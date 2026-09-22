/**
 * Shared engraving rules (ticket §§A–D) — gate-2 unit theory + gate-3 literal
 * real-engine pins.
 *
 *  §A. Lowest-inward cluster slots: pure interval-colouring units
 *      (clear/pair/triple/long-chain, permutation, folding priority,
 *      halo/tall masks, cell-fit diagnostics) + canonical Brahms literals
 *      (m.4 clear; m.7/m.17 inward + carrier; m.8/m.9/m.18/m.19 alignment;
 *      m.33/m.53 folds; mixed durations; cross-hand independence).
 *  §B. Bracket-dot consistency: the negative actual-collision fixture (the
 *      m.1/m.19 45° pins live in the dots-golden suite, the corpus sweep in
 *      the nib suite).
 *  §C. Ottava glyph treatment: scale/ink/advance/bbox wiring + a real
 *      spanner-attachment window.
 *  §D. Rest placement: the local-measure rule on corpus specimens
 *      (tie/nearer/one-sided/crossbar-exclusion/polyphonic-cluster) +
 *      synthetic whole-bar (empty-measure) and no-history fallbacks +
 *      corpus-wide safety.
 *
 * Beamed-stem integrity, cross-hand bracket unification and unison survival
 * are pinned by the green clasp/round-19/round-21 suites (cited, not
 * duplicated).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  buildBrahmsOp118No1Score,

} from '../src/scores/brahms-op118-no1';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  JankoClusterFitMember,
  checkClusterCellFit,
  clusterOverlapComponents,
  computeJankoRestLayer,
  fitClusterSlots,
  layoutJankoScore,
  nearestDrawnStaffRule,
  nearestLatticeRow,
} from '../src/render/janko/engine';
import {
  JankoClaspGroupGeometry,
  JankoRhythmNote,
  ResolvedJankoClaspInk,
  claspDotCenter,
  claspDotMemberAir,
} from '../src/render/janko/elements/rhythm';
import {
  DUODECIMAL_SPAN_SEMITONES,
  OTTAVA_GLYPH_INK,
  OTTAVA_LABELS,
  OTTAVA_LABEL_ADVANCE,
  OTTAVA_LABEL_ASCENT,
  OTTAVA_LABEL_DESCENT,
  OTTAVA_LABEL_FONT_SIZE,
  duodecimalSpanSemitones,
  kindForShift,
  ottavaGlyphAdvance,
  ottavaGlyphBbox,
  renderOttavaBracket,
} from '../src/render/janko/elements/ottava';
import { REST_INK } from '../src/render/janko/elements/rests';
import { getEquatorYForOctave } from '../src/render/janko/geometry';
import { lintJankoScore } from '../src/render/janko/linter';
import type { QuantizedGridScore, QuantizedNote } from '../src/model/types';

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();
const O_BRAHMS = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
const T_BRAHMS = resolveJankoTokens(BRAHMS_ROUND44_RESERVE_TOKENS);
const O_BACH = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T_BACH = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
/** Ordinary tight head footprint + style air (the 5.46pt pair gap). */
const WX = 2.53;
const AIR = 0.4;

function mem(id: string, lower: number, upper: number, lin: number, wx = WX): JankoClusterFitMember {
  return { id, lower, upper, wx, lin };
}

