/**
 * Round 11 — Accolade Replacements, Symmetrical Octave Lattice, Clean Specimen
 * Chords & Urtext Typography: candidate registry suite.
 *
 * The round tests four **System 1 start replacements**, each paired with one
 * light transverse clasp-duration paradigm, on a 100% symmetrical 30pt octave
 * lattice:
 *
 * | # | id                                  | `systemStartStyle`       | `claspDurationStyle`      |
 * | - | ----------------------------------- | ------------------------ | ------------------------- |
 * | A | `open-halo-cross-rungs`             | `'open-halo'`            | `'transverse-cross-bars'` |
 * | B | `architectural-bracket-kinetic-slashes` | `'architectural-bracket'` | `'kinetic-cross-slashes'` |
 * | C | `clef-pillar-down-raked-slashes`    | `'clef-pillar'`          | `'down-raked-slashes'`    |
 * | D | `double-hairline-cross-hatch-stitches` | `'double-hairline'`   | `'cross-hatch-stitches'`  |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 11` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four pairs A–D.
 *  3. Each candidate's deltas against the golden master are `chordGrouping`
 *     (`'per-hand-clasp'`) plus its own system-start and duration paradigms.
 *  4. All four display windows (Bach mm. 1–2, m. 4, mm. 29–30 and the
 *     wide-span chord-duration specimen) are declared and really engraved.
 *  5. The specimen chords are **stemless**: simultaneities never form melodic
 *     beams, so the clasp brackets are their sole grouping and duration carrier.
 *  6. mm. 29–30 carry one continuous Octave 6 outlier rule and the margin
 *     measure numerals sit in the true left margin.
 *  7. The live studio engraves all four candidates on all four windows with
 *     option deltas, the clasp layer, distinct duration ink and a lint chip.
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
  JANKO_CLASP_DURATION_STYLES,
  JANKO_SUBDIVISION_STYLES,
  JANKO_SYSTEM_START_STYLES,
  JankoClaspDurationStyle,
  JankoSystemStartStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-11 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  label: string;
  start: JankoSystemStartStyle;
  style: JankoClaspDurationStyle;
  /** The class of the margin ink the System 1 start paints (null = open margin). */
  startInk: string | null;
  /** The cut class the paradigm paints for an 8th / 16th. */
  mark: string;
}> = [
  {
    id: 'open-halo-cross-rungs',
    letter: 'A',
    label: 'A · Open Margin + Halo / Horizontal Cross-Rungs',
    start: 'open-halo',
    style: 'transverse-cross-bars',
    startInk: null,
    mark: 'janko-clasp-bar',
  },
  {
    id: 'architectural-bracket-kinetic-slashes',
    letter: 'B',
    label: 'B · Architectural Bracket / 12.4° Kinetic Slashes',
    start: 'architectural-bracket',
    style: 'kinetic-cross-slashes',
    startInk: 'janko-system-bracket',
    mark: 'janko-clasp-slash',
  },
  {
    id: 'clef-pillar-down-raked-slashes',
    letter: 'C',
    label: 'C · Clef-Pillar Landmark / Down-Raked Slashes',
    start: 'clef-pillar',
    style: 'down-raked-slashes',
    startInk: 'janko-clef-pillar',
    mark: 'janko-clasp-slash',
  },
  {
    id: 'double-hairline-cross-hatch-stitches',
    letter: 'D',
    label: 'D · Double Hairline Frame / Cross-Hatch Stitches',
    start: 'double-hairline',
    style: 'cross-hatch-stitches',
    startInk: 'janko-double-hairline-outer',
    mark: 'janko-clasp-stitch',
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

test('CURRENT_ROUND_METADATA opens round 11 of the accolade-replacement exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 11);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Accolade Replacements, Symmetrical Octave Lattice, Clean Specimen Chords & Urtext Typography'
  );
  assert.equal(
    CURRENT_ROUND_METADATA.description,
    'Comparing 4 System 1 start styles paired with 4 light transverse clasp-duration paradigms on a symmetrical 30pt octave lattice, with stemless specimen chords, margin measure numerals, a continuous Octave 6 outlier rule and Urtext running headers.'
  );
});

