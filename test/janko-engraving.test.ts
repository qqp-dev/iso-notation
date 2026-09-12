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
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  renderJankoVariantComparison,
} from '../src/render/janko/engine';
import {
  getStemGeometry,
  partitionBeamGroups,
} from '../src/render/janko/elements/rhythm';
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
// 3. Rhythm engraving: centred stems, standard flags, collision-free beams
// ---------------------------------------------------------------------------

/** Perpendicular distance from a point to a line segment (page pt). */
function segmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / len2));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

/** Stem length of one beamed note, measured along the stem direction. */
function stemLengthTo(
  beam: { direction: -1 | 1; beamY(x: number): number },
  note: { x: number; y: number }
): number {
  return beam.direction === -1 ? note.y - beam.beamY(note.x) : beam.beamY(note.x) - note.y;
}

test('Stem centring: every note of every rhythm dialect centres its stem on the note column', () => {
  const score = buildBachGoldbergVar1Score();
  const styles = ['beamed', 'angled-cuts', 'horizontal-ticks'] as const;
  for (const rhythmStyle of styles) {
    const layouts = layoutJankoScore(score, { ...OPTIONS, rhythmStyle }, TOKENS);
    assert.equal(layouts.length, 8, `${rhythmStyle}: eight systems`);
    let notes = 0;
    let beamStems = 0;
    for (const layout of layouts) {
      for (const p of layout.notes) {
        close(
          getStemGeometry(p.rhythm, TOKENS).stemX,
          p.x,
          `stem column of ${p.note.id} (${rhythmStyle})`
        );
        notes++;
      }
      for (const beam of layout.beams) {
        for (let i = 0; i < beam.stems.length; i++) {
          close(beam.stems[i].stemX, beam.notes[i].x, `beam stem column (${rhythmStyle})`);
          beamStems++;
        }
      }
    }
    assert.ok(notes >= score.notes.length / 8, `${rhythmStyle}: notes were laid out`);
    if (rhythmStyle === 'beamed') assert.ok(beamStems > 100, 'the beamed dialect beams its stems');
  }

  // SVG level: every engraved stem is a perfectly vertical line whose column is
  // a notehead centre — no perimeter offset survives into the document.
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const columns = new Set(
    layoutJankoScore(score, OPTIONS, TOKENS)[0].notes.map((p) => p.x.toFixed(2))
  );
  const stemLines = [
    ...crop.matchAll(/class="janko-stem" x1="([\d.]+)" y1="[\d.]+" x2="([\d.]+)"/g),
  ];
  assert.ok(stemLines.length > 0, 'the crop engraves stems');
  for (const m of stemLines) {
    assert.equal(m[1], m[2], 'a stem must be perfectly vertical');
    assert.ok(columns.has(m[1]), `stem column ${m[1]} must be a notehead centre`);
  }
});

test('Unbeamed notes carry standard flags, never a crossbar through the stem', () => {
  const score = buildBachGoldbergVar1Score();
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const system0 = layoutJankoScore(score, OPTIONS, TOKENS)[0];

  // The beamed dialect draws neither perpendicular ticks nor slash cuts.
  assert.ok(!crop.includes('class="janko-tick"'), 'no duration crossbar in the beamed dialect');
  assert.ok(!crop.includes('class="janko-cut"'), 'no angled cut in the beamed dialect');

  const ungrouped = system0.ungrouped;
  const expectedFlags = ungrouped.reduce(
    (sum, n) => sum + (n.durationTicks <= 14 ? 2 : n.durationTicks <= 38 ? 1 : 0),
    0
  );
  const expectedDots = ungrouped.filter(
    (n) => n.durationTicks > 26 && n.durationTicks <= 38
  ).length;
  const flags = [
    ...crop.matchAll(
      /class="janko-flag" data-stem-x="([\d.]+)" data-flag-index="(\d)" d="([^"]+)"/g
    ),
  ];
  assert.equal(flags.length, expectedFlags, 'one flag per 8th, two flags per 16th');
  assert.equal(
    (crop.match(/class="janko-augmentation-dot"/g) ?? []).length,
    expectedDots,
    'one augmentation dot per dotted solitary value'
  );

  // Standard flag geometry: the hook starts on the stem, stays strictly right
  // of it, and never reaches beyond its tokenised width.
  for (const m of flags) {
    const stemX = Number(m[1]);
    const numbers = [...m[3].matchAll(/-?\d+(?:\.\d+)?/g)].map((x) => Number(x[0]));
    const xs = numbers.filter((_, i) => i % 2 === 0);
    assert.ok(numbers.length >= 2 && numbers.length % 2 === 0, 'flag path samples come in x/y pairs');
    assert.equal(xs[0], stemX, 'the flag latches onto the stem tip');
    for (const x of xs) {
      assert.ok(x >= stemX - 1e-9, `flag sample x=${x} must not cross the stem at ${stemX}`);
    }
    assert.ok(
      Math.max(...xs) - stemX <= TOKENS.flagWidth + 1e-9,
      'the flag keeps its tokenised horizontal reach'
    );
  }

  // mm. 1–2: the solitary dotted 8ths of pitch 7 (m. 1) and pitch 2 (m. 2).
  const dotted = ungrouped.filter((n) => n.durationTicks > 26 && n.durationTicks <= 38);
  assert.deepEqual(dotted.map((n) => n.startTick), [24, 168, 312], 'three solitary dotted 8ths');
  const opening = dotted.filter((n) => n.startTick < 2 * TOKENS.ticksPerMeasure);
  assert.deepEqual(opening.map((n) => n.startTick), [24, 168], 'm. 1 pitch 7 · m. 2 pitch 2');
  for (const n of opening) {
    const noteFlags = flags.filter((m) => Math.abs(Number(m[1]) - n.x) < 0.02);
    assert.equal(noteFlags.length, 1, `${n.id} carries exactly one flag`);
    assert.ok(
      crop.includes(
        `class="janko-augmentation-dot" cx="${(n.x + TOKENS.noteheadRadius + 3.2).toFixed(2)}" cy="${n.y.toFixed(2)}"`
      ),
      `${n.id} carries its augmentation dot`
    );
  }
});

