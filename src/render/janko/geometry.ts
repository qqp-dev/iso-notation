/**
 * Jánko Two-Row Engraving Geometry — pure mathematical core.
 *
 * Coordinate convention
 * ---------------------
 * Vertical coordinates are expressed **relative to the Middle C spine**
 * (y = 0) and grow **downward** (SVG convention):
 *
 * - octave 6 equator     -> -88.0pt   (dynamic ledger, outside the staff)
 * - octave 5 equator     -> -58.0pt   (outer upper staff rule)
 * - octave 4 equator     -> -28.0pt   (inner upper staff rule)
 * - Middle C spine       ->   0.0pt
 * - octave 3 equator     -> +28.0pt   (inner lower staff rule)
 * - octave 2 equator     -> +58.0pt   (outer lower staff rule)
 * - octave 1 equator     -> +88.0pt   (dynamic ledger, outside the staff)
 *
 * The lattice is **absolute and unified**: `getEquatorYForOctave` resolves one
 * global coordinate for every octave, identical for both hands. Octaves 2–5
 * are the continuous grand staff (four rules, `interStaffGap` between the two
 * inner rules) and never produce ledger lines; only octaves outside that span
 * accumulate *dynamic ledger equators*.
 *
 * Row parity (Jánko Equator Principle):
 * - whole-tone rank 0 (even pc) => `rowHeight / 2` **below** its equator;
 * - whole-tone rank 1 (odd pc)  => `rowHeight / 2` **above** its equator.
 *
 * Bounded Center Channel (`channelLayout: 'bounded-channel'`)
 * ----------------------------------------------------------
 * The single equator is replaced by two boundary rules at
 * `equator ± channelHalfWidth`. Whole-tone Set A (rank 0) then sits **inside**
 * the open channel (`offset 0.0`, zero line knockouts) and whole-tone Set B
 * (rank 1) takes a flanking row at `-channelFlankOffset` (above the upper rule)
 * or `+channelFlankOffset` (below the lower rule). Which flank a Set B note
 * takes is resolved **globally** by {@link resolveChannelFlanks}, which picks
 * the assignment that never contradicts the melodic contour (a rising step may
 * never move down the page, `Δpitch > 0 => Δy <= 0`, and vice versa).
 */

import { Hand } from '../../model/types';
import {
  JANKO_STAFF_OCTAVES,
  JankoStaffOctaveRange,
  JankoTokens,
  JankoLayoutOptions,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';

/** Whole-tone rank of a pitch class: 0 for evens, 1 for odds. */
export type JankoWholeToneRank = 0 | 1;

/**
 * Flank of the bounded center channel taken by a whole-tone Set B note:
 * `'up'` = the row above the upper boundary rule (`-channelFlankOffset`),
 * `'down'` = the row below the lower boundary rule (`+channelFlankOffset`).
 */
export type JankoChannelFlank = 'up' | 'down';

/** Which band of its octave a notehead occupies. */
export type JankoChannelSide = 'above' | 'below' | 'channel';

/** Both flanks, in canonical order (upper first). */
const CHANNEL_FLANKS: readonly JankoChannelFlank[] = ['up', 'down'];

/** Contour cost vector, compared lexicographically. See {@link resolveChannelFlanks}. */
type ChannelCost = readonly [contradictions: number, dishonours: number, zigzags: number, lowerFlanks: number];

const ZERO_COST: ChannelCost = [0, 0, 0, 0];
const INFINITE_COST: ChannelCost = [Infinity, Infinity, Infinity, Infinity];

function addCost(a: ChannelCost, b: ChannelCost): ChannelCost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];
}

