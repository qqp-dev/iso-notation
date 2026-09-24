/**
 * Round 30 — duration-grammar preview (rings, dots, levels) + Brahms as a
 * first-class iteration surface.
 *
 *  1. Grammar core: exact notated-value analysis (plain/dotted/double/out).
 *  2. Geometry: stem rings, second dots (singles + brackets), flags/levels.
 *  3. Census: EVERY changed note by id/tick (the flip checklist) + the
 *     unchanged classes (out-of-grammar byte-pins, Bach byte-identity).
 *  4. Linter: the preview adds nothing to the golden's report on either
 *     score (Bach clean; Brahms carries the 2 accepted 4-up slot findings
 *     under both grammars); the new audits are option-aware (golden silent).
 *  5. Registry + Reference (PARKED Round 31 — judgment withheld, historical
 *     consts below): two cards, one axis, proofread captions, dual golden
 *     spread with Brahms beside Bach.
 *
 * Round 31 parks this round by convention: §5 asserts on historical consts
 * (exact R28/R29 precedent) while §§1–4 stay live on the adaptive engine
 * pins. Flip-time debt: when the cards return for judgment post-cleanup, the
 * §3 census must be re-verified on fixed-3 (the R30 counts were proven under
 * adaptive; the studio's Brahms is fixed-3 since Round 31).
 *
 * The golden grammar is the incumbent throughout: option-off renders equal
 * the current golden byte-for-byte on both scores, and the preview changes
 * ink only — never grouping, never suppression, never the clasp set.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';

import {
  BRAHMS_STUDIO_SCORE_ID,
  JankoCandidate,
  JankoCandidateRound,
  brahmsWindow,
  candidateBadges,
  resolveCandidate,
} from '../src/render/janko/candidates';
import {
  NOTATED_PLAIN_VALUES,
  OUT_OF_GRAMMAR_DURATIONS,
  analyzeNotatedDuration,
  durationDotCount,
  durationFlagCount,
  durationRingCount,
} from '../src/render/janko/elements/duration';
import {
  CLASP_MARK_STACK_GAP,
  CLASP_RING_RADIUS,
  CLASP_RING_STROKE,
  JankoRhythmNote,
  beamLevel,
  claspInkBox,
  claspMarkDaylight,
  computeBeamGroupGeometry,
  getStemGeometry,
  renderBeamGroup,
  renderClaspGroup,
  renderFlags,
  resolveClaspInk,
  stemRingCenters,
  subdivisionMarkCount,
} from '../src/render/janko/elements/rhythm';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoSystems,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  renderSystem,
  suppressedStemIds,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { buildInkScene, sceneSoloAt, sceneSoloSvg } from '../src/render/janko/ink-scene';
import { soloPieceAt } from '../src/render/janko/solo-scene';
import {
  StudioCrop,
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';


const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
/** The studio's Brahms golden: the lint-gated adaptive config. */
const O_BRAHMS = resolveJankoOptions({ ...BRAHMS_ROUND44_RESERVE_OPTIONS, core: 'adaptive' });
const T_BRAHMS = resolveJankoTokens(BRAHMS_ROUND44_RESERVE_TOKENS);
const O_BRAHMS_PREVIEW = resolveJankoOptions({
  ...BRAHMS_ROUND44_RESERVE_OPTIONS,
  core: 'adaptive',
  durationGrammar: 'complete',
});
const O_BACH_PREVIEW = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, durationGrammar: 'complete' });

/** One synthetic rhythm note (hand-built callers exercise renderer fallbacks). */
function rn(
  id: string,
  x: number,
  y: number,
  durationTicks: number,
  startTick = 100,
  hand: 'RH' | 'LH' = 'RH'
): JankoRhythmNote {
  return { id, x, y, durationTicks, startTick, hand };
}

const countDots = (svg: string): number => (svg.match(/janko-augmentation-dot/g) ?? []).length;
const countRings = (svg: string): number => (svg.match(/janko-stem-ring/g) ?? []).length;

// ---------------------------------------------------------------------------
// 1. Grammar core: exact analysis, no thresholds
// ---------------------------------------------------------------------------

test('analyzeNotatedDuration reads plain, dotted and double-dotted exactly', () => {
  for (const p of NOTATED_PLAIN_VALUES) {
    assert.deepEqual(analyzeNotatedDuration(p), { base: p, dots: 0, inGrammar: true });
  }
  // Dotted = base × 1.5, exactly (integer factors only: 2d = 3p).
  const dotted: Array<[number, number]> = [
    [9, 6],
    [18, 12],
    [36, 24],
    [72, 48],
    [144, 96],
    [288, 192],
  ];
  for (const [d, base] of dotted) {
    assert.deepEqual(analyzeNotatedDuration(d), { base, dots: 1, inGrammar: true }, `${d} ticks`);
  }
  // Double-dotted = base × 1.75, exactly (4d = 7p).
  const doubled: Array<[number, number]> = [
    [21, 12],
    [42, 24],
    [84, 48],
    [168, 96],
    [336, 192],
  ];
  for (const [d, base] of doubled) {
    assert.deepEqual(analyzeNotatedDuration(d), { base, dots: 2, inGrammar: true }, `${d} ticks`);
  }
});

test('analyzeNotatedDuration rejects the tie/tuplet/hold durations (verified list)', () => {
  // Verified by exact factor check against the corpus census: none of these
  // reads as plain, ×1.5 of plain, or ×1.75 of plain. 108 = 72×1.5 and
  // 126 = 84×1.5 dot an already-dotted value (ties, not notation);
  // 150/360/501 and the rest factor against nothing.
  assert.deepEqual(
    [...OUT_OF_GRAMMAR_DURATIONS].sort((a, b) => a - b),
    [63, 66, 108, 117, 120, 126, 132, 138, 141, 150, 156, 360, 501]
  );
  for (const d of OUT_OF_GRAMMAR_DURATIONS) {
    assert.equal(analyzeNotatedDuration(d).inGrammar, false, `${d} ticks is out of grammar`);
    assert.equal(durationDotCount(d, 'complete'), 0, `${d} paints no dots`);
    assert.equal(durationRingCount(d, 'complete'), 0, `${d} paints no rings`);
    assert.equal(
      durationFlagCount(d, 'complete'),
      durationFlagCount(d, 'golden'),
      `${d} keeps legacy flags`
    );
  }
});

