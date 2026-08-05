import { TranscriptItem } from '../types';

/**
 * Normalize round string to standard representation (e.g. 'Round 1', 'Round 2', 'Final Round').
 */
export function normalizeRound(r?: string): string {
  if (!r) return 'Round 1';
  const str = String(r).trim();
  const lower = str.toLowerCase();
  
  if (lower.includes('final')) return 'Final Round';
  if (lower.includes('2') || lower === 'r2') return 'Round 2';
  if (lower.includes('3') || lower === 'r3') return 'Round 3';
  if (lower.includes('4') || lower === 'r4') return 'Round 4';
  if (lower.includes('1') || lower === 'r1') return 'Round 1';

  return str;
}

/**
 * Normalize phase string to high-level category (OPENING, REBUTTAL, CROSS, FLOOR, CLOSING, WINNER, LOBBY).
 */
export function normalizePhaseCategory(p?: string): string {
  if (!p) return 'OPENING';
  const upper = String(p).toUpperCase();

  if (upper.includes('LOBBY')) return 'LOBBY';
  if (upper.includes('OPEN')) return 'OPENING';
  if (upper.includes('REBUT')) return 'REBUTTAL';
  if (upper.includes('CROSS')) return 'CROSS';
  if (upper.includes('FLOOR') || upper.includes('CHAT')) return 'FLOOR';
  if (upper.includes('CLOSIN')) return 'CLOSING';
  if (upper.includes('WINNER')) return 'WINNER';

  return upper;
}

/**
 * Filter transcripts so teleprompter and stage open-captions ONLY show items from the active phase & round.
 * Prevents earlier phase/round transcripts from cluttering the stage when advancing phases or rounds.
 */
export function getActivePhaseTranscripts(
  transcripts: TranscriptItem[] = [],
  currentPhase?: string,
  currentRound?: string
): TranscriptItem[] {
  if (!Array.isArray(transcripts) || transcripts.length === 0) return [];

  const activePhaseCategory = normalizePhaseCategory(currentPhase);
  const activeRoundNormalized = normalizeRound(currentRound);

  return transcripts.filter((t) => {
    // 1. Match phase
    const tRawPhase = t.phaseId || t.phaseName || t.phase;
    const tPhaseCategory = tRawPhase ? normalizePhaseCategory(tRawPhase) : 'OPENING';

    if (tPhaseCategory !== activePhaseCategory) {
      return false;
    }

    // 2. Match round
    const tRoundNormalized = normalizeRound(t.round);
    if (tRoundNormalized !== activeRoundNormalized) {
      return false;
    }

    return true;
  });
}

/**
 * Cap transcripts to limit memory usage when live open captions are running.
 * When recording is active, returns all transcripts.
 * When recording is NOT active, keeps all saved/starred/highlighted items permanently,
 * and caps non-saved items to the most recent `limit` items (default: 15).
 */
export function limitUnsavedTranscripts(
  transcripts: TranscriptItem[] = [],
  isRecording: boolean = false,
  limit: number = 15
): TranscriptItem[] {
  if (isRecording) {
    return transcripts;
  }

  if (!Array.isArray(transcripts) || transcripts.length === 0) {
    return [];
  }

  const regularItems: TranscriptItem[] = [];

  for (const item of transcripts) {
    if (!item.isStarred && !item.isHighlighted && !item.isSaved) {
      regularItems.push(item);
    }
  }

  if (regularItems.length <= limit) {
    return transcripts;
  }

  const regularToKeep = new Set(regularItems.slice(-limit));

  return transcripts.filter(
    (item) => item.isStarred || item.isHighlighted || item.isSaved || regularToKeep.has(item)
  );
}

export interface AccentLanguageOption {
  code: string;
  label: string;
  flag: string;
  region: string;
}

