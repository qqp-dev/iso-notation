/**
 * Round 17A — Rect Knockout + Spacing Solver v2 + Dot Hug: registry, gap
 * fixtures, solver fixtures, dot fixtures and rest-ink identity.
 *
 * Single judged axis — the gap amount:
 *
 * | # | id               | `clusterSpacing` | window set                    |
 * | - | ---------------- | ---------------- | ----------------------------- |
 * | A | `spacing-snug`   | `snug` (golden)  | the carried cluster windows   |
 * | B | `spacing-tight`  | `tight`          | the carried cluster windows   |
 *
 * Everything else goes direct: the sharp rectangular mask, the v2 solver
 * (unit centering, pin-preserving shrink, local redistribution, multi-row
 * interleave) and the hugging dots. Rest behaviour is explicitly out —
 * rests, beams and the m4 beam-break stay exactly Round 16, so every rest
 * SVG group is identical under both spacing presets (and byte-identical to
 * the Round 16 golden, verified at implementation time).
 *
 * Committed fixtures for every directive the round fixes:
 *  1. the preset table (margin / air / pair gap / wx / hy) and the gap
 *     identity G = 2(1.93 + m) + air, pinned per preset;
 *  2. the rect paint pin: every mask a sharp rect with the preset wx/hy,
 *     every digit 5.8pt;
 *  3. pair spans (G ±0.1), triple spans (2G ±0.2), beat-cell containment and
 *     time order — every preset, every ticketed tick;
 *  4. unit centering (t1032 free-space symmetry ≤1.5pt);
 *  5. the pin (m12: the 9 holds ±0.3, gap = min(G, room)) plus a synthetic
 *     shrink proof;
 *  6. redistribution (t2052..t2076 gap spread ≤2.0);
 *  7. interleave (t1392 row offset G/2 ±0.2, one shared stem) and the t1584
 *     triple;
 *  8. the mixed t1752 stack: one stem-x, both beams, each drawn once;
 *  9. synthetic same-duration stacks: one painted stem;
 * 10. zero split-stack-stems golden-wide, plus the defect;
 * 11. dots hug the mask corner (offsets, clearance proof, uniform sign) and
 *     bar 6 attaches only to t744;
 * 12. the digit inside the rect for all 12 glyphs, every preset evaluated;
 * 13. rest size maxima, rule-hang and rest-ink identity (Round 16 behaviour,
 *     untouched);
 * 14. bar 5 beat 2 beam arithmetic (locked, unchanged);
 * 15. the four-systems-per-page golden.
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
} from '../src/render/janko/engine';
import { getEquatorRuleYs } from '../src/render/janko/elements/staff';
import { getEquatorYForOctave } from '../src/render/janko/geometry';
import { digitHalfExtents } from '../src/render/janko/elements/notehead';
import { getStemGeometry } from '../src/render/janko/elements/rhythm';
import { restInkBox } from '../src/render/janko/elements/rests';
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  checkKnockoutCoverage,
  checkSplitStackStems,
  lintJankoScore,
} from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const REST_SPECIMEN = buildRestDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The two spacing candidates, in display order. */
const SPACING_CANDIDATES: Array<{ id: string; spacing: JankoClusterSpacing; letter: string }> = [
  { id: 'spacing-snug', spacing: 'snug', letter: 'A' },
  { id: 'spacing-tight', spacing: 'tight', letter: 'B' },
];

/** The four rest dialects whose Round 16 behaviour stays untouched. */
const REST_STYLES: JankoRestStyle[] = [
  'kinetic-monoline',
  'classical-urtext',
  'geometric-node',
  'phantom-notehead',
];

/** The carried cluster windows: real 2- and 3-note clusters in real music. */
const SPACING_WINDOWS = [
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 8 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 12 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 15 },
  { scoreId: BRAHMS_STUDIO_SCORE_ID, measureStart: 8 },
  { scoreId: BRAHMS_STUDIO_SCORE_ID, measureStart: 9 },
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

test('CURRENT_ROUND_METADATA opens round 17 with the single gap-amount axis', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 17);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Rect Knockout + Gap Amounts: Snug −30% vs Tight −35%'
  );
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['clusterSpacing'],
    'the round carries exactly the operator-approved axis'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /rectangular knockout/i);
  assert.match(CURRENT_ROUND_METADATA.description, /gap amount/i);
  assert.match(
    CURRENT_ROUND_METADATA.description,
    /cannot move rest ink/,
    'the independence proof is stated'
  );
});

