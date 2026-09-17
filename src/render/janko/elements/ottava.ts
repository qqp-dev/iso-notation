/**
 * Ottava Spanner Engine (Round 27)
 * =================================
 *
 * Gould-compliant octave spanners (8va / 8vb / 15ma / 15mb):
 *
 * 1. Shape per Gould/SMuFL: verbatim Bravura numeral at the start, straight
 *    horizontal DASHED line over exactly the affected passage, short hook
 *    turning toward the staff at the far end; above the notes to raise
 *    (8va/15ma), below to lower (8vb/15mb). The line is straight even as
 *    notes move (never follows contour).
 * 2. Grouping: maximal contiguous folded runs PER SYSTEM; fresh full label
 *    after every system break (no paren-continuations); singleton folded notes
 *    get the full numeral+line+hook.
 * 3. Self-delimiting: `loco` is skipped.
 */

import {
  JankoOttavaBracket,
  JankoOttavaKind,
  JankoSystemGeometry,
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
} from '../types';
import type { PositionedJankoNote, JankoUnisonMerge } from '../engine';
import { URTEXT_OTTAVA_GLYPHS, OttavaGlyph } from './ottava-paths';
import { REST_INK, REST_SCALE } from './rests';
import { f } from './style';
import {
  JANKO_STEM_STROKE_WIDTH,
  JankoBeamGroupGeometry,
  JankoClaspGroupGeometry,
  JankoRhythmNote,
  CLASP_RING_RADIUS,
  CLASP_RING_STROKE,
  claspInkBox,
  getStemGeometry,
  getSubdivisionGlyphBBox,
  stemRingCenters,
  subdivisionMarkCount,
} from './rhythm';
import { durationDotCount, durationRingCount } from './duration';
import { JankoRestGeometry, restInkBox } from './rests';
import { JANKO_HALO_STROKE_WIDTH, isPositionOfHonor } from './notehead';
import { OutlierRuleSpan, getEquatorRuleYs, pitchGridRules } from './staff';

/**
 * Shared solid-ink treatment (permanent rule): the ottava numeral/letterform
 * renders at the live rest family's uniform scale and ink (`0.85`, `#1A1A1A`).
 * The baked Bravura outlines in `ottava-paths.ts` stay byte-identical; the
 * scale applies at render about the glyph origin, and every measured extent
 * (advance, bbox, spanner connection) reads the scaled helpers below so
 * placement, attachment and audit can never drift from the paint.
 */
export const OTTAVA_GLYPH_SCALE = REST_SCALE;
export const OTTAVA_GLYPH_INK = REST_INK;

/** Scaled advance width (page pt) of one ottava numeral — the painted extent. */
export function ottavaGlyphAdvance(kind: JankoOttavaKind): number {
  return URTEXT_OTTAVA_GLYPHS[kind].advance * OTTAVA_GLYPH_SCALE;
}

/** Scaled bounding box `[x0, y0, x1, y1]` of one ottava numeral — the painted extent. */
export function ottavaGlyphBbox(kind: JankoOttavaKind): readonly [number, number, number, number] {
  const [x0, y0, x1, y1] = URTEXT_OTTAVA_GLYPHS[kind].bbox;
  const s = OTTAVA_GLYPH_SCALE;
  return [x0 * s, y0 * s, x1 * s, y1 * s];
}

/** Render a verbatim Bravura ottava sign outline into an SVG path string. */
export function renderOttavaGlyph(
  kind: JankoOttavaKind,
  x: number,
  lineY: number
): string {
  const glyph: OttavaGlyph = URTEXT_OTTAVA_GLYPHS[kind];
  const s = OTTAVA_GLYPH_SCALE;
  // For 8vb/15mb (below the staff), the numeral sits ON the line (origin at baseline lineY).
  // For 8va/15ma (above the staff), the numeral sits UNDER the line (towards the staff).
  const baselineY =
    kind === '8va' || kind === '15ma' ? lineY - glyph.bbox[1] * s : lineY;
  const p = (q: readonly [number, number]): string =>
    `${f(x + q[0] * s)} ${f(baselineY + q[1] * s)}`;
  const d = glyph.contours
    .map(
      (c) =>
        `M ${p(c.start)} ` +
        c.segments.map(([a, b, e]) => `C ${p(a)} ${p(b)} ${p(e)}`).join(' ') +
        ' Z'
    )
    .join(' ');
  return `<path class="janko-ottava-glyph" data-ottava-kind="${kind}" d="${d}" fill="${OTTAVA_GLYPH_INK}" stroke="none" fill-rule="evenodd"/>`;
}

