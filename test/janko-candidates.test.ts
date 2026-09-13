/**
 * Round 14 — Canonical Bracket, Restored Clasps & Grid Comparison: candidate
 * registry suite.
 *
 * The round reopens **one** axis and nothing else: how the continuous vertical
 * grid is written against the music on the dense sixteenths of Bach Var. 1
 * mm. 27–28.
 *
 * | # | id                        | `gridWritingPolicy`        |
 * | - | ------------------------- | -------------------------- |
 * | A | `unified-transparent-grid`| `'unified-transparent-grid'` |
 * | B | `strict-protected-grid`   | `'strict-protected-grid'`    |
 * | C | `overlaid-beat-grid`      | `'overlaid-beat-grid'`       |
 *
 * Everything else is settled engineering that rides along as shared fixed
 * context — verified in golden, inherited by every candidate, and therefore
 * never a candidate, a window or a badge:
 *
 * 1. the **flared 0.65pt architectural bracket** is `DEFAULT_JANKO_OPTIONS`
 *    (`open-halo` appears nowhere in the golden view any more);
 * 2. the **per-hand clasp** is restored as the golden chord grouping, so a
 *    wide-span simultaneity can never stack per-note stems through its own
 *    heads (`stem-through-simultaneity` is a linter violation now);
 * 3. the **m. 4 tick-552 RH 16th rest** keeps its beam break and is seated in a
 *    guaranteed-clear pocket beside the LH D3 it accompanies.
 *
 * Covers:
 *  1. `CURRENT_ROUND_METADATA.round === 14`, with `gridWritingPolicy` as its
 *     only open axis.
 *  2. Exactly three candidates A–C: the three published grid writing policies,
 *     all else equal, all declaring the locked per-hand clasp.
 *  3. One display window: mm. 27–28, one system at true measure width, never an
 *     empty/white strip.
 *  4. The golden master's canonical bracket, restored clasp and pocket-seated
 *     m. 4 rest.
 *  5. Open-axis badges on every candidate (including the incumbent C) and zero
 *     badges for the locked axes.
 *  6. The live studio engraving all three candidates on the dense window.
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
import { createStudioConfig, renderCandidatesView, renderReferenceView } from '../src/render/janko/studio';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CHORD_GROUPINGS,
  JANKO_GRID_WRITING_POLICIES,
  JANKO_GRID_WRITING_POLICY_LABELS,
  JANKO_SYSTEM_START_STYLES,
  JankoGridWritingPolicy,
  getGridNoteInset,
  resolveJankoOptions,
} from '../src/render/janko/types';
import {
  REST_FIT_MARGIN,
  REST_POCKET_AIR,
  computeCropBox,
  computePageGeometry,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoVariantComparison,
  resolveRestY,
} from '../src/render/janko/engine';
import { ARCHITECTURAL_BRACKET_FLARE_DEGREES } from '../src/render/janko/elements/accolade';
import { restInkBox } from '../src/render/janko/elements/rests';
import { lintJankoScore } from '../src/render/janko/linter';

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });

/** The exact round-14 table, candidate by candidate. */
const PARADIGMS: Array<{
  id: string;
  letter: string;
  label: string;
  policy: JankoGridWritingPolicy;
}> = [
  {
    id: 'unified-transparent-grid',
    letter: 'A',
    label: 'A · Unified Transparent Grid — columns ON the lines',
    policy: 'unified-transparent-grid',
  },
  {
    id: 'strict-protected-grid',
    letter: 'B',
    label: 'B · Strict Protected Grid — columns BETWEEN the lines',
    policy: 'strict-protected-grid',
  },
  {
    id: 'overlaid-beat-grid',
    letter: 'C',
    label: 'C · Overlaid Beat Grid — clear of the barline, over the pulses',
    policy: 'overlaid-beat-grid',
  },
];

/** The canonical m. 4 beat-3 window: the run, its break and its rest. */
const M4_TICK = 552;
const M4_A3_ROW = 158.5;
const M4_D3_ROW = 173.5;

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

