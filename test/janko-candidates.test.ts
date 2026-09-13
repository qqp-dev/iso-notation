/**
 * Round 17B — Rest Behavior (weight, phrase rows, bridging) + Rest-Shape
 * Verdict: the fixed rest behavior, the m4 bridge, and the round 18 registry.
 *
 * The gap verdict is in: `tight` is the golden master (`snug` remains
 * implemented). Rest behavior goes direct: 0.90pt rest strokes (the note stem
 * weight), phrase-row placement (the rest hangs from the nearest whole-tone
 * row of its phrase octave toward Middle C, with an adjacent-row fallback),
 * and standard beam bridging across a single printed 16th rest strictly
 * inside one beat — so the m4 beat-3 run beams as one gesture [528, 540, 564]
 * over its printed rest. The Round 13 m4 beam break is retired with cause;
 * every rest SVG group stays identical under both spacing presets.
 *
 * Single judged axis — the rest shape (round 18):
 *
 * | # | id                      | `restStyle`          | window set             |
 * | - | ----------------------- | -------------------- | ---------------------- |
 * | A | `rest-kinetic-monoline` | `kinetic-monoline`   | the verdict windows    |
 * | B | `rest-classical-urtext` | `classical-urtext`   | the verdict windows    |
 * | C | `rest-geometric-node`   | `geometric-node`     | the verdict windows    |
 * | D | `rest-phantom-notehead` | `phantom-notehead`   | the verdict windows    |
 *
 * Committed fixtures for every directive the round fixes:
 *  1. the round 18 registry: four carried dialects, one rest-shape axis,
 *     per-candidate purity, the byte-identical R15 clean windows plus the
 *     Bach m4 fixed-context window on every card;
 *  2. rest weight: every rest stroke at its Round 15 pre-scale width
 *     (REST_STROKE = 0.90pt, the note stem stroke) with scaled extents, and
 *     size maxima recomputed per value × 4 dialects;
 *  3. phrase rows: the showcase set (Bach m4 + m6 + m7, chord-m2, the rest
 *     specimen, Brahms m68) hangs a glyph edge exactly on a phrase row,
 *     clear, with no diagnostics — all 4 dialects;
 *  4. bridging: m4 beams [528, 540, 564] with the 16th rest printed beneath
 *     a clearing beam; 8th rests and cross-beat gaps still break runs; bar 5
 *     beat 2 re-verified (locked);
 *  5. the 17A solver, dot and knockout fixtures stay verbatim (preset-explicit;
 *     heads never move in this ticket), rest-ink identity across both gaps,
 *     zero split-stack-stems golden-wide, and the four-systems-per-page golden.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Hand, QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { buildChordDurationSpecimenScore } from '../src/scores/chord-duration-specimen';
import {
  REST_DURATION_SPECIMEN_VALUES,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DEFAULT_STUDIO_SCORE_ID,
  REST_SPECIMEN_STUDIO_SCORE_ID,
  SPECIMEN_STUDIO_SCORE_ID,
  candidateBadges,
  getCandidate,
  resolveCandidate,
} from '../src/render/janko/candidates';
import { createStudioConfig, renderCandidatesView } from '../src/render/janko/studio';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CLUSTER_SPACINGS,
  JANKO_DIGIT_HALF_HEIGHT,
  JANKO_DIGIT_HALF_WIDTH,
  JankoClusterSpacing,
  JankoRestStyle,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computePageGeometry,
  countJankoPages,
  layoutJankoScore,
  renderJankoCrop,
  renderSystem,
  restClearsLayout,
  suppressedStemIds,
  wholeToneRowOffsets,
} from '../src/render/janko/engine';
import { getEquatorRuleYs } from '../src/render/janko/elements/staff';
import { getEquatorYForOctave } from '../src/render/janko/geometry';
import { digitHalfExtents } from '../src/render/janko/elements/notehead';
import {
  JankoRhythmNote,
  bridgeBeamGroupsAcrossRests,
  getStemGeometry,
  partitionBeamGroups,
} from '../src/render/janko/elements/rhythm';
import {
  JANKO_REST_VALUES,
  JankoRestValue,
  REST_BOX_STROKE,
  REST_LINEAR_SCALE,
  REST_PHANTOM_HEAD_RADIUS,
  REST_PHANTOM_HEAD_STROKE,
  REST_STROKE,
  REST_URTEXT_BULB_RADIUS,
  restInkBox,
} from '../src/render/janko/elements/rests';
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  checkBeamRestClearance,
  checkKnockoutCoverage,
  checkSplitStackStems,
  lintJankoScore,
} from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const REST_SPECIMEN = buildRestDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The two spacing presets (kept for the preset-explicit 17A solver fixtures). */
const SPACING_CANDIDATES: Array<{ id: string; spacing: JankoClusterSpacing; letter: string }> = [
  { id: 'spacing-snug', spacing: 'snug', letter: 'A' },
  { id: 'spacing-tight', spacing: 'tight', letter: 'B' },
];

/** The four carried rest dialects the round 18 verdict judges. */
const REST_STYLES: JankoRestStyle[] = [
  'kinetic-monoline',
  'classical-urtext',
  'geometric-node',
  'phantom-notehead',
];

/** The four verdict candidates, in display order. */
const VERDICT_CANDIDATES: Array<{ id: string; style: JankoRestStyle; letter: string }> = [
  { id: 'rest-kinetic-monoline', style: 'kinetic-monoline', letter: 'A' },
  { id: 'rest-classical-urtext', style: 'classical-urtext', letter: 'B' },
  { id: 'rest-geometric-node', style: 'geometric-node', letter: 'C' },
  { id: 'rest-phantom-notehead', style: 'phantom-notehead', letter: 'D' },
];

/**
 * The round 18 verdict window set: the R15 clean windows byte-identical
 * (fourth carry) plus the Bach m4 fixed-context window on every card.
 */
const VERDICT_WINDOWS = [
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 1 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 3 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 4 },
  { scoreId: BRAHMS_STUDIO_SCORE_ID, measureStart: 68 },
  { scoreId: SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 4 },
];

/** One synthetic note: pitch class + octave address the Jánko rows directly. */
function note(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: Hand = 'RH'
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand };
}

/** One synthetic one-measure score in 3/4. */
function score(id: string, notes: QuantizedNote[]): QuantizedGridScore {
  return {
    id,
    title: id,
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 144,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

/** Every rest of one score, flattened over its systems. */
function allRests(
  score: ReturnType<typeof buildBachGoldbergVar1Score>,
  options: Parameters<typeof resolveJankoOptions>[0],
  tokens: Parameters<typeof layoutJankoScore>[2]
) {
  return layoutJankoScore(score, resolveJankoOptions(options), tokens).flatMap((l) => l.rests);
}

/**
 * Every rest SVG group of one score under one spacing preset, in system order:
 * the extracted rest ink the spacing question is forbidden to move. Groups are
 * matched with a depth counter, so nested dialect markup (urtext hooks) cannot
 * truncate the comparison.
 */
function restInkOf(
  score: ReturnType<typeof buildBachGoldbergVar1Score>,
  base: Parameters<typeof resolveJankoOptions>[0],
  tokens: Parameters<typeof layoutJankoScore>[2],
  spacing: JankoClusterSpacing
): string[] {
  const o = resolveJankoOptions({ ...resolveJankoOptions(base), clusterSpacing: spacing });
  const t = resolveJankoTokens(tokens);
  const groups: string[] = [];
  for (const layout of layoutJankoScore(score, o, t)) {
    const svg = renderSystem(score, layout.geometry, layout.index, o, t, layout);
    const open = '<g class="janko-rest-group"';
    let at = svg.indexOf(open);
    while (at >= 0) {
      const tagEnd = svg.indexOf('>', at);
      let depth = 1;
      let cursor = tagEnd + 1;
      while (depth > 0) {
        const nextOpen = svg.indexOf('<g', cursor);
        const nextClose = svg.indexOf('</g>', cursor);
        if (nextClose < 0) break;
        if (nextOpen >= 0 && nextOpen < nextClose) {
          depth++;
          cursor = nextOpen + 2;
        } else {
          depth--;
          cursor = nextClose + 4;
        }
      }
      groups.push(svg.slice(at, cursor));
      at = svg.indexOf(open, cursor);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// 1. Registry discipline (one judged axis, per-candidate purity)
// ---------------------------------------------------------------------------

test('CURRENT_ROUND_METADATA opens round 18 with the single rest-shape axis', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 18);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Rest-Shape Verdict: Four Dialects on Fixed Behavior'
  );
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['restStyle'],
    'the round carries exactly the operator-approved axis'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /shape/i);
  assert.match(CURRENT_ROUND_METADATA.description, /behavior is fixed/);
  assert.match(
    CURRENT_ROUND_METADATA.description,
    /fourth carry/,
    'the clean windows compare against everything the operator saw'
  );
});

test('CURRENT_CANDIDATES declares exactly the four carried dialects', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    VERDICT_CANDIDATES.map((c) => c.id),
    'A–D in registry order'
  );
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.equal(CURRENT_CANDIDATES.length, 4, 'four candidates on one axis');

  assert.deepEqual(
    VERDICT_CANDIDATES.map((c) => resolveCandidate(getCandidate(c.id)!).options.restStyle),
    VERDICT_CANDIDATES.map((c) => c.style),
    'every carried dialect is represented exactly once'
  );
  assert.deepEqual(
    [...new Set(VERDICT_CANDIDATES.map((c) => c.style))].sort(),
    [...REST_STYLES].sort(),
    'the registry covers the four carried dialects'
  );

  for (const { id, letter } of VERDICT_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.ok(candidate.label.startsWith(`${letter} · `), `${id} is candidate ${letter}`);
    assert.ok((candidate.description ?? '').length > 120, `${id} carries a rationale`);
    assert.ok((candidate.tags ?? []).length > 0, `${id} is tagged`);
  }
});

