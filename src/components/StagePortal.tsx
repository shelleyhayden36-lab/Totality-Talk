import React, { useState, useEffect, useRef } from 'react';
import { DebateState } from '../App';
import LobbyLayout from './stage/LobbyLayout';
import OpeningLayout from './stage/OpeningLayout';
import CrossExamLayout from './stage/CrossExamLayout';
import RebuttalLayout from './stage/RebuttalLayout';
import ChatQLayout from './stage/ChatQLayout';
import ClosingLayout from './stage/ClosingLayout';
import FloorLayout from './stage/FloorLayout';
import HighlightsLayout from './stage/HighlightsLayout';
import WinnerLayout from './stage/WinnerLayout';
import CreditsLayout from './stage/CreditsLayout';
import { X, Volume2, VolumeX, Megaphone, Pin, PinOff, ChevronUp, ChevronDown, Move, AlertTriangle, AlertCircle, ShieldAlert, ShieldCheck, CheckCircle2, Bot, Sparkles, Sliders, RotateCcw, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playPenaltyBuzzerSound } from '../utils/audio';
import { TOTALITY_TALK_DISCLOSURE_TEXT, TOTALITY_TALK_SHORT_DISCLOSURE_TEXT, playDisclosureTTS, stopTTS, getAvailableTTSVoices, TTSVoiceOption, parseDisclosureSegments, DisclosureSegment, findFeminineVoice } from '../lib/disclosureText';
import { getActivePhaseTranscripts, limitUnsavedTranscripts, cleanAndFormatTranscriptText, ACCENT_LANGUAGE_OPTIONS } from '../lib/transcriptUtils';

interface StagePortalProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
  onExit?: () => void;
  suppressAudio?: boolean;
}

function formatNonVerbalSounds(text: string): string {
  if (!text) return text;
  let formatted = text;

  // Remove "order in court" from captions as requested
  formatted = formatted.replace(/\b(order\s+in\s+court)\b/gi, '');

  // Transform spoken non-speech descriptions into live caption cues
  const soundRules: [RegExp, string][] = [
    [/\b(talking\s+over|speaking\s+over|talking\s+at\s+the\s+same\s+time|multiple\s+people\s+talking|voices?\s+overlapping|overlapping\s+speech|cross-?talk|garbled\s+audio|unintelligible|indistinguishable|everyone(?:\s+is)?\s+talking|shouting\s+over|simultaneous\s+speech|overlapping\s+voices|commotion)\b/gi, '[multiple people talking - unable to caption]'],
    [/\b(coughing|coughed|cough|cough\s+cough)\b/gi, '[cough]'],
    [/\b(clears?\s+throat|throat\s+clearing|ahem+)\b/gi, '[clears throat]'],
    [/\b(laughing|laughs|laughed|hahaha+|hehehe+|rofl|giggle|giggling|chuckle|chuckling)\b/gi, '[laughing]'],
    [/\b(sighing|sighs|sighed|sigh|breathing|heavy\s+breath|exhale|exhaling|pant|panting)\b/gi, '[sigh]'],
    [/\b(applause|clapping|cheering|cheers)\b/gi, '[applause]'],
    [/\b(gasping|gasped|gasp)\b/gi, '[gasp]'],
    [/\b(sneezing|sneezed|sneeze)\b/gi, '[sneeze]'],
  ];

  for (const [regex, replacement] of soundRules) {
    formatted = formatted.replace(regex, replacement);
  }

  // Deduplicate consecutive identical tags like "[cough] [cough]" -> "[cough]"
  formatted = formatted.replace(/(\[[^\]]+\])(\s+\1)+/gi, '$1');

  return formatted.trim();
}

function estimatePitch(buffer: Float32Array, sampleRate: number): number {
  let SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.012) return -1; // Silent or background

  let r1 = 0, r2 = SIZE - 1;
  const thres = 0.15;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  const buf = buffer.slice(r1, r2);
  SIZE = buf.length;

  const c = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buf[j] * buf[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  const T0 = maxpos;
  if (T0 <= 0) return -1;

  const pitch = sampleRate / T0;
  if (pitch < 65 || pitch > 450) return -1;
  return pitch;
}

function getStaticCaptionChunk(text: string, maxChars: number = 95): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  // Split by sentence/clause boundaries (. ! ? ; ,)
  const clauses = trimmed.split(/(?<=[.!?;,])\s+/);
  if (clauses.length > 1) {
    let chunk = '';
    for (let i = clauses.length - 1; i >= 0; i--) {
      const candidate = chunk ? clauses[i] + ' ' + chunk : clauses[i];
      if (candidate.length <= maxChars) {
        chunk = candidate;
      } else {
        if (!chunk) {
          chunk = clauses[i];
        }
        break;
      }
    }
    if (chunk && chunk.length <= maxChars) return chunk;
  }

  // Fallback: Take trailing part cleanly at a word boundary
  const substring = trimmed.slice(-maxChars);
  const firstSpaceIndex = substring.indexOf(' ');
  if (firstSpaceIndex > 0 && firstSpaceIndex < 25) {
    return substring.slice(firstSpaceIndex + 1);
  }
  return substring;
}

function StaticSubtitleBlock({ text }: { text: string }) {
  const currentChunk = getStaticCaptionChunk(text, 95);
  const isCrosstalk = /\[(?:multiple\s+people\s+talking|unable\s+to\s+caption|cross-?talk|overlapping\s+speech)[^\]]*\]/i.test(currentChunk);

  return (
    <div className="flex-1 min-w-0 flex items-center min-h-[40px]">
      <p className={`font-sans font-bold text-sm sm:text-base leading-snug tracking-wide line-clamp-2 break-words ${isCrosstalk ? 'text-amber-300 italic' : 'text-white'}`}>
        {currentChunk}
      </p>
    </div>
  );
}

