/**
 * Round 21 — Measured Duration Ink · Slabs on Lines · Lower-First.
 *
 * The round's own pins, one section per ticket letter:
 *
 * - **§A** the measurement table's envelope, per value (§B pins the cut to it);
 * - **§C** slabs touch drawn staff rules, the whole bar is centred, and the
 *   linter names a slab that floats;
 * - **§D** lower-first on all sixteen corpus rows, the stem tripwire, and the
 *   lower-voice unison survivor;
 * - **§E** the complete working set: 32nd/64th rests and flags, the generic
 *   tertiary/quaternary beam levels, and the Gould partial beams;
 * - **§F** the registry windows the operator reads.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DURATION_SPECIMEN_JANKO_OPTIONS,
  DURATION_SPECIMEN_JANKO_TOKENS,
  buildDurationSpecimenScore,
} from '../src/scores/duration-specimen';
import {
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { getEquatorRuleYs } from '../src/render/janko/elements/staff';
import {
  JANKO_REST_VALUES,
  REST_MARK_COUNT,
  REST_SIXTY_FOURTH_HEIGHT,
  REST_SPACE_PT,
  SMUFL_SPACE_UNITS,
  beamLevelOf,
  restInkBox,
  restInkCentroidOffset,
} from '../src/render/janko/elements/rests';
import { subdivisionMarkCount } from '../src/render/janko/elements/rhythm';
import { layoutJankoScore, drawnStaffRuleYs, nearestDrawnStaffRule } from '../src/render/janko/engine';
import { checkRestSeat, lintJankoScore } from '../src/render/janko/linter';
import type { LintViolation } from '../src/render/janko/linter';
import { CURRENT_CANDIDATES, CURRENT_ROUND_METADATA } from '../src/render/janko/candidates';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const REST_SPECIMEN = buildRestDurationSpecimenScore();
const DURATION_SPECIMEN = buildDurationSpecimenScore();

const SPECIMEN_TOKENS = resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS);
const SPECIMEN_OPTIONS = resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS);

// ---------------------------------------------------------------------------
// §A/§B — the measured cut
// ---------------------------------------------------------------------------

test('§A scale: one staff space is the measured headroom over the 64th envelope', () => {
  const t = DEFAULT_JANKO_TOKENS;
  const headroom = 2 * (t.rowHeight - t.noteheadRadius - 1.0);
  assert.ok(
    Math.abs(REST_SPACE_PT - headroom / (1183 / SMUFL_SPACE_UNITS)) < 1e-12,
    'the scale is derived, not chosen'
  );
  assert.ok(
    Math.abs(REST_SIXTY_FOURTH_HEIGHT - headroom) < 1e-9,
    'and it makes the 64th envelope exactly the headroom'
  );
});

test('§A/§B proportions: every value carries the measured Bravura envelope', () => {
  // Measured bboxes (Bravura v1.482, upm 1000, space 250u) → pt through the
  // one explicit scale. These are §A table rows, not eyeballed numbers.
  const measured: Record<string, readonly [number, number]> = {
    quarter: [269, 748],
    eighth: [247, 425],
    sixteenth: [320, 679],
    'thirty-second': [363, 926],
    'sixty-fourth': [423, 1183],
  };
  const u = (units: number): number => (units / SMUFL_SPACE_UNITS) * REST_SPACE_PT;
  for (const [value, [w, h]] of Object.entries(measured)) {
    const box = restInkBox(
      {
        tick: 0,
        durationTicks: 0,
        hand: 'RH',
        x: 0,
        y: 0,
        value: value as (typeof JANKO_REST_VALUES)[number],
        style: 'kinetic-monoline',
      },
      DEFAULT_JANKO_TOKENS
    );
    const width = box.x1 - box.x0;
    const height = box.y1 - box.y0;
    // The spine/contour reconstruction keeps the measured envelope within 3%
    // (the resampling residual at the caps; the ticket allows no fake curve
    // precision, so the tolerance is stated rather than the curve faked).
    assert.ok(Math.abs(width - u(w)) < u(w) * 0.03, `${value}: width ${width.toFixed(2)} vs ${u(w).toFixed(2)}`);
    assert.ok(Math.abs(height - u(h)) < u(h) * 0.03, `${value}: height ${height.toFixed(2)} vs ${u(h).toFixed(2)}`);
  }
});

test('§B duration grammar: seven values, one mark per hook', () => {
  assert.deepEqual(JANKO_REST_VALUES, [
    'sixty-fourth',
    'thirty-second',
    'sixteenth',
    'eighth',
    'quarter',
    'half',
    'whole',
  ]);
  assert.deepEqual(
    JANKO_REST_VALUES.map((value) => REST_MARK_COUNT[value]),
    [4, 3, 2, 1, 0, 0, 0],
    'the measured lobe counts, and none for the quarter or the bar pair'
  );
  // A flagged note and a rest of the same value can never disagree.
  for (const [ticks, marks] of [
    [3, 4],
    [6, 3],
    [12, 2],
    [24, 1],
  ] as const) {
    assert.equal(subdivisionMarkCount(ticks), marks, `${ticks} ticks carries ${marks} marks`);
    assert.equal(beamLevelOf(marks), marks, 'and the beam level is the mark count');
  }
});

// ---------------------------------------------------------------------------
// §C — slabs on drawn lines, whole centred
// ---------------------------------------------------------------------------

test('§C: every bar rest touches a drawn staff rule, to the float', () => {
  const layouts = layoutJankoScore(REST_SPECIMEN, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
  const bars = layouts.flatMap((l) => l.rests.filter((r) => r.value === 'half' || r.value === 'whole'));
  assert.equal(bars.length, 2, 'the specimen states the half and the whole bar');
  for (const rest of bars) {
    const layout = layouts.find((l) => l.rests.includes(rest))!;
    const rules = drawnStaffRuleYs(layout.geometry, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
    assert.ok(
      rules.some((rule) => Math.abs(rule - rest.y) < 1e-9),
      `${rest.value}: the seat point is a drawn rule`
    );
    assert.ok(
      Math.abs(nearestDrawnStaffRule(rest.y, layout.geometry, SPECIMEN_OPTIONS, SPECIMEN_TOKENS) - rest.y) < 1e-9,
      `${rest.value}: and it is the nearest one`
    );
    const box = restInkBox(rest, SPECIMEN_TOKENS);
    const contact = rest.value === 'half' ? box.y1 : box.y0;
    assert.ok(Math.abs(contact - rest.y) < 1e-9, `${rest.value}: the contact edge is on the line (zero gap)`);
  }
});

test('§C: the whole bar is centred in its measure — 220.29 → 303.54 on the specimen', () => {
  const layouts = layoutJankoScore(REST_SPECIMEN, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
  const whole = layouts.flatMap((l) => l.rests).find((r) => r.value === 'whole')!;
  assert.equal(whole.tick, 768, 'the specimen’s m. 5 whole bar');
  assert.ok(Math.abs(whole.x - 303.54) < 0.02, `centred on the barline midpoint (got ${whole.x.toFixed(2)})`);
  assert.ok(Math.abs(whole.x - 220.29) > 80, 'and 83pt from the R20 onset column it used to hold');
  // The half slab keeps its beat column: §C moves no hanging seat.
  // (−4 staffLeft + ⅛·(8/3) measure growth at tick 600 under golden margins.)
  const half = layouts.flatMap((l) => l.rests).find((r) => r.value === 'half')!;
  assert.ok(Math.abs(half.x - 58.945) < 0.02, `the half stays on its beat column (got ${half.x.toFixed(2)})`);
});

test('§C violation fixture: a slab off its line is named rest-slab-off-line', () => {
  const layouts = layoutJankoScore(REST_SPECIMEN, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
  const system = layouts.find((l) => l.rests.some((r) => r.value === 'half'))!;
  const clean: LintViolation[] = [];
  checkRestSeat(system, SPECIMEN_OPTIONS, SPECIMEN_TOKENS, clean);
  assert.deepEqual(clean, [], 'the shipped seats are clean');
  // The floating brick: the half slab lifted 1.4pt off its drawn rule.
  const drifted = {
    ...system,
    rests: system.rests.map((r) => (r.value === 'half' ? { ...r, y: r.y - 1.4 } : r)),
  };
  const out: LintViolation[] = [];
  checkRestSeat(drifted, SPECIMEN_OPTIONS, SPECIMEN_TOKENS, out);
  assert.equal(out.length, 1, 'the floating slab is named');
  assert.equal(out[0].code, 'rest-slab-off-line');
  assert.equal(out[0].severity, 'error');
  assert.ok(Math.abs((out[0].metrics?.offLine as number) - 1.4) < 1e-9);
});

test('§C: the same-pitch doubling of a mid-measure 192-tick silence stays unwritten (green)', () => {
  // A 192-tick silence that does *not* open a measure is not a whole bar, so it
  // is a non-silence: never a slab slid onto a line, never a violation.
  const report = lintJankoScore(REST_SPECIMEN, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
  assert.equal(report.ok, true);
  assert.equal(report.warnings.length, 0);
});

// ---------------------------------------------------------------------------
// §D — lower-first
// ---------------------------------------------------------------------------

/** The sixteen shipped lower-first rows: `score|tick`. */
const LOWER_FIRST_ROWS: ReadonlyArray<readonly [string, number]> = [
  ['bach', 408],
  ['bach', 672],
  ['bach', 1032],
  ['bach', 1632],
  ['bach', 2040],
  ['bach', 2064],
  ['bach', 3216],
  ['bach', 4368],
  ['brahms', 1296],
  ['brahms', 3216],
  ['brahms', 4848],
  ['brahms', 5400],
  ['brahms', 5592],
  ['brahms', 8688],
  ['brahms', 9240],
  ['brahms', 9432],
];

