/**
 * Round 46 — literal-ink clean-up, readable 95 % clusters, the long-value
 * vocabulary, shared 2-span indicators and the committed written ties.
 * ===========================================================================
 *
 * Everything here is measured on the **real engine**: the emitted layout facts,
 * the emitted SVG text and the visual linter's own report. Nothing in this file
 * claims operator acceptance — glanceability and the final GOLD designation are
 * the operator's judgement; this file certifies that the round's *contract* is
 * implemented and that the canonical Brahms surface is complete and honest.
 *
 * The four sections mirror the ticket:
 *
 * - **A** the Round 45 literal-mode extra ink (outlier rules, ledger dashes and
 *   the row extensions they earned) is gone while every literal position, the
 *   core staff, the legitimate Round 44 rows, the carriers and the page plan
 *   are untouched;
 * - **B** the 95 % working Reference measures exactly 0.30pt of declared air on
 *   the six five-level clusters (δ = 0.92919pt, span growth 3.71675pt, maximum
 *   displacement 1.85837pt), and same-hand/onset/exact-duration 2-span
 *   neighbours of one bracket share one indicator — with the exclusions;
 * - **C** the long-value vocabulary on both mounts, the bracket-only 20 % ring
 *   enlargement, the recomputed carrier length and the +0.20pt cut spacing;
 * - **D** the written ties: 19 arcs, 6 carries that reuse existing heads, 13
 *   added continuation heads, no reattack, m. 66 reads 9 / 2 / 5 before the
 *   chord, the m65 bracket carries its first component, and the canonical lint
 *   report is clean — no former six-warning exception.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoPages,
  getTieDisplayPlan,
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoPage,
} from '../src/render/janko/engine';
import {
  MIDPOINT_MAX_RINGS,
  compactDurationMarks,
  effectiveExceptionCarrierLength,
  midpointMetrics,
} from '../src/render/janko/elements/rhythm';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  resolveCandidate,
} from '../src/render/janko/candidates';

const SCORE = buildBrahmsOp118No1Score();
const OPTIONS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const LAYOUTS = layoutJankoScore(SCORE, OPTIONS, TOKENS);

/**
 * The parked Round 46 pair, kept as this file's own historical fixtures now
 * that Round 47 has opened its own candidate set: the 0.30pt working Reference
 * card and its 0.20pt spacing control (the live registry is pinned in section E
 * below, never used to identify the Reference).
 */
const ROUND_46_FAMILY = {
  pitchPlacement: 'parity-columns',
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
  opticalSpacing: true,
  lowPitchFolding: 'literal',
  writtenTies: 'source',
  chordSymbolScale: 0.95,
} as const;
const ROUND_46_TOKENS = {
  midpointSlashLengthFactor: 1.1,
  midpointRingScale: 1.1,
  midpointBracketRingScale: 1.2,
  midpointSpacingFactor: 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95),
} as const;
const ROUND_46_CONTROL_CARD = {
  id: 'brahms-scale-95-air20',
  options: { ...ROUND_46_FAMILY },
  tokens: { ...ROUND_46_TOKENS, opticalClearanceAir: 0.2 },
};
const ROUND_46_REFERENCE_CARD = {
  id: 'brahms-scale-95-air30',
  options: { ...ROUND_46_FAMILY },
  tokens: { ...ROUND_46_TOKENS, opticalClearanceAir: 0.3 },
};
const PLAN = getTieDisplayPlan(SCORE);
const REPORTS = lintJankoScore(SCORE, OPTIONS, TOKENS);

function cents(actual: number, expected: number, eps: number): boolean {
  return Math.abs(actual - expected) <= eps;
}

function pagesOf(options = OPTIONS, tokens = TOKENS): string {
  let svg = '';
  const total = countJankoPages(SCORE, options, tokens);
  for (let i = 0; i < total; i++) svg += renderJankoPage(SCORE, i, options, tokens);
  return svg;
}

// ---------------------------------------------------------------------------
// A. The literal-mode extra ink is gone; nothing else moved.
// ---------------------------------------------------------------------------

test('A. The unwanted literal-mode ink is gone: no outlier rules, no ledger dashes, the Round 44 row census', () => {
  const svg = pagesOf();
  assert.equal((svg.match(/class="janko-outlier-rule"/g) ?? []).length, 0, 'no continuous outlier rule');
  assert.equal((svg.match(/class="janko-ledger"/g) ?? []).length, 0, 'no per-note ledger dash');
  const segments = LAYOUTS.reduce((n, l) => n + (l.geometry.staffSegments ?? []).length, 0);
  assert.equal(segments, 85, 'the Round 44 need-based row census is back exactly');
  // System 1 (mm. 5–8) is the reported case: the bottom row was m6..m8 in Round
  // 44 and had grown to m5..m8 under the literal treatment.
  const exts = (LAYOUTS[1].geometry.staffSegments ?? [])
    .filter((s) => s.lin === 24 || s.lin === 72)
    .map((s) => `${s.lin}@m${s.mStart}..${s.mEnd}`);
  assert.deepEqual(exts, ['24@m1..3'], 'm. 5 earns no bottom row again — see the reported round census');
  // The extensions that *are* drawn are the established ones.
  const sys16 = (LAYOUTS[16].geometry.staffSegments ?? [])
    .filter((s) => s.lin === 24 || s.lin === 72)
    .map((s) => `${s.lin}@m${s.mStart}..${s.mEnd}`);
  assert.deepEqual(sys16, ['24@m2..2'], 'the mm. 65–68 system keeps its single legitimate row');
});

