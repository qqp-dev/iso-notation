/**
 * Jánko Engraving Ergonomics Harness — invariant test suite.
 *
 * Covers:
 *  1. Jánko geometry & pitch isomorphism (rank mapping, row/octave steps,
 *     dynamic ledger equators, Position of Honor halo).
 *  2. The modular engine (page/crop/variant SVG composition).
 *  3. The unified export suite (`npm run janko:export`) and its twelve PNGs —
 *     including the Round 4 four-paradigm domain sheet and the Brahms Op. 118
 *     No. 1 pressure benchmark — in every delivery location, inside the
 *     3-second budget.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Hand, QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildChordDurationSpecimenScore } from '../src/scores/chord-duration-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CHANNEL_LAYOUTS,
  JANKO_FINAL_BARLINE_STYLES,
  JANKO_REST_STYLES,
  JANKO_STAFF_OCTAVES,
  JANKO_SUBDIVISION_STYLES,
  JANKO_SYSTEM_START_STYLES,
  JankoRestStyle,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  getChannelLayoutSpec,
  getEquatorYForOctave,
  getFlankOffset,
  getLedgerEquators,
  getPitchCoordinate,
  getTickX,
  getWholeToneRank,
  isOutOfStaffOctave,
  resolveChannelFlanks,
  usesContourFlanks,
} from '../src/render/janko/geometry';
import { getEquatorRuleYs } from '../src/render/janko/elements/staff';
import {
  computeCropBox,
  computePageGeometry,
  countJankoPages,
  countJankoSystems,
  getChordalOffset,
  getSystemGeometry,
  getMarginFurniture,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  renderJankoVariantComparison,
  renderSystem,
  resolveRestY,
  restClearsLayout,
  REST_FIT_MARGIN,
  REST_POCKET_AIR,
} from '../src/render/janko/engine';
import {
  JankoRhythmNote,
  getStemAttachmentRadii,
  getStemAttachmentRadius,
  getStemGeometry,
  partitionBeamGroups,
  renderChordClasp,
  renderFlags,
  renderSubdivisionMark,
  subdivisionMarkCount,
  computeClaspGeometry,
  SUBDIVISION_TAB_30_TAN,
  SUBDIVISION_TAPER_ROOT,
  SUBDIVISION_URTEXT_STROKE,
} from '../src/render/janko/elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
  renderHalo,
} from '../src/render/janko/elements/notehead';
import { ARCHITECTURAL_BRACKET_FLARE_DEGREES } from '../src/render/janko/elements/accolade';
import { restInkBox } from '../src/render/janko/elements/rests';
import { lintJankoScore } from '../src/render/janko/linter';

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
  'janko_domain_exploration.png',
  'janko_domain_a.png',
  'janko_domain_b.png',
  'janko_domain_c.png',
  'janko_domain_d.png',
  // Brahms Op. 118 No. 1 — the harmonic row-collision pressure benchmark.
  'janko_brahms_page1.png',
  'janko_brahms_m7_m8.png',
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

test('Unified global equator lattice: absolute coordinates, identical for both hands', () => {
  // One absolute lattice: the same octave resolves to one coordinate whichever
  // hand plays it.
  for (let oct = 1; oct <= 6; oct++) {
    close(
      getEquatorYForOctave(oct, 'RH', TOKENS, OPTIONS),
      getEquatorYForOctave(oct, 'LH', TOKENS, OPTIONS),
      `octave ${oct} equator is hand-independent`
    );
  }

  // The four continuous staff rules of the grand staff. Round 11 equalizes the
  // lattice: o5 -45, o4 -15, Middle C 0, o3 +15, o2 +45.
  for (const hand of HANDS) {
    close(getEquatorYForOctave(5, hand, TOKENS, OPTIONS), -45.0, `o5 staff rule (${hand})`);
    close(getEquatorYForOctave(4, hand, TOKENS, OPTIONS), -15.0, `o4 staff rule (${hand})`);
    close(getEquatorYForOctave(3, hand, TOKENS, OPTIONS), +15.0, `o3 staff rule (${hand})`);
    close(getEquatorYForOctave(2, hand, TOKENS, OPTIONS), +45.0, `o2 staff rule (${hand})`);
  }
  close(OPTIONS.interStaffGap, TOKENS.octaveStep, 'the corridor is exactly one octave step');

  // Every octave steps by exactly 2h (30pt) — including the Middle C corridor,
  // which is no wider than any other octave step.
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      const lower = getEquatorYForOctave(oct, hand, TOKENS, OPTIONS);
      const upper = getEquatorYForOctave(oct + 1, hand, TOKENS, OPTIONS);
      assert.ok(upper < lower, 'higher octaves must climb upward on the page');
      close(lower - upper, TOKENS.octaveStep, `octave step ${oct}->${oct + 1} (${hand})`);
    }
  }

  // A pitch's engraved height never depends on the hand that plays it.
  for (let pc = 0; pc < 12; pc++) {
    for (let oct = 0; oct <= 7; oct++) {
      const rh = getPitchCoordinate(pc, oct, 'RH', TOKENS, OPTIONS);
      const lh = getPitchCoordinate(pc, oct, 'LH', TOKENS, OPTIONS);
      close(rh.equatorY, lh.equatorY, `pc ${pc} oct ${oct} equator`);
      close(rh.y, lh.y, `pc ${pc} oct ${oct} notehead y`);
      assert.equal(rh.isOutOfStaff, lh.isOutOfStaff, `pc ${pc} oct ${oct} staff membership`);
    }
  }
});

test('Out-of-staff octaves are strictly octave < 2 || octave > 5', () => {
  const [minOct, maxOct] = JANKO_STAFF_OCTAVES;
  assert.deepEqual([minOct, maxOct], [2, 5], 'the grand staff spans octaves 2–5');
  for (let oct = -1; oct <= 8; oct++) {
    const expected = oct < minOct || oct > maxOct;
    for (const hand of HANDS) {
      assert.equal(isOutOfStaffOctave(oct, hand), expected, `${hand} octave ${oct} out-of-staff`);
      const c = getPitchCoordinate(0, oct, hand, TOKENS, OPTIONS);
      assert.equal(c.isOutOfStaff, expected, `${hand} octave ${oct} coordinate`);
      assert.equal(c.ledgerYs.length === 0, !expected, `${hand} octave ${oct} ledger presence`);
    }
  }
});

test('Symmetrical spine-free corridor anchors the two inner staff rules (o4 −15pt / o3 +15pt)', () => {
  close(OPTIONS.interStaffGap, 30.0, 'Round 11 equalizes the corridor to the 30pt octave step');
  close(getEquatorYForOctave(4, 'RH', TOKENS, OPTIONS), -15.0, 'RH o4 equator');
  close(getEquatorYForOctave(3, 'LH', TOKENS, OPTIONS), 15.0, 'LH o3 equator');
  close(getEquatorYForOctave(5, 'RH', TOKENS, OPTIONS), -45.0, 'RH o5 equator');
  close(getEquatorYForOctave(2, 'LH', TOKENS, OPTIONS), 45.0, 'LH o2 equator');
});

test('Dynamic ledger equators: only octaves outside the grand staff accumulate', () => {
  // Every staff octave (2–5) is a continuous rule shared by both hands: no
  // ledger line may ever be generated for it, whichever hand plays the note.
  for (const hand of HANDS) {
    for (let oct = 2; oct <= 5; oct++) {
      for (let pc = 0; pc < 12; pc++) {
        const c = getPitchCoordinate(pc, oct, hand, TOKENS, OPTIONS);
        assert.equal(c.isOutOfStaff, false, `${hand} oct ${oct} is in staff`);
        assert.equal(c.ledgerYs.length, 0, `${hand} oct ${oct} needs no ledger`);
        assert.equal(c.ledgerY, null);
      }
    }
  }

  // Measure 4 scenario: the RH cascading run descends onto the true o3 rule —
  // the exact y where the old hand-relative lattice grew a phantom ledger
  // floating inside the corridor.
  const rh3 = getPitchCoordinate(9, 3, 'RH', TOKENS, OPTIONS);
  assert.equal(rh3.isOutOfStaff, false);
  close(rh3.equatorY, getEquatorYForOctave(3, 'LH', TOKENS, OPTIONS), 'RH o3 shares the LH o3 rule');
  close(rh3.equatorY, 15.0, 'RH o3 is the true staff rule');
  assert.equal(rh3.ledgerY, null);

  // Measure 3 scenario: the LH reaching up into octave 4 lands on the o4 rule.
  const lh4 = getPitchCoordinate(0, 4, 'LH', TOKENS, OPTIONS);
  assert.equal(lh4.isOutOfStaff, false);
  close(lh4.equatorY, getEquatorYForOctave(4, 'RH', TOKENS, OPTIONS), 'LH o4 shares the RH o4 rule');
  close(lh4.equatorY, -15.0, 'LH o4 is the true staff rule');
  assert.equal(lh4.ledgerY, null);

  // Outside the staff every intervening equator accumulates, nearest first.
  const rh6 = getPitchCoordinate(0, 6, 'RH', TOKENS, OPTIONS);
  assert.deepEqual(rh6.ledgerYs, [getEquatorYForOctave(6, 'RH', TOKENS, OPTIONS)]);
  assert.equal(rh6.isOutOfStaff, true);
  const lh1 = getPitchCoordinate(0, 1, 'LH', TOKENS, OPTIONS);
  assert.deepEqual(lh1.ledgerYs, [getEquatorYForOctave(1, 'LH', TOKENS, OPTIONS)]);
  const rh1 = getPitchCoordinate(0, 1, 'RH', TOKENS, OPTIONS);
  assert.deepEqual(
    rh1.ledgerYs,
    [1].map((oct) => getEquatorYForOctave(oct, 'RH', TOKENS, OPTIONS))
  );
  const lh7 = getPitchCoordinate(0, 7, 'LH', TOKENS, OPTIONS);
  assert.deepEqual(
    lh7.ledgerYs,
    [6, 7].map((oct) => getEquatorYForOctave(oct, 'LH', TOKENS, OPTIONS))
  );

  // Every ledger equator of an out-of-staff octave clears the staff entirely.
  for (const hand of HANDS) {
    for (const oct of [-1, 0, 1, 6, 7, 8]) {
      for (const y of getLedgerEquators(0, oct, hand, TOKENS, OPTIONS)) {
        assert.ok(Number.isFinite(y), `finite ledger y for ${hand} oct ${oct}`);
        assert.ok(y < -58 || y > 58, `ledger at ${y}pt stays outside the staff rules`);
      }
    }
  }
});

test('Zero corridor ledger cuts across the canonical Bach score (mm. 3 & 4 included)', () => {
  const score = buildBachGoldbergVar1Score();
  const layouts = layoutJankoScore(score, OPTIONS, TOKENS);
  const staffRules = [5, 4, 3, 2].map((oct) => getEquatorYForOctave(oct, 'RH', TOKENS, OPTIONS));
  // The old hand-relative lattice put LH o4 at -2pt and RH o3 at +2pt, deep
  // inside the corridor: those phantom offsets may never come back.
  const phantomOffsets = [-2.0, 2.0];

  let ledgers = 0;
  for (const layout of layouts) {
    for (const p of layout.notes) {
      for (const ledgerY of p.coord.ledgerYs) {
        ledgers++;
        // The corridor [-28, +28] must never carry a ledger cut ...
        assert.ok(
          ledgerY <= -28 - 1e-9 || ledgerY >= 28 + 1e-9,
          `${p.note.id} (${p.coord.hand} o${p.coord.octave}) emits a ledger at ${ledgerY}pt ` +
            'inside the corridor'
        );
        // ... no ledger may sit on one of the four continuous staff rules ...
        for (const rule of staffRules) {
          assert.ok(
            Math.abs(ledgerY - rule) > 1e-9,
            `ledger at ${ledgerY}pt coincides with the ${rule}pt staff rule`
          );
        }
        // ... and every surviving ledger is a genuine out-of-staff rule.
        assert.ok(
          ledgerY < -58 - 1e-9 || ledgerY > 58 + 1e-9,
          `ledger at ${ledgerY}pt must stay outside the grand staff`
        );
      }
    }
  }
  assert.ok(ledgers > 0, 'the octave-6 excursions still carry their dynamic ledger');

  // Measure 3: the LH octave-4 notes sit on the true o4 rule with no ledger.
  const sys0 = layouts[0];
  const o4Rule = sys0.geometry.equatorY('RH', 4);
  const o3Rule = sys0.geometry.equatorY('LH', 3);
  const lh4 = sys0.notes.filter((p) => p.coord.hand === 'LH' && p.coord.octave === 4);
  assert.ok(lh4.length > 0, 'm. 3 contains LH octave-4 notes');
  for (const p of lh4) {
    close(p.coord.equatorY, -15.0, `${p.note.id} LH o4 equator`);
    close(p.y, o4Rule + p.coord.offsetFromEquator, `${p.note.id} head sits on the o4 staff rule`);
    assert.equal(p.coord.ledgerY, null, `${p.note.id} carries no ledger`);
  }

  // Measure 4: the RH octave-3 run sits on the true o3 rule with no ledger.
  const rh3 = sys0.notes.filter((p) => p.coord.hand === 'RH' && p.coord.octave === 3);
  assert.ok(rh3.length > 0, 'm. 4 contains RH octave-3 notes');
  for (const p of rh3) {
    close(p.coord.equatorY, 15.0, `${p.note.id} RH o3 equator`);
    close(p.y, o3Rule + p.coord.offsetFromEquator, `${p.note.id} head sits on the o3 staff rule`);
    assert.equal(p.coord.ledgerY, null, `${p.note.id} carries no ledger`);
  }

  // Document level: neither measure engraves a single floating ledger cut, and
  // both true staff rules are painted continuously across the measure.
  for (const measure of [3, 4]) {
    const crop = renderJankoCrop(score, measure, 1, OPTIONS, TOKENS);
    assert.ok(
      crop.includes(`y1="${o4Rule.toFixed(2)}"`) && crop.includes(`y1="${o3Rule.toFixed(2)}"`),
      `m. ${measure} paints the continuous o4 and o3 staff rules`
    );
    assert.ok(
      !crop.includes('class="janko-ledger"'),
      `m. ${measure} must not emit a phantom ledger inside the corridor`
    );
    for (const offset of phantomOffsets) {
      const y = (sys0.geometry.middleCY + offset).toFixed(2);
      assert.ok(
        !new RegExp(`class="janko-ledger"[^>]*y1="${y}"`).test(crop),
        `m. ${measure} has no ledger at the old phantom y=${y}`
      );
    }
  }
});

test('Position of Honor halo ring (R = 6.2pt) is emitted at tick 0 of Measure 1', () => {
  close(TOKENS.haloRadius, 6.2, 'canonical halo radius');
  assert.match(renderHalo(10, 20, TOKENS), /r="6\.20"/);
  assert.match(renderHalo(10, 20), /r="6\.20"/, 'halo radius survives default tokens');

  const score = buildBachGoldbergVar1Score();
  const tickZero = score.notes.filter((n) => n.startTick === 0);
  assert.equal(tickZero.length, 2, 'Bach Variation 1 opens with two tick-0 sounds');
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const halos = crop.match(/class="janko-halo"/g) ?? [];
  assert.equal(halos.length, tickZero.length, 'one halo per opening sound');
  assert.match(crop, /r="6\.20"/);
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
    close(sys.equatorY('RH', 4) - sys.middleCY, -15.0, 'RH o4 above spine');
    close(sys.equatorY('LH', 3) - sys.middleCY, 15.0, 'LH o3 below spine');
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
  assert.match(page, /Goldberg-Variationen/, 'Urtext header present');
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

test('Clean Urtext subtitle: the page header carries no system branding', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(DEFAULT_JANKO_OPTIONS.subtitle, 'Variatio 1. a 1 Clav.');

  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);
  const header = page.match(/<g id="page-header">[\s\S]*?<\/g>/)?.[0] ?? '';
  assert.ok(header.length > 0, 'the page carries a header group');
  assert.match(header, /class="janko-subtitle"[^>]*>Variatio 1\. a 1 Clav\.<\/text>/);
  assert.match(header, /class="janko-meta"[^>]*>Johann Sebastian Bach<\/text>/);
  assert.ok(
    !header.includes('Jánko Two-Row Equator System'),
    'no notation branding may sit beside Bach’s name'
  );
  assert.ok(
    !page.includes('Jánko Two-Row Equator System'),
    'the branding is gone from the engraving'
  );

  // Round 10: the footer is the page numbering alone — the repetitive
  // "Pure 12-TET Jánko Two-Row Grand Staff" slogan is gone, the figures are
  // unbolded and the only ink left is `Page N of M`.
  const footer = page.match(/<g id="page-footer">[\s\S]*?<\/g>/)?.[0] ?? '';
  assert.ok(!footer.includes('Pure 12-TET'), 'the footer slogan is retired');
  assert.match(footer, /class="janko-page-num"[^>]*>Page 1 of 3<\/text>/);
  assert.ok(!footer.includes('font-weight="bold"'), 'the page number is not bolded');
  const css = page.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.match(
    css,
    /\.janko-page-num \{[^}]*fill: #666666; font-weight: 400; \}/,
    'the page number is normal weight in #666666'
  );
});

test('Round 10 multi-page headers: full title block on page 1, running header after', () => {
  const score = buildBachGoldbergVar1Score();
  const first = renderJankoPage(score, 0, OPTIONS, TOKENS);
  const firstHeader = first.match(/<g id="page-header">[\s\S]*?<\/g>/)?.[0] ?? '';
  assert.match(firstHeader, /class="janko-title"/, 'page 1 carries the full title');

  for (const pageIndex of [1, 2]) {
    const page = renderJankoPage(score, pageIndex, OPTIONS, TOKENS);
    const header = page.match(/<g id="page-header">[\s\S]*?<\/g>/)?.[0] ?? '';
    assert.ok(header.length > 0, `page ${pageIndex + 1} carries a header group`);
    assert.ok(!header.includes('class="janko-title"'), 'no large title block after page 1');
    assert.ok(!header.includes('class="janko-subtitle"'), 'no subtitle block after page 1');
    assert.ok(!header.includes('class="janko-meta"'), 'no composer block after page 1');
    const geo = computePageGeometry(OPTIONS, TOKENS);
    assert.match(
      header,
      new RegExp(
        `<text x="${geo.margin.toFixed(2)}" y="${(geo.margin + 10).toFixed(2)}" class="janko-running-head">` +
          'Johann Sebastian Bach · Goldberg-Variationen · Variatio 1\\. a 1 Clav\\.</text>'
      ),
      `page ${pageIndex + 1} carries the discreet running header at margin + 10`
    );
    assert.match(page, new RegExp(`Page ${pageIndex + 1} of 3`));
  }
  const css = first.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.match(
    css,
    /\.janko-running-head \{[^}]*font-style: italic; font-size: 7pt; fill: #555555; \}/,
    'the running header is 7pt serif italic #555555'
  );
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

// ---------------------------------------------------------------------------
// 1b. Row-Snapped Parity Offset (Approach 2)
// ---------------------------------------------------------------------------

/** The chord under test: C4–E4–G4, i.e. [0, 4, 7] on one onset. */
function majorTriad(): QuantizedGridScore {
  return makeScore(
    [
      makeNote('triad-c', 0, 4, 0, 96, 'RH'),
      makeNote('triad-e', 4, 4, 0, 96, 'RH'),
      makeNote('triad-g', 7, 4, 0, 96, 'RH'),
    ],
    144
  );
}