test('durationDotCount: golden dots dotted 8ths only, complete dots every dotted value', () => {
  const table: Array<[number, 0 | 1 | 2, 0 | 1 | 2]> = [
    // [ticks, golden, complete]
    [3, 0, 0],
    [6, 0, 0],
    [12, 0, 0],
    [18, 0, 1],
    [21, 0, 2],
    [24, 0, 0],
    [36, 1, 1],
    [42, 0, 2],
    [48, 0, 0],
    [72, 0, 1],
    [84, 0, 2],
    [96, 0, 0],
    [144, 0, 1],
    [168, 0, 2],
    [192, 0, 0],
    [288, 0, 1],
    [336, 0, 2],
  ];
  for (const [d, golden, complete] of table) {
    assert.equal(durationDotCount(d, 'golden'), golden, `${d} golden`);
    assert.equal(durationDotCount(d, 'complete'), complete, `${d} complete`);
  }
});

test('durationFlagCount derives from the notated base under complete, legacy otherwise', () => {
  const table: Array<[number, number, number]> = [
    // [ticks, golden, complete]
    [3, 4, 4],
    [6, 3, 3],
    [9, 2, 3], // dotted 32nd: legacy miscounts it as a 16th
    [12, 2, 2],
    [18, 1, 2], // dotted 16th: legacy miscounts it as an 8th
    [21, 1, 2], // double-dotted 16th
    [24, 1, 1],
    [36, 1, 1],
    [42, 0, 1], // double-dotted 8th: legacy leaves it bare
    [48, 0, 0],
    [84, 0, 0],
    [96, 0, 0],
  ];
  for (const [d, golden, complete] of table) {
    assert.equal(durationFlagCount(d, 'golden'), golden, `${d} golden`);
    assert.equal(durationFlagCount(d, 'complete'), complete, `${d} complete`);
    assert.equal(subdivisionMarkCount(d, 'golden'), golden, `${d} golden marks`);
    assert.equal(subdivisionMarkCount(d, 'complete'), complete, `${d} complete marks`);
  }
  // Beam levels mirror the mark counts: a beamed note and a flagged note of
  // the same value never disagree.
  assert.equal(beamLevel(21, 'golden'), 1);
  assert.equal(beamLevel(21, 'complete'), 2);
  assert.equal(beamLevel(42, 'golden'), 1);
  assert.equal(beamLevel(42, 'complete'), 1);
  assert.equal(beamLevel(18, 'complete'), 2);
});

test('durationRingCount: lone halves ring once, wholes twice, nothing else', () => {
  const table: Array<[number, 0 | 1 | 2]> = [
    [24, 0],
    [48, 0],
    [84, 0],
    [96, 1],
    [144, 1], // dotted half rings AND dots
    [168, 1], // double-dotted half rings AND dots twice
    [192, 2],
    [288, 2],
    [336, 2],
    [126, 0], // out of grammar: no ring
    [150, 0],
  ];
  for (const [d, rings] of table) {
    assert.equal(durationRingCount(d, 'golden'), 0, `${d} never rings golden`);
    assert.equal(durationRingCount(d, 'complete'), rings, `${d} complete`);
  }
});

// ---------------------------------------------------------------------------
// 2. Geometry: rings, second dots, flags/levels by notated value
// ---------------------------------------------------------------------------

test('stemRingCenters mounts the bracket rings at the stem midpoint (shared constants)', () => {
  assert.equal(CLASP_RING_RADIUS, 3.0, 'R 3.0pt, the bracket ring');
  assert.equal(CLASP_RING_STROKE, 1.0, '1.0pt stroke, the bracket ring');
  const half = rn('half', 100, 200, 96);
  const s = getStemGeometry(half, T_BACH);
  const [ring] = stemRingCenters(half, T_BACH, 'complete');
  assert.equal(ring.x, s.stemX, 'on the stem column');
  assert.equal(ring.y, (s.stemStartY + s.stemEndY) / 2, 'at the stem midpoint');
  assert.deepEqual(stemRingCenters(half, T_BACH, 'golden'), [], 'golden never rings');
  assert.deepEqual(stemRingCenters(rn('tie', 100, 200, 126), T_BACH, 'complete'), [], 'ties never ring');
  // A whole stacks two about the midpoint on the bracket's own stack offset.
  const whole = stemRingCenters(rn('whole', 100, 200, 192), T_BACH, 'complete');
  assert.equal(whole.length, 2, 'two stacked rings');
  const stack = CLASP_RING_RADIUS + CLASP_MARK_STACK_GAP;
  assert.equal(whole[0].y, (s.stemStartY + s.stemEndY) / 2 - stack);
  assert.equal(whole[1].y, (s.stemStartY + s.stemEndY) / 2 + stack);
});

