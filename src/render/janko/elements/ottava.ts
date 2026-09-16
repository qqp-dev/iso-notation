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
import { PositionedJankoNote, JankoUnisonMerge } from '../engine';
import { URTEXT_OTTAVA_GLYPHS, OttavaGlyph } from './ottava-paths';
import { REST_INK, REST_SCALE } from './rests';
import { f } from './style';

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

/**
 * Build maximal contiguous folded runs of notes per system and construct
 * their Gould-compliant ottava spanner brackets.
 */
export function buildSystemOttavaBrackets(
  notes: readonly PositionedJankoNote[],
  geo: JankoSystemGeometry,
  _options: ResolvedJankoLayoutOptions,
  tokens: ResolvedJankoTokens,
  unisonMerges?: readonly JankoUnisonMerge[]
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
  const clearance = tokens.ottavaClearance ?? 6.0;
  const hookLength = tokens.ottavaHookLength ?? 4.0;

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

      let lineY: number;
      let hookDirection: 1 | -1;
      if (currentShift > 0) {
        // Below staff
        const maxNoteY = Math.max(...currentRun.map((p) => p.y + r));
        const floorY = Math.max(geo.staffBotY, maxNoteY);
        lineY = floorY + clearance;
        hookDirection = -1; // up toward staff
      } else {
        // Above staff
        const minNoteY = Math.min(...currentRun.map((p) => p.y - r));
        const ceilY = Math.min(geo.staffTopY, minNoteY);
        lineY = ceilY - clearance;
        hookDirection = 1; // down toward staff
      }

      // Horizontal position:
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
