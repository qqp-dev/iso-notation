/**
 * Brahms Op. 118 No. 1 — harmonic pressure benchmark.
 *
 * Covers:
 *  1. The score itself: authentic cut-time metadata, the sweeping four-octave
 *     left-hand arpeggio, and the two five-voice chords of mm. 7–8 exactly as
 *     the ticket specifies them.
 *  2. Row-Snapped Parity Offset (Approach 2) on real harmony, preserved as
 *     intentional solver coverage on the adaptive surface: every same-row
 *     chord tone keeps its true whole-tone row and is spread horizontally,
 *     including the three-note cluster of m. 8. Canonical fixed-3 asserts
 *     compact clusters separately (no same-row fan on continuous height).
 *  3. The complete canonical fixed-3 engraving: zero notehead collisions,
 *     zero violations, zero warnings.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_MEASURES,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  BRAHMS_OP118_NO1_TOTAL_TICKS,
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
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
} from '../src/render/janko/engine';
import { getClusterSpacingPreset, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { getPitchCoordinate } from '../src/render/janko/geometry';
import { lintJankoScore } from '../src/render/janko/linter';

const OPTIONS = { ...BRAHMS_OP118_NO1_JANKO_OPTIONS };
const TOKENS = BRAHMS_OP118_NO1_JANKO_TOKENS;
/** Intentional solver coverage: the adaptive surface for row-fan assertions. */
const OPTIONS_ADAPTIVE = { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' as const };
const R = BRAHMS_OP118_NO1_JANKO_TOKENS.noteheadRadius!;
/** Decided golden fan step (Round 17B verdict `'tight'`): 2·2.53 + 0.4 = 5.46pt. */
const PAIR_GAP = getClusterSpacingPreset(OPTIONS.clusterSpacing).pairGap;
/** The mask half-width the fan step clears: two half-widths plus air. */
const MASK_WX = getClusterSpacingPreset(OPTIONS.clusterSpacing).wx;
/** The linter's minimum air between a notehead and a barline. */
const MIN_BARLINE_AIR = 1.0;

const SCORE = buildBrahmsOp118No1Score();
const LAYOUTS = layoutJankoScore(SCORE, OPTIONS, TOKENS);
const REPORT = lintJankoScore(SCORE, OPTIONS, TOKENS);
const LAYOUTS_ADAPTIVE = layoutJankoScore(SCORE, OPTIONS_ADAPTIVE, TOKENS);
const resolvedOptions = resolveJankoOptions(OPTIONS);
const resolvedTokens = resolveJankoTokens(TOKENS);

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

/** Every positioned note of the canonical engraving, systems flattened. */
function allNotes(): PositionedJankoNote[] {
  return LAYOUTS.flatMap((layout) => layout.notes);
}

/** Every positioned note of the adaptive solver surface, systems flattened. */
function allNotesAdaptive(): PositionedJankoNote[] {
  return LAYOUTS_ADAPTIVE.flatMap((layout) => layout.notes);
}

/** Onsets whose notes share one whole-tone row, keyed by tick and row y. */
function sameRowGroups(): Map<string, PositionedJankoNote[]> {
  const groups = new Map<string, PositionedJankoNote[]>();
  for (const p of allNotesAdaptive()) {
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
    BRAHMS_OP118_NO1_TOTAL_TICKS,
    'the complete Intermezzo ends at the MIDI true end (the closing measure is a 144-tick bar)'
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
  assert.deepEqual([lowest.pitch.pitchClass, lowest.pitch.octave], [9, 0], 'lowest note is A0 in LH (m. 69)');
  assert.deepEqual([highest.pitch.pitchClass, highest.pitch.octave], [6, 6], 'highest note is F#6 in RH (m. 63)');
  assert.equal(pitchOf(highest) - pitchOf(lowest), 69, 'span is 69 semitones (> 5.5 octaves)');
});

test('Authentic lossless score contains 964 notes across 71 measures and upbeat', () => {
  assert.equal(SCORE.notes.length, 964, 'Urtext contains exactly 964 notes in the complete Intermezzo');
  assert.equal(BRAHMS_OP118_NO1_MEASURES, 71, 'the ingest covers all 71 measures');
  const lh = SCORE.notes.filter((n) => n.hand === 'LH');
  const rh = SCORE.notes.filter((n) => n.hand === 'RH');
  // §4 bounded hand correction: ten authorized LH→RH retargetings — six
  // descending-line eighths (mm. 23/43) plus the four phrase-continuation
  // notes (mm. 24/44) — by source-part continuity (was 497/467 pre-correction).
  assert.equal(lh.length, 487, '487 LH notes');
  assert.equal(rh.length, 477, '477 RH notes');
});

// ---------------------------------------------------------------------------
// 2. Row-Snapped Parity Offset on real harmony
// ---------------------------------------------------------------------------

test('Every same-row chord tone keeps its true whole-tone row (adaptive solver)', () => {
  for (const p of allNotesAdaptive()) {
    const expected = getPitchCoordinate(
      p.note.pitch.pitchClass,
      p.note.pitch.octave,
      p.coord.hand,
      TOKENS,
      OPTIONS_ADAPTIVE,
      p.coord.flank
    );
    assert.equal(p.coord.y, expected.y, `${p.note.id} keeps its row y`);
    assert.equal(p.coord.rank, p.note.pitch.pitchClass % 2, `${p.note.id} keeps its row parity`);
    assert.equal(p.rhythm.y, p.y, `${p.note.id} rhythm layer follows the head`);
    assert.equal(p.rhythm.x, p.x, `${p.note.id} stem column follows the head`);
  }
});

test('Canonical fixed-3 keeps every head on its resolved pitch height', () => {
  for (const p of allNotes()) {
    const expected = getPitchCoordinate(
      p.note.pitch.pitchClass,
      p.note.pitch.octave,
      p.coord.hand,
      TOKENS,
      OPTIONS,
      p.coord.flank
    );
    assert.equal(p.coord.y, expected.y, `${p.note.id} keeps its pitch y`);
    assert.equal(p.rhythm.y, p.y, `${p.note.id} rhythm layer follows the head`);
    assert.equal(p.rhythm.x, p.x, `${p.note.id} stem column follows the head`);
  }
});

test('Row collisions are fanned at the judged pair gap (adaptive solver, Round 17 golden)', () => {
  const groups = sameRowGroups();
  assert.ok(groups.size >= 10, `the Brahms chords collide on many rows (${groups.size})`);
  for (const [key, group] of groups) {
    const xs = group.map((p) => p.x).sort((a, b) => a - b);
    const k = group.length;
    // Decided golden: the rail step is the judged pair gap (5.46pt). Under
    // the §1 three-rail solver an ordinary conflicting pair stands on the
    // OUTER rails ({-d, +d}), so consecutive same-row heads step one OR two
    // gaps — never a fractional shear — and masks always clear with air.
    for (let i = 1; i < k; i++) {
      const step = xs[i] - xs[i - 1];
      assert.ok(
        Math.abs(step - PAIR_GAP) < 1e-9 || Math.abs(step - 2 * PAIR_GAP) < 1e-9,
        `${key}: heads step one or two rail gaps (got ${step.toFixed(3)})`
      );
      assert.ok(
        step >= 2 * MASK_WX - 1e-9,
        `${key}: two rectangular masks clear with air to spare`
      );
    }
    for (const p of group) {
      assert.equal(p.coord.rank, group[0].coord.rank, `${key}: one shared row`);
      assert.equal(p.coord.octave, group[0].coord.octave, `${key}: one shared octave`);
    }
  }
});

test('mm. 8–9 stack three heads on one row and fan the triplet at the judged pair gap (adaptive solver)', () => {
  const groups = sameRowGroups();
  const inMm89 = (tick: number): boolean => tick >= at(8, 0) && tick < at(10, 0);
  const triplets = [...groups.entries()].filter(
    ([key, group]) => group.length === 3 && inMm89(Number(key.split('|')[0]))
  );
  assert.equal(triplets.length, 2, 'both mm. 8 and 9 carry the three-note row cluster');
  for (const [key, group] of triplets) {
    assert.ok(key.startsWith(`${at(8, 0)}|`) || key.startsWith(`${at(9, 0)}|`), `triplet (${key})`);
    const xs = group.map((p) => p.x).sort((a, b) => a - b);
    // Decided golden: the single-hand triplet fans symmetrically about its
    // middle head at the judged 5.46pt step, and the middle head shares the
    // onset column with a different-row head of the same onset.
    assert.ok(Math.abs(xs[1] - xs[0] - PAIR_GAP) < 1e-9, 'left head sits one gap below the middle');
    assert.ok(Math.abs(xs[2] - xs[1] - PAIR_GAP) < 1e-9, 'right head sits one gap above the middle');
    const middle = group.find((p) => p.coord.pitchClass === 7)!;
    assert.equal(xs[1], middle.x, 'the middle head anchors the fan');
    const tick = middle.note.startTick;
    const fellowTraveller = allNotesAdaptive().some(
      (p) => p.note.startTick === tick && p.y !== middle.y && Math.abs(p.x - middle.x) < 1e-9
    );
    assert.ok(fellowTraveller, 'the anchored head shares its column with the onset');
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
  // Round 20: seven cross-hand unisons (one same-duration pair, six
  // mixed-duration) draw one digit each, so the painted heads number the score's
  // notes minus the merged duplicates.
  const merged = LAYOUTS.reduce(
    (sum, layout) => sum + layout.unisonMerges.reduce((n, m) => n + m.mergedIds.length, 0),
    0
  );
  assert.equal(merged, 7, 'the seven Brahms unisons merge to one head each');
  assert.equal(notes.length, SCORE.notes.length - merged, 'every note is engraved, merged unisons once');
  assert.equal(LAYOUTS.length, 18, 'the complete Intermezzo lays out as 18 systems, four measures each');
  // Every layout is engraved in its own system frame and later pages reuse the
  // four frames of page 1, so two notes are only comparable when their
  // systems share a page.
  const systemsPerPage = OPTIONS.systemsPerPage ?? 1;
  const pageOf = new Map<string, number>();
  for (const layout of LAYOUTS) {
    for (const p of layout.notes) pageOf.set(p.note.id, Math.floor(layout.index / systemsPerPage));
  }
  let collisions = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      if (pageOf.get(notes[i].note.id) !== pageOf.get(notes[j].note.id)) continue;
      // Round 17: the knockout is a sharp rectangle, so two masks overlap
      // only when their boxes intersect on both axes — a same-row pair at the
      // 5.46pt judged gap clears with air to spare.
      const a = knockoutHalfExtents(resolvedOptions, resolvedTokens, notes[i].note.startTick);
      const b = knockoutHalfExtents(resolvedOptions, resolvedTokens, notes[j].note.startTick);
      const dx = Math.abs(notes[i].x - notes[j].x);
      const dy = Math.abs(notes[i].y - notes[j].y);
      if (dx < a.wx + b.wx - 1e-6 && dy < a.hy + b.hy - 1e-6) collisions++;
    }
  }
  assert.equal(collisions, 0, 'no two rectangular notehead masks overlap anywhere in the score');
});

