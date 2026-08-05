import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Play, Pause, Volume2, VolumeX, Sparkles, Plus, Check, Star,
  Brain, UserPlus, Highlighter, FileText, Search, Gavel, Clock, Link2,
  Trash2, ChevronDown, Wand2, Image, Layers, RefreshCw, AlertCircle, ShieldAlert,
  Radio, Upload, FileAudio, Loader2, Zap, Tv, Send, UserCheck, MessageSquare
} from 'lucide-react';
import {
  Participant, FormalClaim, AudioRecording, TranscriptItem,
  ExtractedClaim, TranscriptHighlight, AudioTranscriptionSession
} from '../types';
import { limitUnsavedTranscripts, cleanAndFormatTranscriptText, ACCENT_LANGUAGE_OPTIONS } from '../lib/transcriptUtils';
import { estimatePitch } from '../utils/audio';

interface AITranscriptionBotProps {
  state: any;
  updateStateOnServer: (partial: any) => Promise<void>;
  seatedPanelists: Participant[];
  formalClaims: FormalClaim[];
  className?: string;
}

function formatNonVerbalSounds(text: string): string {
  if (!text) return text;
  let formatted = text;

  // Remove "order in court" from captions as requested
  formatted = formatted.replace(/\b(order\s+in\s+court)\b/gi, '');

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

  formatted = formatted.replace(/(\[[^\]]+\])(\s+\1)+/gi, '$1');
  return formatted.trim();
}