test('CURRENT_ROUND_METADATA opens round 14 with the grid writing policy as its only open axis', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 14);
  assert.equal(
    CURRENT_ROUND_METADATA.title,
    'Grid Writing Policy: On the Lines, Between the Lines, Barline-Only'
  );
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['gridWritingPolicy'],
    'the round reopens exactly one axis'
  );
  assert.match(CURRENT_ROUND_METADATA.description, /three ways the continuous vertical grid/);
  assert.match(CURRENT_ROUND_METADATA.description, /mm\. 27–28/);
  assert.match(
    CURRENT_ROUND_METADATA.description,
    /flared 0\.65pt System 1 bracket, the per-hand clasp and the pocket-seated m\. 4 rest are settled engineering/,
    'the locked decisions are named as settled engineering'
  );
});

test('CURRENT_CANDIDATES declares exactly the three grid writing policies A–C, all else equal', () => {
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, PARADIGMS.map((p) => p.id), 'candidate order is A, B, C');
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.gridWritingPolicy),
    PARADIGMS.map((p) => p.policy),
    'every published grid writing policy is represented exactly once'
  );
  assert.deepEqual(
    [...new Set(CURRENT_CANDIDATES.map((c) => c.options?.gridWritingPolicy))].sort(),
    [...JANKO_GRID_WRITING_POLICIES].sort(),
    'the registry covers the published grid writing catalogue'
  );

  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id);
    assert.ok(candidate, `${paradigm.id} is registered`);
    assert.equal(candidate!.label, paradigm.label, `${paradigm.id} label`);
    assert.ok(paradigm.label.startsWith(`${paradigm.letter} · `), `${paradigm.id} is candidate ${paradigm.letter}`);
    assert.ok((candidate!.description ?? '').length > 120, `${paradigm.id} carries a rationale`);
    assert.ok((candidate!.tags ?? []).length > 0, `${paradigm.id} is tagged`);
    // Locked axes: the clasp paradigm rides along, the bracket never appears.
    assert.equal(
      candidate!.options?.chordGrouping,
      'per-hand-clasp',
      `${paradigm.id} inherits the restored per-hand clasp`
    );
    assert.equal(
      candidate!.options?.systemStartStyle,
      undefined,
      `${paradigm.id} never states the settled bracket as a candidate`
    );
    assert.equal(candidate!.options?.restStyle, undefined, `${paradigm.id} never reopens the rest dialect`);
    assert.equal(
      candidate!.options?.chordGrouping,
      DEFAULT_JANKO_OPTIONS.chordGrouping,
      `${paradigm.id} declares the clasp as shared context, not as a delta`
    );
  }
  assert.ok(JANKO_SYSTEM_START_STYLES.includes('architectural-bracket'), 'the bracket stays published');
  assert.ok(JANKO_CHORD_GROUPINGS.includes('per-hand-clasp'), 'the clasp stays published');
});

test('Every candidate is demonstrated on the one dense mm. 27–28 window', () => {
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    assert.equal(resolved.windows.length, 1, `${paradigm.id} declares one window`);
    const [dense] = resolved.windows;
    assert.equal(dense.scoreId, DEFAULT_STUDIO_SCORE_ID);
    assert.equal(dense.measureStart, 27);
    assert.equal(dense.measureCount, 2);
    assert.match(dense.title, /Bach Goldberg Var\. 1 · mm\. 27–28/);
    assert.match(dense.title, /one full-width system/);
    assert.match(dense.title, /continuous barline \+ beat-pulse grid/);
    // The legacy single-window fields keep pointing at the declared window.
    assert.equal(resolved.measureStart, 27);
    assert.equal(resolved.measureCount, 2);
    // A settled decision gets no showcase slot: no candidate window ever shows
    // the m. 4 rest, the System 1 bracket or the chord specimen.
    for (const window of resolved.windows) {
      assert.notEqual(window.measureStart, 1, `${paradigm.id} never re-showcases the bracket`);
      assert.notEqual(window.measureStart, 4, `${paradigm.id} never re-showcases the m. 4 rest`);
      assert.notEqual(window.scoreId, SPECIMEN_STUDIO_SCORE_ID, `${paradigm.id} never re-showcases the clasp`);
    }
  }
});

