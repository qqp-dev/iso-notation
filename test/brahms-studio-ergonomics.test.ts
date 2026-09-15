/**
 * Brahms studio ergonomics + title block (directed fixes, no round).
 * ================================================================
 *
 * Operator orders, implemented and pinned here:
 *  1. Reference view: BRONZE Brahms block FIRST, GOLD Bach block BELOW;
 *     Bach focus crops dropped (count 0), Brahms crops unchanged.
 *  2. Brahms four systems per page — LANDED BY OPERATOR OVERRIDE (see below).
 *  3. Title block: composer right-only, title fits, Bach frozen (hash).
 *
 * Section 2 record (LANDED 4-up — the operator overrode the fit gate:
 * "We'll fix the problems after I see them"). Brahms lays out as 24
 * systems (71 measures: (13632 − 48) / 192 = 70.75 → 71; ceil(71 / 3)
 * = 24) over 6 pages (ceil(24 / 4)). The page slot is 183.97pt (body
 * 735.89 / 4) and the breakage below ships RECORDED as known-accepted,
 * fixed NEVER here — the fix pass is directed from the eyeball review:
 *  - adaptive (the CLI gate — RED by operator order): 2 `system-slot-
 *    overlap` findings. System 23's furniture runs +1.41pt past its
 *    slot bottom, and REAL full-ink overlap — system 24's ink reaches
 *    y=621.62 into system 23's beam ink (bottom y=638.44), gap
 *    −16.83pt. `lint:engraving --strict` red-on-Brahms is expected.
 *  - fixed-3 (the studio surface): 9 findings, ZERO visual ink overlap
 *    (no same-page pair collides — proven by the absence of the
 *    ink-overlap flavor): the 4 known folding findings (sys 3, 6, 8,
 *    15 — sites unchanged from 3-up) plus 5 slot-accounting findings
 *    (sys 2 bottom +2.01, sys 6 bottom +2.01, sys 11 top +4.41, sys 18
 *    top +4.41, sys 21 top +9.41). The BRONZE chip reads 9.
 * The pins below record the arithmetic (with proof), the itemized
 * breakage, the single-source surfaces agreement, and the slot-0
 * anacrusis mechanism (10 systems re-resolve X — measured, not fixed).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_MEASURES,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  BRAHMS_OP118_NO1_TOTAL_TICKS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computePageGeometry,
  countJankoPages,
  countJankoSystems,
  getSystemGeometry,
  layoutJankoScore,
  renderJankoPage,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  BRAHMS_STUDIO_CROPS,
  createStudioConfig,
  renderReferenceView,
} from '../src/render/janko/studio';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BRAHMS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const read = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');

/** One score's Reference block, sliced order-independently (the order itself is under test). */
function referenceBlock(html: string, scoreId: string): string {
  const at = html.indexOf(`data-score="${scoreId}"`);
  assert.ok(at >= 0, `reference block ${scoreId} renders`);
  const next = html.indexOf('data-score="', at + 1);
  return next >= 0 ? html.slice(at, next) : html.slice(at);
}

// ---------------------------------------------------------------------------
// 1. Reference order: Brahms FIRST, Bach BELOW; Bach crops gone
// ---------------------------------------------------------------------------

test('Reference view leads with BRONZE Brahms, GOLD Bach below, badges intact', () => {
  const html = renderReferenceView(createStudioConfig());
  const brahmsAt = html.indexOf('data-score="brahms-op118-no1"');
  const bachAt = html.indexOf('data-score="primary"');
  assert.ok(brahmsAt >= 0 && bachAt >= 0, 'both reference blocks render');
  assert.ok(brahmsAt < bachAt, 'Brahms block precedes the Bach block (Brahms is live)');
  assert.match(html, /BRONZE · active surface/, 'the BRONZE badge survives the move');
  assert.match(html, /GOLD · frozen standard/, 'the GOLD badge survives the move');
});