function slotMap(fit: { slots: Map<string, number> }): Record<string, number> {
  return Object.fromEntries([...fit.slots.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

// ---------------------------------------------------------------------------
// §A. Context-anchored slot fit — pure unit theory
// ---------------------------------------------------------------------------
// Order (pitch ascending) is fixed; anchoring follows the bracket context:
// 'inward' seats the lowest colour toward its actual bracket (-1, 0, …),
// 'column' seats it ON the true rhythmic column (0, +1, …). Single-colour
// groups sit on the column under either anchor.

test('§A units: a clear vertical stays one component on the main column', () => {
  const members = [mem('a', 0, 6.92, 60), mem('b', 7.5, 14.42, 62), mem('c', 15, 21.92, 64)];
  assert.equal(clusterOverlapComponents(members).length, 3, 'three clear components');
  const fit = fitClusterSlots(members, AIR, 'inward');
  assert.deepEqual(slotMap(fit), { a: 0, b: 0, c: 0 }, 'every clear member holds the column');
});

test('§A units: touching masks split components but share the column', () => {
  // Overlap ≤ EPS is not a conflict: exact-touching masks form separate
  // components, each single-colour, so both sit at slot 0 — together on the
  // column, exactly as the notehead-overlap audit permits.
  const members = [mem('a', 0, 6.92, 60), mem('b', 6.92, 13.84, 62)];
  assert.equal(clusterOverlapComponents(members).length, 2, 'exact touch splits');
  assert.deepEqual(slotMap(fitClusterSlots(members, AIR, 'column')), { a: 0, b: 0 }, 'both on the column');
});

test('§A units: a conflicting pair takes {-gap, 0} inward, {0, +gap} on the column', () => {
  const members = [mem('low', 0, 6.92, 48), mem('high', 2.5, 9.42, 50)];
  assert.equal(clusterOverlapComponents(members).length, 1, 'one component');
  const fit = fitClusterSlots(members, AIR, 'inward');
  assert.deepEqual(slotMap(fit), { high: 0, low: -1 }, 'bracketed: lowest pitch inward, other on the column');
  assert.equal(fit.gap, 2 * WX + AIR, 'the sufficient 5.46pt pair gap');
  assert.equal(fit.gap, 5.46, 'ordinary tight heads: 2·2.53 + 0.4');
  const col = fitClusterSlots(members, AIR, 'column');
  assert.deepEqual(slotMap(col), { high: 1, low: 0 }, 'unbracketed: lowest ON the column, higher right');
  assert.equal(col.gap, fit.gap, 'anchoring never changes the sufficient gap');
});

test('§A units: a chromatic three-clique takes {-gap, 0, +gap} by pitch', () => {
  const members = [mem('c', 0, 6.92, 48), mem('cs', 2.5, 9.42, 49), mem('d', 5, 11.92, 50)];
  assert.equal(clusterOverlapComponents(members).length, 1, 'one component');
  const fit = fitClusterSlots(members, AIR, 'inward');
  assert.deepEqual(slotMap(fit), { c: -1, cs: 0, d: 1 }, 'inward: lowest inward, rest outward by pitch');
  assert.deepEqual(
    slotMap(fitClusterSlots(members, AIR, 'column')),
    { c: 0, cs: 1, d: 2 },
    'column: lowest ON the column, rest outward by pitch'
  );
});

test('§A units: a longer overlap chain reuses columns (no pairwise rule)', () => {
  // A–B–C–D where neighbours overlap but A/C, B/D, A/D are disjoint: two
  // colours suffice, so four members take two slots — never a slot per pair.
  const members = [
    mem('a', 0, 6.92, 40),
    mem('b', 5, 11.92, 43),
    mem('c', 10, 16.92, 46),
    mem('d', 15, 21.92, 49),
  ];
  assert.equal(clusterOverlapComponents(members).length, 1, 'one chained component');
  const fit = fitClusterSlots(members, AIR, 'inward');
  assert.deepEqual(
    slotMap(fit),
    { a: -1, b: 0, c: -1, d: 0 },
    'inward colours reused: {a, c} inward, {b, d} on the column'
  );
  assert.deepEqual(
    slotMap(fitClusterSlots(members, AIR, 'column')),
    { a: 0, b: 1, c: 0, d: 1 },
    'column colours reused: {a, c} on the column, {b, d} outward'
  );
});

test('§A units: input permutation never changes the fit', () => {
  const members = [mem('c', 0, 6.92, 48), mem('cs', 2.5, 9.42, 49), mem('d', 5, 11.92, 50)];
  const expected = slotMap(fitClusterSlots(members, AIR, 'inward'));
  const reversals = [
    [members[2], members[1], members[0]],
    [members[1], members[2], members[0]],
    [members[2], members[0], members[1]],
  ];
  for (const order of reversals) {
    assert.deepEqual(slotMap(fitClusterSlots(order, AIR, 'inward')), expected, 'stable under permutation');
  }
  // Id tie-break inside equal pitch: deterministic, still lowest-inward.
  const twins = [mem('b', 0, 6.92, 48), mem('a', 2.5, 9.42, 48)];
  assert.deepEqual(slotMap(fitClusterSlots(twins, AIR, 'inward')), { a: -1, b: 0 }, 'stable id tie-break');
});

test('§A units: lowest means SOURCE pitch, not folded drawing y', () => {
  // Fold-reversed: the lower-pitch member is drawn HIGHER (smaller y), and a
  // fold-coincident pair shares its interval exactly. Both seat lowest-lin
  // inward — drawing order never decides.
  const reversed = [mem('low', 0, 6.92, 40), mem('high', 2.5, 9.42, 52)];
  assert.deepEqual(slotMap(fitClusterSlots(reversed, AIR, 'inward')), { high: 0, low: -1 }, 'drawn-higher low pitch inward');
  const coincident = [mem('e1', 10, 16.92, 16), mem('e2', 10, 16.92, 28)];
  assert.deepEqual(
    slotMap(fitClusterSlots(coincident, AIR, 'inward')),
    { e1: -1, e2: 0 },
    'same interval: lowest lin inward (the m.33/m.53 octave case)'
  );
});

test('§A units: halo-grown and tall masks widen the gap, never shrink it', () => {
  // A halo-grown member (wx 6.2) against an ordinary head: the gap covers
  // the grown extents plus air.
  const grown = [mem('halo', 0, 6.92, 48, 6.2), mem('plain', 2.5, 9.42, 50)];
  const fit = fitClusterSlots(grown, AIR, 'inward');
  assert.deepEqual(slotMap(fit), { halo: -1, plain: 0 });
  assert.equal(fit.gap, 6.2 + WX + AIR, 'grown extents plus air (9.13pt)');
  // A tall member unifies two disjoint small ones into one component; the
  // smalls share the inward colour (their intervals never meet).
  const tall = mem('tall', 0, 20, 60);
  const s1 = mem('s1', 2, 5, 50);
  const s2 = mem('s2', 15, 18, 40);
  assert.equal(clusterOverlapComponents([tall, s1, s2]).length, 1, 'the tall member unifies');
  assert.deepEqual(
    slotMap(fitClusterSlots([tall, s1, s2], AIR, 'inward')),
    { s1: -1, s2: -1, tall: 0 },
    'smalls share inward, tall holds the column'
  );
});

test('§A units: singletons and empties stay trivially on the column', () => {
  const single = fitClusterSlots([mem('solo', 0, 6.92, 48)], AIR, 'column');
  assert.deepEqual(slotMap(single), { solo: 0 });
  assert.equal(single.gap, 2 * WX + AIR);
  const empty = fitClusterSlots([], AIR, 'column');
  assert.equal(empty.slots.size, 0);
  assert.equal(empty.gap, AIR);
});

test('§A units: the cell-fit diagnostic names the onset, members and edges', () => {
  // Feasible centres (edges inclusive) report nothing.
  assert.equal(
    checkClusterCellFit(1200, new Map([['a', 52.61], ['b', 47.15]]), 47.15, 60),
    null,
    'inside the cell: feasible'
  );
  // A centre past either edge reports the explicit space demand — sorted
  // member ids, desired span, cell span — for the column solve + linter.
  const demand = checkClusterCellFit(
    1200,
    new Map([
      ['b', 47.15],
      ['a', 52.61],
      ['rogue', 61.2],
    ]),
    47.15,
    60
  )!;
  assert.equal(demand.tick, 1200, 'the onset tick');
  assert.deepEqual(demand.memberIds, ['rogue'], 'exactly the escaping member');
  assert.equal(demand.desiredLeft, 47.15, 'desired left edge');
  assert.equal(demand.desiredRight, 61.2, 'desired right edge');
  assert.equal(demand.cellLeft, 47.15, 'cell left edge');
  assert.equal(demand.cellRight, 60, 'cell right edge');
});

// ---------------------------------------------------------------------------
// §A. Lowest-inward slots — canonical Brahms literals (fixed-3)
// ---------------------------------------------------------------------------

/** Solved onset column + member x per id for one tick on the canonical Brahms. */
function onsetColumns(tick: number): { column: number; xs: Map<string, number> } {
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  for (const l of layouts) {
    const ps = l.notes.filter((p) => p.note.startTick === tick);
    if (ps.length === 0) continue;
    const column = l.columns.get(tick)!;
    const xs = new Map(ps.map((p) => [p.note.id, p.x]));
    return { column, xs };
  }
  throw new Error(`tick ${tick} not laid out`);
}

test('§A literal: m.1/m.3 seat commons CENTER, the obstructed exception RIGHT', () => {
  // Ticket §1 duration priority (fixed-3): the two ordinary 144-tick members
  // align CENTER; the middle 192-tick exception's up-stem would pierce the
  // upper common's mask at CENTER, so it takes RIGHT — explicitly outranking
  // ordinary pitch alternation. The LH downbeat singleton holds the column.
  for (const [tick, loId, excId, hiId, lhId] of [
    [48, 'brahms-op118-no1-4', 'brahms-op118-no1-5', 'brahms-op118-no1-6', 'brahms-op118-no1-3'],
    [432, 'brahms-op118-no1-26', 'brahms-op118-no1-27', 'brahms-op118-no1-28', 'brahms-op118-no1-25'],
  ] as const) {
    const { column, xs } = onsetColumns(tick);
    assert.ok(Math.abs(xs.get(loId)! - column) < 1e-9, `tick ${tick}: lower common CENTER`);
    assert.ok(Math.abs(xs.get(hiId)! - column) < 1e-9, `tick ${tick}: upper common CENTER`);
    assert.ok(
      Math.abs(xs.get(excId)! - (column + 5.46)) < 1e-6,
      `tick ${tick}: obstructed exception RIGHT`
    );
    assert.ok(Math.abs(xs.get(lhId)! - column) < 1e-9, `tick ${tick}: LH singleton CENTER`);
    // The aligned commons share the column bit-for-bit: no shear.
    assert.equal(xs.get(loId), xs.get(hiId), `tick ${tick}: commons coincide`);
  }
});

test('§A literal: m.4 (tick 624) stays a clear vertical, every hand on the column', () => {
  const { column, xs } = onsetColumns(624);
  assert.equal(xs.size, 3, 'three heads sound the downbeat');
  for (const [id, x] of xs) {
    assert.ok(Math.abs(x - column) < 1e-9, `${id} holds the column (mixed hands/durations, no conflict)`);
  }
});

test('§A literal: m.7/m.17 seat the ordinary ninth pair CENTER/RIGHT; the upper head carries', () => {
  // Compact seating: the five-voice downbeat is one ordinary component
  // {low, high} (dy 5.0 < 2·hy 6.92) plus three clear singletons. The pair
  // seats adjacent by source pitch — lower CENTER, higher RIGHT — and every
  // clear member holds CENTER. The LH singleton shares the onset but no
  // component.
  for (const [tick, lowId, highId, carrierId] of [
    [1200, 'brahms-op118-no1-78', 'brahms-op118-no1-79', 'brahms-op118-no1-82'],
    [3120, 'brahms-op118-no1-213', 'brahms-op118-no1-214', 'brahms-op118-no1-217'],
  ] as const) {
    const { column, xs } = onsetColumns(tick);
    assert.ok(
      Math.abs(xs.get(lowId)! - column) < 1e-6,
      `tick ${tick}: lower head CENTER`
    );
    assert.ok(
      Math.abs(xs.get(highId)! - (column + 5.46)) < 1e-6,
      `tick ${tick}: higher head RIGHT`
    );
    for (const [id, x] of xs) {
      if (id === lowId || id === highId) continue;
      assert.ok(Math.abs(x - column) < 1e-9, `tick ${tick}: ${id} on the column`);
    }
    const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
    const carrier = layouts
      .flatMap((l) => l.sharedStems)
      .find((g) => g.tick === tick)!;
    assert.equal(carrier.carrierId, carrierId, `tick ${tick}: the topmost main-column head carries`);
    // The carrier is the topmost head of the onset and sits on the column.
    const atTick = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
    const top = [...atTick].sort((a, b) => a.y - b.y)[0];
    assert.equal(top.note.id, carrierId, `tick ${tick}: carrier is topmost`);
    assert.ok(Math.abs(xs.get(carrierId)! - column) < 1e-9, `tick ${tick}: carrier on the column`);
  }
});

test('§A literal: m.8/m.18 seat both pairs CENTER/RIGHT, middle head CENTER', () => {
  // Compact seating: two ordinary pair components {96,97} and {99,100}
  // (each dy 5.0 < 2·hy 6.92) plus the clear singleton 98. Each pair seats
  // adjacent — lower CENTER / higher RIGHT — so the doubled 5s share the
  // column with b and the doubled 7s share RIGHT. The carrier rule
  // (nearest the column, then topmost) elects the topmost on-column head.
  for (const [tick, center, right, carrierId] of [
    [
      1392,
      ['brahms-op118-no1-96', 'brahms-op118-no1-99'],
      ['brahms-op118-no1-97', 'brahms-op118-no1-100'],
      'brahms-op118-no1-99',
    ],
    [
      3312,
      ['brahms-op118-no1-231', 'brahms-op118-no1-234'],
      ['brahms-op118-no1-232', 'brahms-op118-no1-235'],
      'brahms-op118-no1-234',
    ],
  ] as const) {
    const { column, xs } = onsetColumns(tick);
    for (const id of center) {
      assert.ok(
        Math.abs(xs.get(id)! - column) < 1e-6,
        `tick ${tick}: ${id} CENTER (its pair's lower)`
      );
    }
    for (const id of right) {
      assert.ok(
        Math.abs(xs.get(id)! - (column + 5.46)) < 1e-6,
        `tick ${tick}: ${id} RIGHT (its pair's higher)`
      );
    }
    for (const [id, x] of xs) {
      if (([...center, ...right] as readonly string[]).includes(id)) continue;
      assert.ok(Math.abs(x - column) < 1e-9, `tick ${tick}: ${id} on the column`);
    }
    const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
    const carrier = layouts
      .flatMap((l) => l.sharedStems)
      .find((g) => g.tick === tick)!;
    assert.equal(carrier.carrierId, carrierId, `tick ${tick}: equal durations share one carrier`);
  }
});

test('§A literal: m.9/m.19 clear top pair seats lower CENTER / higher RIGHT, never fusing carriers', () => {
  // Compact seating: the commons {114,115,116} seat as an ordinary pair
  // {114,115} (dy 5.0 < 2·hy 6.92 → 114 CENTER / 115 RIGHT) plus clear
  // singleton 116. The two 192-tick exceptions are a clear-path TOP pair,
  // NOT obstructed internal exceptions: 117 (lower) takes CENTER, 118
  // (higher) staggers RIGHT off it — both duration paths run upward
  // unobstructed.
  for (const [tick, right] of [
    [1584, ['brahms-op118-no1-115', 'brahms-op118-no1-118']],
    [3504, ['brahms-op118-no1-250', 'brahms-op118-no1-253']],
  ] as const) {
    const { column, xs } = onsetColumns(tick);
    for (const id of right) {
      assert.ok(
        Math.abs(xs.get(id)! - (column + 5.46)) < 1e-6,
        `tick ${tick}: ${id} RIGHT`
      );
    }
    for (const [id, x] of xs) {
      if (([...right] as readonly string[]).includes(id)) continue;
      assert.ok(Math.abs(x - column) < 1e-9, `tick ${tick}: ${id} on the column`);
    }
    const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
    const atTick = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
    const durations = new Set(atTick.map((p) => p.note.durationTicks));
    assert.ok(durations.size > 1, `tick ${tick}: genuinely mixed durations`);
    const fused = layouts.flatMap((l) => l.sharedStems).some((g) => g.tick === tick);
    assert.equal(fused, false, `tick ${tick}: mixed durations never share one carrier`);
    // No duration is rewritten by the fit: every head keeps its score value.
    for (const p of atTick) {
      const scoreNote = BRAHMS.notes.find((n) => n.id === p.note.id)!;
      assert.equal(p.note.durationTicks, scoreNote.durationTicks, `${p.note.id} keeps its duration`);
    }
  }
});

test('§A literal: m.33/m.53 fold-coincident octaves stagger on the column, unbracketed', () => {
  // Fold-coincident octaves share their drawn row only because folding
  // transposed one member: they stagger horizontally (masks must clear) but
  // earn no bracket solely for the coincidence. Column-anchored: lowest
  // source pitch ON the column, upper one gap right.
  for (const [tick, lowId, highId] of [
    [6192, 'brahms-op118-no1-444', 'brahms-op118-no1-445'],
    [10032, 'brahms-op118-no1-730', 'brahms-op118-no1-731'],
  ] as const) {
    const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
    const atTick = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
    const low = atTick.find((p) => p.note.id === lowId)!;
    const high = atTick.find((p) => p.note.id === highId)!;
    assert.equal(low.y, high.y, `tick ${tick}: the octave pair coincides after folding`);
    const lin = (p: (typeof atTick)[number]): number => p.note.pitch.octave * 12 + p.note.pitch.pitchClass;
    assert.ok(lin(low) < lin(high), `tick ${tick}: column member is lower source pitch`);
    const { column } = onsetColumns(tick);
    assert.ok(
      Math.abs(low.x - column) < 1e-6,
      `tick ${tick}: lowest-lin ON the column`
    );
    assert.ok(
      Math.abs(high.x - (column + 5.46)) < 1e-6,
      `tick ${tick}: upper one gap right`
    );
    const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === tick))!;
    const lhPair = sys.clasps.filter(
      (c) => c.tick === tick && c.notes.every((n) => n.hand === 'LH')
    );
    assert.equal(lhPair.length, 0, `tick ${tick}: the fold-coincident LH pair carries no bracket`);
  }
});

test('§A literal: the other hand holds the column through a slotted onset', () => {
  // m.7's LH singleton (tick 1200) shares the onset but no component with the
  // RH cluster: slotting one hand never drags the other off the column.
  const { column, xs } = onsetColumns(1200);
  assert.ok(Math.abs(xs.get('brahms-op118-no1-77')! - column) < 1e-9, 'the LH singleton holds the column');
});

// ---------------------------------------------------------------------------
// §B. Bracket-dot consistency — the negative actual-collision fixture
// ---------------------------------------------------------------------------

test('§B fixture: a walled 45° seat falls through to the free lower channel', () => {
  // The m.1/m.19 45° pins live in the dots-golden suite, the corpus-wide
  // positive-air sweep in the nib suite. This fixture proves the fallback:
  // the real m.1 group plus one hostile head whose mask swallows the 45°
  // seat. The solver must refuse the preferred seat (a REAL erasure
  // collision, air −0.75) and seat deterministically on −45° — the free
  // lower channel — at the same 4.75 radius (ring outer 2.8 + hug 1.2 +
  // dot r 0.75; was 5.45 at the old 3.5 outer), with positive true daylight.
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const m1 = layouts.flatMap((l) => l.clasps).find((c) => c.tick === 48)!;
  const inkIdx = m1.durationDots.findIndex((d) => d !== null);
  const ink: ResolvedJankoClaspInk = m1.durationInk[inkIdx];
  const hostile: JankoRhythmNote = {
    id: 'hostile',
    x: 75.37,
    y: 128.13,
    durationTicks: 96,
    startTick: 48,
    hand: 'RH',
  };
  const group: JankoClaspGroupGeometry = { ...m1, notes: [...m1.notes, hostile] };
  const honorHalo = (O_BRAHMS as unknown as { honorHalo?: boolean }).honorHalo;
  const seatOpts = { clusterSpacing: O_BRAHMS.clusterSpacing, honorHalo };
  const walled = claspDotMemberAir(75.37314372217251, 128.13251804253335, group, T_BRAHMS, O_BRAHMS.clusterSpacing, honorHalo);
  assert.ok(walled < 0, `the 45° seat is a real collision (air ${walled.toFixed(2)}pt)`);
  const alt = claspDotCenter(group, ink, BRAHMS_ROUND44_RESERVE_TOKENS, seatOpts);
  const angle = (Math.atan2(-(alt.y - ink.centerY), alt.x - group.claspX) * 180) / Math.PI;
  assert.ok(Math.abs(angle - -45) < 1e-9, 'the fallback seats on −45° (lower channel)');
  assert.ok(
    Math.abs(Math.hypot(alt.x - group.claspX, alt.y - ink.centerY) - 4.75) < 1e-9,
    'at the same 4.75 radius as the preferred seat'
  );
  const air = claspDotMemberAir(alt.x, alt.y, group, T_BRAHMS, O_BRAHMS.clusterSpacing, honorHalo);
  assert.ok(air > 0, `positive true daylight on the fallback (air ${air.toFixed(3)}pt)`);
  const again = claspDotCenter(group, ink, BRAHMS_ROUND44_RESERVE_TOKENS, seatOpts);
  assert.deepEqual(again, alt, 'the fallback is deterministic');
});

// ---------------------------------------------------------------------------
// §C. Ottava glyph treatment — scale/ink/advance + spanner attachment
// ---------------------------------------------------------------------------

test('§C wiring: the label vests italic serif at 7.5pt in rest ink (#1A1A1A)', () => {
  assert.equal(OTTAVA_LABEL_FONT_SIZE, 7.5, 'label size');
  assert.equal(OTTAVA_GLYPH_INK, '#1A1A1A', 'label ink');
  assert.equal(OTTAVA_GLYPH_INK, REST_INK, 'one shared ink constant');
  assert.deepEqual(
    OTTAVA_LABELS,
    { up10: '↑10', down10: '↓10', up20: '↑20', down20: '↓20' },
    'arrow plus dozenal span per kind'
  );
  assert.equal(kindForShift(12), 'down10', 'shift +12 sounds down an octave');
  assert.equal(kindForShift(-12), 'up10', 'shift −12 sounds up an octave');
  assert.equal(kindForShift(24), 'down20', 'shift +24 sounds down two octaves');
  assert.equal(kindForShift(-24), 'up20', 'shift −24 sounds up two octaves');
  assert.deepEqual(
    DUODECIMAL_SPAN_SEMITONES,
    { b: 11, '10': 12, '14': 16, '20': 24 },
    'zero-based dozenal spans'
  );
  assert.equal(duodecimalSpanSemitones('b'), 11);
  assert.equal(duodecimalSpanSemitones('10'), 12);
  assert.equal(duodecimalSpanSemitones('14'), 16);
  assert.equal(duodecimalSpanSemitones('20'), 24);
  for (const kind of ['up10', 'down10', 'up20', 'down20'] as const) {
    assert.equal(ottavaGlyphAdvance(kind), OTTAVA_LABEL_ADVANCE, `${kind}: nominal advance`);
    assert.deepEqual(
      [...ottavaGlyphBbox(kind)],
      [0, -OTTAVA_LABEL_ASCENT, OTTAVA_LABEL_ADVANCE, OTTAVA_LABEL_DESCENT],
      `${kind}: nominal bbox`
    );
  }
  assert.equal(ottavaGlyphAdvance('down10'), 10.5, 'down10 advance pinned');
});

test('§C render: the painted label is italic serif text in rest ink', () => {
  const svg = renderOttavaBracket(
    {
      kind: 'down10',
      shift: 12,
      x0: 200,
      x1: 260,
      lineY: 400,
      dashX0: 223.51,
      dashX1: 235.11,
      hookDirection: -1,
      hookLength: 4,
      noteIds: ['synthetic'],
    },
    T_BRAHMS
  );
  const glyph = svg.match(/<text class="janko-ottava-glyph"[^>]*>([^<]*)<\/text>/)!;
  assert.equal(glyph[1], '↓10', 'the label reads arrow plus dozenal span');
  assert.ok(svg.includes('font-style="italic"'), 'the label sets italic');
  assert.ok(svg.includes('font-size="7.5"'), 'the label sets 7.5pt');
  assert.ok(svg.includes('fill="#1A1A1A"'), 'the label paints in rest ink');
  assert.ok(svg.includes('data-ottava-kind="down10"'), 'the kind rides the node');
  // Line and hook keep the existing thin dark treatment (no redesign).
  assert.ok(svg.includes('class="janko-ottava-line"'), 'the dashed line renders');
  assert.ok(svg.includes('stroke="#111111"'), 'line/hook keep #111111');
  assert.ok(svg.includes('stroke-width="0.35"'), 'line/hook keep 0.35pt');
});

test('§C window: a real spanner connects one gap past the label edge', () => {
  // The dashed line must start exactly one dash-gap past the RENDERED
  // label's right edge — the connection reads the nominal advance. Pinned
  // on both placement branches: the roomy branch (note 182, label fully
  // left of the head, dash at the head's left edge) and the left-margin
  // branch (note 47, label tucked, dash past the head — the label sits
  // below the staff, so the horizontal overlap is clean).
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const brackets = layouts.flatMap((l) => l.ottavaBrackets);
  assert.equal(brackets.length, 9, 'nine folded runs on the canonical surface (the 937/938 pair splits at 4-per)');
  const gap = T_BRAHMS.ottavaDashGap ?? 2.0;
  const glyphRightEdge = (b: (typeof brackets)[number]): number => {
    const svg = renderOttavaBracket(b, T_BRAHMS);
    const glyph = svg.match(/<text class="janko-ottava-glyph"[^>]*x="([\d.]+)"[^>]*>/)!;
    return Number(glyph[1]) + ottavaGlyphAdvance(b.kind);
  };
  // Roomy branch: note 182 (sys3).
  const sys3 = layouts[3];
  const roomy = sys3.ottavaBrackets.find((x) => x.noteIds.includes('brahms-op118-no1-182'))!;
  const firstRoomy = sys3.notes.find((p) => p.note.id === 'brahms-op118-no1-182')!;
  assert.ok(
    Math.abs(roomy.dashX0 - (firstRoomy.x - T_BRAHMS.noteheadRadius)) < 1e-9,
    'roomy: dash starts at the first head’s left edge'
  );
  const roomyEdge = glyphRightEdge(roomy);
  assert.ok(
    Math.abs(roomyEdge + gap - roomy.dashX0) < 0.011,
    `roomy: label right edge + one gap meets the dash (edge ${roomyEdge.toFixed(2)}, dash ${roomy.dashX0})`
  );
  // Margin branch: note 47 (sys1).
  const sys1 = layouts[1];
  const margin = sys1.ottavaBrackets.find((x) => x.noteIds.includes('brahms-op118-no1-47'))!;
  const firstMargin = sys1.notes.find((p) => p.note.id === 'brahms-op118-no1-47')!;
  assert.ok(
    margin.dashX0 > firstMargin.x - T_BRAHMS.noteheadRadius,
    'margin: dash starts past the head’s left edge (label tucked)'
  );
  const marginEdge = glyphRightEdge(margin);
  assert.ok(
    Math.abs(marginEdge + gap - margin.dashX0) < 0.011,
    `margin: label right edge + one gap meets the dash (edge ${marginEdge.toFixed(2)}, dash ${margin.dashX0})`
  );
});

// ---------------------------------------------------------------------------
// §D. Rest placement — the local-measure rule
// ---------------------------------------------------------------------------

/** Absolute measure identity (mirrors the rule: upbeat = 0, full from the anacrusis). */
function absMeasure(tick: number): number {
  return tick < 48 ? 0 : 1 + Math.floor((tick - 48) / 192);
}

/** The seat + query level of one Brahms rest, with its system geometry. */
function restSeat(tick: number, hand: 'RH' | 'LH'): { seatY: number; geoIndex: number } {
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  for (let i = 0; i < layouts.length; i++) {
    const r = layouts[i].rests.find((x) => x.tick === tick && x.hand === hand);
    if (r) return { seatY: r.y, geoIndex: i };
  }
  throw new Error(`rest ${tick} ${hand} not written`);
}

/** Lowest source-pitch level y of one hand's onset on the canonical Brahms. */
function onsetLevel(tick: number, hand: 'RH' | 'LH'): number {
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const ps = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick && p.note.hand === hand);
  assert.ok(ps.length > 0, `onset ${tick} ${hand} sounds`);
  const lin = (p: (typeof ps)[number]): number => p.note.pitch.octave * 12 + p.note.pitch.pitchClass;
  return [...ps].sort((a, b) => lin(a) - lin(b))[0].y;
}

