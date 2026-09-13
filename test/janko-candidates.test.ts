/**
 * Round 15 — Crowded Columns + Rest Dialects (two-axis round): registry,
 * column fixtures and dialect fixtures.
 *
 * The round carries **two independent open axes** at once:
 *
 * | # | id                       | axis            | window set                        |
 * | - | ------------------------ | --------------- | --------------------------------- |
 * | A | `stem-anchored-columns`  | `crowdedColumn` | five crime scenes + context       |
 * | B | `asymmetric-micro-columns`| `crowdedColumn`| five crime scenes + context       |
 * | C | `symmetric-spread-control`| `crowdedColumn`| five crime scenes + context (control) |
 * | A | `rest-kinetic-monoline`  | `restStyle`     | strictly clean windows            |
 * | B | `rest-classical-urtext`  | `restStyle`     | strictly clean windows            |
 * | C | `rest-geometric-node`    | `restStyle`     | strictly clean windows            |
 * | D | `rest-phantom-notehead`  | `restStyle`     | strictly clean windows            |
 *
 * Per-candidate purity is the invariant: a column candidate states only its
 * `crowdedColumn` value, a dialect candidate only its `restStyle` value, and no
 * candidate carries a locked-axis delta. The two judgments are independent by
 * construction — every dialect window renders byte-identical SVG under all
 * three column systems, because it contains no same-column collision at all.
 *
 * Committed fixtures for every finding the round fixes:
 *  1. dots always right of the head, in inter-row space (bars 5/6);
 *  2. no head leaves its beat cell (bar 12);
 *  3. no time inversion along the page (bar 15) and the disclosure bound;
 *  4. no fused opposing stems (bars 13/14);
 *  5. bar 5 beat 2 beam arithmetic (locked, unchanged);
 *  6. the m. 4 pocket rest and the specimen m. 2 rest under every candidate;
 *  7. the four-systems-per-page golden.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

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
  JANKO_CROWDED_COLUMN_POLICIES,
  JANKO_REST_STYLES,
  JankoCrowdedColumnPolicy,
  JankoRestStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import {
  CROWDED_MICRO_AIR,
  computePageGeometry,
  countJankoPages,
  layoutJankoScore,
  renderJankoCrop,
} from '../src/render/janko/engine';
import { JANKO_STEM_STAGGER, getStemGeometry } from '../src/render/janko/elements/rhythm';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const REST_SPECIMEN = buildRestDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The three column-axis candidates, in display order. */
const COLUMN_CANDIDATES: Array<{ id: string; policy: JankoCrowdedColumnPolicy; letter: string }> = [
  { id: 'stem-anchored-columns', policy: 'stem-anchored', letter: 'A' },
  { id: 'asymmetric-micro-columns', policy: 'asymmetric-micro', letter: 'B' },
  { id: 'symmetric-spread-control', policy: 'symmetric-spread', letter: 'C' },
];

/** The four dialect-axis candidates, in display order. */
const DIALECT_CANDIDATES: Array<{ id: string; style: JankoRestStyle; letter: string }> = [
  { id: 'rest-kinetic-monoline', style: 'kinetic-monoline', letter: 'A' },
  { id: 'rest-classical-urtext', style: 'classical-urtext', letter: 'B' },
  { id: 'rest-geometric-node', style: 'geometric-node', letter: 'C' },
  { id: 'rest-phantom-notehead', style: 'phantom-notehead', letter: 'D' },
];

/** The Round 15 golden equal-flank distance: `2r + 0.4pt`. */
const MICRO = 2 * DEFAULT_JANKO_TOKENS.noteheadRadius + CROWDED_MICRO_AIR;

/** The five crime scenes plus the two §4 context windows. */
const COLUMN_WINDOWS = [
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 8 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 12 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 13 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 14 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 15 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 4 },
  { scoreId: SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
];

/** The strictly clean dialect windows. */
const DIALECT_WINDOWS = [
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 1 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 3 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 4 },
  { scoreId: 'brahms-op118-no1', measureStart: 68 },
  { scoreId: SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
];

