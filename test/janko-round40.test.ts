import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  isAbstractCandidateWindow,
  resolveCandidate,
} from '../src/render/janko/candidates.js';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types.js';
import {
  layoutJankoScore,
  renderJankoCrop,
} from '../src/render/janko/engine.js';
import {
  auditKnockoutProtection,
  checkNoteheadClearance,
  lintJankoScore,
} from '../src/render/janko/linter.js';
import {
  digitBaselineOffset,
  digitHalfExtents,
  getKnockoutMetrics,
} from '../src/render/janko/elements/notehead.js';
import { wholeToneParity } from '../src/model/pitch.js';
import { QuantizedGridScore } from '../src/model/types.js';
import { buildBrahmsOp118No1Score } from '../src/scores/brahms-op118-no1.js';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1.js';

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();

// ---------------------------------------------------------------------------
// 1. Registry: Round 40 exactly three real-score cards on identical Brahms m8
// ---------------------------------------------------------------------------

test('Round 40 metadata: Round 40 title, open axis pitchPlacement, no strip', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 40);
  assert.match(
    CURRENT_ROUND_METADATA.title,
    /Numbered two-column pitch placement — Round 40/i
  );
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['pitchPlacement']);
  assert.equal(
    CURRENT_ROUND_METADATA.compareStrip,
    undefined,
    'no comparison strip declared (cards only)'
  );
});

test('Round 40 candidate registry: exactly three cards on Brahms m.8 window', () => {
  assert.equal(CURRENT_CANDIDATES.length, 3, 'exactly three active cards');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, ['control', 'parity-scale-068', 'parity-scale-080']);

  for (const c of CURRENT_CANDIDATES) {
    assert.equal(c.axis, 'pitchPlacement', `${c.id}: single open axis`);
    assert.equal(c.kind, undefined, `${c.id}: score candidate (not abstract)`);
    assert.ok(c.windows && c.windows.length === 1, `${c.id}: exactly one window`);
    const w = c.windows[0];
    assert.ok(!isAbstractCandidateWindow(w), `${c.id}: window is not abstract`);
    assert.equal(w.scoreId, 'brahms-op118-no1', `${c.id}: authentic Brahms score`);
    assert.equal(w.measureStart, 8, `${c.id}: measure start 8`);
    assert.equal(w.measureCount, 1, `${c.id}: measure count 1`);
  }
});

test('Candidate card option and token deltas are correctly configured', () => {
  const [control, card068, card080] = CURRENT_CANDIDATES;

  // Card 1: Literal canonical Brahms control
  assert.equal(control.options?.pitchPlacement, 'standard');
  assert.deepEqual(control.tokens ?? {}, {});

  // Card 2: 0.68 scale, proportional knockoutMargin and knockoutAir
  assert.equal(card068.options?.pitchPlacement, 'parity-columns');
  assert.equal(card068.tokens?.digitFontSize, 3.944);
  assert.equal(card068.tokens?.knockoutMargin, 0.408);
  assert.equal(card068.tokens?.knockoutAir, 0.272);

  // Card 3: 0.80 scale, independently tightened knockoutMargin and knockoutAir
  assert.equal(card080.options?.pitchPlacement, 'parity-columns');
  assert.equal(card080.tokens?.digitFontSize, 4.64);
  assert.equal(card080.tokens?.knockoutMargin, 0.10);
  assert.equal(card080.tokens?.knockoutAir, 0.20);
});

// ---------------------------------------------------------------------------
// 2. Actual-engine placement: Brahms m.8 downbeat odd-family single column
// ---------------------------------------------------------------------------

