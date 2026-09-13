/**
 * System-start margin ink: the incumbent copperplate accolade and the Round 10
 * replacements.
 *
 * The curlicue copperplate brace does not match the modern design language, so
 * the golden master retires it (`'open-halo'`): the staff lines emerge openly
 * from the left margin and the Position of Honor halo rings the opening
 * sounds. The two ruled alternatives keep a structural mark at the same
 * reserved margin column:
 *
 * - `'architectural-bracket'` — a straight 0.65pt rule with 3.0pt right-angled
 *   spurs at the staff's top and bottom rules;
 * - `'clef-pillar'` — the same straight 0.65pt rule without spurs;
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

/** Horizontal reach (pt) of an architectural bracket's right-angled spurs. */
export const ARCHITECTURAL_BRACKET_SPUR = 3.0;
/** Stroke (pt) of the architectural bracket and the clef pillar. */
export const ARCHITECTURAL_BRACKET_STROKE = 0.65;

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

/** Straight 0.65pt system-start rule with 3.0pt right-angled spurs. */
export function renderArchitecturalBracket(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  const spur = ARCHITECTURAL_BRACKET_SPUR;
  return `    <path class="janko-system-bracket" d="M ${f(x + spur)} ${f(geo.staffTopY)} L ${f(x)} ${f(geo.staffTopY)} L ${f(x)} ${f(geo.staffBotY)} L ${f(x + spur)} ${f(geo.staffBotY)}" fill="none" stroke="#111827" stroke-width="${ARCHITECTURAL_BRACKET_STROKE.toFixed(2)}"/>`;
}

/** Straight 0.65pt system-start rule without spurs. */
export function renderClefPillar(
  geo: JankoSystemGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  return `    <line class="janko-clef-pillar" x1="${f(x)}" y1="${f(geo.staffTopY)}" x2="${f(x)}" y2="${f(geo.staffBotY)}" stroke="#111827" stroke-width="${ARCHITECTURAL_BRACKET_STROKE.toFixed(2)}"/>`;
}

/**
 * Margin ink for one resolved system geometry in the active
 * `systemStartStyle` (Round 10). `'open-halo'` and `'none'` paint nothing: the
 * opening sounds carry the Position of Honor halo, the staff needs no brace.
 */
export function renderAccolade(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  switch (o.systemStartStyle) {
    case 'architectural-bracket':
      return renderArchitecturalBracket(geo, tokens);
    case 'clef-pillar':
      return renderClefPillar(geo, tokens);
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
