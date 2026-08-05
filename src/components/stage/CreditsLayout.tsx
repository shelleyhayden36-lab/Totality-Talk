import React, { useEffect, useState, useRef } from 'react';
import { DebateState } from '../../App';
import { Sparkles, Heart } from 'lucide-react';

interface LayoutProps {
  state: DebateState;
}

export default function CreditsLayout({ state }: LayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Default permanent credits
  const pc = state.settings.permanentCredits || {
    creatorHost: 'Postatoe',
    mods: ['Mod Sarah', 'Mod David'],
    recurringTeam: ['Production Designer', 'Technical Lead']
  };

  // Live Credits calculation
  const judgesList = (state.settings.judgeAccounts || [])
    .filter(j => j.isActive !== false)
    .map(j => j.nickname || j.username);

  const panelistsList = (state.participants || [])
    .filter(p => p.role === 'PROPOSER' || p.role === 'CONTRARY')
    .map(p => p.name);

  // Gift supporters: collect unique usernames/nicknames of gift senders
  const giftSupporters = Array.from(
    new Set(
      (state.tikfinityEvents || [])
        .filter(ev => ev.type === 'gift')
        .map(ev => ev.nickname || ev.username)
    )
  );

  // Audience questions: approved question authors
  const questionContributors = Array.from(
    new Set(
      (state.chatQuestions || [])
        .filter(q => q.status === 'approved')
        .map(q => q.author)
    )
  );

  // Smooth scroll effect
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let animationId: number;
    const startTime = Date.now();
    
    const animate = () => {
      if (scrollRef.current && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const scrollHeight = scrollRef.current.scrollHeight;
        
        // Speed: 30 pixels per second
        const elapsed = (Date.now() - startTime) / 1000;
        const distance = elapsed * 30;
        
        if (distance > scrollHeight + containerHeight) {
          // Loop back
          setScrollY(0);
        } else {
          setScrollY(distance);
        }
      }
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="flex flex-col w-full h-full text-left select-none p-5 relative bg-[#07080a] overflow-hidden text-white"
    >
      {/* HEADER SECTION (Matches other layout titles exactly) */}
      <div className="flex flex-col shrink-0 z-20">
        {/* TRUTH · RESPECT · PERSPECTIVE Slogan */}
        <div className="text-[9.5px] font-black tracking-[0.2em] uppercase max-w-[65%]">
          <span className="text-gray-400">TRUTH · RESPECT · </span>
          <span className="text-[#f97316]">PERSPECTIVE</span>
        </div>

        {/* Large display titles */}
        <div className="flex flex-col mt-2 space-y-0.5">
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-none uppercase">
            THANKS FOR
          </h1>
          <h1 className="text-2xl md:text-3xl font-black text-[#f97316] tracking-tight leading-none uppercase">
            WATCHING
          </h1>
        </div>

        {/* Subtitle */}
        <span className="text-[9.5px] font-bold text-gray-500 tracking-[0.15em] uppercase mt-1.5 block">
          TOTALITY TALK
        </span>

        {/* Custom Horizontal Divider */}
        <div className="w-full border-b border-gray-800/40 mt-3" />
      </div>

      {/* SCROLLING ZONE: Container with mask to fade out edges */}
      <div className="flex-1 relative overflow-hidden mt-2 z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-[#07080a] via-transparent to-[#07080a] z-20 pointer-events-none h-6" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#07080a] via-transparent to-transparent z-20 pointer-events-none h-12" />

        {/* Scrollable Credit Elements Container */}
        <div 
          ref={scrollRef}
          style={{ transform: `translateY(${-scrollY + 350}px)` }}
          className="w-full max-w-lg flex flex-col gap-8 mx-auto text-center transition-transform duration-75 ease-linear pb-32"
        >
          {/* Main Brand Header inside credits */}
          <div className="flex flex-col items-center gap-1.5 mb-1">
            <Sparkles className="w-7 h-7 text-[#f97316] animate-pulse" />
            <h2 className="text-2xl font-black text-white uppercase tracking-wider">Totality Talk</h2>
            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">A Modern Arena for Open Discourse</p>
          </div>

          {/* Section 1: Host */}
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] text-[#f97316] font-black uppercase tracking-widest">Creator / Host</span>
            <span className="text-base font-bold text-white tracking-tight">{pc.creatorHost || 'Postatoe'}</span>
          </div>

          {/* Section 2: Moderation Team */}
          {pc.mods && pc.mods.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Moderators</span>
              <div className="flex flex-col gap-0.5">
                {pc.mods.map((m, i) => (
                  <span key={i} className="text-xs font-semibold text-gray-300">{m}</span>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Recurring Team Members */}
          {pc.recurringTeam && pc.recurringTeam.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Monthly Supporters</span>
              <div className="flex flex-col gap-0.5">
                {pc.recurringTeam.map((t, i) => (
                  <span key={i} className="text-xs font-semibold text-gray-300">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* --- LIVE CREDITS --- */}
          <div className="border-t border-gray-900 my-1 max-w-[120px] mx-auto w-full" />

          {/* Section 4: Active Judges */}
          {judgesList.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#f97316] font-black uppercase tracking-widest">Debate Judges</span>
              <div className="flex flex-col gap-0.5">
                {judgesList.map((j, i) => (
                  <span key={i} className="text-xs font-bold text-white">@{j}</span>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Panelists Who Spoke */}
          {panelistsList.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-[#f97316] font-black uppercase tracking-widest">Debate Panelists</span>
              <div className="flex flex-col gap-0.5">
                {panelistsList.map((p, i) => (
                  <span key={i} className="text-xs font-bold text-white">{p}</span>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Gift Supporters */}
          {giftSupporters.length > 0 && (
            <div className="flex flex-col gap-1.5 items-center">
              <span className="text-[9px] text-pink-500 font-black uppercase tracking-widest flex items-center gap-1">
                <Heart className="w-3 fill-pink-500 text-pink-500 animate-pulse" />
                <span>Gift Supporters</span>
              </span>
              <div className="flex flex-wrap items-center justify-center gap-1 max-w-xs">
                {giftSupporters.map((g, i) => (
                  <span key={i} className="text-[10px] font-bold text-gray-300 bg-pink-500/10 border border-pink-500/20 px-2 py-0.5 rounded-full">
                    @{g}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Section 7: Audience Questions */}
          {questionContributors.length > 0 && (
            <div className="flex flex-col gap-1.5 items-center">
              <span className="text-[9px] text-cyan-400 font-black uppercase tracking-widest">Audience Contributors</span>
              <div className="flex flex-wrap items-center justify-center gap-1 max-w-xs">
                {questionContributors.map((q, i) => (
                  <span key={i} className="text-[10px] font-bold text-gray-300 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Closing Thank You */}
          <div className="flex flex-col gap-1 mt-4 pb-20">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Special Thanks to All Viewers</p>
            <p className="text-[9px] text-gray-600 font-bold uppercase">See you in the next debate!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
