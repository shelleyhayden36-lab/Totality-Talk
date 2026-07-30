import React, { useState, useEffect } from 'react';
import { RotateCcw, Save, Trash2, X, AlertTriangle, CheckCircle2, Bookmark, Users, HelpCircle, FileText, Gift, Trophy } from 'lucide-react';
import { DebateState } from '../App';

interface ResetDebateModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: DebateState;
  onStateUpdate: (updatedState: Partial<DebateState>) => void;
  onReplaceState?: (fullState: DebateState) => void;
}

export default function ResetDebateModal({ isOpen, onClose, state, onStateUpdate, onReplaceState }: ResetDebateModalProps) {
  const [saveDebate, setSaveDebate] = useState(true);
  const [customLabel, setCustomLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Set default label when modal opens
  useEffect(() => {
    if (isOpen) {
      const topic = state.settings?.debateTopic?.trim();
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (topic) {
        setCustomLabel(`${topic} (${dateStr})`);
      } else {
        setCustomLabel(`Debate Session - ${dateStr}`);
      }
      setSaveDebate(true);
      setErrorMsg('');
    }
  }, [isOpen, state.settings?.debateTopic]);

  if (!isOpen) return null;

  const handleConfirmReset = async () => {
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/state/reset-debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveDebate,
          label: customLabel.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset debate');
      }

      if (data.state) {
        if (onReplaceState) {
          onReplaceState(data.state);
        } else {
          onStateUpdate(data.state);
        }
      }

      onClose();
    } catch (err: any) {
      console.error('Reset Debate Error:', err);
      setErrorMsg(err.message || 'An error occurred while resetting the debate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const seatedCount = state.participants?.length || 0;
  const claimsCount = (state.formalClaims?.length || 0) + (state.claims?.length || 0);
  const evidenceCount = state.evidenceList?.length || 0;
  const questionsCount = state.chatQuestions?.length || 0;
  const giftersCount = state.tikfinityEvents?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#101114] border border-[#2d2f39] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2f39] bg-[#16171d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Reset Debate Session</h3>
              <p className="text-[10px] text-gray-400">Optionally save archive data and reset all live scores & seats</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#20222b] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Mode Selection */}
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">Select Reset Action</span>
            
            {/* Option A: Save & Reset */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                saveDebate
                  ? 'bg-[#16171d] border-[#f97316] ring-1 ring-[#f97316]'
                  : 'bg-[#121318] border-[#2d2f39] hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="resetOption"
                checked={saveDebate}
                onChange={() => setSaveDebate(true)}
                className="mt-0.5 accent-[#f97316]"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Bookmark className="w-3.5 h-3.5 text-[#f97316]" />
                  <span className="text-xs font-bold text-white">Save Debate Session to Archive & Reset</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Archives panelists' names, top gifters, asked questions, claims, evidence, counterclaims, and final scores.
                </p>
              </div>
            </label>

            {/* Option B: Erase Without Saving */}
            <label
              className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                !saveDebate
                  ? 'bg-[#16171d] border-red-500 ring-1 ring-red-500'
                  : 'bg-[#121318] border-[#2d2f39] hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="resetOption"
                checked={!saveDebate}
                onChange={() => setSaveDebate(false)}
                className="mt-0.5 accent-red-500"
              />
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-bold text-white">Erase Debate Data Without Saving</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Permanently clears current live debate records without creating an archived snapshot.
                </p>
              </div>
            </label>
          </div>

          {/* Label Input Section (When Save is selected) */}
          {saveDebate && (
            <div className="bg-[#16171d]/60 border border-[#2d2f39] p-4 rounded-xl flex flex-col gap-3">
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider flex items-center justify-between">
                <span>Debate Title / Label Name:</span>
                <span className="text-[9px] text-[#f97316]">Customizable</span>
              </label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g. AI Ethics Debate - July 2026"
                className="bg-[#0d0e10] border border-[#2d2f39] text-xs text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-[#f97316] font-medium"
              />

              {/* Data Summary Checklist */}
              <div className="mt-1 pt-3 border-t border-[#2d2f39]/60 flex flex-col gap-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Snapshot Content Included:</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-300">
                  <div className="flex items-center gap-1.5 bg-[#101114] px-2.5 py-1.5 rounded-md border border-[#2d2f39]">
                    <Users className="w-3 h-3 text-[#f97316]" />
                    <span>{seatedCount} Panelists Seated</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#101114] px-2.5 py-1.5 rounded-md border border-[#2d2f39]">
                    <FileText className="w-3 h-3 text-cyan-400" />
                    <span>{claimsCount} Claims / {evidenceCount} Evidence</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#101114] px-2.5 py-1.5 rounded-md border border-[#2d2f39]">
                    <HelpCircle className="w-3 h-3 text-emerald-400" />
                    <span>{questionsCount} Questions Asked</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#101114] px-2.5 py-1.5 rounded-md border border-[#2d2f39]">
                    <Gift className="w-3 h-3 text-pink-400" />
                    <span>{giftersCount} Gifters Logged</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reset Scope Details Info */}
          <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-xl flex flex-col gap-2 text-[10px] text-gray-300 leading-relaxed">
            <span className="font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" />
              <span>Reset Actions Summary</span>
            </span>
            <ul className="list-disc pl-4 space-y-1 text-gray-400">
              <li><strong>Unseat Everyone:</strong> Clears all seated panelists and history.</li>
              <li><strong>Reset All Scores:</strong> Clears popular votes, chat votes, and all judge scorecards.</li>
              <li><strong>Logout Remotes:</strong> Automatically logs out all active remote judges and panelists.</li>
              <li><strong>Unselect Prompt:</strong> Unselects current debate prompt topic.</li>
              <li><strong>Reset Claims & Evidence:</strong> Clears all live claims, formal claims, and evidence.</li>
              <li className="text-emerald-400"><strong>Preserved Fixtures:</strong> Uploaded videos, background music, judge accounts/credentials, rules, and permanent credits are preserved.</li>
            </ul>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2d2f39] bg-[#16171d]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-[#2d2f39] text-gray-300 hover:text-white text-xs font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmReset}
            disabled={isSubmitting}
            className={`px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-2 shadow-lg ${
              saveDebate
                ? 'bg-[#f97316] hover:bg-[#ea580c] shadow-orange-950/40'
                : 'bg-red-600 hover:bg-red-700 shadow-red-950/40'
            }`}
          >
            {isSubmitting ? (
              <span>Resetting...</span>
            ) : saveDebate ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save & Reset Debate</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Debate Without Saving</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