test('Row-snapped parity offset: same-row chord tones spread symmetrically around the beat', () => {
  const layout = layoutJankoScore(majorTriad(), OPTIONS, TOKENS)[0];
  const byId = new Map(layout.notes.map((p) => [p.note.id, p]));
  const c = byId.get('triad-c')!;
  const e = byId.get('triad-e')!;
  const g = byId.get('triad-g')!;
  const delta = getChordalOffset(TOKENS);

  // C4 and E4 are both rank 0 of octave 4: one lattice point before the offset.
  assert.equal(c.coord.rank, 0);
  assert.equal(e.coord.rank, 0);
  assert.equal(c.y, e.y, 'the two heads keep one row y');
  close(Math.abs(e.x - c.x), delta, 'the pair is spread by exactly one chordal offset');
  assert.ok(delta >= 2 * TOKENS.noteheadRadius, 'Δx covers a full notehead disc');

  // …and symmetrically: the pair straddles the untouched beat column, which the
  // different-row third of the triad still occupies exactly.
  const nominal = g.x;
  close((c.x + e.x) / 2, nominal, 'the pair is centred on the beat column');
  close(Math.min(c.x, e.x), nominal - delta / 2, 'the lower head sits half an offset left');
  close(Math.max(c.x, e.x), nominal + delta / 2, 'the upper head sits half an offset right');

  // G4 is rank 1: a different row, so it never moves off the beat column, and
  // the isomorphic Δ hand shape survives.
  assert.equal(g.coord.rank, 1);
  assert.notEqual(g.y, c.y);
});

test('Row-snapped parity offset: every note keeps its true row y and its beat column', () => {
  const score = makeScore(
    [
      makeNote('chord-c', 0, 4, 48, 48, 'LH'),
      makeNote('chord-e', 4, 4, 48, 48, 'RH'),
      makeNote('chord-g', 7, 4, 48, 48, 'RH'),
      makeNote('next-d', 2, 4, 96, 48, 'RH'),
    ],
    144
  );
  const layout = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  const tickX = (tick: number): number =>
    layout.geometry.staffLeft +
    getTickX(tick, 0, tick, layout.geometry.measureWidth, TOKENS, {
      left: TOKENS.measureInset,
      right: TOKENS.measureInset,
    });
  for (const p of layout.notes) {
    const expected = getPitchCoordinate(
      p.note.pitch.pitchClass,
      p.note.pitch.octave,
      p.coord.hand,
      TOKENS,
      OPTIONS,
      p.coord.flank
    );
    close(p.coord.y, expected.y, `${p.note.id} keeps its lattice row`);
    assert.equal(p.y, layout.geometry.middleCY + expected.y, `${p.note.id} absolute y`);
    assert.equal(p.rhythm.y, p.y, `${p.note.id} rhythm layer follows the row`);
    assert.equal(p.rhythm.x, p.x, `${p.note.id} stem column follows the head`);
    if (p.note.id === 'chord-g' || p.note.id === 'next-d') {
      // Off the measure opening there is room on both sides, so the row-snapped
      // pair straddles the untouched beat column exactly; the different-row
      // third and the later onset both stay on it.
      close(p.x, tickX(p.note.startTick), `${p.note.id} stays on the nominal beat column`);
    }
  }
  const c = layout.notes.find((p) => p.note.id === 'chord-c')!;
  const e = layout.notes.find((p) => p.note.id === 'chord-e')!;
  close((c.x + e.x) / 2, tickX(48), 'the spread pair is centred on the beat');
});

test('Row-snapped parity offset: a crowd at the barline slides the whole column, never shears it', () => {
  // On a downbeat the measure band has no room to the left, so the column
  // translates; every voice of the onset travels together, which is what keeps
  // the isomorphic hand shape intact.
  const layout = layoutJankoScore(
    makeScore(
      [
        makeNote('open-c', 0, 4, 0, 96, 'LH'),
        makeNote('open-e', 4, 4, 0, 96, 'RH'),
        makeNote('open-g', 7, 4, 0, 96, 'RH'),
      ],
      144
    ),
    OPTIONS,
    TOKENS
  )[0];
  const c = layout.notes.find((p) => p.note.id === 'open-c')!;
  const e = layout.notes.find((p) => p.note.id === 'open-e')!;
  const g = layout.notes.find((p) => p.note.id === 'open-g')!;
  assert.equal(layout.notes.length, 3);
  close((c.x + e.x) / 2, g.x, 'the pair stays centred on its onset column');
  close(Math.abs(e.x - c.x), getChordalOffset(TOKENS), 'the pair keeps its full spread');
  assert.ok(
    Math.min(c.x, e.x) - TOKENS.noteheadRadius >= layout.geometry.staffLeft + 1.0,
    'the slid column still clears the opening barline by >= 1pt'
  );
});

test('Row-snapped parity offset: a three-note row cluster spreads as −Δ, 0, +Δ', () => {
  // G7 without its fifth: [7, 11, 2, 5] → 7, 11 and 5 all rank 1 of one octave.
  const score = makeScore(
    [
      makeNote('g7-g', 7, 4, 0, 96, 'RH'),
      makeNote('g7-b', 11, 4, 0, 96, 'RH'),
      makeNote('g7-f', 5, 4, 0, 96, 'RH'),
    ],
    144
  );
  const layout = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  const xs = layout.notes.map((p) => p.x).sort((a, b) => a - b);
  const delta = getChordalOffset(TOKENS);
  assert.equal(xs.length, 3);
  for (const p of layout.notes) {
    assert.equal(p.coord.rank, 1, 'all three heads sit on row 1');
    assert.equal(p.y, layout.notes[0].y, 'and share one y');
  }
  close(xs[1] - xs[0], delta, 'left pair separated by one offset');
  close(xs[2] - xs[1], delta, 'right pair separated by one offset');
});

test('Row-snapped parity offset: a spread downbeat chord never crosses its barline', () => {
  const layout = layoutJankoScore(
    makeScore(
      [
        makeNote('low-a', 9, 3, 0, 96, 'LH'),
        makeNote('low-b', 11, 3, 0, 96, 'LH'),
        makeNote('low-f', 5, 3, 0, 96, 'LH'),
      ],
      144
    ),
    OPTIONS,
    TOKENS
  )[0];
  const left = layout.geometry.staffLeft;
  for (const p of layout.notes) {
    assert.ok(
      p.x - TOKENS.noteheadRadius >= left + 1.0,
      `${p.note.id} keeps >= 1pt of air from the opening barline (x=${p.x.toFixed(2)})`
    );
  }
  const xs = layout.notes.map((p) => p.x).sort((a, b) => a - b);
  close(xs[1] - xs[0], getChordalOffset(TOKENS), 'the cluster is still fully spread');
});

test('Row-snapped parity offset: the canonical Bach score is unchanged on unaffected onsets', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  // m. 1 of the Goldberg Variation writes two voices in different octaves, so
  // no onset is a row collision and every head stays on its beat column.
  const m1 = layout.notes.filter((p) => p.note.startTick < TOKENS.ticksPerMeasure!);
  assert.ok(m1.length > 0);
  for (const p of m1) {
    const expected =
      layout.geometry.staffLeft +
      getTickX(p.note.startTick, 0, p.note.startTick, layout.geometry.measureWidth, TOKENS, {
        left: TOKENS.measureInset,
        right: TOKENS.measureInset,
      });
    close(p.x, expected, `${p.note.id} stays on its beat column`);
  }
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

  // 3. Beat grid pulse lines are emitted for beats 2 and 3 in every measure.
  // Round 12 makes each pulse ONE continuous rule across the Middle C corridor
  // (no more RH + LH halves): 3 systems * 4 measures/system * 2 beats = 24.
  const beatMatches = [...page.matchAll(/class="janko-beat-line"/g)];
  assert.equal(beatMatches.length, 3 * 4 * 2);
  assert.match(page, /stroke="#9CA3AF" stroke-width="0\.70" stroke-dasharray="2,3"/);

  // 4. Macro crop mm. 1–2 carries beat lines on beats 2 and 3 (system 0 DOM has 4 mm * 2 lines = 8)
  const crop = renderJankoCrop(score, 1, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const cropBeatLines = [...crop.matchAll(/class="janko-beat-line"/g)];
  assert.equal(cropBeatLines.length, 4 * 2);

  // 5. Notes use beamed rhythm by default
  assert.match(crop, /class="janko-beam"/);
});