test('Per-candidate purity: each candidate states only the rest-shape axis and no locked delta', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const { id, style } of VERDICT_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.equal(candidate.axis, 'restStyle', `${id} declares the rest-shape axis`);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['restStyle'],
      `${id} varies the rest-shape axis and nothing else`
    );
    assert.equal(candidate.options?.restStyle, style);
    const options = (candidate.options ?? {}) as Record<string, unknown>;
    for (const locked of [
      'clusterSpacing',
      'gridWritingPolicy',
      'systemStartStyle',
      'chordGrouping',
      'subdivisionStyle',
      'claspDurationStyle',
    ]) {
      assert.equal(options[locked], undefined, `${id} never states the locked ${locked}`);
    }
    assert.equal(candidate.tokens, undefined, `${id} carries no token delta`);
  }
  // The golden context every candidate inherits, unchanged.
  assert.equal(golden.clusterSpacing, 'tight', 'the decided spacing golden');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the incumbent dialect golden');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'grid candidate C is locked');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the flared bracket is locked');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the per-hand clasp is locked');
  assert.equal(golden.systemsPerPage, 4, 'four systems per page is locked');
});

test('Every candidate states exactly its open-axis badge and nothing else', () => {
  for (const { id, style } of VERDICT_CANDIDATES) {
    const badges = candidateBadges(getCandidate(id)!);
    assert.deepEqual(
      badges.map((b) => b.key),
      ['restStyle'],
      `${id} badges only its own axis`
    );
    assert.equal(badges[0].value, style);
    assert.equal(badges[0].axis, true, `${id} flags the rest-shape axis`);
  }
  // Departures from golden: the three challengers; the incumbent states the
  // golden value on the axis without a delta.
  const departures = CURRENT_CANDIDATES.flatMap((c) =>
    candidateBadges(c).filter((b) => b.value !== b.golden)
  );
  assert.equal(departures.length, 3, 'three shape departures');
  assert.deepEqual(
    departures.map((b) => b.value).sort(),
    ['classical-urtext', 'geometric-node', 'phantom-notehead'].sort()
  );
});

test('All four candidates share the verdict windows: the R15 clean set plus Bach m4', () => {
  for (const { id } of VERDICT_CANDIDATES) {
    const resolved = resolveCandidate(getCandidate(id)!);
    assert.deepEqual(
      resolved.windows.map((w) => ({ scoreId: w.scoreId, measureStart: w.measureStart })),
      VERDICT_WINDOWS,
      `${id} window set`
    );
    for (const window of resolved.windows) {
      assert.equal(window.measureCount, 1, `${id} shows one measure per window`);
      assert.ok(window.title.length > 20, `${id} titles every window`);
    }
    // The carried clean windows are byte-identical to Round 15 (fourth
    // carry): the verdict compares against everything the operator saw.
    assert.deepEqual(
      resolved.windows.slice(0, 6).map((w) => w.title),
      [
        'Rest specimen · m. 1 — the genuine 16th silence in a stepwise contour, free column',
        'Rest specimen · m. 2 — the genuine 8th silence',
        'Rest specimen · m. 3 — the genuine quarter silence',
        'Rest specimen · m. 4 — the genuine half silence',
        'Brahms Op. 118/1 · m. 68 — the one real-world bar with a writable rest and no crowded column',
        'Chord specimen · m. 2 — the genuine tick-180 8th rest among the clasped chords',
      ],
      `${id} carries the clean windows byte-identical`
    );
    // The fixed-context window proves the bridging, the weight and the
    // phrase rows on every card.
    const m4 = resolved.windows[6];
    assert.equal(m4.scoreId, DEFAULT_STUDIO_SCORE_ID, `${id} fixes its context on Bach`);
    assert.equal(m4.measureStart, 4, `${id} fixes its context on m. 4`);
  }
});

// ---------------------------------------------------------------------------
// 2. The golden is real geometry: both presets engrave, nothing is symbolic
// ---------------------------------------------------------------------------

test('The golden page layout is four systems per page and two pages — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    assert.equal(layouts.length, 8, `${spacing}: eight systems of music`);
    assert.equal(
      computePageGeometry(options, DEFAULT_JANKO_TOKENS).systems.length,
      4,
      `${spacing}: four systems per page`
    );
    assert.equal(
      countJankoPages(SCORE, options, DEFAULT_JANKO_TOKENS),
      2,
      `${spacing}: two pages`
    );
  }
});

