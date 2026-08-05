import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Maximize2, X, Eye, ShieldCheck, Terminal } from 'lucide-react';
import { 
  generateAffirmativeHologramSvg, 
  generateOppositionHologramSvg, 
  generateEvidenceHologramSvg 
} from '../../lib/imageBots/blueprintSvgRenderer';

interface HolographicProjectionCardProps {
  imageUrl?: string | null;
  claimText?: string;
  speakerName?: string;
  team?: 'PROPOSER' | 'CONTRARY' | 'AFFIRMATIVE' | 'OPPOSITION' | string;
  type?: 'claim' | 'evidence' | 'counterclaim' | 'general';
  evidenceSummary?: string;
  source?: string;
  className?: string;
  compact?: boolean;
  showExpandButton?: boolean;
}

export const HolographicProjectionCard: React.FC<HolographicProjectionCardProps> = ({
  imageUrl,
  claimText = 'Debate Assertion',
  speakerName = 'Debater',
  team = 'PROPOSER',
  type = 'claim',
  evidenceSummary,
  source,
  className = '',
  compact = false,
  showExpandButton = true,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Normalize team side
  const isAff = team === 'PROPOSER' || team === 'AFFIRMATIVE';
  const isEvidence = type === 'evidence';

  // Determine primary color theme
  let accentHex = '#00f2ff'; // Cyan for Affirmative
  let borderClass = 'border-cyan-500/40';
  let glowClass = 'shadow-[0_0_25px_rgba(0,242,255,0.25)]';
  let textAccentClass = 'text-cyan-400';
  let bgGradientClass = 'from-cyan-950/30 via-slate-950/80 to-cyan-950/20';
  let badgeBg = 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
  let beamGradient = 'from-cyan-400/20 via-cyan-400/5 to-transparent';

  if (isEvidence) {
    accentHex = '#10b981'; // Emerald for Evidence
    borderClass = 'border-emerald-500/40';
    glowClass = 'shadow-[0_0_25px_rgba(16,185,129,0.25)]';
    textAccentClass = 'text-emerald-400';
    bgGradientClass = 'from-emerald-950/30 via-slate-950/80 to-emerald-950/20';
    badgeBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
    beamGradient = 'from-emerald-400/20 via-emerald-400/5 to-transparent';
  } else if (!isAff) {
    accentHex = '#f97316'; // Orange for Opposition
    borderClass = 'border-orange-500/40';
    glowClass = 'shadow-[0_0_25px_rgba(249,115,22,0.25)]';
    textAccentClass = 'text-orange-400';
    bgGradientClass = 'from-orange-950/30 via-slate-950/80 to-orange-950/20';
    badgeBg = 'bg-orange-500/15 border-orange-500/30 text-orange-300';
    beamGradient = 'from-orange-400/20 via-orange-400/5 to-transparent';
  }

  // Determine image source: custom uploaded/generated image URL, or high-tech dynamic SVG blueprint fallback
  let displayImageSrc = imageUrl;
  if (!displayImageSrc) {
    if (isEvidence) {
      displayImageSrc = generateEvidenceHologramSvg({
        claimTitle: claimText,
        evidenceSummary: evidenceSummary || claimText,
        source: source || 'Live Verified Record',
        judgeScore: 92,
        judgeResult: 'Strong support'
      });
    } else if (isAff) {
      displayImageSrc = generateAffirmativeHologramSvg({
        claimText,
        speakerName,
        topic: 'AFFIRMATIVE BLUEPRINT'
      });
    } else {
      displayImageSrc = generateOppositionHologramSvg({
        claimText,
        speakerName,
        topic: 'OPPOSITION BLUEPRINT'
      });
    }
  }

  return (
    <>
      {/* MAIN HOLOGRAPHIC PROJECTION CARD */}
      <div 
        className={`relative group rounded-xl overflow-hidden bg-gradient-to-b ${bgGradientClass} border ${borderClass} ${glowClass} transition-all duration-300 ${className}`}
      >
        {/* OVERHEAD PROJECTION BEAM CONE */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 h-20 pointer-events-none z-10 opacity-75">
          <div className={`w-full h-full bg-gradient-to-b ${beamGradient} blur-md clip-polygon`} 
               style={{ clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)' }} />
        </div>

        {/* OVERHEAD EMITTER HUD LIGHT BAR */}
        <div className="absolute top-0 left-0 right-0 h-1.5 z-20 flex justify-between items-center px-4 bg-black/60 backdrop-blur-sm border-b border-white/10">
          <div className="h-full w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          <span className="text-[7.5px] font-mono tracking-widest text-white/70 uppercase font-black">
            HOLOGRAM PROJECTOR ACTIVE
          </span>
          <div className="h-full w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
        </div>

        {/* HIGH-TECH CORNER HUD BRACKETS */}
        <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-white/60 z-20 pointer-events-none" />
        <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-white/60 z-20 pointer-events-none" />
        <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-white/60 z-20 pointer-events-none" />
        <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-white/60 z-20 pointer-events-none" />

        {/* TOP STATUS BADGES */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
          <span className={`text-[8px] font-extrabold font-mono px-2 py-0.5 rounded-full border backdrop-blur-md uppercase tracking-wider flex items-center gap-1 ${badgeBg}`}>
            <Sparkles className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
            {isEvidence ? 'EVIDENCE SCHEMATIC' : isAff ? 'PROPOSER BLUEPRINT' : 'OPPOSITION BLUEPRINT'}
          </span>

          {showExpandButton && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="pointer-events-auto p-1 rounded-md bg-black/60 border border-white/20 text-white/80 hover:text-white hover:bg-black/90 transition-all cursor-pointer backdrop-blur-sm shadow-md"
              title="Expand Holographic Schematic"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* IMAGE CONTAINER WITH ANIMATED HOLOGRAPHIC OVERLAY */}
        <div className="relative w-full h-full min-h-[90px] sm:min-h-[110px] flex items-center justify-center overflow-hidden p-1.5 pt-6">
          
          {/* Subtle Ambient Light Flicker Container */}
          <motion.div 
            className="relative w-full h-full flex items-center justify-center rounded-lg overflow-hidden border border-white/10 bg-black/40"
            animate={{ opacity: [0.94, 1, 0.96, 1, 0.95] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          >
            {/* Main Hologram Image / Blueprint SVG */}
            <img 
              src={displayImageSrc} 
              alt="Holographic Blueprint Visual" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain max-h-[320px] filter drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />

            {/* ANIMATED SCANLINE LASER SWEEP OVERLAY */}
            <motion.div 
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background: `linear-gradient(to bottom, transparent 0%, ${accentHex}33 50%, transparent 100%)`,
                height: '24%',
              }}
              animate={{ top: ['-25%', '100%'] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
            />

            {/* FINE SUBTLE HORIZONTAL GRID LINES (HUD SCREEN TEXTURE) */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-20 z-10"
              style={{
                backgroundImage: `linear-gradient(to bottom, ${accentHex}22 1px, transparent 1px)`,
                backgroundSize: '100% 4px'
              }}
            />

            {/* LIGHT CHROMATIC REFLECTION SWEEP */}
            <motion.div
              className="absolute inset-0 pointer-events-none z-10 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
              animate={{ opacity: [0.1, 0.3, 0.1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>

        </div>

        {/* BOTTOM HUD CAPTION BAR */}
        <div className="px-3 py-2 bg-black/70 border-t border-white/10 flex items-center justify-between text-[9px] font-mono font-bold text-gray-300">
          <div className="flex items-center gap-1.5 truncate max-w-[75%]">
            <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isEvidence ? 'bg-emerald-400' : isAff ? 'bg-cyan-400' : 'bg-orange-400'}`} />
            <span className="truncate uppercase tracking-wider">{claimText}</span>
          </div>
          <span className={`text-[8.5px] font-extrabold uppercase ${textAccentClass}`}>
            3D STAGE PROJECTION
          </span>
        </div>

      </div>

      {/* EXPANDED FULL-SCREEN HOLOGRAM MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`relative max-w-3xl w-full max-h-[90vh] bg-slate-950 border-2 ${borderClass} rounded-2xl p-4 flex flex-col justify-between overflow-hidden shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${isEvidence ? 'bg-emerald-400' : isAff ? 'bg-cyan-400' : 'bg-orange-400'}`} />
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    STAGE HOLOGRAPHIC PROJECTION SCHEMATIC
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Image Area with Scanlines */}
              <div className="relative flex-1 flex items-center justify-center min-h-[400px] overflow-hidden rounded-xl bg-black/80 border border-white/10 p-4">
                <img 
                  src={displayImageSrc} 
                  alt="Expanded Holographic Projection" 
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto object-contain filter drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]"
                />

                {/* ANIMATED SCANLINE LASER SWEEP OVERLAY */}
                <motion.div 
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    background: `linear-gradient(to bottom, transparent 0%, ${accentHex}44 50%, transparent 100%)`,
                    height: '20%',
                  }}
                  animate={{ top: ['-20%', '100%'] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: 'linear' }}
                />

                {/* GRID OVERLAY */}
                <div 
                  className="absolute inset-0 pointer-events-none opacity-15 z-10"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, ${accentHex}33 1px, transparent 1px)`,
                    backgroundSize: '100% 6px'
                  }}
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-3 mt-2 border-t border-white/10 flex items-center justify-between text-xs text-gray-300">
                <div className="flex flex-col">
                  <span className="font-extrabold text-white">{claimText}</span>
                  <span className="text-[10px] text-gray-400 font-mono">Speaker: {speakerName}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase border ${badgeBg}`}>
                  HIGH RESOLUTION STAGE HOLOGRAM
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