/** Render one complete ottava spanner bracket (numeral + dashed line + hook). */
export function renderOttavaBracket(
  bracket: JankoOttavaBracket,
  tokens: ResolvedJankoTokens
): string {
  const dashLen = tokens.ottavaDashLength ?? 3.5;
  const dashGap = tokens.ottavaDashGap ?? 2.0;
  const strokeW = tokens.ottavaLineWidth ?? 0.35;
  const hookLen = bracket.hookLength;
  const hookY =
    bracket.lineY + (bracket.hookDirection === -1 ? -hookLen : hookLen);

  return [
    `    <g class="janko-ottava-bracket" data-ottava-kind="${bracket.kind}">`,
    `      ${renderOttavaGlyph(bracket.kind, bracket.x0, bracket.lineY)}`,
    `      <line class="janko-ottava-line" x1="${f(bracket.dashX0)}" y1="${f(bracket.lineY)}" x2="${f(bracket.dashX1)}" y2="${f(bracket.lineY)}" stroke="#111111" stroke-width="${f(strokeW)}" stroke-dasharray="${f(dashLen)} ${f(dashGap)}"/>`,
    `      <line class="janko-ottava-hook" x1="${f(bracket.dashX1)}" y1="${f(bracket.lineY)}" x2="${f(bracket.dashX1)}" y2="${f(hookY)}" stroke="#111111" stroke-width="${f(strokeW)}"/>`,
    '    </g>',
  ].join('\n');
}

/** Render all ottava brackets of a system. */
export function renderOttavaBrackets(
  brackets: readonly JankoOttavaBracket[],
  tokens: ResolvedJankoTokens
): string {
  if (!brackets || brackets.length === 0) return '';
  const out: string[] = ['  <g class="janko-ottava-layer">'];
  for (const b of brackets) {
    out.push(renderOttavaBracket(b, tokens));
  }
  out.push('  </g>');
  return out.join('\n');
}

/** Determine the SMuFL octave sign kind from the pitch shift. */
export function kindForShift(shift: number): JankoOttavaKind {
  if (shift === 12) return '8vb';
  if (shift === -12) return '8va';
  if (shift === 24) return '15mb';
  if (shift === -24) return '15ma';
  return shift > 0 ? '8vb' : '8va';
}

// ---------------------------------------------------------------------------
// Ticket §5 — complete-ink ottava clearance + shared placement resolver
// ---------------------------------------------------------------------------

/**
 * Actual-ink air (pt) the ottava label and hook keep from beams, stems and
 * other marks. First-review value 1.2pt: a consistent air choice for
 * label ink, not the inherited 6pt notehead gap applied blindly. The
 * established 6pt staff/notehead minimum clearance is preserved alongside.
 */
export const OTTAVA_ACTUAL_INK_GAP = 1.2;

/** One painted ink box with its horizontal span (page pt). */
export interface OttavaInkBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Absolute x of a bracket's numeral (inverse of the builder's placement). */
export function ottavaNumeralX(
  bracket: JankoOttavaBracket,
  tokens: ResolvedJankoTokens
): number {
  const advance = ottavaGlyphAdvance(bracket.kind);
  const gap = tokens.ottavaDashGap ?? 2.0;
  if (bracket.dashX0 === undefined || !Number.isFinite(bracket.dashX0)) return bracket.x0;
  return bracket.dashX0 - advance - gap;
}

/**
 * Painted extent of a bracket's numeral/letterform (page pt) — the scaled
 * Bravura bbox at the rendered origin, mirroring {@link renderOttavaGlyph}
 * exactly (below-staff signs sit ON the line, above-staff signs UNDER it).
 * The glyph paints with `stroke="none"`, so no stroke growth applies.
 */
export function ottavaLabelBox(
  bracket: JankoOttavaBracket,
  tokens: ResolvedJankoTokens
): OttavaInkBox {
  const glyph: OttavaGlyph = URTEXT_OTTAVA_GLYPHS[bracket.kind];
  const s = OTTAVA_GLYPH_SCALE;
  const nx = ottavaNumeralX(bracket, tokens);
  const [gx0, gy0, gx1, gy1] = glyph.bbox;
  if (bracket.shift > 0) {
    return {
      x0: nx + gx0 * s,
      y0: bracket.lineY + gy0 * s,
      x1: nx + gx1 * s,
      y1: bracket.lineY + gy1 * s,
    };
  }
  const baselineY = bracket.lineY - gy0 * s;
  return {
    x0: nx + gx0 * s,
    y0: baselineY + gy0 * s,
    x1: nx + gx1 * s,
    y1: baselineY + gy1 * s,
  };
}

