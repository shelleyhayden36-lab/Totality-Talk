import React, { useState } from 'react';
import { 
  X, 
  Terminal, 
  Activity, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Search, 
  Copy, 
  Check, 
  Send, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw,
  Code2,
  Filter
} from 'lucide-react';
import { DebateState, WebhookLogEntry } from '../App';

interface WebhookLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DebateState;
  onClearLogs: () => void;
  onSimulateWebhook: (payload: any) => Promise<void>;
}

export const WebhookLogModal: React.FC<WebhookLogModalProps> = ({
  isOpen,
  onClose,
  state,
  onClearLogs,
  onSimulateWebhook
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'triggered' | 'untriggered'>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  const [showSimulateDrawer, setShowSimulateDrawer] = useState(false);
  const [customJsonInput, setCustomJsonInput] = useState(`{\n  "username": "live_tester",\n  "nickname": "Tester",\n  "content": "this is a raw webhook event",\n  "likeCount": 10\n}`);
  const [isSendingSim, setIsSendingSim] = useState(false);
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);

  if (!isOpen) return null;

  const logs = state.webhookLogs || [];
  const webhookUrl = `${window.location.origin}/webhooks/tikfinity`;

  // Filter logs
  const filteredLogs = logs.filter(log => {
    // Filter by type
    if (filterType === 'triggered' && !log.triggered) return false;
    if (filterType === 'untriggered' && log.triggered) return false;

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const user = (log.user || '').toLowerCase();
      const summary = (log.summary || '').toLowerCase();
      const endpoint = (log.endpoint || '').toLowerCase();
      const jsonStr = JSON.stringify(log.payload || {}).toLowerCase();
      return user.includes(q) || summary.includes(q) || endpoint.includes(q) || jsonStr.includes(q);
    }
    return true;
  });

  const totalCount = logs.length;
  const triggeredCount = logs.filter(l => l.triggered).length;
  const untriggeredCount = logs.filter(l => !l.triggered).length;

  const toggleExpand = (id: string) => {
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyJson = (id: string, payload: any) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopiedLogId(id);
    setTimeout(() => setCopiedLogId(null), 2000);
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookUrl(true);
    setTimeout(() => setCopiedWebhookUrl(false), 2000);
  };

  const handleSendSimulated = async (payload: any) => {
    setIsSendingSim(true);
    try {
      await onSimulateWebhook(payload);
    } catch (e: any) {
      alert('Error sending webhook: ' + e.message);
    } finally {
      setIsSendingSim(false);
    }
  };

  const handleCustomSimulate = async () => {
    try {
      const parsed = JSON.parse(customJsonInput);
      await handleSendSimulated(parsed);
    } catch (e: any) {
      alert('Invalid JSON syntax: ' + e.message);
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const date = new Date(ts);
      const timeStr = date.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      let relative = `${diffSec}s ago`;
      if (diffSec < 2) relative = 'just now';
      else if (diffSec > 60) relative = `${Math.floor(diffSec / 60)}m ago`;
      return { timeStr, relative };
    } catch {
      return { timeStr: ts, relative: '' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121318] border border-[#2d2f39] rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-[#2d2f39] bg-[#16171d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#f97316]/10 border border-[#f97316]/20 rounded-xl text-[#f97316]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Webhook Event Inspector
                </h2>
                <span className="flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  LIVE LISTENER ONLINE
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Logs all incoming HTTP payloads to <code className="text-[#f97316] font-mono px-1 bg-[#101114] rounded border border-white/5">/webhooks/tikfinity</code> whether matched or untriggered.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSimulateDrawer(!showSimulateDrawer)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                showSimulateDrawer
                  ? 'bg-[#f97316] text-white'
                  : 'bg-[#1e2029] hover:bg-[#282a36] text-gray-200 border border-[#2d2f39]'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{showSimulateDrawer ? 'Hide Test Suite' : 'Simulate Payload'}</span>
            </button>

            <button
              type="button"
              onClick={onClearLogs}
              disabled={logs.length === 0}
              className="px-3 py-1.5 text-xs font-bold text-gray-400 hover:text-red-400 bg-[#1e2029] hover:bg-red-500/10 border border-[#2d2f39] hover:border-red-500/20 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              title="Clear all recorded webhook logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white bg-[#1e2029] hover:bg-[#282a36] rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* METRICS & WEBHOOK URL BAR */}
        <div className="px-6 py-3 bg-[#101114] border-b border-[#2d2f39] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Metrics */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#16171d] px-3 py-1 rounded-lg border border-[#2d2f39]">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-gray-400 font-mono">Total Received:</span>
              <span className="font-bold font-mono text-white">{totalCount}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-500/5 px-3 py-1 rounded-lg border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-gray-400 font-mono">Triggered:</span>
              <span className="font-bold font-mono text-emerald-400">{triggeredCount}</span>
            </div>

            <div className="flex items-center gap-1.5 bg-amber-500/5 px-3 py-1 rounded-lg border border-amber-500/20">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-gray-400 font-mono">Raw / Untriggered:</span>
              <span className="font-bold font-mono text-amber-400">{untriggeredCount}</span>
            </div>
          </div>

          {/* Quick Copy URL */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500 font-mono text-[11px]">Endpoint:</span>
            <code className="text-[11px] font-mono text-gray-300 bg-[#16171d] px-2 py-0.5 rounded border border-[#2d2f39]">
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={handleCopyWebhookUrl}
              className="p-1 text-gray-400 hover:text-white bg-[#16171d] border border-[#2d2f39] rounded hover:border-gray-500 transition-colors cursor-pointer"
              title="Copy Webhook Endpoint URL"
            >
              {copiedWebhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* SIMULATE TEST DRAWER (IF OPEN) */}
        {showSimulateDrawer && (
          <div className="bg-[#181a22] border-b border-[#2d2f39] p-4 flex flex-col gap-3 animate-in slide-in-from-top-2 duration-150 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-[#f97316]" />
                <span className="text-xs font-black text-white uppercase tracking-wider">Simulate Incoming Webhook Payload</span>
                <span className="text-[10px] text-gray-400">Select a preset or edit raw JSON to test listener response</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Quick Presets:</span>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'test_user', content: 'this is a test' })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-gray-200 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Connection Test
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'sarah_m', nickname: 'Sarah', content: '!me question What is the economic impact?' })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-emerald-400 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Question Trigger
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'john_doe', content: '!me vote yes' })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-blue-400 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Vote Affirmative
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'stream_fan', likeCount: 50 })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-rose-400 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Popular Likes (50)
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'top_gifter', giftName: 'Universe', giftId: 991, coins: 500 })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-purple-400 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Gift Event
              </button>
              <button
                type="button"
                onClick={() => handleSendSimulated({ event_type: 'raw_ping', user_id: 88123, raw_message: 'hello world without trigger' })}
                disabled={isSendingSim}
                className="px-2.5 py-1 bg-[#232530] hover:bg-[#2d303f] text-amber-400 text-xs font-mono font-semibold rounded-lg border border-[#373a4a] transition-all cursor-pointer"
              >
                + Raw Payload (No Trigger)
              </button>
            </div>

            {/* Custom JSON editor */}
            <div className="flex items-stretch gap-2">
              <textarea
                value={customJsonInput}
                onChange={(e) => setCustomJsonInput(e.target.value)}
                rows={2}
                className="w-full bg-[#101114] border border-[#2d2f39] rounded-xl p-2.5 text-xs font-mono text-gray-200 focus:outline-none focus:border-[#f97316]"
                placeholder='Enter custom JSON payload e.g. {"username": "foo", "content": "bar"}'
              />
              <button
                type="button"
                onClick={handleCustomSimulate}
                disabled={isSendingSim}
                className="px-4 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {isSendingSim ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>Dispatch</span>
              </button>
            </div>
          </div>
        )}

        {/* SEARCH AND FILTER BAR */}
        <div className="px-6 py-3 bg-[#14151b] border-b border-[#2d2f39] flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by username, content, endpoint, or raw JSON payload..."
              className="w-full bg-[#101114] border border-[#2d2f39] rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-200 placeholder-gray-500 font-mono focus:outline-none focus:border-[#f97316]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#101114] p-1 rounded-xl border border-[#2d2f39]">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-[#282a36] text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              All Logs ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('triggered')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === 'triggered'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Triggered ({triggeredCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('untriggered')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                filterType === 'untriggered'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Raw / Untriggered ({untriggeredCount})
            </button>
          </div>
        </div>

        {/* LOG LIST CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-[#0d0e11] font-mono">
          {filteredLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#2d2f39] rounded-2xl bg-[#121318]/50">
              <div className="p-4 bg-[#1e2029] rounded-full text-gray-500 mb-3">
                <Terminal className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">No Webhook Logs Found</h3>
              <p className="text-xs text-gray-400 max-w-md mt-1 mb-4 leading-relaxed">
                {searchTerm
                  ? `No entries match your search query "${searchTerm}". Try clearing search filters.`
                  : filterType !== 'all'
                  ? `No log entries match the filter "${filterType}".`
                  : 'No HTTP POST requests have arrived at the webhook receiver yet. Use the simulator above to verify integration or send live payloads from Tikfinity/TikTok.'}
              </p>
              <button
                type="button"
                onClick={() => handleSendSimulated({ username: 'test_user', content: 'this is a test' })}
                className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Sample Webhook Event</span>
              </button>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const { timeStr, relative } = formatTimestamp(log.timestamp);
              const isExpanded = expandedLogIds.has(log.id);

              return (
                <div
                  key={log.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    log.triggered
                      ? 'bg-[#151720]/80 border-[#2b2d3d] hover:border-[#3d4057]'
                      : 'bg-[#1a1714]/60 border-amber-500/20 hover:border-amber-500/40'
                  }`}
                >
                  {/* CARD HEADER ROW */}
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="p-3 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-[#f97316]" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      {/* Trigger Badge */}
                      {log.triggered ? (
                        <span className="shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Triggered: {log.triggeredType || 'matched'}</span>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Raw Payload (No Trigger)</span>
                        </span>
                      )}

                      {/* Endpoint */}
                      <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 bg-[#0d0e11] rounded border border-white/5 text-gray-400">
                        {log.endpoint || '/webhooks/tikfinity'}
                      </span>

                      {/* User / Author */}
                      {log.user && (
                        <span className="shrink-0 text-xs font-bold text-white truncate max-w-[140px]">
                          @{log.user}
                        </span>
                      )}

                      {/* Summary */}
                      <span className="text-xs text-gray-300 truncate">
                        {log.summary || 'Received webhook payload'}
                      </span>
                    </div>

                    {/* Right side: Timestamp & Copy */}
                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div className="flex flex-col text-right">
                        <span className="text-[11px] font-mono font-bold text-gray-300">{timeStr}</span>
                        {relative && <span className="text-[9px] text-gray-500">{relative}</span>}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyJson(log.id, log.payload);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white bg-[#101114] border border-[#2d2f39] hover:border-gray-500 rounded-lg transition-colors cursor-pointer"
                        title="Copy Raw JSON"
                      >
                        {copiedLogId === log.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* EXPANDED JSON VIEWER */}
                  {isExpanded && (
                    <div className="border-t border-[#252735] p-4 bg-[#0a0b0e] space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs text-gray-400 border-b border-white/5 pb-2">
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          HTTP Body Payload
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">Method: POST</span>
                          <button
                            type="button"
                            onClick={() => handleCopyJson(log.id, log.payload)}
                            className="px-2 py-0.5 bg-[#16171d] hover:bg-[#20222b] text-gray-300 rounded border border-[#2d2f39] text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            {copiedLogId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedLogId === log.id ? 'Copied' : 'Copy JSON'}</span>
                          </button>
                        </div>
                      </div>

                      <pre className="text-xs text-emerald-300/90 font-mono bg-[#0d0e11] p-3 rounded-xl border border-white/5 overflow-x-auto leading-relaxed max-h-[280px]">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 bg-[#16171d] border-t border-[#2d2f39] flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div>
            Showing <span className="font-bold text-white font-mono">{filteredLogs.length}</span> of{' '}
            <span className="font-bold text-white font-mono">{totalCount}</span> entries
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#252733] hover:bg-[#303342] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
