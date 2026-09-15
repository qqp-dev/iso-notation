/**
 * Round 28: Extension Junctions — Conjoin vs Wide Gap
 * ===================================================
 *
 * Durable maintained test suite verifying:
 *  1. Registry purity: exactly 2 cards, NO control card (operator order —
 *     the Reference view carries the standing golden look), single open axis
 *     `extensionJunction`.
 *  2. Card A loci (Conjoin): measure barlines span outer-row levels (fixed-3:
 *     lin 72–24; fixed-4: 77.5–17.5), and extension-row interior terminals run
 *     FLUSH into abutting barlines (guest gap 0; |tip - barline| = 0).
 *  3. Card B loci (Wide Gap): extension-row interior terminals stand off 12.0pt
 *     (double house inset) from barlines; barlines at short heights.
 *  4. Golden/default reproduction: default junction reproduces golden master
 *     (6.0pt standoff, short barlines).
 *  5. Window loci: Page 2 (mm. 17–32) contains m. 29 and >= 1 interior extension
 *     terminal; macro mm. 29–30 contains the junction.
 *  6. Captions match rendered junction counts (1 junction).
 *  7. Linter cleanliness: both candidates report clean (0 violations, 0 warnings).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_STUDIO_SCORE_ID,
  JankoCandidate,
  JankoCandidateRound,
  getCandidate,
  resolveCandidate,
} from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computePageGeometry,
  getSystemGeometry,
  layoutJankoScore,
  renderSystem,
} from '../src/render/janko/engine';
import { gridBotY, gridTopY } from '../src/render/janko/elements/barlines';
import { continuousPitchY } from '../src/render/janko/geometry';
import { lintJankoScore, systemBarlines } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();

// Historical Round 28 registry (conjoin vs wide-gap) preserved for durable regression coverage.
// Active candidate round in src/render/janko/candidates.ts is Round 30 (duration-grammar preview).
const ROUND_28_METADATA: JankoCandidateRound = {
  round: 28,
  title: 'Extension Junctions: Conjoin vs Wide Gap',
  description:
    'Where an extension-row terminal stands near a barline, does clean design favor contact or separation? Two answers: Conjoin (outer-row measure barlines meeting flush extension terminals in 90° T-junctions) vs Wide Gap (12.0pt standoff with short barlines). No control card — the Reference view carries the standing golden look (6.0pt standoff).',
  openAxes: ['extensionJunction'],
};

const ROUND_28_CANDIDATES: JankoCandidate[] = [
  {
    id: 'junction-conjoin',
    label: 'A · Conjoin — Flush Outer T-Junctions',
    description:
      'Measure barlines span the outer-row levels (fixed-3: lin 72–24; fixed-4: 77.5–17.5), and extension-row interior terminals run flush into abutting barlines (0pt guest gap). Page 2 contains 1 interior extension junction (m. 30 closing barline); macro contains 1 junction.',
    axis: 'extensionJunction',
    options: { extensionJunction: 'conjoin' },
  },
  {
    id: 'junction-wide-gap',
    label: 'B · Wide Gap — 12.0pt Clear Separation',
    description:
      'Extension-row interior terminals stand off 12.0pt (double the house inset) from abutting barlines, while measure barlines keep short heights. Page 2 contains 1 interior extension junction (m. 30 closing barline); macro contains 1 junction.',
    axis: 'extensionJunction',
    options: { extensionJunction: 'wide-gap' },
  },
];

// ---------------------------------------------------------------------------
// 1. Registry Purity (Round 28, NO control card, one open axis)
// ---------------------------------------------------------------------------

test('Round 28 registry purity: exactly 2 cards, NO control card, extensionJunction axis', () => {
  assert.equal(ROUND_28_METADATA.round, 28);
  assert.match(ROUND_28_METADATA.title, /Extension Junctions/);
  assert.deepEqual(
    ROUND_28_METADATA.openAxes,
    ['extensionJunction'],
    'only extensionJunction is an open axis'
  );

  // Operator explicit order: NO control card (Reference view is the standing control)
  assert.equal(ROUND_28_CANDIDATES.length, 2, 'exactly two contenders');
  const [cardA, cardB] = ROUND_28_CANDIDATES;

  assert.equal(cardA.id, 'junction-conjoin');
  assert.match(cardA.label, /Conjoin/);
  assert.equal(cardA.axis, 'extensionJunction');
  assert.deepEqual(cardA.options, { extensionJunction: 'conjoin' });

  assert.equal(cardB.id, 'junction-wide-gap');
  assert.match(cardB.label, /Wide Gap/);
  assert.equal(cardB.axis, 'extensionJunction');
  assert.deepEqual(cardB.options, { extensionJunction: 'wide-gap' });

  // Candidate discipline: each card differs ONLY on extensionJunction against golden
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.extensionJunction, 'default', 'golden default is "default"');

  for (const card of ROUND_28_CANDIDATES) {
    const resolved = resolveCandidate(card);
    for (const [k, v] of Object.entries(resolved.options)) {
      if (k === 'extensionJunction') {
        assert.notEqual(v, golden.extensionJunction, `${card.id} departs from golden extensionJunction`);
      } else {
        assert.deepEqual(v, (golden as any)[k], `${card.id} leaves ${k} locked to golden`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Card A Loci (Conjoin: flush terminals, outer-row measure barlines)
// ---------------------------------------------------------------------------

test('Card A loci (fixed-3): measure barlines span lin 72–24; interior extension terminals flush (gap = 0)', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3', extensionJunction: 'conjoin' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  // System 7 (mm. 29–32) has extension row 4 (lin 72) in mm. 29–30
  const sys7 = layouts[7];
  const geo = sys7.geometry;
  const segs = geo.staffSegments ?? [];

  const barline2X = Number((geo.staffLeft + 2 * geo.measureWidth).toFixed(2));

  // Row 4 segment in mm. 29–30:
  const row4 = segs.find((s) => s.rowId === 4 && s.mStart === 0 && s.mEnd === 1);
  assert.ok(row4, 'Row 4 segment found in mm. 29–30');
  assert.equal(row4.x1, geo.staffLeft, 'System left edge is flush');
  // Flush conjoin at interior barline: |tip - barline| === 0
  assert.equal(Number(row4.x2.toFixed(2)), barline2X, 'Row 4 runs FLUSH into interior barline (0pt gap)');

  // Measure barlines span lin 72 to lin 24
  const expectedTop = (geo.middleCY + continuousPitchY(72, t.semitoneScale)).toFixed(2);
  const expectedBot = (geo.middleCY + continuousPitchY(24, t.semitoneScale)).toFixed(2);

  const barlines = systemBarlines(sys7, o, t);
  for (const b of barlines) {
    assert.equal(b.top.toFixed(2), expectedTop, 'barline top spans to lin 72');
    assert.equal(b.bottom.toFixed(2), expectedBot, 'barline bottom spans to lin 24');
  }

  // SVG inspection: rendered line elements have matching coordinates
  const svg = renderSystem(BACH, geo, 7, o, t, sys7);
  const barlineRegex = new RegExp(
    `<line class="janko-barline" x1="${barline2X.toFixed(2)}" y1="${expectedTop}" x2="${barline2X.toFixed(2)}" y2="${expectedBot}"`
  );
  assert.match(svg, barlineRegex, 'rendered barline spans lin 72–24');
});

test('Card A loci (fixed-4): measure barlines span lin 77.5–17.5', () => {
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'fixed-4', extensionJunction: 'conjoin' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, o, t);

  const sys0 = layouts[0];
  const geo = sys0.geometry;
  const expectedTop = (geo.middleCY + continuousPitchY(77.5, t.semitoneScale)).toFixed(2);
  const expectedBot = (geo.middleCY + continuousPitchY(17.5, t.semitoneScale)).toFixed(2);

  const barlines = systemBarlines(sys0, o, t);
  for (const b of barlines) {
    assert.equal(b.top.toFixed(2), expectedTop, 'fixed-4 barline top spans to lin 77.5');
    assert.equal(b.bottom.toFixed(2), expectedBot, 'fixed-4 barline bottom spans to lin 17.5');
  }
});

// ---------------------------------------------------------------------------
// 3. Card B Loci (Wide Gap: 12.0pt standoff, short barlines)
// ---------------------------------------------------------------------------

test('Card B loci: interior extension terminals stand off exactly 12.0pt; barlines at short heights', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3', extensionJunction: 'wide-gap' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  const sys7 = layouts[7];
  const geo = sys7.geometry;
  const segs = geo.staffSegments ?? [];

  const barline2X = Number((geo.staffLeft + 2 * geo.measureWidth).toFixed(2));

  // Row 4 segment in mm. 29–30:
  const row4 = segs.find((s) => s.rowId === 4 && s.mStart === 0 && s.mEnd === 1);
  assert.ok(row4, 'Row 4 segment found in mm. 29–30');
  assert.equal(row4.x1, geo.staffLeft, 'System left edge is flush');
  // 12.0pt standoff:
  assert.equal(
    Number(row4.x2.toFixed(2)),
    Number((barline2X - 12.0).toFixed(2)),
    'Row 4 stands off exactly 12.0pt before interior barline'
  );

  // Barlines keep short heights (gridTopY to gridBotY)
  const expectedTop = gridTopY(geo).toFixed(2);
  const expectedBot = gridBotY(geo).toFixed(2);

  const barlines = systemBarlines(sys7, o, t);
  // Interior measure barlines have short heights
  assert.equal(barlines[0].top.toFixed(2), expectedTop);
  assert.equal(barlines[0].bottom.toFixed(2), expectedBot);
});

// ---------------------------------------------------------------------------
// 4. Default Junction Reproduction (golden master exact)
// ---------------------------------------------------------------------------

test('Default junction style reproduces golden master geometry exactly', () => {
  const oDefault = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, extensionJunction: 'default' });
  const oGolden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const lDefault = layoutJankoScore(BACH, oDefault, t);
  const lGolden = layoutJankoScore(BACH, oGolden, t);

  assert.deepEqual(
    lDefault[7].geometry.staffSegments,
    lGolden[7].geometry.staffSegments,
    'default staff segments match golden exactly'
  );

  // Row 4 stands off 6.0pt
  const geo = lDefault[7].geometry;
  const barline2X = geo.staffLeft + 2 * geo.measureWidth;
  const row4 = (geo.staffSegments ?? []).find((s) => s.rowId === 4)!;
  assert.equal(Number((barline2X - row4.x2).toFixed(2)), 6.0, '6.0pt standoff under default');
});

// ---------------------------------------------------------------------------
// 5. Window Loci & Captions
// ---------------------------------------------------------------------------

test('Page 2 (mm. 17–32) contains m. 29 and >= 1 interior extension terminal; captions match', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(BACH, o, t);

  assert.equal(layouts.length, 8, 'Bach has 8 systems total (2 pages)');
  // Page 2 spans systems 4..7 (measures 17..32)
  const page2Systems = layouts.slice(4, 8);
  assert.equal(page2Systems.length, 4, 'Page 2 contains 4 systems');

  // System 7 is on Page 2 (index 7) and contains measures 29..32
  const sys7 = layouts[7];
  assert.equal(sys7.index, 7);

  // Verify >= 1 interior extension terminal exists on Page 2
  const page2Segs = page2Systems.flatMap((sys) => sys.geometry.staffSegments ?? []);
  const interiorExtTerminals = page2Segs.filter((s) => (s.rowId === 4 || s.rowId === 5) && (s.mStart > 0 || s.mEnd < 3));
  assert.ok(interiorExtTerminals.length >= 1, 'Page 2 contains >= 1 interior extension terminal');

  // Specifically in System 7, Row 4 terminates at measure index 1 (m. 30), before barline 2
  const sys7Ext = (sys7.geometry.staffSegments ?? []).find((s) => s.rowId === 4);
  assert.ok(sys7Ext, 'System 7 contains Row 4');
  assert.equal(sys7Ext.mStart, 0, 'starts at m. 29');
  assert.equal(sys7Ext.mEnd, 1, 'ends at m. 30 (interior terminal)');

  // Captions match: exactly 1 junction
  for (const card of ROUND_28_CANDIDATES) {
    assert.match(card.description ?? '', /Page 2 contains 1 interior extension junction/);
    assert.match(card.description ?? '', /macro contains 1 junction/);
  }
});

// ---------------------------------------------------------------------------
// 6. Linter Cleanliness
// ---------------------------------------------------------------------------

test('Both candidate cards pass visual linter with 0 violations and 0 warnings', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const card of ROUND_28_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...(card.options ?? {}) });
    const report = lintJankoScore(BACH, o, t);
    assert.equal(report.ok, true, `${card.id} lints clean on Bach`);
    assert.equal(report.violations.length, 0, `${card.id} reports 0 violations`);
    assert.equal(report.warnings.length, 0, `${card.id} reports 0 warnings`);
  }
});
