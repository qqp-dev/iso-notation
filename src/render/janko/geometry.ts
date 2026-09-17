/**
 * Jánko Two-Row Engraving Geometry — pure mathematical core.
 *
 * Coordinate convention
 * ---------------------
 * Vertical coordinates are expressed **relative to the Middle C spine**
 * (y = 0) and grow **downward** (SVG convention):
 *
 * - octave 6 equator     -> -75.0pt   (dynamic ledger, outside the staff)
 * - octave 5 equator     -> -45.0pt   (outer upper staff rule)
 * - octave 4 equator     -> -15.0pt   (inner upper staff rule)
 * - Middle C spine       ->   0.0pt
 * - octave 3 equator     -> +15.0pt   (inner lower staff rule)
 * - octave 2 equator     -> +45.0pt   (outer lower staff rule)
 * - octave 1 equator     -> +75.0pt   (dynamic ledger, outside the staff)
 *
 * The lattice is **absolute and unified**: `getEquatorYForOctave` resolves one
 * global coordinate for every octave, identical for both hands. Round 11
 * equalizes `interStaffGap` to `octaveStep` (30pt), so the equators are
 * uniformly spaced everywhere — Octave 5 (−45), Octave 4 (−15), Middle C (0),
 * Octave 3 (+15), Octave 2 (+45) — and the corridor is no wider than any other
 * octave step. Octaves 2–5 are the continuous grand staff (four rules) and
 * never produce ledger lines; only octaves outside that span accumulate
 * *dynamic ledger equators*.
 *
 * Row parity (Jánko Equator Principle, golden-master `'single-equator'`):
 * - whole-tone rank 0 (even pc) => `rowHeight / 2` **below** its equator;
 * - whole-tone rank 1 (odd pc)  => `rowHeight / 2` **above** its equator.
 *
 * Row framing (`channelLayout`)
 * ----------------------------
 * Four paradigms share the one octave lattice:
 *
 * | layout               | Set A (even pc)          | Set B (odd pc)                     | rules |
 * | -------------------- | ------------------------ | ---------------------------------- | ----- |
 * | `'single-equator'`   | `+h/2` (below the rule)  | `-h/2` (above), static parity      | 1     |
 * | `'on-the-line'`      | `0` (on the rule)        | `-h` (above), static               | 1     |
 * | `'single-line-3row'` | `0` (on the rule)        | `∓h`, contour-resolved             | 1     |
 * | `'bounded-channel'`  | `0` (inside the channel) | `∓channelFlankOffset`, contour-resolved | 2 |
 *
 * `h` is `rowHeight` (15pt), so every static step between neighbouring rows is
 * exactly one whole-tone row. The two **dynamic** layouts — `'single-line-3row'`
 * and `'bounded-channel'` — resolve the side of every Set B note **globally**
 * with {@link resolveChannelFlanks}, which picks the assignment that never
 * contradicts the melodic contour (a rising step may never move down the page,
 * `Δpitch > 0 => Δy <= 0`, and vice versa). The two static layouts anchor Set B
 * on a single row and therefore need no solver.
 *
 * Under `'bounded-channel'` the single equator is replaced by two boundary
 * rules at `equator ± channelHalfWidth`, so whole-tone Set A sits in the open
 * negative space (`offset 0.0`, zero line knockouts) and Set B takes a flanking
 * row at `-channelFlankOffset` (above the upper rule) or `+channelFlankOffset`
 * (below the lower rule).
 */

