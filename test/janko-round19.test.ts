/**
 * Round 19 — Symmetric-Tuck Clusters + Anchor Verdict + Beat Grid.
 *
 * The round changes three score-wide behaviours:
 *
 *  1. **Symmetric tuck** replaces the multi-row interleave. One onset whose
 *     rows carry different head counts is re-centred: the widest row(s) keep
 *     the fan, every smaller row shifts so its own middle lands on the widest
 *     row's middle, and an even cluster (1+1, 2+2+2, 3+3) does not move at all.
 *     A tuck that would leave the beat cell is skipped.
 *  2. **Overlap-conditional unification**: when both hands of one onset produce
 *     a qualifying clasp group and their spans overlap or touch, one bracket
 *     spans every head of the onset (with one duration group per hand); a gapped
 *     onset keeps Round 6's per-hand brackets.
 *  3. **The beat grid follows the columns**: a beat that carries an onset paints
 *     its dashed pulse through the onset's laid-out column; an empty beat keeps
 *     the proportional line.
 *
 * Round 20 retires the round's axis: the RH anchor is the only rule, so the
 * `'rh'` behavior below is the golden behavior. The tests pin the tuck, the
 * unification and the grid; the anchor demonstrator is gone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { QuantizedGridScore, QuantizedNote, Hand } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  getGridNoteInset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { layoutJankoScore, renderSystem } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const BRAHMS_T = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const PAIR_GAP = getClusterSpacingPreset(DEFAULT_JANKO_OPTIONS.clusterSpacing).pairGap;

/** Brahms m. 46 downbeat: the ticket's six-head cluster (tick 8688). */
const M46 = 8688;
/** Brahms m. 26 downbeat: the second interlocking-hands instance (tick 4848). */
const M26 = 4848;
/** Brahms m. 3 downbeat: the Round 6 split guard (tick 432). */
const M3 = 432;

function makeNote(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number,
  hand: Hand = 'RH'
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand };
}

