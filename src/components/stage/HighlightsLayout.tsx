import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { DebateState, HighlightSlide } from '../../App';
import StageTimer from './StageTimer';
import { HolographicProjectionCard } from './HolographicProjectionCard';

interface LayoutProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
}

export default function HighlightsLayout({ state, formatTime, onStateUpdate }: LayoutProps) {
  const slides: HighlightSlide[] = state.highlightSlides || [];
  const currentIndex = Math.min(state.currentHighlightSlideIndex || 0, Math.max(0, slides.length - 1));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSlide: HighlightSlide | undefined = slides[currentIndex];

  React.useEffect(() => {
    const vol = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
    if (videoRef.current) {
      videoRef.current.volume = vol;
    }
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  }, [activeSlide, state?.settings?.bgMusicVolume]);

  const handleNext = () => {
    if (slides.length <= 1) return;
    const nextIdx = (currentIndex + 1) % slides.length;
    if (onStateUpdate) {
      onStateUpdate({ currentHighlightSlideIndex: nextIdx });
    }
  };

  const cleanContent = (text?: string) => {
    if (!text) return '';
    return text.trim().replace(/^["'\u201c\u201d]+|["'\u201c\u201d]+$/g, '');
  };

  // If no slides exist, render clean minimal empty state with no pop-ups or action buttons
  if (slides.length === 0) {
    return (
      <div className="flex flex-col w-full h-full text-left select-none p-6 relative bg-[#040507] overflow-hidden text-white items-center justify-center">
        <StageTimer state={state} formatTime={formatTime} isAffirmative={true} />
        <p className="text-sm font-medium text-gray-500">No highlight selected for stage.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full text-left select-none p-4 sm:p-6 relative bg-[#040508] overflow-hidden text-white justify-between">
      {/* FLOATING TIMER IN TOP RIGHT */}
      <StageTimer state={state} formatTime={formatTime} isAffirmative={true} />

      {/* MAIN SLIDE STAGE DISPLAY */}
      <div className="flex-1 flex items-center justify-center my-auto py-2 z-10 w-full max-w-3xl mx-auto min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide?.id || currentIndex}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.25 }}
            className="w-full flex flex-col justify-center items-center max-h-full overflow-y-auto"
          >
            {/* VIDEO CLIP SLIDE */}
            {activeSlide?.type === 'video' && activeSlide.mediaUrl ? (
              <div className="relative w-full h-full max-h-[75vh] flex flex-col items-center justify-center rounded-xl overflow-hidden bg-black shadow-2xl">
                <video
                  ref={videoRef}
                  src={activeSlide.mediaUrl}
                  autoPlay
                  playsInline
                  muted={false}
                  onLoadedMetadata={(e) => {
                    e.currentTarget.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
                  }}
                  onEnded={handleNext}
                  className="w-full max-h-[75vh] object-contain"
                />
              </div>
            ) : activeSlide?.type === 'audio' && activeSlide.mediaUrl ? (
              /* AUDIO CLIP SLIDE */
              <div className="bg-[#0c0e15] border border-[#202330] rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center shadow-xl max-w-xl w-full">
                <audio
                  ref={audioRef}
                  src={activeSlide.mediaUrl}
                  autoPlay
                  muted={false}
                  onLoadedMetadata={(e) => {
                    e.currentTarget.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
                  }}
                  onEnded={handleNext}
                />

                {activeSlide.title && (
                  <h3 className="text-base sm:text-lg font-bold text-white mb-2">
                    {activeSlide.title}
                  </h3>
                )}

                <p className="text-sm sm:text-base text-gray-200 italic mb-4">
                  "{cleanContent(activeSlide.content)}"
                </p>

                {activeSlide.speakerName && (
                  <span className="text-xs font-semibold text-[#f97316]">
                    Speaker: {activeSlide.speakerName}
                  </span>
                )}
              </div>
            ) : (
              /* TEXT CLAIM / HOT TOPIC SLIDE */
              <div className="bg-[#0a0c10] border border-[#202330] rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl gap-4 max-w-2xl w-full">
                {activeSlide?.title && (
                  <div className="border-b border-[#1b1e2a] pb-2 text-center">
                    <span className="text-xs font-bold uppercase text-[#f97316] tracking-wider">
                      {activeSlide.title}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-7 my-2 flex-1 flex flex-col justify-center">
                    <blockquote className="text-base sm:text-lg font-medium text-gray-100 leading-snug italic border-l-2 border-[#f97316] pl-3 py-1">
                      "{cleanContent(activeSlide?.content)}"
                    </blockquote>
                  </div>

                  <div className="md:col-span-5 w-full">
                    <HolographicProjectionCard
                      imageUrl={(activeSlide as any)?.visualImageUrl}
                      claimText={cleanContent(activeSlide?.content)}
                      speakerName={activeSlide?.speakerName || 'Panel Speaker'}
                      type="claim"
                      className="w-full min-h-[170px]"
                    />
                  </div>
                </div>

                {/* SPEAKER FOOTER */}
                {activeSlide?.speakerName && (
                  <div className="flex items-center justify-center gap-2 pt-2 border-t border-[#1b1e2a]">
                    <span className="w-2 h-2 rounded-full bg-[#f97316]" />
                    <span className="text-xs font-bold text-white">
                      {activeSlide.speakerName}
                    </span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}


