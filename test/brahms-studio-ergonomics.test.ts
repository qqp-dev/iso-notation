/**
 * Brahms studio ergonomics + title block (directed fixes, no round).
 * ================================================================
 *
 * Operator orders, implemented and pinned here:
 *  1. Reference view: BRONZE Brahms block FIRST, GOLD Bach block BELOW;
 *     Bach focus crops dropped (count 0), Brahms crops unchanged.
 *  2. Brahms four systems per page — BLOCKED BY MEASUREMENT (see below).
 *  3. Title block: composer right-only, title fits, Bach frozen (hash).
 *
 * Section 2 record (MEASURE FIRST verdict — the ticket's own gate):
 * Brahms lays out as 24 systems (71 measures: (13632 − 48) / 192 = 70.75
 * → 71; ceil(71 / 3) = 24). At 4-up the page slot is 183.97pt
 * (body 735.89 / 4) and NEITHER core fits:
 *  - adaptive (the CLI gate): REAL full-ink overlap — system 24's ink
 *    reaches y=621.62 into system 23's beam ink (bottom y=638.44),
 *    gap −16.83pt (`system-slot-overlap`). No options-level spacing
 *    change can close it (needs +68pt of body height — more than the
 *    page has); engraving changes are out of scope. Pure pagination
 *    would ship overlapping systems AND redden the deploy gate.
 *  - fixed-3 (the studio surface): no visual overlap (min same-page
 *    gap +2.07pt) but 5 slot-accounting violations (numerals above
 *    staffTop, ottava hooks below, page-uniform slot reuse) — the
 *    BRONZE chip would read 9 violations, breaking the standing
 *    "4 knowns" acceptance and the Round 31 pins.
 * So Brahms STAYS 3-up (8 pages) in this ticket; the pins below record
 * the arithmetic, the block, and the single-source surfaces agreement.
 * If the §2-block test ever flips, 4-up may be feasible — re-measure.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

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
  countJankoSystems,
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
    'Brahms crop content unchanged (pagination did not move — no re-aim)'
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
// 2. Pagination: arithmetic pinned, 3-up stays (4-up blocked — see header)
// ---------------------------------------------------------------------------

test('Brahms pagination arithmetic: 71 measures → 24 systems → 8 pages at 3-up', () => {
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
  assert.equal(O_BRAHMS.systemsPerPage, 3, '3-up stays: the 4-up fit measurement failed (see header)');
  assert.equal(Math.ceil(24 / O_BRAHMS.systemsPerPage), 8, '24 systems at 3-up = 8 pages');
  const html = renderReferenceView(createStudioConfig());
  const brahms = referenceBlock(html, 'brahms-op118-no1');
  assert.equal(brahms.match(/data-page="/g)?.length ?? 0, 8, 'the Reference spread shows all 8 Brahms pages');
});

test('Brahms §2-block record: 4-up overlaps real ink (adaptive) and breaks slots (fixed-3)', () => {
  // If either assertion flips, the fit picture changed — re-measure §2.
  const adaptive4 = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive', systemsPerPage: 4 });
  const report4 = lintJankoScore(BRAHMS, adaptive4, T_BRAHMS);
  const overlap = report4.violations.filter((v) => v.code === 'system-slot-overlap');
  assert.ok(overlap.length >= 1, 'adaptive 4-up still violates the slot gate');
  assert.ok(
    overlap.some((v) => /System 24's ink reaches up to y=621\.62, into system 23's ink/.test(v.message)),
    'system 24 head ink (y=621.62) still overlaps system 23 beam ink (bottom y=638.44): gap −16.83pt'
  );
  const fixed4 = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-3', systemsPerPage: 4 });
  const reportF = lintJankoScore(BRAHMS, fixed4, T_BRAHMS);
  assert.equal(
    reportF.violations.filter((v) => v.code === 'system-slot-overlap').length,
    5,
    'fixed-3 4-up still carries its 5 slot-accounting violations (BRONZE would read 9, not 4 knowns)'
  );
});

test('Brahms pagination has one source of truth; every surface agrees', () => {
  const config = createStudioConfig();
  const studioBrahms = config.scores['brahms-op118-no1'].options;
  assert.equal(studioBrahms.systemsPerPage, O_BRAHMS.systemsPerPage, 'studio reads the score options');
  assert.equal(studioBrahms.measuresPerSystem, O_BRAHMS.measuresPerSystem);
  assert.equal(studioBrahms.ticksPerMeasure, O_BRAHMS.ticksPerMeasure);
  // The lint CLI spreads the same const (`scripts/lint_engraving.ts`); the
  // gate run proves it. No surface pins its own pagination.
  assert.equal(O_BRAHMS.systemsPerPage, 3);
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

test('Reference completeness: Brahms systems 1–24 each render exactly once across the spread', () => {
  const seen = new Map<number, number>();
  for (let page = 0; page < 8; page++) {
    const svg = renderJankoPage(BRAHMS, page, O_BRAHMS, T_BRAHMS);
    for (const m of svg.matchAll(/id="system-(\d+)"/g)) {
      const n = Number(m[1]);
      seen.set(n, (seen.get(n) ?? 0) + 1);
    }
  }
  assert.equal(seen.size, 24, 'all 24 systems render somewhere');
  for (let n = 1; n <= 24; n++) {
    assert.equal(seen.get(n), 1, `system ${n} renders exactly once`);
  }
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