test('§D rule: m.2 LH seats on the preceding lower E3 — never interpolated', () => {
  // The operator-confirmed case: the preceding E3/E4 onset offers its LOWER
  // level (E3, octave 3); the next measure's A1 never enters the query. Base
  // interpolated the seat to 206.99 (+15 toward the future); the rule seats
  // exactly on E3.
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const e3 = layouts.flatMap((l) => l.notes).find((p) => p.note.id === 'brahms-op118-no1-16')!;
  const e4 = layouts.flatMap((l) => l.notes).find((p) => p.note.id === 'brahms-op118-no1-18')!;
  assert.equal(e3.note.pitch.octave, 3, 'the lower head is octave 3 (E3)');
  assert.equal(e4.note.pitch.octave, 4, 'the upper head is octave 4 (E4)');
  assert.ok(e3.y !== e4.y, 'the cluster offers two distinct levels');
  const { seatY } = restSeat(384, 'LH');
  assert.equal(seatY, e3.y, 'the seat IS the lower E3 level, bit-exact');
  assert.ok(Math.abs(seatY - 206.98624999999998) > 1, 'not the base crossbar interpolation (206.99)');
  // Only the release side is in-measure: the resume (432, m.3) is excluded.
  assert.equal(absMeasure(384), 2, 'the rest opens in m.2');
  assert.equal(absMeasure(240), 2, 'the release onset is in m.2');
  assert.equal(absMeasure(432), 3, 'the resume onset is out (m.3)');
});