/** Painted extent of a bracket's hook (stroke included). */
export function ottavaHookBox(
  bracket: JankoOttavaBracket,
  tokens: ResolvedJankoTokens
): OttavaInkBox {
  const w = (tokens.ottavaLineWidth ?? 0.35) / 2;
  const hookY = bracket.lineY + (bracket.hookDirection === -1 ? -bracket.hookLength : bracket.hookLength);
  return {
    x0: bracket.dashX1 - w,
    y0: Math.min(bracket.lineY, hookY),
    x1: bracket.dashX1 + w,
    y1: Math.max(bracket.lineY, hookY),
  };
}

/** Painted extent of a bracket's dashed line (stroke included). */
export function ottavaLineBox(
  bracket: JankoOttavaBracket,
  tokens: ResolvedJankoTokens
): OttavaInkBox {
  const w = (tokens.ottavaLineWidth ?? 0.35) / 2;
  return {
    x0: Math.min(bracket.dashX0, bracket.dashX1),
    y0: bracket.lineY - w,
    x1: Math.max(bracket.dashX0, bracket.dashX1),
    y1: bracket.lineY + w,
  };
}

/**
 * Everything the ottava resolver needs beyond the notes themselves: the
 * system's laid-out rhythm ink. The engine passes its resolved layout
 * pieces; the linter passes the same from the layout it audits — one
 * collector, both consumers.
 */
export interface OttavaInkContext {
  /** Resolved beam groups (all levels). */
  beams: readonly JankoBeamGroupGeometry[];
  /** Unbeamed rhythm notes (standalone stems/flags/dots/rings). */
  ungrouped: readonly JankoRhythmNote[];
  /** Note ids whose standalone stem is suppressed (clasp/vertical/shared). */
  suppressedStemIds: ReadonlySet<string>;
  /** Admitted brackets (spine, marks and dots). */
  clasps: readonly JankoClaspGroupGeometry[];
  /** Printed rests. */
  rests: readonly JankoRestGeometry[];
  /** Continuous outlier-rule spans (shared helper, render-exact). */
  outlierRules: readonly OutlierRuleSpan[];
  /** Active layout options (grammar, subdivision style, rhythm style). */
  options: ResolvedJankoLayoutOptions;
}

/**
 * Complete musical ink boxes of one system for ottava clearance: painted
 * stems (beamed stems at their painted beam attach, standalone stems minus
 * suppressed), every beam level strip, solo subdivision flags, augmentation
 * dots (beamed and standalone voices), stem rings, brackets (spine, marks,
 * dots via the shared ink box), rests and staff-rule-adjacent ledger lines.
 * Noteheads themselves are collected separately (halo-aware) by the caller
 * loop; staff edges arrive as floors. Mirrors the renderers box for box, so
 * placement and audit can never drift from the paint.
 */