export const ACCENT_LANGUAGE_OPTIONS: AccentLanguageOption[] = [
  { code: 'auto', label: 'Auto-Detect Accent & Language (AI Auto-Adapts)', flag: '🌍', region: 'Global AI Auto-Detection' },
  { code: 'en-US', label: 'English (US Accent)', flag: '🇺🇸', region: 'United States' },
  { code: 'en-GB', label: 'English (UK / British Accent)', flag: '🇬🇧', region: 'United Kingdom' },
  { code: 'en-AU', label: 'English (Australian Accent)', flag: '🇦🇺', region: 'Australia' },
  { code: 'en-IN', label: 'English (Indian Accent)', flag: '🇮🇳', region: 'India' },
  { code: 'en-CA', label: 'English (Canadian Accent)', flag: '🇨🇦', region: 'Canada' },
  { code: 'en-NZ', label: 'English (New Zealand Accent)', flag: '🇳🇿', region: 'New Zealand' },
  { code: 'en-ZA', label: 'English (South African Accent)', flag: '🇿🇦', region: 'South Africa' },
  { code: 'es-ES', label: 'Spanish (Español)', flag: '🇪🇸', region: 'Spain / LatAm' },
  { code: 'fr-FR', label: 'French (Français)', flag: '🇫🇷', region: 'France' },
  { code: 'de-DE', label: 'German (Deutsch)', flag: '🇩🇪', region: 'Germany' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)', flag: '🇨🇳', region: 'China' },
];

/**
 * Speech-to-text post-processor for live open captions.
 * Fixes common Web Speech API phonetic mishearings, duplicate stuttered words,
 * capitalization, and accent-induced missing punctuation.
 */
export function cleanAndFormatTranscriptText(rawText: string, langCode: string = 'en-US'): string {
  if (!rawText || !rawText.trim()) return '';

  let text = rawText.trim();

  // 1. Remove duplicate adjacent stutter words ("the the" -> "the", "is is" -> "is")
  text = text.replace(/\b(\w+)\s+\1\b/gi, '$1');

  // 2. Fix common lowercase English contractions & personal pronouns
  text = text
    .replace(/\bi\b/g, 'I')
    .replace(/\bim\b/gi, "I'm")
    .replace(/\bive\b/gi, "I've")
    .replace(/\bill\b/gi, "I'll")
    .replace(/\bid\b/gi, "I'd")
    .replace(/\bdont\b/gi, "don't")
    .replace(/\bcant\b/gi, "can't")
    .replace(/\bwont\b/gi, "won't")
    .replace(/\bisnt\b/gi, "isn't")
    .replace(/\barent\b/gi, "aren't")
    .replace(/\bwasnt\b/gi, "wasn't")
    .replace(/\bwerent\b/gi, "weren't")
    .replace(/\bhasnt\b/gi, "hasn't")
    .replace(/\bhavent\b/gi, "haven't")
    .replace(/\bcouldnt\b/gi, "couldn't")
    .replace(/\bwouldnt\b/gi, "wouldn't")
    .replace(/\bshouldnt\b/gi, "shouldn't")
    .replace(/\bthats\b/gi, "that's")
    .replace(/\bwhats\b/gi, "what's")
    .replace(/\bits\b/gi, "it's");

  // 3. Fix common debate/phonetic misrecognitions across UK/AU/US accents
  text = text
    .replace(/\bshed yool\b/gi, "schedule")
    .replace(/\bshed yooling\b/gi, "scheduling")
    .replace(/\bproposer team\b/gi, "Proposer team")
    .replace(/\bopposer team\b/gi, "Opposer team")
    .replace(/\bcross exam\b/gi, "Cross-Examination")
    .replace(/\brebutel\b/gi, "Rebuttal");

  // 4. Ensure initial capital letter
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  // 5. Add terminal punctuation if string is a complete phrase (>= 4 words) and lacks ending punctuation
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 4 && !/[.!?]$/.test(text)) {
    text += '.';
  }

  return text;
}