/** Layouts of one score under one crowded-column policy. */
function layoutsWith(
  score: ReturnType<typeof buildBachGoldbergVar1Score>,
  base: Parameters<typeof resolveJankoOptions>[0],
  tokens: Parameters<typeof layoutJankoScore>[2],
  policy: JankoCrowdedColumnPolicy
) {
  return layoutJankoScore(score, { ...resolveJankoOptions(base), crowdedColumn: policy }, tokens);
}

/** Every rest of one score, flattened over its systems. */
function allRests(
  score: ReturnType<typeof buildBachGoldbergVar1Score>,
  options: Parameters<typeof resolveJankoOptions>[0],
  tokens: Parameters<typeof layoutJankoScore>[2]
) {
  return layoutJankoScore(score, resolveJankoOptions(options), tokens).flatMap((l) => l.rests);
}

// ---------------------------------------------------------------------------
// 1. Registry discipline (two axes, per-candidate purity)
// ---------------------------------------------------------------------------

test('CURRENT_ROUND_METADATA opens round 15 with both independent axes', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 15);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Crowded Columns + Rest Dialects: Two Independent Axes'
  );
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['crowdedColumn', 'restStyle'],
    'the round carries exactly the two operator-approved axes'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /crowded column/i);
  assert.match(CURRENT_ROUND_METADATA.description, /rest dialect/i);
  assert.match(
    CURRENT_ROUND_METADATA.description,
    /byte-identical SVG under all three column systems/,
    'the identity guard is the stated proof of independence'
  );
});

test('CURRENT_CANDIDATES declares exactly 3 column + 4 dialect candidates, all else equal', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    [...COLUMN_CANDIDATES, ...DIALECT_CANDIDATES].map((c) => c.id),
    'column candidates first, then the dialect set, in registry order'
  );
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.equal(CURRENT_CANDIDATES.length, 7, 'seven candidates across two axes');

  assert.deepEqual(
    COLUMN_CANDIDATES.map((c) => resolveCandidate(getCandidate(c.id)!).options.crowdedColumn),
    COLUMN_CANDIDATES.map((c) => c.policy),
    'every published crowded-column policy is represented exactly once'
  );
  assert.deepEqual(
    [...new Set(COLUMN_CANDIDATES.map((c) => c.policy))].sort(),
    [...JANKO_CROWDED_COLUMN_POLICIES].sort(),
    'the registry covers the published crowded-column catalogue'
  );
  assert.deepEqual(
    DIALECT_CANDIDATES.map((c) => resolveCandidate(getCandidate(c.id)!).options.restStyle),
    DIALECT_CANDIDATES.map((c) => c.style),
    'the four Round 13 finalist dialects are represented exactly once'
  );
  for (const dialect of DIALECT_CANDIDATES) {
    assert.ok(JANKO_REST_STYLES.includes(dialect.style), `${dialect.style} stays published`);
  }

  for (const { id, letter } of [...COLUMN_CANDIDATES, ...DIALECT_CANDIDATES]) {
    const candidate = getCandidate(id)!;
    assert.ok(candidate.label.startsWith(`${letter} · `), `${id} is candidate ${letter}`);
    assert.ok((candidate.description ?? '').length > 120, `${id} carries a rationale`);
    assert.ok((candidate.tags ?? []).length > 0, `${id} is tagged`);
  }
});

