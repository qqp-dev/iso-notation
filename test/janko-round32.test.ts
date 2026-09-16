/**
 * Round 32 — settled four-per-system packing + midpoint-only grid (candidate-only).
 *
 *  1. Registry: two cards on the single `gridPulseFilter` axis, both sharing
 *     the settled packing (measuresPerSystem 4 + opt-in page-top correction)
 *     and differing only in the interior grid. Four literal Brahms windows
 *     per card: pickup + mm. 1–4 (five displayed slots), mm. 5–8, mm. 17–20
 *     (later page top), mm. 57–64 (paired systems exposing the known new
 *     adjacent-system overlap under investigation).
 *  2. Geometry: system tick ranges, staff span 543.48pt, first/later widths,
 *     page-top correction (sys 4/8/12/16), vertical preservation, no-pickup
 *     and non-four-measure genericity, last-system partial, crop/page
 *     coordinate agreement and the mm. 57–64 gap retention.
 *  3. Grid: omitted vs explicit `all` byte-identity, 192/48 midpoint subset
 *     (offset 96 only), solved-column subset equality, showBeatGrid false,
 *     no pickup pulses, final-partial subset, odd-subdivision empty set.
 *  4. Linter: packing-only baseline 10/0 itemized (4 folding + 5 slot + the
 *     new sys14/15 overlap −1.93pt); correction/filter add no new or
 *     worsened findings; window findings pinned.
 *  5. Canonical: Bach GOLD frozen, Brahms studio 9 / adaptive 2 unchanged,
 *     new defaults byte-identical.
 *
 * Candidate-only: no canonical promotion, no Reference change, no PDF release.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
  getCandidate,
} from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computeCropBox,
  computePageGeometry,
  countJankoSystems,
  getSystemGeometry,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
} from '../src/render/janko/engine';
import { resolveBeatPulseXs } from '../src/render/janko/elements/barlines';
import { lintJankoScore } from '../src/render/janko/linter';
import { createStudioConfig, renderCandidatesView } from '../src/render/janko/studio';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const read = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
/** Studio Brahms golden: fixed-3, 3/system, 4/page — the frozen reference. */
const O_BRAHMS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
/** Packing-only diagnostic: mps4, no correction, full grid. */
const O_PACK = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, measuresPerSystem: 4 });
const O_CORR_ALL = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  measuresPerSystem: 4,
  correctPageTopAnacrusisMeasureWidth: true,
  gridPulseFilter: 'all',
});
const O_CORR_MID = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  measuresPerSystem: 4,
  correctPageTopAnacrusisMeasureWidth: true,
  gridPulseFilter: 'midpoint-only',
});
const CONFIG = createStudioConfig({ score: BACH });

const STAFF_LEFT = 31.8;
const STAFF_RIGHT = 575.28;
const STAFF_SPAN = 543.48;
const FIRST_W = STAFF_SPAN / 4.25;
const NORMAL_W = STAFF_SPAN / 4;