test('Round 10 staff hierarchy: uniform equators, canonical start mark and lightened numerals', () => {
  const score = buildBachGoldbergVar1Score();
  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);

  // All four octave lines are one identical 0.50pt `#1E293B` hairline.
  const staff = page.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)![0];
  assert.equal(
    (staff.match(/stroke="#1E293B" stroke-width="0\.50"/g) ?? []).length,
    4,
    'RH 5, LH 2, RH 4 and LH 3 are all the same 0.50pt hairline'
  );
  assert.ok(!staff.includes('#0F172A'), 'the 0.65pt inner-equator discrepancy is gone');

  // Round 10 retires the copperplate accolade; Round 14 settles the flared
  // 0.65pt architectural bracket as the golden System 1 start.
  assert.equal(
    DEFAULT_JANKO_OPTIONS.systemStartStyle,
    'architectural-bracket',
    'the flared architectural bracket is the default'
  );
  assert.equal(DEFAULT_JANKO_OPTIONS.finalBarlineStyle, 'unified', 'the unified final barline is the default');
  assert.deepEqual(
    [...JANKO_SYSTEM_START_STYLES],
    [
      'open-halo',
      'architectural-bracket',
      'delicate-bracket',
      'clef-pillar',
      'double-hairline',
      'none',
    ],
    'the published system-start catalogue (Round 12 adds the delicate bracket)'
  );
  assert.deepEqual(
    [...JANKO_FINAL_BARLINE_STYLES],
    ['unified', 'split-corridor'],
    'the published final-barline catalogue'
  );
  assert.equal(DEFAULT_JANKO_TOKENS.accoladeWidth, 4.8, 'the reserved margin column is 4.8pt');
  assert.equal(DEFAULT_JANKO_TOKENS.accoladeThick, 0.55, 'the reserved hairline is 0.55pt');
  assert.equal(DEFAULT_JANKO_TOKENS.augmentationDotRadius, 0.75, 'the dot falls to 0.75pt');
  assert.equal(DEFAULT_JANKO_OPTIONS.pageMargin, 24.0, 'the page margin widens to 24pt');
  assert.ok(!page.includes('janko-accolade'), 'the curlicue accolade is never painted');
  // Only the very first system of the very first page opens with the bracket:
  // the page object carries exactly one system-start mark.
  assert.equal(
    (page.match(/janko-system-bracket/g) ?? []).length,
    1,
    'the golden page paints exactly one system-start mark (System 1)'
  );
  assert.ok(!page.includes('janko-clef-pillar'), 'the Round 12 start finalists stay retired');
  const geo = computePageGeometry(OPTIONS, TOKENS);
  assert.equal(
    geo.staffLeft,
    24.0 + DEFAULT_JANKO_TOKENS.accoladeWidth + DEFAULT_JANKO_TOKENS.accoladeGap,
    'the staff column keeps its reserved margin inset'
  );
  const openFurniture = getMarginFurniture(geo.systems[0], TOKENS, 1, undefined, 'open-halo');
  assert.equal(openFurniture.accolade, null, 'the retired open margin reserves no accolade box');
  const bracketFurniture = getMarginFurniture(geo.systems[0], TOKENS, 1);
  assert.ok(bracketFurniture.accolade, 'the golden architectural bracket reserves its own box');
  assert.ok(
    bracketFurniture.accolade!.x1 <= geo.systems[0].staffLeft,
    'the bracket stays left of the staff column'
  );

  // The beat grid is the structural layer above the lightened staff rules.
  assert.match(page, /class="janko-beat-line"[^>]*stroke="#9CA3AF" stroke-width="0\.70"/);

  // Round 11 moves the measure numeral into the true left margin
  // (`x = staffLeft − 10.0`, right-aligned) and sets it snug just above the top
  // staff rule (`y = staffTopY − 3.0`) as a 7pt normal-weight italic #555555;
  // the painted baseline and the linter's margin-furniture box agree.
  const painted =
    /<text class="janko-measure-num" x="([\d.-]+)" y="([\d.-]+)" text-anchor="end">/.exec(page)!;
  const system0 = geo.systems[0];
  close(
    Number(painted[1]),
    system0.staffLeft - 10.0,
    'the numeral is right-aligned 10pt left of the staff column',
    1e-6
  );
  close(
    Number(painted[2]),
    system0.staffTopY - 3.0,
    'the numeral sits snug 3pt above the staff top rule',
    1e-6
  );
  const css = page.match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
  assert.match(
    css,
    /\.janko-measure-num \{[^}]*font-style: italic; font-size: 7pt; fill: #555555; font-weight: normal; \}/,
    'the numeral is a normal-weight 7pt #555555 italic'
  );
  const furniture = getMarginFurniture(system0, TOKENS, 1);
  close(furniture.numeral.y1, Number(painted[2]), 'painted and audited baselines agree', 1e-6);
  close(furniture.numeral.x1, Number(painted[1]), 'painted and audited x agree', 1e-6);
  assert.ok(furniture.numeral.x0 < furniture.numeral.x1, 'the right-aligned numeral box opens left');
  const layout0 = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  for (const p of layout0.notes) {
    const dx = Math.max(furniture.numeral.x0 - p.x, 0, p.x - furniture.numeral.x1);
    const dy = Math.max(furniture.numeral.y0 - p.y, 0, p.y - furniture.numeral.y1);
    const air = Math.hypot(dx, dy) - TOKENS.noteheadRadius;
    assert.ok(
      air >= 14.0 - 1e-9,
      `${p.note.id} keeps 14pt of numeral air (got ${air.toFixed(2)}pt)`
    );
  }

  // Measure barlines fall to 0.60pt (the closing barline of the score stays
  // authoritative and is covered by the system-openness test below). Round 12
  // paints one continuous rule per internal boundary (3 per system) instead of
  // the two split hand halves.
  const pageBarlines = page.match(/<g class="janko-barlines">[\s\S]*?<\/g>/)![0];
  assert.equal(
    (pageBarlines.match(/stroke-width="0\.60"/g) ?? []).length,
    3,
    'internal measure barlines are lighter'
  );
  assert.ok(!pageBarlines.includes('stroke-width="0.85"'), 'the 0.85pt measure barline is gone');
});

// ---------------------------------------------------------------------------
// 2c. Round 12 — rests, the continuous vertical grid, its writing policies and
//     the refined architectural start symbols
// ---------------------------------------------------------------------------

test('Round 14 pocket-seated rests: the m. 4 silence sits beside the D3 it accompanies, never on the Octave 4 equator', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(DEFAULT_JANKO_OPTIONS.restStyle, 'kinetic-monoline', 'the settled rest dialect');
  const layouts = layoutJankoScore(score, OPTIONS, TOKENS);
  const all = layouts.flatMap((l) => l.rests);
  assert.ok(all.length > 0, 'the score writes its silences');

  // The canonical case: RH plays 16ths to tick 540 (digit `9`, y = 158.5),
  // releases at 552 and resumes at 564 (digit `0`, y = 173.5) while the LH
  // enters at 552 — so the silence is exactly one 16th.
  const m4 = all.find((r) => r.tick === 552)!;
  assert.ok(m4, 'the m. 4 tick-552 rest exists');
  assert.equal(m4.hand, 'RH');
  assert.equal(m4.value, 'sixteenth');
  assert.equal(m4.durationTicks, 12);
  close(m4.x, 544.97, 'the rest stands on the tick-552 beat column', 0.01);
  const system0 = getSystemGeometry(computePageGeometry(OPTIONS, TOKENS), 0);
  close(system0.equatorY('RH', 4), 136.0, 'the retired Round 12 sky-floating equator', 1e-9);
  close(system0.equatorY('LH', 3), 166.0, 'the Octave 3 contour of the m. 4 writing', 1e-9);

  // The contour target is the midpoint of the two RH digits that surround the
  // silence: (158.5 + 173.5) / 2 = 166.0 — the Octave 3 equator itself.
  const surround = layouts[0].notes.filter(
    (p) => p.rhythm.hand === 'RH' && (p.note.startTick === 540 || p.note.startTick === 564)
  );
  assert.equal(surround.length, 2, 'digit 9 and digit 0 surround the silence');
  const target = surround.reduce((sum, p) => sum + p.y, 0) / surround.length;
  close(target, 166.0, 'the voice contour midpoint', 1e-9);
  assert.ok(Math.abs(m4.y - 136.0) > 20, 'the rest no longer floats on the Octave 4 equator');
  assert.ok(
    m4.y > 158.5 && m4.y < 173.5,
    `the rest is nestled between digit 9 and digit 0 (y = ${m4.y.toFixed(2)})`
  );
  // The 12pt kinetic stem is seated in the clear pocket above the LH D3 head
  // that sounds at the same column: the guaranteed REST_POCKET_AIR (2.4pt) plus
  // the float-safety solver margin, so the anchor slides just 5.72pt up the
  // voice — never back to the hand's default equator and never onto the disc.
  close(m4.y, 160.28, 'the pocket seat on the voice contour', 0.05);
  const m4Box = restInkBox(m4, TOKENS);
  const d3 = layouts[0].notes.find((p) => p.note.startTick === 552)!;
  close(d3.y - TOKENS.noteheadRadius - m4Box.y1, REST_POCKET_AIR + REST_FIT_MARGIN, 'the guaranteed pocket air', 5e-3);

  // Every rest states a standard value, is anchored on the nearest legal
  // position of its hand's own voice contour and never collides with a glyph.
  for (const rest of all) {
    assert.ok([12, 24, 48, 96, 192].includes(rest.durationTicks), `${rest.tick} standard value`);
    const system = layouts.find((l) => l.rests.includes(rest))!;
    assert.equal(
      resolveRestY(rest, system.notes, system.geometry, TOKENS),
      rest.y,
      `${rest.hand} rest at ${rest.tick} is a fixed point of the fit rule`
    );
    assert.ok(
      restClearsLayout(rest, system.notes, TOKENS),
      `${rest.hand} rest at ${rest.tick} keeps 1.0pt of air from every notehead`
    );
    assert.ok(
      rest.y >= system.geometry.staffTopY && rest.y <= system.geometry.staffBotY,
      `${rest.hand} rest at ${rest.tick} stays inside the grand staff`
    );
    for (const p of system.notes) {
      const dx = Math.max(Math.abs(p.x - rest.x) - 0, 0);
      const dy = Math.abs(p.y - rest.y);
      assert.ok(
        Math.hypot(dx, dy) > 0,
        `${rest.hand} rest at ${rest.tick} does not share a point with a glyph`
      );
    }
  }

  const crop = renderJankoCrop(score, 4, 1, OPTIONS, TOKENS);
  assert.match(
    crop,
    /<g class="janko-rest-group" data-rest-tick="552" data-rest-value="sixteenth" data-rest-hand="RH" data-rest-style="kinetic-monoline">/
  );
  assert.match(crop, /class="janko-rest-stem"/, 'the monoline stem is painted');
  assert.equal(
    (crop.match(/class="janko-rest-tab"/g) ?? []).length,
    2,
    'a 16th rest carries two 12.4° kinetic tabs'
  );
  const report = lintJankoScore(score, OPTIONS, TOKENS);
  assert.equal(report.ok, true, 'the resting score stays clean');
  assert.equal(report.warnings.length, 0);
});

test('Round 13 rest dialects: five distinct monoline grammars, all clean', () => {
  const score = buildBachGoldbergVar1Score();
  const signatures: Record<JankoRestStyle, RegExp> = {
    'kinetic-monoline': /janko-rest-(tab|notch|bar)"/,
    'classical-urtext': /janko-rest-(hook|hook-bulb|lightning|block|stem-line)/,
    'geometric-node': /janko-rest-(node|ray|capsule)/,
    'bauhaus-slash': /janko-rest-(slash|wing|z|box)/,
    'phantom-notehead': /janko-rest-phantom-(head|stem|flag|bar)/,
  };
  const documents = new Set<string>();
  for (const style of JANKO_REST_STYLES) {
    const options = resolveJankoOptions({ ...OPTIONS, restStyle: style });
    const crop = renderJankoCrop(score, 4, 1, options, TOKENS);
    assert.match(crop, signatures[style], `${style} paints its own ink`);
    for (const [other, pattern] of Object.entries(signatures)) {
      if (other === style) continue;
      assert.ok(!pattern.test(crop), `${style} never paints ${other} ink`);
    }
    const report = lintJankoScore(score, options, TOKENS);
    assert.equal(report.ok, true, `${style} engraves clean`);
    assert.equal(report.warnings.length, 0, `${style} adds no warning`);
    documents.add(crop.replace(new RegExp(`data-rest-style="${style}"`, 'g'), ''));
  }
  assert.equal(documents.size, 5, 'the five dialects are five different engravings');
});

