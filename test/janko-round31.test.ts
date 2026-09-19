/**
 * Round 31 — Brahms bronze bootstrap (fixed-3 studio + GOLD/BRONZE + clasp preview).
 *
 *  1. Surface: the studio's Brahms is the fixed-3 golden (display-only — the
 *     defaults already carry fixed-3), whole-spread, GOLD/BRONZE badged, with
 *     its 9 violations displayed honestly (never gated, never hidden): the 4
 *     known folding findings (stem-through-simultaneity, sites unchanged)
 *     plus the 5 accepted 4-up slot-accounting findings. Mixed codes carry
 *     no known tags (the single-code rule degrades honestly); the itemized
 *     record lives in test/brahms-studio-ergonomics.test.ts (§2-landed).
 *  2. Preview: ONE card on the single `claspDotNudge` axis — bracket dots step
 *     (+0.4pt, +0.2pt), uniform across clasp dots, note dots byte-identical —
 *     framed on the two pinned white-ring dots (m.1 tick 48 + m.3 tick-432
 *     twin, which move identically).
 *  3. R30 parked by convention: the historical-const migration lives in
 *     `test/janko-round30.test.ts` (R28/R29 precedent); this file pins the
 *     parking record, and R30's engine/census/linter tests stay live.
 *
 * Two ticket predictions are superseded by measurement, and pinned as such:
 *  - the Brahms-wide moved-dot census is 12, not 2 (twelve dotted brackets
 *    under the fixed-3 golden; each card window still frames exactly 1);
 *  - the card chip is honestly red: whole-score card lint inherits the BRONZE
 *    surface's 9 knowns, and the nudge adds 0 (proven by lint equality).
 *
 * 4-up update (operator override): every count below moved with proof —
 * brahmsPages [0..7]→[0..5], spread 8→6 pages, chip ✗4→✗9, CLI 0/0→2
 * violations (accepted red), page loops 8→6, three exact floats re-pinned
 * to last-ulp dust. Old values quoted at each site.
 *
 * Canonical-packing update (Round 33 judged): brahmsPages [0..5]→[0..4],
 * spread 6→5 pages, the settled 8 cleared to 0/0 by the canonical geometry
 * pass, chip ✗8→✓ clean, adaptive CLI residual re-itemized at the final
 * pair (sys 17/18), page loops 6→5, bracket census 74→72 (ticks 12432 +
 * 12624 no longer fit). The dotted-18 set and the three exact floats are
 * bit-identical — stated, not re-derived.
 *
 * Round 32 parks this round by convention (R28/R29/R30 precedent): the
 * registry assertions below run on historical consts
 * (`ROUND_31_METADATA` / `ROUND_31_CANDIDATES`) while §§1–2 surface, census
 * and linter pins stay live on the explicit fixed-3 options.
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
  DEFAULT_STUDIO_SCORE_ID,
  JankoCandidate,
  JankoCandidateRound,
  type JankoScoreCandidateWindow,
  brahmsWindow,
  candidateBadges,
  resolveCandidate,
} from '../src/render/janko/candidates';
import { claspMarkDaylight } from '../src/render/janko/elements/rhythm';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoSystems,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  BRAHMS_STUDIO_CROPS,
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
/** The studio's Brahms golden: fixed-3, exactly as the defaults carry it. */
const O_BRAHMS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
/** The preview: fixed-3 golden plus the uniform situational nudge. */
const NUDGE_DX = 0.4;
const NUDGE_DY = 0.2;
const O_PREVIEW = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  claspDotNudge: [NUDGE_DX, NUDGE_DY],
});
const CONFIG = createStudioConfig({ score: BACH });