export default function StagePortal({ state, formatTime, onStateUpdate, onExit, suppressAudio }: StagePortalProps) {
  const isAudioSuppressed = suppressAudio || !!onExit;
  // Phase detection: Extract current active phase ID (standardize to uppercase)
  const currentPhaseId = (state?.currentPhase || 'LOBBY').toUpperCase();

  // Find the current phase in state settings to get video options
  const currentPhaseObj = (state?.settings?.phases || []).find(
    p => p.id.toUpperCase() === currentPhaseId
  );

  // Find the current round name
  const currentRoundName = state?.currentRound || 'Round 1';

  // Extract the video url for this phase and round
  let videoUrl = state?.settings?.roundIntroVideos?.[currentRoundName] || '';
  if (!videoUrl) {
    const roundVideoConfig = currentPhaseObj?.roundVideos?.[currentRoundName];
    videoUrl = roundVideoConfig?.videoUrl || currentPhaseObj?.videoUrl || '';
  }

  if (currentPhaseId === 'CLOSING') {
    if (state?.closingSubPhase === 'WINNER') {
      videoUrl = state?.settings?.winnerVideoUrl || videoUrl;
    } else if (state?.settings?.closingVideoUrl) {
      videoUrl = state?.settings?.closingVideoUrl;
    }
  } else if (currentPhaseId === 'WINNER' && state?.settings?.winnerVideoUrl) {
    videoUrl = state.settings.winnerVideoUrl;
  }

  const [showVideoOverlay, setShowVideoOverlay] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [lastVideoKey, setLastVideoKey] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Popular vote widget alternating view state & top bar docking state (30s Gauge / 45s Instructions cycle)
  const [widgetView, setWidgetView] = useState<'gauge' | 'scroll'>('gauge');
  const [isPopularVoteDocked, setIsPopularVoteDocked] = useState(false);

  useEffect(() => {
    // 30 seconds for Gauge view, 45 seconds for Instructions view
    const duration = widgetView === 'gauge' ? 30000 : 45000;
    const timer = setTimeout(() => {
      setWidgetView(prev => prev === 'gauge' ? 'scroll' : 'gauge');
    }, duration);
    return () => clearTimeout(timer);
  }, [widgetView]);

  // Floating hearts reaction state
  interface FloatingHeart {
    id: string;
    x: number;
    size: number;
    color: string;
    duration: number;
    swayOffset: number;
  }
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  // Track total likes to synchronize floating hearts reaction from the webhook
  const lastTotalLikesRef = useRef<number | null>(null);

  // Helper function to pick heart color based on active team selection
  const getRandomHeartColor = (activeTeam: 'PRO' | 'CON' | null) => {
    if (activeTeam === 'PRO') {
      const proColors = ['#3b82f6', '#60a5fa', '#2563eb', '#38bdf8', '#00f2ff'];
      return proColors[Math.floor(Math.random() * proColors.length)];
    } else if (activeTeam === 'CON') {
      const conColors = ['#ef4444', '#f87171', '#dc2626', '#fb7185', '#f43f5e'];
      return conColors[Math.floor(Math.random() * conColors.length)];
    } else {
      // Rainbow multi-color effect when no team is active/selected
      const rainbowColors = ['#ff007f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#a855f7', '#e11d48', '#38bdf8', '#f43f5e'];
      return rainbowColors[Math.floor(Math.random() * rainbowColors.length)];
    }
  };

  // Keydown listener for 'L' to trigger floating hearts from the lower stage and register with popular vote webhook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        )) {
          return;
        }

        // Determine active team color
        const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
        let activeTeam: 'PRO' | 'CON' | null = null;
        if (speaker) {
          activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
        } else if (state?.currentPhase === 'REBUTTAL') {
          activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
        } else if (state?.currentPhase === 'CHAT_Q') {
          activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
        }

        const newHearts: FloatingHeart[] = [];
        // Spawn 2-3 hearts for a rich press effect
        const count = Math.floor(Math.random() * 2) + 2;
        for (let i = 0; i < count; i++) {
          const id = Math.random().toString(36).substring(2, 9);
          const heart: FloatingHeart = {
            id,
            x: Math.random() * 80 + 10, // Random X from 10% to 90% at lower stage
            size: Math.random() * 12 + 18, // Size 18px to 30px
            color: getRandomHeartColor(activeTeam),
            duration: Math.random() * 1.5 + 3.2, // Float duration 3.2s to 4.7s
            swayOffset: Math.random() * 30 - 15,
          };
          newHearts.push(heart);

          // Clean up heart after animation
          setTimeout(() => {
            setHearts(prev => prev.filter(h => h.id !== id));
          }, 5000);
        }

        setHearts(prev => [...prev, ...newHearts]);

        // Advance lastTotalLikesRef immediately to prevent duplicate local rendering on webhook feedback loop
        if (lastTotalLikesRef.current !== null) {
          lastTotalLikesRef.current += 1;
        }

        // Connect L key function with popular vote webhook
        fetch('/webhooks/tikfinity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'L-Key User',
            nickname: 'L-Key Viewer',
            likeCount: 1,
          }),
        }).catch(err => console.error('Failed to trigger popular vote webhook from L key:', err));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state?.currentSpeakerId, state?.participants, state?.currentPhase, state?.rebuttalRebutterTeam, state?.chatSpeakingTeam]);

  // Sync incoming popular vote changes to spawn hearts for all clients
  useEffect(() => {
    const totalLikes = (state?.popularVotes?.pro ?? 0) + (state?.popularVotes?.con ?? 0);
    
    if (lastTotalLikesRef.current === null) {
      lastTotalLikesRef.current = totalLikes;
      return;
    }

    if (totalLikes > lastTotalLikesRef.current) {
      const diff = totalLikes - lastTotalLikesRef.current;
      lastTotalLikesRef.current = totalLikes;

      const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
      let activeTeam: 'PRO' | 'CON' | null = null;
      if (speaker) {
        activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
      } else if (state?.currentPhase === 'REBUTTAL') {
        activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
      } else if (state?.currentPhase === 'CHAT_Q') {
        activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
      }

      const numHeartsToSpawn = Math.min(diff, 15);
      const spawnedHearts: FloatingHeart[] = [];

      for (let i = 0; i < numHeartsToSpawn; i++) {
        const id = Math.random().toString(36).substring(2, 9);
        spawnedHearts.push({
          id,
          x: Math.random() * 80 + 10,
          size: Math.random() * 12 + 18,
          color: getRandomHeartColor(activeTeam),
          duration: Math.random() * 1.5 + 3.2,
          swayOffset: Math.random() * 30 - 15,
        });

        setTimeout(() => {
          setHearts(prev => prev.filter(h => h.id !== id));
        }, 5000);
      }

      setHearts(prev => [...prev, ...spawnedHearts]);
    } else if (totalLikes < lastTotalLikesRef.current) {
      lastTotalLikesRef.current = totalLikes;
    }
  }, [
    state?.popularVotes?.pro,
    state?.popularVotes?.con,
    state?.participants,
    state?.currentSpeakerId,
    state?.currentPhase,
    state?.rebuttalRebutterTeam,
    state?.chatSpeakingTeam
  ]);

  // Play buzzer sound whenever a stage broadcast popup / penalty popup overlay opens or when a rule violation occurs
  const lastActivePopupIdRef = useRef<string | null>(null);
  const lastViolationsCountRef = useRef<number>(state?.violations?.length || 0);
  const lastActiveNoticeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const notice = state?.activeViolationNotice;
    if (!notice) {
      lastActiveNoticeIdRef.current = null;
      return;
    }

    const createdTime = notice.createdTime || (notice.id ? parseInt(notice.id.split('-').pop() || '0', 10) : 0);
    const noSeatedParticipants = !state?.participants || state.participants.length === 0;
    const isLobby = state?.currentPhase === 'LOBBY';
    const isExpired = createdTime > 0 && (Date.now() - createdTime > 15000);
    const isBeforeReset = !!(state?.resetTimestamp && createdTime > 0 && createdTime < state.resetTimestamp);

    if (noSeatedParticipants || isLobby || isExpired || isBeforeReset) {
      if (onStateUpdate) {
        onStateUpdate({ activeViolationNotice: null });
      }
      return;
    }

    if (notice.id !== lastActiveNoticeIdRef.current) {
      lastActiveNoticeIdRef.current = notice.id;
      if (!isAudioSuppressed) playPenaltyBuzzerSound();
    }

    if (onStateUpdate) {
      const timer = setTimeout(() => {
        onStateUpdate({ activeViolationNotice: null });
      }, 15000); // Auto-closes after 15 seconds on stage
      return () => clearTimeout(timer);
    }
  }, [state?.activeViolationNotice?.id, state?.participants?.length, state?.currentPhase, state?.resetTimestamp, onStateUpdate]);

  useEffect(() => {
    const activePopup = state?.popupTemplates?.find(p => p.isPlaying);
    if (activePopup && activePopup.id !== lastActivePopupIdRef.current) {
      lastActivePopupIdRef.current = activePopup.id;
      if (!isAudioSuppressed) playPenaltyBuzzerSound();
    } else if (!activePopup) {
      lastActivePopupIdRef.current = null;
    }
  }, [state?.popupTemplates, isAudioSuppressed]);

  useEffect(() => {
    const count = state?.violations?.length || 0;
    if (count > lastViolationsCountRef.current) {
      if (!isAudioSuppressed) playPenaltyBuzzerSound();
    }
    lastViolationsCountRef.current = count;
  }, [state?.violations, isAudioSuppressed]);

  const [teleprompterCharIndex, setTeleprompterCharIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<TTSVoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('ai-aoede');
  const [voicePitch, setVoicePitch] = useState<number>(1.0);
  const [voiceRate, setVoiceRate] = useState<number>(0.95);
  const teleprompterRef = useRef<HTMLDivElement>(null);

  // Smart Speaker Tracking & Acoustic Cues State Refs
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Open Captions Speech Activity Tracking
  const [lastSpeechTimestamp, setLastSpeechTimestamp] = useState<number>(0);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTime(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const session = state?.transcriptionSession;
  useEffect(() => {
    if (session?.interimTranscript && session.interimTranscript.trim().length > 0) {
      setLastSpeechTimestamp(Date.now());
    }
  }, [session?.interimTranscript]);

  useEffect(() => {
    if (session?.transcripts && session.transcripts.length > 0) {
      setLastSpeechTimestamp(Date.now());
    }
  }, [session?.transcripts?.length]);

  const speakerIndexRef = useRef(0);
  const lastFinalTimestampRef = useRef(Date.now());
  const lastPitchRef = useRef(-1);
  const speakerPitchProfilesRef = useRef<{ [index: number]: number }>({});
  const interimTextRef = useRef('');

  // Dedicated Live Open Mic Speech Recognition for Open Captions in active phases (Opening, Cross-exam, Floor/Chat, Rebuttal, etc.)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Do NOT run mic recognition when in LOBBY or when full-screen video playback is active
    const isVideoPlaybackActive =
      !currentPhaseId ||
      currentPhaseId === 'LOBBY' ||
      !!state?.activeDisclosureParticipantId ||
      !!state?.introVideoPlaying ||
      !!state?.openingStatementVideoPlayingForParticipantId;

    if (isVideoPlaybackActive) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let recognition: any = null;
    let isStopped = false;
    let audioCtx: AudioContext | null = null;
    let analyserNode: AnalyserNode | null = null;
    let mediaStream: MediaStream | null = null;
    let animFrameId: number | null = null;
    let lastAcousticCueTime = 0;

    // 1. Web Audio API Acoustic Sound & Pitch Detector
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          if (isStopped) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          mediaStream = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          audioCtx = new AudioContextClass();
          const source = audioCtx.createMediaStreamSource(stream);
          analyserNode = audioCtx.createAnalyser();
          analyserNode.fftSize = 1024;
          source.connect(analyserNode);

          const timeData = new Float32Array(analyserNode.fftSize);
          const freqData = new Uint8Array(analyserNode.frequencyBinCount);

          const detectAcoustics = () => {
            if (isStopped || !analyserNode) return;

            analyserNode.getFloatTimeDomainData(timeData);
            analyserNode.getByteFrequencyData(freqData);

            // Calculate RMS energy
            let sumSq = 0;
            for (let i = 0; i < timeData.length; i++) {
              sumSq += timeData[i] * timeData[i];
            }
            const rms = Math.sqrt(sumSq / timeData.length);

            // Calculate high-frequency energy ratio for noise bursts (coughs/throat clears)
            let highFreqSum = 0;
            let totalFreqSum = 0;
            for (let i = 0; i < freqData.length; i++) {
              totalFreqSum += freqData[i];
              if (i > freqData.length / 2) {
                highFreqSum += freqData[i];
              }
            }
            const highFreqRatio = totalFreqSum > 0 ? highFreqSum / totalFreqSum : 0;
            const now = Date.now();

            // Inject non-verbal acoustic cue ONLY if mic senses sharp loud burst (e.g. cough/throat clear) during speech silence
            // Never default low-frequency breathing audio to laughter
            if (rms > 0.22 && highFreqRatio > 0.48 && now - lastAcousticCueTime > 3000 && !interimTextRef.current) {
              lastAcousticCueTime = now;
              const cue = Math.random() > 0.5 ? '[cough]' : '[clears throat]';
              const session = stateRef.current?.transcriptionSession || { id: 'default', transcripts: [] };
              onStateUpdate?.({
                transcriptionSession: {
                  ...session,
                  interimTranscript: cue,
                  isRecording: session.isRecording ?? false
                }
              });
            }

            // Estimate fundamental pitch F0 for voice profiling
            const pitch = estimatePitch(timeData, audioCtx.sampleRate);
            if (pitch > 0) {
              lastPitchRef.current = pitch;
            }

            animFrameId = requestAnimationFrame(detectAcoustics);
          };

          animFrameId = requestAnimationFrame(detectAcoustics);
        }).catch(() => {
          // Silent fallback if microphone permission not granted immediately
        });
      }
    } catch (err) {
      // Ignore audio context errors
    }

    // 2. Web Speech Recognition with Smart Speaker Turn & Non-Verbal Formatting
    try {
      if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        const activeLang = stateRef.current?.transcriptionSession?.transcriptionLanguage || 'en-US';
        recognition.lang = activeLang === 'auto' ? (navigator.language || 'en-US') : activeLang;
        try { recognition.maxAlternatives = 3; } catch (e) {}

        recognition.onresult = (event: any) => {
          let rawInterim = '';
          let rawFinal = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              rawFinal += event.results[i][0].transcript;
            } else {
              rawInterim += event.results[i][0].transcript;
            }
          }

          const curLang = stateRef.current?.transcriptionSession?.transcriptionLanguage || 'en-US';
          const interimText = cleanAndFormatTranscriptText(formatNonVerbalSounds(rawInterim.trim()), curLang);
          const finalText = cleanAndFormatTranscriptText(formatNonVerbalSounds(rawFinal.trim()), curLang);
          interimTextRef.current = interimText;

          const currentState = stateRef.current;
          const hostSpeaker = { id: 'host', name: 'Host / Moderator' };
          const seated = (currentState?.participants || []).filter(p => p.isSeated);
          const availableSpeakers = [hostSpeaker, ...seated];

          const now = Date.now();
          const pauseDuration = now - lastFinalTimestampRef.current;

          // Smart Speaker Turn Determination (Auto-switches between Host & seated debaters):
          if (availableSpeakers.length >= 2) {
            let currentIdx = speakerIndexRef.current;
            const currentPitch = lastPitchRef.current;

            // Check if pitch matches Host's trained/known voice profile (index 0 or hostVoiceProfile in state)
            const hostProfile = currentState?.transcriptionSession?.hostVoiceProfile;
            const hostPitchProfile = hostProfile?.pitchMean || speakerPitchProfilesRef.current[0];
            const isHostVoiceMatch = currentPitch > 0 && hostPitchProfile && hostPitchProfile > 0 && (
              (hostProfile && currentPitch >= hostProfile.pitchMin - 20 && currentPitch <= hostProfile.pitchMax + 20) ||
              Math.abs(currentPitch - hostPitchProfile) < 40
            );

            if (isHostVoiceMatch) {
              // Host interjected! Prioritize Host voice over selected debater seat
              currentIdx = 0;
              speakerIndexRef.current = 0;
            } else if (currentState?.currentSpeakerId) {
              const manualIdx = availableSpeakers.findIndex(s => s.id === currentState.currentSpeakerId);
              if (manualIdx !== -1) {
                currentIdx = manualIdx;
                speakerIndexRef.current = currentIdx;
              }
            } else if (pauseDuration > 1000) {
              // If no seat selected & pause > 1s, do pitch-matching or turn cycling
              let bestMatchIdx = -1;
              let minPitchDiff = 999;
              if (currentPitch > 0) {
                availableSpeakers.forEach((_, idx) => {
                  const pProf = speakerPitchProfilesRef.current[idx];
                  if (pProf && pProf > 0) {
                    const diff = Math.abs(currentPitch - pProf);
                    if (diff < minPitchDiff && diff < 45) {
                      minPitchDiff = diff;
                      bestMatchIdx = idx;
                    }
                  }
                });
              }

              if (bestMatchIdx !== -1) {
                currentIdx = bestMatchIdx;
              } else {
                currentIdx = (currentIdx + 1) % availableSpeakers.length;
              }
              speakerIndexRef.current = currentIdx;
            }

            // Update pitch profile for active speaker
            if (currentPitch > 0) {
              const oldPitch = speakerPitchProfilesRef.current[currentIdx];
              speakerPitchProfilesRef.current[currentIdx] = oldPitch ? oldPitch * 0.7 + currentPitch * 0.3 : currentPitch;
            }
          } else {
            speakerIndexRef.current = 0;
            if (lastPitchRef.current > 0) {
              const oldPitch = speakerPitchProfilesRef.current[0];
              speakerPitchProfilesRef.current[0] = oldPitch ? oldPitch * 0.7 + lastPitchRef.current * 0.3 : lastPitchRef.current;
            }
          }

          const activeSpeaker = availableSpeakers[speakerIndexRef.current % availableSpeakers.length];

          if (interimText) {
            const currentSession = currentState?.transcriptionSession || { id: 'default', transcripts: [] };
            onStateUpdate?.({
              currentSpeakerId: activeSpeaker.id,
              transcriptionSession: {
                ...currentSession,
                interimTranscript: interimText,
                isRecording: currentSession.isRecording ?? false
              }
            });
          }

          if (finalText) {
            lastFinalTimestampRef.current = now;
            const currentSession = currentState?.transcriptionSession || { id: 'default', transcripts: [] };
            const existingTranscripts = currentSession.transcripts || [];

            const activePhaseId = currentState?.currentPhase || 'OPENING';
            const phaseMap: Record<string, string> = {
              LOBBY: 'Lobby Stage',
              OPENING: 'Opening Statements',
              CROSS: 'Cross Examination',
              REBUTTAL: 'Rebuttal Phase',
              REBUTTAL_AFFIRMATIVE: 'Rebuttal Phase',
              REBUTTAL_OPPOSITION: 'Rebuttal Phase',
              FLOOR: 'Floor / Chat Debate',
              CLOSING: 'Closing Statements',
              WINNER: 'Winner Declaration'
            };
            const activePhaseName = phaseMap[activePhaseId] || activePhaseId;

            const newSegment = {
              id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              speakerName: activeSpeaker.name,
              speaker: activeSpeaker.name,
              text: finalText,
              phaseId: activePhaseId,
              phaseName: activePhaseName,
              phase: activePhaseId,
              round: currentState?.currentRound || 'Round 1'
            };

            const isRec = !!currentSession.isRecording;
            const updatedTranscripts = [...existingTranscripts, newSegment];
            const finalTranscripts = limitUnsavedTranscripts(updatedTranscripts, isRec, 15);

            onStateUpdate?.({
              currentSpeakerId: activeSpeaker.id,
              transcriptionSession: {
                ...currentSession,
                interimTranscript: '',
                isRecording: isRec,
                transcripts: finalTranscripts
              }
            });

            // Asynchronous AI Accent & Grammar Smoother (Gemini 3.6 Flash)
            if (currentSession.aiEnhanceEnabled || currentSession.autoTranslateEnabled) {
              const targetId = newSegment.id;
              fetch('/api/transcription/smooth-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: finalText,
                  accent: curLang,
                  language: curLang
                })
              })
              .then(res => res.json())
              .then(data => {
                if (data.smoothedText && data.smoothedText !== finalText) {
                  const latestSession = stateRef.current?.transcriptionSession || { id: 'default', transcripts: [] };
                  const updated = (latestSession.transcripts || []).map(item => {
                    if (item.id === targetId) {
                      return { ...item, text: data.smoothedText };
                    }
                    return item;
                  });
                  onStateUpdate?.({
                    transcriptionSession: {
                      ...latestSession,
                      transcripts: updated
                    }
                  });
                }
              })
              .catch(() => {});
            }
          }
        };

        recognition.onend = () => {
          if (!isStopped) {
            setTimeout(() => {
              if (!isStopped && recognition) {
                try {
                  recognition.start();
                } catch (e) {
                  // ignore continuous restart errors
                }
              }
            }, 100);
          }
        };

        recognition.onerror = (e: any) => {
          if (e?.error === 'aborted' || e?.error === 'no-speech') {
            return;
          }
          // silent handling for expected mic noise/pause events
        };

        recognition.start();
      }
    } catch (err) {
      console.warn('Open captions speech recognition initialization notice:', err);
    }

    return () => {
      isStopped = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (audioCtx) {
        try { audioCtx.close(); } catch (e) {}
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
      }
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
      }
    };
  }, [
    currentPhaseId,
    state?.activeDisclosureParticipantId,
    state?.introVideoPlaying,
    state?.openingStatementVideoPlayingForParticipantId
  ]);

  const selectedVoiceURIRef = React.useRef(selectedVoiceURI);
  React.useEffect(() => {
    selectedVoiceURIRef.current = selectedVoiceURI;
  }, [selectedVoiceURI]);

  // Load available system & AI voices
  useEffect(() => {
    const updateVoices = () => {
      const voices = getAvailableTTSVoices();
      setAvailableVoices(voices);
      if (voices.length > 0 && !selectedVoiceURIRef.current) {
        const pref = voices.find(v => v.default) || voices[0];
        if (pref) {
          selectedVoiceURIRef.current = pref.uri;
          setSelectedVoiceURI(pref.uri);
        }
      }
    };
    updateVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const activeDisclosureText = state?.activeDisclosureParticipantId === 'general'
    ? TOTALITY_TALK_DISCLOSURE_TEXT
    : TOTALITY_TALK_SHORT_DISCLOSURE_TEXT;

  const disclosureSegments = React.useMemo(() => {
    return parseDisclosureSegments(activeDisclosureText);
  }, [activeDisclosureText]);

  const activeSegmentIndex = React.useMemo(() => {
    if (!disclosureSegments.length) return 0;
    for (let i = disclosureSegments.length - 1; i >= 0; i--) {
      if (teleprompterCharIndex >= disclosureSegments[i].startIndex) {
        return i;
      }
    }
    return 0;
  }, [disclosureSegments, teleprompterCharIndex]);

  const activeDisclosureParticipantIdRef = React.useRef<string | null>(null);
  const [isTTSSpeaking, setIsTTSSpeaking] = React.useState(false);

  // Close disclosure overlay without auto-agreeing
  const handleCloseDisclosureOverlay = () => {
    activeDisclosureParticipantIdRef.current = null;
    setIsTTSSpeaking(false);
    stopTTS();

    onStateUpdate?.({
      activeDisclosureParticipantId: null
    });
  };

  const handleManualReplayDisclosureTTS = () => {
    if (isAudioSuppressed) return;
    const activeId = state?.activeDisclosureParticipantId;
    if (!activeId) return;
    const textToSpeak = activeId === 'general' ? TOTALITY_TALK_DISCLOSURE_TEXT : TOTALITY_TALK_SHORT_DISCLOSURE_TEXT;
    activeDisclosureParticipantIdRef.current = activeId;
    setTeleprompterCharIndex(0);
    setIsTTSSpeaking(true);
    playDisclosureTTS(
      textToSpeak,
      {
        voiceURI: selectedVoiceURI,
        pitch: voicePitch,
        rate: voiceRate
      },
      (charIndex) => {
        setTeleprompterCharIndex(charIndex);
      },
      () => {
        setIsTTSSpeaking(false);
      },
      () => {
        setIsTTSSpeaking(true);
      }
    );
  };

  // TTS Trigger Effect for Guidelines & AI Disclosure Notice with Teleprompter tracking & configurable voices
  useEffect(() => {
    if (isAudioSuppressed) {
      if (activeDisclosureParticipantIdRef.current) {
        activeDisclosureParticipantIdRef.current = null;
        setIsTTSSpeaking(false);
        stopTTS();
      }
      return;
    }

    const activeId = state?.activeDisclosureParticipantId || null;

    if (activeId) {
      if (activeDisclosureParticipantIdRef.current !== activeId) {
        activeDisclosureParticipantIdRef.current = activeId;
        setTeleprompterCharIndex(0);
        setIsTTSSpeaking(true);
        const textToSpeak = activeId === 'general' ? TOTALITY_TALK_DISCLOSURE_TEXT : TOTALITY_TALK_SHORT_DISCLOSURE_TEXT;
        playDisclosureTTS(
          textToSpeak,
          {
            voiceURI: selectedVoiceURI,
            pitch: voicePitch,
            rate: voiceRate
          },
          (charIndex) => {
            setTeleprompterCharIndex(charIndex);
          },
          () => {
            setIsTTSSpeaking(false);
          },
          () => {
            setIsTTSSpeaking(true);
          }
        );
      }
    } else {
      if (activeDisclosureParticipantIdRef.current) {
        activeDisclosureParticipantIdRef.current = null;
        setIsTTSSpeaking(false);
        stopTTS();
      }
    }
  }, [state?.activeDisclosureParticipantId]);

  // Auto-scroll teleprompter container to keep the active spoken line centered
  useEffect(() => {
    if (!teleprompterRef.current || !state?.activeDisclosureParticipantId) return;

    const timer = setTimeout(() => {
      const container = teleprompterRef.current;
      if (!container) return;
      const activeEl = document.getElementById(`teleprompter-seg-${activeSegmentIndex}`);
      if (activeEl) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        if (containerRect.height > 0) {
          const relativeTop = activeRect.top - containerRect.top + container.scrollTop;
          const targetScroll = relativeTop - (containerRect.height / 2) + (activeRect.height / 2);

          container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth'
          });
        }
      }
    }, 40);

    return () => clearTimeout(timer);
  }, [activeSegmentIndex, state?.activeDisclosureParticipantId]);

  const currentVideoKey = `${currentPhaseId}_${currentRoundName}_${state?.closingSubPhase || ''}_${state?.declaredWinner || ''}_${videoUrl}`;

  // Reset or trigger video overlay when videoUrl or key changes, or when intro video starts playing
  useEffect(() => {
    if (state?.introVideoPlaying) {
      const introVideoUrl = state?.settings?.openingStatementVideoUrl || state?.settings?.videoUrl || state?.settings?.phases?.find(p => p.id === 'OPENING')?.videoUrl || 'https://assets.totalitytalk.com/videos/lobby_intro.mp4';
      setActiveVideoUrl(introVideoUrl);
      setShowVideoOverlay(true);
      setIsPlaying(true);
      setIsMuted(false);
    } else if (videoUrl) {
      if (currentVideoKey !== lastVideoKey) {
        setLastVideoKey(currentVideoKey);
        setActiveVideoUrl(videoUrl);
        setShowVideoOverlay(true);
        setIsPlaying(true);
        setIsMuted(false); // Load unmuted by default
      }
    } else {
      setShowVideoOverlay(false);
      setActiveVideoUrl('');
    }
  }, [videoUrl, currentVideoKey, lastVideoKey, state?.introVideoPlaying, state?.closingSubPhase, state?.declaredWinner]);

  // Autoplay trigger muted on the stage for instant browser compliance
  useEffect(() => {
    if (showVideoOverlay && activeVideoUrl && videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = isMuted ? 0 : ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;

      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn("Autoplay blocked by browser:", err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        });
    }
  }, [showVideoOverlay, activeVideoUrl, isMuted, state?.settings?.bgMusicVolume]);

  // Background music controller
  useEffect(() => {
    if (isAudioSuppressed) {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      return;
    }

    const trackUrl = state?.settings?.bgMusicTrack;
    if (!trackUrl) {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      return;
    }

    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio(trackUrl);
    } else if (bgMusicRef.current.src !== trackUrl) {
      bgMusicRef.current.pause();
      bgMusicRef.current.src = trackUrl;
    }

    const audio = bgMusicRef.current;

    // Pause background music if any video overlay is active to prevent sound overlap
    if (showVideoOverlay) {
      audio.pause();
      return;
    }

    audio.loop = state?.settings?.bgMusicLoop ?? true;
    audio.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;

    // Direct loop fallback to guarantee repeating playback on all browsers
    audio.onended = () => {
      if (state?.settings?.bgMusicLoop ?? true) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Background music failed to loop/play on ended:", e));
      }
    };

    // Try playing immediately
    audio.play()
      .catch((err) => {
        console.warn("Background music autoplay blocked by browser. This is normal until first interaction.", err);
      });

    const handleInteraction = () => {
      if (bgMusicRef.current && !showVideoOverlay) {
        bgMusicRef.current.play()
          .then(() => {
            cleanup();
          })
          .catch((err) => {
            console.warn("Play failed on interaction:", err);
          });
      }
    };

    const events = ['click', 'mousedown', 'touchstart', 'keydown', 'pointerdown'];
    const cleanup = () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };

    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      cleanup();
    };
  }, [state?.settings?.bgMusicTrack, state?.settings?.bgMusicLoop, state?.settings?.bgMusicVolume, showVideoOverlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  const handleOpeningStatementVideoEnded = () => {
    if (onStateUpdate && state.openingStatementVideoPlayingForParticipantId) {
      const participantId = state.openingStatementVideoPlayingForParticipantId;
      onStateUpdate({
        openingStatementVideoPlayingForParticipantId: null,
        showOpeningStatementPopupForParticipantId: participantId,
        timer: {
          duration: 120,
          timeLeft: 120,
          isRunning: true
        },
        paused: false
      });
    }
  };

  // Handle play/pause toggle
  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Play failed", err);
      });
    }
  };

  // Handle mute toggle
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  // Layout loading system: registry mapping phase IDs to their respective display layout components
  const renderActiveLayout = () => {
    const p = (currentPhaseId || '').toUpperCase();

    if (p.includes('LOBBY') || p.includes('IDLE') || p.includes('SETUP')) {
      return <LobbyLayout state={state} formatTime={formatTime} />;
    }
    if (p.includes('OPENING')) {
      return <OpeningLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
    }
    if (p.includes('CROSS') || p.includes('EXAM')) {
      return <CrossExamLayout state={state} formatTime={formatTime} />;
    }
    if (p.includes('REBUT')) {
      return <RebuttalLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
    }
    if (p.includes('CHAT') || p.includes('QUESTION') || p.includes('CHAT Q')) {
      return <ChatQLayout state={state} formatTime={formatTime} />;
    }
    if (p.includes('HIGHLIGHT')) {
      return <HighlightsLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
    }
    if (p.includes('CLOSING') || p.includes('STATEMENT')) {
      if (state.closingSubPhase === 'WINNER') {
        return <WinnerLayout state={state} formatTime={formatTime} />;
      }
      if (state.closingSubPhase === 'CREDITS') {
        return <CreditsLayout state={state} />;
      }
      return <ClosingLayout state={state} formatTime={formatTime} />;
    }
    if (p.includes('FLOOR')) {
      return <FloorLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
    }
    if (p.includes('WINNER')) {
      return <WinnerLayout state={state} formatTime={formatTime} />;
    }
    if (p.includes('CREDIT')) {
      return <CreditsLayout state={state} />;
    }

    // Default fallback to OpeningLayout (or LobbyLayout if Round 1) if phase is non-standard or custom
    if (state?.currentRound === 'Round 1') {
      return <LobbyLayout state={state} formatTime={formatTime} />;
    }
    return <OpeningLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
  };

  return (
    <div className="min-h-screen bg-[#040507] text-[#f3f4f6] font-sans flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background radial highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Host Desk Exit button - Only shown when onExit callback is provided (e.g. from Host Desk overlay) */}
      {onExit && (
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            id="stage-exit-btn"
            onClick={onExit}
            className="px-3.5 py-1.5 bg-[#16171d]/90 hover:bg-[#20222b] text-gray-300 hover:text-white border border-[#2d2f39] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xl backdrop-blur-md"
            title="Exit Stage View"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
            <span>Exit Stage</span>
          </button>
        </div>
      )}

      {/* 8:9 RATIO SCALABLE STAGE CANVAS CONTAINER */}
      <div 
        id="stage-canvas-container"
        className="w-full max-w-[620px] aspect-[8/9] max-h-[85vh] bg-[#07080a] border border-[#1d1e24] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden select-none"
      >

        {/* TOP STATUS BAR */}
        <div className="h-7 shrink-0 bg-[#07080a] border-b border-[#1d1e24]/30 flex items-center justify-between px-5 z-20 relative">
          <div className="text-[10px] font-mono font-bold text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LIVE STAGE PROJECTION</span>
          </div>
        </div>

        {/* STRIKING RED HOLOGRAPHIC RULES VIOLATION POPUP OVERLAY */}
        <AnimatePresence>
          {state?.activeViolationNotice && state.participants && state.participants.length > 0 && state.currentPhase !== 'LOBBY' && (
            <motion.div
              key={state.activeViolationNotice.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="absolute inset-0 z-[65] pointer-events-auto flex items-center justify-center p-4 bg-black/50 backdrop-blur-[3px]"
            >
              <div className="relative overflow-hidden w-[330px] sm:w-[360px] aspect-square rounded-2xl border-2 border-orange-500 bg-gradient-to-b from-[#3a1a08]/98 via-[#221004]/98 to-[#0f0702]/98 p-5 shadow-[0_0_60px_rgba(249,115,22,0.9),inset_0_0_30px_rgba(249,115,22,0.35)] flex flex-col justify-between">
                
                {/* Animated Sci-Fi Orange Pulse Top Bar & Scanline Grid */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-600 via-amber-500 via-orange-500 to-orange-700 animate-pulse" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(249,115,22,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(249,115,22,0.08)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                {/* Top Header */}
                <div className="relative z-10 flex items-start justify-between border-b border-orange-500/40 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-orange-500/20 border-2 border-orange-500/70 rounded-xl text-orange-500 animate-bounce shadow-[0_0_20px_rgba(249,115,22,0.7)] shrink-0">
                      <AlertTriangle className="w-6 h-6 text-orange-500" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black tracking-[0.18em] text-orange-400 uppercase font-mono animate-pulse">
                        RULE VIOLATION OCCURRED
                      </span>
                      <span className="text-[10px] font-bold text-orange-200/90 font-mono tracking-wider">
                        STAGE NOTICE
                      </span>
                    </div>
                  </div>

                  {onStateUpdate && (
                    <button
                      onClick={() => onStateUpdate({ activeViolationNotice: null })}
                      className="p-1.5 text-orange-400 hover:text-white bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/50 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
                      title="Dismiss Stage Notice"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Squarish Central Details Body */}
                <div className="relative z-10 flex flex-col justify-center gap-3 bg-black/80 border border-orange-500/35 rounded-xl p-3.5 my-auto text-xs shadow-inner">
                  {/* Subject / Player Name */}
                  <div className="flex flex-col gap-0.5 border-b border-orange-500/25 pb-2.5">
                    <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase font-mono flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-orange-500" />
                      PLAYER / PARTICIPANT
                    </span>
                    <span className="text-base font-black text-white tracking-wide leading-tight">
                      {state.activeViolationNotice.participantName}
                    </span>
                    <span className="text-[10px] font-bold text-orange-300/80 font-mono">
                      Role: {state.activeViolationNotice.participantRole}
                    </span>
                  </div>

                  {/* Violation / Rule Details */}
                  <div className="flex flex-col gap-1 pt-0.5">
                    <span className="text-[9px] font-black tracking-widest text-orange-400 uppercase font-mono">
                      RULE VIOLATED
                    </span>
                    <span className="text-xs font-black text-orange-200">
                      "{state.activeViolationNotice.ruleName}"
                    </span>
                    {state.activeViolationNotice.ruleDescription && (
                      <span className="text-[10px] text-gray-300 italic leading-snug">
                        {state.activeViolationNotice.ruleDescription}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer Timestamp */}
                <div className="relative z-10 flex items-center justify-between text-[9px] font-mono text-orange-400/80 pt-2 border-t border-orange-500/25">
                  <span>TIME: {state.activeViolationNotice.timestamp}</span>
                  <span></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FUTURISTIC SPLIT-SCREEN HOLOGRAPHIC BROADCAST TELEPROMPTER & FRIENDLY AI BOT OVERLAY */}
        <AnimatePresence>
          {state?.activeDisclosureParticipantId && (() => {
            const participant = state.participants?.find(p => p.id === state.activeDisclosureParticipantId);
            const paragraphs = activeDisclosureText.split('\n\n');
            const totalLen = activeDisclosureText.length || 1;
            const progressPercent = Math.min(100, Math.round((teleprompterCharIndex / totalLen) * 100));

            return (
              <motion.div
                key={state.activeDisclosureParticipantId}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className="absolute inset-0 z-[66] pointer-events-auto flex flex-col bg-[#030a16] border-2 border-cyan-500/80 p-4 sm:p-6 shadow-[0_0_80px_rgba(6,182,212,0.5),inset_0_0_40px_rgba(6,182,212,0.15)] overflow-hidden"
              >
                {/* Top cyan gradient pulse line & hologram grid */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-600 animate-pulse" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.06)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

                {/* Top Broadcast Header Bar */}
                <div className="relative z-10 flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/20 border border-cyan-400/60 rounded-xl text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                      <ShieldCheck className="w-6 h-6 text-cyan-300 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm sm:text-base font-black tracking-widest text-cyan-300 uppercase font-mono">
                          TOTALITY TALK GUIDELINES & AI DISCLOSURE NOTICE
                        </span>
                        <span className="px-2.5 py-0.5 bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-[10px] font-extrabold rounded-full font-mono uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                          STAGE BROADCAST
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-300 font-mono">
                        Reviewing for: <span className="text-cyan-200 font-extrabold">{participant ? participant.name : 'All Stage Participants & Audience'}</span> {participant?.role ? `(${participant.role})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-cyan-950/60 border border-cyan-500/40 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-cyan-300">
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span>READING NOTICE ({progressPercent}%)</span>
                    </div>
                    <button
                      onClick={() => {
                        handleCloseDisclosureOverlay();
                      }}
                      className="p-1.5 bg-orange-500/20 hover:bg-orange-500/40 border border-orange-500/50 text-orange-300 rounded-xl transition-all cursor-pointer"
                      title="Close Overlay"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Split Screen Stage Layout */}
                <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 min-h-0">
                  
                  {/* LEFT SIDE: LIVE MOVING TELEPROMPTER (7 cols) */}
                  <div className="md:col-span-7 flex flex-col bg-black/80 border border-cyan-500/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                    {/* Teleprompter Top Header */}
                    <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2.5 mb-3 shrink-0">
                      <span className="text-xs font-mono font-black text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        LIVE TELEPROMPTER SCROLL
                      </span>
                      <div className="w-32 h-2 bg-gray-900 rounded-full overflow-hidden border border-cyan-500/40">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Scrollable Teleprompter Text Window */}
                    <div
                      ref={teleprompterRef}
                      className="flex-1 overflow-y-auto pr-2 space-y-3 font-sans text-sm sm:text-base text-gray-200 leading-relaxed scrollbar-thin scrollbar-thumb-cyan-500/50 scrollbar-track-black"
                    >
                      {disclosureSegments.map((segment, idx) => {
                        const isActive = idx === activeSegmentIndex;

                        return (
                          <div
                            key={segment.id}
                            id={`teleprompter-seg-${idx}`}
                            className={`transition-all duration-300 rounded-xl p-3 sm:p-3.5 ${
                              isActive
                                ? 'bg-gradient-to-r from-cyan-950/90 via-cyan-900/80 to-cyan-950/90 border-l-4 border-cyan-400 text-white font-extrabold shadow-[0_0_30px_rgba(6,182,212,0.4)] scale-[1.02]'
                                : 'text-gray-400 opacity-60 font-medium'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              {isActive && (
                                <span className="shrink-0 mt-0.5 px-1.5 py-0.5 bg-cyan-400 text-black text-[9px] font-black font-mono rounded tracking-wider uppercase animate-pulse">
                                  READING
                                </span>
                              )}
                              <p className={`leading-relaxed ${segment.isHeader ? 'text-cyan-300 font-bold uppercase tracking-wide' : ''} ${segment.isBullet ? 'pl-1' : ''}`}>
                                {segment.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* RIGHT SIDE: FRIENDLY HOLOGRAPHIC AI BOT DISPLAY (5 cols) */}
                  <div className="md:col-span-5 flex flex-col justify-between relative overflow-hidden bg-gradient-to-b from-[#091f36] via-[#041222] to-[#020810] border-2 border-cyan-400/70 rounded-2xl p-5 text-center shadow-[0_0_40px_rgba(6,182,212,0.35)]">
                    {/* Futuristic Scanlines & Holographic Grid Overlay */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:100%_6px] pointer-events-none" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15)_0%,transparent_70%)] pointer-events-none" />

                    {/* Animated Holographic Concentric Rings */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-cyan-400/30 rounded-full animate-spin-slow pointer-events-none" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-cyan-500/20 rounded-full animate-reverse-spin pointer-events-none" />

                    {/* AI Helper Bot Avatar Graphic Frame */}
                    <div className="relative z-10 flex flex-col items-center justify-center flex-1 py-4">
                      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-tr from-cyan-500/40 via-cyan-600/30 to-cyan-500/40 border-2 border-cyan-300 shadow-[0_0_40px_rgba(6,182,212,0.6)] flex items-center justify-center mb-4 group">
                        <Bot className="w-16 h-16 text-cyan-200 animate-pulse drop-shadow-[0_0_15px_rgba(6,182,212,0.9)]" />
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-400 rounded-full border-2 border-black animate-ping" />
                        
                        {/* Futuristic Holographic Shimmer Bar */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent animate-shimmer" />
                      </div>

                      {/* AI Helper Bot Name & Status */}
                      <h3 className="text-base sm:text-lg font-black text-cyan-200 tracking-wider font-mono uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]">
                        TOTALITY AI HELPER BOT
                      </h3>
                      <p className="text-xs font-bold text-cyan-300/90 font-mono mt-1 flex items-center justify-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        <span>PRESENTING GUIDELINES & NOTICE</span>
                      </p>

                      {/* Equalizer Audio Waves */}
                      <div className="flex items-center justify-center gap-1.5 my-4">
                        <span className={`w-1.5 h-6 bg-cyan-400 rounded-full ${isTTSSpeaking ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDelay: '0ms' }} />
                        <span className={`w-1.5 h-10 bg-cyan-300 rounded-full ${isTTSSpeaking ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDelay: '120ms' }} />
                        <span className={`w-1.5 h-12 bg-cyan-200 rounded-full ${isTTSSpeaking ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDelay: '240ms' }} />
                        <span className={`w-1.5 h-8 bg-cyan-300 rounded-full ${isTTSSpeaking ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDelay: '80ms' }} />
                        <span className={`w-1.5 h-5 bg-cyan-400 rounded-full ${isTTSSpeaking ? 'animate-bounce' : 'opacity-40'}`} style={{ animationDelay: '180ms' }} />
                      </div>
                    </div>

                    {/* Interactive Control Buttons */}
                    <div className="relative z-10 flex flex-col gap-2 pt-2 border-t border-cyan-500/30 shrink-0">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (isTTSSpeaking) {
                              stopTTS();
                              setIsTTSSpeaking(false);
                            } else {
                              handleManualReplayDisclosureTTS();
                            }
                          }}
                          className={`flex-1 py-2.5 px-3 border rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md ${
                            isTTSSpeaking
                              ? 'bg-amber-500/20 border-amber-400/60 text-amber-300 hover:bg-amber-500/30'
                              : 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200 hover:bg-cyan-500/30'
                          }`}
                        >
                          {isTTSSpeaking ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
                          <span>{isTTSSpeaking ? 'Pause / Stop Voice' : 'Replay Voiceover'}</span>
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          handleCloseDisclosureOverlay();
                        }}
                        className="w-full py-2.5 px-3 bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-500/60 text-cyan-200 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
                      >
                        <X className="w-4 h-4 text-cyan-400" />
                        <span>Close Teleprompter</span>
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* ACTIVE STAGE BROADCAST POPUP OVERLAY */}
        <AnimatePresence>
          {(() => {
            const activePopup = state.popupTemplates?.find(p => p.isPlaying);
            if (!activePopup) return null;
            return (
              <motion.div
                key={activePopup.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute top-8 left-3 right-3 z-50 bg-gradient-to-b from-[#181a2d]/95 to-[#0e1017]/95 border-2 border-[#f97316] rounded-2xl p-3.5 shadow-[0_12px_36px_rgba(249,115,22,0.4)] backdrop-blur-md pointer-events-auto"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#2d2f39] pb-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-[#f97316]/20 border border-[#f97316]/40 rounded-lg text-[#f97316] shrink-0">
                      <Megaphone className="w-4 h-4 text-[#f97316] animate-bounce" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">
                        STAGE BROADCAST
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {activePopup.title}
                      </span>
                    </div>
                  </div>

                  {onStateUpdate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (state.popupTemplates) {
                          const updated = state.popupTemplates.map(p => 
                            p.id === activePopup.id ? { ...p, isPlaying: false } : p
                          );
                          onStateUpdate({ popupTemplates: updated });
                        }
                      }}
                      className="p-1.5 bg-[#20222a] hover:bg-[#2e313e] text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 border border-[#2d2f39]"
                      title="Dismiss Stage Popup"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-semibold text-gray-100 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto pr-1 font-sans">
                  {activePopup.text}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* INNER VIEWPORT FOR ACTIVE LAYOUT */}
        <div 
          ref={viewportRef} 
          className={`flex-1 h-full w-full overflow-y-auto overflow-x-hidden p-3.5 flex flex-col relative z-10 scrollbar-none transition-all duration-300 ${
            isPopularVoteDocked && state.showPopularVoteWidget && !(
              state?.introVideoPlaying ||
              state?.openingStatementVideoPlayingForParticipantId ||
              state?.showOpeningStatementPopupForParticipantId
            ) ? 'pt-16 sm:pt-20' : ''
          }`}
        >
          {renderActiveLayout()}



          {state.currentPhase !== 'LOBBY' && state.openingStatementVideoPlayingForParticipantId && (() => {
            const videoUrl = state.settings?.openingStatementVideoUrl || '';
            const participant = state.participants?.find(p => p.id === state.openingStatementVideoPlayingForParticipantId);
            return (
              <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
                <video
                  src={videoUrl}
                  autoPlay
                  controls
                  playsInline
                  onLoadedMetadata={(e) => {
                    e.currentTarget.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
                  }}
                  onEnded={handleOpeningStatementVideoEnded}
                  className="w-full h-full object-contain"
                />
                
                {/* Skip / Close Overlay Bar */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={handleOpeningStatementVideoEnded}
                    className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 rounded-full text-white text-xs font-black tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Skip Video</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtitle / Participant Badge */}
                {participant && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-center">
                    <div className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">
                      Opening Statement Intro
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">
                      {participant.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {state.currentPhase !== 'LOBBY' && state.showOpeningStatementPopupForParticipantId && (() => {
            const participantId = state.showOpeningStatementPopupForParticipantId;
            const popupState = {
              ...state,
              currentSpeakerId: participantId
            };
            return (
              <div className="absolute inset-0 z-30 bg-[#07080a] flex flex-col p-4 overflow-y-auto scrollbar-none animate-none">
                {/* Header inside popup */}
                <div className="flex justify-between items-center border-b border-[#1d1e24] pb-2 mb-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-[#f97316] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-[#ea580c] rounded-full animate-pulse"></span>
                    <span>Opening Statement mode</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onStateUpdate) {
                        onStateUpdate({ showOpeningStatementPopupForParticipantId: null });
                      }
                    }}
                    className="p-1.5 bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col">
                  <OpeningLayout state={popupState} formatTime={formatTime} onStateUpdate={onStateUpdate} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* POPULAR VOTE WIDGET (DRAGGABLE & DYNAMIC MINIMALIST HUD) */}
        {state.showPopularVoteWidget && !(
          state?.introVideoPlaying ||
          state?.openingStatementVideoPlayingForParticipantId ||
          state?.showOpeningStatementPopupForParticipantId
        ) && (() => {
          const proLikes = state?.popularVotes?.pro ?? 0;
          const conLikes = state?.popularVotes?.con ?? 0;
          const totalLikes = proLikes + conLikes;

          const proVotes = Math.floor(proLikes / 100);
          const conVotes = Math.floor(conLikes / 100);
          const totalVotes = proVotes + conVotes;

          // Check which team is active/selected based on current speaker or sub-phases
          const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
          let activeTeam: 'PRO' | 'CON' | null = null;
          if (speaker) {
            activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
          } else if (state?.currentPhase === 'REBUTTAL') {
            activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
          } else if (state?.currentPhase === 'CHAT_Q') {
            activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
          }

          let proPercent = 50;
          let conPercent = 50;
          if (totalVotes > 0) {
            proPercent = Math.round((proVotes / totalVotes) * 100);
            conPercent = 100 - proPercent;
          } else if (totalLikes > 0) {
            proPercent = Math.round((proLikes / totalLikes) * 100);
            conPercent = 100 - proPercent;
          }

          const ropeLength = 10;
          const knotIndex = Math.max(0, Math.min(ropeLength - 1, Math.round((proPercent / 100) * (ropeLength - 1))));
          const leftRope = "━".repeat(knotIndex);
          const rightRope = "━".repeat(ropeLength - 1 - knotIndex);

          if (isPopularVoteDocked) {
            // DOCKED TOP BAR MODE (Wall-to-wall top header spanning full length of stage)
            return (
              <motion.div
                drag="y"
                dragConstraints={{ top: 0, bottom: 150 }}
                dragElastic={0.1}
                dragMomentum={false}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 40 || info.point.y > 120) {
                    setIsPopularVoteDocked(false);
                  }
                }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={`absolute top-0 left-0 right-0 w-full z-30 bg-[#07080d]/95 backdrop-blur-md border-b p-2 sm:p-2.5 px-3 sm:px-4 shadow-[0_6px_20px_rgba(0,0,0,0.9)] flex items-center justify-between gap-2.5 sm:gap-3.5 text-xs select-none cursor-grab active:cursor-grabbing ${
                  activeTeam === 'PRO'
                    ? 'border-cyan-500/50 shadow-[0_4px_16px_rgba(6,182,212,0.3)]'
                    : activeTeam === 'CON'
                    ? 'border-orange-500/50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]'
                    : 'border-cyan-500/40 shadow-[0_4px_16px_rgba(0,242,255,0.2)]'
                }`}
              >
                {/* Drag handle indicator */}
                <div className="flex items-center gap-1 text-gray-400 hover:text-white shrink-0 cursor-grab" title="Drag down to float">
                  <Move className="w-4 h-4 text-cyan-400 animate-pulse" />
                </div>

                {/* CYCLING DOCKED VIEW: GAUGE (30s) OR INSTRUCTIONS (45s) */}
                <div className="flex-1 min-w-0">
                  <AnimatePresence mode="wait">
                    {widgetView === 'gauge' ? (
                      /* VIEW 1: DYNAMIC ANIMATED FULL-LENGTH GAUGE BAR */
                      <motion.div
                        key="docked-gauge"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.25 }}
                        className="w-full flex flex-col gap-1"
                      >
                        <div className="h-6 sm:h-7 w-full bg-gray-950 rounded-lg overflow-hidden flex border border-white/20 relative shadow-inner">
                          {/* PRO GAUGE BAR WITH ANIMATED LIGHT SHIMMER */}
                          <motion.div
                            animate={{ width: `${proPercent}%` }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                            className={`h-full bg-gradient-to-r from-cyan-700 via-cyan-500 to-cyan-400 flex items-center justify-start pl-2 sm:pl-3 relative overflow-hidden ${activeTeam === 'PRO' ? 'brightness-125' : ''}`}
                          >
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
                              animate={{ x: ['-100%', '200%'] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                            />
                            <span className="text-xs sm:text-sm font-black text-white drop-shadow-md tracking-tight whitespace-nowrap z-10 flex items-center gap-1">
                              PRO {proPercent}% <span className="text-cyan-200/90 font-mono text-[10px] font-bold">({proVotes}V)</span>
                            </span>
                          </motion.div>

                          {/* CON GAUGE BAR WITH ANIMATED LIGHT SHIMMER */}
                          <motion.div
                            animate={{ width: `${conPercent}%` }}
                            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                            className={`h-full bg-gradient-to-l from-orange-700 via-orange-500 to-amber-400 flex items-center justify-end pr-2 sm:pr-3 relative overflow-hidden ${activeTeam === 'CON' ? 'brightness-125' : ''}`}
                          >
                            <motion.div
                              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none"
                              animate={{ x: ['100%', '-200%'] }}
                              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
                            />
                            <span className="text-xs sm:text-sm font-black text-white drop-shadow-md tracking-tight whitespace-nowrap z-10 flex items-center gap-1">
                              <span className="text-orange-200/90 font-mono text-[10px] font-bold">({conVotes}V)</span> {conPercent}% CON
                            </span>
                          </motion.div>

                          {/* Center divider notch */}
                          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 bg-black z-20 shadow-md" />
                        </div>
                      </motion.div>
                    ) : (
                      /* VIEW 2: LARGE, HIGHLY LEGIBLE MOBILE INSTRUCTIONS CALLOUT */
                      <motion.div
                        key="docked-instructions"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.25 }}
                        className="w-full bg-gradient-to-r from-cyan-500/15 via-cyan-400/15 to-cyan-500/15 border border-cyan-400/40 rounded-lg p-1.5 sm:p-2 text-center flex flex-col justify-center items-center shadow-lg"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
                          <h4 className="text-xs sm:text-sm md:text-base font-black text-cyan-300 tracking-wide uppercase leading-tight">
                            👍 LIKE THE STREAM TO SHIFT THE GAUGE!
                          </h4>
                        </div>
                        <p className="text-[10px] sm:text-xs font-bold text-gray-200 mt-0.5 tracking-normal">
                          Agree with the speaker? Every <strong className="text-white font-black underline decoration-cyan-400">100 Likes = 1 Vote Point</strong> added directly to your team!
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* UNDOCK / FLOAT BUTTON */}
                <button
                  type="button"
                  onClick={() => setIsPopularVoteDocked(false)}
                  className="px-2 py-1 bg-[#16171d] hover:bg-[#20222b] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-md transition-all cursor-pointer shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold"
                  title="Undock / Float Widget"
                >
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[9px] font-black tracking-wider uppercase">FLOAT</span>
                </button>
              </motion.div>
            );
          }

          // FLOATING MODE
          return (
            <motion.div
              drag
              dragConstraints={{ left: -100, right: 100, top: -280, bottom: 80 }}
              dragElastic={0.05}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.y < -120 || info.point.y < 100) {
                  setIsPopularVoteDocked(true);
                }
              }}
              className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-20 w-[240px] select-none cursor-grab active:cursor-grabbing bg-[#090a0f]/90 backdrop-blur-md border rounded-lg p-2 shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex flex-col gap-1 transition-all duration-300 ${
                activeTeam === 'PRO'
                  ? 'shadow-[0_0_8px_rgba(6,182,212,0.25)] border-cyan-500/40'
                  : activeTeam === 'CON'
                  ? 'shadow-[0_0_8px_rgba(249,115,22,0.25)] border-orange-500/40'
                  : 'border-white/10'
              }`}
              whileHover={{ scale: 1.01 }}
              whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            >
              {/* Drag handle & Dock to Top button */}
              <div className="flex items-center justify-between px-1 pt-0.5">
                <div className="w-4 h-0.5 bg-white/20 rounded-full mx-auto" />
                <button
                  type="button"
                  onClick={() => setIsPopularVoteDocked(true)}
                  className="text-gray-400 hover:text-cyan-300 transition-colors p-0.5 cursor-pointer"
                  title="Dock to Top Bar"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
              </div>

              <div className="pt-0.5">
                <AnimatePresence mode="wait">
                  {widgetView === 'gauge' ? (
                    <motion.div
                      key="gauge"
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-1 pointer-events-none"
                    >
                      {/* Votes Display */}
                      <div className="flex items-center justify-between px-0.5 text-[8px] font-black">
                        {/* PRO */}
                        <div className={`flex items-baseline gap-0.5 ${activeTeam === 'PRO' ? 'text-cyan-400 font-extrabold scale-[1.02] origin-left' : 'text-cyan-400/70'}`}>
                          <span>PRO:</span>
                          <span className="text-white font-mono text-[9px]">{proVotes}V</span>
                          <span className="text-gray-500 font-mono text-[6.5px]">({proLikes})</span>
                        </div>

                        {/* ACTIVE TEAM HIGHLIGHT */}
                        <div className="text-[7px] tracking-widest text-gray-500 font-bold">
                          {activeTeam ? (
                            <span className={`animate-pulse ${activeTeam === 'PRO' ? 'text-cyan-400' : 'text-orange-400'}`}>
                              {activeTeam === 'PRO' ? 'LIKE PRO' : 'LIKE CON'}
                            </span>
                          ) : (
                            <span className="text-gray-400">TUG OF WAR</span>
                          )}
                        </div>

                        {/* CON */}
                        <div className={`flex items-baseline gap-0.5 ${activeTeam === 'CON' ? 'text-orange-400 font-extrabold scale-[1.02] origin-right' : 'text-orange-400/70'}`}>
                          <span className="text-gray-500 font-mono text-[6.5px]">({conLikes})</span>
                          <span className="text-white font-mono text-[9px]">{conVotes}V</span>
                          <span>CON:</span>
                        </div>
                      </div>

                      {/* Progress gauge bar */}
                      <div className="h-3 w-full bg-gray-950 rounded-full overflow-hidden flex border border-white/10 relative">
                        <motion.div
                          animate={{ width: `${proPercent}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          className={`h-full bg-gradient-to-r from-cyan-600 via-cyan-500 to-cyan-400 ${activeTeam === 'PRO' ? 'brightness-125' : ''}`}
                        />
                        <motion.div
                          animate={{ width: `${conPercent}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          className={`h-full bg-gradient-to-l from-orange-600 via-orange-500 to-amber-400 ${activeTeam === 'CON' ? 'brightness-125' : ''}`}
                        />
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-black z-10" />
                      </div>

                      {/* Tug of War Text-Rope */}
                      <div className="flex items-center justify-between text-[8px] font-mono bg-black/40 py-0.5 px-1 rounded border border-white/5 gap-1">
                        <span className="text-cyan-400 select-none text-[7px]">🔵</span>
                        <span className="text-gray-600 tracking-tight overflow-hidden text-center flex-1 font-mono text-[7px] select-none">
                          {leftRope}📍{rightRope}
                        </span>
                        <span className="text-orange-400 select-none text-[7px]">🔴</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="scroll"
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col items-center justify-center p-1.5 text-center bg-amber-500/10 border border-amber-500/30 rounded gap-1 pointer-events-none"
                    >
                      <h5 className="text-[11px] font-black text-amber-300 uppercase tracking-wide leading-tight animate-pulse">
                        👍 LIKE STREAM TO VOTE!
                      </h5>
                      <p className="text-[9px] font-bold text-gray-200 leading-tight">
                        100 Likes = +1 Vote Point to shift the Tug-of-War Gauge!
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}



        {/* MOBILE BOTTOM NAVIGATION INDICATOR */}
        <div className="h-3.5 shrink-0 bg-black flex items-center justify-center pb-1.5 z-20 relative">
          <div className="w-20 h-1 bg-[#1d1e24] rounded-full"></div>
        </div>

        {/* FULLSCREEN MOBILE VIDEO OVERLAY */}
        {showVideoOverlay && activeVideoUrl && (
          <div 
            className="absolute inset-0 z-50 bg-black flex flex-col justify-center items-center rounded-[36px] overflow-hidden pointer-events-none"
          >
            {/* The actual video player */}
            <video
              ref={videoRef}
              src={activeVideoUrl}
              playsInline
              autoPlay
              muted={isMuted}
              onLoadedMetadata={(e) => {
                e.currentTarget.volume = isMuted ? 0 : ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
              }}
              className="w-full h-full object-cover"
              onEnded={() => {
                setShowVideoOverlay(false);
                if (state?.introVideoPlaying && onStateUpdate) {
                  const openingPhase = state?.settings?.phases?.find(p => p.id === 'OPENING');
                  const duration = openingPhase?.timerLength ?? 120;
                  onStateUpdate({
                    introVideoPlaying: false,
                    currentPhase: 'OPENING',
                    timer: {
                      duration: duration,
                      timeLeft: duration,
                      isRunning: true
                    },
                    paused: false
                  });
                }
              }}
              onError={() => {
                console.error("Video failed to load:", activeVideoUrl);
                setShowVideoOverlay(false);
                if (state?.introVideoPlaying && onStateUpdate) {
                  const openingPhase = state?.settings?.phases?.find(p => p.id === 'OPENING');
                  const duration = openingPhase?.timerLength ?? 120;
                  onStateUpdate({
                    introVideoPlaying: false,
                    currentPhase: 'OPENING',
                    timer: {
                      duration: duration,
                      timeLeft: duration,
                      isRunning: true
                    },
                    paused: false
                  });
                }
              }}
            />

            {/* Bottom HUD bar */}
            <div 
              className="absolute bottom-6 left-4 right-4 flex items-center justify-between bg-black/80 p-3 rounded-2xl border border-white/10 backdrop-blur-md pointer-events-auto"
            >
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono font-black tracking-wider text-white uppercase">
                  {currentPhaseId === 'WINNER' || state?.closingSubPhase === 'WINNER' ? 'Winner Announcement' : (currentPhaseObj?.name || 'Phase Transition')}
                </span>
                <span className="text-[8px] font-mono text-gray-400">Playing: {currentRoundName} Video</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
                  <span>{isMuted ? 'Muted' : 'Sound On'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating hearts reaction overlay - positioned at the bottom of the stage frame */}
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none z-40 overflow-hidden">
          {hearts.map(heart => (
            <motion.div
              key={heart.id}
              initial={{ y: 0, opacity: 0, scale: 0.4 }}
              animate={{
                y: -520,
                opacity: [0, 0.95, 0.95, 0],
                scale: [0.4, 1.2, 1, 0.7],
                x: [
                  0,
                  heart.swayOffset,
                  -heart.swayOffset,
                  heart.swayOffset / 2
                ]
              }}
              transition={{
                duration: heart.duration,
                ease: "easeOut"
              }}
              style={{
                position: 'absolute',
                bottom: '12px',
                left: `${heart.x}%`,
                width: heart.size,
                height: heart.size,
                color: heart.color,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-full h-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </motion.div>
          ))}
        </div>

      </div>

      {/* DEDICATED LIVE OPEN CAPTIONS BAR (Positioned below the Stage Canvas Container) */}
      {!state?.activeDisclosureParticipantId && !(
        state?.introVideoPlaying ||
        state?.openingStatementVideoPlayingForParticipantId ||
        state?.showOpeningStatementPopupForParticipantId
      ) && (() => {
        const session = state?.transcriptionSession;
        const interimText = session?.interimTranscript;
        const transcripts = getActivePhaseTranscripts(session?.transcripts || [], currentPhaseId, currentRoundName);
        const lastTranscript = transcripts.length > 0 ? transcripts[transcripts.length - 1] : null;

        const isInterimPresent = !!interimText && interimText.trim().length > 0;
        const isRecentTranscript = !!lastTranscript && (nowTime - lastSpeechTimestamp < 3500);
        const hasActiveSpeech = isInterimPresent || isRecentTranscript;
        const activeCaptionText = isInterimPresent ? interimText : (isRecentTranscript ? lastTranscript?.text : null);

        // 1. Never show closed captions in LOBBY phase (disclosure not read yet)
        if (currentPhaseId === 'LOBBY') return null;

        // 2. On Opening Statements phase, only show bottom captions bar when actively speaking
        if (currentPhaseId.includes('OPENING') && !hasActiveSpeech) return null;

        const seatedList = (state?.participants || []).filter(p => p.isSeated);
        const currentSpeaker = (state?.participants || []).find(p => p.id === state?.currentSpeakerId);

        // Automatic speaker tag determination
        let speakerBadge = 'GUEST SPEAKER';
        let badgeColor = 'bg-indigo-600 text-white';

        const hostProfile = state?.transcriptionSession?.hostVoiceProfile;
        const currentPitchVal = lastPitchRef.current;
        const isVerifiedHostPitch = currentPitchVal > 0 && hostProfile && hostProfile.pitchMean > 0 && (
          (currentPitchVal >= hostProfile.pitchMin - 20 && currentPitchVal <= hostProfile.pitchMax + 20) ||
          Math.abs(currentPitchVal - hostProfile.pitchMean) < 35
        );

        const isCrosstalk = activeCaptionText && /\[(?:multiple\s+people\s+talking|unable\s+to\s+caption|cross-?talk|overlapping\s+speech)[^\]]*\]/i.test(activeCaptionText);

        if (isCrosstalk) {
          speakerBadge = 'MULTIPLE SPEAKERS';
          badgeColor = 'bg-amber-600 text-white animate-pulse';
        } else if (state?.currentSpeakerId === 'host' || isVerifiedHostPitch) {
          speakerBadge = 'HOST';
          badgeColor = 'bg-cyan-700 text-white';
        } else if (currentSpeaker && currentSpeaker.id !== 'host') {
          const index = seatedList.findIndex(p => p.id === currentSpeaker.id);
          if (index === 0) {
            speakerBadge = `AFFIRMATIVE: ${currentSpeaker.name.split(' ')[0]}`;
            badgeColor = 'bg-cyan-600 text-white';
          } else if (index === 1) {
            speakerBadge = `OPPOSITION: ${currentSpeaker.name.split(' ')[0]}`;
            badgeColor = 'bg-emerald-600 text-white';
          } else if (index >= 2) {
            speakerBadge = `SPEAKER ${index + 1}: ${currentSpeaker.name.split(' ')[0]}`;
            badgeColor = 'bg-purple-600 text-white';
          } else {
            speakerBadge = `SPEAKER: ${currentSpeaker.name.split(' ')[0]}`;
            badgeColor = 'bg-indigo-600 text-white';
          }
        } else if (seatedList.length > 0 && lastTranscript?.speakerName) {
          const matchedIndex = seatedList.findIndex(p => p.name.toLowerCase() === lastTranscript.speakerName.toLowerCase());
          if (matchedIndex === 0) {
            speakerBadge = `AFFIRMATIVE: ${seatedList[0].name.split(' ')[0]}`;
            badgeColor = 'bg-cyan-600 text-white';
          } else if (matchedIndex === 1) {
            speakerBadge = `OPPOSITION: ${seatedList[1].name.split(' ')[0]}`;
            badgeColor = 'bg-emerald-600 text-white';
          } else if (matchedIndex >= 2) {
            speakerBadge = `SPEAKER ${matchedIndex + 1}: ${seatedList[matchedIndex].name.split(' ')[0]}`;
            badgeColor = 'bg-purple-600 text-white';
          } else {
            speakerBadge = 'GUEST SPEAKER';
            badgeColor = 'bg-indigo-600 text-white';
          }
        } else {
          speakerBadge = 'GUEST SPEAKER';
          badgeColor = 'bg-indigo-600 text-white';
        }

        const isOpeningOrLobby = currentPhaseId === 'LOBBY' || currentPhaseId === 'OPENING';
        const isMusicActive = state?.introVideoPlaying || state?.openingStatementVideoPlayingForParticipantId || currentPhaseId === 'CREDITS';

        let idleCaptionText = '[no audio registered]';
        if (isOpeningOrLobby) {
          idleCaptionText = '[Notice: Live stage uses AI-generated captions. AI can make mistakes.]';
        } else if (isMusicActive) {
          idleCaptionText = '[background music playing]';
        }

        return (
          <div className="w-full max-w-[720px] mt-3 bg-black border border-zinc-700 rounded-xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center gap-2 shrink-0">
              <span className={`px-2 py-0.5 ${badgeColor} font-mono font-black text-xs rounded uppercase tracking-wider shadow-sm`}>
                [{speakerBadge}]
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Live Captions Active" />
            </div>

            <div className="flex-1 overflow-hidden min-w-0 flex items-center">
              {hasActiveSpeech && activeCaptionText ? (
                <StaticSubtitleBlock text={activeCaptionText} />
              ) : (
                <p className="text-xs sm:text-sm font-semibold text-zinc-100 leading-snug tracking-wide">
                  {idleCaptionText}
                </p>
              )}
            </div>

            {/* Quick Accent & Language Selector Pill on Stage */}
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={session?.transcriptionLanguage || 'en-US'}
                onChange={(e) => {
                  const newLang = e.target.value;
                  const currentSession = session || { id: 'default', transcripts: [] };
                  onStateUpdate?.({
                    transcriptionSession: {
                      ...currentSession,
                      transcriptionLanguage: newLang
                    }
                  });
                }}
                className="bg-zinc-900 border border-zinc-700 text-[10px] font-bold text-amber-400 px-1.5 py-1 rounded focus:outline-none focus:border-amber-500 cursor-pointer"
                title="Switch Speech Recognition Accent Model (British, Australian, American, Indian, etc.)"
              >
                <option value="en-US">🇺🇸 US Accent</option>
                <option value="en-GB">🇬🇧 UK Accent</option>
                <option value="en-AU">🇦🇺 AU Accent</option>
                <option value="en-IN">🇮🇳 IN Accent</option>
                <option value="en-CA">🇨🇦 CA Accent</option>
                <option value="auto">🌍 Auto Detect</option>
              </select>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
