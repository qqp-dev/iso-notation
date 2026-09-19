/**
 * Historical Round 33 — full interior grid vs no interior grid. DECIDED: the
 * full grid is selected — the settled packing, the page-top correction and
 * every shared refinement are canonical (see the Brahms score options), and
 * no comparison remains. Parked by convention (reversible, nothing lost):
 * the registry record lives in `src/render/janko/candidates.ts`, the cards
 * as `ROUND_33_METADATA` / `ROUND_33_CANDIDATES` below.
 *
 *  1. Registry (HISTORICAL consts; no live-registry assertions remain): two
 *     cards on the single `gridPulseFilter` axis, both sharing the settled
 *     packing (measuresPerSystem 4 + page-top correction) and every settled
 *     refinement, differing only in the interior grid. Six literal Brahms
 *     windows per card: pickup + mm. 1–4 (five displayed slots), mm. 5–8,
 *     mm. 17–20, mm. 33–36, mm. 53–56, mm. 57–64.
 *  2. Grid (live): `none` paints zero interior pulses while barlines still
 *     paint; omitted vs explicit `none` agreement; music untouched.
 *  3. Ink-only (live): all vs none produce byte-equal underlying solved
 *     geometry (note positions, columns, cells) — the pages differ ONLY by
 *     the beat-grid group. mm. 9 covered explicitly.
 *  4. Linter (live): the full-grid card carries the settled baseline; the
 *     filter adds no finding.
 *  5. Candidates view (HISTORICAL config): the parked cards render 2 × 6,
 *     Brahms-only.
 *  6. R33 decided by convention: historical consts parked, live registry
 *     moved to Round 34 (see test/janko-round34.test.ts).
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
  brahmsWindow,
  candidateBadges,
  type JankoCandidate,
  type JankoCandidateRound,
  type JankoScoreCandidateWindow,
} from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoSystems,
  getSystemGeometry,
  computePageGeometry,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
} from '../src/render/janko/engine';
import {
  renderBarlines,
  resolveBeatPulseXs,
} from '../src/render/janko/elements/barlines';
import { lintJankoScore } from '../src/render/janko/linter';
import { createStudioConfig, renderCandidatesView } from '../src/render/janko/studio';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const read = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
/** Full-grid card options: settled packing + correction + full grid. */
const O_FULL = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  measuresPerSystem: 4,
  correctPageTopAnacrusisMeasureWidth: true,
  gridPulseFilter: 'all',
});
/** No-grid card options: settled packing + correction + no interior grid. */
const O_NONE = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  measuresPerSystem: 4,
  correctPageTopAnacrusisMeasureWidth: true,
  gridPulseFilter: 'none',
});
const CONFIG = createStudioConfig({ score: BACH });

/** Historical Round 33 metadata (parked; full grid selected). */
const ROUND_33_METADATA: JankoCandidateRound = {
  round: 33,
  title: 'Full interior grid vs no interior grid',
  description:
    'Settled packing — first system pickup + four full measures (five displayed slots), later systems four full measures — under the opt-in page-top width correction on the fixed-3 core at four systems/page, with every settled refinement shared. The question is the interior grid only: the existing quarter-position pulses versus no interior grid at all, measure boundaries untouched. Midpoint-only is rejected. Two cards, one axis (gridPulseFilter); no canonical promotion.',
  openAxes: ['gridPulseFilter'],
};

