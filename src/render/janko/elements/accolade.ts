/**
 * System accolade: the slender copperplate brace that clasps both hands.
 *
 * Geometry is delegated to the shared Emmentaler/LilyPond brace outline in
 * `print-layout.ts`, so the Jánko engraving and the legacy print pipeline use
 * exactly the same master-engraved curve (w = 7.0pt, thick = 0.65pt).
 */

import { getVerticalAccoladePath } from '../../print-layout';
import { JankoLayoutOptions, JankoSystemGeometry, JankoTokens, resolveJankoTokens } from '../types';
import { f } from './style';

/** Accolade path at explicit coordinates. */
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

/** Accolade for one resolved system geometry. */
export function renderAccolade(
  geo: JankoSystemGeometry,
  _options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const x = geo.staffLeft - t.accoladeGap - t.accoladeWidth;
  return renderAccoladePath(x, geo.staffTopY, geo.staffBotY, t.accoladeWidth, t.accoladeThick);
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
