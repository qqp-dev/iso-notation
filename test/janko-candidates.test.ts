/**
 * Round 13 — Voice Contour Rests, Flared 0.65pt Bracket & Beam Discontinuity:
 * candidate registry suite.
 *
 * The round compares the four **high-fidelity rest dialects** under the
 * standardized flared architectural bracket:
 *
 * | # | id                                    | `restStyle`          |
 * | - | ------------------------------------- | -------------------- |
 * | A | `classical-urtext-flared-bracket`     | `'classical-urtext'` |
 * | B | `phantom-notehead-flared-bracket`     | `'phantom-notehead'` |
 * | C | `geometric-node-flared-bracket`       | `'geometric-node'`   |
 * | D | `kinetic-monoline-flared-bracket`     | `'kinetic-monoline'` |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 13` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four rest finalists A–D, all
 *     under the same flared 0.65pt architectural bracket.
 *  3. Each candidate's deltas against the golden master are its own rest
 *     dialect and the standardized flared start — the round's single question.
 *  4. All four display windows (Bach mm. 1–2, m. 4, **mm. 27–28** and the
 *     wide-span chord specimen) are declared and really engraved.
 *  5. The m. 4 tick-552 rest is anchored on the **voice contour** (target
 *     y = 166.0pt, between the RH digits 9 and 0) — never on the Octave 4
 *     equator it used to float on — and the beam breaks across it.
 *  6. The System 1 start is the flared 0.65pt architectural bracket.
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
  JANKO_REST_STYLES,
  JANKO_SUBDIVISION_STYLES,
  JANKO_SYSTEM_START_STYLES,
  JankoRestStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import {
  computeCropBox,
  computePageGeometry,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoVariantComparison,
  resolveRestY,
} from '../src/render/janko/engine';
import { ARCHITECTURAL_BRACKET_FLARE_DEGREES } from '../src/render/janko/elements/accolade';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-13 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  label: string;
  rest: JankoRestStyle;
  /** The class of the rest ink the dialect paints on the m. 4 16th. */
  restInk: string;
}> = [
  {
    id: 'classical-urtext-flared-bracket',
    letter: 'A',
    label: 'A · Authentic Classical Urtext Rest / Flared Bracket',
    rest: 'classical-urtext',
    restInk: 'janko-rest-hook',
  },
  {
    id: 'phantom-notehead-flared-bracket',
    letter: 'B',
    label: 'B · Phantom Notehead Rest / Flared Bracket',
    rest: 'phantom-notehead',
    restInk: 'janko-rest-phantom-head',
  },
  {
    id: 'geometric-node-flared-bracket',
    letter: 'C',
    label: 'C · Geometric Pause Node / Flared Bracket',
    rest: 'geometric-node',
    restInk: 'janko-rest-node',
  },
  {
    id: 'kinetic-monoline-flared-bracket',
    letter: 'D',
    label: 'D · Corrected Kinetic Monoline Rest / Flared Bracket',
    rest: 'kinetic-monoline',
    restInk: 'janko-rest-tab',
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

test('CURRENT_ROUND_METADATA opens round 13 of the rest exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 13);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Voice Contour Rests, Flared 0.65pt Bracket & Beam Discontinuity'
  );
  assert.equal(
    CURRENT_ROUND_METADATA.description,
    'Comparing 4 high-fidelity rest dialects anchored on the melodic voice contour, under the standardized flared 0.65pt architectural bracket, with beams that break across rests and multi-system crops that no longer collapse to an empty white page.'
  );
});

test('CURRENT_CANDIDATES declares the four high-fidelity rest finalists A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.restStyle),
    PARADIGMS.map((p) => p.rest),
    'every round-13 rest dialect is represented exactly once'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.restStyle))].sort(),
    ['classical-urtext', 'geometric-node', 'kinetic-monoline', 'phantom-notehead'],
    'the round narrows the catalogue to the four high-fidelity finalists'
  );
  assert.ok(
    JANKO_REST_STYLES.includes('phantom-notehead'),
    'the Round 13 phantom notehead is part of the published catalogue'
  );
  assert.ok(
    JANKO_REST_STYLES.includes('bauhaus-slash'),
    'the retired bauhaus dialect stays published (never silently deleted)'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.systemStartStyle))].sort(),
    ['architectural-bracket'],
    'the round standardizes one System 1 start: the flared 0.65pt bracket'
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
});

