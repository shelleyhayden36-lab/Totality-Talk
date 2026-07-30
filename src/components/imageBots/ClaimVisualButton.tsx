import React, { useState } from 'react';
import { Sparkles, Loader2, Image as ImageIcon, Eye, ExternalLink } from 'lucide-react';
import { FormalClaim } from '../../App';
import { affirmativeBot } from '../../lib/imageBots/affirmativeStageBot';
import { oppositionBot } from '../../lib/imageBots/oppositionStageBot';

interface ClaimVisualButtonProps {
  claim: FormalClaim;
  updateStateOnServer: (updater: (draft: any) => void) => void;
  onViewImage?: (imageUrl: string, title: string) => void;
  className?: string;
}

export const ClaimVisualButton: React.FC<ClaimVisualButtonProps> = ({
  claim,
  updateStateOnServer,
  onViewImage,
  className = '',
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(
    (claim as any).visualImageUrl || null
  );

  const isAffirmative =
    (claim.team || '').toUpperCase() === 'PROPOSER' ||
    (claim.team || '').toUpperCase() === 'AFFIRMATIVE';

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGenerating(true);

    try {
      let result;
      if (isAffirmative) {
        result = await affirmativeBot.generateVisual({
          claimId: claim.claimId,
          claimText: claim.claimText,
          speaker: claim.speaker,
          team: claim.team,
          phase: claim.phase,
        });
      } else {
        result = await oppositionBot.generateVisual({
          claimId: claim.claimId,
          claimText: claim.claimText,
          speaker: claim.speaker,
          team: claim.team,
          phase: claim.phase,
        });
      }

      if (result && result.imageUrl) {
        setLocalImageUrl(result.imageUrl);

        // Attach generated image directly to this claim in debate state
        updateStateOnServer((draft: any) => {
          const formalClaims = Array.isArray(draft?.formalClaims) ? [...draft.formalClaims] : [];
          const claims = Array.isArray(draft?.claims) ? [...draft.claims] : [];

          const fIdx = formalClaims.findIndex(
            (c: any) => c.claimId === claim.claimId || c.id === claim.claimId
          );
          if (fIdx !== -1) {
            formalClaims[fIdx] = {
              ...formalClaims[fIdx],
              visualImageUrl: result.imageUrl,
              visualImagePrompt: result.promptUsed,
              visualGeneratedAt: result.timestamp,
            };
          }

          const cIdx = claims.findIndex(
            (c: any) => c.claimId === claim.claimId || c.id === claim.claimId
          );
          if (cIdx !== -1) {
            claims[cIdx] = {
              ...claims[cIdx],
              visualImageUrl: result.imageUrl,
              visualImagePrompt: result.promptUsed,
              visualGeneratedAt: result.timestamp,
            };
          }

          return { formalClaims, claims };
        });
      }
    } catch (err) {
      console.error('Failed to generate claim visual:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentImageUrl = localImageUrl || (claim as any).visualImageUrl;
  const hasImage = Boolean(currentImageUrl);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-sm ${
            isAffirmative
              ? 'bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border-[#00f0ff]/40 shadow-[#00f0ff]/10'
              : 'bg-[#ff2a5f]/10 hover:bg-[#ff2a5f]/20 text-[#ff2a5f] border-[#ff2a5f]/40 shadow-[#ff2a5f]/10'
          } disabled:opacity-50`}
          title={isAffirmative ? 'Affirmative Stage Image Bot' : 'Opposition Stage Image Bot'}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating Blueprint...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{hasImage ? 'Re-generate Claim Visual' : 'Generate Claim Visual'}</span>
            </>
          )}
        </button>

        {hasImage && onViewImage && currentImageUrl && (
          <button
            onClick={() => onViewImage(currentImageUrl, `Claim Visual: ${claim.claimText}`)}
            className="px-2.5 py-1.5 bg-[#16171d] hover:bg-[#232530] text-gray-300 rounded-xl text-xs font-bold transition-colors border border-[#2d2f39] flex items-center gap-1 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Full Hologram</span>
          </button>
        )}
      </div>

      {hasImage && currentImageUrl && (
        <div
          onClick={() => onViewImage?.(currentImageUrl, `Claim Visual: ${claim.claimText}`)}
          className="relative group rounded-xl overflow-hidden border border-[#00f0ff]/30 bg-black/50 cursor-pointer shadow-lg hover:border-[#00f0ff]/70 transition-all mt-1"
        >
          <img
            src={currentImageUrl}
            alt={`Blueprint Visual for claim: ${claim.claimText}`}
            className="w-full h-52 object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
            <span className="text-xs font-bold text-[#00f0ff] flex items-center gap-1.5">
              <Eye className="w-4 h-4" /> Click to Expand Hologram Stage View
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
