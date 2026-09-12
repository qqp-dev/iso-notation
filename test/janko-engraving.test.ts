/**
 * Jánko Engraving Ergonomics Harness — invariant test suite.
 *
 * Covers:
 *  1. Jánko geometry & pitch isomorphism (rank mapping, row/octave steps,
 *     dynamic ledger equators, Position of Honor halo).
 *  2. The modular engine (page/crop/variant SVG composition).
 *  3. The unified export suite (`npm run janko:export`) and its five PNGs in
 *     every delivery location, inside the 2-second budget.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Hand, QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_HOME_OCTAVES,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  getEquatorYForOctave,
  getLedgerEquators,
  getPitchCoordinate,
  getTickX,
  getWholeToneRank,
} from '../src/render/janko/geometry';
import {
  computeCropBox,
  computePageGeometry,
  countJankoPages,
  renderJankoCrop,
  renderJankoPage,
  renderJankoVariantComparison,
} from '../src/render/janko/engine';
import { renderHalo } from '../src/render/janko/elements/notehead';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const MAIN_CHECKOUT = '/home/qqp/projects/iso-notation';

const TOKENS = DEFAULT_JANKO_TOKENS;
const OPTIONS = DEFAULT_JANKO_OPTIONS;
const HANDS: Hand[] = ['RH', 'LH'];

const EXPORT_NAMES = [
  'janko_portrait_page1.png',
  'janko_m1_m2.png',
  'janko_m4.png',
  'janko_m8.png',
  'janko_variants.png',
] as const;

function close(actual: number, expected: number, message: string, epsilon = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${message}: expected ${expected}, got ${actual}`
  );
}

function makeNote(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: Hand = 'RH'
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand };
}

function makeScore(notes: QuantizedNote[], totalTicks: number): QuantizedGridScore {
  return {
    id: 'synthetic-janko-test',
    title: 'Synthetic Jánko Test',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

// ---------------------------------------------------------------------------
// 1. Geometry & pitch isomorphism invariants
// ---------------------------------------------------------------------------

test('Jánko pitch isomorphism: every pc in [0,11] maps to whole-tone rank pc mod 2', () => {
  for (let pc = 0; pc < 12; pc++) {
    assert.equal(getWholeToneRank(pc), pc % 2, `rank of pc ${pc}`);
    for (const hand of HANDS) {
      const coord = getPitchCoordinate(pc, 4, hand, TOKENS, OPTIONS);
      assert.equal(coord.rank, pc % 2, `coord rank of pc ${pc} (${hand})`);
      assert.equal(coord.row, coord.rank, `row aliases rank for pc ${pc}`);
    }
  }
});

test('Jánko equator principle: rank 0 (evens) below the equator, rank 1 (odds) above', () => {
  const halfRow = TOKENS.rowHeight / 2;
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      for (let pc = 0; pc < 12; pc++) {
        const c = getPitchCoordinate(pc, oct, hand, TOKENS, OPTIONS);
        const even = pc % 2 === 0;
        close(c.offsetFromEquator, even ? halfRow : -halfRow, `offset of pc ${pc}`);
        close(c.y - c.equatorY, c.offsetFromEquator, `y-equator of pc ${pc} oct ${oct} ${hand}`);
        if (even) {
          assert.ok(c.y > c.equatorY, `even pc ${pc} must sit below its equator`);
          assert.equal(c.side, 'below');
        } else {
          assert.ok(c.y < c.equatorY, `odd pc ${pc} must sit above its equator`);
          assert.equal(c.side, 'above');
        }
      }
    }
  }
});

test('Jánko row-to-row vertical step is universally isometric (h = 15.0pt)', () => {
  close(TOKENS.rowHeight, 15.0, 'canonical row height token');
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      for (let k = 0; k < 6; k++) {
        const even = getPitchCoordinate(2 * k, oct, hand, TOKENS, OPTIONS);
        const odd = getPitchCoordinate(2 * k + 1, oct, hand, TOKENS, OPTIONS);
        close(even.y - odd.y, TOKENS.rowHeight, `row step pc ${2 * k}/${2 * k + 1} oct ${oct}`);
        close(odd.y - even.y, -TOKENS.rowHeight, `row step reversed (${hand})`);
        close(even.equatorY, odd.equatorY, 'same octave must share one equator');
      }
    }
  }
  // The rank offset itself is universally isometric: every lane sits exactly
  // h/2 from its equator, in every octave and for both hands.
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      for (let pc = 0; pc < 12; pc++) {
        const c = getPitchCoordinate(pc, oct, hand, TOKENS, OPTIONS);
        close(Math.abs(c.y - c.equatorY), TOKENS.rowHeight / 2, `lane offset pc ${pc} oct ${oct}`);
      }
    }
  }
});

test('Jánko octave equator step is 2h = 30.0pt within each hand lattice', () => {
  close(TOKENS.octaveStep, 30.0, 'canonical octave step token');
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      const lower = getEquatorYForOctave(oct, hand, TOKENS, OPTIONS);
      const upper = getEquatorYForOctave(oct + 1, hand, TOKENS, OPTIONS);
      close(Math.abs(upper - lower), TOKENS.octaveStep, `octave step ${oct}->${oct + 1} (${hand})`);
      assert.ok(upper < lower, 'higher octaves must climb upward on the page');
    }
  }
  // Every pitch class inherits the same octave step.
  for (let pc = 0; pc < 12; pc++) {
    for (const hand of HANDS) {
      const a = getPitchCoordinate(pc, 3, hand, TOKENS, OPTIONS);
      const b = getPitchCoordinate(pc, 4, hand, TOKENS, OPTIONS);
      close(Math.abs(b.equatorY - a.equatorY), TOKENS.octaveStep, `pc ${pc} octave step`);
    }
  }
});

test('Middle C spine anchors the two hand lattices (o4 -22.5pt / o3 +22.5pt)', () => {
  close(OPTIONS.interStaffGap, 45.0, 'canonical inter-staff gap');
  close(getEquatorYForOctave(4, 'RH', TOKENS, OPTIONS), -22.5, 'RH o4 equator');
  close(getEquatorYForOctave(3, 'LH', TOKENS, OPTIONS), 22.5, 'LH o3 equator');
  close(getEquatorYForOctave(5, 'RH', TOKENS, OPTIONS), -52.5, 'RH o5 equator');
  close(getEquatorYForOctave(2, 'LH', TOKENS, OPTIONS), 52.5, 'LH o2 equator');
});

test('Dynamic ledger equators: home octaves are clean, out-of-staff octaves accumulate', () => {
  // Home staff octaves never produce ledgers.
  for (const hand of HANDS) {
    const [minOct, maxOct] = JANKO_HOME_OCTAVES[hand];
    for (let oct = minOct; oct <= maxOct; oct++) {
      for (let pc = 0; pc < 12; pc++) {
        const c = getPitchCoordinate(pc, oct, hand, TOKENS, OPTIONS);
        assert.equal(c.isOutOfStaff, false, `${hand} oct ${oct} is in staff`);
        assert.equal(c.ledgerYs.length, 0, `${hand} oct ${oct} needs no ledger`);
        assert.equal(c.ledgerY, null);
      }
    }
  }

  // Measure 4 scenario: RH cascading run descending into octave 3.
  const rh3 = getPitchCoordinate(9, 3, 'RH', TOKENS, OPTIONS);
  assert.equal(rh3.isOutOfStaff, true);
  assert.equal(rh3.ledgerYs.length, 1);
  close(rh3.ledgerY as number, getEquatorYForOctave(3, 'RH', TOKENS, OPTIONS), 'RH o3 ledger');
  assert.equal(rh3.ledgerY, rh3.ledgerYs[0]);
  assert.ok(Number.isFinite(rh3.ledgerY as number));

  // LH reaching up into octave 4.
  const lh4 = getPitchCoordinate(0, 4, 'LH', TOKENS, OPTIONS);
  assert.equal(lh4.ledgerYs.length, 1);
  close(lh4.ledgerY as number, getEquatorYForOctave(4, 'LH', TOKENS, OPTIONS), 'LH o4 ledger');

  // Deep out-of-staff pitches accumulate every intervening equator, nearest first.
  const rh1 = getPitchCoordinate(0, 1, 'RH', TOKENS, OPTIONS);
  assert.deepEqual(
    rh1.ledgerYs,
    [3, 2, 1].map((oct) => getEquatorYForOctave(oct, 'RH', TOKENS, OPTIONS))
  );
  const lh5 = getPitchCoordinate(0, 5, 'LH', TOKENS, OPTIONS);
  assert.deepEqual(
    lh5.ledgerYs,
    [4, 5].map((oct) => getEquatorYForOctave(oct, 'LH', TOKENS, OPTIONS))
  );

  // Every ledger equator is a valid (finite) coordinate on the hand lattice.
  for (const hand of HANDS) {
    for (const oct of [0, 1, 6, 7]) {
      for (const y of getLedgerEquators(0, oct, hand, TOKENS, OPTIONS)) {
        assert.ok(Number.isFinite(y), `finite ledger y for ${hand} oct ${oct}`);
      }
    }
  }
});

test('Bach m. 4 RH octave-3 notes resolve to ledger equators in the rendered crop', () => {
  const score = buildBachGoldbergVar1Score();
  const measureTicks = TOKENS.ticksPerMeasure;
  const m4 = score.notes.filter(
    (n) => n.startTick >= 3 * measureTicks && n.startTick < 4 * measureTicks
  );
  const rhOct3 = m4.filter((n) => n.hand === 'RH' && n.pitch.octave === 3);
  assert.ok(rhOct3.length > 0, 'm. 4 must contain the RH run descending into octave 3');
  for (const n of rhOct3) {
    const c = getPitchCoordinate(n.pitch.pitchClass, n.pitch.octave, 'RH', TOKENS, OPTIONS);
    assert.ok(c.ledgerY !== null && Number.isFinite(c.ledgerY), 'ledger equator emitted');
  }
  const crop = renderJankoCrop(score, 4, 1, OPTIONS, TOKENS);
  assert.match(crop, /class="janko-ledger"/, 'm. 4 crop contains ledger equators');
});

test('Position of Honor halo ring (R = 5.4pt) is emitted at tick 0 of Measure 1', () => {
  close(TOKENS.haloRadius, 5.4, 'canonical halo radius');
  assert.match(renderHalo(10, 20, TOKENS), /r="5\.40"/);
  assert.match(renderHalo(10, 20), /r="5\.40"/, 'halo radius survives default tokens');

  const score = buildBachGoldbergVar1Score();
  const tickZero = score.notes.filter((n) => n.startTick === 0);
  assert.equal(tickZero.length, 2, 'Bach Variation 1 opens with two tick-0 sounds');
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const halos = crop.match(/class="janko-halo"/g) ?? [];
  assert.equal(halos.length, tickZero.length, 'one halo per opening sound');
  assert.match(crop, /r="5\.40"/);
  // Every halo sits inside Measure 1 (before the first internal barline).
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const m1Right = geo.staffLeft + geo.measureWidth;
  for (const m of crop.matchAll(/class="janko-halo" cx="([\d.]+)"/g)) {
    assert.ok(Number(m[1]) < m1Right, 'halo belongs to tick 0 of Measure 1');
  }
  // A crop of m. 2 must not place any halo inside the m. 2 x-span.
  const m2 = renderJankoCrop(score, 2, 1, OPTIONS, TOKENS);
  const m2Left = geo.staffLeft + geo.measureWidth;
  const m2Right = geo.staffLeft + 2 * geo.measureWidth;
  for (const m of m2.matchAll(/class="janko-halo" cx="([\d.]+)"/g)) {
    const cx = Number(m[1]);
    assert.ok(cx < m2Left || cx > m2Right, 'no later measure carries the opening halo');
  }
});

test('getTickX: measure insets, measure offsets and strict monotonicity', () => {
  const t = resolveJankoTokens(null);
  close(getTickX(0, 0, 0, 100, t), t.measureInset, 'first tick starts at the left inset');
  close(getTickX(144, 1, 0, 100, t), 100 + t.measureInset, 'second measure offset');
  const last = getTickX(143, 0, 143, 100, t);
  assert.ok(last <= 100 - t.measureInset + 1e-9, 'last tick stays inside the right inset');
  let prev = -Infinity;
  for (let tick = 0; tick < 144; tick += 6) {
    const x = getTickX(tick, 0, tick, 100, t);
    assert.ok(x > prev, `tick ${tick} must advance horizontally`);
    prev = x;
  }
  // Opening-measure time-signature clearance compresses the note field.
  const withTs = getTickX(0, 0, 0, 100, t, { left: 26, right: 6 });
  close(withTs, 26, 'time-signature inset');
  const tsEnd = getTickX(144, 0, 143, 100, t, { left: 26, right: 6 });
  assert.ok(tsEnd <= 100 - 6 + 1e-9, 'still inside the right inset');
});

// ---------------------------------------------------------------------------
// 2. Modular engine invariants
// ---------------------------------------------------------------------------

test('computePageGeometry: A4 portrait, accolade-anchored staff column, 3 systems', () => {
  const geo = computePageGeometry(OPTIONS, TOKENS);
  assert.equal(geo.systemsPerPage, 3);
  assert.equal(geo.measuresPerSystem, 4);
  assert.equal(geo.systems.length, 3);
  close(geo.staffLeft, geo.margin + TOKENS.accoladeWidth + TOKENS.accoladeGap, 'staff left');
  close(geo.measureWidth, geo.staffWidth / 4, 'measure width');
  close(geo.pageWidth, 595.28, 'A4 width');
  close(geo.pageHeight, 841.89, 'A4 height');
  for (const sys of geo.systems) {
    close(sys.equatorY('RH', 4) - sys.middleCY, -22.5, 'RH o4 above spine');
    close(sys.equatorY('LH', 3) - sys.middleCY, 22.5, 'LH o3 below spine');
    assert.ok(sys.staffTopY < sys.staffBotY);
  }
});

test('renderJankoPage: well-formed 3-system page with all rhythm styles available', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(countJankoPages(score, OPTIONS, TOKENS), 3);
  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);
  assert.ok(page.startsWith('<svg'), 'page starts with an svg root');
  assert.ok(page.trimEnd().endsWith('</svg>'), 'page closes the svg root');
  for (const s of [1, 2, 3]) assert.match(page, new RegExp(`id="system-${s}"`));
  assert.match(page, /Goldberg Variations/, 'Urtext header present');
  assert.match(page, /Page 1 of 3/);
  assert.ok(!page.includes('class="janko-time-signature"'), 'time signature removed by default');
  assert.ok(!page.includes('class="janko-octave-labels"'), 'octave indicators removed by default');
  assert.ok(!page.includes('class="janko-hand-labels"'), 'hand labels removed by default');
  assert.match(page, /class="janko-beat-line"/, 'beat grid pulse lines emitted by default');

  const withTs = renderJankoPage(score, 0, { ...OPTIONS, showTimeSignature: true }, TOKENS);
  assert.match(withTs, /3<\/text>[\s\S]*?4<\/text>/, 'opt-in time signature');

  const angled = renderJankoCrop(score, 1, 2, { ...OPTIONS, rhythmStyle: 'angled-cuts' }, TOKENS);
  const ticks = renderJankoCrop(score, 1, 2, { ...OPTIONS, rhythmStyle: 'horizontal-ticks' }, TOKENS);
  const beamed = renderJankoCrop(score, 1, 2, { ...OPTIONS, rhythmStyle: 'beamed' }, TOKENS);
  assert.match(angled, /class="janko-cut"/);
  assert.ok(!angled.includes('class="janko-beam"'), 'angled dialect emits no beams');
  assert.match(ticks, /class="janko-tick"/);
  assert.ok(!ticks.includes('class="janko-beam"'), 'lattice dialect emits no beams');
  assert.match(beamed, /class="janko-beam"/);
  assert.ok(!beamed.includes('class="janko-cut"'), 'beam dialect emits no angled cuts');
});

test('renderJankoCrop: crops are exact viewBox narrowings of the full page', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const box = computeCropBox(geo, 1, 4);
  assert.deepEqual(
    [box.firstSystem, box.lastSystem, box.firstMeasure, box.lastMeasure],
    [0, 0, 1, 4]
  );
  const crop = renderJankoCrop(score, 1, 4, OPTIONS, TOKENS);
  assert.match(crop, new RegExp(`viewBox="${box.x.toFixed(2)} ${box.y.toFixed(2)}`));

  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);
  const parseDigitPositions = (svg: string): string[] =>
    [...svg.matchAll(/class="janko-digit" x="([\d.]+)" y="([\d.]+)"/g)]
      .map((m) => `${m[1]},${m[2]}`)
      .sort();

  const system0 = geo.systems[0];
  const pageDigits = [...page.matchAll(/class="janko-digit" x="([\d.]+)" y="([\d.]+)"/g)]
    .filter((m) => {
      const y = Number(m[2]);
      return y >= system0.staffTopY - 40 && y <= system0.staffBotY + 20;
    })
    .map((m) => `${m[1]},${m[2]}`)
    .sort();
  assert.deepEqual(parseDigitPositions(crop), pageDigits, 'crop glyphs identical to page region');
});

test('Synthetic same-row 16th cluster 0 2 4 6 2 keeps strictly advancing x', () => {
  const cluster = [0, 2, 4, 6, 2];
  const notes = cluster.map((pc, i) =>
    makeNote(`cluster-${i}`, pc, 4, i * 12, 12, 'RH')
  );
  const score = makeScore(notes, 144);
  const crop = renderJankoCrop(score, 1, 1, OPTIONS, TOKENS);
  const positions = [...crop.matchAll(/class="janko-digit" x="([\d.]+)" y="([\d.]+)"/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]) })
  );
  assert.equal(positions.length, 5);
  for (let i = 1; i < positions.length; i++) {
    assert.ok(positions[i].x > positions[i - 1].x, 'cluster must advance left-to-right');
    assert.ok(
      positions[i].x - positions[i - 1].x > TOKENS.noteheadRadius,
      'adjacent 16ths must not collapse onto one another'
    );
  }
  // 0, 2, 4, 6, 2 are all rank 0: one shared whole-tone row.
  for (const p of positions) close(p.y, positions[0].y, 'same-row cluster shares one y');
});

test('renderJankoVariantComparison: A/B/C contact sheet over the same measures', () => {
  const score = buildBachGoldbergVar1Score();
  const sheet = renderJankoVariantComparison(score, undefined, 1, 4, OPTIONS, TOKENS);
  assert.ok(sheet.startsWith('<svg'));
  assert.ok(sheet.trimEnd().endsWith('</svg>'));
  for (const label of [
    'Variant A: Angled Cuts',
    'Variant B: Traditional Beams',
    'Variant C: Unified Continuous Lattice',
  ]) {
    assert.ok(sheet.includes(label), `contact sheet must label ${label}`);
  }
  for (const id of ['angled-cuts', 'beamed', 'horizontal-ticks']) {
    assert.match(sheet, new RegExp(`data-variant="${id}"`));
  }
  // One panel per variant, each containing a full 4-measure system.
  assert.equal((sheet.match(/class="janko-variant-panel"/g) ?? []).length, 3);
  assert.equal((sheet.match(/id="system-1"/g) ?? []).length, 3);
  assert.match(sheet, /class="janko-cut"/);
  assert.match(sheet, /class="janko-beam"/);
  assert.match(sheet, /class="janko-tick"/);
});

test('Token/option overrides flow through every renderer (pluggable design)', () => {
  const score = buildBachGoldbergVar1Score();
  const tokens = resolveJankoTokens({ rowHeight: 18, noteheadRadius: 5, haloRadius: 6.4 });
  const options = resolveJankoOptions({ middleCSpine: 'double', interStaffGap: 60 });
  close(tokens.octaveStep, 30, 'octaveStep keeps its canonical default');
  const crop = renderJankoCrop(score, 1, 1, options, tokens);
  assert.match(crop, /r="6\.40"/, 'halo override');
  assert.match(crop, /r="5\.00"/, 'notehead override');
  const geo = computePageGeometry(options, tokens);
  close(geo.systems[0].equatorY('RH', 4) - geo.systems[0].middleCY, -30, 'interStaffGap override');
});

test('Subdivision Invariant: beat grid replaces time signature, octave/hand labels removed, beamed rhythm default', () => {
  const score = buildBachGoldbergVar1Score();
  // 1. Defaults align with user mandate
  assert.equal(DEFAULT_JANKO_OPTIONS.rhythmStyle, 'beamed');
  assert.equal(DEFAULT_JANKO_OPTIONS.showOctaveLabels, false);
  assert.equal(DEFAULT_JANKO_OPTIONS.showHandLabels, false);
  assert.equal(DEFAULT_JANKO_OPTIONS.showTimeSignature, false);
  assert.equal(DEFAULT_JANKO_OPTIONS.showBeatGrid, true);
  assert.equal(DEFAULT_JANKO_OPTIONS.timeSignatureWidth, 0);

  // 2. Full-page engraving contains no octave labels, no hand labels, no time signatures
  const page = renderJankoPage(score, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.ok(!page.includes('class="janko-octave-label"'));
  assert.ok(!page.includes('class="janko-hand-label"'));
  assert.ok(!page.includes('class="janko-time-signature"'));

  // 3. Beat grid pulse lines are emitted for beats 2 and 3 in every measure
  const beatMatches = [...page.matchAll(/class="janko-beat-line"/g)];
  // 3 systems * 4 measures/system * 2 beats/measure * 2 hands (RH + LH) = 48 lines
  assert.equal(beatMatches.length, 3 * 4 * 2 * 2);
  assert.match(page, /stroke="#D1D5DB" stroke-width="0\.50" stroke-dasharray="2,3"/);

  // 4. Macro crop mm. 1–2 carries beat lines on beats 2 and 3 (system 0 DOM has 4 mm * 4 lines = 16)
  const crop = renderJankoCrop(score, 1, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const cropBeatLines = [...crop.matchAll(/class="janko-beat-line"/g)];
  assert.equal(cropBeatLines.length, 4 * 2 * 2);

  // 5. Notes use beamed rhythm by default
  assert.match(crop, /class="janko-beam"/);
});

// ---------------------------------------------------------------------------
// 3. Export suite invariant
// ---------------------------------------------------------------------------

test('npm run janko:export produces all five PNGs everywhere in under 2 seconds', () => {
  const started = Date.now();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/render_janko_suite.ts'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const elapsed = Date.now() - started;

  const mirrors = (root: string): string[] => [
    path.join(root, ''),
    path.join(root, 'public'),
    path.join(root, 'docs', 'img'),
  ];
  for (const name of EXPORT_NAMES) {
    for (const dir of mirrors(REPO_ROOT)) {
      const p = path.join(dir, name);
      assert.ok(fs.existsSync(p), `${name} must exist in ${dir}`);
      assert.ok(fs.statSync(p).size > 1000, `${name} in ${dir} must be a real rasterization`);
    }
  }
  if (fs.existsSync(MAIN_CHECKOUT)) {
    for (const name of EXPORT_NAMES) {
      for (const dir of mirrors(MAIN_CHECKOUT)) {
        assert.ok(fs.existsSync(path.join(dir, name)), `${name} must be mirrored to ${dir}`);
      }
    }
  }

  assert.ok(elapsed < 2000, `export suite must finish under 2s (took ${elapsed}ms)`);
});
