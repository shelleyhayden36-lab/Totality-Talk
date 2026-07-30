import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  FileText, 
  MessageSquare, 
  Gavel, 
  Brain, 
  RotateCw, 
  Zap, 
  Target, 
  Check,
  ImageIcon
} from 'lucide-react';
import { DebateState, FormalClaim } from '../../App';
import StageTimer from './StageTimer';
import { HolographicProjectionCard } from './HolographicProjectionCard';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
}

export default function RebuttalLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  // Determine Phase & Rebutting Team
  const currentPhase = (state.currentPhase || 'REBUTTAL_OPPOSITION').toUpperCase();
  const isOppRebuttal = currentPhase === 'REBUTTAL_OPPOSITION';
  const isAffRebuttal = currentPhase === 'REBUTTAL_AFFIRMATIVE';

  // Target claim ID from global state
  const targetClaimId = state.rebuttalTargetClaimId || null;

  // Gather target claims pool
  const rawFormalClaims: FormalClaim[] = Array.isArray(state.formalClaims) ? state.formalClaims : [];
  
  const legacyClaims: FormalClaim[] = (Array.isArray(state.claims) ? state.claims : [])
    .filter(c => c.text && c.text.trim().length > 0)
    .map(c => ({
      claimId: c.id,
      speaker: c.speakerName || 'Speaker',
      team: c.speakerId?.includes('con') || c.speakerName?.toLowerCase().includes('opp') ? 'CONTRARY' : 'PROPOSER',
      phase: c.phase || 'OPENING',
      claimText: c.text,
      status: 'approved'
    }));

  const aiExtractedClaims: FormalClaim[] = (Array.isArray(state.transcriptionSession?.extractedClaims) ? state.transcriptionSession.extractedClaims : [])
    .filter(c => c.text && c.text.trim().length > 0)
    .map(c => ({
      claimId: c.id,
      speaker: c.possibleSpeaker || 'Speaker',
      team: 'PROPOSER',
      phase: 'OPENING',
      claimText: c.text,
      status: 'approved'
    }));

  const allClaimsPool = rawFormalClaims.length > 0 
    ? rawFormalClaims 
    : legacyClaims.length > 0 
      ? legacyClaims 
      : aiExtractedClaims;

  const opposingApprovedClaims = allClaimsPool.filter(c => {
    const cTeam = (c.team || '').toUpperCase();
    const isProposer = cTeam === 'PROPOSER' || cTeam === 'AFFIRMATIVE' || cTeam.includes('PRO') || cTeam.includes('AFF');
    const isContrary = cTeam === 'CONTRARY' || cTeam === 'OPPOSITION' || cTeam.includes('CON') || cTeam.includes('OPP');

    if (isOppRebuttal) return isProposer || !isContrary;
    if (isAffRebuttal) return isContrary || !isProposer;
    return true;
  });

  const availableTargetClaims = opposingApprovedClaims.length > 0 ? opposingApprovedClaims : allClaimsPool;

  // Helper to retrieve generated image URL for a claim
  const getClaimImageUrl = (claim: FormalClaim | undefined): string | null => {
    if (!claim) return null;
    
    const directUrl = (claim as any).visualImageUrl || (claim as any).imageUrl;
    if (directUrl) return directUrl;

    const fc = (state.formalClaims || []).find(f => f.claimId === claim.claimId || (f as any).id === claim.claimId);
    if (fc && ((fc as any).visualImageUrl || (fc as any).imageUrl)) {
      return (fc as any).visualImageUrl || (fc as any).imageUrl;
    }

    const lc = (state.claims || []).find(c => c.id === claim.claimId || c.id === (claim as any).id);
    if (lc && ((lc as any).visualImageUrl || (lc as any).imageUrl)) {
      return (lc as any).visualImageUrl || (lc as any).imageUrl;
    }

    const ec = (state.transcriptionSession?.extractedClaims || []).find((c: any) => c.id === claim.claimId || c.claimId === claim.claimId);
    if (ec && (ec.visualImageUrl || ec.imageUrl)) {
      return ec.visualImageUrl || ec.imageUrl;
    }

    return null;
  };

  // State to track manual selection vs auto cycling
  const [isManualSelection, setIsManualSelection] = useState<boolean>(false);
  const [activeClaimIndex, setActiveClaimIndex] = useState<number>(0);

  // Sync active target claim
  const activeTargetClaim: FormalClaim | undefined = isManualSelection
    ? (availableTargetClaims.find(c => c.claimId === targetClaimId) || availableTargetClaims[activeClaimIndex] || availableTargetClaims[0])
    : (availableTargetClaims[activeClaimIndex] || availableTargetClaims[0]);

  // Auto-set targetClaimId if not set
  useEffect(() => {
    if (!targetClaimId && activeTargetClaim && onStateUpdate) {
      onStateUpdate({ rebuttalTargetClaimId: activeTargetClaim.claimId });
    }
  }, [targetClaimId, activeTargetClaim, onStateUpdate]);

  // Connected Evidences & Counterclaims for active target claim
  const connectedEvidences = (state.evidenceList || []).filter(e => e.claimId === activeTargetClaim?.claimId);
  const connectedCounterClaims = (state.counterClaims || []).filter(cc => cc.claimId === activeTargetClaim?.claimId);

  // Active Image URL for the active claim
  const activeClaimImageUrl = getClaimImageUrl(activeTargetClaim);

  // Stage display modes: 'image' (image/blueprint) | 'claim' (text) | 'counterclaim' | 'evidence'
  const [viewMode, setViewMode] = useState<'image' | 'claim' | 'counterclaim' | 'evidence'>('image');
  const [autoRotate, setAutoRotate] = useState(true);

  // -------------------------------------------------------------
  // CYCLING & ROTATION LOGIC:
  // 1. If NO claim manually selected:
  //    - Autocycle through available claims every 12 seconds (10-15s per image/claim)
  //    - Shows image + claim text, NO transcription panel underneath until selected
  // 2. If a claim IS manually selected:
  //    - Shows selected claim, actual words of the claim, image, and transcription underneath!
  // -------------------------------------------------------------
  useEffect(() => {
    if (!autoRotate || availableTargetClaims.length === 0) return;

    const interval = setInterval(() => {
      if (isManualSelection) {
        // Single claim selected mode: cycle between Image + transcription and Claim text focus view
        setViewMode(prev => (prev === 'image' ? 'claim' : 'image'));
      } else {
        // Auto-cycle through all available target claims (12 seconds per image)
        setActiveClaimIndex(prevIdx => {
          const nextIdx = (prevIdx + 1) % availableTargetClaims.length;
          const nextClaim = availableTargetClaims[nextIdx];
          if (nextClaim && onStateUpdate) {
            onStateUpdate({ rebuttalTargetClaimId: nextClaim.claimId });
          }
          return nextIdx;
        });
        setViewMode('image');
      }
    }, 12000); // 12 seconds per claim image (10 to 15s requirement)

    return () => clearInterval(interval);
  }, [autoRotate, isManualSelection, availableTargetClaims, onStateUpdate]);

  // Color scheme based on target claim team
  const isTargetClaimAffirmative = activeTargetClaim?.team === 'PROPOSER' || isOppRebuttal;
  const isCounterMode = viewMode === 'counterclaim';

  let isCyanTheme = isTargetClaimAffirmative;
  if (isCounterMode) {
    isCyanTheme = isAffRebuttal;
  }

  const primaryTextClass = isCyanTheme ? 'text-cyan-400' : 'text-rose-400';
  const primaryBorderClass = isCyanTheme ? 'border-cyan-500/50' : 'border-rose-500/50';
  const primaryGlowClass = isCyanTheme 
    ? 'shadow-[0_0_35px_rgba(0,242,255,0.3)]' 
    : 'shadow-[0_0_35px_rgba(255,42,95,0.3)]';
  const primaryBeamGradient = isCyanTheme 
    ? 'from-cyan-400/30 via-cyan-400/10 to-transparent' 
    : 'from-rose-400/30 via-rose-400/10 to-transparent';

  const activeEvidence = connectedEvidences[0];
  const activeCounterClaim = connectedCounterClaims[connectedCounterClaims.length - 1];

  // Cyber transition animation variants
  const cyberVariants = {
    initial: { 
      opacity: 0, 
      scale: 0.92, 
      filter: 'blur(8px) brightness(1.8) contrast(1.2)', 
      rotateX: 10 
    },
    animate: { 
      opacity: 1, 
      scale: 1, 
      filter: 'blur(0px) brightness(1) contrast(1)', 
      rotateX: 0,
      transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
    },
    exit: { 
      opacity: 0, 
      scale: 1.06, 
      filter: 'blur(10px) brightness(2) contrast(1.5)', 
      rotateX: -10,
      transition: { duration: 0.3, ease: [0.7, 0, 0.84, 0] }
    }
  };

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-2.5 sm:p-3.5 relative bg-[#050608] overflow-hidden text-white font-sans scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
      
      {/* TOP-RIGHT FLOATING SLEEK TIMER */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={isAffRebuttal} />

      {/* HEADER BAR & BRANDING */}
      <div className="flex flex-col shrink-0 z-10 mb-2">
        <div className="flex items-center justify-between">
          {/* TOTALITY TALK BRANDING BADGE */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center p-0.5 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,242,255,0.4)]">
              <div className="w-full h-full rounded-full bg-[#07090e] flex items-center justify-center">
                <span className="text-[11px] font-black text-cyan-400 font-mono">T</span>
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-black tracking-widest text-white uppercase font-mono">
                TOTALITY
              </span>
              <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-mono">
                TALK
              </span>
            </div>
          </div>

          {/* Mode Indicator Tag */}
          <div className="flex items-center gap-2 pr-28 sm:pr-32">
            <span className={`text-[10px] font-extrabold font-mono px-2.5 py-0.5 rounded-full border tracking-wider flex items-center gap-1.5 uppercase ${
              isOppRebuttal
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
            }`}>
              <Zap className="w-3 h-3 animate-pulse" />
              <span>REBUTTAL {isOppRebuttal ? 'OPPOSITION' : 'AFFIRMATIVE'}</span>
            </span>
          </div>
        </div>

        <div className="w-full border-b border-gray-800/80 mt-2" />
      </div>

      {/* MAIN CYBER STAGE CHAMBER */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 relative overflow-hidden min-h-0 py-1">
        
        {/* Subtle Background Atmospheric Light Beam */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 sm:w-96 h-[340px] pointer-events-none z-0 opacity-40">
          <div 
            className={`w-full h-full bg-gradient-to-b ${primaryBeamGradient} blur-xl`}
            style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)' }}
          />
        </div>

        {/* CENTER FLOATING STAGE DISPLAY CONTAINER */}
        <div className="w-full max-w-2xl flex-1 flex flex-col items-center justify-center my-auto z-10 min-h-0 py-1 overflow-hidden scrollbar-none">
          <AnimatePresence mode="wait">
            
            {/* ------------------------------------------------------------- */}
            {/* MODE A: IMAGE / HOLOGRAPHIC PROJECTION VIEW WITH COUNTERCLAIM UNDERNEATH */}
            {/* ------------------------------------------------------------- */}
            {(viewMode === 'image' || viewMode === 'counterclaim') && activeTargetClaim && (
              <motion.div
                key={`image-${activeTargetClaim.claimId}`}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center gap-2 my-auto"
              >
                {/* Visual Status Indicator Badge */}
                {isManualSelection ? (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] text-[10px] font-black uppercase text-amber-300 tracking-wider">
                    <Target className="w-3.5 h-3.5 text-amber-300" />
                    <span>SELECTED REBUTTAL TARGET CLAIM</span>
                  </div>
                ) : activeClaimImageUrl ? (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/60 shadow-[0_0_15px_rgba(0,242,255,0.4)] text-[10px] font-black uppercase text-cyan-300 tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>AI GENERATED CLAIM IMAGE PROJECTION</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-900/80 border border-cyan-500/30 text-[10px] font-black uppercase text-cyan-400 tracking-wider">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>HOLOGRAPHIC BLUEPRINT SCHEMATIC</span>
                  </div>
                )}

                {/* FLOATING 3D SCHEMATIC / GENERATED IMAGE CARD */}
                <div className="w-full max-w-sm sm:max-w-md h-[160px] sm:h-[190px] shrink-0 my-0.5">
                  <HolographicProjectionCard
                    imageUrl={activeClaimImageUrl}
                    claimText={activeTargetClaim.claimText}
                    speakerName={activeTargetClaim.speaker}
                    team={activeTargetClaim.team}
                    type="claim"
                    showExpandButton={true}
                    className="w-full h-full shadow-2xl"
                  />
                </div>

                {/* Actual Words of the Claim */}
                <div className={`flex flex-col items-center justify-center px-4 py-2 rounded-xl text-center max-w-lg w-full ${
                  isManualSelection ? 'bg-[#07090e]/95 border border-amber-500/50 shadow-lg' : 'bg-[#07090e]/90 border border-gray-800'
                }`}>
                  <span className={`text-[10px] uppercase font-mono tracking-wider font-extrabold mb-0.5 ${
                    isManualSelection ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {isManualSelection ? '🎯 SELECTED REBUTTAL TARGET WORDS:' : 'TARGET CLAIM WORDS:'}
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                    <strong className={primaryTextClass}>[{activeTargetClaim.speaker}]: </strong>
                    "{activeTargetClaim.claimText}"
                  </p>
                </div>

                {/* TRANSCRIBING ROLE & COUNTERCLAIM PANEL - ONLY SHOWN ONCE A CLAIM IS SELECTED */}
                {isManualSelection && (
                  <div className={`w-full max-w-lg ${
                    isAffRebuttal 
                      ? 'bg-[#040f1a]/95 border border-cyan-500/50 shadow-[0_0_20px_rgba(0,242,255,0.25)]'
                      : 'bg-[#1a040a]/95 border border-rose-500/50 shadow-[0_0_20px_rgba(255,42,95,0.25)]'
                  } rounded-xl p-2.5 text-left relative overflow-hidden backdrop-blur-md`}>
                    <div className="flex items-center justify-between border-b border-gray-800/80 pb-1 mb-1">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className={`w-3.5 h-3.5 ${isAffRebuttal ? 'text-cyan-400' : 'text-rose-400'} animate-pulse`} />
                        <span className={`text-[10px] font-black tracking-widest uppercase font-mono ${isAffRebuttal ? 'text-cyan-400' : 'text-rose-400'}`}>
                          TRANSCRIBING REBUTTAL ROLE & COUNTERCLAIM
                        </span>
                      </div>

                      <span className={`text-[9px] font-extrabold font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                        isAffRebuttal 
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' 
                          : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                      }`}>
                        ⚔️ REBUTTAL
                      </span>
                    </div>

                    {connectedCounterClaims.length > 0 ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-gray-400 uppercase">
                            VOICED BY: <strong className="text-white">{activeCounterClaim?.rebutterId || 'Rebuttal Speaker'}</strong>
                          </span>
                          <span className="text-[9px] font-mono text-gray-400">
                            {connectedCounterClaims.length} Rebuttal Point{connectedCounterClaims.length > 1 ? 's' : ''}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-white leading-relaxed bg-[#020b14]/80 p-2 rounded-lg border border-cyan-500/30 italic truncate">
                          "{activeCounterClaim?.counterText}"
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 py-1 px-2.5 bg-slate-900/60 rounded-lg border border-gray-800 text-xs text-gray-400">
                        {(state?.transcriptionSession?.interimTranscript || (state?.transcriptionSession?.transcripts && state.transcriptionSession.transcripts.length > 0)) ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-mono font-black uppercase text-cyan-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} />
                              LIVE TRANSCRIPTION:
                            </span>
                            <p className="text-xs font-bold text-white italic leading-snug">
                              "{state?.transcriptionSession?.interimTranscript || state?.transcriptionSession?.transcripts[state.transcriptionSession.transcripts.length - 1]?.text}"
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                            <span className="text-[11px]">Transcribing live rebuttal audio... Extracting counterclaims targeting this claim.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* MODE B: CLAIM TEXT CARD VIEW */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'claim' && activeTargetClaim && (
              <motion.div
                key={`claim-${activeTargetClaim.claimId}`}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center gap-2 my-auto"
              >
                {/* CLAIM BOX */}
                <div className={`w-full max-w-lg bg-[#07090e]/95 border-2 ${primaryBorderClass} ${primaryGlowClass} rounded-2xl p-4 text-center relative overflow-hidden backdrop-blur-md flex flex-col items-center`}>
                  {/* High-Tech Corner HUD Brackets */}
                  <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-white/60 pointer-events-none" />
                  <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-white/60 pointer-events-none" />
                  <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-white/60 pointer-events-none" />
                  <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-white/60 pointer-events-none" />

                  {/* Header Title Label */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] sm:text-xs font-black tracking-[0.2em] uppercase ${primaryTextClass}`}>
                      {activeTargetClaim.team === 'PROPOSER' ? 'AFFIRMATIVE CLAIM' : 'OPPOSITION CLAIM'}
                    </span>
                    {activeClaimImageUrl && (
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 uppercase flex items-center gap-1">
                        <ImageIcon className="w-2.5 h-2.5" />
                        <span>IMAGE GENERATED</span>
                      </span>
                    )}
                  </div>

                  {/* Main Display Claim Text (Scrollbar Hidden) */}
                  <div className="max-h-[180px] overflow-y-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] w-full px-2">
                    <h2 className="text-base sm:text-xl font-black text-white tracking-tight leading-relaxed my-1">
                      "{activeTargetClaim.claimText}"
                    </h2>
                  </div>

                  {/* Speaker & Team Pill Badge */}
                  <div className="mt-3 flex items-center justify-center shrink-0">
                    <span className={`px-4 py-1 rounded-full border text-xs font-black uppercase tracking-wider flex items-center gap-2 ${
                      activeTargetClaim.team === 'PROPOSER'
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                    }`}>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{activeTargetClaim.speaker}</span>
                      <span className="text-gray-400 font-mono">//</span>
                      <span>{activeTargetClaim.team === 'PROPOSER' ? 'Affirmative' : 'Opposition'}</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* MODE C: EVIDENCE LOG CARD */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'evidence' && activeTargetClaim && (
              <motion.div
                key={`evidence-${activeTargetClaim.claimId}`}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center gap-3"
              >
                <div className="w-full max-w-lg bg-[#061410]/95 border-2 border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.3)] rounded-2xl p-4 text-left relative overflow-hidden backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center">
                        <FileText className="w-3.5 h-3.5 text-emerald-300" />
                      </div>
                      <span className="text-xs font-black tracking-widest text-emerald-400 uppercase font-mono">
                        EVIDENCE LOG
                      </span>
                    </div>

                    <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase">
                      VERIFIED EVIDENCE
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <span className="text-[10px] font-black tracking-wider text-emerald-300 uppercase block">
                      ARTICLE: {activeEvidence?.source || 'OBSERVING THE MOON FROM HOME'}
                    </span>
                    <p className="text-xs font-bold text-gray-200 leading-relaxed bg-[#020b08] p-2 rounded-lg border border-emerald-500/30 italic">
                      "{activeEvidence?.evidenceText || activeTargetClaim.claimText}"
                    </p>
                  </div>

                  <div className="bg-[#020d09] border border-emerald-500/40 rounded-xl p-2.5 text-center relative">
                    <div className="grid grid-cols-5 gap-1 pt-1 text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[7.5px] font-bold text-gray-400 uppercase">PRESENTATION</span>
                        <span className="text-sm font-black text-emerald-300 font-mono">9.5</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7.5px] font-bold text-gray-400 uppercase">CLARITY</span>
                        <span className="text-sm font-black text-emerald-300 font-mono">9.8</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7.5px] font-bold text-gray-400 uppercase">RELEVANCE</span>
                        <span className="text-sm font-black text-emerald-300 font-mono">9.6</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[7.5px] font-bold text-gray-400 uppercase">CREDIBILITY</span>
                        <span className="text-sm font-black text-emerald-300 font-mono">10</span>
                      </div>
                      <div className="flex flex-col items-center bg-emerald-500/20 border border-emerald-400/40 rounded p-0.5">
                        <span className="text-[7.5px] font-black text-emerald-300 uppercase">OVERALL</span>
                        <span className="text-sm font-black text-white font-mono flex items-center gap-1">
                          9.7 <Gavel className="w-3 h-3 text-emerald-300" />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* MODE D: COUNTERCLAIM REBUTTAL CARD */}
            {/* ------------------------------------------------------------- */}
            {viewMode === 'counterclaim' && activeTargetClaim && (
              <motion.div
                key={`counter-${activeTargetClaim.claimId}`}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center gap-3"
              >
                <div className={`w-full max-w-lg ${
                  isAffRebuttal 
                    ? 'bg-[#040f1a]/95 border-2 border-cyan-500/60 shadow-[0_0_35px_rgba(0,242,255,0.4)]'
                    : 'bg-[#1a040a]/95 border-2 border-rose-500/60 shadow-[0_0_35px_rgba(255,42,95,0.4)]'
                } rounded-2xl p-4 text-left relative overflow-hidden backdrop-blur-md`}>
                  
                  <div className={`flex items-center justify-between border-b ${isAffRebuttal ? 'border-cyan-500/30' : 'border-rose-500/30'} pb-2 mb-2.5`}>
                    <div className="flex items-center gap-2">
                      <MessageSquare className={`w-4 h-4 ${isAffRebuttal ? 'text-cyan-400' : 'text-rose-400'} animate-bounce`} />
                      <span className={`text-xs font-black tracking-widest uppercase font-mono ${isAffRebuttal ? 'text-cyan-400' : 'text-rose-400'}`}>
                        {isAffRebuttal ? 'AFFIRMATIVE REBUTTAL COUNTERCLAIM' : 'OPPOSITION REBUTTAL COUNTERCLAIM'}
                      </span>
                    </div>

                    <span className={`text-[9px] font-extrabold font-mono px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                      isAffRebuttal 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' 
                        : 'bg-rose-500/20 text-rose-300 border-rose-400/50'
                    }`}>
                      ⚔️ REBUTTAL ATTACK
                    </span>
                  </div>

                  {connectedCounterClaims.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400 flex flex-col items-center gap-2 italic">
                      <Brain className="w-8 h-8 text-gray-500 animate-pulse" />
                      <span>No counterclaims registered yet for this target claim.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-gray-400 uppercase">
                          VOICED BY: <strong className="text-white">{activeCounterClaim?.rebutterId || 'Rebuttal Speaker'}</strong>
                        </span>
                        <span className="text-[9px] font-mono text-gray-400">
                          {connectedCounterClaims.length} Rebuttal Points
                        </span>
                      </div>

                      <blockquote className={`text-sm sm:text-base font-black text-white leading-relaxed p-3 rounded-xl border italic shadow-inner ${
                        isAffRebuttal
                          ? 'bg-[#020b14] border-cyan-500/40 text-cyan-100'
                          : 'bg-[#120206] border-rose-500/40 text-rose-100'
                      }`}>
                        "{activeCounterClaim?.counterText}"
                      </blockquote>
                    </div>
                  )}
                </div>

                <div className={`w-full max-w-lg ${
                  isAffRebuttal
                    ? 'bg-[#040f1a]/90 border-2 border-cyan-500/60 shadow-[0_0_25px_rgba(0,242,255,0.3)]'
                    : 'bg-[#1a040a]/90 border-2 border-rose-500/60 shadow-[0_0_25px_rgba(255,42,95,0.3)]'
                } rounded-2xl p-3 text-center relative overflow-hidden backdrop-blur-md`}>
                  
                  <span className={`text-[10px] sm:text-xs font-black tracking-[0.25em] uppercase block mb-1 ${
                    isAffRebuttal ? 'text-cyan-400' : 'text-rose-400'
                  }`}>
                    {isAffRebuttal ? 'AFFIRMATIVE COUNTERCLAIM' : 'OPPOSITION COUNTERCLAIM'}
                  </span>

                  <h2 className="text-sm sm:text-base font-black text-white tracking-tight leading-snug px-2">
                    REBUTTING TARGET: "{activeTargetClaim.claimText}"
                  </h2>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Minimal floor accent line */}
        <div className="w-full max-w-lg h-0.5 bg-gradient-to-r from-transparent via-gray-700/50 to-transparent shrink-0 mt-1" />

      </div>

      {/* BOTTOM TARGET CLAIM SELECTOR & AUTO-CYCLE BAR (Clean, No Scrollbar) */}
      <div className="pt-2 z-10 shrink-0 border-t border-gray-800/80 mt-1 flex items-center justify-between gap-2">
        
        {/* Quick Target Claims Selector Pills */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase shrink-0 flex items-center gap-1">
            <Target className="w-3 h-3 text-cyan-400" />
            <span>Target Claims:</span>
          </span>

          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[85%] py-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
            {availableTargetClaims.map((claim, idx) => {
              const isSelected = claim.claimId === activeTargetClaim?.claimId;
              const hasImg = !!getClaimImageUrl(claim);

              return (
                <button
                  key={claim.claimId}
                  type="button"
                  onClick={() => {
                    setIsManualSelection(true);
                    setActiveClaimIndex(idx);
                    if (onStateUpdate) {
                      onStateUpdate({ rebuttalTargetClaimId: claim.claimId });
                    }
                    setViewMode('image');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-cyan-500 text-white border-cyan-400 shadow-md scale-105'
                      : 'bg-[#11131a] text-gray-400 border-[#222530] hover:text-white'
                  }`}
                >
                  <span>[{claim.speaker}]</span>
                  <span className="max-w-[120px] truncate">{claim.claimText}</span>
                  {hasImg && (
                    <span className="text-cyan-300 text-[10px]" title="Image Generated">
                      🖼️
                    </span>
                  )}
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cycle Toggle Button */}
        <button
          type="button"
          onClick={() => {
            setIsManualSelection(prev => !prev);
            setAutoRotate(true);
          }}
          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer shrink-0 flex items-center gap-1 border ${
            !isManualSelection
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(0,242,255,0.2)]'
              : 'bg-[#11131a] text-gray-400 border-[#222530] hover:text-white'
          }`}
          title={!isManualSelection ? 'Auto-cycling all target claims' : 'Click to auto-cycle all claims'}
        >
          <RotateCw className={`w-3 h-3 ${!isManualSelection ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
          <span>{!isManualSelection ? 'Auto Cycling' : 'Manual View'}</span>
        </button>

      </div>

    </div>
  );
}
