import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateState, DEFAULT_DEBATE_RULES } from '../../App';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
}

interface LobbySlide {
  id: string;
  type: 'team' | 'rules';
  duration: number; // in milliseconds
  title: string;
  badgeText?: string;
  colorClass?: string;
  borderColorClass?: string;
  teamType?: 'PROPOSER' | 'CONTRARY';
  teamLabel?: string;
  members?: DebateState['participants'];
  rule?: typeof DEFAULT_DEBATE_RULES[0];
  ruleIndex?: number;
  totalRules?: number;
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

  // Construct structured slideshow sequence for team spots & rules (prompt is ALWAYS visible at top)
  const slides: LobbySlide[] = [];

  // 1. Team Affirmative (Proposer) Roster
  slides.push({
    id: 'team-pro',
    type: 'team',
    duration: 12000,
    teamType: 'PROPOSER',
    title: `TEAM ${proTeamLabel.toUpperCase()} ROSTER`,
    teamLabel: proTeamLabel,
    colorClass: 'text-cyan-400',
    borderColorClass: 'border-cyan-500/30',
    members: seatedPro
  });

  // 2. Team Opposition (Contrary) Roster
  slides.push({
    id: 'team-con',
    type: 'team',
    duration: 12000,
    teamType: 'CONTRARY',
    title: `TEAM ${conTeamLabel.toUpperCase()} ROSTER`,
    teamLabel: conTeamLabel,
    colorClass: 'text-orange-400',
    borderColorClass: 'border-orange-500/30',
    members: seatedCon
  });