/** The visible rect of a crop SVG (`viewBox="x y w h"`). */
function viewBoxOf(svg: string): { x: number; y: number; w: number; h: number } {
  const m = svg.match(/viewBox="([\d.\-]+) ([\d.\-]+) ([\d.\-]+) ([\d.\-]+)"/);
  assert.ok(m, 'the svg carries a viewBox');
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

/** All `x1` of one barline class in an SVG. */
function barlineXs(svg: string, cls = 'janko-barline'): number[] {
  return [...svg.matchAll(new RegExp(`<line class="${cls}" x1="([\\d.]+)"`, 'g'))].map((m) =>
    Number(m[1])
  );
}

// ---------------------------------------------------------------------------
// 1. Registry: Round 32, two cards, one axis, four literal windows each
// ---------------------------------------------------------------------------

test('Registry: Round 32 grid round, two cards, one open axis, no control', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 32);
  assert.match(CURRENT_ROUND_METADATA.title, /Four per system/);
  assert.ok(CURRENT_ROUND_METADATA.description.includes('five displayed slots'));
  assert.ok(CURRENT_ROUND_METADATA.description.includes('third quarter position'));
  assert.ok(!CURRENT_ROUND_METADATA.description.includes('third metric beat'));
  assert.ok(CURRENT_ROUND_METADATA.description.includes('no canonical promotion'));
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['gridPulseFilter']);
  assert.equal(CURRENT_ROUND_METADATA.compareStrip, undefined, 'no strip: matched windows');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    ['4-per-system-full-grid', '4-per-system-midpoint-grid']
  );
  assert.equal(getCandidate('control'), undefined, 'no control card');
  for (const card of CURRENT_CANDIDATES) {
    assert.equal(card.axis, 'gridPulseFilter', `${card.id} declares the open axis`);
    assert.equal(card.options?.measuresPerSystem, 4, `${card.id} settles packing`);
    assert.equal(
      card.options?.correctPageTopAnacrusisMeasureWidth,
      true,
      `${card.id} carries the correction`
    );
    assert.equal(card.tokens, undefined, `${card.id} states no token delta`);
    assert.deepEqual(
      card.windows!.map((w) => [w.scoreId, w.measureStart, w.measureCount]),
      [
        [BRAHMS_STUDIO_SCORE_ID, 1, 4],
        [BRAHMS_STUDIO_SCORE_ID, 5, 4],
        [BRAHMS_STUDIO_SCORE_ID, 17, 4],
        [BRAHMS_STUDIO_SCORE_ID, 57, 8],
      ],
      `${card.id} frames the four literal windows`
    );
  }
  assert.equal(getCandidate('4-per-system-full-grid')!.options?.gridPulseFilter, 'all');
  assert.equal(getCandidate('4-per-system-midpoint-grid')!.options?.gridPulseFilter, 'midpoint-only');
  const [w0, , , w3] = getCandidate('4-per-system-full-grid')!.windows!;
  assert.match(w0.title, /five displayed slots/, 'pickup + mm. 1–4 captioned as five slots');
  assert.match(w3.title, /known new adjacent-system overlap/, 'mm. 57–64 captioned as known overlap');
});

test('Registry: cards differ only in gridPulseFilter; core/page inherit fixed-3/4-up', () => {
  const [full, mid] = CURRENT_CANDIDATES;
  const { gridPulseFilter: _f, ...restFull } = full.options!;
  const { gridPulseFilter: _m, ...restMid } = mid.options!;
  assert.deepEqual(restFull, restMid, 'shared packing + correction, grid differs only');
  // Studio merge: candidate deltas over the score-specific Brahms entry.
  const entry = CONFIG.scores[BRAHMS_STUDIO_SCORE_ID];
  for (const card of CURRENT_CANDIDATES) {
    const merged = resolveJankoOptions({ ...entry.options, ...(card.options ?? {}) });
    assert.equal(merged.core, 'fixed-3', `${card.id} inherits the fixed-3 core`);
    assert.equal(merged.systemsPerPage, 4, `${card.id} inherits four systems/page`);
    assert.equal(merged.measuresPerSystem, 4, `${card.id} packs four/system`);
    assert.equal(merged.ticksPerMeasure, 192);
    assert.equal(merged.anacrusisTicks, 48);
  }
  // Badges: the axis is always shown; the shared correction rides as a delta.
  for (const card of CURRENT_CANDIDATES) {
    const keys = candidateBadges(card).map((b) => b.key);
    assert.ok(keys.includes('gridPulseFilter'), `${card.id} badges its axis`);
    assert.ok(
      keys.includes('correctPageTopAnacrusisMeasureWidth'),
      `${card.id} shows the shared correction delta`
    );
  }
  // Reference stays frozen: the studio Brahms entry is untouched mps3.
  assert.equal(entry.options.measuresPerSystem, 3, 'reference packing untouched');
  assert.equal(entry.options.correctPageTopAnacrusisMeasureWidth, false);
  assert.equal(entry.options.gridPulseFilter, 'all');
});