function compareCost(a: ChannelCost, b: ChannelCost): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** Full geometric resolution of one pitch on the Jánko Two-Row staff. */
export interface JankoPitchCoordinate {
  pitchClass: number;
  octave: number;
  hand: Hand;
  /** Whole-tone rank: 0 = evens (row 0), 1 = odds (row 1). */
  rank: JankoWholeToneRank;
  /** Alias of {@link rank} (Jánko keyboard row index). */
  row: JankoWholeToneRank;
  /** Which band of its octave the notehead sits in. */
  side: JankoChannelSide;
  /**
   * Flank resolved for a Set B (odd) notehead under the bounded center
   * channel; `null` for Set A notes and for the single-equator layout.
   */
  flank: JankoChannelFlank | null;
  /** Signed offset from the equator (single equator: ±h/2; channel: 0 / ∓offset). */
  offsetFromEquator: number;
  /** y of this pitch's octave equator, relative to the Middle C spine. */
  equatorY: number;
  /** Notehead centre y relative to the Middle C spine (equatorY + offset). */
  y: number;
  /** True when the pitch's octave lies outside the grand staff (o2–o5). */
  isOutOfStaff: boolean;
  /** Equator ys of every ledger octave, nearest to the staff first. */
  ledgerYs: number[];
  /** Nearest ledger equator y, or null when the note sits inside the staff. */
  ledgerY: number | null;
}

/** Whole-tone rank: evens = 0 (Row 0), odds = 1 (Row 1). */
export function getWholeToneRank(pitchClass: number): JankoWholeToneRank {
  const pc = ((pitchClass % 12) + 12) % 12;
  return (pc % 2) as JankoWholeToneRank;
}

/**
 * Voice of a note: its explicit hand, or the register default (octave >= 4 is
 * played by the right hand). Shared by the layout engine and the contour.
 */
export function getNoteHand(hand: Hand | undefined, octave: number): Hand {
  return hand ?? (octave >= 4 ? 'RH' : 'LH');
}

/**
 * Signed offset from the octave equator under the bounded center channel.
 *
 * Whole-tone Set A (even pitch classes) sits **inside** the channel, exactly on
 * the equator (offset `0.0`, so nothing can cut through the glyph). Whole-tone
 * Set B (odd pitch classes) sits on the requested flank: `-channelFlankOffset`
 * above the upper boundary rule for `'up'`, `+channelFlankOffset` below the
 * lower rule for `'down'`.
 */
export function getChannelOffsetFromEquator(
  pitchClass: number,
  flank: JankoChannelFlank = 'up',
  tokens?: Partial<JankoTokens> | null
): number {
  const t = resolveJankoTokens(tokens);
  if (getWholeToneRank(pitchClass) === 0) return 0;
  return flank === 'down' ? t.channelFlankOffset : -t.channelFlankOffset;
}

/**
 * Signed row offset from the octave equator.
 *
 * Under the golden-master single equator the offset is pure parity: `+h/2`
 * below for even pitch classes, `-h/2` above for odd ones. Under the bounded
 * center channel the offset follows {@link getChannelOffsetFromEquator}, with
 * `flank` supplying the contour-resolved side of a Set B note (see
 * {@link resolveChannelFlanks}); `'up'` is the canonical fallback.
 */
export function getRowOffsetFromEquator(
  pitchClass: number,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null,
  flank?: JankoChannelFlank | null
): number {
  const o = resolveJankoOptions(options);
  if (o.channelLayout === 'bounded-channel') {
    return getChannelOffsetFromEquator(pitchClass, flank ?? 'up', tokens);
  }
  const t = resolveJankoTokens(tokens);
  const halfRow = t.rowHeight / 2;
  return getWholeToneRank(pitchClass) === 0 ? halfRow : -halfRow;
}

/**
 * Minimal melodic description the bounded-channel contour solver needs. A
 * quantized score note satisfies it structurally, so no mapping is required.
 */
export interface JankoChannelContourNote {
  id: string;
  pitch: { pitchClass: number; octave: number };
  startTick: number;
  /** Explicit hand; when omitted the register default applies (see {@link getNoteHand}). */
  hand?: Hand;
}