test('Bach carries no focus crops; Brahms crops unchanged in content', () => {
  const html = renderReferenceView(createStudioConfig());
  const brahms = referenceBlock(html, 'brahms-op118-no1');
  const bach = referenceBlock(html, 'primary');
  assert.equal(bach.match(/data-crop="/g)?.length ?? 0, 0, 'Bach crops dropped (visual weight)');
  assert.ok(!bach.includes('Macro focus crops'), 'no empty crops section weighs on the Bach block');
  const brahmsCrops = brahms.match(/data-crop="/g) ?? [];
  assert.equal(brahmsCrops.length, 3, 'Brahms keeps its three macro crops');
  assert.deepEqual(
    BRAHMS_STUDIO_CROPS.map((c) => c.title),
    ['mm. 1–2 · Upbeat and downbeat', 'mm. 5–6 · First fold', 'mm. 7–8 · Chords and the first known finding'],
    'Brahms crop content unchanged (crops frame measures, not pages — 4-up needs no re-aim)'
  );
  for (const crop of BRAHMS_STUDIO_CROPS) {
    assert.ok(
      brahms.includes(`data-crop="${crop.start}-${crop.start + crop.count - 1}"`),
      `Brahms crop ${crop.title}`
    );
  }
  assert.ok(brahms.includes('Macro focus crops'), 'the Brahms crops section stays');
});

// ---------------------------------------------------------------------------
// 2. Pagination: 4-up LANDED (operator override) — arithmetic with proof
// ---------------------------------------------------------------------------

test('Brahms pagination arithmetic: 71 measures → 24 systems → 6 pages at 4-up', () => {
  // The measure count from the MIDI's own ticks (upbeat + 70 full cut-time
  // measures + the closing 144-tick measure = 71 × 192 = 13632).
  assert.equal(BRAHMS_OP118_NO1_TOTAL_TICKS, 13632);
  assert.equal(BRAHMS_OP118_NO1_TICKS_PER_MEASURE, 192);
  assert.equal(BRAHMS_OP118_NO1_MEASURES, 71);
  assert.equal(
    Math.ceil((BRAHMS_OP118_NO1_TOTAL_TICKS - 48) / BRAHMS_OP118_NO1_TICKS_PER_MEASURE),
    71,
    '(13632 − 48) / 192 = 70.75 → 71 measures'
  );
  assert.equal(O_BRAHMS.measuresPerSystem, 3);
  assert.equal(countJankoSystems(BRAHMS, O_BRAHMS, T_BRAHMS), 24, 'ceil(71 / 3) = 24 systems');
  // The page-slot proof: every body-height component, then the quotient.
  assert.equal(O_BRAHMS.pageHeight, 841.89, 'A4 height');
  assert.equal(O_BRAHMS.pageMarginTop, 30);
  assert.equal(O_BRAHMS.pageMarginBottom, 14);
  assert.equal(O_BRAHMS.headerHeight, 48);
  assert.equal(O_BRAHMS.footerHeight, 14);
  const geo = computePageGeometry(O_BRAHMS, T_BRAHMS, BRAHMS);
  assert.equal(geo.bodyHeight.toFixed(2), '735.89', '841.89 − 30 − 14 − 48 − 14 = 735.89');
  assert.equal(O_BRAHMS.systemsPerPage, 4, '4-up landed by operator override (was 3)');
  assert.equal(geo.slotHeight.toFixed(2), '183.97', '735.89 / 4 = 183.97');
  assert.equal(Math.ceil(24 / O_BRAHMS.systemsPerPage), 6, '24 systems at 4-up = 6 pages');
  assert.equal(countJankoPages(BRAHMS, O_BRAHMS, T_BRAHMS), 6, 'the engine pages 6 (ceil(71 / 12))');
  assert.deepEqual(createStudioConfig().brahmsPages, [0, 1, 2, 3, 4, 5], 'the studio spreads 6');
  const html = renderReferenceView(createStudioConfig());
  const brahms = referenceBlock(html, 'brahms-op118-no1');
  assert.equal(brahms.match(/data-page="/g)?.length ?? 0, 6, 'the Reference spread shows all 6 Brahms pages');
});

test('Brahms §2-landed record: adaptive 2 + fixed-3 9, itemized, zero fixes', () => {
  // The operator-accepted breakage, every item with proof. If ANY assertion
  // flips, the fit picture changed — re-measure §2, do not re-pin blindly.
  // --- Adaptive = the CLI gate configuration, spread exactly as the script does.
  const adaptive = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
  const cli = lintJankoScore(BRAHMS, adaptive, T_BRAHMS);
  assert.equal(cli.ok, false, 'red-on-Brahms is the expected, operator-accepted state');
  assert.equal(cli.warnings.length, 0, 'zero warnings');
  assert.equal(cli.violations.length, 2, 'exactly the two accepted slot findings (was 0/0 at 3-up)');
  const [fit23, overlap24] = cli.violations;
  assert.equal(fit23.code, 'system-slot-overlap');
  assert.equal(fit23.system, 22, 'system 23 (0-based 22)');
  assert.equal(
    fit23.message,
    "System 23's staff furniture spans y=[452.54, 630.32], outside its 183.97pt page slot " +
      '[445.94, 629.92] (1.00pt clearance).'
  );
  const m23 = fit23.metrics!;
  assert.ok(m23.inkTop >= m23.slotTop + m23.required, 'sys 23: top edge clears its slot');
  assert.equal(
    (m23.inkBottom - (m23.slotBottom - m23.required)).toFixed(2),
    '1.41',
    'sys 23: bottom-side deficit +1.41pt (metrics-exact; the 2dp message rounds to 1.40)'
  );
  assert.equal(overlap24.code, 'system-slot-overlap');
  assert.equal(overlap24.system, 23, 'system 24 (0-based 23)');
  assert.equal(
    overlap24.message,
    "System 24's ink reaches up to y=621.62, into system 23's ink (bottom y=638.44): " +
      'the two systems overlap on the page.'
  );
  assert.equal(
    (overlap24.metrics!.lowerTop - overlap24.metrics!.upperBottom).toFixed(2),
    '-16.83',
    'sys 24 head ink into sys 23 beam ink: gap −16.83pt (re-measured live)'
  );
  // --- Fixed-3 = the studio surface: the itemized 9, zero visual ink overlap.
  const studio = lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  assert.equal(studio.ok, false, 'the BRONZE surface is honestly not-ok');
  assert.equal(studio.warnings.length, 0, 'zero warnings');
  assert.equal(studio.violations.length, 9, 'the BRONZE chip reads 9 (was 4 at 3-up)');
  const folding = studio.violations.filter((v) => v.code === 'stem-through-simultaneity');
  const slots = studio.violations.filter((v) => v.code === 'system-slot-overlap');
  assert.equal(folding.length, 4, 'the 4 known folding findings survive the flip');
  assert.deepEqual(
    folding.map((v) => v.system + 1),
    [3, 6, 8, 15],
    'folding sites unchanged from 3-up'
  );
  assert.deepEqual(
    folding.map((v) => v.measure),
    [7, 17, 24, 44],
    'folding measures unchanged from 3-up'
  );
  assert.equal(slots.length, 5, 'the 5 accepted slot-accounting findings');
  for (const v of slots) {
    assert.match(v.message, /staff furniture spans/, `sys ${v.system + 1}: accounting flavor`);
    assert.ok(
      !/overlap on the page/.test(v.message),
      `sys ${v.system + 1}: no ink-overlap flavor — nothing visibly collides`
    );
  }
  const expected: Array<[number, 'top' | 'bottom', string]> = [
    [2, 'bottom', '2.01'],
    [6, 'bottom', '2.01'],
    [11, 'top', '4.41'],
    [18, 'top', '4.41'],
    [21, 'top', '9.41'],
  ];
  for (const [sys, side, deficit] of expected) {
    const v = slots.find((s) => s.system + 1 === sys)!;
    assert.ok(v, `system ${sys} slot finding recorded`);
    const m = v.metrics!;
    const topDeficit = m.slotTop + m.required - m.inkTop;
    const botDeficit = m.inkBottom - (m.slotBottom - m.required);
    if (side === 'top') {
      assert.ok(botDeficit <= 0, `sys ${sys}: bottom edge clears its slot`);
      assert.equal(topDeficit.toFixed(2), deficit, `sys ${sys}: top-side deficit +${deficit}pt`);
    } else {
      assert.ok(topDeficit <= 0, `sys ${sys}: top edge clears its slot`);
      assert.equal(botDeficit.toFixed(2), deficit, `sys ${sys}: bottom-side deficit +${deficit}pt`);
    }
  }
  assert.deepEqual(
    slots.map((v) => v.message),
    [
      "System 2's staff furniture spans y=[276.06, 446.96], outside its 183.97pt page slot [261.97, 445.94] (1.00pt clearance).",
      "System 6's staff furniture spans y=[293.56, 446.96], outside its 183.97pt page slot [261.97, 445.94] (1.00pt clearance).",
      "System 11's staff furniture spans y=[442.53, 615.93], outside its 183.97pt page slot [445.94, 629.92] (1.00pt clearance).",
      "System 18's staff furniture spans y=[258.56, 421.96], outside its 183.97pt page slot [261.97, 445.94] (1.00pt clearance).",
      "System 21's staff furniture spans y=[69.59, 237.99], outside its 183.97pt page slot [78.00, 261.97] (1.00pt clearance).",
    ],
    'the exact fixed-3 slot list the operator sees in Diagnostics'
  );
  // --- The chip reads the itemized 9.
  const html = renderReferenceView(createStudioConfig());
  const brahms = referenceBlock(html, 'brahms-op118-no1');
  assert.match(brahms, /✗ 9 violations/, 'the BRONZE chip reads the itemized 9');
  assert.match(brahms, /<summary>Diagnostics \(9\)<\/summary>/, 'all 9 listed, none hidden');
  assert.ok(
    !brahms.includes('known-note') && !brahms.includes('known-finding'),
    'mixed codes degrade honestly: no known tags (they return when the fix pass clears the slot findings)'
  );
});

test('Brahms pagination has one source of truth; every surface agrees', () => {
  const config = createStudioConfig();
  const studioBrahms = config.scores['brahms-op118-no1'].options;
  assert.equal(studioBrahms.systemsPerPage, O_BRAHMS.systemsPerPage, 'studio reads the score options');
  assert.equal(studioBrahms.measuresPerSystem, O_BRAHMS.measuresPerSystem);
  assert.equal(studioBrahms.ticksPerMeasure, O_BRAHMS.ticksPerMeasure);
  // The lint CLI spreads the same const; reconstruct its spread exactly.
  const cliBrahms = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
  assert.equal(cliBrahms.systemsPerPage, 4, 'the CLI spread carries the 4-up flip');
  assert.match(
    read('scripts/lint_engraving.ts'),
    /\.\.\.BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive'/,
    'the CLI spreads the const — no private pagination'
  );
  // The engine agrees with the studio on the page count, from the const alone.
  assert.equal(
    countJankoPages(BRAHMS, O_BRAHMS, T_BRAHMS),
    config.brahmsPages.length,
    'engine and studio page counts agree (6)'
  );
  assert.equal(O_BRAHMS.systemsPerPage, 4);
  // Sheet + print never consume Brahms pagination, so there is nothing to
  // disagree: the Sheet/Play views hardcode the golden defaults over
  // Bach-only scores, print runs the duodecimal engine, the PDF is Bach-only.
  assert.ok(!read('src/ui/JankoPages.tsx').includes('BRAHMS'), 'sheet hardcodes the golden defaults');
  assert.ok(!read('src/ui/Landing.tsx').includes('brahms'), 'the app never loads Brahms (Bach + uploads)');
  assert.ok(
    read('scripts/print-score.ts').includes('computeColumnarLayout'),
    'print runs the duodecimal engine'
  );
  assert.ok(!read('scripts/print-score.ts').includes('systemsPerPage'), 'print knows no Jankó pagination');
  assert.match(
    read('scripts/export-pdf.ts'),
    /const SCORE_ID = 'bach-goldberg-var1'/,
    'the PDF export is Bach-only'
  );
});

test('Brahms option diff is pagination/meter/title-data only — rows/ink/grammar identical', () => {
  const brahms = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const allowed = new Set([
    'ticksPerMeasure',
    'anacrusisTicks',
    'measuresPerSystem',
    'systemsPerPage',
    'title',
    'subtitle',
    'composer',
  ]);
  for (const key of Object.keys(golden) as Array<keyof typeof golden>) {
    if (allowed.has(key)) continue;
    assert.deepEqual(
      brahms[key],
      golden[key],
      `Brahms layout option ${key} equals the golden master (rows/ink/grammar identical)`
    );
  }
  const brahmsT = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const goldenT = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const allowedT = new Set(['ticksPerMeasure', 'anacrusisTicks']);
  for (const key of Object.keys(goldenT) as Array<keyof typeof goldenT>) {
    if (allowedT.has(key as string)) continue;
    assert.deepEqual(brahmsT[key], goldenT[key], `Brahms token ${key} equals the golden master`);
  }
});

test('Reference completeness: Brahms systems 1–24 each render exactly once across the 6-page spread', () => {
  const seen = new Map<number, number>();
  const perPage: number[] = [];
  for (let page = 0; page < 6; page++) {
    const svg = renderJankoPage(BRAHMS, page, O_BRAHMS, T_BRAHMS);
    const ids = [...svg.matchAll(/id="system-(\d+)"/g)].map((m) => Number(m[1]));
    perPage.push(ids.length);
    assert.match(svg, new RegExp(`Page ${page + 1} of 6`), `page ${page + 1} footer counts 6`);
    for (const n of ids) {
      seen.set(n, (seen.get(n) ?? 0) + 1);
    }
  }
  assert.deepEqual(perPage, [4, 4, 4, 4, 4, 4], '4 systems on every page (was 3 × 8)');
  assert.equal(seen.size, 24, 'all 24 systems render somewhere');
  for (let n = 1; n <= 24; n++) {
    assert.equal(seen.get(n), 1, `system ${n} renders exactly once`);
  }
});

test('Slot-0 anacrusis mechanism: 10 systems re-resolve X at 4-up (measured, not fixed)', () => {
  // Pre-existing engine behavior in every computePageGeometry branch: the
  // anacrusis-narrowed measureWidth (staffWidth / 3.25) applies to SLOT 0,
  // not SYSTEM 0 — whichever systems land in slot 0 engrave narrow. The
  // flip moves the narrow set; the 10 systems whose slot-0 membership
  // changed re-resolve X as a pure measure-width scaling. Recorded for the
  // eyeball pass; re-scoping to system 0 is the fix pass's call, not this
  // ticket's (ZERO fixes).
  const o3 = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, systemsPerPage: 3 });
  const g3 = computePageGeometry(o3, T_BRAHMS, BRAHMS);
  const g4 = computePageGeometry(O_BRAHMS, T_BRAHMS, BRAHMS);
  const narrowOf = (g: ReturnType<typeof computePageGeometry>): number[] => {
    const out: number[] = [];
    for (let s = 0; s < 24; s++) {
      if (getSystemGeometry(g, s).measureWidth < 181) out.push(s + 1);
    }
    return out;
  };
  assert.deepEqual(narrowOf(g3), [1, 4, 7, 10, 13, 16, 19, 22], '3-up narrow set (retired)');
  assert.deepEqual(narrowOf(g4), [1, 5, 9, 13, 17, 21], '4-up narrow set (live)');
  assert.equal(getSystemGeometry(g4, 0).measureWidth.toFixed(2), '167.22', 'narrow = 543.48 / 3.25');
  assert.equal(getSystemGeometry(g4, 1).measureWidth.toFixed(2), '181.16', 'full = 543.48 / 3');
  const changed = [4, 5, 7, 9, 10, 16, 17, 19, 21, 22];
  for (const core of ['fixed-3', 'adaptive'] as const) {
    const a = layoutJankoScore(
      BRAHMS,
      { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core, systemsPerPage: 3 },
      T_BRAHMS
    );
    const b = layoutJankoScore(BRAHMS, { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core }, T_BRAHMS);
    const ax = new Map(a.flatMap((s) => s.notes.map((p) => [p.note.id, { x: p.x, sys: s.index }] as const)));
    const bx = new Map(b.flatMap((s) => s.notes.map((p) => [p.note.id, p.x] as const)));
    const movedSystems = new Set<number>();
    let moved = 0;
    for (const [id, { x, sys }] of ax) {
      if (bx.get(id) !== x) {
        moved++;
        movedSystems.add(sys + 1);
      }
    }
    assert.deepEqual(
      [...movedSystems].sort((x, y) => x - y),
      changed,
      `${core}: exactly the 10 re-slotted systems move in X`
    );
    assert.equal(moved, 357, `${core}: 357 heads re-resolve X (600 bit-identical)`);
  }
  // The move is a pure measure-width scaling: dx is linear in the
  // within-measure offset (system 4, m. 10 starts at tick 1776).
  const a4 = layoutJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3', systemsPerPage: 3 },
    T_BRAHMS
  );
  const b4 = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const xOf = (id: string): [number, number] => [
    a4.flatMap((s) => s.notes).find((p) => p.note.id === id)!.x,
    b4.flatMap((s) => s.notes).find((p) => p.note.id === id)!.x,
  ];
  const deltaW =
    getSystemGeometry(g4, 3).measureWidth - getSystemGeometry(g3, 3).measureWidth;
  const k = deltaW / 192;
  for (const [id, tick] of [
    ['brahms-op118-no1-131', 1800],
    ['brahms-op118-no1-132', 1824],
    ['brahms-op118-no1-136', 1920],
  ] as const) {
    const [x3, x4] = xOf(id);
    const dx = x4 - x3;
    assert.ok(
      Math.abs(dx / (tick - 1776) - k) < 1e-9,
      `${id}: dx follows the width-scaling law (dx=${dx.toFixed(2)})`
    );
  }
  assert.equal((xOf('brahms-op118-no1-131')[1] - xOf('brahms-op118-no1-131')[0]).toFixed(2), '1.74');
  assert.equal((xOf('brahms-op118-no1-138')[1] - xOf('brahms-op118-no1-138')[0]).toFixed(2), '13.94');
});

// ---------------------------------------------------------------------------
// 3. Title block: composer right-only, title fits, Bach frozen
// ---------------------------------------------------------------------------
//
// Measurement table (Liberation Serif Italic v2.1.5, UPM 2048 — first in the
// URTEXT_SERIF stack; advances exact, kern pairs fire nowhere in these
// strings; em-dash 0.8892em is the widest glyph, everything else ≤ 0.7222em):
//   space/,/. 0.2500 · 1/6/8 0.5000 · A 0.6108 · B 0.6108 · C 0.6670 ·
//   I 0.3330 · J 0.4438 · K 0.6670 · N 0.6670 · O 0.7222 · S 0.5000 ·
//   V 0.6108 · a 0.5000 · b 0.5000 · c/e/k/v 0.4438 · g/h/n/o/p/u/ü 0.5000 ·
//   i/l/t 0.2778 · m 0.7222 · r/s/z 0.3892 · : 0.3330 · · 0.2500 · — 0.8892
// The widths below re-derive from the LIVE option strings, so a future edit
// that re-breaks the fit fails here — an unlisted glyph throws loudly
// (extend the table from the same font file, never guess).

/** Measured advance (em) of every glyph in the title-block strings. */
const ITALIC_ADVANCE_EM: Record<string, number> = {
  ' ': 0.25, ',': 0.25, '.': 0.25, '1': 0.5, '6': 0.5, '8': 0.5,
  A: 0.6108, B: 0.6108, C: 0.667, I: 0.333, J: 0.4438, K: 0.667, N: 0.667,
  O: 0.7222, S: 0.5, V: 0.6108, a: 0.5, b: 0.5, c: 0.4438, e: 0.4438,
  g: 0.5, h: 0.5, i: 0.2778, k: 0.4438, l: 0.2778, m: 0.7222, n: 0.5,
  o: 0.5, p: 0.5, r: 0.3892, s: 0.3892, t: 0.2778, u: 0.5, v: 0.4438,
  z: 0.3892, 'ü': 0.5, ':': 0.333, '·': 0.25, '—': 0.8892,
};

/** Advance width (pt) of a string at a size, from the measured table. */
function measuredWidthPt(text: string, sizePt: number): number {
  let em = 0;
  for (const ch of text) {
    const adv = ITALIC_ADVANCE_EM[ch];
    assert.ok(adv !== undefined, `unmeasured glyph ${JSON.stringify(ch)} — extend ITALIC_ADVANCE_EM from Liberation Serif Italic v2.1.5`);
    em += adv;
  }
  return em * sizePt;
}

interface HeaderText {
  x: number;
  y: number;
  cls: string;
  anchor: string;
  text: string;
}

/** The actual rendered header texts of a page SVG (proofread against the SVG, not the options). */
function headerTexts(svg: string): HeaderText[] {
  const header = /<g id="page-header">[\s\S]*?<\/g>/.exec(svg);
  assert.ok(header, 'page carries a page-header group');
  const out: HeaderText[] = [];
  const re = /<text x="([\d.]+)" y="([\d.]+)" class="([^"]+)"(?: text-anchor="([^"]+)")?>([^<]*)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(header[0])) !== null) {
    out.push({ x: Number(m[1]), y: Number(m[2]), cls: m[3], anchor: m[4] ?? 'start', text: m[5] });
  }
  return out;
}

