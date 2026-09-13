/**
 * Round 12 — Rest Symbol Dialects, Continuous Vertical Grid, Start Symbols &
 * Grid Writing Policies: candidate registry suite.
 *
 * The round tests four **rest dialects**, each paired with one refined
 * architectural System 1 start symbol and one vertical-grid writing policy:
 *
 * | # | id                                        | `restStyle`         | `systemStartStyle`       | `gridWritingPolicy`        |
 * | - | ----------------------------------------- | ------------------- | ------------------------ | -------------------------- |
 * | A | `kinetic-monoline-architectural-bracket`  | `'kinetic-monoline'`| `'architectural-bracket'`| `'overlaid-beat-grid'`     |
 * | B | `classical-urtext-delicate-bracket`       | `'classical-urtext'`| `'delicate-bracket'`     | `'strict-protected-grid'`  |
 * | C | `geometric-node-clef-pillar`              | `'geometric-node'`  | `'clef-pillar'`          | `'unified-transparent-grid'` |
 * | D | `bauhaus-slash-architectural-bracket`     | `'bauhaus-slash'`   | `'architectural-bracket'`| `'overlaid-beat-grid'`     |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 12` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four pairs A–D.
 *  3. Each candidate's deltas against the golden master are `chordGrouping`
 *     (`'per-hand-clasp'`) plus its own rest dialect, start symbol and grid
 *     writing policy.
 *  4. All four display windows (Bach mm. 1–2, m. 4, mm. 27–29 and the
 *     wide-span chord specimen) are declared and really engraved.
 *  5. The m. 4 tick-552 silence is written as a 16th rest in the RH on the
 *     Octave 4 equator, in the candidate's own dialect.
 *  6. The specimen chords are **stemless** and carry the standardized up-raked
 *     12.4° kinetic clasps.
 *  7. The live studio engraves all four candidates on all four windows with
 *     option deltas, the rest layer and a clean lint chip.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  CHORD_DURATION_SPECIMEN_VALUES,
  buildChordDurationSpecimenScore,
} from '../src/scores/chord-duration-specimen';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DEFAULT_STUDIO_SCORE_ID,
  SPECIMEN_STUDIO_SCORE_ID,
  candidateBadges,
  getCandidate,
  resolveCandidate,
} from '../src/render/janko/candidates';
import { createStudioConfig, renderCandidatesView } from '../src/render/janko/studio';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_GRID_WRITING_POLICIES,
  JANKO_REST_STYLES,
  JANKO_SUBDIVISION_STYLES,
  JANKO_SYSTEM_START_STYLES,
  JankoGridWritingPolicy,
  JankoRestStyle,
  JankoSystemStartStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-12 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  label: string;
  rest: JankoRestStyle;
  start: JankoSystemStartStyle;
  grid: JankoGridWritingPolicy;
  /** The class of the rest ink the dialect paints on the m. 4 16th. */
  restInk: string;
  /** The class of the margin ink the System 1 start paints. */
  startInk: string;
}> = [
  {
    id: 'kinetic-monoline-architectural-bracket',
    letter: 'A',
    label: 'A · Kinetic Monoline Rests / Architectural Bracket (0.65pt)',
    rest: 'kinetic-monoline',
    start: 'architectural-bracket',
    grid: 'overlaid-beat-grid',
    restInk: 'janko-rest-tab',
    startInk: 'janko-system-bracket',
  },
  {
    id: 'classical-urtext-delicate-bracket',
    letter: 'B',
    label: 'B · Classical Urtext Rests / Delicate Bracket (0.50pt)',
    rest: 'classical-urtext',
    start: 'delicate-bracket',
    grid: 'strict-protected-grid',
    restInk: 'janko-rest-hook',
    startInk: 'janko-system-bracket-delicate',
  },
  {
    id: 'geometric-node-clef-pillar',
    letter: 'C',
    label: 'C · Geometric Node Rests / Nib-Free Clef Pillar',
    rest: 'geometric-node',
    start: 'clef-pillar',
    grid: 'unified-transparent-grid',
    restInk: 'janko-rest-node',
    startInk: 'janko-clef-pillar',
  },
  {
    id: 'bauhaus-slash-architectural-bracket',
    letter: 'D',
    label: 'D · Bauhaus Hairline Rests / Architectural Bracket (0.65pt)',
    rest: 'bauhaus-slash',
    start: 'architectural-bracket',
    grid: 'overlaid-beat-grid',
    restInk: 'janko-rest-slash',
    startInk: 'janko-system-bracket',
  },
];