test('§D rule: an exact tick tie prefers the preceding onset — and a foreign-voice release side offers no query', () => {
  // Rest 360 RH sits 24 ticks from each neighbour. Round 49 §1 renders the
  // written chains, and the release onset's only displayed-RH head (note 22,
  // C6) is a foreign-voice continuation (source LH): under the §3 editorial
  // query that side offers NO query, so the exact tie never arises here — the
  // seat falls through to the resume side's genuine RH level.
  assert.equal(360 - 336, 24, 'release distance');
  assert.equal(384 - 360, 24, 'resume distance: an exact tie');
  const { seatY, geoIndex } = restSeat(360, 'RH');
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const geo = layouts[geoIndex].geometry;
  const after = onsetLevel(384, 'RH');
  assert.equal(seatY, nearestLatticeRow(after, geo, T_BRAHMS, O_BRAHMS), 'the seat follows the resume side (the release side is foreign-voice)');
  // The tie-break preference itself, on a clean synthetic specimen: two
  // genuine same-hand onsets exactly 96 ticks from a 96-tick (half) rest,
  // different levels — the seat follows the release side.
  const mk = (id: string, pc: number, oct: number, tick: number, dur: number): QuantizedNote => ({
    id,
    pitch: { pitchClass: pc, octave: oct },
    startTick: tick,
    durationTicks: dur,
    hand: 'RH',
  });
  const fixture: QuantizedGridScore = {
    id: 'synthetic-tie-break',
    title: 'synthetic',
    composer: 'synthetic',
    ticksPerBeat: 48,
    totalTicks: 5 * 192,
    timeSignatures: [],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [mk('a', 0, 4, 48, 96), mk('b', 7, 5, 240, 48)],
  };
  const flayouts = layoutJankoScore(fixture, O_BRAHMS, T_BRAHMS);
  const frest = flayouts.flatMap((l) => l.rests).find((r) => r.tick === 144 && r.hand === 'RH');
  assert.ok(frest, 'the synthetic rest is written (the 96-tick gap is a half value)');
  const fa = flayouts.flatMap((l) => l.notes).find((p) => p.note.id === 'a')!;
  const fb = flayouts.flatMap((l) => l.notes).find((p) => p.note.id === 'b')!;
  assert.ok(Math.abs(fa.y - fb.y) > 1, 'the two sides offer different levels');
  assert.ok(Math.abs(frest.y - fa.y) < 1e-9, 'the exact tie seats on the release side');
});