const BACH_ADAPTIVE_OPTIONS = { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const };
const BRAHMS_ADAPTIVE_OPTIONS = { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' as const };

test('§D lower-first: all sixteen rows put the lower head on the column', () => {
  const layouts = {
    bach: layoutJankoScore(BACH, BACH_ADAPTIVE_OPTIONS, DEFAULT_JANKO_TOKENS),
    brahms: layoutJankoScore(BRAHMS, BRAHMS_ADAPTIVE_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS),
  };
  let seen = 0;
  for (const [scoreKey, tick] of LOWER_FIRST_ROWS) {
    const heads = layouts[scoreKey as 'bach' | 'brahms']
      .flatMap((l) => l.notes)
      .filter((p) => p.note.startTick === tick);
    const rows = new Map<string, typeof heads>();
    for (const h of heads) rows.set(h.y.toFixed(3), [...(rows.get(h.y.toFixed(3)) ?? []), h]);
    for (const row of rows.values()) {
      if (row.length < 2) continue;
      const hands = new Set(row.map((p) => p.rhythm.hand));
      if (hands.size < 2) continue;
      seen++;
      const sorted = [...row].sort(
        (a, b) => a.coord.octave * 12 + a.coord.pitchClass - (b.coord.octave * 12 + b.coord.pitchClass)
      );
      const lower = sorted[0];
      const higher = sorted[sorted.length - 1];
      assert.ok(
        lower.x < higher.x - 1e-9,
        `${scoreKey} t${tick}: the lower head (${lower.rhythm.hand} pc${lower.coord.pitchClass}) ` +
          `holds the left column (${lower.x.toFixed(2)} < ${higher.x.toFixed(2)})`
      );
      // The swap preserves the row's stem-x set: exactly the same two columns.
      assert.ok(
        Math.abs(Math.abs(higher.x - lower.x) - 5.46) < 0.01,
        `${scoreKey} t${tick}: the row still spans exactly one tight pair gap`
      );
    }
  }
  assert.equal(seen, 16, 'every ticketed row is audited');
});

test('§D stem tripwire: the retired R19 stem-through-simultaneity signatures are absent', () => {
  // The R19 defect (m. 46 at 0.00pt, m. 17 at 2.73pt) must not come back — the
  // tripwire FAILS if either signature reappears.
  for (const [label, score, options, tokens] of [
    ['Bach', BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS],
    ['Brahms', BRAHMS, BRAHMS_ADAPTIVE_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS],
  ] as const) {
    const report = lintJankoScore(score, options, tokens);
    assert.equal(
      report.diagnostics.filter((d) => d.code === 'stem-through-simultaneity').length,
      0,
      `${label}: no stem pierces a fellow chord tone`
    );
    if (label === 'Brahms') {
      // 4-up by operator override (was clean at 3-up): exactly the 2
      // accepted slot findings — the stem tripwire itself stays silent.
      assert.equal(report.ok, false, 'red by operator order, like the CLI entry');
      assert.deepEqual(
        report.violations.map((v) => [v.code, v.system + 1]),
        [
          ['system-slot-overlap', 23],
          ['system-slot-overlap', 24],
        ],
        'exactly the accepted 2 (itemized in the §2-landed record)'
      );
    } else {
      assert.equal(report.ok, true, `${label}: the lower-first golden is clean`);
    }
  }
});

test('§D unison survivor: the lower voice keeps the digit', () => {
  const final = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS).at(-1)!;
  const merge = final.unisonMerges.find((m) => m.tick === 4560)!;
  const survivor = final.notes.find((p) => p.note.id === merge.survivorId)!;
  assert.equal(
    survivor.rhythm.hand,
    'LH',
    'the lower voice (LH) survives the cross-hand unison'
  );
  const brahmsLayouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const brahmsMerges = brahmsLayouts.flatMap((l) => l.unisonMerges);
  assert.equal(brahmsMerges.length, 7, 'the Brahms unison census is unchanged');
  for (const system of brahmsLayouts) {
    for (const m of system.unisonMerges) {
      const survivorHead = system.notes.find((p) => p.note.id === m.survivorId)!;
      assert.equal(survivorHead.rhythm.hand, 'LH', `t${m.tick}: the lower voice keeps the digit`);
    }
  }
});

