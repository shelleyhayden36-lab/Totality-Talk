import { EvidenceVisualRequest, GeneratedImageResponse, ImageBotConfig } from './types';
import { generateEvidenceHologramPng } from './blueprintSvgRenderer';

export class EvidenceImageBot {
  private config: ImageBotConfig;

  constructor(config?: Partial<ImageBotConfig>) {
    this.config = {
      model: 'gemini-3.6-flash',
      apiKeyPlaceholder: 'GEMINI_API_KEY_SERVER',
      resolution: '1080x1920',
      enabled: true,
      ...config,
    };
  }

  public getConfig(): ImageBotConfig {
    return this.config;
  }

  public setConfig(newConfig: Partial<ImageBotConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public async generateVisual(request: EvidenceVisualRequest): Promise<GeneratedImageResponse> {
    const { claimText, evidenceText, quotes, source, judgeScore, judgeResult, reasoning } = request;

    const promptUsed = `Detailed scientific evidence card blueprint diagram directly illustrating the subject matter of the evaluated claim and evidence: Claim: "${claimText}", Evidence: "${evidenceText}". Feature technical schematics matching the subject domain, HUD evaluation indicators (Score: ${judgeScore}, Result: "${judgeResult}"), glowing vector lines, source verification tags ("${source}"), and blueprint grid layout. Totality Talk evidence card aesthetic, high resolution 9:16 aspect ratio.`;

    try {
      // Attempt backend endpoint
      const response = await fetch('/api/ai/image-bot/evidence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText,
          evidenceText,
          quotes,
          source,
          judgeScore,
          judgeResult,
          reasoning,
          prompt: promptUsed,
          config: this.config,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.imageUrl) {
          return {
            imageUrl: data.imageUrl,
            promptUsed: data.promptUsed || promptUsed,
            botType: 'evidence',
            timestamp: new Date().toISOString(),
            aspectRatio: '9:16',
          };
        }
      }
    } catch (e) {
      console.warn('Evidence Image Bot server request failed, utilizing local PNG generator.', e);
    }

    // Local PNG Evidence Card Blueprint Generator Fallback
    const pngUrl = generateEvidenceHologramPng({
      claimTitle: claimText || 'Debate Claim',
      evidenceSummary: evidenceText || 'Reviewed Evidence Text',
    });

    return {
      imageUrl: pngUrl,
      promptUsed,
      botType: 'evidence',
      timestamp: new Date().toISOString(),
      aspectRatio: '9:16',
    };
  }
}

export const evidenceBot = new EvidenceImageBot();