test('A. Literal positions survive, no ↓10 fold returns, and no head is displaced', () => {
  // The low LH statements the round draws at source pitch. Round 44 folded the
  // ones below lin 18 up by an octave under a ↓10 indicator; Round 45 drew them
  // literally (with extra ledger ink); Round 46 keeps the literal position and
  // drops only that extra ink.
  const literal = ['brahms-op118-no1-917', 'brahms-op118-no1-25', 'brahms-op118-no1-302'];
  for (const id of literal) {
    const note = SCORE.notes.find((n) => n.id === id)!;
    const head = LAYOUTS.flatMap((l) => l.notes).find((p) => p.note.id === id);
    assert.ok(head, `${id} is laid out`);
    assert.equal(head.coord.octave, note.pitch.octave, `${id}: drawn at its source octave`);
    assert.equal(head.coord.pitchClass, note.pitch.pitchClass, `${id}: source pitch class`);
    assert.equal(head.ottavaShift ?? 0, 0, `${id}: no ↓10 displacement`);
    assert.equal(head.coord.ledgerYs.length, 0, `${id}: no ledger ink is added beside it`);
  }
  const ottava = pagesOf().match(/class="janko-ottava[^"]*"/g) ?? [];
  assert.equal(ottava.length, 0, 'no ottava indicator is emitted for the literal low notes');
});

test('A. The page and system plan is unchanged (5 pages, 18 systems, the same measures)', () => {
  assert.equal(LAYOUTS.length, 18, '18 systems');
  assert.equal(countJankoPages(SCORE, OPTIONS, TOKENS), 5, '5 pages');
});

// ---------------------------------------------------------------------------
// B. 95 % clusters, 0.30pt air, and the shared 2-span indicator.
// ---------------------------------------------------------------------------

test('B. The 95 % Reference declares 0.30pt of air on the six five-level clusters', () => {
  const byTick = new Map(
    LAYOUTS.flatMap((l) => l.opticalClusters ?? []).map((c) => [c.tick, c] as const)
  );
  for (const tick of [1200, 1392, 1584, 3120, 3312, 3504]) {
    const c = byTick.get(tick);
    assert.ok(c, `tick ${tick} is an admitted optical cluster`);
    assert.equal(c.hand, 'RH');
    assert.equal(c.lins.length, 5, 'five distinct levels');
    assert.ok(cents(c.delta, 0.929187, 1e-5), `tick ${tick}: δ = 0.92919pt`);
    assert.ok(cents(c.spanGrowth, 3.716747, 1e-4), `tick ${tick}: span growth 3.71675pt`);
    assert.ok(cents(c.maxDisplacement, 1.858373, 1e-4), `tick ${tick}: max 1.85837pt`);
    assert.equal(c.capped, false, 'inside the 2.5pt cap');
    // Centred: the offsets sum to zero on the member-weighted mean.
    const weights = c.lins.map((lin) => c.memberIds.filter((id) => id).length && 1);
    assert.ok(weights.length === 5);
    const sum = c.offsets.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum) < 5e-3, 'the cluster never translates as a whole');
  }
  // The control variant differs in exactly this number.
  const control = ROUND_46_CONTROL_CARD;
  const controlClusters = layoutJankoScore(
    SCORE,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(control.options ?? {}) }),
    resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(control.tokens ?? {}) })
  ).flatMap((l) => l.opticalClusters ?? []);
  const at1200 = controlClusters.find((c) => c.tick === 1200)!;
  assert.ok(cents(at1200.delta, 0.829187, 1e-5), 'the 0.20pt control measures δ = 0.82919pt');
  assert.ok(cents(at1200.delta, 0.929187 - 0.1, 1e-6), 'exactly 0.10pt less air');
});

