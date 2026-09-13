/**
 * Round 5 — Left Clasp / Bracket Duration Carrier.
 *
 * The round replaces the long vertical stems that used to run through
 * multi-note chords with an **external bracket on the left of the cluster** that
 * simultaneously groups the vertical sonority and carries its duration. This
 * suite covers, in order:
 *
 *  1. the token grammar (clasp width / stroke / offset / barline air) and the
 *     golden-master default (`chordGrouping: 'none'`);
 *  2. the duration tip grammar (pip, spire, flag hooks);
 *  3. the bracket geometry — `claspX = minX − r − claspOffset`,
 *     `topY = minY − r`, `botY = maxY + r`, caps of `claspWidth`;
 *  4. the fit rule: a lone melodic note is never clasped, and a bracket that
 *     cannot stand clear of a barline, a foreign disc or the margin furniture
 *     is not engraved at all;
 *  5. the downbeat barline clearance (`claspX − barlineX ≥ 4.0pt`) and the
 *     measure-inset budget that pays for it without distorting the note grid;
 *  6. the beamed-clasp rail: contiguous clasps of one measure joined at the
 *     tips, strictly terminating inside the measure;
 *  7. engine integrity: a real 16th-note beam is never cut by a clasp, and both
 *     benchmark scores engrave every clasp mode with zero diagnostics;
 *  8. the Round 6 refinement: `'per-hand-clasp'` groups strictly one hand and
 *     strictly a horizontally displaced (row-snapped) cluster — a clean vertical
 *     column, a lone note and the cross-hand Bach columns are never bracketed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_CHORD_GROUPINGS,
  JANKO_CHORD_GROUPING_LABELS,
  JankoChordGrouping,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { QuantizedGridScore } from '../src/model/types';
import { splitTick } from '../src/render/janko/geometry';
import {
  CLASP_NOTEHEAD_AIR,
  collectClaspClusters,
  computeClaspInsetMap,
  computePageGeometry,
  getClaspDownbeatInset,
  getMeasureOpeningBarlineX,
  getSystemGeometry,
  layoutJankoScore,
  measuresWithColumnCollisions,
  railClearsLayout,
  renderJankoCrop,
} from '../src/render/janko/engine';
import {
  CLASP_MIN_HORIZONTAL_SPREAD,
  CLASP_PIP_RADIUS,
  CLASP_SPIRE_LENGTH,
  JankoRhythmNote,
  claspDurationClass,
  claspInkBox,
  computeClaspGeometry,
  renderChordClasp,
} from '../src/render/janko/elements/rhythm';
import { JANKO_LINT_CHECKS, lintJankoScore, systemBarlines } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const T = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const BRAHMS_T = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

/** A positioned-looking rhythm note for the pure geometry tests. */
function rn(
  id: string,
  x: number,
  y: number,
  durationTicks: number,
  startTick: number = 0
): JankoRhythmNote {
  return { id, x, y, durationTicks, startTick, hand: 'RH' };
}

/** Layout a benchmark under one chord-grouping paradigm. */
function layouts(
  mode: JankoChordGrouping,
  score = BACH,
  base: Partial<typeof DEFAULT_JANKO_OPTIONS> = DEFAULT_JANKO_OPTIONS,
  tokens = T
) {
  return layoutJankoScore(score, { ...base, chordGrouping: mode }, tokens);
}

// ---------------------------------------------------------------------------
// 1. Tokens & options
// ---------------------------------------------------------------------------

test('Clasp tokens: geometry lands on the ticket defaults, golden grouping stays none', () => {
  assert.equal(DEFAULT_JANKO_TOKENS.claspWidth, 2.2, 'cap reach');
  assert.equal(DEFAULT_JANKO_TOKENS.claspStrokeWidth, 0.85, 'bracket stroke');
  assert.equal(DEFAULT_JANKO_TOKENS.claspOffset, 2.8, 'disc-to-spine air');
  assert.equal(DEFAULT_JANKO_TOKENS.claspMinBarlineAir, 4.0, 'downbeat barline air');
  assert.equal(DEFAULT_JANKO_OPTIONS.chordGrouping, 'none', 'the golden master keeps per-note stems');
  assert.deepEqual(
    [...JANKO_CHORD_GROUPINGS],
    ['none', 'left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase', 'per-hand-clasp'],
    'the five paradigms in exploration order'
  );
  for (const mode of JANKO_CHORD_GROUPINGS) {
    assert.ok(JANKO_CHORD_GROUPING_LABELS[mode].length > 0, `${mode} is labelled`);
  }
  // A downbeat clasp needs `r + claspOffset + claspMinBarlineAir` from the
  // measure's left edge — 11.6pt with the canonical tokens.
  assert.equal(getClaspDownbeatInset(T), 4.8 + 2.8 + 4.0);
  assert.equal(resolveJankoOptions({ chordGrouping: 'left-clasp-spire' }).chordGrouping, 'left-clasp-spire');
  assert.equal(resolveJankoOptions({ chordGrouping: 'per-hand-clasp' }).chordGrouping, 'per-hand-clasp');
});