test('renderFlags paints stem, rings, flags, dots in knockout order (complete)', () => {
  const svg = renderFlags(
    { ...rn('half', 100, 200, 144, 100, 'LH'), dotX: 106, dotY: 196 },
    T_BACH,
    'classical-urtext',
    'complete'
  );
  assert.equal(countRings(svg), 1, 'the dotted half rings once');
  assert.equal(countDots(svg), 1, 'and dots once');
  const stem = svg.indexOf('janko-stem');
  const ring = svg.indexOf('janko-stem-ring');
  const dot = svg.indexOf('janko-augmentation-dot');
  assert.ok(stem < ring && ring < dot, 'stem, then ring, then dot — the white ring knocks the stem out');
  assert.match(svg, /janko-stem-ring" cx="[^"]*" cy="[^"]*" r="3\.00" fill="#FFFFFF"/);
  // The golden grammar renders the same note as the incumbent bare stem.
  const golden = renderFlags(rn('half', 100, 200, 144, 100, 'LH'), T_BACH);
  assert.equal(countRings(golden), 0, 'golden: no rings');
  assert.equal(countDots(golden), 0, 'golden: no dots past the 8th');
});

test('renderFlags dots doubly dotted values twice and flags them by base', () => {
  const dd16 = renderFlags(
    { ...rn('a', 100, 200, 21), dotX: 105, dotY: 196, dot2X: 107.7, dot2Y: 196 },
    T_BACH,
    'classical-urtext',
    'complete'
  );
  assert.equal(countDots(dd16), 2, 'two dots');
  assert.match(dd16, /data-flag-count="2"/, 'two-mark verbatim flag (a 16th), not one');
  assert.match(dd16, /data-dot="2"/, 'the second dot is tagged');
  const dd8 = renderFlags(
    { ...rn('b', 100, 200, 42), dotX: 105, dotY: 196, dot2X: 107.7, dot2Y: 196 },
    T_BACH,
    'classical-urtext',
    'complete'
  );
  assert.equal(countDots(dd8), 2, 'two dots');
  assert.match(dd8, /data-flag-count="1"/, 'one-mark flag (an 8th) where golden left a bare stem');
  assert.equal(countDots(renderFlags(rn('b', 100, 200, 42), T_BACH)), 0, 'golden: bare');
  // Hand-built callers without resolved dot2 fall back to the canonical
  // horizontal pair (dotX + 2r + gap, same height).
  const fallback = renderFlags(
    { ...rn('c', 100, 200, 84), dotX: 105, dotY: 196 },
    T_BACH,
    'classical-urtext',
    'complete'
  );
  assert.match(fallback, /data-dot="2" cx="107\.70" cy="196\.00"/, 'canonical pair fallback');
});

test('renderBeamGroup dots doubly dotted members twice at level 2 (complete)', () => {
  const pair = [rn('q', 100, 200, 24, 100), rn('dd', 130, 190, 21, 124)];
  const golden = renderBeamGroup(pair, T_BACH, computeBeamGroupGeometry(pair, T_BACH));
  assert.equal(countDots(golden), 0, 'golden: the 21 member undotted');
  assert.ok(!golden.includes('data-beam-level="2"'), 'golden: the 21 rides level 1');
  const geo = computeBeamGroupGeometry(pair, T_BACH, null, null, null, 'complete');
  const preview = renderBeamGroup(pair, T_BACH, geo, 'classical-urtext', 'complete');
  assert.equal(countDots(preview), 2, 'the double-dotted member dots twice');
  assert.ok(preview.includes('data-beam-level="2"'), 'level-2 stub for the 16th-base member');
  // A beamed dotted 8th is unchanged: one dot, level 1, both grammars.
  const plain = [rn('q', 100, 200, 24, 100), rn('d', 130, 190, 36, 124)];
  const gPlain = renderBeamGroup(plain, T_BACH, computeBeamGroupGeometry(plain, T_BACH));
  const pGeo = computeBeamGroupGeometry(plain, T_BACH, null, null, null, 'complete');
  const pPlain = renderBeamGroup(plain, T_BACH, pGeo, 'classical-urtext', 'complete');
  assert.equal(gPlain, pPlain, 'dotted-8th beams are byte-identical across grammars');
});

test('resolveClaspInk reads bracket dots from the notated value (complete)', () => {
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 42 }, 'complete').dots, 2);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 84 }, 'complete').dots, 2);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 336 }, 'complete').dots, 2);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 144 }, 'complete').dots, 1);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 96 }, 'complete').dots, 0);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 126 }, 'complete').dots, 0);
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 42 }).dots, 0, 'golden: max one');
  assert.deepEqual(resolveClaspInk({ centerY: 0, durationTicks: 144 }).dots, 1, 'golden: dotted halves dot');
});

test('claspSecondDotCenter: one m.66 double-dotted bracket, the m.25 bracket undotted', () => {
  // Source correction eliminated all 42/84/336 brackets (shortened quarters/
  // halves); the m.25 bracket at tick 4800 now carries a standard 48-tick
  // quarter (fixture: all tick-4800 notes 48, provenance lines 65/132/215/287)
  // with no second dot under either grammar. Second-dot positioning logic also
  // stays covered by the synthetic resolveClaspInk unit test above (42/84/336
  // → 2 dots) and the historical record; engine rules unchanged (Bach
  // byte-identical).
  //
  // Round 45: the m. 66 RH→LH correction gives t12552 a two-voice LH clasp
  // (the sustained A2 909 + the reattacked 908) whose carried value is the
  // sustained A2's own 168 ticks — a legitimate double-dotted quarter
  // (96 + 48 + 24) — so exactly one double-dotted bracket exists now, named
  // here by tick and carried value rather than hidden.
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const clasp = layouts.flatMap((s) => s.clasps).find((c) => c.tick === 4800)!;
  assert.equal(clasp.durationTicks, 48, 'm.25 bracket corrected 42→48 (standard quarter)');
  assert.ok(
    clasp.durationSecondDots.every((d) => d === null),
    'no second dot on the m.25 bracket'
  );
  const withSecond = layouts.flatMap((s) => s.clasps).filter((c) => c.durationSecondDots.some(Boolean));
  assert.deepEqual(
    withSecond.map((c) => [c.tick, c.durationTicks]),
    [[12552, 168]],
    'exactly the m. 66 clasp carries a second dot'
  );
  assert.deepEqual(DOUBLE_DOT_CLASPS, [[12552, 168]], 'and the census names the same instance');
  assert.deepEqual(
    withSecond[0].notes.map((n) => n.id).sort(),
    ['brahms-op118-no1-908', 'brahms-op118-no1-909'],
    'the double-dotted clasp is the corrected two-voice LH t12552 pair'
  );
  const goldenLayouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const goldenClasp = goldenLayouts.flatMap((s) => s.clasps).find((c) => c.tick === 4800)!;
  assert.equal(goldenClasp.durationInk[0].dots, 0, 'golden: undotted');
});

// ---------------------------------------------------------------------------
// 3. Census: every changed note by id (the flip checklist)
// ---------------------------------------------------------------------------

type Num = number;
/**
 * Source-correct durations (fixture 964, LilyPond written values) re-baseline
 * the Round-30 census: playback shortenings (42←48 quarters, 84←96 halves,
 * 18/21←24 eighths, 336←? ) are eliminated; the preview now differs from
 * golden only on standard dotted/half values that gain preview rings/dots.
 * Engine rules unchanged (Bach byte-identical, zero engine diff); new pins
 * follow from corrected input (e.g. ID 5: 168→192 whole; IDs 953/954: 18→24).
 */
