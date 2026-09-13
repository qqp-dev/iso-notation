/**
 * Staff elements: octave equator lines, Middle C spine, subtle row guides and
 * dynamic ledger equators.
 *
 * Every octave is one **absolute, hand-independent** lattice: the four staff
 * equators (o5/o4/o3/o2) are continuous rules shared by both hands, spaced by
 * `octaveStep` (2h = 30pt) above and below the *spacious corridor* —
 * `interStaffGap` (56pt by default) of negative breathing space with **no**
 * spine by default. Only octaves outside the staff span emit dynamic ledger
 * equators. Horizontal dotted row guidelines and the dashed Middle C spine are
 * opt-in; the only dotted lines in the canonical engraving are the vertical
 * beat-grid pulses.
 *
 * Under `channelLayout: 'bounded-channel'` every equator is drawn as **two**
 * boundary rules at `equator ± channelHalfWidth`, opening the channel that
 * holds whole-tone Set A; the other three layouts (`'single-equator'`,
 * `'on-the-line'`, `'single-line-3row'`) draw one rule per equator. The same
 * pairing is applied to dynamic ledgers so an out-of-staff octave keeps its
 * center row open too.
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
 * Absolute ys of the horizontal rules that frame one octave equator.
 *
 * `'single-equator'`, `'on-the-line'` and `'single-line-3row'` paint exactly
 * one rule, on the equator (4 across the staff). Only
 * `'bounded-channel'` paints two, at `equator ± channelHalfWidth`, so the
 * whole-tone Set A row sits in the open negative space between them (8 across
 * the staff).
 */
export function getEquatorRuleYs(
  equatorY: number,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): number[] {
  const o = resolveJankoOptions(options);
  if (o.channelLayout !== 'bounded-channel') return [equatorY];
  const t = resolveJankoTokens(tokens);
  return [equatorY - t.channelHalfWidth, equatorY + t.channelHalfWidth];
}

/**
 * The four staff octave equators (o5, o4, o3, o2), shared by both hands, plus
 * the opt-in Middle C spine and row guidelines of every staff lane.
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
  // Inner equators (o4, o3): the definitive octave boundaries of each hand.
  // Round 7 lightens the whole hierarchy: the outer equators fall to a 0.50pt
  // hairline and the inner octave boundaries to 0.65pt, so the staff reads as
  // four quiet rules behind the music instead of two competing weights.
  const equators: Array<[Hand, number, string, number]> = [
    ['RH', 5, '#1E293B', 0.50],
    ['LH', 2, '#1E293B', 0.50],
    ['RH', 4, '#0F172A', 0.65],
    ['LH', 3, '#0F172A', 0.65],
  ];
  for (const [hand, oct, stroke, width] of equators) {
    for (const y of getEquatorRuleYs(geo.equatorY(hand, oct), o, t)) {
      out.push(renderRule(geo.staffLeft, geo.staffRight, y, stroke, width));
    }
  }

  out.push('  </g>');
  // Both are opt-in and resolve to the empty string when disabled, so no empty
  // <g> wrapper ever reaches the document.
  const guidelines = renderRowGuidelines(geo, o, t);
  if (guidelines) out.push(guidelines);
  const spine = renderMiddleCSpine(geo, o, t);
  if (spine) out.push(spine);

  return out.join('\n');
}

/**
 * Subtle dashed guidelines showing the two whole-tone row lanes (odd rank
 * above / even rank below each staff equator). They are intentionally faint:
 * pure registration aids, never musical content — and **off by default**, so
 * the score keeps zero horizontal dotted lines.
 */
export function renderRowGuidelines(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showRowGuidelines) return '';
  const t = resolveJankoTokens(tokens);
  const halfRow = t.rowHeight / 2;
  const out: string[] = ['  <g class="janko-row-guidelines" opacity="0.45">'];
  const x1 = geo.staffLeft + o.measureInset;
  const x2 = geo.staffRight - o.measureInset;
  const staffEquators: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of staffEquators) {
    const eq = geo.equatorY(hand, oct);
    out.push(renderRule(x1, x2, eq - halfRow, '#CBD5E1', 0.45, '3,3'));
    out.push(renderRule(x1, x2, eq + halfRow, '#CBD5E1', 0.45, '3,3'));
  }
  out.push('  </g>');
  return out.join('\n');
}

/**
 * The Middle C spine between the two hands (`dashed` | `double` | `continuous`
 * | `none`). `'none'` is the canonical treatment: the corridor is held open by
 * the negative space of `interStaffGap` alone, with nothing dividing the hands.
 */
export function renderMiddleCSpine(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (o.middleCSpine === 'none') return '';
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
 * One dynamic ledger equator segment, centred on a notehead whose octave lies
 * outside the grand staff (`octave < 2` or `octave > 5`). The bounded center
 * channel emits the same pair of boundary rules as the staff equators, so an
 * out-of-staff octave keeps its center row open as well.
 */
export function renderLedgerEquator(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  options?: Partial<JankoLayoutOptions> | null
): string {
  const t = resolveJankoTokens(tokens);
  const hw = t.ledgerHalfWidth;
  return getEquatorRuleYs(y, options, t)
    .map(
      (ruleY) =>
        `    <line class="janko-ledger" x1="${f(x - hw)}" y1="${f(ruleY)}" x2="${f(x + hw)}" y2="${f(ruleY)}" stroke="#334155" stroke-width="0.75"/>`
    )
    .join('\n');
}

/** Left-margin octave labels for the four staff equators. */
export function renderOctaveLabels(
  geo: JankoSystemGeometry,
  options?: Partial<JankoLayoutOptions> | null,
  _tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showOctaveLabels) return '';
  const x = geo.staffLeft - 5;
  const out: string[] = ['  <g class="janko-octave-labels">'];
  const staffEquators: Array<[Hand, number]> = [
    ['RH', 5],
    ['RH', 4],
    ['LH', 3],
    ['LH', 2],
  ];
  for (const [hand, oct] of staffEquators) {
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
  options?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): string {
  const o = resolveJankoOptions(options);
  if (!o.showTimeSignature) return '';
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