test('Brahms title data: composer out of the title, subtitle trimmed, tempo kept at the model', () => {
  assert.equal(O_BRAHMS.title, '6 Klavierstücke, Op. 118', 'no composer prefix up top');
  assert.equal(
    O_BRAHMS.subtitle,
    'No. 1. Intermezzo in A minor — Allegro non assai',
    'subtitle trimmed to fit; the full marking survives in score.tempos'
  );
  assert.equal(O_BRAHMS.composer, 'Johannes Brahms');
  assert.match(
    BRAHMS.tempos?.[0]?.description ?? '',
    /Allegro non assai, ma molto appassionato/,
    'the full tempo marking is lossless at the model level'
  );
});

test('Brahms p0: composer appears ONCE, right-aligned (common practice)', () => {
  const svg = renderJankoPage(BRAHMS, 0, O_BRAHMS, T_BRAHMS);
  const texts = headerTexts(svg);
  const composers = texts.filter((t) => t.cls === 'janko-meta');
  assert.equal(composers.length, 1, 'exactly one composer node');
  assert.equal(composers[0].anchor, 'end', 'right-aligned');
  assert.equal(composers[0].x, 575.28, 'x = pageWidth − marginRight (595.28 − 20)');
  assert.equal(composers[0].text, 'Johannes Brahms');
  const brahmsMentions = texts.filter((t) => t.text.includes('Brahms')).length;
  assert.equal(brahmsMentions, 1, 'no second composer hiding in the title or subtitle');
  const title = texts.find((t) => t.cls === 'janko-title');
  assert.ok(title, 'title node renders');
  assert.equal(title.anchor, 'middle', 'title stays centered');
  assert.equal(title.text, '6 Klavierstücke, Op. 118');
});

