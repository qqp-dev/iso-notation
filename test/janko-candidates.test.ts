/**
 * Round 10 — Scaled Midpoint Clasps, Beaming Integrity, Accolade Retirement &
 * Page Furniture Polish: candidate registry suite.
 *
 * The round scales every clasp duration mark so it cuts symmetrically across
 * the bracket spine and tests four **scaled** paradigms, all sharing the
 * settled beam-harmonized kinetic subdivision tab, the open System 1 start,
 * continuous run beaming, the unified final barline and the uncluttered
 * multi-page headers:
 *
 * | # | id                       | `claspDurationStyle`       | 8th / 16th mark          |
 * | - | ------------------------ | -------------------------- | ------------------------ |
 * | A | `transverse-cross-bars`  | `'transverse-cross-bars'`  | 7.5pt bars, 1 / 2        |
 * | B | `kinetic-cross-slashes`  | `'kinetic-cross-slashes'`  | 12.4° slashes, 1 / 2     |
 * | C | `interrupted-spine-node` | `'interrupted-spine-node'` | beads, 1 / 2 stacked     |
 * | D | `faceted-diamond-bands`  | `'faceted-diamond-bands'`  | diamond bands, 1 / 2     |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 10` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four scaled paradigms A–D.
 *  3. Each candidate's deltas against the golden master are `chordGrouping`
 *     (`'per-hand-clasp'`) and its own `claspDurationStyle`.
 *  4. All three display windows (Bach mm. 1–2, Bach m. 4 and the wide-span
 *     chord-duration specimen) are declared and really engraved.
 *  5. The specimen carries the whole taxonomy — half, quarter, dotted quarter,
 *     8th, 16th — on 1.5-octave (45pt) brackets, so every scaled mark is on
 *     screen on a realistic tall bracket.
 *  6. The live studio engraves all four candidates on all three windows with
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
  JankoClaspDurationStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-9 table, candidate by candidate. */
/** The exact round-10 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  label: string;
  style: JankoClaspDurationStyle;
  /** The mark class the paradigm paints for an 8th / 16th. */
  mark: string;
  /** The open half/whole mark class. */
  open: string;
}> = [
  {
    id: 'transverse-cross-bars',
    letter: 'A',
    label: 'A · Transverse Cross-Bars',
    style: 'transverse-cross-bars',
    mark: 'janko-clasp-bar',
    open: 'janko-clasp-gap',
  },
  {
    id: 'kinetic-cross-slashes',
    letter: 'B',
    label: 'B · Kinetic 12.4° Cross-Slashes',
    style: 'kinetic-cross-slashes',
    mark: 'janko-clasp-slash',
    open: 'janko-clasp-lozenge',
  },
  {
    id: 'interrupted-spine-node',
    letter: 'C',
    label: 'C · Interrupted-Spine Node',
    style: 'interrupted-spine-node',
    mark: 'janko-clasp-bead',
    open: 'janko-clasp-ring',
  },
  {
    id: 'faceted-diamond-bands',
    letter: 'D',
    label: 'D · Faceted Diamond Bands',
    style: 'faceted-diamond-bands',
    mark: 'janko-clasp-band',
    open: 'janko-clasp-diamond',
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

test('CURRENT_ROUND_METADATA opens round 10 of the scaled-clasp exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 10);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Scaled Midpoint Clasps, Beaming Integrity, Accolade Retirement & Page Furniture Polish'
  );
  assert.equal(
    CURRENT_ROUND_METADATA.description,
    'Comparing 4 scaled clasp-duration paradigms cutting across the spine on wide-span chords, with continuous run beaming, open System 1 start, unified final barline, and uncluttered multi-page headers.'
  );
});

test('CURRENT_CANDIDATES declares the four scaled duration paradigms A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
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
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.claspDurationStyle))].sort(),
    [...JANKO_CLASP_DURATION_STYLES].sort(),
    'the registry covers the published duration catalogue'
  );
});

