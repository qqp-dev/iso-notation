/**
 * Rest Duration Specimen — Round 15 fixture tests, extended by Round 20 with the
 * whole-bar context: the declared values, the written silences
 * (`computeJankoRestLayer` through `layoutJankoScore`), the free-column
 * guarantee that keeps every other-hand head off a rest column, the optical
 * seats, and the clean linter report that lets the rest cuts be compared.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  REST_DURATION_SPECIMEN_MEASURES,
  REST_DURATION_SPECIMEN_TICKS_PER_MEASURE,
  REST_DURATION_SPECIMEN_TOTAL_TICKS,
  REST_DURATION_SPECIMEN_VALUES,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  JANKO_REST_STYLES,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { getEquatorYForOctave } from '../src/render/janko/geometry';
import { getEquatorRuleYs } from '../src/render/janko/elements/staff';
import { layoutJankoScore, wholeToneRowOffsets } from '../src/render/janko/engine';
import { formatLintReport, lintJankoScore } from '../src/render/janko/linter';
import {
  JankoRestGeometry,
  restInkBox,
  restSeatOffsetY,
  restValueForTicks,
} from '../src/render/janko/elements/rests';

const SCORE = buildRestDurationSpecimenScore();
const TOKENS = resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS);
/** One notehead disc diameter (9.6pt with the canonical white-knockout mask). */
const R = TOKENS.noteheadRadius;

/** Every written rest, positioned head and refused silence of a whole layout. */
function laidOut(measuresPerSystem: number) {
  const layouts = layoutJankoScore(
    SCORE,
    { ...REST_DURATION_SPECIMEN_JANKO_OPTIONS, measuresPerSystem },
    REST_DURATION_SPECIMEN_JANKO_TOKENS
  );
  return {
    layouts,
    rests: layouts.flatMap((system) => system.rests),
    notes: layouts.flatMap((system) => system.notes),
    unwritten: layouts.flatMap((system) => system.unwrittenRests),
  };
}

test('The specimen declares the complete working set in order, one per measure', () => {
  assert.equal(
    REST_DURATION_SPECIMEN_MEASURES,
    8,
    'five values + the whole bar’s resume measure + the two Round 21 §E windows'
  );
  assert.equal(REST_DURATION_SPECIMEN_TICKS_PER_MEASURE, 192, '4/4 — the meter that can state a whole bar');
  assert.equal(REST_DURATION_SPECIMEN_TOTAL_TICKS, 1536, 'eight measures of 4/4');
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((value) => value.durationTicks),
    [12, 24, 48, 96, 192, 6, 3],
    'the five original standard values, then the two §E constructions'
  );
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((value) => value.measure),
    [1, 2, 3, 4, 5, 7, 8],
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
  const whole = REST_DURATION_SPECIMEN_VALUES.find((value) => value.value === 'whole')!;
  assert.equal(whole.restTick, 4 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE, 'the whole bar opens on its downbeat');
  assert.equal(SCORE.id, 'rest-duration-specimen');
  assert.equal(SCORE.title, 'Rest Duration Specimen');
  assert.equal(SCORE.composer, 'Jánko Engraving Harness');
  assert.equal(SCORE.ticksPerBeat, 48);
  assert.equal(SCORE.gridResolution, 3, 'the specimen now states 64th silences (3 ticks)');
  assert.equal(SCORE.totalTicks, REST_DURATION_SPECIMEN_TOTAL_TICKS);
  assert.deepEqual(SCORE.timeSignatures, [{ tick: 0, numerator: 4, denominator: 4 }]);
  assert.deepEqual(
    SCORE.barlines.map((barline) => [barline.barNumber, barline.tick, barline.type]),
    [
      [1, 0, 'regular'],
      [2, 192, 'regular'],
      [3, 384, 'regular'],
      [4, 576, 'regular'],
      [5, 768, 'regular'],
      [6, 960, 'regular'],
      [7, 1152, 'regular'],
      [8, 1344, 'regular'],
      [9, 1536, 'final'],
    ]
  );
});

