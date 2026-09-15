#!/usr/bin/env node
/**
 * `npm run pdf` — Download-PDF export for the judged Jánko golden
 * ================================================================
 *
 * Renders the canonical Bach Goldberg Variation 1 engraving (the golden
 * master: `DEFAULT_JANKO_OPTIONS` + `DEFAULT_JANKO_TOKENS`, no overrides)
 * to `public/goldberg-variation-1.pdf`, the file behind the studio's
 * "Download PDF" button.
 *
 * Recipe (pinned — this is what PR #50 proved reproduces the artifact):
 *   1. `renderJankoPage(score, i, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)`
 *      for every page of `BENCHMARK_SCORES['bach-goldberg-var1']()`.
 *   2. `rsvg-convert -f pdf` per page, at DEFAULT DPI (see quirk below).
 *   3. `pdfunite` to join the pages (also strips the info dict).
 *
 * rsvg-convert DPI QUIRK (do not "fix"): rsvg scales CSS `pt` font sizes by
 * `dpi / 72`, so at the default 96 dpi all PDF text renders at x4/3 (the
 * 11pt title lands at Tm 14.667) while vectors stay absolute. Passing
 * `-d 72 -p 72` would silently shrink every glyph. This script therefore
 * passes NO `-d`/`-p` flags, and `test/janko-pdf.test.ts` pins the title
 * Tm scale so a future well-meaning DPI flag fails loudly.
 *
 * The script takes NO options that alter the golden (no weights, no scales,
 * no paper variants): it exports the judged golden, period. The only flag
 * is `--out <path>`, which redirects the output file (used by the freshness
 * test to regenerate into a temp dir) without changing a single pixel.
 *
 * Requires `rsvg-convert` (librsvg2-bin) and `pdfunite` (poppler-utils);
 * fails loudly with a clear message when either is missing. CI installs
 * both before `npm test` (see `.github/workflows/deploy.yml`).
 *
 * Exit codes: 0 = written, 1 = toolchain missing or conversion failed.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_SCORES } from '../src/scores';
import { countJankoPages, renderJankoPage } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SCORE_ID = 'bach-goldberg-var1';
const DEFAULT_OUT = path.join(REPO_ROOT, 'public', 'goldberg-variation-1.pdf');

function findOnPath(cmd: string): string | null {
  const pathEnv = process.env.PATH ?? '';
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const full = path.join(dir, cmd);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch {
      // Not here; keep looking.
    }
  }
  return null;
}

function requireTool(cmd: string, pkg: string): string {
  const full = findOnPath(cmd);
  if (!full) {
    console.error(
      `npm run pdf: missing required tool \`${cmd}\` (install \`${pkg}\`).\n` +
        `Refusing to write a stale or partial PDF.`
    );
    process.exit(1);
  }
  return full;
}

function parseOutArg(argv: string[]): string {
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      const value = argv[i + 1];
      if (!value) {
        console.error('npm run pdf: `--out` needs a path argument.');
        process.exit(1);
      }
      out = path.resolve(REPO_ROOT, value);
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: npm run pdf [--out <path>]');
      console.log('Exports the judged golden to public/goldberg-variation-1.pdf.');
      process.exit(0);
    } else {
      console.error(
        `npm run pdf: unknown argument \`${arg}\` (only \`--out <path>\` is supported).`
      );
      process.exit(1);
    }
  }
  return out;
}

function main(): void {
  const outPath = parseOutArg(process.argv.slice(2));
  const rsvg = requireTool('rsvg-convert', 'librsvg2-bin');
  const pdfunite = requireTool('pdfunite', 'poppler-utils');

  const score = BENCHMARK_SCORES[SCORE_ID]();
  const totalPages = countJankoPages(score, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  if (totalPages < 1) {
    console.error('npm run pdf: the golden score renders zero pages; refusing to export.');
    process.exit(1);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'janko-pdf-'));
  try {
    const pagePdfs: string[] = [];
    for (let i = 0; i < totalPages; i++) {
      const svg = renderJankoPage(score, i, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
      const svgPath = path.join(tmpDir, `page-${i}.svg`);
      const pdfPath = path.join(tmpDir, `page-${i}.pdf`);
      fs.writeFileSync(svgPath, svg, 'utf-8');
      // NOTE: default DPI on purpose — see the DPI-quirk comment above.
      execFileSync(rsvg, ['-f', 'pdf', '-o', pdfPath, svgPath], { stdio: 'pipe' });
      pagePdfs.push(pdfPath);
    }
    execFileSync(pdfunite, [...pagePdfs, outPath], { stdio: 'pipe' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`npm run pdf: conversion failed: ${detail}`);
    process.exit(1);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  console.log(`npm run pdf: wrote ${totalPages} page(s) -> ${path.relative(REPO_ROOT, outPath)}`);
}

main();