/** Historical Round 31 registry (parked by Round 32; R28/R29/R30 precedent). */
const ROUND_31_METADATA: JankoCandidateRound = {
  round: 31,
  title: 'Clasp-dot nudge: a little lower and to the right',
  description:
    'The approved situational nudge, previewed before any flip: every bracket-attached augmentation dot steps lower-right by the uniform vector (+0.4pt, +0.2pt) while every note dot stays byte-identical. The card frames the two pinned white-ring dots — the Brahms m.1 tick-48 dot and its m.3 tick-432 twin — which move identically; the Reference BRONZE Brahms is the standing control.',
  openAxes: ['claspDotNudge'],
};
const ROUND_31_CANDIDATES: JankoCandidate[] = [
  {
    id: 'round-31-clasp-nudge',
    label: 'Clasp dot lower-right',
    description:
      'Bracket dots step (+0.4pt, +0.2pt) — the approved situational nudge, uniform across clasp dots. The m.1 white-ring dot and its m.3 twin move identically; note dots are byte-identical. Adds no new findings: the card inherits the BRONZE surface\u2019s 4 known folding findings.',
    axis: 'claspDotNudge',
    options: { claspDotNudge: [0.4, 0.2] },
    windows: [
      brahmsWindow(
        1,
        2,
        'Brahms mm. 1–2 · the m.1 white-ring dot steps (+0.4pt, +0.2pt) lower-right'
      ),
      brahmsWindow(
        2,
        2,
        'Brahms mm. 2–3 · the m.3 downbeat twin steps the identical (+0.4pt, +0.2pt)'
      ),
    ],
  },
];
const CONFIG_31 = createStudioConfig({
  score: BACH,
  candidates: ROUND_31_CANDIDATES,
  round: ROUND_31_METADATA,
});

/**
 * Every dotted bracket under the fixed-3 golden (the 22-dot census).
 * Source correction (fixture 964) restores six dotted brackets whose
 * durations were shortened below dotted values (e.g. 126←144 dotted halves
 * at 3888/4656/7728/8496, final 144 chord ×2 hands at 13488). The §3 mode
 * rule adds five ([96,144,144] at 1776/3696/7536 and [120,144,144] at
 * 6192/10032 carry dotted 144, not the undotted min) and removes one (7344:
 * [144,192,192] carries the undotted 192 whole, not the dotted 144 min).
 */
const DOTTED_CLASP_TICKS = [
  48, 432, 1584, 1776, 1968, 2352, 3504, 3696, 3888, 4656, 5520, 5808, 6192, 7536,
  7728, 8496, 9360, 9648, 10032, 12720, 13488, 13488,
];

const read = (file: string): string => fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');

/** Split the Reference view into its Bach block and its Brahms block. */
function referenceBlocks(): { bach: string; brahms: string } {
  const html = renderReferenceView(CONFIG);
  const brahmsAt = html.indexOf(`data-score="${BRAHMS_STUDIO_SCORE_ID}"`);
  const bachAt = html.indexOf(`data-score="${DEFAULT_STUDIO_SCORE_ID}"`);
  assert.ok(brahmsAt > 0 && bachAt > 0, 'both reference blocks render');
  assert.ok(brahmsAt < bachAt, 'Brahms leads (ergonomics order)');
  return { bach: html.slice(bachAt), brahms: html.slice(brahmsAt, bachAt) };
}

/** `(cx, cy)` of every circle of one class in an SVG (2dp floats). */
function circlesOf(svg: string, cls: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = new RegExp(`<circle class="${cls}"[^>]*?cx="([\\d.]+)" cy="([\\d.]+)"`, 'g');
  for (const m of svg.matchAll(re)) out.push([Number(m[1]), Number(m[2])]);
  return out;
}

/** The visible rect of a crop SVG (`viewBox="x y w h"`). */
function viewBoxOf(svg: string): { x0: number; y0: number; x1: number; y1: number } {
  const m = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(m, 'the crop carries a viewBox');
  const [x, y, w, h] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
  return { x0: x, y0: y, x1: x + w, y1: y + h };
}

// ---------------------------------------------------------------------------
// 1. Surface: fixed-3 Brahms, whole spread, GOLD/BRONZE, honest knowns
// ---------------------------------------------------------------------------

test('Studio Brahms is the fixed-3 golden (display-only, no default change)', () => {
  const entry = CONFIG.scores[BRAHMS_STUDIO_SCORE_ID];
  assert.equal(entry.options.core, 'fixed-3', 'the studio Brahms runs the golden core');
  assert.equal(DEFAULT_JANKO_OPTIONS.core, 'fixed-3', 'the defaults already carry fixed-3');
  // No studio-side override of any key: the entry IS the benchmark options.
  assert.deepEqual(
    entry.options,
    resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
    'the studio adds no override — the fixed-3 switch is display-only'
  );
});