test('Per-candidate purity: each candidate states only its own axis and no locked delta', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const { id, policy } of COLUMN_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.equal(candidate.axis, 'crowdedColumn', `${id} declares the column axis`);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['crowdedColumn'],
      `${id} varies the column axis and nothing else`
    );
    assert.equal(candidate.options?.crowdedColumn, policy);
    assert.equal(candidate.options?.restStyle, undefined, `${id} never reopens the dialect`);
    const options = (candidate.options ?? {}) as Record<string, unknown>;
    for (const locked of [
      'gridWritingPolicy',
      'systemStartStyle',
      'chordGrouping',
      'subdivisionStyle',
      'claspDurationStyle',
    ]) {
      assert.equal(options[locked], undefined, `${id} never states the locked ${locked}`);
    }
  }
  for (const { id, style } of DIALECT_CANDIDATES) {
    const candidate = getCandidate(id)!;
    assert.equal(candidate.axis, 'restStyle', `${id} declares the dialect axis`);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['restStyle'],
      `${id} varies the dialect axis and nothing else`
    );
    assert.equal(candidate.options?.restStyle, style);
    assert.equal(candidate.options?.crowdedColumn, undefined, `${id} never reopens the column axis`);
  }
  // The golden context every candidate inherits, unchanged.
  assert.equal(golden.crowdedColumn, 'stem-anchored', 'the settled crowded-column golden');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the incumbent dialect golden');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'grid candidate C is locked');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the flared bracket is locked');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the per-hand clasp is locked');
  assert.equal(golden.systemsPerPage, 4, 'four systems per page is locked');
});

test('Every candidate states exactly its own open-axis badge and nothing else', () => {
  for (const { id, policy } of COLUMN_CANDIDATES) {
    const badges = candidateBadges(getCandidate(id)!);
    assert.deepEqual(
      badges.map((b) => b.key),
      ['crowdedColumn'],
      `${id} badges only its own axis`
    );
    assert.equal(badges[0].value, policy);
    assert.equal(badges[0].axis, true, `${id} flags the column axis`);
  }
  for (const { id, style } of DIALECT_CANDIDATES) {
    const badges = candidateBadges(getCandidate(id)!);
    assert.deepEqual(
      badges.map((b) => b.key),
      ['restStyle'],
      `${id} badges only its own axis`
    );
    assert.equal(badges[0].value, style);
    assert.equal(badges[0].axis, true, `${id} flags the dialect axis`);
  }
});

test('Column candidates are demonstrated on the crime scenes + §4 context; dialects on clean windows', () => {
  for (const { id } of COLUMN_CANDIDATES) {
    const resolved = resolveCandidate(getCandidate(id)!);
    assert.deepEqual(
      resolved.windows.map((w) => ({ scoreId: w.scoreId, measureStart: w.measureStart })),
      COLUMN_WINDOWS,
      `${id} window set`
    );
    for (const window of resolved.windows) {
      assert.equal(window.measureCount, 1, `${id} shows one measure per window`);
      assert.ok(window.title.length > 20, `${id} titles every window`);
    }
  }
  for (const { id } of DIALECT_CANDIDATES) {
    const resolved = resolveCandidate(getCandidate(id)!);
    assert.deepEqual(
      resolved.windows.map((w) => ({ scoreId: w.scoreId, measureStart: w.measureStart })),
      DIALECT_WINDOWS,
      `${id} window set`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. The column axis: dots, cells, time order, fusion, disclosure
// ---------------------------------------------------------------------------

test('Golden master: 4 systems per page, 2 pages, lint 0/0 — and every column policy is real geometry', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(geo.systemsPerPage, 4);
  assert.equal(geo.systems.length, 4);
  assert.equal(countJankoPages(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS), 2);
  const golden = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(golden.ok, true, 'the golden page is clean');
  assert.equal(golden.warnings.length, 0, 'with zero warnings');
  assert.equal(golden.stats.systems, 8, '32 bars in 8 systems');

  for (const { policy } of COLUMN_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, crowdedColumn: policy });
    const svg = renderJankoCrop(SCORE, 8, 1, o, DEFAULT_JANKO_TOKENS);
    assert.ok((svg.match(/class="janko-digit"/g) ?? []).length > 10, `${policy} engraves m. 8`);
  }
  // The three policies are distinct engravings on the crime-scene window.
  const docs = new Set(
    COLUMN_CANDIDATES.map(({ policy }) =>
      renderJankoCrop(
        SCORE,
        8,
        1,
        resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, crowdedColumn: policy }),
        DEFAULT_JANKO_TOKENS
      ).replace(/ data-[a-z-]+="[^"]*"/g, '')
    )
  );
  assert.equal(docs.size, 3, 'A, B and C each engrave a different m. 8');
});