import { Hand, QuantizedGridScore, QuantizedNote } from '../../model/types';
import {
  JANKO_CHANNEL_LAYOUT_LABELS,
  JANKO_STAFF_OCTAVES,
  JankoChannelLayout,
  JankoCore,
  JankoStaffOctaveRange,
  JankoTokens,
  JankoLayoutOptions,
  ResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';

/** Whole-tone rank of a pitch class: 0 for evens, 1 for odds. */
export type JankoWholeToneRank = 0 | 1;

/**
 * The two channel layouts whose Set B row is resolved by the melodic contour
 * (`'single-line-3row'`, `'bounded-channel'`), as opposed to the static
 * `'single-equator'` and `'on-the-line'` framings.
 */
export type JankoDynamicChannelLayout = 'single-line-3row' | 'bounded-channel';

/** True when the layout resolves Set B against the melodic contour. */
export function usesContourFlanks(layout: JankoChannelLayout): layout is JankoDynamicChannelLayout {
  return layout === 'single-line-3row' || layout === 'bounded-channel';
}

/**
 * Magnitude of the Set B flank offset for a dynamic layout: one whole-tone row
 * (`rowHeight`, 15pt) for `'single-line-3row'`, `channelFlankOffset` (13pt, the
 * exact mirror of the 6.5pt channel) for `'bounded-channel'`.
 */
export function getFlankOffset(
  layout: JankoChannelLayout,
  tokens?: Partial<JankoTokens> | null
): number {
  const t = resolveJankoTokens(tokens);
  return layout === 'bounded-channel' ? t.channelFlankOffset : t.rowHeight;
}

/**
 * Fully resolved geometric description of one channel layout — the single
 * source of truth shared by the renderers, the studio and the tests.
 */
export interface JankoChannelLayoutSpec {
  layout: JankoChannelLayout;
  /** Human-readable name of the framing. */
  label: string;
  /** Boundary rules painted per octave equator (1, or 2 for the channel). */
  rulesPerEquator: number;
  /** Rules painted across the four-octave grand staff (4, or 8 for the channel). */
  staffRules: number;
  /** Signed offset of the whole-tone Set A row from its equator. */
  setAOffset: number;
  /** Signed offset of the canonical (upper) Set B row from its equator. */
  setBOffset: number;
  /** Magnitude of the Set B row offset (the lower row mirrors it). */
  flankMagnitude: number;
  /** True when the side of a Set B note is resolved by the melodic contour. */
  dynamicFlanks: boolean;
  /**
   * True when a Set A notehead sits exactly on a boundary rule and its knockout
   * therefore cuts the rule (`'on-the-line'`, `'single-line-3row'`). False for
   * the floating equator and for the bounded channel, whose Set A row is clear
   * of every rule.
   */
  setAOnRule: boolean;
}

/**
 * Resolve the complete geometric description of a channel layout, including
 * the rule count that answers the round's visual-density question:
 * `'single-equator'`, `'on-the-line'` and `'single-line-3row'` all paint **one**
 * rule per octave (4 across the staff), while `'bounded-channel'` paints two
 * (8 across the staff).
 */
export function getChannelLayoutSpec(
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): JankoChannelLayoutSpec {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const layout = o.channelLayout;
  const halfRow = t.rowHeight / 2;
  const octaves = JANKO_STAFF_OCTAVES[1] - JANKO_STAFF_OCTAVES[0] + 1;
  const rulesPerEquator = layout === 'bounded-channel' ? 2 : 1;
  // Set A floats below the incumbent equator, and sits on it in every
  // anchored framing. Set B is either the parity row above (`-h/2`), the
  // static row one whole-tone step above (`-h`), or the dynamic flank.
  const setAOffset = layout === 'single-equator' ? halfRow : 0;
  const setBOffset =
    layout === 'single-equator'
      ? -halfRow
      : layout === 'on-the-line'
        ? -t.rowHeight
        : -getFlankOffset(layout, t);
  return {
    layout,
    label: JANKO_CHANNEL_LAYOUT_LABELS[layout],
    rulesPerEquator,
    staffRules: rulesPerEquator * octaves,
    setAOffset,
    setBOffset,
    flankMagnitude: Math.abs(setBOffset),
    dynamicFlanks: usesContourFlanks(layout),
    setAOnRule: layout === 'on-the-line' || layout === 'single-line-3row',
  };
}

/**
 * Flank of a dynamic channel layout taken by a whole-tone Set B note:
 * `'up'` = the row above (`-flankOffset`), `'down'` = the row below
 * (`+flankOffset`). The offset itself is `channelFlankOffset` (13pt) under the
 * bounded channel and `rowHeight` (15pt) under the single-line 3-row layout.
 */
export type JankoChannelFlank = 'up' | 'down';

/**
 * Which band of its octave a notehead occupies: `'channel'` is the anchored
 * base row (offset 0) of every non-`'single-equator'` layout — on the rule for
 * `'on-the-line'` and `'single-line-3row'`, inside the two boundary rules for
 * `'bounded-channel'` — while `'above'`/`'below'` name the Set B side.
 */
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
   * Flank of a Set B (odd) notehead: contour-resolved under a dynamic layout,
   * the canonical upper row under `'on-the-line'`; `null` for Set A notes and
   * for the `'single-equator'` parity framing.
   */
  flank: JankoChannelFlank | null;
  /**
   * Signed offset from the equator: `±h/2` for the single equator, `0` for the
   * anchored Set A row, `-h` for the static `'on-the-line'` Set B row, and
   * `0 / ∓flankOffset` for the two dynamic layouts.
   */
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

// ---------------------------------------------------------------------------
// Continuous pitch height (the pitch-mapping round)
// ---------------------------------------------------------------------------

/**
 * Linear pitch of the staff's Middle C line: middle C the note (linear 48).
 * Every continuous mapping pins C4 exactly onto `middleCY` — the landscape
 * benchmark's spine-at-pitch-48 — so C4 heads are pierced by the anchor with
 * knockout holes (standard middle-C ledger behavior) and B3 stands a full
 * semitone below it.
 */
export const CONTINUOUS_PITCH_ANCHOR_LIN = 48;

/**
 * Fallback pitch window (semitones) when a score is unavailable: C2–C6, the
 * four-octave grand span. Score-aware callers always use the score's own
 * range instead (see {@link pitchWindowForScore}).
 */
export const DEFAULT_PITCH_WINDOW: { readonly min: number; readonly max: number } = {
  min: 24,
  max: 72,
};

/**
 * Continuous pitch height of one linear pitch, relative to the Middle C
 * line: every semitone higher stands exactly `scale` pt higher on the page.
 */
export function continuousPitchY(lin: number, scale: number): number {
  return -(lin - CONTINUOUS_PITCH_ANCHOR_LIN) * scale;
}

/**
 * Compute the octave fold shift in semitones (Round 27).
 *
 * - `fixed-3` (C3–C5, C-lines at 36, 48, 60):
 *   Core coverage [30, 66]. Core±1 extensions at 24 and 72 cover [18, 78].
 *   Notes with lin < 18 or lin > 78 fold by ∓12 (↑10/↓10) or ∓24 (↑20/↓20).
 * - `fixed-4` (o2–o5 middles at 29.5, 41.5, 53.5, 65.5):
 *   Core coverage [23.5, 71.5]. Core±1 extensions at 17.5 and 77.5 cover [12, 83.5].
 *   Notes with lin < 12 or lin > 83.5 fold by ∓12 (↑10/↓10) or ∓24 (↑20/↓20).
 * - `adaptive`: 0 (no folding).
 */
export function computeFoldShift(lin: number, core?: JankoCore): number {
  if (core === 'fixed-3') {
    if (lin < 18) {
      return lin + 12 < 18 ? 24 : 12;
    }
    if (lin > 78) {
      return lin - 12 > 78 ? -24 : -12;
    }
    return 0;
  }
  if (core === 'fixed-4') {
    if (lin < 12) {
      return lin + 12 < 12 ? 24 : 12;
    }
    if (lin > 83.5) {
      return lin - 12 > 83.5 ? -24 : -12;
    }
    return 0;
  }
  return 0;
}

/** Exact linear-pitch range of a score: the continuous window. */
export function pitchWindowForScore(score: QuantizedGridScore): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const n of score.notes) {
    const pc = ((n.pitch.pitchClass % 12) + 12) % 12;
    const lin = n.pitch.octave * 12 + pc;
    if (lin < min) min = lin;
    if (lin > max) max = lin;
  }
  if (!Number.isFinite(min)) return { min: 48, max: 48 };
  return { min, max };
}