test('§D rule: a blocked release row falls through to the in-measure resume level', () => {
  // Rest 4200 LH: release 24 ticks back, resume 48 ahead — both in m.22.
  // The release side is nearer, so the phrase row IS the release level —
  // but at 4-per packing the release head itself (id 299, 7.8pt left of the
  // rest column) blocks that row, and the voice-row solver falls through to
  // the resume level. Still in-measure, still same-hand: the documented
  // fallback, not an interpolation. (Every release-nearer corpus rest falls
  // through the same way at this packing — 4200/4968/8040/8808 LH — and no
  // resume-nearer both-sides specimen exists; the nearer-side preference
  // itself is proven by the tie-break pin above and the free-release m.2
  // seat.)
  assert.equal(absMeasure(4200), 22, 'the rest opens in m.22');
  assert.equal(absMeasure(4176), 22, 'release in-measure');
  assert.equal(absMeasure(4248), 22, 'resume in-measure');
  assert.ok(4200 - 4176 < 4248 - 4200, 'the release side is nearer');
  const { seatY, geoIndex } = restSeat(4200, 'LH');
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const geo = layouts[geoIndex].geometry;
  const releaseRow = nearestLatticeRow(onsetLevel(4176, 'LH'), geo, T_BRAHMS, O_BRAHMS);
  const resumeRow = nearestLatticeRow(onsetLevel(4248, 'LH'), geo, T_BRAHMS, O_BRAHMS);
  assert.ok(Math.abs(releaseRow - resumeRow) > 1, 'the two sides offer different rows');
  assert.equal(seatY, resumeRow, 'the seat falls through to the resume row');
  // The block is real: the release head crowds the rest column on its row.
  const head = layouts.flatMap((l) => l.notes).find((p) => p.note.id === 'brahms-op118-no1-299')!;
  const rest = layouts.flatMap((l) => l.rests).find((r) => r.tick === 4200 && r.hand === 'LH')!;
  assert.ok(
    Math.abs(head.x - rest.x) < 8.5,
    `the release head crowds the rest column (${Math.abs(head.x - rest.x).toFixed(2)}pt)`
  );
});

