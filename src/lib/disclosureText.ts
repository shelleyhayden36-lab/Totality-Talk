export const TOTALITY_TALK_DISCLOSURE_TEXT = `Welcome to Totality Talk.

I am your debate assistant. Before you join the panel, I will review the debate guidelines and technology notice.

Totality Talk is a public debate focused on respectful discussion, staying on topic, and the exchange of ideas.

If you are new to formal debate, that is okay. Please let the host know, and they can explain the debate format and phases before you begin.

Please follow these rules:

• No personal attacks. Challenge ideas, not people.
• No poisoning the well. Address the claim being presented rather than attempting to discredit it through unrelated attacks on a source, person, or organization.
• Stay on topic. Keep your responses relevant to the current debate question.
• No interrupting. Allow each speaker to finish their statement.
• No hate speech or targeted harassment.
• Follow instructions from the host and moderators.
• You must be 21 years or older to participate unless approved by the host.
• When your timer ends, finish your current statement before the next speaker continues.

Fallacy Notice:

Debaters are responsible for understanding and identifying logical fallacies during discussion. The host will enforce rules regarding personal attacks and poisoning the well, but will not stop the debate to identify or correct every possible fallacy.

Participants are encouraged to focus on addressing arguments, evidence, and claims rather than turning the debate into a discussion about fallacy labels.

AI Accessibility Notice:

This livestream uses AI-assisted technology to provide live captions and improve accessibility. Audio from the livestream may be processed into text to help viewers follow the discussion.

The transcription system may also be used to identify possible claims during the debate. Any AI-identified claims are reviewed by the host before being added to the debate record.

Additional AI tools may assist with reviewing information or evidence, but AI does not decide winners, assign scores, or replace human judgment.

Some visuals shown during the livestream may be AI-generated.

By joining the panel, you acknowledge that AI-assisted transcription may process your audio during the livestream.

If you agree to participate, please say:

“I agree,” and state your age for TikTok participation requirements.

If you do not agree to these terms, please disconnect from the panel. If you remain on the panel without agreeing, you may be removed.

Thank you for joining Totality Talk.

Have a great debate.`;

export interface TTSVoiceConfig {
  voiceURI?: string;
  voiceName?: string;
  presetId?: string;
  pitch?: number; // 0.5 to 2.0
  rate?: number;  // 0.5 to 2.0
  volume?: number; // 0 to 1
}

export interface TTSVoiceOption {
  uri: string;
  name: string;
  lang: string;
  default: boolean;
}

export function getAvailableTTSVoices(): TTSVoiceOption[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return [];
  }
  const voices = window.speechSynthesis.getVoices() || [];
  return voices.map(v => ({
    uri: v.voiceURI,
    name: v.name,
    lang: v.lang,
    default: v.default
  }));
}

export interface DisclosureSegment {
  id: number;
  text: string;
  startIndex: number;
  endIndex: number;
  isBullet: boolean;
  isHeader: boolean;
}

export function parseDisclosureSegments(text: string): DisclosureSegment[] {
  const lines = text.split('\n');
  const segments: DisclosureSegment[] = [];
  let searchStart = 0;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      const linePos = text.indexOf(trimmed, searchStart);
      const start = linePos >= 0 ? linePos : searchStart;
      const end = start + trimmed.length;
      searchStart = end;

      const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
      const isHeader = trimmed.endsWith(':') || trimmed === 'Welcome to Totality Talk.';

      segments.push({
        id: idx,
        text: trimmed,
        startIndex: start,
        endIndex: end,
        isBullet,
        isHeader
      });
    }
  });

  return segments;
}

// Global reference to retain utterances and prevent browser garbage collection mid-speech
let activeGlobalUtterances: SpeechSynthesisUtterance[] = [];
let activeKeepAliveTimer: any = null;
let currentTTSController: { cancel: () => void } | null = null;

/**
 * Finds a guaranteed feminine voice or user-configured preferred voice from available browser voices.
 */