test('Brahms Op. 118 No. 1 canonical fixed-3 is clean', () => {
  assert.deepEqual(
    REPORT.violations.map((v) => `${v.code}: ${v.message}`),
    [],
    'zero violations on the canonical fixed-3 surface'
  );
  assert.deepEqual(
    REPORT.warnings.map((v) => `${v.code}: ${v.message}`),
    [],
    'zero warnings — the five-voice chords are fully resolved'
  );
  assert.equal(REPORT.ok, true, 'the canonical surface is honestly ok');
  assert.equal(REPORT.stats.systems, 18);
  assert.equal(REPORT.stats.measures, 71);
  assert.equal(REPORT.stats.notes, SCORE.notes.length - 7, 'the seven merged unison heads are painted once');
  assert.ok(REPORT.stats.beams > 0, 'the eighths are beamed');
});

test('Brahms linting stays a millisecond-scale operation', () => {
  const started = Date.now();
  lintJankoScore(SCORE, OPTIONS, TOKENS);
  const elapsed = Date.now() - started;
  // ~200ms isolated on dev hardware (~170ms pre-ticket: the §1/§2/§5 solver
  // passes cost a genuine ~20%), ~1100ms under full-suite parallel load:
  // the tripwire guards against 10x regressions, not the exact digit.
  assert.ok(elapsed < 2000, `Brahms lint must stay fast (took ${elapsed}ms)`);
});