function makeScore(notes: QuantizedNote[], totalTicks = 144): QuantizedGridScore {
  return {
    id: 'synthetic-round19',
    title: 'Synthetic Round 19',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

/** Every note of one tick, keyed by note id. */
function onset(layouts: ReturnType<typeof layoutJankoScore>, tick: number) {
  const notes = layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === tick);
  return new Map(notes.map((p) => [p.note.id, p]));
}

/** Every onset of a score bucketed by tick (id -> positioned note). */
function onsetsByTick(layouts: ReturnType<typeof layoutJankoScore>) {
  const byTick = new Map<number, ReturnType<typeof onset>>();
  for (const p of layouts.flatMap((l) => l.notes)) {
    const bucket = byTick.get(p.note.startTick) ?? new Map();
    bucket.set(p.note.id, p);
    byTick.set(p.note.startTick, bucket);
  }
  return byTick;
}

// ---------------------------------------------------------------------------
// 1. The RH anchor (the only rule since the Round 19 verdict)
// ---------------------------------------------------------------------------

test('The RH anchor is the only anchor rule: the option is retired', () => {
  assert.ok(
    !('clusterAnchor' in DEFAULT_JANKO_OPTIONS),
    'the retired cluster-anchor option is gone from the golden master'
  );
  assert.ok(
    !('clusterAnchor' in resolveJankoOptions({})),
    'and from every resolved option set'
  );
});

// ---------------------------------------------------------------------------
// 2. The symmetric tuck
// ---------------------------------------------------------------------------

test('m. 46 tucks to the ticket positions: single heads on the pair columns’ midpoint', () => {
  const layout = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const n = onset(layout, M46);
  const x = (id: string): number => n.get(id)!.x;
  // F5 / D3 (the single-head rows) tuck onto the pair columns' midpoint …
  assert.equal(x('brahms-op118-no1-637').toFixed(2), '49.88', 'F5 tucks to 49.88');
  assert.equal(x('brahms-op118-no1-632').toFixed(2), '49.88', 'D3 tucks to 49.88');
  // … while the two pair rows fan from the column exactly as before.
  assert.equal(x('brahms-op118-no1-634').toFixed(2), '47.15', 'F4 holds the column');
  assert.equal(x('brahms-op118-no1-636').toFixed(2), '52.61', 'B4 fans one pair gap');
  // Round 21 §D lower-first: on the mixed-hand row the **lower** head (D4, LH)
  // holds the column and G#4 (RH) fans.
  assert.equal(x('brahms-op118-no1-633').toFixed(2), '47.15', 'D4 holds the column');
  assert.equal(x('brahms-op118-no1-635').toFixed(2), '52.61', 'G#4 fans one pair gap');
  // The whole cluster mirrors about 49.88 (the ticket's "symmetric about 53.88", shifted by the 20pt margin).
  const xs = [...n.values()].map((p) => p.x);
  const centre = 49.88;
  for (const v of xs) {
    assert.ok(
      xs.some((w) => Math.abs(w + v - 2 * centre) < 1e-9),
      `every head at ${v.toFixed(2)} has its mirror about ${centre}`
    );
  }
});

test('The tuck is score-wide: every uneven cluster mirrors about its widest row’s middle', () => {
  for (const [name, score, options, tokens] of [
    ['Bach', BACH, DEFAULT_JANKO_OPTIONS, T],
    ['Brahms', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T],
  ] as const) {
    const byTick = onsetsByTick(layoutJankoScore(score, options, tokens));
    let uneven = 0;
    for (const [tick, heads] of byTick) {
      const rows = new Map<number, number[]>();
      for (const p of heads.values()) {
        const key = Math.round(p.y * 1000);
        rows.set(key, [...(rows.get(key) ?? []), p.x]);
      }
      const middles = [...rows.values()].map((xs) => {
        const lo = Math.min(...xs);
        const hi = Math.max(...xs);
        return { count: xs.length, middle: (lo + hi) / 2 };
      });
      const maxCount = Math.max(...middles.map((r) => r.count));
      if (middles.length < 2 || middles.every((r) => r.count === maxCount)) continue;
      uneven++;
      const widest = middles.find((r) => r.count === maxCount)!;
      for (const row of middles) {
        if (row.count === maxCount) continue;
        assert.ok(
          Math.abs(row.middle - widest.middle) < 1e-6,
          `${name} t${tick}: a ${row.count}-head row centres on the ${maxCount}-head middle`
        );
      }
    }
    if (name === 'Brahms') assert.ok(uneven >= 30, `Brahms carries the uneven clusters (${uneven})`);
    else assert.equal(uneven, 0, 'Bach’s rows are all even');
  }
});

test('An even cluster coincides: equal-count rows share their middle exactly', () => {
  const byTick = onsetsByTick(layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, T));
  let evenPairs = 0;
  for (const [tick, heads] of byTick) {
    const rows = new Map<number, number[]>();
    for (const p of heads.values()) {
      const key = Math.round(p.y * 1000);
      rows.set(key, [...(rows.get(key) ?? []), p.x]);
    }
    if (rows.size < 2) continue;
    const middles = [...rows.values()].map((xs) => (Math.min(...xs) + Math.max(...xs)) / 2);
    assert.ok(
      middles.every((m) => Math.abs(m - middles[0]) < 1e-6),
      `t${tick}: even rows stay aligned`
    );
    evenPairs++;
  }
  assert.ok(evenPairs > 0, 'Bach has multi-row onsets to check');
});