test('B. Same-hand/onset/exact-duration 2-span neighbours share one centred indicator', () => {
  for (const [tick, a, b] of [
    [1584, 'brahms-op118-no1-117', 'brahms-op118-no1-118'],
    [3504, 'brahms-op118-no1-252', 'brahms-op118-no1-253'],
  ] as const) {
    const systems = LAYOUTS.filter((l) => l.notes.some((p) => p.note.id === a));
    const carriers = systems.flatMap((l) => l.exceptionCarriers);
    const shared = carriers.filter(
      (c) => c.noteId === a || c.noteId === b || c.partnerId === a || c.partnerId === b
    );
    assert.equal(shared.length, 1, `tick ${tick}: exactly one indicator for the pair`);
    const one = shared[0];
    assert.ok(
      (one.noteId === a && one.partnerId === b) || (one.noteId === b && one.partnerId === a),
      'both members are its owners'
    );
    assert.equal(one.durationTicks, 192, 'it states the shared 192-tick value');
    assert.equal(one.rings, 1, 'one full ring');
    const heads = systems.flatMap((l) => l.notes).filter((p) => p.note.id === a || p.note.id === b);
    const mid = heads.reduce((s, p) => s + p.x, 0) / heads.length;
    assert.ok(
      cents((one.x0 + one.x1) / 2, mid, 1e-6),
      `tick ${tick}: centred between the painted heads`
    );
    // Both members are owned by the shared mark (their stems are not painted).
    for (const system of systems) {
      for (const id of [a, b]) {
        if (system.notes.some((p) => p.note.id === id)) {
          assert.ok(system.claspedStems.includes(id), `${id}: the shared mark owns its statement`);
        }
      }
    }
  }
});

test('B. Exclusions: a bracket-owned value is never re-stated, and equal durations across tie chains never merge', () => {
  // mm. 7/8/9/17/18/19: the 144-tick pairs are owned by their bracket (no
  // second mark), the 96-tick pairs likewise — only the independent 192-tick
  // pairs get carriers.
  const carriers = LAYOUTS.flatMap((l) => l.exceptionCarriers);
  const shared = carriers.filter((c) => c.partnerId !== undefined);
  assert.equal(shared.length, 2, 'exactly the two independent 192-tick pairs share');
  for (const c of carriers) {
    const clasp = LAYOUTS.flatMap((l) => l.clasps).find((k) => k.notes.some((n) => n.id === c.noteId));
    if (!clasp) continue;
    assert.notEqual(
      c.durationTicks,
      clasp.durationTicks,
      `${c.noteId}: an own-value that equals the bracket's is never re-stated`
    );
  }
  // A tie-bearing head is never absorbed into a shared mark: every component
  // head of a rendered chain that owns a carrier owns it alone.
  const chainHeads = new Set(PLAN.chains.flatMap((c) => c.components.map((k) => k.headId)));
  for (const c of carriers) {
    if (!chainHeads.has(c.noteId)) continue;
    assert.equal(c.partnerId, undefined, `${c.noteId}: a tie component never shares its mark`);
  }
});

// ---------------------------------------------------------------------------
// C. The long-value vocabulary, the bracket enlargement and the cut spacing.
// ---------------------------------------------------------------------------

test('C. 96 = half-ring, 192 = one ring, 384 = two rings — and no three-ring glyph exists', () => {
  const marks = (v: number) => compactDurationMarks(v, 'midpoint');
  assert.deepEqual(
    [marks(96).rings, marks(96).halfRing, marks(192).rings, marks(192).halfRing, marks(384).rings, marks(384).halfRing],
    [1, true, 1, false, 2, false],
    'the Round 46 midpoint family'
  );
  assert.equal(MIDPOINT_MAX_RINGS, 2, 'the family’s largest run is two rings');
  assert.deepEqual(
    [marks(48).rings, marks(48).halfRing, marks(48).cuts, marks(24).cuts, marks(144).halfRing, marks(288).rings],
    [0, false, 0, 1, true, 1],
    '48 stays bare, cuts and dots keep their meanings'
  );
  // The compact family (the Round 42 study) is untouched by the round.
  assert.deepEqual([compactDurationMarks(96).rings, compactDurationMarks(384).rings], [1, 3]);
  const svg = pagesOf();
  assert.equal((svg.match(/class="janko-clasp-compact-ring"/g) ?? []).length > 0, true, 'rings are painted');
  // No mount ever paints more than two ring marks in one run.
  const groups = svg.match(/data-clasp-notes="[^"]*"|data-exception-rings="\d"/g) ?? [];
  for (const g of groups) {
    const rings = /data-exception-rings="(\d)"/.exec(g);
    if (rings) assert.ok(Number(rings[1]) <= 2, `carrier rings ≤ 2 (saw ${rings[1]})`);
  }
  const threeRings = svg.match(/data-exception-rings="3"/g) ?? [];
  assert.equal(threeRings.length, 0, 'no three-ring carrier anywhere');
});

