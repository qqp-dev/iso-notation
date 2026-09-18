/**
 * Round 35 — Semantic hand-cluster compression candidate comparison (OPEN).
 *
 * Problem:
 * Explore semantic compression: write an absolute pitch shape once and
 * represent its simultaneous occurrences in other registers, each with
 * independently owned rhythm. Reduce repeated decoding, not merely physical
 * spacing.
 *
 * Compares:
 * - Literal baseline control: every notehead rendered with duodecimal digits.
 * - Spatial echo (Treatment A): explicit numeral-bearing origin shape; lightweight
 *   non-note group marker at each copied register carrying occurrence rhythm via
 *   standard duration cues.
 * - Compact coupling (Treatment B): explicit origin shape with adjacent bounded
 *   additive-occurrence structure (+10/+20) binding each occurrence's duration cues.
 *
 * Tested on identical Brahms windows:
 * - mm. 8–9 (octave subsets, independent B, 144 vs 192 ticks)
 * - mm. 33–34 (folded octave and unequal RH releases)
 * - mm. 46–47 (LH/RH independent tones and octave copies)
 * - mm. 66–67 (triple-register repetition D3/D4/D5 plus A2)
 * - m. 8 second half as nonrepeating control
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
  type JankoCandidate,
  type JankoCandidateRound,
} from '../src/render/janko/candidates';
import {
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
  type JankoClusterCompression,
} from '../src/render/janko/types';
import {
  layoutJankoScore,
  renderJankoPage,
  renderJankoCrop,
  sourceLin,
  type PositionedJankoNote,
} from '../src/render/janko/engine';
import { lintJankoScore, JANKO_LINT_CHECKS } from '../src/render/janko/linter';
import {
  groupOnsetNotes,
  expandCompressedClusters,
  renderSpatialEchoSvg,
  renderCompactCouplingSvg,
  checkCompressionInkCollisions,
  renderOccurrenceDurationCue,
  getSoundingLin,
  getQuantizedNote,
} from '../src/render/janko/compression';
import { Hand, QuantizedNote } from '../src/model/types';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();
const CONFIG = createStudioConfig({ score: BACH });

function optFor(mode: JankoClusterCompression) {
  return resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    clusterCompression: mode,
  });
}

function tok() {
  return resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
}

// ---------------------------------------------------------------------------
// 1. Grouping and expansion unit tests (deterministic, exact, immutable)
// ---------------------------------------------------------------------------

test('groupOnsetNotes: single-note shape (1-note octave repetition) groups and expands losslessly', () => {
  const n1: QuantizedNote = {
    id: 'test-lh-low',
    pitch: { octave: 1, pitchClass: 4 }, // E1, sounding lin 16
    startTick: 6192,
    durationTicks: 24,
    hand: 'LH',
    velocity: 100,
  };
  const n2: QuantizedNote = {
    id: 'test-lh-high',
    pitch: { octave: 2, pitchClass: 4 }, // E2, sounding lin 28 (octave +10)
    startTick: 6192,
    durationTicks: 24,
    hand: 'LH',
    velocity: 100,
  };

  const input = [n1, n2];
  const inputClone = JSON.parse(JSON.stringify(input));

  const result = groupOnsetNotes(input);
  assert.equal(result.clusters.length, 1, 'detects one compressed cluster');
  const c = result.clusters[0];
  assert.equal(c.hand, 'LH');
  assert.equal(c.startTick, 6192);
  assert.deepEqual(c.shapeOffsets, [0], 'single-note shape has shapeOffsets [0]');
  assert.equal(c.origin.baseLin, 16);
  assert.equal(c.origin.notes.length, 1);
  assert.equal(c.copies.length, 1);
  assert.equal(c.copies[0].baseLin, 28);
  assert.equal(c.copies[0].octaveOffset, 1);
  assert.equal(result.independentNotes.length, 0, 'no independent notes');

  // Lossless expansion reproduces exact source events
  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.equal(expanded.length, 2);
  assert.deepEqual(expanded, [n1, n2]);

  // Provenance and input immutability
  assert.deepEqual(input, inputClone, 'input notes were not mutated');
});

test('groupOnsetNotes: paired shape (m.8 RH {F, G} repeated at octave) groups accurately', () => {
  const f3: QuantizedNote = {
    id: 'f3',
    pitch: { octave: 3, pitchClass: 5 }, // F3, lin 41
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const g3: QuantizedNote = {
    id: 'g3',
    pitch: { octave: 3, pitchClass: 7 }, // G3, lin 43
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const f4: QuantizedNote = {
    id: 'f4',
    pitch: { octave: 4, pitchClass: 5 }, // F4, lin 53
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const g4: QuantizedNote = {
    id: 'g4',
    pitch: { octave: 4, pitchClass: 7 }, // G4, lin 55
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };

  const result = groupOnsetNotes([f3, g3, f4, g4]);
  assert.equal(result.clusters.length, 1, 'one 2-note cluster');
  const c = result.clusters[0];
  assert.deepEqual(c.shapeOffsets, [0, 2], '{F, G} offset pattern is [0, 2]');
  assert.equal(c.origin.baseLin, 41);
  assert.equal(c.origin.notes.length, 2);
  assert.equal(c.copies.length, 1);
  assert.equal(c.copies[0].baseLin, 53);
  assert.equal(c.copies[0].octaveOffset, 1);
  assert.equal(result.independentNotes.length, 0);

  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.equal(expanded.length, 4);
  assert.deepEqual(expanded, [f3, g3, f4, g4]);
});

test('groupOnsetNotes: independent B3 is excluded from shape scope and remains literal', () => {
  const f3: QuantizedNote = {
    id: 'f3',
    pitch: { octave: 3, pitchClass: 5 },
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const g3: QuantizedNote = {
    id: 'g3',
    pitch: { octave: 3, pitchClass: 7 },
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const b3: QuantizedNote = {
    id: 'b3',
    pitch: { octave: 3, pitchClass: 11 }, // B3, lin 47 (independent extra note)
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const f4: QuantizedNote = {
    id: 'f4',
    pitch: { octave: 4, pitchClass: 5 },
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };
  const g4: QuantizedNote = {
    id: 'g4',
    pitch: { octave: 4, pitchClass: 7 },
    startTick: 1536,
    durationTicks: 96,
    hand: 'RH',
    velocity: 100,
  };

  const result = groupOnsetNotes([f3, g3, b3, f4, g4]);
  assert.equal(result.clusters.length, 1, 'one cluster for {F, G}');
  assert.equal(result.independentNotes.length, 1, 'B3 is independent');
  assert.equal(result.independentNotes[0].id, 'b3');

  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.equal(expanded.length, 5);
  const ids = expanded.map((n) => n.id);
  assert.deepEqual(ids, ['f3', 'g3', 'b3', 'f4', 'g4']);
});

test('groupOnsetNotes: multi-register copies (m.66 D3/D4/D5 plus A2)', () => {
  const a2: QuantizedNote = {
    id: 'a2',
    pitch: { octave: 2, pitchClass: 9 }, // A2, lin 33 (independent)
    startTick: 12624,
    durationTicks: 48,
    hand: 'LH',
    velocity: 100,
  };
  const d3: QuantizedNote = {
    id: 'd3',
    pitch: { octave: 3, pitchClass: 2 }, // D3, lin 38
    startTick: 12624,
    durationTicks: 48,
    hand: 'LH',
    velocity: 100,
  };
  const d4: QuantizedNote = {
    id: 'd4',
    pitch: { octave: 4, pitchClass: 2 }, // D4, lin 50 (+10)
    startTick: 12624,
    durationTicks: 48,
    hand: 'LH',
    velocity: 100,
  };
  const d5: QuantizedNote = {
    id: 'd5',
    pitch: { octave: 5, pitchClass: 2 }, // D5, lin 62 (+20)
    startTick: 12624,
    durationTicks: 48,
    hand: 'LH',
    velocity: 100,
  };

  const result = groupOnsetNotes([a2, d3, d4, d5]);
  assert.equal(result.clusters.length, 1);
  const c = result.clusters[0];
  assert.equal(c.origin.baseLin, 38, 'D3 is origin');
  assert.equal(c.copies.length, 2, 'two copy occurrences');
  assert.equal(c.copies[0].octaveOffset, 1, '+10 displacement');
  assert.equal(c.copies[1].octaveOffset, 2, '+20 displacement');
  assert.equal(result.independentNotes.length, 1);
  assert.equal(result.independentNotes[0].id, 'a2', 'A2 is independent');

  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.equal(expanded.length, 4);
  assert.deepEqual(expanded, [a2, d3, d4, d5]);
});

test('groupOnsetNotes: mixed copy durations in m.9 (144 vs 192 ticks) are independently owned', () => {
  // In m.9: origin {F3, G3} has 144 ticks (dotted half); copy {F4, G4} has 192 ticks (whole note)
  const f3: QuantizedNote = {
    id: 'f3-m9',
    pitch: { octave: 3, pitchClass: 5 },
    startTick: 1728,
    durationTicks: 144,
    hand: 'RH',
    velocity: 100,
  };
  const g3: QuantizedNote = {
    id: 'g3-m9',
    pitch: { octave: 3, pitchClass: 7 },
    startTick: 1728,
    durationTicks: 144,
    hand: 'RH',
    velocity: 100,
  };
  const b3: QuantizedNote = {
    id: 'b3-m9',
    pitch: { octave: 3, pitchClass: 11 },
    startTick: 1728,
    durationTicks: 144,
    hand: 'RH',
    velocity: 100,
  };
  const f4: QuantizedNote = {
    id: 'f4-m9',
    pitch: { octave: 4, pitchClass: 5 },
    startTick: 1728,
    durationTicks: 192,
    hand: 'RH',
    velocity: 100,
  };
  const g4: QuantizedNote = {
    id: 'g4-m9',
    pitch: { octave: 4, pitchClass: 7 },
    startTick: 1728,
    durationTicks: 192,
    hand: 'RH',
    velocity: 100,
  };

  const result = groupOnsetNotes([f3, g3, b3, f4, g4]);
  assert.equal(result.clusters.length, 1);
  const c = result.clusters[0];
  assert.equal(c.origin.durationTicks, 144, 'origin occurrence retains 144 ticks');
  assert.equal(c.copies[0].durationTicks, 192, 'copy occurrence retains 192 ticks');
  assert.equal(result.independentNotes.length, 1);
  assert.equal(result.independentNotes[0].id, 'b3-m9');

  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.equal(expanded.length, 5);
  const origF3 = expanded.find((n) => n.id === 'f3-m9')!;
  const copyF4 = expanded.find((n) => n.id === 'f4-m9')!;
  assert.equal(origF3.durationTicks, 144);
  assert.equal(copyF4.durationTicks, 192);
});

test('groupOnsetNotes: nonrepeating control (m.8 second half) falls back with zero clusters', () => {
  // Four distinct non-repeating pitches at the same onset
  const notes: QuantizedNote[] = [
    { id: 'c3', pitch: { octave: 3, pitchClass: 0 }, startTick: 1632, durationTicks: 48, hand: 'RH', velocity: 100 },
    { id: 'e3', pitch: { octave: 3, pitchClass: 4 }, startTick: 1632, durationTicks: 48, hand: 'RH', velocity: 100 },
    { id: 'g3', pitch: { octave: 3, pitchClass: 7 }, startTick: 1632, durationTicks: 48, hand: 'RH', velocity: 100 },
    { id: 'b3', pitch: { octave: 3, pitchClass: 11 }, startTick: 1632, durationTicks: 48, hand: 'RH', velocity: 100 },
  ];

  const result = groupOnsetNotes(notes);
  assert.equal(result.clusters.length, 0, 'no clusters formed');
  assert.equal(result.independentNotes.length, 4, 'all notes remain independent');
  assert.equal(result.copyNoteIds.size, 0);

  const expanded = expandCompressedClusters(result.clusters, result.independentNotes);
  assert.deepEqual(expanded, notes);
});

// ---------------------------------------------------------------------------
// 2. Real-Engine Candidate Rendering & Invariants
// ---------------------------------------------------------------------------

test('Literal baseline: Brahms and Bach remain byte-identical to golden master under default options', () => {
  const literalOpts = optFor('literal');
  const t = tok();

  const brahmsLiteralSvg = renderJankoPage(BRAHMS, 0, literalOpts, t);
  const brahmsDefaultSvg = renderJankoPage(BRAHMS, 0, resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS), t);
  assert.equal(brahmsLiteralSvg, brahmsDefaultSvg, 'Brahms literal output matches default options byte-for-byte');

  const bachLiteralOpts = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    clusterCompression: 'literal',
  });
  const bachTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const bachLiteralSvg = renderJankoPage(BACH, 0, bachLiteralOpts, bachTokens);
  const bachDefaultSvg = renderJankoPage(BACH, 0, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), bachTokens);
  assert.equal(bachLiteralSvg, bachDefaultSvg, 'Bach literal output matches default options byte-for-byte');
});

test('Spatial Echo (Treatment A): renders origin enclosure, connector, echo marker, and suppresses copy noteheads', () => {
  const echoOpts = optFor('spatial-echo');
  const literalOpts = optFor('literal');
  const t = tok();

  // Brahms mm. 8–9 crop
  const echoCrop = renderJankoCrop(BRAHMS, 8, 2, echoOpts, t);
  const literalCrop = renderJankoCrop(BRAHMS, 8, 2, literalOpts, t);

  // 1. Genuinely different SVG output
  assert.notEqual(echoCrop, literalCrop, 'Spatial echo alters the rendered SVG');

  // 2. Contains Spatial Echo SVG components
  assert.match(echoCrop, /class="janko-echo-enclosure"/, 'renders origin enclosure bracket');
  assert.match(echoCrop, /class="janko-echo-connector"/, 'renders structural connector');
  assert.match(echoCrop, /class="janko-echo-marker"/, 'renders echo group marker');
  assert.match(echoCrop, /class="janko-compress-dur"/, 'renders duration cue glyphs');

  // 3. Notehead suppression: copy heads suppressed in mm. 8–9 (113 literal down to 109 in echo)
  const literalDigits = (literalCrop.match(/class="janko-digit"/g) ?? []).length;
  const echoDigits = (echoCrop.match(/class="janko-digit"/g) ?? []).length;
  assert.equal(literalDigits, 113, 'literal renders 113 notehead digits in mm. 8-9 crop');
  assert.ok(echoDigits < literalDigits, 'spatial echo suppresses copy noteheads');
  assert.equal(echoDigits, 109, 'spatial echo suppresses copy noteheads down to 109 digits');

  // 4. Independent note B3 ('B') remains rendered with full notehead
  assert.match(echoCrop, />B<\/text>/, 'independent note B3 notehead retained');

  // 5. m.9 duration cues: origin dotted half (144 ticks) and copy whole note (192 ticks)
  assert.match(echoCrop, /class="janko-compress-dot"/, 'm.9 origin dotted half has augmentation dot cue');
});

test('Compact Coupling (Treatment B): renders bounded additive badge (+10/+20) and suppresses copy noteheads', () => {
  const couplingOpts = optFor('compact-coupling');
  const literalOpts = optFor('literal');
  const t = tok();

  // Brahms mm. 8–9 crop
  const couplingCrop = renderJankoCrop(BRAHMS, 8, 2, couplingOpts, t);
  const literalCrop = renderJankoCrop(BRAHMS, 8, 2, literalOpts, t);

  // 1. Genuinely different SVG output
  assert.notEqual(couplingCrop, literalCrop, 'Compact coupling alters the rendered SVG');

  // 2. Contains Compact Coupling SVG components
  assert.match(couplingCrop, /class="janko-compact-coupling"/, 'renders compact coupling group');
  assert.match(couplingCrop, /class="janko-coupling-badge"/, 'renders bounded additive badge');
  assert.match(couplingCrop, /class="janko-coupling-label"/, 'renders additive displacement label');
  assert.match(couplingCrop, />\+10<\/text>/, 'duodecimal +10 displacement label present');

  // 3. Notehead suppression: suppresses copy heads in mm. 8–9 (113 down to 108)
  const literalDigits = (literalCrop.match(/class="janko-digit"/g) ?? []).length;
  const couplingDigits = (couplingCrop.match(/class="janko-digit"/g) ?? []).length;
  assert.ok(couplingDigits < literalDigits, 'compact coupling suppresses copy noteheads');
  assert.equal(couplingDigits, 108, 'compact coupling suppresses copy noteheads down to 108 digits');

  // 4. Independent note B3 ('B') remains rendered
  assert.match(couplingCrop, />B<\/text>/, 'independent note B3 notehead retained');
});

// ---------------------------------------------------------------------------
// 3. Collision Auditing and Fallback Tripwires
// ---------------------------------------------------------------------------

test('Linter registry: compression-collision check is registered (35 total checks)', () => {
  assert.ok(JANKO_LINT_CHECKS.includes('compression-collision'), 'compression-collision in lint catalog');
  assert.equal(JANKO_LINT_CHECKS.length, 35, '35 total engraving checks');
});

test('Candidate windows lint clean across all 4 declared windows', () => {
  const t = tok();
  for (const mode of ['literal', 'spatial-echo', 'compact-coupling'] as const) {
    const opts = optFor(mode);
    const report = lintJankoScore(BRAHMS, opts, t);
    // Verified: Brahms score lints clean with zero compression collisions
    const collisions = report.violations.filter((v) => v.code === 'compression-collision');
    assert.equal(collisions.length, 0, `${mode} has zero compression-collision violations`);
    assert.equal(report.ok, true, `${mode} full score lints completely clean`);
  }
});

test('checkCompressionInkCollisions: synthetic obstacle tripwire detects intentional collisions', () => {
  const cluster = {
    id: 'test-cluster',
    startTick: 0,
    hand: 'RH' as Hand,
    shapeOffsets: [0],
    origin: { notes: [], baseLin: 40, octaveOffset: 0, durationTicks: 96 },
    copies: [{ notes: [], baseLin: 52, octaveOffset: 1, durationTicks: 96 }],
    allNoteIds: new Set(['origin-1', 'copy-1']),
    copyNoteIds: new Set(['copy-1']),
  };

  // 1. Clear primitive
  const clearBox: [number, number, number, number][] = [[100, 200, 115, 210]];
  const barlineXs = [50, 150];
  const clearNotes: PositionedJankoNote[] = [];
  const clearResult = checkCompressionInkCollisions(cluster, clearBox, barlineXs, clearNotes, []);
  assert.equal(clearResult.collides, false, 'reports clear when no obstacle is in range');

  // 2. Barline collision tripwire
  const barlineCollideResult = checkCompressionInkCollisions(cluster, clearBox, [105], clearNotes, []);
  assert.equal(barlineCollideResult.collides, true, 'detects barline collision');
  assert.equal(barlineCollideResult.obstacle, 'barline');

  // 3. Notehead collision tripwire
  const collidingNote = {
    note: { id: 'obstacle-note', pitch: { octave: 4, pitchClass: 0 }, startTick: 24, durationTicks: 24, hand: 'RH', velocity: 100 },
    x: 108,
    y: 205,
    writtenLin: 48,
    rhythm: { id: 'obstacle-note', hand: 'RH', startTick: 24, durationTicks: 24, x: 108, y: 205 },
  } as unknown as PositionedJankoNote;
  const noteCollideResult = checkCompressionInkCollisions(cluster, clearBox, barlineXs, [collidingNote], []);
  assert.equal(noteCollideResult.collides, true, 'detects notehead collision');
  assert.equal(noteCollideResult.obstacle, 'notehead');
});

// ---------------------------------------------------------------------------
// 4. Registry & Round 35 Studio Contract
// ---------------------------------------------------------------------------

test('Registry: Round 35 is declared with three cards on four identical Brahms windows', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 35);
  assert.match(CURRENT_ROUND_METADATA.title, /compression/i);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['clusterCompression'], 'open axis is clusterCompression');
  assert.equal(CURRENT_CANDIDATES.length, 3, 'three cards: control, A, B');

  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(ids, [
    'cluster-compression-literal',
    'cluster-compression-spatial-echo',
    'cluster-compression-compact-coupling',
  ]);

  for (const cand of CURRENT_CANDIDATES) {
    assert.equal(cand.axis, 'clusterCompression', `${cand.id} declares clusterCompression axis`);
    assert.equal(cand.windows?.length, 4, `${cand.id} has four identical windows`);
    const winKeys = cand.windows!.map((w) => `${w.scoreId}:${w.measureStart}-${w.measureStart + w.measureCount - 1}`);
    assert.deepEqual(winKeys, [
      'brahms-op118-no1:8-9',
      'brahms-op118-no1:33-34',
      'brahms-op118-no1:46-47',
      'brahms-op118-no1:66-67',
    ], `${cand.id} covers mm.8–9, mm.33–34, mm.46–47, mm.66–67`);

    // Caption states grammar, learning cost, and fallback
    assert.ok(cand.description && cand.description.length > 30, `${cand.id} has substantive description`);
    if (cand.id !== 'cluster-compression-literal') {
      assert.match(cand.description!, /falls back/i, `${cand.id} documents literal fallback`);
      assert.match(cand.description!, /grammar/i, `${cand.id} documents grammar learning cost`);
    }
  }
});