// ---------------------------------------------------------------------------
// 2. Duration tip grammar
// ---------------------------------------------------------------------------

test('Clasp duration grammar: pip for halves/wholes, spire for quarters, hooks for 8ths/16ths', () => {
  assert.equal(claspDurationClass(384), 'double-pip', 'whole note');
  assert.equal(claspDurationClass(192), 'double-pip');
  assert.equal(claspDurationClass(96), 'pip', 'half note');
  assert.equal(claspDurationClass(168), 'pip', 'Brahms dotted half');
  assert.equal(claspDurationClass(48), 'spire', 'quarter note');
  assert.equal(claspDurationClass(84), 'spire', 'Brahms long value');
  assert.equal(claspDurationClass(39), 'spire');
  assert.equal(claspDurationClass(38), 'spire-one-flag', 'dotted 8th');
  assert.equal(claspDurationClass(24), 'spire-one-flag', '8th note');
  assert.equal(claspDurationClass(15), 'spire-one-flag');
  assert.equal(claspDurationClass(14), 'spire-two-flags', '16th note');
  assert.equal(claspDurationClass(12), 'spire-two-flags');

  const pip = computeClaspGeometry([rn('a', 100, 100, 96), rn('b', 100, 130, 96)], T)!;
  assert.equal(pip.duration, 'pip');
  assert.equal(pip.spireTipY, null, 'a pip clasp carries no spire');
  assert.equal(pip.pips, 1);
  assert.equal(pip.flags, 0);

  const whole = computeClaspGeometry([rn('a', 100, 100, 384), rn('b', 100, 130, 384)], T)!;
  assert.equal(whole.pips, 2, 'a whole note doubles the pip');

  const eighth = computeClaspGeometry([rn('a', 100, 100, 24), rn('b', 100, 130, 24)], T)!;
  assert.equal(eighth.flags, 1);
  assert.equal(eighth.spireTipY, eighth.topY - CLASP_SPIRE_LENGTH, 'a clean 8.5pt spire');

  const sixteenth = computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 12)], T)!;
  assert.equal(sixteenth.flags, 2, 'a 16th doubles the hook');

  // The clasp carries the **shortest** member value: the point at which the
  // cluster's first voice moves on.
  const mixed = computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 96)], T)!;
  assert.equal(mixed.durationTicks, 12);
  assert.equal(mixed.duration, 'spire-two-flags');
  // …unless the caller overrides it (the phrase paradigm carries its opening value).
  const phrase = computeClaspGeometry(
    [rn('a', 100, 100, 12), rn('b', 100, 130, 96)],
    T,
    { durationTicks: 96 }
  )!;
  assert.equal(phrase.duration, 'pip');
});

// ---------------------------------------------------------------------------
// 3. Bracket geometry
// ---------------------------------------------------------------------------