export function collectOttavaContextInk(
  context: OttavaInkContext,
  tokens: ResolvedJankoTokens
): OttavaInkBox[] {
  const boxes: OttavaInkBox[] = [];
  const o = context.options;
  const halfStem = JANKO_STEM_STROKE_WIDTH / 2;
  const grammar = o.durationGrammar;
  // Beamed voices: painted stems (head to beam centerline), every beam
  // strip (all levels incl. partial stubs), and augmentation dots.
  for (const beam of context.beams) {
    for (let i = 0; i < beam.stems.length; i++) {
      const s = beam.stems[i];
      const attachY = beam.beamY(s.stemX);
      boxes.push({
        x0: s.stemX - halfStem,
        y0: Math.min(s.stemStartY, attachY),
        x1: s.stemX + halfStem,
        y1: Math.max(s.stemStartY, attachY),
      });
    }
    const halfBeam = tokens.beamThickness / 2;
    const strips = [beam.primary, ...beam.levels.map((l) => l.connector)];
    for (const c of strips) {
      if (!c) continue;
      boxes.push({
        x0: Math.min(c.x1, c.x2),
        y0: Math.min(c.y1, c.y2) - halfBeam,
        x1: Math.max(c.x1, c.x2),
        y1: Math.max(c.y1, c.y2) + halfBeam,
      });
    }
    for (const n of beam.notes) {
      const dots = durationDotCount(n.durationTicks, grammar);
      if (dots < 1) continue;
      const r = tokens.augmentationDotRadius;
      const cx = n.dotX ?? n.x;
      const cy = n.dotY ?? n.y;
      boxes.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
      if (dots >= 2) {
        const c2x = n.dot2X ?? cx + 2 * r + tokens.augmentationDotGap;
        const c2y = n.dot2Y ?? cy;
        boxes.push({ x0: c2x - r, y0: c2y - r, x1: c2x + r, y1: c2y + r });
      }
    }
  }
  // Standalone voices: stems that paint, solo flags, dots and rings.
  for (const n of context.ungrouped) {
    if (context.suppressedStemIds.has(n.id)) continue;
    const s = getStemGeometry(n, tokens);
    boxes.push({
      x0: s.stemX - halfStem,
      y0: Math.min(s.stemStartY, s.stemEndY),
      x1: s.stemX + halfStem,
      y1: Math.max(s.stemStartY, s.stemEndY),
    });
    const marks = subdivisionMarkCount(n.durationTicks, grammar);
    if (marks >= 1 && o.rhythmStyle === 'beamed') {
      const bb = getSubdivisionGlyphBBox(o.subdivisionStyle, s.direction, marks, tokens);
      boxes.push({
        x0: s.stemX + bb.x0,
        y0: s.stemEndY + bb.y0,
        x1: s.stemX + bb.x1,
        y1: s.stemEndY + bb.y1,
      });
    } else if (marks >= 1) {
      // Retired display dialects: bound the cuts/ticks at the tip.
      const half = tokens.slashDx + 0.6 + 0.6;
      boxes.push({
        x0: s.stemX - half,
        y0: Math.min(s.stemEndY - s.direction * 5.6, s.stemEndY) - tokens.slashDy - 0.6,
        x1: s.stemX + half,
        y1: Math.max(s.stemEndY - s.direction * 5.6, s.stemEndY) + tokens.slashDy + 0.6,
      });
    }
    const dots = durationDotCount(n.durationTicks, grammar);
    if (dots >= 1) {
      const r = tokens.augmentationDotRadius;
      const cx = n.dotX ?? n.x;
      const cy = n.dotY ?? n.y;
      boxes.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r });
      if (dots >= 2) {
        const c2x = n.dot2X ?? cx + 2 * r + tokens.augmentationDotGap;
        const c2y = n.dot2Y ?? cy;
        boxes.push({ x0: c2x - r, y0: c2y - r, x1: c2x + r, y1: c2y + r });
      }
    }
    if (durationRingCount(n.durationTicks, grammar) > 0) {
      const outer = CLASP_RING_RADIUS + CLASP_RING_STROKE / 2;
      for (const c of stemRingCenters(n, tokens, grammar)) {
        boxes.push({ x0: c.x - outer, y0: c.y - outer, x1: c.x + outer, y1: c.y + outer });
      }
    }
  }
  for (const clasp of context.clasps) {
    const box = claspInkBox(clasp, tokens);
    boxes.push({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 });
  }
  for (const rest of context.rests) {
    const box = restInkBox(rest, tokens);
    boxes.push({ x0: box.x0, y0: box.y0, x1: box.x1, y1: box.y1 });
  }
  return boxes;
}

/**
 * Shared ottava placement resolver (§5): the line y for one spanner from
 * the complete musical ink over its actual horizontal span.
 *
 * - Below the staff (`shift > 0`): the line stands at or below the staff
 *   floor plus the preserved 6pt, every overlapped notehead's bottom plus
 *   the preserved 6pt, and the full ink bottom plus the label/hook extent
 *   (`max(labelUp, hookLength)`) plus the 1.2pt actual-ink gap.
 * - Above: the mirror (staff/notehead tops minus 6pt; ink top minus
 *   `max(labelDown, hookLength)` minus the gap).
 *
 * Pure over its inputs; the builder, the crop/page geometry (via the placed
 * brackets' boxes) and the linter all read this one function. No
 * measure/pitch hardcoding, no octave-coverage or fold-policy change.
 */
