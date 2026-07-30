import React, { useState, useEffect } from 'react';
import {
  Bookmark,
  Calendar,
  Users,
  FileText,
  HelpCircle,
  Gift,
  Trophy,
  Trash2,
  X,
  ChevronRight,
  Edit2,
  Check,
  Search,
  Eye,
  Share2,
  Copy,
  Terminal,
  Shield,
  Activity,
  Radio,
  Cpu,
  Layers,
  Zap,
  ExternalLink,
  RefreshCw,
  Filter,
  MessageSquare,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Lock,
  ShieldCheck
} from 'lucide-react';
import { DebateState } from '../App';

interface SavedDebatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DebateState;
  onStateUpdate: (updatedState: Partial<DebateState>) => void;
  initialArchiveId?: string | null;
  canDelete?: boolean;
}

export default function SavedDebatesModal({
  isOpen,
  onClose,
  state,
  onStateUpdate,
  initialArchiveId,
  canDelete = false
}: SavedDebatesModalProps) {
  // Navigation mode: 'archived' or 'live'
  const [activeTab, setActiveTab] = useState<'archived' | 'live'>('archived');
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Detail sub-view for Claims/Evidence vs Panelists vs Questions
  const [detailTab, setDetailTab] = useState<'claims' | 'panelists' | 'questions' | 'gifters'>('claims');
  const [teamFilter, setTeamFilter] = useState<'ALL' | 'PROPOSER' | 'CONTRARY'>('ALL');

  const savedList = state?.savedDebates || [];

  // Auto-select archive if initialArchiveId is passed or set in URL
  useEffect(() => {
    if (isOpen) {
      if (initialArchiveId) {
        const found = savedList.find(r => r.id === initialArchiveId);
        if (found) {
          setSelectedRecord(found);
          setActiveTab('archived');
        }
      } else if (!selectedRecord && savedList.length > 0) {
        setSelectedRecord(savedList[0]);
      }
    }
  }, [isOpen, initialArchiveId, savedList]);

  // Sync URL when selected record changes
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeTab === 'live') {
        url.searchParams.set('view', 'archives');
        url.searchParams.set('tab', 'live');
        url.searchParams.delete('archive');
      } else if (selectedRecord) {
        url.searchParams.set('view', 'archives');
        url.searchParams.set('archive', selectedRecord.id);
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('view', 'archives');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [isOpen, activeTab, selectedRecord]);

  if (!isOpen) return null;

  const filteredList = savedList.filter(record => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (record.label || '').toLowerCase().includes(q) ||
      (record.debateTopic || '').toLowerCase().includes(q) ||
      (record.id || '').toLowerCase().includes(q)
    );
  });

  const handleUpdateLabel = async (id: string, newLabel: string) => {
    if (!canDelete) {
      alert('Label edits are restricted. Archives can only be modified from the Host Control Board.');
      return;
    }
    if (!newLabel.trim()) return;
    const updated = savedList.map(item => {
      if (item.id === id) {
        return { ...item, label: newLabel.trim() };
      }
      return item;
    });

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedDebates: updated })
      });
      const data = await res.json();
      if (data) onStateUpdate(data);
    } catch (err) {
      console.error('Failed to update saved debate label:', err);
    }
    setEditingId(null);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!canDelete) {
      alert('Deletion restricted: Archives can only be deleted directly through the Host Control Board.');
      return;
    }
    if (!confirm('Are you sure you want to delete this debate archive file?')) return;
    const updated = savedList.filter(item => item.id !== id);

    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedDebates: updated })
      });
      const data = await res.json();
      if (data) onStateUpdate(data);
      if (selectedRecord?.id === id) setSelectedRecord(updated[0] || null);
    } catch (err) {
      console.error('Failed to delete saved debate record:', err);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyToast(`copied: ${label}`);
    setTimeout(() => setCopyToast(null), 3500);
  };

  const getShareableUrl = (recordId?: string) => {
    if (typeof window === 'undefined') return '';
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    if (recordId) {
      return `${origin}${pathname}?view=archives&archive=${recordId}`;
    }
    return `${origin}${pathname}?view=archives&tab=live`;
  };

  // Live Debate Data Extraction
  const liveTopic = state?.settings?.debateTopic || 'Untitled Active Debate';
  const liveRound = state?.currentRound || 'Round 1';
  const livePhase = state?.currentPhase || 'LOBBY';
  const liveProScore = state?.scores?.proScore || 0;
  const liveConScore = state?.scores?.conScore || 0;
  const liveFormalClaims = state?.formalClaims || [];
  const liveClaims = state?.claims || [];
  const liveEvidence = state?.evidenceList || [];
  const liveCounterClaims = state?.counterClaims || [];
  const livePanelists = state?.participants || [];
  const liveQuestions = state?.chatQuestions || [];
  const liveGifters = state?.tikfinityEvents || [];
  const isLiveOngoing = livePhase !== 'LOBBY' || liveFormalClaims.length > 0 || liveClaims.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 animate-fadeIn font-mono">
      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed top-6 right-6 z-50 bg-[#00f0ff]/10 border border-[#00f0ff] text-[#00f0ff] px-4 py-2.5 rounded-lg shadow-[0_0_20px_rgba(0,240,255,0.3)] flex items-center gap-2 text-xs uppercase tracking-widest font-extrabold animate-bounce">
          <Zap className="w-4 h-4 text-[#00f0ff] shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Main Container - Sci-Fi Terminal Window */}
      <div className="relative w-full max-w-6xl bg-[#07090e] border border-[#00f0ff]/30 rounded-xl shadow-[0_0_50px_rgba(0,240,255,0.15)] overflow-hidden flex flex-col h-[90vh] text-gray-200">
        
        {/* Decorative Grid Lines Overlay & HUD Corner Brackets */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00f0ff08_1px,transparent_1px),linear-gradient(to_bottom,#00f0ff08_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-2 left-2 text-[9px] text-[#00f0ff]/40 pointer-events-none select-none font-mono">┌── CYBER_FILE_SYSTEM ──┐</div>
        <div className="absolute top-2 right-2 text-[9px] text-[#00f0ff]/40 pointer-events-none select-none font-mono">└── SYSTEM_CORE_v4.0 ──┘</div>

        {/* Sci-Fi Top Navigation Header */}
        <div className="relative flex flex-wrap items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#00f0ff]/20 bg-[#0a0d16]/90 shrink-0 gap-3 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/40 flex items-center justify-center text-[#00f0ff] shadow-[0_0_12px_rgba(0,240,255,0.3)]">
              <Cpu className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-[#00f0ff]" />
                  <span>NEURAL DEBATE VAULT</span>
                </h3>
                {canDelete ? (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold tracking-widest uppercase">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>HOST MANAGEMENT (DELETION PERMITTED)</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 text-[9px] font-bold tracking-widest uppercase">
                    <Lock className="w-3 h-3 text-[#00f0ff]" />
                    <span>READ-ONLY VAULT (DELETION RESTRICTED TO HOST BOARD)</span>
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>STATUS: SECURE_SYNC</span>
                <span className="text-[#00f0ff]/50">|</span>
                <span className="text-gray-400 hidden sm:inline">QUANTUM_DEBATE_ARCHIVE</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#05070a] p-1 rounded-lg border border-[#00f0ff]/20">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'live'
                  ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.5)] font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#0d121f]'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${activeTab === 'live' ? 'animate-pulse' : 'text-emerald-400'}`} />
              <span>LIVE FEED</span>
              {isLiveOngoing && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('archived')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-[#00f0ff] text-black shadow-[0_0_15px_rgba(0,240,255,0.5)] font-bold'
                  : 'text-gray-400 hover:text-white hover:bg-[#0d121f]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>ARCHIVES ({savedList.length})</span>
            </button>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg border border-transparent hover:border-red-500/30 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="relative flex flex-1 overflow-hidden z-10">
          
          {/* Left Column: Explorer / Selector (Show when in 'archived' mode or on mobile sidebar) */}
          {activeTab === 'archived' && (
            <div className={`flex flex-col border-r border-[#00f0ff]/20 bg-[#05070c] ${selectedRecord ? 'w-full md:w-80 lg:w-96 hidden md:flex' : 'w-full'}`}>
              
              {/* Search Header */}
              <div className="p-3 border-b border-[#00f0ff]/20 bg-[#0a0d16]">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#00f0ff] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="QUERY_FILE_INDEX..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#05070a] border border-[#00f0ff]/30 text-xs text-[#00f0ff] placeholder-[#00f0ff]/40 pl-8 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_10px_rgba(0,240,255,0.3)] font-mono"
                  />
                </div>
                
                <div className="flex items-center justify-between text-[9px] text-[#00f0ff]/60 mt-2 px-1 font-mono uppercase tracking-widest">
                  <span>FILES FOUND: {filteredList.length}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(getShareableUrl(), 'Vault Direct Link')}
                    className="hover:text-[#00f0ff] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Copy Vault General URL"
                  >
                    <Share2 className="w-3 h-3" />
                    <span>SHARE VAULT</span>
                  </button>
                </div>
              </div>

              {/* Archived Debate File Cards */}
              <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
                {filteredList.length === 0 ? (
                  <div className="text-center py-12 flex flex-col items-center justify-center gap-2">
                    <Bookmark className="w-10 h-10 text-gray-600 mb-1" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">NO DEBATE FILES RECORDED</span>
                    <p className="text-[10px] text-gray-500 max-w-xs font-mono">
                      When resetting a debate session, choose "Save Debate Session to Archive" to commit records into this neural vault.
                    </p>
                  </div>
                ) : (
                  filteredList.map((record, index) => {
                    const isSelected = selectedRecord?.id === record.id;
                    const isEditing = editingId === record.id;
                    const formattedDate = new Date(record.timestamp || Date.now()).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const fileCode = `FILE_0X${(index + 1).toString(16).padStart(2, '0').toUpperCase()}`;

                    return (
                      <div
                        key={record.id}
                        onClick={() => setSelectedRecord(record)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative overflow-hidden group ${
                          isSelected
                            ? 'bg-[#0d1424] border-[#00f0ff] shadow-[0_0_20px_rgba(0,240,255,0.2)]'
                            : 'bg-[#0a0d16] border-[#00f0ff]/20 hover:border-[#00f0ff]/60 hover:bg-[#0c101c]'
                        }`}
                      >
                        {/* Selected Hologram Accent Line */}
                        {isSelected && (
                          <div className="absolute top-0 left-0 bottom-0 w-1 bg-[#00f0ff] shadow-[0_0_10px_#00f0ff]" />
                        )}

                        {/* File Header Code & Controls */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[9px] font-black text-[#00f0ff] tracking-widest uppercase flex items-center gap-1 font-mono">
                            <Layers className="w-3 h-3" />
                            <span>{fileCode}</span>
                          </span>

                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {/* Copy Link Button */}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(getShareableUrl(record.id), 'Debate URL')}
                              className="text-gray-400 hover:text-[#00f0ff] p-1 rounded hover:bg-[#00f0ff]/10 transition-colors cursor-pointer"
                              title="Copy Direct URL for this Debate Archive"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Button - Host Board Only */}
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(record.id)}
                                className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors cursor-pointer"
                                title="Delete Archive File (Host Authorized)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="p-1 text-gray-600 cursor-not-allowed" title="Deletion restricted to Host Board">
                                <Lock className="w-3 h-3 text-gray-600" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title Label Row */}
                        {isEditing && canDelete ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingLabel}
                              onChange={(e) => setEditingLabel(e.target.value)}
                              className="flex-1 bg-[#05070a] border border-[#00f0ff] text-xs text-white px-2 py-1 rounded focus:outline-none font-mono"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateLabel(record.id, editingLabel)}
                              className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-xs font-extrabold text-white truncate font-sans tracking-wide">
                              {record.label}
                            </h4>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingId(record.id);
                                  setEditingLabel(record.label);
                                }}
                                className="text-gray-500 hover:text-[#00f0ff] p-0.5 cursor-pointer"
                                title="Edit Label"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Topic Subtitle */}
                        <p className="text-[10px] text-gray-400 truncate font-mono">
                          TOPIC: <span className="text-gray-200">{record.debateTopic || 'Untitled Session'}</span>
                        </p>

                        {/* Footer details */}
                        <div className="flex items-center justify-between text-[9px] text-gray-400 pt-1.5 border-t border-[#00f0ff]/10 font-mono">
                          <span className="flex items-center gap-1 text-gray-400">
                            <Calendar className="w-3 h-3 text-[#00f0ff]" />
                            <span>{formattedDate}</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <span className="text-[#00f0ff] font-bold">
                              P:{(record.panelists || []).length} | C:{(record.formalClaims || []).length + (record.claims || []).length}
                            </span>
                            {record.declaredWinner && (
                              <span className={`px-1.5 py-0.5 rounded font-black text-[8px] uppercase ${
                                record.declaredWinner === 'PROPOSER'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
                              }`}>
                                {record.declaredWinner === 'PROPOSER' ? 'PRO WIN' : 'CON WIN'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Right Column: Quantum Data Display (Shows Live or Selected Archived Record) */}
          <div className="flex-1 bg-[#07090e] flex flex-col overflow-y-auto p-4 sm:p-6 gap-5">
            
            {/* MODE A: LIVE ONGOING DEBATE VIEW */}
            {activeTab === 'live' && (
              <div className="flex flex-col gap-5">
                
                {/* Live Banner Card */}
                <div className="relative bg-[#0c111d] border border-[#00f0ff]/40 rounded-2xl p-5 overflow-hidden shadow-[0_0_30px_rgba(0,240,255,0.1)]">
                  <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500/20 border-b border-l border-emerald-500/40 rounded-bl-xl text-emerald-400 text-[9px] font-black tracking-widest uppercase flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>REAL-TIME STREAM ONLINE</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-[#00f0ff] tracking-widest uppercase flex items-center gap-1.5 font-mono">
                      <Radio className="w-3.5 h-3.5 text-[#00f0ff] animate-pulse" />
                      <span>ONGOING DEBATE VAULT MONITOR</span>
                    </span>
                    <h2 className="text-base sm:text-lg font-black text-white tracking-wide font-sans">
                      {liveTopic}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300 font-mono mt-1">
                      <span className="px-2.5 py-1 rounded bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 font-extrabold uppercase">
                        {liveRound}
                      </span>
                      <span className="px-2.5 py-1 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-extrabold uppercase">
                        PHASE: {livePhase}
                      </span>
                      
                      {/* Copy Live Share Link */}
                      <button
                        type="button"
                        onClick={() => copyToClipboard(getShareableUrl(), 'Live Debate URL')}
                        className="ml-auto px-3 py-1 rounded-lg bg-[#00f0ff]/20 hover:bg-[#00f0ff] hover:text-black text-[#00f0ff] border border-[#00f0ff]/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>COPY LIVE LINK</span>
                      </button>
                    </div>
                  </div>

                  {/* Live Score Tally Meter */}
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#00f0ff]/20">
                    <div className="bg-[#05070a] border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider font-mono">PROPOSER SCORE</span>
                        <span className="text-2xl font-black text-white">{liveProScore}</span>
                      </div>
                      <Shield className="w-7 h-7 text-emerald-400/40" />
                    </div>

                    <div className="bg-[#05070a] border border-red-500/30 p-3 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-wider font-mono">CONTRARY SCORE</span>
                        <span className="text-2xl font-black text-white">{liveConScore}</span>
                      </div>
                      <Shield className="w-7 h-7 text-red-400/40" />
                    </div>
                  </div>
                </div>

                {/* Sub-tab Navigation for Live Data */}
                <div className="flex items-center gap-2 border-b border-[#00f0ff]/20 pb-2 overflow-x-auto font-mono">
                  <button
                    type="button"
                    onClick={() => setDetailTab('claims')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      detailTab === 'claims'
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                        : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Claims & Evidence ({liveFormalClaims.length + liveClaims.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailTab('panelists')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      detailTab === 'panelists'
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                        : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Panelists ({livePanelists.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailTab('questions')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      detailTab === 'questions'
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                        : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Questions ({liveQuestions.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDetailTab('gifters')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      detailTab === 'gifters'
                        ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                        : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                    }`}
                  >
                    <Gift className="w-3.5 h-3.5" />
                    <span>Gifters Log ({liveGifters.length})</span>
                  </button>
                </div>

                {/* Sub-tab Content: Live Claims & Evidence */}
                {detailTab === 'claims' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-[#00f0ff] uppercase tracking-wider">LIVE CLAIMS & EVIDENCE LOG</span>
                      
                      {/* Team Filter */}
                      <div className="flex items-center gap-1 bg-[#05070a] p-1 rounded-lg border border-[#00f0ff]/20 text-[9px]">
                        <button
                          type="button"
                          onClick={() => setTeamFilter('ALL')}
                          className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'ALL' ? 'bg-[#00f0ff] text-black' : 'text-gray-400'}`}
                        >
                          ALL
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamFilter('PROPOSER')}
                          className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'PROPOSER' ? 'bg-emerald-500 text-black' : 'text-emerald-400'}`}
                        >
                          PRO
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamFilter('CONTRARY')}
                          className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'CONTRARY' ? 'bg-red-500 text-black' : 'text-red-400'}`}
                        >
                          CON
                        </button>
                      </div>
                    </div>

                    {liveFormalClaims.length === 0 && liveClaims.length === 0 ? (
                      <div className="p-8 border border-dashed border-[#00f0ff]/20 rounded-xl text-center flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-gray-600" />
                        <span className="text-xs font-bold text-gray-400">NO LIVE CLAIMS SUBMITTED YET</span>
                        <p className="text-[10px] text-gray-500 max-w-sm">
                          Claims and evidence submitted during live rounds will populate here in real-time.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Formal Claims List */}
                        {liveFormalClaims
                          .filter(fc => teamFilter === 'ALL' || fc.team === teamFilter)
                          .map((fc, idx) => {
                            // Find evidence linked to this claim
                            const linkedEv = liveEvidence.filter(ev => ev.claimId === fc.claimId);
                            const linkedCounter = liveCounterClaims.filter(cc => cc.claimId === fc.claimId);

                            return (
                              <div
                                key={fc.claimId || idx}
                                className="bg-[#0a0d16] border border-[#00f0ff]/30 p-4 rounded-xl flex flex-col gap-2.5 shadow-md"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                                      fc.team === 'PROPOSER' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                    }`}>
                                      {fc.team}
                                    </span>
                                    <span className="text-xs font-bold text-white">{fc.speaker || 'Panelist'}</span>
                                  </div>
                                  <span className="text-[9px] text-[#00f0ff] uppercase bg-[#00f0ff]/10 px-2 py-0.5 rounded border border-[#00f0ff]/30 font-mono">
                                    {fc.phase || 'LIVE CLAIM'}
                                  </span>
                                </div>

                                <p className="text-xs text-gray-200 font-sans leading-relaxed font-medium">
                                  "{fc.claimText}"
                                </p>

                                {/* Linked Evidence */}
                                {linkedEv.length > 0 && (
                                  <div className="mt-1 pt-2 border-t border-[#00f0ff]/10 flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black text-[#00f0ff] uppercase tracking-wider flex items-center gap-1">
                                      <Zap className="w-3 h-3" />
                                      <span>SUPPORTING EVIDENCE ({linkedEv.length})</span>
                                    </span>
                                    {linkedEv.map((ev, eIdx) => (
                                      <div key={eIdx} className="bg-[#05070a] border border-[#00f0ff]/20 p-2.5 rounded-lg text-[11px] flex flex-col gap-1 font-sans">
                                        <div className="flex items-center justify-between text-[9px] font-mono text-gray-400">
                                          <span>BY: {ev.submittedBy || 'Panelist'}</span>
                                          {ev.source && <span className="text-[#00f0ff] underline truncate max-w-[180px]">{ev.source}</span>}
                                        </div>
                                        <p className="text-gray-300">{ev.evidenceText}</p>
                                        
                                        {/* AI Rating badge if evaluated */}
                                        {ev.aiJudgeResult && (
                                          <div className="mt-1 p-1.5 rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[9px] font-mono flex items-center justify-between text-[#00f0ff]">
                                            <span>AI VALIDATION: {ev.aiJudgeResult.evidence_rating}</span>
                                            <span>SCORE: {ev.aiJudgeResult.final_score}/10</span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Linked Counterclaims */}
                                {linkedCounter.length > 0 && (
                                  <div className="mt-1 pt-2 border-t border-red-500/20 flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      <span>REBUTTALS & COUNTERCLAIMS ({linkedCounter.length})</span>
                                    </span>
                                    {linkedCounter.map((cc, cIdx) => (
                                      <div key={cIdx} className="bg-[#05070a] border border-red-500/30 p-2.5 rounded-lg text-[11px] text-gray-300 font-sans">
                                        <span className="text-[9px] text-red-400 font-bold block mb-0.5">REBUTTER: {cc.rebutterId}</span>
                                        <p>{cc.counterText}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Sub-tab Content: Live Panelists */}
                {detailTab === 'panelists' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {livePanelists.map((p, idx) => (
                      <div key={idx} className="bg-[#0a0d16] border border-[#00f0ff]/30 p-3.5 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm ${
                            p.role === 'PROPOSER' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          }`}>
                            {p.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">{p.name}</h4>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {p.role} {p.isSeated ? '• SEATED' : ''}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-black text-[#00f0ff] font-mono">
                          {p.score} PTS
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sub-tab Content: Live Questions */}
                {detailTab === 'questions' && (
                  <div className="flex flex-col gap-2">
                    {liveQuestions.length === 0 ? (
                      <span className="text-xs text-gray-500 font-mono italic p-4 text-center">No questions in queue.</span>
                    ) : (
                      liveQuestions.map((q, idx) => (
                        <div key={idx} className="bg-[#0a0d16] border border-[#00f0ff]/20 p-3 rounded-xl flex items-center justify-between gap-3 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-[#00f0ff] font-bold">{q.author || 'AUDIENCE_USER'}</span>
                            <p className="text-gray-200 font-sans">{q.text}</p>
                          </div>
                          <span className="px-2 py-1 rounded bg-[#00f0ff]/10 text-[#00f0ff] font-mono font-bold text-[10px]">
                            {q.votes || 0} VOTES
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Sub-tab Content: Gifters Log */}
                {detailTab === 'gifters' && (
                  <div className="flex flex-wrap gap-2">
                    {liveGifters.length === 0 ? (
                      <span className="text-xs text-gray-500 font-mono italic p-4 text-center">No gift events logged in current session.</span>
                    ) : (
                      liveGifters.map((g: any, idx: number) => (
                        <div key={idx} className="bg-[#0a0d16] border border-pink-500/30 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 font-mono">
                          <Gift className="w-3.5 h-3.5 text-pink-400" />
                          <span className="text-white font-bold">{g.nickname || g.username || 'Gifter'}</span>
                          <span className="text-pink-300">sent {g.giftName} x{g.repeatCount || 1}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            )}

            {/* MODE B: SELECTED ARCHIVED DEBATE RECORD VIEW */}
            {activeTab === 'archived' && (
              <>
                {selectedRecord ? (
                  <div className="flex flex-col gap-6">
                    
                    {/* Record Header Banner */}
                    <div className="relative bg-[#0c111d] border border-[#00f0ff]/40 rounded-2xl p-5 overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.1)]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] font-black text-[#00f0ff] tracking-widest uppercase font-mono">
                              ARCHIVE ID: {selectedRecord.id}
                            </span>
                            {selectedRecord.declaredWinner && (
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                selectedRecord.declaredWinner === 'PROPOSER'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
                              }`}>
                                WINNER: {selectedRecord.declaredWinner}
                              </span>
                            )}
                          </div>
                          <h2 className="text-lg font-black text-white tracking-wide font-sans">
                            {selectedRecord.label}
                          </h2>
                          <p className="text-xs text-gray-300 font-mono mt-0.5">
                            TOPIC: <span className="text-white font-bold">{selectedRecord.debateTopic || 'N/A'}</span>
                          </p>
                        </div>

                        {/* Copy URL Button */}
                        <button
                          type="button"
                          onClick={() => copyToClipboard(getShareableUrl(selectedRecord.id), 'Archive Share Link')}
                          className="px-4 py-2.5 rounded-xl bg-[#00f0ff] hover:bg-[#33f3ff] text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer transition-all shrink-0"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>COPY SHARE LINK</span>
                        </button>
                      </div>

                      {/* Scores breakdown */}
                      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-[#00f0ff]/20">
                        <div className="bg-[#05070a] border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider font-mono">PROPOSER FINAL SCORE</span>
                            <span className="text-2xl font-black text-white block">{selectedRecord.scores?.proScore || 0}</span>
                          </div>
                          <Trophy className="w-6 h-6 text-emerald-400/50" />
                        </div>

                        <div className="bg-[#05070a] border border-red-500/30 p-3 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-wider font-mono">CONTRARY FINAL SCORE</span>
                            <span className="text-2xl font-black text-white block">{selectedRecord.scores?.conScore || 0}</span>
                          </div>
                          <Trophy className="w-6 h-6 text-red-400/50" />
                        </div>
                      </div>
                    </div>

                    {/* Sub-tab Navigation for Archived Data */}
                    <div className="flex items-center gap-2 border-b border-[#00f0ff]/20 pb-2 overflow-x-auto font-mono">
                      <button
                        type="button"
                        onClick={() => setDetailTab('claims')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          detailTab === 'claims'
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                            : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Claims & Evidence ({(selectedRecord.formalClaims || []).length + (selectedRecord.claims || []).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab('panelists')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          detailTab === 'panelists'
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                            : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Panelists Roster ({(selectedRecord.panelists || []).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab('questions')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          detailTab === 'questions'
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                            : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                        }`}
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Questions ({(selectedRecord.questions || []).length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab('gifters')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                          detailTab === 'gifters'
                            ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]'
                            : 'text-gray-400 hover:text-white hover:bg-[#0a0d16]'
                        }`}
                      >
                        <Gift className="w-3.5 h-3.5" />
                        <span>Gifters ({(selectedRecord.gifters || []).length})</span>
                      </button>
                    </div>

                    {/* Claims Detail */}
                    {detailTab === 'claims' && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-[#00f0ff] uppercase tracking-wider font-mono">ARCHIVED CLAIMS & EVIDENCE LOG</span>
                          
                          {/* Team Filter */}
                          <div className="flex items-center gap-1 bg-[#05070a] p-1 rounded-lg border border-[#00f0ff]/20 text-[9px] font-mono">
                            <button
                              type="button"
                              onClick={() => setTeamFilter('ALL')}
                              className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'ALL' ? 'bg-[#00f0ff] text-black' : 'text-gray-400'}`}
                            >
                              ALL
                            </button>
                            <button
                              type="button"
                              onClick={() => setTeamFilter('PROPOSER')}
                              className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'PROPOSER' ? 'bg-emerald-500 text-black' : 'text-emerald-400'}`}
                            >
                              PRO
                            </button>
                            <button
                              type="button"
                              onClick={() => setTeamFilter('CONTRARY')}
                              className={`px-2 py-0.5 rounded font-extrabold ${teamFilter === 'CONTRARY' ? 'bg-red-500 text-black' : 'text-red-400'}`}
                            >
                              CON
                            </button>
                          </div>
                        </div>

                        {(selectedRecord.formalClaims || []).length === 0 && (selectedRecord.claims || []).length === 0 ? (
                          <span className="text-xs text-gray-500 italic p-4 text-center font-mono">No claims logged for this archived debate.</span>
                        ) : (
                          <div className="flex flex-col gap-3">
                            {(selectedRecord.formalClaims || [])
                              .filter((fc: any) => teamFilter === 'ALL' || fc.team === teamFilter)
                              .map((fc: any, idx: number) => {
                                const linkedEv = (selectedRecord.evidenceList || []).filter((ev: any) => ev.claimId === fc.claimId);
                                const linkedCounter = (selectedRecord.counterClaims || []).filter((cc: any) => cc.claimId === fc.claimId);

                                return (
                                  <div key={fc.claimId || idx} className="bg-[#0a0d16] border border-[#00f0ff]/20 p-4 rounded-xl flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                                        fc.team === 'PROPOSER' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-red-500/20 text-red-400 border border-red-500/40'
                                      }`}>
                                        {fc.team} • {fc.speaker || 'Speaker'}
                                      </span>
                                      <span className="text-[9px] text-[#00f0ff] font-mono uppercase">{fc.phase || 'RECORDED CLAIM'}</span>
                                    </div>

                                    <p className="text-xs text-gray-200 font-sans font-medium">{fc.claimText || fc.statement || fc.text}</p>

                                    {linkedEv.length > 0 && (
                                      <div className="mt-1 pt-2 border-t border-[#00f0ff]/10 flex flex-col gap-1.5 font-sans">
                                        <span className="text-[9px] font-black text-[#00f0ff] uppercase font-mono">SUPPORTING EVIDENCE</span>
                                        {linkedEv.map((ev: any, eIdx: number) => (
                                          <div key={eIdx} className="bg-[#05070a] border border-[#00f0ff]/20 p-2.5 rounded-lg text-xs text-gray-300">
                                            <p>{ev.evidenceText}</p>
                                            {ev.source && <span className="text-[9px] text-[#00f0ff] font-mono block mt-1">Source: {ev.source}</span>}
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {linkedCounter.length > 0 && (
                                      <div className="mt-1 pt-2 border-t border-red-500/20 flex flex-col gap-1.5 font-sans">
                                        <span className="text-[9px] font-black text-red-400 uppercase font-mono">REBUTTALS</span>
                                        {linkedCounter.map((cc: any, cIdx: number) => (
                                          <div key={cIdx} className="bg-[#05070a] border border-red-500/30 p-2.5 rounded-lg text-xs text-gray-300">
                                            <p>{cc.counterText}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Panelists Detail */}
                    {detailTab === 'panelists' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(selectedRecord.panelists || []).map((p: any, idx: number) => (
                          <div key={idx} className="bg-[#0a0d16] border border-[#00f0ff]/20 p-3 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] ${
                                p.team === 'PROPOSER' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                              }`}>
                                {p.team === 'PROPOSER' ? 'PRO' : 'CON'} SEAT {p.seat}
                              </span>
                              <span className="text-xs font-bold text-white font-sans">{p.name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Questions Detail */}
                    {detailTab === 'questions' && (
                      <div className="flex flex-col gap-2 font-sans">
                        {(selectedRecord.questions || []).map((q: any, idx: number) => (
                          <div key={idx} className="bg-[#0a0d16] border border-[#00f0ff]/20 p-3 rounded-xl text-xs text-gray-200">
                            "{q.text}" {q.author && <span className="text-[#00f0ff] font-mono text-[10px]">— {q.author}</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Gifters Detail */}
                    {detailTab === 'gifters' && (
                      <div className="flex flex-wrap gap-2 font-mono">
                        {(selectedRecord.gifters || []).map((g: any, idx: number) => (
                          <div key={idx} className="bg-[#0a0d16] border border-pink-500/30 px-3 py-1.5 rounded-lg text-xs text-pink-300">
                            {g.nickname || g.username || 'Gifter'}: {g.giftName} x{g.repeatCount || 1}
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="text-center p-12 flex flex-col items-center justify-center gap-2">
                    <Bookmark className="w-12 h-12 text-[#00f0ff]/40 mb-2" />
                    <span className="text-sm font-black text-white uppercase tracking-widest">SELECT ARCHIVE FILE FROM INDEX</span>
                    <p className="text-xs text-gray-400 max-w-xs font-mono">
                      Choose an archived debate from the left panel to inspect snapshot claims, evidence, score breakdowns, and share links.
                    </p>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Sci-Fi Footer Status Bar */}
        <div className="px-6 py-2 border-t border-[#00f0ff]/20 bg-[#0a0d16] text-[9px] font-mono text-[#00f0ff]/60 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
            <span>NEURAL FILING SYSTEM ONLINE</span>
          </span>
          <span className="hidden sm:inline">DATA ENCRYPTION: AES-256-GCM • QUANTUM DEBATE ARCHIVE</span>
        </div>

      </div>
    </div>
  );
}