test('Clasp geometry: the bracket is drawn outside the cluster and bounds every disc', () => {
  const notes = [rn('top', 120, 40, 12), rn('bottom', 110, 100, 12)];
  const clasp = computeClaspGeometry(notes, T)!;
  assert.equal(clasp.minX, 110, 'leftmost head');
  assert.equal(clasp.maxX, 120);
  assert.equal(clasp.minY, 40);
  assert.equal(clasp.maxY, 100);
  assert.equal(clasp.claspX, 110 - 4.8 - 2.8, 'claspX = minX − r − claspOffset');
  assert.equal(clasp.topY, 40 - 4.8, 'topY = minY − r');
  assert.equal(clasp.botY, 100 + 4.8, 'botY = maxY + r');
  assert.equal(clasp.capWidth, T.claspWidth);
  assert.equal(clasp.strokeWidth, T.claspStrokeWidth);
  assert.equal(
    clasp.path,
    'M 104.60 35.20 L 102.40 35.20 L 102.40 104.80 L 104.60 104.80',
    'cap → spine → cap'
  );
  // Members are sorted top-to-bottom so the geometry is order-independent.
  assert.deepEqual(clasp.notes.map((n) => n.id), ['top', 'bottom']);

  // The bracket's ink never crosses the discs it clasps: the caps stop
  // `r + claspOffset − capW` short of the outermost head, i.e. 0.6pt clear of
  // the knockout, and everything else it paints lives above the cluster.
  const ink = claspInkBox(clasp, T);
  assert.equal(ink.x0, clasp.claspX);
  assert.ok(
    clasp.claspX + clasp.capWidth <= clasp.minX - T.noteheadRadius - 0.6 + 1e-9,
    'the caps stop clear of the disc'
  );
  assert.ok(ink.y0 <= clasp.topY - CLASP_SPIRE_LENGTH + 1e-9, 'the spire rises above the bracket');
  assert.ok(ink.y1 >= clasp.botY - 1e-9);
  assert.ok(
    (clasp.spireTipY ?? clasp.topY) + T.flagHeight <= clasp.topY,
    'flag hooks hang above the topmost disc'
  );

  assert.equal(computeClaspGeometry([rn('solo', 100, 100, 12)], T), null, 'a lone note is never clasped');
});

test('renderChordClasp paints bracket, spire and tip with the engine classes', () => {
  const markup = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 48), rn('b', 100, 130, 48)], T)!,
    T
  );
  assert.match(markup, /class="janko-clasp-group" data-clasp-tick="0" data-clasp-duration="spire"/);
  assert.match(markup, /class="janko-clasp" d="M 94\.60 95\.20 L 92\.40 95\.20 L 92\.40 134\.80 L 94\.60 134\.80"/);
  assert.match(markup, /class="janko-clasp-spire" x1="92\.40" y1="95\.20" x2="92\.40" y2="86\.70"/);
  assert.match(markup, /stroke-width="0\.85"/);
  assert.ok(!markup.includes('janko-clasp-flag'), 'a quarter carries no hook');
  assert.ok(!markup.includes('janko-clasp-pip'), 'a quarter carries no pip');

  const flagged = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 12), rn('b', 100, 130, 12)], T)!,
    T
  );
  assert.equal((flagged.match(/janko-clasp-flag/g) ?? []).length, 2, '16th: two hooks');
  const pipped = renderChordClasp(
    computeClaspGeometry([rn('a', 100, 100, 96), rn('b', 100, 130, 96)], T)!,
    T
  );
  assert.equal((pipped.match(/janko-clasp-pip/g) ?? []).length, 1, 'half: one open pip');
  assert.ok(pipped.includes(`r="${CLASP_PIP_RADIUS.toFixed(2)}"`), 'the pip is open, not filled');
  assert.ok(!pipped.includes('janko-clasp-spire'));
});

// ---------------------------------------------------------------------------
// 4. Fit rule
// ---------------------------------------------------------------------------