test('Dots (bars 5/6): always right of the head, in inter-row space, clear of every disc and rule', () => {
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const notes = layouts.flatMap((l) => l.notes);
  const r = DEFAULT_JANKO_TOKENS.noteheadRadius;
  const dotR = DEFAULT_JANKO_TOKENS.augmentationDotRadius;

  // Bar 6: the LH dotted 0 at t744 — exactly one dot, right of its own head.
  const m6 = notes.filter((p) => p.note.startTick === 744 && p.note.durationTicks > 26);
  assert.equal(m6.length, 1, 'exactly one dotted value at t744 (the LH 0)');
  const dotted = m6[0];
  const dotX = dotted.x + r + DEFAULT_JANKO_TOKENS.augmentationDotGap;
  const dotY = dotted.rhythm.dotY ?? dotted.y;
  assert.ok(dotX > dotted.x, 'the dot is right of the head');
  assert.ok(
    Math.abs(Math.abs(dotY - dotted.y) - DEFAULT_JANKO_TOKENS.augmentationDotRowOffset) < 1e-9,
    'the dot lives half a row off its own row'
  );
  let nearest = Infinity;
  for (const q of notes) nearest = Math.min(nearest, Math.hypot(dotX - q.x, dotY - q.y));
  assert.ok(nearest >= r + dotR, `the t744 dot clears every disc (nearest ${nearest.toFixed(2)}pt)`);
  assert.equal(
    notes.filter((q) => q.note.startTick === 720 && q.note.durationTicks > 26).length,
    0,
    'the plain t720 0 carries no dot to confuse it with'
  );

  // Bar 5: the LH dotted B at t600 clears the innocent RH 9 at t588.
  const m5 = notes.find((p) => p.note.startTick === 600 && p.note.durationTicks > 26)!;
  const innocent = notes.find((p) => p.note.startTick === 588)!;
  const m5X = m5.x + r + DEFAULT_JANKO_TOKENS.augmentationDotGap;
  const m5Y = m5.rhythm.dotY ?? m5.y;
  assert.ok(
    Math.hypot(m5X - innocent.x, m5Y - innocent.y) >= r + dotR,
    'the t600 dot cannot be misread as belonging to the t588 head'
  );
  assert.ok(
    Math.abs(m5X - (m5.x + r + DEFAULT_JANKO_TOKENS.augmentationDotGap)) < 1e-9,
    'the dot attaches only to its own t600 head'
  );

  // No dot anywhere in the golden touches a disc, a rule or a grid line.
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(
    report.diagnostics.filter((d) => d.code === 'dot-collision').length,
    0,
    'the dot-clearance audit is part of the golden lint'
  );

  // Paint-level fixture: the document carries exactly the computed dots, each
  // right of its own head — a regression to the hand-mirrored LH dot (left of
  // the head) would change these cx values.
  const crop = renderJankoCrop(SCORE, 6, 1, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const painted = [
    ...crop.matchAll(/class="janko-augmentation-dot" cx="([\d.]+)" cy="([\d.]+)"/g),
  ].map((m) => ({ cx: Number(m[1]), cy: Number(m[2]) }));
  const m6Dotted = layouts
    .flatMap((l) => l.notes)
    .filter(
      (p) =>
        p.note.startTick >= 720 &&
        p.note.startTick < 864 &&
        p.note.durationTicks > 26 &&
        p.note.durationTicks <= 38
    );
  assert.ok(
    painted.length >= m6Dotted.length,
    'every dotted value of the system paints its dot (the crop clips one measure)'
  );
  for (const p of m6Dotted) {
    const cx = p.x + r + DEFAULT_JANKO_TOKENS.augmentationDotGap;
    const cy = p.rhythm.dotY ?? p.y;
    assert.ok(
      painted.some((d) => Math.abs(d.cx - cx) < 0.01 && Math.abs(d.cy - cy) < 0.01),
      `${p.note.id} paints its dot at (${cx.toFixed(2)}, ${cy.toFixed(2)})`
    );
    assert.ok(
      !painted.some((d) => Math.abs(d.cx - (p.x - r - DEFAULT_JANKO_TOKENS.augmentationDotGap)) < 0.01),
      `${p.note.id} paints no mirrored left-side dot`
    );
  }
});

test('Bar 12: no displaced head crosses a beat pulse or barline (grid-crossing-offset)', () => {
  for (const { policy } of COLUMN_CANDIDATES.filter((c) => c.policy !== 'symmetric-spread')) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, crowdedColumn: policy });
    const layout = layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS)[2];
    const pair = layout.notes.filter((p) => p.note.startTick === 1632);
    assert.equal(pair.length, 2, 'the bar-12 beat column carries the LH 7 and the RH 9');
    for (const p of pair) {
      assert.ok(p.beatCell, 'every head records its beat cell');
      assert.ok(
        p.x >= p.beatCell!.left - 1e-9 && p.x <= p.beatCell!.right + 1e-9,
        `${policy}: ${p.note.id} stays inside [${p.beatCell!.left.toFixed(2)}, ${p.beatCell!.right.toFixed(2)}]`
      );
      assert.ok(p.x >= p.beatCell!.left - 1e-9, `${policy}: no head left of the beat-2 pulse`);
    }
    const report = lintJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS);
    assert.equal(report.ok, true, `${policy} lints clean`);
    assert.equal(report.warnings.length, 0, `${policy} adds no warning`);
  }

  // The control is the honest baseline: it *does* push a head across the pulse.
  const control = lintJankoScore(
    SCORE,
    { ...DEFAULT_JANKO_OPTIONS, crowdedColumn: 'symmetric-spread' },
    DEFAULT_JANKO_TOKENS
  );
  assert.ok(
    control.diagnostics.some((d) => d.code === 'grid-crossing-offset' && d.measure === 12),
    'the control trips grid-crossing-offset on m. 12'
  );
});

