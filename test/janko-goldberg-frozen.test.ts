/**
 * Historical Goldberg engraving witness (before the operator-judged m. 5 GOLD revision).
 *
 * Baseline captured at 8890d42003676f181525298e472e0eb93e622e7e
 * via the real engine (DEFAULT_JANKO_OPTIONS/TOKENS, in-memory SVG bytes).
 * No SVG/image snapshots committed — textual hashes only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { bachBeforeM5 } from './support/bach-before-m5';
import { renderJankoPage, countJankoSystems, layoutJankoScore } from '../src/render/janko/engine';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
} from '../src/render/janko/types';
import { lintJankoScore } from '../src/render/janko/linter';

const BASELINE_REVISION = '8890d42003676f181525298e472e0eb93e622e7e';
const BASELINE_PAGES = 2;
const BASELINE_SYSTEMS = 8;
// Provenance: pre-PR66 page hashes were
// 5331f5966b18b764d398554800d8d579ee6614a7327123ff4d8bb766b289141d and
// f75e80b2916ca9835829553630699067e59e6948a77d44b7931f647d7c2c6a97.
// The authorized §4 nearby-level rule moves exactly seven rest glyphs
// (720, 864, 1056, 2988, 3060, 3132, 3600 — proven by full-SVG diff:
// zero head/pulse/grid/staff/beam changes, the m12 pulse restored to its
// pre-PR66 486.70); the hashes below pin that approved state.
const BASELINE_PAGE_SHA = [
  '2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f',
  'dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757',
];
// The operator-judged hand correction requires a newly exported PDF; freshness
// and vector geometry of the current GOLD PDF are checked in janko-pdf.test.ts.

test('archival pre-m. 5 hand reading retains both historical Goldberg page hashes', () => {
  const score = bachBeforeM5(buildBachGoldbergVar1Score());
  assert.equal(countJankoSystems(score, DEFAULT_JANKO_OPTIONS), BASELINE_SYSTEMS);
  const pages = Math.ceil(BASELINE_SYSTEMS / DEFAULT_JANKO_OPTIONS.systemsPerPage);
  assert.equal(pages, BASELINE_PAGES);
  for (let p = 0; p < pages; p++) {
    const svg = renderJankoPage(score, p, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
    const sha = crypto.createHash('sha256').update(svg, 'utf8').digest('hex');
    assert.equal(
      sha,
      BASELINE_PAGE_SHA[p],
      `historical Goldberg page ${p + 1} differs from baseline ${BASELINE_REVISION}`
    );
  }
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

test('GOLD m12: tick1632 lower head exactly ON its pulse, upper exactly one gap higher', () => {
  // The shared-fitting root restoration: the m.12 cross-hand pair carries
  // one note per hand, so no bracket qualifies — the lower head (G3, id 198)
  // sits bit-exactly ON the laid-out column, the upper (A3, id 199) one
  // judged gap right, and the painted beat pulse ink stands on the column.
  // Pre-PR66 values restored: 486.70 / 492.16 (not 492.16 as the column).
  const layouts = layoutJankoScore(
    buildBachGoldbergVar1Score(),
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  const system = layouts.find((l) => l.columns.has(1632))!;
  const column = system.columns.get(1632)!;
  const lo = system.notes.find((p) => p.note.id === 'bach-var1-198')!;
  const hi = system.notes.find((p) => p.note.id === 'bach-var1-199')!;
  assert.equal(lo.note.startTick, 1632);
  assert.equal(hi.note.startTick, 1632);
  assert.equal(system.claspQualifiedIds?.has('bach-var1-198'), false, 'lower unqualified');
  assert.equal(system.claspQualifiedIds?.has('bach-var1-199'), false, 'upper unqualified');
  assert.equal(lo.x, column, 'lower head bit-exactly ON the column');
  assert.equal(column.toFixed(2), '486.70', 'the true column is 486.70, not 492.16');
  assert.ok(
    Math.abs(hi.x - lo.x - getClusterSpacingPreset('tight').pairGap) < 1e-9,
    `upper exactly one gap higher (span ${(hi.x - lo.x).toFixed(2)})`
  );
  assert.equal(hi.x.toFixed(2), '492.16');
  // The painted pulse ink stands on the column (2dp print of the same float).
  const svg = renderJankoPage(
    buildBachGoldbergVar1Score(),
    0,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.ok(
    svg.includes(`<line class="janko-beat-line" x1="${column.toFixed(2)}"`),
    'the beat pulse ink stands on the true column'
  );
});
