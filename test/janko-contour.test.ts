/**
 * Pitch-contour round (Round 23): thread, ticks, strip.
 * =====================================================
 *
 * Pins the three honest contour layers over the twin whole-tone rows:
 *
 * - melody sequences (top pitch per attack, global departure, pen lifts),
 * - the woven true-pitch thread (anchor, vertices, runs),
 * - the head-adjacent departure ticks (legend, row-aware sides, mirror rule),
 * - the absolute-pitch strip (fixed global scale, placement, curves),
 * - paint integration (layer order, crop extents, options-off neutrality),
 * - the linter verdict (every paradigm clean on the full score).
 *
 * Corpus pins use the Bach Goldberg Var. 1 benchmark; the mirror rule (which
 * never fires on the corpus) is pinned by unit geometry instead.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { bachBeforeM5 } from './support/bach-before-m5';
import {
  computeCropExtents,
  computePageGeometry,
  layoutJankoScore,
  renderJankoCrop,
  renderSystem,
} from '../src/render/janko/engine';
import {
  CONTOUR_C4_LIN,
  CONTOUR_LEAP_SEMITONES,
  CONTOUR_MIDDLE_C_LIN,
  ContourAttack,
  buildContourStrip,
  buildContourThreads,
  buildContourTicks,
  buildSystemContour,
  contourGlobalSequence,
  contourPenLifts,
  contourPieceRange,
  contourSilence,
  contourStripY,
  contourSystemAttacks,
  contourSystemInkBottom,
  contourSystemInkBounds,
  contourThreadHands,
  contourThreadY,
  contourTickKind,
  linearPitch,
  placeContourTick,
  renderContourStrip,
} from '../src/render/janko/elements/contour';
import { JANKO_LINT_CHECKS, lintJankoScore } from '../src/render/janko/linter';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';

const SCORE = buildBachGoldbergVar1Score();
const O = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const LAYOUTS = layoutJankoScore(SCORE, O, T);
const GEO = computePageGeometry(O, T);

// ---------------------------------------------------------------------------
// Sequences
// ---------------------------------------------------------------------------

test('linearPitch addresses middle C the note at 48, the anchor with it', () => {
  assert.equal(linearPitch({ pitchClass: 0, octave: 4 }), 48);
  assert.equal(CONTOUR_C4_LIN, 48);
  assert.equal(CONTOUR_MIDDLE_C_LIN, 48);
  assert.equal(CONTOUR_LEAP_SEMITONES, 3);
});

test('Global sequences: one attack per tick per hand, top pitch, time order', () => {
  const before = bachBeforeM5(SCORE);
  const oldRh = contourGlobalSequence(before, 'RH');
  const oldLh = contourGlobalSequence(before, 'LH');
  assert.equal(oldRh.length, 303, 'historical RH corpus count');
  assert.equal(oldLh.length, 248, 'historical LH corpus count');
  assert.equal(oldRh.length + oldLh.length, 551, 'historical attack total');

  // Operator-judged GOLD revision: exactly these two distinct m. 5 attacks move
  // from RH to LH; MIDI track assignment does not establish performing hand.
  const moved = [
    { id: 'bach-var1-70', tick: 576, lin: 35 }, // B2
    { id: 'bach-var1-71', tick: 588, lin: 33 }, // A2
  ];
  for (const { id, tick, lin } of moved) {
    const oldNote = before.notes.find(n => n.id === id)!;
    const note = SCORE.notes.find(n => n.id === id)!;
    assert.equal(oldNote.hand, 'RH', `${id} historically RH`);
    assert.equal(note.hand, 'LH', `${id} now LH`);
    assert.equal(note.startTick, tick, `${id} onset`);
    assert.equal(linearPitch(note.pitch), lin, `${id} pitch`);
    assert.equal(note.durationTicks, 12, `${id} duration`);
    assert.deepEqual({ ...note, hand: 'RH' }, oldNote, `${id} changes hand only`);
    assert.deepEqual(oldRh.find(a => a.tick === tick), { tick, lin, durationTicks: 12 });
    assert.ok(!oldLh.some(a => a.tick === tick), `${id} adds a new LH onset`);
  }
  const movedIds = new Set(moved.map(n => n.id));
  assert.deepEqual(SCORE.notes.filter(n => !movedIds.has(n.id)),
    before.notes.filter(n => !movedIds.has(n.id)), 'every other note and hand stays fixed');

  const rh = contourGlobalSequence(SCORE, 'RH');
  const lh = contourGlobalSequence(SCORE, 'LH');
  const movedTicks = new Set(moved.map(n => n.tick));
  assert.deepEqual(rh, oldRh.filter(a => !movedTicks.has(a.tick)), 'all other RH attacks unchanged');
  assert.deepEqual(lh, [...oldLh, ...oldRh.filter(a => movedTicks.has(a.tick))].sort((a, b) => a.tick - b.tick),
    'all other LH attacks unchanged');
  assert.equal(rh.length, 301, '303 historical RH attacks minus exactly two');
  assert.equal(lh.length, 250, '248 historical LH attacks plus exactly two');
  assert.equal(rh.length + lh.length, 551, 'global attack total is preserved');
  for (const seq of [rh, lh]) {
    for (let i = 1; i < seq.length; i++) {
      assert.ok(seq[i].tick > seq[i - 1].tick, 'strictly time-ordered');
    }
  }
  // Var. 1 is strict two-part counterpoint: every attack is a single note.
  assert.equal(new Set(rh.map((a) => a.tick)).size, rh.length);
  assert.deepEqual(contourPieceRange(SCORE), { min: 26, max: 74 });
});

test('Pen lifts exactly at the five corpus silences of a beat or more', () => {
  const lifts = (hand: 'RH' | 'LH'): string[] => {
    const seq = contourGlobalSequence(SCORE, hand);
    const out: string[] = [];
    for (let i = 1; i < seq.length; i++) {
      const s = contourSilence(seq[i - 1], seq[i]);
      if (contourPenLifts(s, T)) out.push(`${seq[i - 1].tick}->${seq[i].tick}`);
    }
    return out;
  };
  assert.deepEqual(lifts('RH'), ['2244->2304', '2952->3036', '3096->3180']);
  assert.deepEqual(lifts('LH'), ['2832->2964', '3024->3108']);
  // Sounding durations never lift: a legato quarter bridges its full value.
  assert.equal(contourPenLifts(0, T), false);
  assert.equal(contourPenLifts(47, T), false);
  assert.equal(contourPenLifts(48, T), true);
});

test('System attacks touch the final-bar unison digit with both hands', () => {
  const sys8 = LAYOUTS[7];
  const rh = contourSystemAttacks(SCORE, sys8, 'RH', T);
  const lh = contourSystemAttacks(SCORE, sys8, 'LH', T);
  const rhLast = rh.find((a) => a.tick === 4560)!;
  const lhLast = lh.find((a) => a.tick === 4560)!;
  assert.ok(rhLast, 'the absorbed RH unison loser is patched back');
  assert.equal(rhLast.x, lhLast.x, 'both lines touch the one shared digit');
  assert.equal(rhLast.y, lhLast.y, 'same pitch, same row');
  assert.equal(rhLast.lin, 43);
});

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------

test('Thread anchor: middle C the note sits exactly on the Middle C line', () => {
  const middleCY = LAYOUTS[0].geometry.middleCY;
  assert.equal(contourThreadY(middleCY, CONTOUR_MIDDLE_C_LIN, T.contourThreadScale), middleCY);
  assert.equal(
    contourThreadY(middleCY, linearPitch({ pitchClass: 11, octave: 3 }), T.contourThreadScale),
    middleCY + T.contourThreadScale
  );
  assert.equal(T.contourThreadScale, 2.5);
});

test('Thread vertices stand at exact attack columns at formula height', () => {
  for (const [s, hand] of [[0, 'RH'], [0, 'LH'], [5, 'RH']] as const) {
    const layout = LAYOUTS[s];
    const attacks = contourSystemAttacks(SCORE, layout, hand, T);
    const runs = buildContourThreads(attacks, layout.geometry.middleCY, T.contourThreadScale, hand, T);
    assert.ok(runs.length > 0);
    for (const run of runs) {
      assert.equal(run.hand, hand);
      for (let i = 0; i < run.points.length; i++) {
        const a = attacks.find((q) => q.tick === run.ticks[i])!;
        assert.equal(run.points[i].x, a.x, 'exact attack column');
        assert.equal(
          run.points[i].y,
          contourThreadY(layout.geometry.middleCY, a.lin, T.contourThreadScale),
          'formula height'
        );
      }
    }
    // Coverage: every attack carries exactly one vertex.
    const seen = runs.flatMap((r) => r.ticks).sort((x, y) => x - y);
    assert.deepEqual(seen, attacks.map((a) => a.tick));
  }
});

test('Thread runs break exactly at pen-lifting silences, never elsewhere', () => {
  for (const [s, layout] of LAYOUTS.entries()) {
    for (const hand of ['RH', 'LH'] as const) {
      const attacks = contourSystemAttacks(SCORE, layout, hand, T);
      const runs = buildContourThreads(attacks, layout.geometry.middleCY, T.contourThreadScale, hand, T);
      for (const run of runs) {
        for (let i = 1; i < run.ticks.length; i++) {
          const prev = attacks.find((a) => a.tick === run.ticks[i - 1])!;
          const cur = attacks.find((a) => a.tick === run.ticks[i])!;
          assert.equal(
            contourPenLifts(contourSilence(prev, cur), T),
            false,
            `sys${s + 1} ${hand}: no segment bridges a rest`
          );
        }
      }
    }
  }
  // The corpus breaks, pinned: sys6 carries the RH 2952→3036 and LH 2832→2964 lifts.
  const sys6 = LAYOUTS[5];
  const rhTicks = buildContourThreads(
    contourSystemAttacks(SCORE, sys6, 'RH', T),
    sys6.geometry.middleCY,
    T.contourThreadScale,
    'RH',
    T
  ).map((r) => r.ticks);
  assert.ok(rhTicks.length >= 2, 'the RH thread lifts on sys6');
  assert.ok(!rhTicks.some((ticks) => ticks.includes(2952) && ticks.includes(3036)));
});

test("contourThread 'rh' voices the right hand only", () => {
  const rhOnly = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, contourThread: 'rh' });
  assert.deepEqual(contourThreadHands(rhOnly), ['RH']);
  assert.deepEqual(contourThreadHands(O), []);
  const ink = buildSystemContour(SCORE, LAYOUTS[0], rhOnly, T);
  assert.match(ink.thread, /janko-contour-thread-rh/);
  assert.doesNotMatch(ink.thread, /janko-contour-thread-lh/);
});

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

test('Tick legend: direction, weight, breath — the opening ascent reads up', () => {
  const sys1 = LAYOUTS[0];
  const byTick = new Map(
    buildContourTicks(
      contourSystemAttacks(SCORE, sys1, 'RH', T),
      contourGlobalSequence(SCORE, 'RH'),
      sys1,
      O,
      T
    ).map((tk) => [tk.tick, tk])
  );
  // The stepwise ascent: every departure rises, including the B→C octave wrap.
  for (const tick of [60, 72, 84, 96, 108, 120, 132]) {
    assert.equal(byTick.get(tick)!.kind, 'up-step', `tick ${tick} rises`);
  }
  // Repeats hold still; the corpus lifts breathe.
  const sys4 = LAYOUTS[3];
  const byTick4 = new Map(
    buildContourTicks(
      contourSystemAttacks(SCORE, sys4, 'RH', T),
      contourGlobalSequence(SCORE, 'RH'),
      sys4,
      O,
      T
    ).map((tk) => [tk.tick, tk])
  );
  assert.equal(byTick4.get(1752)!.kind, 'same');
  assert.equal(byTick4.get(1896)!.kind, 'same');
  const sys6 = LAYOUTS[5];
  const rh6 = new Map(
    buildContourTicks(
      contourSystemAttacks(SCORE, sys6, 'RH', T),
      contourGlobalSequence(SCORE, 'RH'),
      sys6,
      O,
      T
    ).map((tk) => [tk.tick, tk])
  );
  assert.equal(rh6.get(2952)!.kind, 'breathe', 'the 48t silence breathes');
  // The score's final attack of each hand carries no tick.
  const sys8 = LAYOUTS[7];
  const rh8 = buildContourTicks(
    contourSystemAttacks(SCORE, sys8, 'RH', T),
    contourGlobalSequence(SCORE, 'RH'),
    sys8,
    O,
    T
  );
  assert.ok(!rh8.some((tk) => tk.tick === 4560), 'no departure past the final note');
  // Unit legend.
  assert.equal(contourTickKind(0, 0, T), 'same');
  assert.equal(contourTickKind(2, 0, T), 'up-step');
  assert.equal(contourTickKind(3, 0, T), 'up-leap');
  assert.equal(contourTickKind(-1, 0, T), 'down-step');
  assert.equal(contourTickKind(-4, 0, T), 'down-leap');
  assert.equal(contourTickKind(5, 48, T), 'breathe', 'silence outranks interval');
});

test('Tick sides follow whole-tone rank: odd above, even below', () => {
  const sys1 = LAYOUTS[0];
  const attacks = contourSystemAttacks(SCORE, sys1, 'RH', T);
  const ticks = buildContourTicks(attacks, contourGlobalSequence(SCORE, 'RH'), sys1, O, T);
  assert.ok(ticks.length > 10);
  for (const tick of ticks) {
    const a = attacks.find((q) => q.tick === tick.tick)!;
    const cy = tick.kind === 'breathe' ? tick.cy : (tick.y1 + tick.y2) / 2;
    if (a.pitchClass % 2 === 1) {
      assert.ok(cy < a.y, `odd tick ${tick.tick} rides above`);
    } else {
      assert.ok(cy > a.y, `even tick ${tick.tick} rides below`);
    }
  }
});

test('Mirror rule: a blocked right side mirrors left at the same air (unit)', () => {
  const attack: ContourAttack = {
    tick: 100,
    lin: 50,
    durationTicks: 12,
    hand: 'RH',
    x: 200,
    y: 150,
    pitchClass: 2,
    dotX: undefined,
  };
  const preset = getClusterSpacingPreset(O.clusterSpacing);
  const free = placeContourTick(attack, 'up-step', preset.wx, preset.hy, [], T);
  assert.equal(free.mirrored, false);
  assert.ok(free.x1 > attack.x, 'unblocked ticks stand right');
  // A barline inside the rightward span (with its air) mirrors the tick.
  const blocked = placeContourTick(
    attack,
    'up-step',
    preset.wx,
    preset.hy,
    [{ x: free.x1 + 1.0, air: 1.0 }],
    T
  );
  assert.equal(blocked.mirrored, true);
  assert.ok(blocked.x2 < attack.x, 'mirrored ticks stand left');
  // Same head air on both sides; the shape still points forward.
  assert.equal(free.y1, blocked.y1);
  assert.equal(free.y2, blocked.y2);
  assert.ok(blocked.x2 > blocked.x1 && blocked.y1 > blocked.y2, 'still rises to the right');
  // A blocker at the span edge (touching) does not fire the rule.
  const touching = placeContourTick(
    attack,
    'up-step',
    preset.wx,
    preset.hy,
    [{ x: free.x2 + 1.0, air: 1.0 }],
    T
  );
  assert.equal(touching.mirrored, false);
});

test('Dotted odd heads nudge the above-tick right of the dot lane (unit)', () => {
  const preset = getClusterSpacingPreset(O.clusterSpacing);
  const attack: ContourAttack = {
    tick: 100,
    lin: 51,
    durationTicks: 36,
    hand: 'RH',
    x: 200,
    y: 150,
    pitchClass: 3,
    dotX: 200 + preset.wx + T.augmentationDotGap,
  };
  const tick = placeContourTick(attack, 'up-step', preset.wx, preset.hy, [], T);
  assert.ok(tick.y1 < attack.y && tick.y2 < attack.y, 'odd rides above');
  assert.ok(
    tick.x1 >= attack.dotX! + T.augmentationDotRadius + 1.0 - 1e-9,
    'the tick starts right of the dot'
  );
});

// ---------------------------------------------------------------------------
// Strip
// ---------------------------------------------------------------------------

test('Strip scale is the score’s own, identical on every system', () => {
  const strips = LAYOUTS.map((l) => buildContourStrip(SCORE, l, T)!);
  assert.ok(strips.every(Boolean), 'every system carries a strip');
  for (const [i, strip] of strips.entries()) {
    assert.equal(strip.rangeMin, 26, `sys${i + 1} range`);
    assert.equal(strip.rangeMax, 74, `sys${i + 1} range`);
    assert.equal(strip.height, 24);
    assert.equal(strip.k, 0.5, `sys${i + 1} slope`);
    assert.deepEqual(strip.gridCs, [36, 48, 60, 72], `sys${i + 1} C-gridlines`);
  }
  // C4 sits 12 semitones above the floor: the landmark height is fixed.
  assert.equal(contourStripY(100, 24, 26, 74, 48), 100 + 24 - (22 / 48) * 24);
});

test('Strip top clears the staff and the lowest ink by the token air', () => {
  for (const [i, layout] of LAYOUTS.entries()) {
    const strip = buildContourStrip(SCORE, layout, T)!;
    const inkBottom = contourSystemInkBottom(layout, T);
    assert.equal(
      strip.top,
      Math.max(layout.geometry.staffBotY + T.contourStripAir, inkBottom + T.contourStripAir),
      `sys${i + 1} sits on the clearance line`
    );
    assert.ok(strip.top >= layout.geometry.staffBotY + 3, `sys${i + 1} clears the staff`);
  }
});

test('Strip curves: one vertex per attack at exact columns and heights', () => {
  for (const [i, layout] of LAYOUTS.entries()) {
    const strip = buildContourStrip(SCORE, layout, T)!;
    for (const curve of strip.curves) {
      const attacks = contourSystemAttacks(SCORE, layout, curve.hand, T);
      const flat = curve.runs.flat();
      assert.equal(flat.length, attacks.length, `sys${i + 1} ${curve.hand} vertex count`);
      for (const [v, a] of flat.map((v, k) => [v, attacks[k]] as const)) {
        assert.equal(v.x, a.x, 'exact attack column');
        assert.equal(
          v.y,
          contourStripY(strip.top, strip.height, strip.rangeMin, strip.rangeMax, a.lin),
          'formula height'
        );
      }
    }
  }
});

test('Strip paint: frame, C4 landmark, solid RH, dashed LH', () => {
  const strip = buildContourStrip(SCORE, LAYOUTS[0], T)!;
  const svg = renderContourStrip(strip, LAYOUTS[0]);
  assert.equal((svg.match(/janko-contour-strip-frame/g) ?? []).length, 2, 'top and bottom frame');
  assert.match(svg, /janko-contour-strip-c4/, 'the C4 gridline is marked');
  assert.match(svg, />C4<\/text>/, 'the C4 landmark is labelled');
  assert.match(svg, /janko-contour-strip-rh/, 'RH curve');
  assert.match(svg, /janko-contour-strip-lh/, 'LH curve');
  assert.match(svg, /stroke-dasharray="3 1\.8"/, 'LH dashes');
  const rhLine = svg.split('\n').find((line) => line.includes('janko-contour-strip-rh'))!;
  assert.ok(!rhLine.includes('stroke-dasharray'), 'RH runs solid');
});

// ---------------------------------------------------------------------------
// Paint integration
// ---------------------------------------------------------------------------

test('Contour layers paint in order: thread first, ticks last, strip outside', () => {
  const o = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    contourThread: 'both',
    contourTicks: true,
    contourStrip: true,
  });
  const layout = layoutJankoScore(SCORE, o, T)[0];
  const svg = renderSystem(SCORE, layout.geometry, 0, o, T, layout);
  const thread = svg.indexOf('janko-contour-thread');
  const firstKnockout = svg.indexOf('janko-knockout');
  const lastDigit = svg.lastIndexOf('janko-digit');
  const ticks = svg.indexOf('janko-contour-ticks');
  const strip = svg.indexOf('janko-contour-strip');
  const notesClose = svg.indexOf('class="janko-notes"');
  assert.ok(thread >= 0 && ticks > 0 && strip > 0, 'all three layers paint');
  assert.ok(thread < firstKnockout, 'the thread weaves beneath the knockouts');
  assert.ok(ticks > lastDigit, 'ticks paint above the heads, like articulation');
  assert.ok(strip > notesClose, 'the strip paints outside the notes layer');
});

test('Crop extents grow for contour ink and only for contour ink', () => {
  const plain = computeCropExtents(SCORE, GEO, 1, 16, O, T);
  const o = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    contourThread: 'both',
    contourTicks: true,
    contourStrip: true,
  });
  const grown = computeCropExtents(SCORE, GEO, 1, 16, o, T);
  assert.ok(grown.bottom > plain.bottom, 'the strip and thread extend the crop');
  assert.ok(
    renderJankoCrop(SCORE, 1, 16, o, T).length > renderJankoCrop(SCORE, 1, 16, O, T).length,
    'the grown crop carries the layers'
  );
  // Options off: no ink, no bounds, no contour classes anywhere.
  assert.equal(contourSystemInkBounds(SCORE, LAYOUTS[0], O, T), null);
  assert.deepEqual(buildSystemContour(SCORE, LAYOUTS[0], O, T), { thread: '', ticks: '', strip: '' });
  assert.doesNotMatch(renderJankoCrop(SCORE, 1, 16, O, T), /janko-contour/);
});

// ---------------------------------------------------------------------------
// Linter verdict
// ---------------------------------------------------------------------------

test('Every paradigm lints clean on the full score (paint-order audits on)', () => {
  const cases: Array<[string, ReturnType<typeof resolveJankoOptions>]> = [
    ['golden', O],
    ['thread', resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, contourThread: 'both' })],
    ['ticks', resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', contourTicks: true })],
    ['strip', resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'adaptive', contourStrip: true })],
  ];
  for (const [name, options] of cases) {
    const report = lintJankoScore(SCORE, options, T);
    assert.deepEqual(report.violations, [], `${name}: violation list is empty`);
    assert.equal(report.ok, true, `${name}: no violations`);
    assert.equal(report.stats.checks, JANKO_LINT_CHECKS.length, `${name}: every check ran`);
  }
  assert.ok(JANKO_LINT_CHECKS.includes('contour-thread'), 'the thread check is registered');
  assert.ok(JANKO_LINT_CHECKS.includes('contour-ticks'), 'the tick check is registered');
  assert.ok(JANKO_LINT_CHECKS.includes('contour-strip'), 'the strip check is registered');
});