test('Every candidate is demonstrated on the Bach opening, the m. 4 run and the specimen', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 3, `${paradigm.id} declares three windows`);
    const [bach, run, specimen] = resolved.windows;
    assert.equal(bach.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(bach.measureStart, 1);
    assert.equal(bach.measureCount, 2);
    assert.match(bach.title, /Bach Goldberg Var\. 1 · mm\. 1–2/);
    assert.match(bach.title, /open margin start/);
    assert.match(bach.title, /Position of Honor halo/);
    assert.match(bach.title, /12° kinetic tabs/);
    assert.equal(run.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(run.measureStart, 4);
    assert.equal(run.measureCount, 1);
    assert.match(run.title, /Bach Goldberg Var\. 1 · m\. 4/);
    assert.match(run.title, /continuous RH run beaming across Middle C into Octave 3/);
    assert.match(run.title, /orphaned 9 · 7 · 6 flags/);
    assert.equal(specimen.scoreId, SPECIMEN_STUDIO_SCORE_ID);
    assert.equal(specimen.measureStart, 1);
    assert.equal(specimen.measureCount, 2);
    assert.match(specimen.title, /Wide-Span Chord Specimen/);
    assert.match(specimen.title, /dotted quarter \(0\.75pt dot\)/);
    assert.match(specimen.title, /8th \(1 mark\)/);
    assert.match(specimen.title, /16th \(2 marks\)/);
    assert.match(specimen.title, /1\.5-octave brackets/);
    // The legacy single-window fields keep pointing at the first window.
    assert.equal(resolved.measureStart, 1);
    assert.equal(resolved.measureCount, 2);
  }
});

test('The wide-span chord specimen really carries the whole duration taxonomy', () => {
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
    'the taxonomy lands as open mark / plain / plain+dot / 1 mark / 2 marks'
  );
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
  assert.equal(golden.subdivisionStyle, 'kinetic-tab-beam', 'the Round 9 golden tab');
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    // Candidate A *is* the golden duration paradigm, so it departs only in the
    // per-hand bracket scope; the settled kinetic tab and the golden open-halo
    // start / unified final barline are no longer deltas.
    const expected =
      paradigm.style === golden.claspDurationStyle
        ? [{ key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' }]
        : [
            { key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' },
            {
              key: 'claspDurationStyle',
              value: paradigm.style,
              golden: golden.claspDurationStyle,
            },
          ];
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in the per-hand clasp and its own midpoint paradigm`
    );
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      if (key === 'chordGrouping') {
        assert.equal(value, 'per-hand-clasp');
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

test('Every paradigm engraves both benchmarks and the specimen with the scope and lint it claims', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    // The Bach opening is melodic: no hand carries a row-snapped cluster or a
    // 3-note chord, so the per-hand clasp never appears there.
    const bach = layoutJankoScore(SCORE, resolved.options, resolved.tokens);
    assert.equal(bach.reduce((n, l) => n + l.clasps.length, 0), 0, `${paradigm.id} Bach clasps`);
    // Round 10: the m. 4 RH run beams continuously across Middle C — its
    // `9 · 7 · 6` tail is never orphaned into solitary flags.
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

test('Every paradigm paints its own midpoint duration ink and the settled kinetic tab', () => {
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
      (byDuration.get('pip')!.match(new RegExp(paradigm.open, 'g')) ?? []).length,
      1,
      `${paradigm.id} half: one open knockout mark`
    );
    const plains = groups.filter((g) => g.duration === 'spire');
    assert.equal(plains.length, 2, `${paradigm.id} paints a quarter and a dotted quarter`);
    assert.ok(
      !/janko-clasp-(gap|lozenge|ring|diamond|bar|slash|bead|band|dot|pip)/.test(plains[0].body),
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
      `${paradigm.id} 8th: one midpoint mark`
    );
    assert.equal(
      (byDuration.get('spire-two-flags')!.match(new RegExp(paradigm.mark, 'g')) ?? []).length,
      2,
      `${paradigm.id} 16th: two midpoint marks`
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
        // The shared pip/whole ink rides the midpoint; the 16th pair mirrors
        // about it, so no mark may leave the bracket's own span.
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

test('The live studio engraves four candidates on three windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 12, 'three engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 12, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="3"/);
  assert.match(html, /Round 10/);
  assert.match(html, /Scaled Midpoint Clasps/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:1-2"/);
  assert.match(html, /data-window="primary:4-4"/);
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

test('The contact sheet engraves the four scaled clasp paradigms on one document', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => {
    const resolved = resolveCandidate(candidate);
    return { id: candidate.id, label: candidate.label, options: resolved.options };
  });
  const sheet = renderJankoVariantComparison(
    SCORE,
    specs,
    1,
    2,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
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
    assert.match(panel, /data-subdivision-style="kinetic-tab-beam"/, `${paradigm.id} settled tab`);
  }
});
