/**
 * Brahms Op. 118 No. 1 — harmonic pressure benchmark.
 *
 * Covers:
 *  1. The score itself: authentic cut-time metadata, the sweeping four-octave
 *     left-hand arpeggio, and the two five-voice chords of mm. 7–8 exactly as
 *     the ticket specifies them.
 *  2. Row-Snapped Parity Offset (Approach 2) on real harmony: every same-row
 *     chord tone keeps its true whole-tone row and is spread horizontally by
 *     one full notehead diameter, including the three-note cluster of m. 8.
 *  3. The complete engraving: zero notehead collisions and a completely clean
 *     visual lint (no violations, no warnings).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_MEASURES,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { BENCHMARK_METADATA, BENCHMARK_SCORES } from '../src/scores';
import { QuantizedNote } from '../src/model/types';
import { verifyLosslessGrid } from '../src/model/grid';
import {
  JankoSystemLayout,
  PositionedJankoNote,
  computeCropExtents,
  computePageGeometry,
  getChordalOffset,
  layoutJankoScore,
  renderJankoCrop,
} from '../src/render/janko/engine';
import { getPitchCoordinate } from '../src/render/janko/geometry';
import { lintJankoScore } from '../src/render/janko/linter';

const OPTIONS = BRAHMS_OP118_NO1_JANKO_OPTIONS;
const TOKENS = BRAHMS_OP118_NO1_JANKO_TOKENS;
const R = BRAHMS_OP118_NO1_JANKO_TOKENS.noteheadRadius!;
const DELTA = getChordalOffset(TOKENS);
/** The linter's minimum air between a notehead and a barline. */
const MIN_BARLINE_AIR = 1.0;

const SCORE = buildBrahmsOp118No1Score();
const LAYOUTS = layoutJankoScore(SCORE, OPTIONS, TOKENS);
const REPORT = lintJankoScore(SCORE, OPTIONS, TOKENS);

/** Absolute tick of `eighth` eighths into `measure` (1-based). */
const at = (measure: number, eighth: number): number =>
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS +
  (measure - 1) * BRAHMS_OP118_NO1_TICKS_PER_MEASURE +
  eighth * 24;

/** Right-hand chord of one onset, pitch ascending (`pitchClass/octave` keys). */
function sonority(tick: number): QuantizedNote[] {
  return SCORE.notes
    .filter((n) => n.startTick === tick && n.hand === 'RH')
    .sort(
      (a, b) =>
        a.pitch.octave * 12 + a.pitch.pitchClass - (b.pitch.octave * 12 + b.pitch.pitchClass)
    );
}

/** Every positioned note of the engraving, systems flattened. */
function allNotes(): PositionedJankoNote[] {
  return LAYOUTS.flatMap((layout) => layout.notes);
}