// Lone halves (96) gain one stem ring (bare → ring). Old 84s (shortened 96s)
// corrected to 96 join the two historical lone halves (321, 607) plus 553.
// The tick-12624 bracket is admitted (§2 true-ink pre-step), so 916 leaves
// the census (bracketed and suppressed); the de-unified m.26/m.46 LH pairs
// (§2 line 19: clean pairs never independently qualify) join it as gap-gated
// Option-3 carriers (346, 632), each gaining its preview ring.
const RING_96: Num[] = [
  290, 321, 346, 368, 375, 383, 390, 407, 414, 545, 553, 576, 607, 632, 654, 661, 669, 676,
  693, 700, 840, 849, 913, 916, 934,
];
// Lone dotted halves (144) gain one stem ring plus their dot. Historical pair
// (332, 618) plus ten more lone 144s now that shortenings are corrected. The
// Round 45: the m. 66 RH→LH correction moves notes 913 and 916 into the left
// hand (they join the LH t12624 clasp, so their own ink no longer changes —
// each reads 0d/1r) and gives the t12552/t12576 pairs new LH clasps. The
// sustained A2 909 and the sustained D3 911 are now clasp members (the
// bracket owns their value), so they leave the changed set; the t12552 clasp
// carries the double-dotted 168 (DOUBLE_DOT_CLASPS below).
//
// m.1 downbeat pair (4, 6) leaves the census: the tick-48 bracket is admitted
// (§2 true-ink pre-step), so both are bracketed and suppressed.
const RING_DOT_144: Num[] = [16, 38, 151, 173, 332, 435, 543, 618, 721, 903, 904];
// Lone whole (192): empty. Note 5 (m.1 downbeat, 192) was the first whole in
// the census while tick-48 stood bare; the admitted bracket carries it as
// the 192 exception (preview stays golden for clasp members), so no whole
// changes ink anymore.
const RING2_192: Num[] = [];
// Lone double-dotted halves (168, legitimate hidden-8th + dotted-half ties)
// gain two dots plus one ring. The 8 source-anchored 168s (e.g. tick 216:
// lines 268+269; tick 12360: line 320 tieWait gap).
const DOTS2_168: Num[] = [15, 37, 150, 172, 434, 720, 901];
// Lone dotted quarters (72) gain their dot. Two newly in-grammar 72s
// (previously out-of-grammar 63s, byte-identical under both grammars).
const DOT_72: Num[] = [554, 899];
// Eliminated playback-artifact categories (no 42/84/18/21 in corrected source):
// DOTS2_84 (18×84←96), FLAG_DOTS2_42 (52×42←48), DOT_LVL_18 (953/954: 18→24),
// DOTS2_LVL_21 (45×21←24) — all now standard values with no preview delta.
/** Beamed pairs: none (no 21/18 members remain; all beamed 24s identical). */
const BEAMED_21_PAIRS: Array<[Num, Num]> = [];
/** The beamed [24 + 18] pair: eliminated (956/957 now 24+24, no delta). */
const BEAMED_18_PAIR: [Num, Num] | null = null;
/** Brackets carrying double-dotted values: none (no 42/84/336 brackets remain). */
const DOUBLE_DOT_CLASPS: Array<[tick: Num, carried: Num]> = [[12552, 168]];

const id = (n: Num): string => `brahms-op118-no1-${n}`;

test('Census: the changed singles are exactly the pinned id sets (45 notes)', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const changed = new Map<string, string>();
  for (let s = 0; s < golden.length; s++) {
    const gs = golden[s];
    const ps = preview[s];
    const gHidden = suppressedStemIds(gs);
    const pHidden = suppressedStemIds(ps);
    const pClasped = new Set(ps.clasps.flatMap((c) => c.notes.map((n) => n.id)));
    const gCar = new Map(gs.verticalChords.map((c) => [c.carrier.id, c.durationTicks]));
    const pCar = new Map(ps.verticalChords.map((c) => [c.carrier.id, c.durationTicks]));
    const eng = (n: JankoRhythmNote, car: Map<string, number>): JankoRhythmNote => {
      const d = car.get(n.id);
      return d === undefined || d === n.durationTicks ? n : { ...n, durationTicks: d };
    };
    const gU = new Map(gs.ungrouped.map((n) => [n.id, n]));
    const pU = new Map(ps.ungrouped.map((n) => [n.id, n]));
    assert.deepEqual(
      [...pU.keys()].sort(),
      [...gU.keys()].sort(),
      `system ${s}: the preview changes ink, never membership`
    );
    for (const [noteId, pn] of pU) {
      const gn = gU.get(noteId)!;
      assert.equal(pHidden.has(noteId), gHidden.has(noteId), `${noteId}: suppression never flips`);
      if (pHidden.has(noteId)) continue;
      // The engine's exact grammar selection: golden everywhere on the
      // golden layout; the preview everywhere except clasp members (the
      // bracket owns their duration) on the preview layout.
      const pSel = pClasped.has(noteId) ? 'golden' : 'complete';
      const gSvg = renderFlags(eng(gn, gCar), T_BRAHMS, O_BRAHMS.subdivisionStyle, 'golden');
      const pSvg = renderFlags(eng(pn, pCar), T_BRAHMS, O_BRAHMS.subdivisionStyle, pSel);
      if (gSvg !== pSvg) changed.set(noteId, `${countDots(pSvg) - countDots(gSvg)}d/${countRings(pSvg)}r`);
    }
  }
  const expect = new Map<string, string>();
  for (const n of RING_96) expect.set(id(n), '0d/1r');
  for (const n of RING_DOT_144) expect.set(id(n), '1d/1r');
  for (const n of DOTS2_168) expect.set(id(n), '2d/1r');
  for (const n of DOT_72) expect.set(id(n), '1d/0r');
  for (const n of RING2_192) expect.set(id(n), '0d/2r');
  assert.equal(changed.size, 45, '45 changed singles, no more, no fewer');
  assert.deepEqual(
    [...changed.keys()].sort(),
    [...expect.keys()].sort(),
    'the changed id set is exactly the census'
  );
  for (const [noteId, delta] of expect) {
    assert.equal(changed.get(noteId), delta, `${noteId} before→after ink`);
  }
});