test('Brahms m.8 downbeat source data verification: 5 RH notes at tick 1392', () => {
  // Find all RH notes at tick 1392
  const downbeatRH = BRAHMS.notes.filter(
    (n) => n.startTick === 1392 && n.hand === 'RH'
  );
  assert.equal(downbeatRH.length, 5, 'exactly 5 RH downbeat notes at tick 1392');

  // Verify pitch classes: F3 (5), G3 (7), B3 (11), F4 (5), G4 (7)
  const pcs = downbeatRH.map((n) => n.pitch.pitchClass).sort((a, b) => a - b);
  assert.deepEqual(pcs, [5, 5, 7, 7, 11], 'pitch classes: F (5), G (7), B (11), F (5), G (7)');

  // All 5 notes must belong to the odd whole-tone family (wholeToneParity === 1)
  for (const n of downbeatRH) {
    assert.equal(
      wholeToneParity(n.pitch),
      1,
      `note ${n.id} (pc=${n.pitch.pitchClass}) must have wholeToneParity 1 (odd)`
    );
    assert.equal(n.durationTicks, 96, `note ${n.id} duration must be 96 ticks`);
  }
});

test('Actual engine placement: Cards 2 & 3 place all 5 RH odd notes in one parity column', () => {
  const pairGap = getClusterSpacingPreset('tight').pairGap;

  for (const card of [CURRENT_CANDIDATES[1], CURRENT_CANDIDATES[2]]) {
    const resolved = resolveCandidate(card);
    const layouts = layoutJankoScore(BRAHMS, resolved.options, resolved.tokens);

    // Locate system containing tick 1392
    const system = layouts.find((sys) =>
      sys.notes.some((p) => p.note.startTick === 1392)
    );
    assert.ok(system, `${card.id}: found system for tick 1392`);

    const rhHeads = system.notes.filter(
      (p) => p.note.startTick === 1392 && p.rhythm.hand === 'RH'
    );
    assert.equal(rhHeads.length, 5, `${card.id}: all 5 RH heads positioned`);

    // All 5 odd heads MUST share the exact same X coordinate = nominalX + pairGap
    const nominalX = rhHeads[0].nominalX!;
    assert.ok(nominalX !== undefined, 'nominalX must be defined');
    const expectedX = nominalX + pairGap;

    for (const p of rhHeads) {
      assert.ok(
        Math.abs(p.x - expectedX) < 1e-3,
        `${card.id}: head ${p.note.id} at x=${p.x.toFixed(3)}, expected ${expectedX.toFixed(3)}`
      );
    }

    // Sort by Y (top to bottom = higher pitch to lower pitch in SVG coordinates, or vice versa)
    const sortedByY = [...rhHeads].sort((a, b) => a.y - b.y);

    // Semitone height is 2.5pt:
    // 2-span neighbour distance = 5.0pt
    // 10-span (octave) distance = 30.0pt
    const g4 = sortedByY[0]; // highest pitch (G4)
    const f4 = sortedByY[1]; // F4
    const b3 = sortedByY[2]; // B3
    const g3 = sortedByY[3]; // G3
    const f3 = sortedByY[4]; // lowest pitch (F3)

    // Verify 2-span neighbours: G4-F4 = 2 semitones = 5.0pt, G3-F3 = 2 semitones = 5.0pt
    assert.ok(
      Math.abs(Math.abs(f4.y - g4.y) - 5.0) < 1e-3,
      `${card.id}: F4-G4 2-span distance must be exactly 5.0pt (got ${Math.abs(f4.y - g4.y).toFixed(3)})`
    );
    assert.ok(
      Math.abs(Math.abs(f3.y - g3.y) - 5.0) < 1e-3,
      `${card.id}: F3-G3 2-span distance must be exactly 5.0pt (got ${Math.abs(f3.y - g3.y).toFixed(3)})`
    );

    // Verify 10-span repeats (octaves): F3-F4 = 12 semitones = 30.0pt, G3-G4 = 12 semitones = 30.0pt
    assert.ok(
      Math.abs(Math.abs(f3.y - f4.y) - 30.0) < 1e-3,
      `${card.id}: F3-F4 10-span octave distance must be exactly 30.0pt (got ${Math.abs(f3.y - f4.y).toFixed(3)})`
    );
    assert.ok(
      Math.abs(Math.abs(g3.y - g4.y) - 30.0) < 1e-3,
      `${card.id}: G3-G4 10-span octave distance must be exactly 30.0pt (got ${Math.abs(g3.y - g4.y).toFixed(3)})`
    );

    // LH accompaniment notes at tick 1392 preserved
    const lhHeads = system.notes.filter(
      (p) => p.note.startTick === 1392 && p.rhythm.hand === 'LH'
    );
    assert.ok(lhHeads.length >= 1, `${card.id}: LH accompaniment note rendered`);
  }
});