/** Historical Round 33 cards (parked; the full card won). */
const ROUND_33_CANDIDATES: JankoCandidate[] = [
  {
    id: 'grid-full-vs-none-full',
    label: 'Full grid · settled packing',
    description:
      'Settled 4-per-system packing with the page-top correction and the existing interior quarter-position grid (second, third and fourth positions). Every settled refinement shared; no canonical promotion.',
    axis: 'gridPulseFilter',
    options: {
      measuresPerSystem: 4,
      correctPageTopAnacrusisMeasureWidth: true,
      gridPulseFilter: 'all',
    },
    windows: [
      brahmsWindow(
        1,
        4,
        'Brahms pickup + mm. 1–4 · five displayed slots (upbeat + four full measures)'
      ),
      brahmsWindow(5, 4, 'Brahms mm. 5–8 · second system, four full measures'),
      brahmsWindow(17, 4, 'Brahms mm. 17–20 · later page-top system, four full measures'),
      brahmsWindow(33, 4, 'Brahms mm. 33–36 · four full measures'),
      brahmsWindow(53, 4, 'Brahms mm. 53–56 · four full measures'),
      brahmsWindow(
        57,
        8,
        'Brahms mm. 57–64 · paired systems spanning the known adjacent-system overlap'
      ),
    ],
  },
  {
    id: 'grid-full-vs-none-none',
    label: 'No interior grid · settled packing',
    description:
      'Same settled packing, page-top correction and shared refinements; no interior grid pulse paints at all. Measure boundaries untouched; no canonical promotion.',
    axis: 'gridPulseFilter',
    options: {
      measuresPerSystem: 4,
      correctPageTopAnacrusisMeasureWidth: true,
      gridPulseFilter: 'none',
    },
    windows: [
      brahmsWindow(
        1,
        4,
        'Brahms pickup + mm. 1–4 · five displayed slots (upbeat + four full measures)'
      ),
      brahmsWindow(5, 4, 'Brahms mm. 5–8 · second system, four full measures'),
      brahmsWindow(17, 4, 'Brahms mm. 17–20 · later page-top system, four full measures'),
      brahmsWindow(33, 4, 'Brahms mm. 33–36 · four full measures'),
      brahmsWindow(53, 4, 'Brahms mm. 53–56 · four full measures'),
      brahmsWindow(
        57,
        8,
        'Brahms mm. 57–64 · paired systems spanning the known adjacent-system overlap'
      ),
    ],
  },
];

/** Studio config rendering the parked Round 33 cards (reversible, nothing lost). */
const CONFIG_33 = createStudioConfig({
  score: BACH,
  candidates: ROUND_33_CANDIDATES,
  round: ROUND_33_METADATA,
});

/**
 * Strip every beat-grid group from a page SVG (the only sanctioned diff) and
 * normalize inter-tag whitespace (the engine leaves a blank line where a
 * grid group is absent; path data is untouched).
 */
function withoutBeatGrid(svg: string): string {
  return svg
    .replace(/\s*<g class="janko-beat-grid">[\s\S]*?<\/g>/g, '')
    .replace(/>\s+</g, '><');
}

/** Count painted interior beat pulses in an SVG. */
function beatLineCount(svg: string): number {
  return (svg.match(/<line class="janko-beat-line"/g) ?? []).length;
}

// ---------------------------------------------------------------------------
// 1. Registry (HISTORICAL): Round 33, two cards, one axis, six literal windows
// ---------------------------------------------------------------------------

test('Round 33 parked: one axis, two cards, no control', () => {
  assert.equal(ROUND_33_METADATA.round, 33);
  assert.match(ROUND_33_METADATA.title, /no interior grid/i);
  assert.ok(ROUND_33_METADATA.description.includes('five displayed slots'));
  assert.ok(ROUND_33_METADATA.description.includes('Midpoint-only is rejected'));
  assert.ok(ROUND_33_METADATA.description.includes('no canonical promotion'));
  assert.deepEqual(ROUND_33_METADATA.openAxes, ['gridPulseFilter']);
  assert.equal(ROUND_33_METADATA.compareStrip, undefined, 'no strip: matched windows');
  assert.deepEqual(
    ROUND_33_CANDIDATES.map((c) => c.id),
    ['grid-full-vs-none-full', 'grid-full-vs-none-none']
  );
  assert.equal(
    ROUND_33_CANDIDATES.find((c) => c.id === 'control'),
    undefined,
    'no control card'
  );
  for (const card of ROUND_33_CANDIDATES) {
    assert.equal(card.axis, 'gridPulseFilter', `${card.id} declares the open axis`);
    assert.equal(card.options?.measuresPerSystem, 4, `${card.id} settles packing`);
    assert.equal(
      card.options?.correctPageTopAnacrusisMeasureWidth,
      true,
      `${card.id} carries the correction`
    );
    assert.equal(card.tokens, undefined, `${card.id} states no token delta`);
    assert.deepEqual(
      (card.windows as JankoScoreCandidateWindow[]).map((w) => [w.scoreId, w.measureStart, w.measureCount]),
      [
        [BRAHMS_STUDIO_SCORE_ID, 1, 4],
        [BRAHMS_STUDIO_SCORE_ID, 5, 4],
        [BRAHMS_STUDIO_SCORE_ID, 17, 4],
        [BRAHMS_STUDIO_SCORE_ID, 33, 4],
        [BRAHMS_STUDIO_SCORE_ID, 53, 4],
        [BRAHMS_STUDIO_SCORE_ID, 57, 8],
      ],
      `${card.id} frames the six literal windows`
    );
  }
  assert.equal(
    ROUND_33_CANDIDATES.find((c) => c.id === 'grid-full-vs-none-full')!.options?.gridPulseFilter,
    'all'
  );
  assert.equal(
    ROUND_33_CANDIDATES.find((c) => c.id === 'grid-full-vs-none-none')!.options?.gridPulseFilter,
    'none'
  );
  const fullWindows = ROUND_33_CANDIDATES.find((c) => c.id === 'grid-full-vs-none-full')!.windows!;
  const [w0, , , , , w5] = fullWindows;
  assert.match(w0.title, /five displayed slots/, 'pickup + mm. 1–4 captioned as five slots');
  assert.match(w5.title, /known adjacent-system overlap/, 'mm. 57–64 captioned as known overlap');
});