/** Onsets whose notes share one whole-tone row, keyed by tick and row y. */
function sameRowGroups(): Map<string, PositionedJankoNote[]> {
  const groups = new Map<string, PositionedJankoNote[]>();
  for (const p of allNotes()) {
    const key = `${p.note.startTick}|${(p.y + 0).toFixed(3)}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  for (const [key, group] of [...groups]) if (group.length < 2) groups.delete(key);
  return groups;
}

// ---------------------------------------------------------------------------
// 1. The score
// ---------------------------------------------------------------------------

test('Brahms Op. 118 No. 1 is ingested as cut time with lossless grid data', () => {
  assert.equal(SCORE.id, 'brahms-op118-no1');
  assert.equal(SCORE.composer, 'Johannes Brahms');
  assert.equal(SCORE.ticksPerBeat, 48);
  assert.equal(SCORE.gridResolution, 24, 'the smallest value is an eighth note');
  assert.equal(BRAHMS_OP118_NO1_TICKS_PER_MEASURE, 192, '2/2 at 48 ticks per quarter');
  assert.equal(
    SCORE.totalTicks,
    BRAHMS_OP118_NO1_ANACRUSIS_TICKS +
      BRAHMS_OP118_NO1_MEASURES * BRAHMS_OP118_NO1_TICKS_PER_MEASURE
  );
  assert.deepEqual(SCORE.timeSignatures, [{ tick: 0, numerator: 2, denominator: 2 }]);
  assert.match(SCORE.tempos[0].description ?? '', /Allegro non assai, ma molto appassionato/);
  assert.equal(SCORE.barlines.length, BRAHMS_OP118_NO1_MEASURES + 1);
  assert.equal(SCORE.barlines[SCORE.barlines.length - 1].type, 'final');
  assert.deepEqual(verifyLosslessGrid(SCORE), { lossless: true, errors: [] });
});

test('The authentic score opens with a quarter-note upbeat and downbeat chord over bass arpeggio', () => {
  const upbeat = SCORE.notes.filter((n) => n.startTick === 0);
  assert.equal(upbeat.length, 2, 'quarter-note upbeat has C5 + C6');
  assert.deepEqual(
    upbeat.map((n) => `${n.pitch.pitchClass}/${n.pitch.octave}`).sort(),
    ['0/5', '0/6']
  );
  for (const n of upbeat) {
    assert.equal(n.hand, 'RH');
    assert.equal(n.durationTicks, 48);
  }

  const downbeatRH = sonority(at(1, 0));
  assert.deepEqual(
    downbeatRH.map((n) => `${n.pitch.pitchClass}/${n.pitch.octave}`),
    ['10/4', '4/5', '10/5'],
    'm. 1 downbeat carries Bb4 + E5 + Bb5'
  );

  const downbeatLH = SCORE.notes.filter((n) => n.startTick === at(1, 0) && n.hand === 'LH');
  assert.equal(downbeatLH.length, 1);
  assert.deepEqual(
    [downbeatLH[0].pitch.pitchClass, downbeatLH[0].pitch.octave],
    [0, 2],
    'C2 bass downbeat'
  );
});

test('The score is registered as a first-class benchmark', () => {
  assert.equal(BENCHMARK_SCORES['brahms-op118-no1'], buildBrahmsOp118No1Score);
  const meta = BENCHMARK_METADATA.find((m) => m.id === 'brahms-op118-no1');
  assert.ok(meta, 'Brahms metadata is exported to the UI');
  assert.match(meta!.title, /Op\. 118 No\. 1/);
});

test('The two massive five-voice chords of mm. 7–8 carry exactly the notated pitches', () => {
  // ⟨A3, B3, D4, F4, A4⟩ — ♯iiø4/2 of C major.
  assert.deepEqual(
    sonority(at(7, 0)).map((n) => `${n.pitch.pitchClass}/${n.pitch.octave}`),
    ['9/3', '11/3', '2/4', '5/4', '9/4']
  );
  // ⟨F3, G3, B3, F4, G4⟩ — V4/2 of C major.
  assert.deepEqual(
    sonority(at(8, 0)).map((n) => `${n.pitch.pitchClass}/${n.pitch.octave}`),
    ['5/3', '7/3', '11/3', '5/4', '7/4']
  );
  assert.equal(sonority(at(7, 0)).length, 5, 'm. 7 downbeat is a five-voice chord');
  assert.equal(sonority(at(8, 0)).length, 5, 'm. 8 downbeat is a five-voice chord');
});

test('The authentic score spans more than four octaves from low bass to top treble', () => {
  const pitchOf = (n: QuantizedNote): number => n.pitch.octave * 12 + n.pitch.pitchClass;
  const lowest = SCORE.notes.reduce((a, b) => (pitchOf(a) <= pitchOf(b) ? a : b));
  const highest = SCORE.notes.reduce((a, b) => (pitchOf(a) >= pitchOf(b) ? a : b));
  assert.deepEqual([lowest.pitch.pitchClass, lowest.pitch.octave], [5, 1], 'lowest note is F1 in LH');
  assert.deepEqual([highest.pitch.pitchClass, highest.pitch.octave], [0, 6], 'highest note is C6 in RH');
  assert.equal(pitchOf(highest) - pitchOf(lowest), 55, 'span is 55 semitones (> 4.5 octaves)');
});

test('Authentic lossless score contains 126 notes across 9 measures and upbeat', () => {
  assert.equal(SCORE.notes.length, 126, 'Urtext contains exactly 126 notes in mm. 0-9');
  const lh = SCORE.notes.filter((n) => n.hand === 'LH');
  const rh = SCORE.notes.filter((n) => n.hand === 'RH');
  assert.equal(lh.length, 60, '60 LH notes');
  assert.equal(rh.length, 66, '66 RH notes');
});

// ---------------------------------------------------------------------------
// 2. Row-Snapped Parity Offset on real harmony
// ---------------------------------------------------------------------------

test('Every same-row chord tone keeps its true whole-tone row', () => {
  for (const p of allNotes()) {
    const expected = getPitchCoordinate(
      p.note.pitch.pitchClass,
      p.note.pitch.octave,
      p.coord.hand,
      TOKENS,
      OPTIONS,
      p.coord.flank
    );
    assert.equal(p.coord.y, expected.y, `${p.note.id} keeps its row y`);
    assert.equal(p.coord.rank, p.note.pitch.pitchClass % 2, `${p.note.id} keeps its row parity`);
    assert.equal(p.rhythm.y, p.y, `${p.note.id} rhythm layer follows the head`);
    assert.equal(p.rhythm.x, p.x, `${p.note.id} stem column follows the head`);
  }
});

test('Row collisions are spread symmetrically by one full notehead diameter', () => {
  const groups = sameRowGroups();
  assert.ok(groups.size >= 10, `the Brahms chords collide on many rows (${groups.size})`);
  for (const [key, group] of groups) {
    const xs = group.map((p) => p.x).sort((a, b) => a - b);
    const k = group.length;
    // x_i = x_onset + (i - (K-1)/2) · Δx, i.e. consecutive heads are exactly one
    // chordal offset apart and the whole cluster is centred on its column.
    for (let i = 1; i < k; i++) {
      assert.ok(
        Math.abs(xs[i] - xs[i - 1] - DELTA) < 1e-9,
        `${key}: heads keep Δx = ${DELTA}pt (got ${(xs[i] - xs[i - 1]).toFixed(3)})`
      );
      assert.ok(xs[i] - xs[i - 1] >= 2 * R, `${key}: one full disc of air`);
    }
    const centre = (xs[0] + xs[k - 1]) / 2;
    assert.ok(Math.abs(xs[0] - centre + ((k - 1) * DELTA) / 2) < 1e-9, `${key}: centred cluster`);
    for (const p of group) {
      assert.equal(p.coord.rank, group[0].coord.rank, `${key}: one shared row`);
      assert.equal(p.coord.octave, group[0].coord.octave, `${key}: one shared octave`);
    }
  }
});

test('mm. 8–9 stack three heads on one row and spread the triplet −Δ, 0, +Δ', () => {
  const groups = sameRowGroups();
  const triplets = [...groups.entries()].filter(([, group]) => group.length === 3);
  assert.equal(triplets.length, 2, 'both mm. 8 and 9 carry the three-note row cluster');
  for (const [key, group] of triplets) {
    assert.ok(key.startsWith(`${at(8, 0)}|`) || key.startsWith(`${at(9, 0)}|`), `triplet (${key})`);
    const xs = group.map((p) => p.x).sort((a, b) => a - b);
    assert.ok(Math.abs(xs[1] - xs[0] - DELTA) < 1e-9, 'left head sits one Δx below the middle');
    assert.ok(Math.abs(xs[2] - xs[1] - DELTA) < 1e-9, 'right head sits one Δx above the middle');
    assert.deepEqual(
      group.map((p) => p.coord.pitchClass).sort((a, b) => a - b),
      [5, 7, 11],
      'F3, G3 and B3 are the three heads of octave 3, row 1'
    );
    for (const p of group) {
      assert.equal(p.coord.octave, 3);
      assert.equal(p.coord.rank, 1);
    }
  }
});

test('A spread chord never crosses its measure band', () => {
  const anacrusis = TOKENS.anacrusisTicks ?? 0;
  for (const layout of LAYOUTS) {
    const g = layout.geometry;
    for (const p of layout.notes) {
      let measureLeft: number;
      let measureWidth: number;
      if (layout.index === 0 && anacrusis > 0) {
        const upbeatWidth = (anacrusis / TOKENS.ticksPerMeasure!) * g.measureWidth;
        if (p.note.startTick < anacrusis) {
          measureLeft = g.staffLeft;
          measureWidth = upbeatWidth;
        } else {
          const elapsed = p.note.startTick - anacrusis;
          const measureIdx = Math.floor(elapsed / BRAHMS_OP118_NO1_TICKS_PER_MEASURE);
          measureLeft = g.staffLeft + upbeatWidth + measureIdx * g.measureWidth;
          measureWidth = g.measureWidth;
        }
      } else {
        const elapsed = p.note.startTick - anacrusis;
        const measureIdx =
          Math.floor(elapsed / BRAHMS_OP118_NO1_TICKS_PER_MEASURE) -
          layout.index * g.measuresPerSystem;
        measureLeft = g.staffLeft + measureIdx * g.measureWidth;
        measureWidth = g.measureWidth;
      }
      assert.ok(
        p.x - R >= measureLeft + MIN_BARLINE_AIR - 1e-6,
        `${p.note.id} keeps air from the preceding barline (x=${p.x.toFixed(2)})`
      );
      assert.ok(
        p.x + R <= measureLeft + measureWidth - MIN_BARLINE_AIR + 1e-6,
        `${p.note.id} keeps air from the following barline`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 3. The complete engraving
// ---------------------------------------------------------------------------

test('Laying out Brahms Op. 118 No. 1 produces zero notehead collisions', () => {
  const notes = allNotes();
  assert.equal(notes.length, SCORE.notes.length, 'every note is engraved');
  assert.equal(LAYOUTS.length, 3, 'nine measures, three per system');
  let collisions = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      if (notes[i].note.startTick === notes[j].note.startTick && notes[i].y === notes[j].y) {
        // Same onset, same row: only legal when the row-snapped pair is spread.
        if (Math.abs(notes[i].x - notes[j].x) < 2 * R - 1e-6) collisions++;
      }
      if (Math.hypot(notes[i].x - notes[j].x, notes[i].y - notes[j].y) < 2 * R - 1e-6) {
        collisions++;
      }
    }
  }
  assert.equal(collisions, 0, 'no two notehead discs overlap anywhere in the score');
});

test('Brahms Op. 118 No. 1 lints completely clean', () => {
  assert.deepEqual(
    REPORT.violations.map((v) => `${v.code}: ${v.message}`),
    [],
    'zero violations'
  );
  assert.deepEqual(
    REPORT.warnings.map((v) => `${v.code}: ${v.message}`),
    [],
    'zero warnings — the five-voice chords are fully resolved'
  );
  assert.equal(REPORT.ok, true);
  assert.equal(REPORT.stats.systems, 3);
  assert.equal(REPORT.stats.measures, 9);
  assert.equal(REPORT.stats.notes, SCORE.notes.length);
  assert.ok(REPORT.stats.beams > 0, 'the eighths are beamed');
});

test('Brahms linting stays a millisecond-scale operation', () => {
  const started = Date.now();
  lintJankoScore(SCORE, OPTIONS, TOKENS);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 500, `Brahms lint must stay fast (took ${elapsed}ms)`);
});

test('The mm. 7–8 macro crop keeps the octave-1 ledger stack whole', () => {
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const extents = computeCropExtents(SCORE, geo, 7, 2, OPTIONS, TOKENS);
  assert.ok(extents.bottom > 0, 'the sweeping bass ledger claims extra room below the staff');
  assert.equal(extents.top, 0, 'nothing in mm. 7–8 leaves the staff upwards');
  const crop = renderJankoCrop(SCORE, 7, 2, OPTIONS, TOKENS, 'five-voice chords');
  const viewBox = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(crop)!;
  const [vx, vy, vw, vh] = viewBox.slice(1).map(Number);

  // The glyph work is the whole system (a crop is a viewBox narrowing), so the
  // assertion is on the notes the crop actually frames: mm. 7–8 of system 3.
  const system = LAYOUTS[2];
  const framed = system.notes.filter((p) => p.note.startTick < at(9, 0));
  assert.ok(framed.length >= 30, 'the crop frames the two five-voice chords and their arpeggios');
  const pad = Math.max(R, TOKENS.ledgerHalfWidth!);
  for (const p of framed) {
    assert.ok(
      p.x - pad >= vx && p.x + pad <= vx + vw,
      `${p.note.id} stays inside the crop horizontally (x=${p.x.toFixed(2)})`
    );
    assert.ok(
      p.y - R >= vy && p.y + R <= vy + vh,
      `${p.note.id} keeps its whole disc inside the crop`
    );
    for (const ledgerY of p.coord.ledgerYs) {
      const y = system.geometry.middleCY + ledgerY;
      assert.ok(
        y >= vy && y <= vy + vh,
        `${p.note.id} keeps ledger y=${y.toFixed(2)} inside the crop (viewBox ${vy}–${vy + vh})`
      );
    }
  }
  // The bass really does reach octave 1: the crop would clip it without the
  // ledger-aware extent.
  assert.ok(
    framed.some((p) => p.coord.octave === 1 && p.coord.ledgerYs.length > 0),
    'the framed measures contain an octave-1 ledger note'
  );
});

test('The Brahms page renders every system with glyphs and no phantom staff', () => {
  for (const layout of LAYOUTS) {
    assert.ok(layout.notes.length > 0, `system ${layout.index + 1} carries notes`);
  }
  const systems = LAYOUTS.map((l: JankoSystemLayout) => l.index);
  assert.deepEqual(systems, [0, 1, 2]);
});
