/**
 * Round 16 — Cluster Doctrine (Shared Stems Direct) + Horizontal-Spacing
 * Candidates + Dots + Rests (two-axis round): registry, spacing fixtures,
 * shared-stem fixtures, dot fixtures and rest fixtures.
 *
 * The round carries **two independent open axes** at once:
 *
 * | # | id                       | axis             | window set                        |
 * | - | ------------------------ | ---------------- | --------------------------------- |
 * | A | `spacing-compact`        | `clusterSpacing` | real 2- and 3-note clusters     |
 * | B | `spacing-balanced`       | `clusterSpacing` | real 2- and 3-note clusters     |
 * | C | `spacing-airy`           | `clusterSpacing` | real 2- and 3-note clusters     |
 * | A | `rest-kinetic-monoline`  | `restStyle`      | strictly clean windows (carried)  |
 * | B | `rest-classical-urtext`  | `restStyle`      | strictly clean windows (carried)  |
 * | C | `rest-geometric-node`    | `restStyle`      | strictly clean windows (carried)  |
 * | D | `rest-phantom-notehead`  | `restStyle`      | strictly clean windows (carried)  |
 *
 * Per-candidate purity is the invariant: a spacing candidate states only its
 * `clusterSpacing` value, a dialect candidate only its `restStyle` value, and no
 * candidate carries a locked-axis delta. The two judgments are independent by
 * construction — the spacing question cannot move rest ink, so every rest SVG
 * group is identical under all three spacing presets.
 *
 * Committed fixtures for every directive the round fixes:
 *  1. the preset table (rx / air / pair gap) and the rx + ry + digit paint pin;
 *  2. pair spans, beat-cell containment and time order under every preset;
 *  3. the Brahms triples: span plus one shared stem each;
 *  4. the mixed t1752 stack: one stem-x, both beams, each drawn once;
 *  5. synthetic same-duration stacks: one painted stem;
 *  6. zero split-stack-stems golden-wide, plus the defect;
 *  7. dots always above, tight to the mask, bar 6 attaching only to t744;
 *  8. the digit inside the knockout for all 12 glyphs, every preset evaluated;
 *  9. rest size maxima per value over the four carried dialects;
 * 10. rule-hung rests, corridor-side, on m. 4, the specimens and Brahms m. 68;
 * 11. rest-ink identity across spacing (replaces the Round 15 byte-identity
 *     guard, retired with `crowdedColumn`);
 * 12. bar 5 beat 2 beam arithmetic (locked, unchanged);
 * 13. the four-systems-per-page golden.
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
  JANKO_REST_STYLES,
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

/** The three spacing-axis candidates, in display order. */
const SPACING_CANDIDATES: Array<{ id: string; spacing: JankoClusterSpacing; letter: string }> = [
  { id: 'spacing-compact', spacing: 'compact', letter: 'A' },
  { id: 'spacing-balanced', spacing: 'balanced', letter: 'B' },
  { id: 'spacing-airy', spacing: 'airy', letter: 'C' },
];

/** The four dialect-axis candidates, in display order. */
const DIALECT_CANDIDATES: Array<{ id: string; style: JankoRestStyle; letter: string }> = [
  { id: 'rest-kinetic-monoline', style: 'kinetic-monoline', letter: 'A' },
  { id: 'rest-classical-urtext', style: 'classical-urtext', letter: 'B' },
  { id: 'rest-geometric-node', style: 'geometric-node', letter: 'C' },
  { id: 'rest-phantom-notehead', style: 'phantom-notehead', letter: 'D' },
];

/** The Round 16 spacing windows: real 2- and 3-note clusters in real music. */
const SPACING_WINDOWS = [
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 8 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 12 },
  { scoreId: DEFAULT_STUDIO_SCORE_ID, measureStart: 15 },
  { scoreId: BRAHMS_STUDIO_SCORE_ID, measureStart: 8 },
  { scoreId: BRAHMS_STUDIO_SCORE_ID, measureStart: 9 },
];

/** The strictly clean dialect windows, carried byte-identical from Round 15. */
const DIALECT_WINDOWS = [
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 1 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 3 },
  { scoreId: REST_SPECIMEN_STUDIO_SCORE_ID, measureStart: 4 },
  { scoreId: 'brahms-op118-no1', measureStart: 68 },
  { scoreId: SPECIMEN_STUDIO_SCORE_ID, measureStart: 2 },
];

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
// 1. Registry discipline (two axes, per-candidate purity)
// ---------------------------------------------------------------------------