test('Census: no beam groups change (all beamed 24s identical)', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const key = (b: { notes: JankoRhythmNote[] }): string =>
    b.notes.map((n) => n.id).sort().join(',');
  const changed: string[] = [];
  for (let s = 0; s < golden.length; s++) {
    const gB = new Map(golden[s].beams.map((b) => [key(b), b]));
    const pB = new Map(preview[s].beams.map((b) => [key(b), b]));
    assert.deepEqual([...pB.keys()].sort(), [...gB.keys()].sort(), `system ${s}: beam membership stable`);
    for (const [k, pb] of pB) {
      const gb = gB.get(k)!;
      const gSvg = renderBeamGroup(gb.notes, T_BRAHMS, gb, O_BRAHMS.subdivisionStyle, 'golden');
      const pSvg = renderBeamGroup(pb.notes, T_BRAHMS, pb, O_BRAHMS.subdivisionStyle, 'complete');
      if (gSvg !== pSvg) changed.push(k);
    }
  }
  // Source-correct 24-tick beamed eighths (no 21/18 shortenings remain).
  const expect: string[] = [
    ...BEAMED_21_PAIRS.map(([a, b]) => [id(a), id(b)].sort().join(',')),
    ...(BEAMED_18_PAIR
      ? [[id(BEAMED_18_PAIR[0]), id(BEAMED_18_PAIR[1])].sort().join(',')]
      : []),
  ].sort();
  assert.deepEqual(changed.sort(), expect, 'no beamed groups change under corrected durations');
  // Every changed group gains its level-2 stub (single-note run → one stub).
  for (const k of changed) {
    const sys = preview.flatMap((s) => s.beams).find((b) => key(b) === k)!;
    const svg = renderBeamGroup(sys.notes, T_BRAHMS, sys, O_BRAHMS.subdivisionStyle, 'complete');
    assert.ok(svg.includes('data-beam-level="2"'), `${k} carries its level-2 stub`);
  }
});

test('Census: no brackets gain two dots (no double-dotted brackets in source)', () => {
  const golden = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const preview = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const gSet = golden.flatMap((s) => s.clasps.map((c) => `${c.tick}:${c.durationTicks}`)).sort();
  const pSet = preview.flatMap((s) => s.clasps.map((c) => `${c.tick}:${c.durationTicks}`)).sort();
  assert.deepEqual(pSet, gSet, 'the clasp set is identical under both grammars');
  const dotted = preview
    .flatMap((s) => s.clasps)
    .filter((c) => c.durationSecondDots.some(Boolean))
    .map((c) => [c.tick, c.durationTicks] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  // Source-correct durations carry no 42/84/336 brackets (all corrected to
  // standard 48/96/144); double-dots survive only on singles (168s).
  assert.deepEqual(dotted, DOUBLE_DOT_CLASPS, 'no bracket carries a double-dotted value');
  for (const [tick] of DOUBLE_DOT_CLASPS) {
    const clasp = preview.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    const painted = renderClaspGroup([clasp], [], T_BRAHMS);
    assert.equal(
      (painted.match(/janko-clasp-dot/g) ?? []).length,
      2,
      `bracket @${tick} paints its pair`
    );
  }
  // The unified brackets (@4848, @8688) now carry standard 96 (corrected from
  // shortened 84) and show their per-hand ring with no second dot.
  for (const tick of [4848, 8688]) {
    const clasp = preview.flatMap((s) => s.clasps).find((c) => c.tick === tick)!;
    assert.equal(clasp.durationTicks, 96, `@${tick} carries corrected 96 (was shortened 84)`);
    assert.ok(
      clasp.durationSecondDots.every((d) => d === null),
      `@${tick} paints no second dot under the preview`
    );
  }
});

test('Unchanged: every out-of-grammar duration renders byte-identically (both grammars)', () => {
  // Unit purity: the renderer reads the same gates for ties/tuplets/holds.
  for (const d of OUT_OF_GRAMMAR_DURATIONS) {
    const note = { ...rn('x', 100, 200, d), dotX: 105, dotY: 196 };
    assert.equal(
      renderFlags(note, T_BRAHMS, 'classical-urtext', 'complete'),
      renderFlags(note, T_BRAHMS, 'classical-urtext', 'golden'),
      `${d} ticks: byte-identical stems`
    );
  }
  // Layout level: the census pins above prove nothing else changes, but the
  // boundary notes deserve their names — the m.1/m.2 tie-merged LH holds,
  // the 501-tick final hold, and the Bach tied 108.
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const pSvg = new Map<string, string>();
  for (const sys of layouts) {
    const hidden = suppressedStemIds(sys);
    const clasped = new Set(sys.clasps.flatMap((c) => c.notes.map((n) => n.id)));
    for (const n of sys.ungrouped) {
      if (hidden.has(n.id)) continue;
      const sel = clasped.has(n.id) ? 'golden' : 'complete';
      pSvg.set(n.id, renderFlags(n, T_BRAHMS, O_BRAHMS.subdivisionStyle, sel));
    }
  }
  const goldenLayouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  for (const sys of goldenLayouts) {
    const hidden = suppressedStemIds(sys);
    for (const n of sys.ungrouped) {
      if (hidden.has(n.id)) continue;
      const gSvg = renderFlags(n, T_BRAHMS, O_BRAHMS.subdivisionStyle, 'golden');
      if (!OUT_OF_GRAMMAR_DURATIONS.includes(n.durationTicks as never)) continue;
      assert.equal(pSvg.get(n.id), gSvg, `${n.id} (${n.durationTicks} ticks) keeps current rendering`);
    }
  }
  // Bach's tied 108 keeps its bare stem under the preview.
  const bachLayouts = layoutJankoScore(BACH, O_BACH_PREVIEW, T_BACH);
  const tied = bachLayouts.flatMap((s) => s.notes).find((p) => p.note.id === 'bach-var1-343')!;
  assert.equal(tied.note.durationTicks, 108);
  assert.equal(countDots(renderFlags(tied.rhythm, T_BACH, 'classical-urtext', 'complete')), 0);
  assert.equal(countRings(renderFlags(tied.rhythm, T_BACH, 'classical-urtext', 'complete')), 0);
});

test('Unchanged: Bach renders byte-identically under the preview (full score)', () => {
  // Bach's durations are all plain, dotted-8th or out-of-grammar ties — the
  // complete grammar moves nothing. Both pages, byte for byte.
  for (const page of [0, 1]) {
    assert.equal(
      renderJankoPage(BACH, page, O_BACH_PREVIEW, T_BACH),
      renderJankoPage(BACH, page, O_BACH, T_BACH),
      `Bach page ${page + 1} byte-identical`
    );
  }
  // And the layouts compare deep-equal (modulo beam closures, which are
  // per-layout function identities): no second dot is ever resolved.
  const struct = (v: unknown): unknown =>
    JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'function' ? '[fn]' : x)));
  assert.deepEqual(
    struct(layoutJankoScore(BACH, O_BACH_PREVIEW, T_BACH)),
    struct(layoutJankoScore(BACH, O_BACH, T_BACH)),
    'Bach layouts deep-equal across grammars'
  );
});

