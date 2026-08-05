import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateState } from '../../App';
import StageTimer from './StageTimer';
import { getActivePhaseTranscripts } from '../../lib/transcriptUtils';
import { 
  Mic, 
  CheckCircle2, 
  Terminal, 
  Cpu, 
  Activity
} from 'lucide-react';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partial: any) => Promise<void> | void;
}

export default function OpeningLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  // Identify Active Speaker
  const activeSpeaker = state.participants?.find(p => p.id === state.currentSpeakerId && p.isSeated);
  
  // Speaker details & team coloring
  const isAffirmative = activeSpeaker ? activeSpeaker.role === 'PROPOSER' : true; 
  const teamLabel = activeSpeaker 
    ? (activeSpeaker.role === 'PROPOSER' ? 'TEAM AFFIRMATIVE' : 'TEAM OPPOSITION')
    : 'TEAM AFFIRMATIVE';

  const speakerName = activeSpeaker ? `@${activeSpeaker.name.replace('@', '')}` : 'Speaker Standby';
  const speakerInitial = activeSpeaker 
    ? activeSpeaker.name.replace('@', '').charAt(0).toUpperCase() 
    : 'S';

  const mainColorClass = isAffirmative ? 'text-cyan-400' : 'text-orange-400';
  const borderAccentClass = isAffirmative ? 'border-cyan-500/30' : 'border-orange-500/30';
  const bgAccentClass = isAffirmative ? 'bg-cyan-500/10' : 'bg-orange-500/10';
  const glowShadowClass = isAffirmative 
    ? 'shadow-[0_0_35px_rgba(6,182,212,0.15)]' 
    : 'shadow-[0_0_35px_rgba(249,115,22,0.15)]';

  // Session Transcripts & Live Recording State directly from server state
  const session = state?.transcriptionSession;
  const rawTranscripts = session?.transcripts || [];
  const phaseTranscripts = getActivePhaseTranscripts(rawTranscripts, state?.currentPhase || 'OPENING', state?.currentRound || 'Round 1');
  
  const activeSpeakerId = state.showOpeningStatementPopupForParticipantId || state.currentSpeakerId;

  // Track starting transcript index when current speaker/seat turn changes
  const speakerTurnStartRef = useRef<{ speakerId: string | null; offset: number }>({
    speakerId: activeSpeakerId || null,
    offset: rawTranscripts.length
  });

  useEffect(() => {
    if (speakerTurnStartRef.current.speakerId !== activeSpeakerId) {
      speakerTurnStartRef.current = {
        speakerId: activeSpeakerId || null,
        offset: rawTranscripts.length
      };
    }
  }, [activeSpeakerId]);

  // Check server-provided turn start index for this speaker/seat, falling back to local turn start
  const serverStartIdx = activeSpeakerId ? session?.speakerTurnStartIndices?.[activeSpeakerId] : undefined;
  const startOffset = typeof serverStartIdx === 'number'
    ? serverStartIdx
    : speakerTurnStartRef.current.offset;

  // Filter transcripts so teleprompter ONLY shows new transcript items recorded for THIS opening statement session/seat
  const transcripts = phaseTranscripts.filter((t) => {
    const rawIndex = rawTranscripts.indexOf(t);
    return rawIndex === -1 || rawIndex >= startOffset;
  });

  const interimTranscript = session?.interimTranscript || '';
  const isRecordingSession = !!session?.isRecording;
  const selectedRecordingId = session?.selectedRecordingId;

  // Teleprompter automatically displays live speech during Opening Statements (no manual record button required)
  const hasLiveSpeech = true;

  const [isUserHovering, setIsUserHovering] = useState(false);

  // Auto-scroll teleprompter container
  const teleprompterRef = useRef<HTMLDivElement>(null);

  // Instantly pick up where left off (scroll to bottom) on mount, speaker change, or new text
  useEffect(() => {
    const container = teleprompterRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [activeSpeakerId, transcripts.length, interimTranscript]);

  // Slow cinematic crawl for teleprompter
  useEffect(() => {
    if (isUserHovering || transcripts.length === 0) return;
    const container = teleprompterRef.current;
    if (!container) return;

    // Slow 1px scroll every 45ms for cinematic, readable crawling speed
    const scrollInterval = setInterval(() => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (container.scrollTop < maxScroll) {
        container.scrollTop += 1;
      }
    }, 45);

    return () => clearInterval(scrollInterval);
  }, [transcripts, isUserHovering]);

  // Keep scroll position smooth at bottom when new speech segments arrive during active recording
  useEffect(() => {
    if (teleprompterRef.current && !isUserHovering) {
      teleprompterRef.current.scrollTo({
        top: teleprompterRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcripts.length, interimTranscript, isRecordingSession, isUserHovering]);

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-2 sm:p-3 relative bg-[#060709] text-white justify-between overflow-hidden">
      
      {/* FLOATING STAGE TIMER IN UPPER RIGHT CORNER */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={isAffirmative} />

      {/* SLEEK HEADER BAR - TOP RIGHT RESERVED EXCLUSIVELY FOR TIMER */}
      <div className="flex items-center justify-between border-b border-gray-800/60 pb-2 mb-2 shrink-0 pr-32">
        <div className="flex items-center gap-2 bg-[#0d0f16] border border-gray-800 rounded-full px-3.5 py-1.5 shadow-md">
          <span className={`w-2.5 h-2.5 rounded-full ${isRecordingSession ? 'bg-orange-500 animate-ping' : 'bg-cyan-400'}`} />
          <span className="text-sm font-black text-white uppercase tracking-wide">
            {speakerName}
          </span>
          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider border ${borderAccentClass} ${mainColorClass} ${bgAccentClass}`}>
            {teamLabel}
          </span>
        </div>
      </div>

      {/* MAIN OPEN TRANSCRIPTION STAGE */}
      <div className="flex-1 flex flex-col justify-center relative overflow-hidden my-1">
        <AnimatePresence mode="wait">
          
          {hasLiveSpeech ? (
            
            /* CINEMATIC CRAWLING TELEPROMPTER VIEW - CONNECTED TO ACTIVE LIVE TRANSCRIPTION OR SELECTED RECORDING */
            <motion.div
              key="teleprompter-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex flex-col justify-between relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#050608] via-[#090b10] to-[#050608] border border-gray-800/80 p-4 sm:p-6 shadow-2xl"
              onMouseEnter={() => setIsUserHovering(true)}
              onMouseLeave={() => setIsUserHovering(false)}
            >
              {/* TOP FADE OVERLAY FOR CINEMATIC TELEPROMPTER CRAWL */}
              <div className="absolute top-0 left-0 right-0 h-10 bg-gradient-to-b from-[#050608] to-transparent z-10 pointer-events-none" />

              {/* CURRENTLY SPEAKING HEADER BAR */}
              <div className="z-10 pb-2.5 border-b border-white/10 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <Mic className={`w-4 h-4 ${mainColorClass} ${isRecordingSession ? 'animate-pulse' : ''}`} />
                  <span className="text-gray-400 font-bold uppercase tracking-wider">
                    {isRecordingSession ? 'LIVE TRANSCRIPTION:' : 'PLAYBACK TRANSCRIPTION:'}
                  </span>
                  <span className={`text-sm font-black uppercase tracking-wide ${mainColorClass}`}>{speakerName}</span>
                </div>
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${borderAccentClass} ${mainColorClass} ${bgAccentClass}`}>
                  {teamLabel}
                </span>
              </div>

              {/* SCROLLING TELEPROMPTER TEXT AREA */}
              <div 
                ref={teleprompterRef}
                className="flex-1 overflow-y-auto scrollbar-none space-y-6 py-6 px-2 sm:px-6 relative text-center flex flex-col justify-start"
              >
                {transcripts.map((t, idx) => (
                  <motion.p 
                    key={t.id || idx} 
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-lg sm:text-2xl font-semibold text-gray-100 leading-[1.85] tracking-wide font-sans select-text max-w-4xl mx-auto"
                  >
                    {t.text}
                  </motion.p>
                ))}
                {interimTranscript && (
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-lg sm:text-2xl font-bold text-cyan-300 italic leading-[1.85] tracking-wide font-sans select-text max-w-4xl mx-auto animate-pulse"
                  >
                    "{interimTranscript}..."
                  </motion.p>
                )}
                {transcripts.length === 0 && !interimTranscript && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-cyan-400">
                    <Mic className="w-8 h-8 animate-pulse mb-2 text-cyan-400" />
                    <p className="text-lg font-bold text-white">Live Teleprompter Listening</p>
                    <p className="text-xs sm:text-sm text-cyan-300/80 mt-1 max-w-md">Speech recognition is active live. Speak into your microphone and transcriptions will stream here automatically.</p>
                  </div>
                )}
              </div>

              {/* BOTTOM FADE OVERLAY FOR CINEMATIC CRAWL */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#050608] to-transparent z-10 pointer-events-none" />
            </motion.div>

          ) : (
            
            /* IDLE STANDBY STATE - SAYS "WAITING" */
            <motion.div
              key="standby-view"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`bg-gradient-to-br from-[#0c0e14]/90 to-[#07080c]/90 border ${borderAccentClass} p-6 sm:p-8 rounded-2xl shadow-2xl relative overflow-hidden backdrop-blur-md h-full flex flex-col justify-between ${glowShadowClass}`}
            >
              {/* Ambient Background Glow */}
              <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl pointer-events-none ${isAffirmative ? 'bg-cyan-500/10' : 'bg-orange-500/10'}`} />

              {/* CENTER SPEAKER DISPLAY */}
              <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-6">
                <div className="relative w-24 h-24 flex items-center justify-center mb-3">
                  <motion.div
                    className={`absolute rounded-full border ${isAffirmative ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-orange-500/30 bg-orange-500/10'}`}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    style={{ width: '100%', height: '100%' }}
                  />
                  
                  <div className={`w-[70px] h-[70px] bg-[#08090d] rounded-full flex items-center justify-center shadow-2xl border-2 ${borderAccentClass}`}>
                    <span className={`text-2xl font-black ${mainColorClass} tracking-tight`}>
                      {speakerInitial}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase block mb-1">
                  CURRENT SPEAKER ON STAGE
                </span>
                
                <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight uppercase">
                  {speakerName}
                </h2>

                <div className="mt-3 inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-gray-800 bg-[#0d0f16]">
                  <span className={`w-2 h-2 rounded-full ${isAffirmative ? 'bg-cyan-400' : 'bg-orange-400'}`} />
                  <span className={`text-[11px] font-black uppercase tracking-wider ${mainColorClass}`}>
                    {teamLabel}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-2 text-sm font-mono text-gray-400 bg-[#0d0f16] px-4 py-1.5 rounded-full border border-gray-800">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="font-extrabold uppercase tracking-widest text-gray-300">WAITING</span>
                </div>
              </div>

              {/* FOOTER */}
              <div className="pt-2 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-500 font-bold shrink-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-gray-500 uppercase tracking-wider">Speaker:</span>
                  <span className={`font-black uppercase ${mainColorClass}`}>{speakerName}</span>
                </span>
                <span className="text-gray-500 uppercase tracking-wider">
                  Opening Statement
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