test('Round 13 corrected kinetic tabs hook downward to the right of their stem', () => {
  const score = buildBachGoldbergVar1Score();
  const crop = renderJankoCrop(score, 4, 1, OPTIONS, TOKENS);
  const tabs = [
    ...crop.matchAll(
      /<line class="janko-rest-tab"[^>]*x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g
    ),
  ].map((m) => m.slice(1).map(Number));
  assert.equal(tabs.length, 2, 'the m. 4 16th rest carries two tabs');
  for (const [x1, y1, x2, y2] of tabs) {
    assert.ok(x2 > x1, 'the tab reaches right of its stem');
    assert.ok(y2 > y1, 'and hooks downward, like a note flag');
    close((y2 - y1) / (x2 - x1), TOKENS.maxBeamSlope, 'at the score’s own 12.4° rake', 1e-6);
  }
});

test('Round 13 authentic urtext rests: a slanted calligraphic stem with teardrop bulbs', () => {
  const score = buildBachGoldbergVar1Score();
  const options = resolveJankoOptions({ ...OPTIONS, restStyle: 'classical-urtext' });
  const crop = renderJankoCrop(score, 4, 1, options, TOKENS);
  const stem = /<path class="janko-rest-stem-line" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"/.exec(crop);
  assert.ok(stem, 'the calligraphic stem is painted');
  const [, sx1, , sx2] = stem!.map(Number);
  assert.ok(Math.abs(sx2 - sx1) > 1.0, 'the stem is slanted, not a monoline rule');
  // A 16th rest carries two hooks, each ending in a solid teardrop bulb.
  assert.equal((crop.match(/class="janko-rest-hook"/g) ?? []).length, 2, 'two hooks for a 16th');
  assert.equal((crop.match(/class="janko-rest-hook-bulb"/g) ?? []).length, 2, 'two teardrop bulbs');
  const bulbs = [...crop.matchAll(/<circle class="janko-rest-hook-bulb" cx="[\d.-]+" cy="[\d.-]+" r="([\d.-]+)"/g)];
  for (const bulb of bulbs) {
    assert.ok(Number(bulb[1]) > 0, 'teardrop bulbs are solid ink, not hollow rings');
  }
  // The quarter rest is the serpentine lightning, and it is a curve (C commands).
  const m4Quarter = renderJankoCrop(score, 2, 1, options, TOKENS);
  const lightning = /<path class="janko-rest-lightning" d="([^"]+)"/.exec(m4Quarter);
  if (lightning) assert.match(lightning[1], /C /, 'the serpentine is calligraphic, not a polyline');
});

test('Round 13 phantom notehead rests stand exactly where the unvoiced note would have been', () => {
  const score = buildBachGoldbergVar1Score();
  const options = resolveJankoOptions({ ...OPTIONS, restStyle: 'phantom-notehead' });
  const crop = renderJankoCrop(score, 4, 1, options, TOKENS);
  const head = /<circle class="janko-rest-phantom-head" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.-]+)" fill="none" stroke="#111111" stroke-width="0.80" stroke-dasharray="1.8,1.5"\/>/.exec(crop);
  assert.ok(head, 'the dashed open head is painted');
  close(Number(head![3]), 3.0, 'at the ticket’s R = 3.0pt', 1e-9);
  const rest = layoutJankoScore(score, options, TOKENS)[0].rests.find((r) => r.tick === 552)!;
  close(Number(head![1]), rest.x, 'the head stands on the rest column', 0.01);
  close(Number(head![2]), rest.y, 'and on the rest’s voice contour', 0.01);
  assert.equal((crop.match(/class="janko-rest-phantom-flag"/g) ?? []).length, 2, 'two flags for a 16th');
  const flags = [
    ...crop.matchAll(/<path class="janko-rest-phantom-flag"[^>]*d="M ([\d.-]+) ([\d.-]+) Q ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/g),
  ].map((m) => m.slice(1).map(Number));
  for (const [, fy1, , , , fy2] of flags) {
    assert.ok(fy2 > fy1, 'every flag hooks downward');
  }
});

test('Round 13 beam discontinuity: no beam ever bridges the rest that interrupts it', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  const groups = layout.beams.map((b) => b.notes.map((n) => n.startTick).join(','));
  // Bach m. 4 beat 3: the RH 16ths at 528 and 540 beam together, the tick-552
  // rest (a 12-tick hole) breaks the run, and 564 resumes as a flagged 16th.
  assert.ok(groups.includes('528,540'), `the 528 + 540 pair beams (got ${groups.join(' | ')})`);
  assert.ok(
    !layout.beams.some((b) => b.notes.some((n) => n.startTick === 564)),
    'no beam reaches the tick-564 resumption across the rest'
  );
  assert.deepEqual(
    layout.ungrouped
      .filter((n) => n.startTick >= 528 && n.startTick < 576)
      .map((n) => n.startTick),
    [564],
    'the resumption falls back to a standard flag'
  );
  const crop = renderJankoCrop(score, 4, 1, OPTIONS, TOKENS);
  assert.match(
    crop,
    /class="janko-flag"[^>]*data-subdivision-style="kinetic-tab-beam"/,
    'the orphaned 16th really paints its flag'
  );

  // Partition level: a one-16th hole splits the run even though the onset gap
  // (24 ticks) is not greater than half a beat. A legato overlap does not.
  const note = (id: string, startTick: number, durationTicks: number): JankoRhythmNote => ({
    id,
    startTick,
    durationTicks,
    hand: 'RH',
    x: startTick,
    y: 0,
  });
  const holed = partitionBeamGroups([
    note('a', 0, 12),
    note('b', 12, 12),
    note('c', 36, 12),
  ]);
  assert.deepEqual(
    holed.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12]],
    'the rest at tick 24 breaks the beam'
  );
  assert.deepEqual(holed.ungrouped.map((n) => n.startTick), [36]);
  const legato = partitionBeamGroups([
    note('a', 0, 24),
    note('b', 12, 12),
    note('c', 24, 12),
  ]);
  assert.deepEqual(
    legato.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12, 24]],
    'a sounding overlap is still one continuous gesture'
  );
});

test('Round 13 multi-system crops span the staff column instead of collapsing to an empty page', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const measureWidth = geo.systems[0].measureWidth;

  // Round 13 window 3: mm. 27–28 live inside System 7, at their true width.
  const single = computeCropBox(geo, 27, 2, true);
  assert.equal(single.firstSystem, single.lastSystem, 'one system');
  assert.equal(single.firstSystem, 6);
  close(single.w, 2 * measureWidth + 16, 'two true measure widths plus padding', 1e-6);
  const dense = renderJankoCrop(score, 27, 2, OPTIONS, TOKENS);
  assert.ok(
    (dense.match(/class="janko-digit"/g) ?? []).length > 20,
    'the dense sixteenths are engraved'
  );

  // The defect the ticket reports: a window that crosses a system break used to
  // subtract anchors from two different systems and clamp to a 1pt strip.
  const multi = computeCropBox(geo, 27, 3, true);
  assert.equal(multi.firstSystem, 6);
  assert.equal(multi.lastSystem, 7);
  close(multi.x, geo.margin - 8.0, 'a system-spanning crop opens at the page margin', 1e-9);
  close(
    multi.w,
    geo.staffRight - geo.margin + 16.0,
    'and spans the whole staff column',
    1e-9
  );
  assert.ok(multi.w > 500, `the crop is a full page width, not a 1pt strip (${multi.w.toFixed(1)}pt)`);
  assert.ok(multi.h > 350, 'and tall enough to hold both systems');
  const wide = renderJankoCrop(score, 27, 3, OPTIONS, TOKENS);
  assert.match(wide, new RegExp(`viewBox="${multi.x.toFixed(2)} `), 'the viewBox carries the fixed box');
  assert.ok(
    (wide.match(/class="janko-digit"/g) ?? []).length > 40,
    'both systems are engraved inside the wide crop'
  );
  assert.ok(
    (wide.match(/id="system-/g) ?? []).length >= 2,
    'the crop really contains two systems'
  );
});

test('Round 12 continuous vertical grid: barlines and beat pulses cross Middle C unbroken', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const system0 = getSystemGeometry(geo, 0);
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const rhTop = system0.equatorY('RH', 5) - 12;
  const lhBot = system0.equatorY('LH', 2) + 12;
  const spine = system0.middleCY;
  close(rhTop, spine - 57.0, 'the grid opens 57pt above Middle C', 1e-9);
  close(lhBot, spine + 57.0, 'and closes 57pt below it', 1e-9);

  const verticals = [...crop.matchAll(/<line class="(janko-barline|janko-beat-line)" x1="([\d.-]+)" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)"/g)];
  assert.ok(verticals.length > 0, 'the grid is painted');
  for (const line of verticals) {
    close(Number(line[3]), rhTop, `${line[1]} opens on the Octave 5 rule`, 1e-9);
    close(Number(line[4]), lhBot, `${line[1]} closes on the Octave 2 rule`, 1e-9);
    assert.ok(
      Number(line[3]) < spine && Number(line[4]) > spine,
      `${line[1]} crosses the Middle C corridor with no gap`
    );
  }
  assert.match(
    crop,
    /class="janko-beat-line"[^>]*stroke="#9CA3AF" stroke-width="0\.70" stroke-dasharray="2,3"/
  );
});

test('Round 12 grid writing policies: protected air, air channels and full-width transparency', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const system0 = getSystemGeometry(geo, 0);

  // 1. The golden overlaid policy: no channel ink, barlines keep their air.
  const overlaid = renderJankoCrop(score, 27, 3, OPTIONS, TOKENS);
  assert.ok(!overlaid.includes('janko-grid-channel'), 'the overlaid grid reserves no channel');

  // 2. The strict policy: every grid line rides a dedicated white air channel,
  //    and the channel is painted *above* the rhythm layer (after every stem).
  const strictOptions = resolveJankoOptions({ ...OPTIONS, gridWritingPolicy: 'strict-protected-grid' });
  const strict = renderJankoCrop(score, 27, 3, strictOptions, TOKENS);
  const channels = (strict.match(/class="janko-grid-channel"/g) ?? []).length;
  assert.ok(channels > 0, 'the strict grid paints its air channels');
  assert.equal(
    channels,
    (strict.match(/class="janko-(barline|beat-line)"/g) ?? []).length,
    'every grid line owns exactly one channel'
  );
  const lastStem = strict.lastIndexOf('class="janko-stem"');
  const firstChannel = strict.indexOf('class="janko-grid-channel"');
  // The mm. 27–29 window spans two systems, so the layer order is asserted on a
  // single-system window: nothing but the noteheads may follow the channel.
  const strictOneSystem = renderJankoCrop(score, 1, 2, strictOptions, TOKENS);
  const stemInOneSystem = strictOneSystem.lastIndexOf('class="janko-stem"');
  const channelInOneSystem = strictOneSystem.indexOf('class="janko-grid-channel"');
  assert.ok(
    stemInOneSystem !== -1 && channelInOneSystem > stemInOneSystem,
    'the channelled grid is painted above the rhythm layer'
  );
  assert.ok(
    strictOneSystem.lastIndexOf('class="janko-grid-channel"') <
      strictOneSystem.indexOf('class="janko-knockout"'),
    'and beneath the circular notehead masks'
  );
  assert.ok(lastStem !== -1 && firstChannel !== -1, 'both layers are present in the long window');

  // 3. The transparent policy: the music uses the full measure width, so the
  //    first 16th of a measure stands exactly on its opening barline.
  const transparentOptions = resolveJankoOptions({
    ...OPTIONS,
    gridWritingPolicy: 'unified-transparent-grid',
  });
  const transparent = renderJankoCrop(score, 27, 3, transparentOptions, TOKENS);
  assert.ok(!transparent.includes('janko-grid-channel'), 'the transparent grid reserves nothing');
  // m. 29 opens system 8 — measure index 0 of its system — and its downbeat is a
  // real tick-4032 onset, so with the inset withdrawn the head straddles the
  // system's opening edge exactly where the barline would stand.
  const systemIndex = Math.floor(28 / OPTIONS.measuresPerSystem);
  const layout = layoutJankoScore(score, transparentOptions, TOKENS)[systemIndex];
  const firstOfM29 = layout.notes
    .filter((p) => p.note.startTick >= 28 * 144 && p.note.startTick < 29 * 144)
    .sort((a, b) => a.note.startTick - b.note.startTick)[0];
  assert.equal(firstOfM29.note.startTick, 28 * 144, 'm. 29 opens on its downbeat');
  close(
    firstOfM29.x,
    layout.geometry.staffLeft,
    'the transparent downbeat stands on the measure barline',
    1e-6
  );
  assert.ok(
    Math.abs(firstOfM29.y - layout.geometry.middleCY) < 60,
    'and it is a real in-staff glyph'
  );
  for (const policy of ['overlaid-beat-grid', 'strict-protected-grid', 'unified-transparent-grid'] as const) {
    const report = lintJankoScore(score, { ...OPTIONS, gridWritingPolicy: policy }, TOKENS);
    assert.equal(report.ok, true, `${policy} is clean`);
    assert.equal(report.warnings.length, 0, `${policy} adds no warning`);
  }
});