test('Candidates view: two cards × four windows, honestly red, Brahms-only', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 2, 'two cards');
  assert.match(html, /data-candidate-count="2"/);
  assert.match(html, /data-window-count="8"/, '2 cards × 4 windows');
  assert.match(html, /data-verification="false"/, 'the grid round is decisive');
  assert.match(html, /2 candidates × 8 engraving windows/);
  assert.match(html, /Round 32/);
  assert.ok(!html.includes('data-window="primary:'), 'Bach carries no window this round');
  assert.equal((html.match(/data-window="brahms-op118-no1:/g) ?? []).length, 8, 'Brahms ×8');
  assert.ok(!html.includes('data-candidate="control"'), 'no control card');
  // Whole-score card lint inherits the approved candidate-only 10 findings.
  assert.equal((html.match(/data-lint="violations"/g) ?? []).length, 2, 'both cards honestly red');
  assert.equal((html.match(/✗ 10 violations/g) ?? []).length, 2, 'the approved 10 on each card');
});

// ---------------------------------------------------------------------------
// 2. Geometry: ticks, widths, correction, partial, crop/page agreement
// ---------------------------------------------------------------------------

test('System tick ranges: sys0 pickup + 4×192, sys1 follows; 964 events, 7 merges', () => {
  assert.equal(countJankoSystems(BRAHMS, O_CORR_ALL, T_BRAHMS), 18, '18 systems at 4/system');
  assert.equal(BRAHMS.notes.length, 964, '964 underlying score events');
  assert.equal(BRAHMS.totalTicks, 13632);
  const layouts = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  assert.equal(layouts.length, 18);
  // Sys0 spans ticks [0, 816): pickup 48 + four full 192 measures, five slots.
  const s0 = layouts[0].notes;
  assert.ok(s0.length > 0);
  for (const p of s0) assert.ok(p.note.startTick >= 0 && p.note.startTick < 816);
  assert.ok(s0.some((p) => p.note.startTick < 48), 'sys0 carries the pickup');
  assert.ok(s0.some((p) => p.note.startTick >= 48), 'sys0 carries full measures');
  // Sys1 spans [816, 1584).
  for (const p of layouts[1].notes) {
    assert.ok(p.note.startTick >= 816 && p.note.startTick < 1584);
  }
  // No missing/duplicated score events: positioned + merged voices = 964.
  const positioned = layouts.flatMap((l) => l.notes).length;
  const merges = layouts.flatMap((l) => l.unisonMerges);
  const mergedIds = merges.flatMap((m) => m.mergedIds).length;
  assert.equal(merges.length, 7, 'the existing 7 cross-hand unison merges');
  assert.equal(positioned, 957, '957 physical noteheads');
  assert.equal(positioned + mergedIds, 964, 'every score event accounted for once');
  const seen = new Set<string>();
  for (const l of layouts) {
    for (const p of l.notes) {
      assert.ok(!seen.has(p.note.id), `${p.note.id} laid out once`);
      seen.add(p.note.id);
    }
    for (const m of l.unisonMerges) {
      for (const id of m.mergedIds) {
        assert.ok(!seen.has(id), `${id} merged once`);
        seen.add(id);
      }
    }
  }
  assert.equal(seen.size, 964);
});

test('Staff span and widths: first 543.48/4.25, later 543.48/4, closure at 575.28', () => {
  const geo = computePageGeometry(O_CORR_ALL, T_BRAHMS, BRAHMS);
  assert.equal(geo.staffLeft, STAFF_LEFT);
  assert.equal(geo.staffRight, STAFF_RIGHT);
  assert.equal(geo.staffRight - geo.staffLeft, STAFF_SPAN);
  assert.equal(geo.measureWidth, NORMAL_W);
  const sys0 = getSystemGeometry(geo, 0);
  assert.equal(sys0.measureWidth, FIRST_W, 'sys0 keeps its pickup denominator');
  const upbeatWidth = (48 / 192) * sys0.measureWidth;
  assert.ok(Math.abs(upbeatWidth - FIRST_W / 4) < 1e-12, 'pickup is a quarter-measure');
  assert.ok(
    Math.abs(sys0.staffLeft + upbeatWidth + 4 * sys0.measureWidth - STAFF_RIGHT) < 1e-9,
    'sys0 closes at the right margin'
  );
  // Every later full system closes exactly — corrected page-tops included.
  for (const s of [1, 2, 3, 4, 8, 12, 16]) {
    const g = getSystemGeometry(geo, s);
    assert.equal(g.measureWidth, NORMAL_W, `sys${s} uses the normal width`);
    assert.ok(
      Math.abs(g.staffLeft + 4 * g.measureWidth - STAFF_RIGHT) < 1e-9,
      `sys${s} closes at the right margin`
    );
  }
  // Uncorrected page-tops leave the 31.97pt blank tail.
  const geoN = computePageGeometry(O_PACK, T_BRAHMS, BRAHMS);
  const tail = getSystemGeometry(geoN, 4);
  assert.equal(tail.measureWidth, FIRST_W, 'uncorrected sys4 inherits the pickup width');
  const endX = tail.staffLeft + 4 * tail.measureWidth;
  assert.ok(Math.abs(endX - 543.3105882352941) < 1e-6, `uncorrected sys4 ends at ${endX}`);
  assert.ok(Math.abs(STAFF_RIGHT - endX - 31.96941176470588) < 1e-6, 'the blank tail');
});

test('Correction preserves slot verticals; no pickup repeats; generic opt-in', () => {
  const geoN = computePageGeometry(O_PACK, T_BRAHMS, BRAHMS);
  const geoC = computePageGeometry(O_CORR_ALL, T_BRAHMS, BRAHMS);
  // Across every page break: the corrected top keeps its slot verticals.
  for (const s of [4, 8, 12, 16]) {
    const n = getSystemGeometry(geoN, s);
    const c = getSystemGeometry(geoC, s);
    assert.equal(c.slotTopY, n.slotTopY, `sys${s} slotTopY preserved`);
    assert.equal(c.middleCY, n.middleCY, `sys${s} middleCY preserved`);
    assert.equal(c.staffTopY, n.staffTopY, `sys${s} staffTopY preserved`);
    assert.equal(c.staffBotY, n.staffBotY, `sys${s} staffBotY preserved`);
    assert.equal(c.staffLeft, n.staffLeft);
    assert.equal(c.staffRight, n.staffRight);
    assert.equal(n.measureWidth, FIRST_W, `sys${s} was narrowed`);
    assert.equal(c.measureWidth, NORMAL_W, `sys${s} corrected`);
  }
  // Neighbours and system 0 are untouched by the flag.
  for (const s of [0, 1, 3, 7]) {
    const n = getSystemGeometry(geoN, s);
    const c = getSystemGeometry(geoC, s);
    assert.equal(c.measureWidth, n.measureWidth, `sys${s} width untouched`);
    assert.equal(c.slotTopY, n.slotTopY);
  }
  // Layout tick ranges never repeat the pickup past system 0.
  const layouts = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  for (let s = 1; s < layouts.length; s++) {
    for (const p of layouts[s].notes) assert.ok(p.note.startTick >= 48, `sys${s} has no pickup`);
  }
  // No-pickup scores are unchanged by the opt-in (Bach byte-identical).
  for (const page of [0, 1]) {
    assert.equal(
      renderJankoPage(BACH, page, { ...DEFAULT_JANKO_OPTIONS, correctPageTopAnacrusisMeasureWidth: true }, T_BACH),
      renderJankoPage(BACH, page, O_BACH, T_BACH),
      `Bach page ${page + 1} inert under the correction`
    );
  }
  // Non-four-measure packing corrects generically (mps3: 543.48/3.25 → /3).
  const o3n = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS });
  const o3c = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    correctPageTopAnacrusisMeasureWidth: true,
  });
  const g3n = computePageGeometry(o3n, T_BRAHMS, BRAHMS);
  const g3c = computePageGeometry(o3c, T_BRAHMS, BRAHMS);
  assert.equal(getSystemGeometry(g3n, 4).measureWidth, STAFF_SPAN / 3.25);
  assert.equal(getSystemGeometry(g3c, 4).measureWidth, STAFF_SPAN / 3);
  assert.equal(getSystemGeometry(g3c, 0).measureWidth, STAFF_SPAN / 3.25, 'sys0 keeps pickup');
});