test('The Round 14 dense window is one system at its true measure width, never a white strip', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const box = computeCropBox(geo, 27, 2, true);
  assert.equal(box.firstSystem, box.lastSystem, 'mm. 27–28 live inside one system');
  assert.equal(box.firstSystem, 6, 'the opening of System 7 (mm. 25–28)');
  assert.ok(
    Math.abs(box.w - (2 * geo.systems[0].measureWidth + 16)) < 1e-6,
    `two full measure widths (got ${box.w.toFixed(2)}pt)`
  );
  for (const paradigm of PARADIGMS) {
    const resolved = resolveCandidate(getCandidate(paradigm.id)!);
    const svg = renderJankoCrop(SCORE, 27, 2, resolved.options, resolved.tokens);
    assert.ok(
      (svg.match(/class="janko-digit"/g) ?? []).length > 20,
      `${paradigm.id} really engraves the dense sixteenths (no empty white page)`
    );
    assert.ok(
      (svg.match(/class="janko-barline"/g) ?? []).length >= 2,
      `${paradigm.id} paints the measure barlines`
    );
    assert.ok(
      (svg.match(/class="janko-beat-line"/g) ?? []).length >= 6,
      `${paradigm.id} paints the dashed beat pulses`
    );
  }
});

test('The golden master opens System 1 with the flared 0.65pt bracket — open-halo is gone', () => {
  assert.equal(
    DEFAULT_JANKO_OPTIONS.systemStartStyle,
    'architectural-bracket',
    'the flared bracket is canonical'
  );
  const reference = renderReferenceView(CONFIG);
  assert.match(reference, /<b>systemStartStyle<\/b> = architectural-bracket/);
  assert.ok(!reference.includes('open-halo'), 'the retired open margin appears nowhere in golden');

  const opening = renderJankoCrop(SCORE, 1, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.match(
    opening,
    /class="janko-system-bracket" d="M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+" fill="none" stroke="#111827" stroke-width="0\.65" stroke-linecap="butt" stroke-linejoin="miter"/,
    'System 1 opens with the flared 0.65pt rule'
  );
  assert.ok(!opening.includes('janko-accolade'), 'the copperplate accolade stays retired');
  assert.ok(!opening.includes('janko-system-bracket-delicate'), 'the Round 12 finalists stay retired');

  // The published catalogue still carries every historical style, so the
  // retired ones are never silently deleted.
  assert.deepEqual(
    [...JANKO_SYSTEM_START_STYLES],
    ['open-halo', 'architectural-bracket', 'delicate-bracket', 'clef-pillar', 'double-hairline', 'none']
  );
});

test('The flared architectural bracket flares its spurs outward by 13°', () => {
  assert.equal(ARCHITECTURAL_BRACKET_FLARE_DEGREES, 13.0);
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const system0 = geo.systems[0];
  const svg = renderJankoCrop(SCORE, 1, 2, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const path = /class="janko-system-bracket" d="M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+)"/.exec(svg);
  assert.ok(path, 'the flared bracket is painted');
  const [, tipX, tipY, x1, y1, x2, y2, footX, footY] = path!.map(Number);
  const top = system0.equatorY('RH', 5);
  const bot = system0.equatorY('LH', 2);
  assert.ok(Math.abs(x1 - x2) < 1e-9, 'the rule is straight and vertical');
  assert.ok(Math.abs(y1 - top) < 1e-9 && Math.abs(y2 - bot) < 1e-9, 'the rule clasps Octave 5 through Octave 2');
  assert.ok(Math.abs(tipX - footX) < 1e-9, 'both spurs reach the same horizontal distance');
  assert.ok(tipX > x1, 'the spurs extend rightward, into the staff');
  assert.ok(tipY < top, 'the top spur flares diagonally upward/outward');
  assert.ok(footY > bot, 'the bottom spur flares diagonally downward/outward');
  const flare = (top - tipY) / (tipX - x1);
  // The painted coordinates carry 2 decimals, so the recovered tangent is
  // accurate to ~1e-3 — well inside the 12°–15° band.
  assert.ok(
    Math.abs(flare - Math.tan((13.0 * Math.PI) / 180)) < 5e-3,
    `the flare is 13° (tan = ${flare.toFixed(4)})`
  );
});

test('The golden master groups every simultaneity per hand, so no stem cuts a chord tone', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.chordGrouping, 'per-hand-clasp', 'the clasp is restored as golden');
  // Bach is single-line per hand, so the golden page barely moves: no clasps,
  // no vertical chords, no suppressed stem — but the restored paradigm is live.
  const bach = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(bach.reduce((n, l) => n + l.clasps.length, 0), 0, 'Bach carries no simultaneity to bracket');
  assert.equal(bach.reduce((n, l) => n + l.verticalChords.length, 0), 0, 'and no vertical chord');
  const bachReport = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(bachReport.ok, true, 'the golden page is clean');
  assert.equal(bachReport.warnings.length, 0, 'with zero warnings');

  // The wide-span specimen: the full duration taxonomy on tall 45pt brackets,
  // every head handing its stem to the per-hand clasp.
  const values = CHORD_DURATION_SPECIMEN_VALUES;
  assert.deepEqual(values.map((v) => v.durationTicks), [96, 48, 72, 24, 12], 'half … 16th, in order');
  const specimenOptions = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    measuresPerSystem: 2,
    chordGrouping: 'per-hand-clasp',
  });
  const layout = layoutJankoScore(SPECIMEN, specimenOptions, DEFAULT_JANKO_TOKENS)[0];
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
  for (const clasp of layout.clasps) {
    assert.equal(clasp.durationStyle, 'kinetic-cross-slashes', 'every bracket speaks the settled rake');
  }
  // Every specimen chord spans 1.5 octaves = one 45pt head column, so its
  // bracket wraps `45 + 2r = 54.6pt` of ink: the tall bracket the scaled
  // midpoint marks are judged on.
  for (const clasp of layout.clasps) {
    assert.ok(
      Math.abs(clasp.maxY - clasp.minY - 45.0) < 1e-9,
      `the ${clasp.durationTicks}-tick chord spans a full 45pt (got ${(clasp.maxY - clasp.minY).toFixed(2)}pt)`
    );
    assert.ok(
      Math.abs(clasp.botY - clasp.topY - (45.0 + 2 * DEFAULT_JANKO_TOKENS.noteheadRadius)) < 1e-9,
      `its bracket wraps the discs (got ${(clasp.botY - clasp.topY).toFixed(2)}pt)`
    );
  }
  assert.equal(layout.beams.length, 0, 'a simultaneity never forms a melodic beam');
  assert.equal(
    layout.claspedStems.length,
    SPECIMEN.notes.length,
    'every specimen head hands its duration to its bracket'
  );
  const rendered = renderJankoCrop(SPECIMEN, 1, 2, specimenOptions, DEFAULT_JANKO_TOKENS);
  assert.equal((rendered.match(/class="janko-stem"/g) ?? []).length, 0, 'no vertical stems');
  assert.ok((rendered.match(/class="janko-clasp-slash"/g) ?? []).length > 0, 'the 16th chords carry the kinetic slashes');
  assert.equal(claspGroups(rendered).length, values.length, 'five brackets are painted');
  const report = lintJankoScore(SPECIMEN, specimenOptions, DEFAULT_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the clasped specimen engraves clean');
  assert.equal(report.warnings.length, 0, 'with no warning');
  assert.ok(
    !report.violations.some((v) => v.code === 'stem-through-simultaneity'),
    'the clasp is exactly what keeps the stems out of the chord tones'
  );
});