test('Round 13 start symbols: the flared 0.65pt bracket, the 0.50pt bracket and the nib-free clef pillar', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const system0 = getSystemGeometry(geo, 0);

  const bracket = renderSystem(score, system0, 0, { ...OPTIONS, systemStartStyle: 'architectural-bracket' }, TOKENS);
  const flared = /class="janko-system-bracket" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)" fill="none" stroke="#111827" stroke-width="0\.65" stroke-linecap="butt" stroke-linejoin="miter"\/>/.exec(bracket);
  assert.ok(flared, 'the flared architectural bracket is painted');
  const [, tipX, tipY, x1, y1, , , footX, footY] = flared!.map(Number);
  close(y1, system0.equatorY('RH', 5), 'the rule clasps the Octave 5 rule', 1e-9);
  assert.ok(tipY < y1 && footY > system0.equatorY('LH', 2), 'both spurs flare diagonally outward');
  close(footX - tipX, 0, 'the spurs reach the same horizontal distance', 1e-9);
  close(
    (y1 - tipY) / (tipX - x1),
    Math.tan((ARCHITECTURAL_BRACKET_FLARE_DEGREES * Math.PI) / 180),
    'the flare is 13°',
    5e-3
  );

  const delicate = renderSystem(score, system0, 0, { ...OPTIONS, systemStartStyle: 'delicate-bracket' }, TOKENS);
  assert.match(delicate, /class="janko-system-bracket-delicate"[^>]*stroke-width="0\.50"/);
  assert.ok(!delicate.includes('class="janko-system-bracket"'), 'the two brackets never co-paint');

  const pillar = renderSystem(score, system0, 0, { ...OPTIONS, systemStartStyle: 'clef-pillar' }, TOKENS);
  assert.match(pillar, /class="janko-clef-pillar" x1="[\d.-]+" y1="[\d.-]+" x2="[\d.-]+" y2="[\d.-]+" stroke="#111827" stroke-width="0\.50"/);
  const ticks = [...pillar.matchAll(/class="janko-clef-pillar-tick" x1="[\d.-]+" y1="([\d.-]+)"/g)].map((m) => Number(m[1]));
  assert.equal(ticks.length, 4, 'the pillar ticks the four octave equators only (the nib is gone)');
  for (const [i, octave] of ([5, 4, 3, 2] as const).entries()) {
    close(ticks[i], system0.equatorY(octave >= 4 ? 'RH' : 'LH', octave), `tick at o${octave}`, 1e-9);
  }
  assert.ok(
    !ticks.some((y) => Math.abs(y - system0.middleCY) < 1e-6),
    'no Middle C nib survives'
  );
  for (const style of ['architectural-bracket', 'delicate-bracket', 'clef-pillar'] as const) {
    const report = lintJankoScore(score, { ...OPTIONS, systemStartStyle: style }, TOKENS);
    assert.equal(report.ok, true, `${style} engraves clean`);
    assert.equal(report.warnings.length, 0, `${style} adds no warning`);
  }
});

test('Round 14 system openness: the canonical flared bracket opens System 1, no mid-piece marks', () => {
  const score = buildBachGoldbergVar1Score();
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const total = countJankoSystems(score, OPTIONS, TOKENS);
  const barlineXs = (svg: string): Set<number> =>
    new Set(
      [...svg.matchAll(/class="janko-barline" x1="([\d.]+)"/g)].map((m) => Number(m[1]))
    );

  // The golden default opens the piece with the flared 0.65pt architectural
  // bracket — strictly at System 1; every other system stays an open margin.
  const first = renderSystem(score, getSystemGeometry(geo, 0), 0, OPTIONS, TOKENS);
  assert.match(
    first,
    /class="janko-system-bracket" d="M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+" fill="none" stroke="#111827" stroke-width="0\.65" stroke-linecap="butt" stroke-linejoin="miter"/,
    'System 1 opens with the canonical flared 0.65pt bracket'
  );
  assert.ok(!first.includes('janko-accolade'), 'the copperplate accolade stays retired');
  assert.ok(!first.includes('janko-clef-pillar'), 'the Round 12 finalists stay retired');
  const bare = renderSystem(
    score,
    getSystemGeometry(geo, 0),
    0,
    { ...OPTIONS, systemStartStyle: 'none' as const },
    TOKENS
  );
  assert.equal(
    (bare.match(/janko-accolade|janko-system-bracket|janko-clef-pillar/g) ?? []).length,
    0,
    'the inkless styles still paint no margin mark at all'
  );
  const middle = renderSystem(score, getSystemGeometry(geo, 1), 1, OPTIONS, TOKENS);
  assert.equal((middle.match(/janko-accolade|janko-system-bracket|janko-clef-pillar/g) ?? []).length, 0, 'no mid-piece mark');

  // Intermediate systems have no barline at either edge; only the final measure
  // of the final system closes the score.
  const middleX = barlineXs(middle);
  const middleRight = Number(getSystemGeometry(geo, 1).staffRight.toFixed(2));
  assert.ok(!middleX.has(middleRight), 'an intermediate system ends in open negative space');

  const last = renderSystem(score, getSystemGeometry(geo, total - 1), total - 1, OPTIONS, TOKENS);
  const lastX = barlineXs(last);
  assert.ok(
    lastX.has(Number(getSystemGeometry(geo, total - 1).staffRight.toFixed(2))),
    'the final system draws the closing barline'
  );
  assert.match(last, /class="janko-barline"[^>]*stroke-width="1\.05"/, 'the closing barline stays firm');
  assert.match(first, /class="janko-barline"[^>]*stroke-width="0\.60"/, 'measure barlines are lighter');

  // Round 10: the default final barline is unified — one continuous rule from
  // the RH top to the LH bottom that seals the Middle C corridor.
  const finalBar = new RegExp(
    `<line class="janko-barline" x1="${getSystemGeometry(geo, total - 1).staffRight.toFixed(2)}" ` +
      `y1="${(getSystemGeometry(geo, total - 1).equatorY('RH', 5) - 12).toFixed(2)}" ` +
      `x2="${getSystemGeometry(geo, total - 1).staffRight.toFixed(2)}" ` +
      `y2="${(getSystemGeometry(geo, total - 1).equatorY('LH', 2) + 12).toFixed(2)}" ` +
      'stroke="#111111" stroke-width="1.05"'
  );
  assert.match(last, finalBar, 'the unified final barline spans both hands across the corridor');
  assert.equal(
    (last.match(/class="janko-barline"[^>]*stroke-width="1\.05"/g) ?? []).length,
    1,
    'the unified boundary is one single rule'
  );

  const splitOptions = { ...OPTIONS, finalBarlineStyle: 'split-corridor' as const };
  const split = renderSystem(score, getSystemGeometry(geo, total - 1), total - 1, splitOptions, TOKENS);
  assert.equal(
    (split.match(/class="janko-barline"[^>]*stroke-width="1\.05"/g) ?? []).length,
    2,
    'the split final barline keeps two hand segments with an open corridor'
  );
});

// ---------------------------------------------------------------------------
// 2b. Spacious corridor, dotted-line elimination, notehead optics & stem air
// ---------------------------------------------------------------------------
const MIDDLE_C_SPINE_GROUP = 'class="janko-middle-c-spine"';
const ROW_GUIDELINES_GROUP = 'class="janko-row-guidelines"';

test('Symmetrical spine-free corridor invariant: 30pt of negative space, zero Middle C rule', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(DEFAULT_JANKO_OPTIONS.interStaffGap, 30.0);
  assert.equal(DEFAULT_JANKO_OPTIONS.middleCSpine, 'none');

  const geo = computePageGeometry(OPTIONS, TOKENS);
  for (const sys of geo.systems) {
    close(sys.middleCY - sys.equatorY('RH', 4), 15.0, 'RH half corridor');
    close(sys.equatorY('LH', 3) - sys.middleCY, 15.0, 'LH half corridor');
  }

  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  for (const svg of [page, crop]) {
    assert.ok(!svg.includes(MIDDLE_C_SPINE_GROUP), 'no Middle C spine group may be engraved');
  }
  // No horizontal rule may be engraved on the corridor centre line itself.
  for (const sys of geo.systems) {
    const y = sys.middleCY.toFixed(2);
    assert.ok(
      !new RegExp(`y1="${y}" x2="[^"]*" y2="${y}"`).test(page),
      `no horizontal rule may run along the Middle C corridor (y=${y})`
    );
  }

  // The spine survives as an explicit designer opt-in.
  const withSpine = renderJankoCrop(
    score,
    1,
    2,
    { ...OPTIONS, middleCSpine: 'continuous' },
    TOKENS
  );
  assert.match(withSpine, /class="janko-middle-c-spine"/);
});

test('Zero horizontal dashed guidelines: the vertical beat grid is the only dotted line', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(DEFAULT_JANKO_OPTIONS.showRowGuidelines, false);
  const page = renderJankoPage(score, 0, OPTIONS, TOKENS);
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  for (const svg of [page, crop]) {
    assert.ok(!svg.includes(ROW_GUIDELINES_GROUP), 'no row guideline group may be engraved');
  }

  const dashed = [...page.matchAll(/<(\w+)\b[^>]*stroke-dasharray="[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.ok(dashed.length > 0, 'the vertical beat grid pulses must survive');
  for (const element of dashed) {
    assert.match(element, /class="janko-beat-line"/, 'only beat lines may be dashed');
    const x1 = element.match(/x1="([\d.]+)"/)?.[1];
    const x2 = element.match(/x2="([\d.]+)"/)?.[1];
    assert.equal(x1, x2, 'a beat grid pulse is strictly vertical');
  }

  // Row guidelines survive as an explicit designer opt-in.
  const withGuides = renderJankoCrop(score, 1, 1, { ...OPTIONS, showRowGuidelines: true }, TOKENS);
  assert.match(withGuides, /class="janko-row-guidelines"/);
  assert.match(withGuides, /stroke-dasharray="3,3"/);
});

test('Optical notehead: 5.8pt digits sit dead-centre in the 4.8pt knockout disc', () => {
  const score = buildBachGoldbergVar1Score();
  close(TOKENS.noteheadRadius, 4.8, 'canonical knockout radius');
  close(TOKENS.digitFontSize, 5.8, 'canonical digit font size');
  const { halfWidth, halfHeight } = digitHalfExtents(TOKENS.digitFontSize);
  assert.ok(TOKENS.noteheadRadius - halfWidth >= 1.2, 'left/right white margin');
  assert.ok(TOKENS.noteheadRadius - halfHeight >= 1.2, 'top/bottom white margin');
  assert.ok(
    TOKENS.noteheadRadius - Math.hypot(halfWidth, halfHeight) >= 1.2,
    'corner white margin'
  );

  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const knockouts = [
    ...crop.matchAll(/class="janko-knockout" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g),
  ].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]), r: Number(m[3]) }));
  const digits = [
    ...crop.matchAll(
      /class="janko-digit" x="([\d.]+)" y="([\d.]+)" font-weight="\d+" font-size="([\d.]+)pt"/g
    ),
  ].map((m) => ({ x: Number(m[1]), y: Number(m[2]), size: Number(m[3]) }));
  assert.ok(knockouts.length > 0, 'the crop engraves noteheads');
  assert.equal(digits.length, knockouts.length, 'every knockout carries exactly one digit');
  for (const disc of knockouts) {
    close(disc.r, TOKENS.noteheadRadius, 'knockout radius');
  }
  for (const d of digits) {
    close(d.size, TOKENS.digitFontSize, 'digit font size');
    // The alphabetic baseline sits half a cap height below the notehead centre.
    const glyphCentreY = d.y - digitBaselineOffset(d.size);
    const disc = knockouts.find(
      (k) => Math.abs(k.cx - d.x) < 0.02 && Math.abs(k.cy - glyphCentreY) < 0.02
    );
    assert.ok(disc, `digit at (${d.x}, ${d.y}) owns a concentric knockout disc`);
  }
  close(
    JANKO_DIGIT_BASELINE_OFFSET,
    digitHalfExtents(TOKENS.digitFontSize).halfHeight,
    'canonical baseline offset is half a cap height'
  );
});

test('Stem attachment: every stem starts flush outside its knockout disc — and its halo at tick 0', () => {
  const score = buildBachGoldbergVar1Score();
  const radii = getStemAttachmentRadii(TOKENS);
  close(radii.regular, TOKENS.noteheadRadius + 0.2, 'regular attachment radius');
  close(radii.honor, TOKENS.haloRadius + 0.4, 'Position of Honor attachment radius');

  const layouts = layoutJankoScore(score, OPTIONS, TOKENS);
  let honored = 0;
  for (const layout of layouts) {
    for (const p of layout.notes) {
      const stem = getStemGeometry(p.rhythm, TOKENS);
      const expected = getStemAttachmentRadius(p.rhythm, TOKENS);
      const attach = Math.hypot(stem.stemX - p.x, stem.stemStartY - p.y);
      close(attach, expected, `flush attachment of ${p.note.id}`, 1e-9);
      assert.ok(attach >= TOKENS.noteheadRadius, `${p.note.id} never starts inside the disc`);
      if (isPositionOfHonor(p.note.startTick)) {
        honored++;
        assert.ok(
          attach >= TOKENS.haloRadius + 0.375,
          `${p.note.id} clears the halo ring stroke (${attach.toFixed(2)}pt)`
        );
      }
    }
  }
  assert.equal(honored, 2, 'both opening sounds carry the halo attachment');

  // SVG level: every engraved stem starts exactly on the flush perimeter.
  const system0 = layouts[0];
  const crop = renderJankoCrop(score, 1, 2, OPTIONS, TOKENS);
  const expectedStarts = new Set(
    system0.notes.map((p) => {
      const s = getStemGeometry(p.rhythm, TOKENS);
      return `${s.stemX.toFixed(2)},${s.stemStartY.toFixed(2)}`;
    })
  );
  const starts = [
    ...crop.matchAll(/class="janko-stem" x1="([\d.]+)" y1="([\d.]+)" x2="[\d.]+"/g),
  ].map((m) => `${m[1]},${m[2]}`);
  assert.ok(starts.length > 0, 'mm. 1–2 engrave stems');
  for (const start of starts) {
    assert.ok(expectedStarts.has(start), `stem start ${start} must sit on the disc perimeter`);
  }
  for (const start of expectedStarts) {
    assert.ok(starts.includes(start), `notehead stem start ${start} must reach the document`);
  }
});