test('Whole-spread completeness: 5 Brahms pages tile mm. 1–71 exactly once', () => {
  assert.deepEqual(CONFIG.brahmsPages, [0, 1, 2, 3, 4], 'five pages (18 systems, 4/page; was [0..5])');
  assert.equal(countJankoSystems(BRAHMS, O_BRAHMS, T_BRAHMS), 18, '18 fixed-3 systems');
  const { brahms } = referenceBlocks();
  // Page-card captions only (crop titles and in-SVG crop captions also print
  // measure ranges, so the match is anchored on the page-card figcaption).
  const ranges = [
    ...brahms.matchAll(/<b>Page \d+<\/b> · (\d+) systems? · mm\. (\d+)–(\d+)/g),
  ].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  assert.equal(ranges.length, 5, 'five page captions (was 6)');
  assert.deepEqual(
    ranges,
    [
      [4, 1, 16],
      [4, 17, 32],
      [4, 33, 48],
      [4, 49, 64],
      [2, 65, 71],
    ],
    '4 systems and 16 measures per page, the last page holds 2'
  );
  const covered = new Map<number, number>();
  for (const [, a, b] of ranges) {
    for (let m = a; m <= b; m++) covered.set(m, (covered.get(m) ?? 0) + 1);
  }
  assert.equal(covered.size, 71, 'every measure of the 71-measure piece is covered');
  for (const [m, n] of [...covered.entries()].sort((x, y) => x[0] - y[0])) {
    assert.equal(n, 1, `m. ${m} is covered exactly once`);
  }
});

test('GOLD/BRONZE badges on the two Reference blocks + AGENTS.md convention', () => {
  const { bach, brahms } = referenceBlocks();
  assert.ok(bach.includes('<span class="tag tag-gold">GOLD · frozen standard</span>'), 'Bach wears GOLD');
  assert.ok(
    brahms.includes('<span class="tag tag-bronze">BRONZE · active surface</span>'),
    'Brahms wears BRONZE'
  );
  assert.ok(!bach.includes('tag-bronze'), 'no BRONZE on the GOLD block');
  assert.ok(!brahms.includes('tag-gold'), 'no GOLD on the BRONZE block');
  const agents = read('AGENTS.md');
  assert.match(agents, /GOLD = the frozen perfection standard/, 'the GOLD convention is written');
  assert.match(agents, /BRONZE = the active iteration surface/, 'the BRONZE convention is written');
});

test('The clean BRONZE block displays honestly: 0/0, itemized, ungated', () => {
  // Canonical completion: the settled 8 (5 slot-furniture bounds, the
  // sys15/16 ink overlap, the m.24/m.44 stem pair) are cleared genuinely by
  // the canonical geometry pass — rigid whole-system positioning from
  // complete ink bounds, corrected shared slot fitting, exact rhythmic ink.
  // Nothing suppressed, nothing gated: the chip and diagnostics read clean.
  const report = lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  assert.equal(report.violations.length, 0, 'zero violations (was the settled 8)');
  assert.equal(report.warnings.length, 0, 'zero warnings');
  assert.equal(report.ok, true, 'the BRONZE surface is honestly ok');
  const { bach, brahms } = referenceBlocks();
  assert.match(brahms, /data-lint-ok="true"/, 'the BRONZE chip stays honestly clean');
  assert.match(brahms, /✓ zero violations/, 'the count is shown, never folded away (was ✗ 8)');
  assert.ok(!brahms.includes('known-note'), 'no known-note on the clean surface');
  assert.ok(!brahms.includes('known-finding'), 'no known tags on the clean surface');
  assert.match(bach, /data-lint-ok="true"/, 'the GOLD block stays clean');
  assert.ok(!bach.includes('known-finding'), 'no known tags on GOLD');
  assert.ok(!bach.includes('known-note'), 'no known note on GOLD');
});

test('CLI canonical: fixed-3 Brahms entry is clean (deploy green)', () => {
  const cli = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS },
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.equal(cli.violations.length, 0, 'canonical Brahms: zero violations');
  assert.equal(cli.warnings.length, 0, 'and warning-free');
  assert.ok(
    !read('scripts/lint_engraving.ts').includes("core: 'adaptive'"),
    'the script carries no adaptive production override'
  );
  // Deploy stays green: `.github/workflows/deploy.yml` gates on `npm test` +
  // `npm run build` only — the CLI is an operator readout, not a gate.
  assert.ok(!read('.github/workflows/deploy.yml').includes('lint:engraving'), 'deploy never gates on the CLI');
});

