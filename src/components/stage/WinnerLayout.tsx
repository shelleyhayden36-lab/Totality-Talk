import React from 'react';
import { motion } from 'motion/react';
import { DebateState } from '../../App';
import StageTimer from './StageTimer';

interface LayoutProps {
  state: DebateState;
  formatTime?: (seconds: number) => string;
}

export default function WinnerLayout({ state, formatTime }: LayoutProps) {
  const winner = state.declaredWinner || null;
  const proName = state.settings.proTeamName || 'Affirmative';
  const conName = state.settings.conTeamName || 'Opposition';

  const isAffirmative = winner === 'PROPOSER';
  const mainColorClass = winner === 'PROPOSER' ? 'text-emerald-400' : winner === 'CONTRARY' ? 'text-orange-400' : 'text-emerald-400';
  const pulseColorClass = winner === 'PROPOSER' ? 'border-emerald-500/30 bg-emerald-500/2' : winner === 'CONTRARY' ? 'border-orange-500/30 bg-orange-500/2' : 'border-emerald-500/30 bg-emerald-500/2';
  const ringDashedClass = winner === 'PROPOSER' ? 'border-emerald-500/10' : winner === 'CONTRARY' ? 'border-orange-500/10' : 'border-emerald-500/10';
  const border30Class = winner === 'PROPOSER' ? 'border-emerald-500/30' : winner === 'CONTRARY' ? 'border-orange-500/30' : 'border-emerald-500/30';
  const border60Class = winner === 'PROPOSER' ? 'border-emerald-500/60' : winner === 'CONTRARY' ? 'border-orange-500/60' : 'border-emerald-500/60';
  const border10Class = winner === 'PROPOSER' ? 'border-emerald-500/10' : winner === 'CONTRARY' ? 'border-orange-500/10' : 'border-emerald-500/10';

  // Ripples for soundwave pulsing animation
  const rippleDelays = [0, 1, 2];

  // Generate random confetti particles on mount
  const confettiParticles = React.useMemo(() => {
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#f43f5e', '#14b8a6'];
    return Array.from({ length: 70 }).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      x: Math.random() * 100, // percentage width
      delay: Math.random() * 2.5,
      duration: 2.8 + Math.random() * 3.5,
      size: 5 + Math.random() * 11,
      rotation: Math.random() * 360,
      drift: -50 + Math.random() * 100,
    }));
  }, []);

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-5 relative bg-[#07080a] overflow-hidden text-white">
      
      {/* Dynamic Confetti Celebration Rain */}
      {winner && confettiParticles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm pointer-events-none z-20"
          style={{
            backgroundColor: p.color,
            width: p.size,
            height: p.size,
            left: `${p.x}%`,
            top: `-20px`,
          }}
          initial={{ y: -50, opacity: 1, rotate: p.rotation }}
          animate={{
            y: '110vh',
            x: `calc(${p.x}% + ${p.drift}px)`,
            rotate: p.rotation + 720,
            opacity: [1, 1, 0.8, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      {/* TOP-RIGHT FLOATING SLEEK TIMER */}
      {formatTime && state.timer && (
        <StageTimer state={state} formatTime={formatTime} isAffirmative={isAffirmative} />
      )}

      {/* VISUAL CONTENT AREA */}
      <div className="flex-1 flex flex-col justify-between z-10">
        
        {/* HEADER SECTION (Matches image exactly) */}
        <div className="flex flex-col shrink-0">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
          <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className={mainColorClass}>PERSPECTIVE</span>
          </div>

          {/* Large display titles */}
          <div className="flex flex-col mt-2 space-y-0.5">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none uppercase">
              DEBATE
            </h1>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight leading-none uppercase">
              CHAMPIONSHIP
            </h1>
            <h1 className={`text-3xl md:text-4xl font-black ${mainColorClass} tracking-tight leading-none uppercase`}>
              DECISION
            </h1>
          </div>

          {/* Subtitle */}
          <span className="text-[9.5px] font-bold text-gray-500 tracking-[0.15em] uppercase mt-1.5 block">
            TOTALITY TALK
          </span>

          {/* Custom Horizontal Divider */}
          <div className="w-full border-b border-gray-800/40 mt-3" />
        </div>

        {/* MIDDLE SECTION: Concentric pulsing circles with Trophy */}
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

            {/* Central Badge containing Trophy */}
            <div className={`absolute w-[44px] h-[44px] bg-[#0a0b0d] rounded-full flex items-center justify-center shadow-2xl border ${border10Class}`}>
              <motion.span 
                animate={{ 
                  y: [0, -6, 0],
                  scale: [1, 1.15, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-xl font-black select-none leading-none cursor-pointer"
              >
                🏆
              </motion.span>
            </div>
          </div>

          {/* Winner details & scoreboard under the badge */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 15, delay: 0.15 }}
            className="text-center mt-3 space-y-2 w-full max-w-sm z-10"
          >
            <span className={`text-[8.5px] font-black tracking-[0.25em] ${mainColorClass} uppercase block bg-white/5 px-2.5 py-0.5 rounded-full border ${border30Class} max-w-max mx-auto`}>
              Debate Concluded
            </span>

            {!winner ? (
              <div className="space-y-0.5">
                <h2 className="text-base font-black text-white tracking-wide uppercase leading-tight">
                  AWAITING FINAL WINNER
                </h2>
                <p className="text-[10px] text-gray-500 font-medium">
                  Audience votes are being computed by the host desk...
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <h2 className="text-xl font-black tracking-tight uppercase leading-tight flex items-center justify-center gap-2">
                  <motion.span 
                    animate={{ scale: [1, 1.25, 1], rotate: [0, 15, 0] }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="text-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                  >
                    👑
                  </motion.span>
                  <span className={`${mainColorClass} filter drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]`}>
                    {winner === 'PROPOSER' ? `${proName} Wins!` :
                     winner === 'CONTRARY' ? `${conName} Wins!` :
                     'Debate Tied!'}
                  </span>
                  <motion.span 
                    animate={{ scale: [1, 1.25, 1], rotate: [0, -15, 0] }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.3 }}
                    className="text-white filter drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                  >
                    👑
                  </motion.span>
                </h2>

                {/* Scoreboard */}
                {state.scoringCalculations && (
                  <motion.div 
                    initial={{ y: 15, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="grid grid-cols-2 gap-3 w-full max-w-[240px] mx-auto mt-2"
                  >
                    {/* Pro Team Card */}
                    <div className={`relative flex flex-col items-center py-2 px-1 bg-[#101114]/85 rounded-xl border transition-all duration-500 ${
                      winner === 'PROPOSER' 
                        ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-105' 
                        : 'border-gray-900/60 opacity-50'
                    }`}>
                      {winner === 'PROPOSER' && (
                        <span className="absolute -top-2 bg-emerald-500 text-[7px] font-black uppercase text-white px-1.5 py-0.5 rounded-full tracking-wider border border-emerald-400">
                          Winner
                        </span>
                      )}
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider truncate max-w-[90px] mt-1">
                        {proName}
                      </span>
                      <span className={`text-xl font-mono font-black ${winner === 'PROPOSER' ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {state.scoringCalculations.pro.finalScore}
                      </span>
                    </div>

                    {/* Con Team Card */}
                    <div className={`relative flex flex-col items-center py-2 px-1 bg-[#101114]/85 rounded-xl border transition-all duration-500 ${
                      winner === 'CONTRARY' 
                        ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.35)] scale-105' 
                        : 'border-gray-900/60 opacity-50'
                    }`}>
                      {winner === 'CONTRARY' && (
                        <span className="absolute -top-2 bg-orange-500 text-[7px] font-black uppercase text-white px-1.5 py-0.5 rounded-full tracking-wider border border-orange-400">
                          Winner
                        </span>
                      )}
                      <span className="text-[8px] font-black text-gray-400 uppercase tracking-wider truncate max-w-[90px] mt-1">
                        {conName}
                      </span>
                      <span className={`text-xl font-mono font-black ${winner === 'CONTRARY' ? 'text-orange-400' : 'text-gray-500'}`}>
                        {state.scoringCalculations.con.finalScore}
                      </span>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </div>

      </div>



    </div>
  );
}