/** The studio HTML-escapes labels and rationales before printing them. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The clasp groups of one rendered document, keyed by their duration class. */
function claspGroups(svg: string): Array<{ tick: string; duration: string; body: string }> {
  return [...svg.matchAll(
    /<g class="janko-clasp-group"[^>]*data-clasp-tick="(\d+)"[^>]*data-clasp-duration="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g
  )].map((m) => ({ tick: m[1], duration: m[2], body: m[3] }));
}

test('CURRENT_ROUND_METADATA opens round 12 of the rest-dialect exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 12);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Rest Symbol Dialects, Continuous Vertical Grid, Start Symbols & Grid Writing Policies'
  );
  assert.equal(
    CURRENT_ROUND_METADATA.description,
    'Comparing 4 rest symbol dialects, testing the 3-way grid writing policy on mm. 27 & 29, with continuous barlines and beat lines across Middle C and refined architectural start symbols.'
  );
});

test('CURRENT_CANDIDATES declares the four rest dialect / start symbol / grid policy pairs A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.restStyle),
    PARADIGMS.map((p) => p.rest),
    'every rest dialect is represented exactly once'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.systemStartStyle),
    PARADIGMS.map((p) => p.start),
    'the three refined architectural start symbols are represented'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.gridWritingPolicy),
    PARADIGMS.map((p) => p.grid),
    'every grid writing policy is represented'
  );
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id);
    assert.ok(candidate, `${paradigm.id} is registered`);
    assert.equal(candidate!.label, paradigm.label, `${paradigm.id} label`);
    assert.ok(
      (candidate!.description ?? '').length > 120,
      `${paradigm.id} carries a rationale`
    );
    assert.ok((candidate!.tags ?? []).length > 0, `${paradigm.id} is tagged`);
    assert.ok(paradigm.label.startsWith(`${paradigm.letter} · `), `${paradigm.id} is candidate ${paradigm.letter}`);
  }
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.restStyle))].sort(),
    [...JANKO_REST_STYLES].sort(),
    'the registry covers the published rest catalogue'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.systemStartStyle))].sort(),
    ['architectural-bracket', 'clef-pillar', 'delicate-bracket'],
    'the round narrows System 1 to the three architectural finalists'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.gridWritingPolicy))].sort(),
    [...JANKO_GRID_WRITING_POLICIES].sort(),
    'the registry covers the published grid writing catalogue'
  );
  assert.ok(
    JANKO_SYSTEM_START_STYLES.includes('delicate-bracket'),
    'the Round 12 delicate bracket is part of the published catalogue'
  );
});

test('Every candidate is demonstrated on the opening, the m. 4 rest, mm. 27–29 and the specimen', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 4, `${paradigm.id} declares four windows`);
    const [bach, rest, dense, specimen] = resolved.windows;
    assert.equal(bach.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(bach.measureStart, 1);
    assert.equal(bach.measureCount, 2);
    assert.match(bach.title, /Bach Goldberg Var\. 1 · mm\. 1–2/);
    assert.match(bach.title, /System 1 start symbols/);
    assert.match(bach.title, /architectural bracket/);
    assert.match(bach.title, /delicate bracket/);
    assert.match(bach.title, /nib-free clef pillar/);
    assert.equal(rest.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(rest.measureStart, 4);
    assert.equal(rest.measureCount, 1);
    assert.match(rest.title, /Bach Goldberg Var\. 1 · m\. 4/);
    assert.match(rest.title, /4 rest dialects at tick 552/);
    assert.match(rest.title, /Octave 4 equator/);
    assert.equal(dense.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(dense.measureStart, 27);
    assert.equal(dense.measureCount, 3);
    assert.match(dense.title, /Bach Goldberg Var\. 1 · mm\. 27–29/);
    assert.match(dense.title, /3-way grid writing policy/);
    assert.match(dense.title, /continuous barlines and beat lines across Middle C/);
    assert.equal(specimen.scoreId, SPECIMEN_STUDIO_SCORE_ID);
    assert.equal(specimen.measureStart, 1);
    assert.equal(specimen.measureCount, 2);
    assert.match(specimen.title, /Wide-Span Chord Specimen/);
    assert.match(specimen.title, /12\.4° kinetic clasps/);
    assert.match(specimen.title, /open white ring/);
    assert.match(specimen.title, /stemless 1\.5-octave chords/);
    // The legacy single-window fields keep pointing at the first window.
    assert.equal(resolved.measureStart, 1);
    assert.equal(resolved.measureCount, 2);
  }
});