test('Bach engraved-identity by construction: 0 clasps, so the nudge is inert', () => {
  const clasps = layoutJankoScore(BACH, O_BACH, T_BACH).flatMap((s) => s.clasps);
  assert.equal(clasps.length, 0, 'Bach clasps nothing — no bracket dot can move');
  for (const page of [0, 1]) {
    const golden = renderJankoPage(BACH, page, O_BACH, T_BACH);
    assert.ok(!golden.includes('janko-clasp-dot'), `Bach page ${page + 1} paints no clasp dot`);
    assert.equal(
      renderJankoPage(BACH, page, { ...DEFAULT_JANKO_OPTIONS, claspDotNudge: [0.4, 0.2] }, T_BACH),
      golden,
      `Bach page ${page + 1} is byte-identical with the nudge on`
    );
    // Non-vacuous: Bach DOES paint note dots, and they are identical too.
    assert.ok(circlesOf(golden, 'janko-augmentation-dot').length > 0, 'Bach paints note dots');
  }
});

// ---------------------------------------------------------------------------
// 2. Preview: the uniform (+0.4pt, +0.2pt) situational nudge
// ---------------------------------------------------------------------------

test('Option default is the judged seat; the card carries the preview vector', () => {
  assert.deepEqual(
    resolveJankoOptions(DEFAULT_JANKO_OPTIONS).claspDotNudge,
    [0, 0],
    'default [0, 0] renders the judged seats byte-identically'
  );
  const card = ROUND_31_CANDIDATES.find((c) => c.id === 'round-31-clasp-nudge')!;
  assert.ok(card, 'the card is registered');
  assert.deepEqual(card.options, { claspDotNudge: [0.4, 0.2] }, 'a one-axis preview delta');
});

test('Both pinned instances move by exactly (+0.4pt, +0.2pt)', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  // The same IEEE addition on both sides: strict equality is exact, not luck.
  for (const tick of [48, 432]) {
    const g = golden.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    const p = preview.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    assert.equal(p.durationDots[0]!.x, g.durationDots[0]!.x + NUDGE_DX, `tick-${tick} x moves exactly`);
    assert.equal(p.durationDots[0]!.y, g.durationDots[0]!.y + NUDGE_DY, `tick-${tick} y moves exactly`);
  }
});

test('Score census: exactly the 22 bracket dots move; the clasp set is stable', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  const dottedTicks = (layouts: typeof golden): number[] =>
    layouts
      .flatMap((s) => s.clasps)
      .filter((c) => c.durationDots.some(Boolean))
      .map((c) => c.tick)
      .sort((a, b) => a - b);
  assert.deepEqual(dottedTicks(golden), DOTTED_CLASP_TICKS, 'the golden dotted-bracket set');
  assert.deepEqual(dottedTicks(preview), DOTTED_CLASP_TICKS, 'no dot appears or vanishes');
  const allTicks = (layouts: typeof golden): number[] =>
    layouts
      .flatMap((s) => s.clasps)
      .map((c) => c.tick)
      .sort((a, b) => a - b);
  assert.deepEqual(allTicks(preview), allTicks(golden), 'the 72-bracket fit never flips');
  assert.equal(allTicks(golden).length, 72, '72 brackets (the fold-coincident LH octaves at 6192/10032 stagger unbracketed)');
  // Every moved dot moves by the vector exactly — the uniform rule, all 22.
  for (const tick of DOTTED_CLASP_TICKS) {
    const g = golden.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    const p = preview.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    assert.equal(g.durationDots.filter(Boolean).length, 1, `tick-${tick} carries one dot`);
    assert.equal(p.durationDots[0]!.x, g.durationDots[0]!.x + NUDGE_DX, `tick-${tick} x`);
    assert.equal(p.durationDots[0]!.y, g.durationDots[0]!.y + NUDGE_DY, `tick-${tick} y`);
  }
});

