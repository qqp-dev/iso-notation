import { JankoRowIndex } from './types';

/**
 * Definitive Duodecimal Solfège System for 12-TET Iso-Notation.
 *
 * Each chromatic pitch class (0..11) is paired with an intuitive,
 * monosyllabic phonetic simplification of its duodecimal numeral:
 *
 *   0: o   (oh / zero)        Row 0
 *   1: wa  (one)              Row 1
 *   2: tu  (two)              Row 0
 *   3: ti  (three)            Row 1
 *   4: fo  (four)             Row 0
 *   5: fa  (five)             Row 1
 *   6: si  (six)              Row 0
 *   7: se  (seven)            Row 1
 *   8: e   (eight)            Row 0
 *   9: na  (nine)             Row 1
 *  10: a   (ten / a)          Row 0
 *  11: bi  (eleven / b)       Row 1
 *
 * Structural Invariants:
 * - Direct Numeral Isomorphism: zero arbitrary memorization barrier
 * - Row Parity Invariant: Evens (0, 2, 4, 6, 8, a) are Row 0; Odds (1, 3, 5, 7, 9, b) are Row 1
 * - Semitones strictly alternate parity (Even <-> Odd)
 * - Whole tones preserve parity (Row 0 -> Row 0, Row 1 -> Row 1)
 */
export interface DuodecimalSolfegeDefinition {
  pitchClass: number; // 0..11
  row: JankoRowIndex; // 0 | 1
  digit: string;      // '0'..'9', 'a', 'b'
  syllable: string;
  derivation: string;
  notes: string;
}

export const DUODECIMAL_SOLFEGE: readonly DuodecimalSolfegeDefinition[] = [
  { pitchClass: 0, row: 0, digit: '0', syllable: 'o', derivation: 'oh (0)', notes: 'Grounding root of Whole-Tone Row 0' },
  { pitchClass: 1, row: 1, digit: '1', syllable: 'wa', derivation: 'one (1)', notes: 'Gliding semi-vowel onset of Row 1' },
  { pitchClass: 2, row: 0, digit: '2', syllable: 'tu', derivation: 'two (2)', notes: 'Crisp dental strike on Row 0' },
  { pitchClass: 3, row: 1, digit: '3', syllable: 'ti', derivation: 'three (3)', notes: 'High dental continuant on Row 1' },
  { pitchClass: 4, row: 0, digit: '4', syllable: 'fo', derivation: 'four (4)', notes: 'Labiodental fricative on Row 0 (5th landmark)' },
  { pitchClass: 5, row: 1, digit: '5', syllable: 'fa', derivation: 'five (5)', notes: 'Open labiodental release on Row 1' },
  { pitchClass: 6, row: 0, digit: '6', syllable: 'si', derivation: 'six (6)', notes: 'Sibilant tritone landmark on Row 0' },
  { pitchClass: 7, row: 1, digit: '7', syllable: 'se', derivation: 'seven (7)', notes: 'Mid-vowel sibilant fifth landmark on Row 1' },
  { pitchClass: 8, row: 0, digit: '8', syllable: 'e', derivation: 'eight (8)', notes: 'Bright mid-front vowel on Row 0' },
  { pitchClass: 9, row: 1, digit: '9', syllable: 'na', derivation: 'nine (9)', notes: 'Alveolar nasal resonance on Row 1' },
  { pitchClass: 10, row: 0, digit: 'A', syllable: 'a', derivation: 'ten / A (10)', notes: 'Low open central vowel on Row 0' },
  { pitchClass: 11, row: 1, digit: 'B', syllable: 'bi', derivation: 'eleven / B (11)', notes: 'Voiced bilabial pop leading into octave on Row 1' },
] as const;

/** Canonical alias pointing to the definitive duodecimal solfège system */
export const CANONICAL_PHONETICS = DUODECIMAL_SOLFEGE;
export const CANONICAL_SOLFEGE = DUODECIMAL_SOLFEGE;

export function getDuodecimalSolfege(pitchClass: number): DuodecimalSolfegeDefinition {
  const pc = ((pitchClass % 12) + 12) % 12;
  return DUODECIMAL_SOLFEGE[pc];
}

export function getDuodecimalSyllable(pitchClass: number): string {
  return getDuodecimalSolfege(pitchClass).syllable;
}

export function duodecimalSolfegeSequence(pitches: readonly number[]): string[] {
  return pitches.map((p) => getDuodecimalSyllable(p));
}

export function duodecimalSolfegeString(pitches: readonly number[], delimiter: string = '-'): string {
  return duodecimalSolfegeSequence(pitches).join(delimiter);
}

export function pitchClassFromDuodecimalSyllable(syllable: string): number | undefined {
  const normalized = syllable.trim().toLowerCase();
  const entry = DUODECIMAL_SOLFEGE.find(
    (e) => e.syllable === normalized || e.digit.toLowerCase() === normalized
  );
  return entry ? entry.pitchClass : undefined;
}

// Canonical aliases for direct interoperability
export const getCanonicalPhonetic = getDuodecimalSolfege;
export const getCanonicalSyllable = getDuodecimalSyllable;
export const solfegeSequence = duodecimalSolfegeSequence;
export const solfegeString = duodecimalSolfegeString;
export const pitchClassFromSyllable = pitchClassFromDuodecimalSyllable;
