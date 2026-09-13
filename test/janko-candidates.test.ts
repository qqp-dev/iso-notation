/**
 * Round 7 — Kinetic Subdivision Tabs, Gap-Gated Chords & Staff Hierarchy:
 * candidate registry suite.
 *
 * The round rakes the isolated single-note subdivision ink into a **diagonal
 * kinetic** direction, tests it across all three subdivision tiers, and pairs it
 * with Option 3 gap-gated vertical chording under the per-hand clasp:
 *
 * | # | id                     | `subdivisionStyle`      | ink                       |
 * | - | ---------------------- | ----------------------- | ------------------------- |
 * | A | `kinetic-tab-30`       | `'kinetic-tab-30'`      | 30° tab, 1.1pt monoline   |
 * | B | `kinetic-tab-45`       | `'kinetic-tab-45'`      | 45° tab, 1.1pt monoline   |
 * | C | `kinetic-tab-tapered`  | `'kinetic-tab-tapered'` | 30° tab, 1.4 → 0.8pt      |
 * | D | `classical-urtext`     | `'classical-urtext'`    | balanced urtext flag      |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 7` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four dialects A–D.
 *  3. Each candidate's deltas against the golden master are `chordGrouping`
 *     (`'per-hand-clasp'`) and its own `subdivisionStyle`.
 *  4. Both display windows (Bach mm. 1–2 and Brahms mm. 7–8) are declared.
 *  5. The live studio engraves all four candidates on both windows with option
 *     deltas, the clasp layer, distinct subdivision ink and a live lint chip.
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
  JANKO_SUBDIVISION_STYLES,
  JankoSubdivisionStyle,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-7 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  style: JankoSubdivisionStyle;
  /** Clasps the paradigm paints across the canonical Brahms score. */
  brahmsClasps: number;
}> = [
  { id: 'kinetic-tab-30', letter: 'A', style: 'kinetic-tab-30', brahmsClasps: 6 },
  { id: 'kinetic-tab-45', letter: 'B', style: 'kinetic-tab-45', brahmsClasps: 6 },
  { id: 'kinetic-tab-tapered', letter: 'C', style: 'kinetic-tab-tapered', brahmsClasps: 6 },
  { id: 'classical-urtext', letter: 'D', style: 'classical-urtext', brahmsClasps: 6 },
];

test('CURRENT_ROUND_METADATA opens round 7 of the kinetic-tab exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 7);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Kinetic Subdivision Tabs, Gap-Gated Chords & Staff Hierarchy'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /kinetic/i);
  assert.match(CURRENT_ROUND_METADATA.description, /8th\/16th\/32nd/);
  assert.match(CURRENT_ROUND_METADATA.description, /gap-gated/i);
  assert.match(CURRENT_ROUND_METADATA.description, /hierarchy/i);
});