test('CURRENT_CANDIDATES declares exactly the snug golden and the tight challenger', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    SPACING_CANDIDATES.map((c) => c.id),
    'golden first, then the challenger, in registry order'
  );
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.equal(CURRENT_CANDIDATES.length, 2, 'two candidates on one axis');

  assert.deepEqual(
    SPACING_CANDIDATES.map((c) => resolveCandidate(getCandidate(c.id)!).options.clusterSpacing),
    SPACING_CANDIDATES.map((c) => c.spacing),
    'every published spacing preset is represented exactly once'
  );
  assert.deepEqual(
    [...new Set(SPACING_CANDIDATES.map((c) => c.spacing))].sort(),
    [...JANKO_CLUSTER_SPACINGS].sort(),
    'the registry covers the published spacing catalogue'
  );

  for (const { id, letter } of SPACING_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.ok(candidate.label.startsWith(`${letter} · `), `${id} is candidate ${letter}`);
    assert.ok((candidate.description ?? '').length > 120, `${id} carries a rationale`);
    assert.ok((candidate.tags ?? []).length > 0, `${id} is tagged`);
  }
});

test('Per-candidate purity: each candidate states only the spacing axis and no locked delta', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const { id, spacing } of SPACING_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.equal(candidate.axis, 'clusterSpacing', `${id} declares the spacing axis`);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['clusterSpacing'],
      `${id} varies the spacing axis and nothing else`
    );
    assert.equal(candidate.options?.clusterSpacing, spacing);
    const options = (candidate.options ?? {}) as Record<string, unknown>;
    for (const locked of [
      'restStyle',
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
  assert.equal(golden.clusterSpacing, 'snug', 'the recommended spacing golden');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the incumbent dialect golden');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'grid candidate C is locked');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the flared bracket is locked');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the per-hand clasp is locked');
  assert.equal(golden.systemsPerPage, 4, 'four systems per page is locked');
});

test('Every candidate states exactly its open-axis badge and nothing else', () => {
  for (const { id, spacing } of SPACING_CANDIDATES) {
    const badges = candidateBadges(getCandidate(id)!);
    assert.deepEqual(
      badges.map((b) => b.key),
      ['clusterSpacing'],
      `${id} badges only its own axis`
    );
    assert.equal(badges[0].value, spacing);
    assert.equal(badges[0].axis, true, `${id} flags the spacing axis`);
  }
  // Departures from golden: the tight challenger alone.
  const departures = CURRENT_CANDIDATES.flatMap((c) =>
    candidateBadges(c).filter((b) => b.value !== b.golden)
  );
  assert.equal(departures.length, 1, 'one spacing departure');
  assert.equal(departures[0].value, 'tight');
});

