export const TOTALITY_TALK_DISCLOSURE_TEXT = `Welcome to Totality Talk! I am your debate assistant. Before you join the panel, I will review the debate guidelines and technology notice.

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

export const TOTALITY_TALK_SHORT_DISCLOSURE_TEXT = `Welcome to Totality Talk! If you're new to debating, let the host know and she'll explain each phase before it begins.

Please take a moment to review the debate rules. The host will only call out ad hominem and poisoning the well. All other logical fallacies are the responsibility of the debaters to recognize and address.

For transparency, this live uses AI to process panel audio for live captions, identify debate claims, and assist with routine moderation tasks. AI helps support the debate but does not determine the winner.

By joining the panel, you acknowledge that AI-assisted transcription may process your audio during the livestream.

If you agree to participate, please say:

“I agree,” and state your age for TikTok participation requirements.

If you do not agree to these terms, please disconnect from the panel. If you remain on the panel without agreeing, you may be removed.

Thank you, and have a great debate!`;

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
  const aiVoices: TTSVoiceOption[] = [
    { uri: 'ai-aoede', name: 'AI Studio Voice - Aoede (Expressive Female)', lang: 'en-US', default: true },
    { uri: 'ai-kore', name: 'AI Studio Voice - Kore (Warm Female)', lang: 'en-US', default: false },
    { uri: 'ai-zephyr', name: 'AI Studio Voice - Zephyr (Calm Female)', lang: 'en-US', default: false },
    { uri: 'ai-puck', name: 'AI Studio Voice - Puck (Friendly Male)', lang: 'en-US', default: false },
    { uri: 'ai-fenrir', name: 'AI Studio Voice - Fenrir (Deep Male)', lang: 'en-US', default: false },
  ];
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return aiVoices;
  }
  const voices = window.speechSynthesis.getVoices() || [];
  const browserVoices = voices.map(v => ({
    uri: v.voiceURI,
    name: `Browser: ${v.name}`,
    lang: v.lang,
    default: false
  }));
  return [...aiVoices, ...browserVoices];
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

/**
 * Calculates weighted character position mapping spoken time fraction to segments,
 * accounting for pauses in headers, bullet points, and sentence ends.
 */
export function getWeightedCharPos(
  segments: DisclosureSegment[],
  fraction: number,
  totalLen: number
): number {
  if (!segments || segments.length === 0 || fraction <= 0) {
    return 0;
  }
  if (fraction >= 1) {
    return totalLen;
  }

  let totalWeight = 0;
  const weightedList = segments.map(seg => {
    const textLen = seg.text.length;
    const sentenceCount = (seg.text.match(/[\.\!\?\:]+/g) || []).length;
    
    // Header pauses (titles/colons): +45 weight
    const headerExtra = seg.isHeader ? 45 : 0;
    
    // Bullet item pauses: +35 weight
    const bulletExtra = seg.isBullet ? 35 : 0;
    
    // Sentence pauses: +18 weight per boundary
    const sentenceExtra = Math.max(1, sentenceCount) * 18;
    
    // Paragraph gap extra
    const gapExtra = 22;

    const weight = textLen + headerExtra + bulletExtra + sentenceExtra + gapExtra;
    const start = totalWeight;
    totalWeight += weight;
    return {
      seg,
      start,
      end: totalWeight,
      weight
    };
  });

  if (totalWeight <= 0) return Math.floor(fraction * totalLen);

  const currentWeightPos = fraction * totalWeight;

  for (let i = 0; i < weightedList.length; i++) {
    const item = weightedList[i];
    if (currentWeightPos >= item.start && currentWeightPos <= item.end) {
      const segFraction = item.weight > 0 ? (currentWeightPos - item.start) / item.weight : 0;
      const charSpan = item.seg.endIndex - item.seg.startIndex;
      return Math.min(totalLen, Math.floor(item.seg.startIndex + segFraction * charSpan));
    }
  }

  return Math.min(totalLen, Math.floor(fraction * totalLen));
}

// Global references to manage audio, speech synthesis, and teleprompter animation frames
let activeAudio: HTMLAudioElement | null = null;
let activeAudioUrl: string | null = null;
let activeGlobalUtterances: SpeechSynthesisUtterance[] = [];
let activeKeepAliveTimer: any = null;
let activeAnimFrameId: number | null = null;
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
    'natural', 'google us english', 'google uk english female', 'jenny', 'aria', 
    'samantha', 'karen', 'zira', 'victoria', 'fiona', 'serena', 'moira', 
    'tessa', 'katelyn', 'susan', 'sonia', 'female', 'woman'
  ];

  const maleKeywords = ['daniel', 'alex', 'fred', 'david', 'mark', 'george', 'oliver', 'james', 'guy', 'thomas', 'male', 'man', 'boy'];

  const englishVoices = voices.filter(v => v.lang.toLowerCase().startsWith('en'));

  // First try: Natural or Premium English human voice
  const naturalEnVoice = englishVoices.find(v => {
    const name = v.name.toLowerCase();
    return (name.includes('natural') || name.includes('online') || name.includes('google us english') || name.includes('samantha')) && !maleKeywords.some(m => name.includes(m));
  });
  if (naturalEnVoice) return naturalEnVoice;

  // Second try: Any English voice matching keywords
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
 * Fallback SpeechSynthesis execution if server AI TTS fails or is unavailable.
 */
function playWebSpeechTTSFallback(
  text: string, 
  config?: TTSVoiceConfig,
  onProgress?: (charIndex: number, length: number) => void,
  onEnd?: () => void,
  onStart?: () => void,
  parentController?: { cancel: () => void }
) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    if (onEnd) setTimeout(onEnd, 50);
    return;
  }

  const segments = parseDisclosureSegments(text);
  if (!segments || segments.length === 0) {
    if (onEnd) setTimeout(onEnd, 50);
    return;
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

  if (parentController) {
    const origCancel = parentController.cancel;
    parentController.cancel = () => {
      cancelSession();
      try { origCancel(); } catch (e) {}
    };
  }

  const startSpeechExecution = () => {
    if (isCancelled) return;

    const voices = window.speechSynthesis.getVoices() || [];
    const chosenVoice = findFeminineVoice(voices, config);

    let highestCharIndex = 0;
    let segmentStartTime = performance.now();

    keepAliveInterval = setInterval(() => {
      if (isCancelled) {
        clearInterval(keepAliveInterval);
        return;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          try { window.speechSynthesis.resume(); } catch (e) {}
        }
      }
    }, 2500);
    activeKeepAliveTimer = keepAliveInterval;

    const rate = config?.rate ?? 0.95;
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

      const cleanedText = seg.text.replace(/^[•\-\*\s]+/, '').trim();
      if (!cleanedText) {
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

    clockTimer = setInterval(() => {
      if (isCancelled) {
        clearInterval(clockTimer);
        return;
      }
      const curSeg = segments[currentSegmentIndex];
      if (!curSeg) return;

      const charsPerSec = 11.5 * rate; // Realistic human speech pace (~130 WPM)
      const elapsedSec = (performance.now() - segmentStartTime) / 1000;
      const estimatedPos = Math.floor(curSeg.startIndex + (elapsedSec * charsPerSec));

      // Limit timer estimation to 80% of current segment to avoid jumping ahead before utterance completes
      const segSpan = curSeg.endIndex - curSeg.startIndex;
      const segCap = curSeg.startIndex + Math.floor(segSpan * 0.80);
      const cap = Math.min(totalLen, segCap);
      if (estimatedPos > highestCharIndex && estimatedPos <= cap) {
        highestCharIndex = estimatedPos;
        if (onProgress) onProgress(highestCharIndex, totalLen);
      }
    }, 100);

    speakSegment(0);
  };

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
}

/**
 * Function to speak the disclosure text using server AI voiceover audio with real-time teleprompter tracking.
 */
export function playDisclosureTTS(
  text: string, 
  config?: TTSVoiceConfig,
  onProgress?: (charIndex: number, length: number) => void,
  onEnd?: () => void,
  onStart?: () => void
): { cancel: () => void } | null {
  stopTTS();

  let isCancelled = false;
  const totalLen = text.length;

  const isAIVoice = config?.voiceURI ? config.voiceURI.startsWith('ai-') : false;

  // Synchronously warm up browser SpeechSynthesis within current user gesture context
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
      const dummy = new SpeechSynthesisUtterance('');
      dummy.volume = 0;
      window.speechSynthesis.speak(dummy);
    } catch (e) {}
  }

  let aiVoiceName = "Aoede";
  if (config?.voiceURI) {
    if (config.voiceURI === 'ai-aoede' || config.voiceURI.toLowerCase().includes('aoede')) aiVoiceName = "Aoede";
    else if (config.voiceURI === 'ai-kore' || config.voiceURI.toLowerCase().includes('kore')) aiVoiceName = "Kore";
    else if (config.voiceURI === 'ai-zephyr' || config.voiceURI.toLowerCase().includes('zephyr')) aiVoiceName = "Zephyr";
    else if (config.voiceURI === 'ai-puck' || config.voiceURI.toLowerCase().includes('puck')) aiVoiceName = "Puck";
    else if (config.voiceURI === 'ai-fenrir' || config.voiceURI.toLowerCase().includes('fenrir')) aiVoiceName = "Fenrir";
  }

  const controller = {
    cancel: () => {
      isCancelled = true;
      if (activeAudio) {
        try {
          activeAudio.pause();
          activeAudio.currentTime = 0;
        } catch (e) {}
        activeAudio = null;
      }
      if (activeAudioUrl) {
        try { URL.revokeObjectURL(activeAudioUrl); } catch (e) {}
        activeAudioUrl = null;
      }
      if (activeKeepAliveTimer) {
        clearInterval(activeKeepAliveTimer);
        activeKeepAliveTimer = null;
      }
      if (activeAnimFrameId) {
        cancelAnimationFrame(activeAnimFrameId);
        activeAnimFrameId = null;
      }
      activeGlobalUtterances = [];
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
    }
  };
  currentTTSController = controller;

  // Direct synchronous Web Speech route for native browser/system voices
  if (!isAIVoice) {
    playWebSpeechTTSFallback(text, config, onProgress, onEnd, onStart, controller);
    return controller;
  }

  fetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceName: aiVoiceName })
  })
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
  })
  .then(blob => {
    if (isCancelled) return;
    if (!blob || blob.type.includes('json') || blob.size < 1000) {
      throw new Error("Invalid audio response");
    }
    const url = URL.createObjectURL(blob);
    activeAudioUrl = url;
    const audio = new Audio(url);
    activeAudio = audio;

    const segments = parseDisclosureSegments(text);
    let animFrameId: number | null = null;
    const startAnimationFrameLoop = () => {
      const updateFrame = () => {
        if (isCancelled || !activeAudio) return;
        if (activeAudio.duration > 0 && !activeAudio.paused && !activeAudio.ended) {
          const fraction = Math.min(1, Math.max(0, activeAudio.currentTime / activeAudio.duration));
          const currentCharPos = getWeightedCharPos(segments, fraction, totalLen);
          if (onProgress) onProgress(currentCharPos, totalLen);
          animFrameId = requestAnimationFrame(updateFrame);
          activeAnimFrameId = animFrameId;
        }
      };
      animFrameId = requestAnimationFrame(updateFrame);
      activeAnimFrameId = animFrameId;
    };

    audio.onplay = () => {
      if (isCancelled) return;
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
      }
      if (onStart) onStart();
      startAnimationFrameLoop();
    };

    audio.ontimeupdate = () => {
      if (isCancelled) return;
      if (audio.duration > 0 && activeAudio) {
        const fraction = Math.min(1, Math.max(0, activeAudio.currentTime / activeAudio.duration));
        const currentCharPos = getWeightedCharPos(segments, fraction, totalLen);
        if (onProgress) onProgress(currentCharPos, totalLen);
      }
    };

    audio.onended = () => {
      if (isCancelled) return;
      if (activeAnimFrameId) {
        cancelAnimationFrame(activeAnimFrameId);
        activeAnimFrameId = null;
      }
      if (onProgress) onProgress(totalLen, totalLen);
      if (onEnd) onEnd();
      if (activeAudioUrl) {
        try { URL.revokeObjectURL(activeAudioUrl); } catch (e) {}
        activeAudioUrl = null;
      }
      activeAudio = null;
    };

    audio.onerror = () => {
      console.info("[TTS] Audio playback fallback to Web Speech");
      if (!isCancelled) {
        playWebSpeechTTSFallback(text, config, onProgress, onEnd, onStart, controller);
      }
    };

    audio.play().catch(() => {
      console.info("[TTS] Audio play fallback to Web Speech");
      if (!isCancelled) {
        playWebSpeechTTSFallback(text, config, onProgress, onEnd, onStart, controller);
      }
    });
  })
  .catch(() => {
    console.info("[TTS] Server AI voiceover unavailable, using browser Web Speech fallback.");
    if (!isCancelled) {
      playWebSpeechTTSFallback(text, config, onProgress, onEnd, onStart, controller);
    }
  });

  return controller;
}

// Backward compatibility alias
export const playSemiFeminineRoboticTTS = (text: string) => playDisclosureTTS(text);

export function stopTTS() {
  const controllerToCancel = currentTTSController;
  currentTTSController = null;
  if (controllerToCancel) {
    try {
      controllerToCancel.cancel();
    } catch (e) {}
  }
  if (activeAnimFrameId) {
    cancelAnimationFrame(activeAnimFrameId);
    activeAnimFrameId = null;
  }
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch (e) {}
    activeAudio = null;
  }
  if (activeAudioUrl) {
    try { URL.revokeObjectURL(activeAudioUrl); } catch (e) {}
    activeAudioUrl = null;
  }
  if (activeKeepAliveTimer) {
    clearInterval(activeKeepAliveTimer);
    activeKeepAliveTimer = null;
  }
  activeGlobalUtterances = [];
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch (e) {}
  }
}