test('§D rule: one side present wins — resume-only rests follow the resume', () => {
  // Three rests whose release onset falls in the previous measure: the
  // resume side alone is in-measure, so it alone decides. (Resume-nearer
  // with BOTH sides present has no corpus specimen — every both-sides rest
  // is a tie or release-nearer; the tie→preceding and nearer-release pins
  // above cover the expressed branches.)
  // Round 48: the former third case (12528 LH) was the m. 66 eighth rest the
  // source evidence now **withholds** (the source's own leftHandUpper pair
  // sounds through 12528–12552), so a resume-only seat no longer exists there;
  // the withheld fact is pinned in test/janko-round48.test.ts instead.
  for (const [tick, hand, resume] of [
    [5616, 'RH', 5640],
    [9456, 'RH', 9480],
  ] as const) {
    const { seatY, geoIndex } = restSeat(tick, hand);
    const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
    const geo = layouts[geoIndex].geometry;
    assert.equal(
      seatY,
      nearestLatticeRow(onsetLevel(resume, hand), geo, T_BRAHMS, O_BRAHMS),
      `rest ${tick} ${hand} follows its resume onset (${resume})`
    );
  }
});

test('§D safety: every corpus seat stands on its lattice row, audits silent', () => {
  for (const [label, score, o, t] of [
    ['Brahms', BRAHMS, O_BRAHMS, T_BRAHMS],
    ['Bach', BACH, O_BACH, T_BACH],
  ] as const) {
    const layouts = layoutJankoScore(score, o, t);
    let seats = 0;
    for (const l of layouts) {
      for (const r of l.rests) {
        seats++;
        assert.equal(
          nearestLatticeRow(r.y, l.geometry, t, o),
          r.y,
          `${label} rest ${r.tick} ${r.hand}: the seat is a lattice row`
        );
      }
    }
    assert.ok(seats > 0, `${label} writes rests (${seats})`);
    const report = lintJankoScore(score, o, t);
    const restCodes = report.diagnostics.filter((d) =>
      ['beam-rest-clearance', 'rest-clearance', 'rest-unwritable', 'rest-seat'].includes(d.code)
    );
    assert.deepEqual(
      restCodes.map((d) => `${d.code}@${d.system}`),
      [],
      `${label}: the rest audits stay silent`
    );
  }
});