test('No other ink moves: every note-dot seat is identical (1914 fields)', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  let compared = 0;
  for (let s = 0; s < golden.length; s++) {
    const pU = new Map(preview[s].notes.map((n) => [n.note.id, n.rhythm]));
    for (const n of golden[s].notes) {
      const pr = pU.get(n.note.id)!;
      for (const key of ['dotX', 'dotY', 'dot2X', 'dot2Y'] as const) {
        if (n.rhythm[key] === undefined) {
          assert.equal(pr[key], undefined, `${n.note.id}.${key} stays unresolved`);
          continue;
        }
        compared++;
        assert.equal(pr[key], n.rhythm[key], `${n.note.id}.${key} unmoved`);
      }
    }
  }
  assert.ok(compared > 1000, `${compared} resolved note-dot fields compared (non-vacuous)`);
});

test('Page census: note-dot multisets identical, exactly 22 clasp dots move', () => {
  let augTotal = 0;
  let movedTotal = 0;
  for (let page = 0; page < 5; page++) {
    const golden = renderJankoPage(BRAHMS, page, O_BRAHMS, T_BRAHMS);
    const preview = renderJankoPage(BRAHMS, page, O_PREVIEW, T_BRAHMS);
    // Brahms states no plain dotted-8th, so its golden note-dot set is empty —
    // asserted empty on both sides (honest, not vacuous: the layout census
    // above compares every resolved seat, and Bach pins painted dots).
    assert.deepEqual(
      circlesOf(preview, 'janko-augmentation-dot').sort(),
      circlesOf(golden, 'janko-augmentation-dot').sort(),
      `page ${page + 1}: note-dot multiset identical`
    );
    augTotal += circlesOf(golden, 'janko-augmentation-dot').length;
    const byXY = (a: [number, number], b: [number, number]): number => a[0] - b[0] || a[1] - b[1];
    const gDots = circlesOf(golden, 'janko-clasp-dot').sort(byXY);
    const pDots = circlesOf(preview, 'janko-clasp-dot').sort(byXY);
    assert.equal(pDots.length, gDots.length, `page ${page + 1}: no dot appears or vanishes`);
    for (let i = 0; i < gDots.length; i++) {
      const dx = pDots[i][0] - gDots[i][0];
      const dy = pDots[i][1] - gDots[i][1];
      movedTotal++;
      // 2dp paint: the vector reads through rounding within half a hundredth.
      assert.ok(
        Math.abs(dx - NUDGE_DX) < 0.015 && Math.abs(dy - NUDGE_DY) < 0.015,
        `page ${page + 1} dot ${i}: reads (+${dx.toFixed(2)}, +${dy.toFixed(2)})`
      );
    }
  }
  assert.equal(augTotal, 0, 'Brahms paints no golden note dots anywhere (stated for the record)');
  assert.equal(movedTotal, 22, 'exactly the 22 bracket dots move, spread-wide');
});