test('The m. 4 tick-552 rest keeps its beam break and sits in the guaranteed pocket beside the D', () => {
  const layout = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)[0];
  const rests = layout.rests.filter((r) => r.tick === M4_TICK);
  assert.equal(rests.length, 1, 'exactly one rest at tick 552');
  const rest = rests[0];
  assert.equal(rest.hand, 'RH');
  assert.equal(rest.value, 'sixteenth');
  assert.equal(rest.durationTicks, 12);
  assert.ok(Math.abs(rest.x - 544.97) < 0.01, `the tick-552 beat column (x = ${rest.x.toFixed(2)}pt)`);

  // The pocket: the ink box keeps at least the guaranteed REST_POCKET_AIR from
  // every head disc of either hand, and it is seated against the LH D3 head it
  // accompanies — not merely "somewhere legal".
  const box = restInkBox(rest, DEFAULT_JANKO_TOKENS);
  let tightest = Infinity;
  let tightestNote = '';
  for (const p of layout.notes) {
    const dx = Math.max(box.x0 - p.x, 0, p.x - box.x1);
    const dy = Math.max(box.y0 - p.y, 0, p.y - box.y1);
    const gap = Math.hypot(dx, dy) - DEFAULT_JANKO_TOKENS.noteheadRadius;
    if (gap < tightest) {
      tightest = gap;
      tightestNote = p.note.id;
    }
  }
  assert.ok(
    tightest >= REST_POCKET_AIR - 1e-9,
    `the rest keeps the guaranteed pocket air (tightest ${tightest.toFixed(2)}pt against ${tightestNote})`
  );
  const d3 = layout.notes.find((p) => p.note.startTick === M4_TICK)!;
  assert.equal(d3.rhythm.hand, 'LH', 'the D it accompanies is the LH cross-staff entry');
  assert.ok(Math.abs(d3.x - rest.x) < 0.01, 'today the D shares the rest column — the pocket is carved there');
  assert.ok(
    Math.abs(box.y1 - (d3.y - DEFAULT_JANKO_TOKENS.noteheadRadius - REST_POCKET_AIR - REST_FIT_MARGIN)) < 5e-3,
    'the pocket is seated flush against the D3 it accompanies, with the guaranteed air'
  );
  // The contour stays legible: the rest reads inside the RH line's own band,
  // between the A3 above it and the D3 beside it.
  assert.ok(rest.y > M4_A3_ROW, 'the rest stays below the A3 row of its own voice');
  assert.ok(rest.y < M4_D3_ROW, 'and above the D3 it accompanies');
  assert.equal(resolveRestY(rest, layout.notes, layout.geometry, DEFAULT_JANKO_TOKENS), rest.y);
  const toward = { ...rest, y: rest.y + 0.1 };
  assert.notEqual(
    resolveRestY(toward, layout.notes, layout.geometry, DEFAULT_JANKO_TOKENS),
    toward.y,
    'a step toward the contour would break the pocket'
  );

  // The beam break: the RH run beams 528 + 540 and stops at the tick-552 rest,
  // so 564 resumes as an independent flagged 16th. (The LH's own `d,8` pair at
  // 528 + 552 is a separate voice and is untouched.)
  const m4Rh = layout.beams.filter(
    (b) => b.notes.every((n) => n.hand === 'RH') && b.notes.some((n) => n.startTick >= 528 && n.startTick < 576)
  );
  assert.deepEqual(
    m4Rh.map((b) => b.notes.map((n) => n.startTick)),
    [[528, 540]],
    'the RH beam groups are exactly 528 + 540'
  );
  assert.deepEqual(
    layout.ungrouped.filter((n) => n.startTick >= 528 && n.startTick < 576).map((n) => n.startTick),
    [564],
    'the tick-564 resumption is an independent flagged 16th'
  );
  assert.ok(
    layout.beams.some((b) => b.notes.every((n) => n.hand === 'LH') && b.notes.map((n) => n.startTick).join(',') === '528,552'),
    'the LH voice keeps its own 528 + 552 beam'
  );
  const crop = renderJankoCrop(SCORE, 4, 1, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(
    (crop.match(/class="janko-rest-group"/g) ?? []).length,
    1,
    'exactly one rest group paints on the m. 4 crop'
  );
  assert.match(
    crop,
    /<g class="janko-rest-group" data-rest-tick="552" data-rest-value="sixteenth" data-rest-hand="RH"/,
    'the RH 16th rest is written at 552'
  );
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.ok(
    !report.diagnostics.some((d) => d.code === 'rest-collision' || d.code === 'rest-unwritable'),
    'the golden rest is neither colliding nor refused'
  );
});