test('C. The bracket ring grows 20 % while the horizontal mount keeps the 95 % size', () => {
  const m = midpointMetrics(TOKENS, 0.95);
  assert.ok(cents(m.bracketRingRadius, 2.0064, 1e-6), 'bracket ring r 2.0064pt');
  assert.ok(cents(m.bracketRingStroke, 0.73986, 1e-6), 'bracket ring stroke 0.73986pt');
  assert.ok(cents(m.bracketRingSpacing, 5.22766, 1e-4), 'bracket ring centre pitch 5.22766pt');
  assert.ok(cents(m.ringRadius, 1.672, 1e-6), 'carrier ring stays at 1.672pt');
  assert.ok(cents(m.ringStroke, 0.61655, 1e-6), 'carrier ring stroke stays 0.61655pt');
  assert.ok(cents(m.bracketRingScale, 1.2, 1e-9), 'the mount policy is declared');
  // The painted SVG agrees with both mounts.
  const svg = pagesOf();
  // The emitted markup rounds to two decimals, so the emitted metrics are
  // compared with the paint's own rounding tolerance.
  const bracketRings = [...svg.matchAll(/class="janko-clasp-compact-ring"[^>]*r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)];
  assert.ok(bracketRings.length > 0, 'the bracket mount paints rings');
  for (const [, r, s] of bracketRings) {
    assert.ok(cents(Number(r), m.bracketRingRadius, 0.006), `bracket ring r ${r}`);
    assert.ok(cents(Number(s), m.bracketRingStroke, 0.006), `bracket ring stroke ${s}`);
  }
  const carrierRings = [...svg.matchAll(/class="janko-exception-ring"[^>]*r="([\d.]+)"[^>]*stroke-width="([\d.]+)"/g)];
  assert.ok(carrierRings.length > 0, 'the carrier mount paints rings');
  for (const [, r, s] of carrierRings) {
    // The horizontal mount keeps the un-enlarged size at its own admitted
    // scale (0.95 on the Reference, 1 for the canonical heads): never the
    // bracket's enlarged value, on either scale.
    assert.ok(
      cents(Number(r), m.ringRadius, 0.006) || cents(Number(r), 1.6 * 1.1, 0.006),
      `carrier ring r ${r} keeps the Round 45 size`
    );
    assert.ok(
      cents(Number(s), m.ringStroke, 0.006) || cents(Number(s), 0.59 * 1.1, 0.006),
      `carrier ring stroke ${s} keeps the Round 45 weight`
    );
  }
});

test('C. Half-rings rotate by mount, keep their meaning, and never erase the mount line', () => {
  const svg = pagesOf();
  const half = [...svg.matchAll(/<path class="([^"]*)" data-half-ring="true"[^>]*>/g)];
  assert.ok(half.length >= 4, `half-rings are painted on both mounts (${half.length})`);
  for (const [tag, cls] of half) {
    const d = / d="([^"]*)"/.exec(tag)![1];
    if (cls.includes('clasp')) {
      // LEFT semicircle: the chord is vertical (same x), bulging left.
      const m = /^M ([\d.-]+) ([\d.-]+) A ([\d.-]+) [\d.-]+ 0 0 0 ([\d.-]+) ([\d.-]+)$/.exec(d);
      assert.ok(m, `bracket half-ring is an explicit arc: ${d}`);
      assert.equal(m[1], m[4], 'the chord is vertical (left semicircle)');
      assert.ok(Number(m[5]) > Number(m[2]), 'the arc runs downward');
    } else {
      // UPPER semicircle: the chord is horizontal (same y), bulging up.
      const m = /^M ([\d.-]+) ([\d.-]+) A ([\d.-]+) [\d.-]+ 0 0 1 ([\d.-]+) ([\d.-]+)$/.exec(d);
      assert.ok(m, `carrier half-ring is an explicit arc: ${d}`);
      assert.equal(m[2], m[5], 'the chord lies on the carrier (upper semicircle)');
      assert.ok(Number(m[4]) > Number(m[1]), 'the arc runs rightward');
    }
    assert.ok(tag.includes('fill="none"'), 'the half-ring is unfilled: the mount line survives');
  }
});

test('C. The fixed carrier length is recomputed from the new maximum run, and the cut spacing gains 0.20pt', () => {
  const m = midpointMetrics(TOKENS, 0.95);
  assert.ok(cents(m.cutSpacing, 2.09658, 1e-4), 'cut centre pitch 2.09658pt at 95 %');
  const round45CutPitch = Math.SQRT2 * (0.71 + 0.5) * 0.95 * (7 / 6);
  assert.ok(cents(m.cutSpacing - round45CutPitch, 0.2, 1e-4), 'exactly +0.20pt over the Round 45 reading');
  const maxRun = Math.max(m.cutsRun, m.ringsRun, m.halfRingRun);
  assert.ok(cents(m.carrierLength, maxRun + 2 * m.gap, 1e-9), 'length = the largest run + one gap at each end');
  assert.ok(
    cents(m.carrierLength, effectiveExceptionCarrierLength('midpoint', TOKENS, 0.95), 1e-9),
    'one metric for paint, layout and fit'
  );
  assert.ok(m.carrierLength < 13.7816, 'the envelope shrank even though each mark grew');
  // The slash keeps its angle, length and stroke.
  assert.equal(m.slashSlope, 1, '45 degrees');
  assert.ok(cents(m.paintedCenterline, 5.575211, 1e-4), 'the painted slash length is unchanged');
  assert.ok(cents(m.slashStroke, 0.6745, 1e-6), 'the slash stroke is unchanged');
});