test('Round 33 parked cards differ only in gridPulseFilter; core/page inherit fixed-3/4-up', () => {
  const [full, none] = ROUND_33_CANDIDATES;
  const { gridPulseFilter: _f, ...restFull } = full.options!;
  const { gridPulseFilter: _n, ...restNone } = none.options!;
  assert.deepEqual(restFull, restNone, 'shared packing + correction, grid differs only');
  // Studio merge: candidate deltas over the score-specific Brahms entry.
  const entry = CONFIG.scores[BRAHMS_STUDIO_SCORE_ID];
  for (const card of ROUND_33_CANDIDATES) {
    const merged = resolveJankoOptions({ ...entry.options, ...(card.options ?? {}) });
    assert.equal(merged.core, 'fixed-3', `${card.id} inherits the fixed-3 core`);
    assert.equal(merged.systemsPerPage, 4, `${card.id} inherits four systems/page`);
    assert.equal(merged.measuresPerSystem, 4, `${card.id} packs four/system`);
    assert.equal(merged.ticksPerMeasure, 192);
    assert.equal(merged.anacrusisTicks, 48);
  }
  // Badges: the axis is always shown (against the parked round record); the
  // shared correction rides as a delta.
  for (const card of ROUND_33_CANDIDATES) {
    const keys = candidateBadges(card, ROUND_33_METADATA).map((b) => b.key);
    assert.ok(keys.includes('gridPulseFilter'), `${card.id} badges its axis`);
    assert.ok(
      keys.includes('correctPageTopAnacrusisMeasureWidth'),
      `${card.id} shows the shared correction delta`
    );
  }
  // Canonical promotion: the studio Brahms entry now carries the judged
  // packing (4/system + correction + full grid).
  assert.equal(entry.options.measuresPerSystem, 4, 'canonical packing promoted');
  assert.equal(entry.options.correctPageTopAnacrusisMeasureWidth, true);
  assert.equal(entry.options.gridPulseFilter, 'all');
});