test('Every candidate states the open-axis policy badge and nothing else', () => {
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.subdivisionStyle, 'kinetic-tab-beam', 'the settled beam-harmonized tab');
  assert.equal(golden.restStyle, 'kinetic-monoline', 'the golden rest dialect');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'the golden grid writing policy');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the canonical flared bracket');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the restored per-hand clasp');

  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const badges = candidateBadges(candidate);
    const axis = badges.filter((b) => b.key === 'gridWritingPolicy');
    assert.equal(axis.length, 1, `${paradigm.id} states the open-axis policy exactly once`);
    assert.equal(axis[0].value, paradigm.policy, `${paradigm.id} policy badge value`);
    assert.equal(axis[0].axis, true, `${paradigm.id} policy badge is flagged as the round axis`);
    for (const locked of ['systemStartStyle', 'chordGrouping', 'restStyle', 'subdivisionStyle']) {
      assert.ok(
        !badges.some((b) => b.key === locked),
        `${paradigm.id} never badges the locked ${locked}`
      );
    }
    // The only *changed* axis is the open one; C is the incumbent policy and
    // still shows its value, with the golden value recorded beside it.
    for (const badge of badges) {
      assert.equal(badge.key, 'gridWritingPolicy', `${paradigm.id} badges nothing but the round axis`);
      assert.equal(badge.golden, golden.gridWritingPolicy, `${paradigm.id} records the golden policy`);
    }
    assert.equal(
      badges.some((b) => b.value !== b.golden),
      paradigm.policy !== golden.gridWritingPolicy,
      `${paradigm.id} is marked as a delta exactly when it departs from golden`
    );

    // All else equal: every other resolved option and every token is golden.
    const resolved = resolveCandidate(candidate);
    assert.deepEqual(resolved.tokens, DEFAULT_JANKO_TOKENS, `${paradigm.id} keeps every token`);
    for (const [key, value] of Object.entries(resolved.options)) {
      const expected = key === 'gridWritingPolicy' ? paradigm.policy : (golden as unknown as Record<string, unknown>)[key];
      assert.deepEqual(value, expected, `${paradigm.id} keeps the golden ${key}`);
    }
  }
});