test('Window census: each card window shows exactly its dot moved, visibly, nothing else', () => {
  // A crop renders whole systems under a viewBox clip: window A (mm. 1–2,
  // sys 0) carries the tick-432 mate clipped in its DOM, and vice versa.
  // The VISIBLE diff is exactly one dot per window; the DOM diff is exactly
  // the two system-mate dots — both pinned, nothing else.
  const card = ROUND_31_CANDIDATES.find((c) => c.id === 'round-31-clasp-nudge')!;
  const windows = [
    { start: 1, count: 2, visible: 48, clipped: 432 },
    { start: 2, count: 2, visible: 432, clipped: 48 },
  ];
  assert.deepEqual(
    (card.windows as JankoScoreCandidateWindow[]).map((w) => [w.measureStart, w.measureCount]),
    windows.map((w) => [w.start, w.count]),
    'the card frames mm. 1–2 + mm. 2–3'
  );
  const goldenLayouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const dotOf = (tick: number): [number, number] => {
    const d = goldenLayouts.flatMap((s) => s.clasps).find((c) => c.tick === tick)!.durationDots[0]!;
    return [d.x, d.y];
  };
  for (const w of windows) {
    const golden = renderJankoCrop(BRAHMS, w.start, w.count, O_BRAHMS, T_BRAHMS);
    const preview = renderJankoCrop(BRAHMS, w.start, w.count, O_PREVIEW, T_BRAHMS);
    const box = viewBoxOf(preview);
    assert.deepEqual(viewBoxOf(golden), box, 'the nudge never moves the viewBox');
    const inBox = ([x, y]: [number, number]): boolean =>
      x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
    const gDots = circlesOf(golden, 'janko-clasp-dot');
    const pDots = circlesOf(preview, 'janko-clasp-dot');
    assert.equal(pDots.length, gDots.length, 'no dot appears or vanishes in the DOM');
    // Visible diff: exactly the window's dot, moved by the vector.
    const moved = pDots.filter(
      ([x, y]) => !gDots.some(([gx, gy]) => Math.abs(gx - x) < 1e-9 && Math.abs(gy - y) < 1e-9)
    );
    const visibleMoved = moved.filter(inBox);
    assert.equal(visibleMoved.length, 1, 'exactly one VISIBLE dot moves');
    const [vx, vy] = visibleMoved[0];
    const [gx, gy] = dotOf(w.visible);
    assert.ok(
      Math.abs(vx - (gx + NUDGE_DX)) < 0.015 && Math.abs(vy - (gy + NUDGE_DY)) < 0.015,
      'the visible dot is the window dot, moved by the vector'
    );
    // DOM diff: exactly the two system-mate dots — normalize both, and the
    // two renders are byte-identical (no other ink moves, in or out of view).
    assert.equal(moved.length, 2, 'the DOM moves exactly the two system-mate dots');
    let normalized = preview;
    for (const tick of [w.visible, w.clipped]) {
      const [ox, oy] = dotOf(tick);
      const goldenEl =
        `<circle class="janko-clasp-dot" cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" ` +
        `r="0.75" fill="#111111"/>`;
      const previewEl =
        `<circle class="janko-clasp-dot" cx="${(ox + NUDGE_DX).toFixed(2)}" cy="${(oy + NUDGE_DY).toFixed(2)}" ` +
        `r="0.75" fill="#111111"/>`;
      assert.equal(
        normalized.split(previewEl).length - 1,
        1,
        `the tick-${tick} moved circle occurs exactly once`
      );
      normalized = normalized.replace(previewEl, goldenEl);
    }
    assert.equal(normalized, golden, 'nothing else moves in the window render');
  }
});

test('Linter covers the nudged positions: the preview adds no finding', () => {
  const golden = lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = lintJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  assert.deepEqual(
    preview.violations.map((v) => [v.code, v.system, v.measure, v.message]),
    golden.violations.map((v) => [v.code, v.system, v.measure, v.message]),
    'preview violations equal the golden report — the nudge adds nothing (both clean at canonical packing)'
  );
  const fusion = (codes: string[]): string[] =>
    codes.filter((c) => c === 'clasp-dot-fusion' || c === 'dot-collision' || c === 'dot-count-agreement');
  assert.deepEqual(fusion(preview.violations.map((v) => v.code)), [], 'no fusion audit fires');
  assert.deepEqual(fusion(golden.violations.map((v) => v.code)), [], 'the golden path is silent');
  // The binding seat, pinned absolutely — re-pinned for the §1/§2/§3 geometry
  // (the nudge applies to the new seat exactly: dot = golden seat +
  // [0.4, 0.2], proven by the moved-circles test above). Mark air is 1.360
  // (keeps the hug with room). The old binding case is gone BY DESIGN: §1
  // seats the 192-tick exception (member 5) on the RIGHT rail, 5.46pt off
  // the column, so the nudged dot now clears its head widely — virtual hug
  // +4.27, knockout daylight +6.02 — and no audit fires.
  const layouts = layoutJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  const clasp = layouts.flatMap((s) => s.clasps).find((c) => c.tick === 48)!;
  const dot = clasp.durationDots[0]!;
  const daylight = claspMarkDaylight(clasp, clasp.durationInk[0], dot.x, dot.y, T_BRAHMS);
  assert.ok(Math.abs(daylight - 1.3597864397806587) < 1e-10, 'nudged mark air keeps the hug (was 1.3574… pre-§1/§3)');
  const member = layouts
    .flatMap((s) => s.notes)
    .find((p) => p.note.id === 'brahms-op118-no1-5')!;
  const hug =
    Math.hypot(dot.x - member.x, dot.y - member.y) - T_BRAHMS.noteheadRadius - T_BRAHMS.augmentationDotRadius;
  assert.ok(Math.abs(hug - 4.272976358642013) < 1e-10, 'the exception head stands well clear (was −0.5954… on the column)');
  const qx = Math.max(Math.abs(dot.x - member.x) - 2.53, 0);
  const qy = Math.max(Math.abs(dot.y - member.y) - 3.46, 0);
  const ko = Math.hypot(qx, qy) - T_BRAHMS.augmentationDotRadius;
  assert.ok(Math.abs(ko - 6.021242789363926) < 1e-10, 'the knockout keeps daylight: the dot paints whole (was 0.0889…)');
  assert.ok(ko > 0, 'positive knockout daylight — zero clipping on the nudged seat');
});

