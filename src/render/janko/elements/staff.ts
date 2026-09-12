/**
 * Staff elements: octave equator lines, Middle C spine, subtle row guides and
 * dynamic ledger equators.
 *
 * Every octave is one equator line. Within a hand, adjacent equators are
 * exactly `octaveStep` (2h = 30pt) apart; the two hands are separated by
 * `interStaffGap` (default 45pt) with the Middle C spine centred between them.
 */

import {
  JankoLayoutOptions,
  JankoSystemGeometry,
  JankoTokens,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
import { f } from './style';

type Hand = 'RH' | 'LH';

/** Render one horizontal rule. */
export function renderRule(
  x1: number,
  x2: number,
  y: number,
  stroke: string,
  strokeWidth: number,
  dashArray?: string
): string {
  const dash = dashArray ? ` stroke-dasharray="${dashArray}"` : '';
  return `    <line x1="${f(x1)}" y1="${f(y)}" x2="${f(x2)}" y2="${f(y)}" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"${dash}/>`;
}

/**
 * The four home octave equators (RH o5/o4, LH o3/o2), the Middle C spine and
 * the subtle dashed row guidelines of every home lane.
 */
export function renderStaffLines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const out: string[] = ['  <g class="janko-staff-lines">'];

  // Outer equators (o5, o2): lighter hairline.
  out.push(renderRule(geo.staffLeft, geo.staffRight, geo.equatorY('RH', 5), '#1E293B', 0.70));
  out.push(renderRule(geo.staffLeft, geo.staffRight, geo.equatorY('LH', 2), '#1E293B', 0.70));

  // Inner equators (o4, o3): the definitive octave boundaries of each hand.
  out.push(renderRule(geo.staffLeft, geo.staffRight, geo.equatorY('RH', 4), '#0F172A', 0.90));
  out.push(renderRule(geo.staffLeft, geo.staffRight, geo.equatorY('LH', 3), '#0F172A', 0.90));

  out.push('  </g>');
  out.push(renderRowGuidelines(geo, o, t));
  out.push(renderMiddleCSpine(geo, o, t));

  return out.join('\n');
}

/**
 * Subtle dashed guidelines showing the two whole-tone row lanes (odd rank
 * above / even rank below each home equator). They are intentionally faint:
 * pure registration aids, never musical content.
 */
export function renderRowGuidelines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const halfRow = t.rowHeight / 2;
  const out: string[] = ['  <g class="janko-row-guidelines" opacity="0.45">'];
  const x1 = geo.staffLeft + o.measureInset;
  const x2 = geo.staffRight - o.measureInset;
  const homes: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of homes) {
    const eq = geo.equatorY(hand, oct);
    out.push(renderRule(x1, x2, eq - halfRow, '#CBD5E1', 0.45, '3,3'));
    out.push(renderRule(x1, x2, eq + halfRow, '#CBD5E1', 0.45, '3,3'));
  }
  out.push('  </g>');
  return out.join('\n');
}

/** The Middle C spine between the two hands (`dashed` | `double` | `continuous`). */
export function renderMiddleCSpine(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const y = geo.middleCY;
  const x1 = geo.staffLeft + t.measureInset;
  const x2 = geo.staffRight - t.measureInset;
  const out: string[] = ['  <g class="janko-middle-c-spine">'];

  if (o.middleCSpine === 'double') {
    out.push(renderRule(x1, x2, y - 1.1, '#94A3B8', 0.55));
    out.push(renderRule(x1, x2, y + 1.1, '#94A3B8', 0.55));
  } else if (o.middleCSpine === 'continuous') {
    out.push(renderRule(x1, x2, y, '#94A3B8', 0.65));
  } else {
    out.push(renderRule(x1, x2, y, '#E2E8F0', 0.65, '4,4'));
  }

  out.push('  </g>');
  return out.join('\n');
}

/**
 * One dynamic ledger equator segment, centred on a notehead that lies outside
 * the hand's home staff.
 */
export function renderLedgerEquator(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const hw = t.ledgerHalfWidth;
  return `    <line class="janko-ledger" x1="${f(x - hw)}" y1="${f(y)}" x2="${f(x + hw)}" y2="${f(y)}" stroke="#334155" stroke-width="0.75"/>`;
}

/** Left-margin octave labels for the four home equators. */
export function renderOctaveLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showOctaveLabels) return '';
  const x = geo.staffLeft - 5;
  const out: string[] = ['  <g class="janko-octave-labels">'];
  const homes: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of homes) {
    out.push(
      `    <text x="${f(x)}" y="${f(geo.equatorY(hand, oct) + 2.5)}" class="janko-octave-label" text-anchor="end">${oct}</text>`
    );
  }
  out.push('  </g>');
  return out.join('\n');
}

/** m.d. (RH) / m.s. (LH) hand designations, rendered once on the first system. */
export function renderHandLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showHandLabels) return '';
  return [
    '  <g class="janko-hand-labels">',
    `    <text x="${f(geo.staffLeft)}" y="${f(geo.staffTopY + 2)}" class="janko-hand-label">m.d. (RH)</text>`,
    `    <text x="${f(geo.staffLeft)}" y="${f(geo.middleCY - 3)}" class="janko-hand-label">m.s. (LH)</text>`,
    '  </g>',
  ].join('\n');
}

/** 3/4 time signature, aligned on the inner equators of both hands. */
export function renderTimeSignature(
  geo: JankoSystemGeometry,
  _options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  const tsx = geo.staffLeft + t.measureInset + 4;
  const out: string[] = ['  <g class="janko-time-signature">'];
  const anchors: Array<[Hand, number]> = [
    ['RH', 4],
    ['LH', 3],
  ];
  for (const [hand, oct] of anchors) {
    const y = geo.equatorY(hand, oct);
    out.push(`    <g transform="translate(${f(tsx)}, ${f(y)})">`);
    out.push('      <text x="0" y="-4" class="janko-ts-num">3</text>');
    out.push('      <text x="0" y="11" class="janko-ts-num">4</text>');
    out.push('    </g>');
  }
  out.push('  </g>');
  return out.join('\n');
}