test('Unchanged: option-off renders equal the current golden on both scores', () => {
  // The default (option omitted) is byte-identical to explicit golden —
  // the preview plumbing adds nothing when it is off.
  for (const page of [0, 1]) {
    assert.equal(
      renderJankoPage(BACH, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS),
      renderJankoPage(BACH, page, { ...DEFAULT_JANKO_OPTIONS, durationGrammar: 'golden' }, DEFAULT_JANKO_TOKENS)
    );
  }
  const brahmsPages = Math.ceil(countJankoSystems(BRAHMS, O_BRAHMS, T_BRAHMS) / O_BRAHMS.systemsPerPage);
  for (let page = 0; page < brahmsPages; page++) {
    assert.equal(
      renderJankoCrop(BRAHMS, page * 9 + 1, 9, BRAHMS_ROUND44_RESERVE_OPTIONS, BRAHMS_ROUND44_RESERVE_TOKENS),
      renderJankoCrop(
        BRAHMS,
        page * 9 + 1,
        9,
        { ...BRAHMS_ROUND44_RESERVE_OPTIONS, durationGrammar: 'golden' },
        BRAHMS_ROUND44_RESERVE_TOKENS
      ),
      `Brahms crop ${page + 1} byte-identical`
    );
  }
});

// ---------------------------------------------------------------------------
// 4. Linter: the preview lints clean, the new audits are option-aware
// ---------------------------------------------------------------------------

test('Withdrawn complete preview reports previously missed Brahms ring contacts; Bach remains green', () => {
  const bach = lintJankoScore(BACH, O_BACH_PREVIEW, T_BACH);
  assert.equal(bach.violations.length, 0, 'Bach preview: zero violations');
  assert.equal(bach.warnings.length, 0, 'Bach preview: zero warnings');
  // Canonical packing retains its two historical slot findings. The
  // withdrawn complete preview has seventeen *additional* real painted
  // clasp-exception ring/mask contacts the former golden re-render missed.
  const brahms = lintJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  // Historical withheld preview only: its clasp exceptions already painted
  // complete-grammar rings, but the old re-render audit used golden grammar
  // and silently missed seventeen ring/mask contacts. The placed audit reports
  // the real ink without shifting its seats or changing canonical Brahms.
  assert.equal(brahms.violations.length, 19, '2 grandfathered slots + 17 previously missed preview ring contacts');
  assert.equal(brahms.warnings.length, 0, 'Brahms preview: zero warnings');
  assert.equal(brahms.ok, false, 'red by operator order, like its golden');
  const slots = brahms.violations.filter((v) => v.code === 'system-slot-overlap');
  assert.deepEqual(
    slots.map((v) => [v.code, v.system, v.message]),
    lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS).violations.map((v) => [v.code, v.system, v.message]),
    'the 2 slot findings are byte-identical to the golden report'
  );
  const rings = brahms.violations.filter((v) => v.code === 'ring-geometry');
  assert.equal(rings.length, 17, 'all previously missed complete-preview clasp exception rings');
});

test('withdrawn Round 30 mm. 1–2 ring witness is physically clipped by the later mask, not a conservative false positive',()=>{
  const layouts=layoutJankoScore(BRAHMS,O_BRAHMS_PREVIEW,T_BRAHMS);
  const layout=layouts.find(l=>l.notes.some(n=>n.note.id==='brahms-op118-no1-5'))!;
  const scene=buildInkScene(layout,O_BRAHMS_PREVIEW,T_BRAHMS,BRAHMS);
  const id='brahms-op118-no1-5',group=scene.solos.get(id)!;
  assert.ok(group&&group.some(p=>p.shape.kind==='ring'));
  assert.ok(layout.notes.find(p=>p.note.id===id)!.note.startTick<384,
    'contact is in historical Round 30 rings card mm. 1–2, not the current studio registry');
  // Adaptive is a direct-call adapter to the same constructor, not fixed-core
  // stored paint. Both paths retain literal output bytes at this historical seat.
  const svg=renderSystem(BRAHMS,layout.geometry,layout.index,O_BRAHMS_PREVIEW,T_BRAHMS,layout);
  assert.ok(svg.includes(sceneSoloSvg(scene,id)));
  const mask=scene.heads.get(id)!.find(p=>p.primitive.kind==='erase')!.primitive;
  if(mask.kind!=='erase')throw Error('missing later head mask');
  const rings=group.filter(p=>p.shape.kind==='ring');
  let contact:[number,number]|undefined;
  for(const ring of rings){
    const shape=ring.shape;if(shape.kind!=='ring')continue;
    for(let x=mask.box.x0+.02;x<mask.box.x1-.02&&!contact;x+=.04)
      for(let y=mask.box.y0+.02;y<mask.box.y1-.02;y+=.04)
        if(soloPieceAt(ring,x,y).status==='ink'){contact=[x,y];break;}
  }
  assert.ok(contact,'literal ring rim lies inside actual mask: genuine later white clipping');
  assert.equal(sceneSoloAt(scene,id,...contact!).status,'clear','mask erases the earlier ring rim');
});

test('Placed audits expose withdrawn preview rings while canonical golden stays silent', () => {
  // Golden: the two new checks are no-ops (the golden grammar predates the
  // notated counts), so the gate reports exactly the accepted 2.
  const golden = lintJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  assert.equal(golden.violations.length, 2, 'golden: exactly the accepted 2 slot findings');
  assert.equal(golden.warnings.length, 0);
  // Preview: the checks now see real clasp-exception paint, not the former
  // golden re-render. The canonical golden remains silent; the unjudged
  // historical preview's seventeen contacts are not silently dismissed.
  // Non-vacuousness rests on the synthetic fixtures in
  // test/janko-linter.test.ts.
  const preview = lintJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  assert.equal(preview.violations.length, 19, 'preview: 2 accepted slots + 17 newly visible historical ring contacts');
  assert.equal(preview.warnings.length, 0);
  const auditCodes = (codes: string[]): string[] =>
    codes.filter((c) => c === 'ring-geometry' || c === 'dot-count-agreement');
  assert.deepEqual(auditCodes(preview.violations.map((v) => v.code)), Array(17).fill('ring-geometry'),
    'the historical preview now reports its painted exception ring contacts');
  assert.deepEqual(auditCodes(golden.violations.map((v) => v.code)), [], 'the golden path is silent');
});