test('The tuck respects the beat cell: no head of either score leaves its own beat', () => {
  for (const [score, options, tokens] of [
    [BACH, DEFAULT_JANKO_OPTIONS, T],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T],
  ] as const) {
    const report = lintJankoScore(score, options, tokens);
    assert.equal(report.ok, true, 'the tucked golden lints clean');
    assert.equal(
      report.diagnostics.filter((d) => d.code === 'grid-crossing-offset').length,
      0,
      'the tuck never buys symmetry with a grid crossing'
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Overlap-conditional unification
// ---------------------------------------------------------------------------

test('Overlapping hands unify: m. 46 and m. 26 carry one bracket spanning both hands', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  for (const [tick, top, bot, mid] of [
    [M46, 99.7, 184.3, 142.0],
    // m. 26 sits in system 2: +6 top margin + 2·(14/3) slot spread.
    [M26, 590.29, 674.89, 632.59],
  ] as const) {
    const system = layouts.find((l) => l.notes.some((p) => p.note.startTick === tick))!;
    const clasps = system.clasps.filter((c) => c.tick === tick);
    assert.equal(clasps.length, 1, `t${tick}: exactly one bracket`);
    const clasp = clasps[0];
    assert.equal(clasp.notes.length, 6, `t${tick}: every head of the onset is a member`);
    assert.deepEqual(
      [...new Set(clasp.notes.map((n) => n.hand))].sort(),
      ['LH', 'RH'],
      `t${tick}: the bracket spans both hands`
    );
    assert.equal(Number(clasp.topY.toFixed(2)), top, `t${tick}: the unified top`);
    assert.equal(Number(clasp.botY.toFixed(2)), bot, `t${tick}: the unified bottom`);
    // The double-pip / pip ring of the hand that carries one sits at the
    // unified bracket's own midpoint (the ticket's "ring cy ≈ 136" for m. 46, +6 for the 30pt top margin).
    const open = clasp.durationInk.filter((ink) => ink.pips > 0);
    assert.equal(open.length, 1, `t${tick}: one open duration group`);
    assert.equal(Number(open[0].centerY.toFixed(2)), mid, `t${tick}: the ring sits at the new midpoint`);
    // The bracket still carries the cluster's shortest value.
    assert.equal(
      clasp.durationTicks,
      Math.min(...clasp.notes.map((n) => n.durationTicks)),
      `t${tick}: the carried value is the shortest member`
    );
  }
});

test('A gapped onset keeps Round 6 per-hand brackets: the m. 3 guard', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const system = layouts.find((l) => l.notes.some((p) => p.note.startTick === M3))!;
  const clasps = system.clasps.filter((c) => c.tick === M3);
  assert.equal(clasps.length, 1, 'the 90pt hand gap stays split');
  assert.deepEqual(
    [...new Set(clasps[0].notes.map((n) => n.hand))],
    ['RH'],
    'only the three-note RH chord is bracketed'
  );
  assert.equal(clasps[0].notes.length, 3);
  // The 90pt hand gap keeps the brackets split: two per-hand brackets, never
  // one unified span (the retired anchor axis was inert on this window).
  const m3Svg = renderSystem(BRAHMS, layouts[0].geometry, 0, resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS), BRAHMS_T, layouts[0]);
  assert.equal((m3Svg.match(/class="janko-clasp"/g) ?? []).length, 2, 'two split brackets');
});

test('A unified bracket paints one duration group per hand', () => {
  // RH pair on one row, LH pair on the adjacent row, overlapping spans, both
  // 8th notes: one bracket, two transverse duration groups — one per hand's
  // own vertical centre.
  const score = makeScore([
    makeNote('rh-0', 0, 4, 0, 24, 'RH'),
    makeNote('rh-4', 4, 4, 0, 24, 'RH'),
    makeNote('lh-2', 2, 4, 0, 24, 'LH'),
    makeNote('lh-6', 6, 4, 0, 24, 'LH'),
  ]);
  const layout = layoutJankoScore(score, DEFAULT_JANKO_OPTIONS, T)[0];
  assert.equal(layout.clasps.length, 1, 'one unified bracket');
  const clasp = layout.clasps[0];
  assert.equal(clasp.notes.length, 4);
  assert.equal(clasp.durationInk.length, 2, 'one duration group per hand');
  assert.deepEqual(
    clasp.durationInk.map((i) => i.flags),
    [1, 1],
    'both hands carry their 8th-note subdivision mark'
  );
  const rhY = layout.notes.filter((p) => p.rhythm.hand === 'RH').map((p) => p.y);
  const lhY = layout.notes.filter((p) => p.rhythm.hand === 'LH').map((p) => p.y);
  const centres = clasp.durationInk.map((i) => i.centerY).sort((a, b) => a - b);
  assert.equal(centres[0], (Math.min(...rhY) + Math.max(...rhY)) / 2, 'RH mark at the RH centre');
  assert.equal(centres[1], (Math.min(...lhY) + Math.max(...lhY)) / 2, 'LH mark at the LH centre');
  assert.equal(clasp.durationTicks, 24, 'the carried value is the shortest member');
});