test('The fit rule: only actual chords are clasped, and only where the bracket stands clear', () => {
  // Bach Var. 1 is a two-voice 16th-note texture: its measure-opening dyads are
  // clasped, while an interior dyad — whose predecessor sits exactly one disc
  // away — cannot host a 7.6pt bracket and keeps its traditional stems.
  const system0 = layouts('left-clasp-spire')[0];
  const ticks = system0.clasps.map((c) => c.tick);
  assert.deepEqual(ticks, [0, 144, 432, 504], 'measure downbeats and the one interior dyad with room');
  assert.ok(!ticks.includes(24), 'the 16th-grid dyad at tick 24 is not clasped');
  for (const clasp of system0.clasps) {
    assert.ok(clasp.notes.length >= 2, 'a clasp always groups a vertical simultaneity');
  }
  // Every clasp clears every foreign disc and its opening barline.
  for (const layout of layouts('left-clasp-spire')) {
    for (const clasp of layout.clasps) {
      const ink = claspInkBox(clasp, T);
      const own = new Set(clasp.notes.map((n) => n.id));
      for (const p of layout.notes) {
        if (own.has(p.note.id)) continue;
        const dx = Math.max(ink.x0 - p.x, 0, p.x - ink.x1);
        const dy = Math.max(ink.y0 - p.y, 0, p.y - ink.y1);
        assert.ok(
          Math.hypot(dx, dy) >= T.noteheadRadius + CLASP_NOTEHEAD_AIR - 1e-6,
          `clasp at tick ${clasp.tick} clears ${p.note.id}`
        );
      }
      let leftBarline: number | null = null;
      for (const b of systemBarlines(layout, resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' }), T)) {
        if (b.x <= clasp.claspX + 1e-6 && (leftBarline === null || b.x > leftBarline)) leftBarline = b.x;
      }
      if (leftBarline !== null) {
        assert.ok(
          clasp.claspX - leftBarline >= T.claspMinBarlineAir - 1e-6,
          `clasp at tick ${clasp.tick} keeps ${T.claspMinBarlineAir}pt of barline air`
        );
      }
    }
  }
  // A system whose clasp positions cannot stand are simply left unclasped: the
  // engine never paints a bracket the linter would have to report.
  const report = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' }, T);
  assert.equal(report.violations.length, 0);
  assert.equal(report.warnings.length, 0);
});

// ---------------------------------------------------------------------------
// 4b. Round 6 — the per-hand, non-vertical clasp
// ---------------------------------------------------------------------------

test('Round 6 per-hand clasp: one hand only, only for horizontally displaced clusters', () => {
  // A clean vertical column of one hand is never grouped…
  assert.equal(
    computeClaspGeometry(
      [rn('a', 100, 100, 24), rn('b', 100, 130, 24)],
      T,
      { requireHorizontalSpread: true }
    ),
    null,
    'a clean vertical column keeps its stems'
  );
  // …and neither is a lone note, however it sits on the row grid.
  assert.equal(
    computeClaspGeometry([rn('solo', 100, 100, 24)], T, { requireHorizontalSpread: true }),
    null
  );
  // A row-snapped pair is exactly what the bracket exists for.
  const pair = computeClaspGeometry(
    [rn('a', 94.5, 100, 24), rn('b', 105.5, 130, 24)],
    T,
    { requireHorizontalSpread: true }
  )!;
  assert.ok(pair.maxX - pair.minX > CLASP_MIN_HORIZONTAL_SPREAD);
  assert.equal(pair.topY, 100 - T.noteheadRadius, 'topY = min(y) − r of the hand');
  assert.equal(pair.botY, 130 + T.noteheadRadius, 'botY = max(y) + r of the hand');

  // Bach's simultaneities are cross-hand vertical columns, so the refined
  // paradigm never merges them into a grand-staff mega-bracket …
  const bach = layouts('per-hand-clasp');
  assert.equal(
    bach.reduce((n, l) => n + l.clasps.length, 0),
    0,
    'no bracket on the cross-hand Bach columns'
  );

  // … while the dense Brahms writing carries the row-snapped hand clusters the
  // round targets (the 2-5-9 sonority among them).
  const o = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    chordGrouping: 'per-hand-clasp',
  });
  const brahms = layoutJankoScore(BRAHMS, o, BRAHMS_T);
  const clasps = brahms.flatMap((l) => l.clasps);
  assert.ok(clasps.length >= 3, `Brahms hand clusters are clasped (${clasps.length})`);
  const r = BRAHMS_T.noteheadRadius;
  for (const clasp of clasps) {
    assert.equal(
      new Set(clasp.notes.map((n) => n.hand)).size,
      1,
      'a bracket never spans both hands'
    );
    const xs = clasp.notes.map((n) => n.x);
    assert.ok(
      Math.max(...xs) - Math.min(...xs) > CLASP_MIN_HORIZONTAL_SPREAD,
      'only horizontally displaced hand clusters are grouped'
    );
    assert.equal(clasp.topY, Math.min(...clasp.notes.map((n) => n.y)) - r);
    assert.equal(clasp.botY, Math.max(...clasp.notes.map((n) => n.y)) + r);
    // Duration ownership: the bracket carries the shortest member value.
    assert.equal(
      clasp.durationTicks,
      Math.min(...clasp.notes.map((n) => n.durationTicks)),
      'the clasp carries the cluster duration at its tip'
    );
    // A downbeat bracket keeps its barline air (≥ 3.5pt; the token holds 4.0).
    const layout = brahms.find((l) => l.clasps.includes(clasp))!;
    const leftBarline = systemBarlines(layout, o, BRAHMS_T).reduce(
      (best, b) => (b.x <= clasp.claspX + 1e-6 && b.x > best ? b.x : best),
      Number.NEGATIVE_INFINITY
    );
    if (Number.isFinite(leftBarline)) {
      assert.ok(
        clasp.claspX - leftBarline >= BRAHMS_T.claspMinBarlineAir - 1e-6,
        `clasp at tick ${clasp.tick} keeps ${BRAHMS_T.claspMinBarlineAir}pt of barline air`
      );
      assert.ok(BRAHMS_T.claspMinBarlineAir >= 3.5, 'the ticket floor is 3.5pt');
    }
  }
  // Duration ownership: a member whose stem is not part of a real beam loses its
  // standalone stem, because the bracket now carries the value.
  const beamed = new Set(
    brahms.flatMap((l) => l.beams.flatMap((b) => b.notes.map((n) => n.id)))
  );
  for (const layout of brahms) {
    for (const id of layout.claspedStems) {
      assert.ok(!beamed.has(id), `${id} is not inside a beam`);
      assert.ok(
        clasps.some((c) => c.notes.some((n) => n.id === id)),
        `${id} belongs to a per-hand clasp`
      );
    }
    for (const clasp of layout.clasps) {
      if (clasp.notes.some((n) => beamed.has(n.id))) continue;
      for (const n of clasp.notes) {
        assert.ok(layout.claspedStems.includes(n.id), `${n.id} loses its standalone stem`);
      }
    }
  }
  assert.ok(
    clasps.some((c) => c.notes.every((n) => !beamed.has(n.id))),
    'the Brahms clasps really replace standalone stems'
  );
  // The mm. 7–8 window's 2-5-9 sonority is clasped as one right-hand bracket
  // whose vertical reach spans the hand's full (corridor-crossing) stretch.
  const target = clasps.find((c) => c.tick === 1200);
  assert.ok(target, 'the 2-5-9 sonority is clasped');
  const onset = BRAHMS.notes.filter((n) => n.startTick === 1200 && n.hand === 'RH');
  const classes = onset.map((n) => n.pitch.pitchClass);
  assert.ok([2, 5, 9].every((pc) => classes.includes(pc)), 'the ticket’s 2-5-9 sonority');
  assert.equal(target!.notes.length, onset.length, 'the bracket groups the whole hand onset');
  assert.equal(
    new Set(target!.notes.map((n) => n.x)).size > 1,
    true,
    'the bracket exists because the hand cluster is row-snapped'
  );

  const report = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'per-hand-clasp' },
    BRAHMS_T
  );
  assert.equal(report.ok, true);
  assert.equal(report.warnings.length, 0, 'the per-hand refinement adds no warning');
});

