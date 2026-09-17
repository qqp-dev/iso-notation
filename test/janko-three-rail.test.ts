/**
 * Fixed three-rail note placement (ticket §1) — solver units + literals.
 *
 * `assignThreeRails` seats one bracket group's members on {-1, 0, +1} about
 * the true rhythmic column at the style's rail step (5.46pt at 'tight').
 * These tests pin the precedence with hand-computed mask/ink boxes
 * (tight wx 2.53 / hy 3.46; stems at head-x, 16pt long, 0.9 stroke):
 *
 *  - ordinary pairs alternate lower LEFT / higher RIGHT; chains L/R/L;
 *    true cliques take the only feasible LEFT/CENTER/RIGHT;
 *  - duration ALONE never displaces: unobstructed members hold CENTER;
 *  - one obstructed internal exception goes RIGHT (outranking alternation);
 *  - clear-path outward carriers and clear top pairs stay undisplaced;
 *  - two genuine obstructions seat LONGER LEFT / SHORTER RIGHT (ticks);
 *  - infeasible groups diagnose honestly, never pretend to fit.
 *
 * Corpus literals (m.1/m.3 duration priority) close the suite; the m.7/m.8/
 * m.9/m.33 ordinary literals live in the shared-rules §A suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assignThreeRails,
  type ThreeRail,
  type ThreeRailFixed,
  type ThreeRailInk,
  type ThreeRailMember,
} from '../src/render/janko/three-rail';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1';

const G = 5.46;
const WX = 2.53;
const HY = 3.46;
const COL = 100;

/** A stem-only ink box at CENTER: stem at head-x, 16pt in `dir`, 0.9 stroke. */
function stemInk(y: number, dir: -1 | 1, halfStroke = 0.45): ThreeRailInk {
  const lo = dir < 0 ? y - 16 : y + 4.8;
  const hi = dir < 0 ? y - 4.8 : y + 16;
  return {
    stem: { x0: COL - halfStroke, y0: Math.min(lo, hi), x1: COL + halfStroke, y1: Math.max(lo, hi) },
    flags: [],
    dots: [],
  };
}

let seq = 0;
function member(
  lin: number,
  y: number,
  durationTicks: number,
  carriedTicks: number,
  stemDir: -1 | 1,
  ink: ThreeRailInk | null = null,
  wx: number = WX,
  hy: number = HY
): ThreeRailMember {
  return {
    id: `m${seq++}`,
    sourceLin: lin,
    y,
    wx,
    hy,
    durationTicks,
    carriedTicks,
    stemDir,
    ink,
  };
}

const railsOf = (members: readonly ThreeRailMember[], rails: Map<string, ThreeRail>): ThreeRail[] =>
  members.map((m) => rails.get(m.id)!);

// ---------------------------------------------------------------------------
// 1. Ordinary seating: pairs, chains, cliques, singletons
// ---------------------------------------------------------------------------

test('Ordinary conflicting pair: lower LEFT / higher RIGHT', () => {
  const lo = member(40, 100, 48, 48, -1);
  const hi = member(52, 100, 48, 48, -1);
  const { rails, diagnostics } = assignThreeRails([lo, hi], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([lo, hi], rails), [-1, 1]);
});

test('Ordinary three-chain alternates LEFT/RIGHT/LEFT by source pitch', () => {
  // dy 5.5 links neighbours (5.5 < 6.92) but not the ends (11.0 > 6.92).
  const a = member(40, 100, 48, 48, -1);
  const b = member(50, 105.5, 48, 48, -1);
  const c = member(60, 111, 48, 48, -1);
  const { rails, diagnostics } = assignThreeRails([a, b, c], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([a, b, c], rails), [-1, 1, -1]);
});

test('True three-clique takes the only feasible LEFT/CENTER/RIGHT', () => {
  // All three coincide: alternation would double-book a side rail, so the
  // solver seats the honest L/C/R pattern instead of pretending.
  const a = member(40, 100, 48, 48, -1);
  const b = member(50, 100, 48, 48, -1);
  const c = member(60, 100, 48, 48, -1);
  const { rails, diagnostics } = assignThreeRails([a, b, c], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([a, b, c], rails), [-1, 0, 1]);
});

test('Nonconflicting members hold CENTER', () => {
  const a = member(40, 100, 48, 48, -1);
  const b = member(50, 120, 48, 48, -1);
  const c = member(60, 140, 48, 48, -1);
  const { rails, diagnostics } = assignThreeRails([a, b, c], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([a, b, c], rails), [0, 0, 0]);
});

// ---------------------------------------------------------------------------
// 2. Duration precedence: obstruction, not duration alone
// ---------------------------------------------------------------------------