test('CURRENT_ROUND_METADATA opens round 16 with both independent axes', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 16);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Cluster Spacing + Rest Dialects: Two Independent Axes'
  );
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['clusterSpacing', 'restStyle'],
    'the round carries exactly the two operator-approved axes'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /shared stem/i);
  assert.match(CURRENT_ROUND_METADATA.description, /spacing amount/i);
  assert.match(CURRENT_ROUND_METADATA.description, /rest dialect/i);
  assert.match(
    CURRENT_ROUND_METADATA.description,
    /cannot move rest ink/,
    'the independence proof is stated'
  );
});

test('CURRENT_CANDIDATES declares exactly 3 spacing + 4 dialect candidates, all else equal', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    [...SPACING_CANDIDATES, ...DIALECT_CANDIDATES].map((c) => c.id),
    'spacing candidates first, then the dialect set, in registry order'
  );
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.equal(CURRENT_CANDIDATES.length, 7, 'seven candidates across two axes');

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
  assert.deepEqual(
    DIALECT_CANDIDATES.map((c) => resolveCandidate(getCandidate(c.id)!).options.restStyle),
    DIALECT_CANDIDATES.map((c) => c.style),
    'the four Round 13 finalist dialects are represented exactly once'
  );
  for (const dialect of DIALECT_CANDIDATES) {
    assert.ok(JANKO_REST_STYLES.includes(dialect.style), `${dialect.style} stays published`);
  }

  for (const { id, letter } of [...SPACING_CANDIDATES, ...DIALECT_CANDIDATES]) {
    const candidate = getCandidate(id)!;
    assert.ok(candidate.label.startsWith(`${letter} · `), `${id} is candidate ${letter}`);
    assert.ok((candidate.description ?? '').length > 120, `${id} carries a rationale`);
    assert.ok((candidate.tags ?? []).length > 0, `${id} is tagged`);
  }
});

test('Per-candidate purity: each candidate states only its own axis and no locked delta', () => {
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
    assert.equal(candidate.tokens, undefined, `${id} carries no token delta`);
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
    assert.equal(candidate.options?.clusterSpacing, undefined, `${id} never reopens the spacing axis`);
    assert.equal(candidate.tokens, undefined, `${id} carries no token delta`);
  }
  // The golden context every candidate inherits, unchanged.
  assert.equal(golden.clusterSpacing, 'balanced', 'the agreed spacing golden');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the incumbent dialect golden');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'grid candidate C is locked');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the flared bracket is locked');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the per-hand clasp is locked');
  assert.equal(golden.systemsPerPage, 4, 'four systems per page is locked');
});

test('Every candidate states exactly its own open-axis badge and nothing else', () => {
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
  // Departures from golden: compact + airy on the spacing axis, the three
  // non-incumbent dialects on the dialect axis.
  const departures = CURRENT_CANDIDATES.flatMap((c) =>
    candidateBadges(c).filter((b) => b.value !== b.golden)
  );
  assert.equal(departures.length, 5, 'two spacing departures plus three dialect departures');
});

test('Spacing candidates share the cluster windows; dialects share the clean windows', () => {
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
  const dialectSets = DIALECT_CANDIDATES.map((d) =>
    resolveCandidate(getCandidate(d.id)!).windows.map((w) => ({ ...w }))
  );
  for (const [i, set] of dialectSets.entries()) {
    assert.deepEqual(
      set.map((w) => ({ scoreId: w.scoreId, measureStart: w.measureStart })),
      DIALECT_WINDOWS,
      `${DIALECT_CANDIDATES[i].id} window set`
    );
  }
  for (let i = 1; i < dialectSets.length; i++) {
    assert.deepEqual(
      dialectSets[i],
      dialectSets[0],
      'the carried dialect windows are one shared set, byte-identical across dialects'
    );
  }
});

// ---------------------------------------------------------------------------
// 2. The spacing axis: preset table, pair spans, cells, time order, triples
// ---------------------------------------------------------------------------

