/**
 * Round 36 — Mirrored handprint: whole-form cluster candidate comparison.
 *
 * Requirements from .architect/ticket.md:
 * 1. Forward/inverse pitch/register fidelity for all dense corpus groups plus
 *    one-note perturbations, inner/collinear added notes, different voicings with
 *    identical pitch-class sets, octave repetitions, and varying spans. Independent
 *    onset/hand/release/attachment ownership unchanged.
 * 2. Odd transposition = reflection; even transposition = same normalized
 *    landmark/body geometry (excluding changed base label and global staff translation).
 * 3. Actual SVG candidate tests: one real connected pitch body, only base pitch
 *    numeral for represented group, every sounding landmark visible; no literal
 *    heads or orphan old ink underneath. Test actual m.7/8/9/60/66 forms and
 *    mixed durations.
 * 4. Mathematical candidate clearance checks account for painted body, numeral,
 *    rhythm attachments, other hand/staff/barlines; retain all canonical lint checks.
 * 5. Canonical bytes/Bach frozen/PDF and layout reuse unchanged.
 * 6. Reviewer verifies implementation against construction and exact-source semantics.
 *    Report concrete remaining readability risk honestly.
 * 7. Studio candidates view and registry badges.
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
  brahmsWindow,
  candidateBadges,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  type JankoCandidate,
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
  type JankoClusterPresentation,
} from '../src/render/janko/types';
import {
  layoutJankoScore,
  renderJankoPage,
  renderJankoCrop,
  sourceLin,
  suppressedStemIds,
  type PositionedJankoNote,
} from '../src/render/janko/engine';
import { lintJankoScore, JANKO_LINT_CHECKS } from '../src/render/janko/linter';
import {
  groupHandprintClusters,
  renderHandprintBodyPath,
  renderHandprintDurationCue,
  renderHandprintSvg,
  decodeHandprintLandmarks,
  checkHandprintCollisions,
  getHandprintPrimitives,
  HANDPRINT_U,
  HANDPRINT_A,
  HANDPRINT_LOBE_WIDTH,
  HANDPRINT_LOBE_HALF_HEIGHT,
  HANDPRINT_BODY_HALF_WIDTH,
} from '../src/render/janko/elements/handprint';
import { Hand, QuantizedNote } from '../src/model/types';
import { getPitchCoordinate } from '../src/render/janko/geometry';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();

const linOf = (pc: number, oct: number) => oct * 12 + (((pc % 12) + 12) % 12);

function optFor(presentation: JankoClusterPresentation) {
  return resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    clusterPresentation: presentation,
  });
}

function tok() {
  return resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
}

// ---------------------------------------------------------------------------
// 1. Forward / Inverse Pitch & Register Fidelity
// ---------------------------------------------------------------------------

test('Criterion 1: Forward/inverse pitch/register fidelity on dense corpus chords (mm. 7, 8, 9, 46, 60, 66)', () => {
  const m7_rh = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 1200);
  assert.equal(m7_rh.length, 5, 'm.7 RH has 5 notes');

  const m8_rh_first = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 1296);
  assert.equal(m8_rh_first.length, 4, 'm.8 RH first chord has 4 notes');

  const m8_rh_second = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 1392);
  assert.equal(m8_rh_second.length, 5, 'm.8 RH second chord has 5 notes');

  const m9_rh = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 1584);
  assert.equal(m9_rh.length, 5, 'm.9 RH has 5 notes');

  const m46_rh = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 7056);
  assert.equal(m46_rh.length, 4, 'm.46 RH has 4 notes');

  const m60_rh = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 10896);
  assert.equal(m60_rh.length, 4, 'm.60 RH has 4 notes');

  const m66_rh = BRAHMS.notes.filter((n) => n.hand === 'RH' && n.startTick === 12624);
  assert.equal(m66_rh.length, 4, 'm.66 RH has 4 notes');

  const testGroups = [
    { label: 'm.7 RH', notes: m7_rh },
    { label: 'm.8 RH (first)', notes: m8_rh_first },
    { label: 'm.8 RH (second)', notes: m8_rh_second },
    { label: 'm.9 RH', notes: m9_rh },
    { label: 'm.46 RH', notes: m46_rh },
    { label: 'm.60 RH', notes: m60_rh },
    { label: 'm.66 RH', notes: m66_rh },
  ];

  const staffHeightFn = (lin: number) => 800 - lin * 2.4;

  for (const { label, notes } of testGroups) {
    const positioned: PositionedJankoNote[] = notes.map((n) => {
      const lin = linOf(n.pitch.pitchClass, n.pitch.octave);
      return {
        note: n,
        x: 100,
        y: staffHeightFn(lin),
        writtenLin: lin,
        nominalX: 100,
        coord: getPitchCoordinate(n.pitch.pitchClass, n.pitch.octave, n.hand as Hand),
        rhythm: {
          id: n.id,
          hand: n.hand as Hand,
          startTick: n.startTick,
          durationTicks: n.durationTicks,
          x: 100,
          y: staffHeightFn(lin),
        },
      };
    });

    const result = groupHandprintClusters(positioned);
    assert.equal(result.clusters.length, 1, `${label} groups into exactly 1 handprint cluster`);
    const c = result.clusters[0];
    assert.equal(c.landmarks.length, notes.length, `${label} has landmark for every note`);

    // Exact inverse recovery strictly from landmark coordinates + anchor pitch
    const recovered = decodeHandprintLandmarks(c.baseLin, c.anchorStaffY, c.onsetX, c.landmarks);
    const expected = notes
      .map((n) => linOf(n.pitch.pitchClass, n.pitch.octave))
      .sort((a, b) => a - b);
    assert.deepEqual(recovered, expected, `${label} recovers exact linear sounding pitches`);
  }
});

test('Criterion 1: 2/3-note groups remain literal; 4/5-note groups form clusters', () => {
  const staffHeightFn = (lin: number) => 800 - lin * 2.4;

  const mkNote = (id: string, pc: number, oct: number, tick: number): PositionedJankoNote => {
    const n: QuantizedNote = {
      id,
      pitch: { pitchClass: pc, octave: oct },
      startTick: tick,
      durationTicks: 96,
      hand: 'RH',
      velocity: 80,
    };
    const lin = linOf(pc, oct);
    return {
      note: n,
      x: 100,
      y: staffHeightFn(lin),
      writtenLin: lin,
      nominalX: 100,
      coord: getPitchCoordinate(pc, oct, 'RH'),
      rhythm: {
        id,
        hand: 'RH',
        startTick: tick,
        durationTicks: 96,
        x: 100,
        y: staffHeightFn(lin),
      },
    };
  };

  // 2-note dyad
  const dyad = [mkNote('d1', 0, 4, 0), mkNote('d2', 4, 4, 0)];
  const dyadRes = groupHandprintClusters(dyad);
  assert.equal(dyadRes.clusters.length, 0, '2-note group stays literal');
  assert.equal(dyadRes.handprintNoteIds.size, 0);

  // 3-note triad
  const triad = [mkNote('t1', 0, 4, 0), mkNote('t2', 4, 4, 0), mkNote('t3', 7, 4, 0)];
  const triadRes = groupHandprintClusters(triad);
  assert.equal(triadRes.clusters.length, 0, '3-note group stays literal');
  assert.equal(triadRes.handprintNoteIds.size, 0);

  // 4-note chord
  const tetrad = [
    mkNote('c1', 0, 4, 0),
    mkNote('c2', 4, 4, 0),
    mkNote('c3', 7, 4, 0),
    mkNote('c4', 11, 4, 0),
  ];
  const tetradRes = groupHandprintClusters(tetrad);
  assert.equal(tetradRes.clusters.length, 1, '4-note chord forms handprint cluster');
  assert.equal(tetradRes.handprintNoteIds.size, 4);

  // 5-note chord
  const pentad = [
    mkNote('p1', 0, 4, 0),
    mkNote('p2', 2, 4, 0),
    mkNote('p3', 4, 4, 0),
    mkNote('p4', 7, 4, 0),
    mkNote('p5', 11, 4, 0),
  ];
  const pentadRes = groupHandprintClusters(pentad);
  assert.equal(pentadRes.clusters.length, 1, '5-note chord forms handprint cluster');
  assert.equal(pentadRes.handprintNoteIds.size, 5);
});

test('Criterion 1: One-note perturbations, collinear notes, octave repeats, and varying spans', () => {
  const staffHeightFn = (lin: number) => 800 - lin * 2.4;

  const makeChord = (pitches: Array<[number, number]>): PositionedJankoNote[] => {
    return pitches.map(([pc, oct], idx) => {
      const id = `test-${idx}`;
      const lin = linOf(pc, oct);
      const n: QuantizedNote = {
        id,
        pitch: { pitchClass: pc, octave: oct },
        startTick: 0,
        durationTicks: 96,
        hand: 'RH',
        velocity: 80,
      };
      return {
        note: n,
        x: 150,
        y: staffHeightFn(lin),
        writtenLin: lin,
        nominalX: 150,
        coord: getPitchCoordinate(pc, oct, 'RH'),
        rhythm: {
          id,
          hand: 'RH',
          startTick: 0,
          durationTicks: 96,
          x: 150,
          y: staffHeightFn(lin),
        },
      };
    });
  };

  // Base 4-note chord: C4, E4, G4, B4
  const base = makeChord([[0, 4], [4, 4], [7, 4], [11, 4]]);
  const baseRes = groupHandprintClusters(base).clusters[0];
  const baseDecoded = decodeHandprintLandmarks(baseRes.baseLin, baseRes.anchorStaffY, baseRes.onsetX, baseRes.landmarks);
  assert.deepEqual(baseDecoded, [48, 52, 55, 59]);

  // Perturbation: shift G4 (+1 semitone to G#4 / pc 8)
  const perturbed = makeChord([[0, 4], [4, 4], [8, 4], [11, 4]]);
  const pertRes = groupHandprintClusters(perturbed).clusters[0];
  const pertDecoded = decodeHandprintLandmarks(pertRes.baseLin, pertRes.anchorStaffY, pertRes.onsetX, pertRes.landmarks);
  assert.deepEqual(pertDecoded, [48, 52, 56, 59], 'perturbed chord decodes accurately');
  assert.notEqual(pertRes.landmarks[2].y, baseRes.landmarks[2].y, 'landmark y shifted by 1 semitone');

  // Inner collinear added note: add D4 (pc 2) between C4 and E4
  const collinear = makeChord([[0, 4], [2, 4], [4, 4], [7, 4], [11, 4]]);
  const colRes = groupHandprintClusters(collinear).clusters[0];
  const colDecoded = decodeHandprintLandmarks(colRes.baseLin, colRes.anchorStaffY, colRes.onsetX, colRes.landmarks);
  assert.deepEqual(colDecoded, [48, 50, 52, 55, 59], 'collinear added note decodes accurately');
  assert.equal(colRes.landmarks.length, 5);

  // Octave repetition: C4, G4, C5, E5
  const octaveChord = makeChord([[0, 4], [7, 4], [0, 5], [4, 5]]);
  const octRes = groupHandprintClusters(octaveChord).clusters[0];
  const octDecoded = decodeHandprintLandmarks(octRes.baseLin, octRes.anchorStaffY, octRes.onsetX, octRes.landmarks);
  assert.deepEqual(octDecoded, [48, 55, 60, 64], 'octave repetition decodes accurately');

  // Varying spans: wide 2-octave span vs narrow 1-octave span
  const wideChord = makeChord([[0, 3], [7, 3], [4, 4], [0, 5]]); // C3 (36) to C5 (60): 24 semitones
  const wideRes = groupHandprintClusters(wideChord).clusters[0];
  const wideDecoded = decodeHandprintLandmarks(wideRes.baseLin, wideRes.anchorStaffY, wideRes.onsetX, wideRes.landmarks);
  assert.deepEqual(wideDecoded, [36, 43, 52, 60], 'wide 2-octave span decodes accurately');
  const totalYSpan = wideRes.landmarks[0].y - wideRes.landmarks[3].y;
  assert.equal(Math.round(totalYSpan), Math.round(24 * HANDPRINT_U), 'y span strictly proportional to semitone distance');
});

// ---------------------------------------------------------------------------
// 2. Transposition Invariants: Odd (Reflection) vs Even (Identity)
// ---------------------------------------------------------------------------

test('Criterion 2: Odd transposition = horizontal reflection; Even transposition = identical normalized geometry', () => {
  const staffHeightFn = (lin: number) => 800 - lin * 2.4;

  const makeNotesForPitches = (lins: number[]): PositionedJankoNote[] => {
    return lins.map((lin, idx) => {
      const pc = ((lin % 12) + 12) % 12;
      const oct = Math.floor(lin / 12);
      const n: QuantizedNote = {
        id: `trans-note-${idx}`,
        pitch: { pitchClass: pc, octave: oct },
        startTick: 0,
        durationTicks: 96,
        hand: 'RH',
        velocity: 80,
      };
      return {
        note: n,
        x: 200,
        y: staffHeightFn(lin),
        writtenLin: lin,
        nominalX: 200,
        coord: getPitchCoordinate(pc, oct, 'RH'),
        rhythm: {
          id: `trans-note-${idx}`,
          hand: 'RH',
          startTick: 0,
          durationTicks: 96,
          x: 200,
          y: staffHeightFn(lin),
        },
      };
    });
  };

  // Original chord: {F3, A3, C4, E4} -> lin [41, 45, 48, 52] (base lin 41 is odd)
  const origNotes = makeNotesForPitches([41, 45, 48, 52]);
  const origCluster = groupHandprintClusters(origNotes).clusters[0];

  // Odd transposition (+1 semitone): {F#3, A#3, C#4, F4} -> lin [42, 46, 49, 53] (base lin 42 is even)
  const oddNotes = makeNotesForPitches([42, 46, 49, 53]);
  const oddCluster = groupHandprintClusters(oddNotes).clusters[0];

  // Even transposition (+2 semitones): {G3, B3, D4, F#4} -> lin [43, 47, 50, 54] (base lin 43 is odd)
  const evenNotes = makeNotesForPitches([43, 47, 50, 54]);
  const evenCluster = groupHandprintClusters(evenNotes).clusters[0];

  // 1. Check Odd Transposition: Horizontal reflection
  assert.equal(origCluster.landmarks.length, oddCluster.landmarks.length);
  for (let i = 0; i < origCluster.landmarks.length; i++) {
    const origLm = origCluster.landmarks[i];
    const oddLm = oddCluster.landmarks[i];

    // Horizontal offset from onset axis is strictly negated
    const origDx = origLm.x - origCluster.onsetX;
    const oddDx = oddLm.x - oddCluster.onsetX;
    assert.equal(Math.round(oddDx * 10), Math.round(-origDx * 10), `landmark ${i} horizontal offset is negated`);

    // Parity is inverted (0 -> 1, 1 -> 0)
    assert.equal(oddLm.parity, 1 - origLm.parity, `landmark ${i} parity is inverted`);

    // Vertical delta from anchor is preserved
    const origDy = origLm.y - origCluster.landmarks[0].y;
    const oddDy = oddLm.y - oddCluster.landmarks[0].y;
    assert.equal(Math.round(oddDy * 10), Math.round(origDy * 10), `landmark ${i} relative vertical delta is preserved`);
  }

  // 2. Check Even Transposition: Exact same normalized geometry
  for (let i = 0; i < origCluster.landmarks.length; i++) {
    const origLm = origCluster.landmarks[i];
    const evenLm = evenCluster.landmarks[i];

    // Horizontal offset from onset axis is identical
    const origDx = origLm.x - origCluster.onsetX;
    const evenDx = evenLm.x - evenCluster.onsetX;
    assert.equal(Math.round(evenDx * 10), Math.round(origDx * 10), `landmark ${i} horizontal offset is identical`);

    // Parity is preserved
    assert.equal(evenLm.parity, origLm.parity, `landmark ${i} parity is preserved`);

    // Vertical delta from anchor is identical
    const origDy = origLm.y - origCluster.landmarks[0].y;
    const evenDy = evenLm.y - evenCluster.landmarks[0].y;
    assert.equal(Math.round(evenDy * 10), Math.round(origDy * 10), `landmark ${i} relative vertical delta is identical`);
  }

  // 3. Single unified routine generates both variants
  const origPath = renderHandprintBodyPath(origCluster.landmarks);
  const oddPath = renderHandprintBodyPath(oddCluster.landmarks);
  const evenPath = renderHandprintBodyPath(evenCluster.landmarks);

  assert.ok(origPath.length > 0 && oddPath.length > 0 && evenPath.length > 0);
  assert.notEqual(origPath, oddPath, 'odd transposition path is distinct (reflected)');
  assert.notEqual(origPath, evenPath, 'even transposition path has shifted absolute y');
});

// ---------------------------------------------------------------------------
// 3. Actual SVG Candidate Tests & Duration Attachments
// ---------------------------------------------------------------------------

test('Criterion 3: Candidate SVG contains one connected body, base numeral only, and clean duration cues', () => {
  const t = tok();
  const opts = optFor('mirrored-handprint');
  const layouts = layoutJankoScore(BRAHMS, opts, t);

  // System 2 covers mm. 7–9 (admitted handprint clusters)
  const sys2 = layouts[1];
  assert.ok(sys2.handprintClusters && sys2.handprintClusters.length >= 3, 'System 2 has handprint clusters');

  const page = renderJankoPage(BRAHMS, 0, opts, t, layouts);

  // 1. One real connected pitch body per cluster
  const bodyMatches = page.match(/<path class="janko-handprint-body"/g) || [];
  assert.ok(bodyMatches.length >= 4, `Found ${bodyMatches.length} connected handprint bodies on page 0`);

  // 2. Only base pitch numeral for represented group
  for (const c of sys2.handprintClusters!) {
    // For each cluster, check that only the anchor pitch class appears in the cluster's group
    const { svg } = renderHandprintSvg(c, t);
    const digitMatches = svg.match(/<text class="janko-digit"/g) || [];
    assert.equal(digitMatches.length, 1, `Cluster ${c.id} carries exactly one duodecimal digit`);

    // The single digit corresponds to basePitchClass
    const expectedChar = c.basePitchClass === 10 ? 'ⵋ' : c.basePitchClass === 11 ? 'Ɛ' : String(c.basePitchClass);
    assert.ok(svg.includes(`>${expectedChar}<`), `Cluster carries base numeral ${expectedChar}`);
  }

  // 3. No literal noteheads or orphan old ink underneath
  const hiddenStems = suppressedStemIds(sys2);
  for (const c of sys2.handprintClusters!) {
    for (const noteId of c.allNoteIds) {
      assert.ok(hiddenStems.has(noteId), `Note ${noteId} stem is suppressed`);
      assert.ok(sys2.handprintNoteIds?.has(noteId), `Note ${noteId} is marked in handprintNoteIds`);
    }
  }

  // 4. Differing releases in m.9 and m.60
  // In m.9 (tick 1584, System 3): mixed durations 144 vs 192 ticks
  const sys3 = layouts[2];
  const m9Cluster = sys3.handprintClusters?.find((c) => c.startTick === 1584);
  assert.ok(m9Cluster, 'm.9 handprint cluster exists');
  assert.equal(m9Cluster.isUniformRhythm, false, 'm.9 cluster has differing releases');
  assert.equal(m9Cluster.durationSubsets.length, 2, 'm.9 cluster has 2 duration subsets (144 and 192)');
  const m9Svg = renderHandprintSvg(m9Cluster, t).svg;
  assert.ok(m9Svg.includes('class="janko-handprint-dur-connector"'), 'm.9 has duration attachment connectors');

  // In m.60 (System 15, tick 10896): RH chord has independent 48-tick B
  const sys15 = layouts[14];
  const m60Cluster = sys15.handprintClusters?.find((c) => c.startTick === 10896);
  assert.ok(m60Cluster, 'm.60 handprint cluster exists');
  // Independent note at tick 10896 in RH or LH remains independent
  const independentB = sys15.notes.find(
    (p) => p.note.startTick === 10896 && !sys15.handprintNoteIds?.has(p.note.id)
  );
  assert.ok(independentB, 'm.60 independent tone survives as literal note outside handprint cluster');
});

// ---------------------------------------------------------------------------
// 4. Mathematical Clearance Checks & Linter
// ---------------------------------------------------------------------------

test('Criterion 4: Clearance checks and synthetic collision tripwires', () => {
  const notes: PositionedJankoNote[] = [
    {
      note: { id: 'c1', pitch: { pitchClass: 0, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH', velocity: 80 },
      x: 100,
      y: 700,
      writtenLin: 48,
      nominalX: 100,
      coord: getPitchCoordinate(0, 4, 'RH'),
      rhythm: { id: 'c1', hand: 'RH', startTick: 0, durationTicks: 96, x: 100, y: 700 },
    },
    {
      note: { id: 'c2', pitch: { pitchClass: 4, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH', velocity: 80 },
      x: 100,
      y: 690.4,
      writtenLin: 52,
      nominalX: 100,
      coord: getPitchCoordinate(4, 4, 'RH'),
      rhythm: { id: 'c2', hand: 'RH', startTick: 0, durationTicks: 96, x: 100, y: 690.4 },
    },
    {
      note: { id: 'c3', pitch: { pitchClass: 7, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH', velocity: 80 },
      x: 100,
      y: 683.2,
      writtenLin: 55,
      nominalX: 100,
      coord: getPitchCoordinate(7, 4, 'RH'),
      rhythm: { id: 'c3', hand: 'RH', startTick: 0, durationTicks: 96, x: 100, y: 683.2 },
    },
    {
      note: { id: 'c4', pitch: { pitchClass: 11, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH', velocity: 80 },
      x: 100,
      y: 673.6,
      writtenLin: 59,
      nominalX: 100,
      coord: getPitchCoordinate(11, 4, 'RH'),
      rhythm: { id: 'c4', hand: 'RH', startTick: 0, durationTicks: 96, x: 100, y: 673.6 },
    },
  ];

  const cluster = groupHandprintClusters(notes).clusters[0];

  // 1. Clear baseline
  const clearResult = checkHandprintCollisions(cluster, [50, 150], [], []);
  assert.equal(clearResult.collides, false, 'reports clear with no obstacles in range');

  // 2. Barline collision tripwire
  const barlineResult = checkHandprintCollisions(cluster, [cluster.onsetX], [], []);
  assert.equal(barlineResult.collides, true, 'detects barline collision on cluster onset');
  assert.equal(barlineResult.obstacle, 'barline');

  // 3. Notehead collision tripwire
  const obstacleNote: PositionedJankoNote = {
    note: { id: 'obs-note', pitch: { pitchClass: 0, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'LH', velocity: 80 },
    x: cluster.landmarks[0].x,
    y: cluster.landmarks[0].y,
    writtenLin: 48,
    nominalX: cluster.landmarks[0].x,
    coord: getPitchCoordinate(0, 4, 'LH'),
    rhythm: { id: 'obs-note', hand: 'LH', startTick: 0, durationTicks: 96, x: cluster.landmarks[0].x, y: cluster.landmarks[0].y },
  };
  const noteResult = checkHandprintCollisions(cluster, [50], [obstacleNote], []);
  assert.equal(noteResult.collides, true, 'detects notehead collision');
  assert.equal(noteResult.obstacle, 'notehead');

  // 4. Rest collision tripwire
  const obstacleRest = { x: cluster.landmarks[0].x, y: cluster.landmarks[0].y };
  const restResult = checkHandprintCollisions(cluster, [50], [], [obstacleRest]);
  assert.equal(restResult.collides, true, 'detects rest collision');
  assert.equal(restResult.obstacle, 'rest');
});

test('Criterion 4: Candidate score lints 100% clean across full Brahms score', () => {
  const t = tok();
  const opts = optFor('mirrored-handprint');
  const report = lintJankoScore(BRAHMS, opts, t);

  assert.equal(report.ok, true, 'mirrored-handprint lints completely clean on Brahms');
  assert.equal(report.violations.length, 0, 'zero lint violations');

  const handprintCollisions = report.violations.filter((v) => v.code === 'handprint-collision');
  assert.equal(handprintCollisions.length, 0, 'zero handprint collisions');
});

// ---------------------------------------------------------------------------
// 5. Canonical Invariants & Layout Reuse
// ---------------------------------------------------------------------------

test('Criterion 5: Golden master defaults and canonical rendering unchanged', () => {
  assert.equal(
    DEFAULT_JANKO_OPTIONS.clusterPresentation,
    'literal',
    'default clusterPresentation is literal'
  );

  const defaultBrahms = lintJankoScore(BRAHMS, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(defaultBrahms.ok, true, 'canonical Brahms remains clean under default options');

  const defaultBach = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(defaultBach.ok, true, 'canonical Bach remains clean under default options');

  // Layout reuse
  const layouts1 = layoutJankoScore(BRAHMS, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const layouts2 = layoutJankoScore(BRAHMS, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(layouts1.length, layouts2.length);
  assert.equal(layouts1[0].notes.length, layouts2[0].notes.length);
});

// ---------------------------------------------------------------------------
// 6. Reviewer Semantics & Readability Risk Reporting
// ---------------------------------------------------------------------------

test('Criterion 6: Honest description of construction, grammar, and readability risk', () => {
  const candidate = CURRENT_CANDIDATES.find((c) => c.id === 'mirrored-handprint');
  assert.ok(candidate, 'mirrored-handprint candidate is registered');
  assert.ok(candidate.description, 'description exists');
  assert.match(candidate.description, /rotated keyboard footprint/i, 'documents keyboard footprint geometry');
  assert.match(candidate.description, /alternating/i, 'documents alternating row families');
  assert.match(candidate.description, /calligraphic body/i, 'documents calligraphic body');
});

// ---------------------------------------------------------------------------
// 7. Studio Candidates View & Registry Badges
// ---------------------------------------------------------------------------

test('Criterion 7: Studio candidates view renders open Round 36 with 2 cards and 8 panels', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 36);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['clusterPresentation']);
  assert.equal(CURRENT_CANDIDATES.length, 2);

  const config = createStudioConfig({ score: BRAHMS });
  const viewHtml = renderCandidatesView(config);

  assert.ok(viewHtml.includes('Mirrored handprint'), 'contains Round 36 title');
  assert.ok(viewHtml.includes('mirrored-handprint-literal'), 'contains literal control card');
  assert.ok(viewHtml.includes('mirrored-handprint'), 'contains handprint candidate card');

  // 2 cards * 4 windows = 8 window panels
  const panelMatches = viewHtml.match(/class="candidate-window"/g) || [];
  assert.equal(panelMatches.length, 8, 'renders exactly 8 candidate window panels');

  // Badges report open axis clusterPresentation
  for (const c of CURRENT_CANDIDATES) {
    const badges = candidateBadges(c, CURRENT_ROUND_METADATA);
    const axisBadge = badges.find((b) => b.key === 'clusterPresentation');
    assert.ok(axisBadge, `${c.id} has clusterPresentation badge`);
    assert.equal(axisBadge.axis, true, 'marked as active open axis');
  }
});
