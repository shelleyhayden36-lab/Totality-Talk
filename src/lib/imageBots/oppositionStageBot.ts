import { ClaimVisualRequest, StageVisualRequest, GeneratedImageResponse, ImageBotConfig } from './types';
import { generateOppositionHologramPng } from './blueprintSvgRenderer';

export class OppositionStageImageBot {
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

  public async generateVisual(
    request: ClaimVisualRequest | StageVisualRequest
  ): Promise<GeneratedImageResponse> {
    const isClaim = 'claimText' in request;
    const claimText = isClaim ? (request as ClaimVisualRequest).claimText : (request as StageVisualRequest).topic;
    const speaker = isClaim ? (request as ClaimVisualRequest).speaker : 'Opposition Chair';

    const promptUsed = `Detailed scientific hologram blueprint diagram directly illustrating the subject matter of the counter-claim: "${claimText}". Feature complex technical schematic illustrations representing the core concepts of this opposition argument, glowing crimson red HUD vector lines, technical coordinate callouts, data graphs, metric gauges, and blueprint grid background. Totality Talk opposition stage aesthetic, high resolution 9:16 aspect ratio. Speaker: ${speaker}.`;

    try {
      // Attempt backend endpoint
      const response = await fetch('/api/ai/image-bot/opposition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimText,
          speaker,
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
            botType: 'opposition',
            timestamp: new Date().toISOString(),
            aspectRatio: '9:16',
          };
        }
      }
    } catch (e) {
      console.warn('Opposition Image Bot server request failed, utilizing local PNG generator.', e);
    }

    // Local PNG Blueprint Generator Fallback
    const pngUrl = generateOppositionHologramPng({
      claimText: claimText || 'Opposition Stage Counter-Arguments',
      speakerName: speaker,
      topic: isClaim ? (request as ClaimVisualRequest).topic : (request as StageVisualRequest).topic,
    });

    return {
      imageUrl: pngUrl,
      promptUsed,
      botType: 'opposition',
      timestamp: new Date().toISOString(),
      aspectRatio: '9:16',
    };
  }
}

export const oppositionBot = new OppositionStageImageBot();