test('The decided tight golden passes every gate; snug stays implemented and clean', () => {
  // The verdict is in: tight is the golden master, so the DEFAULT options —
  // exactly what the CLI gates — must report zero violations and zero
  // warnings on both benchmark scores.
  assert.equal(
    resolveJankoOptions(DEFAULT_JANKO_OPTIONS).clusterSpacing,
    'tight',
    'the golden master is the decided tight gap'
  );
  for (const [score, base, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const report = lintJankoScore(score, base, tokens);
    assert.equal(report.violations.length, 0, `tight golden: zero violations on ${label}`);
    assert.equal(report.warnings.length, 0, `tight golden: zero warnings on ${label}`);
    assert.equal(report.ok, true, `tight golden: ${label} engraves clean`);
  }
  // Snug remains implemented: the rest behavior is gap-independent, so the
  // retired golden stays clean too.
  for (const [score, base, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const snug = lintJankoScore(score, { ...base, clusterSpacing: 'snug' }, tokens);
    assert.equal(snug.violations.length, 0, `snug: zero violations on ${label}`);
    assert.equal(snug.warnings.length, 0, `snug: zero warnings on ${label}`);
  }
});

test('A and B are genuinely different engravings of the same score', () => {
  const crops = SPACING_CANDIDATES.map(({ spacing }) =>
    renderJankoCrop(
      SCORE,
      8,
      1,
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    )
  );
  assert.notEqual(crops[0], crops[1], 'snug and tight paint different m. 8 columns');
  for (const [i, { spacing }] of SPACING_CANDIDATES.entries()) {
    assert.ok(
      crops[i].includes('janko-knockout'),
      `${spacing} engraves real notehead masks`
    );
    assert.ok(crops[i].includes('janko-stem'), `${spacing} engraves real stems`);
    assert.ok(crops[i].includes('janko-digit'), `${spacing} engraves real digits`);
  }
});

// ---------------------------------------------------------------------------
// 3. The preset table and the gap identity (pinned per preset)
// ---------------------------------------------------------------------------

test('Preset table: margin / air / pair gap / wx / hy, exactly as ticketed', () => {
  const table: Record<JankoClusterSpacing, { margin: number; air: number; pairGap: number; wx: number; hy: number }> = {
    snug: { margin: 0.8, air: 0.4, pairGap: 5.86, wx: 2.73, hy: 3.66 },
    tight: { margin: 0.6, air: 0.4, pairGap: 5.46, wx: 2.53, hy: 3.46 },
  };
  for (const spacing of JANKO_CLUSTER_SPACINGS) {
    assert.deepEqual(
      getClusterSpacingPreset(spacing),
      table[spacing],
      `${spacing} geometry, verbatim`
    );
  }
});

test('Gap identity G = 2(1.93 + m) + air, pinned per preset', () => {
  assert.equal(JANKO_DIGIT_HALF_WIDTH, 1.93, 'measured digit half-width base');
  assert.equal(JANKO_DIGIT_HALF_HEIGHT, 2.86, 'measured digit half-height base');
  for (const spacing of JANKO_CLUSTER_SPACINGS) {
    const preset = getClusterSpacingPreset(spacing);
    assert.equal(
      preset.wx,
      JANKO_DIGIT_HALF_WIDTH + preset.margin,
      `${spacing}: wx = 1.93 + m`
    );
    assert.equal(
      preset.hy,
      JANKO_DIGIT_HALF_HEIGHT + preset.margin,
      `${spacing}: hy = 2.86 + m`
    );
    assert.equal(
      preset.pairGap,
      2 * preset.wx + preset.air,
      `${spacing}: G = 2wx + air`
    );
    assert.equal(
      preset.pairGap,
      2 * (JANKO_DIGIT_HALF_WIDTH + preset.margin) + preset.air,
      `${spacing}: G = 2(1.93 + m) + air`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. The rect paint pin: every mask a sharp rect with the preset wx/hy
// ---------------------------------------------------------------------------

test('Rect paint pin: every mask a sharp rect with the preset wx/hy, every digit 5.8pt', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const preset = getClusterSpacingPreset(spacing);
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    for (const page of [1, 2]) {
      const svg =
        page === 1
          ? renderJankoCrop(SCORE, 1, 16, options, DEFAULT_JANKO_TOKENS)
          : renderJankoCrop(SCORE, 17, 16, options, DEFAULT_JANKO_TOKENS);
      assert.ok(
        !/<ellipse class="janko-knockout"/.test(svg),
        `${spacing} p${page}: no legacy elliptical mask survives`
      );
      const masks = [
        ...svg.matchAll(
          /<rect class="janko-knockout" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#FFFFFF"\/>/g
        ),
      ];
      assert.ok(masks.length > 200, `${spacing} p${page}: paints real masks`);
      for (const m of masks) {
        const wx = Number(m[3]) / 2;
        const hy = Number(m[4]) / 2;
        assert.ok(
          Math.abs(wx - preset.wx) < 0.011,
          `${spacing}: mask half-width ${wx} is the preset ${preset.wx}`
        );
        assert.ok(
          Math.abs(hy - preset.hy) < 0.011,
          `${spacing}: mask half-height ${hy} is the preset ${preset.hy}`
        );
      }
      const sizes = [
        ...svg.matchAll(/class="janko-digit"[^>]*font-size="([\d.]+)pt"/g),
      ].map((m) => Number(m[1]));
      assert.equal(sizes.length, masks.length, `${spacing} p${page}: one digit per mask`);
      for (const size of sizes) {
        assert.equal(size, 5.8, `${spacing} p${page}: the digit stays 5.8pt`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Spans: pairs G ±0.1, triples 2G ±0.2, cells firm, time ordered
// ---------------------------------------------------------------------------

test('Pairs stand at the judged gap ±0.1, inside their beat cell, in time order — every preset', () => {
  // Bach's same-row pairs: t1032 (m8), t1632 (m12), t2040/t2064 (m15).
  const pairTicks = [1032, 1632, 2040, 2064];
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const notes = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).flatMap((l) => l.notes);
    for (const tick of pairTicks) {
      const pair = notes.filter((p) => p.note.startTick === tick);
      assert.equal(pair.length, 2, `${spacing} t${tick}: the ticketed pair`);
      const span = Math.abs(pair[1].x - pair[0].x);
      assert.ok(
        Math.abs(span - G) < 0.1,
        `${spacing} t${tick}: pair spans ${span.toFixed(2)} (G = ${G})`
      );
      for (const p of pair) {
        assert.ok(
          p.x >= (p.beatCell?.left ?? 0) - 1e-9 && p.x <= (p.beatCell?.right ?? 0) + 1e-9,
          `${spacing} t${tick}: ${p.note.id} stays in its beat cell`
        );
      }
    }
    // Time order across the ticketed neighbourhoods: no later onset may sit
    // left of an earlier one.
    for (const [a, b] of [[1020, 1032], [1032, 1044], [1620, 1632], [1632, 1644], [2028, 2040], [2040, 2052], [2052, 2064], [2064, 2076]] as const) {
      const maxA = Math.max(...notes.filter((p) => p.note.startTick === a).map((p) => p.x));
      const minB = Math.min(...notes.filter((p) => p.note.startTick === b).map((p) => p.x));
      assert.ok(maxA <= minB + 1e-9, `${spacing}: t${a} stays left of t${b}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 6. Unit centering: t1032 free-space symmetry ≤1.5pt
// ---------------------------------------------------------------------------

test('Unit centering: the t1032 pair sits symmetric in its free space — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const { wx } = getClusterSpacingPreset(spacing);
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const notes = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).flatMap((l) => l.notes);
    const pair = notes
      .filter((p) => p.note.startTick === 1032)
      .sort((a, b) => a.x - b.x);
    // The fixed nominal neighbours both sides (the 10.1/2.0 split is gone).
    const prevX = Math.max(
      ...notes.filter((p) => (p.nominalX ?? p.x) < (pair[0].nominalX ?? 0)).map((p) => p.nominalX ?? p.x)
    );
    const nextX = Math.min(
      ...notes.filter((p) => (p.nominalX ?? p.x) > (pair[0].nominalX ?? 0)).map((p) => p.nominalX ?? p.x)
    );
    const leftAir = pair[0].x - wx - (prevX + wx);
    const rightAir = nextX - wx - (pair[1].x + wx);
    assert.ok(
      Math.abs(leftAir - rightAir) <= 1.5,
      `${spacing}: t1032 free-space symmetry |${leftAir.toFixed(2)} − ${rightAir.toFixed(2)}| ≤ 1.5`
    );
  }
});

// ---------------------------------------------------------------------------
// 7. The pin: m12's 9 holds, the gap is min(G, room)
// ---------------------------------------------------------------------------

test('Pin: m12 pins the 9 on its column while the 7 walks in — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const notes = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).flatMap((l) => l.notes);
    const pair = notes
      .filter((p) => p.note.startTick === 1632)
      .sort((a, b) => a.x - b.x);
    const nine = pair.find((p) => p.coord.pitchClass === 9)!;
    assert.ok(nine, `${spacing}: the ticketed 9 exists`);
    assert.ok(
      Math.abs(nine.x - (nine.nominalX ?? nine.x)) <= 0.3,
      `${spacing}: the 9 holds its column (Δ${Math.abs(nine.x - (nine.nominalX ?? 0)).toFixed(2)})`
    );
    const span = Math.abs(pair[1].x - pair[0].x);
    // Free room here exceeds G on the roomy side, so the walked-in gap is G.
    assert.ok(
      Math.abs(span - G) < 0.1,
      `${spacing}: the 7 walks in to the judged gap (${span.toFixed(2)} = min(G, room))`
    );
  }
});

test('Pin-preserving shrink: a pair starved of room narrows to the room with the pin held', () => {
  // 5-tick onsets: the pair at tick 43 faces a 5-tick room to its beat pulse
  // — inside [touching, G) — so the gap shrinks to the room instead of
  // hiding the overflow by sliding the anchor.
  const shrink = score('synthetic-pin-shrink', [
    note('shrink-a', 0, 5, 38, 12),
    note('shrink-lo', 0, 5, 43, 12),
    note('shrink-hi', 4, 5, 43, 12),
    note('shrink-b', 1, 5, 48, 12),
  ]);
  // The synthetic room is tuned to the snug gap (snug remains implemented);
  // the solver itself is untouched by the golden verdict.
  const options = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    measuresPerSystem: 3,
    clusterSpacing: 'snug',
  });
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const placed = layoutJankoScore(shrink, options, tokens).flatMap((l) => l.notes);
  const lo = placed.find((p) => p.note.id === 'shrink-lo')!;
  const hi = placed.find((p) => p.note.id === 'shrink-hi')!;
  const room = (lo.beatCell?.right ?? 0) - (lo.nominalX ?? 0);
  assert.ok(
    room >= 2 * getClusterSpacingPreset('snug').wx && room < getClusterSpacingPreset('snug').pairGap,
    `the room (${room.toFixed(2)}pt) sits inside [touching, G)`
  );
  assert.ok(
    Math.abs(lo.x - (lo.nominalX ?? 0)) < 1e-9,
    'the pinned head holds its column exactly'
  );
  const span = Math.abs(hi.x - lo.x);
  assert.ok(
    Math.abs(span - room) < 0.05,
    `the gap shrinks to the room (${span.toFixed(2)} = min(G, room))`
  );
  assert.ok(span < getClusterSpacingPreset('snug').pairGap, 'and stays under the judged gap');
  const report = lintJankoScore(shrink, options, tokens);
  assert.equal(report.violations.length, 0, 'the shrunk pair still lints clean');
  assert.equal(report.warnings.length, 0, '... with no warnings either');
});

// ---------------------------------------------------------------------------
// 8. Redistribution: m15's four evened, still in time order
// ---------------------------------------------------------------------------

test('Redistribution: t2052..t2076 gaps spread ≤2.0 — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const notes = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).flatMap((l) => l.notes);
    const edge = (tick: number, which: 'min' | 'max'): number => {
      const xs = notes.filter((p) => p.note.startTick === tick).map((p) => p.x);
      return which === 'min' ? Math.min(...xs) : Math.max(...xs);
    };
    const g1 = edge(2064, 'min') - edge(2052, 'max');
    const g2 = edge(2076, 'min') - edge(2064, 'max');
    assert.ok(
      Math.abs(g1 - g2) <= 2.0,
      `${spacing}: m15 gap spread |${g1.toFixed(2)} − ${g2.toFixed(2)}| ≤ 2.0`
    );
  }
});

// ---------------------------------------------------------------------------
// 9. Mixed-hand seconds keep their two stems at head-x
// ---------------------------------------------------------------------------

test('Seconds keep two stems at head-x: the m12 rule on the t1632 pair — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    const pair = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 1632);
    assert.equal(pair.length, 2, `${spacing}: t1632 is a same-row pair`);
    assert.notEqual(pair[0].rhythm.hand, pair[1].rhythm.hand, `${spacing}: t1632 is cross-hand`);
    for (const layout of layouts) {
      const hidden = suppressedStemIds(layout);
      for (const p of pair.filter((q) => layout.notes.some((n) => n.note.id === q.note.id))) {
        assert.ok(!hidden.has(p.note.id), `${spacing}: ${p.note.id} keeps its own stem`);
        const stem = getStemGeometry(p.rhythm, DEFAULT_JANKO_TOKENS);
        assert.equal(stem.stemX, p.x, `${spacing}: ${p.note.id} stems exactly at head-x`);
      }
    }
    // Paint-level: two stem rules stand on the two head columns.
    const crop = renderJankoCrop(
      SCORE,
      12,
      1,
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    );
    const stems = [...crop.matchAll(/class="janko-stem" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
    for (const p of pair) {
      assert.ok(
        stems.some((s) => Math.abs(Number(s[1]) - p.x) < 0.01 && Math.abs(Number(s[3]) - p.x) < 0.01),
        `${spacing}: a painted stem stands on ${p.note.id} at x=${p.x.toFixed(2)}`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 10. Held triples: 2G spans, interleaved rows, one shared stem (t1392)
// ---------------------------------------------------------------------------

test('Brahms held triples span 2G with interleaved rows — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(BRAHMS, options, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    for (const tick of [1392, 1584]) {
      const heads = notes.filter((p) => p.note.startTick === tick);
      // The RH held triple on its row: three heads, 2G end to end.
      const rows = new Map<number, typeof heads>();
      for (const h of heads) {
        const key = Math.round(h.y * 1000);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key)!.push(h);
      }
      const triple = [...rows.values()].find((hs) => hs.length === 3)!;
      assert.ok(triple, `${spacing} t${tick}: the held triple`);
      const xs = triple.map((p) => p.x).sort((a, b) => a - b);
      assert.ok(
        Math.abs(xs[2] - xs[0] - 2 * G) < 0.2,
        `${spacing} t${tick}: triple spans ${(xs[2] - xs[0]).toFixed(2)} (2G = ${(2 * G).toFixed(2)})`
      );
    }
  }
});

test('t1392 interleaves its rows at the half-step and shares one stem', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(BRAHMS, options, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    const heads = notes.filter((p) => p.note.startTick === 1392);
    const rows = new Map<number, typeof heads>();
    for (const h of heads) {
      const key = Math.round(h.y * 1000);
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key)!.push(h);
    }
    const byY = [...rows.values()].sort((a, b) => a[0].y - b[0].y);
    const fanned = byY.filter((hs) => hs.length >= 2);
    assert.ok(fanned.length >= 2, `${spacing}: t1392 carries 2+ fanned rows`);
    const widest = fanned.reduce((a, b) => (b.length > a.length ? b : a));
    assert.equal(widest.length, 3, `${spacing}: the widest row is the triple`);
    // The widest row anchors: its middle head on the (clasp-shifted) column —
    // the same column the lone LH head stands on.
    const middle = widest.map((p) => p.x).sort((a, b) => a - b)[1];
    const lone = byY.find((hs) => hs.length === 1)![0];
    assert.ok(
      Math.abs(middle - lone.x) < 0.05,
      `${spacing}: the triple middle anchors the shifted column`
    );
    // The alternate fanned row nests at the half-step.
    const other = fanned.find((hs) => hs !== widest)!;
    const nest = Math.min(...other.map((p) => p.x)) - Math.min(...widest.map((p) => p.x));
    assert.ok(
      Math.abs(nest - G / 2) < 0.2,
      `${spacing}: t1392 nests at ${nest.toFixed(2)} (G/2 = ${(G / 2).toFixed(2)})`
    );
    // One shared stem for the whole one-duration onset, nearest the nominal.
    const layout = layouts.find((l) => l.notes.some((p) => p.note.startTick === 1392))!;
    const groups = layout.sharedStems.filter((g) => g.tick === 1392);
    assert.equal(groups.length, 1, `${spacing}: t1392 shares one stem`);
    assert.equal(groups[0].carrierId, 'brahms-op118-no1-96', `${spacing}: the carrier is 96`);
  }
});

// ---------------------------------------------------------------------------
// 11. Mixed stacks coincide: the t1752 three-voice chord (locked)
// ---------------------------------------------------------------------------

test('Mixed stack t1752: exactly one stem-x, both beams present, each drawn once (locked)', () => {
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const heads = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 1752);
  assert.equal(heads.length, 2, 't1752 carries the mixed-duration stacked pair');
  assert.equal(heads[0].x, heads[1].x, 'both heads stand on the nominal column');

  // Both voices are beamed in their own hand's run: the RH single strip and
  // the LH double strip.
  const touching = layouts
    .flatMap((l) => l.beams)
    .filter((b) => b.notes.some((n) => n.startTick === 1752));
  assert.equal(touching.length, 2, 'the RH beam and the LH beam both touch t1752');
  const rh = touching.find((b) => b.notes[0].hand === 'RH')!;
  const lh = touching.find((b) => b.notes[0].hand === 'LH')!;
  assert.deepEqual(
    rh.notes.map((n) => n.startTick),
    [1728, 1752],
    'the RH beam spans the 8th pair'
  );
  assert.equal(rh.secondary, null, 'the RH beam is a single strip');
  assert.deepEqual(
    lh.notes.map((n) => n.startTick),
    [1728, 1740, 1752, 1764],
    'the LH beam spans the 16th run'
  );
  assert.ok(lh.secondary, 'the LH beam is a double strip');

  // One visible coincident line: every painted stem of the column shares one x.
  const stemXs = touching.flatMap((b) =>
    b.stems.filter((_, i) => b.notes[i].startTick === 1752).map((s) => s.stemX)
  );
  assert.equal(stemXs.length, 2, 'one stem per voice, each reaching its own beam');
  assert.equal(stemXs[0], stemXs[1], 'the two stems coincide on the nominal column');
  assert.equal(stemXs[0], heads[0].x, 'the coincident line stands on the heads');

  // Each beam span is drawn once: the painted beam lines of the system match
  // the layout's beam groups exactly.
  const layout = layouts.find((l) => l.notes.some((p) => p.note.startTick === 1752))!;
  const svg = renderSystem(SCORE, layout.geometry, layout.index, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, layout);
  const primaries = svg.match(/class="janko-beam"/g) ?? [];
  const secondaries = svg.match(/class="janko-beam-secondary"/g) ?? [];
  assert.equal(primaries.length, layout.beams.length, 'one primary line per beam group');
  assert.equal(
    secondaries.length,
    layout.beams.filter((b) => b.secondary).length,
    'one secondary line per double strip'
  );
});

// ---------------------------------------------------------------------------
// 12. Synthetic same-duration stacks: one painted stem
// ---------------------------------------------------------------------------

test('Synthetic same-duration stacks: one painted stem — stacked and flanked', () => {
  const stack = score('synthetic-shared-stem', [
    // A stacked same-hand same-duration pair (two rows, one column).
    note('stack-lo', 2, 3, 0, 48),
    note('stack-hi', 2, 4, 0, 48),
    // A flanked same-hand same-duration pair (one row, two heads).
    note('flank-lo', 4, 4, 48, 48),
    note('flank-hi', 6, 4, 48, 48),
  ]);
  const layouts = layoutJankoScore(stack, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(layouts.length, 1);
  const layout = layouts[0];
  const hidden = suppressedStemIds(layout);

  // The stack shares one stem on the column (the vertical-chord grammar).
  const stackPainted = ['stack-lo', 'stack-hi'].filter((id) => !hidden.has(id));
  assert.equal(stackPainted.length, 1, 'the stack paints one shared stem');

  // The flanked pair spans the golden gap and shares one stem on the column.
  const flank = layout.notes.filter((p) => p.note.startTick === 48).sort((a, b) => a.x - b.x);
  assert.equal(flank.length, 2);
  const G = getClusterSpacingPreset('tight').pairGap;
  assert.ok(
    Math.abs(flank[1].x - flank[0].x - G) < 0.05,
    `the flanked pair spans the golden ${G}pt (got ${(flank[1].x - flank[0].x).toFixed(2)})`
  );
  const groups = layout.sharedStems.filter((g) => g.tick === 48 && g.hand === 'RH');
  assert.equal(groups.length, 1, 'the flanked pair forms one shared-stem group');
  const carrier = layout.notes.find((p) => p.note.id === groups[0].carrierId)!;
  assert.ok(Math.abs(carrier.x - carrier.nominalX!) < 0.05, 'the carrier stands on the column');
  const flankPainted = ['flank-lo', 'flank-hi'].filter((id) => !hidden.has(id));
  assert.deepEqual(flankPainted, [carrier.note.id], 'the flanked pair paints one shared stem');

  // And the shared grammar is clean: no split column, no simultaneity trip.
  const split: Parameters<typeof checkSplitStackStems>[2] = [];
  checkSplitStackStems(layout, resolveJankoTokens(DEFAULT_JANKO_TOKENS), split);
  assert.deepEqual(split, [], 'no split-stack-stems on the synthetic stacks');
  const report = lintJankoScore(stack, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the synthetic stacks lint clean');
});

test('Zero split-stack-stems golden-wide; a staggered column is named', () => {
  for (const [score, options, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
    [SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 }, DEFAULT_JANKO_TOKENS, 'chord specimen'],
    [REST_SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen'],
  ] as const) {
    const report = lintJankoScore(score, options, tokens);
    assert.equal(
      report.diagnostics.filter((d) => d.code === 'split-stack-stems').length,
      0,
      `${label}: no onset column ever splits its stems`
    );
  }

  // The defect: two stems of one onset column at different x — the deleted
  // Round 15 stagger returning silently.
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const layout = layouts.find((l) => l.notes.some((p) => p.note.startTick === 1752))!;
  const tampered = {
    ...layout,
    beams: layout.beams.map((b) => ({
      ...b,
      stems: b.stems.map((s, i) =>
        b.notes[i].startTick === 1752 && b.notes[i].hand === 'RH' ? { ...s, stemX: s.stemX + 1.2 } : s
      ),
    })),
  };
  const out: Parameters<typeof checkSplitStackStems>[2] = [];
  checkSplitStackStems(tampered, resolveJankoTokens(DEFAULT_JANKO_TOKENS), out);
  assert.equal(out.length, 1, 'the staggered column is named');
  assert.equal(out[0].code, 'split-stack-stems');
  assert.equal(out[0].severity, 'error');
  assert.match(out[0].message, /different stem columns/);
});

// ---------------------------------------------------------------------------
// 13. Beam spans are drawn exactly once per voice
// ---------------------------------------------------------------------------

test('Shared stems draw one beam span per beamed voice — none fused, none doubled', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const crop = renderJankoCrop(
      SCORE,
      1,
      32,
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    );
    const stems = (crop.match(/class="janko-stem"/g) ?? []).length;
    const beams = (crop.match(/class="janko-beam"/g) ?? []).length;
    const layouts = layoutJankoScore(
      SCORE,
      resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing }),
      DEFAULT_JANKO_TOKENS
    );
    const expectedBeams = layouts.reduce((acc, l) => acc + l.beams.length, 0);
    assert.equal(beams, expectedBeams, `${spacing}: every beam span is drawn exactly once`);
    assert.ok(stems > beams, `${spacing}: stems outnumber beams (flags share nothing)`);
  }
});

// ---------------------------------------------------------------------------
// 14. Dots hug the mask corner (offsets, clearance proof, uniform sign)
// ---------------------------------------------------------------------------

test('Dots hug the mask corner on both scores — every preset', () => {
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const { spacing } of SPACING_CANDIDATES) {
    const preset = getClusterSpacingPreset(spacing);
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, tokens);
    const dotted = layouts.flatMap((l) => l.notes).filter(
      (p) => p.note.durationTicks > 26 && p.note.durationTicks <= 38
    );
    assert.equal(dotted.length, 19, `${spacing}: Bach carries 19 dotted values`);
    for (const p of dotted) {
      // Hug offsets: tight to the mask edge, low lane above the head.
      assert.ok(
        Math.abs((p.rhythm.dotX ?? -1) - (p.x + preset.wx + tokens.augmentationDotGap)) < 1e-9,
        `${spacing}: ${p.note.id} hugs its mask edge`
      );
      assert.ok(
        Math.abs(p.y - (p.rhythm.dotY ?? -1) - tokens.augmentationDotRowOffset) < 1e-9,
        `${spacing}: ${p.note.id} sits the hug lane above its head`
      );
      // Uniform sign, every bar.
      assert.ok(
        (p.rhythm.dotY ?? p.y) < p.y,
        `${spacing}: ${p.note.id} dots above its head`
      );
      // The high-lane fallback stays vacuous: no same-row neighbour crowds.
      const layout = layouts.find((l) => l.notes.includes(p))!;
      for (const q of layout.notes) {
        if (q === p || Math.abs(q.y - p.y) >= 1e-9) continue;
        assert.ok(
          Math.abs(q.x - p.x) >= 2 * preset.wx + tokens.augmentationDotGap + tokens.augmentationDotRadius,
          `${spacing}: ${p.note.id} clears its same-row neighbour ${q.note.id}`
        );
      }
    }
    const brahmsLayouts = layoutJankoScore(
      BRAHMS,
      resolveJankoOptions({
        ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
        clusterSpacing: spacing,
      }),
      BRAHMS_OP118_NO1_JANKO_TOKENS
    );
    for (const l of brahmsLayouts) {
      for (const p of l.notes) {
        if (p.note.durationTicks <= 26 || p.note.durationTicks > 38) continue;
        assert.ok(
          Math.abs((p.rhythm.dotX ?? -1) - (p.x + preset.wx + tokens.augmentationDotGap)) < 1e-9,
          `${spacing}: Brahms ${p.note.id} hugs its mask edge`
        );
        assert.ok(
          (p.rhythm.dotY ?? p.y) < p.y,
          `${spacing}: Brahms ${p.note.id} dots above its head`
        );
      }
    }
  }
});

test('Dot clearance proof: every Bach dot clears its mask, rules and grid', () => {
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const { spacing } of SPACING_CANDIDATES) {
    const preset = getClusterSpacingPreset(spacing);
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, tokens);
    const dotted = layouts.flatMap((l) => l.notes).filter(
      (p) => p.note.durationTicks > 26 && p.note.durationTicks <= 38
    );
    for (const p of dotted) {
      const cx = p.rhythm.dotX!;
      const cy = p.rhythm.dotY!;
      // Own mask: the dot hugs the top-right corner with real air.
      const dx = Math.max(p.x - preset.wx - cx, 0, cx - (p.x + preset.wx));
      const dy = Math.max(p.y - preset.hy - cy, 0, cy - (p.y + preset.hy));
      assert.ok(
        Math.hypot(dx, dy) >= tokens.augmentationDotRadius,
        `${spacing}: ${p.note.id} clears its own mask corner`
      );
      // Rules: the hug lane sits 4.0pt from the nearest rule.
      const layout = layouts.find((l) => l.notes.includes(p))!;
      for (let octave = 0; octave <= 8; octave++) {
        for (const ry of getEquatorRuleYs(layout.geometry.equatorY('RH', octave), options, tokens)) {
          assert.ok(
            Math.abs(cy - ry) >= tokens.augmentationDotRadius + 0.375,
            `${spacing}: ${p.note.id} clears the o${octave} rule`
          );
        }
      }
      // Same-row neighbours: the linter's own collision audit stays silent.
      const collisions = lintJankoScore(SCORE, options, tokens).diagnostics.filter(
        (d) => d.code === 'dot-collision'
      );
      assert.deepEqual(collisions, [], `${spacing}: zero dot collisions Bach-wide`);
    }
  }
});

test("Bar 6's dot attaches only to t744 — every preset", () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    const dotted = notes.filter(
      (p) => p.note.startTick >= 720 && p.note.startTick < 864 && p.note.durationTicks > 26 && p.note.durationTicks <= 38
    );
    assert.equal(dotted.length, 1, `${spacing}: bar 6 carries exactly one dotted value`);
    assert.equal(dotted[0].note.startTick, 744, `${spacing}: the dotted value is the LH 0 at t744`);
    const dot = { x: dotted[0].rhythm.dotX!, y: dotted[0].rhythm.dotY! };
    let nearest = notes[0];
    let nearestDistance = Infinity;
    for (const q of notes) {
      const distance = Math.hypot(dot.x - q.x, dot.y - q.y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = q;
      }
    }
    assert.equal(nearest.note.id, dotted[0].note.id, `${spacing}: the nearest head to the dot is its own t744 head`);

    // Paint-level: the engraved dot sits at the resolved hug position, above
    // and right — never mirrored, never on-row.
    const crop = renderJankoCrop(
      SCORE,
      6,
      1,
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    );
    const painted = [...crop.matchAll(/class="janko-augmentation-dot" cx="([\d.]+)" cy="([\d.]+)"/g)].map(
      (m) => ({ cx: Number(m[1]), cy: Number(m[2]) })
    );
    assert.ok(
      painted.some((d) => Math.abs(d.cx - dot.x) < 0.01 && Math.abs(d.cy - dot.y) < 0.01),
      `${spacing}: the t744 dot paints at (${dot.x.toFixed(2)}, ${dot.y.toFixed(2)})`
    );
    assert.ok(dot.y < dotted[0].y, `${spacing}: above the head`);
    assert.ok(dot.x > dotted[0].x, `${spacing}: right of the head`);
  }
});

test('Dot high-lane fallback: a crowded same-row neighbour lifts the dot', () => {
  // A dotted head with a same-row neighbour 7 ticks away: the heads clear
  // (5.93pt apart) but the low dot would sit inside the neighbour's mask, so
  // the fallback lifts it to the high lane (half a row up, grazing no rule
  // from the Set B row).
  const crowded = score('synthetic-dot-fallback', [
    note('dot-head', 1, 4, 24, 36),
    note('dot-neighbour', 3, 4, 31, 12),
  ]);
  const options = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const placed = layoutJankoScore(crowded, options, tokens).flatMap((l) => l.notes);
  const head = placed.find((p) => p.note.id === 'dot-head')!;
  assert.ok(
    Math.abs(head.y - head.rhythm.dotY! - tokens.rowHeight / 2) < 1e-9,
    'the crowded dot takes the high lane'
  );
  assert.ok(head.rhythm.dotY! < head.y, '... still above its head');
  const report = lintJankoScore(crowded, options, tokens);
  assert.equal(report.violations.length, 0, 'the lifted dot lints clean');
});

// ---------------------------------------------------------------------------
// 15. The digit inside the rect: all 12 glyphs, every preset evaluated
// ---------------------------------------------------------------------------

test('All 12 pitch-class digits sit inside the rect with the preset margin — every spacing', () => {
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const { halfWidth, halfHeight } = digitHalfExtents(tokens.digitFontSize);
  for (const spacing of JANKO_CLUSTER_SPACINGS) {
    const preset = getClusterSpacingPreset(spacing);
    const digitNotes: QuantizedNote[] = [];
    for (let pc = 0; pc < 12; pc++) {
      digitNotes.push(note(`all-pc-${pc}`, pc, 4, pc * 12, 12));
    }
    const layouts = layoutJankoScore(
      score(`synthetic-all-digits-${spacing}`, digitNotes),
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    );
    assert.equal(layouts.length, 1, `${spacing}: the digit row engraves`);
    assert.equal(layouts[0].notes.length, 12, `${spacing}: all 12 pitch classes`);
    for (const p of layouts[0].notes) {
      assert.ok(
        preset.wx - halfWidth >= preset.margin - 0.01,
        `${spacing}: pc${p.coord.pitchClass} keeps its left/right margin`
      );
      assert.ok(
        preset.hy - halfHeight >= preset.margin - 0.01,
        `${spacing}: pc${p.coord.pitchClass} keeps its top/bottom margin`
      );
    }
    const coverage = lintJankoScore(
      score(`synthetic-all-digits-${spacing}`, digitNotes),
      { ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    ).diagnostics.filter((d) => d.code === 'knockout-undersized');
    assert.deepEqual(coverage, [], `${spacing}: the coverage audit stays silent`);
    const direct: Parameters<typeof checkKnockoutCoverage>[4] = [];
    checkKnockoutCoverage(
      layouts[0],
      resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing }),
      tokens,
      DEFAULT_JANKO_LINT_OPTIONS,
      direct
    );
    assert.deepEqual(direct, [], `${spacing}: direct coverage check stays silent`);
  }
});

// ---------------------------------------------------------------------------
// 16. Rests: Round 17B fixed behavior (weight, phrase rows, bridging)
// ---------------------------------------------------------------------------

test('Rest weight: every rest stroke is the note-stem weight with scaled extents', () => {
  // The constants: strokes back at Round 15 pre-scale values, extents scaled.
  assert.equal(REST_STROKE, 0.9, 'the monoline rest stroke is exactly the note stem stroke');
  assert.equal(REST_BOX_STROKE, 0.6, 'the bauhaus box stroke is its pre-scale 0.6pt');
  assert.equal(REST_PHANTOM_HEAD_STROKE, 0.8, 'the phantom stroke is its pre-scale 0.8pt');
  assert.equal(REST_LINEAR_SCALE, 0.575, 'extents keep the 0.575 scale');
  assert.ok(
    Math.abs(REST_PHANTOM_HEAD_RADIUS - 3.0 * REST_LINEAR_SCALE) < 1e-9,
    'the phantom head radius is an extent and stays scaled'
  );
  assert.ok(
    Math.abs(REST_URTEXT_BULB_RADIUS - 0.7 * REST_LINEAR_SCALE) < 1e-9,
    'the urtext bulb radius is an extent and stays scaled'
  );

  // The paint: every stroke-width inside every printed rest group, over Bach
  // (16ths, 8ths, quarters) plus the rest specimen (all four values).
  const widthsOf = (style: JankoRestStyle): string[] => {
    const groups = [
      ...restInkOf(SCORE, { ...DEFAULT_JANKO_OPTIONS, restStyle: style }, DEFAULT_JANKO_TOKENS, 'tight'),
      ...restInkOf(
        REST_SPECIMEN,
        { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4, restStyle: style },
        DEFAULT_JANKO_TOKENS,
        'tight'
      ),
    ];
    assert.ok(groups.length >= 13, `${style} prints its rests (${groups.length} groups)`);
    return [...groups.join('\n').matchAll(/stroke-width="([\d.]+)"/g)].map((m) => m[1]);
  };
  for (const style of ['kinetic-monoline', 'classical-urtext', 'geometric-node'] as const) {
    const widths = widthsOf(style);
    assert.ok(widths.length > 0, `${style} paints stroked ink`);
    assert.ok(
      widths.every((w) => w === '0.90'),
      `${style}: every rest stroke is 0.90pt (saw ${[...new Set(widths)].join(', ')})`
    );
  }
  const phantom = widthsOf('phantom-notehead');
  assert.ok(
    phantom.length > 0 && phantom.every((w) => w === '0.80'),
    `phantom: every rest stroke is 0.80pt (saw ${[...new Set(phantom)].join(', ')})`
  );
  const bauhaus = widthsOf('bauhaus-slash');
  assert.ok(
    bauhaus.length > 0 && bauhaus.every((w) => w === '0.90' || w === '0.60'),
    `bauhaus: slashes at 0.90pt, the hairline box at 0.60pt (saw ${[...new Set(bauhaus)].join(', ')})`
  );
  assert.ok(bauhaus.includes('0.60'), 'the bauhaus half box really paints its 0.60pt hairline');
});

test('Rest size maxima: pinned per value over the four carried dialects', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const expected: Record<string, { w: number; h: number }> = {
    sixteenth: { w: 4.94, h: 7.3025 },
    eighth: { w: 4.94, h: 7.3025 },
    quarter: { w: 4.25, h: 6.9 },
    half: { w: 4.925, h: 5.06 },
  };
  for (const [value, max] of Object.entries(expected)) {
    let w = 0;
    let h = 0;
    for (const style of REST_STYLES) {
      const box = restInkBox(
        { tick: 0, durationTicks: 0, hand: 'RH', x: 0, y: 0, value: value as JankoRestValue, style },
        t
      );
      w = Math.max(w, box.x1 - box.x0);
      h = Math.max(h, box.y1 - box.y0);
    }
    assert.ok(Math.abs(w - max.w) < 1e-6, `${value}: max width ${max.w}pt (got ${w})`);
    assert.ok(Math.abs(h - max.h) < 1e-6, `${value}: max height ${max.h}pt (got ${h})`);
    // Smaller ink on standard-like proportions — never head-sized.
    assert.ok(w < 2 * t.noteheadRadius, `${value}: narrower than one head`);
    assert.ok(h < 2 * t.noteheadRadius, `${value}: shorter than one head`);
  }
  // The weight change grows widths (stroke padding) but no extent: heights are
  // exactly the Round 16 pins.
  assert.deepEqual(
    JANKO_REST_VALUES.map((value) => expected[value].h),
    [7.3025, 7.3025, 6.9, 5.06],
    'extents keep the scaled heights'
  );
});

test('Phrase rows: the showcase rests hang a glyph edge exactly on a phrase row — every dialect', () => {
  const cases = [
    {
      label: 'Bach m. 4',
      score: SCORE,
      options: DEFAULT_JANKO_OPTIONS,
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [552],
    },
    {
      label: 'Bach m. 6',
      score: SCORE,
      options: DEFAULT_JANKO_OPTIONS,
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [720],
    },
    {
      label: 'Bach m. 7',
      score: SCORE,
      options: DEFAULT_JANKO_OPTIONS,
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [864],
    },
    {
      label: 'chord specimen m. 2',
      score: SPECIMEN,
      options: { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [180],
    },
    {
      label: 'rest specimen',
      score: REST_SPECIMEN,
      options: { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [24, 168, 312, 456],
    },
    {
      label: 'Brahms m. 68',
      score: BRAHMS,
      options: BRAHMS_OP118_NO1_JANKO_OPTIONS,
      tokens: BRAHMS_OP118_NO1_JANKO_TOKENS,
      ticks: [13092],
    },
  ] as const;
  for (const style of REST_STYLES) {
    for (const c of cases) {
      const o = resolveJankoOptions({ ...c.options, restStyle: style });
      const t = resolveJankoTokens(c.tokens);
      const layouts = layoutJankoScore(c.score, o, t);
      for (const tick of c.ticks) {
        const layout = layouts.find((l) => l.rests.some((r) => r.tick === tick));
        assert.ok(layout, `${style} · ${c.label}: the t${tick} rest is written`);
        const rest = layout!.rests.find((r) => r.tick === tick)!;
        const box = restInkBox(rest, t);
        // On-row: one glyph edge sits exactly on a whole-tone row of the
        // lattice (staff octaves plus ledger registers) — the hang.
        const rows: number[] = [];
        for (let octave = 0; octave <= 8; octave++) {
          const base = layout!.geometry.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
          for (const offset of wholeToneRowOffsets(o, t)) rows.push(base + offset);
        }
        let rowDistance = Infinity;
        let rowY = rows[0];
        for (const edge of [box.y0, box.y1]) {
          for (const candidate of rows) {
            const distance = Math.abs(edge - candidate);
            if (distance < rowDistance) {
              rowDistance = distance;
              rowY = candidate;
            }
          }
        }
        assert.ok(
          rowDistance < 1e-6,
          `${style} · ${c.label} t${tick}: a glyph edge hangs exactly on a phrase row (off by ${rowDistance.toFixed(6)})`
        );
        // Corridor-side: the glyph extends from its row toward Middle C.
        const toCorridor = layout!.geometry.middleCY - rowY;
        const extendsTo = (box.y0 + box.y1) / 2 - rowY;
        assert.ok(
          Math.sign(extendsTo) === Math.sign(toCorridor),
          `${style} · ${c.label} t${tick}: the glyph extends toward the corridor`
        );
        // Clear: the admission predicate and the lint agree.
        assert.equal(
          restClearsLayout(rest, layout!.notes, t),
          true,
          `${style} · ${c.label} t${tick}: the hung rest clears every head`
        );
      }
      const report = lintJankoScore(c.score, { ...c.options, restStyle: style }, c.tokens);
      assert.equal(
        report.diagnostics.filter(
          (d) => d.code === 'rest-collision' || d.code === 'rest-unwritable' || d.code === 'beam-rest-clearance'
        ).length,
        0,
        `${style} · ${c.label}: no rest diagnostic`
      );
    }
  }
});

test('Vertical fallback: a walled reference row seats the adjacent row; a roomy cell keeps the reference', () => {
  // One RH 16th silence (60..72) on the octave-3 even row, with the LH
  // walling the whole beat cell on that row: at 4 per system the reference
  // row offers no clear slot, so the adjacent row toward the corridor seats
  // the rest; at 2 per system the wider cell keeps the reference seat.
  const wall = score('synthetic-rest-fallback', [
    note('rh-a', 2, 3, 48, 12),
    note('rh-b', 2, 3, 72, 12),
    note('rh-c', 2, 3, 84, 12),
    note('lh-54', 2, 3, 54, 12, 'LH'),
    note('lh-60', 2, 3, 60, 12, 'LH'),
    note('lh-66', 2, 3, 66, 12, 'LH'),
    note('lh-78', 2, 3, 78, 12, 'LH'),
    note('lh-90', 2, 3, 90, 12, 'LH'),
  ]);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const narrow = layoutJankoScore(
    wall,
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 },
    DEFAULT_JANKO_TOKENS
  )[0];
  assert.deepEqual(narrow.unwrittenRests, [], 'the walled silence is written, not refused');
  const rest = narrow.rests.find((r) => r.tick === 60)!;
  assert.ok(rest, 'the tick-60 rest is admitted');
  assert.equal(rest.hand, 'RH');
  assert.equal(rest.value, 'sixteenth');
  const box = restInkBox(rest, t);
  const release = narrow.notes.find((p) => p.note.id === 'rh-a')!;
  const resume = narrow.notes.find((p) => p.note.id === 'rh-b')!;
  assert.equal(release.y, resume.y, 'the releasing and resuming rows agree');
  const referenceRow = release.y;
  assert.ok(
    Math.abs(box.y0 - referenceRow) > 1 && Math.abs(box.y1 - referenceRow) > 1,
    'the walled reference row seats nothing'
  );
  assert.ok(
    Math.abs(box.y1 - (referenceRow - t.rowHeight)) < 1e-6,
    `the adjacent row toward the corridor seats the rest (edge at ${box.y1.toFixed(2)}pt)`
  );
  assert.equal(restClearsLayout(rest, narrow.notes, t), true, 'the fallback seat clears every head');
  assert.ok(
    narrow.beams.some((b) => b.notes.map((n) => n.startTick).join(',') === '48,72,84'),
    'the run still bridges across its printed rest'
  );
  const narrowReport = lintJankoScore(
    wall,
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 },
    DEFAULT_JANKO_TOKENS
  );
  assert.equal(narrowReport.violations.length, 0, 'the fallback engraving is violation-free');
  assert.equal(narrowReport.warnings.length, 0, '... with no warnings either');

  // The same silence in a roomy cell never falls back.
  const wide = layoutJankoScore(
    wall,
    { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 },
    DEFAULT_JANKO_TOKENS
  )[0];
  const kept = wide.rests.find((r) => r.tick === 60)!;
  const keptBox = restInkBox(kept, t);
  const wideRelease = wide.notes.find((p) => p.note.id === 'rh-a')!;
  assert.ok(
    Math.abs(keptBox.y1 - wideRelease.y) < 1e-6,
    'the roomy cell keeps the reference seat'
  );
});

test('Bridging: m. 4 beams [528, 540, 564] as one gesture with its 16th rest printed beneath', () => {
  const layout = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  const groups = layout.beams.map((b) => b.notes.map((n) => n.startTick).join(','));
  assert.ok(groups.includes('528,540,564'), `the beat-3 run beams as one gesture (got ${groups.join(' | ')})`);
  const beam = layout.beams.find((b) => b.notes.map((n) => n.startTick).join(',') === '528,540,564')!;
  assert.ok(
    beam.notes.every((n) => n.hand === 'RH'),
    'the bridged gesture is one right-hand voice'
  );
  assert.deepEqual(
    layout.ungrouped.filter((n) => n.startTick >= 528 && n.startTick < 576).map((n) => n.startTick),
    [],
    'no orphaned flag survives inside the bridged beat'
  );
  // The rest is still computed, admitted and printed — the beam continues
  // across it, and the admission is unchanged by the bridge.
  const rest = layout.rests.find((r) => r.tick === 552)!;
  assert.ok(rest, 'the tick-552 rest is admitted');
  assert.equal(rest.hand, 'RH');
  assert.equal(rest.value, 'sixteenth');
  assert.equal(rest.durationTicks, 12);
  const crop = renderJankoCrop(SCORE, 4, 1, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.match(
    crop,
    /<g class="janko-rest-group" data-rest-tick="552" data-rest-value="sixteenth" data-rest-hand="RH"/,
    'the bridged rest is printed in its natural gap'
  );
  // Beneath a clearing beam: the connector rides above the rest ink with the
  // full beam air, and the linter's beam-rest audit agrees.
  const box = restInkBox(rest, resolveJankoTokens(DEFAULT_JANKO_TOKENS));
  const air = DEFAULT_JANKO_TOKENS.minStemClearance!;
  assert.ok(
    beam.beamY(rest.x) + air <= box.y0,
    `the beam clears the rest ink (beam ${beam.beamY(rest.x).toFixed(2)}pt, ink top ${box.y0.toFixed(2)}pt)`
  );
  const out: Parameters<typeof checkBeamRestClearance>[3] = [];
  checkBeamRestClearance(layout, resolveJankoTokens(DEFAULT_JANKO_TOKENS), DEFAULT_JANKO_LINT_OPTIONS, out);
  assert.deepEqual(out, [], 'the bridged beam passes the beam-rest audit');
  // And the rest hangs where a note would go: its near edge exactly on the
  // digit 9 phrase row it releases from.
  assert.ok(
    Math.abs(box.y1 - 158.5) < 1e-6,
    `the m. 4 rest hangs its near edge on the 158.5pt phrase row (got ${box.y1})`
  );
});

test('Bridging is the only new beam: Bach and Brahms span exactly the two qualifying 16th rests', () => {
  // A same-hand rest strictly inside a beam span can only arise from a
  // bridge (the partition splits every other hole), so scanning every span
  // pins the complete musical change — no silent re-beamings.
  const spans: string[] = [];
  for (const [score, options, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const o = resolveJankoOptions(options);
    const t = resolveJankoTokens(tokens);
    for (const l of layoutJankoScore(score, o, t)) {
      for (const b of l.beams) {
        const ticks = b.notes.map((n) => n.startTick);
        const lo = ticks[0];
        const hi = ticks[ticks.length - 1];
        const hand = b.notes[0].hand;
        for (const r of l.rests) {
          if (r.hand === hand && r.tick > lo && r.tick < hi) {
            assert.equal(r.durationTicks, 12, `${label}: only a 16th rest bridges`);
            spans.push(`${label} [${ticks.join(',')}] over t${r.tick}`);
          }
        }
      }
    }
  }
  assert.deepEqual(
    spans,
    ['Bach [528,540,564] over t552', 'Bach [3408,3420,3444] over t3432'],
    'exactly the two qualifying bridges, both intended'
  );
});

test('Bridging unit: a single 16th rest bridges; 8ths, chains and cross-beat gaps break', () => {
  const rnote = (id: string, startTick: number, durationTicks: number): JankoRhythmNote => ({
    id,
    startTick,
    durationTicks,
    hand: 'RH',
    x: startTick,
    y: 0,
  });
  const ticksOf = (partition: { groups: JankoRhythmNote[][]; ungrouped: JankoRhythmNote[] }): string =>
    `groups=${JSON.stringify(partition.groups.map((g) => g.map((n) => n.startTick)))} ungrouped=${JSON.stringify(partition.ungrouped.map((n) => n.startTick))}`;

  // The qualifying bridge: a one-16th hole with its printed rest re-joins.
  const holed = partitionBeamGroups([rnote('a', 0, 12), rnote('b', 12, 12), rnote('c', 36, 12)]);
  assert.deepEqual(
    holed.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12]],
    `the partition still splits at the hole (${ticksOf(holed)})`
  );
  const bridged = bridgeBeamGroupsAcrossRests(holed, [{ tick: 24, durationTicks: 12, hand: 'RH' }]);
  assert.deepEqual(
    bridged.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12, 36]],
    `the printed 16th rest re-joins the run (${ticksOf(bridged)})`
  );
  assert.deepEqual(bridged.ungrouped.map((n) => n.startTick), [], 'the resumption loses its flag');

  // An 8th rest never bridges, even strictly inside the beat.
  const eighth = partitionBeamGroups([rnote('a', 0, 12), rnote('c', 36, 12)]);
  const eighthBridged = bridgeBeamGroupsAcrossRests(eighth, [{ tick: 12, durationTicks: 24, hand: 'RH' }]);
  assert.deepEqual(eighthBridged.groups, [], 'the 8th rest breaks the run');
  assert.deepEqual(
    eighthBridged.ungrouped.map((n) => n.startTick),
    [0, 36],
    'both notes keep their flags'
  );

  // A rest chain never bridges: no single rest spans the boundary.
  const chained = partitionBeamGroups([rnote('a', 0, 12), rnote('c', 36, 12)]);
  const chainedBridged = bridgeBeamGroupsAcrossRests(chained, [
    { tick: 12, durationTicks: 12, hand: 'RH' },
    { tick: 24, durationTicks: 12, hand: 'RH' },
  ]);
  assert.deepEqual(chainedBridged.groups, [], 'the rest chain breaks the run');

  // A cross-beat 16th rest never bridges: the flanks share no beat window.
  const crossBeat = partitionBeamGroups([rnote('a', 36, 12), rnote('c', 60, 12)]);
  const crossBridged = bridgeBeamGroupsAcrossRests(crossBeat, [{ tick: 48, durationTicks: 12, hand: 'RH' }]);
  assert.deepEqual(crossBridged.groups, [], 'the cross-beat gap breaks the run');

  // A sounding onset strictly between the flanks refuses the bridge.
  const straddled = partitionBeamGroups([rnote('a', 0, 12), rnote('x', 12, 48), rnote('c', 24, 12)]);
  const straddledBridged = bridgeBeamGroupsAcrossRests(straddled, [{ tick: 12, durationTicks: 12, hand: 'RH' }]);
  assert.deepEqual(straddledBridged.groups, [], 'the straddled flank breaks the run');

  // Without a printed rest the partition stands exactly as partitioned.
  const untouched = bridgeBeamGroupsAcrossRests(holed, []);
  assert.deepEqual(
    untouched.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12]],
    'no rest, no bridge'
  );

  // A legato overlap is still one continuous gesture (Round 13 stands).
  const legato = partitionBeamGroups([rnote('a', 0, 24), rnote('b', 12, 12), rnote('c', 24, 12)]);
  assert.deepEqual(
    legato.groups.map((g) => g.map((n) => n.startTick)),
    [[0, 12, 24]],
    'a sounding overlap bridges without any rest'
  );
});

test('Rest-ink identity: extracted rest SVG groups are equal across both spacing presets', () => {
  for (const [score, options, tokens, label, minGroups] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach', 9],
    [REST_SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen', 4],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms', 1],
  ] as const) {
    const golden = restInkOf(score, options, tokens, 'snug');
    assert.ok(golden.length >= minGroups, `${label} writes its rests (${golden.length} groups)`);
    assert.deepEqual(
      restInkOf(score, options, tokens, 'tight'),
      golden,
      `${label}: the spacing question cannot move rest ink (tight vs snug)`
    );
  }
});

test('Bar 5 beat 2: the beam covers exactly t636/648/660 and the dotted B spans 600–636 (locked)', () => {
  const layout = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[1];
  const dotted = layout.notes.find((p) => p.note.startTick === 600 && p.rhythm.hand === 'LH')!;
  assert.equal(dotted.note.durationTicks, 36, 'the dotted B is a dotted 8th');
  assert.equal(600 + dotted.note.durationTicks, 636, 'the dotted B sounds through slot 1 (600–636)');
  const beatBeam = layout.beams.filter(
    (b) =>
      b.notes.every((n) => n.hand === 'LH') &&
      b.notes.every((n) => n.startTick >= 624 && n.startTick < 672)
  );
  assert.deepEqual(
    beatBeam.map((b) => b.notes.map((n) => n.startTick)),
    [[636, 648, 660]],
    'the LH beam covers exactly the three played slots of beat 2'
  );
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the locked beaming stays honest');
});

test('The m. 4 rest and the specimen m. 2 rest survive every spacing preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing });
    const m4 = layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS)[0].rests.filter(
      (r) => r.tick === 552
    );
    assert.equal(m4.length, 1, `${spacing}: exactly one m. 4 rest at t552`);
    assert.equal(m4[0].hand, 'RH');
    assert.equal(m4[0].value, 'sixteenth');
    const specimenRests = allRests(
      SPECIMEN,
      { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2, clusterSpacing: spacing },
      DEFAULT_JANKO_TOKENS
    );
    assert.equal(specimenRests.length, 1, `${spacing}: the specimen writes its tick-180 8th rest`);
    assert.equal(specimenRests[0].tick, 180);
    assert.equal(specimenRests[0].value, 'eighth');
  }
});

test('Rest specimen material: exactly the four standard gaps, each on a guaranteed-free column (locked)', () => {
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((v) => [v.value, v.durationTicks]),
    [
      ['sixteenth', 12],
      ['eighth', 24],
      ['quarter', 48],
      ['half', 96],
    ],
    'the four standard values, shortest first'
  );
  const options = { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 };
  const layout = layoutJankoScore(REST_SPECIMEN, options, DEFAULT_JANKO_TOKENS)[0];
  assert.equal(layout.rests.length, 4, 'exactly four rests are written');
  assert.equal(layout.unwrittenRests.length, 0, 'and none is refused');
  assert.deepEqual(
    layout.rests.map((r) => r.value),
    ['sixteenth', 'eighth', 'quarter', 'half'],
    'one rest per value, in measure order'
  );
  const r = DEFAULT_JANKO_TOKENS.noteheadRadius;
  for (const rest of layout.rests) {
    for (const p of layout.notes) {
      assert.ok(
        Math.hypot(p.x - rest.x, p.y - rest.y) >= 2 * r,
        `the ${rest.value} rest column is free of every foreign head`
      );
    }
  }
});

test('Every dialect renders every clean window with zero diagnostics and every rest clear (locked)', () => {
  for (const style of REST_STYLES) {
    const options = { ...DEFAULT_JANKO_OPTIONS, restStyle: style };
    for (const [score, base, tokens, label] of [
      [REST_SPECIMEN, { ...options, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen'],
      [
        SPECIMEN,
        { ...options, measuresPerSystem: 2 },
        DEFAULT_JANKO_TOKENS,
        'chord specimen',
      ],
      [
        BRAHMS,
        { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, restStyle: style },
        BRAHMS_OP118_NO1_JANKO_TOKENS,
        'Brahms complete',
      ],
    ] as const) {
      const report = lintJankoScore(score, base, tokens);
      assert.deepEqual(
        report.diagnostics.map((d) => `${d.code}: ${d.message}`),
        [],
        `${style} · ${label}`
      );
    }
  }
  // The real-world anchor carries a genuine rest.
  const brahmsRests = allRests(
    BRAHMS,
    BRAHMS_OP118_NO1_JANKO_OPTIONS,
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.ok(
    brahmsRests.some((r) => r.tick >= 13056 && r.tick < 13248),
    'Brahms m. 68 writes a genuine rest'
  );
});

test('The dialect material contains no same-column collision (the independence precondition, locked)', () => {
  for (const [score, options, tokens, label] of [
    [REST_SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen'],
    [SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 }, DEFAULT_JANKO_TOKENS, 'chord specimen'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms m. 68'],
  ] as const) {
    const layouts = layoutJankoScore(score, resolveJankoOptions(options), tokens);
    for (const layout of layouts) {
      const rows = new Map<string, number>();
      for (const p of layout.notes) {
        const key = `${p.note.startTick}|${p.y.toFixed(3)}`;
        rows.set(key, (rows.get(key) ?? 0) + 1);
      }
      for (const [key, count] of rows) {
        if (label === 'Brahms m. 68') {
          const tick = Number(key.split('|')[0]);
          if (tick < 13056 || tick >= 13248) continue;
        }
        assert.equal(count, 1, `${label} · ${key} carries at most one head per row`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 17. Studio: four verdict cards, every card clean
// ---------------------------------------------------------------------------

test('The live studio engraves all four verdict candidates on their own windows with shape badges', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /Round 18/);
  assert.match(html, /Rest-Shape Verdict/, 'the round title headlines the view');
  assert.ok(!html.includes('Rect Knockout + Gap Amounts'), 'the Round 17 title is retired');
  let cursor = -1;
  for (const { id, style } of VERDICT_CANDIDATES) {
    const at = html.indexOf(`data-candidate="${id}"`);
    assert.ok(at > cursor, `${id} appears in registry order`);
    cursor = at;
    const body = html.slice(at, html.indexOf('</article>', at));
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>restStyle</b> = ${style}`),
      `${id} shows its shape badge`
    );
    assert.ok(!body.includes('<b>clusterSpacing</b>'), `${id} never shows a spacing badge`);
    assert.ok(!body.includes('<b>chordGrouping</b>'), `${id} never badges the locked clasp`);
    if (style === DEFAULT_JANKO_OPTIONS.restStyle) {
      assert.ok(!body.includes('badge-delta'), 'candidate A is the incumbent: no delta styling');
    } else {
      assert.match(body, /badge-delta/, `${id} highlights its departure from golden`);
    }
    // The behavior is fixed, so every card is clean — the verdict judges
    // shapes, never defects.
    assert.match(body, /data-lint="clean"/, `${id} carries a clean lint chip`);
    assert.match(body, /chip chip-ok/, `${id} reports its clean chip`);
  }
});