test('Every candidate is demonstrated on the opening, the m. 4 rest, mm. 27–28 and the specimen', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 4, `${paradigm.id} declares four windows`);
    const [bach, rest, dense, specimen] = resolved.windows;
    assert.equal(bach.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(bach.measureStart, 1);
    assert.equal(bach.measureCount, 2);
    assert.match(bach.title, /Bach Goldberg Var\. 1 · mm\. 1–2/);
    assert.match(bach.title, /0\.65pt architectural rule/);
    assert.match(bach.title, /flaring 13° diagonally outward/);
    assert.equal(rest.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(rest.measureStart, 4);
    assert.equal(rest.measureCount, 1);
    assert.match(rest.title, /Bach Goldberg Var\. 1 · m\. 4/);
    assert.match(rest.title, /4 rest dialects at tick 552/);
    assert.match(rest.title, /RH voice contour/);
    assert.match(rest.title, /target y = 166pt/);
    assert.match(rest.title, /digit 9 at 158\.5pt and digit 0 at 173\.5pt/);
    assert.match(rest.title, /nearest legal position/);
    assert.match(rest.title, /528 \+ 540 beamed, 564 an independent flagged 16th/);
    // Round 13: the dense window is one system at its true measure width — the
    // Round 12 mm. 27–29 window straddled Systems 6 and 7 and collapsed.
    assert.equal(dense.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(dense.measureStart, 27);
    assert.equal(dense.measureCount, 2);
    assert.match(dense.title, /Bach Goldberg Var\. 1 · mm\. 27–28/);
    assert.match(dense.title, /one system at full width/);
    assert.match(dense.title, /collapsed to an empty white page/);
    assert.equal(specimen.scoreId, SPECIMEN_STUDIO_SCORE_ID);
    assert.equal(specimen.measureStart, 1);
    assert.equal(specimen.measureCount, 2);
    assert.match(specimen.title, /Wide-Span Chord Specimen/);
    assert.match(specimen.title, /m\. 2 voice-contour 8th rest/);
    assert.match(specimen.title, /mean register of the four-voice chords/);
    assert.match(specimen.title, /y = 121pt/);
    // The legacy single-window fields keep pointing at the first window.
    assert.equal(resolved.measureStart, 1);
    assert.equal(resolved.measureCount, 2);
  }
});

