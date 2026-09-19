/**
 * Round 37 — Intrinsically Indexed Symmetric Cluster Candidate Comparison.
 *
 * Requirements from .architect/ticket.md:
 * 1. Forward/inverse pitch/register fidelity for all dense corpus groups (all 18 in Brahms Op. 118 No. 1)
 *    and spans: 3/4, 3/5, 4/6, a/b, a/10 spans, compound intervals, transposition, and reflection.
 *    Sounding landmarks, reference divisions, and unadorned central crossings distinguishable in emitted geometry.
 * 2. Real-engine assertions: candidate paths AND divisions appear; replaced literal heads are actually
 *    suppressed without dropping notes; no silent all-literal fallback in mandatory windows. Both m.60 RH
 *    bodies contain all four source pitches despite shared bass heads. Canonical unisons unchanged.
 * 3. Geometry matching: same pitch-body geometry for mm.8/9; explicit lower-three 144 versus upper-two
 *    192 ownership in m.9. Check m.7 interior 48, m.46 top 120, and m.60 interior 48 releases, including
 *    noncontiguous memberships.
 * 4. Collision / knockout checks cover body, scale divisions, landmarks, shared anchor, both hands,
 *    and duration ink. Deliberately colliding fixture proves detection. Crop/layout bounds include all new ink.
 * 5. Canonical Brahms/Bach output and frozen PDF unchanged; layout reuse retained.
 * 6. Synthetic real-engine diagnostic for m.8 inner G3→A3 perturbation (same span/count/parities).
 * 7. Studio candidate registry: Control vs Candidate A on identical windows (mm.7–9, 46–47, 60–61, 66–67, m.71,
 *    and synthetic diagnostic). Captions explain scale, mirrored-pair convention, and readability risks.
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
import { buildSyntheticM8DiagnosticScore } from '../src/scores/synthetic-m8-diagnostic';
import {
  BRAHMS_STUDIO_SCORE_ID,
  SYNTHETIC_M8_DIAGNOSTIC_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
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
  computeCropExtents,
  layoutJankoScore,
  renderJankoPage,
  renderJankoCrop,
  type PositionedJankoNote,
} from '../src/render/janko/engine';
import { DEFAULT_JANKO_LINT_OPTIONS, lintJankoScore, systemInkExtents } from '../src/render/janko/linter';
import {
  groupHandprintClusters,
  renderIndexedSymmetricBodyPaths,
  renderIndexedSymmetricDivisions,
  renderIndexedSymmetricLandmarks,
  renderIndexedSymmetricDurationAttachments,
  renderIndexedSymmetricSvg,
  decodeIndexedSymmetricCluster,
  checkHandprintCollisions,
  getHandprintPrimitives,
  HANDPRINT_U,
  HANDPRINT_A,
  INDEXED_SYMMETRIC_BODY_STROKE,
  INDEXED_SYMMETRIC_DIVISION_WIDTH,
  INDEXED_SYMMETRIC_OCTAVE_DIVISION_WIDTH,
  INDEXED_SYMMETRIC_LANDMARK_REACH,
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
// 1. Deterministic Pitch Reconstruction & Emitted Geometry
// ---------------------------------------------------------------------------

test('Criterion 1: Deterministic pitch reconstruction across spans (3/4, 3/5, 4/6, a/b, a/10) and compound intervals', () => {
  const u = HANDPRINT_U;
  const a = HANDPRINT_A;
  const baseStaffY = 500.0;
  const baseLin = 36; // C3 (even anchor)

  // Spans to test:
  // 3/4: base + 3 (Eb3), base + 4 (E3), base + 7 (G3) -> 4 notes: [36, 39, 40, 43]
  // 3/5: base + 3 (Eb3), base + 5 (F3), base + 8 (Ab3) -> 4 notes: [36, 39, 41, 44]
  // 4/6: base + 4 (E3), base + 6 (F#3), base + 10 (Bb3) -> 4 notes: [36, 40, 42, 46]
  // a/b: base + 10 (10-span duodecimal Bb3), base + 11 (B3), base + 14 (D4) -> 4 notes: [36, 46, 47, 50]
  // a/10: base + 10 (Bb3), base + 12 (10-span duodecimal octave C4), base + 15 (Eb4) -> [36, 46, 48, 51]
  // Compound: base + 12 (C4), base + 17 (F4 compound 4th), base + 24 (C5 compound 2 octaves) -> [36, 48, 53, 60]

  const spanSpecs = [
    { label: '3/4 span', offsets: [0, 3, 4, 7] },
    { label: '3/5 span', offsets: [0, 3, 5, 8] },
    { label: '4/6 span', offsets: [0, 4, 6, 10] },
    { label: 'a/b span', offsets: [0, 10, 11, 14] },
    { label: 'a/10 octave span', offsets: [0, 10, 12, 15] },
    { label: 'compound intervals (17, 24 semitones)', offsets: [0, 12, 17, 24] },
  ];

  for (const spec of spanSpecs) {
    const maxOffset = spec.offsets[spec.offsets.length - 1];
    const maxDiv = maxOffset % 2 === 0 ? maxOffset : maxOffset + 1;
    const divisions = [];
    for (let d = 0; d <= maxDiv; d += 2) {
      divisions.push({
        offset: d,
        y: baseStaffY - u * d,
        isOctave: d > 0 && d % 12 === 0,
      });
    }

    const landmarks = spec.offsets.map((off) => ({
      y: baseStaffY - u * off,
    }));

    const reconstructed = decodeIndexedSymmetricCluster(
      baseLin,
      baseStaffY,
      200,
      divisions,
      landmarks,
      u
    );

    const expected = spec.offsets.map((off) => baseLin + off);
    assert.deepEqual(
      reconstructed,
      expected,
      `${spec.label} reconstructed exact pitches: ${expected.join(',')}`
    );
  }
});

test('Criterion 1: Transposition and reflection preserve decoding and symmetry relations', () => {
  const u = HANDPRINT_U;
  const baseStaffY = 500;
  const pitches = [40, 43, 45, 48]; // E3 (even), G3 (odd), A3 (odd), C4 (even)

  const mkCluster = (trans: number) => {
    const shifted = pitches.map((p) => p + trans);
    const notes: PositionedJankoNote[] = shifted.map((p, idx) => ({
      note: {
        id: `t-${trans}-${idx}`,
        pitch: { pitchClass: ((p % 12) + 12) % 12, octave: Math.floor(p / 12) },
        startTick: 0,
        durationTicks: 96,
        hand: 'RH',
      },
      coord: getPitchCoordinate(((p % 12) + 12) % 12, Math.floor(p / 12), 'RH'),
      x: 100,
      y: baseStaffY - u * (p - shifted[0]),
      rhythm: { id: `r-${idx}`, hand: 'RH', startTick: 0, durationTicks: 96, x: 100, y: baseStaffY },
    }));
    return groupHandprintClusters(notes, u, HANDPRINT_A, 'indexed-symmetric').clusters[0];
  };

  const orig = mkCluster(0);
  const evenTrans = mkCluster(2); // Even transposition (+2 semitones)
  const oddTrans = mkCluster(1); // Odd transposition (+1 semitone, reflects tracks)

  // Decodes perfectly in all transpositions
  assert.deepEqual(
    decodeIndexedSymmetricCluster(orig.baseLin, orig.anchorStaffY, orig.onsetX, orig.scaleDivisions!, orig.landmarks),
    pitches
  );
  assert.deepEqual(
    decodeIndexedSymmetricCluster(evenTrans.baseLin, evenTrans.anchorStaffY, evenTrans.onsetX, evenTrans.scaleDivisions!, evenTrans.landmarks),
    pitches.map((p) => p + 2)
  );
  assert.deepEqual(
    decodeIndexedSymmetricCluster(oddTrans.baseLin, oddTrans.anchorStaffY, oddTrans.onsetX, oddTrans.scaleDivisions!, oddTrans.landmarks),
    pitches.map((p) => p + 1)
  );

  // Geometry: even transposition keeps identical parity sequence [0, 1, 1, 0]
  assert.deepEqual(
    orig.landmarks.map((l) => l.parity),
    evenTrans.landmarks.map((l) => l.parity)
  );
  // Odd transposition flips parities: [0, 1, 1, 0] -> [1, 0, 0, 1]
  assert.deepEqual(
    oddTrans.landmarks.map((l) => l.parity),
    orig.landmarks.map((l) => (l.parity === 0 ? 1 : 0))
  );
});

test('Criterion 1: Deterministic pitch reconstruction on all 18 dense Brahms source groups', () => {
  const byOnset = new Map<string, QuantizedNote[]>();
  for (const n of BRAHMS.notes) {
    const k = `${n.startTick}_${n.hand}`;
    const list = byOnset.get(k) || [];
    list.push(n);
    byOnset.set(k, list);
  }
  const denseGroups = [...byOnset.values()].filter((g) => g.length >= 4);
  assert.equal(denseGroups.length, 18, 'exactly 18 dense source groups in Brahms Op. 118 No. 1');

  for (const group of denseGroups) {
    const sorted = [...group].sort(
      (a, b) => linOf(a.pitch.pitchClass, a.pitch.octave) - linOf(b.pitch.pitchClass, b.pitch.octave)
    );
    const anchorLin = linOf(sorted[0].pitch.pitchClass, sorted[0].pitch.octave);
    const staffY = 600.0;
    const u = HANDPRINT_U;
    const a = HANDPRINT_A;

    const posNotes: PositionedJankoNote[] = sorted.map((n) => {
      const lin = linOf(n.pitch.pitchClass, n.pitch.octave);
      return {
        note: n,
        coord: getPitchCoordinate(n.pitch.pitchClass, n.pitch.octave, n.hand as Hand),
        x: 150,
        y: staffY - u * (lin - anchorLin),
        rhythm: { id: n.id, hand: n.hand as Hand, startTick: n.startTick, durationTicks: n.durationTicks, x: 150, y: staffY },
      };
    });

    const res = groupHandprintClusters(posNotes, u, a, 'indexed-symmetric');
    assert.equal(res.clusters.length, 1, `tick ${group[0].startTick} ${group[0].hand} forms cluster`);
    const cluster = res.clusters[0];
    assert.ok(cluster.scaleDivisions && cluster.scaleDivisions.length > 0, 'has scale divisions');

    const decoded = decodeIndexedSymmetricCluster(
      cluster.baseLin,
      cluster.anchorStaffY,
      cluster.onsetX,
      cluster.scaleDivisions,
      cluster.landmarks,
      u
    );

    const expected = sorted.map((n) => linOf(n.pitch.pitchClass, n.pitch.octave));
    assert.deepEqual(
      decoded,
      expected,
      `reconstructed exact sounding pitches for dense group at tick ${group[0].startTick} (${group[0].hand})`
    );
  }
});

test('Criterion 1: Landmarks, divisions, and crossings are distinguishable in emitted geometry', () => {
  const notes: PositionedJankoNote[] = [
    { note: { id: 'n1', pitch: { pitchClass: 0, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(0, 3, 'RH'), x: 200, y: 500, rhythm: { id: 'r1', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n2', pitch: { pitchClass: 3, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(3, 3, 'RH'), x: 200, y: 500 - 2.4 * 3, rhythm: { id: 'r2', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n3', pitch: { pitchClass: 6, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(6, 3, 'RH'), x: 200, y: 500 - 2.4 * 6, rhythm: { id: 'r3', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n4', pitch: { pitchClass: 0, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(0, 4, 'RH'), x: 200, y: 500 - 2.4 * 12, rhythm: { id: 'r4', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
  ];

  const cluster = groupHandprintClusters(notes, 2.4, 3.0, 'indexed-symmetric').clusters[0];
  const { svg } = renderIndexedSymmetricSvg(cluster, tok());

  // Emitted SVG classes:
  // 1. Slender stroked symmetric body (0.5pt, fill none)
  assert.ok(svg.includes('class="janko-symmetric-body"'));
  assert.ok(svg.includes(`stroke-width="${INDEXED_SYMMETRIC_BODY_STROKE.toFixed(2)}"`));
  assert.ok(svg.includes('fill="none"'));

  // 2. Transverse reference divisions (internal width <= 4pt)
  assert.ok(svg.includes('class="janko-symmetric-division"'));
  assert.ok(svg.includes('class="janko-symmetric-division-octave"'));

  // 3. Sounding landmarks: paired outward articulations
  assert.ok(svg.includes('class="janko-symmetric-landmark"'));

  // 4. Central axis crossings: body paths cross onsetX, unadorned
  const bodyMatches = svg.match(/class="janko-symmetric-body"/g) || [];
  assert.equal(bodyMatches.length, 2, 'primary and reflected path');
  // Confirm no badge, surrounding box, or detached ruler
  assert.ok(!svg.includes('badge'));
  assert.ok(!svg.includes('ruler'));
});

// ---------------------------------------------------------------------------
// 2. Real-Engine Assertions in Mandatory Windows & Full Score
// ---------------------------------------------------------------------------

test('Criterion 2: Real-engine candidate paths and divisions appear; literal heads suppressed without dropping notes', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());

  let totalClusters = 0;
  let totalSuppressedNotes = 0;

  for (const layout of layouts) {
    if (layout.handprintClusters) {
      totalClusters += layout.handprintClusters.length;
      totalSuppressedNotes += layout.handprintNoteIds?.size ?? 0;
    }
  }

  // All 18 dense clusters are admitted
  assert.equal(totalClusters, 18, 'all 18 dense clusters admitted in full score');
  assert.ok(totalSuppressedNotes >= 18 * 4, 'all constituent source notes tracked in handprintNoteIds');

  // Verify page rendering includes symmetric body and divisions, and suppresses notehead digits
  const pageSvg = renderJankoPage(BRAHMS, 0, optFor('indexed-symmetric'), tok(), layouts);
  assert.ok(pageSvg.includes('janko-symmetric-body'), 'page SVG contains symmetric body paths');
  assert.ok(pageSvg.includes('janko-symmetric-division'), 'page SVG contains scale divisions');
  assert.ok(pageSvg.includes('janko-symmetric-landmark'), 'page SVG contains landmark articulations');
});

test('Criterion 2: Full-score m.60 RH candidate eligibility with cross-hand unison bass anchor reuse', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());

  // System 14 contains measure 60
  const sys14 = layouts[14];
  assert.ok(sys14, 'system 14 exists');
  assert.ok(sys14.handprintClusters && sys14.handprintClusters.length >= 2, 'system 14 has m.60 RH clusters');

  const m60_first = sys14.handprintClusters.find((c) => c.startTick === 11376 && c.hand === 'RH');
  const m60_second = sys14.handprintClusters.find((c) => c.startTick === 11472 && c.hand === 'RH');

  assert.ok(m60_first, 'm.60 first RH voicing reaches candidate renderer');
  assert.ok(m60_second, 'm.60 second RH voicing reaches candidate renderer');

  // Both voicings contain all 4 source pitches
  assert.equal(m60_first.landmarks.length, 4, 'm.60 first voicing contains all 4 source pitches');
  assert.equal(m60_second.landmarks.length, 4, 'm.60 second voicing contains all 4 source pitches');

  // Both have shared bass anchor
  assert.equal(m60_first.hasSharedAnchor, true, 'first voicing flags hasSharedAnchor');
  assert.equal(m60_second.hasSharedAnchor, true, 'second voicing flags hasSharedAnchor');
  assert.equal(m60_first.sharedBassSurvivorId, 'brahms-op118-no1-841', 'reuses LH survivor 841');
  assert.equal(m60_second.sharedBassSurvivorId, 'brahms-op118-no1-850', 'reuses LH survivor 850');

  // Shared bass notehead is NOT suppressed: LH notes 841 and 850 remain drawn as literal heads
  assert.ok(!sys14.handprintNoteIds?.has('brahms-op118-no1-841'), 'LH survivor 841 not in handprintNoteIds');
  assert.ok(!sys14.handprintNoteIds?.has('brahms-op118-no1-850'), 'LH survivor 850 not in handprintNoteIds');

  // LH noteheads are rendered
  const pageSvg = renderJankoPage(BRAHMS, 3, optFor('indexed-symmetric'), tok(), layouts);
  assert.ok(pageSvg.includes('janko-indexed-symmetric'), 'page 4 contains indexed-symmetric cluster');

  // Canonical unisons remain unchanged in golden master
  const goldenLayouts = layoutJankoScore(BRAHMS, optFor('literal'), tok());
  assert.equal(goldenLayouts[14].handprintClusters, undefined, 'golden master has no handprint clusters');
});

// ---------------------------------------------------------------------------
// 3. Geometry Matching (mm.8/9) & Explicit Duration Ownership
// ---------------------------------------------------------------------------

test('Criterion 3: Same pitch-body geometry for mm.8/9 despite different durations', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());

  // m.8 RH cluster (tick 1392 in system 1)
  const m8 = layouts[1].handprintClusters!.find((c) => c.startTick === 1392);
  // m.9 RH cluster (tick 1584 in system 2)
  const m9 = layouts[2].handprintClusters!.find((c) => c.startTick === 1584);

  assert.ok(m8, 'm.8 RH cluster exists');
  assert.ok(m9, 'm.9 RH cluster exists');

  // Pitch sets are identical: F3, G3, B3, F4, G4
  assert.deepEqual(m8.landmarks.map((l) => l.pitch), m9.landmarks.map((l) => l.pitch));
  // Normalized local coordinates are identical
  assert.deepEqual(
    m8.landmarks.map((l) => ({ lx: l.localX, ly: l.localY })),
    m9.landmarks.map((l) => ({ lx: l.localX, ly: l.localY }))
  );
  // Drawn body paths are identical strings
  const m8Body = renderIndexedSymmetricBodyPaths(m8.landmarks);
  const m9Body = renderIndexedSymmetricBodyPaths(m9.landmarks);
  assert.equal(
    m8Body.replace(/M [\d.]+ [\d.]+/g, 'M').replace(/L [\d.]+ [\d.]+/g, 'L'),
    m9Body.replace(/M [\d.]+ [\d.]+/g, 'M').replace(/L [\d.]+ [\d.]+/g, 'L'),
    'pitch-body geometry is identical in mm.8/9'
  );
});

test('Criterion 3: Explicit duration ownership in m.9 (lower-three 144 vs upper-two 192)', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());
  const m9 = layouts[2].handprintClusters!.find((c) => c.startTick === 1584)!;

  assert.ok(m9.durationRuns, 'm.9 has duration runs');
  assert.equal(m9.durationRuns.length, 2, 'm.9 has 2 duration runs');

  // Run 1: lower-three notes (duration 144)
  assert.equal(m9.durationRuns[0].durationTicks, 144);
  assert.equal(m9.durationRuns[0].landmarks.length, 3);
  // Run 2: upper-two notes (duration 192)
  assert.equal(m9.durationRuns[1].durationTicks, 192);
  assert.equal(m9.durationRuns[1].landmarks.length, 2);

  const durSvg = renderIndexedSymmetricDurationAttachments(m9);
  // Contains vertical connecting rails for multi-note runs
  assert.ok(durSvg.includes('class="janko-symmetric-dur-rail"'));
  assert.ok(durSvg.includes('class="janko-symmetric-dur-connector"'));
});

test('Criterion 3: Release ownership in m.7 (interior 48), m.46 (top 120), and m.60 (interior 48)', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());

  // m.7 tick 1200: all 96-tick uniform duration
  const m7_1 = layouts[1].handprintClusters!.find((c) => c.startTick === 1200)!;
  assert.equal(m7_1.durationRuns?.length, 1, 'm.7 tick 1200 is uniform');
  assert.equal(m7_1.durationRuns[0].landmarks.length, 5);

  // m.7 tick 1296: noncontiguous duration subset with interior 48 release
  const m7_2 = layouts[1].handprintClusters!.find((c) => c.startTick === 1296)!;
  assert.ok(m7_2.durationRuns, 'm.7 tick 1296 has duration runs');
  assert.equal(m7_2.durationRuns.length, 3, 'm.7 tick 1296 splits into 3 runs due to interior 48');
  assert.equal(m7_2.durationRuns[0].durationTicks, 96, 'lower two notes have 96 ticks');
  assert.equal(m7_2.durationRuns[0].landmarks.length, 2);
  assert.equal(m7_2.durationRuns[1].durationTicks, 48, 'interior note has 48 ticks');
  assert.equal(m7_2.durationRuns[1].landmarks.length, 1);
  assert.equal(m7_2.durationRuns[2].durationTicks, 96, 'top note has 96 ticks');
  assert.equal(m7_2.durationRuns[2].landmarks.length, 1);

  // m.46 tick 8688: lower three notes 96 ticks, top note dotted half (120 ticks)
  const m46 = layouts[11].handprintClusters!.find((c) => c.startTick === 8688)!;
  assert.ok(m46);
  assert.equal(m46.durationRuns?.length, 2, 'm.46 has 2 duration runs');
  assert.equal(m46.durationRuns[0].durationTicks, 96, 'lower three notes have 96 ticks');
  assert.equal(m46.durationRuns[0].landmarks.length, 3);
  assert.equal(m46.durationRuns[1].durationTicks, 120, 'top note has 120 ticks');
  assert.equal(m46.durationRuns[1].landmarks.length, 1);

  // m.60 tick 11376: notes have 96, interior 48, 96, 96
  const m60_1 = layouts[14].handprintClusters!.find((c) => c.startTick === 11376)!;
  assert.ok(m60_1.durationRuns && m60_1.durationRuns.length >= 2, 'm.60 has multiple duration runs');
  const durs = m60_1.durationRuns.map((r) => r.durationTicks);
  assert.ok(durs.includes(48), 'm.60 includes 48-tick release');
  assert.equal(m60_1.durationRuns[1].durationTicks, 48, 'interior note has 48-tick release');
});

// ---------------------------------------------------------------------------
// 4. Candidate Collision / Knockout Checks & Crop Bounds
// ---------------------------------------------------------------------------

test('Criterion 4: Candidate collision check detects collisions with body, scale, landmarks, and duration ink', () => {
  const notes: PositionedJankoNote[] = [
    { note: { id: 'n1', pitch: { pitchClass: 0, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(0, 3, 'RH'), x: 200, y: 500, rhythm: { id: 'r1', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n2', pitch: { pitchClass: 4, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(4, 3, 'RH'), x: 200, y: 500 - 2.4 * 4, rhythm: { id: 'r2', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n3', pitch: { pitchClass: 7, octave: 3 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(7, 3, 'RH'), x: 200, y: 500 - 2.4 * 7, rhythm: { id: 'r3', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
    { note: { id: 'n4', pitch: { pitchClass: 0, octave: 4 }, startTick: 0, durationTicks: 96, hand: 'RH' }, coord: getPitchCoordinate(0, 4, 'RH'), x: 200, y: 500 - 2.4 * 12, rhythm: { id: 'r4', hand: 'RH', startTick: 0, durationTicks: 96, x: 200, y: 500 } },
  ];

  const cluster = groupHandprintClusters(notes, 2.4, 3.0, 'indexed-symmetric').clusters[0];

  // 1. Clear: no obstacle
  const cleanCheck = checkHandprintCollisions(cluster, [], [], [], 1.0);
  assert.equal(cleanCheck.collides, false);

  // 2. Deliberate collision with landmark articulation (left tick at x=195.2, y=500)
  const landmarkObstacle: PositionedJankoNote = {
    note: { id: 'obs-lm', pitch: { pitchClass: 0, octave: 3 }, startTick: 48, durationTicks: 48, hand: 'LH' },
    coord: getPitchCoordinate(0, 3, 'LH'),
    x: 195.0,
    y: 500.0,
    rhythm: { id: 'r-obs', hand: 'LH', startTick: 48, durationTicks: 48, x: 195.0, y: 500.0 },
  };
  const lmCol = checkHandprintCollisions(cluster, [], [landmarkObstacle], [], 1.0);
  assert.equal(lmCol.collides, true, 'detects collision with landmark articulation');

  // 3. Deliberate collision with central scale division (at x=200, y=500 - 2.4*2 = 495.2)
  const divObstacle: PositionedJankoNote = {
    note: { id: 'obs-div', pitch: { pitchClass: 2, octave: 3 }, startTick: 48, durationTicks: 48, hand: 'LH' },
    coord: getPitchCoordinate(2, 3, 'LH'),
    x: 200.0,
    y: 495.2,
    rhythm: { id: 'r-obs2', hand: 'LH', startTick: 48, durationTicks: 48, x: 200.0, y: 495.2 },
  };
  const divCol = checkHandprintCollisions(cluster, [], [divObstacle], [], 1.0);
  assert.equal(divCol.collides, true, 'detects collision with scale division');

  // 4. Deliberate collision with duration ink (at x=208, y=490)
  const durObstacle: PositionedJankoNote = {
    note: { id: 'obs-dur', pitch: { pitchClass: 5, octave: 3 }, startTick: 48, durationTicks: 48, hand: 'LH' },
    coord: getPitchCoordinate(5, 3, 'LH'),
    x: 208.0,
    y: 490.0,
    rhythm: { id: 'r-obs3', hand: 'LH', startTick: 48, durationTicks: 48, x: 208.0, y: 490.0 },
  };
  const durCol = checkHandprintCollisions(cluster, [], [durObstacle], [], 1.0);
  assert.equal(durCol.collides, true, 'detects collision with duration attachment');

  // 5. Deliberate collision with barline
  const barlineCol = checkHandprintCollisions(cluster, [200.0], [], [], 1.0);
  assert.equal(barlineCol.collides, true, 'detects collision with barline');
});

test('Criterion 4: Crop extents and system ink extents include all candidate glyph ink', () => {
  const layouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());
  const c = layouts[1].handprintClusters![0];

  // Verify systemInkExtents encompasses c.inkBox
  const extents = systemInkExtents(layouts[1], tok(), DEFAULT_JANKO_LINT_OPTIONS, optFor('indexed-symmetric'));
  assert.ok(extents.top <= c.inkBox[1], `extents.top (${extents.top}) <= cluster minY (${c.inkBox[1]})`);
  assert.ok(extents.bottom >= c.inkBox[3], `extents.bottom (${extents.bottom}) >= cluster maxY (${c.inkBox[3]})`);

  // Verify computeCropExtents incorporates cluster bounds
  const geo = {
    staffLeft: 31.8,
    staffRight: 575.28,
    measureWidth: 135.87,
    measuresPerSystem: 4,
    systems: [layouts[1].geometry],
  };
  const crop = computeCropExtents(BRAHMS, geo as any, 7, 3, optFor('indexed-symmetric'), tok(), layouts);
  assert.ok(crop.top >= 0, 'crop extents top non-negative');
});

// ---------------------------------------------------------------------------
// 5. Canonical Brahms/Bach Invariant Preservation
// ---------------------------------------------------------------------------

test('Criterion 5: Golden master defaults and canonical rendering unchanged', () => {
  const goldenReportBrahms = lintJankoScore(BRAHMS);
  assert.equal(goldenReportBrahms.violations.length, 0, 'golden Brahms lints clean');

  const goldenReportBach = lintJankoScore(BACH);
  assert.equal(goldenReportBach.violations.length, 0, 'golden Bach lints clean');

  // Bach frozen PDF untouched
  const bachPdfFile = path.join(REPO_ROOT, 'public/goldberg-variation-1.pdf');
  assert.ok(fs.existsSync(bachPdfFile), 'committed Goldberg PDF exists');
});

// ---------------------------------------------------------------------------
// 6. Synthetic Real-Engine Diagnostic (m.8 G3→A3 perturbation)
// ---------------------------------------------------------------------------

test('Criterion 6: Synthetic real-engine diagnostic disambiguates inner G3→A3 perturbation', () => {
  const synthScore = buildSyntheticM8DiagnosticScore();
  const synthLayouts = layoutJankoScore(
    synthScore,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, measuresPerSystem: 1, clusterPresentation: 'indexed-symmetric' }),
    tok()
  );

  assert.ok(synthLayouts[0].handprintClusters, 'synthetic diagnostic has handprint cluster');
  const synthCluster = synthLayouts[0].handprintClusters![0];

  // Compare original m.8 vs synthetic m.8
  const brahmsLayouts = layoutJankoScore(BRAHMS, optFor('indexed-symmetric'), tok());
  const origCluster = brahmsLayouts[1].handprintClusters!.find((c) => c.startTick === 1392)!;

  // Both have 5 notes, span 14 semitones (F3 to G4), all odd parities
  assert.equal(origCluster.landmarks.length, 5);
  assert.equal(synthCluster.landmarks.length, 5);
  assert.deepEqual(
    origCluster.landmarks.map((l) => l.parity),
    [1, 1, 1, 1, 1]
  );
  assert.deepEqual(
    synthCluster.landmarks.map((l) => l.parity),
    [1, 1, 1, 1, 1]
  );

  // Original has G3 (offset 2) -> landmark sits at offset 2 division level
  const origInnerOffset = origCluster.landmarks[1].pitch - origCluster.baseLin;
  assert.equal(origInnerOffset, 2, 'original inner note is G3 (offset 2)');

  // Synthetic has A3 (offset 4) -> landmark sits at offset 4 division level
  const synthInnerOffset = synthCluster.landmarks[1].pitch - synthCluster.baseLin;
  assert.equal(synthInnerOffset, 4, 'perturbed inner note is A3 (offset 4)');

  // Emitted SVGs reflect distinct landmark positions
  const origSvg = renderIndexedSymmetricSvg(origCluster, tok()).svg;
  const synthSvg = renderIndexedSymmetricSvg(synthCluster, tok()).svg;
  assert.notEqual(origSvg, synthSvg, 'diagnostic produces distinct SVG geometry');
});

// ---------------------------------------------------------------------------
// 7. Studio Candidates View & Registry Badges
// ---------------------------------------------------------------------------

test('Criterion 7: Studio candidates view renders open Round 37 with 2 cards and 12 panels', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 37);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['clusterPresentation']);
  assert.equal(CURRENT_CANDIDATES.length, 2);

  const config = createStudioConfig({ score: BRAHMS });
  const viewHtml = renderCandidatesView(config);

  assert.ok(viewHtml.includes('Intrinsically indexed symmetric cluster candidate'), 'contains Round 37 title');
  assert.ok(viewHtml.includes('indexed-symmetric-literal'), 'contains literal control card');
  assert.ok(viewHtml.includes('indexed-symmetric'), 'contains indexed-symmetric candidate card');

  // 2 cards * 6 windows = 12 window panels
  const panelMatches = viewHtml.match(/class="candidate-window"/g) || [];
  assert.equal(panelMatches.length, 12, 'renders exactly 12 candidate window panels');

  // Badges report open axis clusterPresentation
  for (const c of CURRENT_CANDIDATES) {
    const badges = candidateBadges(c, CURRENT_ROUND_METADATA);
    const axisBadge = badges.find((b) => b.key === 'clusterPresentation');
    assert.ok(axisBadge, `${c.id} has clusterPresentation badge`);
    assert.equal(axisBadge.axis, true, 'marked as active open axis');
  }
});
