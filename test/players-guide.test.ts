/**
 * Player's Guide — model pins and example audits.
 *
 * The Guide tab derives its digit/syllable strings live from the encoded
 * scores, but the *sentences around them* are prose: these tests pin every
 * displayed string and every caption claim against the models and the
 * engine, so a future engraving change that invalidates the guide fails
 * `npm test`. Every specimen the guide renders must also engrave clean —
 * a teaching example with a linter finding would be embarrassing.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BENCHMARK_SCORES } from '../src/scores';
import { DUODECIMAL_SOLFEGE } from '../src/model/phonetics';
import { DUODECIMAL_DIGITS } from '../src/render/types';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  FIXED_3_ROW_DEFS,
  PITCH_GRID_C4_STROKE,
  PITCH_GRID_OCTAVE_STROKE,
} from '../src/render/janko/elements/staff';
import { REST_MARK_COUNT } from '../src/render/janko/elements/rests';
import {
  JankoRhythmNote,
  claspDurationClass,
  claspQualifies,
  renderFlags,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import {
  countJankoPages,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  GUIDE_REST_JANKO_OPTIONS,
  GUIDE_REST_JANKO_TOKENS,
  GUIDE_REST_TICKS_PER_MEASURE,
  GUIDE_TICKS_PER_MEASURE,
  buildGuideHandsSpecimen,
  buildGuidePitchSpecimen,
  buildGuideRestSpecimen,
  buildGuideRhythmSpecimen,
  handThread,
  threadDigitString,
  threadSyllableString,
} from '../src/ui/guide-specimens';

const O = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const REST_O = resolveJankoOptions(GUIDE_REST_JANKO_OPTIONS);
const REST_T = resolveJankoTokens(GUIDE_REST_JANKO_TOKENS);
const bach = () => BENCHMARK_SCORES['bach-goldberg-var1']();

// ---------------------------------------------------------------------------
// Pinned display strings: Bach m.1 (the first-bar walkthrough)
// ---------------------------------------------------------------------------

test('Guide pin: Bach m.1 right-hand digits and syllables', () => {
  const rh = handThread(bach(), 0, 'RH', GUIDE_TICKS_PER_MEASURE);
  assert.equal(threadDigitString(rh), '7 6 7 2 4 6 7 9 B 1');
  assert.equal(threadSyllableString(rh), 'se si se tu fo si se na bi wa');
});

test('Guide pin: Bach m.1 left-hand digits and syllables', () => {
  const lh = handThread(bach(), 0, 'LH', GUIDE_TICKS_PER_MEASURE);
  assert.equal(threadDigitString(lh), '7 B 9 B 7 7 7');
  assert.equal(threadSyllableString(lh), 'se bi na bi se se se');
});

test('Guide pin: Bach m.1 opening thread, note by note', () => {
  const fmt = (hand: 'RH' | 'LH') =>
    handThread(bach(), 0, hand, GUIDE_TICKS_PER_MEASURE).map(
      (n) =>
        `${n.startTick}/${n.durationTicks}/${n.digit}/${n.syllable}` as const
    );
  assert.deepEqual(fmt('RH'), [
    '0/12/7/se',
    '12/12/6/si',
    '24/36/7/se',
    '60/12/2/tu',
    '72/12/4/fo',
    '84/12/6/si',
    '96/12/7/se',
    '108/12/9/na',
    '120/12/B/bi',
    '132/12/1/wa',
  ]);
  assert.deepEqual(fmt('LH'), [
    '0/24/7/se',
    '24/12/B/bi',
    '36/12/9/na',
    '48/24/B/bi',
    '72/24/7/se',
    '96/24/7/se',
    '120/24/7/se',
  ]);
});

test('Guide pin: Bach m.1 both hands open on digit 7, two octaves apart', () => {
  const rh = handThread(bach(), 0, 'RH', GUIDE_TICKS_PER_MEASURE)[0];
  const lh = handThread(bach(), 0, 'LH', GUIDE_TICKS_PER_MEASURE)[0];
  assert.equal(rh.pitchClass, 7);
  assert.equal(rh.octave, 4);
  assert.equal(lh.pitchClass, 7);
  assert.equal(lh.octave, 2);
  assert.equal(rh.octave - lh.octave, 2);
});

test('Guide pin: Bach opening audition thread (m.1 + three notes)', () => {
  const score = bach();
  const thread = [
    ...handThread(score, 0, 'RH', GUIDE_TICKS_PER_MEASURE),
    ...handThread(score, 1, 'RH', GUIDE_TICKS_PER_MEASURE).slice(0, 3),
  ];
  assert.equal(thread.length, 13);
  assert.equal(threadDigitString(thread), '7 6 7 2 4 6 7 9 B 1 2 1 2');
  assert.equal(
    threadSyllableString(thread),
    'se si se tu fo si se na bi wa tu wa tu'
  );
});

test('Guide pin: handThread agrees with the digit and phonetic models', () => {
  const score = bach();
  for (const hand of ['RH', 'LH'] as const) {
    for (const n of handThread(score, 0, hand, GUIDE_TICKS_PER_MEASURE)) {
      assert.equal(n.digit, DUODECIMAL_DIGITS[n.pitchClass]);
      assert.equal(
        n.syllable,
        DUODECIMAL_SOLFEGE[n.pitchClass].syllable
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Pinned display strings: specimens, staff grammar, navigation
// ---------------------------------------------------------------------------

test('Guide pin: pitch specimen climbs the chromatic digits', () => {
  const rh = handThread(buildGuidePitchSpecimen(), 0, 'RH');
  assert.equal(threadDigitString(rh), '0 1 2 3 4 5 6 7 8 9 A B');
  assert.equal(
    threadSyllableString(rh),
    'o wa tu ti fo fa si se e na a bi'
  );
});

test('Guide pin: pitch specimen left hand marks C3 on each beat', () => {
  const lh = handThread(buildGuidePitchSpecimen(), 0, 'LH');
  assert.deepEqual(
    lh.map((n) => `${n.startTick}/${n.durationTicks}/${n.pitchClass}/${n.octave}`),
    ['0/48/0/3', '48/48/0/3', '96/48/0/3']
  );
});

test('Guide pin: fixed-3 core lines are C3/C4/C5 with the C4 anchor', () => {
  const core = FIXED_3_ROW_DEFS.filter((d) => d.fires([]))
    .map((d) => d.lin)
    .sort((a, b) => a - b);
  assert.deepEqual(core, [36, 48, 60]);
  const anchor = FIXED_3_ROW_DEFS.find((d) => d.isAnchor);
  assert.equal(anchor?.lin, 48);
  // Core equalization (PR #48): all three render in the same ink at the same
  // weight, so middle C is positional (the middle line), never "the dark one".
  assert.equal(PITCH_GRID_C4_STROKE, PITCH_GRID_OCTAVE_STROKE);
});

test('Guide pin: flag hooks and rest lobes count 1–4 from 8th to 64th', () => {
  assert.deepEqual(
    [24, 12, 6, 3].map(subdivisionMarkCount),
    [1, 2, 3, 4]
  );
  assert.deepEqual(
    (
      ['eighth', 'sixteenth', 'thirty-second', 'sixty-fourth'] as const
    ).map((value) => REST_MARK_COUNT[value]),
    [1, 2, 3, 4]
  );
});

test('Guide pin: navigation numbers and title block', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.measuresPerSystem, 4);
  assert.equal(DEFAULT_JANKO_OPTIONS.systemsPerPage, 4);
  assert.equal(DEFAULT_JANKO_OPTIONS.title, 'Goldberg-Variationen');
  assert.equal(DEFAULT_JANKO_OPTIONS.subtitle, 'Variatio 1. a 1 Clav.');
  assert.equal(DEFAULT_JANKO_OPTIONS.composer, 'Johann Sebastian Bach');
});

test('Guide pin: Bach numerals open each system, page by page', () => {
  const score = bach();
  assert.equal(countJankoPages(score, O, T), 2);
  const numerals = (page: number) =>
    [
      ...renderJankoPage(score, page, O, T).matchAll(
        /<text class="janko-measure-num"[^>]*>(\d+)<\/text>/g
      ),
    ].map((m) => m[1]);
  assert.deepEqual(numerals(0), ['1', '5', '9', '13']);
  assert.deepEqual(numerals(1), ['17', '21', '25', '29']);
});

// ---------------------------------------------------------------------------
// Teaching examples engrave clean
// ---------------------------------------------------------------------------

test('Guide examples: every specimen is lint-clean, zero warnings', () => {
  const cases = [
    {
      name: 'pitch',
      score: buildGuidePitchSpecimen(),
      o: O,
      t: T,
    },
    {
      name: 'rhythm',
      score: buildGuideRhythmSpecimen(),
      o: O,
      t: T,
    },
    {
      name: 'hands',
      score: buildGuideHandsSpecimen(),
      o: O,
      t: T,
    },
    {
      name: 'rests',
      score: buildGuideRestSpecimen(),
      o: REST_O,
      t: REST_T,
    },
    { name: 'bach', score: bach(), o: O, t: T },
  ] as const;
  for (const { name, score, o, t } of cases) {
    const report = lintJankoScore(score, o, t);
    assert.equal(
      report.violations.length,
      0,
      `${name}: expected zero violations, got ${JSON.stringify(report.violations).slice(0, 300)}`
    );
    assert.equal(
      report.warnings.length,
      0,
      `${name}: expected zero warnings, got ${JSON.stringify(report.warnings).slice(0, 300)}`
    );
  }
});

// ---------------------------------------------------------------------------
// Caption truth: each figure shows what its caption claims
// ---------------------------------------------------------------------------

test('Guide figure: hands specimen brackets once and merges once', () => {
  const score = buildGuideHandsSpecimen();
  const layout = layoutJankoScore(score, O, T)[0];
  assert.equal(layout.clasps.length, 1);
  assert.equal(layout.unisonMerges.length, 1);
  assert.equal(layout.unisonMerges[0].tick, 96);
  assert.equal(layout.unisonMerges[0].exact, true);
  // The merged unison is G4 (pc 7, octave 4), as the caption claims.
  assert.equal(layout.unisonMerges[0].pitchClass, 7);
  assert.equal(layout.unisonMerges[0].octave, 4);
  const svg = renderJankoCrop(score, 1, 1, O, T, 'hands');
  assert.ok(svg.includes('janko-clasp'), 'bracket ink present');
});

test('Guide figure: rhythm specimen beams, flags and dots as captioned', () => {
  const score = buildGuideRhythmSpecimen();
  const layout = layoutJankoScore(score, O, T)[0];
  assert.deepEqual(
    layout.beams.map((g) => g.notes.length),
    [4]
  );
  const dotted = layout.notes.filter(
    (p) => p.note.durationTicks > 26 && p.note.durationTicks <= 38
  );
  assert.equal(dotted.length, 1);
  const svg = renderJankoCrop(score, 1, 1, O, T, 'rhythm');
  assert.equal(
    (svg.match(/janko-augmentation-dot/g) ?? []).length,
    1,
    'exactly one augmentation dot'
  );
});

test('Guide figure: a lone long reads exactly like a quarter', () => {
  // renderFlags: flags iff d ≤ 38, dot iff 26 < d ≤ 38 — every d ≥ 39 is one
  // bare stem, and renderNotehead takes no duration at all. Dotted quarters,
  // halves, wholes and the odd Brahms holds all engrave byte-identically.
  const ink = (durationTicks: number) =>
    renderFlags(
      {
        id: 'pin',
        x: 100,
        y: 200,
        startTick: 1000,
        durationTicks,
        hand: 'RH',
      },
      T
    );
  const quarter = ink(48);
  assert.ok(quarter.includes('janko-stem'), 'the quarter is a bare stem');
  assert.ok(!quarter.includes('janko-flag'), 'no flag on the quarter');
  assert.ok(!quarter.includes('janko-augmentation-dot'), 'no dot on the quarter');
  for (const d of [72, 96, 126, 144, 150, 192]) {
    assert.equal(ink(d), quarter, `d=${d} renders byte-identically to a quarter`);
  }
  // No bracket rescues a single note: clasps need ≥ 2 heads, and only a
  // bracketed chord spells a long value (open ring = half/whole classes).
  const solo = [
    { x: 0, startTick: 0, durationTicks: 96, hand: 'RH' },
  ] as unknown as readonly JankoRhythmNote[];
  assert.equal(claspQualifies(solo), false);
  assert.equal(claspDurationClass(96), 'pip');
  assert.equal(claspDurationClass(192), 'double-pip');
});

test('Guide figure: rest specimen states one silence per value', () => {
  const score = buildGuideRestSpecimen();
  const layouts = layoutJankoScore(score, REST_O, REST_T);
  assert.deepEqual(
    layouts[0].rests.map((r) => `${r.value}@${r.tick}`),
    ['quarter@48', 'half@192', 'whole@384', 'eighth@648']
  );
  assert.deepEqual(
    layouts[1].rests.map((r) => `${r.value}@${r.tick}`),
    ['sixteenth@780']
  );
  assert.deepEqual(layouts[0].unwrittenRests, []);
  assert.deepEqual(layouts[1].unwrittenRests, []);
});

test('Guide figure: Bach m.1 beams and the lone dotted 8th', () => {
  const layout = layoutJankoScore(bach(), O, T)[0];
  const groups = layout.beams
    .map((g) =>
      g.notes.filter((n) => n.startTick < GUIDE_TICKS_PER_MEASURE)
    )
    .filter((notes) => notes.length > 0)
    .map((notes) => notes.map((n) => n.startTick).join(','))
    .sort();
  assert.deepEqual(groups, [
    '0,12',
    '0,24,36',
    '48,72',
    '60,72,84',
    '96,108,120,132',
    '96,120',
  ]);
  const ungrouped = layout.ungrouped.filter(
    (n) => n.startTick < GUIDE_TICKS_PER_MEASURE
  );
  assert.equal(ungrouped.length, 1);
  assert.equal(ungrouped[0].durationTicks, 36);
});

test('Guide figure: Bach m.1 crop carries the numeral and the dot', () => {
  const svg = renderJankoCrop(bach(), 1, 1, O, T, 'first bar');
  assert.ok(
    /<text class="janko-measure-num"[^>]*>1<\/text>/.test(svg),
    'opening numeral present'
  );
  assert.ok(
    svg.includes('janko-augmentation-dot'),
    'dotted-8th dot present'
  );
});
