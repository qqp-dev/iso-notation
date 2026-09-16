/**
 * Goldberg frozen reference (GOLD): pre/post full-page equality + PDF bytes.
 *
 * Baseline captured pre-change at 8890d42003676f181525298e472e0eb93e622e7e
 * via the real engine (DEFAULT_JANKO_OPTIONS/TOKENS, in-memory SVG bytes).
 * No SVG/image snapshots committed — textual hashes only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { renderJankoPage, countJankoSystems } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { lintJankoScore } from '../src/render/janko/linter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const BASELINE_REVISION = '8890d42003676f181525298e472e0eb93e622e7e';
const BASELINE_PAGES = 2;
const BASELINE_SYSTEMS = 8;
const BASELINE_PAGE_SHA = [
  '5331f5966b18b764d398554800d8d579ee6614a7327123ff4d8bb766b289141d',
  'f75e80b2916ca9835829553630699067e59e6948a77d44b7931f647d7c2c6a97',
];
const BASELINE_PDF_SHA =
  'bf85832ad687d891a69efae8a350037513f3de78e678115c29c5b970859e963f';

test('GOLD frozen: every canonical Goldberg full-page hash equals pre-change baseline', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(countJankoSystems(score, DEFAULT_JANKO_OPTIONS), BASELINE_SYSTEMS);
  const pages = Math.ceil(BASELINE_SYSTEMS / DEFAULT_JANKO_OPTIONS.systemsPerPage);
  assert.equal(pages, BASELINE_PAGES);
  for (let p = 0; p < pages; p++) {
    const svg = renderJankoPage(score, p, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
    const sha = crypto.createHash('sha256').update(svg, 'utf8').digest('hex');
    assert.equal(
      sha,
      BASELINE_PAGE_SHA[p],
      `Goldberg page ${p + 1} differs from baseline ${BASELINE_REVISION} — frozen Bach must not change`
    );
  }
});

test('GOLD frozen: committed Goldberg PDF bytes unchanged', () => {
  const pdf = path.join(REPO_ROOT, 'public', 'goldberg-variation-1.pdf');
  assert.ok(fs.existsSync(pdf), 'committed PDF missing');
  const sha = crypto.createHash('sha256').update(fs.readFileSync(pdf)).digest('hex');
  assert.equal(sha, BASELINE_PDF_SHA, 'committed Goldberg PDF bytes changed — regeneration to conceal change is forbidden');
});

test('GOLD frozen: Goldberg zero violations and zero warnings', () => {
  const report = lintJankoScore(
    buildBachGoldbergVar1Score(),
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.equal(report.violations.length, 0);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.ok, true);
});