test('Knockout guard: no clasp dot intersects a head knockout (all pages, golden + preview)', () => {
  // Knockouts paint after clasps, so an intersection would erase dot ink.
  for (const [label, options] of [
    ['golden', O_BRAHMS],
    ['preview', O_PREVIEW],
  ] as const) {
    let rects = 0;
    let dots = 0;
    for (let page = 0; page < 5; page++) {
      const svg = renderJankoPage(BRAHMS, page, options, T_BRAHMS);
      const boxes = [
        ...svg.matchAll(/<rect class="janko-knockout" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g),
      ].map((m) => ({ x0: Number(m[1]), y0: Number(m[2]), x1: Number(m[1]) + Number(m[3]), y1: Number(m[2]) + Number(m[4]) }));
      rects += boxes.length;
      for (const [cx, cy] of circlesOf(svg, 'janko-clasp-dot')) {
        dots++;
        for (const b of boxes) {
          const dx = Math.max(b.x0 - cx, 0, cx - b.x1);
          const dy = Math.max(b.y0 - cy, 0, cy - b.y1);
          assert.ok(
            Math.hypot(dx, dy) >= T_BRAHMS.augmentationDotRadius - 1e-9,
            `${label} page ${page + 1}: dot (${cx}, ${cy}) clears its knockouts`
          );
        }
      }
    }
    const totalNotes = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS).flatMap((s) => s.notes).length;
    assert.equal(rects, totalNotes, `${label}: one knockout rect per positioned note (non-vacuous)`);
    assert.equal(dots, 22, `${label}: all 22 dots audited`);
  }
});

test('Caption proofread against the actual render', () => {
  const card = ROUND_31_CANDIDATES.find((c) => c.id === 'round-31-clasp-nudge')!;
  const [w0, w1] = card.windows!;
  // The displacement vector, printed to 0.1pt in both windows — and true.
  for (const w of [w0, w1]) {
    assert.ok(w.title.includes('(+0.4pt, +0.2pt)'), 'the vector is printed to 0.1pt');
  }
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_PREVIEW, T_BRAHMS);
  for (const tick of [48, 432]) {
    const g = golden.flatMap((s) => s.clasps).find((c) => c.tick === tick)!.durationDots[0]!;
    const p = preview.flatMap((s) => s.clasps).find((c) => c.tick === tick)!.durationDots[0]!;
    assert.equal((p.x - g.x).toFixed(1), '0.4', `tick-${tick} prints +0.4pt`);
    assert.equal((p.y - g.y).toFixed(1), '0.2', `tick-${tick} prints +0.2pt`);
  }
  // "White-ring": the m.1 clasp carries an open ring mark.
  const m1 = golden.flatMap((s) => s.clasps).find((c) => c.tick === 48)!;
  assert.ok(m1.durationInk[0].pips >= 1, 'the tick-48 mark is a white-ring pip');
  // "m.1" and "m.3 downbeat twin": the engine's own measure map (48 upbeat, 192/measure).
  assert.equal(Math.floor((48 - 48) / 192) + 1, 1, 'tick 48 opens m. 1');
  assert.equal(Math.floor((432 - 48) / 192) + 1, 3, 'tick 432 opens m. 3 (not m. 4)');
  assert.equal(432, 48 + 2 * 192, 'tick 432 is the m. 3 downbeat');
  // "Adds no new findings": the card says it, the lint equality above proves it.
  assert.ok(card.description!.includes('Adds no new findings'), 'the attribution is on the card');
});

// ---------------------------------------------------------------------------
// 3. Registry: one card, one axis, no control + honest chip attribution
// ---------------------------------------------------------------------------

