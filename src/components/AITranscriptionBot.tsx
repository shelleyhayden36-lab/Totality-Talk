import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Play, Pause, Volume2, VolumeX, Sparkles, Plus, Check,
  Brain, UserPlus, Highlighter, FileText, Search, Gavel, Clock, Link2,
  Trash2, ChevronDown, Wand2, Image, Layers, RefreshCw, AlertCircle, ShieldAlert,
  Radio, Upload, FileAudio, Loader2, Zap
} from 'lucide-react';
import {
  Participant, FormalClaim, AudioRecording, TranscriptItem,
  ExtractedClaim, TranscriptHighlight, AudioTranscriptionSession
} from '../types';

interface AITranscriptionBotProps {
  state: any;
  updateStateOnServer: (partial: any) => Promise<void>;
  seatedPanelists: Participant[];
  formalClaims: FormalClaim[];
  className?: string;
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

  // Future placeholders toggle
  const [activeTab, setActiveTab] = useState<'recorder' | 'transcript' | 'claims' | 'highlights' | 'placeholders'>('recorder');

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

  // RULE: Transcriptions should ONLY be showing if actively recording OR if a recording is selected.
  // If no selected recording and not actively recording, displayTranscripts is zero ([]).
  const isActivelyRecording = isRecording;
  const selectedRecordingId = session.selectedRecordingId;

  const displayTranscripts: TranscriptItem[] = (isActivelyRecording || !!selectedRecordingId)
    ? sessionTranscripts
    : [];

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

  // Speech Recognition initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

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