// ---------------------------------------------------------------------------
// §E — the complete working set
// ---------------------------------------------------------------------------

test('§E: the constructed specimens render every new part, clean', () => {
  const duration = lintJankoScore(
    DURATION_SPECIMEN,
    DURATION_SPECIMEN_JANKO_OPTIONS,
    DURATION_SPECIMEN_JANKO_TOKENS
  );
  assert.equal(duration.ok, true, 'the duration specimen engraves clean');
  assert.equal(duration.warnings.length, 0, 'and adds no warning');
  const rests = lintJankoScore(REST_SPECIMEN, SPECIMEN_OPTIONS, SPECIMEN_TOKENS);
  assert.equal(rests.ok, true, 'the rest specimen states the complete working set clean');
  assert.equal(rests.warnings.length, 0);
});

test('§E beam levels: the level is a function of the duration, and levels nest', () => {
  const layouts = layoutJankoScore(
    DURATION_SPECIMEN,
    DURATION_SPECIMEN_JANKO_OPTIONS,
    DURATION_SPECIMEN_JANKO_TOKENS
  );
  const beams = layouts.flatMap((l) => l.beams);
  const levelsOf = (ticks: number[]): number[] => {
    const beam = beams.find((b) => b.notes.map((n) => n.startTick).join(',') === ticks.join(','))!;
    assert.ok(beam, `the specimen states the beam [${ticks.join(',')}]`);
    return beam.levels.map((l) => l.level);
  };
  assert.deepEqual(levelsOf([0, 6, 12, 18, 24, 30, 36, 42]), [1, 2, 3], 'the 32nd run carries the tertiary');
  assert.deepEqual(
    levelsOf([192, 195, 198, 201, 204, 207, 210, 213, 216]),
    [1, 2, 3, 4],
    'the 64th run carries the quaternary'
  );
  assert.deepEqual(levelsOf([384, 408, 420]), [1, 2], 'mixed 8th + 16ths nests levels 1–2');
  assert.deepEqual(levelsOf([432, 438, 444, 450, 456]), [1, 2, 3], 'mixed 32nds nests levels 1–3');
  // Generality, not a forked path: the level-3 and level-4 strips obey the same
  // span rule as level 2 (maximal runs of notes at or above the level).
  for (const beam of beams) {
    for (const strip of beam.levels) {
      if (strip.level === 1 || strip.stub) continue;
      assert.ok(
        strip.connector.x1 <= strip.connector.x2 + 1e-9,
        'every full strip spans its run left to right (a partial beam points instead)'
      );
      const spanning = beam.stems.filter(
        (s) =>
          s.stemX >= strip.connector.x1 - 1e-9 &&
          s.stemX <= strip.connector.x2 + 1e-9 &&
          Math.abs(beam.beamY(s.stemX) + 0 - s.stemStartY) >= 0
      );
      assert.ok(spanning.length >= 2, `a level-${strip.level} run covers at least two stems`);
    }
  }
});