test('Brahms p0: subtitle and composer boxes are disjoint with air to spare', () => {
  const svg = renderJankoPage(BRAHMS, 0, O_BRAHMS, T_BRAHMS);
  const texts = headerTexts(svg);
  const subtitle = texts.find((t) => t.cls === 'janko-subtitle');
  const composer = texts.find((t) => t.cls === 'janko-meta');
  assert.ok(subtitle && composer, 'both same-baseline nodes render');
  assert.equal(subtitle.y, composer.y, 'the pair under test shares the y=57 baseline');
  const subRight = subtitle.x + measuredWidthPt(subtitle.text, 8.5) / 2;
  const compLeft = composer.x - measuredWidthPt(composer.text, 8);
  const REQUIRED_AIR = 8;
  assert.ok(
    subRight + REQUIRED_AIR <= compLeft,
    `subtitle right edge (${subRight.toFixed(2)}) keeps ${REQUIRED_AIR}pt air before the composer left edge (${compLeft.toFixed(2)})`
  );
  // The ticket's effect, visible: the retired 71-char subtitle held 93.6pt
  // of air (no literal overlap in the reference stack — the fault was the
  // duplication plus fallback fragility); the new string must beat it well.
  const OLD_SUBTITLE = 'No. 1. Intermezzo in A minor — Allegro non assai, ma molto appassionato';
  const oldRight = subtitle.x + measuredWidthPt(OLD_SUBTITLE, 8.5) / 2;
  assert.ok(
    compLeft - subRight >= (compLeft - oldRight) + 40,
    `new air (${(compLeft - subRight).toFixed(1)}pt) beats retired air (${(compLeft - oldRight).toFixed(1)}pt) by 40pt+`
  );
});