test('The Round 13 dense window is one system at its true measure width', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const box = computeCropBox(geo, 27, 2, true);
  assert.equal(box.firstSystem, box.lastSystem, 'mm. 27–28 live inside one system');
  assert.equal(box.firstSystem, 6, 'the opening of System 7 (mm. 25–28)');
  // Two true measure widths + the crop padding — never the 1pt strip the
  // cross-system arithmetic used to clamp to.
  assert.ok(
    Math.abs(box.w - (2 * geo.systems[0].measureWidth + 16)) < 1e-6,
    `two full measure widths (got ${box.w.toFixed(2)}pt)`
  );
  const svg = renderJankoCrop(SCORE, 27, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.ok(
    (svg.match(/class="janko-digit"/g) ?? []).length > 20,
    'the dense sixteenths are really engraved (no empty white page)'
  );
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
  // Round 13: the specimen's m. 2 silence is written on the exact voice contour
  // of the two chords that surround it (their mean y is 121.0pt).
  assert.equal(layout.rests.length, 1, 'the specimen writes its silence');
  const rest = layout.rests[0];
  assert.equal(rest.value, 'eighth');
  assert.equal(rest.hand, 'RH');
  assert.equal(rest.tick, 180);
  const chordMean = (tick: number): number => {
    const ys = layout.notes.filter((p) => p.note.startTick === tick).map((p) => p.y);
    return ys.reduce((a, b) => a + b, 0) / ys.length;
  };
  const target = (chordMean(156) + chordMean(204)) / 2;
  assert.ok(Math.abs(rest.y - target) < 1e-9, 'the specimen rest sits on the exact contour midpoint');
  assert.ok(Math.abs(rest.y - 121.0) < 1e-9, 'which is 121.0pt for the specimen chords');
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
      { key: 'restStyle', value: paradigm.rest, golden: golden.restStyle },
      {
        key: 'systemStartStyle',
        value: 'architectural-bracket',
        golden: golden.systemStartStyle,
      },
    ].filter((delta) => delta.value !== delta.golden);
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in its rest dialect and the flared bracket only`
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
    // Round 13: the m. 4 run beams 528 + 540 and breaks at the tick-552 rest,
    // so the resumption at 564 is an independent flagged 16th.
    const m4 = bach[0].beams.filter((b) => b.notes.some((n) => n.startTick >= 528 && n.startTick < 576));
    assert.ok(
      m4.some((b) => b.notes.map((n) => n.startTick).join(',') === '528,540'),
      `${paradigm.id} beams exactly the 528 + 540 pair`
    );
    assert.deepEqual(
      bach[0].ungrouped.filter((n) => n.startTick >= 528 && n.startTick < 576).map((n) => n.startTick),
      [564],
      `${paradigm.id} leaves the tick-564 resumption as an independent flagged 16th`
    );
    // Round 13 varies the rest dialect and nothing else: the Brahms benchmark
    // is engraved identically to the golden master in every candidate (the
    // clasp scope stays the settled one — this round does not reopen it).
    const brahmsOptions = resolveJankoOptions({
      ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      ...(getCandidate(paradigm.id)!.options ?? {}),
    });
    const brahms = layoutJankoScore(BRAHMS, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const golden = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
    assert.deepEqual(
      brahms.map((l) => l.notes.map((p) => `${p.note.id}@${p.x.toFixed(6)},${p.y.toFixed(6)}`)),
      golden.map((l) => l.notes.map((p) => `${p.note.id}@${p.x.toFixed(6)},${p.y.toFixed(6)}`)),
      `${paradigm.id} never moves a Brahms notehead`
    );
    assert.deepEqual(
      brahms.map((l) => l.beams.map((b) => b.notes.map((n) => n.startTick))),
      golden.map((l) => l.beams.map((b) => b.notes.map((n) => n.startTick))),
      `${paradigm.id} never re-partitions a Brahms beam`
    );
    assert.equal(brahms.reduce((n, l) => n + l.clasps.length, 0), 0, `${paradigm.id} keeps the golden grouping`);
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

test('Every candidate anchors its m. 4 rest on the voice contour, never on the Octave 4 equator', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const system0 = geo.systems[0];
  const octave4 = system0.equatorY('RH', 4);
  const octave3 = system0.equatorY('LH', 3);
  assert.equal(octave4, 136.0, 'the Round 12 sky-floating equator');
  assert.equal(octave3, 166.0, 'the Octave 3 voice contour of the m. 4 writing');

  const golden = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  const goldenRest = golden.rests.find((r) => r.tick === 552)!;
  // The contour target is the midpoint of digit 9 (y = 158.5) and digit 0
  // (y = 173.5) — the two RH notes that surround the silence.
  assert.ok(Math.abs(goldenRest.y - octave4) > 20, 'the rest no longer floats on the o4 equator');
  assert.ok(
    goldenRest.y > 158.5 && goldenRest.y < 173.5,
    'the rest is nestled between the surrounding RH digits'
  );

  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    const layout = layoutJankoScore(SCORE, resolved.options, resolved.tokens)[0];
    const rest = layout.rests.find((r) => r.tick === 552)!;
    assert.equal(rest.hand, 'RH');
    assert.equal(rest.value, 'sixteenth');
    assert.ok(
      rest.y > 158.5 && rest.y < 173.5,
      `${paradigm.id} rest sits inside the Octave 3 voice band (y = ${rest.y.toFixed(2)})`
    );
    assert.ok(
      Math.abs(rest.y - octave3) < 5,
      `${paradigm.id} rest lands within 5pt of the o3 contour (y = ${rest.y.toFixed(2)})`
    );
    // The fitted position is the *nearest legal* one: re-solving it is a
    // no-op, and a step toward the contour target would collide.
    assert.equal(resolveRestY(rest, layout.notes, layout.geometry, resolved.tokens), rest.y);
    const toward = { ...rest, y: rest.y + 0.1 };
    assert.notEqual(
      resolveRestY(toward, layout.notes, layout.geometry, resolved.tokens),
      toward.y,
      `${paradigm.id} sits on the boundary of the legal band`
    );
  }
});

test('Every candidate paints its rest dialect and the flared 0.65pt System 1 bracket', () => {
  const documents = new Set<string>();
  const foreignRestInk: Record<JankoRestStyle, RegExp> = {
    'kinetic-monoline': /janko-rest-(hook|lightning|block|node|ray|capsule|slash|wing|z|box|phantom|stem-line)/,
    'classical-urtext': /janko-rest-(tab|notch|bar|node|ray|capsule|slash|wing|z|box|phantom)/,
    'geometric-node': /janko-rest-(tab|notch|bar|hook|lightning|block|slash|wing|z|box|phantom|stem-line)/,
    'bauhaus-slash': /janko-rest-(tab|notch|bar|hook|lightning|block|node|ray|capsule|phantom|stem-line)/,
    'phantom-notehead': /janko-rest-(tab|notch|bar|hook|lightning|block|node|ray|capsule|slash|wing|z|box|stem-line)/,
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
    // Round 13: the System 1 start is one standardized flared 0.65pt bracket.
    assert.match(
      bach,
      /class="janko-system-bracket" d="M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+" fill="none" stroke="#111827" stroke-width="0\.65" stroke-linecap="butt" stroke-linejoin="miter"/,
      `${paradigm.id} paints the flared architectural bracket`
    );
    assert.ok(
      !bach.includes('janko-clef-pillar') && !bach.includes('janko-system-bracket-delicate'),
      `${paradigm.id} retires the Round 12 start finalists`
    );

    // The Round 13 rest layer: the m. 4 tick-552 16th silence in the RH.
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
    assert.ok(Math.abs(m4Rest.x - 544.97) < 0.01, `${paradigm.id} tick-552 column`);

    // Round 13: the beam breaks at the rest instead of bridging it.
    const bars = restCrop.match(/<line class="janko-beam"[^>]*>/g) ?? [];
    assert.ok(bars.length > 0, `${paradigm.id} still beams the surrounding 16ths`);

    // The specimen window: the dense chordal texture with the m. 2 silence
    // written in the candidate's own dialect, anchored on the chords' mean
    // register (y = 121pt — never on a hand's default equator).
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
    assert.equal(claspGroups(specimen).length, 0, `${paradigm.id} keeps the golden chord grouping`);
    assert.match(
      specimen,
      new RegExp(
        `<g class="janko-rest-group" data-rest-tick="180" data-rest-value="eighth" data-rest-hand="RH" data-rest-style="${paradigm.rest}">`
      ),
      `${paradigm.id} writes the specimen silence in its own dialect`
    );
    assert.match(specimen, new RegExp(paradigm.restInk), `${paradigm.id} specimen rest ink`);
    const specimenRest = layoutJankoScore(SPECIMEN, specimenOptions, DEFAULT_JANKO_TOKENS)[0].rests[0];
    assert.ok(Math.abs(specimenRest.y - 121.0) < 1e-9, `${paradigm.id} specimen rest on the chord mean`);

    // Compare the *ink*, not the tags: strip the style attributes so two
    // paradigms that painted identical ink could never count as distinct.
    documents.add(specimen.replace(/ data-rest-style="[^"]*"/g, ''));
  }
  // The four paradigms must be four *different* engravings of the same window:
  // a decision round whose candidates render identically decides nothing.
  assert.equal(documents.size, PARADIGMS.length, 'each paradigm is a distinct engraving');
});

test('The flared architectural bracket flares its spurs outward by 13°', () => {
  assert.equal(ARCHITECTURAL_BRACKET_FLARE_DEGREES, 13.0);
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const system0 = geo.systems[0];
  const svg = renderJankoCrop(
    SCORE,
    1,
    2,
    resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, systemStartStyle: 'architectural-bracket' }),
    DEFAULT_JANKO_TOKENS
  );
  const path = /class="janko-system-bracket" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"/.exec(svg);
  assert.ok(path, 'the flared bracket is painted');
  const [, tipX, tipY, x1, y1, x2, y2, footX, footY] = path!.map(Number);
  const top = system0.equatorY('RH', 5);
  const bot = system0.equatorY('LH', 2);
  assert.ok(Math.abs(x1 - x2) < 1e-9, 'the rule is straight and vertical');
  assert.ok(Math.abs(x1 - x2) < 1e-9 && Math.abs(y1 - top) < 1e-9 && Math.abs(y2 - bot) < 1e-9,
    'the rule clasps Octave 5 through Octave 2');
  assert.ok(Math.abs(tipX - footX) < 1e-9, 'both spurs reach the same horizontal distance');
  assert.ok(tipX > x1, 'the spurs extend rightward, into the staff');
  assert.ok(tipY < top, 'the top spur flares diagonally upward/outward');
  assert.ok(footY > bot, 'the bottom spur flares diagonally downward/outward');
  const flare = (top - tipY) / (tipX - x1);
  // The painted coordinates carry 2 decimals, so the recovered tangent is
  // accurate to ~1e-3 — well inside the ticket's 12°–15° band.
  assert.ok(
    Math.abs(flare - Math.tan((13.0 * Math.PI) / 180)) < 5e-3,
    `the flare is 13° (tan = ${flare.toFixed(4)})`
  );
  const degrees = (Math.atan(flare) * 180) / Math.PI;
  assert.ok(degrees >= 12 && degrees <= 15, `the flare stays inside 12°–15° (got ${degrees.toFixed(2)}°)`);
});

test('The live studio engraves four candidates on four windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 16, 'four engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 16, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="4"/);
  assert.match(html, /Round 13/);
  assert.match(html, /Voice Contour Rests/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:1-2"/);
  assert.match(html, /data-window="primary:4-4"/);
  assert.match(html, /data-window="primary:27-28"/);
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
    assert.ok(
      !body.includes('<b>chordGrouping</b>'),
      `${paradigm.id} keeps the golden chord grouping (this round does not reopen it)`
    );
    if (paradigm.rest === DEFAULT_JANKO_OPTIONS.restStyle) {
      assert.ok(
        !body.includes('<b>restStyle</b>'),
        'candidate D is the golden rest dialect itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>restStyle</b> = ${paradigm.rest}`),
        `${paradigm.id} rest badge`
      );
      assert.match(body, /<s>kinetic-monoline<\/s>/, 'the golden rest dialect is shown');
    }
    assert.match(
      body,
      /<b>systemStartStyle<\/b> = architectural-bracket/,
      `${paradigm.id} shows the standardized flared bracket`
    );
    assert.match(body, /<s>open-halo<\/s>/, `${paradigm.id} shows the golden open margin it departs from`);
    assert.ok(
      !body.includes('<b>gridWritingPolicy</b>'),
      `${paradigm.id} keeps the settled golden grid`
    );
    assert.match(body, /badge-delta/, `${paradigm.id} highlights its delta`);
    assert.ok(
      !body.includes('janko-clasp-layer'),
      `${paradigm.id} keeps the golden chord grouping (no bracket layer)`
    );
    assert.match(body, /class="janko-rest-group"/, `${paradigm.id} renders its rest layer`);
    assert.match(body, /class="janko-system-bracket"/, `${paradigm.id} paints the flared bracket`);
    assert.match(body, /data-subdivision-style="kinetic-tab-beam"/, `${paradigm.id} settled tab`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
  }
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four rest finalists on one document', () => {
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
    // The specimen window under the golden chord grouping: one rest, in the
    // candidate's own dialect, and the dense four-voice chords around it.
    assert.equal(
      (panel.match(/class="janko-rest-group"/g) ?? []).length,
      1,
      `${paradigm.id} writes exactly the specimen silence`
    );
    assert.match(panel, new RegExp(paradigm.restInk), `${paradigm.id} specimen rest ink`);
    assert.ok(
      (panel.match(/class="janko-digit"/g) ?? []).length >= 20,
      `${paradigm.id} engraves the dense chordal texture`
    );
  }
});