test('§E lone stubs: a partial beam points INTO the group it is beamed with (Gould)', () => {
  const layouts = layoutJankoScore(
    DURATION_SPECIMEN,
    DURATION_SPECIMEN_JANKO_OPTIONS,
    DURATION_SPECIMEN_JANKO_TOKENS
  );
  const beams = layouts.flatMap((l) => l.beams);
  const stubs = beams.flatMap((b) => b.levels.filter((l) => l.stub).map((l) => ({ beam: b, strip: l })));
  assert.equal(stubs.length, 2, 'the specimen states two lone-16th partial beams');
  for (const { beam, strip } of stubs) {
    const notes = beam.notes;
    // The lone 16th is the only level-2 note.
    const lone = notes.find((n) => n.durationTicks <= 14)!;
    const index = notes.indexOf(lone);
    const stem = beam.stems[index];
    const toward = index > 0 ? -1 : 1;
    const tip = strip.connector.x2 - strip.connector.x1;
    assert.ok(
      Math.sign(tip) === toward,
      `t${lone.startTick}: the stub points ${toward < 0 ? 'backward' : 'forward'} into the group`
    );
    assert.ok(Math.abs(tip) > 0, 'and it has real length');
    // Backward when the group precedes the lone note, forward only at its start.
    const expectedBackward = index > 0;
    assert.equal(
      tip < 0,
      expectedBackward,
      `t${lone.startTick}: backward rule (${expectedBackward ? 'preceded by the group' : 'opens the group'})`
    );
    assert.ok(Math.abs(strip.connector.x1 - stem.stemX) < 1e-9, 'the stub starts at its own stem');
  }
});