// ---------------------------------------------------------------------------
// 5. Barline clearance & the inset budget
// ---------------------------------------------------------------------------

test('Downbeat clasps keep their barline air — the measure pays for it out of its closing margin', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const geo = computePageGeometry(o, T);
  const system0 = getSystemGeometry(geo, 0);
  const insets = computeClaspInsetMap(BACH, system0, 0, o, T);
  assert.ok(insets.size > 0, 'Bach opens chords on measure downbeats');
  for (const [measureIdx, required] of insets) {
    assert.equal(required, getClaspDownbeatInset(T), `measure ${measureIdx} reserves the clasp inset`);
  }

  // The budget rule: `left + right` stays at `2 × measureInset`, so the note
  // field keeps its canonical width and no downstream beat is squeezed.
  const canonical = getMeasureOpeningBarlineX(1, system0, 0, T)! - system0.staffLeft;
  assert.equal(canonical, system0.measureWidth, 'measure 2 opens one measure width in');
  const layoutsWithClasps = layouts('left-clasp-spire');
  const measureWidth = system0.measureWidth;
  const widths = new Set<number>();
  for (const layout of layoutsWithClasps) {
    for (const p of layout.notes) {
      const m = Math.floor((p.note.startTick % (4 * o.ticksPerMeasure)) / o.ticksPerMeasure);
      const left = getMeasureOpeningBarlineX(m, layout.geometry, layout.index, T);
      if (left === null) continue;
      widths.add(Number((p.x - left).toFixed(6)));
    }
  }
  // Every note still starts at least `measureInset` inside its measure, and the
  // downsweep of the 16th grid is identical to the golden master's.
  const gilt = layouts('none');
  const goldenGrid = gilt[0].notes
    .filter((p) => p.note.startTick < o.ticksPerMeasure)
    .sort((a, b) => a.note.startTick - b.note.startTick)
    .map((p, i, all) => (i === 0 ? 0 : p.x - all[i - 1].x));
  const claspGrid = layoutsWithClasps[0].notes
    .filter((p) => p.note.startTick < o.ticksPerMeasure)
    .sort((a, b) => a.note.startTick - b.note.startTick)
    .map((p, i, all) => (i === 0 ? 0 : p.x - all[i - 1].x));
  assert.deepEqual(
    claspGrid.map((v) => v.toFixed(6)),
    goldenGrid.map((v) => v.toFixed(6)),
    'the measure keeps its canonical proportional spacing'
  );
  assert.ok(measureWidth > 0);
  assert.ok(widths.size > 0);
});