test('Last system: sys17 begins 13104, score ends 13632 — 192 + 192 + 144 partial', () => {
  const layouts = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  const last = layouts[17];
  assert.equal(last.index, 17);
  assert.equal(last.isFinalSystem, true);
  for (const p of last.notes) {
    assert.ok(p.note.startTick >= 13104 && p.note.startTick < 13632, 'within the musical span');
  }
  assert.equal(BRAHMS.totalTicks - 13104, 528, '192 + 192 + 144 sounding ticks');
  // Nominal grid endpoint (13872) overruns the music; nothing is forced full.
  const nominalEnd = 48 + 18 * 4 * 192;
  assert.equal(nominalEnd, 13872);
  assert.ok(nominalEnd > BRAHMS.totalTicks, 'grid overrun is not musical duration');
  for (const l of layouts) {
    for (const p of l.notes) assert.ok(p.note.startTick < 13632, 'no note past the score end');
  }
});

test('Crop/page agreement: mm. 17–20 spans the full 571.28pt after correction', () => {
  const geoN = computePageGeometry(O_PACK, T_BRAHMS, BRAHMS);
  const geoC = computePageGeometry(O_CORR_ALL, T_BRAHMS, BRAHMS);
  const boxN = computeCropBox(geoN, 17, 4, true, null);
  const boxC = computeCropBox(geoC, 17, 4, true, null);
  assert.equal(boxN.firstSystem, 4);
  assert.equal(boxC.firstSystem, 4);
  assert.ok(Math.abs(boxN.w - 539.3105882352941) < 1e-6, `uncorrected crop clips at ${boxN.w}`);
  assert.ok(Math.abs(boxC.w - 571.28) < 1e-9, `corrected crop spans ${boxC.w}`);
  // Same-options crop and full-page barlines agree (no masking, no drift).
  const crop = renderJankoCrop(BRAHMS, 17, 4, O_CORR_ALL, T_BRAHMS);
  const page = renderJankoPage(BRAHMS, 1, O_CORR_ALL, T_BRAHMS);
  const cropXs = barlineXs(crop).sort((a, b) => a - b);
  const pageXs = barlineXs(page).sort((a, b) => a - b);
  assert.ok(cropXs.length > 0 && pageXs.length > 0);
  for (const x of cropXs) {
    assert.ok(
      pageXs.some((p) => Math.abs(p - x) < 0.015),
      `crop barline x=${x} has a page twin`
    );
  }
  // The corrected crop reaches the staff edge instead of clipping the tail.
  const view = viewBoxOf(crop);
  assert.ok(Math.abs(view.x + view.w - (STAFF_RIGHT + 8)) < 1e-6, 'crop ends past staffRight');
});