test('Golden master: 4 systems per page, 2 pages, lint 0/0 — and every spacing preset is real geometry', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(geo.systemsPerPage, 4);
  assert.equal(geo.systems.length, 4);
  assert.equal(countJankoPages(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS), 2);
  const golden = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(golden.ok, true, 'the golden page is clean');
  assert.equal(golden.warnings.length, 0, 'with zero warnings');
  assert.equal(golden.stats.systems, 8, '32 bars in 8 systems');

  for (const { spacing } of SPACING_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing });
    const svg = renderJankoCrop(SCORE, 8, 1, o, DEFAULT_JANKO_TOKENS);
    assert.ok((svg.match(/class="janko-digit"/g) ?? []).length > 10, `${spacing} engraves m. 8`);
  }
  // The three presets are distinct engravings on the cluster window.
  const docs = new Set(
    SPACING_CANDIDATES.map(({ spacing }) =>
      renderJankoCrop(
        SCORE,
        8,
        1,
        resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing }),
        DEFAULT_JANKO_TOKENS
      ).replace(/ data-[a-z-]+="[^"]*"/g, '')
    )
  );
  assert.equal(docs.size, 3, 'A, B and C each engrave a different m. 8');
});

test('Preset table: rx / air / pair gap exactly as ticketed, consistent in every row', () => {
  assert.deepEqual(getClusterSpacingPreset('compact'), { rx: 3.2, air: 0.8, pairGap: 7.2 });
  assert.deepEqual(getClusterSpacingPreset('balanced'), { rx: 3.6, air: 1.0, pairGap: 8.2 });
  assert.deepEqual(getClusterSpacingPreset('airy'), { rx: 4.0, air: 1.2, pairGap: 9.2 });
  assert.deepEqual(getClusterSpacingPreset(undefined), getClusterSpacingPreset('balanced'));
  for (const spacing of JANKO_CLUSTER_SPACINGS) {
    const preset = getClusterSpacingPreset(spacing);
    assert.ok(
      Math.abs(preset.pairGap - (2 * preset.rx + preset.air)) < 1e-9,
      `${spacing}: pairGap is 2rx + air`
    );
  }
});

test('Paint pin: rx + ry + digit size per preset, straight off the engraved page', () => {
  assert.equal(DEFAULT_JANKO_TOKENS.noteheadRadius, 4.8, 'ry is fixed at 4.8');
  assert.equal(DEFAULT_JANKO_TOKENS.digitFontSize, 5.8, 'the digit is fixed at 5.8');
  for (const { spacing } of SPACING_CANDIDATES) {
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing });
    const svg = renderJankoCrop(SCORE, 8, 1, o, DEFAULT_JANKO_TOKENS);
    const masks = [...svg.matchAll(/<(circle|ellipse) class="janko-knockout" cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/g)];
    assert.ok(masks.length > 10, `${spacing} paints elliptical knockouts`);
    const { rx } = getClusterSpacingPreset(spacing);
    for (const m of masks) {
      assert.equal(m[1], 'ellipse', `${spacing}: every mask is an ellipse, never a legacy circle`);
      assert.equal(Number(m[4]), rx, `${spacing}: every mask carries rx ${rx}`);
      assert.equal(Number(m[5]), 4.8, `${spacing}: every mask carries ry 4.8`);
    }
    const digits = [...svg.matchAll(/class="janko-digit"[^>]*font-size="([\d.]+)pt"/g)];
    assert.ok(digits.length > 10, `${spacing} paints digits`);
    for (const d of digits) assert.equal(Number(d[1]), 5.8, `${spacing}: every digit is 5.8pt`);
  }
});