test('Bar 15: page order matches tick order, and the colliding pair discloses less than the control', () => {
  for (const { policy } of COLUMN_CANDIDATES.filter((c) => c.policy !== 'symmetric-spread')) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, crowdedColumn: policy });
    const layout = layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS)[3];
    const inBar = layout.notes.filter((p) => {
      const tickInMeasure = (p.note.startTick - 2016) % 144;
      return p.note.startTick >= 2016 && p.note.startTick < 2160 && tickInMeasure < 144;
    });
    const byTick = new Map<number, { min: number; max: number }>();
    for (const p of inBar) {
      const bucket = byTick.get(p.note.startTick);
      if (bucket) {
        bucket.min = Math.min(bucket.min, p.x);
        bucket.max = Math.max(bucket.max, p.x);
      } else {
        byTick.set(p.note.startTick, { min: p.x, max: p.x });
      }
    }
    const ticks = [...byTick.keys()].sort((a, b) => a - b);
    for (let i = 1; i < ticks.length; i++) {
      const before = byTick.get(ticks[i - 1])!;
      const after = byTick.get(ticks[i])!;
      assert.ok(
        before.max <= after.min + 1e-9,
        `${policy}: t${ticks[i - 1]} stays left of t${ticks[i]} (${before.max.toFixed(2)} vs ${after.min.toFixed(2)})`
      );
    }
  }

  // Disclosure bound: the colliding pair of t2064 discloses MICRO, not the
  // Round 14 control's full chordal offset.
  const goldenPair = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[3].notes
    .filter((p) => p.note.startTick === 2064)
    .map((p) => p.x)
    .sort((a, b) => a - b);
  assert.equal(goldenPair.length, 2);
  assert.ok(
    Math.abs(goldenPair[1] - goldenPair[0] - MICRO) < 1e-9,
    `the golden pair discloses ${MICRO}pt (got ${(goldenPair[1] - goldenPair[0]).toFixed(2)})`
  );
  const control = layoutJankoScore(
    SCORE,
    { ...DEFAULT_JANKO_OPTIONS, crowdedColumn: 'symmetric-spread' },
    DEFAULT_JANKO_TOKENS
  );
  const controlPair = control[3].notes
    .filter((p) => p.note.startTick === 2064)
    .map((p) => p.x)
    .sort((a, b) => a - b);
  assert.ok(
    controlPair[1] - controlPair[0] > goldenPair[1] - goldenPair[0],
    'the control still discloses the full symmetric 11pt'
  );
  // The Round 14 inversion, restated as a fixture: the control puts the t2064
  // LH head left of the t2052 head.
  const control2052 = control[3].notes.find((p) => p.note.startTick === 2052)!;
  assert.ok(
    controlPair[0] < control2052.x,
    'the control inverts time on the page — the defect the round removes'
  );
});