test('Paired crop mm. 57–64 retains the page-relative inter-system gap', () => {
  const geo = computePageGeometry(O_CORR_ALL, T_BRAHMS, BRAHMS);
  const box = computeCropBox(geo, 57, 8, true, null);
  assert.equal(box.firstSystem, 14);
  assert.equal(box.lastSystem, 15);
  assert.ok(Math.abs(box.w - 571.28) < 1e-9, 'full staff width');
  const layouts = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  const upper = layouts[14];
  const lower = layouts[15];
  // The systems are page-mates (page 4): the crop stacks them at page Y.
  assert.equal(Math.floor(14 / 4), Math.floor(15 / 4), 'same page');
  assert.ok(upper.geometry.staffBotY > lower.geometry.staffTopY - 200, 'stacked, not rearranged');
  // The known overlap survives the crop: upper ink bottom past lower ink top.
  const report = lintJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  const overlap = report.violations.find(
    (v) => v.code === 'system-slot-overlap' && v.system === 15 && v.metrics?.lowerTop !== undefined
  );
  assert.ok(overlap, 'the sys14/15 overlap is reported');
  const gap = (overlap!.metrics!.lowerTop as number) - (overlap!.metrics!.upperBottom as number);
  assert.ok(Math.abs(gap - -1.9275) < 1e-6, `signed gap ${gap}pt exposes the collision`);
  assert.equal(gap.toFixed(2), '-1.93');
});

// ---------------------------------------------------------------------------
// 3. Grid: filter semantics on the 192/48 lattice and odd subdivisions
// ---------------------------------------------------------------------------

test('Omitted and explicit all are byte-identical canonical output', () => {
  const oOmitted = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, measuresPerSystem: 4 });
  const oExplicit = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    measuresPerSystem: 4,
    gridPulseFilter: 'all',
  });
  for (let page = 0; page < 5; page++) {
    assert.equal(
      renderJankoPage(BRAHMS, page, oExplicit, T_BRAHMS),
      renderJankoPage(BRAHMS, page, oOmitted, T_BRAHMS),
      `Brahms page ${page + 1} identical`
    );
  }
  for (const page of [0, 1]) {
    assert.equal(
      renderJankoPage(
        BACH,
        page,
        { ...DEFAULT_JANKO_OPTIONS, gridPulseFilter: 'all' },
        T_BACH
      ),
      renderJankoPage(BACH, page, O_BACH, T_BACH),
      `Bach page ${page + 1} identical`
    );
  }
  const rO = lintJankoScore(BRAHMS, oOmitted, T_BRAHMS);
  const rE = lintJankoScore(BRAHMS, oExplicit, T_BRAHMS);
  assert.deepEqual(
    rE.violations.map((v) => [v.code, v.system, v.measure]),
    rO.violations.map((v) => [v.code, v.system, v.measure])
  );
});

