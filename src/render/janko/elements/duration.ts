/**
 * Notated-duration grammar (Round 30).
 *
 * Every written duration mark derives from the NOTATED duration on the
 * 48-grid by exact integer arithmetic — never by raw threshold. A duration is
 * *in grammar* when it reads exactly as a plain value, a dotted value
 * (`base × 1.5`) or a double-dotted value (`base × 1.75`); anything else is a
 * tie, a tuplet or a MIDI hold and keeps its current rendering under every
 * grammar (see {@link OUT_OF_GRAMMAR_DURATIONS} for the corpus census).
 *
 * The golden grammar (`'golden'`) is the incomplete incumbent: dots iff
 * `d ∈ (26, 38]`, flags/levels by raw threshold, lone longs bare. The
 * complete grammar (`'complete'`) is the Round 30 preview: dots for every
 * dotted value (doubly dotted doubly), flags/levels from the notated base,
 * and the bracket open rings stem-mounted on lone longs.
 */

import { JankoDurationGrammar } from '../types';

/**
 * Plain note values (ticks) on the 48-grid, 64th to double whole. A value of
 * exactly 1.5× one of them is *dotted*, exactly 1.75× is *double-dotted*.
 */
export const NOTATED_PLAIN_VALUES: readonly number[] = [3, 6, 12, 24, 48, 96, 192, 384];

/**
 * Corpus durations with no exact plain/dotted/double-dotted reading (Round 30
 * census, verified by exact factor check): ties and tuplets (63, 66, 117,
 * 120, 132, 138, 141, 156), tie-merged holds (108, 126, 150 — stacked LH
 * voices sharing one release past the notated grid), the 360-tick
 * tie-merged chord tone, and the 501-tick final-hold pedal tone. Every one of
 * them renders byte-identically under both grammars (pinned).
 */
export const OUT_OF_GRAMMAR_DURATIONS: readonly number[] = [
  63, 66, 108, 117, 120, 126, 132, 138, 141, 150, 156, 360, 501,
];

/** Exact reading of one duration: its plain base and its dot count. */
export interface NotatedDuration {
  /** The plain value the duration dots (itself when undotted). */
  base: number;
  /** Augmentation dots the value carries: 0, 1 or 2. */
  dots: 0 | 1 | 2;
  /** False for ties/tuplets/holds (see {@link OUT_OF_GRAMMAR_DURATIONS}). */
  inGrammar: boolean;
}

/**
 * Read one duration exactly: `d` is dotted iff `2d = 3p` and double-dotted
 * iff `4d = 7p` for a plain `p` — all integer arithmetic, no float factors.
 */
export function analyzeNotatedDuration(durationTicks: number): NotatedDuration {
  for (const p of NOTATED_PLAIN_VALUES) {
    if (durationTicks === p) return { base: p, dots: 0, inGrammar: true };
    if (2 * durationTicks === 3 * p) return { base: p, dots: 1, inGrammar: true };
    if (4 * durationTicks === 7 * p) return { base: p, dots: 2, inGrammar: true };
  }
  return { base: durationTicks, dots: 0, inGrammar: false };
}

/**
 * Augmentation dots one note's own stem paints (0–2).
 *
 * Golden: the legacy gate (dotted 8ths only). Complete: the notated dot
 * count; out-of-grammar durations paint none under both.
 */
export function durationDotCount(
  durationTicks: number,
  grammar: JankoDurationGrammar = 'golden'
): 0 | 1 | 2 {
  if (grammar !== 'complete') {
    return durationTicks > 26 && durationTicks <= 38 ? 1 : 0;
  }
  return analyzeNotatedDuration(durationTicks).dots;
}

/**
 * Subdivision marks (flags / beam levels beyond the primary) one duration
 * carries.
 *
 * Golden: the legacy raw thresholds (64th/32nd/16th/8th at 3/6/14/38).
 * Complete: the marks of the NOTATED base value — a double-dotted 16th
 * (21 ticks) carries two, a double-dotted 8th (42) one — so a beamed note
 * and a flagged note of the same value never disagree. Out-of-grammar
 * durations keep the legacy thresholds under both.
 */
export function durationFlagCount(
  durationTicks: number,
  grammar: JankoDurationGrammar = 'golden'
): number {
  const legacy = (d: number): number => {
    if (d <= 3) return 4;
    if (d <= 6) return 3;
    if (d <= 14) return 2;
    if (d <= 38) return 1;
    return 0;
  };
  if (grammar !== 'complete') return legacy(durationTicks);
  const { base, inGrammar } = analyzeNotatedDuration(durationTicks);
  if (!inGrammar) return legacy(durationTicks);
  if (base <= 3) return 4;
  if (base <= 6) return 3;
  if (base <= 14) return 2;
  if (base <= 26) return 1;
  return 0;
}

/**
 * Open stem rings a LONE note paints (0–2): one for a half, two stacked for
 * a whole — the standalone rings (`CLASP_RING_*`), stem-mounted. Dotted
 * and double-dotted longs ring by base (a dotted half rings once and dots
 * once). Golden: none, always. Out-of-grammar durations: none under both.
 */
export function durationRingCount(
  durationTicks: number,
  grammar: JankoDurationGrammar = 'golden'
): 0 | 1 | 2 {
  if (grammar !== 'complete') return 0;
  const { base, inGrammar } = analyzeNotatedDuration(durationTicks);
  if (!inGrammar) return 0;
  if (base >= 192) return 2;
  if (base >= 96) return 1;
  return 0;
}