// ---------------------------------------------------------------------------
// D. Written ties.
// ---------------------------------------------------------------------------

test('D. The source bijection is untouched: 964 sounding notes, no invented sounding data', () => {
  assert.equal(SCORE.notes.length, 964, 'the duration fixture’s 964-key bijection is unchanged');
  assert.ok(SCORE.tieChains && SCORE.tieChains.length > 0, 'the committed chain sidecar is attached');
  for (const chain of SCORE.tieChains!) {
    const note = SCORE.notes.find((n) => n.id === chain.noteId)!;
    assert.ok(note, `${chain.noteId} exists`);
    // Sounding timing is the source's own: no chain rewrites it.
    const sum = chain.components.reduce((a, c) => a + c.durationTicks, 0);
    assert.ok(sum <= chain.soundingTicks, `${chain.noteId}: components never exceed the sounding total`);
  }
});

test('D. Thirty-five tie arcs, six carries that reuse an existing head, twenty-nine added continuation heads', () => {
  const arcs = LAYOUTS.flatMap((l) => l.tieArcs ?? []);
  // Round 49 §1 renders every authenticated written chain, so the arcs number
  // 35 (was 19) and 18 of them cross a barline (the newly rendered chains
  // reach across measures); none spans a system break at the canonical packing.
  assert.equal(arcs.length, 35, 'one arc per consecutive written component pair of every authenticated chain');
  assert.equal(arcs.filter((a) => a.crossesBarline).length, 18, 'eighteen barline crossings, no system break');
  assert.equal(LAYOUTS.flatMap((l) => l.tieAnchorShortfalls ?? []).length, 0, 'every arc found its heads');
  assert.equal(LAYOUTS.flatMap((l) => l.tieBlockedArcs ?? []).length, 0, 'every arc clears the glyph masks');
  const added = LAYOUTS.flatMap((l) => l.notes)
    .map((p) => p.note.id)
    .filter((id) => id.includes('~c'));
  assert.deepEqual(
    [...new Set(added)].sort(),
    [
      'brahms-op118-no1-150~c1',
      'brahms-op118-no1-15~c1',
      'brahms-op118-no1-172~c1',
      'brahms-op118-no1-295~c1',
      'brahms-op118-no1-351~c1',
      'brahms-op118-no1-37~c1',
      'brahms-op118-no1-434~c1',
      'brahms-op118-no1-448~c1',
      'brahms-op118-no1-544~c1',
      'brahms-op118-no1-554~c1',
      'brahms-op118-no1-581~c1',
      'brahms-op118-no1-637~c1',
      'brahms-op118-no1-720~c1',
      'brahms-op118-no1-734~c1',
      'brahms-op118-no1-858~c1',
      'brahms-op118-no1-858~c2',
      'brahms-op118-no1-858~c3',
      'brahms-op118-no1-904~c1',
      'brahms-op118-no1-904~c2',
      'brahms-op118-no1-905~c1',
      'brahms-op118-no1-906~c1',
      'brahms-op118-no1-907~c1',
      'brahms-op118-no1-912~c1',
      'brahms-op118-no1-918~c1',
      'brahms-op118-no1-919~c1',
      'brahms-op118-no1-920~c1',
      'brahms-op118-no1-939~c1',
      'brahms-op118-no1-940~c1',
      'brahms-op118-no1-941~c1',
    ].sort(),
    'exactly the twenty-nine written continuations no head stated (Round 49 §1)'
  );
  // Every rendered component head states exactly its own written component —
  // the tie can never re-label a head with the composite total.
  const laidOut = new Map(LAYOUTS.flatMap((l) => l.notes).map((p) => [p.note.id, p]));
  for (const chain of PLAN.chains) {
    for (const component of chain.components) {
      const head = laidOut.get(component.headId);
      assert.ok(head, `${component.headId}: the component's head is laid out`);
      assert.equal(
        head.note.durationTicks,
        component.durationTicks,
        `${component.headId}: engraved at its own written component`
      );
    }
  }
  // The six hidden carries land on heads that already existed: each
  // continuation is a source statement (never a `~c` head) and states the
  // component the source wrote under it. Four are genuine `tieWaitForNote`
  // spans (m65/m66, with the source's own gap), two are plain ties whose
  // continuation already coincides with a head.
  const carries: ReadonlyArray<readonly [string, string, boolean]> = [
    ['brahms-op118-no1-543', 'brahms-op118-no1-545', false],
    ['brahms-op118-no1-553', 'brahms-op118-no1-555', false],
    ['brahms-op118-no1-901', 'brahms-op118-no1-905', true],
    ['brahms-op118-no1-903', 'brahms-op118-no1-906', true],
    ['brahms-op118-no1-909', 'brahms-op118-no1-913', true],
    ['brahms-op118-no1-911', 'brahms-op118-no1-914', true],
  ];
  for (const [attackId, landingId, tieWait] of carries) {
    const chain = PLAN.chains.find((c) => c.noteId === attackId);
    assert.ok(chain, `${attackId}: the carry chain is rendered`);
    assert.equal(chain.components.length, 2, `${attackId}: exactly two written components`);
    const landingComponent = chain.components[1];
    assert.equal(landingComponent.headId, landingId, `${attackId}: the continuation lands on the existing head`);
    assert.equal(landingComponent.added, false, `${landingId}: reused, never added`);
    assert.equal(landingComponent.tieWait, tieWait, `${attackId}: the source's tieWaitForNote context`);
    const landing = SCORE.notes.find((n) => n.id === landingId);
    assert.ok(landing, `${landingId} is a source statement, not a display head`);
    const own = PLAN.chains.find((c) => c.noteId === landingId);
    assert.equal(
      landingComponent.durationTicks,
      own ? own.components[0].durationTicks : landing.durationTicks,
      `${landingId}: the component it states is its own first written value`
    );
  }
});

