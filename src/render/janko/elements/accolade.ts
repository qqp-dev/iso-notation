/**
 * System-start margin ink: the incumbent copperplate accolade and the
 * Round 10/11 replacements.
 *
 * The curlicue copperplate brace does not match the modern design language, so
 * the golden master retires it (`'open-halo'`): the staff lines emerge openly
 * from the left margin and the Position of Honor halo rings the opening
 * sounds. The ruled alternatives keep a structural mark at the same reserved
 * margin column:
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
 * The copperplate path itself is still exported (and shared with the legacy
 * print pipeline in `print-layout.ts`) for the historical golden masters.
 */

import { getVerticalAccoladePath } from '../../print-layout';
import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { f } from './style';

/** Horizontal reach (pt) of an architectural bracket's spurs. */
export const ARCHITECTURAL_BRACKET_SPUR = 3.0;
/** Stroke (pt) of the architectural bracket. */
export const ARCHITECTURAL_BRACKET_STROKE = 0.65;
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
 * and shared with the legacy print pipeline in `print-layout.ts`. Round 10
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
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const top = geo.equatorY('RH', 5);
  const bot = geo.equatorY('LH', 2);
  const flare = ARCHITECTURAL_BRACKET_SPUR * ARCHITECTURAL_BRACKET_FLARE_TAN;
  return `    <path class="janko-system-bracket" d="M ${f(x + ARCHITECTURAL_BRACKET_SPUR)} ${f(top - flare)} L ${f(x)} ${f(top)} L ${f(x)} ${f(bot)} L ${f(x + ARCHITECTURAL_BRACKET_SPUR)} ${f(bot + flare)}" fill="none" stroke="#111827" stroke-width="${ARCHITECTURAL_BRACKET_STROKE.toFixed(2)}" stroke-linecap="butt" stroke-linejoin="miter"/>`;
}

/**
 * The architectural bracket of the published catalogue — the Round 13 flared
 * form. Kept as the historical name of {@link renderFlaredArchitecturalBracket}
 * so a call site never has to know which round shaped the spur.
 */
export function renderArchitecturalBracket(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  return renderFlaredArchitecturalBracket(geo, tokens);
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
  const top = geo.equatorY('RH', 5);
  const bot = geo.equatorY('LH', 2);
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
  const top = geo.equatorY('RH', 5);
  const bot = geo.equatorY('LH', 2);
  return [
    `    <line class="janko-double-hairline-outer" x1="${f(x)}" y1="${f(top)}" x2="${f(x)}" y2="${f(bot)}" stroke="#111827" stroke-width="${DOUBLE_HAIRLINE_OUTER_STROKE.toFixed(2)}"/>`,
    `    <line class="janko-double-hairline-inner" x1="${f(x + DOUBLE_HAIRLINE_SPACING)}" y1="${f(top)}" x2="${f(x + DOUBLE_HAIRLINE_SPACING)}" y2="${f(bot)}" stroke="#111827" stroke-width="${DOUBLE_HAIRLINE_INNER_STROKE.toFixed(2)}"/>`,
  ].join('\n');
}

/**
 * Margin ink for one resolved system geometry in the active
 * `systemStartStyle` (Round 10/11, refined by Round 13). `'open-halo'` and
 * `'none'` paint nothing: the opening sounds carry the Position of Honor halo,
 * the staff needs no brace.
 */
export function renderAccolade(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  switch (o.systemStartStyle) {
    case 'architectural-bracket':
      return renderFlaredArchitecturalBracket(geo, tokens);
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
