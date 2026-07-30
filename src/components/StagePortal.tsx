import React, { useState, useEffect, useRef } from 'react';
import { DebateState } from '../App';
import LobbyLayout from './stage/LobbyLayout';
import OpeningLayout from './stage/OpeningLayout';
import CrossExamLayout from './stage/CrossExamLayout';
import RebuttalLayout from './stage/RebuttalLayout';
import ChatQLayout from './stage/ChatQLayout';
import ClosingLayout from './stage/ClosingLayout';
import HighlightsLayout from './stage/HighlightsLayout';
import WinnerLayout from './stage/WinnerLayout';
import CreditsLayout from './stage/CreditsLayout';
import { X, Volume2, VolumeX, Megaphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StagePortalProps {
  state: DebateState;
  formatTime: (seconds: number) => string;
  onStateUpdate?: (partialState: Partial<DebateState>) => void;
  onExit?: () => void;
}

export default function StagePortal({ state, formatTime, onStateUpdate, onExit }: StagePortalProps) {
  // Phase detection: Extract current active phase ID (standardize to uppercase)
  const currentPhaseId = (state?.currentPhase || 'LOBBY').toUpperCase();

  // Find the current phase in state settings to get video options
  const currentPhaseObj = (state?.settings?.phases || []).find(
    p => p.id.toUpperCase() === currentPhaseId
  );

  // Find the current round name
  const currentRoundName = state?.currentRound || 'Round 1';

  // Extract the video url for this phase and round
  let videoUrl = state?.settings?.roundIntroVideos?.[currentRoundName] || '';
  if (!videoUrl) {
    const roundVideoConfig = currentPhaseObj?.roundVideos?.[currentRoundName];
    videoUrl = roundVideoConfig?.videoUrl || currentPhaseObj?.videoUrl || '';
  }

  if (currentPhaseId === 'CLOSING') {
    if (state?.closingSubPhase === 'WINNER') {
      videoUrl = state?.settings?.winnerVideoUrl || videoUrl;
    } else if (state?.settings?.closingVideoUrl) {
      videoUrl = state?.settings?.closingVideoUrl;
    }
  } else if (currentPhaseId === 'WINNER' && state?.settings?.winnerVideoUrl) {
    videoUrl = state.settings.winnerVideoUrl;
  }

  const [showVideoOverlay, setShowVideoOverlay] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState('');
  const [lastVideoKey, setLastVideoKey] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Popular vote widget alternating view state: 'gauge' (gauge/tug of war) vs 'scroll' (scrolling rules)
  const [widgetView, setWidgetView] = useState<'gauge' | 'scroll'>('gauge');

  useEffect(() => {
    const interval = setInterval(() => {
      setWidgetView(prev => prev === 'gauge' ? 'scroll' : 'gauge');
    }, 6000); // Toggle every 6 seconds
    return () => clearInterval(interval);
  }, []);

  // Floating hearts reaction state
  interface FloatingHeart {
    id: string;
    x: number;
    size: number;
    color: string;
    duration: number;
    swayOffset: number;
  }
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);

  // Track total likes to synchronize floating hearts reaction from the webhook
  const lastTotalLikesRef = useRef<number | null>(null);

  // Keydown listener for 'L' to trigger subtle floating hearts and register with popular vote webhook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        const activeEl = document.activeElement as HTMLElement | null;
        if (activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.isContentEditable
        )) {
          return;
        }

        // Determine active team color
        const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
        let activeTeam: 'PRO' | 'CON' | null = null;
        if (speaker) {
          activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
        } else if (state?.currentPhase === 'REBUTTAL') {
          activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
        } else if (state?.currentPhase === 'CHAT_Q') {
          activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
        }

        let heartColor = '';
        if (activeTeam === 'PRO') {
          heartColor = '#3b82f6'; // Blue for Pro Team
        } else if (activeTeam === 'CON') {
          heartColor = '#ef4444'; // Red for Con Team
        } else {
          // Multicolored effect
          const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e'];
          heartColor = colors[Math.floor(Math.random() * colors.length)];
        }

        const id = Math.random().toString(36).substring(2, 9);
        const newHeart: FloatingHeart = {
          id,
          x: Math.random() * 80 + 10, // Starts between 10% and 90% width
          size: Math.random() * 10 + 14, // Subtle size 14px to 24px
          color: heartColor,
          duration: Math.random() * 1.5 + 2.5, // Float duration 2.5s to 4.0s
          swayOffset: Math.random() * 24 - 12, // sway range -12% to +12%
        };

        setHearts(prev => [...prev, newHeart]);

        // Clean up heart after its animation completes
        setTimeout(() => {
          setHearts(prev => prev.filter(h => h.id !== id));
        }, 4500);

        // Advance lastTotalLikesRef immediately to prevent duplicate local rendering on webhook feedback loop
        if (lastTotalLikesRef.current !== null) {
          lastTotalLikesRef.current += 1;
        }

        // Connect L key function with popular vote webhook
        fetch('/webhooks/tikfinity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'L-Key User',
            nickname: 'L-Key Viewer',
            likeCount: 1,
          }),
        }).catch(err => console.error('Failed to trigger popular vote webhook from L key:', err));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [state?.currentSpeakerId, state?.participants, state?.currentPhase, state?.rebuttalRebutterTeam, state?.chatSpeakingTeam]);

  // Sync incoming popular vote changes to spawn hearts for all clients
  useEffect(() => {
    const totalLikes = (state?.popularVotes?.pro ?? 0) + (state?.popularVotes?.con ?? 0);
    
    if (lastTotalLikesRef.current === null) {
      lastTotalLikesRef.current = totalLikes;
      return;
    }

    if (totalLikes > lastTotalLikesRef.current) {
      const diff = totalLikes - lastTotalLikesRef.current;
      lastTotalLikesRef.current = totalLikes;

      const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
      let activeTeam: 'PRO' | 'CON' | null = null;
      if (speaker) {
        activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
      } else if (state?.currentPhase === 'REBUTTAL') {
        activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
      } else if (state?.currentPhase === 'CHAT_Q') {
        activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
      }

      const numHeartsToSpawn = Math.min(diff, 15); // Capped for performance
      const spawnedHearts: FloatingHeart[] = [];

      for (let i = 0; i < numHeartsToSpawn; i++) {
        let heartColor = '';
        if (activeTeam === 'PRO') {
          heartColor = '#3b82f6';
        } else if (activeTeam === 'CON') {
          heartColor = '#ef4444';
        } else {
          const colors = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f43f5e'];
          heartColor = colors[Math.floor(Math.random() * colors.length)];
        }

        const id = Math.random().toString(36).substring(2, 9);
        spawnedHearts.push({
          id,
          x: Math.random() * 80 + 10,
          size: Math.random() * 10 + 14,
          color: heartColor,
          duration: Math.random() * 1.5 + 2.5,
          swayOffset: Math.random() * 24 - 12,
        });

        setTimeout(() => {
          setHearts(prev => prev.filter(h => h.id !== id));
        }, 4500);
      }

      setHearts(prev => [...prev, ...spawnedHearts]);
    } else if (totalLikes < lastTotalLikesRef.current) {
      lastTotalLikesRef.current = totalLikes;
    }
  }, [
    state?.popularVotes?.pro,
    state?.popularVotes?.con,
    state?.participants,
    state?.currentSpeakerId,
    state?.currentPhase,
    state?.rebuttalRebutterTeam,
    state?.chatSpeakingTeam
  ]);

  const currentVideoKey = `${currentPhaseId}_${currentRoundName}_${state?.closingSubPhase || ''}_${state?.declaredWinner || ''}_${videoUrl}`;

  // Reset or trigger video overlay when videoUrl or key changes, or when intro video starts playing
  useEffect(() => {
    if (state?.introVideoPlaying) {
      const introVideoUrl = state?.settings?.openingStatementVideoUrl || state?.settings?.videoUrl || state?.settings?.phases?.find(p => p.id === 'OPENING')?.videoUrl || 'https://assets.totalitytalk.com/videos/lobby_intro.mp4';
      setActiveVideoUrl(introVideoUrl);
      setShowVideoOverlay(true);
      setIsPlaying(true);
      setIsMuted(false);
    } else if (videoUrl) {
      if (currentVideoKey !== lastVideoKey) {
        setLastVideoKey(currentVideoKey);
        setActiveVideoUrl(videoUrl);
        setShowVideoOverlay(true);
        setIsPlaying(true);
        setIsMuted(false); // Load unmuted by default
      }
    } else {
      setShowVideoOverlay(false);
      setActiveVideoUrl('');
    }
  }, [videoUrl, currentVideoKey, lastVideoKey, state?.introVideoPlaying, state?.closingSubPhase, state?.declaredWinner]);

  // Autoplay trigger muted on the stage for instant browser compliance
  useEffect(() => {
    if (showVideoOverlay && activeVideoUrl && videoRef.current) {
      videoRef.current.muted = isMuted;
      videoRef.current.volume = isMuted ? 0 : ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;

      videoRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.warn("Autoplay blocked by browser:", err);
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        });
    }
  }, [showVideoOverlay, activeVideoUrl, isMuted, state?.settings?.bgMusicVolume]);

  // Background music controller
  useEffect(() => {
    const trackUrl = state?.settings?.bgMusicTrack;
    if (!trackUrl) {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
      return;
    }

    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio(trackUrl);
    } else if (bgMusicRef.current.src !== trackUrl) {
      bgMusicRef.current.pause();
      bgMusicRef.current.src = trackUrl;
    }

    const audio = bgMusicRef.current;

    // Pause background music if any video overlay is active to prevent sound overlap
    if (showVideoOverlay) {
      audio.pause();
      return;
    }

    audio.loop = state?.settings?.bgMusicLoop ?? true;
    audio.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;

    // Direct loop fallback to guarantee repeating playback on all browsers
    audio.onended = () => {
      if (state?.settings?.bgMusicLoop ?? true) {
        audio.currentTime = 0;
        audio.play().catch(e => console.warn("Background music failed to loop/play on ended:", e));
      }
    };

    // Try playing immediately
    audio.play()
      .catch((err) => {
        console.warn("Background music autoplay blocked by browser. This is normal until first interaction.", err);
      });

    const handleInteraction = () => {
      if (bgMusicRef.current && !showVideoOverlay) {
        bgMusicRef.current.play()
          .then(() => {
            cleanup();
          })
          .catch((err) => {
            console.warn("Play failed on interaction:", err);
          });
      }
    };

    const events = ['click', 'mousedown', 'touchstart', 'keydown', 'pointerdown'];
    const cleanup = () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });
    };

    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      cleanup();
    };
  }, [state?.settings?.bgMusicTrack, state?.settings?.bgMusicLoop, state?.settings?.bgMusicVolume, showVideoOverlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, []);

  const handleOpeningStatementVideoEnded = () => {
    if (onStateUpdate && state.openingStatementVideoPlayingForParticipantId) {
      const participantId = state.openingStatementVideoPlayingForParticipantId;
      onStateUpdate({
        openingStatementVideoPlayingForParticipantId: null,
        showOpeningStatementPopupForParticipantId: participantId,
        timer: {
          duration: 120,
          timeLeft: 120,
          isRunning: true
        },
        paused: false
      });
    }
  };

  // Handle play/pause toggle
  const togglePlay = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error("Play failed", err);
      });
    }
  };

  // Handle mute toggle
  const toggleMute = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  // Layout loading system: registry mapping phase IDs to their respective display layout components
  const renderActiveLayout = () => {
    switch (currentPhaseId) {
      case 'LOBBY':
        return <LobbyLayout state={state} formatTime={formatTime} />;
      case 'OPENING':
        return <OpeningLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
      case 'CROSS EXAM':
      case 'CROSS_EXAM':
        return <CrossExamLayout state={state} formatTime={formatTime} />;
      case 'REBUTTAL':
      case 'REBUTTAL_OPPOSITION':
      case 'REBUTTAL_AFFIRMATIVE':
        return <RebuttalLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
      case 'CHAT Q':
      case 'CHAT_Q':
        return <ChatQLayout state={state} formatTime={formatTime} />;
      case 'HIGHLIGHT':
      case 'HIGHLIGHTS':
        return <HighlightsLayout state={state} formatTime={formatTime} onStateUpdate={onStateUpdate} />;
      case 'CLOSING':
        if (state.closingSubPhase === 'WINNER') {
          return <WinnerLayout state={state} formatTime={formatTime} />;
        }
        if (state.closingSubPhase === 'CREDITS') {
          return <CreditsLayout state={state} />;
        }
        return <ClosingLayout state={state} formatTime={formatTime} />;
      case 'WINNER':
        return <WinnerLayout state={state} formatTime={formatTime} />;
      case 'CREDITS':
        return <CreditsLayout state={state} />;
      default:
        // Fallback layout in case of un-registered or custom phases
        return (
          <div className="flex flex-col items-center justify-center h-full text-center p-4 border border-dashed border-gray-700/20 rounded-xl bg-gray-500/5">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Default Layout</h2>
            <p className="text-gray-500 mt-1 text-[10px]">Phase: {state.currentPhase || 'Unknown'}</p>
            <div className="mt-2 text-[9px] font-mono bg-[#101114] border border-[#1d1e24] p-2 rounded text-left">
              Timer Left: {formatTime(state.timer.timeLeft)}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#040507] text-[#f3f4f6] font-sans flex flex-col items-center justify-center p-4 overflow-hidden relative">
      {/* Background radial highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-gradient-to-b from-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

      {/* Host Desk Exit button - Only shown when onExit callback is provided (e.g. from Host Desk overlay) */}
      {onExit && (
        <div className="absolute top-4 right-4 z-50">
          <button
            type="button"
            id="stage-exit-btn"
            onClick={onExit}
            className="px-3.5 py-1.5 bg-[#16171d]/90 hover:bg-[#20222b] text-gray-300 hover:text-white border border-[#2d2f39] text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-all shadow-xl backdrop-blur-md"
            title="Exit Stage View"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
            <span>Exit Stage</span>
          </button>
        </div>
      )}

      {/* 8:9 RATIO SCALABLE STAGE CANVAS CONTAINER */}
      <div 
        id="stage-canvas-container"
        className="w-full max-w-[620px] aspect-[8/9] max-h-[85vh] bg-[#07080a] border border-[#1d1e24] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative flex flex-col overflow-hidden select-none"
      >

        {/* TOP STATUS BAR */}
        <div className="h-7 shrink-0 bg-[#07080a] border-b border-[#1d1e24]/30 flex items-center justify-between px-5 z-20 relative">
          <div className="text-[10px] font-mono font-bold text-gray-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>LIVE STAGE PROJECTION</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-gray-500">
            <span className="text-[#f97316] font-bold">8:9 ASPECT</span>
          </div>
        </div>

        {/* ACTIVE STAGE BROADCAST POPUP OVERLAY */}
        <AnimatePresence>
          {(() => {
            const activePopup = state.popupTemplates?.find(p => p.isPlaying);
            if (!activePopup) return null;
            return (
              <motion.div
                key={activePopup.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute top-8 left-3 right-3 z-50 bg-gradient-to-b from-[#181a2d]/95 to-[#0e1017]/95 border-2 border-[#f97316] rounded-2xl p-3.5 shadow-[0_12px_36px_rgba(249,115,22,0.4)] backdrop-blur-md pointer-events-auto"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#2d2f39] pb-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1.5 bg-[#f97316]/20 border border-[#f97316]/40 rounded-lg text-[#f97316] shrink-0">
                      <Megaphone className="w-4 h-4 text-[#f97316] animate-bounce" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">
                        STAGE BROADCAST
                      </span>
                      <span className="text-xs font-black text-white truncate">
                        {activePopup.title}
                      </span>
                    </div>
                  </div>

                  {onStateUpdate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (state.popupTemplates) {
                          const updated = state.popupTemplates.map(p => 
                            p.id === activePopup.id ? { ...p, isPlaying: false } : p
                          );
                          onStateUpdate({ popupTemplates: updated });
                        }
                      }}
                      className="p-1.5 bg-[#20222a] hover:bg-[#2e313e] text-gray-400 hover:text-white rounded-xl transition-all cursor-pointer shrink-0 border border-[#2d2f39]"
                      title="Dismiss Stage Popup"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs font-semibold text-gray-100 leading-relaxed whitespace-pre-wrap max-h-36 overflow-y-auto pr-1 font-sans">
                  {activePopup.text}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* INNER VIEWPORT FOR ACTIVE LAYOUT */}
        <div ref={viewportRef} className="flex-1 h-full w-full overflow-y-auto overflow-x-hidden p-3.5 flex flex-col relative z-10 scrollbar-none">
          {renderActiveLayout()}



          {state.openingStatementVideoPlayingForParticipantId && (() => {
            const videoUrl = state.settings?.openingStatementVideoUrl || '';
            const participant = state.participants?.find(p => p.id === state.openingStatementVideoPlayingForParticipantId);
            return (
              <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center">
                <video
                  src={videoUrl}
                  autoPlay
                  controls
                  playsInline
                  onLoadedMetadata={(e) => {
                    e.currentTarget.volume = ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
                  }}
                  onEnded={handleOpeningStatementVideoEnded}
                  className="w-full h-full object-contain"
                />
                
                {/* Skip / Close Overlay Bar */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <button
                    onClick={handleOpeningStatementVideoEnded}
                    className="px-3.5 py-1.5 bg-black/60 hover:bg-black/80 border border-white/20 rounded-full text-white text-xs font-black tracking-wider uppercase transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>Skip Video</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Subtitle / Participant Badge */}
                {participant && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-center">
                    <div className="text-[9px] font-black tracking-widest text-[#f97316] uppercase">
                      Opening Statement Intro
                    </div>
                    <div className="text-sm font-black text-white mt-0.5">
                      {participant.name}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {state.showOpeningStatementPopupForParticipantId && (() => {
            const participantId = state.showOpeningStatementPopupForParticipantId;
            const popupState = {
              ...state,
              currentSpeakerId: participantId
            };
            return (
              <div className="absolute inset-0 z-30 bg-[#07080a] flex flex-col p-4 overflow-y-auto scrollbar-none animate-none">
                {/* Header inside popup */}
                <div className="flex justify-between items-center border-b border-[#1d1e24] pb-2 mb-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-[#f97316] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 bg-[#ea580c] rounded-full animate-pulse"></span>
                    <span>Opening Statement mode</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onStateUpdate) {
                        onStateUpdate({ showOpeningStatementPopupForParticipantId: null });
                      }
                    }}
                    className="p-1.5 bg-[#16171d] hover:bg-[#20222b] border border-[#2d2f39] rounded-full text-gray-400 hover:text-white transition-all cursor-pointer"
                    title="Close"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 flex flex-col">
                  <OpeningLayout state={popupState} formatTime={formatTime} onStateUpdate={onStateUpdate} />
                </div>
              </div>
            );
          })()}
        </div>

        {/* POPULAR VOTE WIDGET (DRAGGABLE & DYNAMIC MINIMALIST HUD) */}
        {state.showPopularVoteWidget && !(
          state?.introVideoPlaying ||
          state?.openingStatementVideoPlayingForParticipantId ||
          state?.showOpeningStatementPopupForParticipantId
        ) && (() => {
          const proLikes = state?.popularVotes?.pro ?? 0;
          const conLikes = state?.popularVotes?.con ?? 0;
          const totalLikes = proLikes + conLikes;

          const proVotes = Math.floor(proLikes / 100);
          const conVotes = Math.floor(conLikes / 100);
          const totalVotes = proVotes + conVotes;

          // Check which team is active/selected based on current speaker or sub-phases
          const speaker = state?.participants?.find(p => p.id === state?.currentSpeakerId);
          let activeTeam: 'PRO' | 'CON' | null = null;
          if (speaker) {
            activeTeam = speaker.role === 'PROPOSER' ? 'PRO' : 'CON';
          } else if (state?.currentPhase === 'REBUTTAL') {
            activeTeam = state?.rebuttalRebutterTeam === 'PROPOSER' ? 'PRO' : 'CON';
          } else if (state?.currentPhase === 'CHAT_Q') {
            activeTeam = state?.chatSpeakingTeam === 'PROPOSER' ? 'PRO' : 'CON';
          }

          let proPercent = 50;
          let conPercent = 50;
          if (totalVotes > 0) {
            proPercent = Math.round((proVotes / totalVotes) * 100);
            conPercent = 100 - proPercent;
          } else if (totalLikes > 0) {
            proPercent = Math.round((proLikes / totalLikes) * 100);
            conPercent = 100 - proPercent;
          }

          const ropeLength = 10;
          const knotIndex = Math.max(0, Math.min(ropeLength - 1, Math.round((proPercent / 100) * (ropeLength - 1))));
          const leftRope = "━".repeat(knotIndex);
          const rightRope = "━".repeat(ropeLength - 1 - knotIndex);

          return (
            <motion.div
              drag
              dragConstraints={{ left: -50, right: 50, top: -240, bottom: 80 }}
              dragElastic={0.05}
              dragMomentum={false}
              className={`absolute left-1/2 -translate-x-1/2 bottom-3 z-20 w-[215px] select-none cursor-grab active:cursor-grabbing bg-[#090a0f]/90 backdrop-blur-md border rounded-lg p-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.6)] flex flex-col gap-1 transition-all duration-300 ${
                activeTeam === 'PRO'
                  ? 'shadow-[0_0_8px_rgba(59,130,246,0.25)] border-blue-500/40'
                  : activeTeam === 'CON'
                  ? 'shadow-[0_0_8px_rgba(239,68,68,0.25)] border-rose-500/40'
                  : 'border-white/10'
              }`}
              whileHover={{ scale: 1.01 }}
              whileDrag={{ scale: 1.03, cursor: 'grabbing' }}
            >
              {/* Small drag visual handle */}
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white/10 rounded-full" />

              <div className="pt-0.5">
                <AnimatePresence mode="wait">
                  {widgetView === 'gauge' ? (
                    <motion.div
                      key="gauge"
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-1 pointer-events-none"
                    >
                      {/* Votes Display */}
                      <div className="flex items-center justify-between px-0.5 text-[8px] font-black">
                        {/* PRO */}
                        <div className={`flex items-baseline gap-0.5 ${activeTeam === 'PRO' ? 'text-blue-400 font-extrabold scale-[1.02] origin-left' : 'text-blue-400/70'}`}>
                          <span>PRO:</span>
                          <span className="text-white font-mono text-[9px]">{proVotes}V</span>
                          <span className="text-gray-500 font-mono text-[6.5px]">({proLikes})</span>
                        </div>

                        {/* ACTIVE TEAM HIGHLIGHT */}
                        <div className="text-[7px] tracking-widest text-gray-500 font-bold">
                          {activeTeam ? (
                            <span className={`animate-pulse ${activeTeam === 'PRO' ? 'text-blue-400' : 'text-rose-400'}`}>
                              {activeTeam === 'PRO' ? 'LIKE PRO' : 'LIKE CON'}
                            </span>
                          ) : (
                            <span className="text-gray-400">TUG OF WAR</span>
                          )}
                        </div>

                        {/* CON */}
                        <div className={`flex items-baseline gap-0.5 ${activeTeam === 'CON' ? 'text-rose-400 font-extrabold scale-[1.02] origin-right' : 'text-rose-400/70'}`}>
                          <span className="text-gray-500 font-mono text-[6.5px]">({conLikes})</span>
                          <span className="text-white font-mono text-[9px]">{conVotes}V</span>
                          <span>CON:</span>
                        </div>
                      </div>

                      {/* Progress gauge bar */}
                      <div className="h-1 w-full bg-gray-950 rounded-full overflow-hidden flex border border-white/5 relative">
                        <motion.div
                          animate={{ width: `${proPercent}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          className={`h-full bg-gradient-to-r from-blue-600 to-blue-400 ${activeTeam === 'PRO' ? 'brightness-125' : ''}`}
                        />
                        <motion.div
                          animate={{ width: `${conPercent}%` }}
                          transition={{ type: 'spring', stiffness: 100, damping: 15 }}
                          className={`h-full bg-gradient-to-l from-rose-600 to-rose-400 ${activeTeam === 'CON' ? 'brightness-125' : ''}`}
                        />
                        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-black" />
                      </div>

                      {/* Tug of War Text-Rope */}
                      <div className="flex items-center justify-between text-[8px] font-mono bg-black/40 py-0.5 px-1 rounded border border-white/5 gap-1">
                        <span className="text-blue-400 select-none text-[7px]">🔵</span>
                        <span className="text-gray-600 tracking-tight overflow-hidden text-center flex-1 font-mono text-[7px] select-none">
                          {leftRope}📍{rightRope}
                        </span>
                        <span className="text-rose-400 select-none text-[7px]">🔴</span>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="scroll"
                      initial={{ opacity: 0, y: 2 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -2 }}
                      transition={{ duration: 0.15 }}
                      className="flex flex-col gap-0.5 pointer-events-none"
                    >
                      {/* Tiny rule header */}
                      <div className="flex items-center justify-center gap-1 text-[6.5px] font-black text-gray-500 uppercase tracking-widest">
                        <span>⚡ POPULAR VOTE RULES ⚡</span>
                      </div>

                      {/* Marquee Ticker */}
                      <div className="relative flex overflow-x-hidden w-full h-3.5 bg-black/40 rounded border border-white/5 items-center">
                        <motion.div
                          initial={{ x: 0 }}
                          animate={{ x: '-50%' }}
                          transition={{ ease: 'linear', duration: 11, repeat: Infinity }}
                          className="flex whitespace-nowrap text-[6.5px] font-extrabold tracking-wider text-amber-400 uppercase gap-4 pr-4"
                        >
                          <span>100 LIKES = 1 VOTE • EXTRA LIKES STILL COUNT AS 1 VOTE UNTIL NEXT 100! • LIKES: PRO {proLikes} VS CON {conLikes} • LIKE STREAM TO CAST POPULAR VOTE! •</span>
                          <span>100 LIKES = 1 VOTE • EXTRA LIKES STILL COUNT AS 1 VOTE UNTIL NEXT 100! • LIKES: PRO {proLikes} VS CON {conLikes} • LIKE STREAM TO CAST POPULAR VOTE! •</span>
                        </motion.div>
                      </div>

                      {totalLikes === 0 && (
                        <div className="text-[6px] font-bold text-center text-gray-400 mt-0.5 tracking-tight uppercase">
                          Press L or like to reach 100 votes!
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })()}



        {/* MOBILE BOTTOM NAVIGATION INDICATOR */}
        <div className="h-3.5 shrink-0 bg-black flex items-center justify-center pb-1.5 z-20 relative">
          <div className="w-20 h-1 bg-[#1d1e24] rounded-full"></div>
        </div>

        {/* FULLSCREEN MOBILE VIDEO OVERLAY */}
        {showVideoOverlay && activeVideoUrl && (
          <div 
            className="absolute inset-0 z-50 bg-black flex flex-col justify-center items-center rounded-[36px] overflow-hidden pointer-events-none"
          >
            {/* The actual video player */}
            <video
              ref={videoRef}
              src={activeVideoUrl}
              playsInline
              autoPlay
              muted={isMuted}
              onLoadedMetadata={(e) => {
                e.currentTarget.volume = isMuted ? 0 : ((state?.settings?.bgMusicVolume ?? 100) / 100) * 0.5;
              }}
              className="w-full h-full object-cover"
              onEnded={() => {
                setShowVideoOverlay(false);
                if (state?.introVideoPlaying && onStateUpdate) {
                  const openingPhase = state?.settings?.phases?.find(p => p.id === 'OPENING');
                  const duration = openingPhase?.timerLength ?? 120;
                  onStateUpdate({
                    introVideoPlaying: false,
                    currentPhase: 'OPENING',
                    timer: {
                      duration: duration,
                      timeLeft: duration,
                      isRunning: true
                    },
                    paused: false
                  });
                }
              }}
              onError={() => {
                console.error("Video failed to load:", activeVideoUrl);
                setShowVideoOverlay(false);
                if (state?.introVideoPlaying && onStateUpdate) {
                  const openingPhase = state?.settings?.phases?.find(p => p.id === 'OPENING');
                  const duration = openingPhase?.timerLength ?? 120;
                  onStateUpdate({
                    introVideoPlaying: false,
                    currentPhase: 'OPENING',
                    timer: {
                      duration: duration,
                      timeLeft: duration,
                      isRunning: true
                    },
                    paused: false
                  });
                }
              }}
            />

            {/* Bottom HUD bar */}
            <div 
              className="absolute bottom-6 left-4 right-4 flex items-center justify-between bg-black/80 p-3 rounded-2xl border border-white/10 backdrop-blur-md pointer-events-auto"
            >
              <div className="flex flex-col text-left">
                <span className="text-[9px] font-mono font-black tracking-wider text-white uppercase">
                  {currentPhaseId === 'WINNER' || state?.closingSubPhase === 'WINNER' ? 'Winner Announcement' : (currentPhaseObj?.name || 'Phase Transition')}
                </span>
                <span className="text-[8px] font-mono text-gray-400">Playing: {currentRoundName} Video</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title={isMuted ? "Unmute Audio" : "Mute Audio"}
                >
                  {isMuted ? <VolumeX className="w-3 h-3 text-yellow-400" /> : <Volume2 className="w-3 h-3 text-emerald-400" />}
                  <span>{isMuted ? 'Muted' : 'Sound On'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating hearts reaction overlay */}
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {hearts.map(heart => (
            <motion.div
              key={heart.id}
              initial={{ y: '100%', x: `${heart.x}%`, opacity: 0, scale: 0.5 }}
              animate={{
                y: -100,
                opacity: [0, 0.95, 0.95, 0],
                scale: [0.5, 1, 1, 0.7],
                x: [
                  `${heart.x}%`,
                  `${heart.x + heart.swayOffset}%`,
                  `${heart.x - heart.swayOffset}%`,
                  `${heart.x + heart.swayOffset / 2}%`
                ]
              }}
              transition={{
                duration: heart.duration,
                ease: "easeOut"
              }}
              style={{
                position: 'absolute',
                width: heart.size,
                height: heart.size,
                color: heart.color,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-full h-full drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </motion.div>
          ))}
        </div>

      </div>

      {/* Floating Meta Tag below the stage frame */}
      <span className="text-[9px] text-[#475569] font-mono tracking-[0.2em] uppercase mt-3">
        Stage Projection View · 8:9 Aspect Ratio
      </span>
    </div>
  );
}