test('§E solo flags: a 32nd and a 64th alone in their beat carry three and four marks', () => {
  const layouts = layoutJankoScore(
    DURATION_SPECIMEN,
    DURATION_SPECIMEN_JANKO_OPTIONS,
    DURATION_SPECIMEN_JANKO_TOKENS
  );
  const ungrouped = layouts.flatMap((l) => l.ungrouped);
  const solo32 = ungrouped.find((n) => n.durationTicks === 6);
  const solo64 = ungrouped.find((n) => n.durationTicks === 3);
  assert.ok(solo32, 'the solo 32nd is ungrouped, so it is flagged');
  assert.ok(solo64, 'the solo 64th is ungrouped, so it is flagged');
  assert.equal(subdivisionMarkCount(solo32!.durationTicks), 3, 'triple flag');
  assert.equal(subdivisionMarkCount(solo64!.durationTicks), 4, 'quad flag');
});

test('§E completeness: the rest specimen states all seven silences in every dialect', () => {
  for (const style of ['kinetic-monoline', 'classical-urtext', 'geometric-node', 'bauhaus-slash', 'phantom-notehead'] as const) {
    const options = { ...REST_DURATION_SPECIMEN_JANKO_OPTIONS, measuresPerSystem: 3, restStyle: style };
    const report = lintJankoScore(REST_SPECIMEN, resolveJankoOptions(options), SPECIMEN_TOKENS);
    assert.equal(report.ok, true, `${style}: clean`);
    assert.equal(report.warnings.length, 0, `${style}: no warning`);
    const rests = layoutJankoScore(REST_SPECIMEN, options, SPECIMEN_TOKENS).flatMap((l) => l.rests);
    assert.deepEqual(
      rests.map((r) => r.value),
      ['sixteenth', 'eighth', 'quarter', 'half', 'whole', 'thirty-second', 'sixty-fourth'],
      `${style}: the complete working set`
    );
  }
});