// ---------------------------------------------------------------------------
// 4. The anchor axis
// ---------------------------------------------------------------------------

test('The lower-first anchor holds the mixed row: D4 keeps the column, G#4 fans right', () => {
  const rh = onset(layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS), M46);
  // Round 21 §D (the golden, and now only, rule): the lower head — D4 (LH) —
  // holds the column, and G#4 (RH) fans one pair gap right.
  assert.equal(rh.get('brahms-op118-no1-633')!.x.toFixed(2), '47.15');
  assert.equal(rh.get('brahms-op118-no1-635')!.x.toFixed(2), '52.61');
  // The tuck is anchor-free: F5/D3 stay on the pair columns' midpoint.
  assert.equal(rh.get('brahms-op118-no1-637')!.x.toFixed(2), '49.88');
  assert.equal(rh.get('brahms-op118-no1-632')!.x.toFixed(2), '49.88');
});

test('The former anchor collision is owned by the unified bracket', () => {
  // With the fixed context (symmetric tuck + overlap unification) the golden
  // is stem-clean: the unified bracket replaces every member stem.
  const report = lintJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the tucked golden is clean');
  assert.equal(
    report.diagnostics.filter((d) => d.code === 'stem-through-simultaneity').length,
    0,
    'no stem pierces a fellow chord tone'
  );
});

// ---------------------------------------------------------------------------
// 4. The beat grid follows the columns
// ---------------------------------------------------------------------------

/** Rendered x of every dashed beat pulse of one system, in painting order. */
function pulsesOf(score: QuantizedGridScore, layouts: ReturnType<typeof layoutJankoScore>, index: number, options: typeof DEFAULT_JANKO_OPTIONS, tokens: typeof T) {
  const system = layouts[index];
  const svg = renderSystem(score, system.geometry, index, options, tokens, system);
  return [...svg.matchAll(/class="janko-beat-line" x1="([\d.]+)"/g)].map((m) => Number(m[1]));
}

test('m. 3’s pulses move onto their own note columns', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const pulses = pulsesOf(BRAHMS, layouts, 0, options, BRAHMS_T);
  // Brahms is cut time: 4 pulses per measure, 3 dashed lines each. System 0 is
  // the anacrusis + mm. 1–3, so the last three pulses are m. 3's.
  const m3 = pulses.slice(-3).map((x) => Number(x.toFixed(2)));
  assert.deepEqual(m3, [461.37, 499.34, 537.31], 'the dotted quarter lines follow the columns');
  // The pre-Round-19 grid drew m. 3's pulses proportionally inside the
  // anacrusis system's third cell (after the 48-tick upbeat), 8.51 / 7.67 /
  // 6.84pt left of their own note columns.
  const g = layouts[0].geometry;
  const inset = getGridNoteInset(options, BRAHMS_T);
  const upbeat = (BRAHMS_T.anacrusisTicks! / BRAHMS_T.ticksPerMeasure) * g.measureWidth;
  const proportional = [1, 2, 3].map(
    (b) => g.staffLeft + upbeat + 2 * g.measureWidth + inset + (b / 4) * (g.measureWidth - 2 * inset)
  );
  assert.deepEqual(
    m3.map((x, i) => Number((x - proportional[i]).toFixed(2))),
    [8.51, 7.67, 6.84],
    'the ticket’s measured left-drift is gone'
  );
  // The m. 3 pair's bracket spine (claspX = leftmost head − r − claspOffset)
  // now clears its own pulse by the whole disc + bracket air (~7.6pt), instead
  // of landing 0.76pt left of it.
  const lastBeat = layouts[0].notes.filter((p) => p.note.startTick === 576);
  const spine =
    Math.min(...lastBeat.map((p) => p.x)) - BRAHMS_T.noteheadRadius - BRAHMS_T.claspOffset;
  assert.ok(m3[2] - spine > 7, `the spine clears its pulse by ${(m3[2] - spine).toFixed(2)}pt`);
});

