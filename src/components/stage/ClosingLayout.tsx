import React from 'react';
import { motion } from 'motion/react';
import { DebateState } from '../../App';
import StageTimer from './StageTimer';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
}

export default function ClosingLayout({ state, formatTime }: LayoutProps) {
  const subPhase = state.closingSubPhase || 'STATEMENTS';

  // Extract vote details from chatVotes
  const proVotes = state.chatVotes?.pro || 0;
  const conVotes = state.chatVotes?.con || 0;
  const totalVotes = proVotes + conVotes;

  const proPct = totalVotes === 0 ? 50 : Math.round((proVotes / totalVotes) * 100);
  const conPct = totalVotes === 0 ? 50 : Math.round((conVotes / totalVotes) * 100);

  // Extract participant speaker details using currentSpeakerId
  const activeSpeakerId = state.currentSpeakerId || null;
  const activeSpeaker = state.participants?.find(p => p.id === activeSpeakerId && p.isSeated) || null;

  // Extract team names from settings
  const proTeamName = state.settings.proTeamName || 'Affirmative';
  const conTeamName = state.settings.conTeamName || 'Opposition';

  const speakerInitial = activeSpeaker 
    ? activeSpeaker.name.replace('@', '').charAt(0).toUpperCase() 
    : 'C';

  // Ripples for soundwave pulsing animation
  const rippleDelays = [0, 1, 2];

  if (subPhase === 'VOTE') {
    return (
      <div className="flex flex-col w-full h-full text-left select-none p-5 relative bg-[#07080a] overflow-hidden text-white">
        
        {/* TOP-RIGHT FLOATING SLEEK TIMER */}
        <StageTimer state={state} formatTime={formatTime} isAffirmative={true} />

        {/* VISUAL CONTENT AREA */}
        <div className="flex-1 flex flex-col justify-between z-10">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col shrink-0">
            {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
            <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
              <span className="text-gray-400">TRUTH · RESPECT · </span>
              <span className="text-cyan-400">PERSPECTIVE</span>
            </div>

            {/* Large display titles */}
            <div className="flex flex-col mt-2 space-y-0.5">
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none uppercase">
                LIVE
              </h1>
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none uppercase">
                DECISION
              </h1>
              <h1 className="text-3xl md:text-4xl font-black text-cyan-400 tracking-tight leading-none uppercase">
                POLL
              </h1>
            </div>

            {/* Subtitle */}
            <span className="text-[9.5px] font-bold text-gray-500 tracking-[0.15em] uppercase mt-1.5 block">
              TOTALITY TALK
            </span>

            {/* Custom Horizontal Divider */}
            <div className="w-full border-b border-gray-800/40 mt-3" />
          </div>

          {/* MIDDLE SECTION: Live Poll results display */}
          <div className="flex flex-col items-center justify-center my-auto py-1 space-y-3">
            
            <div className="text-center">
              <span className="text-[8.5px] font-black tracking-[0.2em] text-[#f97316] uppercase block mb-0.5">
                CHAT INTERACTION COMMAND
              </span>
              <p className="text-[10px] text-gray-400">
                Type <span className="text-white font-mono font-black bg-[#101114] px-1 py-0.5 rounded border border-gray-800 text-[9px]">!me Vote Pro</span> or <span className="text-white font-mono font-black bg-[#101114] px-1 py-0.5 rounded border border-gray-800 text-[9px]">!me Vote Con</span>
              </p>
            </div>

            {/* High-Contrast Vote Result Grid Card */}
            <div className="w-full max-w-sm bg-[#101114]/60 border border-gray-900/50 p-3 rounded-xl shadow-2xl space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="flex flex-col">
                  <span className="text-[8.5px] text-emerald-400 font-black uppercase tracking-wider truncate">
                    {proTeamName}
                  </span>
                  <span className="text-2xl font-mono font-black text-emerald-400 mt-0.5">
                    {proPct}%
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold">
                    {proVotes} Votes
                  </span>
                </div>
                <div className="flex flex-col border-l border-gray-800/60">
                  <span className="text-[8.5px] text-orange-400 font-black uppercase tracking-wider truncate">
                    {conTeamName}
                  </span>
                  <span className="text-2xl font-mono font-black text-orange-400 mt-0.5">
                    {conPct}%
                  </span>
                  <span className="text-[9px] text-gray-500 font-bold">
                    {conVotes} Votes
                  </span>
                </div>
              </div>

              {/* Graphical Percentage Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#0a0b0d] overflow-hidden flex border border-gray-800/50">
                <div 
                  style={{ width: `${proPct}%` }} 
                  className="h-full bg-emerald-500 transition-all duration-300"
                />
                <div 
                  style={{ width: `${conPct}%` }} 
                  className="h-full bg-orange-500 transition-all duration-300"
                />
              </div>
            </div>

          </div>

        </div>



      </div>
    );
  }

  // STATEMENTS SUBPHASE
  const isAffirmative = activeSpeaker ? activeSpeaker.role === 'PROPOSER' : true;
  const mainColorClass = isAffirmative ? 'text-cyan-400' : 'text-orange-400';
  const pulseColorClass = isAffirmative ? 'border-cyan-500/30 bg-cyan-500/2' : 'border-orange-500/30 bg-orange-500/2';
  const ringDashedClass = isAffirmative ? 'border-cyan-500/10' : 'border-orange-500/10';
  const border30Class = isAffirmative ? 'border-cyan-500/30' : 'border-orange-500/30';
  const border60Class = isAffirmative ? 'border-cyan-500/60' : 'border-orange-500/60';
  const border10Class = isAffirmative ? 'border-cyan-500/10' : 'border-orange-500/10';

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-5 relative bg-[#07080a] overflow-hidden text-white">
      
      {/* TOP-RIGHT FLOATING SLEEK TIMER */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={isAffirmative} />

      {/* VISUAL CONTENT AREA */}
      <div className="flex-1 flex flex-col justify-between z-10">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col shrink-0">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
          <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className={mainColorClass}>PERSPECTIVE</span>
          </div>

          {/* Large display titles */}
          <div className="flex flex-col mt-2 space-y-0.5">
            <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight leading-none uppercase">
              CLOSING
            </h1>
            <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight leading-none uppercase">
              REMARKS
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
            <div className="absolute w-[115px] h-[115px] rounded-full border border-gray-900/40" />
            <div className={`absolute w-[95px] h-[95px] rounded-full border border-dashed ${ringDashedClass}`} />
            <div className="absolute w-[75px] h-[75px] rounded-full border border-gray-900/60" />

            {/* Double Border around central badge */}
            <div className={`absolute w-[60px] h-[60px] rounded-full border ${border30Class}`} />
            <div className={`absolute w-[52px] h-[52px] rounded-full border ${border60Class}`} />

            {/* Central Badge */}
            <div className={`absolute w-[44px] h-[44px] bg-[#0a0b0d] rounded-full flex items-center justify-center shadow-2xl border ${border10Class}`}>
              <span className={`text-xl font-black ${mainColorClass} select-none tracking-tighter`}>
                {speakerInitial}
              </span>
            </div>
          </div>

          {/* Speaker label & active name underneath */}
          <div className="text-center mt-2.5 space-y-0.5">
            <span className="text-[8.5px] font-black tracking-[0.25em] text-gray-500 uppercase block">
              {activeSpeaker ? 'ACTIVE SPEAKER' : 'STANDBY MODE'}
            </span>
            <h2 className={`text-base font-black tracking-wide uppercase leading-tight ${mainColorClass}`}>
              {activeSpeaker 
                ? (activeSpeaker.role === 'PROPOSER' ? 'AFFIRMATIVE CLOSING' : 'OPPOSITION CLOSING')
                : 'FINAL REMARKS'}
            </h2>
            {activeSpeaker && (
              <p className="text-[11px] font-bold text-gray-400">
                @{activeSpeaker.name.replace('@', '')}
              </p>
            )}
          </div>
        </div>

      </div>



    </div>
  );
}
