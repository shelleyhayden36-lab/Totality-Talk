import React, { useState } from 'react';
import { X, Sparkles, Settings, Bot, Cpu, Key, Sliders, Image, Check } from 'lucide-react';
import { ImageBotConfig } from '../../lib/imageBots/types';
import { affirmativeBot } from '../../lib/imageBots/affirmativeStageBot';
import { oppositionBot } from '../../lib/imageBots/oppositionStageBot';
import { evidenceBot } from '../../lib/imageBots/evidenceImageBot';

interface ImageBotSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImageBotSettingsModal: React.FC<ImageBotSettingsModalProps> = ({ isOpen, onClose }) => {
  const [affConfig, setAffConfig] = useState<ImageBotConfig>(affirmativeBot.getConfig());
  const [oppConfig, setOppConfig] = useState<ImageBotConfig>(oppositionBot.getConfig());
  const [evConfig, setEvConfig] = useState<ImageBotConfig>(evidenceBot.getConfig());
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    affirmativeBot.setConfig(affConfig);
    oppositionBot.setConfig(oppConfig);
    evidenceBot.setConfig(evConfig);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0e0f14] border border-[#252836] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-[#1d202d] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#f97316]/10 text-[#f97316] rounded-xl border border-[#f97316]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                AI Image Bots Configuration
              </h2>
              <p className="text-xs text-gray-400">
                Modular settings, models &amp; API placeholders for Affirmative, Opposition &amp; Evidence bots
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white bg-[#181a24] hover:bg-[#252836] rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {savedSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
              <Check className="w-4 h-4" />
              Settings updated successfully across all 3 AI Image Bots!
            </div>
          )}

          {/* 1. AFFIRMATIVE STAGE BOT */}
          <div className="p-4 bg-[#14161f] border border-[#252836] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#00f0ff]" />
                <h3 className="text-sm font-black text-white">1. Affirmative Stage Image Bot</h3>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded fill-cyan-500/10 text-[#00f0ff] border border-[#00f0ff]/30">
                Cyan Hologram Style
              </span>
            </div>
            <p className="text-xs text-gray-400">Generates stage backgrounds and hologram claim visuals for Affirmative team arguments.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Model Engine</label>
                <select
                  value={affConfig.model}
                  onChange={(e) => setAffConfig({ ...affConfig, model: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Default)</option>
                  <option value="imagen-3.0">Imagen 3.0 Blueprint Engine</option>
                  <option value="dalle-3-placeholder">DALL-E 3 (API Placeholder)</option>
                  <option value="custom-api">Custom API Endpoint</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">API Key / Secret Placeholder</label>
                <div className="flex items-center bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2">
                  <Key className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                  <input
                    type="password"
                    placeholder="Inherits GEMINI_API_KEY from server environment"
                    value={affConfig.apiKeyPlaceholder}
                    onChange={(e) => setAffConfig({ ...affConfig, apiKeyPlaceholder: e.target.value })}
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. OPPOSITION STAGE BOT */}
          <div className="p-4 bg-[#14161f] border border-[#252836] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#ff2a5f]" />
                <h3 className="text-sm font-black text-white">2. Opposition Stage Image Bot</h3>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/10 text-[#ff2a5f] border border-[#ff2a5f]/30">
                Crimson / Red Hologram Style
              </span>
            </div>
            <p className="text-xs text-gray-400">Generates stage backgrounds and hologram claim visuals for Opposition team counter-arguments.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Model Engine</label>
                <select
                  value={oppConfig.model}
                  onChange={(e) => setOppConfig({ ...oppConfig, model: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Default)</option>
                  <option value="imagen-3.0">Imagen 3.0 Blueprint Engine</option>
                  <option value="dalle-3-placeholder">DALL-E 3 (API Placeholder)</option>
                  <option value="custom-api">Custom API Endpoint</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">API Key / Secret Placeholder</label>
                <div className="flex items-center bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2">
                  <Key className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                  <input
                    type="password"
                    placeholder="Inherits GEMINI_API_KEY from server environment"
                    value={oppConfig.apiKeyPlaceholder}
                    onChange={(e) => setOppConfig({ ...oppConfig, apiKeyPlaceholder: e.target.value })}
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. EVIDENCE IMAGE BOT */}
          <div className="p-4 bg-[#14161f] border border-[#252836] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black text-white">3. Evidence Image Bot</h3>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Judge Color-Coded Cards
              </span>
            </div>
            <p className="text-xs text-gray-400">Creates visual evidence cards after evidence review, dynamically changing hologram colors based on judge results (Green/Yellow/Red/Grey).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">Model Engine</label>
                <select
                  value={evConfig.model}
                  onChange={(e) => setEvConfig({ ...evConfig, model: e.target.value })}
                  className="w-full bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="gemini-3.6-flash">Gemini 3.6 Flash (Default)</option>
                  <option value="imagen-3.0">Imagen 3.0 Blueprint Engine</option>
                  <option value="dalle-3-placeholder">DALL-E 3 (API Placeholder)</option>
                  <option value="custom-api">Custom API Endpoint</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">API Key / Secret Placeholder</label>
                <div className="flex items-center bg-[#0a0b0e] border border-[#2d3042] rounded-lg px-3 py-2">
                  <Key className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
                  <input
                    type="password"
                    placeholder="Inherits GEMINI_API_KEY from server environment"
                    value={evConfig.apiKeyPlaceholder}
                    onChange={(e) => setEvConfig({ ...evConfig, apiKeyPlaceholder: e.target.value })}
                    className="w-full bg-transparent text-xs text-white placeholder-gray-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. VISUAL RESEARCH & PROMPT ARCHITECT BOT */}
          <div className="p-4 bg-[#14161f] border border-[#252836] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">4. Visual Research &amp; Prompt Architect Bot</h3>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Google Search Grounded (Free Tier)
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Performs real-time Google Search on the claim topic to find visual concepts, real-world models, and literal representations. Formulates a tailored visual prompt for the Image Generator Bot without needing hardcoded categories.
            </p>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-[#1d202d] bg-[#0a0b0e] flex items-center justify-between">
          <span className="text-[11px] text-gray-500">All 3 bots operate independently in modular architecture</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#181a24] hover:bg-[#252836] text-gray-300 text-xs font-bold rounded-xl cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-[#f97316]/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Save Bot Configurations
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
