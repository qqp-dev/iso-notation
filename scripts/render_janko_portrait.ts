#!/usr/bin/env node
/**
 * Legacy artifact compatibility wrapper.
 *
 * The Jánko Two-Row layout engine no longer lives here: all coordinate math and
 * SVG composition now live in `src/render/janko/` (geometry + elements +
 * engine). This script is kept only so the historical
 * `janko_2row_portrait_page1.*` artifact keeps being produced.
 *
 * Prefer the first-class harness instead:
 *
 *   npm run janko:export   # full page + macro crops + variant contact sheet
 *   npm run janko:watch    # same, on file change
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { renderJankoPage } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';

const RESVG_BIN = '/home/linuxbrew/.linuxbrew/bin/resvg';
const MAIN_CHECKOUT = '/home/qqp/projects/iso-notation';
const BASE_NAME = 'janko_2row_portrait_page1';

const score = buildBachGoldbergVar1Score();
const svg = renderJankoPage(score, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);

const docsDir = path.resolve('docs/img');
const outSvg = path.join(docsDir, `${BASE_NAME}.svg`);
const outPng = path.join(docsDir, `${BASE_NAME}.png`);
fs.mkdirSync(docsDir, { recursive: true });
fs.writeFileSync(outSvg, svg, 'utf-8');
console.log(`Wrote SVG to ${outSvg}`);

const tmpSvg = path.join(os.tmpdir(), `${BASE_NAME}.svg`);
fs.writeFileSync(tmpSvg, svg, 'utf-8');
execFileSync(RESVG_BIN, ['--zoom', '2', tmpSvg, outPng], { stdio: 'ignore' });
fs.rmSync(tmpSvg, { force: true });
console.log(`Rasterized PNG to ${outPng}`);

const targets = [
  path.resolve(`${BASE_NAME}.png`),
  path.resolve('public', `${BASE_NAME}.png`),
  outPng,
  path.join(MAIN_CHECKOUT, `${BASE_NAME}.png`),
  path.join(MAIN_CHECKOUT, 'public', `${BASE_NAME}.png`),
  path.join(MAIN_CHECKOUT, 'docs/img', `${BASE_NAME}.png`),
];
for (const target of targets) {
  if (target !== outPng && fs.existsSync(path.dirname(target))) {
    fs.copyFileSync(outPng, target);
  }
}
console.log(`Copied to ${targets.length} locations.`);
