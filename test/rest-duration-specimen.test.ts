/**
 * Rest Duration Specimen — Round 15 fixture tests: the declared values, the
 * four written silences (`computeJankoRestLayer` through `layoutJankoScore`),
 * the free-column guarantee that keeps every other-hand head off a rest column,
 * and the clean linter report that lets the rest dialects be compared.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REST_DURATION_SPECIMEN_MEASURES,
  REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
  REST_DURATION_SPECIMEN_TOTAL_TICKS,
  REST_DURATION_SPECIMEN_VALUES,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_REST_STYLES,
} from '../src/render/janko/types';
import { layoutJankoScore } from '../src/render/janko/engine';
import { formatLintReport, lintJankoScore } from '../src/render/janko/linter';
import { restValueForTicks } from '../src/render/janko/elements/rests';

const SCORE = buildRestDurationSpecimenScore();
/** One notehead disc diameter (9.6pt with the canonical white-knockout mask). */
const R = DEFAULT_JANKO_TOKENS.noteheadRadius;

/** Every written rest, positioned head and refused silence of a whole layout. */
function laidOut(measuresPerSystem: number) {
  const layouts = layoutJankoScore(
    SCORE,
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem },
    DEFAULT_JANKO_TOKENS
  );
  return {
    rests: layouts.flatMap((system) => system.rests),
    notes: layouts.flatMap((system) => system.notes),
    unwritten: layouts.flatMap((system) => system.unwrittenRests),
  };
}

test('The specimen declares the four standard values in order, one per measure', () => {
  assert.equal(REST_DURATION_SPECIMEN_MEASURES, 4);
  assert.equal(REST_DURATION_SPECIMEN_TICKS_PER_MEASURE, 144);
  assert.equal(REST_DURATION_SPECIMEN_TOTAL_TICKS, 576);
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((value) => value.durationTicks),
    [12, 24, 48, 96],
    'exactly the four standard rest values, shortest first'
  );
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((value) => value.measure),
    [1, 2, 3, 4],
    'each value owns its own measure'
  );
  for (const spec of REST_DURATION_SPECIMEN_VALUES) {
    assert.equal(restValueForTicks(spec.durationTicks), spec.value, spec.label);
    const measureStart = (spec.measure - 1) * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE;
    assert.ok(
      spec.restTick >= measureStart && spec.restTick < measureStart + REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
      `${spec.label} opens inside its own measure`
    );
  }
  assert.equal(SCORE.id, 'rest-duration-specimen');
  assert.equal(SCORE.title, 'Rest Duration Specimen');
  assert.equal(SCORE.composer, 'Jánko Engraving Harness');
  assert.equal(SCORE.ticksPerBeat, 48);
  assert.equal(SCORE.gridResolution, 24);
  assert.equal(SCORE.totalTicks, REST_DURATION_SPECIMEN_TOTAL_TICKS);
  assert.deepEqual(SCORE.timeSignatures, [{ tick: 0, numerator: 3, denominator: 4 }]);
  assert.deepEqual(
    SCORE.barlines.map((barline) => [barline.barNumber, barline.tick, barline.type]),
    [
      [1, 0, 'regular'],
      [2, 144, 'regular'],
      [3, 288, 'regular'],
      [4, 432, 'regular'],
      [5, 576, 'final'],
    ]
  );
});

for (const measuresPerSystem of [2, 4]) {
  test(`Every declared value writes one RH rest in a free column at ${measuresPerSystem} per system`, () => {
    const { rests, notes, unwritten } = laidOut(measuresPerSystem);
    assert.equal(rests.length, 4, 'exactly four silences are written');
    assert.ok(rests.every((rest) => rest.hand === 'RH'), 'all four silences belong to the right hand');
    assert.deepEqual(rests.map((rest) => rest.durationTicks), [12, 24, 48, 96]);
    assert.equal(unwritten.length, 0, 'no silence is refused');

    for (const spec of REST_DURATION_SPECIMEN_VALUES) {
      const written = rests.filter(
        (rest) => rest.tick === spec.restTick && rest.value === spec.value && rest.hand === 'RH'
      );
      assert.equal(written.length, 1, `exactly one RH ${spec.label} rest at tick ${spec.restTick}`);
      const rest = written[0];
      assert.equal(rest.durationTicks, spec.durationTicks);
      assert.ok(
        !unwritten.some((silence) => silence.tick === spec.restTick && silence.hand === 'RH'),
        `the ${spec.label} rest is written, never a named refusal`
      );

      // The free-column guarantee: the nearest LH onset is a full 24 ticks
      // away, so no other-hand head may enter the rest's disc band — audited
      // both as the strict |dx| rule and as the true disc distance hypot(dx,dy).
      const lh = notes.filter((p) => p.rhythm.hand === 'LH');
      const banded = lh.filter((p) => Math.abs(p.x - rest.x) < 2 * R);
      assert.ok(
        banded.every((p) => Math.hypot(p.x - rest.x, p.y - rest.y) >= 2 * R),
        `no LH head enters the ${spec.label} rest's disc band`
      );
      const inMeasure = lh.filter(
        (p) =>
          p.note.startTick >= (spec.measure - 1) * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE &&
          p.note.startTick < spec.measure * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE
      );
      assert.ok(inMeasure.length > 0, `the LH is active in the ${spec.label} measure`);
      const nearestDx = Math.min(...inMeasure.map((p) => Math.abs(p.x - rest.x)));
      assert.ok(nearestDx >= 2 * R, `nearest LH head is ${nearestDx.toFixed(2)}pt from the rest column`);
    }
  });
}

test('The specimen engraves clean under the golden 3/4 layout and the 3- and 2-per-system crops', () => {
  for (const options of [
    DEFAULT_JANKO_OPTIONS,
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 3 },
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 },
  ]) {
    const report = lintJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    assert.equal(report.violations.length, 0, formatLintReport(report));
    assert.equal(report.warnings.length, 0, formatLintReport(report));
    assert.equal(report.ok, true, formatLintReport(report));
  }
});

test('Every rest dialect states the same four silences on the clean specimen', () => {
  for (const restStyle of JANKO_REST_STYLES) {
    const options = { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2, restStyle };
    const report = lintJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    assert.equal(report.ok, true, `${restStyle}: ${formatLintReport(report)}`);
    assert.equal(report.warnings.length, 0, `${restStyle}: ${formatLintReport(report)}`);
    const rests = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).flatMap((s) => s.rests);
    assert.deepEqual(rests.map((rest) => rest.durationTicks), [12, 24, 48, 96], restStyle);
  }
});