test('CURRENT_CANDIDATES declares the four kinetic subdivision dialects A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.subdivisionStyle),
    PARADIGMS.map((p) => p.style),
    'every subdivision dialect is represented exactly once'
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
  assert.equal(getCandidate('kinetic-tab-30')!.label, 'A · 30° Kinetic Architectural Tab');
  assert.equal(getCandidate('kinetic-tab-45')!.label, 'B · 45° Dynamic Chevron Tab');
  assert.equal(getCandidate('kinetic-tab-tapered')!.label, 'C · Tapered Kinetic Wing Tab');
  assert.equal(getCandidate('classical-urtext')!.label, 'D · Balanced Numeral-Urtext Flag');
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.subdivisionStyle))].sort(),
    [...JANKO_SUBDIVISION_STYLES].sort(),
    'the registry covers the published style catalogue'
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
    assert.match(bach.title, /16th/i);
    assert.equal(brahms.scoreId, BRAHMS_STUDIO_SCORE_ID);
    assert.equal(brahms.measureStart, 7);
    assert.equal(brahms.measureCount, 2);
    assert.match(brahms.title, /Brahms Op\. 118 No\. 1 · mm\. 7–8/);
    assert.match(brahms.title, /B - 2 - 8 clasp/);
    assert.match(brahms.title, /B - 4 - 7 Option 3 chording/);
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
    // The classical control happens to *be* the golden subdivision, so it only
    // departs in the refined per-hand clasp.
    const expected =
      paradigm.style === golden.subdivisionStyle
        ? [{ key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' }]
        : [
            { key: 'chordGrouping', value: 'per-hand-clasp', golden: 'none' },
            { key: 'subdivisionStyle', value: paradigm.style, golden: golden.subdivisionStyle },
          ];
    assert.deepEqual(
      candidateBadges(candidate),
      expected,
      `${paradigm.id} departs in the per-hand clasp and its own subdivision dialect`
    );
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      if (key === 'chordGrouping') {
        assert.equal(value, 'per-hand-clasp');
        continue;
      }
      if (key === 'subdivisionStyle') {
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
});

test('Every dialect engraves both benchmarks with the clasp and Option 3 counts it claims', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    // The Bach opening is melodic: no hand carries a row-snapped cluster, so the
    // per-hand clasp never appears there.
    const bach = layoutJankoScore(SCORE, resolved.options, resolved.tokens);
    assert.equal(bach.reduce((n, l) => n + l.clasps.length, 0), 0, `${paradigm.id} Bach clasps`);
    // The Brahms block chords carry the row-snapped hand clusters.
    const brahmsOptions = resolveJankoOptions({
      ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      ...(getCandidate(paradigm.id)!.options ?? {}),
    });
    const brahms = layoutJankoScore(BRAHMS, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS);
    const clasps = brahms.flatMap((l) => l.clasps);
    assert.equal(clasps.length, paradigm.brahmsClasps, `${paradigm.id} Brahms clasp count`);
    for (const clasp of clasps) {
      assert.equal(new Set(clasp.notes.map((n) => n.hand)).size, 1, 'one hand per bracket');
    }
    // The Round 7 `B - 2 - 8` bracket is among them.
    assert.ok(clasps.some((c) => c.tick === 1296), `${paradigm.id} keeps the B - 2 - 8 clasp`);
    // Option 3 gap-gates the vertical hand columns: every group suppresses its
    // interior stems and bridges only its wide leaps.
    const chords = brahms.flatMap((l) => l.verticalChords);
    assert.ok(chords.length > 0, `${paradigm.id} gap-gates vertical hand chords`);
    for (const chord of chords) {
      assert.ok(chord.suppressedIds.length >= 1, 'the interior heads lose their stems');
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

test('Every dialect paints its own subdivision ink, and the tips carry the active style', () => {
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const resolved = resolveCandidate(candidate);
    const bach = renderJankoCrop(SCORE, 1, 2, resolved.options, resolved.tokens);
    assert.match(
      bach,
      new RegExp(`data-subdivision-style="${paradigm.style}"`),
      `${paradigm.id} dispatches the subdivision renderer`
    );
    // The per-hand clasp tips carry the same dialect, so a clasped cluster and a
    // flagged stem of one value can never disagree.
    const brahmsOptions = resolveJankoOptions({
      ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
      ...(candidate.options ?? {}),
    });
    const brahms = renderJankoCrop(BRAHMS, 7, 2, brahmsOptions, BRAHMS_OP118_NO1_JANKO_TOKENS);
    assert.match(brahms, /<g class="janko-clasp-layer">/, `${paradigm.id} paints its clasps`);
    for (const mark of brahms.matchAll(/class="janko-clasp-flag"[^>]*\/>/g)) {
      assert.match(
        mark[0],
        new RegExp(`data-subdivision-style="${paradigm.style}"`),
        `${paradigm.id} clasp tip dialect`
      );
    }
  }
});

test('The live studio engraves four candidates on two windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 8, 'two engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 8, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="2"/);
  assert.match(html, /Round 7/);
  assert.match(html, /Kinetic Subdivision Tabs/, 'the escaped round title headlines the view');
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
    if (paradigm.style === DEFAULT_JANKO_OPTIONS.subdivisionStyle) {
      assert.ok(
        !body.includes('<b>subdivisionStyle</b>'),
        'the classical control is the golden subdivision itself'
      );
    } else {
      assert.match(
        body,
        new RegExp(`<b>subdivisionStyle</b> = ${paradigm.style}`),
        `${paradigm.id} subdivision badge`
      );
      assert.match(
        body,
        /<s>classical-urtext<\/s>/,
        `${paradigm.id} shows the golden subdivision it departs from`
      );
    }
    assert.match(body, /badge-delta/, `${paradigm.id} highlights its delta`);
    assert.match(body, /class="janko-clasp-layer"/, `${paradigm.id} renders its clasp layer`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
  }
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four kinetic dialects on one document', () => {
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
    assert.match(panel, new RegExp(`data-subdivision-style="${paradigm.style}"`), `${paradigm.id} ink`);
  }
});
