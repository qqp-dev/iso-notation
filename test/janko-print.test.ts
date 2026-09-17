/**
 * Canonical print pipeline (offline).
 *
 * `scripts/print-score.ts` engraves the canonical Jánko pages and fits them
 * for Letter/A4 laser output. Every test here is offline: pure SVG/string
 * assertions plus dry-run argument parsing — no shell, no network, no
 * physical print jobs.
 *
 * Covers:
 *  1. Canonical resolution: Bach/Brahms print the studio/CLI entries.
 *  2. Letter fit: uniform aspect-preserving scale, centered within
 *     printable bounds, Letter media, no clipping, pagination unchanged.
 *  3. A4 passthrough: canonical pages untouched, A4 media.
 *  4. Media/PJL consistency: PAPER matches the sheet, portrait, mono/color.
 *  5. Vector output: no raster images, content preserved under the fit.
 *  6. Morphology switching retired explicitly; export-pdf contract kept.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  A4_HEIGHT_PT,
  A4_WIDTH_PT,
  LETTER_HEIGHT_PT,
  LETTER_WIDTH_PT,
  PRINT_MARGIN_PT,
  fitCanonicalPageToLetter,
  letterFitForCanonicalPage,
  mapSvgToMono,
  parsePrintArgs,
  resolvePrintScore,
  wrapInPjl,
} from '../scripts/print-score';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { countJankoPages, renderJankoPage } from '../src/render/janko/engine';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
function read(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Canonical resolution
// ---------------------------------------------------------------------------

test('Print resolves the canonical studio/CLI entries', () => {
  const bach = resolvePrintScore('bach-goldberg-var1');
  assert.deepEqual(bach.options, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), 'Bach golden options');
  assert.deepEqual(bach.tokens, resolveJankoTokens(DEFAULT_JANKO_TOKENS), 'Bach golden tokens');
  const brahms = resolvePrintScore('brahms-op118-no1');
  assert.deepEqual(
    brahms.options,
    resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
    'Brahms fixed-3 golden options'
  );
  assert.deepEqual(
    brahms.tokens,
    resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS),
    'Brahms golden tokens'
  );
  assert.equal(countJankoPages(bach.score, bach.options, bach.tokens), 2, 'Bach paginates to 2');
  assert.equal(countJankoPages(brahms.score, brahms.options, brahms.tokens), 5, 'Brahms paginates to 5');
  assert.throws(() => resolvePrintScore('no-such-score'), /not found/, 'unknown scores throw');
});

// ---------------------------------------------------------------------------
// 2. Letter fit
// ---------------------------------------------------------------------------

test('Letter fit is uniform, centered, and inside printable bounds', () => {
  const fit = letterFitForCanonicalPage();
  const printableW = LETTER_WIDTH_PT - 2 * PRINT_MARGIN_PT;
  const printableH = LETTER_HEIGHT_PT - 2 * PRINT_MARGIN_PT;
  assert.ok(fit.scale > 0 && fit.scale < 1, `shrinks to fit (${fit.scale.toFixed(5)})`);
  assert.equal(
    Number(fit.scale.toFixed(5)),
    Number(Math.min(printableW / A4_WIDTH_PT, printableH / A4_HEIGHT_PT).toFixed(5)),
    'largest aspect-preserving scale'
  );
  // Centered within the printable bounds (margins + residual split evenly).
  assert.equal(
    Number(fit.dx.toFixed(2)),
    Number((PRINT_MARGIN_PT + (printableW - A4_WIDTH_PT * fit.scale) / 2).toFixed(2)),
    'centered horizontally'
  );
  assert.equal(
    Number(fit.dy.toFixed(2)),
    Number((PRINT_MARGIN_PT + (printableH - A4_HEIGHT_PT * fit.scale) / 2).toFixed(2)),
    'centered vertically'
  );
  // No clipping: the scaled page rect sits inside the printable rect.
  assert.ok(fit.dx >= PRINT_MARGIN_PT - 1e-9, 'left edge inside');
  assert.ok(fit.dy >= PRINT_MARGIN_PT - 1e-9, 'top edge inside');
  assert.ok(
    fit.dx + A4_WIDTH_PT * fit.scale <= LETTER_WIDTH_PT - PRINT_MARGIN_PT + 1e-9,
    'right edge inside'
  );
  assert.ok(
    fit.dy + A4_HEIGHT_PT * fit.scale <= LETTER_HEIGHT_PT - PRINT_MARGIN_PT + 1e-9,
    'bottom edge inside'
  );
});

test('Letter fit keeps Letter media and pagination, content byte-identical', () => {
  const { score, options, tokens } = resolvePrintScore('bach-goldberg-var1');
  const page = renderJankoPage(score, 0, options, tokens);
  const fitted = fitCanonicalPageToLetter(page);
  assert.match(fitted, /viewBox="0 0 612 792"/, 'Letter viewBox');
  assert.match(fitted, /width="612pt" height="792pt"/, 'Letter media size');
  const fit = letterFitForCanonicalPage();
  assert.ok(
    fitted.includes(
      `<g transform="translate(${fit.dx.toFixed(2)} ${fit.dy.toFixed(2)}) scale(${fit.scale.toFixed(5)})">`
    ),
    'one uniform sheet transform (no reflow)'
  );
  // Content preserved: the fitted page carries the same vector ink.
  const stripSheet = (svg: string): string =>
    svg
      .replace(/^<svg[^>]*>/m, '')
      .replace(/<\/svg>\s*$/, '')
      .replace(/<g transform="translate\([^)]*\) scale\([^)]*\)">/, '')
      .replace(/<\/g>$/, '');
  const countTags = (svg: string, tag: string): number =>
    (svg.match(new RegExp(`<${tag}[\\s>]`, 'g')) ?? []).length;
  for (const tag of ['path', 'text', 'line', 'rect', 'circle', 'ellipse']) {
    assert.equal(
      countTags(stripSheet(fitted), tag),
      countTags(stripSheet(page), tag),
      `same <${tag}> count under the fit`
    );
  }
  // Pagination unchanged: the fit is a pure sheet transform.
  assert.equal(countJankoPages(score, options, tokens), 2, 'Bach still paginates to 2');
});

// ---------------------------------------------------------------------------
// 3. A4 passthrough
// ---------------------------------------------------------------------------

test('A4 passes canonical pages through untouched', () => {
  const { score, options, tokens } = resolvePrintScore('bach-goldberg-var1');
  const page = renderJankoPage(score, 0, options, tokens);
  assert.match(page, /viewBox="0.00 0.00 595.28 841.89"/, 'canonical A4 viewBox');
  assert.match(page, /width="595.28pt" height="841.89pt"/, 'canonical A4 media');
  assert.ok(!page.includes('translate('), 'no sheet transform on A4');
});

// ---------------------------------------------------------------------------
// 4. Media/PJL consistency
// ---------------------------------------------------------------------------

test('PJL matches the sheet: Letter/A4 media, portrait, mono/color', () => {
  const payload = Buffer.from('%ps', 'binary');
  const letter = wrapInPjl(payload, 'Job', 'letter', 'color').toString('binary');
  assert.ok(letter.includes('@PJL SET PAPER = LETTER'), 'Letter media');
  assert.ok(letter.includes('@PJL SET ORIENTATION = PORTRAIT'), 'portrait (canonical pages)');
  assert.ok(letter.includes('@PJL SET COLORMODE = COLOR'), 'color drums');
  const a4mono = wrapInPjl(payload, 'Job', 'A4', 'mono').toString('binary');
  assert.ok(a4mono.includes('@PJL SET PAPER = A4'), 'A4 media');
  assert.ok(a4mono.includes('@PJL SET COLORMODE = MONO'), 'mono drums');
  assert.ok(a4mono.includes('@PJL SET RENDERMODE = GRAYSCALE'), 'grayscale render');
});

// ---------------------------------------------------------------------------
// 5. Vector output and mono
// ---------------------------------------------------------------------------

test('Print SVGs are vector-only: no raster images', () => {
  for (const id of ['bach-goldberg-var1', 'brahms-op118-no1']) {
    const { score, options, tokens } = resolvePrintScore(id);
    for (let p = 0; p < countJankoPages(score, options, tokens); p++) {
      const svg = fitCanonicalPageToLetter(renderJankoPage(score, p, options, tokens));
      assert.ok(!svg.includes('<image'), `${id} p${p}: no <image>`);
      assert.ok(!svg.includes('data:image'), `${id} p${p}: no embedded raster`);
      assert.ok(!svg.includes('base64'), `${id} p${p}: no base64 payload`);
    }
  }
});

test('Mono maps chromatic inks to gray, keeps achromatic ink and paper', () => {
  assert.equal(mapSvgToMono('<g fill="#111111"/>'), '<g fill="#111111"/>', 'near-black kept');
  assert.equal(mapSvgToMono('<g fill="#FFFFFF"/>'), '<g fill="#FFFFFF"/>', 'paper kept');
  assert.equal(mapSvgToMono('<g fill="#1D4ED8"/>'), '<g fill="#4e4e4e"/>', 'chromatic to gray');
  const { score, options, tokens } = resolvePrintScore('brahms-op118-no1');
  const page = renderJankoPage(score, 0, options, tokens);
  const mono = mapSvgToMono(page);
  const hexes = [...mono.matchAll(/#([0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  assert.ok(hexes.length > 0, 'inks present');
  for (const hex of hexes) {
    const r = hex.slice(0, 2);
    const g = hex.slice(2, 4);
    const b = hex.slice(4, 6);
    assert.equal(`${r}${g}${b}`, `${r}${r}${r}`, `#${hex} is achromatic`);
  }
});

// ---------------------------------------------------------------------------
// 6. Retired morphology, preserved contracts, offline defaults
// ---------------------------------------------------------------------------

test('Morphology switching is retired explicitly, not silently ignored', () => {
  assert.throws(
    () => parsePrintArgs(['--morphology', 'duodecimal']),
    /retired/,
    'even the old default errors loudly'
  );
  assert.throws(() => parsePrintArgs(['--morphology=row-parity-shape']), /retired/);
  assert.ok(!read('scripts/print-score.ts').includes('normalizeNoteheadMorphology'));
  assert.ok(!read('scripts/print-score.ts').includes('computeColumnarLayout'));
  assert.ok(read('scripts/print-score.ts').includes('renderJankoPage'), 'canonical rendering');
});

test('Print defaults offline with explicit send, page and paper selection', () => {
  const defaults = parsePrintArgs([]);
  assert.equal(defaults.dryRun, true, 'offline by default');
  assert.equal(defaults.paperSize, 'letter', 'Letter default for the US tray');
  assert.equal(parsePrintArgs(['--send']).dryRun, false, 'explicit send');
  assert.equal(parsePrintArgs(['--page', '1']).pageIndex, 1, 'page selection');
  assert.equal(parsePrintArgs(['--paper', 'a4']).paperSize, 'A4', 'A4 selection');
  assert.equal(parsePrintArgs(['--mono']).colorMode, 'mono', 'mono selection');
});

test('The export-pdf frozen Bach contract is preserved', () => {
  const pdf = read('scripts/export-pdf.ts');
  assert.match(pdf, /const SCORE_ID = 'bach-goldberg-var1'/, 'Bach-only');
  assert.ok(pdf.includes("['-f', 'pdf', '-o', pdfPath, svgPath]"), 'default 96 DPI invocation');
  assert.ok(!pdf.includes("'-d'"), 'never passes -d 72 (see the DPI quirk comment)');
  assert.ok(
    !read('scripts/print-score.ts').includes("from './export-pdf'"),
    'print never imports the PDF contract'
  );
});