  // 3. Individual Ground Rules (One single rule per slide for clean readability)
  rulesList.forEach((rule, idx) => {
    slides.push({
      id: `rule-${rule.id || idx}`,
      type: 'rules',
      duration: 8000,
      title: `DEBATE GROUND RULE (0${idx + 1} / 0${rulesList.length})`,
      rule,
      ruleIndex: idx + 1,
      totalRules: rulesList.length
    });
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Cycle interval timer based on current active slide's duration
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

  const proSeatsMax = state.settings?.proSeatsCount ?? 3;
  const conSeatsMax = state.settings?.conSeatsCount ?? 3;

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-4 sm:p-5 relative bg-[#07080a] text-white justify-between overflow-hidden gap-3">
      
      {/* 1. TOP HEADER SECTION */}
      <div className="flex flex-col shrink-0">
        <div className="flex items-center justify-between w-full">
          {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
          <div className="text-[9px] font-black tracking-[0.2em] uppercase">
            <span className="text-gray-400">TRUTH · RESPECT · </span>
            <span className="text-cyan-400">PERSPECTIVE</span>
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
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-gray-300 tracking-wider uppercase bg-[#14161f] border border-gray-800/80 px-2.5 py-1 rounded-lg">
              LOBBY <span className="text-cyan-400">STANDBY</span>
            </span>
            <span className="text-[9.5px] font-bold text-gray-500 tracking-widest uppercase">
              TOTALITY TALK
            </span>
          </div>
        </div>

        {/* Custom Horizontal Divider */}
        <div className="w-full border-b border-gray-800/40 mt-2" />
      </div>

      {/* 2. ALWAYS VISIBLE DEBATE PROMPT HEADER (TOP OF MAIN BODY) */}
      <div className="bg-gradient-to-r from-[#12141c] via-[#161926] to-[#12141c] border border-cyan-500/30 p-3 sm:p-3.5 rounded-xl shadow-xl text-center shrink-0 relative overflow-hidden">
        <div className="flex items-center justify-center gap-2 mb-0.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="text-[10px] font-black tracking-widest text-cyan-400 uppercase">
            DEBATE TOPIC & PROMPT
          </span>
        </div>
        <p className="text-sm sm:text-base md:text-lg font-black text-white leading-tight tracking-tight max-w-4xl mx-auto">
          "{debateTopic}"
        </p>
      </div>

      {/* 3. MAIN CONTENT BODY: SIDE-BY-SIDE SPLIT FORMAT FOR IMAGE & SLIDESHOW */}
      <div className="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        {state.settings?.lobbyImageUrl ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 h-full min-h-0 items-stretch">
            {/* LEFT COLUMN: HOLOGRAPHIC STAGE IMAGE PROJECTION */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative flex flex-col justify-center items-center rounded-xl overflow-hidden border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.25)] bg-black/80 p-2.5 h-full min-h-[180px]"
            >
              {/* Image Container with contain fit */}
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-lg">
                <img 
                  src={state.settings.lobbyImageUrl} 
                  alt="Lobby Stage Visual" 
                  className="w-full h-full object-cover rounded-lg block"
                />

                {/* HOLOGRAM SCANLINE LASER SWEEP OVERLAY */}
                <motion.div 
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    background: 'linear-gradient(to bottom, transparent 0%, rgba(6, 182, 212, 0.45) 50%, transparent 100%)',
                    height: '25%',
                  }}
                  animate={{ top: ['-30%', '100%'] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
                />

                {/* SUBTLE HORIZONTAL HUD SCREEN TEXTURE GRID LINES */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-30 z-10 rounded-lg"
                  style={{
                    backgroundImage: 'linear-gradient(to bottom, rgba(6, 182, 212, 0.3) 1px, transparent 1px)',
                    backgroundSize: '100% 4px'
                  }}
                />

                {/* LIGHT CHROMATIC REFLECTION SWEEP */}
                <motion.div
                  className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-tr from-transparent via-cyan-300/15 to-transparent rounded-lg"
                  animate={{ opacity: [0.15, 0.4, 0.15] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>

              {/* CORNER HUD TECH ACCENTS */}
              <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400/80 z-20 pointer-events-none" />
              <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400/80 z-20 pointer-events-none" />
              <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400/80 z-20 pointer-events-none" />
              <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400/80 z-20 pointer-events-none" />
            </motion.div>

            {/* RIGHT COLUMN: SCROLLING TEAM SPOTS & ROLES CYCLING SECTION */}
            <div className="h-full min-h-0 flex flex-col justify-center relative">
              <AnimatePresence mode="wait">
                <motion.div 
                  key={currentSlide?.id || 'default-slide'}
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.99 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="bg-gradient-to-br from-[#12141c]/90 to-[#0d0e14]/90 border border-cyan-500/20 p-4 rounded-xl shadow-2xl relative overflow-hidden backdrop-blur-md h-full flex flex-col justify-between"
                >
                  {/* Ambient Glow */}
                  <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl pointer-events-none ${
                    currentSlide?.type === 'team'
                      ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-500/15' : 'bg-orange-500/15'
                      : 'bg-amber-500/15'
                  }`}></div>

                  {/* Slide Bar Header */}
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full animate-pulse ${
                        currentSlide?.type === 'team'
                          ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-500'
                          : 'bg-amber-500'
                      }`}></span>
                      <span className={`text-[11px] font-black tracking-widest uppercase ${
                        currentSlide?.type === 'team'
                          ? currentSlide.teamType === 'PROPOSER' ? 'text-cyan-400' : 'text-orange-400'
                          : 'text-amber-400'
                      }`}>
                        {currentSlide?.title}
                      </span>
                    </div>

                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {currentSlide?.type === 'team' ? 'Team Roster Lineup' : 'Rulebook'}
                    </span>
                  </div>

                  {/* SLIDE INNER CONTENT */}
                  <div className="my-auto py-1 flex-1 flex flex-col justify-center min-h-0">
                    {/* TYPE: TEAM ROSTER SPOTS */}
                    {currentSlide?.type === 'team' && (
                      <div className="flex flex-col gap-2.5 h-full justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-400'}`}></span>
                            <span>{currentSlide.teamLabel} Speaker Lineup</span>
                          </span>
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                            currentSlide.teamType === 'PROPOSER' 
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                              : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                          }`}>
                            {currentSlide.members?.length || 0} / {currentSlide.teamType === 'PROPOSER' ? proSeatsMax : conSeatsMax} Seated
                          </span>
                        </div>

                        {/* Spots Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-auto">
                          {Array.from({ length: currentSlide.teamType === 'PROPOSER' ? proSeatsMax : conSeatsMax }).map((_, idx) => {
                            const member = currentSlide.members?.[idx];
                            return (
                              <div 
                                key={idx}
                                className={`p-3 rounded-xl border flex flex-col justify-between min-h-[60px] ${
                                  member 
                                    ? currentSlide.teamType === 'PROPOSER'
                                      ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                                      : 'bg-orange-950/40 border-orange-500/40 text-orange-200'
                                    : 'bg-[#10121a]/50 border-dashed border-gray-800 text-gray-500'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                                    Speaker {idx + 1}
                                  </span>
                                  <span className={`w-2 h-2 rounded-full ${member ? 'bg-emerald-400' : 'bg-gray-700'}`}></span>
                                </div>
                                {member ? (
                                  <span className="text-xs font-black text-white truncate mt-1">
                                    {member.name}
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold italic text-gray-600 mt-1">
                                    Open Spot
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* TYPE: SINGLE RULE SLIDE */}
                    {currentSlide?.type === 'rules' && currentSlide.rule && (
                      <div className="flex flex-col items-center justify-center text-center p-3 sm:p-4 my-auto h-full">
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black mb-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                          0{currentSlide.ruleIndex}
                        </div>
                        <h4 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider mb-1">
                          {currentSlide.rule.name}
                        </h4>
                        <p className="text-xs sm:text-sm text-gray-200 font-medium leading-relaxed max-w-xl mx-auto">
                          {currentSlide.rule.description}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Slide Footer Info Bar */}
                  <div className="pt-2 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-400 font-bold shrink-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-gray-500 uppercase tracking-wider">Status:</span>
                      <span className="text-emerald-400 font-black uppercase">Waiting for Speakers</span>
                    </span>
                    <span className="text-gray-500 uppercase tracking-wider">
                      {seatedPro.length + seatedCon.length} / {proSeatsMax + conSeatsMax} Total Seated
                    </span>
                  </div>

                  {/* Slide Timer Countdown Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 overflow-hidden">
                    <motion.div 
                      key={activeSlideIndex}
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: (currentSlide?.duration || 10000) / 1000, ease: "linear" }}
                      className={`h-full ${
                        currentSlide?.type === 'team'
                          ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-500'
                          : 'bg-amber-500'
                      }`}
                    />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* FULL WIDTH SLIDESHOW CARD WHEN NO IMAGE */
          <div className="h-full min-h-0 flex flex-col justify-center relative">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentSlide?.id || 'default-slide'}
                initial={{ opacity: 0, y: 8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.99 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="bg-gradient-to-br from-[#12141c]/90 to-[#0d0e14]/90 border border-cyan-500/20 p-4 rounded-xl shadow-2xl relative overflow-hidden backdrop-blur-md h-full flex flex-col justify-between"
              >
                {/* Ambient Glow */}
                <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl pointer-events-none ${
                  currentSlide?.type === 'team'
                    ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-500/15' : 'bg-orange-500/15'
                    : 'bg-amber-500/15'
                }`}></div>

                {/* Slide Bar Header */}
                <div className="flex items-center justify-between mb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full animate-pulse ${
                      currentSlide?.type === 'team'
                        ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-500'
                        : 'bg-amber-500'
                    }`}></span>
                    <span className={`text-[11px] font-black tracking-widest uppercase ${
                      currentSlide?.type === 'team'
                        ? currentSlide.teamType === 'PROPOSER' ? 'text-cyan-400' : 'text-orange-400'
                        : 'text-amber-400'
                    }`}>
                      {currentSlide?.title}
                    </span>
                  </div>

                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {currentSlide?.type === 'team' ? 'Team Roster Lineup' : 'Rulebook'}
                  </span>
                </div>

                {/* SLIDE INNER CONTENT */}
                <div className="my-auto py-1 flex-1 flex flex-col justify-center min-h-0">
                  {/* TYPE: TEAM ROSTER SPOTS */}
                  {currentSlide?.type === 'team' && (
                    <div className="flex flex-col gap-2.5 h-full justify-center">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-400'}`}></span>
                          <span>{currentSlide.teamLabel} Speaker Lineup</span>
                        </span>
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                          currentSlide.teamType === 'PROPOSER' 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {currentSlide.members?.length || 0} / {currentSlide.teamType === 'PROPOSER' ? proSeatsMax : conSeatsMax} Seated
                        </span>
                      </div>

                      {/* Spots Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 my-auto">
                        {Array.from({ length: currentSlide.teamType === 'PROPOSER' ? proSeatsMax : conSeatsMax }).map((_, idx) => {
                          const member = currentSlide.members?.[idx];
                          return (
                            <div 
                              key={idx}
                              className={`p-3 rounded-xl border flex flex-col justify-between min-h-[60px] ${
                                member 
                                  ? currentSlide.teamType === 'PROPOSER'
                                    ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200'
                                    : 'bg-orange-950/40 border-orange-500/40 text-orange-200'
                                  : 'bg-[#10121a]/50 border-dashed border-gray-800 text-gray-500'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400">
                                  Speaker {idx + 1}
                                </span>
                                <span className={`w-2 h-2 rounded-full ${member ? 'bg-emerald-400' : 'bg-gray-700'}`}></span>
                              </div>
                              {member ? (
                                <span className="text-xs font-black text-white truncate mt-1">
                                  {member.name}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold italic text-gray-600 mt-1">
                                  Open Spot
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* TYPE: SINGLE RULE SLIDE */}
                  {currentSlide?.type === 'rules' && currentSlide.rule && (
                    <div className="flex flex-col items-center justify-center text-center p-3 sm:p-4 my-auto h-full">
                      <div className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-black mb-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                        0{currentSlide.ruleIndex}
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider mb-1">
                        {currentSlide.rule.name}
                      </h4>
                      <p className="text-xs sm:text-sm text-gray-200 font-medium leading-relaxed max-w-xl mx-auto">
                        {currentSlide.rule.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Slide Footer Info Bar */}
                <div className="pt-2 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-400 font-bold shrink-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-gray-500 uppercase tracking-wider">Status:</span>
                    <span className="text-emerald-400 font-black uppercase">Waiting for Speakers</span>
                  </span>
                  <span className="text-gray-500 uppercase tracking-wider">
                    {seatedPro.length + seatedCon.length} / {proSeatsMax + conSeatsMax} Total Seated
                  </span>
                </div>

                {/* Slide Timer Countdown Progress Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900 overflow-hidden">
                  <motion.div 
                    key={activeSlideIndex}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: (currentSlide?.duration || 10000) / 1000, ease: "linear" }}
                    className={`h-full ${
                      currentSlide?.type === 'team'
                        ? currentSlide.teamType === 'PROPOSER' ? 'bg-cyan-400' : 'bg-orange-500'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 5. SLIDESHOW NAVIGATION INDICATORS */}
      <div className="flex justify-center items-center gap-1.5 py-0.5 shrink-0">
        {slides.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setActiveSlideIndex(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              idx === activeSlideIndex 
                ? s.type === 'team' 
                  ? s.teamType === 'PROPOSER' ? 'w-5 bg-cyan-400' : 'w-5 bg-orange-500'
                  : 'w-5 bg-amber-500'
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
