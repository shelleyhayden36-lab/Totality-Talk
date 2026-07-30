import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { DebateState } from '../../App';

interface StageTimerProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  isAffirmative?: boolean;
}

// Custom synthesizer function for self-contained beep sounds
function playBeep(frequency = 800, duration = 0.15, type: OscillatorType = 'sine', volumeScale = 1) {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    
    // Smooth volume transition to avoid clicks (scaled by default volume ratio)
    gain.gain.setValueAtTime(0.12 * volumeScale, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (error) {
    console.error("Audio beep failed:", error);
  }
}

export default function StageTimer({ state, formatTime, isAffirmative = true }: StageTimerProps) {
  const lastPlayedRef = useRef<{ [key: number]: boolean }>({ 30: false, 10: false });
  const timer = state.timer;
  const timeLeft = timer?.timeLeft ?? 0;
  const isRunning = timer?.isRunning ?? false;

  // Reset audio trigger flags if timer is reset to a higher value or stopped
  useEffect(() => {
    if (!isRunning) {
      lastPlayedRef.current[30] = false;
      lastPlayedRef.current[10] = false;
    } else {
      if (timeLeft > 30) {
        lastPlayedRef.current[30] = false;
      }
      if (timeLeft > 10) {
        lastPlayedRef.current[10] = false;
      }
    }
  }, [timeLeft, isRunning]);

  // Audio cues at 30 and 10 seconds
  useEffect(() => {
    if (!isRunning) return;
    const volScale = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;

    if (timeLeft === 30 && !lastPlayedRef.current[30]) {
      lastPlayedRef.current[30] = true;
      // Rich chime/alert sound: high frequency followed by a second tone
      playBeep(880, 0.4, 'triangle', volScale); // A5 tone
    }

    if (timeLeft === 10 && !lastPlayedRef.current[10]) {
      lastPlayedRef.current[10] = true;
      // Urgent double beep warning
      playBeep(987.77, 0.2, 'sine', volScale); // B5 tone
      setTimeout(() => {
        playBeep(987.77, 0.25, 'sine', volScale);
      }, 250);
    }
  }, [timeLeft, isRunning, state?.settings?.bgMusicVolume]);

  if (!timer || timeLeft < 0) return null;

  // 1. Determine size state
  const isExpanded = timeLeft <= 60 && timeLeft > 0;

  // 2. Determine color state
  const isRedWarning = timeLeft <= 30 && timeLeft > 0;
  
  // Custom classes depending on active state
  let timerBorderClass = 'border-gray-700/80 shadow-[0_0_20px_rgba(0,0,0,0.6)]';
  let timerTextClass = 'text-white';
  let pulseDotClass = isRunning 
    ? (isAffirmative ? 'bg-cyan-400' : 'bg-rose-400') 
    : 'bg-gray-500';

  if (isRedWarning) {
    timerBorderClass = 'border-red-500/90 shadow-[0_0_25px_rgba(239,68,68,0.4)] animate-pulse';
    timerTextClass = 'text-red-400 font-extrabold';
    pulseDotClass = 'bg-red-500';
  } else if (isExpanded) {
    // Elegant amber or team warning color for expanded state (but not yet red)
    timerBorderClass = isAffirmative ? 'border-cyan-500/80' : 'border-rose-500/80';
  }

  return (
    <motion.div 
      className="absolute top-2.5 right-3 z-30"
      animate={{
        scale: isExpanded ? 1.25 : 1,
        x: isExpanded ? -10 : 0,
        y: isExpanded ? 5 : 0,
      }}
      transition={{ type: 'spring', stiffness: 120, damping: 15 }}
    >
      <div className={`flex items-center gap-2.5 bg-[#08090d]/95 border-2 ${timerBorderClass} px-4 py-2 rounded-2xl shadow-2xl backdrop-blur-md transition-colors duration-300`}>
        <span className={`w-2.5 h-2.5 rounded-full ${pulseDotClass} ${isRunning ? 'animate-pulse' : ''}`} />
        <span className={`text-base sm:text-lg font-mono font-black tracking-widest transition-colors duration-300 ${timerTextClass}`}>
          {formatTime(timeLeft)}
        </span>
      </div>
    </motion.div>
  );
}
