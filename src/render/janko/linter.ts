/**
 * Jánko Implementer Visual Linter
 * ===============================
 *
 * Headless implementers cannot *see* an engraving, and rasterizing one just to
 * notice that two noteheads touch is a slow feedback loop. This module verifies
 * the aesthetics of a Jánko Two-Row engraving **mathematically**, in
 * milliseconds, over the exact same layout model the renderer uses
 * ({@link layoutJankoScore}) plus a paint-order audit of the emitted SVG.
 *
 * Checked invariants
 * ------------------
 * 1. **Knockout protection** — every duodecimal digit owns an opaque white
 *    rectangular mask, the glyph's ink box fits inside that box with the
 *    preset margin of white on every side, and nothing painted after the mask
 *    (staff rules, row guidelines, ledger equators, beat grid, stems, beams,
 *    barlines) may cut through it. This is the invariant that guarantees
 *    "zero staff/beat line pass-through".
 * 2. **Collision & clearance** — notehead *mask boxes* may not overlap: a chord
 *    is allowed to stack on different whole-tone rows, and two tones that share
 *    one row of one octave are resolved by the engine's Row-Snapped Parity
 *    Offset (Approach 2), which fans them horizontally at the active
 *    cluster-spacing preset. Same-onset mask neighbours whose boxes still
 *    overlap are surfaced as `chordal-overlap`; every other overlapping pair
 *    is a hard `notehead-overlap`, and nothing may collide with a barline.
 * 3. **Corridor & guideline integrity** — the Middle C channel stays free of
 *    structural rules and beams, and the spine is never cut by a glyph.
 * 4. **Beam & stem validity** — stems attach *flush on the outside* of their
 *    glyph (the halo ring at tick 0, the rectangular mask edge otherwise), stay
 *    clear of their own digit by a real margin, never pierce the Position of
 *    Honor halo, sit on their notehead's vertical centreline (`stemX ===
 *    note.x`) and reach the beam centerline exactly (no overshoot, no gap);
 *    every beam connector stays a minimum clearance away from every notehead
 *    disc (`beam-notehead-collision`), and every beam slope stays inside the
 *    acceptable threshold.
 * 5. **Accolade & measure numeral clearances** — the left-margin furniture
 *    never collides with the music or with itself.
 * 6. **Rest clearance** (Round 12, hung from its phrase row by Round 17B) —
 *    a voice rest's own dialect ink box keeps real air from every foreign
 *    notehead disc and from any protected barline; a silence the fit rule
 *    refused is republished as the named `rest-unwritable` diagnostic. A
 *    bridged beam clears every printed rest's ink (`beam-rest-clearance`).
 * 7. **Simultaneity integrity** (Round 14) — no painted stem or beam connector
 *    of one chord tone may pass through the notehead disc of a **same-onset**
 *    tone (`stem-through-simultaneity`). The defect that a wide-span chord
 *    falls into whenever the chord-grouping paradigm stops unifying it.
 *
 * Usage
 * -----
 * ```ts
 * const report = lintJankoScore(score, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
 * if (!report.ok) for (const v of report.violations) console.error(v.message);
 * ```
 */

import { QuantizedGridScore } from '../../model/types';
import {
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoPageGeometry,
  JankoSystemStartStyle,
  JankoTokens,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  getClusterSpacingPreset,
  getGridNoteInset,
  protectsBarlineInk,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import {
  JankoSystemLayout,
  PositionedJankoNote,
  computePageGeometry,
  getMarginFurniture,
  knockoutHalfExtents,
  layoutJankoScore,
  nearestLatticeRow,
  renderSystem,
  suppressedStemIds,
} from './engine';
import { getEquatorRuleYs } from './elements/staff';
import { resolveBeatPulseXs } from './elements/barlines';
import {
  JankoBeamConnector,
  JankoRhythmNote,
  claspDotCenter,
  claspInkBox,
  claspMarkDaylight,
  getStemAttachmentRadii,
  getStemAttachmentRadius,
  getStemGeometry,
  resolveClaspInk,
} from './elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  JANKO_HALO_STROKE_WIDTH,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
} from './elements/notehead';
import {
  JankoRestGeometry,
  isBarRestValue,
  restInkCentroidOffset,
  restInkBox,
  restSeatOffsetY,
} from './elements/rests';

// ---------------------------------------------------------------------------
// Report model
// ---------------------------------------------------------------------------

/** Diagnostics are either hard engraving defects (`error`) or known risks. */
export type JankoLintSeverity = 'error' | 'warning';

/** Stable diagnostic identifiers (safe to assert on in tests). */
export type JankoLintCode =
  | 'notehead-overlap'
  | 'chordal-overlap'
  | 'knockout-missing'
  | 'knockout-empty'
  | 'knockout-undersized'
  | 'knockout-pass-through'
  | 'stem-detached'
  | 'stem-digit-collision'
  | 'halo-piercing'
  | 'beam-slope'
  | 'beam-stem-gap'
  | 'beam-notehead-collision'
  | 'beam-rest-clearance'
  | 'barline-collision'
  | 'clasp-barline-collision'
  | 'clasp-collision'
  | 'clasp-rail-crossing'
  | 'measure-numeral-collision'
  | 'accolade-collision'
  | 'rest-collision'
  | 'rest-unwritable'
  | 'rest-centroid-off-row'
  | 'rest-slab-off-line'
  | 'unison-double-digit'
  | 'clasp-dot-fusion'
  | 'stem-through-simultaneity'
  | 'split-stack-stems'
  | 'dot-collision'
  | 'grid-crossing-offset'
  | 'time-inversion'
  | 'system-slot-overlap'
  | 'corridor-intrusion';

/** One diagnostic, located on the page and in musical time. */
export interface LintViolation {
  code: JankoLintCode;
  severity: JankoLintSeverity;
  /** Human-readable, implementer-facing description. */
  message: string;
  /** Zero-based global system index. */
  system: number;
  /** One-based measure number, when the diagnostic concerns musical content. */
  measure?: number;
  /** Note ids involved, when applicable. */
  noteIds?: string[];
  /** Page pt coordinates of the defect. */
  x?: number;
  y?: number;
  /** Numeric evidence (distances, slopes, radii, …). */
  metrics?: Record<string, number>;
}

/** Structured result of {@link lintJankoScore}. */
export interface LintReport {
  /** True when no `error`-severity diagnostic was found. */
  ok: boolean;
  /** Hard engraving defects (empty for a clean golden master). */
  violations: LintViolation[];
  /** Non-blocking risks worth a designer's attention. */
  warnings: LintViolation[];
  /** `violations` + `warnings`, in detection order. */
  diagnostics: LintViolation[];
  stats: {
    systems: number;
    measures: number;
    notes: number;
    beams: number;
    checks: number;
    violations: number;
    warnings: number;
    durationMs: number;
  };
}

/** Tunable thresholds for the visual linter. */
export interface JankoLintOptions {
  /** Maximum acceptable |slope| of a beam connector. */
  maxBeamSlope: number;
  /** Minimum air (pt) between a glyph and a barline / margin furniture. */
  minClearance: number;
  /** Band (pt) around the Middle C spine that structural rules must avoid. */
  corridorClearance: number;
  /** Approximate advance width of a digit as a fraction of its font size. */
  digitAdvance: number;
  /**
   * Absolute floor (pt) of white the rectangular knockout must leave on
   * **every side** (top, bottom, left, right) of the digit's ink box. The
   * coverage audit requires the preset's own margin above this floor, so the
   * golden 0.8 and the tight 0.6 both pass while a digit-size regression is
   * still caught.
   */
  digitClearance: number;
  /**
   * Minimum air (pt) between a stem and its own digit glyph box. The
   * construction gap is the preset margin plus the 0.2pt stem air (≈1.0pt
   * golden, ≈0.8pt tight); the floor guards both.
   */
  stemDigitClearance: number;
  /** Run the SVG paint-order audit (slower, catches layer regressions). */
  auditPaintOrder: boolean;
}

/** Canonical linter thresholds (aligned with the golden master). */
export const DEFAULT_JANKO_LINT_OPTIONS: JankoLintOptions = {
  maxBeamSlope: 0.25,
  minClearance: 1.0,
  corridorClearance: 2.0,
  digitAdvance: 0.35,
  digitClearance: 0.6,
  stemDigitClearance: 0.7,
  auditPaintOrder: true,
};

/** Names of every check the linter runs, for coverage reporting. */
export const JANKO_LINT_CHECKS = [
  'notehead-clearance',
  'knockout-coverage',
  'stem-beam-validity',
  'stem-digit-clearance',
  'halo-clearance',
  'beam-notehead-clearance',
  'beam-rest-clearance',
  'barline-clearance',
  'clasp-clearance',
  'measure-numeral-clearance',
  'accolade-clearance',
  'rest-clearance',
  'rest-unwritable',
  'rest-seat',
  'unison-merge',
  'clasp-dot-fusion',
  'stem-simultaneity',
  'split-stack-stems',
  'dot-clearance',
  'grid-crossing',
  'time-order',
  'system-slot',
  'middle-c-corridor',
  'knockout-paint-order',
] as const;

// ---------------------------------------------------------------------------
// Small geometric helpers
// ---------------------------------------------------------------------------

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const EPS = 1e-6;

function box(x0: number, y0: number, x1: number, y1: number): Box {
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

function boxesOverlap(a: Box, b: Box, clearance = 0): boolean {
  return (
    a.x0 - clearance < b.x1 &&
    b.x0 - clearance < a.x1 &&
    a.y0 - clearance < b.y1 &&
    b.y0 - clearance < a.y1
  );
}

/** Distance from a point to an axis-aligned box (0 when inside). */
function pointToBoxDistance(px: number, py: number, b: Box): number {
  const dx = Math.max(b.x0 - px, 0, px - b.x1);
  const dy = Math.max(b.y0 - py, 0, py - b.y1);
  return Math.hypot(dx, dy);
}

/** True when two line segments intersect (proper crossing, excl. parallel). */
function segmentsIntersect(
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  p4x: number,
  p4y: number
): boolean {
  const d = (p2x - p1x) * (p4y - p3y) - (p2y - p1y) * (p4x - p3x);
  if (Math.abs(d) < 1e-12) return false;
  const t = ((p3x - p1x) * (p4y - p3y) - (p3y - p1y) * (p4x - p3x)) / d;
  const u = ((p3x - p1x) * (p2y - p1y) - (p3y - p1y) * (p2x - p1x)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Distance from a line segment to an axis-aligned box (0 when they touch). */
function segmentToBoxDistance(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  b: Box
): number {
  if (pointToBoxDistance(x1, y1, b) === 0 || pointToBoxDistance(x2, y2, b) === 0) return 0;
  const edges: Array<[number, number, number, number]> = [
    [b.x0, b.y0, b.x1, b.y0],
    [b.x1, b.y0, b.x1, b.y1],
    [b.x1, b.y1, b.x0, b.y1],
    [b.x0, b.y1, b.x0, b.y0],
  ];
  if (edges.some(([ax, ay, cx, cy]) => segmentsIntersect(x1, y1, x2, y2, ax, ay, cx, cy))) {
    return 0;
  }
  let d = Math.min(pointToBoxDistance(x1, y1, b), pointToBoxDistance(x2, y2, b));
  for (const [cx, cy] of [
    [b.x0, b.y0],
    [b.x1, b.y0],
    [b.x1, b.y1],
    [b.x0, b.y1],
  ]) {
    d = Math.min(d, pointToSegmentDistance(cx, cy, x1, y1, x2, y2));
  }
  return d;
}

/** Distance from a point to a line segment. */
function pointToSegmentDistance(
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
  if (len2 <= EPS) return Math.hypot(px - x1, py - y1);
  const tt = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + tt * vx), py - (y1 + tt * vy));
}

/** Distance from a vertical segment (`x`, `ya..yb`) to an axis-aligned box. */
function verticalSegmentToBoxDistance(x: number, ya: number, yb: number, b: Box): number {
  const lo = Math.min(ya, yb);
  const hi = Math.max(ya, yb);
  const horizontal = Math.max(b.x0 - x, 0, x - b.x1);
  const vertical = Math.max(b.y0 - hi, 0, lo - b.y1);
  return Math.hypot(horizontal, vertical);
}

/** The digit's ink box (page pt) centred on a notehead. */
function digitBox(p: PositionedJankoNote, fontSize: number): Box {
  const { halfWidth, halfHeight } = digitHalfExtents(fontSize);
  return box(p.x - halfWidth, p.y - halfHeight, p.x + halfWidth, p.y + halfHeight);
}

/** One-based measure number of an absolute tick. */
function measureOfTick(tick: number, t: ResolvedJankoTokens): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  if (anacrusis > 0) {
    if (tick < anacrusis) return 0;
    return Math.floor((tick - anacrusis) / t.ticksPerMeasure) + 1;
  }
  return Math.floor(tick / t.ticksPerMeasure) + 1;
}

/** Disc of a notehead as a box (used for clearance math). */
function noteDisc(p: PositionedJankoNote, r: number): Box {
  return box(p.x - r, p.y - r, p.x + r, p.y + r);
}

/** Vertical extents of one hand's structural rules (barline / beat grid). */
function handRuleSpans(
  layout: JankoSystemLayout
): Array<{ hand: 'RH' | 'LH'; top: number; bottom: number }> {
  const g = layout.geometry;
  return [
    { hand: 'RH', top: g.equatorY('RH', 5) - 12, bottom: g.equatorY('RH', 4) + 12 },
    { hand: 'LH', top: g.equatorY('LH', 3) - 12, bottom: g.equatorY('LH', 2) + 12 },
  ];
}

/**
 * Round 12: the **continuous** vertical-grid span of one system — the top of the
 * Octave 5 rule (`rhTop`) straight down to the bottom of the Octave 2 rule
 * (`lhBot`), across the Middle C corridor. Every measure barline and dashed beat
 * pulse is painted as one such rule (see `elements/barlines`).
 */
function gridRuleSpan(layout: JankoSystemLayout): { top: number; bottom: number } {
  const g = layout.geometry;
  return { top: g.equatorY('RH', 5) - 12, bottom: g.equatorY('LH', 2) + 12 };
}

// ---------------------------------------------------------------------------
// 1. Notehead clearance
// ---------------------------------------------------------------------------