export function findFeminineVoice(voices: SpeechSynthesisVoice[], config?: TTSVoiceConfig): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined;

  if (config?.voiceURI) {
    const matched = voices.find(v => v.voiceURI === config.voiceURI);
    if (matched) return matched;
  }
  if (config?.presetId) {
    const matched = voices.find(v => v.name.toLowerCase().includes(config.presetId!.toLowerCase()));
    if (matched) return matched;
  }

  const femaleKeywords = [
    'samantha', 'karen', 'zira', 'victoria', 'fiona', 'serena', 'moira', 
    'tessa', 'katelyn', 'susan', 'jenny', 'aria', 'sonia', 'female', 
    'woman', 'google uk english female', 'google us english female', 'natural'
  ];

  const maleKeywords = ['daniel', 'alex', 'fred', 'david', 'mark', 'george', 'oliver', 'james', 'guy', 'thomas', 'male', 'man', 'boy'];

  const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));

  // First try: English voice matching female keywords and excluding male keywords
  for (const kw of femaleKeywords) {
    const found = englishVoices.find(v => {
      const name = v.name.toLowerCase();
      return name.includes(kw) && !maleKeywords.some(m => name.includes(m));
    });
    if (found) return found;
  }

  // Second try: Any English voice NOT matching male keywords
  const nonMaleEn = englishVoices.find(v => {
    const name = v.name.toLowerCase();
    return !maleKeywords.some(m => name.includes(m));
  });
  if (nonMaleEn) return nonMaleEn;

  // Fallback: Any voice excluding male keywords, or first voice
  return voices.find(v => !maleKeywords.some(m => v.name.toLowerCase().includes(m))) || voices[0];
}

/**
 * Function to speak the disclosure text using SpeechSynthesis with articulate voice options and auto-progression tracking for the teleprompter.
 */