/**
 * Voice of a note: its explicit hand, or the register default (octave >= 4 is
 * played by the right hand). Shared by the layout engine and the contour.
 */
export function getNoteHand(hand: Hand | undefined, octave: number): Hand {
  return hand ?? (octave >= 4 ? 'RH' : 'LH');
}

/**
 * Signed offset from the octave equator under a dynamic flank layout.
 *
 * Whole-tone Set A (even pitch classes) sits exactly on the equator (offset
 * `0.0`, so nothing can cut through the glyph). Whole-tone Set B (odd pitch
 * classes) sits on the requested flank: `-offset` above for `'up'`, `+offset`
 * below for `'down'`, where the offset is `channelFlankOffset` (13pt) under the
 * bounded channel and one whole-tone row (`rowHeight`, 15pt) under the
 * single-line 3-row layout.
 */
export function getChannelOffsetFromEquator(
  pitchClass: number,
  flank: JankoChannelFlank = 'up',
  tokens?: Partial<JankoTokens> | null,
  layout: JankoChannelLayout = 'bounded-channel'
): number {
  const t = resolveJankoTokens(tokens);
  if (getWholeToneRank(pitchClass) === 0) return 0;
  const offset = getFlankOffset(layout, t);
  return flank === 'down' ? offset : -offset;
}

