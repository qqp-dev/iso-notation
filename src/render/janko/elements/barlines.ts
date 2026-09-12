/**
 * Barlines: internal measure barlines and system boundaries.
 *
 * Each hand keeps its own classical barline segment (RH: o5..o4, LH: o3..o2),
 * preserving the "two independent grand-staff halves" reading of the Jánko
 * Two-Row Equator system. The system end is drawn as a final boundary.
 */

import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
} from '../types';
import { f } from './style';

/** One hand's barline segment at x, from its top rule to its bottom rule. */
export function renderStaffBarline(
  x: number,
  yTop: number,
  yBot: number,
  strokeWidth: number = 0.85,
  stroke: string = '#111111'
): string {
  return `    <line class="janko-barline" x1="${f(x)}" y1="${f(yTop)}" x2="${f(x)}" y2="${f(yBot)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"/>`;
}

/**
 * All internal measure barlines of one system, plus the closing system
 * boundary. Measure numbers are the caller's responsibility (see engine).
 */
export function renderBarlines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const out: string[] = ['  <g class="janko-barlines">'];

  const rhTop = geo.equatorY('RH', 5) - 12;
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = geo.equatorY('LH', 2) + 12;

  // Internal boundaries: every measure end, including the system end.
  for (let m = 0; m < o.measuresPerSystem; m++) {
    const x = geo.staffLeft + (m + 1) * geo.measureWidth;
    const isFinal = m === o.measuresPerSystem - 1;
    const width = isFinal ? 1.05 : 0.85;
    out.push(renderStaffBarline(x, rhTop, rhBot, width));
    out.push(renderStaffBarline(x, lhTop, lhBot, width));
  }

  out.push('  </g>');
  return out.join('\n');
}

/** A measure number above the first measure of a system. */
export function renderMeasureNumber(
  geo: JankoSystemGeometry,
  measureNumber: number,
  tokens?: Partial<JankoTokens> | null
): string {
  void tokens;
  const x = geo.staffLeft - 2;
  const y = geo.staffTopY - 6;
  return `    <text class="janko-measure-num" x="${f(x)}" y="${f(y)}">${measureNumber}</text>`;
}