test('The anacrusis system maps its pulses to the right measures', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  const system = layouts[0];
  const pulses = pulsesOf(BRAHMS, layouts, 0, options, BRAHMS_T);
  // System 0 opens on the 48-tick upbeat, so its first cell is m. 1 (tick 48):
  // beats 2–4 of m. 1 stand at ticks 96 / 144 / 192.
  for (const [i, tick] of [96, 144, 192].entries()) {
    const column = system.columns.get(tick);
    assert.ok(column !== undefined, `tick ${tick} carries an onset`);
    assert.equal(Number(pulses[i].toFixed(2)), Number(column!.toFixed(2)), `pulse ${i} = t${tick}`);
  }
});

test('An empty beat keeps the proportional line', () => {
  const options = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  // System 20 (Brahms m. 64) has no onset on its first beat's pulse (tick 11616).
  const system = layouts[20];
  assert.equal(system.columns.has(11616), false, 'tick 11616 is empty');
  const pulses = pulsesOf(BRAHMS, layouts, 20, options, BRAHMS_T);
  const inset = getGridNoteInset(options, BRAHMS_T);
  const proportional =
    system.geometry.staffLeft + inset + (1 / 4) * (system.geometry.measureWidth - 2 * inset);
  assert.equal(Number(pulses[0].toFixed(2)), Number(proportional.toFixed(2)), 'proportional line');
});

test('Score-wide: every occupied pulse stands on its column, every empty one proportionally', () => {
  for (const [score, options, tokens] of [
    [BACH, DEFAULT_JANKO_OPTIONS, T],
    [BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T],
  ] as const) {
    const o = resolveJankoOptions(options);
    const t = resolveJankoTokens(tokens);
    const layouts = layoutJankoScore(score, options, tokens);
    const beats = Math.max(1, Math.round(t.ticksPerMeasure / t.ticksPerBeat));
    const anacrusis = t.anacrusisTicks ?? 0;
    const inset = getGridNoteInset(o, t);
    for (const [index, system] of layouts.entries()) {
      const pulses = pulsesOf(score, layouts, index, o, t);
      const expected: number[] = [];
      for (let m = 0; m < o.measuresPerSystem; m++) {
        const sys0Anacrusis = index === 0 && anacrusis > 0;
        const measureStart = sys0Anacrusis
          ? anacrusis + m * t.ticksPerMeasure
          : anacrusis + (index * o.measuresPerSystem + m) * t.ticksPerMeasure;
        for (let b = 1; b < beats; b++) {
          const tick = measureStart + b * t.ticksPerBeat;
          const proportional =
            system.geometry.staffLeft +
            m * system.geometry.measureWidth +
            inset +
            (b / beats) * (system.geometry.measureWidth - 2 * inset);
          expected.push(system.columns.get(tick) ?? proportional);
        }
      }
      assert.deepEqual(
        pulses.map((x) => Number(x.toFixed(2))),
        expected.map((x) => Number(x.toFixed(2))),
        `${score.id} system ${index}: every pulse on its beat's column`
      );
    }
  }
});
