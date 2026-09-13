/**
 * Round 8 — Symmetrical Clasps, Beam-Harmonized Tabs & Uniform Staff Hierarchy:
 * candidate registry suite.
 *
 * The round removes the clasp's lopsided upward spire and tests four **mirror
 * symmetrical** duration paradigms, all sharing the settled beam-harmonized
 * kinetic subdivision tab and the widened per-hand bracket scope:
 *
 * | # | id              | `claspDurationStyle` | duration ink                        |
 * | - | --------------- | -------------------- | ----------------------------------- |
 * | A | `center-ticks`  | `'center-ticks'`     | 1/2 ticks or a pip at the midpoint  |
 * | B | `cap-cuts`      | `'cap-cuts'`         | 1/2/3 bars stacked inside both caps |
 * | C | `framing-only`  | `'framing-only'`     | pure `[` bracket, no duration ink   |
 * | D | `bilateral-fins`| `'bilateral-fins'`   | 12.4° fins flaring off both caps    |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 8` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four paradigms A–D.
 *  3. Each candidate's deltas against the golden master are `chordGrouping`
 *     (`'per-hand-clasp'`), its own `claspDurationStyle` and the settled
 *     `'kinetic-tab-beam'` subdivision.
 *  4. Both display windows (Bach mm. 1–2 and Brahms mm. 7–8) are declared.
 *  5. The live studio engraves all four candidates on both windows with option
 *     deltas, the clasp layer, distinct duration ink and a live lint chip.
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
  JANKO_CLASP_DURATION_STYLES,
  JANKO_SUBDIVISION_STYLES,
  JankoClaspDurationStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-8 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  style: JankoClaspDurationStyle;
  /** The duration ink the paradigm paints on a quarter-value clasp. */
  quarterInk: { must: RegExp | null; mustNot: RegExp };
}> = [
  {
    id: 'center-ticks',
    letter: 'A',
    style: 'center-ticks',
    quarterInk: { must: null, mustNot: /janko-clasp-(tick|cap-cut|fin|pip)/ },
  },
  {
    id: 'cap-cuts',
    letter: 'B',
    style: 'cap-cuts',
    quarterInk: { must: /janko-clasp-cap-cut/, mustNot: /janko-clasp-(tick|fin|pip)/ },
  },
  {
    id: 'framing-only',
    letter: 'C',
    style: 'framing-only',
    quarterInk: { must: null, mustNot: /janko-clasp-(tick|cap-cut|fin|pip)/ },
  },
  {
    id: 'bilateral-fins',
    letter: 'D',
    style: 'bilateral-fins',
    quarterInk: { must: /janko-clasp-fin/, mustNot: /janko-clasp-(tick|cap-cut|pip)/ },
  },
];

test('CURRENT_ROUND_METADATA opens round 8 of the symmetrical-clasp exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 8);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Symmetrical Clasps, Beam-Harmonized Tabs & Uniform Staff Hierarchy'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /symmetr/i);
  assert.match(CURRENT_ROUND_METADATA.description, /4 balanced duration paradigms/);
  assert.match(CURRENT_ROUND_METADATA.description, /12° beam-harmonized/);
  assert.match(CURRENT_ROUND_METADATA.description, /0\.65pt accolade/);
  assert.match(CURRENT_ROUND_METADATA.description, /24pt margins/);
});

test('CURRENT_CANDIDATES declares the four symmetrical duration paradigms A–D', () => {
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
    assert.ok(
      candidate!.label.startsWith(`${paradigm.letter} · `),
      `${paradigm.id} is labelled candidate ${paradigm.letter}`
    );
    assert.ok((candidate!.description ?? '').length > 120, `${paradigm.id} carries a rationale`);
    assert.ok((candidate!.tags ?? []).length > 0, `${paradigm.id} is tagged`);
  }
  assert.equal(getCandidate('center-ticks')!.label, 'A · Balanced Center-Spine Ticks');
  assert.equal(getCandidate('cap-cuts')!.label, 'B · Stacked Horizontal Cap Cuts');
  assert.equal(getCandidate('framing-only')!.label, 'C · Pure Symmetrical Framing Bracket');
  assert.equal(getCandidate('bilateral-fins')!.label, 'D · Bilateral Cap Fins');
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.claspDurationStyle))].sort(),
    [...JANKO_CLASP_DURATION_STYLES].sort(),
    'the registry covers the published duration catalogue'
  );
});

test('Every candidate is demonstrated on the Bach and Brahms windows', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 2, `${paradigm.id} declares two windows`);
    const [bach, brahms] = resolved.windows;
    assert.equal(bach.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(bach.measureStart, 1);
    assert.equal(bach.measureCount, 2);
    assert.match(bach.title, /Bach Goldberg Var\. 1 · mm\. 1–2/);
    assert.match(bach.title, /opening counterpoint/i);
    assert.match(bach.title, /12° beam-harmonized kinetic tabs/);
    assert.equal(brahms.scoreId, BRAHMS_STUDIO_SCORE_ID);
    assert.equal(brahms.measureStart, 7);
    assert.equal(brahms.measureCount, 2);
    assert.match(brahms.title, /Brahms Op\. 118 No\. 1 · mm\. 7–8/);
    assert.match(brahms.title, /symmetrical B - 2 - 8 clasp/);
    assert.match(brahms.title, /B - 4 - 7 3-note bracket/);
    assert.match(brahms.title, /macro crop/i);
    // The legacy single-window fields keep pointing at the first window.
    assert.equal(resolved.measureStart, 1);
    assert.equal(resolved.measureCount, 2);
  }
});