export function playDisclosureTTS(
  text: string, 
  config?: TTSVoiceConfig,
  onProgress?: (charIndex: number, length: number) => void,
  onEnd?: () => void,
  onStart?: () => void
): { cancel: () => void } | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) setTimeout(onEnd, 50);
    return null;
  }

  // Cancel any active TTS session first
  stopTTS();

  const segments = parseDisclosureSegments(text);
  if (!segments || segments.length === 0) {
    if (onEnd) setTimeout(onEnd, 50);
    return null;
  }

  let isCancelled = false;
  let keepAliveInterval: any = null;
  let clockTimer: any = null;
  let currentSegmentIndex = 0;
  const totalLen = text.length;

  const cancelSession = () => {
    isCancelled = true;
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (clockTimer) clearInterval(clockTimer);
    activeGlobalUtterances = [];
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  };

  const startSpeechExecution = () => {
    if (isCancelled) return;

    const voices = window.speechSynthesis.getVoices() || [];
    const chosenVoice = findFeminineVoice(voices, config);

    let highestCharIndex = 0;
    let segmentStartTime = performance.now();

    // Safe keep-alive: only call resume() if paused or speaking to prevent Chrome auto-kill
    keepAliveInterval = setInterval(() => {
      if (isCancelled) {
        clearInterval(keepAliveInterval);
        return;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 2500);
    activeKeepAliveTimer = keepAliveInterval;

    const rate = config?.rate ?? 0.88;
    const pitch = config?.pitch ?? 1.0;
    const volume = config?.volume ?? 1.0;

    const speakSegment = (idx: number) => {
      if (isCancelled) return;

      if (idx >= segments.length) {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        if (clockTimer) clearInterval(clockTimer);
        activeGlobalUtterances = [];
        if (onProgress) onProgress(totalLen, totalLen);
        if (onEnd) onEnd();
        return;
      }

      currentSegmentIndex = idx;
      const seg = segments[idx];
      segmentStartTime = performance.now();

      // Clean text for speech synthesis to prevent Chrome engine errors on bullet symbols
      const cleanedText = seg.text.replace(/^[•\-\*\s]+/, '').trim();
      if (!cleanedText) {
        // Skip empty segments if any
        const nextIdx = idx + 1;
        if (nextIdx < segments.length) {
          speakSegment(nextIdx);
        } else {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          if (clockTimer) clearInterval(clockTimer);
          activeGlobalUtterances = [];
          if (onProgress) onProgress(totalLen, totalLen);
          if (onEnd) onEnd();
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.pitch = pitch;
      utterance.rate = rate;
      utterance.volume = volume;
      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }

      activeGlobalUtterances = [utterance];

      utterance.onstart = () => {
        if (isCancelled) return;
        segmentStartTime = performance.now();
        if (idx === 0 && onStart) onStart();
        if (seg.startIndex > highestCharIndex) {
          highestCharIndex = seg.startIndex;
          if (onProgress) onProgress(highestCharIndex, totalLen);
        }
      };

      utterance.onboundary = (e) => {
        if (isCancelled) return;
        if (e.charIndex !== undefined && e.charIndex >= 0) {
          const currentPos = seg.startIndex + e.charIndex;
          if (currentPos > highestCharIndex && currentPos <= totalLen) {
            highestCharIndex = currentPos;
            if (onProgress) onProgress(highestCharIndex, totalLen);
          }
        }
      };

      utterance.onend = () => {
        if (isCancelled) return;
        if (seg.endIndex > highestCharIndex) {
          highestCharIndex = seg.endIndex;
          if (onProgress) onProgress(highestCharIndex, totalLen);
        }
        const nextIdx = idx + 1;
        if (nextIdx < segments.length) {
          setTimeout(() => speakSegment(nextIdx), 30);
        } else {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          if (clockTimer) clearInterval(clockTimer);
          activeGlobalUtterances = [];
          if (onProgress) onProgress(totalLen, totalLen);
          if (onEnd) onEnd();
        }
      };

      utterance.onerror = (e) => {
        console.warn(`[TTS] Error on segment ${idx}:`, e);
        if (isCancelled) return;
        if (e.error === 'interrupted' || e.error === 'canceled') {
          return;
        }
        const nextIdx = idx + 1;
        if (nextIdx < segments.length) {
          setTimeout(() => speakSegment(nextIdx), 50);
        } else {
          if (keepAliveInterval) clearInterval(keepAliveInterval);
          if (clockTimer) clearInterval(clockTimer);
          activeGlobalUtterances = [];
          if (onEnd) onEnd();
        }
      };

      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[TTS] Speak error:', err);
      }
    };

    // Teleprompter monotonic fallback clock timer
    clockTimer = setInterval(() => {
      if (isCancelled) {
        clearInterval(clockTimer);
        return;
      }
      const curSeg = segments[currentSegmentIndex];
      if (!curSeg) return;

      const charsPerSec = 16 * rate;
      const elapsedSec = (performance.now() - segmentStartTime) / 1000;
      const estimatedPos = Math.floor(curSeg.startIndex + (elapsedSec * charsPerSec));

      const cap = Math.min(totalLen, curSeg.endIndex);
      if (estimatedPos > highestCharIndex && estimatedPos <= cap) {
        highestCharIndex = estimatedPos;
        if (onProgress) onProgress(highestCharIndex, totalLen);
      }
    }, 100);

    // Start segment 0
    speakSegment(0);
  };

  // Ensure voices are loaded before starting speech execution
  const existingVoices = window.speechSynthesis.getVoices();
  if (!existingVoices || existingVoices.length === 0) {
    let voicesLoaded = false;
    const handleVoicesChanged = () => {
      if (!voicesLoaded) {
        voicesLoaded = true;
        window.speechSynthesis.onvoiceschanged = null;
        startSpeechExecution();
      }
    };
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    setTimeout(() => {
      if (!voicesLoaded) {
        voicesLoaded = true;
        startSpeechExecution();
      }
    }, 150);
  } else {
    startSpeechExecution();
  }

  const controller = { cancel: cancelSession };
  currentTTSController = controller;
  return controller;
}

// Backward compatibility alias
export const playSemiFeminineRoboticTTS = (text: string) => playDisclosureTTS(text);

export function stopTTS() {
  if (currentTTSController) {
    currentTTSController.cancel();
    currentTTSController = null;
  }
  if (activeKeepAliveTimer) {
    clearInterval(activeKeepAliveTimer);
    activeKeepAliveTimer = null;
  }
  activeGlobalUtterances = [];
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