test('192/48 lattice: midpoint-only keeps offset 96, drops 48/144; music untouched', () => {
  const geo = computePageGeometry(O_CORR_ALL, T_BRAHMS, BRAHMS);
  for (const s of [0, 1, 4]) {
    const g = getSystemGeometry(geo, s);
    const all = resolveBeatPulseXs(g, s, O_CORR_ALL, T_BRAHMS, null);
    const mid = resolveBeatPulseXs(g, s, O_CORR_MID, T_BRAHMS, null);
    assert.equal(all.length, 12, `sys${s} full grid has 12 pulses`);
    assert.equal(mid.length, 4, `sys${s} midpoint grid has 4 pulses`);
    // Retained coordinates equal the all-grid subset (every third pulse).
    for (let i = 0; i < 4; i++) {
      assert.equal(mid[i], all[i * 3 + 1], `sys${s} measure ${i} midpoint is the subset twin`);
    }
  }
  // Measure boundaries, geometry, notes, beams and timings are unchanged.
  const geoM = computePageGeometry(O_CORR_MID, T_BRAHMS, BRAHMS);
  for (const s of [0, 1, 4]) {
    assert.equal(getSystemGeometry(geoM, s).measureWidth, getSystemGeometry(geo, s).measureWidth);
  }
  const lA = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  const lM = layoutJankoScore(BRAHMS, O_CORR_MID, T_BRAHMS);
  let notes = 0;
  for (let s = 0; s < lA.length; s++) {
    assert.equal(lM[s].notes.length, lA[s].notes.length);
    const byId = new Map(lM[s].notes.map((p) => [p.note.id, p]));
    for (const p of lA[s].notes) {
      const q = byId.get(p.note.id)!;
      assert.equal(q.x, p.x, `${p.note.id} x untouched`);
      assert.equal(q.y, p.y, `${p.note.id} y untouched`);
      notes++;
    }
    assert.equal(lM[s].beams.length, lA[s].beams.length, `sys${s} beams untouched`);
    assert.equal(lM[s].rests.length, lA[s].rests.length, `sys${s} rests untouched`);
  }
  assert.equal(notes, 957, 'all noteheads compared');
});

test('Retained pulses equal solved-column twins; grid edge cases preserved', () => {
  const layouts = layoutJankoScore(BRAHMS, O_CORR_ALL, T_BRAHMS);
  for (const s of [0, 1, 4, 17]) {
    const l = layouts[s];
    const all = resolveBeatPulseXs(l.geometry, s, O_CORR_ALL, T_BRAHMS, l.columns);
    const mid = resolveBeatPulseXs(l.geometry, s, O_CORR_MID, T_BRAHMS, l.columns);
    for (const x of mid) {
      assert.ok(all.includes(x), `sys${s} midpoint x=${x} is a solved-column twin`);
    }
  }
  // showBeatGrid:false stays empty under both filters.
  const off = resolveJankoOptions({ ...O_CORR_MID, showBeatGrid: false });
  const geo = computePageGeometry(off, T_BRAHMS, BRAHMS);
  assert.deepEqual(resolveBeatPulseXs(getSystemGeometry(geo, 0), 0, off, T_BRAHMS, null), []);
  // No pickup pulses: sys0 interior pulses all sit at/after the downbeat tick.
  const g0 = getSystemGeometry(computePageGeometry(O_CORR_MID, T_BRAHMS, BRAHMS), 0);
  const mid0 = resolveBeatPulseXs(g0, 0, O_CORR_MID, T_BRAHMS, null);
  assert.equal(mid0.length, 4, 'pickup contributes no interior pulse');
  // Final-partial subset: sys17 midpoint pulses are a subset of all-grid.
  const l17 = layouts[17];
  const all17 = resolveBeatPulseXs(l17.geometry, 17, O_CORR_ALL, T_BRAHMS, l17.columns);
  const mid17 = resolveBeatPulseXs(l17.geometry, 17, O_CORR_MID, T_BRAHMS, l17.columns);
  assert.ok(mid17.length > 0 && mid17.length < all17.length);
  for (const x of mid17) assert.ok(all17.includes(x));
  // Odd subdivision (144/48: offsets 48/96, half 72 absent) yields empty set.
  const oddO = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    measuresPerSystem: 4,
    correctPageTopAnacrusisMeasureWidth: true,
    gridPulseFilter: 'midpoint-only',
    ticksPerMeasure: 144,
    ticksPerBeat: 48,
  });
  const oddT = resolveJankoTokens({ ...T_BRAHMS, ticksPerMeasure: 144, ticksPerBeat: 48 });
  const oddGeo = getSystemGeometry(computePageGeometry(oddO, oddT, BRAHMS), 1);
  const oddAll = resolveBeatPulseXs(
    oddGeo,
    1,
    resolveJankoOptions({ ...oddO, gridPulseFilter: 'all' }),
    oddT,
    null
  );
  const oddMid = resolveBeatPulseXs(oddGeo, 1, oddO, oddT, null);
  assert.equal(oddAll.length, 8, 'odd lattice states 8 pulses under all');
  assert.deepEqual(oddMid, [], 'no existing midpoint means no interior pulses, never all');
});

