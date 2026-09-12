/**
 * Jánko Two-Row Engraving Geometry — pure mathematical core.
 *
 * Coordinate convention
 * ---------------------
 * Vertical coordinates are expressed **relative to the Middle C spine**
 * (y = 0) and grow **downward** (SVG convention):
 *
 * - RH octave 5 equator  -> -52.5pt   (interStaffGap 45 => ±22.5pt half gap)
 * - RH octave 4 equator  -> -22.5pt
 * - Middle C spine       ->   0.0pt
 * - LH octave 3 equator  -> +22.5pt
 * - LH octave 2 equator  -> +52.5pt
 *
 * Each hand anchors its own whole-tone lattice on its two home equators and
 * extends it by `octaveStep` (2h = 30pt) per octave. Out-of-staff octaves
 * therefore produce *dynamic ledger equators* on the hand's own lattice.
 *
 * Row parity (Jánko Equator Principle):
 * - whole-tone rank 0 (even pc) => `rowHeight / 2` **below** its equator;
 * - whole-tone rank 1 (odd pc)  => `rowHeight / 2` **above** its equator.
 */

import { Hand } from '../../model/types';
import {
  JANKO_HOME_OCTAVES,
  JankoHomeOctaveRange,
  JankoTokens,
  JankoLayoutOptions,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';

/** Whole-tone rank of a pitch class: 0 for evens, 1 for odds. */
export type JankoWholeToneRank = 0 | 1;

/** Full geometric resolution of one pitch on the Jánko Two-Row staff. */
export interface JankoPitchCoordinate {
  pitchClass: number;
  octave: number;
  hand: Hand;
  /** Whole-tone rank: 0 = evens (row 0), 1 = odds (row 1). */
  rank: JankoWholeToneRank;
  /** Alias of {@link rank} (Jánko keyboard row index). */
  row: JankoWholeToneRank;
  /** Which side of the octave equator the notehead sits on. */
  side: 'above' | 'below';
  /** Signed offset from the equator (-h/2 above, +h/2 below). */
  offsetFromEquator: number;
  /** y of this pitch's octave equator, relative to the Middle C spine. */
  equatorY: number;
  /** Notehead centre y relative to the Middle C spine (equatorY + offset). */
  y: number;
  /** True when the pitch's octave lies outside the hand's home staff. */
  isOutOfStaff: boolean;
  /** Equator ys of every ledger octave, nearest to the staff first. */
  ledgerYs: number[];
  /** Nearest ledger equator y, or null when the note sits on the home staff. */
  ledgerY: number | null;
}

/** Whole-tone rank: evens = 0 (Row 0), odds = 1 (Row 1). */
export function getWholeToneRank(pitchClass: number): JankoWholeToneRank {
  const pc = ((pitchClass % 12) + 12) % 12;
  return (pc % 2) as JankoWholeToneRank;
}

/** Signed row offset from the octave equator (+h/2 below, -h/2 above). */
export function getRowOffsetFromEquator(
  pitchClass: number,
  tokens?: Partial<JankoTokens> | null
): number {
  const t = resolveJankoTokens(tokens);
  const halfRow = t.rowHeight / 2;
  return getWholeToneRank(pitchClass) === 0 ? halfRow : -halfRow;
}

/**
 * y of an octave equator **relative to the Middle C spine** for one hand.
 *
 * RH home equators are octaves 4 (inner) and 5 (outer); LH home equators are
 * octaves 3 (inner) and 2 (outer). The lattice step is always `octaveStep`.
 */
export function getEquatorYForOctave(
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): number {
  const t = resolveJankoTokens(tokens);
  const o = resolveJankoOptions(options);
  const halfGap = o.interStaffGap / 2;
  if (hand === 'RH') {
    // o4 is the RH inner equator; higher octaves climb upward (negative y).
    return -halfGap - (octave - 4) * t.octaveStep;
  }
  // o3 is the LH inner equator; lower octaves descend (positive y).
  return halfGap + (3 - octave) * t.octaveStep;
}

/** True when `octave` lies outside the hand's two home (in-staff) equators. */
export function isOutOfStaffOctave(octave: number, hand: Hand): boolean {
  const [minOct, maxOct] = JANKO_HOME_OCTAVES[hand];
  return octave < minOct || octave > maxOct;
}

/**
 * Dynamic ledger equators for a pitch: every octave equator between the hand's
 * home staff and the note's own octave, nearest to the staff first.
 */
export function getLedgerEquators(
  _pitchClass: number,
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): number[] {
  const [minOct, maxOct] = JANKO_HOME_OCTAVES[hand];
  const out: number[] = [];
  if (octave > maxOct) {
    for (let o = maxOct + 1; o <= octave; o++) {
      out.push(getEquatorYForOctave(o, hand, tokens, options));
    }
  } else if (octave < minOct) {
    for (let o = minOct - 1; o >= octave; o--) {
      out.push(getEquatorYForOctave(o, hand, tokens, options));
    }
  }
  return out;
}

/**
 * Pure pitch -> engraving coordinate resolver.
 *
 * The returned `y`/`equatorY` are relative to the Middle C spine; add the
 * system's absolute `middleCY` (see `JankoSystemGeometry`) to place the note
 * on a page.
 */
export function getPitchCoordinate(
  pitchClass: number,
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): JankoPitchCoordinate {
  const pc = ((pitchClass % 12) + 12) % 12;
  const rank = getWholeToneRank(pc);
  const offsetFromEquator = getRowOffsetFromEquator(pc, tokens);
  const equatorY = getEquatorYForOctave(octave, hand, tokens, options);
  const ledgerYs = getLedgerEquators(pc, octave, hand, tokens, options);
  return {
    pitchClass: pc,
    octave,
    hand,
    rank,
    row: rank,
    side: rank === 0 ? 'below' : 'above',
    offsetFromEquator,
    equatorY,
    y: equatorY + offsetFromEquator,
    isOutOfStaff: isOutOfStaffOctave(octave, hand),
    ledgerYs,
    ledgerY: ledgerYs.length > 0 ? ledgerYs[0] : null,
  };
}

/** Absolute page y for a pitch coordinate, given the system's Middle C spine y. */
export function toAbsolutePitchY(coord: JankoPitchCoordinate, middleCY: number): number {
  return middleCY + coord.y;
}

/** Absolute page y for one of a pitch's ledger equators. */
export function toAbsoluteLedgerY(coord: JankoPitchCoordinate, ledgerIndex: number, middleCY: number): number {
  return middleCY + (coord.ledgerYs[ledgerIndex] ?? coord.equatorY);
}

/** Absolute x of a measure's left edge inside the staff column. */
export function getMeasureX(measureIdx: number, measureW: number): number {
  return measureIdx * measureW;
}

/** Custom inset overrides for {@link getTickX}. */
export interface JankoTickInsets {
  left?: number;
  right?: number;
}

/**
 * Horizontal x of a tick, relative to the left edge of the staff column.
 *
 * `tick` is the absolute score tick (used as a fallback when `tickInMeasure`
 * is not supplied); `measureIdx` is the measure index inside the system.
 * `measureW` is the engraved measure width. Notes are inset by
 * `tokens.measureInset` on both sides, or by the supplied custom insets
 * (used by the opening measure to clear the time signature).
 */
export function getTickX(
  tick: number,
  measureIdx: number,
  tickInMeasure: number,
  measureW: number,
  tokens?: Partial<JankoTokens> | null,
  insets?: JankoTickInsets
): number {
  const t = resolveJankoTokens(tokens);
  const ticksPerMeasure = t.ticksPerMeasure;
  const left = insets?.left ?? t.measureInset;
  const right = insets?.right ?? t.measureInset;
  const available = Math.max(0, measureW - left - right);
  const inMeasure =
    Number.isFinite(tickInMeasure)
      ? ((tickInMeasure % ticksPerMeasure) + ticksPerMeasure) % ticksPerMeasure
      : ((tick % ticksPerMeasure) + ticksPerMeasure) % ticksPerMeasure;
  return measureIdx * measureW + left + (inMeasure / ticksPerMeasure) * available;
}

/** Split an absolute score tick into (measure offset, in-measure tick). */
export function splitTick(
  tick: number,
  tokens?: Partial<JankoTokens> | null
): { measureOffset: number; tickInMeasure: number } {
  const t = resolveJankoTokens(tokens);
  const measureOffset = Math.floor(tick / t.ticksPerMeasure);
  const tickInMeasure = ((tick % t.ticksPerMeasure) + t.ticksPerMeasure) % t.ticksPerMeasure;
  return { measureOffset, tickInMeasure };
}

export type { JankoHomeOctaveRange };