// ---------------------------------------------------------------------------
// 5. Registry + Reference, PARKED (historical consts — Round 31 precedent)
// ---------------------------------------------------------------------------
//
// Round 30 is judged WITHHELD and parked, not killed: the live registry now
// serves Round 31, and these tests assert on verbatim historical consts
// (exact R28/R29 precedent). The cards return for judgment post-cleanup.

// Historical Round 30 registry (duration-grammar preview) preserved for
// durable regression coverage. Active candidate round in
// src/render/janko/candidates.ts is Round 31 (clasp-dot nudge preview).
const ROUND_30_METADATA: JankoCandidateRound = {
  round: 30,
  title: 'Duration-grammar preview: rings, dots, levels',
  description:
    'The complete duration grammar, previewed on Brahms before any flip: lone half/whole notes carry the bracket rings stem-mounted, every dotted value shows its dots (doubly dotted doubly) on singles, beams and brackets, and flags/beam levels derive from the notated base. Both cards run the full preview and differ only in windows: rings first, then the double-dot passages and the out-of-grammar boundary. Ties, tuplets and MIDI holds keep their current rendering.',
  openAxes: ['durationGrammar'],
};

const ROUND_30_CANDIDATES: JankoCandidate[] = [
  {
    id: 'round-30-rings',
    label: 'Rings on lone longs',
    description:
      'One open ring = half, two stacked = whole — the bracket rings (R 3.0pt, 1.0pt stroke) stem-mounted at the stem midpoint. Dotted longs ring AND dot; the 150/126 tie-merged holds stay bare.',
    axis: 'durationGrammar',
    options: { durationGrammar: 'complete' },
    windows: [
      brahmsWindow(
        1,
        2,
        'Brahms mm. 1–2 · dd-8th #14 +flag+2 dots, dd-16th #22 +2nd flag+2 dots; the 150/126 LH holds stay bare'
      ),
      brahmsWindow(
        24,
        2,
        'Brahms mm. 24–25 · rings on the half #321 and the dotted half #332 (+dot); 2 more 42s, 7 21s and the 42-bracket dot twice'
      ),
    ],
  },
  {
    id: 'round-30-double-dots',
    label: 'Double dots everywhere',
    description:
      'Doubly dotted values dot twice — singles, beamed notes (level 2) and brackets alike — with the second dot further along the escape (right first, then up). The Bach window pins the boundary: a tied value keeps its bare stem.',
    axis: 'durationGrammar',
    options: { durationGrammar: 'complete' },
    windows: [
      brahmsWindow(
        44,
        2,
        'Brahms mm. 44–45 · 7 21s +level+2 dots, 2 42s +flag+2 dots, the 42-bracket +2 dots; rings on #607 and #618 (+dot)'
      ),
      {
        measureStart: 20,
        measureCount: 1,
        title: 'Bach m. 20 · the tied 108 (#343) stays bare — zero new marks in this window',
      },
    ],
  },
];

/** The R30 studio's Brahms crops (the live const serves Round 31 now). */
const ROUND_30_BRAHMS_CROPS: StudioCrop[] = [
  {
    start: 1,
    count: 2,
    title: 'mm. 1–2 · Upbeat and downbeat',
    caption:
      'The quarter-note upbeat, the m. 1 downbeat chord over the bass arpeggio, and the tie-merged LH holds the duration grammar leaves bare.',
  },
  {
    start: 7,
    count: 2,
    title: 'mm. 7–8 · Five-voice chords',
    caption: 'The massive chords with the sweeping octave-1 bass ledger stack kept whole.',
  },
  {
    start: 65,
    count: 2,
    title: 'mm. 65–66 · Tie-merged holds',
    caption:
      'Tuplet and tied holds (63, 108, 117, 132, 138, 141, 156 ticks) that read no plain, dotted or double-dotted value and keep their current rendering.',
  },
];

test('Registry purity: two cards, no control, one axis each (historical)', () => {
  assert.equal(ROUND_30_METADATA.round, 30);
  assert.deepEqual(ROUND_30_METADATA.openAxes, ['durationGrammar']);
  assert.equal(ROUND_30_METADATA.compareStrip, undefined, 'no strip: one shared preview');
  assert.equal(ROUND_30_CANDIDATES.length, 2, 'exactly two cards');
  assert.equal(
    ROUND_30_CANDIDATES.find((c) => c.id === 'control'),
    undefined,
    'no control card'
  );
  for (const card of ROUND_30_CANDIDATES) {
    assert.equal(card.axis, 'durationGrammar', `${card.id} declares the open axis`);
    const badges = candidateBadges(card, ROUND_30_METADATA);
    assert.deepEqual(
      badges.map((b) => b.key),
      ['durationGrammar'],
      `${card.id} badges only its axis`
    );
    assert.ok(badges.every((b) => b.axis), `${card.id}: every badge is the axis badge`);
    const resolved = resolveCandidate(card);
    const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
    for (const [k, v] of Object.entries(resolved.options)) {
      if (k === 'durationGrammar') {
        assert.equal(v, 'complete', `${card.id} previews`);
      } else {
        assert.deepEqual(v, (golden as Record<string, unknown>)[k], `${card.id} locks ${k} to golden`);
      }
    }
  }
});

test('brahmsWindow constructs honest literal Brahms windows', () => {
  // The constructor stays live (Round 31 frames Brahms windows with it); the
  // studio-config half of this test moved to test/janko-round31.test.ts,
  // where the studio Brahms is pinned to the fixed-3 golden.
  assert.deepEqual(brahmsWindow(24, 2, 'x'), {
    scoreId: BRAHMS_STUDIO_SCORE_ID,
    measureStart: 24,
    measureCount: 2,
    title: 'x',
  });
  assert.equal(BRAHMS_STUDIO_SCORE_ID, 'brahms-op118-no1');
  const config = createStudioConfig({ score: BACH });
  assert.ok(config.scores[BRAHMS_STUDIO_SCORE_ID], 'the studio library carries Brahms');
});

