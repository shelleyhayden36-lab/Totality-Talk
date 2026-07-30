import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateState } from '../../App';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
}

const DEFAULT_DEBATE_RULES = [
  {
    id: 'rule-attack',
    name: 'No Personal Attacks',
    description: 'Ad hominem attacks, insults, or demeaning personal remarks directed at other participants.',
    enabled: true
  },
  {
    id: 'rule-well',
    name: 'No Poisoning the Well',
    description: "Preemptively dismissing or attacking an opponent's character or source before they can speak.",
    enabled: true
  },
  {
    id: 'rule-hate',
    name: 'No Hate Speech',
    description: 'Any speech attacking, demeaning, or inciting violence against protected groups or individuals.',
    enabled: true
  },
  {
    id: 'rule-interrupt',
    name: 'No Interrupting',
    description: "Speaking out of turn or interrupting another participant's designated speaking time.",
    enabled: true
  },
  {
    id: 'rule-topic',
    name: 'Stay On Topic',
    description: 'Failing to address the debate topic or drifting into unrelated issues.',
    enabled: true
  }
];

interface LobbySlide {
  id: string;
  type: 'prompt' | 'team' | 'rules';
  duration: number; // in milliseconds
  title: string;
  badgeText?: string;
  colorClass?: string;
  borderColorClass?: string;
  teamType?: 'PROPOSER' | 'CONTRARY';
  teamLabel?: string;
  members?: DebateState['participants'];
  rulesPair?: typeof DEFAULT_DEBATE_RULES;
}