export const AITranscriptionBot: React.FC<AITranscriptionBotProps> = ({
  state,
  updateStateOnServer,
  seatedPanelists,
  formalClaims,
  className = ''
}) => {
  // Local state for recording session
  const [audioSource, setAudioSource] = useState<'system' | 'mic' | 'both'>('system');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const activeStreamsRef = useRef<MediaStream[]>([]);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);

  // Saved audio processing state
  const [processingRecordingId, setProcessingRecordingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active audio playback state
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // AI Extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuccessMsg, setAiSuccessMsg] = useState<string | null>(null);

  // Selection & Highlighting state
  const [selectedText, setSelectedText] = useState('');
  const [highlightNote, setHighlightNote] = useState('');
  const [showHighlightModal, setShowHighlightModal] = useState(false);
  const [assigningClaimId, setAssigningClaimId] = useState<string | null>(null);
  const [linkingClaimId, setLinkingClaimId] = useState<string | null>(null);

  // Extractor Mode: 'claims' (assign to person) vs 'counterclaims' (assign to target claim)
  const isRebuttalPhase = (state?.currentPhase || '').toUpperCase().includes('REBUTTAL');
  const [extractorMode, setExtractorMode] = useState<'claims' | 'counterclaims'>(isRebuttalPhase ? 'counterclaims' : 'claims');

  // Active manual caption broadcaster input
  const [manualCaptionText, setManualCaptionText] = useState('');

  // Selected Phase Filter for Transcriptions & Claim Extraction
  const [selectedPhaseFilter, setSelectedPhaseFilter] = useState<string>('ALL');

  // Host Voice Profile Training & Calibration State
  const [showVoiceTrainingModal, setShowVoiceTrainingModal] = useState<boolean>(false);
  const [isCalibratingHostVoice, setIsCalibratingHostVoice] = useState<boolean>(false);
  const [calibrationSecondsLeft, setCalibrationSecondsLeft] = useState<number>(8);
  const [calibrationLivePitch, setCalibrationLivePitch] = useState<number>(0);
  const [calibrationAudioLevel, setCalibrationAudioLevel] = useState<number>(0);
  const [calibrationSamplesCount, setCalibrationSamplesCount] = useState<number>(0);
  const [calibrationResult, setCalibrationResult] = useState<{ mean: number; min: number; max: number } | null>(null);

  const calibrationMediaStreamRef = useRef<MediaStream | null>(null);
  const calibrationAudioCtxRef = useRef<AudioContext | null>(null);

  const CALIBRATION_STATEMENT = "Welcome to Totality Talk. I am your host for today's debate session, guiding the opening statements, cross-examination, and live floor discussion.";

  const startLiveVoiceCalibration = async () => {
    try {
      setIsCalibratingHostVoice(true);
      setCalibrationSecondsLeft(8);
      setCalibrationLivePitch(0);
      setCalibrationAudioLevel(0);
      setCalibrationSamplesCount(0);
      setCalibrationResult(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      calibrationMediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      calibrationAudioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const bufferLength = analyser.fftSize;
      const dataArray = new Float32Array(bufferLength);

      const collectedPitches: number[] = [];
      let secondsRemaining = 8;

      const pitchSamplingInterval = setInterval(() => {
        analyser.getFloatTimeDomainData(dataArray);

        // Calculate volume level RMS
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        setCalibrationAudioLevel(Math.min(100, Math.round(rms * 400)));

        // Estimate pitch F0
        const currentPitch = estimatePitch(dataArray, audioCtx.sampleRate);
        if (currentPitch > 65 && currentPitch < 400) {
          collectedPitches.push(currentPitch);
          setCalibrationLivePitch(Math.round(currentPitch));
          setCalibrationSamplesCount(collectedPitches.length);
        }
      }, 60);

      const countdownInterval = setInterval(() => {
        secondsRemaining -= 1;
        setCalibrationSecondsLeft(secondsRemaining);

        if (secondsRemaining <= 0) {
          clearInterval(pitchSamplingInterval);
          clearInterval(countdownInterval);

          // Stop audio tracks
          if (calibrationMediaStreamRef.current) {
            calibrationMediaStreamRef.current.getTracks().forEach(track => track.stop());
          }
          if (calibrationAudioCtxRef.current) {
            calibrationAudioCtxRef.current.close().catch(() => {});
          }

          if (collectedPitches.length > 5) {
            const sum = collectedPitches.reduce((a, b) => a + b, 0);
            const mean = Math.round(sum / collectedPitches.length);
            const sorted = [...collectedPitches].sort((a, b) => a - b);
            const min = Math.round(sorted[Math.floor(sorted.length * 0.05)] || sorted[0]);
            const max = Math.round(sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1]);

            const profile = {
              pitchMean: mean,
              pitchMin: min,
              pitchMax: max,
              calibratedAt: Date.now(),
              calibratedPhrase: CALIBRATION_STATEMENT
            };

            setCalibrationResult({ mean, min, max });
            setIsCalibratingHostVoice(false);

            // Update session state on server
            const currentSession = sessionRef.current || session || { id: 'default', transcripts: [] };
            updateStateOnServer({
              currentSpeakerId: 'host',
              transcriptionSession: {
                ...currentSession,
                hostVoiceProfile: profile
              }
            });

            setAiSuccessMsg(`Host Voice Profile Locked! Pitch mapped to ${mean} Hz (${min} Hz - ${max} Hz).`);
            setTimeout(() => setAiSuccessMsg(null), 5000);
          } else {
            setIsCalibratingHostVoice(false);
            setAiSuccessMsg('No clear speech pitch detected during calibration. Please speak out loud and try again.');
            setTimeout(() => setAiSuccessMsg(null), 4000);
          }
        }
      }, 1000);

    } catch (err: any) {
      console.error('Voice calibration error:', err);
      setIsCalibratingHostVoice(false);
      setAiSuccessMsg('Microphone access required for voice training calibration.');
      setTimeout(() => setAiSuccessMsg(null), 4000);
    }
  };

  const getPhaseBadgeInfo = (phaseId?: string) => {
    if (!phaseId) return { label: 'Opening Statements', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' };
    const p = phaseId.toUpperCase();
    if (p === 'LOBBY') return { label: 'Lobby Stage', color: 'bg-zinc-700/40 text-zinc-300 border-zinc-600' };
    if (p.includes('OPEN')) return { label: 'Opening Statements', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40' };
    if (p.includes('CROSS')) return { label: 'Cross Examination', color: 'bg-purple-500/20 text-purple-300 border-purple-400/40' };
    if (p.includes('REBUT')) return { label: 'Rebuttal Phase', color: 'bg-rose-500/20 text-rose-300 border-rose-400/40' };
    if (p.includes('FLOOR') || p.includes('CHAT')) return { label: 'Floor / Chat Debate', color: 'bg-amber-500/20 text-amber-300 border-amber-400/40' };
    if (p.includes('CLOSE')) return { label: 'Closing Statements', color: 'bg-blue-500/20 text-blue-300 border-blue-400/40' };
    if (p.includes('WIN')) return { label: 'Winner Declaration', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' };
    return { label: phaseId, color: 'bg-gray-700/40 text-gray-300 border-gray-600' };
  };

  // Future placeholders & open captions tab toggle
  const [activeTab, setActiveTab] = useState<'recorder' | 'transcript' | 'claims' | 'highlights' | 'placeholders' | 'captions'>('recorder');

  // Derive session state from server state or default
  const session: AudioTranscriptionSession = state?.transcriptionSession || {
    recordings: [],
    transcripts: [],
    extractedClaims: [],
    highlights: [],
    selectedRecordingId: null,
  };

  const recordings = session.recordings || [];
  const sessionTranscripts = session.transcripts || [];
  const transcripts = sessionTranscripts;
  const extractedClaims = session.extractedClaims || [];
  const highlights = session.highlights || [];

  const isActivelyRecording = isRecording;
  const selectedRecordingId = session.selectedRecordingId;

  // Transcriptions broken up & filtered by phase
  const filteredTranscripts = sessionTranscripts.filter((t) => {
    if (selectedPhaseFilter === 'ALL') return true;
    const p = (t.phaseId || (t as any).phaseName || '').toUpperCase();
    if (selectedPhaseFilter === 'OPENING') return p.includes('OPEN') || (!p && selectedPhaseFilter === 'ALL');
    if (selectedPhaseFilter === 'CROSS') return p.includes('CROSS');
    if (selectedPhaseFilter === 'REBUTTAL') return p.includes('REBUT');
    if (selectedPhaseFilter === 'FLOOR') return p.includes('FLOOR') || p.includes('CHAT');
    if (selectedPhaseFilter === 'CLOSING') return p.includes('CLOSE');
    return p === selectedPhaseFilter;
  });

  const displayTranscripts: TranscriptItem[] = filteredTranscripts;

  // Keep latest refs for async callbacks
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const recordingsRef = useRef(recordings);
  useEffect(() => {
    recordingsRef.current = recordings;
  }, [recordings]);

  const audioSourceRef = useRef(audioSource);
  useEffect(() => {
    audioSourceRef.current = audioSource;
  }, [audioSource]);

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const transcriptsRef = useRef(sessionTranscripts);
  useEffect(() => {
    transcriptsRef.current = sessionTranscripts;
  }, [sessionTranscripts]);

  const recordingTimeRef = useRef(recordingTime);
  useEffect(() => {
    recordingTimeRef.current = recordingTime;
  }, [recordingTime]);

  // Cleanly reset internal component state when state.transcriptionSession is cleared on debate reset
  useEffect(() => {
    if ((sessionTranscripts.length === 0 && recordings.length === 0) || state?.resetTimestamp) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.currentTime = 0;
      }
      if (isRecording) {
        setIsRecording(false);
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      }
      setInterimTranscript('');
      setProcessingRecordingId(null);
      setPlayingRecordingId(null);
      setIsPlaying(false);
      setManualCaptionText('');
      setSelectedText('');
      setAssigningClaimId(null);
      setLinkingClaimId(null);
      transcriptsRef.current = sessionTranscripts;
      recordingsRef.current = recordings;
      sessionRef.current = session;
    }
  }, [sessionTranscripts.length, recordings.length, state?.resetTimestamp]);

  // Upload audio binary to server store so state payload stays small & persistent
  const uploadAudioToServer = async (base64Audio: string, recId: string): Promise<string> => {
    try {
      const res = await fetch('/api/audio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioDataUri: base64Audio, id: recId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          return data.audioUrl;
        }
      }
    } catch (e) {
      console.warn('Server audio upload notice, using raw URI:', e);
    }
    return base64Audio;
  };

  // Speech Recognition initialization & dynamic language configuration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        const currentLang = sessionRef.current?.transcriptionLanguage || session?.transcriptionLanguage || 'en-US';
        recognition.lang = currentLang === 'auto' ? (navigator.language || 'en-US') : currentLang;
        try { recognition.maxAlternatives = 3; } catch (e) {}

        recognition.onresult = (event: any) => {
          let interim = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          const curLang = sessionRef.current?.transcriptionLanguage || 'en-US';
          const formattedInterim = cleanAndFormatTranscriptText(formatNonVerbalSounds(interim.trim()), curLang);
          const formattedFinal = cleanAndFormatTranscriptText(formatNonVerbalSounds(finalTranscript.trim()), curLang);

          if (formattedInterim) {
            setInterimTranscript(formattedInterim);
            const currentSession = sessionRef.current || session;
            const updatedSession = { ...currentSession, interimTranscript: formattedInterim };
            updateStateOnServer({ transcriptionSession: updatedSession });
          }

          if (formattedFinal) {
            setInterimTranscript('');
            addTranscriptSegment(formattedFinal);
          }
        };

        // Continuous auto-restart if speech recognition pauses mid-session
        recognition.onend = () => {
          if (isRecordingRef.current) {
            setTimeout(() => {
              if (isRecordingRef.current && recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                } catch (e) {
                  // Ignore if already starting or active
                }
              }
            }, 100);
          }
        };

        recognition.onerror = (e: any) => {
          if (e?.error === 'aborted' || e?.error === 'no-speech') {
            return;
          }
          console.warn('Speech recognition notice:', e?.error || e);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Update speech recognition model language dynamically when target accent/language is changed
  useEffect(() => {
    if (recognitionRef.current) {
      const currentLang = session?.transcriptionLanguage || 'en-US';
      const targetLang = currentLang === 'auto' ? (navigator.language || 'en-US') : currentLang;
      try {
        recognitionRef.current.lang = targetLang;
      } catch (e) {}
    }
  }, [session?.transcriptionLanguage]);

  // Helper to format seconds as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Add a new transcript segment
  const addTranscriptSegment = (text: string) => {
    const currentSession = sessionRef.current || session;
    const currentLang = currentSession.transcriptionLanguage || 'en-US';
    const cleanedText = cleanAndFormatTranscriptText(text, currentLang);
    if (!cleanedText) return;

    const currentSecs = recordingTimeRef.current;
    const formatted = formatTime(currentSecs);

    // Smart speaker detection based on active currentSpeakerId or available speakers
    let detectedSpeaker = 'Host / Moderator';
    const activeSpeakerId = state?.currentSpeakerId || 'host';

    if (activeSpeakerId === 'host') {
      detectedSpeaker = 'Host / Moderator';
    } else {
      const activeSpeaker = state?.participants?.find((p) => p.id === activeSpeakerId && p.isSeated);
      if (activeSpeaker) {
        detectedSpeaker = `${activeSpeaker.role === 'PROPOSER' ? 'Affirmative' : 'Opposition'} (${activeSpeaker.name})`;
      } else if (seatedPanelists.length > 0) {
        const hostObj = { id: 'host', name: 'Host / Moderator', role: 'HOST' as const };
        const allList = [hostObj, ...seatedPanelists];
        const sp = allList[Math.floor((currentSecs / 12) % allList.length)];
        detectedSpeaker = sp.role === 'HOST' ? 'Host / Moderator' : `${sp.role === 'PROPOSER' ? 'Affirmative' : 'Opposition'} (${sp.name})`;
      }
    }

    const activePhaseId = (state?.currentPhase || 'OPENING').toUpperCase();
    const newItem: TranscriptItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestampSeconds: currentSecs,
      formattedTime: formatted,
      speaker: detectedSpeaker,
      text: cleanedText,
      phaseId: activePhaseId,
      phaseName: state?.currentPhase || 'Opening Statements',
      phase: activePhaseId,
      round: state?.currentRound || 'Round 1'
    };

    const currentTranscripts = transcriptsRef.current || [];
    const updatedTranscripts = [...currentTranscripts, newItem];

    const isRec = !!currentSession.isRecording || isRecordingRef.current;
    // When recording button is active, hold all transcriptions.
    // When NOT recording, preserve all saved/starred/highlighted captions and cap unsaved live captions to last 15 items.
    const finalTranscripts = limitUnsavedTranscripts(updatedTranscripts, isRec, 15);

    transcriptsRef.current = finalTranscripts;

    const updatedSession = {
      ...currentSession,
      transcripts: finalTranscripts,
      interimTranscript: '',
    };

    updateStateOnServer({ transcriptionSession: updatedSession });

    // Optional AI Speech & Accent Corrector (Gemini 3.6 Flash)
    if (currentSession.aiEnhanceEnabled || currentSession.autoTranslateEnabled) {
      const targetId = newItem.id;
      fetch('/api/transcription/smooth-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanedText,
          accent: currentLang,
          language: currentLang
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.smoothedText && data.smoothedText !== cleanedText) {
          const latestSession = sessionRef.current || session;
          const updated = (latestSession.transcripts || []).map(item => {
            if (item.id === targetId) {
              return { ...item, text: data.smoothedText };
            }
            return item;
          });
          transcriptsRef.current = updated;
          updateStateOnServer({ transcriptionSession: { ...latestSession, transcripts: updated } });
        }
      })
      .catch(() => {});
    }
  };

  // Start Audio Recording
  const handleStartRecording = async () => {
    try {
      setAiError(null);
      setRecordingTime(0);
      setInterimTranscript('');
      audioChunksRef.current = [];
      activeStreamsRef.current = [];

      let finalAudioStream: MediaStream | null = null;

      if (audioSource === 'system' || audioSource === 'both') {
        try {
          // Request display media for capturing speaker/computer audio
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
            } as any,
          });

          activeStreamsRef.current.push(displayStream);

          const audioTracks = displayStream.getAudioTracks();
          if (audioTracks.length === 0) {
            // Stop video track
            displayStream.getTracks().forEach((t) => t.stop());
            if (audioSource === 'system') {
              setAiError('No computer audio track selected. Make sure to check "Share tab audio" or "Also share system audio" in the browser share dialog.');
              return;
            }
          } else {
            // Stop video tracks to conserve CPU
            displayStream.getVideoTracks().forEach((vt) => vt.stop());
            finalAudioStream = new MediaStream([audioTracks[0]]);
          }
        } catch (displayErr: any) {
          if (displayErr.name === 'NotAllowedError') {
            setAiError('Computer audio capture was cancelled by user.');
            return;
          }
          if (audioSource === 'system') {
            console.warn('getDisplayMedia failed, falling back to getUserMedia:', displayErr);
          }
        }
      }

      if (audioSource === 'mic' || (audioSource === 'both' && !finalAudioStream)) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          activeStreamsRef.current.push(micStream);
          finalAudioStream = micStream;
        } catch (micErr: any) {
          if (!finalAudioStream) {
            setAiError(`Microphone access error: ${micErr.message || 'Permission denied'}`);
            return;
          }
        }
      } else if (audioSource === 'both' && finalAudioStream) {
        // We have computer audio; try to combine with microphone audio
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          activeStreamsRef.current.push(micStream);

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const audioCtx = new AudioContextClass();
            const dest = audioCtx.createMediaStreamDestination();

            const sysSourceNode = audioCtx.createMediaStreamSource(finalAudioStream);
            const micSourceNode = audioCtx.createMediaStreamSource(micStream);

            sysSourceNode.connect(dest);
            micSourceNode.connect(dest);

            finalAudioStream = dest.stream;
          }
        } catch (e) {
          // Keep finalAudioStream (computer audio only) if mic permission fails
        }
      }

      if (!finalAudioStream || finalAudioStream.getAudioTracks().length === 0) {
        setAiError('No active audio tracks available to record. Please ensure you check "Share tab audio" in the browser prompt or grant microphone permission.');
        return;
      }

      const mediaRecorder = new MediaRecorder(finalAudioStream);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all media stream tracks AFTER recorder has stopped and flushed data
        activeStreamsRef.current.forEach((str) => {
          str.getTracks().forEach((track) => track.stop());
        });
        activeStreamsRef.current = [];

        if (audioChunksRef.current.length === 0) {
          setAiError('No audio data captured. Please verify microphone/speaker audio selection.');
          return;
        }

        const actualMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });

        if (audioBlob.size === 0) {
          setAiError('Captured audio was 0 bytes. Ensure audio stream was active while recording.');
          return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          const currentAudioSource = audioSourceRef.current;
          const sourceLabel = currentAudioSource === 'system' ? 'Computer Speakers' : currentAudioSource === 'mic' ? 'Microphone' : 'Speakers + Mic';
          const recId = `rec_${Date.now()}`;

          // Upload audio to server audio store so state payload stays lightweight
          const audioUrl = await uploadAudioToServer(base64Audio, recId);
          const duration = recordingTimeRef.current || 1;

          const newRecording: AudioRecording = {
            id: recId,
            title: `Session Recording (${sourceLabel}) - ${new Date().toLocaleTimeString()}`,
            timestamp: new Date().toLocaleString(),
            durationSeconds: duration,
            audioDataUri: audioUrl,
          };

          const currentSession = sessionRef.current || session;
          const currentRecordings = currentSession.recordings || [];
          const updatedRecordings = [newRecording, ...currentRecordings.filter((r) => r.id !== recId)];

          const updatedSession = {
            ...currentSession,
            isRecording: false,
            wasJustStopped: true,
            recordings: updatedRecordings,
            selectedRecordingId: newRecording.id,
            interimTranscript: '',
          };

          await updateStateOnServer({ transcriptionSession: updatedSession });
          setAiSuccessMsg('Recording saved. Running AI Gemini speech transcription on recording...');

          // Automatically run full Gemini AI speech transcription on saved recording
          try {
            const trRes = await fetch('/api/transcription/transcribe-audio', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioDataUri: audioUrl,
                title: newRecording.title,
                seatedPanelists,
              }),
            });

            if (trRes.ok) {
              const trData = await trRes.json();
              if (trData.transcripts && Array.isArray(trData.transcripts) && trData.transcripts.length > 0) {
                const activePhaseId = (state?.currentPhase || 'OPENING').toUpperCase();
                const aiTranscripts: TranscriptItem[] = trData.transcripts.map((t: any, idx: number) => ({
                  id: `tr_ai_${Date.now()}_${idx}`,
                  timestampSeconds: t.timestampSeconds || 0,
                  formattedTime: t.formattedTime || '00:00',
                  speaker: t.speaker || 'Speaker',
                  text: t.text,
                  phaseId: activePhaseId,
                  phaseName: state?.currentPhase || 'Opening Statements',
                  phase: activePhaseId,
                  round: state?.currentRound || 'Round 1'
                }));

                const existingTrans = currentSession.transcripts || [];
                const combinedTranscripts = [...existingTrans, ...aiTranscripts];

                const finalSession = {
                  ...updatedSession,
                  transcripts: combinedTranscripts,
                  extractedClaims: trData.claims && Array.isArray(trData.claims) ? [
                    ...trData.claims.map((c: any) => ({
                      id: `cc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                      text: c.text,
                      confidenceScore: c.confidenceScore || 0.88,
                      timestampSeconds: c.timestampSeconds || 0,
                      formattedTime: c.formattedTime || formatTime(c.timestampSeconds || 0),
                      possibleSpeaker: c.possibleSpeaker || 'Speaker',
                      assignedToParticipantId: '',
                      status: 'pending' as const,
                    })),
                    ...(currentSession.extractedClaims || []),
                  ] : (currentSession.extractedClaims || []),
                };
                await updateStateOnServer({ transcriptionSession: finalSession });
                setAiSuccessMsg(`Saved recording transcribed via Gemini AI (${aiTranscripts.length} lines processed).`);
                setTimeout(() => setAiSuccessMsg(null), 4000);
              }
            }
          } catch (e) {
            console.warn('AI transcription processing notice:', e);
          }
        };
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
      setIsRecording(true);

      // Sync isRecording status to server state for live stage display
      const startSession = { ...sessionRef.current, isRecording: true, wasJustStopped: false, interimTranscript: '' };
      updateStateOnServer({ transcriptionSession: startSession });

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start speech recognition if supported
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          // Ignore if already active
        }
      }
    } catch (err: any) {
      setAiError(`Audio recording error: ${err.message || 'Failed to start audio recording'}`);
    }
  };

  // Stop Recording
  const handleStopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setInterimTranscript('');
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // Sync isRecording: false & wasJustStopped: true to server state
    const stopSession = { ...(sessionRef.current || session), isRecording: false, wasJustStopped: true, interimTranscript: '' };
    updateStateOnServer({ transcriptionSession: stopSession });

    // Request final data from mediaRecorder and stop cleanly
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      }
    } catch (e) {
      console.warn('Notice stopping MediaRecorder:', e);
    }
  };

  // Play audio recording & seek
  const handlePlayRecording = (recording: AudioRecording) => {
    if (!recording.audioDataUri) return;

    if (playingRecordingId === recording.id && isPlaying) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
    }

    const audio = new Audio(recording.audioDataUri);
    audioPlayerRef.current = audio;
    setPlayingRecordingId(recording.id);
    setIsPlaying(true);

    audio.ontimeupdate = () => {
      setPlaybackTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };

    audio.play();
  };

  // Deselect audio recording
  const handleDeselectRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    }
    setPlayingRecordingId(null);
    updateStateOnServer({
      transcriptionSession: {
        ...session,
        selectedRecordingId: null,
      },
    });
  };

  const handleToggleSelectRecording = (recId: string) => {
    if (selectedRecordingId === recId) {
      handleDeselectRecording();
    } else {
      updateStateOnServer({
        transcriptionSession: {
          ...session,
          selectedRecordingId: recId,
        },
      });
    }
  };

  // Jump audio playback to timestamp
  const jumpToTimestamp = (seconds: number) => {
    if (recordings.length === 0) return;
    const targetRec = recordings[0];
    if (audioPlayerRef.current && playingRecordingId === targetRec.id) {
      audioPlayerRef.current.currentTime = seconds;
      if (!isPlaying) {
        audioPlayerRef.current.play();
        setIsPlaying(true);
      }
    } else {
      if (targetRec.audioDataUri) {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        const audio = new Audio(targetRec.audioDataUri);
        audioPlayerRef.current = audio;
        setPlayingRecordingId(targetRec.id);
        audio.currentTime = seconds;
        audio.ontimeupdate = () => setPlaybackTime(audio.currentTime);
        audio.onended = () => { setIsPlaying(false); setPlaybackTime(0); };
        audio.play();
        setIsPlaying(true);
      }
    }
  };

  // AI Transcribe Saved Audio Recording & Extract Claims
  const handleTranscribeSavedRecording = async (rec: AudioRecording) => {
    if (!rec.audioDataUri) {
      setAiError('Recording contains no audio data URI.');
      return;
    }

    setProcessingRecordingId(rec.id);
    setAiError(null);

    try {
      const response = await fetch('/api/transcription/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioDataUri: rec.audioDataUri,
          title: rec.title,
          currentPhase: state?.currentPhase || 'OPENING',
          seatedPanelists,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setAiError(data.error);
        return;
      }

      // Convert returned transcripts to TranscriptItem
      const activePhaseId = (state?.currentPhase || 'OPENING').toUpperCase();

      const newTranscripts: TranscriptItem[] = (data.transcripts || []).map((t: any, idx: number) => ({
        id: `tr_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        timestampSeconds: t.timestampSeconds || 0,
        formattedTime: t.formattedTime || formatTime(t.timestampSeconds || 0),
        speaker: t.speaker || 'Speaker',
        text: t.text || '',
        phaseId: activePhaseId,
        phaseName: state?.currentPhase || 'Opening Statements',
        phase: activePhaseId,
        round: state?.currentRound || 'Round 1'
      }));

      // Convert returned claims to ExtractedClaim
      const rawClaims = data.claims || [];
      const newClaims: ExtractedClaim[] = rawClaims.map((c: any, idx: number) => ({
        id: `cl_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        text: c.text,
        confidenceScore: c.confidenceScore || 0.90,
        timestampSeconds: c.timestampSeconds || 0,
        formattedTime: c.formattedTime || formatTime(c.timestampSeconds || 0),
        possibleSpeaker: c.possibleSpeaker || 'Speaker',
        status: 'pending',
      }));

      // Update recording record to mark as transcribed
      const currentSession = sessionRef.current || session;
      const currentRecordings = currentSession.recordings || [];
      const updatedRecordings = currentRecordings.map((r) =>
        r.id === rec.id
          ? {
              ...r,
              isTranscribed: true,
              extractedClaimsCount: newClaims.length,
            }
          : r
      );

      const updatedSession = {
        ...currentSession,
        transcripts: [...newTranscripts, ...(currentSession.transcripts || [])],
        extractedClaims: [...newClaims, ...(currentSession.extractedClaims || [])],
        recordings: updatedRecordings,
        selectedRecordingId: rec.id,
      };

      await updateStateOnServer({ transcriptionSession: updatedSession });
      setAiSuccessMsg(`Successfully transcribed "${rec.title}"! Generated transcript & extracted ${newClaims.length} debate claims.`);
      setTimeout(() => setAiSuccessMsg(null), 5000);
      setActiveTab('claims');
    } catch (err: any) {
      setAiError(`Failed to transcribe saved audio: ${err.message || 'Server connection error'}`);
    } finally {
      setProcessingRecordingId(null);
    }
  };

  // Upload external audio file (mp3, wav, m4a, webm, ogg)
  const handleUploadAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAiError(null);
    const reader = new FileReader();

    reader.onload = async () => {
      const base64Audio = reader.result as string;
      const recId = `rec_upload_${Date.now()}`;
      const estimatedDuration = Math.round(file.size / 16000) || 60;

      const audioUrl = await uploadAudioToServer(base64Audio, recId);

      const newRecording: AudioRecording = {
        id: recId,
        title: `Uploaded: ${file.name}`,
        timestamp: new Date().toLocaleString(),
        durationSeconds: estimatedDuration,
        audioDataUri: audioUrl,
      };

      const currentSession = sessionRef.current || session;
      const currentRecordings = currentSession.recordings || [];
      const updatedRecordings = [newRecording, ...currentRecordings.filter(r => r.id !== recId)];
      const updatedSession = { ...currentSession, recordings: updatedRecordings, selectedRecordingId: newRecording.id };

      await updateStateOnServer({ transcriptionSession: updatedSession });
      setAiSuccessMsg(`Uploaded audio file "${file.name}". You can now click "Transcribe & Extract Claims".`);
      setTimeout(() => setAiSuccessMsg(null), 5000);

      if (fileInputRef.current) fileInputRef.current.value = '';
    };

    reader.onerror = () => {
      setAiError('Failed to read uploaded audio file.');
    };

    reader.readAsDataURL(file);
  };

  // Delete saved recording
  const handleDeleteRecording = async (recId: string) => {
    const updatedRecordings = recordings.filter((r) => r.id !== recId);
    const updatedSession = { ...session, recordings: updatedRecordings };
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg('Deleted audio recording from session.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // Clear all saved recordings
  const handleClearAllRecordings = async () => {
    const updatedSession = { ...session, recordings: [], selectedRecordingId: null };
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg('Cleared all saved audio recordings.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // Delete individual transcript segment
  const handleDeleteTranscript = async (transcriptId: string) => {
    const currentTranscripts = session.transcripts || [];
    const updatedTranscripts = currentTranscripts.filter((t) => t.id !== transcriptId);
    const updatedSession = { ...session, transcripts: updatedTranscripts };
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg('Deleted transcript segment.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // Star / Favorite / Save individual transcript segment permanently
  const handleToggleStarTranscript = async (transcriptId: string) => {
    const currentTranscripts = session.transcripts || [];
    const targetItem = currentTranscripts.find((t) => t.id === transcriptId);
    if (!targetItem) return;

    const isCurrentlySaved = !!(targetItem.isStarred || targetItem.isHighlighted || targetItem.isSaved);
    const newSavedStatus = !isCurrentlySaved;

    const updatedTranscripts = currentTranscripts.map((t) => {
      if (t.id === transcriptId) {
        return {
          ...t,
          isStarred: newSavedStatus,
          isHighlighted: newSavedStatus,
          isSaved: newSavedStatus,
        };
      }
      return t;
    });

    let updatedHighlights = [...highlights];
    if (newSavedStatus) {
      if (!updatedHighlights.some((h) => h.transcriptId === transcriptId || h.selectedText === targetItem.text)) {
        updatedHighlights.unshift({
          id: `hl_${Date.now()}`,
          transcriptId: targetItem.id,
          selectedText: targetItem.text,
          note: `Saved caption (${targetItem.speaker || 'Speaker'})`,
          color: '#f59e0b',
          targetAction: 'existing_claim',
          createdAt: new Date().toLocaleTimeString(),
        });
      }
    } else {
      updatedHighlights = updatedHighlights.filter((h) => h.transcriptId !== transcriptId && h.selectedText !== targetItem.text);
    }

    const updatedSession = {
      ...session,
      transcripts: updatedTranscripts,
      highlights: updatedHighlights,
    };

    transcriptsRef.current = updatedTranscripts;
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg(newSavedStatus ? 'Saved caption permanently!' : 'Removed star from caption.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // Clear all transcript segments
  const handleClearAllTranscripts = async () => {
    const updatedSession = { ...session, transcripts: [] };
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg('Cleared all transcript segments.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // Delete extracted claim
  const handleDeleteExtractedClaim = async (claimId: string) => {
    const currentExtracted = session.extractedClaims || [];
    const updatedExtracted = currentExtracted.filter((c) => c.id !== claimId && (c as any).claimId !== claimId);
    const updatedSession = { ...session, extractedClaims: updatedExtracted };
    try {
      await fetch(`/api/claims/delete/${claimId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to call delete claim API:', err);
    }
    await updateStateOnServer({ transcriptionSession: updatedSession });
  };

  // Clear all extracted claims
  const handleClearAllExtractedClaims = async () => {
    const updatedSession = { ...session, extractedClaims: [] };
    await updateStateOnServer({ transcriptionSession: updatedSession });
    setAiSuccessMsg('Cleared all extracted claims.');
    setTimeout(() => setAiSuccessMsg(null), 3000);
  };

  // AI Claim Extraction Call (Supports Phase Selection)
  const handleExtractClaimsWithAI = async () => {
    const baseTranscripts = displayTranscripts.length > 0 ? displayTranscripts : sessionTranscripts;
    if (!baseTranscripts || baseTranscripts.length === 0) {
      setAiError('No transcript items available. Start recording live audio or select a saved session recording.');
      return;
    }

    setIsExtracting(true);
    setAiError(null);

    try {
      const response = await fetch('/api/transcription/extract-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: baseTranscripts,
          currentPhase: state?.currentPhase || 'OPENING',
          seatedPanelists,
        }),
      });

      const data = await response.json();
      if (data.claims && Array.isArray(data.claims)) {
        const activePhaseLabel = selectedPhaseFilter !== 'ALL' ? selectedPhaseFilter : (state?.currentPhase || 'OPENING');
        const newClaims: ExtractedClaim[] = data.claims.map((c: any) => ({
          id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          text: c.text,
          confidenceScore: c.confidenceScore || 0.88,
          timestampSeconds: c.timestampSeconds || 0,
          formattedTime: c.formattedTime || formatTime(c.timestampSeconds || 0),
          possibleSpeaker: c.possibleSpeaker || 'Unknown Speaker',
          status: 'pending',
          phase: activePhaseLabel,
        }));

        if (newClaims.length === 0) {
          setAiSuccessMsg(data.note || 'No explicit claims found in transcript segment.');
        } else {
          const updatedSession = {
            ...session,
            extractedClaims: [...newClaims, ...extractedClaims],
          };
          await updateStateOnServer({ transcriptionSession: updatedSession });
          const phaseNotice = selectedPhaseFilter !== 'ALL' ? `from ${selectedPhaseFilter} phase` : '';
          setAiSuccessMsg(`Successfully extracted ${newClaims.length} debate claims ${phaseNotice} using Gemini AI.`);
        }
        setActiveTab('claims');
        setTimeout(() => setAiSuccessMsg(null), 4000);
      } else {
        setAiError(data.error || 'Failed to extract claims from transcript.');
      }
    } catch (err: any) {
      setAiError(`AI Claim Extraction failed: ${err.message || 'Server connection error'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Assign Claim to Panelist
  const handleAssignClaimToPanelist = async (claim: ExtractedClaim, participant: Participant) => {
    // 1. Mark claim as assigned
    const updatedExtracted = extractedClaims.map((c) =>
      c.id === claim.id
        ? {
            ...c,
            status: 'assigned' as const,
            assignedToParticipantId: participant.id,
            assignedSpeakerName: participant.name,
          }
        : c
    );

    // 2. Append to formal debate claims list
    const newFormalClaim: FormalClaim = {
      claimId: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      speaker: participant.name,
      team: participant.role === 'PROPOSER' ? (state.settings?.proTeamName || 'Affirmative') : (state.settings?.conTeamName || 'Opposition'),
      phase: state.currentPhase || 'LOBBY',
      claimText: claim.text,
      status: 'VERIFIED',
    };

    const updatedFormalClaims = [newFormalClaim, ...(formalClaims || [])];
    const updatedSession = { ...session, extractedClaims: updatedExtracted };

    await updateStateOnServer({
      transcriptionSession: updatedSession,
      formalClaims: updatedFormalClaims,
    });

    setAssigningClaimId(null);
    setAiSuccessMsg(`Assigned claim to ${participant.name} and added to debate claim history.`);
    setTimeout(() => setAiSuccessMsg(null), 4000);
  };

  // AI Counterclaim Extraction Call
  const handleExtractCounterclaimsWithAI = async () => {
    if (!displayTranscripts || displayTranscripts.length === 0) {
      setAiError('No transcript items available yet. Start recording live audio or select a saved session recording.');
      return;
    }

    setIsExtracting(true);
    setAiError(null);

    try {
      const response = await fetch('/api/transcription/extract-counterclaims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: displayTranscripts,
          formalClaims,
          seatedPanelists,
        }),
      });

      const data = await response.json();
      if (data.counterclaims && Array.isArray(data.counterclaims)) {
        const newCounterclaims: ExtractedClaim[] = data.counterclaims.map((c: any) => ({
          id: `cc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          text: c.text,
          confidenceScore: c.confidenceScore || 0.88,
          timestampSeconds: c.timestampSeconds || 0,
          formattedTime: c.formattedTime || formatTime(c.timestampSeconds || 0),
          possibleSpeaker: c.possibleSpeaker || 'Rebutter',
          assignedToParticipantId: c.targetClaimId || '',
          status: 'pending',
        }));

        const updatedSession = {
          ...session,
          extractedClaims: [...newCounterclaims, ...extractedClaims],
        };
        await updateStateOnServer({ transcriptionSession: updatedSession });
        setAiSuccessMsg(`Successfully extracted ${newCounterclaims.length} rebuttals/counterclaims using Gemini AI.`);
        setActiveTab('claims');
        setTimeout(() => setAiSuccessMsg(null), 4000);
      } else {
        setAiError(data.error || 'Failed to extract counterclaims from transcript.');
      }
    } catch (err: any) {
      setAiError(`AI Counterclaim Extraction failed: ${err.message || 'Server connection error'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Assign Counterclaim to Target Claim
  const handleAssignCounterclaimToClaim = async (extracted: ExtractedClaim, targetClaim: FormalClaim) => {
    // 1. Mark extracted item as assigned to this claim
    const updatedExtracted = extractedClaims.map((c) =>
      c.id === extracted.id
        ? {
            ...c,
            status: 'assigned' as const,
            assignedToParticipantId: targetClaim.claimId,
            assignedSpeakerName: targetClaim.claimText,
          }
        : c
    );

    // 2. Post or append new CounterClaim
    const newCounterClaim = {
      id: `counter-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      claimId: targetClaim.claimId,
      rebutterId: extracted.possibleSpeaker || 'Rebuttal Speaker',
      counterText: extracted.text,
      timestamp: Date.now(),
      round: state.currentRound || 'Round 1'
    };

    try {
      await fetch('/api/counterclaims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCounterClaim)
      });
    } catch (e) {
      console.warn('Failed API call to /api/counterclaims, updating state directly:', e);
    }

    const currentCounterClaims = Array.isArray(state.counterClaims) ? state.counterClaims : [];
    const updatedCounterClaims = [newCounterClaim, ...currentCounterClaims];
    const updatedSession = { ...session, extractedClaims: updatedExtracted };

    await updateStateOnServer({
      transcriptionSession: updatedSession,
      counterClaims: updatedCounterClaims,
    });

    setAssigningClaimId(null);
    setAiSuccessMsg(`Assigned counterclaim to target claim: "${targetClaim.claimText.slice(0, 35)}..."`);
    setTimeout(() => setAiSuccessMsg(null), 4000);
  };

  // Handle Text Highlighting & Action Menu
  const handleSaveHighlight = async (action: 'claim' | 'existing_claim' | 'research' | 'judge') => {
    if (!selectedText.trim()) return;

    const newHighlight: TranscriptHighlight = {
      id: `hl_${Date.now()}`,
      selectedText: selectedText.trim(),
      note: highlightNote.trim() || undefined,
      color: action === 'claim' ? '#f97316' : action === 'research' ? '#3b82f6' : action === 'judge' ? '#10b981' : '#ec4899',
      targetAction: action,
      createdAt: new Date().toLocaleTimeString(),
    };

    const sel = selectedText.trim();
    const currentTranscripts = session.transcripts || [];
    const updatedTranscripts = currentTranscripts.map((t) => {
      if (t.text.includes(sel) || sel.includes(t.text)) {
        return { ...t, isHighlighted: true, isStarred: true, isSaved: true };
      }
      return t;
    });

    const updatedHighlights = [newHighlight, ...highlights];
    let updatedSession = { ...session, transcripts: updatedTranscripts, highlights: updatedHighlights };

    if (action === 'claim') {
      // Create a claim directly from highlighted text
      const newClaim: ExtractedClaim = {
        id: `cl_hl_${Date.now()}`,
        text: selectedText.trim(),
        confidenceScore: 0.95,
        timestampSeconds: 0,
        formattedTime: '[Highlighted]',
        possibleSpeaker: 'Host Selection',
        status: 'pending',
      };
      updatedSession.extractedClaims = [newClaim, ...extractedClaims];
    } else if (action === 'research') {
      // Send highlighted text to AI Researcher
      try {
        await fetch('/api/ai-researcher', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimText: selectedText.trim(), searchQuery: selectedText.trim() }),
        });
        setAiSuccessMsg('Sent highlighted section to AI Researcher Bot.');
      } catch (e) {}
    }

    await updateStateOnServer({ transcriptionSession: updatedSession });
    setSelectedText('');
    setHighlightNote('');
    setShowHighlightModal(false);
    setTimeout(() => setAiSuccessMsg(null), 4000);
  };

  return (
    <div className={`bg-[#101114] border border-[#1d1e24] rounded-xl overflow-hidden flex flex-col shadow-xl ${className}`}>
      {/* HEADER BAR */}
      <div className="bg-[#16171d] border-b border-[#1d1e24] p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f97316] to-amber-500 flex items-center justify-center text-white shadow-md shadow-[#f97316]/20">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black tracking-wider text-white uppercase">AI TRANSCRIPTION BOT</h3>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/30 rounded-full">
                Gemini Powered
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Real-time Audio Recorder, Transcript Cleaner & Claim Extraction AI</p>
          </div>
        </div>

        {/* TAB CONTROLS */}
        <div className="flex items-center bg-[#0a0b0d] p-1 rounded-lg border border-[#1d1e24] gap-1">
          <button
            onClick={() => setActiveTab('recorder')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'recorder' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mic className="w-3 h-3" />
            <span>Recorder</span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'transcript' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Transcript ({displayTranscripts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('claims')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'claims' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Brain className="w-3 h-3" />
            <span>AI Claims ({extractedClaims.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('highlights')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'highlights' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Highlighter className="w-3 h-3" />
            <span>Highlights ({highlights.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('captions')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'captions' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Tv className="w-3 h-3 text-cyan-400" />
            <span>Open Captions</span>
          </button>
          <button
            onClick={() => setActiveTab('placeholders')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTab === 'placeholders' ? 'bg-[#f97316] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Evidence Visuals</span>
          </button>
        </div>
      </div>

      {/* ERROR / SUCCESS NOTIFICATIONS */}
      {aiError && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 flex items-center justify-between text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{aiError}</span>
          </div>
          <button onClick={() => setAiError(null)} className="text-red-400 hover:text-white font-bold text-xs">Dismiss</button>
        </div>
      )}
      {aiSuccessMsg && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 flex items-center gap-2 text-xs text-emerald-400">
          <Check className="w-4 h-4 shrink-0" />
          <span>{aiSuccessMsg}</span>
        </div>
      )}

      {/* BODY CONTENT */}
      <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[420px]">
        {/* TAB 1: AUDIO RECORDER */}
        {activeTab === 'recorder' && (
          <div className="flex flex-col gap-4">
            {/* AUDIO SOURCE SELECTOR */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#f97316]" />
                  <span>Recording Audio Source</span>
                </span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {audioSource === 'system' ? '🔊 Computer Speakers / Stream' : audioSource === 'mic' ? '🎙️ Microphone Only' : '🎛️ Speakers + Microphone'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setAudioSource('system')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    audioSource === 'system'
                      ? 'bg-[#f97316] text-white border-[#f97316] shadow-md shadow-[#f97316]/20'
                      : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                  } disabled:opacity-50`}
                >
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>Computer Speakers</span>
                </button>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setAudioSource('mic')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    audioSource === 'mic'
                      ? 'bg-[#f97316] text-white border-[#f97316] shadow-md shadow-[#f97316]/20'
                      : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                  } disabled:opacity-50`}
                >
                  <Mic className="w-4 h-4 shrink-0" />
                  <span>Microphone</span>
                </button>

                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setAudioSource('both')}
                  className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${
                    audioSource === 'both'
                      ? 'bg-[#f97316] text-white border-[#f97316] shadow-md shadow-[#f97316]/20'
                      : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                  } disabled:opacity-50`}
                >
                  <Radio className="w-4 h-4 shrink-0" />
                  <span>Speakers + Mic</span>
                </button>
              </div>

              {audioSource === 'system' && (
                <div className="text-[11px] bg-[#f97316]/10 border border-[#f97316]/20 text-gray-300 p-2.5 rounded-lg flex items-center gap-2 leading-tight">
                  <Sparkles className="w-4 h-4 text-[#f97316] shrink-0" />
                  <span>
                    <strong>Computer Speaker Mode:</strong> When you click <strong>Start Recording</strong>, your browser will open a share dialog. Select your debate stream tab or window and make sure <strong>"Share tab audio"</strong> is checked!
                  </span>
                </div>
              )}
              {audioSource === 'both' && (
                <div className="text-[11px] bg-[#f97316]/10 border border-[#f97316]/20 text-gray-300 p-2.5 rounded-lg flex items-center gap-2 leading-tight">
                  <Sparkles className="w-4 h-4 text-[#f97316] shrink-0" />
                  <span>
                    <strong>Combined Mode:</strong> Captures computer speaker sound and your microphone simultaneously into a single audio track.
                  </span>
                </div>
              )}
            </div>

            {/* ACCENT & SPEECH MODEL CONTROLS */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Accent, Dialect & AI Speech Engine</span>
                </span>
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  International Speech Support
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Accent & Dialect Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                    <span>Target Accent / Dialect:</span>
                  </label>
                  <select
                    value={session?.transcriptionLanguage || 'en-US'}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      const updatedSession = { ...session, transcriptionLanguage: newLang };
                      updateStateOnServer({ transcriptionSession: updatedSession });
                      setAiSuccessMsg(`Updated speech recognition model to: ${ACCENT_LANGUAGE_OPTIONS.find(o => o.code === newLang)?.label || newLang}`);
                      setTimeout(() => setAiSuccessMsg(null), 3000);
                    }}
                    className="bg-[#0d0e10] border border-[#2d2f39] text-xs font-semibold text-white px-3 py-2 rounded-lg focus:outline-none focus:border-[#f97316]"
                  >
                    {ACCENT_LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.flag} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Enhancer & Translator Toggles */}
                <div className="flex flex-col justify-center gap-2 bg-[#0d0e10] p-2.5 rounded-lg border border-[#2d2f39]">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!session?.aiEnhanceEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const updatedSession = { ...session, aiEnhanceEnabled: enabled };
                        updateStateOnServer({ transcriptionSession: updatedSession });
                      }}
                      className="rounded border-gray-600 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>AI Accent & Grammar Corrector</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!session?.autoTranslateEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const updatedSession = { ...session, autoTranslateEnabled: enabled };
                        updateStateOnServer({ transcriptionSession: updatedSession });
                      }}
                      className="rounded border-gray-600 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Auto-Translate Speech to English</span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="text-[10px] text-gray-400 leading-normal flex items-start gap-1.5 bg-[#0a0b0d] p-2 rounded-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Accent Precision Tip:</strong> For British accents choose 🇬🇧 <strong>English (UK)</strong>; for Australian speech choose 🇦🇺 <strong>English (Australia)</strong>. Enabling <strong>AI Accent & Grammar Corrector</strong> automatically cleans phonetic errors and adds proper punctuation using Gemini 3.6 Flash without changing the speaker's meaning.
                </span>
              </div>
            </div>

            {/* RECORDING CONTROL PANEL */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-all ${
                  isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' : 'bg-[#101114] text-gray-400 border border-[#2d2f39]'
                }`}>
                  {audioSource === 'system' ? <Volume2 className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{isRecording ? `RECORDING (${audioSource.toUpperCase()})...` : 'AUDIO RECORDER READY'}</span>
                    {isRecording && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#f97316]">
                    {formatTime(recordingTime)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    onClick={handleStartRecording}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-red-500/20 uppercase"
                  >
                    {audioSource === 'system' ? <Volume2 className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>Start Recording</span>
                  </button>
                ) : (
                  <button
                    onClick={handleStopRecording}
                    className="bg-[#101114] hover:bg-red-500/20 text-red-400 border border-red-500/30 px-4 py-2 rounded-lg text-xs font-black tracking-wider transition-all cursor-pointer flex items-center gap-2 uppercase"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop Recording</span>
                  </button>
                )}
              </div>
            </div>

            {/* RECORDINGS HISTORY */}
            <div className="flex flex-col gap-2">
              <input
                type="file"
                ref={fileInputRef}
                accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                onChange={handleUploadAudioFile}
                className="hidden"
              />

              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileAudio className="w-3.5 h-3.5 text-[#f97316]" />
                  <span>SAVED SESSION RECORDINGS ({recordings.length})</span>
                </span>

                <div className="flex items-center gap-2">
                  {recordings.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllRecordings}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      title="Clear all saved audio recordings"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Clear All</span>
                    </button>
                  )}
                  {selectedRecordingId && (
                    <button
                      type="button"
                      onClick={handleDeselectRecording}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all cursor-pointer"
                    >
                      Deselect Recording (Clear)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#101114] hover:bg-[#232530] text-gray-300 hover:text-white border border-[#2d2f39] px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Upload className="w-3 h-3 text-[#f97316]" />
                    <span>Upload Audio File</span>
                  </button>
                </div>
              </div>

              {recordings.length === 0 ? (
                <div className="p-6 bg-[#0a0b0d] border border-[#1d1e24] rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                  <FileAudio className="w-8 h-8 text-gray-600" />
                  <span>No audio recordings saved yet. Click 'Start Recording' above to record live audio or 'Upload Audio File' to process an existing file.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recordings.map((rec) => {
                    const isSelected = selectedRecordingId === rec.id;
                    const isPlayingAudio = playingRecordingId === rec.id && isPlaying;
                    const isProcessing = processingRecordingId === rec.id;

                    return (
                      <div 
                        key={rec.id} 
                        className={`p-3 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 border transition-all ${
                          isSelected 
                            ? 'bg-[#f97316]/10 border-[#f97316] shadow-lg shadow-[#f97316]/10' 
                            : 'bg-[#16171d]/90 border-[#2d2f39]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handlePlayRecording(rec)}
                            className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                              isPlayingAudio ? 'bg-[#f97316] text-white' : 'bg-[#101114] text-gray-300 hover:text-white border border-[#2d2f39]'
                            }`}
                          >
                            {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{rec.title}</span>
                              {isSelected && (
                                <span className="text-[9px] font-black text-[#f97316] bg-[#f97316]/20 border border-[#f97316]/40 px-2 py-0.5 rounded uppercase tracking-wider">
                                  Selected
                                </span>
                              )}
                              {rec.isTranscribed && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Transcribed</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {formatTime(rec.durationSeconds)} · Saved: {rec.timestamp}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-auto">
                          <button
                            onClick={() => handleToggleSelectRecording(rec.id)}
                            className={`px-2.5 py-1 rounded text-[10px] font-black tracking-wider uppercase transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-[#f97316] text-white border-[#f97316]'
                                : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:border-[#f97316]'
                            }`}
                          >
                            {isSelected ? 'Selected (Click to Deselect)' : 'Select Recording'}
                          </button>

                          <button
                            onClick={() => handleTranscribeSavedRecording(rec)}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                              rec.isTranscribed
                                ? 'bg-[#101114] text-amber-400 border-amber-500/30 hover:bg-amber-500/10'
                                : 'bg-gradient-to-r from-[#f97316] to-amber-500 text-white border-[#f97316] hover:from-[#ea580c] hover:to-amber-600 shadow-md'
                            } disabled:opacity-50`}
                            title="Transcribe audio using Gemini AI"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Transcribing...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3.5 h-3.5" />
                                <span>{rec.isTranscribed ? 'Re-Transcribe Audio' : 'Transcribe Audio'}</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => jumpToTimestamp(0)}
                            className="p-1.5 text-gray-400 hover:text-white bg-[#101114] rounded border border-[#2d2f39] cursor-pointer text-[10px] font-bold flex items-center gap-1"
                            title="Jump audio to start"
                          >
                            <Clock className="w-3 h-3 text-[#f97316]" />
                            <span>00:00</span>
                          </button>

                          <button
                            onClick={() => handleDeleteRecording(rec.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 bg-[#101114] hover:bg-red-500/10 rounded border border-[#2d2f39] hover:border-red-500/30 cursor-pointer text-[10px] transition-colors"
                            title="Delete recording"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: LIVE TRANSCRIPT BY PHASES */}
        {activeTab === 'transcript' && (
          <div className="flex flex-col gap-3">
            {/* Header & Claim Extraction Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-[#16171d] p-3 rounded-xl border border-[#2d2f39] gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f97316]" />
                <span className="text-xs font-bold text-white">Debate Speech Transcripts</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExtractClaimsWithAI}
                  disabled={isExtracting || displayTranscripts.length === 0}
                  className="bg-gradient-to-r from-[#f97316] to-amber-500 hover:from-[#ea580c] hover:to-amber-600 text-white px-3 py-1.5 rounded text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  title={selectedPhaseFilter !== 'ALL' ? `Extract claims specifically from ${selectedPhaseFilter} phase` : "Extract claims from full transcript using Gemini AI"}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5" />
                      <span>{selectedPhaseFilter !== 'ALL' ? `Extract Claims (${selectedPhaseFilter})` : 'Extract Claims (All)'}</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] font-mono text-gray-400">
                  {isActivelyRecording ? 'LIVE RECORDING' : selectedRecordingId ? 'SELECTED RECORDING' : 'IDLE'}
                </span>
              </div>
            </div>

            {/* PHASE FILTER BAR & CATEGORY SELECTOR */}
            <div className="bg-[#16171d] p-2.5 rounded-xl border border-[#2d2f39] flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#f97316]" />
                  <span>Segment Transcripts By Phase:</span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-400">
                    Showing {displayTranscripts.length} of {sessionTranscripts.length} lines
                  </span>
                  {sessionTranscripts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllTranscripts}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Clear all transcripts from session"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                      <span>Clear Transcripts</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'ALL', label: 'All Phases' },
                  { id: 'OPENING', label: 'Opening Statements' },
                  { id: 'CROSS', label: 'Cross Exam' },
                  { id: 'REBUTTAL', label: 'Rebuttal Phase' },
                  { id: 'FLOOR', label: 'Floor / Chat' },
                  { id: 'CLOSING', label: 'Closing Statements' },
                ].map((p) => {
                  const isSelected = selectedPhaseFilter === p.id;
                  const count = sessionTranscripts.filter(t => {
                    if (p.id === 'ALL') return true;
                    const tP = (t.phaseId || (t as any).phaseName || '').toUpperCase();
                    if (p.id === 'OPENING') return tP.includes('OPEN');
                    if (p.id === 'CROSS') return tP.includes('CROSS');
                    if (p.id === 'REBUTTAL') return tP.includes('REBUT');
                    if (p.id === 'FLOOR') return tP.includes('FLOOR') || tP.includes('CHAT');
                    if (p.id === 'CLOSING') return tP.includes('CLOSE');
                    return tP === p.id;
                  }).length;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPhaseFilter(p.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-[#f97316] text-white border-[#f97316] shadow-md shadow-[#f97316]/20'
                          : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530] hover:text-white'
                      }`}
                    >
                      <span>{p.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                        isSelected ? 'bg-black/30 text-white' : 'bg-[#1b1d24] text-gray-400'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TRANSCRIPT LIST BROKEN UP BY PHASES */}
            {displayTranscripts.length === 0 ? (
              <div className="p-8 bg-[#0a0b0d] border border-[#1d1e24] rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                <Mic className="w-8 h-8 text-gray-600 animate-pulse" />
                <span>No transcript segments recorded for the selected phase ({selectedPhaseFilter}). Speak during this phase or select "All Phases".</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                {displayTranscripts.map((t) => {
                  const isActiveLine = isPlaying && Math.abs(playbackTime - (t.timestampSeconds || 0)) < 5;
                  const phaseInfo = getPhaseBadgeInfo(t.phaseId || (t as any).phaseName);
                  const speakerDisplay = t.speaker || t.speakerName || 'Speaker';
                  const formattedTimeStr = t.formattedTime || t.timestamp || 'Live';
                  const isSavedItem = !!(t.isStarred || t.isHighlighted || t.isSaved);

                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isActiveLine
                          ? 'bg-[#f97316]/15 border-[#f97316]/50 shadow-md shadow-[#f97316]/10'
                          : isSavedItem
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm shadow-amber-500/5'
                          : 'bg-[#16171d]/60 border-[#2d2f39]/60 hover:border-[#f97316]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => jumpToTimestamp(t.timestampSeconds || 0)}
                            className="bg-[#0a0b0d] hover:bg-[#f97316] hover:text-white text-[#f97316] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[#f97316]/30 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Click to jump audio to this moment"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{formattedTimeStr}</span>
                          </button>

                          <span className="text-xs font-bold text-white">{speakerDisplay}</span>

                          {/* PHASE BADGE ON EACH TRANSCRIPT SEGMENT */}
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${phaseInfo.color}`}>
                            {phaseInfo.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStarTranscript(t.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer ${
                              isSavedItem
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                : 'text-gray-400 hover:text-amber-400 hover:bg-white/5 border border-transparent'
                            }`}
                            title={isSavedItem ? "Saved permanently (click to remove star)" : "Star/Favorite to save caption permanently"}
                          >
                            <Star className={`w-3 h-3 ${isSavedItem ? 'fill-amber-400 text-amber-400' : ''}`} />
                            <span>{isSavedItem ? 'Saved' : 'Save'}</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedText(t.text);
                              setShowHighlightModal(true);
                            }}
                            className="text-[10px] font-bold text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer px-1.5 py-0.5"
                          >
                            <Highlighter className="w-3 h-3" />
                            <span>Highlight</span>
                          </button>
                          <button
                            onClick={() => handleDeleteTranscript(t.id)}
                            className="p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                            title="Delete transcript line"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-300 leading-relaxed font-sans">{t.text}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: AI EXTRACTED CLAIMS & COUNTERCLAIMS */}
        {activeTab === 'claims' && (
          <div className="flex flex-col gap-3">
            {/* Extractor Mode Selector */}
            <div className="flex items-center justify-between bg-[#101114] p-1.5 rounded-xl border border-[#2d2f39]">
              <span className="text-[10px] font-black uppercase text-gray-400 pl-2">Extraction Mode:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExtractorMode('claims')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                    extractorMode === 'claims'
                      ? 'bg-[#f97316] text-white border-[#f97316] shadow-sm'
                      : 'bg-[#16171d] text-gray-400 border-[#2d2f39] hover:text-white'
                  }`}
                >
                  <Brain className="w-3 h-3" />
                  <span>🎯 Claims (To Person)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setExtractorMode('counterclaims')}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                    extractorMode === 'counterclaims'
                      ? 'bg-[#f97316] text-white border-[#f97316] shadow-sm'
                      : 'bg-[#16171d] text-gray-400 border-[#2d2f39] hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>⚔️ Counterclaims (To Claim)</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between bg-[#16171d] p-3 rounded-xl border border-[#2d2f39]">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#f97316]" />
                <span className="text-xs font-bold text-white">
                  {extractorMode === 'counterclaims' ? 'AI Extracted Counterclaims' : 'AI Extracted Debate Claims'}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">({extractedClaims.length} Items)</span>
              </div>

              <div className="flex items-center gap-2">
                {extractedClaims.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllExtractedClaims}
                    className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Clear all extracted items"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={extractorMode === 'counterclaims' ? handleExtractCounterclaimsWithAI : handleExtractClaimsWithAI}
                  disabled={isExtracting || displayTranscripts.length === 0}
                  className="bg-gradient-to-r from-[#f97316] to-amber-500 hover:from-[#ea580c] hover:to-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5" />
                      <span>{extractorMode === 'counterclaims' ? 'Extract Counterclaims (AI)' : 'Extract Claims (AI)'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-[#121319] border border-[#232530] rounded-lg px-3 py-2 text-[11px] text-gray-400 flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide">AI Extractor</span>
              <span>Gemini AI analyzes transcript speech across all debate phases (Opening Statements, Prosecution, Cross-Exam, Rebuttal, Summation, Closing, etc.) to extract explicit claims.</span>
            </div>

            {extractedClaims.length === 0 ? (
              <div className="p-8 bg-[#0a0b0d] border border-[#1d1e24] rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                <Brain className="w-8 h-8 text-gray-600" />
                <span>
                  No items extracted yet. Click <strong>"{extractorMode === 'counterclaims' ? 'Extract Counterclaims (AI)' : 'Extract Claims (AI)'}"</strong> above to analyze transcript speech.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {extractedClaims.map((claim) => {
                  const isAssigned = claim.status === 'assigned';
                  const isCounter = extractorMode === 'counterclaims';

                  return (
                    <div
                      key={claim.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col gap-2 ${
                        isAssigned
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-[#16171d] border-[#2d2f39]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-mono font-bold bg-[#0a0b0d] text-[#f97316] px-2 py-0.5 rounded border border-[#f97316]/30">
                            {claim.formattedTime || '00:00'}
                          </span>
                          <span className="text-xs font-bold text-white">{claim.possibleSpeaker || 'Speaker'}</span>
                          <span className="text-[9px] text-gray-400 font-mono">
                            Confidence: {Math.round((claim.confidenceScore || 0.85) * 100)}%
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isAssigned ? (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded flex items-center gap-1 uppercase">
                              <Check className="w-3 h-3" />
                              <span>Assigned to {claim.assignedSpeakerName}</span>
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                              Pending Assignment
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteExtractedClaim(claim.id)}
                            className="text-gray-500 hover:text-red-400 p-1 hover:bg-white/5 rounded transition-colors cursor-pointer"
                            title="Delete extracted item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-gray-200 leading-relaxed font-medium bg-[#0a0b0d]/60 p-2 rounded border border-[#2d2f39]/50">
                        "{claim.text}"
                      </p>

                      {!isAssigned && (
                        <div className="flex flex-col gap-1.5 pt-1 border-t border-[#2d2f39]/50">
                          <span className="text-[10px] text-gray-400 font-bold uppercase">
                            {isCounter ? 'Assign Counterclaim to Target Claim:' : 'Assign Claim to Speaker:'}
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto">
                            {!isCounter ? (
                              seatedPanelists.length === 0 ? (
                                <span className="text-[10px] text-gray-500 italic">No seated panelists</span>
                              ) : (
                                seatedPanelists.map((panelist) => (
                                  <button
                                    key={panelist.id}
                                    type="button"
                                    onClick={() => handleAssignClaimToPanelist(claim, panelist)}
                                    className="bg-[#101114] hover:bg-[#f97316] hover:text-white text-gray-300 border border-[#2d2f39] hover:border-[#f97316] px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                                  >
                                    <UserPlus className="w-3 h-3" />
                                    <span>{panelist.name}</span>
                                  </button>
                                ))
                              )
                            ) : (
                              (formalClaims.length > 0 ? formalClaims : (state.claims || []).map(c => ({ claimId: c.id, speaker: c.speakerName || 'Speaker', team: 'PROPOSER', phase: 'OPENING', claimText: c.text, status: 'approved' }))).length === 0 ? (
                                <span className="text-[10px] text-gray-500 italic">No formal claims registered to assign to</span>
                              ) : (
                                (formalClaims.length > 0 ? formalClaims : (state.claims || []).map(c => ({ claimId: c.id, speaker: c.speakerName || 'Speaker', team: 'PROPOSER', phase: 'OPENING', claimText: c.text, status: 'approved' }))).map((targetClaim) => (
                                  <button
                                    key={targetClaim.claimId}
                                    type="button"
                                    onClick={() => handleAssignCounterclaimToClaim(claim, targetClaim)}
                                    className="bg-[#101114] hover:bg-amber-500 hover:text-black text-gray-300 border border-[#2d2f39] hover:border-amber-400 px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 max-w-xs truncate"
                                    title={`Rebut claim: "${targetClaim.claimText}"`}
                                  >
                                    <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="truncate">[{targetClaim.speaker}]: {targetClaim.claimText}</span>
                                  </button>
                                ))
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HIGHLIGHTS & NOTES */}
        {activeTab === 'highlights' && (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">SAVED TRANSCRIPT HIGHLIGHTS ({highlights.length})</span>

            {highlights.length === 0 ? (
              <div className="p-8 bg-[#0a0b0d] border border-[#1d1e24] rounded-xl text-center text-xs text-gray-500">
                No highlights created yet. Click 'Highlight Section' on any transcript item to tag key statements.
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {highlights.map((hl) => (
                  <div key={hl.id} className="bg-[#16171d] border border-[#2d2f39] p-3 rounded-xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded text-white" style={{ backgroundColor: hl.color || '#f97316' }}>
                        {hl.targetAction || 'Highlight'}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">{hl.createdAt}</span>
                    </div>

                    <p className="text-xs text-white font-medium italic bg-[#0a0b0d] p-2 rounded border border-[#2d2f39]/50">
                      "{hl.selectedText}"
                    </p>

                    {hl.note && (
                      <p className="text-[11px] text-gray-400">
                        <strong className="text-gray-300">Note:</strong> {hl.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: FUTURE PLACEHOLDERS */}
        {activeTab === 'placeholders' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* CARD 1: EVIDENCE GENERATION PIPELINE */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col justify-between gap-3 opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Wand2 className="w-5 h-5 text-[#f97316]" />
                  <span className="text-[8px] font-black text-[#f97316] bg-[#f97316]/10 px-2 py-0.5 rounded border border-[#f97316]/30 uppercase">
                    Future Module
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white uppercase">Automated Evidence Generation</h4>
                <p className="text-[10px] text-gray-400">AI auto-verification pipeline linking transcript claims directly to peer-reviewed study citations.</p>
              </div>
              <button disabled className="w-full bg-[#0a0b0d] border border-[#2d2f39] text-gray-500 text-[10px] font-bold py-1.5 rounded cursor-not-allowed">
                (Ready for Future Connection)
              </button>
            </div>

            {/* CARD 2: BLUEPRINT VISUALS */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col justify-between gap-3 opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Layers className="w-5 h-5 text-amber-400" />
                  <span className="text-[8px] font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 uppercase">
                    Future Module
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white uppercase">Blueprint Debate Logic Maps</h4>
                <p className="text-[10px] text-gray-400">Structured logic tree visualizer rendering premises, counter-premises, and rebuttal paths.</p>
              </div>
              <button disabled className="w-full bg-[#0a0b0d] border border-[#2d2f39] text-gray-500 text-[10px] font-bold py-1.5 rounded cursor-not-allowed">
                (Ready for Future Connection)
              </button>
            </div>

            {/* CARD 3: AI VISUAL EVIDENCE CARDS */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col justify-between gap-3 opacity-90 hover:opacity-100 transition-opacity">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <Image className="w-5 h-5 text-blue-400" />
                  <span className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30 uppercase">
                    Future Module
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white uppercase">AI Broadcast Evidence Cards</h4>
                <p className="text-[10px] text-gray-400">Generates broadcast-ready visual graphic cards rendered directly onto stage stream overlay.</p>
              </div>
              <button disabled className="w-full bg-[#0a0b0d] border border-[#2d2f39] text-gray-500 text-[10px] font-bold py-1.5 rounded cursor-not-allowed">
                (Ready for Future Connection)
              </button>
            </div>
          </div>
        )}

        {/* TAB 6: OPEN CAPTIONS & ACTIVE SPEAKER CONTROL */}
        {activeTab === 'captions' && (
          <div className="flex flex-col gap-4">
            {/* ACCENT & SPEECH MODEL CONTROLS */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Accent, Dialect & AI Speech Engine</span>
                </span>
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  International Speech Support
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Accent & Dialect Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1">
                    <span>Target Accent / Dialect:</span>
                  </label>
                  <select
                    value={session?.transcriptionLanguage || 'en-US'}
                    onChange={(e) => {
                      const newLang = e.target.value;
                      const updatedSession = { ...session, transcriptionLanguage: newLang };
                      updateStateOnServer({ transcriptionSession: updatedSession });
                      setAiSuccessMsg(`Updated speech recognition model to: ${ACCENT_LANGUAGE_OPTIONS.find(o => o.code === newLang)?.label || newLang}`);
                      setTimeout(() => setAiSuccessMsg(null), 3000);
                    }}
                    className="bg-[#0d0e10] border border-[#2d2f39] text-xs font-semibold text-white px-3 py-2 rounded-lg focus:outline-none focus:border-[#f97316]"
                  >
                    {ACCENT_LANGUAGE_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.flag} {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* AI Enhancer & Translator Toggles */}
                <div className="flex flex-col justify-center gap-2 bg-[#0d0e10] p-2.5 rounded-lg border border-[#2d2f39]">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!session?.aiEnhanceEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const updatedSession = { ...session, aiEnhanceEnabled: enabled };
                        updateStateOnServer({ transcriptionSession: updatedSession });
                      }}
                      className="rounded border-gray-600 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>AI Accent & Grammar Corrector</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!session?.autoTranslateEnabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        const updatedSession = { ...session, autoTranslateEnabled: enabled };
                        updateStateOnServer({ transcriptionSession: updatedSession });
                      }}
                      className="rounded border-gray-600 text-[#f97316] focus:ring-[#f97316]"
                    />
                    <span className="flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Auto-Translate Speech to English</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* 1. ACTIVE SPEAKER CONTROL GRID */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tag Active Open Caption Speaker</span>
                </span>
                <span className="text-[9px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                  Live Stage Tagging
                </span>
              </div>

              <p className="text-[11px] text-gray-400 leading-snug">
                Click a speaker to automatically tag live microphone subtitles during cross-examinations or floor discussions:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Host Button with Voice Profile Calibration */}
                <div className={`p-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-start gap-1.5 border ${
                  state?.currentSpeakerId === 'host' || !state?.currentSpeakerId
                    ? 'bg-cyan-600/20 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                    : 'bg-[#101114] text-gray-300 border-[#2d2f39]'
                }`}>
                  <button
                    type="button"
                    onClick={() => updateStateOnServer({ currentSpeakerId: 'host' })}
                    className="w-full text-left cursor-pointer flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-black">
                        [HOST]
                      </span>
                      {(state?.currentSpeakerId === 'host' || !state?.currentSpeakerId) && (
                        <Check className="w-3.5 h-3.5 text-cyan-400" />
                      )}
                    </div>
                    <span className="truncate w-full font-semibold">Host / Moderator (You)</span>
                  </button>

                  <div className="w-full pt-1.5 border-t border-cyan-500/20 flex items-center justify-between gap-1">
                    <span className={`text-[9px] font-medium ${session?.hostVoiceProfile ? 'text-cyan-300 font-bold' : 'text-amber-400'}`}>
                      {session?.hostVoiceProfile ? `✓ Profile (${session.hostVoiceProfile.pitchMean} Hz)` : '⚠️ Uncalibrated'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVoiceTrainingModal(true);
                      }}
                      className="text-[9px] font-bold text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30 px-2 py-0.5 rounded transition-all cursor-pointer border border-cyan-500/40"
                    >
                      {session?.hostVoiceProfile ? 'Re-Train Voice' : 'Train Voice'}
                    </button>
                  </div>
                </div>

                {/* Speaker 1 (Affirmative / Proposer) */}
                {seatedPanelists.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const id = seatedPanelists[0].id;
                      if (state?.currentSpeakerId === id) {
                        updateStateOnServer({ currentSpeakerId: null, timer: { ...(state?.timer || { duration: 120, timeLeft: 120, isRunning: false }), isRunning: false } });
                      } else {
                        const matchedPhase = state?.settings?.phases?.find(p => p.id === state?.currentPhase);
                        const defaultDuration = matchedPhase?.timerLength || 120;
                        const existingSeatTimer = state?.seatTimers?.[id];
                        const seatTimer = existingSeatTimer ? { ...existingSeatTimer, isRunning: true } : { duration: defaultDuration, timeLeft: defaultDuration, isRunning: true };
                        const curLen = (state?.transcriptionSession?.transcripts || []).length;
                        const updatedSession = {
                          ...(state?.transcriptionSession || { recordings: [], transcripts: [], extractedClaims: [], highlights: [] }),
                          interimTranscript: '',
                          activeTurnStartIndex: curLen,
                          speakerTurnStartIndices: {
                            ...(state?.transcriptionSession?.speakerTurnStartIndices || {}),
                            [id]: curLen
                          }
                        };
                        updateStateOnServer({ currentSpeakerId: id, transcriptionSession: updatedSession, timer: seatTimer, seatTimers: { ...(state?.seatTimers || {}), [id]: seatTimer } });
                      }
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-start gap-1 cursor-pointer border ${
                      state?.currentSpeakerId === seatedPanelists[0].id
                        ? 'bg-blue-600/20 text-blue-300 border-blue-500 shadow-md shadow-blue-500/20 ring-1 ring-blue-500'
                        : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-black">
                        [AFFIRMATIVE]
                      </span>
                      {state?.currentSpeakerId === seatedPanelists[0].id && (
                        <Check className="w-3.5 h-3.5 text-blue-400" />
                      )}
                    </div>
                    <span className="truncate w-full text-left font-semibold">{seatedPanelists[0].name}</span>
                    <span className="text-[9px] text-gray-400 font-normal">Proposer / Speaker 1</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-[#101114] border border-[#2d2f39] text-gray-500 text-[10px]">
                    No Affirmative Speaker Seated
                  </div>
                )}

                {/* Speaker 2 (Opposition / Contrary) */}
                {seatedPanelists.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const id = seatedPanelists[1].id;
                      if (state?.currentSpeakerId === id) {
                        updateStateOnServer({ currentSpeakerId: null, timer: { ...(state?.timer || { duration: 120, timeLeft: 120, isRunning: false }), isRunning: false } });
                      } else {
                        const matchedPhase = state?.settings?.phases?.find(p => p.id === state?.currentPhase);
                        const defaultDuration = matchedPhase?.timerLength || 120;
                        const existingSeatTimer = state?.seatTimers?.[id];
                        const seatTimer = existingSeatTimer ? { ...existingSeatTimer, isRunning: true } : { duration: defaultDuration, timeLeft: defaultDuration, isRunning: true };
                        const curLen = (state?.transcriptionSession?.transcripts || []).length;
                        const updatedSession = {
                          ...(state?.transcriptionSession || { recordings: [], transcripts: [], extractedClaims: [], highlights: [] }),
                          interimTranscript: '',
                          activeTurnStartIndex: curLen,
                          speakerTurnStartIndices: {
                            ...(state?.transcriptionSession?.speakerTurnStartIndices || {}),
                            [id]: curLen
                          }
                        };
                        updateStateOnServer({ currentSpeakerId: id, transcriptionSession: updatedSession, timer: seatTimer, seatTimers: { ...(state?.seatTimers || {}), [id]: seatTimer } });
                      }
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-start gap-1 cursor-pointer border ${
                      state?.currentSpeakerId === seatedPanelists[1].id
                        ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500'
                        : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-black">
                        [OPPOSITION]
                      </span>
                      {state?.currentSpeakerId === seatedPanelists[1].id && (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                    </div>
                    <span className="truncate w-full text-left font-semibold">{seatedPanelists[1].name}</span>
                    <span className="text-[9px] text-gray-400 font-normal">Contrary / Speaker 2</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-lg bg-[#101114] border border-[#2d2f39] text-gray-500 text-[10px]">
                    No Opposition Speaker Seated
                  </div>
                )}

                {/* Additional Seated Speakers */}
                {seatedPanelists.slice(2).map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const id = p.id;
                      if (state?.currentSpeakerId === id) {
                        updateStateOnServer({ currentSpeakerId: null, timer: { ...(state?.timer || { duration: 120, timeLeft: 120, isRunning: false }), isRunning: false } });
                      } else {
                        const matchedPhase = state?.settings?.phases?.find(p => p.id === state?.currentPhase);
                        const defaultDuration = matchedPhase?.timerLength || 120;
                        const existingSeatTimer = state?.seatTimers?.[id];
                        const seatTimer = existingSeatTimer ? { ...existingSeatTimer, isRunning: true } : { duration: defaultDuration, timeLeft: defaultDuration, isRunning: true };
                        const curLen = (state?.transcriptionSession?.transcripts || []).length;
                        const updatedSession = {
                          ...(state?.transcriptionSession || { recordings: [], transcripts: [], extractedClaims: [], highlights: [] }),
                          interimTranscript: '',
                          activeTurnStartIndex: curLen,
                          speakerTurnStartIndices: {
                            ...(state?.transcriptionSession?.speakerTurnStartIndices || {}),
                            [id]: curLen
                          }
                        };
                        updateStateOnServer({ currentSpeakerId: id, transcriptionSession: updatedSession, timer: seatTimer, seatTimers: { ...(state?.seatTimers || {}), [id]: seatTimer } });
                      }
                    }}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all flex flex-col items-start gap-1 cursor-pointer border ${
                      state?.currentSpeakerId === p.id
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500 shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
                        : 'bg-[#101114] text-gray-300 border-[#2d2f39] hover:bg-[#232530]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-black">
                        [SPEAKER {idx + 3}]
                      </span>
                      {state?.currentSpeakerId === p.id && (
                        <Check className="w-3.5 h-3.5 text-purple-400" />
                      )}
                    </div>
                    <span className="truncate w-full text-left font-semibold">{p.name}</span>
                    <span className="text-[9px] text-gray-400 font-normal">Debater</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. MANUAL SUBTITLE & NON-VERBAL BROADCASTER */}
            <div className="bg-[#16171d] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-3">
              <span className="text-[10px] font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Subtitle & Non-Verbal Cue Broadcaster</span>
              </span>

              {/* Quick Non-Verbal Tag Buttons */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Inject Non-Verbal Cue:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['[cough]', '[clears throat]', '[laughing]', '[sigh]', '[applause]', '[gasp]', '[multiple people talking]', '[unable to caption]'].map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const currentSession = sessionRef.current || session;
                        const existingInterim = currentSession.interimTranscript || '';
                        const newText = existingInterim ? `${existingInterim} ${tag}` : tag;
                        updateStateOnServer({
                          transcriptionSession: {
                            ...currentSession,
                            interimTranscript: newText,
                            isRecording: currentSession.isRecording ?? false
                          }
                        });
                      }}
                      className="px-2.5 py-1 bg-[#0a0b0d] hover:bg-[#232530] border border-[#2d2f39] hover:border-[#f97316] text-amber-300 text-[11px] font-mono font-bold rounded-md transition-colors cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Subtitle Input */}
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Broadcast Custom Subtitle Text:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualCaptionText}
                    onChange={(e) => setManualCaptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualCaptionText.trim()) {
                        const currentSession = sessionRef.current || session;
                        updateStateOnServer({
                          transcriptionSession: {
                            ...currentSession,
                            interimTranscript: manualCaptionText.trim(),
                            isRecording: currentSession.isRecording ?? false
                          }
                        });
                        setManualCaptionText('');
                      }
                    }}
                    placeholder="Type a subtitle phrase to project on stage (e.g. 'Floor is open for discussion.')..."
                    className="flex-1 bg-[#0a0b0d] border border-[#2d2f39] text-xs text-white px-3 py-2 rounded-lg focus:outline-none focus:border-[#f97316]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualCaptionText.trim()) return;
                      const currentSession = sessionRef.current || session;
                      updateStateOnServer({
                        transcriptionSession: {
                          ...currentSession,
                          interimTranscript: manualCaptionText.trim(),
                          isRecording: currentSession.isRecording ?? false
                        }
                      });
                      setManualCaptionText('');
                    }}
                    className="bg-[#f97316] hover:bg-[#ea580c] text-white px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Push</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const currentSession = sessionRef.current || session;
                      updateStateOnServer({
                        transcriptionSession: {
                          ...currentSession,
                          interimTranscript: '',
                          isRecording: currentSession.isRecording ?? false
                        }
                      });
                    }}
                    className="bg-[#232530] hover:bg-[#2d2f39] text-gray-300 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Live Preview Monitor */}
              <div className="bg-[#0a0b0d] border border-[#2d2f39] p-2.5 rounded-lg flex flex-col gap-1">
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">Stage Live Subtitle Monitor</span>
                <p className="text-xs font-semibold text-cyan-200 min-h-[20px] italic">
                  {session.interimTranscript || (session.transcripts && session.transcripts.length > 0 ? session.transcripts[session.transcripts.length - 1].text : '[No active caption projected]')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* HIGHLIGHT & ACTION MODAL */}
      {showHighlightModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#16171d] border border-[#2d2f39] rounded-xl max-w-lg w-full p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2d2f39] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Highlighter className="w-4 h-4 text-[#f97316]" />
                <span>Transcript Highlight & AI Actions</span>
              </h3>
              <button onClick={() => setShowHighlightModal(false)} className="text-gray-400 hover:text-white font-bold text-xs">✕</button>
            </div>

            <div className="bg-[#0a0b0d] border border-[#2d2f39] p-3 rounded-lg text-xs text-white font-medium italic">
              "{selectedText}"
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Host Note / Context</label>
              <input
                type="text"
                value={highlightNote}
                onChange={(e) => setHighlightNote(e.target.value)}
                placeholder="Optional note or context..."
                className="w-full bg-[#0a0b0d] border border-[#2d2f39] text-xs text-white p-2.5 rounded-lg focus:outline-none focus:border-[#f97316]"
              />
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-[#2d2f39]">
              <span className="text-[10px] font-bold text-gray-400 uppercase">SELECT ACTION</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSaveHighlight('claim')}
                  className="bg-[#f97316] hover:bg-[#ea580c] text-white p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 justify-center"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Claim</span>
                </button>
                <button
                  onClick={() => handleSaveHighlight('research')}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 justify-center"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Send to Research Bot</span>
                </button>
                <button
                  onClick={() => handleSaveHighlight('judge')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 justify-center"
                >
                  <Gavel className="w-3.5 h-3.5" />
                  <span>Send to Judge Bot</span>
                </button>
                <button
                  onClick={() => handleSaveHighlight('existing_claim')}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 justify-center"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Save Highlight Only</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HOST VOICE TRAINING & CALIBRATION MODAL */}
      {showVoiceTrainingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121318] border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 text-white animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-[#2d2f39] pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                  <Mic className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300">
                    Host Voice Profile Calibration
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Lock your vocal pitch profile so non-host voices never show as Host.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (calibrationMediaStreamRef.current) {
                    calibrationMediaStreamRef.current.getTracks().forEach(t => t.stop());
                  }
                  setShowVoiceTrainingModal(false);
                }}
                className="text-gray-400 hover:text-white text-xs font-bold px-2 py-1 rounded bg-[#1e2029] border border-[#2d2f39] cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="bg-[#0a0b0e] border border-[#2d2f39] p-3.5 rounded-xl flex flex-col gap-2">
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Read Calibration Statement Out Loud (8 Seconds):</span>
                </span>
                <p className="text-xs font-medium text-gray-200 bg-[#14161f] p-3 rounded-lg border border-cyan-500/20 italic leading-relaxed">
                  "{CALIBRATION_STATEMENT}"
                </p>
              </div>

              {isCalibratingHostVoice ? (
                <div className="bg-[#0a0b0e] border border-cyan-500/40 p-4 rounded-xl flex flex-col gap-3 items-center justify-center text-center">
                  <div className="flex items-center gap-2 text-cyan-300 font-mono text-sm font-black">
                    <Radio className="w-4 h-4 text-rose-500 animate-ping" />
                    <span>RECORDING VOICE PRINT: {calibrationSecondsLeft}s REMAINING</span>
                  </div>

                  {/* Volume meter bar */}
                  <div className="w-full bg-[#1b1d28] rounded-full h-3 overflow-hidden border border-[#2d2f39] p-0.5">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-amber-400 h-full rounded-full transition-all duration-75"
                      style={{ width: `${Math.max(5, calibrationAudioLevel)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between w-full text-[11px] font-mono text-gray-300 pt-1">
                    <span>Live Vocal Pitch: <strong className="text-amber-400">{calibrationLivePitch > 0 ? `${calibrationLivePitch} Hz` : 'Detecting...'}</strong></span>
                    <span>Pitch Samples: <strong className="text-cyan-300">{calibrationSamplesCount}</strong></span>
                  </div>
                </div>
              ) : calibrationResult ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold">
                    <Check className="w-4 h-4" />
                    <span>Voice Calibration Complete & Saved!</span>
                  </div>
                  <p className="text-[11px] text-gray-300 leading-normal">
                    Mean Vocal Pitch mapped to <strong className="text-white">{calibrationResult.mean} Hz</strong> (Range: {calibrationResult.min} Hz - {calibrationResult.max} Hz). The AI live stage will now lock your voice to Host and designate all non-matching voices as Guest Speakers.
                  </p>
                </div>
              ) : (
                <div className="bg-[#0a0b0e] border border-[#2d2f39] p-3 rounded-xl flex flex-col gap-2">
                  <span className="text-[10px] text-gray-400">
                    {session?.hostVoiceProfile ? (
                      <>Currently calibrated at <strong className="text-cyan-300">{session.hostVoiceProfile.pitchMean} Hz</strong>. Click below to recalibrate.</>
                    ) : (
                      <>Uncalibrated. Click start, then speak the statement above clearly into your microphone.</>
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2d2f39]">
              {!isCalibratingHostVoice && (
                <button
                  type="button"
                  onClick={startLiveVoiceCalibration}
                  className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs py-2.5 rounded-xl shadow-lg shadow-orange-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>{session?.hostVoiceProfile ? 'Recalibrate Host Voice' : 'Start Voice Calibration (8s)'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
