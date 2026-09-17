/**
 * System-start margin ink: the incumbent copperplate accolade and the
 * Round 10/11 replacements.
 *
 * The curlicue copperplate brace does not match the modern design language, so
 * the golden master retires it. Round 14 settles the flared 0.65pt
 * `'architectural-bracket'` as the canonical System 1 start; the alternative
 * ruled marks are kept as the published catalogue, and `'open-halo'` keeps the
 * open margin (no margin ink at all) that preceded the ruling. The ruled
 * alternatives keep a structural mark at the same reserved margin column:
 *
 * - `'architectural-bracket'` — a straight 0.65pt rule whose 3.0pt spurs clasp
 *   the Octave 5 and Octave 2 rules and **flare diagonally outward** by
 *   {@link ARCHITECTURAL_BRACKET_FLARE_DEGREES} (Round 13 standardizes the
 *   flared form as the primary architectural bracket);
 * - `'delicate-bracket'` (Round 12) — the same bracket drawn lighter: a 0.50pt
 *   rule with 2.5pt spurs;
 * - `'clef-pillar'` — a slender 0.50pt pillar connecting the octave equators,
 *   ticked at every octave line (Round 12 removes the Middle C nib, so the
 *   pillar is a pure registration landmark of the octave lattice);
 * - `'double-hairline'` — a modern double vertical bounding rule (0.75pt
 *   outer, 0.35pt inner, 2.5pt spacing) flush at the start of System 1;
 * - `'none'` — nothing at all.
 *
 * The copperplate path itself is still exported (and preserved from the historical
 * landscape print pipeline) for the historical golden masters.
 */

import { continuousPitchY } from '../geometry';
import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { f } from './style';

/** Classical architectural reach of the vertical accolade cusp from the staff edge. */
const ACCOLADE_WIDTH_PT = 7.5;
/** Delicate calligraphic swell of the accolade in its lobe bellies. */
const ACCOLADE_THICKNESS_PT = 1.9;

/**
 * Classical LilyPond/Emmentaler brace outline command table.
 * 15 cubic Bézier segments derived from authentic master music engraving (brace396).
 */
const LILY_BRACE_CMDS: Array<{ type: 'M' | 'c' | 's'; args: number[] }> = [
  { type: 'M', args: [-133, -1078] },
  { type: 'c', args: [0, 721, -287, 1064, -287, 1078] },
  { type: 'c', args: [0, 35, 287, 329, 287, 1078] },
  { type: 'c', args: [0, 756, -266, 1463, -266, 2324] },
  { type: 'c', args: [0, 504, 98, 994, 378, 1414] },
  { type: 'c', args: [21, 28, 63, -7, 42, -35] },
  { type: 'c', args: [-217, -322, -287, -686, -287, -1071] },
  { type: 'c', args: [0, -749, 259, -1449, 259, -2296] },
  { type: 'c', args: [0, -504, -91, -994, -371, -1414] },
  { type: 'c', args: [280, -420, 371, -910, 371, -1414] },
  { type: 'c', args: [0, -847, -259, -1547, -259, -2296] },
  { type: 'c', args: [0, -385, 70, -749, 287, -1071] },
  { type: 'c', args: [21, -28, -21, -63, -42, -35] },
  { type: 'c', args: [-280, 420, -378, 910, -378, 1414] },
  { type: 'c', args: [0, 861, 266, 1568, 266, 2324] },
];

/** One point of the master outline, in font units. */
type BracePoint = [number, number];

/**
 * The master outline as cubic curves (font units). Both the path builder and
 * the Round 9 ink-weight pass read this one table, so the shape that is painted
 * and the shape that is measured can never drift apart.
 */
const LILY_BRACE_CURVES: ReadonlyArray<readonly [BracePoint, BracePoint, BracePoint, BracePoint]> =
  (() => {
    const curves: Array<[BracePoint, BracePoint, BracePoint, BracePoint]> = [];
    let curr: BracePoint = [LILY_BRACE_CMDS[0].args[0], LILY_BRACE_CMDS[0].args[1]];
    let prevCp: BracePoint = [curr[0], curr[1]];
    for (let i = 1; i < LILY_BRACE_CMDS.length; i++) {
      const cmd = LILY_BRACE_CMDS[i];
      let p1: BracePoint;
      let p2: BracePoint;
      let p3: BracePoint;
      if (cmd.type === 'c') {
        p1 = [curr[0] + cmd.args[0], curr[1] + cmd.args[1]];
        p2 = [curr[0] + cmd.args[2], curr[1] + cmd.args[3]];
        p3 = [curr[0] + cmd.args[4], curr[1] + cmd.args[5]];
      } else {
        p1 = [2 * curr[0] - prevCp[0], 2 * curr[1] - prevCp[1]];
        p2 = [curr[0] + cmd.args[0], curr[1] + cmd.args[1]];
        p3 = [curr[0] + cmd.args[2], curr[1] + cmd.args[3]];
      }
      curves.push([curr, p1, p2, p3]);
      prevCp = p2;
      curr = p3;
    }
    return curves;
  })();