test('The Brahms window really contains the dense block chords the round targets', () => {
  const onsets = new Map<number, number>();
  for (const n of BRAHMS.notes) onsets.set(n.startTick, (onsets.get(n.startTick) ?? 0) + 1);
  // Cut time: the anacrusis is 48 ticks, mm. 7–8 span ticks 1200..1584.
  const window = [...onsets.entries()].filter(([tick]) => tick >= 1200 && tick < 1584);
  const chords = window.filter(([, size]) => size >= 2);
  assert.ok(chords.length >= 4, `mm. 7–8 carry the dense chord onsets (${chords.length})`);
  assert.ok(Math.max(...chords.map(([, size]) => size)) >= 5, 'one of them is a five-voice chord');
  const massive = chords.filter(([, size]) => size >= 4);
  assert.ok(massive.length >= 2, 'at least two four-plus-voice sonorities');
});

test('Every candidate states its deltas against the golden master', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    // Candidate A *is* the golden duration paradigm, so it departs only in the
    // per-hand bracket scope and the settled beam-harmonized tab.
    const expected =
      paradigm.style === golden.claspDurationStyle
        ? [
            { key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' },
            { key: 'subdivisionStyle', value: 'kinetic-tab-beam', golden: golden.subdivisionStyle },
          ]
        : [
            { key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' },
            {
              key: 'claspDurationStyle',
              value: paradigm.style,
              golden: golden.claspDurationStyle,
            },
            { key: 'subdivisionStyle', value: 'kinetic-tab-beam', golden: golden.subdivisionStyle },
          ];
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in the per-hand clasp, its duration paradigm and the kinetic tab`
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
      if (key === 'subdivisionStyle') {
        assert.equal(value, 'kinetic-tab-beam');
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

test('Every paradigm engraves both benchmarks with the bracket scope and lint it claims', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    // The Bach opening is melodic: no hand carries a row-snapped cluster or a
    // 3-note chord, so the per-hand clasp never appears there.
    const bach = layoutJankoScore(SCORE, resolved.options, resolved.tokens);
    assert.equal(bach.reduce((n, l) => n + l.clasps.length, 0), 0, `${paradigm.id} Bach clasps`);
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

test('Every paradigm paints its own symmetrical duration ink and the settled kinetic tab', () => {
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
    const brahmsOptions = resolveJankoOptions({
      ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      ...(candidate.options ?? {}),
    });
    const brahms = renderJankoCrop(BRAHMS, 7, 2, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS);
    // Compare the *ink*, not the paradigm tag: strip the style attribute so two
    // paradigms that painted identical ink could never count as distinct.
    documents.add(brahms.replace(/ data-clasp-duration-style="[^"]*"/g, ''));
    assert.match(brahms, /<g class="janko-clasp-layer">/, `${paradigm.id} paints its clasps`);
    assert.match(
      brahms,
      new RegExp(`data-clasp-duration-style="${paradigm.style}"`),
      `${paradigm.id} tags its duration ink`
    );
    assert.ok(!brahms.includes('janko-clasp-spire'), 'the lopsided spire is gone');
    // The quarter-value clasps of the window carry the paradigm's own ink.
    const quarter = [
      ...brahms.matchAll(
        /<g class="janko-clasp-group"[^>]*data-clasp-duration="spire"[^>]*>([\s\S]*?)<\/g>/g
      ),
    ][0][1].replace(/<path class="janko-clasp"[^>]*\/>/, '');
    assert.ok(quarter.length > 0, `${paradigm.id} paints a quarter clasp`);
    if (paradigm.quarterInk.must) {
      assert.match(quarter, paradigm.quarterInk.must, `${paradigm.id} quarter ink`);
    }
    assert.doesNotMatch(quarter, paradigm.quarterInk.mustNot, `${paradigm.id} paints no foreign ink`);
  }
  // The four paradigms must be four *different* engravings of the same window:
  // a decision round whose candidates render identically decides nothing.
  assert.equal(documents.size, PARADIGMS.length, 'each paradigm is a distinct engraving');
});

test('The live studio engraves four candidates on two windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 8, 'two engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 8, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="2"/);
  assert.match(html, /Round 8/);
  assert.match(html, /Symmetrical Clasps/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:1-2"/);
  assert.match(html, /data-window="brahms-op118-no1:7-8"/);

  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = html.indexOf(`data-candidate="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} appears in registry order`);
    cursor = at;
    const card = html.slice(at);
    const body = card.slice(0, card.indexOf('</article>'));
    assert.ok(body.includes(getCandidate(paradigm.id)!.label), `${paradigm.id} label`);
    assert.ok(body.includes(getCandidate(paradigm.id)!.description ?? ''), `${paradigm.id} rationale`);
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
        /<s>center-ticks<\/s>/,
        `${paradigm.id} shows the golden duration it departs from`
      );
    }
    assert.match(
      body,
      /<b>subdivisionStyle<\/b> = kinetic-tab-beam/,
      `${paradigm.id} carries the settled kinetic tab`
    );
    assert.match(body, /badge-delta/, `${paradigm.id} highlights its delta`);
    assert.match(body, /class="janko-clasp-layer"/, `${paradigm.id} renders its clasp layer`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
  }
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four symmetrical clasp paradigms on one document', () => {
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
