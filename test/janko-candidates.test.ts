/**
 * Round 4 Domain Exploration — candidate registry invariant suite.
 *
 * The round isolates two variables the operator identified in Candidate B —
 * **line density** and **interval proportionality** — by engraving four
 * comparative paradigms of the channel domain:
 *
 * | # | id                  | rules/octave | Set A       | Set B            |
 * | - | ------------------- | ------------ | ----------- | ---------------- |
 * | A | `equator-floating`  | 1 (4 lines)  | `+7.5pt`    | `-7.5pt` static  |
 * | B | `equator-anchored`  | 1 (4 lines)  | `0pt` (rule)| `-15pt` static   |
 * | C | `single-line-3row`  | 1 (4 lines)  | `0pt` (rule)| `±15pt` contour  |
 * | D | `channel-bounded`   | 2 (8 lines)  | `0pt`       | `±13pt` contour  |
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 4` and the round question.
 *  2. `CURRENT_CANDIDATES` declares exactly the four paradigms A–D.
 *  3. Every candidate's resolved geometry matches the table above.
 *  4. Every candidate states its delta against the golden master.
 *  5. The live studio renders all four side by side with option deltas, rule
 *     counts and a live lint chip each.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
  getCandidate,
  resolveCandidate,
} from '../src/render/janko/candidates';
import { createStudioConfig, renderCandidatesView } from '../src/render/janko/studio';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CHANNEL_LAYOUTS,
  JankoChannelLayout,
  resolveJankoOptions,
} from '../src/render/janko/types';
import { getChannelLayoutSpec } from '../src/render/janko/geometry';
import { renderJankoCrop, renderJankoVariantComparison } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-4 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  layout: JankoChannelLayout;
  setAOffset: number;
  setBOffset: number;
  staffRules: number;
  dynamicFlanks: boolean;
  setAOnRule: boolean;
  lintViolations: number;
}> = [
  {
    id: 'equator-floating',
    letter: 'A',
    layout: 'single-equator',
    setAOffset: 7.5,
    setBOffset: -7.5,
    staffRules: 4,
    dynamicFlanks: false,
    setAOnRule: false,
    lintViolations: 0,
  },
  {
    id: 'equator-anchored',
    letter: 'B',
    layout: 'on-the-line',
    setAOffset: 0,
    setBOffset: -15.0,
    staffRules: 4,
    dynamicFlanks: false,
    setAOnRule: true,
    lintViolations: 2,
  },
  {
    id: 'single-line-3row',
    letter: 'C',
    layout: 'single-line-3row',
    setAOffset: 0,
    setBOffset: -15.0,
    staffRules: 4,
    dynamicFlanks: true,
    setAOnRule: true,
    lintViolations: 2,
  },
  {
    id: 'channel-bounded',
    letter: 'D',
    layout: 'bounded-channel',
    setAOffset: 0,
    setBOffset: -13.0,
    staffRules: 8,
    dynamicFlanks: true,
    setAOnRule: false,
    lintViolations: 0,
  },
];

test('CURRENT_ROUND_METADATA opens round 4 of the channel-domain exploration', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 4);
  assert.match(CURRENT_ROUND_METADATA.title, /Domain Exploration/);
  assert.match(CURRENT_ROUND_METADATA.description, /line|density|ink/i);
  assert.match(CURRENT_ROUND_METADATA.description, /43pt/, 'the 2-to-9 canyon is stated');
  assert.ok(CURRENT_ROUND_METADATA.description.length > 200, 'the round question is argued');
});

test('CURRENT_CANDIDATES declares the four paradigms A–D, one per channel layout', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    PARADIGMS.map((p) => p.id),
    'candidate order is A, B, C, D'
  );
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.channelLayout),
    [...JANKO_CHANNEL_LAYOUTS],
    'every channel layout of the domain is represented exactly once'
  );
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id);
    assert.ok(candidate, `${paradigm.id} is registered`);
    assert.ok(
      candidate!.label.startsWith(`${paradigm.letter} · `),
      `${paradigm.id} is labelled candidate ${paradigm.letter}`
    );
    assert.ok((candidate!.description ?? '').length > 80, `${paradigm.id} carries a rationale`);
    assert.equal(candidate!.measureStart, 1, 'the matrix compares mm. 1–2');
    assert.equal(candidate!.measureCount, 2);
    assert.ok((candidate!.tags ?? []).length > 0, `${paradigm.id} is tagged`);
  }
  // The density axis is stated as a tag, so the matrix is scannable at a glance.
  assert.deepEqual(getCandidate('equator-floating')!.tags, ['incumbent', '4 lines', 'static']);
  assert.ok(getCandidate('channel-bounded')!.tags?.includes('8 lines'));
});

test("Every candidate's geometry matches the round-4 table exactly", () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    const spec = getChannelLayoutSpec(resolved.options, resolved.tokens);
    assert.equal(spec.layout, paradigm.layout, `${paradigm.id} layout`);
    assert.equal(spec.setAOffset, paradigm.setAOffset, `${paradigm.id} Set A offset`);
    assert.equal(spec.setBOffset, paradigm.setBOffset, `${paradigm.id} Set B offset`);
    assert.equal(spec.flankMagnitude, Math.abs(paradigm.setBOffset), `${paradigm.id} flank`);
    assert.equal(spec.staffRules, paradigm.staffRules, `${paradigm.id} line count`);
    assert.equal(spec.dynamicFlanks, paradigm.dynamicFlanks, `${paradigm.id} flank resolution`);
    assert.equal(spec.setAOnRule, paradigm.setAOnRule, `${paradigm.id} rule anchoring`);

    // The rendered staff carries exactly that many rules, and 4 lines is the
    // shared floor of A/B/C while only D doubles the ink.
    const crop = renderJankoCrop(SCORE, 1, 2, resolved.options, resolved.tokens);
    const staff = crop.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
    assert.equal(
      (staff.match(/<line/g) ?? []).length,
      paradigm.staffRules,
      `${paradigm.id} paints ${paradigm.staffRules} staff rules`
    );
  }
  // The three 4-line paradigms are not the same drawing: B and C move Set A onto
  // the rule, and C additionally lets Set B swing to the far side.
  assert.notEqual(
    renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate('equator-floating')!).options, DEFAULT_JANKO_TOKENS),
    renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate('equator-anchored')!).options, DEFAULT_JANKO_TOKENS),
    'A and B are different engravings'
  );
  assert.notEqual(
    renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate('equator-anchored')!).options, DEFAULT_JANKO_TOKENS),
    renderJankoCrop(SCORE, 1, 2, resolveCandidate(getCandidate('single-line-3row')!).options, DEFAULT_JANKO_TOKENS),
    'B and C are different engravings'
  );
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
        [{ key: 'channelLayout', value: paradigm.layout, golden: 'single-equator' }],
        `${paradigm.id} departs from the golden master in the channel only`
      );
    }
    const resolved = resolveCandidate(candidate);
    for (const [key, value] of Object.entries(resolved.options)) {
      const gold = (golden as unknown as Record<string, unknown>)[key];
      if (key === 'channelLayout') {
        assert.equal(value, paradigm.layout);
        continue;
      }
      assert.deepEqual(value, gold, `${paradigm.id} keeps the golden ${key}`);
    }
    assert.deepEqual(resolved.tokens, DEFAULT_JANKO_TOKENS, `${paradigm.id} keeps every token`);
  }
});

test('The live studio renders all four candidates with deltas, rule counts and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 4, 'four cards, side by side');
  assert.match(html, /data-candidate-count="4"/);
  assert.equal((html.match(/<svg/g) ?? []).length, 4, 'one engraved preview per paradigm');
  assert.match(html, /Round 4/);
  assert.match(html, /Domain Exploration/);

  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const card = html.slice(html.indexOf(`data-candidate="${paradigm.id}"`));
    const nextCard = card.indexOf('data-candidate="', 1);
    const body = card.slice(0, nextCard === -1 ? undefined : nextCard);
    const at = html.indexOf(`data-candidate="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} appears in registry order`);
    cursor = at;
    assert.ok(body.includes(getCandidate(paradigm.id)!.label), `${paradigm.id} label`);
    assert.ok(
      body.includes(getCandidate(paradigm.id)!.description ?? ''),
      `${paradigm.id} rationale`
    );
    // Option delta badge (or the baseline badge for the golden master).
    if (paradigm.letter === 'A') {
      assert.match(body, /<b>baseline<\/b> = golden master/);
    } else {
      assert.match(body, new RegExp(`<b>channelLayout</b> = ${paradigm.layout}`));
      assert.match(body, /<s>single-equator<\/s>/, `${paradigm.id} shows the golden value it departs from`);
    }
    // The rule count that answers the density question.
    assert.match(
      body,
      new RegExp(`${paradigm.staffRules / 4} rule(s)?\\/octave \\(${paradigm.staffRules} lines\\)`),
      `${paradigm.id} states its rule count`
    );
    // Live lint verdict, recomputed from the candidate's own options.
    const report = lintJankoScore(SCORE, resolveCandidate(getCandidate(paradigm.id)!).options, DEFAULT_JANKO_TOKENS);
    assert.equal(
      report.violations.length,
      paradigm.lintViolations,
      `${paradigm.id} lint violation count`
    );
    assert.match(body, /chip chip-(ok|warn|error)/, `${paradigm.id} carries a chip`);
    assert.match(body, new RegExp(`data-lint="${report.ok ? 'clean' : 'violations'}"`));
  }
  // A is the untouched golden master; D is the 8-line datum. Both are clean.
  assert.match(html, /1 rule\/octave \(4 lines\)/);
  assert.match(html, /2 rules\/octave \(8 lines\)/);
  assert.match(html, /✗ 2 violations/);
});

test('The contact sheet engraves the four paradigms on one document', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => {
    const resolved = resolveCandidate(candidate);
    return { id: candidate.id, label: candidate.label, options: resolved.options };
  });
  const sheet = renderJankoVariantComparison(
    SCORE,
    specs,
    CURRENT_CANDIDATES[0].measureStart,
    CURRENT_CANDIDATES[0].measureCount,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.equal((sheet.match(/<svg/g) ?? []).length, 1, 'one sheet document');
  assert.equal((sheet.match(/data-variant="/g) ?? []).length, 4, 'four stacked panels');
  for (const paradigm of PARADIGMS) {
    assert.ok(sheet.includes(`data-variant="${paradigm.id}"`), `${paradigm.id} panel`);
    assert.ok(sheet.includes(paradigm.id) || sheet.includes('·'), `${paradigm.id} is labelled`);
  }
  // Only the bounded channel doubles the staff rules inside the sheet.
  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = sheet.indexOf(`data-variant="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} panel is in order`);
    cursor = at;
    const next = sheet.indexOf('data-variant="', at + 1);
    const panel = sheet.slice(at, next === -1 ? undefined : next);
    const staff = panel.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
    assert.equal(
      (staff.match(/<line/g) ?? []).length,
      paradigm.staffRules,
      `${paradigm.id} panel rule count`
    );
  }
});