/**
 * Notehead mask boxes may never overlap.
 *
 * The clearance model is box-based (Round 17), matching the rectangular
 * knockout: every head owns its halo-aware mask box (`wx × hy` from the
 * active cluster-spacing preset, grown to the halo ring for tick-0 sounds),
 * and two boxes may touch but never overlap. The row-snapped fan stands
 * same-row pairs at the preset pair gap (`2wx + air`) with real air to spare;
 * the audit fires only where boxes truly intersect — the later knockout would
 * erase the earlier digit.
 *
 * Three cases are distinguished, and they are exactly the three musical
 * situations a two-row whole-tone staff can produce:
 *
 * 1. **Row-snapped chord tones** (`a.startTick === b.startTick`, same `y`) —
 *    the engine keeps every head on its true whole-tone row and resolves the
 *    collision *horizontally* (Approach 2, Row-Snapped Parity Offset, see
 *    `engine.resolveRowSnappedChordOffsets`). Boxes that still overlap are
 *    reported as `chordal-overlap`.
 * 2. **Chordal heads on different rows** — legal by construction: the two
 *    whole-tone rows of an octave are one `rowHeight` (15pt) apart, so a
 *    stacked chord never touches, and the ∇ / Δ hand shapes stay vertically
 *    aligned on one beat column.
 * 3. **Different onsets** — boxes may never intersect: a hard
 *    `notehead-overlap`, because two independent beats must never share a
 *    glyph.
 */