test('The mm. 7–8 macro crop keeps the bass extension whole (canonical fixed-3)', () => {
  const geo = computePageGeometry(OPTIONS, TOKENS);
  const extents = computeCropExtents(SCORE, geo, 7, 2, OPTIONS, TOKENS);
  assert.ok(extents.bottom > 0, 'the sweeping bass claims extra room below the staff');
  assert.equal(extents.top, 0, 'nothing in mm. 7–8 leaves the staff upwards');
  const crop = renderJankoCrop(SCORE, 7, 2, OPTIONS, TOKENS, 'five-voice chords');
  const viewBox = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(crop)!;
  const [vx, vy, vw, vh] = viewBox.slice(1).map(Number);

  // The glyph work is the whole system (a crop is a viewBox narrowing), so the
  // assertion is on the notes the crop actually frames: mm. 7–8 of system 2
  // (canonical 4-per packing: sys1 pickup+1–4, sys2 mm. 5–8 — the filter
  // excludes the system's mm. 5–6, which the crop does not frame).
  const system = LAYOUTS[1];
  const framed = system.notes.filter((p) => p.note.startTick >= at(7, 0) && p.note.startTick < at(9, 0));
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
  }
  // The bass really does reach octave 1: the crop would clip it without the
  // extension-aware extent. Fixed-3 draws need-based extension rows (not
  // twin-row ledger dashes), so ledgerYs stays empty here.
  assert.ok(
    framed.some((p) => p.coord.octave === 1),
    'the framed measures contain an octave-1 bass note'
  );
  assert.ok(
    framed.every((p) => p.coord.ledgerYs.length === 0),
    'fixed-3 carries no twin-row ledger dashes in mm. 7–8'
  );
});