test('§E flag geometry: the measured taper is confirmed, so the R20 flag stands', () => {
  // §B "adjust IFF off": the measured root ÷ drop is 0.159 (Bravura flag8thUp,
  // 130u root over 819u drop) against the cut's 0.136 — within 15%, so the flag
  // is *verified*, not churned. The check pins the tolerance that decision rests
  // on, so a future re-cut has to restate it.
  const root = 130;
  const drop = 819;
  // The cut's root is the house stroke at the stem tip (the classical cut's
  // root weight), and its length is the flag drop.
  const cutRoot = 0.9;
  const cutDrop = DEFAULT_JANKO_TOKENS.flagHeight;
  const measuredTaper = root / drop;
  const cutTaper = cutRoot / cutDrop;
  assert.ok(
    Math.abs(cutTaper - measuredTaper) / measuredTaper < 0.15,
    `the R20 taper is within 15% of the measured one (${cutTaper.toFixed(3)} vs ${measuredTaper.toFixed(3)})`
  );
});

// ---------------------------------------------------------------------------
// §F — the registry
// ---------------------------------------------------------------------------

test('§F registry: round 32 settled-packing grid round, two cards, one open axis', () => {
  // Ordered contract change: Round 32 compares the interior beat grid on
  // Brahms — two cards on the single gridPulseFilter axis with the Reference
  // as control. Rounds 30–31 are parked (historical consts).
  assert.equal(CURRENT_ROUND_METADATA.round, 32);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['gridPulseFilter'], 'one open axis');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, ['4-per-system-full-grid', '4-per-system-midpoint-grid'], 'the grid cards');
});

// ---------------------------------------------------------------------------
// No-move guards
// ---------------------------------------------------------------------------

test('No-move guard: Bach’s note ink is byte-identical except the sixteen prescribed swaps', () => {
  // The round prescribes: rest ink, slab seats, the 16 row swaps, and the
  // (unchanged) flags/dots. Every notehead and column outside those rows must be
  // exactly where it was — proven structurally by the row census.
  const layouts = layoutJankoScore(BACH, BACH_ADAPTIVE_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(layouts.flatMap((l) => l.notes).length, 550, 'one merged head, as in Round 20');
  const swapped = new Set(LOWER_FIRST_ROWS.filter(([s]) => s === 'bach').map(([, t]) => t));
  // Every mixed-hand same-row onset is one of the sixteen, and every one of
  // them is in the census: no other row moved.
  const mixedRows = new Set<number>();
  for (const l of layouts) {
    const byTick = new Map<number, typeof l.notes>();
    for (const p of l.notes) byTick.set(p.note.startTick, [...(byTick.get(p.note.startTick) ?? []), p]);
    for (const [tick, heads] of byTick) {
      const rows = new Map<string, typeof heads>();
      for (const h of heads) rows.set(h.y.toFixed(3), [...(rows.get(h.y.toFixed(3)) ?? []), h]);
      for (const row of rows.values()) {
        if (row.length > 1 && new Set(row.map((p) => p.rhythm.hand)).size > 1) mixedRows.add(tick);
      }
    }
  }
  assert.deepEqual([...mixedRows].sort((a, b) => a - b), [...swapped].sort((a, b) => a - b));
});