test('Stems keep ≥1.2pt of clean air from their own digit glyph', () => {
  const score = buildBachGoldbergVar1Score();
  const { halfWidth, halfHeight } = digitHalfExtents(TOKENS.digitFontSize);
  let worst = Infinity;
  let worstNote = '';
  for (const layout of layoutJankoScore(score, OPTIONS, TOKENS)) {
    for (const p of layout.notes) {
      const stem = getStemGeometry(p.rhythm, TOKENS);
      const lo = Math.min(stem.stemStartY, stem.stemEndY);
      const hi = Math.max(stem.stemStartY, stem.stemEndY);
      const horizontal = Math.max(p.x - halfWidth - stem.stemX, 0, stem.stemX - (p.x + halfWidth));
      const vertical = Math.max(p.y - halfHeight - hi, 0, lo - (p.y + halfHeight));
      const distance = Math.hypot(horizontal, vertical);
      if (distance < worst) {
        worst = distance;
        worstNote = p.note.id;
      }
    }
  }
  assert.ok(
    worst >= 1.2,
    `every stem keeps ≥1.2pt from its digit (worst ${worst.toFixed(2)}pt at ${worstNote})`
  );
});

test('Measure 1 opening stems (pitch 7 RH & LH) never cut through the halo ring', () => {
  const score = buildBachGoldbergVar1Score();
  const layout = layoutJankoScore(score, OPTIONS, TOKENS)[0];
  const opening = layout.notes.filter((p) => p.note.startTick === 0);
  assert.equal(opening.length, 2, 'two opening sounds');
  assert.deepEqual(
    opening.map((p) => p.coord.pitchClass),
    [7, 7],
    'the opening sounds are the two pitch-7 notes'
  );
  assert.deepEqual(
    [...new Set(opening.map((p) => p.coord.hand))].sort(),
    ['LH', 'RH'],
    'one per hand'
  );
  for (const p of opening) {
    const stem = getStemGeometry(p.rhythm, TOKENS);
    const distance = segmentDistance(
      p.x,
      p.y,
      stem.stemX,
      stem.stemStartY,
      stem.stemX,
      stem.stemEndY
    );
    assert.ok(
      distance >= TOKENS.haloRadius + 0.375,
      `${p.note.id} clears the halo ring by ${(distance - TOKENS.haloRadius).toFixed(2)}pt`
    );
  }
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
      /<(?:line|path) class="janko-flag" data-stem-x="([\d.]+)" data-flag-index="(\d)"[^>]*>/g
    ),
  ];
  assert.equal(flags.length, expectedFlags, 'one mark per 8th, two per 16th');
  assert.equal(
    (crop.match(/class="janko-augmentation-dot"/g) ?? []).length,
    expectedDots,
    'one augmentation dot per dotted solitary value'
  );

  // Standard flag geometry: the mark starts on the stem, stays strictly right
  // of it and never reaches beyond its tokenised width. Round 9 dispatches the
  // settled beam-harmonized kinetic tab as the golden master, so the mark is a
  // 1.1pt monoline raked at the score's own beam slope.
  for (const m of flags) {
    const stemX = Number(m[1]);
    const element = m[0];
    assert.ok(element.startsWith('<line'), 'the settled kinetic tab is a monoline');
    const x1 = Number(/ x1="([\d.-]+)"/.exec(element)![1]);
    const y1 = Number(/ y1="([\d.-]+)"/.exec(element)![1]);
    const x2 = Number(/ x2="([\d.-]+)"/.exec(element)![1]);
    const y2 = Number(/ y2="([\d.-]+)"/.exec(element)![1]);
    assert.equal(x1, stemX, 'the tab latches onto the stem column');
    assert.ok(x2 >= stemX - 1e-9, `tab tip x=${x2} must not cross the stem at ${stemX}`);
    assert.ok(x2 - stemX <= TOKENS.flagWidth + 1e-9, 'the tab keeps its tokenised reach');
    assert.match(element, /stroke-width="1\.10"/, 'the tab is a 1.1pt monoline');
    assert.ok(
      Math.abs(Math.abs((y2 - y1) / (x2 - x1)) - TOKENS.maxBeamSlope) < 5e-3,
      'the tab rakes at the beam-harmonized slope'
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
        `class="janko-augmentation-dot" cx="${(n.x + TOKENS.noteheadRadius + 3.2).toFixed(2)}" cy="${n.y.toFixed(2)}" r="${TOKENS.augmentationDotRadius.toFixed(2)}"`
      ),
      `${n.id} carries its augmentation dot`
    );
  }
});

// ---------------------------------------------------------------------------
// 3b. Round 7 — the four single-note subdivision dialects (kinetic tabs)
// ---------------------------------------------------------------------------

/** Anchor y of one rendered subdivision mark (its `M` / line anchor). */
function subdivisionAnchorY(markup: string): number {
  const path = /d="M [\d.-]+ ([\d.-]+)/.exec(markup);
  if (path) return Number(path[1]);
  return Number(/ y1="([\d.]+)"/.exec(markup)![1]);
}

test('Round 9: the subdivision dialects dispatch at the stem tip and stack by flagSpacing', () => {
  assert.equal(
    DEFAULT_JANKO_OPTIONS.subdivisionStyle,
    'kinetic-tab-beam',
    'the golden master settles the beam-harmonized kinetic tab'
  );
  assert.deepEqual(
    [...JANKO_SUBDIVISION_STYLES],
    ['kinetic-tab-30', 'kinetic-tab-45', 'kinetic-tab-tapered', 'classical-urtext', 'kinetic-tab-beam'],
    'the exploratory rakes precede the settled beam-harmonized tab'
  );
  // Stack grammar: 32nd → 3 marks, 16th → 2, 8th/dotted 8th → 1.
  assert.equal(subdivisionMarkCount(6), 3);
  assert.equal(subdivisionMarkCount(12), 2);
  assert.equal(subdivisionMarkCount(24), 1);
  assert.equal(subdivisionMarkCount(36), 1);
  assert.equal(subdivisionMarkCount(48), 0);

  const sixteenth = {
    id: 'probe-16th',
    startTick: 0,
    durationTicks: 12,
    hand: 'RH' as const,
    x: 120,
    y: 200,
  };
  const stem = getStemGeometry(sixteenth, TOKENS);
  const ink = new Set<string>();
  for (const style of JANKO_SUBDIVISION_STYLES) {
    const markup = renderFlags(sixteenth, TOKENS, style);
    // The ink *shape* is the comparison key: the style tag and the shared stem
    // anchor are stripped, the geometry is kept — the monoline tabs differ by
    // their rake alone.
    ink.add(
      markup
        .replace(/ data-subdivision-style="[^"]*"/g, '')
        .replace(/ data-stem-x="[\d.]+" data-flag-index="\d"/g, '')
    );
    assert.match(markup, /class="janko-stem"/, `${style} keeps the stem`);
    assert.ok(
      !markup.includes('janko-tick') && !markup.includes('janko-cut'),
      `${style} is a flag, never a duration crossbar`
    );
    assert.ok(markup.includes(`data-subdivision-style="${style}"`), `${style} tags its ink`);
    const marks = [
      ...markup.matchAll(/class="janko-flag" data-stem-x="([\d.]+)" data-flag-index="(\d)"/g),
    ];
    assert.equal(marks.length, 2, `${style} stacks two marks on a 16th`);
    assert.equal(marks[0][1], stem.stemX.toFixed(2), `${style} latches onto the stem column`);
    assert.deepEqual(marks.map((m) => m[2]), ['1', '2'], `${style} stacks in order`);

    // The stack is spaced by `flagSpacing` along the flag drop.
    const first = renderSubdivisionMark(stem.stemX, stem.stemEndY, -1, 1, style, TOKENS);
    const second = renderSubdivisionMark(stem.stemX, stem.stemEndY, -1, 2, style, TOKENS);
    assert.ok(
      Math.abs(subdivisionAnchorY(second) - subdivisionAnchorY(first) - TOKENS.flagSpacing) < 1e-9,
      `${style} stacks by flagSpacing`
    );

    // Stem safety: every dialect reaches at most `flagWidth` right of the stem.
    const element = /<(path|rect|line) class="janko-flag"[^>]*\/>/.exec(markup)![0];
    if (element.startsWith('<line')) {
      const x1 = Number(/ x1="([\d.]+)"/.exec(element)![1]);
      const x2 = Number(/ x2="([\d.]+)"/.exec(element)![1]);
      assert.equal(x1, stem.stemX, `${style} tab is rooted on the stem`);
      assert.ok(x2 - stem.stemX <= TOKENS.flagWidth + 1e-9, `${style} tab keeps its tokenised reach`);
      assert.match(element, /stroke-width="1\.10"/, `${style} is a 1.1pt monoline`);
      // The kinetic rake itself: 30°, exactly 45°, or the beam-harmonized slope.
      const rake = Math.abs(
        (Number(/ y2="([\d.-]+)"/.exec(element)![1]) - Number(/ y1="([\d.-]+)"/.exec(element)![1])) /
          (x2 - x1)
      );
      const expected =
        style === 'kinetic-tab-45'
          ? 1
          : style === 'kinetic-tab-beam'
            ? TOKENS.maxBeamSlope
            : SUBDIVISION_TAB_30_TAN;
      assert.ok(Math.abs(rake - expected) < 5e-3, `${style} rakes at ${expected}`);
      continue;
    }
    const xs = [.../d="([^"]+)"/.exec(element)![1].matchAll(/-?\d+(?:\.\d+)?/g)]
      .map((n) => Number(n[0]))
      .filter((_, i) => i % 2 === 0);
    if (style === 'kinetic-tab-tapered') {
      // The tapered wing is rooted *on* the stem: its 1.4pt root straddles the
      // column by half its thickness, then reaches exactly `flagWidth` right.
      assert.ok(
        Math.abs(xs[0] - stem.stemX) <= SUBDIVISION_TAPER_ROOT / 2 + 1e-9,
        `${style} roots on the stem column`
      );
      assert.ok(
        Math.max(...xs) - stem.stemX <= TOKENS.flagWidth + 1e-9,
        `${style} keeps its tokenised reach`
      );
      continue;
    }
    // Round 8: the urtext control is a slender **open hairline** — never a
    // filled solid shape — stroked at the stem's own weight.
    assert.match(element, /fill="none"/, `${style} is an open stroke`);
    assert.match(
      element,
      new RegExp(`stroke-width="${SUBDIVISION_URTEXT_STROKE.toFixed(2)}"`),
      `${style} matches the 0.90pt stem weight`
    );
    assert.ok(!/d="[^"]*Z"/.test(element), `${style} never closes into a filled shape`);
    assert.equal(xs[0], stem.stemX, `${style} latches onto the stem tip`);
    for (const x of xs) {
      assert.ok(x >= stem.stemX - 1e-9, `${style} sample x=${x} must not cross its stem`);
    }
    assert.ok(Math.max(...xs) - stem.stemX <= TOKENS.flagWidth + 1e-9);
  }
  assert.equal(ink.size, JANKO_SUBDIVISION_STYLES.length, 'every dialect paints distinct ink');

  // The beam-harmonized tab is the settled Round 8 rake: atan(0.22) ≈ 12.4°.
  assert.ok(
    Math.abs(Math.atan(TOKENS.maxBeamSlope) * (180 / Math.PI) - 12.4) < 0.1,
    'the beam-harmonized tab rakes at ~12.4°'
  );

  // The multi-tier grammar: 8th → 1 tab, 16th → 2 tabs, 32nd → 3 tabs.
  const marksFor = (durationTicks: number): number => {
    const note = { ...sixteenth, durationTicks };
    return (renderFlags(note, TOKENS, 'kinetic-tab-beam').match(/class="janko-flag"/g) ?? []).length;
  };
  assert.equal(marksFor(24), 1, '8th = one kinetic tab');
  assert.equal(marksFor(12), 2, '16th = two kinetic tabs');
  assert.equal(marksFor(6), 3, '32nd = three kinetic tabs');

  // Round 8: the clasp no longer borrows the subdivision dialect — its duration
  // ink is the bracket's own symmetrical paradigm (see test/janko-clasp.test.ts).
  const clasped = computeClaspGeometry(
    [
      { id: 'tip-a', startTick: 0, durationTicks: 24, hand: 'RH' as const, x: 100, y: 100 },
      { id: 'tip-b', startTick: 0, durationTicks: 24, hand: 'RH' as const, x: 100, y: 130 },
    ],
    TOKENS
  )!;
  assert.equal(clasped.durationStyle, 'kinetic-cross-slashes', 'the clasp carries its own paradigm');
  const claspMarkup = renderChordClasp(clasped, TOKENS);
  assert.ok(!claspMarkup.includes('janko-flag'), 'no subdivision ink on the clasp');

  // End to end: the golden default dispatches the settled beam-harmonized tab,
  // and the control dialect still dispatches on request.
  const golden = renderJankoCrop(buildBachGoldbergVar1Score(), 1, 2, OPTIONS, TOKENS);
  assert.match(golden, /data-subdivision-style="kinetic-tab-beam"/);
  const control = renderJankoCrop(buildBachGoldbergVar1Score(), 1, 2, {
    ...OPTIONS,
    subdivisionStyle: 'classical-urtext',
  }, TOKENS);
  assert.match(control, /data-subdivision-style="classical-urtext"/);
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

test('Round 11 beaming integrity: a simultaneity never forms a zero-width melodic beam', () => {
  const note = (id: string, startTick: number, durationTicks: number): JankoRhythmNote => ({
    id,
    startTick,
    durationTicks,
    hand: 'RH',
    x: startTick,
    y: 0,
  });

  // Four chord tones sharing one onset: no group may form at all (the
  // zero-width beam whose vertical stem sliced every notehead).
  const chord = partitionBeamGroups([
    note('a', 0, 12),
    note('b', 0, 12),
    note('c', 0, 12),
    note('d', 0, 12),
  ]);
  assert.deepEqual(chord.groups, [], 'a simultaneity is never beamed');
  assert.equal(chord.ungrouped.length, 4, 'every chord head stays ungrouped');

  // A melodic run across distinct onsets still beams as one gesture.
  const run = partitionBeamGroups([
    note('a', 0, 12),
    note('b', 12, 12),
    note('c', 24, 12),
    note('d', 36, 12),
  ]);
  assert.deepEqual(
    run.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12, 24, 36]],
    'a melodic run is untouched'
  );

  // A chord beside a run: the run keeps beaming, the simultaneity stays out.
  const mixed = partitionBeamGroups([
    note('a', 0, 24),
    note('b', 24, 24),
    note('c', 24, 24),
    note('d', 48, 24),
  ]);
  for (const group of mixed.groups) {
    const ticks = group.map((n) => n.startTick);
    assert.equal(new Set(ticks).size, ticks.length, 'no group ever repeats an onset');
  }
  assert.equal(
    mixed.ungrouped.filter((n) => n.startTick === 24).length,
    2,
    'both heads of the simultaneity fall out of the beam'
  );

  // The canonical specimen is the case that exposed the defect: every onset is
  // a four-voice chord, so nothing beams and the clasps own every duration.
  const specimen = buildChordDurationSpecimenScore();
  const layout = layoutJankoScore(
    specimen,
    { ...OPTIONS, chordGrouping: 'per-hand-clasp', measuresPerSystem: 2 },
    TOKENS
  )[0];
  assert.equal(layout.beams.length, 0, 'the specimen forms no zero-width beam');
  assert.equal(
    layout.claspedStems.length,
    specimen.notes.length,
    'every chord head hands its duration to its bracket'
  );
});

