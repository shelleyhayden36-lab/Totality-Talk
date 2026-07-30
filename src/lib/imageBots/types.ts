export type ImageBotType = 'affirmative' | 'opposition' | 'evidence';

export interface ImageBotConfig {
  model: string; // e.g. 'gemini-3.6-flash', 'imagen-3.0', 'dalle-3-placeholder', 'custom-api'
  apiKeyPlaceholder: string;
  customEndpoint?: string;
  resolution: '1080x1920' | '1080x1080' | '1920x1080';
  promptTemplate?: string;
  enabled: boolean;
}

export interface ClaimVisualRequest {
  claimId: string;
  claimText: string;
  speaker: string;
  team: 'PROPOSER' | 'CONTRARY' | 'AFFIRMATIVE' | 'OPPOSITION' | string;
  phase?: string;
  topic?: string;
  customPrompt?: string;
}

export interface EvidenceVisualRequest {
  evidenceId: string;
  claimId: string;
  claimText: string;
  evidenceText: string;
  source?: string;
  quotes?: string;
  judgeScore?: number;
  judgeResult?: 'Strong support' | 'Partial support' | 'No support' | 'Invalid' | string;
  judgeCategory?: string;
  reasoning?: string;
  customPrompt?: string;
}

export interface StageVisualRequest {
  team: 'AFFIRMATIVE' | 'OPPOSITION';
  topic: string;
  mainArgument?: string;
  customPrompt?: string;
}

export interface GeneratedImageResponse {
  imageUrl: string;
  promptUsed: string;
  botType: ImageBotType;
  timestamp: string;
  aspectRatio: string;
  metadata?: Record<string, any>;
}