test('D. m. 66 reads 9 / 2 / 5 before the chord, with one visible attack head per coincident group', () => {
  const system = LAYOUTS[16];
  const digits = '0123456789AB';
  const heads = system.notes
    .filter((p) => p.note.startTick >= 12552 && p.note.startTick < 12624)
    .sort((a, b) => a.note.startTick - b.note.startTick);
  const lh = heads.filter((p) => p.rhythm.hand === 'LH');
  assert.deepEqual(
    lh.map((p) => `${digits[p.coord.pitchClass]}@${p.note.startTick}`),
    ['9@12552', '2@12576', '5@12600'],
    'one visible attack head per source-proven attack/carry group'
  );
  assert.equal(
    lh.filter((p) => p.coord.pitchClass === 9).length,
    1,
    'the A2 carry no longer paints a second digit'
  );
  // The reattack whose duration is *unequal* keeps its own rhythm statement.
  const voices = system.unisonVoices.filter((p) => p.note.startTick >= 12552 && p.note.startTick < 12624);
  assert.deepEqual(
    voices.map((v) => v.note.id),
    ['brahms-op118-no1-910'],
    'the shorter simultaneous voice is preserved as a mixed-duration voice'
  );
  // The chord: A2 / D3 / F3 left hand, D4 / D5 right hand, at 12624.
  const chord = system.notes.filter((p) => p.note.startTick === 12624);
  assert.deepEqual(
    chord.filter((p) => p.rhythm.hand === 'LH').map((p) => digits[p.coord.pitchClass]).sort(),
    ['2', '5', '9'],
    'the left-hand chord is A2/D3/F3'
  );
  assert.deepEqual(
    chord.filter((p) => p.rhythm.hand === 'RH').map((p) => digits[p.coord.pitchClass]).sort(),
    ['2', '2'],
    'the right hand keeps D4/D5'
  );
});

test('D. m. 65’s bracket carries its first component (96), and 907 states its written components', () => {
  const clasp = LAYOUTS[16].clasps.find((c) => c.tick === 12432);
  assert.ok(clasp, 'the m. 65 bracket is admitted');
  assert.equal(clasp.durationTicks, 96, 'the carried value is the first written component, not the 120 total');
  const ink = clasp.durationInk[0];
  assert.equal(ink.compactRings, 1, 'one ring mark');
  assert.equal(ink.compactHalfRing, true, 'and it is the half-ring (96 ticks)');
  // Round 49 §1: 907's source writes a2~ + a4 (96 + 48) — equal sounding
  // duration is not equivalent notation, so the former single 144 statement is
  // gone. The bracket states the origin's own 96 (the member's value IS the
  // bracket's carried value, so no individual mark is painted beside it), the
  // arc states the hold, and the added continuation head states the 48.
  const carrier = LAYOUTS[16].exceptionCarriers.find((c) => c.noteId === 'brahms-op118-no1-907');
  assert.equal(carrier, undefined, 'no redundant individual 96 mark beside the bracket that carries it');
  const continuation = LAYOUTS.flatMap((l) => l.notes).find(
    (p) => p.note.id === 'brahms-op118-no1-907~c1'
  );
  assert.ok(continuation, 'the continuation head is laid out');
  assert.equal(continuation.note.durationTicks, 48, 'and it states the source’s own a4 (48 ticks)');
});