test('Brahms running head: composer once, fits the line', () => {
  const svg = renderJankoPage(BRAHMS, 1, O_BRAHMS, T_BRAHMS);
  const texts = headerTexts(svg);
  assert.equal(texts.length, 1, 'later pages carry only the running head');
  assert.equal(texts[0].cls, 'janko-running-head');
  assert.equal(
    texts[0].text,
    'Johannes Brahms · 6 Klavierstücke, Op. 118 · No. 1. Intermezzo in A minor — Allegro non assai'
  );
  assert.equal(texts[0].text.match(/Brahms/g)?.length ?? 0, 1, 'composer once in the running head');
  const end = texts[0].x + measuredWidthPt(texts[0].text, 7);
  assert.ok(end <= 575.28 - 8, `running head ends at ${end.toFixed(2)}, inside the right margin with air`);
});

test('Bach p0 title block is byte-identical (GOLD, frozen) — hash pin', () => {
  const svg = renderJankoPage(BACH, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const header = /<g id="page-header">[\s\S]*?<\/g>/.exec(svg);
  assert.ok(header, 'Bach p0 carries a page-header group');
  const hash = createHash('sha256').update(header[0], 'utf8').digest('hex');
  assert.equal(
    hash,
    '92261abcfa82e57083ea1b739a7cd17513a8023b2c11ddcb610082dd4fce924e',
    'Bach p0 title block byte-identity — fails on ANY drift'
  );
  // The shared renderer is exonerated: Bach's pair clears by 167pt, so the
  // Brahms fault was data, never the renderer.
  const texts = headerTexts(svg);
  const subtitle = texts.find((t) => t.cls === 'janko-subtitle');
  const composer = texts.find((t) => t.cls === 'janko-meta');
  assert.ok(subtitle && composer);
  const subRight = subtitle.x + measuredWidthPt(subtitle.text, 8.5) / 2;
  const compLeft = composer.x - measuredWidthPt(composer.text, 8);
  assert.ok(subRight + 8 <= compLeft, `Bach clears by ${(compLeft - subRight).toFixed(1)}pt`);
});