test('Round 11 m. 31 counterpoint: LH 2 stems down, RH B stems up, no stem collision', () => {
  const score = buildBachGoldbergVar1Score();
  const onset = layoutJankoScore(score, OPTIONS, TOKENS)
    .flatMap((layout) => layout.notes)
    .filter((p) => p.note.startTick === 4344);
  assert.equal(onset.length, 2, 'the m. 31 tick 4344 onset is a two-voice simultaneity');
  const lh = onset.find((p) => p.coord.hand === 'LH')!;
  const rh = onset.find((p) => p.coord.hand === 'RH')!;
  assert.equal(lh.coord.pitchClass, 2, 'the LH voice is the duodecimal 2');
  assert.equal(rh.coord.pitchClass, 11, 'the RH voice is the duodecimal b');
  assert.equal(lh.coord.octave, 4);
  assert.equal(rh.coord.octave, 4);
  assert.ok(rh.y < lh.y, 'the RH b sits above the LH 2');

  // Opposing stem directions: down for the lower LH voice, up for the upper RH
  // voice, so the two stems point away from each other instead of colliding.
  const lhStem = getStemGeometry(lh.rhythm, TOKENS);
  const rhStem = getStemGeometry(rh.rhythm, TOKENS);
  assert.equal(lhStem.direction, 1, 'the LH 2 stems down');
  assert.equal(rhStem.direction, -1, 'the RH b stems up');
  assert.ok(lh.y < lhStem.stemEndY, 'the LH stem runs below its head');
  assert.ok(rh.y > rhStem.stemEndY, 'the RH stem runs above its head');

  // The two stem segments share a column but never overlap.
  assert.equal(lhStem.stemX, rhStem.stemX, 'both voices sound on the same beat column');
  const overlap =
    Math.min(Math.max(lhStem.stemStartY, lhStem.stemEndY), Math.max(rhStem.stemStartY, rhStem.stemEndY)) -
    Math.max(Math.min(lhStem.stemStartY, lhStem.stemEndY), Math.min(rhStem.stemStartY, rhStem.stemEndY));
  assert.ok(overlap < 0, `the m. 31 stems keep clear air (overlap ${overlap.toFixed(2)}pt)`);
});

// ---------------------------------------------------------------------------
// 4. Channel layouts (Round 4) — four comparative paradigms
// ---------------------------------------------------------------------------

/** Options delta of Candidate A: the incumbent floating single equator. */
const SINGLE_OPTIONS = { ...OPTIONS, channelLayout: 'single-equator' as const };
/** Options delta of Candidate B: Set A anchored on the rule, Set B static above. */
const ANCHORED_OPTIONS = { ...OPTIONS, channelLayout: 'on-the-line' as const };
/** Options delta of Candidate C: one rule per octave, contour-resolved ±15pt flank. */
const THREE_ROW_OPTIONS = { ...OPTIONS, channelLayout: 'single-line-3row' as const };
/** Options delta of Candidate D: two boundary rules at ±6.5pt, ±13pt flank. */
const CHANNEL_OPTIONS = { ...OPTIONS, channelLayout: 'bounded-channel' as const };

/** The exact per-mode table the round is defined by. */
const LAYOUT_CASES = [
  {
    id: 'single-equator',
    options: SINGLE_OPTIONS,
    setAOffset: 7.5,
    setBOffset: -7.5,
    rulesPerEquator: 1,
    dynamicFlanks: false,
    setAOnRule: false,
  },
  {
    id: 'on-the-line',
    options: ANCHORED_OPTIONS,
    setAOffset: 0,
    setBOffset: -15.0,
    rulesPerEquator: 1,
    dynamicFlanks: false,
    setAOnRule: true,
  },
  {
    id: 'single-line-3row',
    options: THREE_ROW_OPTIONS,
    setAOffset: 0,
    setBOffset: -15.0,
    rulesPerEquator: 1,
    dynamicFlanks: true,
    setAOnRule: true,
  },
  {
    id: 'bounded-channel',
    options: CHANNEL_OPTIONS,
    setAOffset: 0,
    setBOffset: -13.0,
    rulesPerEquator: 2,
    dynamicFlanks: true,
    setAOnRule: false,
  },
] as const;

test('Channel layout schema: four modes, golden default, canonical tokens', () => {
  assert.equal(
    DEFAULT_JANKO_OPTIONS.channelLayout,
    'single-equator',
    'the golden master stays on the single equator'
  );
  assert.equal(resolveJankoOptions({}).channelLayout, 'single-equator');
  assert.deepEqual(
    [...JANKO_CHANNEL_LAYOUTS],
    ['single-equator', 'on-the-line', 'single-line-3row', 'bounded-channel'],
    'the round explores exactly four paradigms, in candidate order'
  );
  for (const { id, options } of LAYOUT_CASES) {
    assert.equal(resolveJankoOptions(options).channelLayout, id);
    assert.equal(getChannelLayoutSpec(options, TOKENS).layout, id);
  }
  assert.ok(usesContourFlanks('single-line-3row') && usesContourFlanks('bounded-channel'));
  assert.ok(!usesContourFlanks('single-equator') && !usesContourFlanks('on-the-line'));
  assert.equal(getFlankOffset('single-line-3row', TOKENS), TOKENS.rowHeight);
  assert.equal(getFlankOffset('bounded-channel', TOKENS), TOKENS.channelFlankOffset);

  close(DEFAULT_JANKO_TOKENS.channelHalfWidth, 6.5, 'canonical channel half width (13pt channel)');
  close(DEFAULT_JANKO_TOKENS.channelFlankOffset, 13.0, 'canonical flank offset');
  close(
    DEFAULT_JANKO_TOKENS.channelFlankOffset,
    2 * DEFAULT_JANKO_TOKENS.channelHalfWidth,
    'the flank rows mirror the channel exactly'
  );
  assert.ok(
    DEFAULT_JANKO_TOKENS.channelHalfWidth - DEFAULT_JANKO_TOKENS.noteheadRadius > 1.0,
    'a notehead keeps real air from both boundary rules'
  );

  // One rule on the equator for three paradigms, two around it for the channel.
  assert.deepEqual(getEquatorRuleYs(-28.0, SINGLE_OPTIONS, TOKENS), [-28.0]);
  assert.deepEqual(getEquatorRuleYs(-28.0, ANCHORED_OPTIONS, TOKENS), [-28.0]);
  assert.deepEqual(getEquatorRuleYs(-28.0, THREE_ROW_OPTIONS, TOKENS), [-28.0]);
  assert.deepEqual(getEquatorRuleYs(-28.0, CHANNEL_OPTIONS, TOKENS), [-34.5, -21.5]);

  // The golden-master engraving is byte-identical with the channel in place.
  const score = buildBachGoldbergVar1Score();
  assert.equal(
    renderJankoCrop(score, 1, 2, SINGLE_OPTIONS, TOKENS),
    renderJankoCrop(score, 1, 2, OPTIONS, TOKENS)
  );
});

test('Channel geometry per mode: Set A/B rows and rule counts exactly as specified', () => {
  const score = buildBachGoldbergVar1Score();
  for (const c of LAYOUT_CASES) {
    const spec = getChannelLayoutSpec(c.options, TOKENS);
    close(spec.setAOffset, c.setAOffset, `${c.id} Set A offset`);
    close(spec.setBOffset, c.setBOffset, `${c.id} canonical Set B offset`);
    assert.equal(spec.flankMagnitude, Math.abs(c.setBOffset), `${c.id} flank magnitude`);
    assert.equal(spec.rulesPerEquator, c.rulesPerEquator, `${c.id} rules per equator`);
    assert.equal(spec.staffRules, 4 * c.rulesPerEquator, `${c.id} rules across the staff`);
    assert.equal(spec.dynamicFlanks, c.dynamicFlanks, `${c.id} flank resolution`);
    assert.equal(spec.setAOnRule, c.setAOnRule, `${c.id} Set A anchor`);

    // Set A always resolves to the base row, Set B to the flank row(s).
    for (const pc of [0, 2, 4, 6, 8, 10]) {
      close(
        getPitchCoordinate(pc, 4, 'RH', TOKENS, c.options).offsetFromEquator,
        c.setAOffset,
        `${c.id} pc${pc} Set A row`
      );
    }
    const upper = getPitchCoordinate(1, 4, 'RH', TOKENS, c.options, 'up');
    const lower = getPitchCoordinate(1, 4, 'RH', TOKENS, c.options, 'down');
    close(upper.offsetFromEquator, c.setBOffset, `${c.id} Set B upper row`);
    close(
      lower.offsetFromEquator,
      c.dynamicFlanks ? -c.setBOffset : c.setBOffset,
      `${c.id} Set B lower row`
    );
    assert.equal(upper.flank, c.id === 'single-equator' ? null : 'up');
    assert.equal(lower.flank, c.id === 'single-equator' ? null : c.dynamicFlanks ? 'down' : 'up');
    assert.equal(upper.side, 'above');
    assert.equal(
      lower.side,
      c.dynamicFlanks ? 'below' : 'above',
      `${c.id} static Set B never drops below its base row`
    );

    // End to end: every engraved note keeps a tabulated offset, and the two
    // anchored modes leave no Set A notehead clear of the rule (that is their
    // defining trade-off — 1 rule per octave, cut by every base-row glyph).
    const allowed = new Set([
      c.setAOffset,
      c.setBOffset,
      ...(c.dynamicFlanks ? [-c.setBOffset] : []),
    ]);
    for (const layout of layoutJankoScore(score, c.options, TOKENS)) {
      for (const p of layout.notes) {
        const offset = p.coord.y - p.coord.equatorY;
        assert.ok(
          [...allowed].some((a) => Math.abs(offset - a) < 1e-9),
          `${c.id} ${p.note.id} offset ${offset} is one of ${[...allowed].join(', ')}`
        );
      }
    }

    // Rule ink: 4 lines for the single-rule framings, 8 for the channel.
    const crop = renderJankoCrop(score, 1, 2, c.options, TOKENS);
    const staffGroup = crop.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
    assert.equal(
      (staffGroup.match(/<line/g) ?? []).length,
      spec.staffRules,
      `${c.id} paints ${spec.staffRules} staff rules`
    );
  }
});

