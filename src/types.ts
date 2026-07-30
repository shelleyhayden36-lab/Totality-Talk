export interface Participant {
  id: string;
  name: string;
  role: 'PROPOSER' | 'CONTRARY';
  isSeated: boolean;
  isMuted: boolean;
  isSpeakerOut?: boolean;
  score: number;
  status?: string;
}

export interface FormalClaim {
  claimId: string;
  speaker: string;
  team: string;
  phase: string;
  claimText: string;
  status: string;
}

export interface AudioRecording {
  id: string;
  title: string;
  timestamp: string;
  durationSeconds: number;
  audioDataUri?: string;
  audioBlobUrl?: string;
  transcriptId?: string;
  isTranscribed?: boolean;
  extractedClaimsCount?: number;
}

export interface TranscriptItem {
  id: string;
  recordingId?: string;
  timestampSeconds: number;
  formattedTime: string;
  speaker: string;
  text: string;
  isHighlighted?: boolean;
}

export interface ExtractedClaim {
  id: string;
  transcriptId?: string;
  text: string;
  confidenceScore: number;
  timestampSeconds: number;
  formattedTime: string;
  possibleSpeaker: string;
  assignedToParticipantId?: string;
  assignedSpeakerName?: string;
  status: 'pending' | 'assigned' | 'rejected';
  linkedAudioTimestamp?: number;
}

export interface TranscriptHighlight {
  id: string;
  transcriptId?: string;
  selectedText: string;
  note?: string;
  color?: string;
  timestampSeconds?: number;
  linkedClaimId?: string;
  targetAction?: 'claim' | 'existing_claim' | 'research' | 'judge';
  createdAt: string;
}

export interface AudioTranscriptionSession {
  recordings: AudioRecording[];
  transcripts: TranscriptItem[];
  extractedClaims: ExtractedClaim[];
  highlights: TranscriptHighlight[];
  selectedRecordingId?: string;
  sidebarCollapsed?: boolean;
}
