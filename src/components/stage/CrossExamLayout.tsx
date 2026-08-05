import React from 'react';
import { motion } from 'motion/react';
import { DebateState } from '../../App';
import StageTimer from './StageTimer';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
}

export default function CrossExamLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  // Extract custom state properties with safe defaults
  const questionerId = state.crossExamQuestionerId || null;
  const respondentId = state.crossExamRespondentId || null;
  const subPhase = state.crossExamSubPhase || 'QUESTION';

  // Find the actual participant objects
  const questioner = state.participants?.find(p => p.id === questionerId && p.isSeated);
  const respondent = state.participants?.find(p => p.id === respondentId && p.isSeated);

  // Fallbacks if no explicit questioner/respondent is selected yet
  const fallbackQuestioner = state.participants?.find(p => p.role === 'PROPOSER' && p.isSeated);
  const fallbackRespondent = state.participants?.find(p => p.role === 'CONTRARY' && p.isSeated);

  const activeQuestioner = questioner || fallbackQuestioner;
  const activeRespondent = respondent || fallbackRespondent;

  // Which entity is being highlighted in the central circle right now?
  const isResponseMode = subPhase === 'RESPONSE';
  const highlightedSpeaker = isResponseMode ? activeRespondent : activeQuestioner;

  const isAffirmative = highlightedSpeaker ? highlightedSpeaker.role === 'PROPOSER' : !isResponseMode;
  const teamLabel = highlightedSpeaker
    ? (highlightedSpeaker.role === 'PROPOSER' ? 'TEAM AFFIRMATIVE' : 'TEAM OPPOSITION')
    : (isResponseMode ? 'TEAM OPPOSITION' : 'TEAM AFFIRMATIVE');

  const speakerInitial = highlightedSpeaker 
    ? highlightedSpeaker.name.replace('@', '').charAt(0).toUpperCase() 
    : 'T';

  const mainColorClass = isAffirmative ? 'text-cyan-400' : 'text-orange-400';
  const pulseColorClass = isAffirmative ? 'border-cyan-500/30 bg-cyan-500/2' : 'border-orange-500/30 bg-orange-500/2';
  const ringDashedClass = isAffirmative ? 'border-cyan-500/10' : 'border-orange-500/10';
  const border30Class = isAffirmative ? 'border-cyan-500/30' : 'border-orange-500/30';
  const border60Class = isAffirmative ? 'border-cyan-500/60' : 'border-orange-500/60';
  const border10Class = isAffirmative ? 'border-cyan-500/10' : 'border-orange-500/10';

  // Toggle subphase handler (Questioner <-> Respondent)
  const handleToggleSubPhase = () => {
    if (!onStateUpdate) return;
    
    if (subPhase === 'QUESTION') {
      onStateUpdate({
        crossExamSubPhase: 'RESPONSE',
        timer: {
          duration: 180,
          timeLeft: 180,
          isRunning: false
        }
      });
    } else {
      onStateUpdate({
        crossExamSubPhase: 'QUESTION',
        timer: {
          duration: 90,
          timeLeft: 90,
          isRunning: false
        }
      });
    }
  };

  // Ripples for soundwave pulsing animation
  const rippleDelays = [0, 1, 2];

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-3 relative bg-[#07080a] overflow-hidden">
      
      {/* TOP-RIGHT FLOATING SLEEK TIMER */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={isAffirmative} />

      {/* VISUAL CONTENT AREA */}
      <div className="flex-1 flex flex-col justify-between z-10">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col shrink-0">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan - limited width to prevent clashing with timer */}
          <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className={mainColorClass}>PERSPECTIVE</span>
          </div>

          {/* display titles */}
          <div className="flex flex-col mt-2 space-y-0.5">
            <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight leading-none uppercase">
              CROSS-
            </h1>
            <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight leading-none uppercase">
              EXAMINATION
            </h1>
            <h1 className={`text-[26px] md:text-3xl font-black ${mainColorClass} tracking-tight leading-none uppercase`}>
              RUNDOWN
            </h1>
          </div>

          {/* Subtitle */}
          <span className="text-[9.5px] font-bold text-gray-500 tracking-[0.15em] uppercase mt-1.5 block">
            TOTALITY TALK
          </span>

          {/* Custom Horizontal Divider */}
          <div className="w-full border-b border-gray-800/40 mt-3" />
        </div>

        {/* MIDDLE SECTION: Concentric pulsing circles & Dynamic status */}
        <div className="flex flex-col items-center justify-center my-auto py-1">
          
          {/* Center concentric sound waves container - beautifully scaled to w-32 */}
          <div className="relative w-32 h-32 flex items-center justify-center">
            
            {/* Pulsing Ripples (Sound waves) */}
            {rippleDelays.map((delayIndex) => (
              <motion.div
                key={delayIndex}
                className={`absolute rounded-full border ${pulseColorClass}`}
                initial={{ width: 44, height: 44, opacity: 0.6 }}
                animate={{
                  width: 120,
                  height: 120,
                  opacity: 0,
                }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  delay: delayIndex * 1.05,
                  ease: "easeOut",
                }}
              />
            ))}

            {/* Static Rings */}
            {/* Outer ring */}
            <div className="absolute w-[115px] h-[115px] rounded-full border border-gray-900/40" />
            
            {/* Middle dashed sound wave ring */}
            <div className={`absolute w-[95px] h-[95px] rounded-full border border-dashed ${ringDashedClass}`} />
            
            {/* Inner ring */}
            <div className="absolute w-[75px] h-[75px] rounded-full border border-gray-900/60" />

            {/* Double Border around central badge */}
            <div className={`absolute w-[60px] h-[60px] rounded-full border ${border30Class}`} />
            <div className={`absolute w-[52px] h-[52px] rounded-full border ${border60Class}`} />

            {/* Central Badge */}
            <div className={`absolute w-[44px] h-[44px] bg-[#0a0b0d] rounded-full flex items-center justify-center shadow-2xl border ${border10Class}`}>
              <span className={`text-lg font-black ${mainColorClass} select-none tracking-tighter`}>
                {speakerInitial}
              </span>
            </div>
          </div>

          {/* Speaker label matching the image styling under the circle */}
          <div className="text-center mt-2 space-y-0.5">
            <span className="text-[9px] font-black tracking-[0.25em] text-gray-500 uppercase block">
              {subPhase === 'QUESTION' ? 'QUESTIONER' : 'RESPONDENT'}
            </span>
            <h2 className={`text-lg font-black tracking-wide uppercase ${mainColorClass}`}>
              {teamLabel}
            </h2>
            {highlightedSpeaker && (
              <p className="text-[11px] font-bold text-gray-400 tracking-wider">
                @{highlightedSpeaker.name.replace('@', '')}
              </p>
            )}
          </div>
        </div>

      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="mt-auto pt-2 w-full flex items-end justify-end z-10 pointer-events-none">
        {onStateUpdate && (
          <div className="pointer-events-auto pb-4 pr-1">
            <button
              onClick={handleToggleSubPhase}
              className="px-3 py-1.5 bg-[#101114] hover:bg-[#1c1d24] text-gray-400 hover:text-white border border-gray-800 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-lg cursor-pointer"
            >
              Toggle Role
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