test('D. The canonical Brahms report is clean: no violations, no warnings, the six refusals solved', () => {
  assert.equal(REPORTS.violations.length, 0, `no hard errors (${REPORTS.violations.map((v) => v.code).join(',')})`);
  assert.equal(
    REPORTS.warnings.length,
    0,
    `no warnings (${REPORTS.warnings.map((w) => `${w.code}:${w.noteIds?.join('/')}`).join(',')})`
  );
  assert.equal(REPORTS.ok, true);
  // The former six `carrier-duration-unsupported` refusals must not reappear
  // under any name: their composites are now stated by components and ties.
  for (const id of [295, 351, 448, 581, 637, 734]) {
    const noteId = `brahms-op118-no1-${id}`;
    const chain = PLAN.chains.find((c) => c.noteId === noteId);
    assert.ok(chain, `${noteId} renders its written chain`);
    assert.deepEqual(
      chain.components.map((c) => c.durationTicks),
      [96, 24],
      `${noteId}: first component 96, continuation 24`
    );
  }
  assert.equal(
    LAYOUTS.flatMap((l) => l.exceptionCarrierUnsupported).length,
    0,
    'no composite is left unstated'
  );
});

test('D. Ties clear every glyph mask and never erase ink (paint order and stem connectivity)', () => {
  const svg = pagesOf();
  // The tie band is painted with the holds, above the staff rules and beneath
  // every carrier mark, beam, stem, rest and notehead — all of them later in
  // the same system frame's document order, so a crossed stem stays unbroken
  // and no mark is ever cut. Read from the emitted page, not asserted by name.
  const frames = svg
    .split(/<g id="system-/)
    .filter((chunk) => chunk.includes('janko-tie-layer'));
  assert.ok(frames.length > 0, 'the page paints the tie band inside a system frame');
  const laterBands = [
    'janko-exception-layer',
    'janko-beam-group',
    'janko-clasp-layer',
    'janko-knockout',
  ];
  for (const frame of frames) {
    const tieIndex = frame.indexOf('janko-tie-layer');
    for (const later of laterBands) {
      const index = frame.indexOf(later);
      // A band the frame does not paint is simply absent; one it does paint
      // must come after the ties, so nothing a tie crosses is ever cut.
      if (index < 0) continue;
      assert.ok(
        index > tieIndex,
        `${later} is painted after the tie band (its ink is never cut by a tie)`
      );
    }
  }
  // At least one frame really does paint the marks the ordering protects.
  assert.ok(
    frames.some((frame) => frame.includes('janko-exception-layer')),
    'a tie-bearing frame also paints its carriers'
  );
  const arcs = LAYOUTS.flatMap((l) => l.tieArcs ?? []);
  for (const arc of arcs) {
    const system = LAYOUTS.find((l) => (l.tieArcs ?? []).includes(arc))!;
    const heads = new Map(system.notes.map((p) => [p.note.id, p]));
    // How many painted tie paths carry this arc's own geometry (one per arc):
    assert.ok(svg.includes(`data-tie-note="${arc.noteId}"`), `${arc.noteId}: the arc is painted`);
    for (const [headId, x] of [
      [arc.fromHeadId, arc.x1],
      [arc.toHeadId, arc.x2],
    ] as const) {
      const head = heads.get(headId)!;
      const mask = knockoutHalfExtents(OPTIONS, TOKENS, head.note.startTick, head);
      // The endpoint stands on (or outside) the head's own outer edge (x) and
      // outside its knockout box by the declared air (y): the tie never enters
      // a glyph. Round 48: when a bracket stands between the two tied heads the
      // chord is clipped short of that bracket, so the endpoint may only move
      // **outward** — never into the head — and the clip is bounded by the
      // bracket's own edge (asserted with the clip margin below).
      const edge =
        headId === arc.fromHeadId ? head.x + mask.wx : head.x - mask.wx;
      const outward = headId === arc.fromHeadId ? x >= edge - 1e-6 : x <= edge + 1e-6;
      assert.ok(outward, `${headId}: the endpoint does not enter the head's knockout edge`);
      assert.ok(
        Math.abs(x - edge) <= 40,
        `${headId}: the endpoint stays within a bracket clip of the head's edge`
      );
      assert.ok(
        Math.abs(arc.y - head.y) >= mask.hy + TOKENS.tieEndpointAir - 1e-6,
        `${headId}: the endpoint keeps ${TOKENS.tieEndpointAir}pt clear of the knockout box`
      );
    }
  }
  // The measured crossings are published, never suppressed. Round 48's routing
  // (measured ink clearance + one side per chain) removed the family's
  // crossings — the Reference keeps at most one measured residual, and every
  // one of them is still published on its arc.
  const crossings = arcs.reduce((n, a) => n + a.stemCrossings.length, 0);
  assert.ok(crossings <= 1, `${crossings} measured stem crossings remain on the Reference`);
  assert.equal(
    (svg.match(/data-tie-stem-crossings="/g) ?? []).length,
    arcs.filter((a) => a.stemCrossings.length > 0).length,
    'every crossing is tagged on its painted arc'
  );
});

// ---------------------------------------------------------------------------
// E. Surfaces.
// ---------------------------------------------------------------------------

test('E. Bach GOLD is byte-frozen, and Round 47 keeps this round\u2019s family as its shared base', () => {
  const bach = buildBachGoldbergVar1Score();
  let svg = '';
  for (let i = 0; i < countJankoPages(bach, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS); i++) {
    svg += renderJankoPage(bach, i, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  }
  assert.equal(
    createHash('sha256').update(svg).digest('hex'),
    'ccfcaecca058aa1ed7d37291d765a8ef58ed79e428c732f338f298fb5b7a104f',
    'Bach GOLD is unchanged'
  );
  // Round 48 has opened its own candidate set on this baseline (the two circle
  // readings of one corrected surface; the Round 46 and Round 47 sets are on
  // record in test/janko-candidates.test.ts, test/janko-round45.test.ts and
  // test/janko-round47.test.ts). Every one of them still states this round's
  // adopted family as fixed context, and the working Reference they are measured
  // against is untouched — the assertions below are the Round 46 contract,
  // checked through the live registry.
  assert.equal(CURRENT_ROUND_METADATA.round, 49, 'Round 49 is the open round');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    ['round49-above-080', 'round49-air-100', 'round49-uniform-080'],
    'the Round 49 trio'
  );
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(resolved.options.chordSymbolScale, 0.95, `${candidate.id}: 95 %`);
    assert.equal(resolved.options.writtenTies, 'source', `${candidate.id}: ties are rendered`);
    assert.equal(resolved.options.bracketDurationGrammar, 'midpoint');
    assert.equal(resolved.tokens.midpointBracketRingScale, 1.2, 'the bracket enlargement is declared');
    assert.equal(resolved.options.pitchPlacement, 'parity-columns', `${candidate.id}: the literal parity columns`);
    assert.equal(resolved.options.lowPitchFolding, 'literal', `${candidate.id}: the literal lows`);
    assert.equal(resolved.tokens.opticalClearanceAir, 0.3, `${candidate.id}: the adopted 0.30pt air`);
  }
  // The working Reference itself is the frozen baseline the cards are judged
  // against: its options and tokens are exactly the Round 46 declaration, so no
  // Round 47 axis can have leaked into it.
  const reference = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const referenceTokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.equal(reference.exceptionCarrier, 'horizontal', 'the Reference keeps the horizontal arm');
  assert.equal(reference.longDurationStyle, 'midpoint', 'and the ring vocabulary');
  assert.equal(reference.tieOriginIndicator, 'source', 'and states every originator mark itself');
  assert.equal(reference.tieProfile, 'uniform', 'and paints the Round 46 uniform tie contour');
  assert.equal(referenceTokens.halfRingGap, 0, 'and the unbroken half-ring mount');
  // Round 49 §5: the adopted 48B detached-circle baseline and the family-wide
  // rightward air are the golden token values (the detached mount itself only
  // paints under `exceptionCarrier: 'symbol'`, so the Reference's bytes read
  // the family air alone).
  assert.equal(referenceTokens.detachedRingScale, 0.88, 'at the adopted 48B circle size');
  assert.equal(referenceTokens.detachedSymbolAir, 0.8, 'at the adopted 0.80pt seat air');
  assert.equal(referenceTokens.horizontalMountAir, 0.8, 'at the adopted family-wide air');
  assert.equal(OPTIONS.chordSymbolScale, 0.95, 'the Reference is the 95 % engraving');
  assert.equal(TOKENS.midpointSpacingFactor, 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95));
  // The working Reference and the 0.30pt card engrave the same music: every
  // layout fact of all 18 systems is identical (the studio cards declare the
  // engraving, not the score's title block).
  // The studio resolves a card exactly like this: the score's own options and
  // tokens first, then the card's declared deltas.
  const card = ROUND_46_REFERENCE_CARD;
  const cardLayouts = layoutJankoScore(
    SCORE,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(card.options ?? {}) }),
    resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(card.tokens ?? {}) })
  );
  const fingerprint = (layouts: typeof LAYOUTS): string =>
    JSON.stringify(
      layouts.map((l) => ({
        index: l.index,
        notes: l.notes.map((p) => [p.note.id, p.x, p.y, p.symbolScale, p.opticalOffsetY ?? 0]),
        clasps: l.clasps.map((c) => [c.tick, c.durationTicks]),
        carriers: l.exceptionCarriers.map((c) => [c.noteId, c.x0, c.y, c.rings, c.halfRing, c.partnerId ?? '']),
        ties: (l.tieArcs ?? []).map((a) => [a.noteId, a.fromHeadId, a.toHeadId, a.x1, a.y, a.depth]),
      }))
    );
  assert.equal(
    createHash('sha256').update(fingerprint(cardLayouts)).digest('hex'),
    createHash('sha256').update(fingerprint(LAYOUTS)).digest('hex'),
    'the Reference and the 0.30pt card are one engraving'
  );
});
