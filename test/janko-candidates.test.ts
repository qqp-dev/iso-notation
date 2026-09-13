/**
 * Round 5 — Left Clasp / Bracket Duration Carrier: candidate registry suite.
 *
 * The round interrogates the external left clasp as a simultaneous grouping
 * bracket **and** duration carrier, on two display windows at once:
 *
 * | # | id                       | `chordGrouping`      | grouping unit            |
 * | - | ------------------------ | -------------------- | ------------------------ |
 * | A | `traditional-stems`      | `'none'`             | per-note stems (golden)  |
 * | B | `independent-left-clasp` | `'left-clasp-spire'` | one chord / cluster      |
 * | C | `beamed-clasp-rail`      | `'beamed-clasp-rail'`| + measure-bounded rail   |
 * | D | `bounding-phrase-clasp`  | `'bounding-phrase'`  | one measure (the phrase) |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 5` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four paradigms A–D.
 *  3. Each candidate's only delta against the golden master is `chordGrouping`.
 *  4. Both display windows (Bach mm. 1–2 and Brahms mm. 7–8) are declared.
 *  5. The live studio engraves all four candidates on both windows with option
 *     deltas, the clasp grammar and a live lint chip each.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
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
  JankoChordGrouping,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-5 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  mode: JankoChordGrouping;
  /** Clasps the paradigm paints across the canonical Bach score. */
  bachClasps: number;
  /** Standalone stems it replaces across the canonical Bach score. */
  bachReplacedStems: number;
}> = [
  { id: 'traditional-stems', letter: 'A', mode: 'none', bachClasps: 0, bachReplacedStems: 0 },
  { id: 'independent-left-clasp', letter: 'B', mode: 'left-clasp-spire', bachClasps: 36, bachReplacedStems: 21 },
  { id: 'beamed-clasp-rail', letter: 'C', mode: 'beamed-clasp-rail', bachClasps: 36, bachReplacedStems: 21 },
  { id: 'bounding-phrase-clasp', letter: 'D', mode: 'bounding-phrase', bachClasps: 23, bachReplacedStems: 62 },
];

test('CURRENT_ROUND_METADATA opens round 5 of the chord-duration exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 5);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Chord & Cluster Duration — Left Clasp with Barline Clearance'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /clasp/i);
  assert.match(CURRENT_ROUND_METADATA.description, /barline/i);
  assert.match(CURRENT_ROUND_METADATA.description, /through-stems/i);
  assert.match(CURRENT_ROUND_METADATA.description, /collision/i);
});

test('CURRENT_CANDIDATES declares the four clasp paradigms A–D', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C, D');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.chordGrouping),
    PARADIGMS.map((p) => p.mode),
    'every chord-grouping paradigm is represented exactly once'
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
  assert.equal(
    getCandidate('traditional-stems')!.label,
    'A · Traditional Stems (Golden Master)'
  );
  assert.equal(getCandidate('independent-left-clasp')!.label, 'B · Independent Left Clasp');
  assert.equal(getCandidate('beamed-clasp-rail')!.label, 'C · Beamed Clasp Rail');
  assert.equal(getCandidate('bounding-phrase-clasp')!.label, 'D · Bounding Phrase Clasp');
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
    assert.match(bach.title, /opening chord/i);
    assert.match(bach.title, /16th/i);
    assert.equal(brahms.scoreId, BRAHMS_STUDIO_SCORE_ID);
    assert.equal(brahms.measureStart, 7);
    assert.equal(brahms.measureCount, 2);
    assert.match(brahms.title, /Brahms Op\. 118 No\. 1 · mm\. 7–8/);
    assert.match(brahms.title, /macro crop/i);
    // The legacy single-window fields keep pointing at the first window.
    assert.equal(resolved.measureStart, 1);
    assert.equal(resolved.measureCount, 2);
  }
});

test('The Brahms window really contains the dense block chords the round targets', () => {
  const brahms = buildBrahmsOp118No1Score();
  const onsets = new Map<number, number>();
  for (const n of brahms.notes) onsets.set(n.startTick, (onsets.get(n.startTick) ?? 0) + 1);
  // Cut time: the anacrusis is 48 ticks, mm. 7–8 span ticks 1200..1584.
  const window = [...onsets.entries()].filter(([tick]) => tick >= 1200 && tick < 1584);
  const chords = window.filter(([, size]) => size >= 2);
  assert.ok(chords.length >= 4, `mm. 7–8 carry the dense chord onsets (${chords.length})`);
  assert.ok(Math.max(...chords.map(([, size]) => size)) >= 5, 'one of them is a five-voice chord');
  const massive = chords.filter(([, size]) => size >= 4);
  assert.ok(massive.length >= 2, 'at least two four-plus-voice sonorities');
});