          if (finalTranscript.trim()) {
            addTranscriptSegment(finalTranscript.trim());
          }
        };

        // Continuous auto-restart if speech recognition pauses mid-session
        recognition.onend = () => {
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Ignore if already starting or active
            }
          }
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition notice:', e.error);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  // Helper to format seconds as MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Add a new transcript segment
  const addTranscriptSegment = (text: string) => {
    const currentSecs = recordingTimeRef.current;
    const formatted = formatTime(currentSecs);

    // Simple speaker heuristics based on active speaker or seated panelists
    let detectedSpeaker = 'Unknown Speaker';
    const activeSpeaker = state?.participants?.find((p) => p.id === state?.currentSpeakerId && p.isSeated);
    if (activeSpeaker) {
      detectedSpeaker = `${activeSpeaker.role === 'PROPOSER' ? 'Affirmative' : 'Opposition'} (${activeSpeaker.name})`;
    } else if (seatedPanelists.length > 0) {
      const index = Math.floor((currentSecs / 15) % seatedPanelists.length);
      const speaker = seatedPanelists[index];
      detectedSpeaker = `${speaker.role === 'PROPOSER' ? 'Affirmative' : 'Opposition'} (${speaker.name})`;
    }

    const newItem: TranscriptItem = {
      id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestampSeconds: currentSecs,
      formattedTime: formatted,
      speaker: detectedSpeaker,
      text,
    };

    const currentTranscripts = transcriptsRef.current || [];
    const updatedTranscripts = [...currentTranscripts, newItem];
    transcriptsRef.current = updatedTranscripts;

    const currentSession = state?.transcriptionSession || session;
    const updatedSession = { ...currentSession, transcripts: updatedTranscripts };

    updateStateOnServer({ transcriptionSession: updatedSession });
  };

  // Start Audio Recording
  const handleStartRecording = async () => {
    try {
      setAiError(null);
      setRecordingTime(0);
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
            // Fallback attempt to getUserMedia if getDisplayMedia fails entirely
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
          };

          await updateStateOnServer({ transcriptionSession: updatedSession });
          setAiSuccessMsg('Recording saved to debate session successfully.');
          setTimeout(() => setAiSuccessMsg(null), 4000);
        };
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      // Sync isRecording status to server state for live stage display & reset transcripts for new live speech session
      const startSession = { ...sessionRef.current, isRecording: true, wasJustStopped: false, transcripts: [] };
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
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }

      // Sync isRecording: false & wasJustStopped: true to server state
      const stopSession = { ...(sessionRef.current || session), isRecording: false, wasJustStopped: true };
      updateStateOnServer({ transcriptionSession: stopSession });

      // Request final data from mediaRecorder and stop cleanly
      try {
        if (mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.warn('Notice stopping MediaRecorder:', e);
      }
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
          seatedPanelists,
        }),
      });

      const data = await response.json();
      if (data.error) {
        setAiError(data.error);
        return;
      }

      // Convert returned transcripts to TranscriptItem
      const newTranscripts: TranscriptItem[] = (data.transcripts || []).map((t: any, idx: number) => ({
        id: `tr_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        timestampSeconds: t.timestampSeconds || 0,
        formattedTime: t.formattedTime || formatTime(t.timestampSeconds || 0),
        speaker: t.speaker || 'Speaker',
        text: t.text || '',
      }));

      // Convert returned claims to ExtractedClaim
      const newClaims: ExtractedClaim[] = (data.claims || []).map((c: any, idx: number) => ({
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

  // AI Claim Extraction Call
  const handleExtractClaimsWithAI = async () => {
    if (!displayTranscripts || displayTranscripts.length === 0) {
      setAiError('No transcript items available yet. Start recording live audio or select a saved session recording.');
      return;
    }

    setIsExtracting(true);
    setAiError(null);

    try {
      const response = await fetch('/api/transcription/extract-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcripts: displayTranscripts,
          seatedPanelists,
        }),
      });

      const data = await response.json();
      if (data.claims && Array.isArray(data.claims)) {
        const newClaims: ExtractedClaim[] = data.claims.map((c: any) => ({
          id: `cl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          text: c.text,
          confidenceScore: c.confidenceScore || 0.88,
          timestampSeconds: c.timestampSeconds || 0,
          formattedTime: c.formattedTime || formatTime(c.timestampSeconds || 0),
          possibleSpeaker: c.possibleSpeaker || 'Unknown Speaker',
          status: 'pending',
        }));

        const updatedSession = {
          ...session,
          extractedClaims: [...newClaims, ...extractedClaims],
        };
        await updateStateOnServer({ transcriptionSession: updatedSession });
        setAiSuccessMsg(`Successfully extracted ${newClaims.length} debate claims using Gemini AI.`);
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

    const updatedHighlights = [newHighlight, ...highlights];
    let updatedSession = { ...session, highlights: updatedHighlights };

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

        {/* TAB 2: LIVE TRANSCRIPT */}
        {activeTab === 'transcript' && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between bg-[#16171d] p-3 rounded-xl border border-[#2d2f39]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#f97316]" />
                <span className="text-xs font-bold text-white">Debate Speech Transcript</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExtractClaimsWithAI}
                  disabled={isExtracting || displayTranscripts.length === 0}
                  className="bg-gradient-to-r from-[#f97316] to-amber-500 hover:from-[#ea580c] hover:to-amber-600 text-white px-3 py-1 rounded text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-md"
                  title="Extract key debate claims from transcript using Gemini AI"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Extracting...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-3.5 h-3.5" />
                      <span>Extract Claims (Gemini AI)</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] font-mono text-gray-400">
                  {isActivelyRecording ? 'LIVE RECORDING' : selectedRecordingId ? 'SELECTED RECORDING' : 'IDLE'}
                </span>
              </div>
            </div>

            {/* TRANSCRIPT LIST */}
            {displayTranscripts.length === 0 ? (
              <div className="p-8 bg-[#0a0b0d] border border-[#1d1e24] rounded-xl text-center text-xs text-gray-500 flex flex-col items-center gap-2">
                <Mic className="w-8 h-8 text-gray-600 animate-pulse" />
                <span>Transcript is zero. Start recording live audio above or select a saved session recording to view its transcript.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                {displayTranscripts.map((t) => {
                  const isActiveLine = isPlaying && Math.abs(playbackTime - t.timestampSeconds) < 5;
                  return (
                    <div
                      key={t.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isActiveLine
                          ? 'bg-[#f97316]/15 border-[#f97316]/50 shadow-md shadow-[#f97316]/10'
                          : 'bg-[#16171d]/60 border-[#2d2f39]/60 hover:border-[#f97316]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => jumpToTimestamp(t.timestampSeconds)}
                            className="bg-[#0a0b0d] hover:bg-[#f97316] hover:text-white text-[#f97316] font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-[#f97316]/30 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Click to jump audio to this moment"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{t.formattedTime}</span>
                          </button>
                          <span className="text-xs font-bold text-white">{t.speaker}</span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedText(t.text);
                            setShowHighlightModal(true);
                          }}
                          className="text-[10px] font-bold text-[#f97316] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Highlighter className="w-3 h-3" />
                          <span>Highlight Section</span>
                        </button>
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
    </div>
  );
};