test('Both candidates share the carried cluster windows', () => {
  for (const { id } of SPACING_CANDIDATES) {
    const resolved = resolveCandidate(getCandidate(id)!);
    assert.deepEqual(
      resolved.windows.map((w) => ({ scoreId: w.scoreId, measureStart: w.measureStart })),
      SPACING_WINDOWS,
      `${id} window set`
    );
    for (const window of resolved.windows) {
      assert.equal(window.measureCount, 1, `${id} shows one measure per window`);
      assert.ok(window.title.length > 20, `${id} titles every window`);
    }
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

test('Snug passes every gate; tight is reported through the real engine (trippable)', () => {
  const snug = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    clusterSpacing: 'snug',
  });
  const report = lintJankoScore(SCORE, snug, DEFAULT_JANKO_TOKENS);
  assert.equal(report.violations.length, 0, 'snug: zero violations on Bach');
  assert.equal(report.warnings.length, 0, 'snug: zero warnings on Bach');
  const brahms = lintJankoScore(
    BRAHMS,
    resolveJankoOptions({
      ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      clusterSpacing: 'snug',
    }),
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.equal(brahms.violations.length, 0, 'snug: zero violations on Brahms');
  assert.equal(brahms.warnings.length, 0, 'snug: zero warnings on Brahms');
  // Tight is REPORTED, not gated: its lint chip carries whatever the engine
  // finds, and a trip is judging input, not failure. The suite pins only that
  // the report runs on both scores — never its counts.
  const tightCases = [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const;
  for (const [score, base, tokens, label] of tightCases) {
    const tight = lintJankoScore(
      score,
      { ...base, clusterSpacing: 'tight' },
      tokens
    );
    assert.equal(typeof tight.ok, 'boolean', `tight ${label}: the report runs`);
    assert.ok(
      Array.isArray(tight.violations) && Array.isArray(tight.warnings),
      `tight ${label}: the report carries violation and warning counts`
    );
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
  const options = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 3 });
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
  const G = getClusterSpacingPreset('snug').pairGap;
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
// 16. Rests: Round 16 behaviour, untouched (locked, verbatim)
// ---------------------------------------------------------------------------

test('Rest size maxima: pinned per value over the four carried dialects (locked)', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const expected: Record<string, { w: number; h: number }> = {
    sixteenth: { w: 4.83, h: 7.3025 },
    eighth: { w: 4.83, h: 7.3025 },
    quarter: { w: 3.91, h: 6.9 },
    half: { w: 4.5425, h: 5.06 },
  };
  for (const [value, max] of Object.entries(expected)) {
    let w = 0;
    let h = 0;
    for (const style of REST_STYLES) {
      const box = restInkBox(
        { tick: 0, durationTicks: 0, hand: 'RH', x: 0, y: 0, value: value as 'quarter', style },
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
});

test('Rule-hang: m. 4, the specimens and Brahms m. 68 hang on-rule, corridor-side, clear — every dialect (locked)', () => {
  const cases = [
    {
      label: 'Bach m. 4',
      score: SCORE,
      options: DEFAULT_JANKO_OPTIONS,
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [552],
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
        // On-rule: one glyph edge sits exactly on a staff rule of the lattice
        // (staff octaves plus ledger registers) — the hang.
        const rules: number[] = [];
        for (let octave = 0; octave <= 8; octave++) {
          const base = layout!.geometry.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
          rules.push(...getEquatorRuleYs(base, o, t));
        }
        let ruleY = rules[0];
        let ruleDistance = Infinity;
        for (const edge of [box.y0, box.y1]) {
          for (const candidate of rules) {
            const distance = Math.abs(edge - candidate);
            if (distance < ruleDistance) {
              ruleDistance = distance;
              ruleY = candidate;
            }
          }
        }
        assert.ok(
          ruleDistance < 0.01,
          `${style} · ${c.label} t${tick}: a glyph edge hangs on a rule (off by ${ruleDistance.toFixed(3)})`
        );
        // Corridor-side: the glyph extends from its rule toward Middle C.
        const toCorridor = layout!.geometry.middleCY - ruleY;
        const extendsTo = (box.y0 + box.y1) / 2 - ruleY;
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
        report.diagnostics.filter((d) => d.code === 'rest-collision' || d.code === 'rest-unwritable').length,
        0,
        `${style} · ${c.label}: no rest diagnostic`
      );
    }
  }
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
// 17. Studio: two cards, snug clean, tight reported
// ---------------------------------------------------------------------------

test('The live studio engraves both candidates on their own windows with spacing badges', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 2, 'two cards');
  assert.match(html, /data-candidate-count="2"/);
  assert.match(html, /Round 17/);
  assert.match(html, /Rect Knockout \+ Gap Amounts/, 'the round title headlines the view');
  assert.ok(!html.includes('Cluster Spacing + Rest Dialects'), 'the Round 16 title is retired');
  let cursor = -1;
  for (const { id, spacing } of SPACING_CANDIDATES) {
    const at = html.indexOf(`data-candidate="${id}"`);
    assert.ok(at > cursor, `${id} appears in registry order`);
    cursor = at;
    const body = html.slice(at, html.indexOf('</article>', at));
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>clusterSpacing</b> = ${spacing}`),
      `${id} shows its spacing badge`
    );
    assert.ok(!body.includes('<b>restStyle</b>'), `${id} never shows a dialect badge`);
    assert.ok(!body.includes('<b>chordGrouping</b>'), `${id} never badges the locked clasp`);
    if (spacing === DEFAULT_JANKO_OPTIONS.clusterSpacing) {
      assert.ok(!body.includes('badge-delta'), 'candidate A is the incumbent: no delta styling');
    } else {
      assert.match(body, /badge-delta/, `${id} highlights its departure from golden`);
    }
    // Snug is clean; tight is reported through its chip — a trip would be
    // judging input, not failure.
    assert.match(body, /chip chip-(ok|error)/, `${id} reports its lint verdict`);
    assert.match(body, /data-lint="(clean|violations)"/, `${id} carries a lint chip`);
    if (spacing === 'snug') {
      assert.match(body, /data-lint="clean"/, 'snug is clean');
    }
  }
});