export function checkNoteheadClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  void lint;
  const pairGap = getClusterSpacingPreset(o.clusterSpacing).pairGap;
  const boxOf = (p: PositionedJankoNote): Box => {
    const { wx, hy } = knockoutHalfExtents(o, t, p.note.startTick);
    return box(p.x - wx, p.y - hy, p.x + wx, p.y + hy);
  };
  const boxes = new Map<string, Box>(layout.notes.map((p) => [p.note.id, boxOf(p)]));
  const maxHalf = Math.max(
    ...layout.notes.map((p) => {
      const { wx } = knockoutHalfExtents(o, t, p.note.startTick);
      return wx;
    }),
    0
  );
  const sorted = [...layout.notes].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const boxA = boxes.get(a.note.id)!;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const dx = Math.abs(b.x - a.x);
      // x-sorted, so nothing further right can intersect this box.
      if (dx >= 2 * maxHalf) break;
      const boxB = boxes.get(b.note.id)!;
      const overlapX = Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0);
      const overlapY = Math.min(boxA.y1, boxB.y1) - Math.max(boxA.y0, boxB.y0);
      if (overlapX <= EPS || overlapY <= EPS) continue;
      const dy = Math.abs(b.y - a.y);
      const chordal = a.note.startTick === b.note.startTick;
      const sameRow = dy < EPS;
      const distance = Math.hypot(dx, dy);
      const detail = {
        dx,
        dy,
        distance,
        /** Penetration depth (pt) of the two mask boxes. */
        overlap: Math.min(overlapX, overlapY),
        /** Canonical row-snapped displacement the engine aims for. */
        canonicalOffset: sameRow && chordal ? pairGap : 0,
      };
      const base = {
        system: layout.index,
        measure: measureOfTick(Math.min(a.note.startTick, b.note.startTick), t),
        noteIds: [a.note.id, b.note.id],
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        metrics: detail,
      };
      if (chordal && sameRow) {
        // Case 1: the row-snapped fan did not happen, or the pin-preserving
        // shrink ran past touching masks. The later knockout erases the
        // earlier digit, so the pair is surfaced instead of silently accepted.
        out.push({
          code: 'chordal-overlap',
          severity: 'warning',
          message:
            `Chordal noteheads ${a.note.id} (${a.coord.hand} pc${a.coord.pitchClass} o${a.coord.octave}) and ` +
            `${b.note.id} (${b.coord.hand} pc${b.coord.pitchClass} o${b.coord.octave}) share row ${a.coord.rank} of ` +
            `octave ${a.coord.octave} only ${dx.toFixed(2)}pt apart: their mask boxes overlap by ` +
            `${Math.min(overlapX, overlapY).toFixed(2)}pt, so the later knockout erases the earlier digit. ` +
            `Row-snap one head by Δx = ${pairGap.toFixed(2)}pt.`,
          ...base,
        });
      } else if (chordal) {
        out.push({
          code: 'chordal-overlap',
          severity: 'warning',
          message:
            `Chordal noteheads ${a.note.id} (${a.coord.hand} pc${a.coord.pitchClass} o${a.coord.octave}) and ` +
            `${b.note.id} (${b.coord.hand} pc${b.coord.pitchClass} o${b.coord.octave}) are ${distance.toFixed(2)}pt apart: ` +
            `their mask boxes overlap, so the later knockout erases the earlier digit. ` +
            `Displace the voices or merge the heads.`,
          ...base,
        });
      } else {
        out.push({
          code: 'notehead-overlap',
          severity: 'error',
          message:
            `Noteheads ${a.note.id} and ${b.note.id} overlap (mask boxes intersect by ` +
            `${Math.min(overlapX, overlapY).toFixed(2)}pt; dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`,
          ...base,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Knockout coverage (geometry side)
// ---------------------------------------------------------------------------

/**
 * The white knockout must be large enough that the duodecimal glyph's ink box
 * keeps the preset margin of white **on every side** — otherwise the digit
 * pokes out of its own mask and staff lines graze the glyph.
 *
 * The mask is the Round 17 **sharp rectangle** (`wx × hy` from the active
 * cluster-spacing preset): the digit box must sit fully inside it with the
 * required white on every side — box-vs-box containment plus the margin. The
 * required margin is the preset's own above the linter's absolute floor. The
 * digit box is derived from the renderer's own metrics
 * ({@link digitHalfExtents}: URW Gothic cap height and widest-glyph half
 * width, resolved against the CSS `pt` → user-unit factor), so the check can
 * never drift from what is actually painted. The ellipse metric and its corner
 * budget are deleted with the ellipse.
 */
export function checkKnockoutCoverage(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const { wx, hy, margin } = getClusterSpacingPreset(o.clusterSpacing);
  const { halfWidth, halfHeight } = digitHalfExtents(t.digitFontSize);
  const horizontal = wx - halfWidth;
  const vertical = hy - halfHeight;
  // The preset's construction bases are rounded to two decimals for humans
  // (1.93/2.86 vs the exact 1.9333/2.8577 optical box), so the containment
  // carries a hundredth-point construction tolerance.
  const required = Math.max(margin, lint.digitClearance);
  const TOL = 0.01;
  for (const p of layout.notes) {
    if (horizontal + TOL >= required && vertical + TOL >= required) {
      continue;
    }
    out.push({
      code: 'knockout-undersized',
      severity: 'error',
      message:
        `Knockout ${wx.toFixed(2)}×${hy.toFixed(2)}pt cannot shield the ${t.digitFontSize}pt digit ` +
        `(needs ${required.toFixed(2)}pt of white on every side; left/right ${horizontal.toFixed(2)}pt, ` +
        `top/bottom ${vertical.toFixed(2)}pt): staff lines would graze the glyph.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: p.x,
      y: p.y,
      metrics: {
        wx,
        hy,
        required,
        digitFontSize: t.digitFontSize,
        digitHalfWidth: halfWidth,
        digitHalfHeight: halfHeight,
        horizontal,
        vertical,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Stem & beam validity
// ---------------------------------------------------------------------------

/**
 * Stems must be engraved on their notehead's vertical centreline
 * (`stemX === note.x`), attach **flush on the outside** of their glyph — the
 * wider Position of Honor halo ring for tick-0 sounds, the rectangular mask
 * edge otherwise — and reach the beam centerline exactly (no overshoot, no
 * shortfall). Beam slopes must stay inside the acceptable threshold, no matter
 * how wide the leap.
 */
export function checkStemAndBeamValidity(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  for (const p of layout.notes) {
    // Shared with the renderer, so a drifting stem column can never slip past.
    const stem = getStemGeometry(p.rhythm, t);
    const stemX = stem.stemX;
    const stemStartY = stem.stemStartY;
    const honor = isPositionOfHonor(p.note.startTick);
    // The distance from the centre at which the stem must start flush.
    const effectiveRadius = getStemAttachmentRadius(p.rhythm, t);
    const glyphLabel = honor
      ? `halo ring (R=${t.haloRadius.toFixed(2)}pt)`
      : `mask edge (hy + 0.2 = ${effectiveRadius.toFixed(2)}pt)`;
    // Round 16: the anti-fusion stagger is deleted — a stem stands exactly on
    // its notehead's centreline, and any drift is a defect (`split-stack-stems`
    // names the onset-wide regression separately).
    if (Math.abs(stemX - p.x) > EPS) {
      out.push({
        code: 'stem-detached',
        severity: 'error',
        message:
          `Stem of ${p.note.id} is engraved ${Math.abs(stemX - p.x).toFixed(2)}pt off the notehead ` +
          `centreline (stemX=${stemX.toFixed(2)}, note x=${p.x.toFixed(2)}): duration indicators ` +
          `would stagger against the digit.`,
        system: layout.index,
        measure: measureOfTick(p.note.startTick, t),
        noteIds: [p.note.id],
        x: stemX,
        y: stemStartY,
        metrics: { stemX, noteX: p.x, offset: stemX - p.x },
      });
      continue;
    }
    const attach = Math.hypot(stemX - p.x, stemStartY - p.y);
    if (attach < effectiveRadius - EPS) {
      out.push({
        code: 'stem-detached',
        severity: 'error',
        message:
          `Stem of ${p.note.id} starts ${attach.toFixed(2)}pt from the notehead centre, inside the ` +
          `${glyphLabel}: the stem would cut through it and crowd the digit ` +
          `(${effectiveRadius.toFixed(2)}pt required).`,
        system: layout.index,
        measure: measureOfTick(p.note.startTick, t),
        noteIds: [p.note.id],
        x: stemX,
        y: stemStartY,
        metrics: { attach, required: effectiveRadius, radius: r, haloRadius: t.haloRadius },
      });
    } else if (attach > effectiveRadius + EPS) {
      out.push({
        code: 'stem-detached',
        severity: 'error',
        message:
          `Stem of ${p.note.id} attaches ${attach.toFixed(2)}pt from the notehead centre ` +
          `(${glyphLabel} at ${effectiveRadius.toFixed(2)}pt): the stem floats off the head.`,
        system: layout.index,
        measure: measureOfTick(p.note.startTick, t),
        noteIds: [p.note.id],
        x: stemX,
        y: stemStartY,
        metrics: { attach, required: effectiveRadius, radius: r, haloRadius: t.haloRadius },
      });
    }
  }

  for (const beam of layout.beams) {
    const ids = beam.notes.map((n) => n.id);
    const measure = measureOfTick(beam.notes[0].startTick, t);
    if (Math.abs(beam.slope) > lint.maxBeamSlope + EPS) {
      out.push({
        code: 'beam-slope',
        severity: 'error',
        message:
          `Beam slope ${beam.slope.toFixed(3)} exceeds the ${lint.maxBeamSlope} threshold ` +
          `(raw ${beam.rawSlope.toFixed(3)}) — the connector is not clamped.`,
        system: layout.index,
        measure,
        noteIds: ids,
        x: beam.primary.x1,
        y: beam.primary.y1,
        metrics: { slope: beam.slope, rawSlope: beam.rawSlope, limit: lint.maxBeamSlope },
      });
    }
    for (let i = 0; i < beam.stems.length; i++) {
      const stem = beam.stems[i];
      if (stem.stemX < beam.primary.x1 - EPS || stem.stemX > beam.primary.x2 + EPS) {
        out.push({
          code: 'beam-stem-gap',
          severity: 'error',
          message: `Stem of ${beam.notes[i].id} falls outside the beam connector span.`,
          system: layout.index,
          measure,
          noteIds: [beam.notes[i].id],
          x: stem.stemX,
          y: stem.stemEndY,
          metrics: { stemX: stem.stemX, spanX1: beam.primary.x1, spanX2: beam.primary.x2 },
        });
      }
      if (stem.direction !== beam.direction) {
        out.push({
          code: 'stem-detached',
          severity: 'error',
          message: `Stem of ${beam.notes[i].id} points against its hand (${stem.direction} vs ${beam.direction}).`,
          system: layout.index,
          measure,
          noteIds: [beam.notes[i].id],
          x: stem.stemX,
          y: stem.stemStartY,
          metrics: { direction: stem.direction, expected: beam.direction },
        });
      }
    }
  }
}

/**
 * No stem may encroach on its own digit glyph.
 *
 * The stem starts flush on the mask edge, so the air between the stem start
 * and the digit's ink box is a pure consequence of the preset margin, the
 * stem air and the optical centring. It must stay at least
 * {@link JankoLintOptions.stemDigitClearance} — with the canonical tokens the
 * real margin is ≈1.0pt golden (≈0.8pt tight).
 *
 * Scope: each stem is audited against *its own* digit. A stem that crosses a
 * foreign glyph is invisible anyway (the rhythm layer is painted beneath the
 * noteheads, so that notehead's mask erases it), and the only way to reach a
 * foreign digit box in the first place is the cross-hand chordal collision,
 * which {@link checkNoteheadClearance} already surfaces as a warning.
 */
export function checkStemDigitClearance(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  for (const p of layout.notes) {
    const stem = getStemGeometry(p.rhythm, t);
    const glyph = digitBox(p, t.digitFontSize);
    const distance = verticalSegmentToBoxDistance(
      stem.stemX,
      stem.stemStartY,
      stem.stemEndY,
      glyph
    );
    if (distance + EPS >= lint.stemDigitClearance) continue;
    out.push({
      code: 'stem-digit-collision',
      severity: 'error',
      message:
        `Stem of ${p.note.id} passes ${distance.toFixed(2)}pt from its own digit glyph ` +
        `(${lint.stemDigitClearance.toFixed(1)}pt of air required): the stem crowds or touches the ` +
        `numeral inside its mask.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: stem.stemX,
      y: stem.stemStartY,
      metrics: {
        distance,
        required: lint.stemDigitClearance,
        stemStartY: stem.stemStartY,
        glyphTop: glyph.y0,
        glyphBottom: glyph.y1,
      },
    });
  }
}

/**
 * A Position of Honor stem may never pierce its halo ring.
 *
 * The tick-0 opening sounds carry the concentric halo (R = `haloRadius`), which
 * is painted on top of the rhythm layer: a stem emerging inside the ring reads
 * as a radial cut straight through it. The distance from the notehead centre to
 * the stem segment must therefore clear the ring's outer stroke edge.
 */
export function checkHaloClearance(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  _lint: JankoLintOptions,
  out: LintViolation[]
): void {
  // The stem must clear the ring's *outer* edge, stroke width included.
  const required = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  for (const p of layout.notes) {
    if (!isPositionOfHonor(p.note.startTick)) continue;
    const stem = getStemGeometry(p.rhythm, t);
    const distance = pointToSegmentDistance(
      p.x,
      p.y,
      stem.stemX,
      stem.stemStartY,
      stem.stemX,
      stem.stemEndY
    );
    if (distance + EPS >= required) continue;
    out.push({
      code: 'halo-piercing',
      severity: 'error',
      message:
        `Stem of opening sound ${p.note.id} passes ${distance.toFixed(2)}pt from the notehead centre, ` +
        `inside the Position of Honor halo ring (R=${t.haloRadius.toFixed(2)}pt, outer edge ` +
        `${required.toFixed(2)}pt): the stem cuts through the halo.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: stem.stemX,
      y: stem.stemStartY,
      metrics: { distance, haloRadius: t.haloRadius, required, stemStartY: stem.stemStartY },
    });
  }
}

/**
 * No beam connector may cut into a notehead disc.
 *
 * For every beam group — primary connector and the 16th secondary connector —
 * and every notehead of the system whose column falls under the connector, the
 * perpendicular distance from the notehead centre to the connector must be at
 * least `noteheadRadius + minStemClearance`, where the air is the larger of the
 * token's stem clearance and the linter's global {@link JankoLintOptions.minClearance}
 * floor. Ascending or descending runs therefore always show a real stem between
 * the head and the beam instead of a clipped beam/knockout intersection.
 */
export function checkBeamNoteheadClearance(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  // The token's stem clearance, never below the linter's global air floor.
  const air = Math.max(t.minStemClearance, lint.minClearance);
  const required = r + air;
  for (const beam of layout.beams) {
    const connectors: Array<{ label: string; connector: JankoBeamConnector }> = [
      { label: 'primary beam', connector: beam.primary },
    ];
    if (beam.secondary) connectors.push({ label: 'secondary beam', connector: beam.secondary });
    const beamIds = beam.notes.map((n) => n.id);

    for (const { label, connector } of connectors) {
      const lo = Math.min(connector.x1, connector.x2) - required;
      const hi = Math.max(connector.x1, connector.x2) + required;
      for (const p of layout.notes) {
        if (p.x < lo || p.x > hi) continue;
        const distance = pointToSegmentDistance(
          p.x,
          p.y,
          connector.x1,
          connector.y1,
          connector.x2,
          connector.y2
        );
        if (distance + EPS >= required) continue;
        out.push({
          code: 'beam-notehead-collision',
          severity: 'error',
          message:
            `${label} of [${beamIds.join(', ')}] passes ${distance.toFixed(2)}pt from notehead ` +
            `${p.note.id} (${required.toFixed(2)}pt required: disc r=${r.toFixed(2)} + ` +
            `${air.toFixed(2)}pt air): the beam collides with the glyph.`,
          system: layout.index,
          measure: measureOfTick(p.note.startTick, t),
          noteIds: [p.note.id, ...beamIds],
          x: p.x,
          y: p.y,
          metrics: {
            distance,
            required,
            radius: r,
            minStemClearance: air,
            beamSlope: beam.slope,
          },
        });
      }
    }
  }
}

/**
 * Round 17B: a beam connector is **real musical ink over a printed silence** —
 * every connector (primary and 16th secondary) must keep the beam air from
 * every printed rest's ink box. The engine's beam solver seats each connector
 * against the same rest boxes with the same air, so a beam the engine admits
 * is guaranteed to pass this audit; the check exists to catch a regression
 * that paints a connector through a rest it bridges. A beam-rest clearance
 * failure is a hard **violation**: a bridged beam may continue across a rest,
 * never touch it.
 */
export function checkBeamRestClearance(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  if (layout.beams.length === 0 || layout.rests.length === 0) return;
  // The token's stem clearance, never below the linter's global air floor —
  // the same air a beam keeps from a notehead disc.
  const air = Math.max(t.minStemClearance, lint.minClearance);
  for (const beam of layout.beams) {
    const connectors: Array<{ label: string; connector: JankoBeamConnector }> = [
      { label: 'primary beam', connector: beam.primary },
    ];
    if (beam.secondary) connectors.push({ label: 'secondary beam', connector: beam.secondary });
    const beamIds = beam.notes.map((n) => n.id);

    for (const { label, connector } of connectors) {
      for (const rest of layout.rests) {
        const ink = restInkBox(rest, t);
        const gap = segmentToBoxDistance(
          connector.x1,
          connector.y1,
          connector.x2,
          connector.y2,
          box(ink.x0, ink.y0, ink.x1, ink.y1)
        );
        if (gap + EPS >= air) continue;
        out.push({
          code: 'beam-rest-clearance',
          severity: 'error',
          message:
            `${label} of [${beamIds.join(', ')}] passes ${gap.toFixed(2)}pt from the ` +
            `${rest.value} rest at tick ${rest.tick} (${air.toFixed(2)}pt of air required: ` +
            `a bridged beam may continue across a printed rest, never touch it).`,
          system: layout.index,
          measure: measureOfTick(rest.tick, t),
          noteIds: beamIds,
          x: rest.x,
          y: rest.y,
          metrics: {
            gap,
            required: air,
            restTick: rest.tick,
            beamSlope: beam.slope,
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4b. Simultaneity integrity: no stem or beam through a same-onset chord tone
// ---------------------------------------------------------------------------

/** One painted segment of the system's rhythm ink. */
interface PaintedSegment {
  /** Note ids the ink belongs to (one stem, or every member of a beam group). */
  ids: string[];
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The note id whose stem this segment is, when it is a single stem. */
  stemOf: string | null;
  label: string;
}

/**
 * Round 14: **no painted stem or beam segment may pass through the notehead
 * disc of a same-onset chord tone of its own hand**
 * (`stem-through-simultaneity`).
 *
 * A two-row whole-tone staff stacks a hand's chord tones on different rows of
 * one shared column, so unless the chord-grouping paradigm unifies them
 * (Round 6/8 `'per-hand-clasp'` bracket or the gap-gated vertical-chord
 * grammar), every tone draws its own full-length stem on the same column — and
 * each of those stems is then painted straight through the discs of the tones
 * above or below it, to be chopped into segments by their white knockouts. That
 * is the exact defect the clasp was invented to kill, and it is invisible to
 * every other check because each stem *is* attached to its own head.
 *
 * The scope is deliberately **one hand's chord**: a cross-hand simultaneity is
 * two independent voices sharing the lattice (Round 4/11 resolve their
 * collisions through the channel layout and the row-snapped parity offset), and
 * its opposing stem directions are the settled engraving, not a chord defect.
 *
 * Only **painted** ink is audited: a member whose stem the clasp replaced, the
 * vertical-chord grammar suppressed, or a Round 16 shared stem serves is
 * skipped, exactly as `renderNotesLayer` skips it. Beam members always keep
 * their stems.
 *
 * A tone's own stem starts on the outside of its own glyph circle, so it can
 * never trip this check; only a *foreign* same-onset head of the same hand can.
 */
export function checkStemThroughSimultaneity(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  const hidden = suppressedStemIds(layout);
  const byId = new Map(layout.notes.map((p) => [p.note.id, p]));

  // Every segment `renderNotesLayer` actually paints for this system.
  const segments: PaintedSegment[] = [];
  if (o.rhythmStyle === 'beamed') {
    for (const beam of layout.beams) {
      const ids = beam.notes.map((n) => n.id);
      for (let i = 0; i < beam.stems.length; i++) {
        const s = beam.stems[i];
        segments.push({
          ids: [ids[i]],
          x1: s.stemX,
          y1: s.stemStartY,
          x2: s.stemX,
          y2: s.stemEndY,
          stemOf: ids[i],
          label: 'stem',
        });
      }
      const connectors: Array<{ label: string; c: JankoBeamConnector }> = [
        { label: 'primary beam', c: beam.primary },
      ];
      if (beam.secondary) connectors.push({ label: '16th secondary beam', c: beam.secondary });
      for (const { label, c } of connectors) {
        segments.push({ ids, x1: c.x1, y1: c.y1, x2: c.x2, y2: c.y2, stemOf: null, label });
      }
    }
    for (const n of layout.ungrouped) {
      if (hidden.has(n.id)) continue;
      const s = getStemGeometry(n, t);
      segments.push({
        ids: [n.id],
        x1: s.stemX,
        y1: s.stemStartY,
        x2: s.stemX,
        y2: s.stemEndY,
        stemOf: n.id,
        label: 'stem',
      });
    }
  } else {
    for (const p of layout.notes) {
      if (hidden.has(p.rhythm.id)) continue;
      const s = getStemGeometry(p.rhythm, t);
      segments.push({
        ids: [p.rhythm.id],
        x1: s.stemX,
        y1: s.stemStartY,
        x2: s.stemX,
        y2: s.stemEndY,
        stemOf: p.rhythm.id,
        label: 'stem',
      });
    }
  }
  if (segments.length === 0) return;

  // One hand's chord tones bucketed by tick, so a segment only tests the
  // simultaneities its own notes belong to instead of the whole system.
  const byHandTick = new Map<string, PositionedJankoNote[]>();
  for (const p of layout.notes) {
    const key = `${p.rhythm.hand}|${p.note.startTick}`;
    const bucket = byHandTick.get(key);
    if (bucket) bucket.push(p);
    else byHandTick.set(key, [p]);
  }

  for (const seg of segments) {
    const owned = new Set(seg.ids);
    const tested = new Set<string>();
    for (const id of seg.ids) {
      const note = byId.get(id);
      if (!note) continue;
      const simultaneity = byHandTick.get(`${note.rhythm.hand}|${note.note.startTick}`) ?? [];
      if (simultaneity.length < 2) continue;
      for (const other of simultaneity) {
        if (owned.has(other.note.id) || tested.has(other.note.id)) continue;
        tested.add(other.note.id);
        const distance = pointToSegmentDistance(
          other.x,
          other.y,
          seg.x1,
          seg.y1,
          seg.x2,
          seg.y2
        );
        if (distance + EPS >= r) continue;
        const source = seg.stemOf === null ? `${seg.label} of [${seg.ids.join(', ')}]` : `stem of notehead ${seg.stemOf}`;
        out.push({
          code: 'stem-through-simultaneity',
          severity: 'error',
          message:
            `The ${source} passes ${distance.toFixed(2)}pt from the centre of same-onset chord tone ` +
            `${other.note.id} (disc r=${r.toFixed(2)}pt): the ink is painted through the glyph and ` +
            `chopped by its knockout. Group the simultaneity (per-hand clasp / gap-gated vertical ` +
            `chord) or suppress the interior stem.`,
          system: layout.index,
          measure: measureOfTick(other.note.startTick, t),
          noteIds: [...seg.ids, other.note.id],
          x: other.x,
          y: other.y,
          metrics: {
            distance,
            radius: r,
            tick: other.note.startTick,
            segmentX1: seg.x1,
            segmentY1: seg.y1,
            segmentX2: seg.x2,
            segmentY2: seg.y2,
          },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Barline clearance
// ---------------------------------------------------------------------------

/**
 * Round 15 — **augmentation dots** must be unambiguous.
 *
 * Every dotted value (the renderers paint a dot for `26 < durationTicks ≤ 38`)
 * carries exactly one dot, always right of its own head and hugging its mask's
 * top-right corner (`dotX = note.x + wx + augmentationDotGap`, `rhythm.dotY`
 * in the hug lane). The dot's 0.75pt ink may not touch
 *  - any notehead mask box or Position-of-Honor halo (which would attribute
 *    the dot to the wrong note — the Round 14 bar-5 defect),
 *  - any painted horizontal rule (a dot sitting on a staff rule drowns in it),
 *  - any painted vertical grid line (barline or dashed beat pulse).
 */
export function checkDotCollision(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  const dotR = t.augmentationDotRadius;
  const barlines = systemBarlines(layout, o, t);
  const pulses = beatPulseXs(layout, o, t);
  const rules: Array<{ y: number; stroke: number }> = [];
  for (let octave = 0; octave <= 8; octave++) {
    for (const y of getEquatorRuleYs(layout.geometry.equatorY('RH', octave), o, t)) {
      rules.push({ y, stroke: octave >= 2 && octave <= 5 ? 0.5 : 0.75 });
    }
  }
  for (const p of layout.notes) {
    const dur = p.note.durationTicks;
    if (dur <= 26 || dur > 38) continue;
    // The dot the engine resolved: hugging the rectangular mask. Hand-built
    // rhythm notes fall back to the head row and the golden mask offset,
    // exactly as the renderer paints them.
    const cx = p.rhythm.dotX ?? p.x + getClusterSpacingPreset(o.clusterSpacing).wx + t.augmentationDotGap;
    const cy = p.rhythm.dotY ?? p.y;
    const base = {
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: cx,
      y: cy,
    };
    const haloOuter = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
    const maskOf = (q: PositionedJankoNote): Box => {
      const { wx, hy } = knockoutHalfExtents(o, t, q.note.startTick);
      return box(q.x - wx, q.y - hy, q.x + wx, q.y + hy);
    };
    for (const q of layout.notes) {
      // Mask boxes for regular heads; the halo ring's outer edge for tick-0
      // honour sounds, exactly as the engine seats them.
      const distance = isPositionOfHonor(q.note.startTick)
        ? Math.hypot(cx - q.x, cy - q.y) - haloOuter
        : pointToBoxDistance(cx, cy, maskOf(q));
      if (distance >= dotR - EPS) continue;
      out.push({
        code: 'dot-collision',
        severity: 'error',
        message:
          `The augmentation dot of ${p.note.id} sits ${distance.toFixed(2)}pt from the mask of ` +
          `${q.note.id} (dot r=${dotR.toFixed(2)}pt): the dot would attach to the wrong note.`,
        ...base,
        metrics: { distance, required: dotR, cx, cy },
      });
      break;
    }
    for (const rule of rules) {
      const gap = Math.abs(cy - rule.y);
      if (gap >= dotR + rule.stroke / 2 - EPS) continue;
      out.push({
        code: 'dot-collision',
        severity: 'error',
        message:
          `The augmentation dot of ${p.note.id} touches the staff rule at y=${rule.y.toFixed(2)} ` +
          `(${gap.toFixed(2)}pt gap, ${(dotR + rule.stroke / 2).toFixed(2)}pt required).`,
        ...base,
        metrics: { gap, required: dotR + rule.stroke / 2, ruleY: rule.y },
      });
      break;
    }
    for (const b of barlines) {
      if (cy < b.top - EPS || cy > b.bottom + EPS) continue;
      const gap = Math.abs(cx - b.x);
      if (gap >= dotR + 0.3 - EPS) continue;
      out.push({
        code: 'dot-collision',
        severity: 'error',
        message:
          `The augmentation dot of ${p.note.id} touches the barline at x=${b.x.toFixed(2)} ` +
          `(${gap.toFixed(2)}pt gap, ${(dotR + 0.3).toFixed(2)}pt required).`,
        ...base,
        metrics: { gap, required: dotR + 0.3, barlineX: b.x },
      });
      break;
    }
    for (const x of pulses) {
      const gap = Math.abs(cx - x);
      if (gap >= dotR + 0.35 - EPS) continue;
      out.push({
        code: 'dot-collision',
        severity: 'error',
        message:
          `The augmentation dot of ${p.note.id} touches the dashed beat pulse at x=${x.toFixed(2)} ` +
          `(${gap.toFixed(2)}pt gap, ${(dotR + 0.35).toFixed(2)}pt required).`,
        ...base,
        metrics: { gap, required: dotR + 0.35, pulseX: x },
      });
      break;
    }
  }
}

/**
 * Round 15 hard barrier — **no head may leave the beat cell of its nominal
 * column**. Each onset carries the `[left, right]` span between the two painted
 * grid lines that bracket its beat (`layout.notes[].beatCell`, recorded by the
 * chord-column solve), and a displaced head outside it has crossed a beat pulse
 * or a barline into another beat's territory (the Round 14 bar-12 defect).
 */
export function checkGridCrossingOffset(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  for (const p of layout.notes) {
    if (p.nominalX === undefined || !p.beatCell) continue;
    const { left, right } = p.beatCell;
    if (p.x >= left - EPS && p.x <= right + EPS) continue;
    const crossed = p.x < left ? left : right;
    const side = p.x < left ? 'left' : 'right';
    out.push({
      code: 'grid-crossing-offset',
      severity: 'error',
      message:
        `Head ${p.note.id} was displaced to x=${p.x.toFixed(2)}, outside the beat cell ` +
        `[${left.toFixed(2)}, ${right.toFixed(2)}] of its nominal column ` +
        `(x=${p.nominalX.toFixed(2)}): it crosses the grid line at x=${crossed.toFixed(2)} into the ` +
        `${side === 'left' ? 'preceding' : 'following'} beat's territory.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: p.x,
      y: p.y,
      metrics: {
        nominalX: p.nominalX,
        x: p.x,
        cellLeft: left,
        cellRight: right,
        crossedX: crossed,
      },
    });
  }
}

/**
 * Round 15 — **time order on the page**: for every pair of consecutive onsets,
 * the earlier onset's rightmost head must stay left of the later onset's
 * leftmost head. A row-spread or column translation that inverts the order
 * (the Round 14 bar-15 defect: LH 2 at t2064 left of the t2052 head) reads as a
 * rhythmic lie even when every disc still clears.
 */
export function checkTimeOrder(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  const byTick = new Map<number, { min: number; max: number; ids: string[] }>();
  for (const p of layout.notes) {
    const bucket = byTick.get(p.note.startTick);
    if (bucket) {
      bucket.min = Math.min(bucket.min, p.x);
      bucket.max = Math.max(bucket.max, p.x);
      bucket.ids.push(p.note.id);
    } else {
      byTick.set(p.note.startTick, { min: p.x, max: p.x, ids: [p.note.id] });
    }
  }
  const ticks = [...byTick.keys()].sort((a, b) => a - b);
  for (let i = 1; i < ticks.length; i++) {
    const before = byTick.get(ticks[i - 1])!;
    const after = byTick.get(ticks[i])!;
    if (before.max <= after.min + EPS) continue;
    out.push({
      code: 'time-inversion',
      severity: 'error',
      message:
        `Onset t${ticks[i - 1]} reaches x=${before.max.toFixed(2)}, right of onset t${ticks[i]}'s ` +
        `leftmost head at x=${after.min.toFixed(2)}: the page reads the later note before the ` +
        `earlier one.`,
      system: layout.index,
      measure: measureOfTick(ticks[i], t),
      noteIds: [...before.ids, ...after.ids],
      x: (before.max + after.min) / 2,
      metrics: {
        prevTick: ticks[i - 1],
        nextTick: ticks[i],
        prevMaxX: before.max,
        nextMinX: after.min,
      },
    });
  }
}

/**
 * Round 15 locked layout — **four systems per page**. Two audits:
 *
 * 1. each system's **furniture** (the staff extents, the measure numeral and
 *    every ledger equator) stays inside its own page slot — the ticket's
 *    slot-fit gate;
 * 2. consecutive systems **on one page** never overlap: the lower system's
 *    topmost ink must stay below the upper system's bottom ink
 *    (see {@link systemInkExtents}).
 */
export function checkSystemSlotFit(
  layout: JankoSystemLayout,
  page: JankoPageGeometry,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const g = layout.geometry;
  const slotTop = g.slotTopY;
  const slotBottom = g.slotTopY + page.slotHeight;
  let inkTop = g.staffTopY;
  let inkBottom = g.staffBotY;
  if (o.showMeasureNumbers) {
    const { numeral } = marginFurniture(layout, t, lint, 1, o.systemStartStyle);
    inkTop = Math.min(inkTop, numeral.y0);
  }
  for (const p of layout.notes) {
    for (const ledgerY of p.coord.ledgerYs) {
      inkTop = Math.min(inkTop, g.middleCY + ledgerY - 0.38);
      inkBottom = Math.max(inkBottom, g.middleCY + ledgerY + 0.38);
    }
  }
  const clearance = lint.minClearance;
  if (inkTop >= slotTop + clearance && inkBottom <= slotBottom - clearance) return;
  out.push({
    code: 'system-slot-overlap',
    severity: 'error',
    message:
      `System ${layout.index + 1}'s staff furniture spans y=[${inkTop.toFixed(2)}, ` +
      `${inkBottom.toFixed(2)}], outside its ${page.slotHeight.toFixed(2)}pt page slot ` +
      `[${slotTop.toFixed(2)}, ${slotBottom.toFixed(2)}] (${clearance.toFixed(2)}pt clearance).`,
    system: layout.index,
    y: inkTop < slotTop + clearance ? inkTop : inkBottom,
    metrics: {
      inkTop,
      inkBottom,
      slotTop,
      slotBottom,
      slotHeight: page.slotHeight,
      required: clearance,
    },
  });
}

/** Full painted extent of one system: every glyph, rule, beam and bracket. */
export function systemInkExtents(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  o: ResolvedJankoLayoutOptions
): { top: number; bottom: number } {
  const g = layout.geometry;
  let top = g.staffTopY;
  let bottom = g.staffBotY;
  if (o.showMeasureNumbers) {
    const { numeral } = marginFurniture(layout, t, lint, 1, o.systemStartStyle);
    top = Math.min(top, numeral.y0);
  }
  const r = t.noteheadRadius;
  for (const p of layout.notes) {
    const glyph = isPositionOfHonor(p.note.startTick)
      ? Math.max(r, t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2)
      : r;
    top = Math.min(top, p.y - glyph);
    bottom = Math.max(bottom, p.y + glyph);
    for (const ledgerY of p.coord.ledgerYs) {
      top = Math.min(top, g.middleCY + ledgerY - 0.38);
      bottom = Math.max(bottom, g.middleCY + ledgerY + 0.38);
    }
  }
  for (const beam of layout.beams) {
    for (const c of [beam.primary, beam.secondary]) {
      if (!c) continue;
      top = Math.min(top, c.y1, c.y2);
      bottom = Math.max(bottom, c.y1, c.y2);
    }
  }
  for (const stem of paintedStemSegments(layout, o, t)) {
    top = Math.min(top, stem.top);
    bottom = Math.max(bottom, stem.bottom);
  }
  for (const clasp of layout.clasps) {
    top = Math.min(top, clasp.topY);
    bottom = Math.max(bottom, clasp.botY);
  }
  for (const rest of layout.rests) {
    const box = restInkBox(rest, t);
    top = Math.min(top, box.y0);
    bottom = Math.max(bottom, box.y1);
  }
  return { top, bottom };
}

/**
 * X positions of every dashed beat pulse painted in one system.
 *
 * Round 19: the pulses are resolved by the *renderer's own* function, fed with
 * the system's laid-out columns — so an occupied beat's pulse is audited at the
 * column the music actually stands on, never at a stale proportional x.
 */
function beatPulseXs(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): number[] {
  return resolveBeatPulseXs(layout.geometry, layout.index, o, t, layout.columns);
}

/** One barline segment of a system, per hand (RH and LH halves). */
export interface BarlineSpan {
  x: number;
  top: number;
  bottom: number;
}

/** One painted stem segment of a system. */
interface PaintedStemSegment {
  id: string;
  hand: 'RH' | 'LH';
  x: number;
  top: number;
  bottom: number;
}

/**
 * Every stem segment `renderNotesLayer` actually paints for one system: the
 * beam stems of the beamed dialect (plus the standalone stems) or every
 * note stem otherwise, minus the ones a clasp, a gap-gated vertical chord or
 * a Round 16 shared stem replaced. Shared by the simultaneity audit and the
 * system-overlap scan, so both check exactly the painted ink.
 */
function paintedStemSegments(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): PaintedStemSegment[] {
  const hidden = suppressedStemIds(layout);
  const segments: PaintedStemSegment[] = [];
  const push = (id: string, hand: 'RH' | 'LH', rhythm: JankoRhythmNote): void => {
    const s = getStemGeometry(rhythm, t);
    segments.push({
      id,
      hand,
      x: s.stemX,
      top: Math.min(s.stemStartY, s.stemEndY),
      bottom: Math.max(s.stemStartY, s.stemEndY),
    });
  };
  if (o.rhythmStyle === 'beamed') {
    for (const beam of layout.beams) {
      for (let i = 0; i < beam.stems.length; i++) {
        const s = beam.stems[i];
        segments.push({
          id: beam.notes[i].id,
          hand: beam.notes[i].hand,
          x: s.stemX,
          top: Math.min(s.stemStartY, s.stemEndY),
          bottom: Math.max(s.stemStartY, s.stemEndY),
        });
      }
    }
    for (const n of layout.ungrouped) {
      if (hidden.has(n.id)) continue;
      push(n.id, n.hand, n);
    }
    return segments;
  }
  for (const p of layout.notes) {
    if (hidden.has(p.rhythm.id)) continue;
    push(p.rhythm.id, p.rhythm.hand, p.rhythm);
  }
  return segments;
}

/**
 * Round 16 — **split stack stems**: the painted stems of one onset column must
 * all stand on that column.
 *
 * Coincidence is the doctrine now: one onset's stacked voices share one stem
 * column (one shared stem object for same durations, coincident per-voice
 * stems with each beam/flag at its own end for mixed durations). Two stems of
 * one onset column at different x would be the deleted Round 15 anti-fusion
 * stagger returning silently — a hard error. Flanked same-row seconds are out
 * of scope by construction: their heads stand on different columns, so each
 * stem belongs to its own head-x (the m12 two-voice rule). Only **painted**
 * ink is audited: shared-stem members and clasp-replaced stems draw nothing.
 */
export function checkSplitStackStems(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  const hidden = suppressedStemIds(layout);
  // Painted stems with the head-x they serve: beam stems keep their note's x,
  // standalone stems serve their own note.
  const painted: Array<{ id: string; hand: 'RH' | 'LH'; tick: number; headX: number; stemX: number }> = [];
  if (layout.beams.length > 0) {
    for (const beam of layout.beams) {
      for (let i = 0; i < beam.stems.length; i++) {
        const note = beam.notes[i];
        const p = layout.notes.find((q) => q.note.id === note.id);
        painted.push({
          id: note.id,
          hand: note.hand,
          tick: note.startTick,
          headX: p?.x ?? note.x,
          stemX: beam.stems[i].stemX,
        });
      }
    }
  }
  const beamedIds = new Set(layout.beams.flatMap((beam) => beam.notes.map((n) => n.id)));
  for (const p of layout.notes) {
    if (beamedIds.has(p.note.id)) continue;
    if (hidden.has(p.note.id)) continue;
    painted.push({
      id: p.note.id,
      hand: p.rhythm.hand,
      tick: p.note.startTick,
      headX: p.x,
      stemX: getStemGeometry(p.rhythm, t).stemX,
    });
  }
  // One onset column = one onset's heads sharing one head-x. A column with two
  // painted stem columns is split.
  const byColumn = new Map<string, typeof painted>();
  for (const s of painted) {
    const key = `${s.tick}|${s.headX.toFixed(3)}`;
    const bucket = byColumn.get(key);
    if (bucket) bucket.push(s);
    else byColumn.set(key, [s]);
  }
  for (const bucket of byColumn.values()) {
    if (bucket.length < 2) continue;
    const stemXs = [...new Set(bucket.map((s) => s.stemX.toFixed(3)))].sort();
    if (stemXs.length < 2) continue;
    out.push({
      code: 'split-stack-stems',
      severity: 'error',
      message:
        `Two stems of the onset at tick ${bucket[0].tick} (head-x ${bucket[0].headX.toFixed(2)}) ` +
        `stand at different stem columns (${stemXs.map((x) => `x=${x}`).join(' vs ')}): a stacked ` +
        `onset shares one stem column — same durations one shared stem object, mixed durations ` +
        `coincident per-voice stems. The deleted Round 15 stagger may never return silently.`,
      system: layout.index,
      measure: measureOfTick(bucket[0].tick, t),
      noteIds: bucket.map((s) => s.id),
      x: bucket[0].headX,
      y: layout.geometry.middleCY,
      metrics: {
        headX: bucket[0].headX,
        stemColumns: stemXs.length,
      },
    });
  }
}

/**
 * Every barline segment painted in one system: the measure boundaries of both
 * hands — including the barline that closes the upbeat of an anacrusis system.
 * The staff lines of a system open from the left margin, so slot 0 contributes
 * no barline; Round 7 opens every **intermediate** system at its right edge as
 * well, so the closing system boundary is audited only for the final system
 * (`layout.isFinalSystem`).
 *
 * Round 10: when `finalBarlineStyle === 'unified'` the score's closing boundary
 * is one continuous rule from the RH top to the LH bottom.
 *
 * Round 12 makes **every** measure barline continuous across the Middle C
 * corridor, exactly as `renderBarlines` paints it. Only the closing boundary
 * still honours `'split-corridor'`, which restores the two hand halves.
 */
export function systemBarlines(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): BarlineSpan[] {
  const g = layout.geometry;
  const spans = handRuleSpans(layout);
  const grid = gridRuleSpan(layout);
  const barlines: BarlineSpan[] = [];
  const anacrusis = t.anacrusisTicks ?? 0;
  const unifiedFinal = o.finalBarlineStyle === 'unified' && layout.isFinalSystem;
  const push = (x: number, isSystemEnd: boolean = false): void => {
    if (isSystemEnd && !unifiedFinal) {
      for (const span of spans) barlines.push({ x, top: span.top, bottom: span.bottom });
      return;
    }
    barlines.push({ x, top: grid.top, bottom: grid.bottom });
  };
  if (layout.index === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * g.measureWidth;
    push(g.staffLeft + upbeatWidth);
    for (let m = 1; m <= o.measuresPerSystem; m++) {
      const isSystemEnd = m === o.measuresPerSystem;
      if (isSystemEnd && !layout.isFinalSystem) continue;
      push(g.staffLeft + upbeatWidth + m * g.measureWidth, isSystemEnd);
    }
  } else {
    for (let m = 0; m < o.measuresPerSystem; m++) {
      const isSystemEnd = m === o.measuresPerSystem - 1;
      if (isSystemEnd && !layout.isFinalSystem) continue;
      push(g.staffLeft + (m + 1) * g.measureWidth, isSystemEnd);
    }
  }
  return barlines;
}

/** No glyph (head, stem or beam) may collide with a barline. */
export function checkBarlineClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  const barlines = systemBarlines(layout, o, t);
  if (barlines.length === 0) return;
  // Round 12: under the `'unified-transparent-grid'` policy the barline is a
  // background coordinate. The music uses the full measure width and the
  // circular knockout erases whatever it crosses, so there is no air to audit:
  // the grid owns the overlap and the glyph mask takes it back.
  if (!protectsBarlineInk(o.gridWritingPolicy)) return;

  for (const b of barlines) {
    for (const p of layout.notes) {
      const verticalGap = Math.max(b.top - p.y, 0, p.y - b.bottom);
      if (verticalGap > r) continue;
      const horizontalGap = Math.abs(p.x - b.x);
      const gap = Math.max(0, horizontalGap - r);
      if (gap < lint.minClearance) {
        out.push({
          code: 'barline-collision',
          severity: 'error',
          message:
            `Notehead ${p.note.id} clears the barline at x=${b.x.toFixed(2)} by only ` +
            `${gap.toFixed(2)}pt (${lint.minClearance}pt required).`,
          system: layout.index,
          measure: measureOfTick(p.note.startTick, t),
          noteIds: [p.note.id],
          x: p.x,
          y: p.y,
          metrics: { gap, barlineX: b.x },
        });
      }
    }
    for (const beam of layout.beams) {
      const x0 = Math.min(beam.primary.x1, beam.primary.x2);
      const x1 = Math.max(beam.primary.x1, beam.primary.x2);
      const ids = beam.notes.map((n) => n.id);
      for (const stem of beam.stems) {
        const stemTop = Math.min(stem.stemStartY, stem.stemEndY);
        const stemBottom = Math.max(stem.stemStartY, stem.stemEndY);
        const verticalGap = Math.max(b.top - stemTop, 0, stemBottom - b.bottom);
        if (verticalGap > lint.minClearance) continue;
        const gap = Math.abs(stem.stemX - b.x);
        if (gap < lint.minClearance) {
          out.push({
            code: 'barline-collision',
            severity: 'error',
            message: `Stem at x=${stem.stemX.toFixed(2)} clears the barline at x=${b.x.toFixed(2)} by only ${gap.toFixed(2)}pt.`,
            system: layout.index,
            noteIds: ids,
            x: stem.stemX,
            y: (stem.stemStartY + stem.stemEndY) / 2,
            metrics: { gap, barlineX: b.x },
          });
        }
      }
      if (b.x >= x0 - lint.minClearance && b.x <= x1 + lint.minClearance) {
        const beamYAt = beam.beamY(Math.max(x0, Math.min(x1, b.x)));
        const verticalGap = Math.max(b.top - beamYAt, 0, beamYAt - b.bottom);
        if (verticalGap < lint.minClearance) {
          out.push({
            code: 'barline-collision',
            severity: 'error',
            message: `Beam crosses the barline at x=${b.x.toFixed(2)} with ${verticalGap.toFixed(2)}pt clearance.`,
            system: layout.index,
            noteIds: ids,
            x: b.x,
            y: beamYAt,
            metrics: { gap: verticalGap, barlineX: b.x },
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4b. Clasp clearance (Round 5)
// ---------------------------------------------------------------------------

/**
 * External left clasps are structural ink: they may never touch a barline, a
 * foreign notehead (or its Position of Honor halo) or the left-margin furniture
 * (accolade, measure numeral), and a rail may never reach a barline — it
 * strictly terminates inside its own measure.
 *
 * The thresholds are deliberately *weaker* than the engine's fit rule
 * (`CLASP_NOTEHEAD_AIR` = 1.2pt, `claspMinBarlineAir` = 4.0pt), so every clasp
 * the engine admits is guaranteed to pass this audit; the check exists to catch
 * a regression that paints a bracket where the solver never placed one. Round 7
 * adds one shared exception: the other hand's heads of the clasp's **own onset**
 * travel with the solved column and only owe the bracket non-overlap (see
 * `engine.claspForeignAir`).
 */
export function checkClaspClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  if (layout.clasps.length === 0 && layout.claspRails.length === 0) return;
  const barlines = systemBarlines(layout, o, t);
  // Round 12: the transparent grid reserves no barline air, so the bracket is
  // judged against the glyphs alone (its barline is knocked out by the mask).
  const barlineAir = protectsBarlineInk(o.gridWritingPolicy);
  const r = t.noteheadRadius;
  const haloEdge = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  const { numeral, accolade } = marginFurniture(
    layout,
    t,
    lint,
    layout.index * o.measuresPerSystem + 1,
    o.systemStartStyle
  );

  for (const clasp of layout.clasps) {
    const disk = claspInkBox(clasp, t);
    const own = new Set(clasp.notes.map((n) => n.id));

    // 1. Strict barline non-intersection: claspX - barlineX >= claspMinBarlineAir.
    let leftBarline: number | null = null;
    for (const b of barlines) {
      if (b.x > clasp.claspX + EPS) continue;
      if (leftBarline === null || b.x > leftBarline) leftBarline = b.x;
    }
    if (
      barlineAir &&
      leftBarline !== null &&
      clasp.claspX - leftBarline < t.claspMinBarlineAir - EPS
    ) {
      out.push({
        code: 'clasp-barline-collision',
        severity: 'error',
        message:
          `Clasp at tick ${clasp.tick} clears the barline at x=${leftBarline.toFixed(2)} by only ` +
          `${(clasp.claspX - leftBarline).toFixed(2)}pt (${t.claspMinBarlineAir.toFixed(1)}pt required): ` +
          `the bracket touches or slices through the barline.`,
        system: layout.index,
        measure: measureOfTick(clasp.tick, t),
        noteIds: clasp.notes.map((n) => n.id),
        x: clasp.claspX,
        y: clasp.topY,
        metrics: {
          gap: clasp.claspX - leftBarline,
          required: t.claspMinBarlineAir,
          barlineX: leftBarline,
        },
      });
    }

    // 2. Every foreign glyph keeps real air from the bracket. Round 7: the other
    // hand's heads of the clasp's own onset travel with the same solved column
    // and only have to stay clear of the bracket's ink (see
    // `engine.claspForeignAir`), exactly as the engine's own fit rule measures
    // them.
    for (const p of layout.notes) {
      if (own.has(p.note.id)) continue;
      const radius = isPositionOfHonor(p.note.startTick) ? Math.max(r, haloEdge) : r;
      const required = p.note.startTick === clasp.tick ? 0 : lint.minClearance;
      const dx = Math.max(disk.x0 - p.x, 0, p.x - disk.x1);
      const dy = Math.max(disk.y0 - p.y, 0, p.y - disk.y1);
      const gap = Math.hypot(dx, dy) - radius;
      if (gap >= required - EPS) continue;
      out.push({
        code: 'clasp-collision',
        severity: 'error',
        message:
          `Clasp at tick ${clasp.tick} passes ${gap.toFixed(2)}pt from notehead ${p.note.id} ` +
          `(${required.toFixed(1)}pt of air required): the bracket collides with the glyph.`,
        system: layout.index,
        measure: measureOfTick(clasp.tick, t),
        noteIds: [p.note.id, ...clasp.notes.map((n) => n.id)],
        x: p.x,
        y: p.y,
        metrics: { gap, required, noteX: p.x, noteY: p.y },
      });
    }

    // 3. Left-margin furniture (accolade, measure numeral). Round 7 paints the
    // accolade only at the start of the piece, so intermediate systems only owe
    // the measure numeral its air.
    for (const [label, furniture] of [
      ['accolade', accolade],
      ['measure numeral', numeral],
    ] as const) {
      if (furniture === null) continue;
      if (label === 'accolade' && layout.index !== 0) continue;
      if (label === 'measure numeral' && !o.showMeasureNumbers) continue;
      if (!boxesOverlap(disk, furniture, lint.minClearance)) continue;
      out.push({
        code: 'clasp-collision',
        severity: 'error',
        message: `Clasp at tick ${clasp.tick} collides with the ${label}.`,
        system: layout.index,
        measure: measureOfTick(clasp.tick, t),
        noteIds: clasp.notes.map((n) => n.id),
        x: disk.x0,
        y: disk.y0,
        metrics: { claspX0: disk.x0, furnitureX1: furniture.x1 },
      });
    }
  }

  // 4. A rail strictly terminates inside its measure: it never reaches a barline.
  for (const rail of layout.claspRails) {
    for (const b of barlines) {
      if (rail.x1 - lint.minClearance < b.x && b.x < rail.x2 + lint.minClearance) {
        out.push({
          code: 'clasp-rail-crossing',
          severity: 'error',
          message:
            `Clasp rail ${rail.x1.toFixed(2)}..${rail.x2.toFixed(2)} reaches the barline at ` +
            `x=${b.x.toFixed(2)}: a rail must terminate inside its own measure.`,
          system: layout.index,
          noteIds: rail.noteIds,
          x: b.x,
          y: rail.y,
          metrics: { railX1: rail.x1, railX2: rail.x2, barlineX: b.x },
        });
      }
    }
    const joined = new Set(rail.noteIds);
    const half = rail.thickness / 2;
    for (const p of layout.notes) {
      if (joined.has(p.note.id)) continue;
      const dx = Math.max(rail.x1 - p.x, 0, p.x - rail.x2);
      const dy = Math.max(rail.y - half - p.y, 0, p.y - (rail.y + half));
      const gap = Math.hypot(dx, dy) - r;
      if (gap >= lint.minClearance - EPS) continue;
      out.push({
        code: 'clasp-collision',
        severity: 'error',
        message:
          `Clasp rail passes ${gap.toFixed(2)}pt from notehead ${p.note.id} ` +
          `(${lint.minClearance.toFixed(1)}pt of air required).`,
        system: layout.index,
        measure: measureOfTick(p.note.startTick, t),
        noteIds: [p.note.id, ...rail.noteIds],
        x: p.x,
        y: p.y,
        metrics: { gap, required: lint.minClearance, railY: rail.y },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 4c. Clasp dots (Round 20) and rest clearance (Round 12)
// ---------------------------------------------------------------------------

/**
 * Round 20 — the **clasp dot is a satellite of its mark**, never a nib fused
 * into it.
 *
 * Every dotted clasp paints its 0.75pt dot up-and-right of the duration mark
 * (`rhythm.claspDotCenter`), and the audit measures the painted result in 2D:
 *
 * - daylight from the dot's disc to **its own mark's ink** — the spine, the
 *   open ring(s) and every transverse cut — must be at least the house dot hug
 *   (`tokens.augmentationDotGap`). The retired `yMid` wedge kept ~1.05pt
 *   *overlap* into the ring's stroke on every Brahms dotted half;
 * - daylight from the dot's disc to **every neighbour ink box** — the cluster's
 *   own member discs (which the bracket's fit rule exempts, but the notehead
 *   knockout would erase) and every foreign head of either hand — must keep the
 *   linter's floor.
 */
export function checkClaspDotFusion(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const hug = t.augmentationDotGap;
  const r = t.augmentationDotRadius;
  const haloEdge = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  for (const clasp of layout.clasps) {
    const inks =
      clasp.durationInk && clasp.durationInk.length > 0
        ? clasp.durationInk
        : [resolveClaspInk({ centerY: (clasp.topY + clasp.botY) / 2, durationTicks: clasp.durationTicks })];
    for (const [index, ink] of inks.entries()) {
      if (!ink.dotted) continue;
      // The resolved geometry's own datum — never a fresh guess — so the audit
      // measures what the renderer paints (and a fused regression is caught).
      const dot = clasp.durationDots?.[index] ?? claspDotCenter(clasp, ink, t);
      const markAir = claspMarkDaylight(clasp, ink, dot.x, dot.y, t);
      if (markAir < hug - EPS) {
        out.push({
          code: 'clasp-dot-fusion',
          severity: 'error',
          message:
            `Clasp at tick ${clasp.tick} paints its augmentation dot ${markAir.toFixed(2)}pt from the ` +
            `mark it belongs to (${hug.toFixed(2)}pt of hug air required): the dot fuses with its own ink.`,
          system: layout.index,
          measure: measureOfTick(clasp.tick, t),
          noteIds: clasp.notes.map((n) => n.id),
          x: dot.x,
          y: dot.y,
          metrics: { markAir, required: hug, dotX: dot.x, dotY: dot.y, claspX: clasp.claspX },
        });
      }
      const own = new Set(clasp.notes.map((n) => n.id));
      for (const p of layout.notes) {
        const radius = isPositionOfHonor(p.note.startTick) ? Math.max(r, haloEdge) : r;
        const gap = Math.hypot(dot.x - p.x, dot.y - p.y) - radius - r;
        // A member's disc is exempt from the bracket's own fit rule, so the
        // dot's hug is measured against it here.
        const required = own.has(p.note.id) ? hug : lint.minClearance;
        if (gap >= required - EPS) continue;
        out.push({
          code: 'clasp-dot-fusion',
          severity: 'error',
          message:
            `Clasp at tick ${clasp.tick} paints its augmentation dot ${gap.toFixed(2)}pt from notehead ` +
            `${p.note.id} (${required.toFixed(2)}pt required): the dot runs into neighbouring ink.`,
          system: layout.index,
          measure: measureOfTick(clasp.tick, t),
          noteIds: [p.note.id, ...clasp.notes.map((n) => n.id)],
          x: dot.x,
          y: dot.y,
          metrics: { gap, required, dotX: dot.x, dotY: dot.y, noteX: p.x, noteY: p.y },
        });
      }
    }
  }
}

/**
 * A voice rest is **real musical ink**: its dialect's ink box must keep
 * `minClearance` from every foreign notehead disc (of either hand — the other
 * hand is exactly what plays while this one is silent) and, whenever the active
 * grid writing policy protects the barlines, from the barline column it may
 * never straddle. The engine's `resolveRestX` (hung from the phrase row and
 * seated along it with the guaranteed `REST_SEAT_AIR`) fits the hang with the
 * same box and **more** air — plus the float-safety solver margin — so a rest
 * the engine admits is guaranteed to pass this audit; the check exists to
 * catch a regression that paints a rest where the fit rule never placed one.
 * A rest-notehead clearance failure is a hard **violation**: a rest may never
 * touch, let alone overlap, a head disc.
 */
export function checkRestClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  if (layout.rests.length === 0) return;
  const r = t.noteheadRadius;
  const haloEdge = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  const barlineAir = protectsBarlineInk(o.gridWritingPolicy);
  const barlines = barlineAir ? systemBarlines(layout, o, t) : [];

  const report = (rest: JankoRestGeometry, message: string, extra: Partial<LintViolation>): void => {
    out.push({
      code: 'rest-collision',
      severity: 'error',
      message,
      system: layout.index,
      measure: measureOfTick(rest.tick, t),
      x: rest.x,
      y: rest.y,
      ...extra,
    });
  };

  for (const rest of layout.rests) {
    const box = restInkBox(rest, t);
    for (const p of layout.notes) {
      const radius = isPositionOfHonor(p.note.startTick) ? Math.max(r, haloEdge) : r;
      const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1);
      const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1);
      const gap = Math.hypot(dx, dy) - radius;
      if (gap >= lint.minClearance - EPS) continue;
      report(
        rest,
        `Rest at tick ${rest.tick} (${rest.value}, ${rest.hand}) passes ${gap.toFixed(2)}pt from ` +
          `notehead ${p.note.id} (${lint.minClearance.toFixed(1)}pt of air required).`,
        {
          noteIds: [p.note.id],
          metrics: { gap, required: lint.minClearance, noteX: p.x, noteY: p.y },
        }
      );
    }
    for (const b of barlines) {
      const horizontal = Math.max(box.x0 - b.x, 0, b.x - box.x1);
      const vertical = Math.max(box.y0 - b.bottom, 0, b.top - box.y1);
      const gap = Math.max(0, Math.hypot(horizontal, vertical));
      if (gap >= lint.minClearance - EPS) continue;
      report(
        rest,
        `Rest at tick ${rest.tick} straddles the protected barline at x=${b.x.toFixed(2)} ` +
          `(${gap.toFixed(2)}pt of air, ${lint.minClearance.toFixed(1)}pt required).`,
        { metrics: { gap, required: lint.minClearance, barlineX: b.x } }
      );
    }
  }
}

/**
 * Round 14: a silence the rest fit rule **refused to write** is republished as a
 * named `rest-unwritable` diagnostic, never swallowed. The engine's
 * {@link JankoRestLayer} records every refusal with its reason, so a designer
 * always knows why a hand's silence carries no sign:
 *
 * - `'no-slot'` — the beat cell offers no clear slot along the row: no
 *   horizontal position inside it, on either the reference or the adjacent
 *   fallback row, keeps the guaranteed seating air from the foreign heads, so
 *   writing the rest would mean sliding it into a collision;
 * - `'protected-barline'` — the silence opens on a barline the active grid
 *   writing policy protects and the along-the-row nudge cannot escape it, so
 *   the column belongs to the grid.
 *
 * A refusal is a **warning**, not a painted defect: the engraving is
 * collision-free by construction, and the omitted sign is a known risk the
 * designer may resolve (wider measure, different grid policy, different
 * grouping) rather than an error in the ink.
 */
export function checkUnwrittenRests(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  for (const rest of layout.unwrittenRests) {
    const why =
      rest.reason === 'no-slot'
        ? 'no horizontal position along the row inside the beat cell keeps the guaranteed seating air from the surrounding heads'
        : 'the silence opens on a barline the active grid writing policy protects and the nudge cannot escape it';
    out.push({
      code: 'rest-unwritable',
      severity: 'warning',
      message:
        `Silence at tick ${rest.tick} (${rest.value}, ${rest.hand}, ${rest.durationTicks} ticks) is ` +
        `left unwritten: ${why}. Anchor the voice differently or widen the measure — the rest is ` +
        `never dropped silently and never slid into a collision.`,
      system: layout.index,
      measure: measureOfTick(rest.tick, t),
      x: rest.x,
      y: rest.targetY,
      metrics: {
        tick: rest.tick,
        durationTicks: rest.durationTicks,
        targetY: rest.targetY,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 4d. Rest seats (Round 20) and the united unison digit (Round 20)
// ---------------------------------------------------------------------------
/**
 * Round 20 **optical seat audit**: a rest is seated by its ink centroid, so the
 * glyph's gravity point must stand exactly on a real whole-tone row of the
 * lattice (the phrase row the engine measured, or the row the vertical
 * fallback snapped to).
 *
 * The linter re-derives the painted centroid from the shared ink model
 * (`restInkCentroidOffset`) and subtracts the value's own classical seat
 * offset — zero for the hanging glyphs, and for the bar forms the half-slab
 * above / whole-slab below the row (the `sit` / `hang` pair). What remains must
 * fall on the lattice to the float: a rest the boxes merely *approximated*, or
 * one a regression seated between two rows, is a hard violation. The seat is
 * never a warning — "rests don't sit where the notes are" is the defect this
 * round exists to kill.
 */
export function checkRestSeat(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  for (const rest of layout.rests) {
    // Round 21 §C — the two seats are audited by their own rule.
    //
    // A **bar form** derives its meaning from touching a line, so its seat point
    // is the drawn staff rule it must touch: the half slab's bottom edge, the
    // whole slab's top edge (both exactly `rest.y`, because the painter draws
    // the bar glyphs with their contact edge on the origin). A slab whose edge
    // stands off the nearest drawn rule is the "floating brick" defect this
    // round exists to kill — a hard violation.
    if (isBarRestValue(rest.value)) {
      const rules: number[] = [];
      for (const [hand, octave] of [
        ['RH', 5],
        ['LH', 2],
        ['RH', 4],
        ['LH', 3],
      ] as const) {
        rules.push(...getEquatorRuleYs(layout.geometry.equatorY(hand, octave), o, t));
      }
      const nearest = rules.reduce(
        (best, rule) => (Math.abs(rule - rest.y) < Math.abs(best - rest.y) ? rule : best),
        rules[0]
      );
      if (Math.abs(nearest - rest.y) <= EPS) continue;
      out.push({
        code: 'rest-slab-off-line',
        severity: 'error',
        message:
          `Bar rest at tick ${rest.tick} (${rest.value}, ${rest.hand}) touches no drawn staff line: ` +
          `its contact edge stands on y=${rest.y.toFixed(2)}, ${Math.abs(nearest - rest.y).toFixed(2)}pt ` +
          `from the nearest drawn rule (y=${nearest.toFixed(2)}). A half slab sits ON a line and a ` +
          `whole slab hangs FROM one — a slab that touches nothing means nothing.`,
        system: layout.index,
        measure: measureOfTick(rest.tick, t),
        x: rest.x,
        y: rest.y,
        metrics: { contactY: rest.y, nearestRule: nearest, offLine: Math.abs(nearest - rest.y) },
      });
      continue;
    }
    // A **hanging glyph** is seated by its ink centroid, so the painted gravity
    // point is `rest.y` and it must stand on a real whole-tone row of the
    // lattice. (Round 21 §C makes every value's seat offset zero, so the row is
    // the seat point itself.)
    const gravity = restInkCentroidOffset(rest.value, rest.style, t);
    const seatOffset = restSeatOffsetY(rest.value, rest.style, t);
    const row = rest.y - seatOffset;
    const snapped = nearestLatticeRow(row, layout.geometry, t, o);
    if (Math.abs(snapped - row) <= EPS) continue;
    out.push({
      code: 'rest-centroid-off-row',
      severity: 'error',
      message:
        `Rest at tick ${rest.tick} (${rest.value}, ${rest.hand}) has its ink centroid on ` +
        `y=${row.toFixed(2)}, which is ${Math.abs(snapped - row).toFixed(2)}pt off the nearest ` +
        `whole-tone row (y=${snapped.toFixed(2)}): a rest is seated by its gravity point, and the ` +
        `gravity point stands on its phrase row.`,
      system: layout.index,
      measure: measureOfTick(rest.tick, t),
      x: rest.x,
      y: rest.y,
      metrics: {
        seatY: rest.y,
        seatOffset,
        gravityY: gravity.y,
        row,
        nearestRow: snapped,
        offRow: Math.abs(snapped - row),
      },
    });
  }
}

/**
 * Round 20: **one onset + one pitch = one sound event = one digit**, on both
 * hands.
 *
 * The engine merges every cross-hand unison before the column solve (see
 * `mergeUnisonHeads`), so the audit is a completeness proof on the same data
 * the painter used: for every unison group of the score, exactly **one** head
 * of the group may be painted. Two painted digits — the R19 defect, two "7"s
 * side by side in the Goldberg's final bar, and the six Brahms doubling onsets
 * — are a hard violation with no duration exception.
 */
export function checkUnisonDigits(
  score: QuantizedGridScore,
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  out: LintViolation[]
): void {
  const painted = new Set(layout.notes.map((p) => p.note.id));
  const systemTicks = new Set(layout.notes.map((p) => p.note.startTick));
  for (const p of layout.unisonVoices) systemTicks.add(p.note.startTick);
  const groups = new Map<string, typeof score.notes>();
  for (const note of score.notes) {
    if (!systemTicks.has(note.startTick)) continue;
    const key = `${note.startTick}|${note.pitch.pitchClass}|${note.pitch.octave}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(note);
    else groups.set(key, [note]);
  }
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const hands = new Set(group.map((n) => n.hand));
    if (hands.size < 2) continue;
    const drawn = group.filter((n) => painted.has(n.id));
    if (drawn.length <= 1) continue;
    const [tick, pitchClass, octave] = key.split('|');
    out.push({
      code: 'unison-double-digit',
      severity: 'error',
      message:
        `Onset tick ${tick} sounds pitch class ${pitchClass} (octave ${octave}) in both hands but ` +
        `paints ${drawn.length} digits (${drawn.map((n) => n.id).join(', ')}): one onset and one ` +
        `pitch is one sound event and can only ever draw one digit.`,
      system: layout.index,
      measure: measureOfTick(Number(tick), t),
      noteIds: group.map((n) => n.id),
      metrics: { tick: Number(tick), painted: drawn.length, voices: group.length },
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Left-margin furniture: measure numeral & accolade
// ---------------------------------------------------------------------------

/**
 * Boxes of the measure numeral and the system-start mark of one system. The
 * golden Round 14 `'architectural-bracket'` paints margin ink, so `accolade`
 * is a real box there (and `null` only for the inkless styles).
 */
export function marginFurniture(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  measureNumber: number,
  systemStartStyle: JankoSystemStartStyle = 'architectural-bracket'
): { numeral: Box; accolade: Box | null } {
  // The furniture geometry lives in the engine, where the Round 5 clasp fit
  // rule reserves against the very same boxes (see `engine.getMarginFurniture`);
  // the linter's job is only to audit it.
  const { numeral, accolade } = getMarginFurniture(
    layout.geometry,
    t,
    measureNumber,
    lint.digitAdvance,
    systemStartStyle
  );
  return { numeral, accolade };
}

/** The measure numeral must clear the accolade column, the staff and the music. */
export function checkMeasureNumeralClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  if (!o.showMeasureNumbers) return;
  const anacrusis = t.anacrusisTicks ?? 0;
  if (layout.index === 0 && anacrusis > 0) return;
  const { numeral, accolade } = marginFurniture(
    layout,
    t,
    lint,
    layout.index * o.measuresPerSystem + 1,
    o.systemStartStyle
  );
  // The numeral is right-aligned into the true left margin, so it may share the
  // system-start mark's x-column as long as the two boxes never actually meet
  // (the numeral rides snug above the top rule, the mark spans the staff).
  if (layout.index === 0 && accolade !== null && boxesOverlap(numeral, accolade, 0)) {
    out.push({
      code: 'measure-numeral-collision',
      severity: 'error',
      message: `Measure numeral intrudes into the accolade column (numeral x0=${numeral.x0.toFixed(2)}, accolade x1=${accolade.x1.toFixed(2)}).`,
      system: layout.index,
      x: numeral.x0,
      y: numeral.y1,
      metrics: { numeralX0: numeral.x0, accoladeX1: accolade.x1 },
    });
  }
  if (numeral.x0 < 0 || numeral.x1 > o.pageWidth) {
    out.push({
      code: 'measure-numeral-collision',
      severity: 'error',
      message: `Measure numeral leaves the page (x0=${numeral.x0.toFixed(2)}, x1=${numeral.x1.toFixed(2)}, page width ${o.pageWidth.toFixed(2)}).`,
      system: layout.index,
      x: numeral.x0,
      y: numeral.y1,
      metrics: { numeralX0: numeral.x0, numeralX1: numeral.x1, pageWidth: o.pageWidth },
    });
  }
  if (numeral.y1 > layout.geometry.staffTopY - lint.minClearance) {
    out.push({
      code: 'measure-numeral-collision',
      severity: 'error',
      message: `Measure numeral descends into the staff (bottom ${numeral.y1.toFixed(2)}pt, staffTop ${layout.geometry.staffTopY.toFixed(2)}pt).`,
      system: layout.index,
      x: numeral.x0,
      y: numeral.y1,
      metrics: { numeralBottom: numeral.y1, staffTop: layout.geometry.staffTopY },
    });
  }
  for (const p of layout.notes) {
    const disc = noteDisc(p, t.noteheadRadius);
    if (!boxesOverlap(numeral, disc, lint.minClearance)) continue;
    out.push({
      code: 'measure-numeral-collision',
      severity: 'error',
      message: `Measure numeral collides with notehead ${p.note.id}.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: p.x,
      y: p.y,
      metrics: { noteX: p.x, noteY: p.y },
    });
  }
}

/** The system-start mark must stay on the page and clear the music column. */
export function checkAccoladeClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  // Round 7 paints the system-start mark strictly at the start of the piece: an
  // intermediate system has no margin ink to audit. Round 14's golden flared
  // `'architectural-bracket'` is audited here; inkless styles return no box.
  if (layout.index !== 0) return;
  const { numeral, accolade } = marginFurniture(
    layout,
    t,
    lint,
    layout.index * o.measuresPerSystem + 1,
    o.systemStartStyle
  );
  if (accolade === null) return;
  const g = layout.geometry;
  if (accolade.x0 < 0 || accolade.x1 > g.staffLeft - EPS) {
    out.push({
      code: 'accolade-collision',
      severity: 'error',
      message: `Accolade leaves the left margin (x0=${accolade.x0.toFixed(2)}, x1=${accolade.x1.toFixed(2)}, staffLeft=${g.staffLeft.toFixed(2)}).`,
      system: layout.index,
      x: accolade.x0,
      y: accolade.y0,
      metrics: { accoladeX0: accolade.x0, accoladeX1: accolade.x1, staffLeft: g.staffLeft },
    });
  }
  if (
    Math.abs(accolade.y0 - g.equatorY('RH', 5)) > EPS ||
    Math.abs(accolade.y1 - g.equatorY('LH', 2)) > EPS
  ) {
    out.push({
      code: 'accolade-collision',
      severity: 'error',
      message: 'Accolade does not clasp the full staff height (top/bottom rules must meet the octave rules).',
      system: layout.index,
      x: accolade.x0,
      y: accolade.y0,
      metrics: { top: accolade.y0, staffTop: g.staffTopY, bottom: accolade.y1, staffBot: g.staffBotY },
    });
  }
  if (boxesOverlap(accolade, numeral, 0)) {
    out.push({
      code: 'accolade-collision',
      severity: 'error',
      message: 'Accolade collides with the measure numeral box.',
      system: layout.index,
      x: accolade.x1,
      y: numeral.y0,
      metrics: { accoladeX1: accolade.x1, numeralX0: numeral.x0 },
    });
  }
  for (const p of layout.notes) {
    const distance = pointToBoxDistance(p.x, p.y, accolade) - t.noteheadRadius;
    if (distance < lint.minClearance) {
      out.push({
        code: 'accolade-collision',
        severity: 'error',
        message: `Notehead ${p.note.id} clears the accolade by only ${distance.toFixed(2)}pt.`,
        system: layout.index,
        measure: measureOfTick(p.note.startTick, t),
        noteIds: [p.note.id],
        x: p.x,
        y: p.y,
        metrics: { distance },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// 6. Middle C corridor & guideline integrity
// ---------------------------------------------------------------------------

/**
 * The Middle C channel is a structural corridor: no **horizontal** rule may run
 * along it, no beam connector may slice across it and no hand label may be
 * swallowed by it. Noteheads and stems may legitimately cross the corridor (the
 * hands share the register), and since Round 12 the **vertical grid** does so on
 * purpose: every measure barline and beat pulse is one continuous rule from
 * `rhTop` to `lhBot`, so a corridor-crossing vertical rule is no longer a defect
 * but the invariant itself (see `elements/barlines`).
 *
 * Round 10's `finalBarlineStyle: 'split-corridor'` is the deliberate opt-out:
 * the score's closing boundary then stops at the corridor's edge, exactly as
 * `renderBarlines` draws it (see {@link systemBarlines}).
 */
export function checkMiddleCCorridor(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const g = layout.geometry;
  const spineY = g.middleCY;
  const c = lint.corridorClearance;

  // 1. Horizontal rules: nothing but the spine itself lives on the corridor.
  //    Row guidelines are only audited when they are actually painted, and the
  //    boundary rules of the bounded channel at their true `equator ± half`
  //    positions rather than the (empty) equator itself.
  const horizontalRules: Array<{ label: string; y: number }> = [];
  for (const hand of ['RH', 'LH'] as const) {
    for (const oct of hand === 'RH' ? [5, 4] : [3, 2]) {
      const eq = g.equatorY(hand, oct);
      for (const ruleY of getEquatorRuleYs(eq, o, t)) {
        horizontalRules.push({ label: `${hand} o${oct} equator rule`, y: ruleY });
      }
      if (!o.showRowGuidelines) continue;
      horizontalRules.push({ label: `${hand} o${oct} upper guideline`, y: eq - t.rowHeight / 2 });
      horizontalRules.push({ label: `${hand} o${oct} lower guideline`, y: eq + t.rowHeight / 2 });
    }
  }
  for (const rule of horizontalRules) {
    if (Math.abs(rule.y - spineY) < c) {
      out.push({
        code: 'corridor-intrusion',
        severity: 'error',
        message: `${rule.label} runs through the Middle C corridor (y=${rule.y.toFixed(2)}, spine y=${spineY.toFixed(2)}).`,
        system: layout.index,
        y: rule.y,
        metrics: { ruleY: rule.y, spineY, clearance: c },
      });
    }
  }

  // 2. A beam connector must never slice across the spine. A beam merely
  //    running parallel beside the corridor is legal; a crossing is not.
  for (const beam of layout.beams) {
    const lo = Math.min(beam.primary.y1, beam.primary.y2);
    const hi = Math.max(beam.primary.y1, beam.primary.y2);
    if (lo <= spineY && hi >= spineY) {
      out.push({
        code: 'corridor-intrusion',
        severity: 'error',
        message: `Beam connector crosses the Middle C spine (${lo.toFixed(2)}..${hi.toFixed(2)} vs ${spineY.toFixed(2)}).`,
        system: layout.index,
        measure: measureOfTick(beam.notes[0].startTick, t),
        noteIds: beam.notes.map((n) => n.id),
        x: beam.primary.x1,
        y: spineY,
        metrics: { beamY1: beam.primary.y1, beamY2: beam.primary.y2, spineY },
      });
    }
  }

  // 3. Hand labels (when enabled) must not be swallowed by the corridor.
  if (o.showHandLabels) {
    for (const p of layout.notes) {
      if (Math.abs(p.y - spineY) < t.digitFontSize) {
        out.push({
          code: 'corridor-intrusion',
          severity: 'error',
          message: `Notehead ${p.note.id} sits on the m.s./m.d. hand-label baseline inside the corridor.`,
          system: layout.index,
          measure: measureOfTick(p.note.startTick, t),
          noteIds: [p.note.id],
          x: p.x,
          y: p.y,
          metrics: { noteY: p.y, spineY },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 7. SVG paint-order audit (knockout protection in the emitted document)
// ---------------------------------------------------------------------------

interface SvgNode {
  tag: string;
  cls: string;
  index: number;
  attrs: Record<string, string>;
}

function parseSvgNodes(svg: string): SvgNode[] {
  const nodes: SvgNode[] = [];
  const tagRe = /<(line|circle|text|rect|path|ellipse|polyline|polygon)\b([^>]*)>/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = tagRe.exec(svg)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRe = /([\w-]+)="([^"]*)"/g;
    let attr: RegExpExecArray | null;
    while ((attr = attrRe.exec(match[2])) !== null) attrs[attr[1]] = attr[2];
    nodes.push({ tag: match[1], cls: attrs.class ?? '', index: index++, attrs });
  }
  return nodes;
}

function num(attrs: Record<string, string>, key: string): number {
  const value = Number.parseFloat(attrs[key] ?? '');
  return Number.isFinite(value) ? value : Number.NaN;
}

/** Options accepted by the paint-order audit. */
export interface KnockoutAuditOptions {
  /** Knockout mask half-width `wx` in pt (the active spacing preset). */
  knockoutWx: number;
  /** Knockout mask half-height `hy` in pt (the active spacing preset). */
  knockoutHy: number;
  /** Position of Honor halo ring radius in pt (audited for stem piercing). */
  haloRadius?: number;
  /** Absolute y of the Middle C spine, used to name the offending rule. */
  spineY?: number;
  /** Optical baseline shift of the digit relative to the notehead centre. */
  digitBaselineOffset?: number;
  /** Intersection tolerance: ink must come this close to count as a cut. */
  tolerance?: number;
}

/**
 * Paint-order audit of one rendered system.
 *
 * Verifies four document-level invariants that pure geometry cannot express:
 * 1. every duodecimal digit owns a rectangular knockout mask painted before
 *    it;
 * 2. every knockout mask actually carries a digit (no blank white holes);
 * 3. nothing painted *after* a knockout mask may cut through that box —
 *    this is what "zero staff/beat line pass-through" means in practice;
 * 4. no stem may pierce a Position of Honor halo ring, whichever layer it is
 *    painted in (the ring is stroked on top of the rhythm layer, so a stem
 *    emerging inside it reads as a radial cut through the halo).
 *
 * Lines are audited against the mask box with an exact segment-to-box
 * distance; circles keep the conservative disc-vs-box bound. A notehead's own
 * stem is legal exactly when it starts flush on the outer edge of its mask —
 * `hy + 0.2` for a regular head, `haloRadius + 0.4` for a tick-0 Position of
 * Honor sound; any deeper attachment is a violation.
 */
export function auditKnockoutProtection(
  svg: string,
  options: KnockoutAuditOptions
): LintViolation[] {
  const out: LintViolation[] = [];
  const haloRadius = options.haloRadius ?? options.knockoutHy;
  const tol = options.tolerance ?? 0.05;
  const baseline = options.digitBaselineOffset ?? JANKO_DIGIT_BASELINE_OFFSET;
  const nodes = parseSvgNodes(svg);

  const knockouts = nodes.filter(
    (n) => n.tag === 'rect' && n.cls.includes('janko-knockout')
  );
  const digits = nodes.filter((n) => n.tag === 'text' && n.cls.includes('janko-digit'));

  /** Mask box and centre of one painted knockout rect (null when malformed). */
  const maskOf = (k: SvgNode): { cx: number; cy: number; wx: number; hy: number; mask: Box } | null => {
    const x = num(k.attrs, 'x');
    const y = num(k.attrs, 'y');
    const w = num(k.attrs, 'width');
    const h = num(k.attrs, 'height');
    if (![x, y, w, h].every(Number.isFinite)) return null;
    return { cx: x + w / 2, cy: y + h / 2, wx: w / 2, hy: h / 2, mask: box(x, y, x + w, y + h) };
  };

  // 1. Every digit must be shielded by a knockout painted before it.
  for (const digit of digits) {
    const dx = num(digit.attrs, 'x');
    const dy = num(digit.attrs, 'y') - baseline;
    const shield = knockouts.find((k) => {
      const m = maskOf(k);
      return (
        m !== null &&
        k.index < digit.index &&
        Math.abs(m.cx - dx) < 0.02 &&
        Math.abs(m.cy - dy) < 0.02
      );
    });
    if (!shield) {
      out.push({
        code: 'knockout-missing',
        severity: 'error',
        message: `Digit at (${dx.toFixed(2)}, ${dy.toFixed(2)}) has no white knockout painted before it.`,
        system: -1,
        x: dx,
        y: dy,
        metrics: { digitX: dx, digitY: dy },
      });
    }
  }

  // 2. Every knockout must carry a digit (a blank mask erases staff lines).
  for (const k of knockouts) {
    const m = maskOf(k);
    if (m === null) continue;
    const { cx, cy } = m;
    const digit = digits.find(
      (d) =>
        d.index > k.index &&
        Math.abs(num(d.attrs, 'x') - cx) < 0.02 &&
        Math.abs(num(d.attrs, 'y') - baseline - cy) < 0.02
    );
    if (!digit) {
      out.push({
        code: 'knockout-empty',
        severity: 'error',
        message: `White knockout at (${cx}, ${cy}) carries no digit.`,
        system: -1,
        x: cx,
        y: cy,
        metrics: { cx, cy },
      });
    }
  }

  // 3. Nothing painted after a knockout may cut through it.
  for (const k of knockouts) {
    const m = maskOf(k);
    if (m === null) continue;
    const { cx, cy, wx, hy, mask } = m;
    // The notehead's own stem: a centred column that starts flush on the outer
    // edge of its mask. The 0.4pt halo air also covers the tick-0 sounds.
    const ownStemAnchors = [
      { x: cx, y: cy - (hy + 0.2) },
      { x: cx, y: cy + (hy + 0.2) },
      { x: cx, y: cy - (haloRadius + 0.4) },
      { x: cx, y: cy + (haloRadius + 0.4) },
    ];
    for (const node of nodes) {
      if (node.index <= k.index) continue;
      let distance = Number.POSITIVE_INFINITY;
      if (node.tag === 'line') {
        const x1 = num(node.attrs, 'x1');
        const y1 = num(node.attrs, 'y1');
        const x2 = num(node.attrs, 'x2');
        const y2 = num(node.attrs, 'y2');
        if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
        const isStem = node.cls.includes('janko-stem');
        if (isStem) {
          const attached = ownStemAnchors.some(
            (a) => Math.abs(a.x - x1) < 0.02 && Math.abs(a.y - y1) < 0.02
          );
          if (attached) continue;
        }
        distance = segmentToBoxDistance(x1, y1, x2, y2, mask);
      } else if (node.tag === 'circle' && !node.cls.includes('janko-knockout')) {
        const ox = num(node.attrs, 'cx');
        const oy = num(node.attrs, 'cy');
        const or = num(node.attrs, 'r');
        if (![ox, oy, or].every(Number.isFinite)) continue;
        // Conservative disc-vs-box bound (may over-flag, never under).
        distance = pointToBoxDistance(ox, oy, mask) - or;
      } else if (node.tag === 'rect') {
        // A later knockout mask intersecting this one is the geometry audit's
        // job (`checkNoteheadClearance` owns mask-vs-mask on exact
        // coordinates): paint-level rounding dust would false-positive here.
        if (node.cls.includes('janko-knockout')) continue;
        const x0 = num(node.attrs, 'x');
        const y0 = num(node.attrs, 'y');
        const w = num(node.attrs, 'width');
        const h = num(node.attrs, 'height');
        if (![x0, y0, w, h].every(Number.isFinite)) continue;
        // Box-vs-box: touching ink is legal, intersecting ink is a cut.
        const overlapX = Math.min(mask.x1, x0 + w) - Math.max(mask.x0, x0);
        const overlapY = Math.min(mask.y1, y0 + h) - Math.max(mask.y0, y0);
        distance = Math.min(overlapX, overlapY) > 0 ? 0 : Infinity;
      } else {
        continue;
      }
      if (distance < tol) {
        const overlapPt = Math.max(0, tol - distance);
        const spineHit =
          options.spineY !== undefined &&
          node.tag === 'line' &&
          Math.abs(num(node.attrs, 'y1') - options.spineY) < 0.02 &&
          Math.abs(num(node.attrs, 'y2') - options.spineY) < 0.02;
        const label = node.cls.replace('janko-', '') || node.tag;
        out.push({
          code: 'knockout-pass-through',
          severity: 'error',
          message: spineHit
            ? `Middle C spine cuts through the knockout at (${cx}, ${cy}) — layer order regression.`
            : `${label} element painted after the knockout at (${cx}, ${cy}) cuts ${overlapPt.toFixed(2)}pt into the glyph mask.`,
          system: -1,
          x: cx,
          y: cy,
          metrics: { distance, wx, hy, overlap: overlapPt },
        });
      }
    }
  }

  // 4. No stem may pierce a Position of Honor halo ring. The ring is stroked
  //    above the rhythm layer, so a stem that starts inside it stays visible on
  //    both sides of the ring: a radial cut straight through the halo.
  const halos = nodes.filter((n) => n.tag === 'circle' && n.cls.includes('janko-halo'));
  const stems = nodes.filter((n) => n.tag === 'line' && n.cls.includes('janko-stem'));
  for (const halo of halos) {
    const cx = num(halo.attrs, 'cx');
    const cy = num(halo.attrs, 'cy');
    const hr = num(halo.attrs, 'r');
    const ring = Number.isFinite(hr) ? hr : haloRadius;
    const required = ring + JANKO_HALO_STROKE_WIDTH / 2;
    for (const stem of stems) {
      const x1 = num(stem.attrs, 'x1');
      const y1 = num(stem.attrs, 'y1');
      const x2 = num(stem.attrs, 'x2');
      const y2 = num(stem.attrs, 'y2');
      if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
      const distance = pointToSegmentDistance(cx, cy, x1, y1, x2, y2);
      if (distance + EPS >= required) continue;
      out.push({
        code: 'halo-piercing',
        severity: 'error',
        message:
          `Stem at x=${x1.toFixed(2)} passes ${distance.toFixed(2)}pt from the halo centre at ` +
          `(${cx}, ${cy}) (ring R=${ring.toFixed(2)}pt, outer edge ${required.toFixed(2)}pt): ` +
          `the stem cuts through the Position of Honor halo.`,
        system: -1,
        x: x1,
        y: y1,
        metrics: { distance, haloRadius: ring, required },
      });
    }
  }

  return out;
}

/** Options accepted by the stem/beam document audit. */
export interface StemBeamAuditOptions {
  /** Canonical stem length measured from the notehead centre. */
  stemLength: number;
  /** Maximum acceptable |slope| of a beam connector. */
  maxBeamSlope: number;
  /** Attachment radius (pt) of a regular stem (default golden `hy + 0.2`). */
  stemAttachmentRadius?: number;
  /** Attachment radius (pt) of a tick-0 Position of Honor stem (default `haloRadius + 0.4`). */
  honorStemAttachmentRadius?: number;
  /** Tolerance (pt) for "the stem tip lands on the beam". */
  tolerance?: number;
}

/**
 * Document-level stem/beam audit of one rendered system.
 *
 * A rendered stem is legal when it is either a standalone stem of exactly the
 * canonical length — `stemLength` minus its flush attachment radius, measured
 * from the outer edge of its mask (or halo ring) — or when its tip lands on a
 * beam connector. Every beam connector must also honour the slope clamp.
 */
export function auditStemBeamConnections(
  svg: string,
  options: StemBeamAuditOptions
): LintViolation[] {
  const out: LintViolation[] = [];
  const tol = options.tolerance ?? 0.03;
  const nodes = parseSvgNodes(svg);
  const lines = nodes.filter((n) => n.tag === 'line');
  const stems = lines.filter((n) => n.cls.includes('janko-stem'));
  const beams = lines.filter(
    (n) => n.cls.includes('janko-beam') || n.cls.includes('janko-beam-secondary')
  );
  const regularAttachment =
    options.stemAttachmentRadius ?? getClusterSpacingPreset().hy + 0.2;
  const honorAttachment = options.honorStemAttachmentRadius ?? DEFAULT_JANKO_TOKENS.haloRadius + 0.4;
  const standaloneLengths = [
    options.stemLength - regularAttachment,
    options.stemLength - honorAttachment,
  ];

  for (const beam of beams) {
    const x1 = num(beam.attrs, 'x1');
    const y1 = num(beam.attrs, 'y1');
    const x2 = num(beam.attrs, 'x2');
    const y2 = num(beam.attrs, 'y2');
    if (![x1, y1, x2, y2].every(Number.isFinite) || Math.abs(x2 - x1) < EPS) continue;
    const slope = (y2 - y1) / (x2 - x1);
    if (Math.abs(slope) > options.maxBeamSlope + EPS) {
      out.push({
        code: 'beam-slope',
        severity: 'error',
        message: `Beam connector slope ${slope.toFixed(3)} exceeds the ${options.maxBeamSlope} threshold.`,
        system: -1,
        x: x1,
        y: y1,
        metrics: { slope, limit: options.maxBeamSlope },
      });
    }
  }

  for (const stem of stems) {
    const x1 = num(stem.attrs, 'x1');
    const y1 = num(stem.attrs, 'y1');
    const x2 = num(stem.attrs, 'x2');
    const y2 = num(stem.attrs, 'y2');
    if (![x1, y1, x2, y2].every(Number.isFinite)) continue;
    const length = Math.hypot(x2 - x1, y2 - y1);
    const canonical = standaloneLengths.some((l) => Math.abs(length - l) <= tol + 0.02);
    if (canonical) continue;
    const landsOnBeam = beams.some((beam) => {
      const bx1 = num(beam.attrs, 'x1');
      const by1 = num(beam.attrs, 'y1');
      const bx2 = num(beam.attrs, 'x2');
      const by2 = num(beam.attrs, 'y2');
      if (![bx1, by1, bx2, by2].every(Number.isFinite)) return false;
      const lo = Math.min(bx1, bx2);
      const hi = Math.max(bx1, bx2);
      if (x2 < lo - tol || x2 > hi + tol) return false;
      const t = Math.abs(bx2 - bx1) < EPS ? 0 : (x2 - bx1) / (bx2 - bx1);
      const beamYAt = by1 + t * (by2 - by1);
      return Math.abs(beamYAt - y2) <= 0.35;
    });
    if (!landsOnBeam) {
      const shortest = Math.max(...standaloneLengths);
      const longer = length > shortest;
      out.push({
        code: 'beam-stem-gap',
        severity: 'error',
        message:
          `Stem at x=${x2.toFixed(2)} is ${length.toFixed(2)}pt long and does not land on any beam ` +
          `(${longer ? 'overshoot' : 'shortfall'}; canonical standalone lengths ` +
          `${standaloneLengths.map((l) => l.toFixed(2)).join(' / ')}pt).`,
        system: -1,
        x: x2,
        y: y2,
        metrics: {
          length,
          standaloneLength: shortest,
          regularStandaloneLength: standaloneLengths[0],
          honorStandaloneLength: standaloneLengths[1],
          overshoot: longer ? length - shortest : 0,
        },
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Lint one Jánko engraving.
 *
 * @param score    quantized fence score to engrave and inspect
 * @param options  macro-layout options (defaults to the golden master)
 * @param tokens   micro-typography tokens (defaults to the golden master)
 * @param lint     linter thresholds (defaults to {@link DEFAULT_JANKO_LINT_OPTIONS})
 */
export function lintJankoScore(
  score: QuantizedGridScore,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  lint?: Partial<JankoLintOptions> | null
): LintReport {
  const startedAt = Date.now();
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const thresholds: JankoLintOptions = {
    ...DEFAULT_JANKO_LINT_OPTIONS,
    ...(lint ?? {}),
  };

  const layouts = layoutJankoScore(score, o, t);
  const page = computePageGeometry(o, t);
  const diagnostics: LintViolation[] = [];
  const extents: Array<{ top: number; bottom: number }> = [];

  for (const layout of layouts) {
    checkNoteheadClearance(layout, o, t, thresholds, diagnostics);
    checkKnockoutCoverage(layout, o, t, thresholds, diagnostics);
    checkStemAndBeamValidity(layout, t, thresholds, diagnostics);
    checkStemDigitClearance(layout, t, thresholds, diagnostics);
    checkHaloClearance(layout, t, thresholds, diagnostics);
    checkBeamNoteheadClearance(layout, t, thresholds, diagnostics);
    checkBeamRestClearance(layout, t, thresholds, diagnostics);
    checkStemThroughSimultaneity(layout, o, t, diagnostics);
    checkSplitStackStems(layout, t, diagnostics);
    checkDotCollision(layout, o, t, diagnostics);
    checkGridCrossingOffset(layout, t, diagnostics);
    checkTimeOrder(layout, t, diagnostics);
    checkBarlineClearance(layout, o, t, thresholds, diagnostics);
    checkClaspClearance(layout, o, t, thresholds, diagnostics);
    checkMeasureNumeralClearance(layout, o, t, thresholds, diagnostics);
    checkAccoladeClearance(layout, o, t, thresholds, diagnostics);
    checkRestClearance(layout, o, t, thresholds, diagnostics);
    checkUnwrittenRests(layout, t, diagnostics);
    checkRestSeat(layout, o, t, diagnostics);
    checkUnisonDigits(score, layout, t, diagnostics);
    checkClaspDotFusion(layout, t, thresholds, diagnostics);
    checkMiddleCCorridor(layout, o, t, thresholds, diagnostics);
    checkSystemSlotFit(layout, page, o, t, thresholds, diagnostics);
    extents.push(systemInkExtents(layout, t, thresholds, o));
    if (thresholds.auditPaintOrder) {
      const attachment = getStemAttachmentRadii(t, o);
      const preset = getClusterSpacingPreset(o.clusterSpacing);
      const svg = renderSystem(score, layout.geometry, layout.index, o, t, layout);
      const audit = [
        ...auditKnockoutProtection(svg, {
          knockoutWx: preset.wx,
          knockoutHy: preset.hy,
          haloRadius: t.haloRadius,
          // The audit recovers the notehead centre from the digit's baseline,
          // so it must know the offset the renderer actually used.
          digitBaselineOffset: digitBaselineOffset(t.digitFontSize),
          spineY: layout.geometry.middleCY,
        }),
        ...auditStemBeamConnections(svg, {
          stemLength: t.stemLength,
          maxBeamSlope: thresholds.maxBeamSlope,
          stemAttachmentRadius: attachment.regular,
          honorStemAttachmentRadius: attachment.honor,
        }),
      ].map((v) => ({ ...v, system: layout.index }));
      diagnostics.push(...audit);
    }
  }

  // Round 15: consecutive systems on one page must never overlap. The layouts
  // carry page-relative slot geometry, so two neighbours on the same page are
  // directly comparable; a page break starts a fresh page and is exempt.
  for (let i = 1; i < layouts.length; i++) {
    if (i % page.systemsPerPage === 0) continue;
    const above = extents[i - 1];
    const below = extents[i];
    if (below.top >= above.bottom - thresholds.minClearance) continue;
    diagnostics.push({
      code: 'system-slot-overlap',
      severity: 'error',
      message:
        `System ${i + 1}'s ink reaches up to y=${below.top.toFixed(2)}, into system ${i}'s ink ` +
        `(bottom y=${above.bottom.toFixed(2)}): the two systems overlap on the page.`,
      system: i,
      y: below.top,
      metrics: { lowerTop: below.top, upperBottom: above.bottom },
    });
  }

  const violations = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');
  const notes = layouts.reduce((sum, l) => sum + l.notes.length, 0);
  const beams = layouts.reduce((sum, l) => sum + l.beams.length, 0);

  return {
    ok: violations.length === 0,
    violations,
    warnings,
    diagnostics,
    stats: {
      systems: layouts.length,
      measures: countMeasures(score, t),
      notes,
      beams,
      checks: JANKO_LINT_CHECKS.length,
      violations: violations.length,
      warnings: warnings.length,
      durationMs: Date.now() - startedAt,
    },
  };
}

/** Total measures engraved for a score. */
export function countMeasures(score: QuantizedGridScore, t: ResolvedJankoTokens): number {
  const anacrusis = t.anacrusisTicks ?? 0;
  const ticks = Math.max(0, (score.totalTicks || 0) - anacrusis);
  return Math.max(1, Math.ceil(ticks / t.ticksPerMeasure));
}

/** Convenience: format a report as a compact multi-line summary. */
export function formatLintReport(report: LintReport): string {
  const lines: string[] = [];
  const s = report.stats;
  lines.push(
    `Jánko visual lint: ${report.ok ? '✓ clean' : `✗ ${s.violations} violation(s)`}` +
      `${s.warnings > 0 ? ` · ${s.warnings} warning(s)` : ''}`
  );
  lines.push(
    `  ${s.systems} systems · ${s.measures} measures · ${s.notes} noteheads · ${s.beams} beams · ` +
      `${s.checks} checks · ${s.durationMs} ms`
  );
  for (const v of report.diagnostics) {
    const where = `system ${v.system + 1}${v.measure ? `, m. ${v.measure}` : ''}`;
    lines.push(`  ${v.severity === 'error' ? '✗' : '⚠'} [${v.code}] ${where}: ${v.message}`);
  }
  return lines.join('\n');
}