test('Canonical control placement: three-rail staggering active (not all on pairGap)', () => {
  const control = resolveCandidate(CURRENT_CANDIDATES[0]);
  const layouts = layoutJankoScore(BRAHMS, control.options, control.tokens);
  const system = layouts.find((sys) =>
    sys.notes.some((p) => p.note.startTick === 1392)
  )!;
  const rhHeads = system.notes.filter(
    (p) => p.note.startTick === 1392 && p.rhythm.hand === 'RH'
  );
  // In canonical three-rail placement, the 5 notes stagger into distinct rails
  const xs = new Set(rhHeads.map((p) => p.x.toFixed(2)));
  assert.ok(xs.size > 1, 'canonical control stagger uses multiple rails');
});

// ---------------------------------------------------------------------------
// 3. Scaling & SVG output verification
// ---------------------------------------------------------------------------

test('Scaling in emitted SVG: font-size and knockout rect dimensions match tokens', () => {
  // Render m.8 crop for card 2 (scale 0.68)
  const card068 = resolveCandidate(CURRENT_CANDIDATES[1]);
  const svg068 = renderJankoCrop(BRAHMS, 8, 1, card068.options, card068.tokens);
  assert.ok(svg068.includes('font-size="3.944pt"'), 'card068 emits font-size 3.944pt');

  const metrics068 = getKnockoutMetrics(card068.options, card068.tokens);
  const expectedW068 = (2 * metrics068.wx).toFixed(2);
  const expectedH068 = (2 * metrics068.hy).toFixed(2);
  assert.ok(
    svg068.includes(`width="${expectedW068}"`) && svg068.includes(`height="${expectedH068}"`),
    `card068 emits knockout rect with width=${expectedW068} height=${expectedH068}`
  );

  // Render m.8 crop for card 3 (scale 0.80)
  const card080 = resolveCandidate(CURRENT_CANDIDATES[2]);
  const svg080 = renderJankoCrop(BRAHMS, 8, 1, card080.options, card080.tokens);
  assert.ok(svg080.includes('font-size="4.64pt"'), 'card080 emits font-size 4.64pt');

  const metrics080 = getKnockoutMetrics(card080.options, card080.tokens);
  const expectedW080 = (2 * metrics080.wx).toFixed(2);
  const expectedH080 = (2 * metrics080.hy).toFixed(2);
  assert.ok(
    svg080.includes(`width="${expectedW080}"`) && svg080.includes(`height="${expectedH080}"`),
    `card080 emits knockout rect with width=${expectedW080} height=${expectedH080}`
  );
});

test('Knockout protection and paint order in emitted SVGs', () => {
  for (const card of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(card);
    const svg = renderJankoCrop(BRAHMS, 8, 1, resolved.options, resolved.tokens);
    const metrics = getKnockoutMetrics(resolved.options, resolved.tokens);
    const violations = auditKnockoutProtection(svg, {
      knockoutWx: metrics.wx,
      knockoutHy: metrics.hy,
      haloRadius: resolved.tokens.haloRadius,
      digitBaselineOffset: digitBaselineOffset(resolved.tokens.digitFontSize),
    });
    assert.deepEqual(violations, [], `${card.id}: no paint order / knockout violations`);
  }
});