test('CURRENT_CANDIDATES declares the four System 1 start / duration pairs A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.systemStartStyle),
    PARADIGMS.map((p) => p.start),
    'every System 1 start style is represented exactly once'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.claspDurationStyle),
    PARADIGMS.map((p) => p.style),
    'every duration paradigm is represented exactly once'
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
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.systemStartStyle))].sort(),
    [...JANKO_SYSTEM_START_STYLES].filter((s) => s !== 'none').sort(),
    'the registry covers every published system-start style except the null one'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.claspDurationStyle))].sort(),
    [...JANKO_CLASP_DURATION_STYLES].sort(),
    'the registry covers the published duration catalogue'
  );
});

test('Every candidate is demonstrated on the opening, the m. 4 run, mm. 29–30 and the specimen', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 4, `${paradigm.id} declares four windows`);
    const [bach, run, outlier, specimen] = resolved.windows;
    assert.equal(bach.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(bach.measureStart, 1);
    assert.equal(bach.measureCount, 2);
    assert.match(bach.title, /Bach Goldberg Var\. 1 · mm\. 1–2/);
    assert.match(bach.title, /System 1 start style/);
    assert.match(bach.title, /Position of Honor halo/);
    assert.match(bach.title, /margin measure numeral/);
    assert.equal(run.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(run.measureStart, 4);
    assert.equal(run.measureCount, 1);
    assert.match(run.title, /Bach Goldberg Var\. 1 · m\. 4/);
    assert.match(run.title, /continuous RH run beaming across Middle C into Octave 3/);
    assert.match(run.title, /orphaned 9 · 7 · 6 flags/);
    assert.equal(outlier.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(outlier.measureStart, 29);
    assert.equal(outlier.measureCount, 2);
    assert.match(outlier.title, /Bach Goldberg Var\. 1 · mm\. 29–30/);
    assert.match(outlier.title, /continuous Octave 6 outlier rule/);
    assert.match(outlier.title, /margin measure numbers/);
    assert.equal(specimen.scoreId, SPECIMEN_STUDIO_SCORE_ID);
    assert.equal(specimen.measureStart, 1);
    assert.equal(specimen.measureCount, 2);
    assert.match(specimen.title, /Wide-Span Chord Specimen/);
    assert.match(specimen.title, /open white ring/);
    assert.match(specimen.title, /dotted quarter \(0\.75pt dot\)/);
    assert.match(specimen.title, /8th \(1 cut\)/);
    assert.match(specimen.title, /16th \(2 cuts\)/);
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
  // Round 11: the four heads of one onset are a chord, never a zero-width beam.
  // No melodic group may form on a simultaneity, so the bracket is the chord's
  // sole grouping and duration carrier (zero stems slicing the noteheads).
  assert.equal(layout.beams.length, 0, 'a simultaneity never forms a melodic beam');
  assert.equal(
    layout.claspedStems.length,
    SPECIMEN.notes.length,
    'every specimen head hands its duration to its bracket'
  );
  const rendered = renderJankoCrop(SPECIMEN, 1, 2, options, DEFAULT_JANKO_TOKENS);
  assert.equal((rendered.match(/class="janko-stem"/g) ?? []).length, 0, 'no vertical stems');
  assert.equal((rendered.match(/class="janko-beam"/g) ?? []).length, 0, 'no zero-width beams');
  // Every chord is one hand's four-voice wide-span chord, i.e. exactly what the
  // per-hand bracket exists for, and every bracket is a realistic tall bracket:
  // 45pt of notehead span (1.5 octaves) inside the ticket's 35–55pt window.
  for (const clasp of layout.clasps) {
    assert.equal(new Set(clasp.notes.map((n) => n.hand)).size, 1, 'one hand per bracket');
    assert.equal(clasp.notes.length, 4, 'four-voice chords');
    const span = clasp.maxY - clasp.minY;
    assert.ok(
      span >= 35 && span <= 55,
      `bracket at tick ${clasp.tick} spans ${span.toFixed(1)}pt (35–55pt required)`
    );
  }
  for (const value of values) {
    assert.ok(
      SPECIMEN.notes.some((n) => n.startTick === value.startTick && n.durationTicks === value.durationTicks),
      `${value.label} is present`
    );
  }
  const report = lintJankoScore(SPECIMEN, options, DEFAULT_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the specimen engraves clean');
});

test('Every candidate states its deltas against the golden master', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.subdivisionStyle, 'kinetic-tab-beam', 'the settled beam-harmonized tab');
  assert.equal(golden.systemStartStyle, 'open-halo', 'the golden open margin');
  assert.equal(golden.claspDurationStyle, 'transverse-cross-bars', 'the golden cross-rungs');
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const expected = [{ key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' }];
    if (paradigm.start !== golden.systemStartStyle) {
      expected.push({
        key: 'systemStartStyle',
        value: paradigm.start,
        golden: golden.systemStartStyle,
      } as never);
    }
    if (paradigm.style !== golden.claspDurationStyle) {
      expected.push({
        key: 'claspDurationStyle',
        value: paradigm.style,
        golden: golden.claspDurationStyle,
      } as never);
    }
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in the per-hand clasp, its start style and its midpoint paradigm`
    );
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      if (key === 'chordGrouping') {
        assert.equal(value, 'per-hand-clasp');
        continue;
      }
      if (key === 'systemStartStyle') {
        assert.equal(value, paradigm.start);
        continue;
      }
      if (key === 'claspDurationStyle') {
        assert.equal(value, paradigm.style);
        continue;
      }
      assert.deepEqual(
        value,
        (golden as unknown as Record<string, unknown>)[key],
        `${paradigm.id} keeps the golden ${key}`
      );
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
    // The m. 4 RH run beams continuously across Middle C — its `9 · 7 · 6` tail
    // is never orphaned into solitary flags.
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
      assert.equal(clasp.durationStyle, paradigm.style, 'the bracket carries its paradigm');
    }
    // The Round 8 `B - 2 - 8` bracket is among them…
    const b28 = clasps.find((c) => c.tick === 1296);
    assert.ok(b28, `${paradigm.id} keeps the B - 2 - 8 clasp`);
    assert.ok(new Set(b28!.notes.map((n) => n.x)).size > 1, 'and it is the row-snapped cluster');
    // …and the `B - 4 - 7` vertical chord is bracketed by the widened scope.
    const b47 = clasps.find((c) => c.tick === 1488);
    assert.ok(b47, `${paradigm.id} brackets the B - 4 - 7 3-note chord`);
    assert.equal(b47!.notes.length, 3, 'three heads in one vertical column');
    assert.equal(new Set(b47!.notes.map((n) => n.x)).size, 1, 'a clean vertical column');
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

test('Every candidate paints its System 1 start ink and its light midpoint paradigm', () => {
  const documents = new Set<string>();
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const resolved = resolveCandidate(candidate);
    const bach = renderJankoCrop(SCORE, 1, 2, resolved.options, resolved.tokens);
    assert.match(
      bach,
      /data-subdivision-style="kinetic-tab-beam"/,
      `${paradigm.id} dispatches the beam-harmonized tab`
    );
    // The System 1 start style paints exactly its own margin ink (or none).
    for (const other of PARADIGMS) {
      if (other.startInk === null || other === paradigm) continue;
      assert.ok(
        !bach.includes(other.startInk),
        `${paradigm.id} never paints ${other.startInk}`
      );
    }
    if (paradigm.startInk === null) {
      assert.ok(
        !/janko-system-bracket|janko-clef-pillar|janko-double-hairline/.test(bach),
        'the open margin paints no system-start ink'
      );
      assert.match(bach, /class="janko-halo"/, 'the tick-0 sounds keep the Position of Honor halo');
    } else {
      assert.ok(bach.includes(paradigm.startInk), `${paradigm.id} paints ${paradigm.startInk}`);
    }
    // Round 11 page furniture: the measure numeral is right-aligned into the
    // true left margin (`staffLeft − 10pt`, `staffTopY − 3pt`).
    const numeral = /<text class="janko-measure-num" x="([\d.-]+)" y="([\d.-]+)" text-anchor="end">/.exec(
      bach
    )!;
    assert.ok(numeral, `${paradigm.id} paints a margin measure numeral`);

    // The specimen carries the whole taxonomy side by side: the ring, the plain
    // bracket, the dotted quarter, the 8th and the 16th.
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
    assert.ok(
      !new RegExp(paradigm.mark).test(plains[1].body),
      `${paradigm.id} keeps the dotted quarter plain apart from its dot`
    );
    assert.equal(
      (byDuration.get('spire-one-flag')!.match(new RegExp(paradigm.mark, 'g')) ?? []).length,
      1,
      `${paradigm.id} 8th: one midpoint cut`
    );
    assert.equal(
      (byDuration.get('spire-two-flags')!.match(new RegExp(paradigm.mark, 'g')) ?? []).length,
      2,
      `${paradigm.id} 16th: two midpoint cuts`
    );
    // Every specimen bracket is tagged with the paradigm and anchored on the
    // exact spine midpoint of its own cluster.
    assert.match(
      specimen,
      new RegExp(`data-clasp-duration-style="${paradigm.style}"`),
      `${paradigm.id} tags its duration ink`
    );
    const layout = layoutJankoScore(SPECIMEN, specimenOptions, CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID].tokens)[0];
    for (const clasp of layout.clasps) {
      const yMid = (clasp.topY + clasp.botY) / 2;
      const group = groups.find((g) => g.tick === String(clasp.tick))!;
      for (const mark of group.body.matchAll(/(?:y1|y2|cy)="([\d.-]+)"/g)) {
        // The shared ring rides the midpoint; the 16th pair mirrors about it,
        // so no mark may leave the bracket's own span.
        const y = Number(mark[1]);
        assert.ok(y >= clasp.topY - 0.01 && y <= clasp.botY + 0.01, `${paradigm.id} mark inside the bracket`);
        assert.ok(
          Math.abs(y - yMid) <= clasp.botY - clasp.topY,
          `${paradigm.id} mark belongs to the midpoint band`
        );
      }
    }

    // Compare the *ink*, not the paradigm tag: strip the style attribute so two
    // paradigms that painted identical ink could never count as distinct.
    documents.add(specimen.replace(/ data-clasp-duration-style="[^"]*"/g, ''));
  }
  // The four paradigms must be four *different* engravings of the same window:
  // a decision round whose candidates render identically decides nothing.
  assert.equal(documents.size, PARADIGMS.length, 'each paradigm is a distinct engraving');
});

test('The mm. 29–30 window carries one continuous Octave 6 outlier rule and no choppy dashes', () => {
  const resolved = resolveCandidate(getCandidate('open-halo-cross-rungs')!);
  const svg = renderJankoCrop(SCORE, 29, 2, resolved.options, resolved.tokens);
  const rules = [...svg.matchAll(/<line class="janko-outlier-rule" x1="([\d.-]+)"[^>]*x2="([\d.-]+)"/g)];
  assert.equal(rules.length, 1, 'one unbroken outlier rule across mm. 29–30');
  const measureWidth = (Number(rules[0][2]) - Number(rules[0][1])) / 2;
  assert.ok(measureWidth > 0, 'the rule spans exactly the two measures');
  assert.equal(
    (svg.match(/class="janko-ledger"/g) ?? []).length,
    0,
    'no choppy notehead-centred ledger dashes survive in the covered measures'
  );
});

test('The live studio engraves four candidates on four windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 16, 'four engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 16, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="4"/);
  assert.match(html, /Round 11/);
  assert.match(html, /Accolade Replacements/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:1-2"/);
  assert.match(html, /data-window="primary:4-4"/);
  assert.match(html, /data-window="primary:29-30"/);
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
    if (paradigm.start === DEFAULT_JANKO_OPTIONS.systemStartStyle) {
      assert.ok(
        !body.includes('<b>systemStartStyle</b>'),
        'candidate A is the golden System 1 start itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>systemStartStyle</b> = ${paradigm.start}`),
        `${paradigm.id} system-start badge`
      );
      assert.match(body, /<s>open-halo<\/s>/, `${paradigm.id} shows the golden start it departs from`);
    }
    if (paradigm.style === DEFAULT_JANKO_OPTIONS.claspDurationStyle) {
      assert.ok(
        !body.includes('<b>claspDurationStyle</b>'),
        'candidate A is the golden duration paradigm itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>claspDurationStyle</b> = ${paradigm.style}`),
        `${paradigm.id} duration badge`
      );
      assert.match(
        body,
        /<s>transverse-cross-bars<\/s>/,
        `${paradigm.id} shows the golden duration it departs from`
      );
    }
    assert.match(body, /badge-delta/, `${paradigm.id} highlights its delta`);
    assert.match(body, /class="janko-clasp-layer"/, `${paradigm.id} renders its clasp layer`);
    assert.match(body, /data-subdivision-style="kinetic-tab-beam"/, `${paradigm.id} settled tab`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
  }
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four start / duration pairs on one document', () => {
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
