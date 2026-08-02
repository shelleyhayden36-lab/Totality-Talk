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