/** Absolute pitch in semitones, the ordering the contour is measured against. */
function absolutePitch(note: JankoChannelContourNote): number {
  const pc = ((note.pitch.pitchClass % 12) + 12) % 12;
  return note.pitch.octave * 12 + pc;
}

/**
 * Resolve the bounded-channel flank of **every** whole-tone Set B note of a
 * score, voice by voice, so that the engraved contour never contradicts the
 * pitch contour:
 *
 * ```
 * Δpitch > 0  =>  Δy <= 0   (a rising step is flat or moves up the page)
 * Δpitch < 0  =>  Δy >= 0   (a falling step is flat or moves down the page)
 * ```
 *
 * A Set B note can only sit on one of two rows (`∓channelFlankOffset`), so the
 * choice is a two-state shortest-path problem per voice; it is solved exactly
 * with a forward dynamic program over the score's notes in tick order. Among
 * the assignments that minimise contour contradictions the solver prefers, in
 * order: the flank the local melodic direction asks for, no zigzag on a
 * repeated pitch, and finally the canonical upper (odd-rank) flank.
 *
 * The result is a pure, deterministic function of the score and the tokens, so
 * the layout engine, the visual linter and the tests all agree. Under the
 * single-equator layout the map is empty (Set B keeps its parity offset).
 */
export function resolveChannelFlanks(
  notes: readonly JankoChannelContourNote[],
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): Map<string, JankoChannelFlank> {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const flanks = new Map<string, JankoChannelFlank>();
  if (o.channelLayout !== 'bounded-channel') return flanks;

  const rows: readonly number[] = [-t.channelFlankOffset, t.channelFlankOffset];

  for (const hand of ['RH', 'LH'] as const) {
    const voice = notes
      .filter((n) => getNoteHand(n.hand, n.pitch.octave) === hand)
      .sort((a, b) => a.startTick - b.startTick || absolutePitch(a) - absolutePitch(b));
    if (voice.length === 0) continue;

    // Absolute y of a note on one flank, relative to the Middle C spine: the
    // octave equator carries the register step, the flank carries the row.
    const yOf = (note: JankoChannelContourNote, state: number): number =>
      getEquatorYForOctave(note.pitch.octave, hand, t, o) +
      (getWholeToneRank(note.pitch.pitchClass) === 0 ? 0 : rows[state]);

    // cost[state] = cheapest contour so far, ending on flank `state`.
    let cost: ChannelCost[] = [ZERO_COST, ZERO_COST];
    const back: number[][] = [];

    for (let i = 0; i < voice.length; i++) {
      const note = voice[i];
      const prev = i > 0 ? voice[i - 1] : null;
      const inChannel = getWholeToneRank(note.pitch.pitchClass) === 0;
      const dPitch = prev ? absolutePitch(note) - absolutePitch(prev) : 0;
      const local: JankoChannelFlank | null =
        dPitch > 0 ? 'up' : dPitch < 0 ? 'down' : null;
      const next: ChannelCost[] = [INFINITE_COST, INFINITE_COST];
      const previous: number[] = [-1, -1];

      for (let state = 0; state < CHANNEL_FLANKS.length; state++) {
        const flank = CHANNEL_FLANKS[state];
        for (let prevState = 0; prevState < cost.length; prevState++) {
          const carried = cost[prevState];
          if (!Number.isFinite(carried[0])) continue;
          let step = ZERO_COST;
          if (prev) {
            const dy = yOf(note, state) - yOf(prev, prevState);
            step = [
              (dPitch > 0 && dy > 1e-9) || (dPitch < 0 && dy < -1e-9) ? 1 : 0,
              local !== null && !inChannel && flank !== local ? 1 : 0,
              dPitch === 0 && !inChannel && Math.abs(dy) > 1e-9 ? 1 : 0,
              !inChannel && flank === 'down' ? 1 : 0,
            ];
          } else if (!inChannel && flank === 'down') {
            // The opening sound opens on its canonical upper flank.
            step = [0, 1, 0, 1];
          }
          const candidate = addCost(carried, step);
          if (compareCost(candidate, next[state]) < 0) {
            next[state] = candidate;
            previous[state] = prevState;
          }
        }
      }

      back.push(previous);
      cost = next;
    }

    let state = compareCost(cost[0], cost[1]) <= 0 ? 0 : 1;
    for (let i = voice.length - 1; i >= 0; i--) {
      const note = voice[i];
      if (getWholeToneRank(note.pitch.pitchClass) === 1) {
        flanks.set(note.id, CHANNEL_FLANKS[state]);
      }
      const prevState = back[i][state];
      state = prevState < 0 ? 0 : prevState;
    }
  }

  return flanks;
}