test('Round 33 parked cards resolve against the golden master with exactly the grid delta', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const card of ROUND_33_CANDIDATES) {
    const resolved = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...(card.options ?? {}) });
    for (const [k, v] of Object.entries(resolved)) {
      if (k === 'measuresPerSystem') {
        assert.equal(v, 4, `${card.id} packs four/system`);
      } else if (k === 'correctPageTopAnacrusisMeasureWidth') {
        assert.equal(v, true, `${card.id} carries the correction`);
      } else if (k === 'gridPulseFilter') {
        assert.equal(
          v,
          card.id === 'grid-full-vs-none-full' ? 'all' : 'none',
          `${card.id} states its grid value`
        );
      } else {
        assert.deepEqual(v, (golden as Record<string, unknown>)[k], `${card.id} locks ${k} to golden`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Grid: none paints zero pulses; barlines untouched
// ---------------------------------------------------------------------------

test('none paints zero interior pulses on every Brahms system; barlines still paint', () => {
  const geoFull = computePageGeometry(O_FULL, T_BRAHMS, BRAHMS);
  const geoNone = computePageGeometry(O_NONE, T_BRAHMS, BRAHMS);
  const systems = countJankoSystems(BRAHMS, O_FULL, T_BRAHMS);
  assert.ok(systems > 10, 'the packing spans many systems');
  let fullTotal = 0;
  for (let s = 0; s < systems; s++) {
    const sysFull = getSystemGeometry(geoFull, s, O_FULL);
    const sysNone = getSystemGeometry(geoNone, s, O_NONE);
    const fullXs = resolveBeatPulseXs(sysFull, s, O_FULL, T_BRAHMS, null);
    const noneXs = resolveBeatPulseXs(sysNone, s, O_NONE, T_BRAHMS, null);
    fullTotal += fullXs.length;
    assert.deepEqual(noneXs, [], `system ${s}: no interior pulse under none`);
    // Barlines are not pulses: every system keeps its measure barlines.
    const barsFull = renderBarlines(sysFull, O_FULL, T_BRAHMS);
    const barsNone = renderBarlines(sysNone, O_NONE, T_BRAHMS);
    assert.ok(barsFull.includes('janko-barline'), `system ${s}: full card barlines paint`);
    assert.equal(barsNone, barsFull, `system ${s}: barlines byte-identical under none`);
  }
  assert.ok(fullTotal > 40, `the full card paints interior pulses (${fullTotal})`);
});

test('mm. 9 is covered: full keeps three pulses per measure, none keeps zero', () => {
  // mm. 9 sits on system 2 under 4-per packing (sys0: pickup+1–4, sys1: 5–8, sys2: 9–12).
  const geoFull = computePageGeometry(O_FULL, T_BRAHMS, BRAHMS);
  const geoNone = computePageGeometry(O_NONE, T_BRAHMS, BRAHMS);
  const sysFull = getSystemGeometry(geoFull, 2, O_FULL);
  const sysNone = getSystemGeometry(geoNone, 2, O_NONE);
  const fullXs = resolveBeatPulseXs(sysFull, 2, O_FULL, T_BRAHMS, null);
  const noneXs = resolveBeatPulseXs(sysNone, 2, O_NONE, T_BRAHMS, null);
  assert.equal(fullXs.length, 12, 'four measures × three interior pulses');
  assert.deepEqual(noneXs, [], 'no interior pulse under none');
  // mm. 9 is the first measure of system 2: its three pulses sit strictly
  // inside the first measure cell (staff left edge to the first closing
  // barline).
  const bars = renderBarlines(sysFull, O_FULL, T_BRAHMS);
  const xs = [...bars.matchAll(/<line class="janko-barline" x1="([\d.]+)"/g)].map((m) =>
    Number(m[1])
  );
  assert.ok(xs.length >= 1, 'system 2 carries measure barlines');
  const m9 = fullXs.slice(0, 3);
  assert.ok(
    m9.every((x) => x > sysFull.staffLeft && x < xs[0]),
    'mm. 9 pulses stand inside mm. 9'
  );
});

// ---------------------------------------------------------------------------
// 3. Ink-only: equal solved geometry, pages differ solely by the beat grid
// ---------------------------------------------------------------------------

test('all vs none share byte-equal solved geometry (notes, columns, cells)', () => {
  const full = layoutJankoScore(BRAHMS, O_FULL, T_BRAHMS);
  const none = layoutJankoScore(BRAHMS, O_NONE, T_BRAHMS);
  assert.equal(none.length, full.length, 'same system count');
  for (let s = 0; s < full.length; s++) {
    assert.equal(none[s].notes.length, full[s].notes.length, `sys${s}: same note count`);
    for (let i = 0; i < full[s].notes.length; i++) {
      const a = full[s].notes[i];
      const b = none[s].notes[i];
      assert.equal(b.note.id, a.note.id, `sys${s} note ${i}: same id order`);
      assert.equal(b.x, a.x, `sys${s} ${a.note.id}: same x`);
      assert.equal(b.y, a.y, `sys${s} ${a.note.id}: same y`);
    }
    assert.deepEqual(
      [...none[s].columns.entries()],
      [...full[s].columns.entries()],
      `sys${s}: same laid-out columns`
    );
  }
});

test('all vs none pages differ ONLY by the beat-grid group (all pages)', () => {
  const systems = countJankoSystems(BRAHMS, O_FULL, T_BRAHMS);
  const pages = Math.ceil(systems / O_FULL.systemsPerPage);
  assert.ok(pages >= 4, 'the packing spans several pages');
  for (let p = 0; p < pages; p++) {
    const full = renderJankoPage(BRAHMS, p, O_FULL, T_BRAHMS);
    const none = renderJankoPage(BRAHMS, p, O_NONE, T_BRAHMS);
    assert.ok(beatLineCount(full) > 0, `page ${p + 1}: full paints pulses`);
    assert.equal(beatLineCount(none), 0, `page ${p + 1}: none paints no pulse`);
    assert.equal(
      withoutBeatGrid(none),
      withoutBeatGrid(full),
      `page ${p + 1}: identical once the beat grid is stripped`
    );
  }
});

test('all vs none crops differ ONLY by the beat-grid group (mm. 9 macro)', () => {
  const full = renderJankoCrop(BRAHMS, 9, 1, O_FULL, T_BRAHMS);
  const none = renderJankoCrop(BRAHMS, 9, 1, O_NONE, T_BRAHMS);
  assert.equal(full.match(/viewBox="[^"]+"/)?.[0], none.match(/viewBox="[^"]+"/)?.[0], 'same crop frame');
  assert.ok(beatLineCount(full) > 0, 'mm. 9 full paints pulses');
  assert.equal(beatLineCount(none), 0, 'mm. 9 none paints no pulse');
  assert.equal(withoutBeatGrid(none), withoutBeatGrid(full), 'mm. 9 identical but for the grid');
});

// ---------------------------------------------------------------------------
// 4. Linter: the full card carries the settled baseline; the filter adds none
// ---------------------------------------------------------------------------

test('Round 33 full card clean under the §5 geometry pass; none adds no finding', () => {
  // Gate 5 recapture (not assumed): the historical 4-per candidate 10 was 4
  // stem-through + 5 slot-accounting + 1 sys15/16 ink overlap. Ticket rule A
  // genuinely resolved the m.7 (78→80) and m.17 (213→215) tuck grazes, and
  // the §5 geometry pass seats the five slot systems and clears the mm57–64
  // sys15/16 overlap (+7.49pt gap) — leaving zero findings, every item
  // genuinely resolved. (The historical m.24/m.44 stem tucks 326/325 and
  // 612/611 retired with the §4 hand correction: 326/612 are RH now, stems
  // up, and the tuck rule itself is pinned synthetically in the linter
  // suite.)
  const keyOf = (v: { code: string; system?: number; measure?: number; noteIds?: string[] }): string =>
    [v.code, v.system ?? '', v.measure ?? '', ...(v.noteIds ?? [])].join('|');
  const full = lintJankoScore(BRAHMS, O_FULL, T_BRAHMS);
  assert.equal(full.violations.length, 0, 'full card: clean');
  assert.equal(full.warnings.length, 0);
  assert.deepEqual(full.violations.map(keyOf), [], 'full card: no finding identities remain');
  assert.ok(
    full.violations.every((v) => v.measure !== 7 && v.measure !== 17),
    'the rule-A m.7/m.17 pair is resolved, not recaptured'
  );
  const none = lintJankoScore(BRAHMS, O_NONE, T_BRAHMS);
  assert.equal(none.warnings.length, 0, 'none card: no warnings');
  assert.deepEqual(
    none.violations.map(keyOf),
    full.violations.map(keyOf),
    'none card: same finding identities and sites as the full card'
  );
});

test('Round 33 settled refinements ride on both cards (m7 slots, dots, rest, ottava)', () => {
  for (const [label, o] of [
    ['full', O_FULL],
    ['none', O_NONE],
  ] as const) {
    const layout = layoutJankoScore(BRAHMS, o, T_BRAHMS);
    // m. 7 (tick 1200): the ordinary ninth pair seats adjacent — lower
    // CENTER / higher RIGHT (compact) — the three clear heads hold CENTER,
    // and the main-column upper head carries the shared stem.
    const s1 = layout[1];
    const m7 = s1.notes.filter((p) => p.note.startTick === 1200 && p.rhythm.hand === 'RH');
    assert.equal(m7.length, 5, `${label}: m. 7 RH five`);
    const col = s1.columns.get(1200)!;
    const byX = [...m7].sort((a, b) => a.x - b.x);
    assert.ok(Math.abs(byX[0].x - col) < 1e-6, `${label}: lower head CENTER`);
    assert.ok(Math.abs(byX[4].x - (col + 5.46)) < 1e-6, `${label}: higher head RIGHT`);
    assert.ok(
      byX.slice(1, 4).every((p) => Math.abs(p.x - col) < 1e-6),
      `${label}: the lower plus the clear three on the column`
    );
    const carrier = s1.sharedStems.find((g) => g.tick === 1200);
    assert.equal(carrier?.carrierId, 'brahms-op118-no1-82', `${label}: upper RH head carries`);
    // Opening bracket dot (tick 48) sits at 45° like its m.19 twin (rule B).
    const m1 = layout.flatMap((s) => s.clasps).find((c) => c.tick === 48)!;
    assert.ok(m1, `${label}: m.1 dotted clasp present`);
    const dot = m1.durationDots.filter((d) => d !== null)[0]!;
    const ink = m1.durationInk[m1.durationDots.indexOf(dot)];
    const angle = (Math.atan2(-(dot.y - ink.centerY), dot.x - m1.claspX) * 180) / Math.PI;
    assert.ok(Math.abs(angle - 45) < 1e-9, `${label}: m.1 dot at 45° (rule B)`);
    // m.2 LH rest (tick 384) seats exactly on the preceding lower-E3 level
    // (rule D): the seat y equals the E3 head y bit-for-bit — no
    // interpolation toward the next measure.
    const rest = layout.flatMap((s) => s.rests).find((r) => r.tick === 384 && r.hand === 'LH')!;
    assert.ok(rest, `${label}: m.2 LH rest written`);
    const e3 = layout
      .flatMap((s) => s.notes)
      .find((p) => p.note.id === 'brahms-op118-no1-16')!;
    assert.equal(rest.y, e3.y, `${label}: m.2 rest on the lower-E3 level (rule D)`);
    // Ottava spanners (rule C): the 4-per packing folds nine runs, each with
    // its numeral+line+hook; the first spans note 47 in system 2.
    const brackets = layout.flatMap((s) => s.ottavaBrackets);
    assert.equal(brackets.length, 9, `${label}: nine ottava runs (rule C)`);
    assert.deepEqual(brackets[0].noteIds, ['brahms-op118-no1-47'], `${label}: first run over note 47`);
    assert.equal(brackets[0].kind, 'down10', `${label}: first run is down10`);
  }
  // Deeper rule pins (slot unit theory, dot daylight, ottava scale/ink,
  // rest fallbacks) live in the shared-rules suite; both cards resolve
  // through the same canonical engine, so byte-equal geometry (§3) proves
  // both carry them.
});

// ---------------------------------------------------------------------------
// 5. Candidates view (HISTORICAL config): parked cards render 2 × 6
// ---------------------------------------------------------------------------

test('The parked Round 33 cards render two grid cards, Brahms-only', () => {
  const html = renderCandidatesView(CONFIG_33);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 2, 'two cards');
  assert.match(html, /data-candidate-count="2"/);
  assert.match(html, /data-window-count="12"/, '2 cards × 6 windows');
  assert.match(html, /data-verification="false"/, 'the grid round is decisive');
  assert.match(html, /2 candidates × 12 engraving windows/);
  assert.match(html, /Round 33/);
  assert.ok(!html.includes('data-window="primary:'), 'Bach carries no window this round');
  assert.equal((html.match(/data-window="brahms-op118-no1:/g) ?? []).length, 12, 'Brahms ×12');
  assert.ok(!html.includes('data-candidate="control"'), 'no control card');
});

// ---------------------------------------------------------------------------
// 6. R33 decided by convention (live registry moved to Round 34)
// ---------------------------------------------------------------------------
// Round 33 is judged (full grid canonical) and its live registry pins moved
// to the Round 34 suite with the newly opened m.33 comparison. This suite
// keeps the historical consts and every canonical assertion; it carries no
// live-registry pins (see the R33 parking record in test/janko-round34.test.ts).

test('R33 parked: historical consts in this suite, registry carries the record', () => {
  const suite = read('test/janko-round33.test.ts');
  assert.ok(suite.includes('ROUND_33_METADATA'), 'the historical metadata const is parked');
  assert.ok(suite.includes('ROUND_33_CANDIDATES'), 'the historical card consts are parked');
  assert.match(suite, /Historical Round 33/, 'the parking record names the round');
  assert.match(
    read('src/render/janko/candidates.ts'),
    /Round 33 is decided|full grid is selected/,
    'the registry carries the decided record'
  );
});

// ---------------------------------------------------------------------------
// 7. R32 parked by convention (reversible, nothing lost)
// ---------------------------------------------------------------------------

test('R32 parked: historical consts in the round-32 suite, registry carries the record', () => {
  const suite = read('test/janko-round32.test.ts');
  assert.ok(suite.includes('ROUND_32_METADATA'), 'the historical metadata const is parked');
  assert.ok(suite.includes('ROUND_32_CANDIDATES'), 'the historical card consts are parked');
  assert.match(suite, /[Hh]istorical Round 32/, 'the parking record names the round');
  assert.ok(!suite.includes('CURRENT_CANDIDATES'), 'no live-registry card assertions remain');
  assert.ok(!suite.includes('CURRENT_ROUND_METADATA'), 'no live-registry metadata assertions remain');
  assert.match(
    read('src/render/janko/candidates.ts'),
    /Round 32 is parked/,
    'the registry carries the parking record'
  );
});