for (const measuresPerSystem of [3]) {
  test(`Every declared value writes one RH rest in a free column at ${measuresPerSystem} per system`, () => {
    const { rests, notes, unwritten } = laidOut(measuresPerSystem);
    assert.equal(rests.length, 7, 'exactly seven silences are written — the whole working set');
    assert.ok(rests.every((rest) => rest.hand === 'RH'), 'all seven silences belong to the right hand');
    assert.deepEqual(
      rests.map((rest) => rest.durationTicks),
      [12, 24, 48, 96, 192, 6, 3]
    );
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

      // The seat (Round 21 §C): a hanging glyph's ink centroid stands on its
      // phrase row; a bar form's **contact edge** stands on a drawn staff rule —
      // the half slab's bottom edge on the line, the whole slab's top edge on
      // it. Every value's seat offset is zero now, because a bar seat is a line
      // and not a row.
      assert.equal(restSeatOffsetY(rest.value, rest.style, TOKENS), 0, `${spec.label} seat offset`);
      const sys = laidOut(measuresPerSystem).layouts.find((s) =>
        s.rests.some((x) => x.tick === rest.tick)
      )!;
      const rules = (
        [
          ['RH', 5],
          ['LH', 2],
          ['RH', 4],
          ['LH', 3],
        ] as const
      ).flatMap(([hand, octave]) =>
        getEquatorRuleYs(sys.geometry.equatorY(hand, octave), resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS), TOKENS)
      );
      const box = restInkBox(rest, TOKENS);
      if (rest.value === 'half' || rest.value === 'whole') {
        assert.ok(
          rules.some((rule) => Math.abs(rule - rest.y) < 1e-9),
          `${spec.label}: the slab touches a drawn staff rule`
        );
        assert.ok(
          Math.abs((rest.value === 'half' ? box.y1 : box.y0) - rest.y) < 0.02,
          `${spec.label}: the contact edge is on the line`
        );
      } else {
        const rows: number[] = [];
        for (let octave = 0; octave <= 8; octave++) {
          const base = sys.geometry.middleCY + getEquatorYForOctave(octave, 'RH', TOKENS, resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS));
          for (const offset of wholeToneRowOffsets(resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS), TOKENS)) {
            rows.push(base + offset);
          }
        }
        assert.ok(
          rows.some((row) => Math.abs(row - rest.y) < 1e-9),
          `${spec.label}: the ink centroid stands on a phrase row`
        );
      }

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
      if (rest.value === 'whole') {
        // The whole bar is **centred in its measure** (Gould; LilyPond NR
        // §§2.2.1/2.2.3), and that centre column is the LH C3 onset column
        // (tick 864 → x = 303.54). The two inks clear each other **vertically**
        // — by row separation — and the slab is never shifted to dodge: the
        // linter confirms the clearance instead.
        assert.ok(
          inMeasure.some((p) => Math.abs(p.x - rest.x) < 1e-6),
          'the centred whole shares the LH C3 onset column'
        );
        assert.ok(
          inMeasure.every((p) => Math.abs(p.y - rest.y) > box.y1 - box.y0),
          'and clears it vertically by row separation'
        );
        continue;
      }
      const nearestDx = Math.min(...inMeasure.map((p) => Math.abs(p.x - rest.x)));
      assert.ok(nearestDx >= 2 * R, `nearest LH head is ${nearestDx.toFixed(2)}pt from the rest column`);
    }
  });
}

test('The whole-bar context states exactly one whole bar, hanging below its row', () => {
  const { rests } = laidOut(3);
  const whole = rests.filter((rest) => rest.value === 'whole');
  assert.equal(whole.length, 1, 'the specimen writes exactly one whole bar');
  const rest: JankoRestGeometry = whole[0];
  assert.equal(rest.tick, 4 * REST_DURATION_SPECIMEN_TICKS_PER_MEASURE);
  assert.equal(rest.durationTicks, 192);
  const box = restInkBox(rest, TOKENS);
  const row = rest.y - restSeatOffsetY(rest.value, rest.style, TOKENS);
  assert.ok(box.y0 >= row - 1e-9, 'the whole slab hangs below its seat row');
  assert.ok(box.y1 > row, 'the whole slab carries real ink below the row');
});

test('The specimen engraves clean under the golden layout and the 3- and 5-per-system crops', () => {
  for (const options of [
    REST_DURATION_SPECIMEN_JANKO_OPTIONS,
    { ...REST_DURATION_SPECIMEN_JANKO_OPTIONS, measuresPerSystem: 3 },
    { ...REST_DURATION_SPECIMEN_JANKO_OPTIONS, measuresPerSystem: 5 },
  ]) {
    const report = lintJankoScore(SCORE, options, REST_DURATION_SPECIMEN_JANKO_TOKENS);
    assert.equal(report.violations.length, 0, formatLintReport(report));
    assert.equal(report.warnings.length, 0, formatLintReport(report));
    assert.equal(report.ok, true, formatLintReport(report));
  }
});

test('Every rest dialect states the same seven silences on the clean specimen', () => {
  for (const restStyle of JANKO_REST_STYLES) {
    const options = { ...REST_DURATION_SPECIMEN_JANKO_OPTIONS, measuresPerSystem: 3, restStyle };
    const report = lintJankoScore(SCORE, options, REST_DURATION_SPECIMEN_JANKO_TOKENS);
    assert.equal(report.ok, true, `${restStyle}: ${formatLintReport(report)}`);
    assert.equal(report.warnings.length, 0, `${restStyle}: ${formatLintReport(report)}`);
    const rests = layoutJankoScore(SCORE, options, REST_DURATION_SPECIMEN_JANKO_TOKENS).flatMap(
      (s) => s.rests
    );
    assert.deepEqual(
      rests.map((rest) => rest.durationTicks),
      [12, 24, 48, 96, 192, 6, 3],
      restStyle
    );
  }
});