/**
 * y of an octave equator **relative to the Middle C spine**.
 *
 * The lattice is **absolute and unified**: octave 4 is the inner staff rule
 * above the corridor (−halfGap), octave 3 the inner rule below it (+halfGap),
 * and every further octave steps by exactly `octaveStep`. The result is
 * identical for both hands, so a pitch's height never depends on which hand
 * plays it:
 *
 * - `octave >= 4` → `-halfGap - (octave - 4) * octaveStep`
 * - `octave <= 3` → `+halfGap + (3 - octave) * octaveStep`
 *
 * @param hand Accepted for call-site compatibility; the unified lattice makes
 *             the resolved coordinate hand-independent.
 */
export function getEquatorYForOctave(
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): number {
  void hand;
  const t = resolveJankoTokens(tokens);
  const o = resolveJankoOptions(options);
  const halfGap = o.interStaffGap / 2;
  return octave >= 4
    ? -halfGap - (octave - 4) * t.octaveStep
    : halfGap + (3 - octave) * t.octaveStep;
}

/**
 * True when `octave` lies outside the grand staff.
 *
 * The staff is the absolute span o2–o5 (four continuous rules shared by both
 * hands), so the test is strictly `octave < 2 || octave > 5` — never a
 * hand-specific range.
 *
 * @param hand Accepted for call-site compatibility; the staff span is shared.
 */
export function isOutOfStaffOctave(octave: number, hand?: Hand): boolean {
  void hand;
  const [minOct, maxOct] = JANKO_STAFF_OCTAVES;
  return octave < minOct || octave > maxOct;
}

/**
 * Dynamic ledger equators for a pitch: every octave equator between the grand
 * staff and the note's own octave, nearest to the staff first. Returns `[]`
 * for every in-staff octave (o2–o5), which never needs a ledger line.
 */
export function getLedgerEquators(
  _pitchClass: number,
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): number[] {
  const [minOct, maxOct] = JANKO_STAFF_OCTAVES;
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
 * on a page. Under the bounded center channel, `flank` carries the
 * contour-resolved side of a Set B note (see {@link resolveChannelFlanks}).
 */
export function getPitchCoordinate(
  pitchClass: number,
  octave: number,
  hand: Hand,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null,
  flank?: JankoChannelFlank | null
): JankoPitchCoordinate {
  const o = resolveJankoOptions(options);
  const pc = ((pitchClass % 12) + 12) % 12;
  const rank = getWholeToneRank(pc);
  const bounded = o.channelLayout === 'bounded-channel';
  const resolvedFlank: JankoChannelFlank | null = bounded && rank === 1 ? flank ?? 'up' : null;
  const offsetFromEquator = getRowOffsetFromEquator(pc, tokens, o, resolvedFlank);
  const equatorY = getEquatorYForOctave(octave, hand, tokens, o);
  const ledgerYs = getLedgerEquators(pc, octave, hand, tokens, o);
  const side: JankoChannelSide = bounded
    ? rank === 0
      ? 'channel'
      : resolvedFlank === 'down'
        ? 'below'
        : 'above'
    : rank === 0
      ? 'below'
      : 'above';
  return {
    pitchClass: pc,
    octave,
    hand,
    rank,
    row: rank,
    side,
    flank: resolvedFlank,
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

export type { JankoStaffOctaveRange };