// ---------------------------------------------------------------------------
// §D. Rest placement — synthetic fallback measures (no corpus specimen)
// ---------------------------------------------------------------------------

/**
 * A synthetic whole-bar silence: LH sustains over the m.1 barline, releasing
 * exactly on the m.2 downbeat (tick 240), and resumes on the m.3 downbeat
 * (tick 432). The 192-tick silence states m.2 exactly — the hand's only
 * empty measure — so BOTH context onsets fall outside the rest's measure and
 * the empty-measure fallback must decide. (Non-whole rests always keep one
 * side in-measure by the active-measure guard; the corpus writes no
 * whole-bar rests, so this configuration is synthetic-only.)
 */
function wholeBarScore(): QuantizedGridScore {
  const a: QuantizedNote = {
    id: 'syn-a',
    pitch: { octave: 3, pitchClass: 4 },
    startTick: 48,
    durationTicks: 192,
    hand: 'LH',
  };
  const b: QuantizedNote = {
    id: 'syn-b',
    pitch: { octave: 4, pitchClass: 0 },
    startTick: 432,
    durationTicks: 24,
    hand: 'LH',
  };
  return {
    id: 'synthetic-whole-bar',
    title: 'synthetic',
    composer: 'synthetic',
    ticksPerBeat: 48,
    totalTicks: 624,
    timeSignatures: [],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [a, b],
  };
}