test('Pairs (mm. 8/12/15): preset span, beat-cell containment, time order — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const { pairGap } = getClusterSpacingPreset(spacing);
    const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing });
    const layouts = layoutJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    for (const tick of [1032, 1632, 2040, 2064]) {
      const pair = notes.filter((p) => p.note.startTick === tick).sort((a, b) => a.x - b.x);
      assert.equal(pair.length, 2, `${spacing}: t${tick} is a same-row pair`);
      assert.ok(
        Math.abs(pair[1].x - pair[0].x - pairGap) < 0.05,
        `${spacing}: t${tick} spans ${pairGap}pt (got ${(pair[1].x - pair[0].x).toFixed(2)})`
      );
      for (const p of pair) {
        assert.ok(p.beatCell, `${spacing}: every head records its beat cell`);
        assert.ok(
          p.x >= p.beatCell!.left - 1e-9 && p.x <= p.beatCell!.right + 1e-9,
          `${spacing}: t${tick} stays inside [${p.beatCell!.left.toFixed(2)}, ${p.beatCell!.right.toFixed(2)}]`
        );
      }
    }
    // Time order across bar 15: every onset stays left of every later onset.
    const byTick = new Map<number, { min: number; max: number }>();
    for (const p of notes.filter((p) => p.note.startTick >= 2016 && p.note.startTick < 2160)) {
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
        `${spacing}: t${ticks[i - 1]} stays left of t${ticks[i]}`
      );
    }
    const report = lintJankoScore(SCORE, o, DEFAULT_JANKO_TOKENS);
    assert.equal(report.ok, true, `${spacing} lints clean on Bach`);
    assert.equal(report.warnings.length, 0, `${spacing} adds no warning on Bach`);
    const brahms = lintJankoScore(
      BRAHMS,
      { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, clusterSpacing: spacing },
      BRAHMS_OP118_NO1_JANKO_TOKENS
    );
    assert.equal(brahms.ok, true, `${spacing} lints clean on Brahms`);
    assert.equal(brahms.warnings.length, 0, `${spacing} adds no warning on Brahms`);
  }
});

test('Seconds keep two stems at head-x: the m12 rule on the t1632 pair', () => {
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const pair = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 1632);
  assert.equal(pair.length, 2, 't1632 is a same-row pair');
  assert.notEqual(pair[0].rhythm.hand, pair[1].rhythm.hand, 't1632 is cross-hand');
  for (const layout of layouts) {
    const hidden = suppressedStemIds(layout);
    for (const p of pair.filter((q) => layout.notes.some((n) => n.note.id === q.note.id))) {
      assert.ok(!hidden.has(p.note.id), `${p.note.id} keeps its own stem`);
      const stem = getStemGeometry(p.rhythm, DEFAULT_JANKO_TOKENS);
      assert.equal(stem.stemX, p.x, `${p.note.id} stems exactly at head-x`);
    }
  }
  // Paint-level: two stem rules stand on the two head columns.
  const crop = renderJankoCrop(SCORE, 12, 1, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const stems = [...crop.matchAll(/class="janko-stem" x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g)];
  for (const p of pair) {
    assert.ok(
      stems.some((s) => Math.abs(Number(s[1]) - p.x) < 0.01 && Math.abs(Number(s[3]) - p.x) < 0.01),
      `a painted stem stands on ${p.note.id} at x=${p.x.toFixed(2)}`
    );
  }
});

test('Triples (Brahms mm. 8/9): twice the pair gap and one shared stem each — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const { pairGap } = getClusterSpacingPreset(spacing);
    const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, clusterSpacing: spacing });
    const layouts = layoutJankoScore(BRAHMS, o, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    for (const tick of [1392, 1584]) {
      const triple = notes
        .filter((p) => p.note.startTick === tick && p.rhythm.hand === 'RH' && p.note.pitch.octave === 3)
        .sort((a, b) => a.x - b.x);
      assert.equal(triple.length, 3, `${spacing}: t${tick} carries the o3r1 triple`);
      assert.ok(
        Math.abs(triple[2].x - triple[0].x - 2 * pairGap) < 0.05,
        `${spacing}: t${tick} spans ${(2 * pairGap).toFixed(1)}pt (got ${(triple[2].x - triple[0].x).toFixed(2)})`
      );
      for (const p of triple) {
        assert.ok(
          p.x >= p.beatCell!.left - 1e-9 && p.x <= p.beatCell!.right + 1e-9,
          `${spacing}: the triple stays in its beat cell`
        );
      }
    }
    // One shared stem serves the whole same-duration RH onset: the carrier is
    // exempt from the clasp's stem suppression, every member is suppressed.
    const layout = layouts.find((l) => l.notes.some((p) => p.note.startTick === 1392))!;
    const groups = layout.sharedStems.filter((g) => g.tick === 1392 && g.hand === 'RH');
    assert.equal(groups.length, 1, `${spacing}: the t1392 RH onset shares one stem`);
    const carrier = layout.notes.find((p) => p.note.id === groups[0].carrierId)!;
    assert.ok(
      Math.abs(carrier.x - carrier.nominalX!) < 0.05,
      `${spacing}: the carrier stands on the nominal column`
    );
    const hidden = suppressedStemIds(layout);
    assert.ok(!hidden.has(carrier.note.id), `${spacing}: the carrier keeps its stem`);
    for (const id of groups[0].suppressedIds) {
      assert.ok(hidden.has(id), `${spacing}: ${id} is served by the shared stem`);
    }
    const rhIds = layout.notes.filter((p) => p.note.startTick === 1392 && p.rhythm.hand === 'RH');
    const painted = rhIds.filter((p) => !hidden.has(p.note.id));
    assert.equal(painted.length, 1, `${spacing}: exactly one painted RH stem on t1392`);
    assert.equal(painted[0].note.id, carrier.note.id);
  }
});