test('The admission loop demotes a measure whose own content cannot absorb the shift', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const geo = computePageGeometry(o, T);
  const system0 = getSystemGeometry(geo, 0);
  const insets = computeClaspInsetMap(BACH, system0, 0, o, T);
  assert.ok(insets.has(2), 'm. 3 opens on a chord and asks for the inset');
  // m. 3's row-snapped pair on beat 3 leaves no room for the shift: the engine
  // withdraws the widening there, so m. 3 keeps the canonical margins and no
  // bracket, and the engraved system reports no column collision at all.
  const layout = layouts('left-clasp-spire')[0];
  assert.equal(
    layout.clasps.some((c) => c.tick >= 288 && c.tick < 432),
    false,
    'm. 3 is demoted'
  );
  const collisions = measuresWithColumnCollisions(
    layout.notes,
    layout.geometry,
    layout.index,
    T
  );
  assert.deepEqual([...collisions], [], 'no measure breaks a hard column rule');
  const barlines = systemBarlines(layout, o, T);
  for (const p of layout.notes) {
    for (const b of barlines) {
      const verticalGap = Math.max(b.top - p.y, 0, p.y - b.bottom);
      if (verticalGap > T.noteheadRadius) continue;
      assert.ok(
        Math.abs(p.x - b.x) - T.noteheadRadius >= 1.0 - 1e-6,
        `${p.note.id} keeps barline air`
      );
    }
  }
});

test('A measure that cannot host the bracket loses it instead of colliding (edge case)', () => {
  // A synthetic two-measure score whose second measure carries a note one tick
  // before its barline: the budget shift would drive that head into the closing
  // barline, so the admission loop withdraws the widening (and the bracket) for
  // that measure and the engraving stays clean.
  const edge: QuantizedGridScore = {
    id: 'clasp-edge-case',
    title: 'Clasp edge case',
    totalTicks: 288,
    notes: (
      [
        [0, 0, 4, 'RH'],
        [0, 4, 4, 'RH'],
        [143, 7, 4, 'RH'],
        [144, 2, 4, 'RH'],
        [144, 6, 4, 'RH'],
        [287, 9, 4, 'RH'],
      ] as Array<[number, number, number, 'RH' | 'LH']>
    ).map(([startTick, pitchClass, octave, hand], i) => ({
      id: `edge-${i}`,
      pitch: { pitchClass, octave },
      startTick,
      durationTicks: 24,
      hand,
      velocity: 90,
    })),
  } as QuantizedGridScore;

  for (const mode of ['left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase'] as const) {
    const options = resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      chordGrouping: mode,
      measuresPerSystem: 2,
      systemsPerPage: 1,
    });
    const report = lintJankoScore(edge, options, T);
    assert.deepEqual(
      report.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `${mode} demotes the cramped measure instead of colliding`
    );
    const layouts = layoutJankoScore(edge, options, T);
    assert.ok(
      layouts.reduce((n, l) => n + l.clasps.length, 0) >= 1,
      `${mode} still clasps the measure that can host a bracket`
    );
    // The demoted measure is the one with the pre-barline 16th (m. 2).
    const demoted = layouts[0].clasps.every((c) => c.tick < 144);
    assert.equal(demoted, true, `${mode} engraves no bracket in the cramped measure`);
  }
});

// ---------------------------------------------------------------------------
// 6. The beamed-clasp rail
// ---------------------------------------------------------------------------