// ---------------------------------------------------------------------------
// 4. Linter: approved candidate-only baseline 10/0, no new/worsened findings
// ---------------------------------------------------------------------------

test('Packing-only baseline: 10 violations/0 warnings, four folding sites pinned', () => {
  const report = lintJankoScore(BRAHMS, O_PACK, T_BRAHMS);
  assert.equal(report.violations.length, 10, 'the approved packing-only 10');
  assert.equal(report.warnings.length, 0);
  const folding = report.violations.filter((v) => v.code === 'stem-through-simultaneity');
  assert.deepEqual(
    folding.map((v) => [v.system, v.measure, ...(v.noteIds ?? [])]),
    [
      [1, 7, 'brahms-op118-no1-78', 'brahms-op118-no1-80'],
      [4, 17, 'brahms-op118-no1-213', 'brahms-op118-no1-215'],
      [5, 24, 'brahms-op118-no1-326', 'brahms-op118-no1-325'],
      [10, 44, 'brahms-op118-no1-612', 'brahms-op118-no1-611'],
    ],
    'the four retained folding sites'
  );
});

test('Slot findings and the new sys14/15 ink overlap, unrounded values pinned', () => {
  const report = lintJankoScore(BRAHMS, O_PACK, T_BRAHMS);
  const slots = report.violations.filter(
    (v) => v.code === 'system-slot-overlap' && v.metrics?.lowerTop === undefined
  );
  assert.deepEqual(
    slots.map((v) => v.system),
    [1, 3, 7, 12, 15],
    'the five slot-accounting sites'
  );
  // Unrounded overflows (1.00pt clearance included): 2.01375 / 4.41375 / 9.41375.
  const overflowOf = (v: (typeof slots)[number]): number => {
    const m = v.metrics as { inkTop: number; inkBottom: number; slotTop: number; slotBottom: number };
    const topOverflow = m.slotTop + 1 - m.inkTop;
    const botOverflow = m.inkBottom - (m.slotBottom - 1);
    return Math.max(topOverflow, botOverflow);
  };
  const overflows = slots.map((v) => overflowOf(v));
  assert.ok(Math.abs(overflows[0] - 2.01375) < 1e-6, `sys1 +${overflows[0]}pt`);
  assert.ok(Math.abs(overflows[1] - 2.01375) < 1e-6, `sys3 +${overflows[1]}pt`);
  assert.ok(Math.abs(overflows[2] - 4.41375) < 1e-6, `sys7 +${overflows[2]}pt`);
  assert.ok(Math.abs(overflows[3] - 4.41375) < 1e-6, `sys12 +${overflows[3]}pt`);
  assert.ok(Math.abs(overflows[4] - 9.41375) < 1e-6, `sys15 +${overflows[4]}pt`);
  assert.deepEqual(
    overflows.map((o) => o.toFixed(2)),
    ['2.01', '2.01', '4.41', '4.41', '9.41'],
    'the rounded diagnostic values'
  );
  // The new real ink overlap — not mere slot accounting.
  const overlaps = report.violations.filter((v) => v.metrics?.lowerTop !== undefined);
  assert.equal(overlaps.length, 1, 'exactly one adjacent-system ink collision');
  assert.equal(overlaps[0].system, 15);
  const gap =
    (overlaps[0].metrics!.lowerTop as number) - (overlaps[0].metrics!.upperBottom as number);
  assert.ok(Math.abs(gap - -1.9275) < 1e-6, `signed gap ${gap}pt`);
  assert.equal(gap.toFixed(2), '-1.93');
  assert.ok(Math.abs((overlaps[0].metrics!.upperBottom as number) - 623.43125) < 1e-6);
  assert.ok(Math.abs((overlaps[0].metrics!.lowerTop as number) - 621.50375) < 1e-6);
});

