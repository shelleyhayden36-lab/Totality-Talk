import React, { useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Evidence } from '../../App';
import { evidenceBot } from '../../lib/imageBots/evidenceImageBot';

interface EvidenceVisualButtonProps {
  evidence: Evidence;
  claimText?: string;
  updateStateOnServer: (updater: (draft: any) => void) => void;
  onViewImage?: (imageUrl: string, title: string) => void;
  className?: string;
}

export const EvidenceVisualButton: React.FC<EvidenceVisualButtonProps> = ({
  evidence,
  claimText = '',
  updateStateOnServer,
  onViewImage,
  className = '',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(
    (evidence as any).visualImageUrl || null
  );

  // Evidence visual is ONLY available after evidence has been reviewed / judged!
  const isJudged = Boolean(
    evidence.aiJudgeResult ||
    (evidence.status && evidence.status.toLowerCase() !== 'pending')
  );

  const judgeResult =
    evidence.aiJudgeResult?.evidence_rating ||
    evidence.aiJudgeResult?.status ||
    evidence.status ||
    'Judged';

  const judgeScore = evidence.aiJudgeResult?.final_score ?? 85;

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isJudged) return;

    setIsGenerating(true);

    try {
      const result = await evidenceBot.generateVisual({
        evidenceId: evidence.evidenceId,
        claimId: evidence.claimId,
        claimText: claimText || 'Debate Claim',
        evidenceText: evidence.evidenceText,
        source: evidence.source,
        quotes: evidence.evidenceText,
        judgeScore,
        judgeResult,
        reasoning: evidence.aiJudgeResult?.reasoning || '',
      });

      if (result && result.imageUrl) {
        setLocalImageUrl(result.imageUrl);

        // Attach generated image directly to this evidence in state
        updateStateOnServer((draft: any) => {
          const evidenceList = Array.isArray(draft?.evidenceList) ? [...draft.evidenceList] : [];
          const eIdx = evidenceList.findIndex(
            (eItem: any) =>
              eItem.evidenceId === evidence.evidenceId ||
              eItem.id === evidence.evidenceId ||
              (evidence.id && (eItem.evidenceId === evidence.id || eItem.id === evidence.id))
          );
          if (eIdx !== -1) {
            evidenceList[eIdx] = {
              ...evidenceList[eIdx],
              visualImageUrl: result.imageUrl,
              visualImagePrompt: result.promptUsed,
              visualGeneratedAt: result.timestamp,
            };
          }
          return { evidenceList };
        });
      }
    } catch (err) {
      console.error('Failed to generate evidence visual:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentImageUrl = localImageUrl || (evidence as any).visualImageUrl;
  const hasImage = Boolean(currentImageUrl);

  if (!isJudged) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#16171d] text-gray-500 rounded-xl text-xs font-semibold border border-[#232530] cursor-not-allowed ${className}`} title="Evidence Visual is available after judge review">
        <ShieldAlert className="w-3.5 h-3.5 text-gray-500" />
        <span>Generate Evidence Visual (Requires Judge Review)</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shadow-emerald-500/10 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating Evidence Blueprint...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{hasImage ? 'Re-generate Evidence Visual' : 'Generate Evidence Visual'}</span>
            </>
          )}
        </button>

        {hasImage && onViewImage && currentImageUrl && (
          <button
            onClick={() => onViewImage(currentImageUrl, `Evidence Hologram Card: ${evidence.evidenceText.substring(0, 40)}...`)}
            className="px-2.5 py-1.5 bg-[#16171d] hover:bg-[#232530] text-gray-300 rounded-xl text-xs font-bold transition-colors border border-[#2d2f39] flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-emerald-400" />
            <span>Full Hologram Card</span>
          </button>
        )}
      </div>

      {hasImage && currentImageUrl && (
        <div
          onClick={() => onViewImage?.(currentImageUrl, `Evidence Hologram Card: ${evidence.evidenceText.substring(0, 40)}...`)}
          className="relative group rounded-xl overflow-hidden border border-emerald-500/30 bg-black/50 cursor-pointer shadow-lg hover:border-emerald-500/70 transition-all mt-1"
        >
          <img
            src={currentImageUrl}
            alt={`Blueprint Visual for evidence`}
            className="w-full h-52 object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Click to Expand Hologram Evidence View
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