/** The outline's `M` anchor (the first point of the first curve). */
const LILY_BRACE_START: BracePoint = [LILY_BRACE_CMDS[0].args[0], LILY_BRACE_CMDS[0].args[1]];

/** Samples per curve when the outline is measured for its ink weight. */
const LILY_BRACE_SAMPLES = 32;

/** Sample one cubic Bézier at `t`. */
function bracePointAt(
  [p0, p1, p2, p3]: readonly [BracePoint, BracePoint, BracePoint, BracePoint],
  t: number
): BracePoint {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Flattened master outline (font units) — the reference of the thinning pass. */
const LILY_BRACE_OUTLINE: readonly BracePoint[] = (() => {
  const points: BracePoint[] = [];
  for (const curve of LILY_BRACE_CURVES) points.push([curve[0][0], curve[0][1]]);
  for (const curve of LILY_BRACE_CURVES) {
    for (let s = 1; s <= LILY_BRACE_SAMPLES; s++) points.push(bracePointAt(curve, s / LILY_BRACE_SAMPLES));
  }
  return points;
})();

/** The `[left, right]` ink intervals of the master outline at font height `y`. */
function braceInkIntervalsAt(y: number): Array<[number, number]> {
  const outline = LILY_BRACE_OUTLINE;
  const crossings: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if ((a[1] - y) * (b[1] - y) >= 0) continue;
    const t = (y - a[1]) / (b[1] - a[1]);
    crossings.push(a[0] + t * (b[0] - a[0]));
  }
  crossings.sort((a, b) => a - b);
  const intervals: Array<[number, number]> = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    intervals.push([crossings[i], crossings[i + 1]]);
  }
  return intervals;
}

/**
 * Round 9 — thin one outline point toward its section's outer edge until the
 * local ink is at most `thick` font units wide. A point on the outer contour is
 * fixed (the requested reach is never touched) and a section already thinner
 * than `thick` — the feather-tapered tips and the cusp needle — stays exactly as
 * drawn, so the master curve keeps its silhouette and taper while shedding the
 * weight the `accoladeThick` token does not want.
 */
