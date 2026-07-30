import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Mic, Sparkles, Trophy, MessageSquare,
  Radio, Settings, Layers, FileText, Brain, ShieldAlert, Award, Bot, Image as ImageIcon
} from 'lucide-react';

interface CollapsibleHostSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  state: any;
  onOpenImageBotSettings?: () => void;
  className?: string;
}

export const CollapsibleHostSidebar: React.FC<CollapsibleHostSidebarProps> = ({
  activeTab,
  setActiveTab,
  state,
  onOpenImageBotSettings,
  className = ''
}) => {
  // Load saved sidebar state from localStorage if available
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('host_desk_sidebar_collapsed');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('host_desk_sidebar_collapsed', JSON.stringify(next));
    }
  };

  const navItems = [
    {
      id: 'live',
      label: 'Live Host Desk',
      icon: Radio,
      badge: state?.currentPhase || 'LOBBY',
      badgeColor: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30',
    },
    {
      id: 'transcription',
      label: 'AI Transcription Bot',
      icon: Brain,
      badge: (state?.transcriptionSession?.transcripts || []).length.toString(),
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    },
    {
      id: 'claims',
      label: 'Claims & Evidence',
      icon: Sparkles,
      badge: (state?.formalClaims || []).length.toString(),
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    },
    {
      id: 'score',
      label: 'Scorecard & Penalties',
      icon: Trophy,
      badge: `${state?.scores?.proScore || 100} - ${state?.scores?.conScore || 100}`,
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    },
    {
      id: 'chat',
      label: 'Viewer Chat Questions',
      icon: MessageSquare,
      badge: (state?.chatQuestions || []).filter((q: any) => q.status === 'pending').length.toString(),
      badgeColor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    },
  ];

  if (state?.currentPhase === 'HIGHLIGHT') {
    navItems.push({
      id: 'highlights',
      label: 'Highlights',
      icon: Sparkles,
      badge: (state?.highlightSlides || []).length.toString(),
      badgeColor: 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30',
    });
  }

  return (
    <aside
      className={`bg-[#0d0e12] border-r border-[#1d1e24] transition-all duration-300 flex flex-col shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      } ${className}`}
    >
      {/* SIDEBAR HEADER */}
      <div className="p-3.5 border-b border-[#1d1e24] flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse"></div>
            <span className="text-xs font-black text-white tracking-wider uppercase">HOST DESK NAV</span>
          </div>
        )}
        <button
          onClick={toggleCollapse}
          className="p-1.5 bg-[#16171d] hover:bg-[#2d2f39] text-gray-400 hover:text-white rounded-lg border border-[#2d2f39] cursor-pointer transition-colors mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* NAVIGATION ITEMS */}
      <nav className="p-2 flex-1 flex flex-col gap-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                isActive
                  ? 'bg-[#16171d] text-white border-[#f97316] shadow-lg shadow-[#f97316]/10'
                  : 'text-[#94a3b8] hover:text-white border-transparent hover:bg-[#16171d]/50'
              } ${isCollapsed ? 'justify-center px-0' : ''}`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#f97316]' : 'text-gray-400'}`} />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${item.badgeColor} ml-1 shrink-0`}>
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {onOpenImageBotSettings && (
          <button
            onClick={onOpenImageBotSettings}
            className={`w-full mt-2 flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-[#f97316]/10 hover:bg-[#f97316]/20 text-[#f97316] border-[#f97316]/30 shadow-sm ${
              isCollapsed ? 'justify-center px-0' : ''
            }`}
            title="AI Image Bots Configuration"
          >
            <Bot className="w-4 h-4 shrink-0 text-[#f97316]" />
            {!isCollapsed && (
              <div className="flex-1 flex items-center justify-between min-w-0">
                <span className="truncate">3 AI Image Bots</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#f97316]/20 text-white ml-1 shrink-0">
                  Settings
                </span>
              </div>
            )}
          </button>
        )}
      </nav>

      {/* FOOTER MINI SUMMARY */}
      {!isCollapsed && (
        <div className="p-3 border-t border-[#1d1e24] bg-[#0a0b0d] flex flex-col gap-1 text-[10px] text-gray-500">
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-400">Debate Round</span>
            <span className="text-white font-mono font-bold">{state?.currentRound || 'Round 1'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-400">Active Phase</span>
            <span className="text-[#f97316] font-mono font-bold uppercase">{state?.currentPhase || 'LOBBY'}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
