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
  resolveJankoTokens,
} from '../types';
import { getTickX } from '../geometry';
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
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const out: string[] = ['  <g class="janko-barlines">'];

  const rhTop = geo.equatorY('RH', 5) - 12;
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = geo.equatorY('LH', 2) + 12;

  const anacrusis = t.anacrusisTicks ?? 0;
  if (geo.index === 0 && anacrusis > 0) {
    const upbeatWidth = (anacrusis / t.ticksPerMeasure) * geo.measureWidth;
    // 1. Barline ending the upbeat
    out.push(renderStaffBarline(geo.staffLeft + upbeatWidth, rhTop, rhBot, 0.85));
    out.push(renderStaffBarline(geo.staffLeft + upbeatWidth, lhTop, lhBot, 0.85));

    // 2. Measure barlines for mm. 1..measuresPerSystem
    for (let m = 1; m <= o.measuresPerSystem; m++) {
      const x = geo.staffLeft + upbeatWidth + m * geo.measureWidth;
      const isFinal = m === o.measuresPerSystem;
      const width = isFinal ? 1.05 : 0.85;
      out.push(renderStaffBarline(x, rhTop, rhBot, width));
      out.push(renderStaffBarline(x, lhTop, lhBot, width));
    }
  } else {
    // Internal boundaries: every measure end, including the system end.
    for (let m = 0; m < o.measuresPerSystem; m++) {
      const x = geo.staffLeft + (m + 1) * geo.measureWidth;
      const isFinal = m === o.measuresPerSystem - 1;
      const width = isFinal ? 1.05 : 0.85;
      out.push(renderStaffBarline(x, rhTop, rhBot, width));
      out.push(renderStaffBarline(x, lhTop, lhBot, width));
    }
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

/**
 * Vertical dashed pulse lines for beats 2, 3, … (Klavarskribo beat grid).
 * Replaces the heavy time signature numerals with subtle subdivision guidance,
 * matching the prior perfected landscape engraving benchmark (stroke="#D1D5DB", width 0.50pt, dash 2,3).
 */
export function renderBeatGrid(
  geo: JankoSystemGeometry,
  systemIndex: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  if (!o.showBeatGrid) return '';

  const beatsPerMeasure = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
  if (beatsPerMeasure <= 1) return '';

  const out: string[] = ['  <g class="janko-beat-grid">'];
  const rhTop = geo.equatorY('RH', 5) - 12;
  const rhBot = geo.equatorY('RH', 4) + 12;
  const lhTop = geo.equatorY('LH', 3) - 12;
  const lhBot = geo.equatorY('LH', 2) + 12;

  const anacrusis = t.anacrusisTicks ?? 0;
  const isSys0Anacrusis = systemIndex === 0 && anacrusis > 0;
  const upbeatWidth = isSys0Anacrusis ? (anacrusis / t.ticksPerMeasure) * geo.measureWidth : 0;

  for (let m = 0; m < o.measuresPerSystem; m++) {
    const isOpeningMeasure = systemIndex === 0 && m === 0;
    const insets =
      isOpeningMeasure && o.showTimeSignature && o.timeSignatureWidth > 0
        ? { left: t.measureInset + o.timeSignatureWidth, right: t.measureInset }
        : undefined;

    const measureLeft = isSys0Anacrusis
      ? geo.staffLeft + upbeatWidth + m * geo.measureWidth
      : geo.staffLeft + m * geo.measureWidth;

    const left = insets?.left ?? t.measureInset;
    const right = insets?.right ?? t.measureInset;
    const available = Math.max(0, geo.measureWidth - left - right);

    for (let b = 1; b < beatsPerMeasure; b++) {
      const frac = b / beatsPerMeasure;
      const x = measureLeft + left + frac * available;
      out.push(
        `    <line class="janko-beat-line" x1="${f(x)}" y1="${f(rhTop)}" x2="${f(x)}" y2="${f(rhBot)}" stroke="#D1D5DB" stroke-width="0.50" stroke-dasharray="2,3"/>`
      );
      out.push(
        `    <line class="janko-beat-line" x1="${f(x)}" y1="${f(lhTop)}" x2="${f(x)}" y2="${f(lhBot)}" stroke="#D1D5DB" stroke-width="0.50" stroke-dasharray="2,3"/>`
      );
    }
  }

  out.push('  </g>');
  return out.join('\n');
}