function thinBracePoint(p: BracePoint, thick: number): BracePoint {
  const intervals = braceInkIntervalsAt(p[1]);
  if (intervals.length === 0) return [p[0], p[1]];
  let best = intervals[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const interval of intervals) {
    const distance = Math.max(interval[0] - p[0], 0, p[0] - interval[1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = interval;
    }
  }
  const width = best[1] - best[0];
  if (width <= 0 || width <= thick) return [p[0], p[1]];
  const k = thick / width;
  return [best[0] + (p[0] - best[0]) * k, p[1]];
}

/**
 * Authentic classical vertical accolade (curly brace) for the left margin of a
 * horizontal system. It clasps the full 4-octave staff from yTop (o5) to yBot (o1)
 * with its central cusp pointing directly horizontally into the Middle C spine at y(48).
 *
 * Implements the definitive Emmentaler/LilyPond master-engraved brace geometry:
 * - Razor-sharp horizontal beak cusp at yMid pointing leftward into the margin
 * - Delicate, graceful waist inflections
 * - Sculptural, organic swelling bellies
 * - Feather-tapered tips clasping the staff edges at staffLeft
 *
 * Round 9 makes the slimming *genuine*: `reach` drives `scaleX`, and `thick` is
 * the ink weight the master outline is thinned to (see {@link thinBracePoint}),
 * so the Jánko token pair (`4.8pt` / `0.55pt`) paints a truly hairline brace
 * instead of a fixed-weight glyph.
 */
export function getVerticalAccoladePath(
  staffLeft: number,
  yTop: number,
  yBot: number,
  reachOrBelly: number = ACCOLADE_WIDTH_PT,
  cuspOrThick: number = ACCOLADE_THICKNESS_PT,
  maybeThick?: number
): string {
  const requestedReach = maybeThick !== undefined ? cuspOrThick : reachOrBelly;
  const reach = requestedReach > 0 ? requestedReach : ACCOLADE_WIDTH_PT;
  const thick = maybeThick !== undefined ? maybeThick : cuspOrThick;

  const ym = (yTop + yBot) / 2;
  const h = yBot - yTop;
  const FONT_MAX_Y = 4844.0;
  const FONT_MIN_X = -420.0;
  const FONT_MAX_X = 42.0;

  const scaleY = (h / 2) / FONT_MAX_Y;
  const scaleX = reach / (FONT_MAX_X - FONT_MIN_X);
  const thin = scaleX > 0 && thick > 0 ? thick / scaleX : 0;
  const fix = (p: BracePoint): BracePoint => (thin > 0 ? thinBracePoint(p, thin) : p);

  const toS = (x: number, y: number): string =>
    `${(staffLeft + (x - FONT_MAX_X) * scaleX).toFixed(2)} ${(ym - y * scaleY).toFixed(2)}`;

  const start = fix(LILY_BRACE_START);
  const parts = [`M ${toS(start[0], start[1])}`];

  for (const curve of LILY_BRACE_CURVES) {
    const p1 = fix([curve[1][0], curve[1][1]]);
    const p2 = fix([curve[2][0], curve[2][1]]);
    const p3 = fix([curve[3][0], curve[3][1]]);
    parts.push(`C ${toS(p1[0], p1[1])}, ${toS(p2[0], p2[1])}, ${toS(p3[0], p3[1])}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/** Horizontal reach (pt) of an architectural bracket's spurs. */
export const ARCHITECTURAL_BRACKET_SPUR = 3.0;
/** Stroke (pt) of the architectural bracket. */
export const ARCHITECTURAL_BRACKET_STROKE = 0.65;
/** Horizontal reach (pt) of System 1 architectural bracket's spurs (slightly grander). */
export const SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR = 3.5;
/** Stroke (pt) of System 1 architectural bracket (slightly grander). */
export const SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE = 0.90;
/** Delta between System 1 bracket stroke and Systems 2+ stroke (operator ruling: 0.90 vs 0.65, no delta preservation). */
export const SYSTEM_1_BRACKET_STROKE_DELTA = 0.25;
/** Delta between System 1 bracket spur reach and Systems 2+ spur reach. */
export const SYSTEM_1_BRACKET_SPUR_DELTA = 0.50;
/**
 * Round 13: outward diagonal flare (degrees) of the architectural bracket's
 * spurs. The top spur leaves the Octave 5 rule rising away from the staff and
 * the bottom spur leaves the Octave 2 rule falling away from it, so the rule
 * clasps the four octave rules with a calm architectural gesture instead of a
 * right-angled picture frame. The vertical travel of a 3.0pt spur is
 * `3.0 · tan(13°) ≈ 0.69pt`.
 */
export const ARCHITECTURAL_BRACKET_FLARE_DEGREES = 13.0;
/** Tangent of {@link ARCHITECTURAL_BRACKET_FLARE_DEGREES}. */
export const ARCHITECTURAL_BRACKET_FLARE_TAN = Math.tan(
  (ARCHITECTURAL_BRACKET_FLARE_DEGREES * Math.PI) / 180
);
/** Round 12: the delicate bracket — a lighter rule with shorter spurs. */
export const DELICATE_BRACKET_SPUR = 2.5;
export const DELICATE_BRACKET_STROKE = 0.50;
/** Stroke (pt) of the clef pillar's slender lattice hairline. */
export const CLEF_PILLAR_STROKE = 0.50;
/** Horizontal reach (pt) of a clef pillar's octave ticks. */
export const CLEF_PILLAR_TICK = 2.4;
/** Stroke (pt) of the double hairline frame's outer and inner rules. */
export const DOUBLE_HAIRLINE_OUTER_STROKE = 0.75;
export const DOUBLE_HAIRLINE_INNER_STROKE = 0.35;
/** Centre-to-centre spacing (pt) of the double hairline frame. */
export const DOUBLE_HAIRLINE_SPACING = 2.5;

/**
 * Accolade path at explicit coordinates — the historical copperplate master
 * outline (w = 4.8pt, thick = 0.55pt), retained for the archived golden masters
 * and historical reference. Round 10
 * retires it from the Jánko system start (`JankoSystemStartStyle`).
 */
export function renderAccoladePath(
  x: number,
  yTop: number,
  yBot: number,
  width: number,
  thick: number,
  fill: string = '#111827'
): string {
  const d = getVerticalAccoladePath(x, yTop, yBot, width, thick);
  return `    <path class="janko-accolade" d="${d}" fill="${fill}"/>`;
}

/**
 * Round 12 delicate architectural bracket: the right-angled clasp that Round
 * 13's flared {@link renderFlaredArchitecturalBracket} replaced, drawn at
 * 0.50pt with 2.5pt spurs. The lighter rule lets the opening margin read as a
 * hairline registration mark rather than a structural frame.
 */
export function renderDelicateBracket(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  return renderBracket(
    geo,
    tokens,
    DELICATE_BRACKET_STROKE,
    DELICATE_BRACKET_SPUR,
    'janko-system-bracket-delicate'
  );
}

/**
 * Round 13: the **flared architectural bracket** — a straight 0.65pt rule
 * clasping the Octave 5 … Octave 2 rules, whose top spur extends rightward and
 * flares slightly diagonally upward/outward and whose bottom spur flares
 * slightly diagonally downward/outward (13°, see
 * {@link ARCHITECTURAL_BRACKET_FLARE_DEGREES}). It is the primary
 * `'architectural-bracket'` of the published catalogue.
 */
export function renderFlaredArchitecturalBracket(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null,
  isSystem1?: boolean
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const top = geo.middleCY + continuousPitchY(60, t.semitoneScale);
  const bot = geo.middleCY + continuousPitchY(36, t.semitoneScale);
  const isSys1 = isSystem1 ?? ((geo.index ?? 0) === 0);
  const spur = isSys1 ? SYSTEM_1_ARCHITECTURAL_BRACKET_SPUR : ARCHITECTURAL_BRACKET_SPUR;
  const stroke = isSys1 ? SYSTEM_1_ARCHITECTURAL_BRACKET_STROKE : ARCHITECTURAL_BRACKET_STROKE;
  const flare = spur * ARCHITECTURAL_BRACKET_FLARE_TAN;
  return `    <path class="janko-system-bracket" d="M ${f(x + spur)} ${f(top - flare)} L ${f(x)} ${f(top)} L ${f(x)} ${f(bot)} L ${f(x + spur)} ${f(bot + flare)}" fill="none" stroke="#111827" stroke-width="${stroke.toFixed(2)}" stroke-linecap="butt" stroke-linejoin="miter"/>`;
}

/**
 * The architectural bracket of the published catalogue — the Round 13 flared
 * form. Kept as the historical name of {@link renderFlaredArchitecturalBracket}
 * so a call site never has to know which round shaped the spur.
 */
export function renderArchitecturalBracket(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null,
  isSystem1?: boolean
): string {
  return renderFlaredArchitecturalBracket(geo, tokens, isSystem1);
}

/**
 * The shared **right-angled** bracket path of the delicate bracket (Round 12).
 * Round 13's architectural bracket no longer uses it: it flares its spurs
 * ({@link renderFlaredArchitecturalBracket}).
 */
function renderBracket(
  geo: JankoSystemGeometry,
  tokens: Partial<JankoTokens> | null | undefined,
  stroke: number,
  spur: number,
  cls: string
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const top = geo.middleCY + continuousPitchY(60, t.semitoneScale);
  const bot = geo.middleCY + continuousPitchY(36, t.semitoneScale);
  return `    <path class="${cls}" d="M ${f(x + spur)} ${f(top)} L ${f(x)} ${f(top)} L ${f(x)} ${f(bot)} L ${f(x + spur)} ${f(bot)}" fill="none" stroke="#111827" stroke-width="${stroke.toFixed(2)}"/>`;
}

/**
 * Slender 0.50pt clef pillar connecting the octave equators, with tick marks
 * at every octave line (o5 … o2). Round 12 removes the Middle C nib: the pillar
 * ticks the **octave lattice only**, so it reads as a registration landmark of
 * the four equators and never as a half-way clef mark.
 */
export function renderClefPillar(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const octaves = [5, 4, 3, 2] as const;
  const ys = octaves.map((oct) => geo.equatorY(oct >= 4 ? 'RH' : 'LH', oct));
  const parts: string[] = [
    `    <line class="janko-clef-pillar" x1="${f(x)}" y1="${f(ys[0])}" x2="${f(x)}" y2="${f(ys[3])}" stroke="#111827" stroke-width="${CLEF_PILLAR_STROKE.toFixed(2)}"/>`,
  ];
  for (const y of ys) {
    parts.push(
      `    <line class="janko-clef-pillar-tick" x1="${f(x)}" y1="${f(y)}" x2="${f(x + CLEF_PILLAR_TICK)}" y2="${f(y)}" stroke="#111827" stroke-width="${CLEF_PILLAR_STROKE.toFixed(2)}"/>`
    );
  }
  return parts.join('\n');
}

/**
 * Modern double vertical bounding rule: 0.75pt outer rule, 0.35pt inner rule,
 * 2.5pt apart, flush at the start of System 1 (the inner rule leads the outer).
 */
export function renderDoubleHairline(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const top = geo.middleCY + continuousPitchY(60, t.semitoneScale);
  const bot = geo.middleCY + continuousPitchY(36, t.semitoneScale);
  return [
    `    <line class="janko-double-hairline-outer" x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(bot)}" stroke="#111827" stroke-width="${DOUBLE_HAIRLINE_OUTER_STROKE.toFixed(2)}"/>`,
    `    <line class="janko-double-hairline-inner" x1="${f(x + DOUBLE_HAIRLINE_SPACING)}" y1="${f(top)}" x2="${f(x + DOUBLE_HAIRLINE_SPACING)}" y2="${f(bot)}" stroke="#111827" stroke-width="${DOUBLE_HAIRLINE_INNER_STROKE.toFixed(2)}"/>`,
  ].join('\n');
}

/**
 * Margin ink for one resolved system geometry in the active
 * `systemStartStyle` (Round 10/11, settled by Round 14). `'open-halo'` and
 * `'none'` paint nothing: the opening sounds carry the Position of Honor halo,
 * the staff needs no brace; the golden `'architectural-bracket'` paints the
 * flared 0.65pt rule.
 */
export function renderAccolade(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null,
  systemIndex?: number
): string {
  const o = resolveJankoOptions(options);
  const isSys1 = (systemIndex ?? geo.index ?? 0) === 0;
  switch (o.systemStartStyle) {
    case 'architectural-bracket':
      return renderFlaredArchitecturalBracket(geo, tokens, isSys1);
    case 'delicate-bracket':
      return renderDelicateBracket(geo, tokens);
    case 'clef-pillar':
      return renderClefPillar(geo, tokens);
    case 'double-hairline':
      return renderDoubleHairline(geo, tokens);
    case 'open-halo':
    case 'none':
    default:
      return '';
  }
}

/** Greedy word wrap for crop captions (approximate serif advances). */
export function wrapCaptionText(
  text: string,
  maxWidth: number,
  fontSize: number,
  averageAdvance = 0.68
): string[] {
  const width = (s: string): number => s.length * fontSize * averageAdvance;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (!current || width(next) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

/** Render wrapped caption lines with a shared font size / leading. */
export function renderCaptionLines(
  x: number,
  y: number,
  lines: string[],
  fontSize: number,
  lineHeight: number = 9
): string {
  return lines
    .map(
      (line, i) =>
        `    <text x="${f(x)}" y="${f(y + i * lineHeight)}" class="janko-caption" font-size="${fontSize.toFixed(2)}pt">${line}</text>`
    )
    .join('\n');
}

/**
 * Debug/label helper: the measure-range caption used on crops.
 *
 * When `maxWidth` is supplied the caption font size is reduced (never below
 * 5.5pt) so the label always fits a narrow single-measure macro crop.
 */
export function renderMeasureRangeLabel(
  x: number,
  y: number,
  startMeasure: number,
  endMeasure: number,
  extra?: string,
  maxWidth?: number
): string {
  const range =
    startMeasure === endMeasure ? `m. ${startMeasure}` : `mm. ${startMeasure}–${endMeasure}`;
  const suffix = extra ? ` — ${extra}` : '';
  const text = `${range}${suffix}`;
  let fontSize = 8;
  if (maxWidth && maxWidth > 0) {
    while (fontSize > 5.5 && text.length * fontSize * 0.55 > maxWidth) fontSize -= 0.25;
  }
  return `    <text x="${f(x)}" y="${f(y)}" class="janko-caption" font-size="${fontSize.toFixed(2)}pt">${text}</text>`;
}
