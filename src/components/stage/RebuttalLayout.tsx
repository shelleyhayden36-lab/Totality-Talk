import React, { useState, useEffect, useRef } from 'react';
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
  ImageIcon,
  UserCheck,
  Users,
  Filter,
  Mic
} from 'lucide-react';
import { DebateState, FormalClaim } from '../../App';
import StageTimer from './StageTimer';
import { HolographicProjectionCard } from './HolographicProjectionCard';
import { getActivePhaseTranscripts } from '../../lib/transcriptUtils';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
}

export default function RebuttalLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  // Determine Phase & Rebutting Team
  const currentPhase = (state.currentPhase || 'REBUTTAL_OPPOSITION').toUpperCase();
  const isOppRebuttal = currentPhase === 'REBUTTAL_OPPOSITION' || state.rebuttalRebutterTeam === 'CONTRARY';
  const isAffRebuttal = currentPhase === 'REBUTTAL_AFFIRMATIVE' || state.rebuttalRebutterTeam === 'PROPOSER';

  // Active Speaker & Participants
  const participants = state.participants || [];
  const seatedParticipants = participants.filter(p => p.isSeated);
  const activeSpeakerId = state.currentSpeakerId || null;
  const activeSpeakerObj = participants.find(p => p.id === activeSpeakerId);

  // Teleprompter ref and active speaker transcript tracking
  const teleprompterRef = useRef<HTMLDivElement>(null);
  const [isHoveringTeleprompter, setIsHoveringTeleprompter] = useState(false);

  const currentTurnStartIndex = state.transcriptionSession?.speakerTurnStartIndices?.[activeSpeakerId || ''] ?? state.transcriptionSession?.activeTurnStartIndex ?? 0;
  const allTranscripts = state.transcriptionSession?.transcripts || [];
  const activeSpeakerTranscripts = currentTurnStartIndex < allTranscripts.length ? allTranscripts.slice(currentTurnStartIndex) : allTranscripts;
  const interimTranscript = state.transcriptionSession?.interimTranscript || '';

  // Auto-scroll teleprompter
  useEffect(() => {
    if (teleprompterRef.current && !isHoveringTeleprompter) {
      teleprompterRef.current.scrollTo({
        top: teleprompterRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [activeSpeakerTranscripts.length, interimTranscript, isHoveringTeleprompter]);

  // Target claim ID from global state
  const targetClaimId = state.rebuttalTargetClaimId || null;

  // Gather ALL target claims pool from formalClaims, claims, and extractedClaims
  const rawFormalClaims: FormalClaim[] = Array.isArray(state.formalClaims) ? state.formalClaims : [];
  
  const legacyClaims: FormalClaim[] = (Array.isArray(state.claims) ? state.claims : [])
    .filter(c => c.text && c.text.trim().length > 0)
    .map(c => ({
      claimId: c.id,
      speaker: c.speakerName || 'Speaker',
      team: c.speakerId?.includes('con') || c.speakerName?.toLowerCase().includes('opp') ? 'CONTRARY' : 'PROPOSER',
      phase: c.phase || 'OPENING',
      claimText: c.text,
      status: 'approved',
      visualImageUrl: (c as any).visualImageUrl || (c as any).imageUrl
    }));

  const aiExtractedClaims: FormalClaim[] = (Array.isArray(state.transcriptionSession?.extractedClaims) ? state.transcriptionSession.extractedClaims : [])
    .filter(c => c.text && c.text.trim().length > 0)
    .map(c => ({
      claimId: c.id,
      speaker: c.possibleSpeaker || 'Speaker',
      team: 'PROPOSER',
      phase: 'OPENING',
      claimText: c.text,
      status: 'approved',
      visualImageUrl: (c as any).visualImageUrl || (c as any).imageUrl
    }));

  // Helper to retrieve generated image URL for a claim across all state collections
  const getClaimImageUrl = (claim: FormalClaim | undefined): string | null => {
    if (!claim) return null;
    
    // 1. Direct URL on claim
    const directUrl = (claim as any).visualImageUrl || (claim as any).imageUrl;
    if (directUrl) return directUrl;

    const normText = (claim.claimText || '').trim().toLowerCase();

    // 2. Search by EXACT ID match FIRST (highest priority)
    const fc = (state.formalClaims || []).find(f => f.claimId === claim.claimId || (f as any).id === claim.claimId);
    if (fc && ((fc as any).visualImageUrl || (fc as any).imageUrl)) {
      return (fc as any).visualImageUrl || (fc as any).imageUrl;
    }

    const lc = (state.claims || []).find(c => c.id === claim.claimId || (c as any).claimId === claim.claimId);
    if (lc && ((lc as any).visualImageUrl || (lc as any).imageUrl)) {
      return (lc as any).visualImageUrl || (lc as any).imageUrl;
    }

    const ec = (state.transcriptionSession?.extractedClaims || []).find((c: any) => c.id === claim.claimId || c.claimId === claim.claimId);
    if (ec && (ec.visualImageUrl || ec.imageUrl)) {
      return ec.visualImageUrl || ec.imageUrl;
    }

    const slide = [...((state as any).slides || []), ...((state as any).highlightSlides || [])].find((s: any) => s.claimId === claim.claimId || s.id === claim.claimId);
    if (slide && ((slide as any).visualImageUrl || (slide as any).imageUrl)) {
      return (slide as any).visualImageUrl || (slide as any).imageUrl;
    }

    // 3. Search by exact text match ONLY if normText is substantial (>= 10 chars)
    if (normText && normText.length >= 10) {
      const fcText = (state.formalClaims || []).find(f => f.claimText && f.claimText.trim().toLowerCase() === normText);
      if (fcText && ((fcText as any).visualImageUrl || (fcText as any).imageUrl)) {
        return (fcText as any).visualImageUrl || (fcText as any).imageUrl;
      }

      const lcText = (state.claims || []).find(c => (c.text && c.text.trim().toLowerCase() === normText) || ((c as any).claimText && (c as any).claimText.trim().toLowerCase() === normText));
      if (lcText && ((lcText as any).visualImageUrl || (lcText as any).imageUrl)) {
        return (lcText as any).visualImageUrl || (lcText as any).imageUrl;
      }
    }

    return null;
  };

  // Combine and deduplicate claims, ensuring images are attached
  const combinedClaimsMap = new Map<string, FormalClaim & { visualImageUrl?: string }>();
  [...rawFormalClaims, ...legacyClaims, ...aiExtractedClaims].forEach(c => {
    if (c.claimId && c.claimText) {
      const existing = combinedClaimsMap.get(c.claimId);
      const img = (c as any).visualImageUrl || (c as any).imageUrl || getClaimImageUrl(c);
      if (!existing) {
        combinedClaimsMap.set(c.claimId, { ...c, visualImageUrl: img || undefined });
      } else {
        if (!existing.visualImageUrl && img) {
          existing.visualImageUrl = img;
        }
      }
    }
  });
  const allClaimsPool = Array.from(combinedClaimsMap.values());

  // Claim filtering tab state
  const [claimFilterTab, setClaimFilterTab] = useState<'OPPOSING' | 'AFFIRMATIVE' | 'ALL'>('OPPOSING');

  const filteredTargetClaims = allClaimsPool.filter(c => {
    if (claimFilterTab === 'ALL') return true;
    const cTeam = (c.team || '').toUpperCase();
    const isProposer = cTeam === 'PROPOSER' || cTeam === 'AFFIRMATIVE' || cTeam.includes('PRO') || cTeam.includes('AFF');
    const isContrary = cTeam === 'CONTRARY' || cTeam === 'OPPOSITION' || cTeam.includes('CON') || cTeam.includes('OPP');

    if (claimFilterTab === 'OPPOSING') {
      if (isOppRebuttal) return isProposer || !isContrary;
      if (isAffRebuttal) return isContrary || !isProposer;
    }
    if (claimFilterTab === 'AFFIRMATIVE') return isProposer;
    return true;
  });

  const availableTargetClaims = filteredTargetClaims.length > 0 ? filteredTargetClaims : allClaimsPool;

  // Handlers to update speaker or rebuttal team
  const handleSelectSpeaker = (participantId: string) => {
    if (!onStateUpdate) return;
    const currentLen = (state.transcriptionSession?.transcripts || []).length;
    const updatedSession = {
      ...(state.transcriptionSession || { recordings: [], transcripts: [], extractedClaims: [], highlights: [] }),
      interimTranscript: '',
      activeTurnStartIndex: currentLen,
      speakerTurnStartIndices: {
        ...(state.transcriptionSession?.speakerTurnStartIndices || {}),
        [participantId]: currentLen
      }
    };
    onStateUpdate({
      currentSpeakerId: participantId,
      transcriptionSession: updatedSession
    });
  };

  const handleToggleRebuttalPhase = (newPhase: 'REBUTTAL_OPPOSITION' | 'REBUTTAL_AFFIRMATIVE') => {
    if (!onStateUpdate) return;
    onStateUpdate({
      currentPhase: newPhase,
      rebuttalRebutterTeam: newPhase === 'REBUTTAL_OPPOSITION' ? 'CONTRARY' : 'PROPOSER'
    });
  };

  const [activeClaimIndex, setActiveClaimIndex] = useState<number>(0);

  // Is a claim targeted? (Driven strictly by global targetClaimId)
  const targetedClaimFromState = targetClaimId ? allClaimsPool.find(c => c.claimId === targetClaimId) : null;
  const isClaimTargeted = !!targetedClaimFromState;

  const currentCarouselIndex = availableTargetClaims.length > 0 
    ? activeClaimIndex % availableTargetClaims.length 
    : 0;

  // Sync active target claim (if targeted, uses exact targeted claim; otherwise uses carousel index)
  const activeTargetClaim: FormalClaim | undefined = targetedClaimFromState 
    || availableTargetClaims[currentCarouselIndex] 
    || availableTargetClaims[0];

  // Connected Evidences & Counterclaims for active target claim
  const connectedEvidences = (state.evidenceList || []).filter(e => e.claimId === activeTargetClaim?.claimId);
  const connectedCounterClaims = (state.counterClaims || []).filter(cc => cc.claimId === activeTargetClaim?.claimId);

  // Active Image URL for the active claim (checks active target claim first, then getClaimImageUrl fallback)
  const activeClaimImageUrl = (activeTargetClaim as any)?.visualImageUrl 
    || (activeTargetClaim as any)?.imageUrl 
    || getClaimImageUrl(activeTargetClaim);

  // Stage display modes: 'image' (image/blueprint) | 'claim' (text) | 'counterclaim' | 'evidence'
  const [viewMode, setViewMode] = useState<'image' | 'claim' | 'counterclaim' | 'evidence'>('image');

  // -------------------------------------------------------------
  // CYCLING & ROTATION LOGIC:
  // 1. If NO claim targeted:
  //    - Autocycle through available claims every 8 seconds
  // 2. If a claim IS targeted:
  //    - Shows split screen: Left Teleprompter + Right AI Claim Image
  // -------------------------------------------------------------
  useEffect(() => {
    if (availableTargetClaims.length === 0) return;

    const interval = setInterval(() => {
      if (!isClaimTargeted) {
        // Auto-cycle through all available target claims (8 seconds per claim)
        setActiveClaimIndex(prevIdx => (prevIdx + 1) % availableTargetClaims.length);
        setViewMode('image');
      }
    }, 8000); // 8 seconds hold time per claim image when untargeted

    return () => clearInterval(interval);
  }, [isClaimTargeted, availableTargetClaims.length]);

  // Color scheme based on target claim team
  const isTargetClaimAffirmative = activeTargetClaim?.team === 'PROPOSER' || isOppRebuttal;
  const isCounterMode = viewMode === 'counterclaim';

  let isCyanTheme = isTargetClaimAffirmative;
  if (isCounterMode) {
    isCyanTheme = isAffRebuttal;
  }

  const primaryTextClass = isCyanTheme ? 'text-cyan-400' : 'text-orange-400';
  const primaryBorderClass = isCyanTheme ? 'border-cyan-500/50' : 'border-orange-500/50';
  const primaryGlowClass = isCyanTheme 
    ? 'shadow-[0_0_35px_rgba(0,242,255,0.3)]' 
    : 'shadow-[0_0_35px_rgba(249,115,22,0.3)]';
  const primaryBeamGradient = isCyanTheme 
    ? 'from-cyan-400/30 via-cyan-400/10 to-transparent' 
    : 'from-orange-400/30 via-orange-400/10 to-transparent';

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
      <div className="flex flex-col shrink-0 z-10 mb-2 gap-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* TOTALITY TALK BRANDING BADGE */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-500 to-cyan-600 flex items-center justify-center p-0.5 border border-cyan-400/60 shadow-[0_0_12px_rgba(0,242,255,0.4)]">
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

          {/* Rebuttal Stage & Speaker Status Indicators (Clean Non-interactive Badges) */}
          <div className="flex items-center gap-2 bg-[#090b10] border border-gray-800 p-1.5 rounded-xl pr-28 sm:pr-32 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 font-mono">
              Rebuttal Stage:
            </span>
            <div
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                isOppRebuttal
                  ? 'bg-orange-500/20 text-orange-300 border-orange-500/60 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-[0_0_12px_rgba(0,242,255,0.3)]'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${isOppRebuttal ? 'text-orange-400' : 'text-cyan-400'}`} />
              <span>{isOppRebuttal ? 'OPPOSITION REBUTTAL' : 'AFFIRMATIVE REBUTTAL'}</span>
            </div>

            {activeSpeakerObj && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-gray-800">
                <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 font-mono flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Speaking:</span>
                </span>
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1.5 ${
                  activeSpeakerObj.role === 'PROPOSER' || (activeSpeakerObj as any).team === 'PROPOSER'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50'
                    : 'bg-orange-500/20 text-orange-300 border-orange-400/50'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${activeSpeakerObj.role === 'PROPOSER' || (activeSpeakerObj as any).team === 'PROPOSER' ? 'bg-cyan-300' : 'bg-orange-300'}`} />
                  <span>@{activeSpeakerObj.name}</span>
                  <span className="text-[8px] opacity-75">({activeSpeakerObj.role === 'PROPOSER' || (activeSpeakerObj as any).team === 'PROPOSER' ? 'AFF' : 'OPP'})</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full border-b border-gray-800/80 mt-1" />
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
        <div className="w-full max-w-5xl flex-1 flex flex-col items-center justify-center my-auto z-10 min-h-0 py-1 overflow-hidden scrollbar-none">
          <AnimatePresence mode="wait">
            
            {/* ------------------------------------------------------------- */}
            {/* TARGETED CLAIM REBUTTAL VIEW (SPLIT: LEFT TELEPROMPTER | RIGHT IMAGE) */}
            {/* ------------------------------------------------------------- */}
            {isClaimTargeted && activeTargetClaim ? (
              <motion.div
                key={`targeted-rebuttal-${activeTargetClaim.claimId}`}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch my-auto min-h-0 p-1 overflow-hidden"
              >
                {/* LEFT SIDE: LIVE TELEPROMPTER */}
                <div className="flex flex-col bg-[#050810]/95 border border-cyan-500/40 shadow-[0_0_25px_rgba(0,242,255,0.15)] rounded-2xl p-4 relative overflow-hidden backdrop-blur-md h-full min-h-[260px]">
                  
                  {/* Teleprompter Header Bar */}
                  <div className="z-10 pb-2.5 border-b border-gray-800 flex items-center justify-between text-xs font-mono shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mic className={`w-4 h-4 shrink-0 ${isAffRebuttal ? 'text-cyan-400' : 'text-orange-400'} animate-pulse`} />
                      <span className="text-gray-400 font-bold uppercase tracking-wider text-[10px] shrink-0">
                        TELEPROMPTER:
                      </span>
                      <span className={`text-xs font-black uppercase tracking-wide truncate ${isAffRebuttal ? 'text-cyan-300' : 'text-orange-300'}`}>
                        {activeSpeakerObj ? activeSpeakerObj.name : (isAffRebuttal ? 'Affirmative Rebutter' : 'Opposition Rebutter')}
                      </span>
                    </div>
                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase font-mono shrink-0 ${
                      isAffRebuttal 
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50' 
                        : 'bg-orange-500/20 text-orange-300 border-orange-400/50'
                    }`}>
                      ⚔️ LIVE REBUTTAL
                    </span>
                  </div>

                  {/* Teleprompter Scrolling Text Area */}
                  <div 
                    ref={teleprompterRef}
                    onMouseEnter={() => setIsHoveringTeleprompter(true)}
                    onMouseLeave={() => setIsHoveringTeleprompter(false)}
                    className="flex-1 overflow-y-auto scrollbar-none space-y-3 py-3 px-2 relative text-left flex flex-col justify-start min-h-0"
                  >
                    {activeSpeakerTranscripts.map((t: any, idx: number) => (
                      <motion.p 
                        key={t.id || idx} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm sm:text-base font-semibold text-gray-100 leading-relaxed font-sans select-text"
                      >
                        {t.text}
                      </motion.p>
                    ))}

                    {interimTranscript && (
                      <motion.p 
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm sm:text-base font-bold text-cyan-300 italic leading-relaxed font-sans select-text animate-pulse"
                      >
                        "{interimTranscript}..."
                      </motion.p>
                    )}

                    {activeSpeakerTranscripts.length === 0 && !interimTranscript && (
                      <div className="flex-1 flex flex-col items-center justify-center py-6 text-center my-auto">
                        <Brain className="w-7 h-7 text-cyan-400 animate-pulse mb-2" />
                        <p className="text-xs font-bold text-white uppercase tracking-wider">Teleprompter Listening Live</p>
                        <p className="text-[11px] text-gray-400 mt-1 max-w-xs leading-relaxed">
                          Speech recognition active. Rebuttal transcriptions stream here live on stage.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bottom Cinematic Fade */}
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#050810] to-transparent z-10 pointer-events-none" />
                </div>

                {/* RIGHT SIDE: CLAIM IMAGE & TARGET CLAIM STATEMENT */}
                <div className="flex flex-col items-center justify-between bg-[#070a12]/95 border border-gray-800 rounded-2xl p-4 relative overflow-hidden backdrop-blur-md h-full min-h-[260px] gap-2.5">
                  
                  {/* Status Indicator Badge */}
                  <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-[10px] font-black uppercase text-amber-300 tracking-wider shrink-0">
                    <Target className="w-3.5 h-3.5 text-amber-300" />
                    <span>TARGETED CLAIM UNDER REBUTTAL</span>
                  </div>

                  {/* Holographic Projection Card (NO selectable/expand buttons!) */}
                  <div className="w-full flex-1 max-h-[210px] min-h-[140px] shrink-0 my-auto">
                    <HolographicProjectionCard
                      imageUrl={activeClaimImageUrl}
                      claimText={activeTargetClaim.claimText}
                      speakerName={activeTargetClaim.speaker}
                      team={activeTargetClaim.team}
                      type="claim"
                      showExpandButton={false}
                      className="w-full h-full shadow-2xl"
                    />
                  </div>

                  {/* Target Claim Text Box */}
                  <div className="w-full bg-[#030509]/95 border border-amber-500/40 p-3 rounded-xl text-center shrink-0">
                    <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-amber-400 block mb-0.5">
                      TARGET CLAIM STATEMENT:
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                      <strong className={primaryTextClass}>[{activeTargetClaim.speaker}]: </strong>
                      "{activeTargetClaim.claimText}"
                    </p>
                  </div>
                </div>

              </motion.div>
            ) : (

              /* ------------------------------------------------------------- */
              /* UNTARGETED REBUTTAL STAGE VIEW (NO CLAIM TARGETED YET) */
              /* ------------------------------------------------------------- */
              <motion.div
                key={activeTargetClaim ? `untargeted-${activeTargetClaim.claimId}` : 'untargeted-none'}
                variants={cyberVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full flex flex-col items-center gap-2.5 my-auto max-w-xl"
              >
                {/* Visual Carousel Status Indicator Badge */}
                <div className="flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.2)] text-[10px] font-black uppercase text-cyan-300 tracking-wider font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-spin" style={{ animationDuration: '6s' }} />
                  <span>
                    AVAILABLE TARGET CLAIMS CAROUSEL ({availableTargetClaims.length > 0 ? currentCarouselIndex + 1 : 0} / {availableTargetClaims.length})
                  </span>
                </div>

                {/* Subtitle / Mode Notice */}
                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-widest font-bold -mt-1">
                  NO CLAIM TARGETED • ROTATING AVAILABLE CLAIMS TO REBUT
                </span>

                {/* FLOATING 3D SCHEMATIC / GENERATED IMAGE CARD */}
                <div className="w-full max-w-sm sm:max-w-md h-[180px] sm:h-[210px] shrink-0 my-0.5">
                  <HolographicProjectionCard
                    imageUrl={activeClaimImageUrl}
                    claimText={activeTargetClaim?.claimText || 'Debate Claim'}
                    speakerName={activeTargetClaim?.speaker || 'Debater'}
                    team={activeTargetClaim?.team}
                    type="claim"
                    showExpandButton={false}
                    className="w-full h-full shadow-2xl"
                  />
                </div>

                {/* Actual Words of the Available Claim */}
                {activeTargetClaim ? (
                  <div className="flex flex-col items-center justify-center px-4 py-2.5 bg-[#07090e]/90 border border-cyan-500/40 rounded-xl text-center max-w-lg w-full shadow-lg">
                    <span className="text-[9px] uppercase font-mono tracking-wider font-extrabold text-cyan-400 mb-0.5">
                      AVAILABLE CLAIM STATEMENT ({currentCarouselIndex + 1} OF {availableTargetClaims.length}):
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                      <strong className={primaryTextClass}>[{activeTargetClaim.speaker}]: </strong>
                      "{activeTargetClaim.claimText}"
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center px-4 py-3 bg-[#07090e]/90 border border-gray-800 rounded-xl text-center max-w-lg w-full">
                    <span className="text-xs font-bold text-gray-500 italic">
                      No claims available to target yet for this stage.
                    </span>
                  </div>
                )}

                {/* Carousel Pips / Indicators */}
                {availableTargetClaims.length > 1 && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {availableTargetClaims.map((c, i) => (
                      <div
                        key={c.claimId}
                        className={`h-1.5 rounded-full transition-all ${
                          i === currentCarouselIndex
                            ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(0,242,255,0.8)]'
                            : 'w-1.5 bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Minimal floor accent line */}
        <div className="w-full max-w-lg h-0.5 bg-gradient-to-r from-transparent via-gray-700/50 to-transparent shrink-0 mt-1" />

      </div>

    </div>
  );
}