test('Bars 13/14: no fused opposing stems; the spot-check columns stay separated', () => {
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  for (const layout of layouts) {
    const group = layout.notes.filter((p) => [1752, 1896, 1944].includes(p.note.startTick));
    for (const p of group) {
      const stem = getStemGeometry(p.rhythm, DEFAULT_JANKO_TOKENS);
      const declared = p.rhythm.stemDx ?? 0;
      assert.ok(
        Math.abs(declared) <= JANKO_STEM_STAGGER + 1e-9,
        `${p.note.id} staggers only by the documented delta`
      );
      assert.equal(stem.stemX, p.x + declared, `${p.note.id} stem column is declared`);
    }
  }
  // The m. 13 t1752 column: the RH and LH stems are two rules, not one.
  const m13 = layouts[3].notes.filter((p) => p.note.startTick === 1752);
  assert.equal(m13.length, 2, 't1752 carries the fused-stem pair');
  const [a, b] = m13.map((p) => getStemGeometry(p.rhythm, DEFAULT_JANKO_TOKENS));
  assert.ok(Math.abs(a.stemX - b.stemX) >= 2 * JANKO_STEM_STAGGER - 1e-9, 'the stems separate');
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(
    report.diagnostics.filter((d) => d.code === 'stem-fusion').length,
    0,
    'no stem-fusion violation on the golden page'
  );
  const control = lintJankoScore(
    SCORE,
    { ...DEFAULT_JANKO_OPTIONS, crowdedColumn: 'symmetric-spread' },
    DEFAULT_JANKO_TOKENS
  );
  assert.ok(
    control.diagnostics.filter((d) => d.code === 'stem-fusion' && (d.measure ?? 0) >= 13).length >= 4,
    'the control trips stem-fusion on the bars 13/14 columns'
  );
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

test('§4 regression: the m. 4 pocket rest and the specimen m. 2 8th rest survive every column candidate', () => {
  for (const { policy } of COLUMN_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, crowdedColumn: policy });
    const m4 = layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS)[0].rests.filter(
      (r) => r.tick === 552
    );
    assert.equal(m4.length, 1, `${policy}: exactly one m. 4 rest at t552`);
    assert.equal(m4[0].hand, 'RH');
    assert.equal(m4[0].value, 'sixteenth');
    assert.ok(
      !layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS)[0].unwrittenRests.some((r) => r.tick === 552),
      `${policy}: the m. 4 rest is written, never refused`
    );
    const specimenRests = allRests(
      SPECIMEN,
      { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2, crowdedColumn: policy },
      DEFAULT_JANKO_TOKENS
    );
    assert.equal(specimenRests.length, 1, `${policy}: the specimen writes its tick-180 8th rest`);
    assert.equal(specimenRests[0].tick, 180);
    assert.equal(specimenRests[0].value, 'eighth');
  }
});

// ---------------------------------------------------------------------------
// 3. The dialect axis: clean windows, four values, identity guard
// ---------------------------------------------------------------------------