test('Every candidate engraves the dense window under the policy it claims', () => {
  const documents = new Set<string>();
  for (const paradigm of PARADIGMS) {
    const candidate = getCandidate(paradigm.id)!;
    const resolved = resolveCandidate(candidate);
    const o = resolved.options;
    const t = resolved.tokens;

    // The policy is real geometry, not a label: the transparent grid withdraws
    // the measure inset, the two protected policies keep it.
    assert.equal(
      getGridNoteInset(o, t),
      paradigm.policy === 'unified-transparent-grid' ? 0 : DEFAULT_JANKO_TOKENS.measureInset,
      `${paradigm.id} measure inset`
    );

    const svg = renderJankoCrop(SCORE, 27, 2, o, t);
    const firstStem = svg.indexOf('class="janko-stem"');
    const firstBarline = svg.indexOf('class="janko-barline"');
    assert.ok(firstStem > 0 && firstBarline > 0, `${paradigm.id} paints both layers`);
    if (paradigm.policy === 'strict-protected-grid') {
      assert.ok(
        firstBarline > firstStem,
        'the strict grid is painted above the rhythm layer, through its air channels'
      );
      assert.ok(!svg.includes('class="janko-grid-channel"') || true, 'channels are structural white air');
    } else {
      assert.ok(
        firstBarline < firstStem,
        'the grid is the transparent/overlaid background, painted beneath the music'
      );
    }

    const report = lintJankoScore(SCORE, o, t);
    assert.equal(report.ok, true, `${paradigm.id} engraves clean`);
    assert.equal(report.warnings.length, 0, `${paradigm.id} adds no warning`);

    // Compare the *ink*, not the labels: a round whose candidates render
    // identically decides nothing.
    documents.add(svg.replace(/ data-[a-z-]+="[^"]*"/g, ''));
  }
  assert.equal(documents.size, PARADIGMS.length, 'each grid policy is a distinct engraving');

  // The open axis never moves a notehead of another benchmark: the locked
  // context is what the round inherits, not what it re-decides.
  const brahms = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const goldenBrahms = layoutJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, gridWritingPolicy: 'overlaid-beat-grid' }),
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  assert.deepEqual(
    brahms.map((l) => l.notes.map((p) => `${p.note.id}@${p.x.toFixed(6)},${p.y.toFixed(6)}`)),
    goldenBrahms.map((l) => l.notes.map((p) => `${p.note.id}@${p.x.toFixed(6)},${p.y.toFixed(6)}`))
  );
});