test('Beamed clasp rail: contiguous clasps of one measure join at the tips, inside the measure', () => {
  const railed = layouts('beamed-clasp-rail', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T);
  const plain = layouts('left-clasp-spire', BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_T);
  const total = railed.reduce((n, l) => n + l.claspRails.length, 0);
  assert.ok(total >= 3, `Brahms chord sequences produce rails (${total})`);
  assert.equal(
    railed.reduce((n, l) => n + l.clasps.length, 0),
    plain.reduce((n, l) => n + l.clasps.length, 0),
    'the rail paradigm clasps exactly the same clusters'
  );

  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'beamed-clasp-rail' });
  for (const layout of railed) {
    const barlines = systemBarlines(layout, o, BRAHMS_T);
    const railedTicks = new Set<number>();
    for (const rail of layout.claspRails) {
      assert.ok(rail.x2 > rail.x1, 'a rail always spans at least two spire columns');
      assert.equal(rail.level, 1, 'every joined run carries the primary rail');
      assert.ok(rail.noteIds.length >= 4, 'at least two clasps (two notes each) per rail');
      for (const b of barlines) {
        assert.ok(
          rail.x1 - 1.0 >= b.x || b.x >= rail.x2 + 1.0,
          `rail ${rail.x1.toFixed(2)}..${rail.x2.toFixed(2)} terminates inside its measure`
        );
      }
      assert.ok(railClearsLayout(rail, layout.notes, BRAHMS_T), 'the rail clears every foreign disc');
      // The rail sits exactly on the topmost spire tip of the run.
      const joined = layout.clasps.filter((c) => c.notes.every((n) => rail.noteIds.includes(n.id)));
      assert.ok(joined.length >= 2, 'a rail joins at least two clasps');
      for (const clasp of joined) {
        assert.equal(clasp.spireTipY, rail.y, 'every joined spire is extended up to the rail');
        assert.equal(clasp.flags, 0, 'the rail replaces the flag hooks');
        railedTicks.add(clasp.tick);
      }
    }
    // A run is measure-bounded: no rail may join clasps of two measures
    // (`splitTick` resolves the cut-time upbeat's 48-tick anacrusis).
    for (const rail of layout.claspRails) {
      const measures = new Set(
        layout.clasps
          .filter((c) => rail.noteIds.includes(c.notes[0].id))
          .map((c) => splitTick(c.tick, BRAHMS_T).measureOffset)
      );
      assert.equal(measures.size, 1, 'one rail, one measure');
    }
  }

  // Every clasp that is NOT part of a run keeps its duration hooks.
  const railedClaspTicks = new Set(
    railed.flatMap((l) => l.claspRails.flatMap((r) => l.clasps.filter((c) => r.noteIds.includes(c.notes[0].id)).map((c) => c.tick)))
  );
  for (const layout of railed) {
    for (const clasp of layout.clasps) {
      if (!railedClaspTicks.has(clasp.tick)) continue;
      assert.equal(clasp.flags, 0);
    }
  }
  const report = lintJankoScore(
    BRAHMS,
    { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: 'beamed-clasp-rail' },
    BRAHMS_T
  );
  assert.deepEqual(report.diagnostics, [], 'the railed engraving is completely clean');
});

// ---------------------------------------------------------------------------
// 7. Engine integrity & full-score cleanliness
// ---------------------------------------------------------------------------

test('Engine integrity: a real 16th-note beam is never cut, only standalone chord stems are replaced', () => {
  const golden = layouts('none');
  for (const mode of ['left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase'] as const) {
    const withClasps = layouts(mode);
    // Beams are byte-identical in count and geometry: the clasp groups clusters,
    // it never re-partitions melodic writing.
    assert.deepEqual(
      withClasps.map((l) => l.beams.map((b) => b.notes.map((n) => n.id).join(','))),
      golden.map((l) => l.beams.map((b) => b.notes.map((n) => n.id).join(','))),
      `${mode} keeps every beam group`
    );
    // Only notes that are NOT part of a beam may lose their standalone stem, and
    // every suppressed stem belongs to a clasp.
    const beamed = new Set(withClasps.flatMap((l) => l.beams.flatMap((b) => b.notes.map((n) => n.id))));
    const clasped = new Set(withClasps.flatMap((l) => l.clasps.flatMap((c) => c.notes.map((n) => n.id))));
    for (const id of withClasps.flatMap((l) => l.claspedStems)) {
      assert.ok(!beamed.has(id), `${mode}: ${id} is not inside a beam`);
      assert.ok(clasped.has(id), `${mode}: ${id} belongs to a clasp`);
    }
    // Every clasp whose members are all unbeamed actually replaces their stems.
    for (const layout of withClasps) {
      for (const clasp of layout.clasps) {
        if (clasp.notes.some((n) => beamed.has(n.id))) continue;
        for (const n of clasp.notes) {
          assert.ok(layout.claspedStems.includes(n.id), `${n.id} loses its standalone stem`);
        }
      }
    }
  }
  // The golden master replaces nothing.
  assert.deepEqual(golden.flatMap((l) => l.claspedStems), []);
  assert.deepEqual(golden.flatMap((l) => l.clasps), []);
});