// ---------------------------------------------------------------------------
// 3. Shared stems: the mixed t1752 stack, synthetic stacks, split-stack-stems
// ---------------------------------------------------------------------------

test('Mixed stack t1752: exactly one stem-x, both beams present, each drawn once', () => {
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

test('Synthetic same-duration stacks: one painted stem — stacked and flanked', () => {
  const note = (
    id: string,
    pitchClass: number,
    octave: number,
    startTick: number,
    durationTicks: number,
    hand: Hand = 'RH'
  ): QuantizedNote => ({ id, pitch: { pitchClass, octave }, startTick, durationTicks, hand });
  const score: QuantizedGridScore = {
    id: 'synthetic-shared-stem',
    title: 'Synthetic Shared Stem',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 144,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [
      // A stacked same-hand same-duration pair (two rows, one column).
      note('stack-lo', 2, 3, 0, 48),
      note('stack-hi', 2, 4, 0, 48),
      // A flanked same-hand same-duration pair (one row, two heads).
      note('flank-lo', 4, 4, 48, 48),
      note('flank-hi', 6, 4, 48, 48),
    ],
  };
  const layouts = layoutJankoScore(score, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(layouts.length, 1);
  const layout = layouts[0];
  const hidden = suppressedStemIds(layout);

  // The stack shares one stem on the column (the vertical-chord grammar).
  const stackPainted = ['stack-lo', 'stack-hi'].filter((id) => !hidden.has(id));
  assert.equal(stackPainted.length, 1, 'the stack paints one shared stem');

  // The flanked pair shares one stem on the nominal column.
  const flank = layout.notes.filter((p) => p.note.startTick === 48).sort((a, b) => a.x - b.x);
  assert.equal(flank.length, 2);
  assert.ok(
    Math.abs(flank[1].x - flank[0].x - 8.2) < 0.05,
    `the flanked pair spans the golden 8.2pt (got ${(flank[1].x - flank[0].x).toFixed(2)})`
  );
  const groups = layout.sharedStems.filter((g) => g.tick === 48 && g.hand === 'RH');
  assert.equal(groups.length, 1, 'the flanked pair forms one shared-stem group');
  const carrier = layout.notes.find((p) => p.note.id === groups[0].carrierId)!;
  assert.ok(Math.abs(carrier.x - carrier.nominalX!) < 0.05, 'the carrier stands on the nominal column');
  const flankPainted = ['flank-lo', 'flank-hi'].filter((id) => !hidden.has(id));
  assert.deepEqual(flankPainted, [carrier.note.id], 'the flanked pair paints one shared stem');

  // And the shared grammar is clean: no split column, no simultaneity trip.
  const split: Parameters<typeof checkSplitStackStems>[2] = [];
  checkSplitStackStems(layout, resolveJankoTokens(DEFAULT_JANKO_TOKENS), split);
  assert.deepEqual(split, [], 'no split-stack-stems on the synthetic stacks');
  const report = lintJankoScore(score, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
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

test('Beam spans are drawn once: no two groups of one system ever share an identical span', () => {
  // partitionBeamGroups excludes every same-hand simultaneity from all runs, so
  // two beam groups can never coincide: the Round 16 dedupe directive holds by
  // construction, and this test pins the structure instead of dead code.
  for (const [score, options, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
    [SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 2 }, DEFAULT_JANKO_TOKENS, 'chord specimen'],
    [REST_SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen'],
  ] as const) {
    for (const layout of layoutJankoScore(score, options, tokens)) {
      const seen = new Set<string>();
      for (const beam of layout.beams) {
        const ticks = beam.notes.map((n) => n.startTick);
        assert.equal(
          new Set(ticks).size,
          ticks.length,
          `${label}: no group ever beams two notes of one onset`
        );
        const key = `${beam.notes[0].hand}|${ticks.join(',')}|${beam.secondary ? '2' : '1'}`;
        assert.ok(!seen.has(key), `${label}: span ${key} is drawn once`);
        seen.add(key);
      }
    }
  }

  // Synthetic doubled run: two same-hand voices sharing every onset stay out of
  // every beam group — simultaneities are never melodic beams.
  const doubled: QuantizedGridScore = {
    id: 'synthetic-doubled-run',
    title: 'Synthetic Doubled Run',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 144,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [0, 12, 24, 36].flatMap((startTick, i) => [
      { id: `a${i}`, pitch: { pitchClass: 2, octave: 3 }, startTick, durationTicks: 12, hand: 'RH' as Hand },
      { id: `b${i}`, pitch: { pitchClass: 2, octave: 4 }, startTick, durationTicks: 12, hand: 'RH' as Hand },
    ]),
  };
  const layouts = layoutJankoScore(doubled, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(layouts.length, 1);
  assert.equal(layouts[0].beams.length, 0, 'the doubled run forms no beam group');
  assert.deepEqual(
    layouts[0].ungrouped.map((n) => n.id).sort(),
    ['a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', 'b3'],
    'every doubled onset stays ungrouped'
  );
});

// ---------------------------------------------------------------------------
// 4. Dots: always above, tight to the mask
// ---------------------------------------------------------------------------

test('Dots: every golden dot sits above its head, tight to the elliptical mask', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  // Bach carries the dotted values (19 of them); the Brahms loop below audits
  // vacuously today and pins the rule for any dotted value it ever gains.
  for (const [score, options, tokens, label, minDots] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach', 1],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms', 0],
  ] as const) {
    const layouts = layoutJankoScore(score, options, tokens);
    const dotted = layouts
      .flatMap((l) => l.notes)
      .filter((p) => p.note.durationTicks > 26 && p.note.durationTicks <= 38);
    assert.ok(dotted.length >= minDots, `${label} has dotted values to audit`);
    for (const p of dotted) {
      assert.ok(
        p.rhythm.dotY! < p.y - 1e-9,
        `${label}: the ${p.note.id} dot sits above its head (uniform sign)`
      );
      assert.ok(
        Math.abs(p.rhythm.dotX! - (p.x + 3.6 + t.augmentationDotGap)) < 0.01,
        `${label}: the ${p.note.id} dot hugs the mask at x + rx + gap`
      );
    }
  }
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(
    report.diagnostics.filter((d) => d.code === 'dot-collision').length,
    0,
    'no dot touches a disc, a rule or a grid line'
  );
});

test("Bar 6's dot attaches only to t744", () => {
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const notes = layouts.flatMap((l) => l.notes);
  const dotted = notes.filter(
    (p) => p.note.startTick >= 720 && p.note.startTick < 864 && p.note.durationTicks > 26 && p.note.durationTicks <= 38
  );
  assert.equal(dotted.length, 1, 'bar 6 carries exactly one dotted value');
  assert.equal(dotted[0].note.startTick, 744, 'the dotted value is the LH 0 at t744');
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
  assert.equal(nearest.note.id, dotted[0].note.id, 'the nearest head to the dot is its own t744 head');

  // Paint-level: the engraved dot sits at the resolved position, above and
  // right — never mirrored, never on-row.
  const crop = renderJankoCrop(SCORE, 6, 1, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const painted = [...crop.matchAll(/class="janko-augmentation-dot" cx="([\d.]+)" cy="([\d.]+)"/g)].map(
    (m) => ({ cx: Number(m[1]), cy: Number(m[2]) })
  );
  assert.ok(
    painted.some((d) => Math.abs(d.cx - dot.x) < 0.01 && Math.abs(d.cy - dot.y) < 0.01),
    `the t744 dot paints at (${dot.x.toFixed(2)}, ${dot.y.toFixed(2)})`
  );
  assert.ok(dot.y < dotted[0].y, 'above the head');
  assert.ok(dot.x > dotted[0].x, 'right of the head');
});

test('The digit sits inside the knockout for all 12 glyphs — golden plus both evaluations', () => {
  const { halfWidth, halfHeight } = digitHalfExtents(DEFAULT_JANKO_TOKENS.digitFontSize);
  const ry = DEFAULT_JANKO_TOKENS.noteheadRadius;
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layout = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  for (const spacing of JANKO_CLUSTER_SPACINGS) {
    const { rx } = getClusterSpacingPreset(spacing);
    const oo = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, clusterSpacing: spacing });
    // All 12 glyphs share the renderer's optical box; every one is measured.
    for (let pc = 0; pc < 12; pc++) {
      const horizontal = rx - halfWidth;
      const vertical = ry - halfHeight;
      const corner = 1 - (halfWidth / rx) ** 2 - (halfHeight / ry) ** 2;
      assert.ok(
        horizontal >= DEFAULT_JANKO_LINT_OPTIONS.digitClearance,
        `${spacing}: glyph ${pc} keeps left/right white`
      );
      assert.ok(
        vertical >= DEFAULT_JANKO_LINT_OPTIONS.digitClearance,
        `${spacing}: glyph ${pc} keeps top/bottom white`
      );
      assert.ok(
        corner >= DEFAULT_JANKO_LINT_OPTIONS.knockoutMargin,
        `${spacing}: glyph ${pc} keeps the ellipse corner budget (${corner.toFixed(3)})`
      );
    }
    const out: Parameters<typeof checkKnockoutCoverage>[4] = [];
    checkKnockoutCoverage(layout, oo, t, DEFAULT_JANKO_LINT_OPTIONS, out);
    assert.deepEqual(out, [], `${spacing}: the coverage audit stays silent`);
  }
});

// ---------------------------------------------------------------------------
// 5. Rests: size maxima, rule-hang, rest-ink identity
// ---------------------------------------------------------------------------

test('Rest size maxima: pinned per value over the four carried dialects', () => {
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
    for (const { style } of DIALECT_CANDIDATES) {
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

test('Rule-hang: m. 4, the specimens and Brahms m. 68 hang on-rule, corridor-side, clear — every dialect', () => {
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
  for (const { style } of DIALECT_CANDIDATES) {
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

test('Rest-ink identity: extracted rest SVG groups are equal across all three spacing presets', () => {
  for (const [score, options, tokens, label, minGroups] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach', 9],
    [REST_SPECIMEN, { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4 }, DEFAULT_JANKO_TOKENS, 'rest specimen', 4],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms', 1],
  ] as const) {
    const golden = restInkOf(score, options, tokens, 'balanced');
    assert.ok(golden.length >= minGroups, `${label} writes its rests (${golden.length} groups)`);
    for (const spacing of ['compact', 'airy'] as const) {
      assert.deepEqual(
        restInkOf(score, options, tokens, spacing),
        golden,
        `${label}: the spacing question cannot move rest ink (${spacing} vs balanced)`
      );
    }
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

// ---------------------------------------------------------------------------
// 6. The dialect axis: clean windows, four values, carried set
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
// 7. The live studio
// ---------------------------------------------------------------------------

test('The live studio engraves all 7 candidates on their own windows with per-axis badges', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 7, 'seven cards');
  assert.match(html, /data-candidate-count="7"/);
  assert.match(html, /Round 16/);
  assert.match(html, /Cluster Spacing \+ Rest Dialects/, 'the round title headlines the view');
  assert.ok(!html.includes('Crowded Columns'), 'the Round 15 title is retired');
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
      assert.ok(!body.includes('badge-delta'), 'candidate B is the incumbent: no delta styling');
    } else {
      assert.match(body, /badge-delta/, `${id} highlights its departure from golden`);
    }
    // All three spacing verdicts are reported; compact and airy are judging
    // input, not gates — today all three lint clean on Bach + Brahms.
    assert.match(body, /chip chip-ok/, `${id} reports its lint verdict`);
    assert.match(body, /data-lint="clean"/, `${id} is clean today`);
  }
  for (const { id, style } of DIALECT_CANDIDATES) {
    const at = html.indexOf(`data-candidate="${id}"`);
    assert.ok(at > cursor, `${id} appears after the spacing set`);
    cursor = at;
    const body = html.slice(at, html.indexOf('</article>', at));
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>restStyle</b> = ${style}`),
      `${id} shows its dialect badge`
    );
    assert.ok(!body.includes('<b>clusterSpacing</b>'), `${id} never shows a spacing badge`);
    assert.match(body, /chip chip-ok/, `${id} lints clean on its clean windows`);
  }
});