test('m1-shape: one obstructed internal exception goes RIGHT, commons CENTER', () => {
  // Commons at y 147 / 117 (dy 30: separate singletons, CENTER). The middle
  // exception's up-stem spans y [116, 127.2] at head-x: it overlaps the
  // upper common's mask (y [113.54, 120.46], x ±2.53) — genuinely
  // obstructed — so it takes RIGHT, outranking ordinary alternation.
  const low = member(58, 147, 144, 144, -1);
  const high = member(70, 117, 144, 144, -1);
  const exc = member(64, 132, 192, 144, -1, stemInk(132, -1));
  const { rails, diagnostics } = assignThreeRails([low, high, exc], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([low, high, exc], rails), [0, 0, 1]);
});

test('Different duration alone never displaces: clear exception holds CENTER', () => {
  // Same durations, but the commons stand 15pt+ off: the exception's stem
  // [116, 127.2] clears both masks ([143.54, 150.46] and [96.54, 103.46]),
  // and its own mask clears at CENTER — so nothing moves.
  const low = member(58, 147, 144, 144, -1);
  const high = member(70, 100, 144, 144, -1);
  const exc = member(64, 132, 192, 144, -1, stemInk(132, -1));
  const { rails, diagnostics } = assignThreeRails([low, high, exc], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([low, high, exc], rails), [0, 0, 0]);
});

test('m9-shape: the clear top pair seats lower CENTER / higher RIGHT', () => {
  // Two 192-tick exceptions above a 144 common. Both stems run upward into
  // open page (nothing seated above); the lower takes CENTER, the higher
  // staggers RIGHT off it. NOT two obstructed internal exceptions: neither
  // is forced RIGHT by obstruction, and both paths stay upward.
  const common = member(47, 142, 144, 144, -1);
  const lo = member(53, 127, 192, 144, -1, stemInk(127, -1));
  const hi = member(55, 122, 192, 144, -1, stemInk(122, -1));
  const { rails, diagnostics } = assignThreeRails([common, lo, hi], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([common, lo, hi], rails), [0, 0, 1]);
});

test('Outward carriers are exempt: clear-path top/bottom heads hold CENTER', () => {
  // Upgoing highest (stem up, nothing above) and down-going lowest (stem
  // down, nothing below) with clear paths: no duration displacement.
  const mid = member(50, 130, 144, 144, -1);
  const top = member(70, 110, 192, 144, -1, stemInk(110, -1));
  const bot = member(40, 150, 96, 144, 1, stemInk(150, 1));
  const { rails, diagnostics } = assignThreeRails([mid, top, bot], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([mid, top, bot], rails), [0, 0, 0]);
});

test('m20-mirror: a down-stem obstructed internal exception goes RIGHT', () => {
  // The downward mirror of the m1 shape (ticket §1 direction example): the
  // middle exception's down-stem spans y [136.8, 148] and overlaps the lower
  // common's mask ([143.54, 150.46]) — obstructed — so RIGHT, commons stay.
  const high = member(58, 117, 144, 144, 1);
  const low = member(70, 147, 144, 144, 1);
  const exc = member(64, 132, 192, 144, 1, stemInk(132, 1));
  const { rails, diagnostics } = assignThreeRails([high, low, exc], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([high, low, exc], rails), [0, 0, 1]);
});

test('Two genuine obstructions: LONGER duration LEFT / SHORTER RIGHT', () => {
  // Both exception stems (up from y 128 → [112, 123.2] and y 124 → [108,
  // 119.2]) overlap the upper common's mask (y [108.54, 115.46]): genuinely
  // obstructed — so exact ticks decide, longer LEFT, shorter RIGHT.
  // Duration means ticks, not stem length.
  const loCommon = member(40, 150, 48, 48, -1);
  const hiCommon = member(70, 112, 48, 48, -1);
  const longer = member(55, 128, 192, 48, -1, stemInk(128, -1));
  const shorter = member(60, 124, 96, 48, -1, stemInk(124, -1));
  const { rails, diagnostics } = assignThreeRails([loCommon, hiCommon, longer, shorter], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([loCommon, hiCommon, longer, shorter], rails), [0, 0, -1, 1]);
});

test('Equal-duration tie: source pitch orders lower LEFT / higher RIGHT', () => {
  const loCommon = member(40, 150, 48, 48, -1);
  const hiCommon = member(70, 112, 48, 48, -1);
  const lo = member(55, 128, 96, 48, -1, stemInk(128, -1));
  const hi = member(60, 124, 96, 48, -1, stemInk(124, -1));
  const { rails, diagnostics } = assignThreeRails([loCommon, hiCommon, lo, hi], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([loCommon, hiCommon, lo, hi], rails), [0, 0, -1, 1]);
});