test('Correction/filter add no new or worsened findings (identities, not counts)', () => {
  const base = lintJankoScore(BRAHMS, O_PACK, T_BRAHMS);
  const keyOf = (v: (typeof base.violations)[number]): string =>
    [v.code, v.system, v.measure ?? '', ...(v.noteIds ?? [])].join('|');
  const baseKeys = base.violations.map(keyOf);
  for (const [label, o] of [
    ['corrected full-grid', O_CORR_ALL],
    ['corrected midpoint-grid', O_CORR_MID],
  ] as const) {
    const r = lintJankoScore(BRAHMS, o, T_BRAHMS);
    assert.equal(r.warnings.length, 0, `${label}: no warnings`);
    assert.deepEqual(
      r.violations.map(keyOf),
      baseKeys,
      `${label}: same finding identities and sites as the approved baseline`
    );
    // Severity and geometry unchanged (spot-check the overlap metrics).
    const overlap = r.violations.find((v) => v.metrics?.lowerTop !== undefined)!;
    const gap = (overlap.metrics!.lowerTop as number) - (overlap.metrics!.upperBottom as number);
    assert.ok(Math.abs(gap - -1.9275) < 1e-6, `${label}: overlap unmoved`);
  }
});

test('Baseline window findings: sys0/8/17 clean; sys1/4/14–15 pinned', () => {
  const report = lintJankoScore(BRAHMS, O_PACK, T_BRAHMS);
  const bySys = new Map<number, typeof report.violations>();
  for (const v of report.violations) {
    const bucket = bySys.get(v.system) ?? [];
    bucket.push(v);
    bySys.set(v.system, bucket);
  }
  assert.equal(bySys.get(0), undefined, 'sys0 (pickup + mm. 1–4) clean');
  assert.equal(bySys.get(1)!.length, 2, 'sys1 carries folding + slot');
  assert.ok(bySys.get(1)!.some((v) => v.code === 'stem-through-simultaneity'));
  assert.ok(bySys.get(1)!.some((v) => v.code === 'system-slot-overlap'));
  assert.deepEqual(
    bySys.get(4)!.map((v) => v.code),
    ['stem-through-simultaneity'],
    'sys4 (mm. 17–20) carries folding only'
  );
  assert.equal(bySys.get(8), undefined, 'sys8 clean');
  assert.equal(bySys.get(17), undefined, 'sys17 (partial close) clean');
  const s15 = bySys.get(15)!;
  assert.equal(s15.length, 2, 'sys15 carries slot + the new collision');
  assert.ok(s15.some((v) => v.metrics?.lowerTop === undefined), 'the slot-accounting finding');
  assert.ok(s15.some((v) => v.metrics?.lowerTop !== undefined), 'the sys14/15 ink overlap');
});

// ---------------------------------------------------------------------------
// 5. Canonical gates: frozen GOLD, studio 9, CLI 2, byte-identical defaults
// ---------------------------------------------------------------------------

test('Canonical frozen: Bach 0/0, Brahms studio 9, adaptive CLI 2, defaults inert', () => {
  assert.deepEqual(resolveJankoOptions(DEFAULT_JANKO_OPTIONS).gridPulseFilter, 'all');
  assert.equal(resolveJankoOptions(DEFAULT_JANKO_OPTIONS).correctPageTopAnacrusisMeasureWidth, false);
  const bach = lintJankoScore(BACH, O_BACH, T_BACH);
  assert.equal(bach.violations.length, 0);
  assert.equal(bach.warnings.length, 0);
  const studio = lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  assert.equal(studio.violations.length, 9, 'live fixed-3 canonical 9 unchanged');
  assert.equal(studio.warnings.length, 0);
  const cli = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' },
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.equal(cli.violations.length, 2, 'CLI adaptive 2 unchanged');
  assert.equal(cli.warnings.length, 0);
  assert.deepEqual(
    cli.violations.map((v) => v.system),
    [22, 23],
    'sys 23 furniture + sys 24/23 overlap'
  );
  assert.ok(!('core' in getCandidate('4-per-system-full-grid')!.options!), 'no core delta');
  assert.ok(!('systemsPerPage' in getCandidate('4-per-system-full-grid')!.options!), 'no page delta');
});

test('R31 parked: historical consts in the round-31 suite, registry carries the record', () => {
  const suite = read('test/janko-round31.test.ts');
  assert.ok(suite.includes('ROUND_31_METADATA'), 'the historical metadata const is parked');
  assert.ok(suite.includes('ROUND_31_CANDIDATES'), 'the historical card consts are parked');
  assert.match(suite, /[Hh]istorical Round 31/, 'the parking record names the round');
  assert.ok(suite.includes('CONFIG_31'), 'parked chip renders on the historical config');
  assert.match(
    read('src/render/janko/candidates.ts'),
    /Round 31 is parked/,
    'the registry carries the parking record'
  );
});