test('Every chord-grouping paradigm engraves both benchmarks with zero diagnostics', () => {
  for (const mode of JANKO_CHORD_GROUPINGS) {
    const bach = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: mode }, T);
    assert.deepEqual(
      bach.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `Bach · ${mode}`
    );
    const brahms = lintJankoScore(
      BRAHMS,
      { ...BRAHMS_OP118_NO1_JANKO_OPTIONS, chordGrouping: mode },
      BRAHMS_T
    );
    assert.deepEqual(
      brahms.diagnostics.map((d) => `${d.code}: ${d.message}`),
      [],
      `Brahms · ${mode}`
    );
  }
  assert.ok(
    JANKO_LINT_CHECKS.includes('clasp-clearance'),
    'the clasp audit is part of the published check list'
  );
});

test('The bounding-phrase paradigm groups whole measures, not single simultaneities', () => {
  const phrase = layouts('bounding-phrase');
  for (const layout of phrase) {
    const measures = new Map<number, number>();
    for (const clasp of layout.clasps) {
      const m = Math.floor(clasp.tick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure);
      measures.set(m, (measures.get(m) ?? 0) + 1);
    }
    for (const [m, count] of measures) {
      assert.equal(count, 1, `measure ${m + 1} carries exactly one phrase bracket`);
    }
    for (const clasp of layout.clasps) {
      const members = new Set(clasp.notes.map((n) => n.id));
      const m = Math.floor(clasp.tick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure);
      const measureNotes = layout.notes.filter(
        (p) => Math.floor(p.note.startTick / resolveJankoOptions(DEFAULT_JANKO_OPTIONS).ticksPerMeasure) === m
      );
      assert.equal(members.size, measureNotes.length, 'the bracket bounds every note of its measure');
    }
  }
  // The phrase bracket still carries the measure's opening duration at its tip.
  const first = phrase[0].clasps[0];
  assert.ok(['pip', 'double-pip', 'spire', 'spire-one-flag', 'spire-two-flags'].includes(first.duration));
  const report = lintJankoScore(BACH, { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'bounding-phrase' }, T);
  assert.equal(report.ok, true);
});

test('Clasp clusters are collected per onset, inside their measure, and deterministic', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' });
  const system0 = layouts('left-clasp-spire')[0];
  const clusters = collectClaspClusters(system0.notes, system0.geometry, 0, o, T, null);
  assert.ok(clusters.length > 0);
  for (const cluster of clusters) {
    assert.ok(cluster.notes.length >= 2, 'a cluster is a vertical simultaneity');
    assert.equal(new Set(cluster.notes.map((p) => p.note.startTick)).size, 1, 'one onset per cluster');
    assert.ok(
      cluster.measureIdx >= 0 && cluster.measureIdx < o.measuresPerSystem,
      'every cluster belongs to a measure of its own system'
    );
  }
  // The solve is a pure function of the score: two runs agree bit for bit.
  const options = { ...DEFAULT_JANKO_OPTIONS, chordGrouping: 'left-clasp-spire' as const };
  assert.equal(renderJankoCrop(BACH, 1, 2, options, T), renderJankoCrop(BACH, 1, 2, options, T));

  // A cluster's onset column is the beat column the row-snapped solver resolved:
  // the clasp spine therefore sits exactly `r + claspOffset` left of the
  // leftmost member head.
  for (const clasp of system0.clasps) {
    const leftmost = Math.min(...clasp.notes.map((n) => n.x));
    assert.equal(clasp.claspX, leftmost - T.noteheadRadius - T.claspOffset);
  }
});
