/**
 * Shared SVG style block for every Jánko engraving render.
 *
 * All element modules emit class-based text/geometry so that a single `<defs>`
 * block controls typography across pages, crops and comparison sheets.
 */

import { JankoTokens, resolveJankoTokens } from '../types';
import { URTEXT_SERIF } from '../../print-layout';

export function renderJankoStyleDefs(tokens?: Partial<JankoTokens> | null): string {
  const t = resolveJankoTokens(tokens);
  return [
    '  <defs>',
    '    <style>',
    `      .janko-title { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 11pt; letter-spacing: 0.3px; fill: #111111; }`,
    `      .janko-subtitle { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #333333; }`,
    `      .janko-meta { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #222222; }`,
    `      .janko-running-head { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 7pt; fill: #555555; }`,
    `      .janko-page-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #666666; font-weight: 400; }`,
    `      .janko-measure-num { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8.5pt; fill: #555555; font-weight: normal; }`,
    `      .janko-octave-label { font-family: "DejaVu Sans Mono", monospace; font-size: 7.5pt; font-weight: bold; fill: #6B7280; }`,
    `      .janko-hand-label { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 8pt; fill: #555555; }`,
    `      .janko-ts-num { font-family: ${URTEXT_SERIF}; font-weight: bold; font-size: 14pt; fill: #111111; text-anchor: middle; }`,
    `      .janko-caption { font-family: ${URTEXT_SERIF}; font-weight: 600; font-size: 8pt; fill: #111827; }`,
    `      .janko-caption-sub { font-family: ${URTEXT_SERIF}; font-style: italic; font-size: 7.5pt; fill: #4B5563; }`,
    // Digits are optically centred with an explicit alphabetic-baseline offset
    // (see `notehead.digitBaselineOffset`); `dominant-baseline` is deliberately
    // not used, because engines disagree on the central baseline and the glyph
    // would drift off the mask centre.
    `      .janko-digit { font-family: ${t.fontFamily}; text-anchor: middle; font-weight: bold; }`,
    '    </style>',
    '  </defs>',
  ].join('\n');
}

/** Fixed-point helper shared by the element renderers. */
export function f(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}
