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
 *    knockout disc, the glyph's ink box fits inside that disc with real white
 *    breathing room on every side, and nothing painted after the disc (staff
 *    rules, row guidelines, ledger equators, beat grid, stems, beams,
 *    barlines) may cut through it. This is the invariant that guarantees
 *    "zero staff/beat line pass-through".
 * 2. **Collision & clearance** — notehead *discs* may not overlap, measured as
 *    circles: a chord is allowed to stack on different whole-tone rows, and two
 *    tones that share one row of one octave are resolved by the engine's
 *    Row-Snapped Parity Offset (Approach 2), which spreads them horizontally by
 *    a full disc. A same-row pair that is still narrower than `2r` is surfaced
 *    as `chordal-overlap`, and nothing may collide with a barline.
 * 3. **Corridor & guideline integrity** — the Middle C channel stays free of
 *    structural rules and beams, and the spine is never cut by a glyph.
 * 4. **Beam & stem validity** — stems attach *flush on the outside* of their
 *    glyph circle (the halo ring at tick 0, the knockout disc otherwise), stay
 *    clear of their own digit by a real margin, never pierce the Position of
 *    Honor halo, sit on their notehead's vertical centreline (`stemX ===
 *    note.x`) and reach the beam centerline exactly (no overshoot, no gap);
 *    every beam connector stays a minimum clearance away from every notehead
 *    disc (`beam-notehead-collision`), and every beam slope stays inside the
 *    acceptable threshold.
 * 5. **Accolade & measure numeral clearances** — the left-margin furniture
 *    never collides with the music or with itself.
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
  JankoTokens,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from './types';
import {
  JankoSystemLayout,
  PositionedJankoNote,
  getChordalOffset,
  getMarginFurniture,
  layoutJankoScore,
  renderSystem,
} from './engine';
import { getEquatorRuleYs } from './elements/staff';
import {
  JankoBeamConnector,
  claspInkBox,
  getStemAttachmentRadii,
  getStemAttachmentRadius,
  getStemGeometry,
} from './elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  JANKO_HALO_STROKE_WIDTH,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
} from './elements/notehead';

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
  | 'barline-collision'
  | 'clasp-barline-collision'
  | 'clasp-collision'
  | 'clasp-rail-crossing'
  | 'measure-numeral-collision'
  | 'accolade-collision'
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
   * Minimum white margin (pt) the knockout disc must leave on **every side**
   * (top, bottom, left, right) of the digit's ink box.
   */
  digitClearance: number;
  /** Minimum air (pt) between a stem and its own digit glyph box. */
  stemDigitClearance: number;
  /** Minimum white margin (pt) a knockout must leave around the digit corner. */
  knockoutMargin: number;
  /** Run the SVG paint-order audit (slower, catches layer regressions). */
  auditPaintOrder: boolean;
}

/** Canonical linter thresholds (aligned with the golden master). */
export const DEFAULT_JANKO_LINT_OPTIONS: JankoLintOptions = {
  maxBeamSlope: 0.25,
  minClearance: 1.0,
  corridorClearance: 2.0,
  digitAdvance: 0.35,
  digitClearance: 1.2,
  stemDigitClearance: 1.2,
  knockoutMargin: 0.25,
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
  'barline-clearance',
  'clasp-clearance',
  'measure-numeral-clearance',
  'accolade-clearance',
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

// ---------------------------------------------------------------------------
// 1. Notehead clearance
// ---------------------------------------------------------------------------

/**
 * Notehead discs may never overlap.
 *
 * Three cases are distinguished, and they are exactly the three musical
 * situations a two-row whole-tone staff can produce:
 *
 * 1. **Row-snapped chord tones** (`a.startTick === b.startTick`, same `y`) — the
 *    engine keeps every head on its true whole-tone row and resolves the
 *    collision *horizontally* (Approach 2, Row-Snapped Parity Offset, see
 *    `engine.resolveRowSnappedChordOffsets`). A horizontal displacement of at
 *    least one notehead diameter (`dx >= 2r - ε`) therefore clears the pair —
 *    this is the check that certifies the offset is real and wide enough. A
 *    pair that still shares a page point is reported as `chordal-overlap`.
 * 2. **Chordal heads on different rows** (`dy >= 2r`) — legal by construction:
 *    the two whole-tone rows of an octave are one `rowHeight` (15pt) apart, so a
 *    stacked chord never touches, and the ∇ / Δ hand shapes stay vertically
 *    aligned on one beat column.
 * 3. **Different onsets** — nothing may collapse onto one point: a hard
 *    `notehead-overlap`, because two independent beats must never share a glyph.
 */
export function checkNoteheadClearance(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  const required = 2 * r;
  const sorted = [...layout.notes].sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const dx = Math.abs(b.x - a.x);
      // x-sorted, so nothing further right can reach: the discs are circles.
      if (dx >= required) break;
      const dy = Math.abs(b.y - a.y);
      // The discs are circles, so the true test is the centre distance, not a
      // bounding box: two heads on rows 4pt apart (the bounded channel's two
      // octave flanks) are already clear at dx = √((2r)² − dy²) < 2r.
      const distance = Math.hypot(dx, dy);
      if (distance >= required - EPS) continue;
      const chordal = a.note.startTick === b.note.startTick;
      const sameRow = dy < EPS;
      const detail = {
        dx,
        dy,
        distance,
        required,
        /** Horizontal displacement still missing to clear the pair. */
        missingOffset: Math.max(0, required - distance),
        /** Canonical row-snapped displacement the engine aims for. */
        canonicalOffset: sameRow && chordal ? getChordalOffset(t) : 0,
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
        // Case 1: the row-snapped displacement did not happen, or was narrower
        // than one disc. The later knockout would erase the earlier digit, so
        // the pair is surfaced instead of being silently accepted.
        const offset = getChordalOffset(t);
        out.push({
          code: 'chordal-overlap',
          severity: 'warning',
          message:
            `Chordal noteheads ${a.note.id} (${a.coord.hand} pc${a.coord.pitchClass} o${a.coord.octave}) and ` +
            `${b.note.id} (${b.coord.hand} pc${b.coord.pitchClass} o${b.coord.octave}) share row ${a.coord.rank} of ` +
            `octave ${a.coord.octave} only ${dx.toFixed(2)}pt apart (${required.toFixed(2)}pt required): the later ` +
            `knockout erases the earlier digit. Row-snap one head by Δx = ${offset.toFixed(2)}pt.`,
          ...base,
        });
      } else if (chordal) {
        out.push({
          code: 'chordal-overlap',
          severity: 'warning',
          message:
            `Chordal noteheads ${a.note.id} (${a.coord.hand} pc${a.coord.pitchClass} o${a.coord.octave}) and ` +
            `${b.note.id} (${b.coord.hand} pc${b.coord.pitchClass} o${b.coord.octave}) are ${distance.toFixed(2)}pt apart: ` +
            `the later knockout erases the earlier digit. Displace the voices or merge the heads.`,
          ...base,
        });
      } else {
        out.push({
          code: 'notehead-overlap',
          severity: 'error',
          message:
            `Noteheads ${a.note.id} and ${b.note.id} overlap (${distance.toFixed(2)}pt apart, ` +
            `${required.toFixed(2)}pt required; dx=${dx.toFixed(2)}, dy=${dy.toFixed(2)}).`,
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
 * keeps a real white margin **on every side** — otherwise the digit pokes out
 * of its own mask and staff lines graze the glyph.
 *
 * The digit box is derived from the renderer's own metrics
 * ({@link digitHalfExtents}: URW Gothic cap height and widest-glyph half
 * width, resolved against the CSS `pt` → user-unit factor), so the check can
 * never drift from what is actually painted.
 */
export function checkKnockoutCoverage(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  const r = t.noteheadRadius;
  const { halfWidth, halfHeight } = digitHalfExtents(t.digitFontSize);
  const horizontal = r - halfWidth;
  const vertical = r - halfHeight;
  const corner = r - Math.hypot(halfWidth, halfHeight);
  const required = Math.max(halfWidth, halfHeight) + lint.digitClearance;
  for (const p of layout.notes) {
    if (
      horizontal + EPS >= lint.digitClearance &&
      vertical + EPS >= lint.digitClearance &&
      corner + EPS >= lint.knockoutMargin
    ) {
      continue;
    }
    out.push({
      code: 'knockout-undersized',
      severity: 'error',
      message:
        `Knockout r=${r.toFixed(2)}pt cannot shield the ${t.digitFontSize}pt digit ` +
        `(needs r>=${required.toFixed(2)}pt for ${lint.digitClearance.toFixed(1)}pt of white on ` +
        `every side; left/right ${horizontal.toFixed(2)}pt, top/bottom ${vertical.toFixed(2)}pt, ` +
        `corner ${corner.toFixed(2)}pt): staff lines would graze the glyph.`,
      system: layout.index,
      measure: measureOfTick(p.note.startTick, t),
      noteIds: [p.note.id],
      x: p.x,
      y: p.y,
      metrics: {
        radius: r,
        required,
        digitFontSize: t.digitFontSize,
        digitHalfWidth: halfWidth,
        digitHalfHeight: halfHeight,
        horizontal,
        vertical,
        corner,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// 3. Stem & beam validity
// ---------------------------------------------------------------------------

/**
 * Stems must be engraved on their notehead's vertical centreline
 * (`stemX === note.x`), attach **flush on the outside** of their glyph circle
 * — the wider Position of Honor halo ring for tick-0 sounds, the knockout disc
 * otherwise — and reach the beam centerline exactly (no overshoot, no
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
    // The radius of the circle the stem must start flush against.
    const effectiveRadius = getStemAttachmentRadius(p.rhythm, t);
    const circleLabel = honor
      ? `halo ring (R=${t.haloRadius.toFixed(2)}pt)`
      : `knockout disc (r=${r.toFixed(2)}pt)`;
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
          `${circleLabel}: the stem would cut through it and crowd the digit ` +
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
          `(${circleLabel} perimeter at ${effectiveRadius.toFixed(2)}pt): the stem floats off the head.`,
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
 * The stem starts flush on the glyph circle's perimeter, so the air between
 * the stem column and the digit's ink box is a pure consequence of the disc
 * radius, the digit font size and the optical centring. It must stay at least
 * {@link JankoLintOptions.stemDigitClearance} — with the canonical tokens the
 * real margin is ≈2.1pt.
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

// ---------------------------------------------------------------------------
// 4. Barline clearance
// ---------------------------------------------------------------------------

/** One barline segment of a system, per hand (RH and LH halves). */
export interface BarlineSpan {
  x: number;
  top: number;
  bottom: number;
}

/**
 * Every barline segment painted in one system: the measure boundaries of both
 * hands — including the barline that closes the upbeat of an anacrusis system.
 * The staff lines of a system open from the left margin, so slot 0 contributes
 * no barline; Round 7 opens every **intermediate** system at its right edge as
 * well, so the closing system boundary is audited only for the final system
 * (`layout.isFinalSystem`).
 */
export function systemBarlines(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): BarlineSpan[] {
  const g = layout.geometry;
  const spans = handRuleSpans(layout);
  const barlines: BarlineSpan[] = [];
  const anacrusis = t.anacrusisTicks ?? 0;
  const push = (x: number): void => {
    for (const span of spans) barlines.push({ x, top: span.top, bottom: span.bottom });
  };
  if (layout.index === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * g.measureWidth;
    push(g.staffLeft + upbeatWidth);
    for (let m = 1; m <= o.measuresPerSystem; m++) {
      if (m === o.measuresPerSystem && !layout.isFinalSystem) continue;
      push(g.staffLeft + upbeatWidth + m * g.measureWidth);
    }
  } else {
    for (let m = 0; m < o.measuresPerSystem; m++) {
      if (m === o.measuresPerSystem - 1 && !layout.isFinalSystem) continue;
      push(g.staffLeft + (m + 1) * g.measureWidth);
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
  const r = t.noteheadRadius;
  const haloEdge = t.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  const { numeral, accolade } = marginFurniture(
    layout,
    t,
    lint,
    layout.index * o.measuresPerSystem + 1
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
    if (leftBarline !== null && clasp.claspX - leftBarline < t.claspMinBarlineAir - EPS) {
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
// 5. Left-margin furniture: measure numeral & accolade
// ---------------------------------------------------------------------------

/** Boxes of the measure numeral and the accolade of one system. */
export function marginFurniture(
  layout: JankoSystemLayout,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  measureNumber: number
): { numeral: Box; accolade: Box } {
  // The furniture geometry lives in the engine, where the Round 5 clasp fit
  // rule reserves against the very same boxes (see `engine.getMarginFurniture`);
  // the linter's job is only to audit it.
  const { numeral, accolade } = getMarginFurniture(
    layout.geometry,
    t,
    measureNumber,
    lint.digitAdvance
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
    layout.index * o.measuresPerSystem + 1
  );
  // The numeral opens the measure-number column: it must start to the right of
  // the accolade's column, never above/inside it. Round 7 paints the accolade
  // only at the start of the piece, so intermediate systems have a free column.
  if (layout.index === 0 && numeral.x0 < accolade.x1) {
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

/** The accolade must stay on the page and clear the music column. */
export function checkAccoladeClearance(
  layout: JankoSystemLayout,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens,
  lint: JankoLintOptions,
  out: LintViolation[]
): void {
  // Round 7 paints the accolade strictly at the start of the piece: an
  // intermediate system has no accolade ink to audit.
  if (layout.index !== 0) return;
  const { numeral, accolade } = marginFurniture(
    layout,
    t,
    lint,
    layout.index * o.measuresPerSystem + 1
  );
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
  if (Math.abs(accolade.y0 - g.staffTopY) > EPS || Math.abs(accolade.y1 - g.staffBotY) > EPS) {
    out.push({
      code: 'accolade-collision',
      severity: 'error',
      message: 'Accolade does not clasp the full staff height (top/bottom rules must meet the staff).',
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
 * The Middle C channel is a structural corridor: no barline, beat-grid pulse,
 * guideline or beam may run into or across the spine. Noteheads and stems may
 * legitimately cross the corridor (the hands share the register), but anything
 * painted after a notehead's knockout must not cut through it — that is audited
 * separately by {@link auditKnockoutProtection}.
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

  // 1. Structural vertical rules must terminate clear of the spine.
  for (const span of handRuleSpans(layout)) {
    const lo = Math.min(span.top, span.bottom);
    const hi = Math.max(span.top, span.bottom);
    if (lo - c <= spineY && hi + c >= spineY) {
      out.push({
        code: 'corridor-intrusion',
        severity: 'error',
        message: `${span.hand} structural rules (${lo.toFixed(2)}..${hi.toFixed(2)}) intrude into the Middle C corridor at y=${spineY.toFixed(2)}.`,
        system: layout.index,
        y: spineY,
        metrics: { ruleTop: lo, ruleBottom: hi, spineY, clearance: c },
      });
    }
  }

  // 2. Horizontal rules: nothing but the spine itself lives on the corridor.
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

  // 3. A beam connector must never slice across the spine. A beam merely
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

  // 4. Hand labels (when enabled) must not be swallowed by the corridor.
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
  /** Notehead (knockout) radius in pt. */
  noteheadRadius: number;
  /** Position of Honor halo ring radius in pt (audited for stem piercing). */
  haloRadius?: number;
  /** Absolute y of the Middle C spine, used to name the offending rule. */
  spineY?: number;
  /** Optical baseline shift of the digit relative to the notehead centre. */
  digitBaselineOffset?: number;
  /** Intersection tolerance: a line must come this close to count as a cut. */
  tolerance?: number;
}

/**
 * Paint-order audit of one rendered system.
 *
 * Verifies four document-level invariants that pure geometry cannot express:
 * 1. every duodecimal digit owns a knockout disc painted immediately before it;
 * 2. every knockout disc actually carries a digit (no blank white holes);
 * 3. nothing painted *after* a knockout disc may cut through that disc — this
 *    is what "zero staff/beat line pass-through" means in practice;
 * 4. no stem may pierce a Position of Honor halo ring, whichever layer it is
 *    painted in (the ring is stroked on top of the rhythm layer, so a stem
 *    emerging inside it reads as a radial cut through the halo).
 *
 * A notehead's own stem is legal exactly when it starts flush on the outer edge
 * of its circle — `noteheadRadius + 0.2` for a regular head, `haloRadius + 0.4`
 * for a tick-0 Position of Honor sound; any deeper attachment is a violation.
 */
export function auditKnockoutProtection(
  svg: string,
  options: KnockoutAuditOptions
): LintViolation[] {
  const out: LintViolation[] = [];
  const r = options.noteheadRadius;
  const haloRadius = options.haloRadius ?? r;
  const tol = options.tolerance ?? 0.05;
  const baseline = options.digitBaselineOffset ?? JANKO_DIGIT_BASELINE_OFFSET;
  const nodes = parseSvgNodes(svg);

  const knockouts = nodes.filter(
    (n) => n.tag === 'circle' && n.cls.includes('janko-knockout')
  );
  const digits = nodes.filter((n) => n.tag === 'text' && n.cls.includes('janko-digit'));

  // 1. Every digit must be shielded by a knockout painted before it.
  for (const digit of digits) {
    const dx = num(digit.attrs, 'x');
    const dy = num(digit.attrs, 'y') - baseline;
    const shield = knockouts.find((k) => {
      return (
        k.index < digit.index &&
        Math.abs(num(k.attrs, 'cx') - dx) < 0.02 &&
        Math.abs(num(k.attrs, 'cy') - dy) < 0.02
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

  // 2. Every knockout must carry a digit (a blank disc erases staff lines).
  for (const k of knockouts) {
    const cx = num(k.attrs, 'cx');
    const cy = num(k.attrs, 'cy');
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
    const cx = num(k.attrs, 'cx');
    const cy = num(k.attrs, 'cy');
    const kr = num(k.attrs, 'r');
    const radius = Number.isFinite(kr) ? kr : r;
    // The notehead's own stem: a centred column that starts flush on the outer
    // edge of its circle. The 0.4pt halo air also covers the tick-0 sounds.
    const ownStemAnchors = [
      { x: cx, y: cy - (radius + 0.2) },
      { x: cx, y: cy + (radius + 0.2) },
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
        distance = pointToSegmentDistance(cx, cy, x1, y1, x2, y2);
      } else if (node.tag === 'circle' && !node.cls.includes('janko-knockout')) {
        const ox = num(node.attrs, 'cx');
        const oy = num(node.attrs, 'cy');
        const or = num(node.attrs, 'r');
        if (![ox, oy, or].every(Number.isFinite)) continue;
        distance = Math.hypot(ox - cx, oy - cy) - or;
      } else if (node.tag === 'rect') {
        const x0 = num(node.attrs, 'x');
        const y0 = num(node.attrs, 'y');
        const w = num(node.attrs, 'width');
        const h = num(node.attrs, 'height');
        if (![x0, y0, w, h].every(Number.isFinite)) continue;
        distance = pointToBoxDistance(cx, cy, box(x0, y0, x0 + w, y0 + h));
      } else {
        continue;
      }
      if (distance < radius - tol) {
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
            : `${label} element painted after the knockout at (${cx}, ${cy}) cuts ${(radius - distance).toFixed(2)}pt into the glyph mask.`,
          system: -1,
          x: cx,
          y: cy,
          metrics: { distance, radius, overlap: radius - distance },
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
  /** Attachment radius (pt) of a regular stem (default `noteheadRadius + 0.2`). */
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
 * from the outer edge of its glyph circle — or when its tip lands on a beam
 * connector. Every beam connector must also honour the slope clamp.
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
  const regularAttachment = options.stemAttachmentRadius ?? DEFAULT_JANKO_TOKENS.noteheadRadius + 0.2;
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
  const diagnostics: LintViolation[] = [];

  for (const layout of layouts) {
    checkNoteheadClearance(layout, t, thresholds, diagnostics);
    checkKnockoutCoverage(layout, t, thresholds, diagnostics);
    checkStemAndBeamValidity(layout, t, thresholds, diagnostics);
    checkStemDigitClearance(layout, t, thresholds, diagnostics);
    checkHaloClearance(layout, t, thresholds, diagnostics);
    checkBeamNoteheadClearance(layout, t, thresholds, diagnostics);
    checkBarlineClearance(layout, o, t, thresholds, diagnostics);
    checkClaspClearance(layout, o, t, thresholds, diagnostics);
    checkMeasureNumeralClearance(layout, o, t, thresholds, diagnostics);
    checkAccoladeClearance(layout, o, t, thresholds, diagnostics);
    checkMiddleCCorridor(layout, o, t, thresholds, diagnostics);
    if (thresholds.auditPaintOrder) {
      const attachment = getStemAttachmentRadii(t);
      const svg = renderSystem(score, layout.geometry, layout.index, o, t, layout);
      const audit = [
        ...auditKnockoutProtection(svg, {
          noteheadRadius: t.noteheadRadius,
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