test('The wide-span chord specimen carries the whole taxonomy and is stemless', () => {
  const values = CHORD_DURATION_SPECIMEN_VALUES;
  assert.deepEqual(
    values.map((v) => v.durationTicks),
    [96, 48, 72, 24, 12],
    'half, quarter, dotted quarter, 8th, 16th — in order'
  );
  const options = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    chordGrouping: 'per-hand-clasp',
    measuresPerSystem: 2,
  });
  const layout = layoutJankoScore(SPECIMEN, options, DEFAULT_JANKO_TOKENS)[0];
  assert.equal(layout.clasps.length, values.length, 'one bracket per demonstrated value');
  assert.deepEqual(
    layout.clasps.map((c) => c.durationTicks),
    values.map((v) => v.durationTicks),
    'the brackets carry exactly the demonstrated values'
  );
  assert.deepEqual(
    layout.clasps.map((c) => `${c.duration}:${c.flags}${c.dotted ? '+dot' : ''}`),
    ['pip:0', 'spire:0', 'spire:0+dot', 'spire-one-flag:1', 'spire-two-flags:2'],
    'the taxonomy lands as open ring / plain / plain+dot / 1 cut / 2 cuts'
  );
  // Round 12 standardizes the up-raked 12.4° kinetic clasp on the golden master.
  assert.equal(
    DEFAULT_JANKO_OPTIONS.claspDurationStyle,
    'kinetic-cross-slashes',
    'the settled midpoint paradigm'
  );
  for (const clasp of layout.clasps) {
    assert.equal(clasp.durationStyle, 'kinetic-cross-slashes', 'every bracket speaks the settled rake');
  }
  // Round 11: the four heads of one onset are a chord, never a zero-width beam.
  assert.equal(layout.beams.length, 0, 'a simultaneity never forms a melodic beam');
  assert.equal(
    layout.claspedStems.length,
    SPECIMEN.notes.length,
    'every specimen head hands its duration to its bracket'
  );
  const rendered = renderJankoCrop(SPECIMEN, 1, 2, options, DEFAULT_JANKO_TOKENS);
  assert.equal((rendered.match(/class="janko-stem"/g) ?? []).length, 0, 'no vertical stems');
  assert.equal((rendered.match(/class="janko-beam"/g) ?? []).length, 0, 'no zero-width beams');
  assert.ok(
    (rendered.match(/class="janko-clasp-slash"/g) ?? []).length > 0,
    'the 8th / 16th chords carry the up-raked kinetic slashes'
  );
  // Round 12: the specimen's m. 2 silence is written too (an 8th rest in the RH).
  assert.equal(layout.rests.length, 1, 'the specimen writes its silence');
  assert.equal(layout.rests[0].value, 'eighth');
  assert.match(rendered, /<g class="janko-rest-group"[^>]*data-rest-value="eighth"/);
  for (const value of values) {
    assert.ok(
      SPECIMEN.notes.some((n) => n.startTick === value.startTick && n.durationTicks === value.durationTicks),
      `${value.label} is present`
    );
  }
  const report = lintJankoScore(SPECIMEN, options, DEFAULT_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the specimen engraves clean');
  assert.equal(report.warnings.length, 0, 'with no warning');
});