test('Synthetic unit test: pitch-based parity assignment and diagonal clearance', () => {
  // Test that even pitch family is placed on the left (offset 0) and odd family on the right (offset pairGap),
  // regardless of note order in the score.
  const pairGap = getClusterSpacingPreset('tight').pairGap;

  // Case A: [C4 (even, pc 0), C#4 (odd, pc 1)]
  const scoreA: QuantizedGridScore = {
    id: 'synthetic-even-odd',
    composer: 'Synthetic',
    totalTicks: 96,
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    title: 'Synthetic Even-Odd',
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    ticksPerBeat: 24,
    notes: [
      { id: 'n-even', pitch: { pitchClass: 0, octave: 4 }, startTick: 24, durationTicks: 24, hand: 'RH' },
      { id: 'n-odd', pitch: { pitchClass: 1, octave: 4 }, startTick: 24, durationTicks: 24, hand: 'RH' },
    ],
  };

  // Case B: [C#4 (odd, pc 1), D4 (even, pc 2)] (odd first in source)
  const scoreB: QuantizedGridScore = {
    id: 'synthetic-odd-even',
    composer: 'Synthetic',
    totalTicks: 96,
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    title: 'Synthetic Odd-Even',
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    ticksPerBeat: 24,
    notes: [
      { id: 'n-odd', pitch: { pitchClass: 1, octave: 4 }, startTick: 24, durationTicks: 24, hand: 'RH' },
      { id: 'n-even', pitch: { pitchClass: 2, octave: 4 }, startTick: 24, durationTicks: 24, hand: 'RH' },
    ],
  };

  for (const card of [CURRENT_CANDIDATES[1], CURRENT_CANDIDATES[2]]) {
    const resolved = resolveCandidate(card);

    for (const [label, score] of [['A', scoreA], ['B', scoreB]] as const) {
      const layouts = layoutJankoScore(score, resolved.options, resolved.tokens);
      const notes = layouts[0].notes;
      const evenNote = notes.find((n) => n.note.id === 'n-even')!;
      const oddNote = notes.find((n) => n.note.id === 'n-odd')!;

      const nominalX = evenNote.nominalX!;
      // Even note MUST have offset 0 (at nominalX)
      assert.ok(
        Math.abs(evenNote.x - nominalX) < 1e-3,
        `${card.id} score ${label}: even note at offset 0 (x=${evenNote.x}, nominal=${nominalX})`
      );
      // Odd note MUST have offset pairGap (at nominalX + pairGap)
      assert.ok(
        Math.abs(oddNote.x - (nominalX + pairGap)) < 1e-3,
        `${card.id} score ${label}: odd note at offset pairGap (x=${oddNote.x}, expected=${nominalX + pairGap})`
      );

      // Verify diagonal clearance: check notehead clearance doesn't flag collision
      const out: any[] = [];
      checkNoteheadClearance(layouts[0], resolved.options, resolved.tokens, { digitClearance: 0.1 } as any, out);
      assert.deepEqual(out, [], `${card.id} score ${label}: diagonal clearance clean`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4. Duration and shared bracket preservation
// ---------------------------------------------------------------------------

test('Brahms m.8 downbeat shared half-duration bracket preserved', () => {
  for (const card of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(card);
    const layouts = layoutJankoScore(BRAHMS, resolved.options, resolved.tokens);
    const system = layouts.find((sys) =>
      sys.notes.some((p) => p.note.startTick === 1392)
    )!;

    // Clasp at tick 1392
    const clasp1392 = system.clasps.find((c) => c.tick === 1392);
    assert.ok(clasp1392, `${card.id}: clasp at tick 1392 exists`);
    assert.equal(clasp1392.durationTicks, 96, `${card.id}: clasp carried duration 96 ticks`);

    // Verify clasp carried duration is 96 ticks (half note in 48-div metric)
    const rhHeads = system.notes.filter(
      (p) => p.note.startTick === 1392 && p.rhythm.hand === 'RH'
    );
    assert.equal(rhHeads.length, 5, `${card.id}: all 5 RH heads found`);
    for (const h of rhHeads) {
      assert.equal(h.note.durationTicks, 96, `${card.id}: 96 ticks duration preserved`);
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Candidate linter coverage & canonical regression
// ---------------------------------------------------------------------------

test('Candidate linter coverage: all three cards lint cleanly on Brahms m.8', () => {
  for (const card of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(card);
    const report = lintJankoScore(BRAHMS, resolved.options, resolved.tokens);
    const m8Violations = report.violations.filter((v) => v.measure === 8);
    assert.equal(m8Violations.length, 0, `${card.id}: 0 violations on m.8`);
  }
});

test('Canonical regression: Bach Goldberg Var. 1 GOLD reference untouched', () => {
  const goldenReport = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(goldenReport.violations.length, 0, 'Bach Goldberg Var. 1 has 0 violations');
});