/**
 * Signed row offset from the octave equator.
 *
 * - `'single-equator'` — pure parity: `+h/2` below the rule for even pitch
 *   classes, `-h/2` above it for odd ones.
 * - `'on-the-line'` — Set A sits on the rule (`0`), Set B statically one
 *   whole-tone row above it (`-h`): the anchored 2-row framing.
 * - `'single-line-3row'` / `'bounded-channel'` — Set A sits on the equator
 *   (`0`) and Set B follows {@link getChannelOffsetFromEquator}, with `flank`
 *   supplying the contour-resolved side (see {@link resolveChannelFlanks});
 *   `'up'` is the canonical fallback.
 */
export function getRowOffsetFromEquator(
  pitchClass: number,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null,
  flank?: JankoChannelFlank | null
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const layout = o.channelLayout;
  if (usesContourFlanks(layout)) {
    return getChannelOffsetFromEquator(pitchClass, flank ?? 'up', t, layout);
  }
  if (layout === 'on-the-line') {
    return getWholeToneRank(pitchClass) === 0 ? 0 : -t.rowHeight;
  }
  const halfRow = t.rowHeight / 2;
  return getWholeToneRank(pitchClass) === 0 ? halfRow : -halfRow;
}

/**
 * Minimal melodic description a dynamic-flank contour solver needs. A
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
 * Resolve the flank of **every** whole-tone Set B note of a score, voice by
 * voice, under a dynamic layout (`'single-line-3row'` or `'bounded-channel'`),
 * so that the engraved contour never contradicts the pitch contour:
 *
 * ```
 * Δpitch > 0  =>  Δy <= 0   (a rising step is flat or moves up the page)
 * Δpitch < 0  =>  Δy >= 0   (a falling step is flat or moves down the page)
 * ```
 *
 * A Set B note can only sit on one of two rows (`∓flankOffset`), so the choice
 * is a two-state shortest-path problem per voice; it is solved exactly with a
 * forward dynamic program over the score's notes in tick order. Among the
 * assignments that minimise contour contradictions the solver prefers, in
 * order: the flank the local melodic direction asks for, no zigzag on a
 * repeated pitch, and finally the canonical upper (odd-rank) flank.
 *
 * The result is a pure, deterministic function of the score and the tokens, so
 * the layout engine, the visual linter and the tests all agree. Under the two
 * static layouts (`'single-equator'`, `'on-the-line'`) the map is empty because
 * Set B is anchored on one row by construction.
 */
