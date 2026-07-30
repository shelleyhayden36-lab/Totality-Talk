import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { DebateState } from '../../App';
import { Volume2 } from 'lucide-react';
import StageTimer from './StageTimer';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
}

export default function ChatQLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  // Get approved questions as fallback queue
  const approvedQuestions = (state.chatQuestions || []).filter(q => q.status === 'approved');

  // Identify the active question from all questions if actively projected, or fallback to the first approved
  const activeQuestion = state.activeChatQuestionId 
    ? (state.chatQuestions || []).find(q => q.id === state.activeChatQuestionId) || null
    : approvedQuestions[0] || null;

  // Local state to track if we are actively speaking
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Stop any ongoing speech when unmounting
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Listen to speakingQuestionId state from the host and trigger speech automatically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (state.speakingQuestionId && activeQuestion && state.speakingQuestionId === activeQuestion.id) {
      if (!window.speechSynthesis.speaking) {
        const cleanAuthor = activeQuestion.author.replace(/[@_]/g, ' ');
        const textToSpeak = `${cleanAuthor} wants to know: ${activeQuestion.text}`;

        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural')));
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onstart = () => {
          setIsSpeaking(true);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          if (onStateUpdate) {
            onStateUpdate({ speakingQuestionId: null });
          }
        };

        utterance.onerror = () => {
          setIsSpeaking(false);
          if (onStateUpdate) {
            onStateUpdate({ speakingQuestionId: null });
          }
        };

        window.speechSynthesis.speak(utterance);
      }
    } else if (!state.speakingQuestionId) {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
  }, [state.speakingQuestionId, activeQuestion?.id]);

  // Ripples for soundwave pulsing animation
  const rippleDelays = [0, 1, 2];

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-3 relative bg-[#07080a] overflow-hidden text-white">
      
      {/* TOP-RIGHT FLOATING SLEEK TIMER */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={true} />

      {/* VISUAL CONTENT AREA */}
      <div className="flex-1 flex flex-col justify-between z-10">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col shrink-0">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
          <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className="text-[#f97316]">PERSPECTIVE</span>
          </div>

          {/* Large display titles */}
          <div className="flex flex-col mt-2 space-y-0.5">
            <h1 className="text-[26px] md:text-3xl font-black text-white tracking-tight leading-none uppercase">
              AUDIENCE
            </h1>
            <h1 className="text-[26px] md:text-3xl font-black text-[#f97316] tracking-tight leading-none uppercase">
              INTERACTIVE
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
                className="absolute rounded-full border border-[#f97316]/30 bg-[#f97316]/2"
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
            <div className="absolute w-[95px] h-[95px] rounded-full border border-dashed border-[#f97316]/10" />
            <div className="absolute w-[75px] h-[75px] rounded-full border border-gray-900/60" />

            {/* Double Border around central badge */}
            <div className="absolute w-[60px] h-[60px] rounded-full border border-[#f97316]/30" />
            <div className="absolute w-[52px] h-[52px] rounded-full border border-[#f97316]/60" />

            {/* Central Badge (With interactive "?") */}
            <div className="absolute w-[44px] h-[44px] bg-[#0a0b0d] rounded-full flex items-center justify-center shadow-2xl border border-[#f97316]/10">
              <span className="text-xl font-black text-[#f97316] select-none">
                ?
              </span>
            </div>
          </div>

          {/* Speaker label & Dynamic Projected Question */}
          <div className="text-center mt-2 space-y-0.5 w-full max-w-lg">
            <span className="text-[8.5px] font-black tracking-[0.25em] text-gray-500 uppercase block">
              {activeQuestion ? `QUESTION FROM ${activeQuestion.author.toUpperCase()}` : 'AWAITING AUDIENCE VOICE'}
            </span>
            <h2 className="text-base font-black text-white tracking-wide uppercase leading-tight">
              {activeQuestion ? `@${activeQuestion.author.replace('@', '')}` : 'CHAT INTERACTION'}
            </h2>

            {/* Projected question display card */}
            <div className="mt-2 px-3 py-2 bg-[#101114]/60 border border-gray-900/50 rounded-xl relative">
              {activeQuestion ? (
                <p className="text-[11px] font-bold text-gray-200 leading-relaxed italic">
                  "{activeQuestion.text}"
                </p>
              ) : (
                <p className="text-[9.5px] text-gray-500 font-bold uppercase tracking-wider">
                  Waiting for host to project a question...
                </p>
              )}

              {isSpeaking && activeQuestion && (
                <div className="flex items-center justify-center gap-1.5 text-[#f97316] text-[9px] font-black animate-pulse mt-2 bg-[#f97316]/5 border border-[#f97316]/15 py-1 rounded-lg shrink-0">
                  <Volume2 className="w-3 h-3 animate-bounce shrink-0" />
                  <span className="uppercase tracking-wider">Reading Question Aloud...</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>



    </div>
  );
}