test('Every candidate states its deltas against the golden master', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.subdivisionStyle, 'kinetic-tab-beam', 'the settled beam-harmonized tab');
  assert.equal(golden.systemStartStyle, 'open-halo', 'the golden open margin');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the golden rest dialect');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'the golden grid writing policy');
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const expected: Array<{ key: string; value: string; golden: string }> = [
      { key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' },
      { key: 'restStyle', value: paradigm.rest, golden: golden.restStyle },
      {
        key: 'systemStartStyle',
        value: paradigm.start,
        golden: golden.systemStartStyle,
      },
      {
        key: 'gridWritingPolicy',
        value: paradigm.grid,
        golden: golden.gridWritingPolicy,
      },
    ].filter((delta) => delta.value !== delta.golden);
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in the per-hand clasp and whichever of its rest dialect / start symbol / grid policy is not already golden`
    );
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      const expectedValue = (expected.find((e) => e.key === key)?.value ??
        (golden as unknown as Record<string, unknown>)[key]) as unknown;
      assert.deepEqual(value, expectedValue, `${paradigm.id} keeps the golden ${key}`);
    }
    assert.deepEqual(resolved.tokens, DEFAULT_JANKO_TOKENS, `${paradigm.id} keeps every token`);
  }
  assert.ok(
    JANKO_SUBDIVISION_STYLES.includes('kinetic-tab-beam'),
    'the settled beam-harmonized tab is part of the published catalogue'
  );
});

test('Every candidate engraves both benchmarks and the specimen with the scope and lint it claims', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    // The Bach opening is melodic: no hand carries a row-snapped cluster or a
    // 3-note chord, so the per-hand clasp never appears there.
    const bach = layoutJankoScore(SCORE, resolved.options, resolved.tokens);
    assert.equal(bach.reduce((n, l) => n + l.clasps.length, 0), 0, `${paradigm.id} Bach clasps`);
    // The m. 4 RH run beams continuously across Middle C.
    const m4 = bach[0].beams.filter((b) => b.notes.some((n) => n.startTick >= 528 && n.startTick < 576));
    assert.ok(
      m4.some((b) => b.notes.some((n) => n.startTick === 540)),
      `${paradigm.id} beams the m. 4 run through tick 540`
    );
    assert.equal(
      bach[0].ungrouped.filter((n) => n.startTick >= 528 && n.startTick < 576).length,
      0,
      `${paradigm.id} leaves no orphaned flag in the m. 4 run`
    );
    // The Brahms block chords carry both bracket routes.
    const brahmsOptions = resolveJankoOptions({
      ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      ...(getCandidate(paradigm.id)!.options ?? {}),
    });
    const brahms = layoutJankoScore(BRAHMS, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const clasps = brahms.flatMap((l) => l.clasps);
    assert.equal(clasps.length, 11, `${paradigm.id} Brahms clasp count`);
    for (const clasp of clasps) {
      assert.equal(new Set(clasp.notes.map((n) => n.hand)).size, 1, 'one hand per bracket');
      assert.equal(clasp.durationStyle, 'kinetic-cross-slashes', 'the bracket carries the settled rake');
    }
    // The Round 8 `B - 2 - 8` bracket is among them…
    const b28 = clasps.find((c) => c.tick === 1296);
    assert.ok(b28, `${paradigm.id} keeps the B - 2 - 8 clasp`);
    assert.ok(new Set(b28!.notes.map((n) => n.x)).size > 1, 'and it is the row-snapped cluster');
    // …and the `B - 4 - 7` vertical chord is bracketed by the widened scope.
    const b47 = clasps.find((c) => c.tick === 1488);
    assert.ok(b47, `${paradigm.id} brackets the B - 4 - 7 3-note chord`);
    assert.equal(b47!.notes.length, 3, 'three heads in one vertical column');
    // Option 3 still gap-gates the clean 2-note columns only.
    const chords = brahms.flatMap((l) => l.verticalChords);
    assert.ok(chords.length > 0, `${paradigm.id} gap-gates clean vertical hand columns`);
    for (const chord of chords) {
      assert.equal(chord.suppressedIds.length, 1, 'Option 3 now handles 2-note columns only');
      for (const bridge of chord.bridges) {
        assert.ok(bridge.y2 > bridge.y1, 'a bridge spans real air');
        assert.equal(bridge.noteIds.length, 2, 'a bridge unifies exactly two heads');
      }
    }
    // The melodic writing is untouched: beams are identical in every paradigm.
    const golden = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
    assert.deepEqual(
      brahms.map((l) => l.beams.length),
      golden.map((l) => l.beams.length),
      `${paradigm.id} never re-partitions a beam`
    );
    for (const [score, options, tokens] of [
      [SCORE, resolved.options, resolved.tokens],
      [BRAHMS, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS],
    ] as const) {
      const report = lintJankoScore(score, options, tokens);
      assert.equal(report.ok, true, `${paradigm.id} engraves clean`);
      assert.equal(report.warnings.length, 0, `${paradigm.id} adds no warning`);
    }
  }
});

test('Every candidate paints its rest dialect, its System 1 start ink and its grid policy', () => {
  const documents = new Set<string>();
  const foreignRestInk: Record<JankoRestStyle, RegExp> = {
    'kinetic-monoline': /janko-rest-(hook|lightning|block|node|ray|capsule|slash|wing|z|box)/,
    'classical-urtext': /janko-rest-(stem|tab|notch|bar|node|ray|capsule|slash|wing|z|box)/,
    'geometric-node': /janko-rest-(stem|tab|notch|bar|hook|lightning|block|slash|wing|z|box)/,
    'bauhaus-slash': /janko-rest-(stem|tab|notch|bar|hook|lightning|block|node|ray|capsule)/,
  };
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const resolved = resolveCandidate(candidate);
    const bach = renderJankoCrop(SCORE, 1, 2, resolved.options, resolved.tokens);
    assert.match(
      bach,
      /data-subdivision-style="kinetic-tab-beam"/,
      `${paradigm.id} dispatches the beam-harmonized tab`
    );
    // The System 1 start symbol paints exactly its own margin ink (or none).
    for (const other of PARADIGMS) {
      if (other.startInk === paradigm.startInk || other === paradigm) continue;
      if (other.startInk === 'janko-system-bracket' && paradigm.startInk === 'janko-system-bracket') continue;
      assert.ok(
        !bach.includes(other.startInk) ||
          (other.startInk === 'janko-system-bracket' &&
            paradigm.startInk === 'janko-system-bracket-delicate') ||
          (other.startInk === 'janko-system-bracket-delicate' &&
            paradigm.startInk === 'janko-system-bracket'),
        `${paradigm.id} never paints ${other.startInk}`
      );
    }
    assert.ok(bach.includes(paradigm.startInk), `${paradigm.id} paints ${paradigm.startInk}`);
    if (paradigm.start === 'architectural-bracket') {
      assert.match(bach, /class="janko-system-bracket" [^>]*stroke-width="0\.65"/);
    }
    if (paradigm.start === 'delicate-bracket') {
      assert.match(bach, /class="janko-system-bracket-delicate" [^>]*stroke-width="0\.50"/);
    }
    if (paradigm.start === 'clef-pillar') {
      assert.equal(
        (bach.match(/class="janko-clef-pillar-tick"/g) ?? []).length,
        4,
        'the nib-free pillar ticks the four octave equators only'
      );
    }

    // The Round 12 rest layer: the m. 4 tick-552 16th silence in the RH.
    const restCrop = renderJankoCrop(SCORE, 4, 1, resolved.options, resolved.tokens);
    const group = new RegExp(
      `<g class="janko-rest-group" data-rest-tick="552" data-rest-value="sixteenth" data-rest-hand="RH" data-rest-style="${paradigm.rest}">`
    );
    assert.match(restCrop, group, `${paradigm.id} writes the m. 4 silence in its own dialect`);
    assert.match(restCrop, new RegExp(paradigm.restInk), `${paradigm.id} paints ${paradigm.restInk}`);
    assert.ok(
      !foreignRestInk[paradigm.rest].test(restCrop),
      `${paradigm.id} never paints another dialect's rest ink`
    );
    const m4Rest = layoutJankoScore(SCORE, resolved.options, resolved.tokens)
      .flatMap((l) => l.rests)
      .find((r) => r.tick === 552)!;
    assert.equal(m4Rest.hand, 'RH');
    assert.equal(m4Rest.value, 'sixteenth');
    // Under the protected policies the rest stands on the canonical tick-552
    // beat column (x ≈ 544.97pt), exactly as the ticket specifies. The
    // transparent policy withdraws the measure inset, so the column shifts with
    // the rest of the music: it then only has to stay inside its own measure,
    // left of the tick-564 resumption.
    const system0 = layoutJankoScore(SCORE, resolved.options, resolved.tokens)[0];
    if (paradigm.grid !== 'unified-transparent-grid') {
      assert.ok(Math.abs(m4Rest.x - 544.97) < 0.01, `${paradigm.id} tick-552 column`);
    } else {
      const measureLeft = system0.geometry.staffLeft + 3 * system0.geometry.measureWidth;
      const resumption = system0.notes.find((p) => p.note.startTick === 564 && p.rhythm.hand === 'RH')!;
      assert.ok(m4Rest.x > measureLeft, `${paradigm.id} rest stays inside m. 4`);
      assert.ok(m4Rest.x < resumption.x, `${paradigm.id} rest precedes the tick-564 resumption`);
    }

    // The grid writing policy: only the strict policy channels the grid.
    const dense = renderJankoCrop(SCORE, 27, 3, resolved.options, resolved.tokens);
    const channels = (dense.match(/class="janko-grid-channel"/g) ?? []).length;
    if (paradigm.grid === 'strict-protected-grid') {
      assert.ok(channels > 0, `${paradigm.id} paints its dedicated white air channels`);
    } else {
      assert.equal(channels, 0, `${paradigm.id} reserves no air channel`);
    }
    // Under every policy the grid stays one continuous rule across Middle C.
    for (const line of dense.matchAll(
      /<line class="janko-(?:barline|beat-line)" x1="[\d.-]+" y1="([\d.-]+)" x2="[\d.-]+" y2="([\d.-]+)"/g
    )) {
      assert.ok(Number(line[1]) < Number(line[2]), `${paradigm.id} grid lines are unbroken`);
    }

    // The specimen carries the standardized kinetic clasp taxonomy side by side.
    const specimenOptions = resolveJankoOptions({
      ...CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID].options,
      ...(candidate.options ?? {}),
    });
    const specimen = renderJankoCrop(
      SPECIMEN,
      1,
      2,
      specimenOptions,
      CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID].tokens
    );
    const groups = claspGroups(specimen);
    assert.equal(groups.length, 5, `${paradigm.id} paints five specimen brackets`);
    const byDuration = new Map(groups.map((g) => [g.duration, g.body]));
    assert.equal(
      (byDuration.get('pip')!.match(/janko-clasp-ring/g) ?? []).length,
      1,
      `${paradigm.id} half: one shared open white ring`
    );
    const plains = groups.filter((g) => g.duration === 'spire');
    assert.equal(plains.length, 2, `${paradigm.id} paints a quarter and a dotted quarter`);
    assert.ok(
      !/janko-clasp-(ring|bar|slash|stitch|dot|pip)/.test(plains[0].body),
      `${paradigm.id} quarter: the plain bracket`
    );
    assert.equal(
      (plains[1].body.match(/janko-clasp-dot/g) ?? []).length,
      1,
      `${paradigm.id} dotted quarter: the plain bracket + one dot`
    );
    assert.equal(
      (byDuration.get('spire-one-flag')!.match(/janko-clasp-slash/g) ?? []).length,
      1,
      `${paradigm.id} 8th: one up-raked slash`
    );
    assert.equal(
      (byDuration.get('spire-two-flags')!.match(/janko-clasp-slash/g) ?? []).length,
      2,
      `${paradigm.id} 16th: two up-raked slashes`
    );
    assert.match(
      specimen,
      /data-clasp-duration-style="kinetic-cross-slashes"/,
      `${paradigm.id} tags the settled duration paradigm`
    );

    // Compare the *ink*, not the tags: strip the style attributes so two
    // paradigms that painted identical ink could never count as distinct.
    documents.add(
      specimen
        .replace(/ data-clasp-duration-style="[^"]*"/g, '')
        .replace(/ data-rest-style="[^"]*"/g, '')
    );
  }
  // The four paradigms must be four *different* engravings of the same window:
  // a decision round whose candidates render identically decides nothing.
  assert.equal(documents.size, PARADIGMS.length, 'each paradigm is a distinct engraving');
});