test('Beam clearance: every notehead keeps a full stem length to its beam (mm. 2 & 4 ascents)', () => {
  const score = buildBachGoldbergVar1Score();
  const layouts = layoutJankoScore(score, OPTIONS, TOKENS);
  const required = TOKENS.noteheadRadius + TOKENS.minStemClearance;
  let beams = 0;
  let worst = Infinity;
  let worstNote = '';
  for (const layout of layouts) {
    for (const beam of layout.beams) {
      beams++;
      assert.ok(
        Math.abs(beam.slope) <= TOKENS.maxBeamSlope + 1e-9,
        `slope clamp survives the beam elevation (${beam.slope})`
      );
      for (const n of beam.notes) {
        const stemLen = stemLengthTo(beam, n);
        if (stemLen < worst) {
          worst = stemLen;
          worstNote = n.id;
        }
        assert.ok(
          stemLen >= required - 1e-9,
          `${n.id} keeps ${stemLen.toFixed(2)}pt of stem (${required.toFixed(2)}pt required)`
        );
      }
      // No connector — primary or 16th secondary — may cut a notehead disc.
      const connectors = [beam.primary, ...(beam.secondary ? [beam.secondary] : [])];
      for (const c of connectors) {
        for (const p of layout.notes) {
          if (p.x < Math.min(c.x1, c.x2) - required || p.x > Math.max(c.x1, c.x2) + required) {
            continue;
          }
          const distance = segmentDistance(p.x, p.y, c.x1, c.y1, c.x2, c.y2);
          assert.ok(
            distance >= required - 1e-9,
            `${p.note.id} clears the beam by only ${distance.toFixed(2)}pt ` +
              `(${required.toFixed(2)}pt required; beam ${beam.notes.map((n) => n.id).join('+')})`
          );
        }
      }
    }
  }
  assert.ok(beams > 100, 'the score is beamed');
  assert.ok(worst >= TOKENS.stemLength - 1e-9, `every extreme head keeps the full stem (${worstNote})`);

  // The ticket's ascending runs: m. 2 (pitch 1 after pitch 2 at tick 156) and
  // m. 4 (tick 540) previously had the beam driven through the upper notehead.
  for (const tick of [156, 540]) {
    const beam = layouts[0].beams.find((b) => b.notes.some((n) => n.startTick === tick));
    assert.ok(beam, `m. ${Math.floor(tick / 144) + 1} tick ${tick} belongs to a beam group`);
    for (const n of beam.notes) {
      assert.ok(
        stemLengthTo(beam, n) >= TOKENS.stemLength - 1e-9,
        `${n.id} (tick ${n.startTick}) keeps a real stem between head and beam`
      );
    }
  }
});

test('No beam group straddles an intervening longer value of the same hand', () => {
  const score = buildBachGoldbergVar1Score();
  for (const layout of layoutJankoScore(score, OPTIONS, TOKENS)) {
    for (const beam of layout.beams) {
      const lo = beam.notes[0].startTick;
      const hi = beam.notes[beam.notes.length - 1].startTick;
      const hand = beam.notes[0].hand;
      const interlopers = score.notes.filter(
        (n) =>
          n.hand === hand &&
          n.startTick > lo &&
          n.startTick < hi &&
          !beam.notes.some((g) => g.id === n.id)
      );
      assert.deepEqual(
        interlopers.map((n) => n.id),
        [],
        `beam [${beam.notes.map((n) => n.id).join(', ')}] must not straddle another notehead`
      );
    }
  }

  // Partition level: a dotted 8th between two 16ths splits them apart (m. 22).
  const notes = layoutJankoScore(score, OPTIONS, TOKENS)[5].notes.map((p) => p.rhythm);
  const partition = partitionBeamGroups(notes, TOKENS);
  const m22 = [3036, 3060];
  assert.deepEqual(
    partition.groups
      .filter((g) => g.some((n) => m22.includes(n.startTick)))
      .map((g) => g.map((n) => n.startTick)),
    [],
    'the dotted 8th at tick 3048 breaks the m. 22 run instead of being straddled'
  );
  assert.deepEqual(
    partition.ungrouped.filter((n) => m22.includes(n.startTick)).map((n) => n.startTick),
    m22,
    'both isolated 16ths fall back to standard flags'
  );
});

// ---------------------------------------------------------------------------
// 4. Export suite invariant
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