export function resolveChannelFlanks(
  notes: readonly JankoChannelContourNote[],
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): Map<string, JankoChannelFlank> {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const flanks = new Map<string, JankoChannelFlank>();
  if (!usesContourFlanks(o.channelLayout)) return flanks;

  const flankOffset = getFlankOffset(o.channelLayout, t);
  const rows: readonly number[] = [-flankOffset, flankOffset];

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
 * and every further octave steps by exactly `octaveStep`. Round 11 sets
 * `interStaffGap = octaveStep = 30pt`, so `halfGap` is 15pt and the whole
 * lattice is uniformly spaced by 30pt: o5 −45, o4 −15, Middle C 0, o3 +15,
 * o2 +45. The result is identical for both hands, so a pitch's height never
 * depends on which hand plays it:
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
  if (o.pitchMapping !== 'twin-rows' || o.core === 'fixed-3' || o.core === 'fixed-4') {
    // Vestigial under the continuous mappings (the grid has no equators):
    // the octave-center height, so head-relative furniture that still asks
    // for an equator degrades gracefully instead of landing on stale rows.
    return continuousPitchY(octave * 12 + 5.5, t.semitoneScale);
  }
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
 * on a page. Under the dynamic layouts (`'single-line-3row'`,
 * `'bounded-channel'`) `flank` carries the contour-resolved side of a Set B
 * note (see {@link resolveChannelFlanks}); the static `'on-the-line'` layout
 * always anchors Set B on its upper row.
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
  const isContinuous =
    o.pitchMapping !== 'twin-rows' ||
    o.core === 'fixed-3' ||
    o.core === 'fixed-4';
  if (isContinuous) {
    // Continuous height: the head stands at its exact pitch, its own
    // equator (offset 0), with no rows, no ledgers and nothing out of staff.
    // Rank/row/side stay parity facts so head-relative consumers keep working.
    const t = resolveJankoTokens(tokens);
    const origLin = octave * 12 + pc;
    const shift = computeFoldShift(origLin, o.core);
    const writtenLin = origLin + shift;
    const writtenOctave = Math.floor(writtenLin / 12);
    const y = continuousPitchY(writtenLin, t.semitoneScale);
    const rank = getWholeToneRank(pc);
    return {
      pitchClass: pc,
      octave: writtenOctave,
      hand,
      rank,
      row: rank,
      side: rank === 0 ? 'below' : 'above',
      flank: null,
      offsetFromEquator: 0,
      equatorY: y,
      y,
      isOutOfStaff: false,
      ledgerYs: [],
      ledgerY: null,
    };
  }
  const rank = getWholeToneRank(pc);
  const layout = o.channelLayout;
  const dynamic = usesContourFlanks(layout);
  // `'on-the-line'` is static: Set B is always the upper row. The dynamic
  // layouts take the contour-resolved flank (canonical upper when unresolved).
  const resolvedFlank: JankoChannelFlank | null =
    rank === 1 && layout !== 'single-equator' ? (dynamic ? flank ?? 'up' : 'up') : null;
  const offsetFromEquator = getRowOffsetFromEquator(pc, tokens, o, resolvedFlank);
  const equatorY = getEquatorYForOctave(octave, hand, tokens, o);
  const ledgerYs = getLedgerEquators(pc, octave, hand, tokens, o);
  const side: JankoChannelSide =
    rank === 0
      ? layout === 'single-equator'
        ? 'below'
        : 'channel'
      : resolvedFlank === 'down'
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
  const anacrusis = t.anacrusisTicks ?? 0;
  if (anacrusis > 0) {
    if (tick < anacrusis) {
      return { measureOffset: 0, tickInMeasure: tick };
    }
    const elapsed = tick - anacrusis;
    const measureOffset = 1 + Math.floor(elapsed / t.ticksPerMeasure);
    const tickInMeasure = ((elapsed % t.ticksPerMeasure) + t.ticksPerMeasure) % t.ticksPerMeasure;
    return { measureOffset, tickInMeasure };
  }
  const measureOffset = Math.floor(tick / t.ticksPerMeasure);
  const tickInMeasure = ((tick % t.ticksPerMeasure) + t.ticksPerMeasure) % t.ticksPerMeasure;
  return { measureOffset, tickInMeasure };
}

/** Measure index (inside its system) of a note's onset. */
export function getMeasureIndexOfTick(
  note: QuantizedNote,
  geo: { measuresPerSystem: number },
  systemIndex: number,
  t: ResolvedJankoTokens
): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  if (anacrusis > 0) {
    if (systemIndex === 0) {
      if (note.startTick < anacrusis) return 0;
      const elapsed = note.startTick - anacrusis;
      return 1 + Math.floor(elapsed / t.ticksPerMeasure);
    }
    const elapsed = note.startTick - anacrusis;
    const measureOffset = Math.floor(elapsed / t.ticksPerMeasure);
    return measureOffset - systemIndex * geo.measuresPerSystem;
  }
  const { measureOffset } = splitTick(note.startTick, t);
  return measureOffset - systemIndex * geo.measuresPerSystem;
}

/**
 * Distance from a point to a line segment. Shared by the visual linter's
 * stem-through audit and the engine's Pass C stem-clearance, which predicts
 * piercing with the exact predicate the audit applies — prediction and audit
 * can never disagree.
 */
export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  if (len2 <= 1e-6) return Math.hypot(px - x1, py - y1);
  const tt = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + tt * vx), py - (y1 + tt * vy));
}

export type { JankoStaffOctaveRange };