export default function LobbyLayout({ state, formatTime }: LayoutProps) {
  // Get seated participants for each team
  const seatedPro = (state.participants || []).filter(p => p.role === 'PROPOSER' && p.isSeated);
  const seatedCon = (state.participants || []).filter(p => p.role === 'CONTRARY' && p.isSeated);

  const proTeamLabel = state.settings?.proTeamName || "Affirmative";
  const conTeamLabel = state.settings?.conTeamName || "Opposition";

  // Define the topic based on settings or default mockup topic
  const debateTopic = state.settings?.debateTopic || "Should social media platforms be legally held liable for user-generated content?";

  // Load ground rules from state, filter to enabled ones
  const rulesList = (state.rules || DEFAULT_DEBATE_RULES).filter(r => r.enabled !== false);

  // Construct structured slideshow sequence:
  // 1. Prompt (30s)
  // 2. Team Affirmative (10s)
  // 3. Rules 1 & 2 (10s)
  // 4. Prompt (30s)
  // 5. Team Opposition (10s)
  // 6. Rules 3 & 4 (10s)
  // 7. Prompt (30s) ... and repeat cycle!
  const slides: LobbySlide[] = [];

  // Helper to push prompt slide
  const pushPrompt = (idx: number) => {
    slides.push({
      id: `prompt-${idx}`,
      type: 'prompt',
      duration: 30000, // 30 seconds as requested
      title: 'DEBATE TOPIC & PROMPT',
      badgeText: 'OPEN DEBATE'
    });
  };

  // 1. Initial Prompt
  pushPrompt(1);

  // 2. Team Proposer
  slides.push({
    id: 'team-pro',
    type: 'team',
    duration: 10000,
    teamType: 'PROPOSER',
    title: `TEAM ${proTeamLabel.toUpperCase()}`,
    teamLabel: proTeamLabel,
    colorClass: 'text-blue-400',
    borderColorClass: 'border-blue-500/30',
    members: seatedPro
  });

  // 3. Rules 1 & 2
  if (rulesList.length > 0) {
    slides.push({
      id: 'rules-1-2',
      type: 'rules',
      duration: 10000,
      title: 'DEBATE GROUND RULES (01 - 02)',
      rulesPair: rulesList.slice(0, 2)
    });
  }

  // 4. Prompt again
  pushPrompt(2);

  // 5. Team Opposition
  slides.push({
    id: 'team-con',
    type: 'team',
    duration: 10000,
    teamType: 'CONTRARY',
    title: `TEAM ${conTeamLabel.toUpperCase()}`,
    teamLabel: conTeamLabel,
    colorClass: 'text-red-400',
    borderColorClass: 'border-red-500/30',
    members: seatedCon
  });

  // 6. Rules 3 & 4 (or remaining)
  if (rulesList.length > 2) {
    slides.push({
      id: 'rules-3-4',
      type: 'rules',
      duration: 10000,
      title: 'DEBATE GROUND RULES (03 - 04)',
      rulesPair: rulesList.slice(2, 4)
    });
  } else if (rulesList.length > 0) {
    slides.push({
      id: 'rules-all',
      type: 'rules',
      duration: 10000,
      title: 'DEBATE GROUND RULES',
      rulesPair: rulesList
    });
  }

  // 7. Prompt again
  pushPrompt(3);

  // 8. Rules 5+ if available
  if (rulesList.length > 4) {
    slides.push({
      id: 'rules-5-plus',
      type: 'rules',
      duration: 10000,
      title: 'DEBATE GROUND RULES (05+)',
      rulesPair: rulesList.slice(4)
    });
    pushPrompt(4);
  }

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Cycle interval timer based on the current active slide's duration
  useEffect(() => {
    if (slides.length <= 1) return;
    const currentSlide = slides[activeSlideIndex] || slides[0];
    const duration = currentSlide.duration || 10000;

    const timer = setTimeout(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, duration);

    return () => clearTimeout(timer);
  }, [activeSlideIndex, slides.length]);

  const currentSlide = slides[activeSlideIndex] || slides[0];

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-5 relative bg-[#07080a] text-white justify-between overflow-hidden">
      
      {/* 1. COMPACT HEADER SECTION */}
      <div className="flex flex-col shrink-0">
        <div className="flex items-center justify-between w-full">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
          <div className="text-[9px] font-black tracking-[0.2em] uppercase">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className="text-blue-500">PERSPECTIVE</span>
          </div>

          {/* Animated OPEN DEBATE Badge */}
          <motion.div 
            animate={{ scale: [1, 1.04, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-[9.5px] font-black tracking-widest uppercase shadow-[0_0_12px_rgba(16,185,129,0.25)]"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            >
              OPEN DEBATE
            </motion.span>
          </motion.div>
        </div>

        {/* Smaller Lobby Standby Header */}
        <div className="flex items-center justify-between mt-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-300 tracking-wider uppercase bg-[#14161f] border border-gray-800/80 px-2.5 py-1 rounded-lg">
              LOBBY <span className="text-blue-500">STANDBY</span>
            </span>
            <span className="text-[9.5px] font-bold text-gray-500 tracking-widest uppercase">
              TOTALITY TALK
            </span>
          </div>
        </div>

        {/* Custom Horizontal Divider */}
        <div className="w-full border-b border-gray-800/40 mt-2.5" />
      </div>

      {/* 2. DYNAMIC MAIN HERO SLIDESHOW ("WHERE THE PROMPT IS") */}
      <div className="flex-1 flex flex-col justify-center my-3 relative min-h-[220px]">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentSlide.id}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="bg-gradient-to-br from-[#12141c]/90 to-[#0d0e14]/90 border border-blue-500/20 p-5 rounded-2xl shadow-2xl relative overflow-hidden group backdrop-blur-md h-full flex flex-col justify-between"
          >
            {/* Ambient Background Glow based on slide type */}
            <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl pointer-events-none ${
              currentSlide.type === 'team'
                ? currentSlide.teamType === 'PROPOSER' ? 'bg-blue-500/15' : 'bg-red-500/15'
                : currentSlide.type === 'rules' ? 'bg-amber-500/15' : 'bg-blue-500/15'
            }`}></div>

            {/* Slide Top Bar */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full animate-pulse ${
                  currentSlide.type === 'team'
                    ? currentSlide.teamType === 'PROPOSER' ? 'bg-blue-500' : 'bg-red-500'
                    : currentSlide.type === 'rules' ? 'bg-amber-500' : 'bg-blue-500'
                }`}></span>
                <span className={`text-[11px] font-black tracking-widest uppercase ${
                  currentSlide.type === 'team'
                    ? currentSlide.teamType === 'PROPOSER' ? 'text-blue-400' : 'text-red-400'
                    : currentSlide.type === 'rules' ? 'text-amber-400' : 'text-blue-400'
                }`}>
                  {currentSlide.title}
                </span>
              </div>

              {/* Animated OPEN DEBATE / LIVE Tag */}
              <motion.div 
                animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-[9px] font-extrabold text-blue-300 uppercase tracking-wider"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                <span>OPEN DEBATE</span>
              </motion.div>
            </div>

            {/* SLIDE CONTENT AREA */}
            <div className="my-auto py-2">
              {/* TYPE 1: PROMPT SLIDE */}
              {currentSlide.type === 'prompt' && (
                <div>
                  <p className="text-[19px] sm:text-[21px] font-black text-white leading-snug tracking-tight my-1">
                    "{debateTopic}"
                  </p>
                </div>
              )}

              {/* TYPE 2: TEAM ROSTER SLIDE */}
              {currentSlide.type === 'team' && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Seated Participants Lineup
                    </span>
                    <span className="text-[10px] font-black text-gray-400 uppercase">
                      {currentSlide.members?.length || 0} Speakers
                    </span>
                  </div>

                  {currentSlide.members && currentSlide.members.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-1 max-h-[100px] overflow-y-auto">
                      {currentSlide.members.map((p, i) => (
                        <div 
                          key={p.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                            currentSlide.teamType === 'PROPOSER'
                              ? 'bg-blue-950/40 border-blue-500/30 text-blue-200'
                              : 'bg-red-950/40 border-red-500/30 text-red-200'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">
                            {i + 1}
                          </span>
                          <span>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-[#141620]/60 border border-gray-800/60 rounded-xl text-center my-1">
                      <p className="text-xs text-gray-400 font-bold italic">
                        No seated speakers confirmed yet for {currentSlide.teamLabel}.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TYPE 3: RULES SLIDE */}
              {currentSlide.type === 'rules' && (
                <div className="grid grid-cols-1 gap-2 my-1">
                  {currentSlide.rulesPair?.map((rule, idx) => (
                    <div 
                      key={rule.id || idx}
                      className="bg-[#12141d]/80 border border-amber-500/20 p-2.5 rounded-xl flex items-start gap-3"
                    >
                      <div className="shrink-0 w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-black flex items-center justify-center mt-0.5">
                        0{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-white uppercase tracking-wide">
                          {rule.name}
                        </h4>
                        <p className="text-[11px] text-gray-400 font-medium leading-tight mt-0.5 line-clamp-2">
                          {rule.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Slide Footer Info Bar */}
            <div className="pt-2.5 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-400 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="text-gray-500 uppercase tracking-wider">Status:</span>
                <span className="text-emerald-400 font-black uppercase">Waiting for Speakers</span>
              </span>
              <span className="text-gray-500 uppercase tracking-wider">
                {seatedPro.length + seatedCon.length} Total Seated
              </span>
            </div>

            {/* Slide Timer Countdown Bar */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 overflow-hidden">
              <motion.div 
                key={activeSlideIndex}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: currentSlide.duration / 1000, ease: "linear" }}
                className={`h-full ${
                  currentSlide.type === 'team'
                    ? currentSlide.teamType === 'PROPOSER' ? 'bg-blue-500' : 'bg-red-500'
                    : currentSlide.type === 'rules' ? 'bg-amber-500' : 'bg-blue-500'
                }`}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 3. SLIDESHOW NAVIGATION INDICATORS */}
      <div className="flex justify-center items-center gap-1.5 py-1 shrink-0">
        {slides.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setActiveSlideIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeSlideIndex 
                ? s.type === 'prompt' ? 'w-5 bg-blue-500' : s.type === 'team' ? 'w-5 bg-purple-500' : 'w-5 bg-amber-500'
                : 'w-1.5 bg-gray-800 hover:bg-gray-700'
            }`}
            title={`Go to ${s.title}`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

    </div>
  );
}
