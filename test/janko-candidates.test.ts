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
  REST_DURATION_SPECIMEN_JANKO_OPTIONS,
  REST_DURATION_SPECIMEN_JANKO_TOKENS,
  REST_DURATION_SPECIMEN_VALUES,
  buildRestDurationSpecimenScore,
} from '../src/scores/rest-duration-specimen';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  getCandidate,
} from '../src/render/janko/candidates';
import { createStudioConfig, renderCandidatesView, renderCompareStrip } from '../src/render/janko/studio';
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
  getSubdivisionGlyphBBox,
  partitionBeamGroups,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import {
  REST_SIXTY_FOURTH_HEIGHT,
  REST_SLAB_WIDTH,
  REST_SLAB_HEIGHT,
  JANKO_REST_VALUES,
  JankoRestValue,
  REST_BOX_STROKE,
  REST_LINEAR_SCALE,
  REST_PHANTOM_HEAD_RADIUS,
  REST_PHANTOM_HEAD_STROKE,
  REST_STROKE,
  REST_URTEXT_BULB_RADIUS,
  restGlyphOrigin,
  restInkBox,
  restSeatOffsetY,
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

/** The four rest dialects the Round 15/17B behaviour fixtures exercise. */
const REST_STYLES: JankoRestStyle[] = [
  'kinetic-monoline',
  'classical-urtext',
  'geometric-node',
  'phantom-notehead',
];

/**
 * Round 29 is judged and landed (kept as the named empty set for the
 * historical record). Round 30 is parked (kept as the named pair for the
 * historical record). Round 31 previewed the clasp-dot nudge on one card
 * (parked as the named singleton). Round 32 asked full vs midpoint-only grid
 * (parked as the named pair; midpoint rejected). Round 33 asked full vs none
 * (parked as the named pair; DECIDED — full grid selected, zero live cards).
 */
const ROUND_29_CARDS: string[] = [];
const ROUND_30_CARDS: string[] = ['round-30-rings', 'round-30-double-dots'];
const ROUND_31_CARDS: string[] = ['round-31-clasp-nudge'];
const ROUND_32_CARDS: string[] = ['4-per-system-full-grid', '4-per-system-midpoint-grid'];
const ROUND_33_CARDS: string[] = ['grid-full-vs-none-full', 'grid-full-vs-none-none'];

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

test('CURRENT_ROUND_METADATA is the decided Round 33 (no open axis)', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 33);
  assert.match(CURRENT_ROUND_METADATA.title, /no active comparison/i);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, [], 'no open axis remains');
  assert.equal(CURRENT_ROUND_METADATA.compareStrip, undefined, 'no shared compare strip');
  assert.deepEqual(ROUND_30_CARDS, ['round-30-rings', 'round-30-double-dots'], 'R30 parked pair on record');
  assert.deepEqual(ROUND_31_CARDS, ['round-31-clasp-nudge'], 'R31 parked singleton on record');
  assert.deepEqual(
    ROUND_32_CARDS,
    ['4-per-system-full-grid', '4-per-system-midpoint-grid'],
    'R32 parked pair on record'
  );
  assert.deepEqual(
    ROUND_33_CARDS,
    ['grid-full-vs-none-full', 'grid-full-vs-none-none'],
    'R33 parked pair on record'
  );
});

test('CURRENT_CANDIDATES is empty: Round 33 decided, no control', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, [], 'zero live cards');
  assert.equal(CURRENT_CANDIDATES.length, 0, 'no active comparison');
  assert.equal(getCandidate('control'), undefined, 'no control card — the Reference is the control');
  assert.equal(
    getCandidate('grid-full-vs-none-full'),
    undefined,
    'the parked full-grid card lives in the round-33 suite, not the registry'
  );
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