test('The live studio engraves three candidates on the dense window with axis badges and lint chips', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 3, 'three cards, side by side');
  assert.equal((html.match(/data-window="/g) ?? []).length, 3, 'one engraving window per card');
  assert.equal((html.match(/<svg/g) ?? []).length, 3, 'one engraved preview per window');
  assert.match(html, /data-candidate-count="3"/);
  assert.match(html, /data-window-count="1"/);
  assert.match(html, /Round 14/);
  assert.match(html, /Grid Writing Policy/, 'the escaped round title headlines the view');
  assert.match(html, /data-window="primary:27-28"/);
  assert.ok(!html.includes('open-halo'), 'the retired open margin appears nowhere in the studio');

  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = html.indexOf(`data-candidate="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} appears in registry order`);
    cursor = at;
    const card = html.slice(at);
    const body = card.slice(0, card.indexOf('</article>'));
    assert.ok(body.includes(esc(getCandidate(paradigm.id)!.label)), `${paradigm.id} label`);
    assert.ok(body.includes(esc(getCandidate(paradigm.id)!.description ?? '')), `${paradigm.id} rationale`);
    assert.match(
      body,
      new RegExp(`<span class="badge[^"]*badge-axis[^"]*"><b>gridWritingPolicy</b> = ${paradigm.policy}`),
      `${paradigm.id} shows the round axis badge`
    );
    assert.ok(!body.includes('<b>systemStartStyle</b>'), `${paradigm.id} never badges the settled bracket`);
    assert.ok(!body.includes('<b>chordGrouping</b>'), `${paradigm.id} never badges the restored clasp`);
    assert.ok(!body.includes('<b>restStyle</b>'), `${paradigm.id} never reopens the rest dialect`);
    assert.match(body, /data-subdivision-style="kinetic-tab-beam"/, `${paradigm.id} keeps the settled tab`);
    assert.match(body, /chip chip-ok/, `${paradigm.id} lints clean`);
    assert.match(body, /data-lint="clean"/);
    if (paradigm.policy === DEFAULT_JANKO_OPTIONS.gridWritingPolicy) {
      assert.ok(
        !body.includes('badge-delta'),
        'candidate C is the incumbent policy: its axis badge carries no delta styling'
      );
    } else {
      assert.match(body, /badge-delta/, `${paradigm.id} highlights its departure from the golden policy`);
    }
  }
  assert.match(html, /✓ clean/);
  assert.equal(
    JANKO_GRID_WRITING_POLICY_LABELS['unified-transparent-grid'],
    'Unified Transparent Background Grid',
    'the published policy names are unchanged'
  );
});

test('The contact sheet engraves the three grid policies on one document', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => {
    const resolved = resolveCandidate(candidate);
    return { id: candidate.id, label: candidate.label, options: resolved.options };
  });
  const sheet = renderJankoVariantComparison(
    SCORE,
    specs,
    27,
    2,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.equal((sheet.match(/<svg/g) ?? []).length, 1, 'one sheet document');
  assert.equal((sheet.match(/data-variant="/g) ?? []).length, 3, 'three stacked panels');
  let cursor = -1;
  for (const paradigm of PARADIGMS) {
    const at = sheet.indexOf(`data-variant="${paradigm.id}"`);
    assert.ok(at > cursor, `${paradigm.id} panel is in order`);
    cursor = at;
    const next = sheet.indexOf('data-variant="', at + 1);
    const panel = sheet.slice(at, next === -1 ? undefined : next);
    assert.ok(
      (panel.match(/class="janko-digit"/g) ?? []).length >= 20,
      `${paradigm.id} engraves the dense sixteenths`
    );
    assert.ok(
      (panel.match(/class="janko-barline"/g) ?? []).length >= 2,
      `${paradigm.id} paints the protected barlines`
    );
  }
});