test('The mm. 7–8 adaptive crop keeps the octave-1 ledger stack whole (solver)', () => {
  const crop = renderJankoCrop(SCORE, 7, 2, OPTIONS_ADAPTIVE, TOKENS, 'five-voice chords');
  const viewBox = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(crop)!;
  const [vx, vy, vw, vh] = viewBox.slice(1).map(Number);
  const system = LAYOUTS_ADAPTIVE[1];
  const framed = system.notes.filter((p) => p.note.startTick >= at(7, 0) && p.note.startTick < at(9, 0));
  assert.ok(framed.length >= 30, 'the adaptive crop frames the two five-voice chords');
  for (const p of framed) {
    for (const ledgerY of p.coord.ledgerYs) {
      const y = system.geometry.middleCY + ledgerY;
      assert.ok(
        y >= vy && y <= vy + vh,
        `${p.note.id} keeps ledger y=${y.toFixed(2)} inside the crop`
      );
    }
  }
  assert.ok(
    framed.some((p) => p.coord.octave === 1 && p.coord.ledgerYs.length > 0),
    'the adaptive framed measures contain an octave-1 ledger note'
  );
});

test('The Brahms page renders every system with glyphs and no phantom staff', () => {
  for (const layout of LAYOUTS) {
    assert.ok(layout.notes.length > 0, `system ${layout.index + 1} carries notes`);
  }
  const systems = LAYOUTS.map((l: JankoSystemLayout) => l.index);
  assert.equal(systems.length, 18, 'the complete Intermezzo renders as 18 systems');
  assert.deepEqual(
    systems,
    Array.from({ length: 18 }, (_, i) => i)
  );
});