test('The decided tight golden pins every gate; snug stays implemented and identical', () => {
  // The verdict is in: tight is the golden master, so the DEFAULT options —
  // exactly what the CLI gates — must report zero violations and zero
  // warnings on Bach; Brahms carries the 2 accepted 4-up slot findings
  // (was 0/0 at 3-up) under both gaps — spacing never touches slots.
  assert.equal(
    resolveJankoOptions(DEFAULT_JANKO_OPTIONS).clusterSpacing,
    'tight',
    'the golden master is the decided tight gap'
  );
  for (const [score, base, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' as const }, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const report = lintJankoScore(score, base, tokens);
    if (label === 'Brahms') {
      assert.deepEqual(
        report.violations.map((v) => [v.code, v.system + 1]),
        [
          ['system-slot-overlap', 18],
          ['system-slot-overlap', 18],
        ],
        'tight golden: exactly the accepted 2 (itemized in the §2-landed record)'
      );
    } else {
      assert.equal(report.violations.length, 0, `tight golden: zero violations on ${label}`);
      assert.equal(report.ok, true, `tight golden: ${label} engraves clean`);
    }
    assert.equal(report.warnings.length, 0, `tight golden: zero warnings on ${label}`);
  }
  // Snug remains implemented: the rest behavior is gap-independent, so the
  // retired golden matches tight exactly — clean on Bach, the accepted 2
  // on Brahms.
  for (const [score, base, tokens, label] of [
    [SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, 'Bach'],
    [BRAHMS, { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' as const }, BRAHMS_OP118_NO1_JANKO_TOKENS, 'Brahms'],
  ] as const) {
    const snug = lintJankoScore(score, { ...base, clusterSpacing: 'snug' }, tokens);
    if (label === 'Brahms') {
      assert.deepEqual(
        snug.violations.map((v) => [v.code, v.system + 1]),
        [
          ['system-slot-overlap', 18],
          ['system-slot-overlap', 18],
        ],
        'snug: the same accepted 2 — the gap never touches slots'
      );
    } else {
      assert.equal(snug.violations.length, 0, `snug: zero violations on ${label}`);
    }
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
    // Round 23: notes crossed by a foreign stem paint tall knockouts reaching
    // the stem-start line; every other mask keeps the exact preset box.
    const tallByPage = new Map<number, Array<{ x: number; y: number }>>([[1, []], [2, []]]);
    for (const [s, layout] of layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS).entries()) {
      for (const p of layout.notes.filter((q) => q.tallKnockout)) {
        tallByPage.get(s < 4 ? 1 : 2)!.push({ x: p.x, y: p.y });
      }
    }
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
        const cx = Number(m[1]) + Number(m[3]) / 2;
        const cy = Number(m[2]) + Number(m[4]) / 2;
        const wx = Number(m[3]) / 2;
        const hy = Number(m[4]) / 2;
        const tall = (tallByPage.get(page) ?? []).some(
          (q) => Math.abs(q.x - cx) < 0.05 && Math.abs(q.y - cy) < 0.6
        );
        const wantHy = tall ? preset.hy + DEFAULT_JANKO_TOKENS.stemAttachmentAir : preset.hy;
        assert.ok(
          Math.abs(wx - preset.wx) < 0.011,
          `${spacing}: mask half-width ${wx} is the preset ${preset.wx}`
        );
        assert.ok(
          Math.abs(hy - wantHy) < 0.011,
          `${spacing}: mask half-height ${hy} is ${tall ? 'the tall knockout' : 'the preset'} ${wantHy}`
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

test('Pairs stand at the judged gap ±0.1, in time order, cells reported — every preset', () => {
  // Bach's cross-hand pairs: t1032 (m8), t1632 (m12), t2040/t2064 (m15). Each
  // resolves jointly (per-hand singletons whose masks overlap): the lower
  // pitch one slot inward, the upper on the solved column. A downbeat pair
  // whose desired slots leave the cell steps its column right (legitimate
  // translation); the demand stays reported in clusterDiagnostics.
  const pairTicks = [1032, 1632, 2040, 2064];
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      core: 'adaptive',
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    const diags = layouts.flatMap((l) => l.clusterDiagnostics ?? []);
    for (const tick of pairTicks) {
      const pair = notes.filter((p) => p.note.startTick === tick);
      assert.equal(pair.length, 2, `${spacing} t${tick}: the ticketed pair`);
      const span = Math.abs(pair[1].x - pair[0].x);
      assert.ok(
        Math.abs(span - G) < 0.1,
        `${spacing} t${tick}: pair spans ${span.toFixed(2)} (G = ${G})`
      );
      // Lowest-on-column relative to the solved column (nominal + legitimate
      // shift): these cross-hand pairs carry one note per hand, so no bracket
      // qualifies — the lower source pitch sits ON the column, the upper one
      // slot right. (Upper-on-grid is retired: the inward slot is reserved
      // for actual brackets.)
      const linOf = (p: (typeof pair)[number]): number =>
        p.note.pitch.octave * 12 + p.note.pitch.pitchClass;
      const [lo, hi] = [...pair].sort((a, b) => linOf(a) - linOf(b));
      const layout = layouts.find((l) => l.columns.has(tick))!;
      const column = layout.columns.get(tick)!;
      assert.ok(
        Math.abs(lo.x - column) < 0.1,
        `${spacing} t${tick}: lower head ON the solved column`
      );
      assert.ok(
        Math.abs(hi.x - (column + G)) < 0.1,
        `${spacing} t${tick}: upper head one slot right of the solved column`
      );
      // Beat cells: legitimate shifts fit every corpus pair — actual ink
      // stays inside — while the demand report names the desired excess.
      const inCell = (p: (typeof pair)[number]): boolean =>
        p.x >= (p.beatCell?.left ?? 0) - 1e-9 && p.x <= (p.beatCell?.right ?? 0) + 1e-9;
      const offenders = pair.filter((p) => !inCell(p));
      assert.equal(offenders.length, 0, `${spacing} t${tick}: legitimate shifts fit the pair`);
      const diag = diags.find((d) => d.tick === tick);
      if (diag) {
        assert.ok(
          diag.memberIds.includes(hi.note.id),
          `${spacing} t${tick}: the diagnostic names the outward demand`
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
// 7. Context-anchored slots: m12's 7 on its column, the gap always G, demand reported
// ---------------------------------------------------------------------------

test('Pin: m12 seats the 7 ON its column with the 9 one slot right — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, DEFAULT_JANKO_TOKENS);
    const notes = layouts.flatMap((l) => l.notes);
    const pair = notes
      .filter((p) => p.note.startTick === 1632)
      .sort((a, b) => a.x - b.x);
    // Permanent context-anchored rule relative to the solved column (nominal
    // + legitimate shift): the m12 pair carries one note per hand, so no
    // bracket qualifies — the **lower** head (pc7, the LH tone) sits ON the
    // column and the pc9 RH tone stands one slot right. (Upper-on-grid is
    // retired: the inward slot is reserved for actual brackets.)
    const nine = pair.find((p) => p.coord.pitchClass === 9)!;
    const seven = pair.find((p) => p.coord.pitchClass === 7)!;
    assert.ok(nine && seven, `${spacing}: the ticketed pair exists`);
    const column = layouts.find((l) => l.columns.has(1632))!.columns.get(1632)!;
    assert.ok(
      Math.abs(seven.x - column) <= 0.3,
      `${spacing}: the lower head holds its column (Δ${Math.abs(seven.x - column).toFixed(2)})`
    );
    assert.ok(
      Math.abs(nine.x - (column + G)) <= 0.3,
      `${spacing}: the upper head sits one slot right (Δ${Math.abs(nine.x - (column + G)).toFixed(2)})`
    );
    const span = Math.abs(pair[1].x - pair[0].x);
    assert.ok(
      Math.abs(span - G) < 0.1,
      `${spacing}: the pair keeps the judged gap (${span.toFixed(2)})`
    );
  }
});

test('No silent shrink: a pair starved of room keeps the judged gap, shifts to clear', () => {
  // 5-tick onsets: the pair at tick 43 faces a 5-tick room to its beat pulse
  // — inside [touching, G). The retired pin-preserving shrink narrowed the
  // gap to the room; the permanent rule keeps the judged gap and steps the
  // whole onset right to clear its same-pitch neighbour (legitimate
  // translation for time order and mask clearance, never a shrink).
  const shrink = score('synthetic-pin-shrink', [
    note('shrink-a', 0, 5, 38, 12),
    note('shrink-lo', 0, 5, 43, 12),
    note('shrink-hi', 4, 5, 43, 12),
    note('shrink-b', 1, 5, 48, 12),
  ]);
  // The synthetic room is tuned to the snug gap (snug remains implemented);
  // the solver itself is untouched by the golden verdict. The tick gap was
  // tuned to the 24pt side margins, so they stay pinned here: the golden 20pt
  // margins would push the 5.87pt room just over the snug pair gap.
  const options = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    core: 'adaptive',
    measuresPerSystem: 3,
    clusterSpacing: 'snug',
    pageMarginLeft: 24,
    pageMarginRight: 24,
  });
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(shrink, options, tokens);
  const placed = layouts.flatMap((l) => l.notes);
  const lo = placed.find((p) => p.note.id === 'shrink-lo')!;
  const hi = placed.find((p) => p.note.id === 'shrink-hi')!;
  const room = (lo.beatCell?.right ?? 0) - (lo.nominalX ?? 0);
  assert.ok(
    room >= 2 * getClusterSpacingPreset('snug').wx && room < getClusterSpacingPreset('snug').pairGap,
    `the room (${room.toFixed(2)}pt) sits inside [touching, G)`
  );
  // Lowest-inward with no shrink relative to the solved column: the lower
  // head one slot inward, the upper on it, the judged gap intact. The column
  // steps right to clear the tick-38 same-pitch head (time order + 5.46pt
  // mask air); the gap is never min(G, room).
  const G = getClusterSpacingPreset('snug').pairGap;
  const column = layouts.find((l) => l.columns.has(43))!.columns.get(43)!;
  assert.ok(
    Math.abs(lo.x - (column - G)) < 0.05,
    `the lower head sits one slot inward (${lo.x.toFixed(2)})`
  );
  assert.ok(
    Math.abs(hi.x - column) < 0.05,
    `the upper head holds its column (${hi.x.toFixed(2)})`
  );
  const span = Math.abs(hi.x - lo.x);
  assert.ok(Math.abs(span - G) < 0.05, `the gap stays judged (${span.toFixed(2)} = G, never min(G, room))`);
  // The cell itself is feasible (both desired slots inside), so no cell
  // demand is reported; the shift answers the neighbour, not the cell. The
  // cell-demand twin (a downbeat inward head desiring past its cell edge,
  // Bach m. 12 tick 1632) is pinned with its diagnostic in the round-19
  // slots suite.
  const diags = layouts.flatMap((l) => l.clusterDiagnostics ?? []);
  assert.equal(diags.find((d) => d.tick === 43), undefined, 'a cell-feasible fit reports no cell demand');
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
// 10. Held triples: 2G spans, lowest-inward slots, one shared stem (t1392)
// ---------------------------------------------------------------------------

test('Brahms held triples span 2G with symmetrically tucked rows — every preset', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      core: 'adaptive',
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

test('t1392 slots lowest-inward with no tuck and shares one stem', () => {
  for (const { spacing } of SPACING_CANDIDATES) {
    const G = getClusterSpacingPreset(spacing).pairGap;
    const options = resolveJankoOptions({
      ...resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      core: 'adaptive',
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
    assert.ok(fanned.length >= 2, `${spacing}: t1392 carries 2+ slotted rows`);
    const widest = fanned.reduce((a, b) => (b.length > a.length ? b : a));
    assert.equal(widest.length, 3, `${spacing}: the widest row is the triple`);
    // The onset column: the lone LH head stands on it (clear members stay).
    const layout = layouts.find((l) => l.notes.some((p) => p.note.startTick === 1392))!;
    const col = layout.columns.get(1392)!;
    const lone = byY.find((hs) => hs.length === 1)![0];
    assert.ok(Math.abs(lone.x - col) < 0.05, `${spacing}: the lone head stands on the column`);
    // Permanent lowest-inward slots: the triple takes {-G, 0, +G} with its
    // lowest pitch (96) inward, and the pair takes {-G, 0} with its lowest
    // (99) inward. No tuck: both inward heads share the inward slot, both
    // upper heads the column.
    const linOf = (p: (typeof heads)[number]): number =>
      p.note.pitch.octave * 12 + p.note.pitch.pitchClass;
    const tripleXs = [...widest].sort((a, b) => linOf(a) - linOf(b));
    assert.ok(Math.abs(tripleXs[0].x - (col - G)) < 0.05, `${spacing}: triple lowest inward`);
    assert.ok(Math.abs(tripleXs[1].x - col) < 0.05, `${spacing}: triple middle on column`);
    assert.ok(Math.abs(tripleXs[2].x - (col + G)) < 0.05, `${spacing}: triple highest outward`);
    const other = fanned.find((hs) => hs !== widest)!;
    const pairXs = [...other].sort((a, b) => linOf(a) - linOf(b));
    assert.ok(Math.abs(pairXs[0].x - (col - G)) < 0.05, `${spacing}: pair lowest inward`);
    assert.ok(Math.abs(pairXs[1].x - col) < 0.05, `${spacing}: pair upper on column`);
    assert.ok(
      Math.abs(pairXs[0].x - tripleXs[0].x) < 1e-9,
      `${spacing}: inward heads share one slot (no tuck)`
    );
    // One shared stem for the whole one-duration onset: the carrier is the
    // on-column outward extremity (topmost RH head on the column), never a
    // tucked interior head.
    const groups = layout.sharedStems.filter((g) => g.tick === 1392);
    assert.equal(groups.length, 1, `${spacing}: t1392 shares one stem`);
    const carrier = notes.find((p) => p.note.id === groups[0].carrierId)!;
    assert.ok(
      Math.abs(carrier.x - col) < 0.05,
      `${spacing}: the carrier stands on the onset's own column`
    );
    assert.equal(carrier.note.id, 'brahms-op118-no1-100', `${spacing}: the upper on-column head carries`);
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
  // The carrier stands on the SOLVED onset column (laid-out x after the
  // column solve's rigid translation), not the un-shifted proportional beat:
  // the clasped inward pair legitimately translated right for bracket air.
  const solvedCol = layout.columns.get(48)!;
  assert.ok(Math.abs(carrier.x - solvedCol) < 0.05, 'the carrier stands on the solved column');
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
    [
      REST_SPECIMEN,
      REST_DURATION_SPECIMEN_JANKO_OPTIONS,
      REST_DURATION_SPECIMEN_JANKO_TOKENS,
      'rest specimen',
    ],
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
  // The judged escape set: flag clearance moves exactly these 12 Bach dots
  // right onto 1.2pt of true flag air; every other dot hugs its mask.
  const ESCAPED = [
    'bach-var1-5',
    'bach-var1-22',
    'bach-var1-39',
    'bach-var1-287',
    'bach-var1-304',
    'bach-var1-351',
    'bach-var1-353',
    'bach-var1-355',
    'bach-var1-357',
    'bach-var1-365',
    'bach-var1-367',
    'bach-var1-369',
  ];
  for (const { spacing } of SPACING_CANDIDATES) {
    const preset = getClusterSpacingPreset(spacing);
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      core: 'adaptive',
      clusterSpacing: spacing,
    });
    const layouts = layoutJankoScore(SCORE, options, tokens);
    const dotted = layouts.flatMap((l) => l.notes).filter(
      (p) => p.note.durationTicks > 26 && p.note.durationTicks <= 38
    );
    assert.equal(dotted.length, 19, `${spacing}: Bach carries 19 dotted values`);
    const moved: string[] = [];
    for (const p of dotted) {
      const hugX = p.x + preset.wx + tokens.augmentationDotGap;
      const hugY = p.y - tokens.augmentationDotRowOffset;
      const dotX = p.rhythm.dotX ?? -1;
      const dotY = p.rhythm.dotY ?? -1;
      const atHug = Math.abs(dotX - hugX) < 1e-9 && Math.abs(dotY - hugY) < 1e-9;
      const layout = layouts.find((l) => l.notes.includes(p))!;
      const partition = partitionBeamGroups(
        layout.notes.map((q) => q.rhythm),
        tokens,
        layout.geometry.middleCY
      );
      const beamed = new Set(partition.groups.flatMap((g) => g.map((n) => n.id)));
      const flagBoxOf = () => {
        const s = getStemGeometry(p.rhythm, tokens);
        const bbox = getSubdivisionGlyphBBox(
          options.subdivisionStyle,
          s.direction,
          subdivisionMarkCount(p.note.durationTicks),
          tokens
        );
        return {
          x0: s.stemX + bbox.x0,
          y0: s.stemEndY + bbox.y0,
          x1: s.stemX + bbox.x1,
          y1: s.stemEndY + bbox.y1,
        };
      };
      const clearanceOf = (x: number, y: number): number => {
        const f = flagBoxOf();
        const dx = Math.max(f.x0 - x, 0, x - f.x1);
        const dy = Math.max(f.y0 - y, 0, y - f.y1);
        return Math.hypot(dx, dy) - tokens.augmentationDotRadius;
      };
      if (!atHug) {
        moved.push(p.note.id);
        // Right-escape: the judged direction — same lane height, right of the
        // hug, clearing true flag ink by the house gap.
        assert.ok(
          Math.abs(dotY - hugY) < 1e-9,
          `${spacing}: ${p.note.id} escapes right, keeping its lane`
        );
        assert.ok(dotX > hugX, `${spacing}: ${p.note.id} escapes right, never left`);
        assert.ok(
          clearanceOf(dotX, dotY) >= tokens.augmentationDotGap - 1e-9,
          `${spacing}: ${p.note.id} clears its flag ink by >= 1.2pt`
        );
        // ... and the escape was required: the hug would have violated.
        assert.ok(
          clearanceOf(hugX, hugY) < tokens.augmentationDotGap - 1e-9,
          `${spacing}: ${p.note.id} had to move (its hug sits inside flag air)`
        );
      } else if (!beamed.has(p.note.id) && subdivisionMarkCount(p.note.durationTicks) >= 1) {
        // No missing escape: a hugging flagged single already clears its flag.
        assert.ok(
          clearanceOf(dotX, dotY) >= tokens.augmentationDotGap - 1e-9,
          `${spacing}: ${p.note.id} hugs with flag clearance to spare`
        );
      }
      // Uniform sign, every bar.
      assert.ok(
        (p.rhythm.dotY ?? p.y) < p.y,
        `${spacing}: ${p.note.id} dots above its head`
      );
      // The high-lane fallback stays vacuous: no same-row neighbour crowds.
      for (const q of layout.notes) {
        if (q === p || Math.abs(q.y - p.y) >= 1e-9) continue;
        assert.ok(
          Math.abs(q.x - p.x) >= 2 * preset.wx + tokens.augmentationDotGap + tokens.augmentationDotRadius,
          `${spacing}: ${p.note.id} clears its same-row neighbour ${q.note.id}`
        );
      }
    }
    assert.deepEqual(moved.sort(), [...ESCAPED].sort(), `${spacing}: exactly the judged 12 escape`);
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
  const options = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' });
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
  // Round 21 §B: the two classical cuts are **filled calligraphic contours**
  // (the measured serpentine and the measured hooked wedge) — a monoline stroke
  // cannot carry their contrast — so they paint no `stroke-width` at all. The
  // live cut (classical-urtext) fills every contour with the 90% rest ink; the
  // dormant kinetic demonstrator keeps #111111. The other demonstrator dialects
  // keep their strokes.
  const groupsOf = (style: JankoRestStyle): string[] => [
    ...restInkOf(SCORE, { ...DEFAULT_JANKO_OPTIONS, restStyle: style }, DEFAULT_JANKO_TOKENS, 'tight'),
    ...restInkOf(
      REST_SPECIMEN,
      { ...DEFAULT_JANKO_OPTIONS, measuresPerSystem: 4, restStyle: style },
      DEFAULT_JANKO_TOKENS,
      'tight'
    ),
  ];
  {
    const kinetic = groupsOf('kinetic-monoline').join('\n');
    assert.ok(kinetic.includes('fill="#111111"'), 'kinetic-monoline paints filled contour ink');
    assert.ok(
      !kinetic.includes('stroke-width'),
      'kinetic-monoline: one filled contour per part, never a stroked rule'
    );
    const classical = groupsOf('classical-urtext').join('\n');
    assert.ok(classical.includes('fill="#1A1A1A"'), 'classical-urtext paints 90% black contour ink');
    assert.ok(
      !classical.includes('fill="#111111"'),
      'classical-urtext keeps no #111111 ink'
    );
    assert.ok(
      !classical.includes('stroke-width'),
      'classical-urtext: one filled contour per part, never a stroked rule'
    );
  }
  {
    const widths = widthsOf('geometric-node');
    assert.ok(widths.length > 0, 'geometric-node paints stroked ink');
    assert.ok(
      widths.every((w) => w === '0.90'),
      `geometric-node: every rest stroke is 0.90pt (saw ${[...new Set(widths)].join(', ')})`
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

test('Rest size maxima: the measured working set, pinned per value', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  // Round 21 §A: every extent is the measured Bravura envelope through
  // `REST_SPACE_PT`. Round 22: the classical hooked heights are the transcribed
  // envelopes themselves (taller than the hand cut by up to 0.1pt); the landed
  // lightening renders those at 0.85 scale, so where classical used to lead the
  // maximum now falls to the unscaled dormant kinetic demonstrator. The maximum
  // over the four surveyed dialects is this table.
  const expected: Record<string, { w: number; h: number }> = {
    'sixty-fourth': { w: 6.602, h: 18.429 },
    'thirty-second': { w: 5.73, h: 14.354 },
    sixteenth: { w: 5.73, h: 10.459 },
    eighth: { w: 4.94, h: 7.41 },
    quarter: { w: 4.25, h: 11.559 },
    half: { w: 5.286, h: 4.25 },
    whole: { w: 5.286, h: 4.25 },
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
    assert.ok(Math.abs(w - max.w) < 1e-3, `${value}: max width ${max.w}pt (got ${w.toFixed(3)})`);
    assert.ok(Math.abs(h - max.h) < 1e-3, `${value}: max height ${max.h}pt (got ${h.toFixed(3)})`);
  }
  // Round 21 §A/§E: the family **grows with the duration** — the classical
  // signature the R16 constant-size cut could not state — and the tallest glyph
  // of the working set exactly fills the lattice's inter-row headroom.
  // `JANKO_REST_VALUES` runs shortest first, so the hooked family's heights must
  // fall monotonically from the 64th (the longest glyph) to the 8th.
  const heights = JANKO_REST_VALUES.map((value) => expected[value].h);
  const hooked = heights.slice(0, 4); // 64th, 32nd, 16th, 8th
  assert.deepEqual(
    [...hooked].sort((a, b) => b - a),
    hooked,
    'the hooked family grows monotonically from the 8th to the 64th'
  );
  // The scale derivation itself: the working set's tallest measured envelope is
  // exactly the lattice's inter-row headroom (2 × (rowHeight − r − minClearance)).
  const headroom = 2 * (t.rowHeight - t.noteheadRadius - 1.0);
  assert.ok(
    Math.abs(REST_SIXTY_FOURTH_HEIGHT - headroom) < 1e-9,
    `the 64th envelope is the measured headroom (${headroom}pt)`
  );
  assert.ok(
    Math.abs(hooked[0] - headroom) < headroom * 0.01,
    `the painted 64th cut keeps the envelope within 1% (${hooked[0].toFixed(3)}pt)`
  );
  assert.ok(heights[4] > heights[3] * 0.6, 'the quarter rest is the tall serpentine');
  // The two bar forms are the same wide slab, mirrored about their seat line:
  // the half sits on it, the whole hangs from it.
  assert.equal(expected.half.w, expected.whole.w, 'the bar pair shares one slab width');
  assert.equal(expected.half.h, expected.whole.h, 'and one slab thickness');
  // The classical cut's own slab (not the cross-dialect maxima) keeps the
  // measured 282:144 proportion.
  const slab = restInkBox(
    { tick: 0, durationTicks: 96, hand: 'RH', x: 0, y: 0, value: 'half', style: 'kinetic-monoline' },
    t
  );
  assert.ok(
    Math.abs((slab.x1 - slab.x0) / (slab.y1 - slab.y0) - 282 / 144) < 1e-6,
    'the slab keeps the measured 282:144 proportion (1.96)'
  );
  assert.ok(
    Math.abs(slab.x1 - slab.x0 - REST_SLAB_WIDTH) < 1e-9 &&
      Math.abs(slab.y1 - slab.y0 - REST_SLAB_HEIGHT) < 1e-9,
    'and the measured 282 × 144u envelope exactly'
  );
});

test('Phrase rows: the showcase rests seat their ink centroid on a phrase row — every dialect', () => {
  const cases = [
    {
      label: 'Bach m. 4',
      score: SCORE,
      options: { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [552],
    },
    {
      label: 'Bach m. 6',
      score: SCORE,
      options: { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [720],
    },
    {
      label: 'Bach m. 7',
      score: SCORE,
      options: { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [864],
    },
    {
      label: 'chord specimen m. 2',
      score: SPECIMEN,
      options: { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const, measuresPerSystem: 2 },
      tokens: DEFAULT_JANKO_TOKENS,
      ticks: [180],
    },
    {
      label: 'rest specimen',
      score: REST_SPECIMEN,
      options: REST_DURATION_SPECIMEN_JANKO_OPTIONS,
      tokens: REST_DURATION_SPECIMEN_JANKO_TOKENS,
      ticks: [24, 216, 408, 600, 768],
    },
    {
      // Source correction filled the false m.68 rest (t13092 was a 12-tick gap
      // from shortened 96→84 halves at tick 13008, now full 96 to 13104);
      // the showcase now uses the genuine m.66 rest (t12528 LH 24, between
      // tieWait chains ending/starting at 12528/12552, lines 320–321).
      label: 'Brahms m. 2',
      score: BRAHMS,
      options: { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' as const },
      tokens: BRAHMS_OP118_NO1_JANKO_TOKENS,
      ticks: [384],
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
        // On-row (Round 20): the glyph's **ink centroid** stands exactly on a
        // whole-tone row of the lattice (staff octaves plus ledger registers) —
        // the bar forms half a slab above / below it, as their seat declares.
        const rows: number[] = [];
        for (let octave = 0; octave <= 8; octave++) {
          const base = layout!.geometry.middleCY + getEquatorYForOctave(octave, 'RH', t, o);
          for (const offset of wholeToneRowOffsets(o, t)) rows.push(base + offset);
        }
        if (rest.value === 'half' || rest.value === 'whole') {
          // Round 21 §C: a bar form's seat point is the **drawn staff rule** it
          // touches — the half slab's bottom edge, the whole slab's top edge —
          // never a phrase row.
          const rules: number[] = [];
          for (const [hand, octave] of [
            ['RH', 5],
            ['LH', 2],
            ['RH', 4],
            ['LH', 3],
          ] as const) {
            rules.push(...getEquatorRuleYs(layout!.geometry.equatorY(hand, octave), o, t));
          }
          const ruleDistance = Math.min(...rules.map((candidate) => Math.abs(rest.y - candidate)));
          assert.ok(
            ruleDistance < 1e-6,
            `${style} · ${c.label} t${tick}: the slab touches a drawn staff rule (off by ${ruleDistance.toFixed(6)})`
          );
        } else {
          const row = rest.y - restSeatOffsetY(rest.value, style, t);
          const rowDistance = Math.min(...rows.map((candidate) => Math.abs(row - candidate)));
          assert.ok(
            rowDistance < 1e-6,
            `${style} · ${c.label} t${tick}: the ink centroid seats on a phrase row (off by ${rowDistance.toFixed(6)})`
          );
        }
        // The painted glyph is drawn about that seat: the origin is exactly the
        // centroid offset from the seat point.
        const origin = restGlyphOrigin(rest, t);
        assert.ok(
          Number.isFinite(origin.x) && Number.isFinite(origin.y),
          `${style} · ${c.label} t${tick}: a real glyph origin`
        );
        // Clear: the admission predicate and the lint agree.
        assert.equal(
          restClearsLayout(rest, layout!.notes, t),
          true,
          `${style} · ${c.label} t${tick}: the seated rest clears every head`
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
    { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', measuresPerSystem: 4 },
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
    Math.abs(rest.y - (referenceRow - t.rowHeight)) < 1e-6,
    `the adjacent row toward the corridor seats the rest (centroid at ${rest.y.toFixed(2)}pt)`
  );
  assert.equal(restClearsLayout(rest, narrow.notes, t), true, 'the fallback seat clears every head');
  assert.ok(
    narrow.beams.some((b) => b.notes.map((n) => n.startTick).join(',') === '48,72,84'),
    'the run still bridges across its printed rest'
  );
  const narrowReport = lintJankoScore(
    wall,
    { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', measuresPerSystem: 4 },
    DEFAULT_JANKO_TOKENS
  );
  assert.equal(narrowReport.violations.length, 0, 'the fallback engraving is violation-free');
  assert.equal(narrowReport.warnings.length, 0, '... with no warnings either');

  // The same silence in a roomy cell never falls back.
  const wide = layoutJankoScore(
    wall,
    { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', measuresPerSystem: 2 },
    DEFAULT_JANKO_TOKENS
  )[0];
  const kept = wide.rests.find((r) => r.tick === 60)!;
  const keptBox = restInkBox(kept, t);
  const wideRelease = wide.notes.find((p) => p.note.id === 'rh-a')!;
  assert.ok(
    Math.abs(kept.y - wideRelease.y) < 1e-6,
    'the roomy cell keeps the reference seat'
  );
});

test('Bridging: m. 4 beams [528, 540, 564] as one gesture with its 16th rest printed beneath', () => {
  const layout = layoutJankoScore(SCORE, { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' }, DEFAULT_JANKO_TOKENS)[0];
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
  const crop = renderJankoCrop(SCORE, 4, 1, { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' }, DEFAULT_JANKO_TOKENS);
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
  // And the rest sits where a note would go: its ink centroid exactly on the
  // digit 9 phrase row it releases from.
  assert.ok(
    Math.abs(rest.y - 164.5) < 1e-6,
    `the m. 4 rest seats its ink centroid on the 164.5pt phrase row (got ${rest.y})`
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
  // Clean: the locked beaming adds no finding and the tick-1632 inward slot
  // steps its column right to stay inside the beat cell (legitimate
  // translation, demand in clusterDiagnostics) — zero violations.
  assert.deepEqual(
    report.violations.map((v) => [v.code, v.system, v.measure, ...(v.noteIds ?? [])]),
    [],
    'the locked beaming stays honest: Goldberg lint-clean'
  );
  assert.equal(report.warnings.length, 0);
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

test('Rest specimen material: the complete working set, each on a guaranteed-free column (locked)', () => {
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((v) => [v.value, v.durationTicks]),
    [
      ['sixteenth', 12],
      ['eighth', 24],
      ['quarter', 48],
      ['half', 96],
      ['whole', 192],
      ['thirty-second', 6],
      ['sixty-fourth', 3],
    ],
    'the five original values, then the two Round 21 §E constructions (32nd, 64th)'
  );
  const options = resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS);
  const rests = layoutJankoScore(REST_SPECIMEN, options, tokens).flatMap((l) => l.rests);
  assert.equal(rests.length, 7, 'exactly seven rests are written — the whole working set');
  assert.deepEqual(
    rests.map((r) => r.value),
    ['sixteenth', 'eighth', 'quarter', 'half', 'whole', 'thirty-second', 'sixty-fourth'],
    'one rest per value, in measure order'
  );
  const r = tokens.noteheadRadius;
  for (const rest of rests) {
    for (const p of layoutJankoScore(REST_SPECIMEN, options, tokens).flatMap((l) => l.notes)) {
      assert.ok(
        Math.hypot(p.x - rest.x, p.y - rest.y) >= 2 * r,
        `the ${rest.value} rest column is free of every foreign head`
      );
    }
  }
  const report = lintJankoScore(REST_SPECIMEN, options, tokens);
  assert.equal(report.violations.length, 0, 'and none is refused');
});

test('STOP tripwire (unlanded): Brahms complete carries exactly the accepted 2', () => {
  // 4-up by operator override (was [] at 3-up). The settled refinements moved
  // the adaptive path (downbeat inward slots + the m. 57 clasp demotion):
  // 14 violations until the architect/operator adjudicates. Preserved, not
  // rebased — see test/brahms-engraving.test.ts §2-landed record.
  const report = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' },
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.deepEqual(
    report.violations.map((v) => [v.code, v.system + 1]),
    [
      ['system-slot-overlap', 18],
      ['system-slot-overlap', 18],
    ],
    'exactly the accepted 2'
  );
  assert.equal(report.warnings.length, 0);
});

test('Every dialect renders every window with zero rest diagnostics and every rest clear (locked)', () => {
  // Dialect-independence anchor: the first style's finding identities, which
  // every other style must reproduce exactly (the absolute pin is the STOP
  // tripwire above).
  let brahmsKeys: string[] | null = null;
  for (const style of REST_STYLES) {
    const options = { ...DEFAULT_JANKO_OPTIONS, restStyle: style };
    for (const [score, base, tokens, label] of [
      [
        REST_SPECIMEN,
        { ...resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS), restStyle: style },
        REST_DURATION_SPECIMEN_JANKO_TOKENS,
        'rest specimen',
      ],
      [
        SPECIMEN,
        { ...options, core: 'adaptive', measuresPerSystem: 2 },
        DEFAULT_JANKO_TOKENS,
        'chord specimen',
      ],
      [
        BRAHMS,
        { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive', restStyle: style },
        BRAHMS_OP118_NO1_JANKO_TOKENS,
        'Brahms complete',
      ],
    ] as const) {
      const report = lintJankoScore(score, base, tokens);
      if (label === 'Brahms complete') {
        // STOP-state: the absolute accepted-2 pin is a tripwire while the
        // adaptive delta is unadjudicated (see 'STOP tripwire: Brahms
        // complete carries exactly the accepted 2' below). The live property
        // — the rest style never touches findings, so all five dialects
        // agree to the finding — stays pinned here.
        const keyOf = (v: (typeof report.violations)[number]): string =>
          [v.code, v.system, v.measure ?? '', ...(v.noteIds ?? [])].join('|');
        const keys = report.violations.map(keyOf);
        if (brahmsKeys === null) brahmsKeys = keys;
        assert.deepEqual(keys, brahmsKeys, `${style} · ${label}: all dialects agree to the finding`);
        assert.equal(report.warnings.length, 0, `${style} · ${label}: zero warnings`);
        continue;
      }
      assert.deepEqual(
        report.diagnostics.map((d) => `${d.code}: ${d.message}`),
        [],
        `${style} · ${label}`
      );
    }
  }
  // The real-world anchor carries a genuine rest (m.66 t12528; the m.68
  // t13092 rest was a false 12-tick gap from shortened halves, now filled).
  const brahmsRests = allRests(
    BRAHMS,
    BRAHMS_OP118_NO1_JANKO_OPTIONS,
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.ok(
    brahmsRests.some((r) => r.tick >= 12528 && r.tick < 12720),
    'Brahms m. 66 writes a genuine rest'
  );
});

test('The dialect material contains no same-column collision (the independence precondition, locked)', () => {
  for (const [score, options, tokens, label] of [
    [
      REST_SPECIMEN,
      REST_DURATION_SPECIMEN_JANKO_OPTIONS,
      REST_DURATION_SPECIMEN_JANKO_TOKENS,
      'rest specimen',
    ],
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
// 17. Studio: two grid cards, twelve windows, no strip
// ---------------------------------------------------------------------------

test('The live studio renders the decided round with zero cards', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 0, 'zero cards');
  assert.match(html, /data-candidate-count="0"/);
  assert.match(html, /data-window-count="0"/, 'zero windows');
  assert.match(html, /data-decided="true"/, 'the decided round is marked');
  assert.match(html, /Round 33/);
  assert.match(html, /no active comparison/i, 'the decided title headlines the view');
  for (const id of ROUND_33_CARDS) {
    assert.ok(!html.includes(`data-candidate="${id}"`), `${id} stays parked`);
  }
  assert.equal((html.match(/data-lint="violations"/g) ?? []).length, 0, 'no card chips at all');
});

test('The closer-comparison strip is absent in the decided round', () => {
  const html = renderCompareStrip(CONFIG);
  assert.equal(html, '', 'no active comparison — no strip to compare');
});