test('Registry purity: one card, no control, one axis', () => {
  assert.equal(ROUND_31_METADATA.round, 31);
  assert.match(ROUND_31_METADATA.title, /Clasp-dot nudge/);
  assert.deepEqual(ROUND_31_METADATA.openAxes, ['claspDotNudge']);
  assert.equal(ROUND_31_METADATA.compareStrip, undefined, 'no strip: one shared preview');
  assert.equal(ROUND_31_CANDIDATES.length, 1, 'exactly one card');
  assert.equal(
    ROUND_31_CANDIDATES.find((c) => c.id === 'control'),
    undefined,
    'no control card'
  );
  const [card] = ROUND_31_CANDIDATES;
  assert.equal(card.id, 'round-31-clasp-nudge');
  assert.equal(card.axis, 'claspDotNudge', 'the card declares the open axis');
  const badges = candidateBadges(card, ROUND_31_METADATA);
  assert.deepEqual(
    badges.map((b) => b.key),
    ['claspDotNudge'],
    'the card badges only its axis'
  );
  assert.ok(badges.every((b) => b.axis), 'the badge is the axis badge');
  const resolved = resolveCandidate(card);
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const [k, v] of Object.entries(resolved.options)) {
    if (k === 'claspDotNudge') {
      assert.deepEqual(v, [0.4, 0.2], 'the card previews the vector');
    } else {
      assert.deepEqual(v, (golden as Record<string, unknown>)[k], `${card.id} locks ${k} to golden`);
    }
  }
});

test('Card chip honestly inherits the surface: clean, preview adds 0', () => {
  const html = renderCandidatesView(CONFIG_31);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 1, 'one card');
  assert.ok(html.includes('data-candidate="round-31-clasp-nudge"'), 'the nudge card renders');
  // Whole-score card lint inherits the clean BRONZE surface — the card chip
  // reads clean BY ATTRIBUTION, and the nudge provably adds nothing (see the
  // lint-equality test).
  assert.match(html, /data-candidate-count="1"/);
  assert.match(html, /data-window-count="2"/);
  assert.match(html, /data-verification="false"/, 'the preview round is decisive');
  assert.match(html, /1 candidate × 2 engraving windows/, 'the header counts honestly');
  assert.match(html, /data-lint="clean"/, 'the chip inherits the surface honestly');
  assert.match(html, /✓ clean/, 'the count is shown, never folded away (was ✗ 7)');
  // Parked: badges render against the live CURRENT round (Round 32), so the
  // historical claspDotNudge delta shows without the axis class (the live
  // axis is gridPulseFilter). The axis badge itself is pinned on the
  // historical round explicitly in the Registry purity test above.
  assert.equal((html.match(/badge-axis/g) ?? []).length, 0, 'no live-axis badge on parked card');
  assert.ok(html.includes('<b>claspDotNudge</b>'), 'the historical delta still badges');
  assert.equal((html.match(/data-window="brahms-op118-no1:/g) ?? []).length, 2, 'Brahms ×2');
  assert.ok(!html.includes('data-window="primary:'), 'Bach carries no window this round');
  assert.ok(!html.includes('data-candidate="control"'), 'no control card');
});

// ---------------------------------------------------------------------------
// 4. R30 parked by convention (reversible, nothing lost)
// ---------------------------------------------------------------------------

test('R30 parked: historical consts in the round-30 suite, no live-registry assertions', () => {
  const suite = read('test/janko-round30.test.ts');
  assert.ok(suite.includes('ROUND_30_METADATA'), 'the historical metadata const is parked');
  assert.ok(suite.includes('ROUND_30_CANDIDATES'), 'the historical card consts are parked');
  assert.match(suite, /[Hh]istorical Round 30/, 'the parking record names the round');
  assert.ok(!suite.includes('CURRENT_CANDIDATES'), 'no live-registry card assertions remain');
  assert.ok(!suite.includes('CURRENT_ROUND_METADATA'), 'no live-registry metadata assertions remain');
  assert.match(
    read('src/render/janko/candidates.ts'),
    /Round 30 is judged WITHHELD and parked/,
    'the registry carries the parking record'
  );
});

test('durationGrammar option code untouched (behavior pin)', () => {
  assert.equal(
    resolveJankoOptions(DEFAULT_JANKO_OPTIONS).durationGrammar,
    'golden',
    'the incomplete grammar is still the incumbent'
  );
  // R30's engine/census/linter pins stay live in test/janko-round30.test.ts
  // (adaptive) — this suite passing alongside them proves it.
});
