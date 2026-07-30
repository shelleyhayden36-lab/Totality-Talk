import React from 'react';
import { X, Download, Copy, Share2, Sparkles, Check } from 'lucide-react';

interface HologramImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  onProjectToStage?: (url: string, title: string) => void;
}

export const HologramImageModal: React.FC<HologramImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  onProjectToStage,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !imageUrl) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(imageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="bg-[#0e0f14] border border-[#252836] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
        {/* HEADER */}
        <div className="p-4 border-b border-[#1d202d] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-2.5 truncate">
            <Sparkles className="w-4 h-4 text-[#f97316] shrink-0" />
            <h3 className="text-sm font-black text-white truncate">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white bg-[#181a24] hover:bg-[#252836] rounded-xl cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* IMAGE DISPLAY CONTAINER */}
        <div className="p-4 flex-1 overflow-y-auto flex items-center justify-center bg-[#050608]">
          <img
            src={imageUrl}
            alt={title}
            referrerPolicy="no-referrer"
            className="max-h-[70vh] w-auto object-contain rounded-xl border border-[#252836] shadow-2xl"
          />
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-[#1d202d] bg-[#0a0b0e] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 bg-[#181a24] hover:bg-[#252836] text-gray-200 text-xs font-bold rounded-xl border border-[#2d3042] cursor-pointer transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied URI!' : 'Copy Image Link'}</span>
            </button>
          </div>

          {onProjectToStage && (
            <button
              onClick={() => {
                onProjectToStage(imageUrl, title);
                onClose();
              }}
              className="px-4 py-2 bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-black rounded-xl cursor-pointer shadow-lg shadow-[#f97316]/20 transition-all flex items-center gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Project Hologram to Stage</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