export function resolveOttavaLineY(args: {
  kind: JankoOttavaKind;
  shift: number;
  /** Full music-ink extremes over the bracket's horizontal span. */
  inkTop: number;
  inkBottom: number;
  /** Notehead-disc extremes over the span (halo-aware). */
  noteTop: number;
  noteBottom: number;
  staffTopY: number;
  staffBotY: number;
  hookLength: number;
  tokens: ResolvedJankoTokens;
}): number {
  const { kind, shift, inkTop, inkBottom, noteTop, noteBottom, staffTopY, staffBotY, hookLength, tokens } = args;
  const clearance = tokens.ottavaClearance ?? 6.0;
  const [, gy0, , gy1] = URTEXT_OTTAVA_GLYPHS[kind].bbox;
  const s = OTTAVA_GLYPH_SCALE;
  if (shift > 0) {
    const labelUp = -gy0 * s;
    return Math.max(
      staffBotY + clearance,
      noteBottom + clearance,
      inkBottom + Math.max(labelUp, hookLength) + OTTAVA_ACTUAL_INK_GAP
    );
  }
  const labelDown = (gy1 - gy0) * s;
  return Math.min(
    staffTopY - clearance,
    noteTop - clearance,
    inkTop - Math.max(labelDown, hookLength) - OTTAVA_ACTUAL_INK_GAP
  );
}

/**
 * Build maximal contiguous folded runs of notes per system and construct
 * their Gould-compliant ottava spanner brackets.
 */