test('The live studio engraves four candidates on four windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 16, 'four engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 16, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="4"/);
  assert.match(html, /Round 12/);
  assert.match(html, /Rest Symbol Dialects/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:1-2"/);
  assert.match(html, /data-window="primary:4-4"/);
  assert.match(html, /data-window="primary:27-29"/);
  assert.match(html, /data-window="chord-duration-specimen:1-2"/);

  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = html.indexOf(`data-candidate="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} appears in registry order`);
    cursor = at;
    const card = html.slice(at);
    const body = card.slice(0, card.indexOf('</article>'));
    assert.ok(body.includes(esc(getCandidate(paradigm.id)!.label)), `${paradigm.id} label`);
    assert.ok(
      body.includes(esc(getCandidate(paradigm.id)!.description ?? '')),
      `${paradigm.id} rationale`
    );
    assert.match(body, /<b>chordGrouping<\/b> = per-hand-clasp/, `${paradigm.id} grouping badge`);
    assert.match(body, /<s>none<\/s>/, `${paradigm.id} shows the golden grouping it departs from`);
    if (paradigm.rest === DEFAULT_JANKO_OPTIONS.restStyle) {
      assert.ok(
        !body.includes('<b>restStyle</b>'),
        'candidate A is the golden rest dialect itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>restStyle</b> = ${paradigm.rest}`),
        `${paradigm.id} rest badge`
      );
      assert.match(body, /<s>kinetic-monoline<\/s>/, 'the golden rest dialect is shown');
    }
    if (paradigm.start === DEFAULT_JANKO_OPTIONS.systemStartStyle) {
      assert.ok(
        !body.includes('<b>systemStartStyle</b>'),
        'the candidate is the golden System 1 start itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>systemStartStyle</b> = ${paradigm.start}`),
        `${paradigm.id} system-start badge`
      );
      assert.match(body, /<s>open-halo<\/s>/, `${paradigm.id} shows the golden start it departs from`);
    }
    if (paradigm.grid === DEFAULT_JANKO_OPTIONS.gridWritingPolicy) {
      assert.ok(
        !body.includes('<b>gridWritingPolicy</b>'),
        'candidate A and D are the golden grid policy itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>gridWritingPolicy</b> = ${paradigm.grid}`),
        `${paradigm.id} grid policy badge`
      );
      assert.match(
        body,
        /<s>overlaid-beat-grid<\/s>/,
        `${paradigm.id} shows the golden policy it departs from`
      );
    }
    assert.match(body, /badge-delta/, `${paradigm.id} highlights its delta`);
    assert.match(body, /class="janko-clasp-layer"/, `${paradigm.id} renders its clasp layer`);
    assert.match(body, /class="janko-rest-group"/, `${paradigm.id} renders its rest layer`);
    assert.match(body, /data-subdivision-style="kinetic-tab-beam"/, `${paradigm.id} settled tab`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
  }
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four rest / start / grid pairs on one document', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => {
    const resolved = resolveCandidate(candidate);
    return { id: candidate.id, label: candidate.label, options: resolved.options };
  });
  const specimen = CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID];
  const sheet = renderJankoVariantComparison(
    SPECIMEN,
    specs,
    1,
    2,
    specimen.options,
    specimen.tokens
  );
  assert.equal((sheet.match(/<svg/g) ?? []).length, 1, 'one sheet document');
  assert.equal((sheet.match(/data-variant="/g) ?? []).length, 4, 'four stacked panels');
  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = sheet.indexOf(`data-variant="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} panel is in order`);
    cursor = at;
    const next = sheet.indexOf('data-variant="', at + 1);
    const panel = sheet.slice(at, next === -1 ? undefined : next);
    // The specimen is all simultaneities: no melodic beam and no standalone
    // flag survives, because the brackets carry every duration.
    assert.match(panel, /class="janko-clasp-layer"/, `${paradigm.id} paints its clasp layer`);
    assert.equal(
      (panel.match(/class="janko-stem"/g) ?? []).length,
      0,
      `${paradigm.id} leaves the specimen chords stemless`
    );
  }
});