test('Bounded channel rendering: two boundary rules per equator, Set A in the gap', () => {
  const score = buildBachGoldbergVar1Score();
  const halfWidth = TOKENS.channelHalfWidth;
  const crop = renderJankoCrop(score, 1, 2, CHANNEL_OPTIONS, TOKENS);
  const staffGroup = crop.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
  const ruleYs = [...staffGroup.matchAll(/<line x1="[\d.]+" y1="([\d.]+)"/g)].map((m) => Number(m[1]));
  const staffEquators: Array<[Hand, number]> = [
    ['RH', 5],
    ['LH', 2],
    ['RH', 4],
    ['LH', 3],
  ];
  assert.equal(ruleYs.length, staffEquators.length * 2, 'two boundary rules per octave equator');
  const geo = computePageGeometry(CHANNEL_OPTIONS, TOKENS);
  for (const [hand, oct] of staffEquators) {
    const eq = geo.systems[0].equatorY(hand, oct);
    assert.ok(ruleYs.includes(Number((eq - halfWidth).toFixed(2))), `${hand} o${oct} upper rule`);
    assert.ok(ruleYs.includes(Number((eq + halfWidth).toFixed(2))), `${hand} o${oct} lower rule`);
    assert.ok(!ruleYs.includes(Number(eq.toFixed(2))), `${hand} o${oct} carries no single equator`);
  }

  // Row assignment across the opening window: Set A on the equator (`offset
  // 0.0`, inside the channel), Set B on its contour-resolved flank.
  let channelHeads = 0;
  let flankHeads = 0;
  for (const layout of layoutJankoScore(score, CHANNEL_OPTIONS, TOKENS)) {
    for (const p of layout.notes) {
      const offset = p.coord.y - p.coord.equatorY;
      if (p.coord.rank === 0) {
        close(offset, 0.0, `${p.note.id} Set A sits on the equator`);
        assert.equal(p.coord.side, 'channel', `${p.note.id} reads as the center row`);
        assert.equal(p.coord.flank, null, 'the channel row has no flank');
        channelHeads++;
      } else {
        close(Math.abs(offset), TOKENS.channelFlankOffset, `${p.note.id} Set B flank offset`);
        assert.equal(p.coord.side, offset < 0 ? 'above' : 'below');
        assert.equal(p.coord.flank, offset < 0 ? 'up' : 'down');
        flankHeads++;
      }
      assert.ok(
        (offset === 0
          ? TOKENS.channelHalfWidth
          : Math.abs(offset) - TOKENS.channelHalfWidth) -
          TOKENS.noteheadRadius >
          1.0,
        `${p.note.id} disc never touches a boundary rule`
      );
    }
  }
  assert.ok(channelHeads > 0 && flankHeads > 0, 'the score exercises both whole-tone sets');

  // Direction-sensitive flanks: ascending into Set B takes the upper row,
  // descending into it takes the lower one.
  const offsetsOf = (pcs: number[], prefix: string): number[] => {
    const notes = pcs.map((pc, i) => makeNote(`${prefix}-${i}`, pc, 4, i * 12, 12, 'RH'));
    const layout = layoutJankoScore(makeScore(notes, 144), CHANNEL_OPTIONS, TOKENS)[0];
    return layout.notes.map((p) => p.coord.y - p.coord.equatorY);
  };
  assert.deepEqual(offsetsOf([2, 3, 4], 'rise'), [0, -TOKENS.channelFlankOffset, 0], 'ascending 2-3-4');
  assert.deepEqual(
    offsetsOf([2, 1, 0], 'fall'),
    [0, TOKENS.channelFlankOffset, 0],
    'the descending 2-1-0 puts 1 below the lower rule'
  );
});

test('Anchored single line: Set A rides the rule, Set B stays one row above', () => {
  const score = buildBachGoldbergVar1Score();
  for (const layout of layoutJankoScore(score, ANCHORED_OPTIONS, TOKENS)) {
    const g = layout.geometry;
    const ruleYs = ([
      ['RH', 5],
      ['RH', 4],
      ['LH', 3],
      ['LH', 2],
    ] as Array<[Hand, number]>).map(([hand, oct]) => g.equatorY(hand, oct));
    for (const p of layout.notes) {
      const offset = p.coord.y - p.coord.equatorY;
      if (p.coord.rank === 0) {
        close(offset, 0.0, `${p.note.id} Set A is centred on the rule`);
        assert.equal(p.coord.side, 'channel');
        assert.equal(p.coord.flank, null);
        // The anchor is literal: an in-staff base-row notehead sits exactly on
        // a painted staff rule, so its knockout cuts that rule.
        if (!p.coord.isOutOfStaff) {
          assert.ok(
            ruleYs.some((y) => Math.abs(y - p.y) < 1e-9),
            `${p.note.id} base row coincides with a staff rule`
          );
        }
      } else {
        close(offset, -TOKENS.rowHeight, `${p.note.id} Set B is one whole-tone row above`);
        assert.equal(p.coord.side, 'above');
        assert.equal(p.coord.flank, 'up', 'the static layout never drops below the base row');
      }
    }
  }

  // The static framing needs no contour solver: there is only one Set B row.
  assert.equal(
    resolveChannelFlanks(score.notes, ANCHORED_OPTIONS, TOKENS).size,
    0,
    'the anchored layout has no flank to resolve'
  );
  const offsetsOf = (pcs: number[]): number[] => {
    const notes = pcs.map((pc, i) => makeNote(`anchored-${i}`, pc, 4, i * 12, 12, 'RH'));
    const layout = layoutJankoScore(makeScore(notes, 144), ANCHORED_OPTIONS, TOKENS)[0];
    return layout.notes.map((p) => p.coord.y - p.coord.equatorY);
  };
  assert.deepEqual(offsetsOf([2, 3, 4]), [0, -TOKENS.rowHeight, 0], 'ascending 2-3-4');
  assert.deepEqual(offsetsOf([2, 1, 0]), [0, -TOKENS.rowHeight, 0], 'descending 2-1-0 is identical');
});

test('Channel contour solver: every Set B note resolved, static layouts untouched', () => {
  const score = buildBachGoldbergVar1Score();
  for (const staticOptions of [SINGLE_OPTIONS, ANCHORED_OPTIONS]) {
    assert.equal(
      resolveChannelFlanks(score.notes, staticOptions, TOKENS).size,
      0,
      'a static layout never needs a flank'
    );
  }
  const setB = score.notes.filter((n) => getWholeToneRank(n.pitch.pitchClass) === 1);
  for (const dynamicOptions of [CHANNEL_OPTIONS, THREE_ROW_OPTIONS]) {
    const flanks = resolveChannelFlanks(score.notes, dynamicOptions, TOKENS);
    assert.equal(flanks.size, setB.length, 'one flank per whole-tone Set B note');
    for (const n of setB) {
      const flank = flanks.get(n.id);
      assert.ok(flank === 'up' || flank === 'down', `${n.id} resolved to a row`);
    }
    assert.deepEqual(
      [...resolveChannelFlanks(score.notes, dynamicOptions, TOKENS)],
      [...flanks],
      'the solver is a pure, deterministic function of the score'
    );
  }
});

test('Non-contradiction invariant: every m. 1 step follows the pitch contour', () => {
  // The round-4 probe: a descending 7-6-4-2 run into the row, across the
  // 2-1 semitone neighbour and back up through 2-4-6. It is solved identically
  // by both dynamic layouts — only the flank offset changes (15pt vs 13pt).
  const sequence = [7, 6, 4, 2, 1, 2, 4, 6];
  for (const c of LAYOUT_CASES.filter((x) => x.dynamicFlanks)) {
    const flank = c.id === 'single-line-3row' ? TOKENS.rowHeight : TOKENS.channelFlankOffset;
    const notes = sequence.map((pc, i) => makeNote(`channel-${i}`, pc, 4, i * 12, 12, 'RH'));
    const layout = layoutJankoScore(makeScore(notes, 144), c.options, TOKENS)[0];
    const offsets = new Map(layout.notes.map((p) => [p.note.id, p.coord.y - p.coord.equatorY]));
    const step = (a: number, b: number): number =>
      offsets.get(`channel-${b}`)! - offsets.get(`channel-${a}`)!;

    // 7 -> 6 descends out of the upper flank into the center row.
    close(offsets.get('channel-0')!, -flank, `${c.id} 7 opens on the upper flank`);
    assert.ok(step(0, 1) > 0, '7 -> 6 moves down the page');
    close(offsets.get('channel-1')!, 0, '6 lands in the center row');

    // 6 -> 4 -> 2 stays flat inside the row.
    assert.equal(step(1, 2), 0);
    assert.equal(step(2, 3), 0);

    // 2 -> 1 descends onto the lower flank ...
    close(offsets.get('channel-4')!, flank, `${c.id} 1 takes the lower flank`);
    assert.ok(step(3, 4) > 0, '2 -> 1 moves down the page');

    // ... and 1 -> 2 rises back into the center row.
    assert.ok(step(4, 5) < 0, '1 -> 2 moves up the page');
    close(offsets.get('channel-5')!, 0, '2 lands back in the center row');

    // 2 -> 4 -> 6 stays flat.
    assert.equal(step(5, 6), 0);
    assert.equal(step(6, 7), 0);

    // Zero steps of the probe contradict the pitch direction.
    for (let i = 1; i < sequence.length; i++) {
      const dPitch = sequence[i] - sequence[i - 1];
      if (dPitch === 0) continue;
      const dy = step(i - 1, i);
      assert.ok(
        dPitch > 0 ? dy <= 1e-9 : dy >= -1e-9,
        `${c.id}: pc ${sequence[i - 1]} -> pc ${sequence[i]} must not invert (dy=${dy})`
      );
    }
  }
});

test('Dynamic layouts: the canonical Bach score never contradicts the pitch contour', () => {
  const score = buildBachGoldbergVar1Score();
  for (const c of LAYOUT_CASES.filter((x) => x.dynamicFlanks)) {
    const layouts = layoutJankoScore(score, c.options, TOKENS);
    let steps = 0;
    let flat = 0;
    for (const hand of HANDS) {
      const voice = layouts
        .flatMap((layout) => layout.notes)
        .filter((p) => p.coord.hand === hand)
        .sort((a, b) => a.note.startTick - b.note.startTick || a.coord.y - b.coord.y);
      for (let i = 1; i < voice.length; i++) {
        const a = voice[i - 1];
        const b = voice[i];
        const dPitch =
          b.coord.octave * 12 + b.coord.pitchClass - (a.coord.octave * 12 + a.coord.pitchClass);
        if (dPitch === 0) continue;
        steps++;
        const dy = b.coord.y - a.coord.y;
        if (Math.abs(dy) < 1e-9) flat++;
        assert.ok(
          dPitch > 0 ? dy <= 1e-9 : dy >= -1e-9,
          `${c.id} ${hand} ${a.note.id} (pc${a.coord.pitchClass}) -> ${b.note.id} (pc${b.coord.pitchClass}) ` +
            `inverts the contour (dy=${dy.toFixed(2)})`
        );
      }
    }
    assert.ok(steps > 500, `${c.id}: the score is contoured (${steps} steps)`);
    assert.ok(flat > 100, `${c.id}: the center row absorbs real motion as flat steps (${flat})`);
  }
});

test('Anchored and 3-row layouts surface their real cost: high notes crowd the numeral margin', () => {
  // Anchoring Set A on the rule pushes the outer Set B row one half-row higher
  // than the golden master, so the topmost o5 notes come closer to the measure
  // numeral's box. The linter measures that air (the numeral box is the figures'
  // real ink box, from cap height down to the baseline) from the Round 11
  // right-aligned margin anchor, so the decision matrix shows the real cost of
  // the paradigm without inventing a collision that is not painted.
  const score = buildBachGoldbergVar1Score();
  // Round 11 equalizes the lattice to one 30pt octave step, so the four layout
  // paradigms share the same staff geometry; only the row framing differs.
  const CLEARANCE: Record<string, number> = {
    'single-equator': 14.90,
    'on-the-line': 11.69,
    'single-line-3row': 11.69,
    'bounded-channel': 12.29,
  };
  for (const c of LAYOUT_CASES) {
    const report = lintJankoScore(score, c.options, TOKENS);
    assert.deepEqual(
      report.violations.map((v) => `${v.code}: ${v.message}`),
      [],
      `${c.id} lint verdict`
    );
    assert.ok(
      report.diagnostics.every((d) => d.code === 'chordal-overlap'),
      `${c.id} produces no unexpected diagnostic class`
    );
    const layouts = layoutJankoScore(score, c.options, TOKENS);
    let air = Number.POSITIVE_INFINITY;
    for (const layout of layouts) {
      const { numeral } = getMarginFurniture(
        layout.geometry,
        TOKENS,
        layout.index * c.options.measuresPerSystem + 1
      );
      for (const p of layout.notes) {
        const dx = Math.max(numeral.x0 - p.x, 0, p.x - numeral.x1);
        const dy = Math.max(numeral.y0 - p.y, 0, p.y - numeral.y1);
        air = Math.min(air, Math.hypot(dx, dy) - TOKENS.noteheadRadius);
      }
    }
    assert.ok(
      Math.abs(air - CLEARANCE[c.id]) < 0.05,
      `${c.id} keeps ${CLEARANCE[c.id]}pt of numeral air (measured ${air.toFixed(2)}pt)`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. Export suite invariant
// ---------------------------------------------------------------------------

test('npm run janko:export produces all twelve PNGs everywhere in under 3 seconds', () => {
  const started = Date.now();
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/render_janko_suite.ts'], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
  });
  const elapsed = Date.now() - started;

  const mirrors = (root: string): string[] => [
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

  // The unified domain sheet is the round's headline artifact: four panels at
  // 3× (216 DPI) on the same two measures.
  const sheet = fs.readFileSync(path.join(REPO_ROOT, 'public', 'janko_domain_exploration.png'));
  assert.ok(sheet.length > 10_000, 'the four-paradigm contact sheet is a real rasterization');
  assert.deepEqual([...sheet.subarray(1, 4)], [...Buffer.from('PNG')], 'the sheet is a PNG');

  // The Brahms pressure benchmark ships as a full page plus the mm. 7–8 macro
  // crop of the two five-voice chords.
  const brahms = fs.readFileSync(path.join(REPO_ROOT, 'public', 'janko_brahms_m7_m8.png'));
  assert.ok(brahms.length > 10_000, 'the Brahms chord crop is a real rasterization');
  assert.deepEqual([...brahms.subarray(1, 4)], [...Buffer.from('PNG')], 'the crop is a PNG');

  assert.ok(elapsed < 3000, `export suite must finish under 3s (took ${elapsed}ms)`);
});