test('Every candidate states its single delta against the golden master', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const badges = candidateBadges(candidate);
    if (paradigm.letter === 'A') {
      assert.deepEqual(badges, [{ key: 'baseline', value: 'golden master', golden: 'golden master' }]);
    } else {
      assert.deepEqual(
        badges,
        [{ key: 'chordGrouping', value: paradigm.mode, golden: 'none' }],
        `${paradigm.id} departs from the golden master in the chord grouping only`
      );
    }
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      const gold = (golden as unknown as Record<string, unknown>)[key];
      if (key === 'chordGrouping') {
        assert.equal(value, paradigm.mode);
        continue;
      }
      assert.deepEqual(value, gold, `${paradigm.id} keeps the golden ${key}`);
    }
    assert.deepEqual(resolved.tokens, DEFAULT_JANKO_TOKENS, `${paradigm.id} keeps every token`);
  }
});

test('Every paradigm engraves the canonical score with the clasp counts its rationale claims', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    const layouts = layoutJankoScore(SCORE, resolved.options, resolved.tokens);
    const clasps = layouts.reduce((n, l) => n + l.clasps.length, 0);
    const replaced = layouts.reduce((n, l) => n + l.claspedStems.length, 0);
    assert.equal(clasps, paradigm.bachClasps, `${paradigm.id} clasp count`);
    assert.equal(replaced, paradigm.bachReplacedStems, `${paradigm.id} replaced stem count`);
    // The melodic writing is untouched: beams are identical in every paradigm.
    const golden = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
    assert.deepEqual(
      layouts.map((l) => l.beams.length),
      golden.map((l) => l.beams.length),
      `${paradigm.id} never re-partitions a beam`
    );
    const report = lintJankoScore(SCORE, resolved.options, resolved.tokens);
    assert.equal(report.ok, true, `${paradigm.id} engraves clean`);
    assert.equal(report.warnings.length, 0, `${paradigm.id} adds no warning`);
  }
  // Only the clasp paradigms paint a clasp layer at all.
  assert.equal(
    (renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate('traditional-stems')!).options, DEFAULT_JANKO_TOKENS).match(/janko-clasp/g) ?? []).length,
    0
  );
  for (const id of ['independent-left-clasp', 'beamed-clasp-rail', 'bounding-phrase-clasp']) {
    const crop = renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate(id)!).options, DEFAULT_JANKO_TOKENS);
    assert.match(crop, /<g class="janko-clasp-layer">/, `${id} paints its clasps`);
    assert.match(crop, /class="janko-clasp-group"/, `${id} groups the opening chord`);
  }
});

test('The live studio engraves four candidates on two windows with deltas and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 8, 'two engraving windows per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 8, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="4"/);
  assert.match(html, /data-window-count="2"/);
  assert.match(html, /Round 5/);
  assert.match(html, /Chord &amp; Cluster Duration/, 'the escaped round title headlines the view');
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
    if (paradigm.letter === 'A') {
      assert.match(body, /<b>baseline<\/b> = golden master/);
      assert.ok(!body.includes('<b>chordGrouping</b>'), 'A is the untouched golden master');
    } else {
      assert.match(body, new RegExp(`<b>chordGrouping</b> = ${paradigm.mode}`), `${paradigm.id} grouping badge`);
      assert.match(body, /<s>none<\/s>/, `${paradigm.id} shows the golden value it departs from`);
      assert.match(body, /badge-delta/);
    }
    if (paradigm.letter === 'A') {
      assert.ok(!body.includes('janko-clasp-layer'), 'A keeps per-note stems');
    } else {
      assert.match(body, /class="janko-clasp-layer"/, `${paradigm.id} renders its clasp layer`);
    }
    assert.match(body, new RegExp(`clasp 2\\.8pt offset / 4\\.0pt barline air`), `${paradigm.id} states the tokens`);
    const report = lintJankoScore(SCORE, resolveCandidate(getCandidate(paradigm.id)!).options, DEFAULT_JANKO_TOKENS);
    assert.equal(report.ok, true, `${paradigm.id} is clean on the canonical score`);
    assert.match(body, /chip chip-ok/);
    assert.match(body, /data-lint="clean"/);
  }
  // The golden master card paints no clasp at all.
  const goldenBody = html.slice(html.indexOf('data-candidate="traditional-stems"'));
  assert.ok(
    !goldenBody.slice(0, goldenBody.indexOf('</article>')).includes('janko-clasp-layer'),
    'candidate A keeps per-note stems'
  );
  assert.match(html, /✓ clean/);
});

test('The contact sheet engraves the four paradigms on one document', () => {
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
    // A crop renders the whole system (four measures): the chord paradigms
    // clasp the four downbeat/interior dyads, the phrase paradigm one bracket
    // per chord-bearing measure, and the golden master none at all.
    const clasps = (panel.match(/class="janko-clasp-group"/g) ?? []).length;
    assert.equal(
      clasps,
      paradigm.letter === 'A' ? 0 : paradigm.letter === 'D' ? 3 : 4,
      `${paradigm.id} panel clasp count (system of mm. 1–4)`
    );
  }
});