export function buildSystemOttavaBrackets(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  options: ResolvedJankoLayoutOptions,
  tokens: ResolvedJankoTokens,
  unisonMerges?: readonly JankoUnisonMerge[],
  context?: OttavaInkContext | null
): JankoOttavaBracket[] {
  const folded = notes.filter(
    (p) => p.ottavaShift !== undefined && p.ottavaShift !== 0
  );
  if (folded.length === 0) return [];

  const brackets: JankoOttavaBracket[] = [];
  const r = tokens.noteheadRadius;
  const dashGap = tokens.ottavaDashGap ?? 2.0;
  const dashLen = tokens.ottavaDashLength ?? 3.5;
  const minDashSpan = dashLen * 2 + dashGap;
  const hookLength = tokens.ottavaHookLength ?? 4.0;
  // Complete rhythm ink of the system (beams, stems, flags, dots, rings,
  // brackets, rests), collected once; each run reads the boxes overlapping
  // its own horizontal span. Without context (lightweight fixtures) the
  // resolver reads noteheads and staff floors only.
  const contextInk = context ? collectOttavaContextInk(context, tokens) : [];
  const haloOuter = tokens.haloRadius + JANKO_HALO_STROKE_WIDTH / 2;
  const ledgerHalf = tokens.ledgerHalfWidth;

  const mergeMap = new Map<string, string[]>();
  if (unisonMerges) {
    for (const m of unisonMerges) {
      mergeMap.set(m.survivorId, m.mergedIds);
    }
  }

  // Group folded notes per hand and direction into maximal contiguous runs
  for (const hand of ['LH', 'RH'] as const) {
    const handFolded = folded
      .filter((p) => p.note.hand === hand)
      .sort((a, b) => a.note.startTick - b.note.startTick || a.x - b.x);
    if (handFolded.length === 0) continue;

    const allHandNotes = notes
      .filter((p) => p.note.hand === hand)
      .sort((a, b) => a.note.startTick - b.note.startTick || a.x - b.x);

    let currentRun: PositionedJankoNote[] = [];
    let currentShift = 0;

    const flushRun = () => {
      if (currentRun.length === 0) return;
      const firstNote = currentRun[0];
      const lastNote = currentRun[currentRun.length - 1];
      const kind = kindForShift(currentShift);
      // Spanner connection reads the painted (scaled) advance, so the dashed
      // line starts exactly one gap past the rendered numeral's right edge.
      const advance = ottavaGlyphAdvance(kind);

      // Horizontal position (X only; the line y resolves after, from the
      // complete ink over this span):
      let numeralX: number;
      if (firstNote.x - r - dashGap - advance >= geo.staffLeft) {
        numeralX = firstNote.x - r - dashGap - advance;
      } else {
        numeralX = Math.max(geo.staffLeft, firstNote.x - advance / 2);
      }
      const dashX0 = numeralX + advance + dashGap;
      const lastNoteRight = lastNote.x + r + 2.0;
      const dashX1 = Math.min(
        geo.staffRight,
        Math.max(lastNoteRight, dashX0 + minDashSpan)
      );

      const x0 = Math.min(numeralX, firstNote.x - r);
      const x1 = Math.max(dashX1, lastNote.x + r);

      // Complete ink over the span: halo-aware notehead discs, staff grid
      // rules (exact segments via the shared rule list), ledger dashes
      // (equator-expanded, dash-exact) and continuous outlier rules (shared
      // spans, render-exact), plus every rhythm-ink box (beams, stems,
      // flags, dots, rings, brackets, rests) overlapping [x0, x1]. The
      // shared resolver places the line from these extremes (§5).
      const EPS = 1e-9;
      const overlaps = (ix0: number, ix1: number): boolean => !(ix1 < x0 - EPS || ix0 > x1 + EPS);
      let noteTop = Number.POSITIVE_INFINITY;
      let noteBottom = Number.NEGATIVE_INFINITY;
      let inkTop = Number.POSITIVE_INFINITY;
      let inkBottom = Number.NEGATIVE_INFINITY;
      for (const p of notes) {
        const glyph = isPositionOfHonor(p.note.startTick) ? Math.max(r, haloOuter) : r;
        if (overlaps(p.x - glyph, p.x + glyph)) {
          noteTop = Math.min(noteTop, p.y - glyph);
          noteBottom = Math.max(noteBottom, p.y + glyph);
          inkTop = Math.min(inkTop, p.y - glyph);
          inkBottom = Math.max(inkBottom, p.y + glyph);
        }
        if (overlaps(p.x - ledgerHalf, p.x + ledgerHalf)) {
          for (const ledgerY of p.coord.ledgerYs) {
            for (const ruleY of getEquatorRuleYs(geo.middleCY + ledgerY, options, tokens)) {
              inkTop = Math.min(inkTop, ruleY - 0.375);
              inkBottom = Math.max(inkBottom, ruleY + 0.375);
            }
          }
        }
      }
      for (const rule of pitchGridRules(geo, options, tokens)) {
        if (!overlaps(rule.x1, rule.x2)) continue;
        inkTop = Math.min(inkTop, rule.y - rule.width / 2);
        inkBottom = Math.max(inkBottom, rule.y + rule.width / 2);
      }
      for (const span of context?.outlierRules ?? []) {
        if (!overlaps(span.x1, span.x2)) continue;
        inkTop = Math.min(inkTop, span.y - 0.375);
        inkBottom = Math.max(inkBottom, span.y + 0.375);
      }
      for (const box of contextInk) {
        if (!overlaps(box.x0, box.x1)) continue;
        inkTop = Math.min(inkTop, box.y0);
        inkBottom = Math.max(inkBottom, box.y1);
      }
      if (!Number.isFinite(noteTop)) {
        noteTop = currentShift > 0 ? geo.staffBotY : geo.staffTopY;
        noteBottom = noteTop;
      }
      if (!Number.isFinite(inkTop)) {
        inkTop = noteTop;
        inkBottom = noteBottom;
      }
      const lineY = resolveOttavaLineY({
        kind,
        shift: currentShift,
        inkTop,
        inkBottom,
        noteTop,
        noteBottom,
        staffTopY: geo.staffTopY,
        staffBotY: geo.staffBotY,
        hookLength,
        tokens,
      });
      const hookDirection: 1 | -1 = currentShift > 0 ? -1 : 1;

      const noteIds: string[] = [];
      for (const p of currentRun) {
        noteIds.push(p.note.id);
        const merged = mergeMap.get(p.note.id);
        if (merged) noteIds.push(...merged);
      }

      brackets.push({
        kind,
        shift: currentShift,
        x0,
        x1,
        lineY,
        dashX0,
        dashX1,
        hookDirection,
        hookLength,
        noteIds,
      });

      currentRun = [];
      currentShift = 0;
    };

    for (const p of handFolded) {
      if (currentRun.length === 0) {
        currentRun.push(p);
        currentShift = p.ottavaShift!;
      } else if (p.ottavaShift === currentShift) {
        const prev = currentRun[currentRun.length - 1];
        const interveningUnfolded = allHandNotes.some(
          (other) =>
            (!other.ottavaShift || other.ottavaShift === 0) &&
            other.note.startTick >= prev.note.startTick + prev.note.durationTicks &&
            other.note.startTick <= p.note.startTick
        );
        if (!interveningUnfolded) {
          currentRun.push(p);
        } else {
          flushRun();
          currentRun.push(p);
          currentShift = p.ottavaShift!;
        }
      } else {
        flushRun();
        currentRun.push(p);
        currentShift = p.ottavaShift!;
      }
    }
    flushRun();
  }

  brackets.sort((a, b) => a.x0 - b.x0);
  return brackets;
}
