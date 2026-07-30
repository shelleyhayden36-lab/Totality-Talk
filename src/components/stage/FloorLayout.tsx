import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateState } from '../../App';
import StageTimer from './StageTimer';
import { 
  Globe, 
  Mic,
  MessageSquare
} from 'lucide-react';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partial: any) => Promise<void> | void;
}

export default function FloorLayout({ state, formatTime }: LayoutProps) {
  // Session Transcripts directly from server state
  const session = state?.transcriptionSession || {};
  const transcripts = session?.transcripts || [];
  const interimTranscript = session?.interimTranscript || '';
  const isRecordingSession = !!session?.isRecording;

  // Auto scroll transcript container
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcripts, interimTranscript]);

  const floorTitle = state?.floorText?.trim() || 'THE FLOOR · OPEN DISCUSSION';

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#020612] text-white flex flex-col justify-between p-3 sm:p-6 select-none font-sans">
      
      {/* 1. HOLOGRAPHIC BLUEPRINT BACKGROUND & PLATTER GRAPHICS */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        {/* Dark Radial Vignette & Grid Backdrop */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#07192e] via-[#030914] to-[#01040a]"></div>
        <div 
          className="absolute inset-0 opacity-25"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0, 242, 255, 0.15) 1px, transparent 1px),
                              linear-gradient(to bottom, rgba(0, 242, 255, 0.15) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        ></div>

        {/* Animated Vertical Holographic Scanline Overlay */}
        <motion.div 
          animate={{ y: ['-100%', '200%'] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-cyan-400/10 to-transparent border-b border-cyan-400/30 pointer-events-none z-10"
        ></motion.div>

        {/* Floating Holographic Depth Particles */}
        <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
          {[...Array(18)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: `${(i * 17) % 100}%`, 
                y: `${(i * 23) % 100}%`, 
                opacity: 0.2 + (i % 5) * 0.15,
                scale: 0.6 + (i % 3) * 0.3
              }}
              animate={{ 
                y: [`${(i * 23) % 100}%`, `${((i * 23) + 40) % 100}%`, `${(i * 23) % 100}%`],
                x: [`${(i * 17) % 100}%`, `${((i * 17) + 15) % 100}%`, `${(i * 17) % 100}%`],
                opacity: [0.2, 0.85, 0.2]
              }}
              transition={{ 
                duration: 8 + (i % 6) * 2, 
                repeat: Infinity, 
                ease: 'easeInOut' 
              }}
              className="absolute w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_#00f2ff]"
            />
          ))}
        </div>

        {/* Floating Blueprint Holographic Platter Graphic */}
        <div className="relative w-full max-w-3xl aspect-square flex items-center justify-center opacity-85 scale-95 sm:scale-105 transition-all duration-700">
          <svg viewBox="0 0 800 800" className="w-full h-full text-cyan-400 drop-shadow-[0_0_35px_rgba(0,242,255,0.5)]">
            <defs>
              <filter id="holoGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0066ff" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {/* Schematic Header Label Top Left */}
            <g opacity="0.85" className="text-[10px] font-mono">
              <text x="50" y="70" fill="#00f2ff" fontWeight="bold" letterSpacing="1.5">FLAT EARTH MODEL SCHEMATIC</text>
              <text x="50" y="85" fill="#00a8ff" fontSize="9">REF: GEOCENTRIC SYSTEM v4.2</text>
              <text x="50" y="98" fill="#00a8ff" fontSize="9">SCALE: 1:A | COORDINATES: CENTRAL POLAR</text>
              <line x1="50" y1="105" x2="220" y2="105" stroke="#00f2ff" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Schematic Header Label Top Right */}
            <g opacity="0.85" className="text-[10px] font-mono text-right">
              <text x="750" y="70" fill="#00f2ff" fontWeight="bold" letterSpacing="1.5" textAnchor="end">THE GREAT DOME / FIRMAMENT</text>
              <line x1="580" y1="80" x2="750" y2="80" stroke="#00f2ff" strokeWidth="1" opacity="0.6" />
            </g>

            {/* Animated Rotating Radar Sweep Ring */}
            <g className="animate-spin origin-center" style={{ animationDuration: '30s' }}>
              <circle cx="400" cy="400" r="320" fill="none" stroke="#00f2ff" strokeWidth="1.5" strokeDasharray="12 12" opacity="0.4" />
              <line x1="400" y1="80" x2="400" y2="400" stroke="#00f2ff" strokeWidth="1" opacity="0.3" />
            </g>
            <circle cx="400" cy="400" r="300" fill="none" stroke="#00a8ff" strokeWidth="1" strokeDasharray="12 6" opacity="0.3" />
            
            {/* Degree Mark Ticks */}
            {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const x1 = 400 + 310 * Math.cos(rad);
              const y1 = 400 + 310 * Math.sin(rad);
              const x2 = 400 + 325 * Math.cos(rad);
              const y2 = 400 + 325 * Math.sin(rad);
              return (
                <g key={i}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#00f2ff" strokeWidth="1.5" opacity="0.7" />
                  <text x={400 + 340 * Math.cos(rad)} y={400 + 340 * Math.sin(rad) + 4} fill="#00f2ff" fontSize="8" fontMono textAnchor="middle" opacity="0.6">
                    {deg}°
                  </text>
                </g>
              );
            })}

            {/* Concentric Spherical Dome Arch */}
            <path d="M 120,400 A 280 220 0 0 1 680,400" fill="none" stroke="#00f2ff" strokeWidth="2.5" filter="url(#holoGlow)" opacity="0.85" />
            <path d="M 180,400 A 220 160 0 0 1 620,400" fill="none" stroke="#00a8ff" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

            {/* Main Flat Earth Platter Disk Body (Perspective Ellipse) */}
            <ellipse cx="400" cy="420" rx="260" ry="90" fill="url(#cyanGrad)" fillOpacity="0.12" stroke="#00f2ff" strokeWidth="3" filter="url(#holoGlow)" />
            <ellipse cx="400" cy="450" rx="260" ry="90" fill="none" stroke="#00f2ff" strokeWidth="2" strokeDasharray="8 4" opacity="0.5" />

            {/* Ice Wall Barrier Rim */}
            <path d="M 140,420 L 140,450 A 260 90 0 0 0 660,450 L 660,420 A 260 90 0 0 1 140,420 Z" fill="#00f2ff" fillOpacity="0.2" stroke="#00f2ff" strokeWidth="2" />

            {/* Platter Continent Outlines */}
            <path d="M 280,410 C 300,380 340,390 360,410 C 370,425 340,435 300,430 Z" fill="#00f2ff" fillOpacity="0.4" stroke="#00f2ff" strokeWidth="1.5" />
            <path d="M 420,390 C 460,375 520,385 540,410 C 510,430 450,435 410,410 Z" fill="#00f2ff" fillOpacity="0.4" stroke="#00f2ff" strokeWidth="1.5" />
            <path d="M 330,435 C 370,430 420,440 400,455 C 360,460 320,450 330,435 Z" fill="#00f2ff" fillOpacity="0.4" stroke="#00f2ff" strokeWidth="1.5" />

            {/* Central Axis & Equatorial Ticks */}
            <line x1="140" y1="420" x2="660" y2="420" stroke="#00f2ff" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />
            <line x1="400" y1="200" x2="400" y2="540" stroke="#00f2ff" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.7" />

            {/* Sun & Moon Spotlight Orbit Callout */}
            <g filter="url(#holoGlow)">
              <circle cx="310" cy="270" r="14" fill="#00f2ff" />
              <circle cx="490" cy="270" r="12" fill="none" stroke="#00f2ff" strokeWidth="2" />
              <path d="M 310,270 A 180 50 0 0 1 490,270" fill="none" stroke="#00f2ff" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.8" />
            </g>

            {/* Bottom Diagram Callouts */}
            <g opacity="0.85">
              <rect x="230" y="580" width="110" height="40" rx="6" fill="#020d1c" stroke="#00f2ff" strokeWidth="1" />
              <text x="285" y="605" fill="#00f2ff" fontSize="8" fontWeight="bold" textAnchor="middle" fontMono>LUMINARY ORBITS</text>
              <line x1="285" y1="580" x2="285" y2="520" stroke="#00f2ff" strokeWidth="1" strokeDasharray="2 2" />
            </g>

            <g opacity="0.85">
              <rect x="360" y="580" width="130" height="40" rx="6" fill="#020d1c" stroke="#00f2ff" strokeWidth="1" />
              <text x="425" y="598" fill="#00f2ff" fontSize="8" fontWeight="bold" textAnchor="middle" fontMono>ATMOSPHERIC LAYERS</text>
              <text x="425" y="612" fill="#00a8ff" fontSize="8" textAnchor="middle" fontMono>PILLARS OF THE EARTH</text>
              <line x1="425" y1="580" x2="425" y2="540" stroke="#00f2ff" strokeWidth="1" strokeDasharray="2 2" />
            </g>

            <g opacity="0.85">
              <rect x="510" y="580" width="110" height="40" rx="6" fill="#020d1c" stroke="#00f2ff" strokeWidth="1" />
              <text x="565" y="605" fill="#00f2ff" fontSize="8" fontWeight="bold" textAnchor="middle" fontMono>ICE WALL BARRIER</text>
              <line x1="565" y1="580" x2="565" y2="520" stroke="#00f2ff" strokeWidth="1" strokeDasharray="2 2" />
            </g>
          </svg>
        </div>
      </div>

      {/* 2. TOP HUD HEADER BAR */}
      <div className="relative z-10 flex items-center justify-between border-b border-cyan-500/30 pb-2.5 bg-[#030c1a]/85 backdrop-blur-md px-3 sm:px-5 py-2.5 rounded-2xl shadow-[0_0_25px_rgba(0,242,255,0.15)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/50 shadow-[0_0_15px_rgba(0,242,255,0.4)]">
            <Globe className="w-5 h-5 text-cyan-300 animate-spin" style={{ animationDuration: '20s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black font-mono tracking-widest text-cyan-400 uppercase bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
                PHASE 08 · DEBATE FLOOR
              </span>
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block"></span>
                LIVE STAGE
              </span>
            </div>
            <h1 className="text-sm sm:text-base font-black tracking-wider text-white uppercase flex items-center gap-2 mt-0.5">
              <span>THE FLOOR</span>
            </h1>
          </div>
        </div>

        {/* Stage Timer */}
        <StageTimer 
          state={state}
          formatTime={formatTime}
        />
      </div>

      {/* 3. CENTER STAGE HOLOGRAPHIC TITLE / PROJECTION */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 py-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={floorTitle}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -10 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="w-full relative flex flex-col items-center justify-center pointer-events-none"
          >
            {/* Holographic Beam Indicator */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-cyan-400 to-cyan-300"></div>
              <span className="text-[10px] sm:text-xs font-mono font-black uppercase tracking-[0.3em] text-cyan-300 drop-shadow-[0_0_10px_rgba(0,242,255,0.8)]">
                FLOOR PROJECTION
              </span>
              <div className="h-0.5 w-16 bg-gradient-to-l from-transparent via-cyan-400 to-cyan-300"></div>
            </div>

            {/* High-Contrast Clear Holographic Title Integrated into Background */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black text-white leading-tight tracking-tight font-sans drop-shadow-[0_0_30px_rgba(0,242,255,0.95)] max-w-3xl">
              <span className="bg-gradient-to-r from-cyan-100 via-white to-cyan-200 bg-clip-text text-transparent">
                {floorTitle}
              </span>
            </h1>

            {/* Subtle Holographic Grid Line Below Text */}
            <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-mono text-cyan-400/90 tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f2ff]"></span>
              <span>LIVE FLOOR BROADCAST</span>
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f2ff]"></span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 4. BOTTOM LIVE TRANSCRIPTIONS STREAM */}
      <div className="relative z-10 w-full max-w-4xl mx-auto bg-[#020b18]/90 border border-cyan-500/40 rounded-2xl p-3 sm:p-4 backdrop-blur-xl shadow-[0_0_30px_rgba(0,242,255,0.2)] shrink-0">
        <div className="flex items-center justify-between border-b border-cyan-500/30 pb-2 mb-2">
          <div className="flex items-center gap-2 text-cyan-300">
            <Mic className={`w-4 h-4 text-cyan-400 ${isRecordingSession ? 'animate-pulse' : ''}`} />
            <span className="text-xs font-mono font-black uppercase tracking-wider text-cyan-300">
              LIVE TRANSCRIPTION
            </span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/30">
            {transcripts.length} MESSAGES
          </span>
        </div>

        <div 
          ref={transcriptContainerRef}
          className="max-h-28 sm:max-h-36 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-cyan-500/40"
        >
          {transcripts.length === 0 && !interimTranscript ? (
            <div className="py-4 text-center text-cyan-400/70 font-mono text-xs flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span>Transcriptions will appear here as participants speak...</span>
            </div>
          ) : (
            <>
              {transcripts.slice(-6).map((t: any, idx: number) => (
                <div key={t.id || idx} className="bg-[#031126]/90 border border-cyan-500/30 p-2 sm:p-2.5 rounded-xl flex items-start gap-2.5">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/20 px-2 py-0.5 rounded shrink-0">
                    {t.speaker || 'Speaker'}
                  </span>
                  <p className="text-xs sm:text-sm text-cyan-100 font-sans font-medium leading-normal flex-1">
                    "{t.text}"
                  </p>
                  <span className="text-[9px] font-mono text-cyan-500/80 shrink-0 self-center">
                    {t.formattedTime || ''}
                  </span>
                </div>
              ))}
              {interimTranscript && (
                <div className="bg-[#051c3d]/90 border border-cyan-400 p-2 sm:p-2.5 rounded-xl animate-pulse flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-400/20 px-2 py-0.5 rounded shrink-0">
                    SPEAKING...
                  </span>
                  <p className="text-xs sm:text-sm text-cyan-200 font-sans font-bold italic">
                    "{interimTranscript}..."
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