// ---------------------------------------------------------------------------
// 3. Honest infeasibility, order-independence, scaling, obstacles, halos
// ---------------------------------------------------------------------------

test('Infeasible groups diagnose: a four-clique cannot fit three rails', () => {
  const ms = [40, 50, 60, 70].map((lin) => member(lin, 100, 48, 48, -1));
  const { diagnostics } = assignThreeRails(ms, COL, G);
  assert.equal(diagnostics.length, 1, 'exactly one honest diagnostic');
  assert.equal(diagnostics[0].reason, 'ordinary-clique-infeasible');
  assert.deepEqual(diagnostics[0].memberIds, ms.map((m) => m.id));
});

test('Infeasible exception: RIGHT occupied diagnoses instead of colliding', () => {
  // The obstructed exception wants RIGHT, but a fixed same-onset obstacle
  // (a solved non-member head) already stands there: honest diagnostic.
  const low = member(58, 147, 144, 144, -1);
  const high = member(70, 117, 144, 144, -1);
  const exc = member(64, 132, 192, 144, -1, stemInk(132, -1));
  const fixed: ThreeRailFixed[] = [{ id: 'fixed', x: COL + G, y: 132, wx: WX, hy: HY }];
  const { rails, diagnostics } = assignThreeRails([low, high, exc], COL, G, fixed);
  assert.equal(rails.has(exc.id), false, 'the exception is left unseated, never collided');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].reason, 'exception-rail-occupied');
});

test('Seating is order-independent: shuffled members seat identically', () => {
  const LINS = [58, 70, 64];
  const mk = (): Map<number, ThreeRailMember> =>
    new Map(
      [
        member(58, 147, 144, 144, -1),
        member(70, 117, 144, 144, -1),
        member(64, 132, 192, 144, -1, stemInk(132, -1)),
      ].map((m) => [m.sourceLin, m] as const)
    );
  const key = (ms: Map<number, ThreeRailMember>, rails: Map<string, ThreeRail>): string =>
    LINS.map((lin) => `${lin}:${rails.get(ms.get(lin)!.id)}`).join(',');
  const base = mk();
  const expected = key(base, assignThreeRails([...base.values()], COL, G).rails);
  // Every permutation of three seats the same rails by source pitch.
  const perms: number[][] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  for (const perm of perms) {
    const ms = mk();
    const ordered = perm.map((i) => ms.get(LINS[i])!);
    const { rails, diagnostics } = assignThreeRails(ordered, COL, G);
    assert.deepEqual(diagnostics, [], `perm ${perm}: no diagnostics`);
    assert.equal(key(ms, rails), expected, `perm ${perm}: identical rails`);
  }
});

test('Rails are gap-independent indices: snug seats what tight seats', () => {
  const mk = (): ThreeRailMember[] => [
    member(58, 147, 144, 144, -1),
    member(70, 117, 144, 144, -1),
    member(64, 132, 192, 144, -1, stemInk(132, -1)),
  ];
  const tight = mk();
  const snug = mk();
  const rTight = assignThreeRails(tight, COL, 5.46);
  const rSnug = assignThreeRails(snug, COL, 5.86);
  assert.deepEqual(rSnug.diagnostics, []);
  assert.deepEqual(
    railsOf(snug, rSnug.rails),
    railsOf(tight, rTight.rails),
    'the rail pattern is a style-scaled lattice, not a per-style decision'
  );
});

test('Members seat around fixed obstacles, never through them', () => {
  // A singleton common whose CENTER is taken by a solved non-member staggers
  // exactly one rail off it and stays collision-free.
  const m = member(50, 100, 48, 48, -1);
  const fixed: ThreeRailFixed[] = [{ id: 'fixed', x: COL, y: 100, wx: WX, hy: HY }];
  const { rails, diagnostics } = assignThreeRails([m], COL, G, fixed);
  assert.deepEqual(diagnostics, []);
  assert.equal(Math.abs(rails.get(m.id)!), 1, 'one rail off the obstacle');
});

test('Halo-grown masks seat when the rails clear them', () => {
  // A mildly grown pair (wx 4.0: 2·4.0 = 8.0 < 2G = 10.92) still alternates;
  // the solver reasons from displayed extents, whatever grows them.
  const lo = member(40, 100, 48, 48, -1, null, 4.0, HY);
  const hi = member(52, 100, 48, 48, -1, null, 4.0, HY);
  const { rails, diagnostics } = assignThreeRails([lo, hi], COL, G);
  assert.deepEqual(diagnostics, []);
  assert.deepEqual(railsOf([lo, hi], rails), [-1, 1]);
});