function positioned(
  note: QuantizedNote,
  x: number,
  y: number
): {
  note: QuantizedNote;
  x: number;
  y: number;
  coord: { octave: number; pitchClass: number };
  rhythm: { id: string; x: number; y: number; durationTicks: number; startTick: number; hand: 'RH' | 'LH' };
} {
  return {
    note,
    x,
    y,
    coord: { octave: note.pitch.octave, pitchClass: note.pitch.pitchClass },
    rhythm: { id: note.id, x, y, durationTicks: note.durationTicks, startTick: note.startTick, hand: note.hand },
  };
}

test('§D fallback: an empty measure seats from the preceding level, not the future', () => {
  const score = wholeBarScore();
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const geo = layouts[0].geometry;
  // Preceding level y=300, resume level y=100: far apart, so the pin proves
  // which one the seat follows through the slab mapping.
  const layer = computeJankoRestLayer(
    score,
    geo,
    0,
    O_BRAHMS,
    T_BRAHMS,
    [positioned(score.notes[0], 100, 300), positioned(score.notes[1], 400, 100)] as never
  );
  assert.equal(layer.rests.length, 1, 'the whole-bar silence is written');
  assert.equal(layer.unwritten.length, 0, 'nothing refused');
  const rest = layer.rests[0];
  assert.equal(rest.tick, 240, 'opens on the m.2 downbeat');
  assert.equal(rest.value, 'whole', 'states the bar');
  // Bar rests are measure furniture: the seat is the drawn rule nearest the
  // PRECEDING level's row (300) — never the resume level (100), never an
  // average toward the future measure.
  const precedingRow = nearestLatticeRow(300, geo, T_BRAHMS, O_BRAHMS);
  assert.equal(rest.y, nearestDrawnStaffRule(precedingRow, geo, O_BRAHMS, T_BRAHMS, rest.x), 'seat follows the preceding level');
  const resumeRow = nearestLatticeRow(100, geo, T_BRAHMS, O_BRAHMS);
  assert.ok(
    rest.y !== nearestDrawnStaffRule(resumeRow, geo, O_BRAHMS, T_BRAHMS, rest.x),
    'not the resume level'
  );
});

test('§D fallback: a release onset with no positioned note seats the voice equator', () => {
  // The defensive no-history path: the release onset exists in the score
  // (so the silence is written) but carries no positioned same-hand note
  // (the end state of a fully merged-away onset). The query is null, so the
  // hand's canonical voice equator (LH octave 3) decides through the slab
  // mapping — a drawn rule, never a crash or a 0 default.
  const score = wholeBarScore();
  const layouts = layoutJankoScore(BRAHMS, O_BRAHMS, T_BRAHMS);
  const geo = layouts[0].geometry;
  const layer = computeJankoRestLayer(score, geo, 0, O_BRAHMS, T_BRAHMS, [
    positioned(score.notes[1], 400, 100),
  ] as never);
  assert.equal(layer.rests.length, 1, 'the whole-bar silence is still written');
  const rest = layer.rests[0];
  const equator = geo.middleCY + getEquatorYForOctave(3, 'LH', T_BRAHMS, O_BRAHMS);
  const equatorRow = nearestLatticeRow(equator, geo, T_BRAHMS, O_BRAHMS);
  assert.equal(
    rest.y,
    nearestDrawnStaffRule(equatorRow, geo, O_BRAHMS, T_BRAHMS, rest.x),
    'seat follows the LH octave-3 equator'
  );
});