test('Proofread captions: every window title counts what the engine paints (historical)', () => {
  const rings = ROUND_30_CANDIDATES.find((c) => c.id === 'round-30-rings')!;
  const dots = ROUND_30_CANDIDATES.find((c) => c.id === 'round-30-double-dots')!;
  // Card R: mm. 1–2 frames the dd-8th #14 (+flag+2 dots) and the dd-16th #22
  // (+2nd flag+2 dots); mm. 24–25 frames the half #321 (ring), the dotted
  // half #332 (ring+dot), 2 more 42s, 7 21s and the 42-bracket @4800.
  assert.equal(rings.windows!.length, 2);
  assert.match(rings.windows![0].title, /#14 \+flag\+2 dots/);
  assert.match(rings.windows![0].title, /#22 \+2nd flag\+2 dots/);
  assert.match(rings.windows![0].title, /150\/126.*stay bare/);
  assert.match(rings.windows![1].title, /#321/);
  assert.match(rings.windows![1].title, /#332 \(\+dot\)/);
  assert.match(rings.windows![1].title, /2 more 42s, 7 21s/);
  // Card D2: mm. 44–45 mirrors the passage (rings #607/#618, 7 21s, 2 42s,
  // the 42-bracket @8640); Bach m. 20 pins the boundary with zero new marks.
  assert.equal(dots.windows!.length, 2);
  assert.match(dots.windows![0].title, /7 21s \+level\+2 dots, 2 42s \+flag\+2 dots/);
  assert.match(dots.windows![0].title, /#607 and #618 \(\+dot\)/);
  assert.match(dots.windows![1].title, /tied 108 \(#343\) stays bare/);
  assert.match(dots.windows![1].title, /zero new marks/);
  // The counts are not decorative: recompute them from the engine.
  const inBrahms = (tick: number, m0: number, m1: number): boolean =>
    tick >= 48 + (m0 - 1) * 192 && tick < 48 + m1 * 192;
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS_PREVIEW, T_BRAHMS);
  const framed21 = new Set<number>();
  const framed42 = new Set<number>();
  const framedBrackets: number[] = [];
  for (const sys of layouts) {
    const hidden = suppressedStemIds(sys);
    const clasped = new Set(sys.clasps.flatMap((c) => c.notes.map((n) => n.id)));
    for (const n of sys.ungrouped) {
      if (!inBrahms(n.startTick, 44, 45) || hidden.has(n.id) || clasped.has(n.id)) continue;
      if (n.durationTicks === 21) framed21.add(Number(n.id.split('-').pop()));
      if (n.durationTicks === 42) framed42.add(Number(n.id.split('-').pop()));
    }
    for (const b of sys.beams) {
      for (const n of b.notes) {
        if (!inBrahms(n.startTick, 44, 45)) continue;
        if (n.durationTicks === 21) framed21.add(Number(n.id.split('-').pop()));
      }
    }
    for (const c of sys.clasps) {
      if (inBrahms(c.tick, 44, 45) && c.durationSecondDots.some(Boolean)) framedBrackets.push(c.tick);
    }
  }
  // Source correction eliminated all 21/42 playback shortenings (24←21 eighths,
  // 48←42 quarters); historical titles above preserve the pre-correction
  // record verbatim, while the engine now paints zero of each in mm. 44–45.
  assert.deepEqual([...framed21].sort((a, b) => a - b), [], '0 21s (corrected to 24)');
  assert.deepEqual([...framed42].sort((a, b) => a - b), [], '0 42s (corrected to 48)');
  assert.deepEqual(framedBrackets, [], 'no double-dotted bracket (all 42-brackets corrected)');
  // Bach m. 20: the tied 108 is the only long, and it keeps its bare stem.
  const bach = layoutJankoScore(BACH, O_BACH_PREVIEW, T_BACH);
  const longs = bach
    .flatMap((s) => s.notes)
    .filter((p) => p.note.startTick >= 19 * 144 && p.note.startTick < 20 * 144 && p.note.durationTicks > 38);
  assert.deepEqual(
    longs.map((p) => p.note.id),
    ['bach-var1-343'],
    'the 108 is m. 20’s only long'
  );
});

test('Reference carries the Brahms golden beside Bach (first-class surface, historical)', () => {
  // The R30 surface, reconstructed from historical consts: the adaptive
  // Brahms the R30 studio carried (the live studio is fixed-3 since R31).
  const config = createStudioConfig({
    score: BACH,
    candidates: ROUND_30_CANDIDATES,
    round: ROUND_30_METADATA,
    brahmsCrops: ROUND_30_BRAHMS_CROPS,
    scores: {
      [BRAHMS_STUDIO_SCORE_ID]: {
        id: BRAHMS_STUDIO_SCORE_ID,
        score: BRAHMS,
        options: O_BRAHMS,
        tokens: T_BRAHMS,
      },
    },
  });
  assert.equal(
    config.scores[BRAHMS_STUDIO_SCORE_ID].options.core,
    'adaptive',
    'the R30 studio Brahms is the lint-gated adaptive golden'
  );
  assert.equal(config.brahmsPages.length, 5, 'five Brahms pages (18 systems, 4-up; was 8)');
  assert.equal(config.brahmsCrops.length, ROUND_30_BRAHMS_CROPS.length, 'three Brahms crops');
  assert.deepEqual(
    ROUND_30_BRAHMS_CROPS.map((c) => [c.start, c.count]),
    [
      [1, 2],
      [7, 2],
      [65, 2],
    ]
  );
  const html = renderReferenceView(config);
  assert.ok(html.includes(`data-score="${BRAHMS_STUDIO_SCORE_ID}"`), 'the Brahms block renders');
  // The Brahms block only (Brahms leads since the ergonomics order — an
  // unbounded slice would also match the Bach verdict).
  const brahmsAt = html.indexOf(`data-score="${BRAHMS_STUDIO_SCORE_ID}"`);
  const bachAt = html.indexOf('data-score="primary"');
  const brahms = bachAt > brahmsAt ? html.slice(brahmsAt, bachAt) : html.slice(brahmsAt);
  assert.match(brahms, /Intermezzo in A minor/, 'the Brahms heading');
  assert.match(brahms, /data-lint-ok="false"/, 'the Brahms block reports the accepted 2 (was clean at 3-up)');
  assert.match(brahms, /✗ 2 violations/, 'the historical surface reads the accepted 2');
  assert.match(brahms, /Live linter/, 'Brahms diagnostics beside Bach’s');
  // Both cards inherit the accepted 2 by whole-score attribution (chips red;
  // were green at 3-up).
  const cards = renderCandidatesView(config);
  assert.equal((cards.match(/data-lint="violations"/g) ?? []).length, 2);
  assert.ok(cards.includes('data-window="primary:20-20"'), 'the Bach window renders');
  assert.ok(cards.includes('data-window="brahms-op118-no1:44-45"'), 'the D2 Brahms window renders');
});
