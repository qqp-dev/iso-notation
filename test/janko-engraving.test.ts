/**
 * Jánko Engraving Ergonomics Harness — invariant test suite.
 *
 * Covers:
 *  1. Jánko geometry & pitch isomorphism (rank mapping, row/octave steps,
 *     dynamic ledger equators, Position of Honor halo).
 *  2. The modular engine (page/crop/variant SVG composition).
 *  3. The unified export suite (`npm run janko:export`) and its ten PNGs —
 *     including the Round 4 four-paradigm domain sheet — in every delivery
 *     location, inside the 3-second budget.
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
  JANKO_CHANNEL_LAYOUTS,
  JANKO_STAFF_OCTAVES,
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
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  renderJankoVariantComparison,
} from '../src/render/janko/engine';
import {
  getStemAttachmentRadii,
  getStemAttachmentRadius,
  getStemGeometry,
  partitionBeamGroups,
} from '../src/render/janko/elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
  renderHalo,
} from '../src/render/janko/elements/notehead';
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

  // The four continuous staff rules of the grand staff.
  for (const hand of HANDS) {
    close(getEquatorYForOctave(5, hand, TOKENS, OPTIONS), -58.0, `o5 staff rule (${hand})`);
    close(getEquatorYForOctave(4, hand, TOKENS, OPTIONS), -28.0, `o4 staff rule (${hand})`);
    close(getEquatorYForOctave(3, hand, TOKENS, OPTIONS), +28.0, `o3 staff rule (${hand})`);
    close(getEquatorYForOctave(2, hand, TOKENS, OPTIONS), +58.0, `o2 staff rule (${hand})`);
  }

  // Octaves step by exactly 2h inside each staff half and climb upward; the
  // only wider step is the 56pt Middle C corridor between o4 and o3.
  for (const hand of HANDS) {
    for (let oct = 0; oct <= 7; oct++) {
      const lower = getEquatorYForOctave(oct, hand, TOKENS, OPTIONS);
      const upper = getEquatorYForOctave(oct + 1, hand, TOKENS, OPTIONS);
      assert.ok(upper < lower, 'higher octaves must climb upward on the page');
      if (oct === 3) {
        close(lower - upper, OPTIONS.interStaffGap, `corridor spans interStaffGap (${hand})`);
      } else {
        close(lower - upper, TOKENS.octaveStep, `octave step ${oct}->${oct + 1} (${hand})`);
      }
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

test('Spacious spine-free corridor anchors the two inner staff rules (o4 −28pt / o3 +28pt)', () => {
  close(OPTIONS.interStaffGap, 56.0, 'canonical spacious inter-staff gap');
  close(getEquatorYForOctave(4, 'RH', TOKENS, OPTIONS), -28.0, 'RH o4 equator');
  close(getEquatorYForOctave(3, 'LH', TOKENS, OPTIONS), 28.0, 'LH o3 equator');
  close(getEquatorYForOctave(5, 'RH', TOKENS, OPTIONS), -58.0, 'RH o5 equator');
  close(getEquatorYForOctave(2, 'LH', TOKENS, OPTIONS), 58.0, 'LH o2 equator');
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
  close(rh3.equatorY, 28.0, 'RH o3 is the true staff rule');
  assert.equal(rh3.ledgerY, null);

  // Measure 3 scenario: the LH reaching up into octave 4 lands on the o4 rule.
  const lh4 = getPitchCoordinate(0, 4, 'LH', TOKENS, OPTIONS);
  assert.equal(lh4.isOutOfStaff, false);
  close(lh4.equatorY, getEquatorYForOctave(4, 'RH', TOKENS, OPTIONS), 'LH o4 shares the RH o4 rule');
  close(lh4.equatorY, -28.0, 'LH o4 is the true staff rule');
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
    close(p.coord.equatorY, -28.0, `${p.note.id} LH o4 equator`);
    close(p.y, o4Rule + p.coord.offsetFromEquator, `${p.note.id} head sits on the o4 staff rule`);
    assert.equal(p.coord.ledgerY, null, `${p.note.id} carries no ledger`);
  }

  // Measure 4: the RH octave-3 run sits on the true o3 rule with no ledger.
  const rh3 = sys0.notes.filter((p) => p.coord.hand === 'RH' && p.coord.octave === 3);
  assert.ok(rh3.length > 0, 'm. 4 contains RH octave-3 notes');
  for (const p of rh3) {
    close(p.coord.equatorY, 28.0, `${p.note.id} RH o3 equator`);
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
    close(sys.equatorY('RH', 4) - sys.middleCY, -28.0, 'RH o4 above spine');
    close(sys.equatorY('LH', 3) - sys.middleCY, 28.0, 'LH o3 below spine');
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

  // The system is still credited in the bottom attribution footer.
  const footer = page.match(/<g id="page-footer">[\s\S]*?<\/g>/)?.[0] ?? '';
  assert.match(footer, /Pure 12-TET Jánko Two-Row Grand Staff/);
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
// 2b. Spacious corridor, dotted-line elimination, notehead optics & stem air
// ---------------------------------------------------------------------------

const MIDDLE_C_SPINE_GROUP = 'class="janko-middle-c-spine"';
const ROW_GUIDELINES_GROUP = 'class="janko-row-guidelines"';

test('Spacious spine-free corridor invariant: 56pt of negative space, zero Middle C rule', () => {
  const score = buildBachGoldbergVar1Score();
  assert.equal(DEFAULT_JANKO_OPTIONS.interStaffGap, 56.0);
  assert.equal(DEFAULT_JANKO_OPTIONS.middleCSpine, 'none');

  const geo = computePageGeometry(OPTIONS, TOKENS);
  for (const sys of geo.systems) {
    close(sys.middleCY - sys.equatorY('RH', 4), 28.0, 'RH half corridor');
    close(sys.equatorY('LH', 3) - sys.middleCY, 28.0, 'LH half corridor');
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

test('Anchored and 3-row layouts surface their real cost: high notes hit the numeral margin', () => {
  // Anchoring Set A on the rule pushes the outer Set B row one half-row higher
  // than the golden master, which is enough for two o5 notes at system openings
  // to reach into the measure-numeral column. The linter reports it instead of
  // hiding it, so the decision matrix shows the real cost of the paradigm.
  const score = buildBachGoldbergVar1Score();
  for (const c of LAYOUT_CASES) {
    const report = lintJankoScore(score, c.options, TOKENS);
    assert.deepEqual(
      report.violations.map((v) => `${v.code}: ${v.message}`),
      c.setAOnRule
        ? [
            'measure-numeral-collision: Measure numeral collides with notehead bach-var1-139.',
            'measure-numeral-collision: Measure numeral collides with notehead bach-var1-481.',
          ]
        : [],
      `${c.id} lint verdict`
    );
    assert.ok(
      report.diagnostics.every((d) => d.code === 'chordal-overlap' || d.code === 'measure-numeral-collision'),
      `${c.id} produces no unexpected diagnostic class`
    );
  }
});

// ---------------------------------------------------------------------------
// 5. Export suite invariant
// ---------------------------------------------------------------------------

test('npm run janko:export produces all ten PNGs everywhere in under 3 seconds', () => {
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

  // The unified domain sheet is the round's headline artifact: four panels at
  // 3× (216 DPI) on the same two measures.
  const sheet = fs.readFileSync(path.join(REPO_ROOT, 'janko_domain_exploration.png'));
  assert.ok(sheet.length > 10_000, 'the four-paradigm contact sheet is a real rasterization');
  assert.deepEqual([...sheet.subarray(1, 4)], [...Buffer.from('PNG')], 'the sheet is a PNG');

  assert.ok(elapsed < 3000, `export suite must finish under 3s (took ${elapsed}ms)`);
});