test('Rest specimen material: exactly the four standard gaps, each on a guaranteed-free column', () => {
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

test('Every dialect renders every clean window with zero diagnostics and every rest clear', () => {
  for (const { style } of DIALECT_CANDIDATES) {
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

test('Cross-system identity: every dialect window is byte-identical under all three column systems', () => {
  for (const { id, style } of DIALECT_CANDIDATES) {
    const resolved = resolveCandidate(getCandidate(id)!);
    for (const window of resolved.windows) {
      // Only the dialect axis varies; every other option is the window score's
      // own bespoke notation (the Brahms benchmark keeps its 3 × 3 layout).
      const entry =
        window.scoreId === REST_SPECIMEN_STUDIO_SCORE_ID
          ? {
              score: REST_SPECIMEN,
              options: { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4, restStyle: style },
              tokens: resolved.tokens,
            }
          : window.scoreId === SPECIMEN_STUDIO_SCORE_ID
            ? {
                score: SPECIMEN,
                options: { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2, restStyle: style },
                tokens: resolved.tokens,
              }
            : {
                score: BRAHMS,
                options: { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, restStyle: style },
                tokens: BRAHMS_OP118_NO1_JANKO_TOKENS,
              };
      const documents = JANKO_CROWDED_COLUMN_POLICIES.map((policy) =>
        renderJankoCrop(
          entry.score,
          window.measureStart,
          window.measureCount,
          resolveJankoOptions({ ...entry.options, crowdedColumn: policy }),
          entry.tokens
        ).replace(/ data-[a-z-]+="[^"]*"/g, '')
      );
      assert.equal(
        new Set(documents).size,
        1,
        `${id} · ${window.scoreId} m. ${window.measureStart} is column-system invariant`
      );
    }
  }
});

test('The dialect material contains no same-column collision (the independence precondition)', () => {
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
// 4. The live studio
// ---------------------------------------------------------------------------

test('The live studio engraves all 7 candidates on their own windows with per-axis badges', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 7, 'seven cards');
  assert.match(html, /data-candidate-count="7"/);
  assert.match(html, /Round 15/);
  assert.match(html, /Crowded Columns \+ Rest Dialects/, 'the round title headlines the view');
  assert.ok(!html.includes('Grid Writing Policy:'), 'the Round 14 title is retired');
  let cursor = -1;
  for (const { id, policy } of COLUMN_CANDIDATES) {
    const at = html.indexOf(`data-candidate="${id}"`);
    assert.ok(at > cursor, `${id} appears in registry order`);
    cursor = at;
    const body = html.slice(at, html.indexOf('</article>', at));
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>crowdedColumn</b> = ${policy}`),
      `${id} shows its column badge`
    );
    assert.ok(!body.includes('<b>restStyle</b>'), `${id} never shows a dialect badge`);
    assert.ok(!body.includes('<b>chordGrouping</b>'), `${id} never badges the locked clasp`);
    if (policy === DEFAULT_JANKO_OPTIONS.crowdedColumn) {
      assert.ok(!body.includes('badge-delta'), 'candidate A is the incumbent: no delta styling');
    } else {
      assert.match(body, /badge-delta/, `${id} highlights its departure from golden`);
    }
    if (policy === 'symmetric-spread') {
      assert.match(body, /chip chip-error/, 'the control shows the defects it exists to demonstrate');
      assert.match(body, /data-lint="violations"/);
    } else {
      assert.match(body, /chip chip-ok/, `${id} lints clean`);
      assert.match(body, /data-lint="clean"/);
    }
  }
  for (const { id, style } of DIALECT_CANDIDATES) {
    const at = html.indexOf(`data-candidate="${id}"`);
    assert.ok(at > cursor, `${id} appears after the column set`);
    cursor = at;
    const body = html.slice(at, html.indexOf('</article>', at));
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>restStyle</b> = ${style}`),
      `${id} shows its dialect badge`
    );
    assert.ok(!body.includes('<b>crowdedColumn</b>'), `${id} never shows a column badge`);
    assert.match(body, /chip chip-ok/, `${id} lints clean on its clean windows`);
  }
});
