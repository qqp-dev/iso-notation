/**
 * Round 43 — the reusable pitch + symbolic-duration study.
 * ========================================================
 *
 * One proposed **midpoint** design, judged on fixed reusable cases (candidate
 * only; the Reference, the goldens and the PDF stay frozen):
 *
 *   - **pitch** — two-column whole-tone parity placement: the even absolute-pitch
 *     family on the left rail, the odd family one `pairGap` to its right, with
 *     the restored lower-on-snap / upper-right collision fan for full-size,
 *     unbracketed groups;
 *   - **duration** — one **unified diagonal slash** family at the midpoint
 *     dimensions, painted **identically** on the shared bracket and on the
 *     fixed-length horizontal exception carrier (only the stacking direction
 *     differs);
 *   - **size** — 0.75 for genuinely admitted bracket members only.
 *
 * The suite pins: the registry, the single midpoint ink metric (paint · layout ·
 * lint), the count alphabet, identical glyphs on both mounts, the page-raked
 * orientation, the collision fan, pitch-scale eligibility, owned-exception
 * suppression, the fixed carrier extent and its published shortfall, the literal
 * corpus source, canonical equivalence, the honest tight failed-fit, the
 * per-mark carrier occlusion gate (real geometry + paint order) and the
 * unsupported-duration refusal (no blank carrier, no suppression).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { wholeToneParity } from '../src/model/pitch';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  DURATION_VOCABULARY_BANDS,
  DURATION_VOCABULARY_NOTES,
  DURATION_VOCABULARY_PLAIN_VALUES,
  DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
  DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
  buildDurationVocabularySpecimenScore,
} from '../src/scores/duration-vocabulary-specimen';
import {
  PITCH_PARITY_SPECIMEN_JANKO_OPTIONS,
  PITCH_PARITY_SPECIMEN_JANKO_TOKENS,
  buildPitchParitySpecimenScore,
} from '../src/scores/pitch-parity-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  fitParityColumns,
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  suppressedStemIds,
  JankoClusterFitMember,
} from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  CLASP_MARK_STACK_GAP,
  compactDurationMarks,
  effectiveExceptionCarrierLength,
  exceptionCarrierMarkBoxes,
  midpointMetrics,
} from '../src/render/janko/elements/rhythm';
import { createStudioConfig, renderStudioMarkup } from '../src/render/janko/studio';
import {
  BRAHMS_STUDIO_SCORE_ID,
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
  PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID,
  resolveCandidate,
} from '../src/render/janko/candidates';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const PPS = buildPitchParitySpecimenScore();
const DVS = buildDurationVocabularySpecimenScore();

const MIDPOINT_CARRIER_LENGTH = 21.91020746279734;

/** Resolve the single R43 card's options for a score entry. */
function optsFor(entry: { options: Parameters<typeof resolveJankoOptions>[0] }) {
  return resolveJankoOptions({ ...entry.options, ...(CURRENT_CANDIDATES[0].options ?? {}) });
}
function toksFor(entry: { tokens: Parameters<typeof resolveJankoTokens>[0] }) {
  return resolveJankoTokens({ ...entry.tokens, ...(CURRENT_CANDIDATES[0].tokens ?? {}) });
}

const PPS_OPTS = optsFor({ options: PITCH_PARITY_SPECIMEN_JANKO_OPTIONS });
const PPS_TOKS = toksFor({ tokens: PITCH_PARITY_SPECIMEN_JANKO_TOKENS });
const DVS_OPTS = optsFor({ options: DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS });
const DVS_TOKS = toksFor({ tokens: DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS });
const BRAHMS_OPTS = optsFor({ options: BRAHMS_OP118_NO1_JANKO_OPTIONS });
const BRAHMS_TOKS = toksFor({ tokens: BRAHMS_OP118_NO1_JANKO_TOKENS });
/** The specimen's own (golden-scale-free) options, for the parity geometry. */
const PPS_OPTS_OWN = resolveJankoOptions(PITCH_PARITY_SPECIMEN_JANKO_OPTIONS);

const F = (n: number): number => Number(n);

/** Every `<line>` of one class, as `{ x1, y1, x2, y2, stroke }`. */
function linesOf(
  svg: string,
  cls: string
): { x1: number; y1: number; x2: number; y2: number; stroke: number }[] {
  const re = new RegExp(
    `<line class="${cls}" x1="([\\d.-]+)" y1="([\\d.-]+)" x2="([\\d.-]+)" y2="([\\d.-]+)" stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    x1: F(+m[1]),
    y1: F(+m[2]),
    x2: F(+m[3]),
    y2: F(+m[4]),
    stroke: F(+m[5]),
  }));
}

/** Every `<circle>` of one class, as `{ cx, cy, r, stroke }`. */
function circlesOf(
  svg: string,
  cls: string
): { cx: number; cy: number; r: number; stroke: number }[] {
  const re = new RegExp(
    `<circle class="${cls}" cx="([\\d.-]+)" cy="([\\d.-]+)" r="([\\d.]+)" fill="#FFFFFF" stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    cx: F(+m[1]),
    cy: F(+m[2]),
    r: F(+m[3]),
    stroke: F(+m[4]),
  }));
}

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;

// ---------------------------------------------------------------------------
// 1. Registry: one midpoint design, three open axes, eleven windows
// ---------------------------------------------------------------------------

test('Round 43 registry: one midpoint design on eleven reusable windows', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 43, 'the open round');
  assert.match(CURRENT_ROUND_METADATA.title, /reusable pitch \+ symbolic-duration study/i);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['pitchPlacement', 'bracketDurationGrammar', 'exceptionCarrier'],
    'pitch placement, the bracket marks and the carrier are the open axes'
  );
  assert.equal(CURRENT_ROUND_METADATA.compareStrip, undefined, 'no shared compare strip');

  assert.equal(CURRENT_CANDIDATES.length, 1, 'one proposed design, no obligatory control');
  const card = CURRENT_CANDIDATES[0];
  assert.equal(card.id, 'midpoint-parity');
  assert.equal(card.axis, undefined, 'the coherent design claims no single axis');
  assert.deepEqual(card.options, {
    pitchPlacement: 'parity-columns',
    chordSymbolScale: 0.75,
    bracketDurationGrammar: 'midpoint',
    exceptionCarrier: 'horizontal',
  });

  const windows = resolveCandidate(card).windows;
  assert.equal(windows.length, 11, 'eleven fixed reusable windows');
  const spans = (scoreId: string): string[] =>
    windows
      .filter((w) => 'scoreId' in w && w.scoreId === scoreId)
      .map((w) => `${(w as { measureStart: number }).measureStart}-${(w as { measureStart: number }).measureStart + (w as { measureCount: number }).measureCount - 1}`);
  assert.deepEqual(
    spans(BRAHMS_STUDIO_SCORE_ID),
    ['5-5', '7-7', '8-8', '9-9', '35-36', '37-37', '67-67'],
    'six to eight authentic Brahms windows (seven, one per targeted case)'
  );
  assert.deepEqual(
    spans(DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID),
    ['17-24', '25-32', '33-34'],
    'the duration key, the exception band and the stress band'
  );
  assert.deepEqual(
    spans(PITCH_PARITY_SPECIMEN_STUDIO_SCORE_ID),
    ['1-4'],
    'the 1-span / 2-span / octave / next-onset pitch specimen'
  );
});

// ---------------------------------------------------------------------------
// 2. The single midpoint ink metric (paint · layout · lint)
// ---------------------------------------------------------------------------

test('Midpoint metric: one page-raked slash + one ring; one metric for paint, layout and lint', () => {
  const m = midpointMetrics(DEFAULT_JANKO_TOKENS);
  // The contract's literal dimensions, not a copied memo.
  assert.ok(approx(m.slashDx, 4.95), 'transverse slash length 4.95pt');
  assert.ok(approx(m.slashStroke, 0.71), 'slash stroke 0.71pt');
  assert.ok(approx(m.slashSlope, 0.22), 'slash rise/run 0.22');
  assert.ok(approx(m.slashDy, 4.95 * 0.22), 'the rise is the slope times the run');
  assert.ok(approx(m.ringRadius, 1.6), 'ring centreline radius 1.60pt');
  assert.ok(approx(m.ringStroke, 0.59), 'ring stroke 0.59pt');

  // Every number is derived from the emitted endpoints and stroke width.
  const theta = Math.atan(m.slashSlope);
  assert.ok(
    approx(m.slashHalfX, m.slashDx / 2 + (m.slashStroke / 2) * Math.sin(theta)),
    'slash x half-extent from the endpoints'
  );
  assert.ok(
    approx(m.slashHalfY, m.slashDy / 2 + (m.slashStroke / 2) * Math.cos(theta)),
    'slash y half-extent from the endpoints'
  );
  assert.ok(approx(m.ringHalf, m.ringRadius + m.ringStroke / 2), 'ring outer half-extent');

  // The per-mount spacings clear the along-axis extent plus the stack gap.
  assert.ok(
    approx(m.bracketCutSpacing, 2 * m.slashHalfY + CLASP_MARK_STACK_GAP),
    'bracket cuts stack along the vertical extent'
  );
  assert.ok(
    approx(m.carrierCutSpacing, 2 * m.slashHalfX + CLASP_MARK_STACK_GAP),
    'carrier cuts stack along the horizontal extent'
  );
  assert.ok(
    approx(m.bracketRingSpacing, 2 * m.ringHalf + CLASP_MARK_STACK_GAP) &&
      approx(m.carrierRingSpacing, 2 * m.ringHalf + CLASP_MARK_STACK_GAP),
    'rings stack the same way on both mounts'
  );

  // The fixed carrier is the largest supported run (four cuts, or three rings).
  assert.ok(
    approx(
      m.carrierLength,
      Math.max(3 * m.carrierCutSpacing + 2 * m.slashHalfX, 2 * m.carrierRingSpacing + 2 * m.ringHalf)
    ),
    'the fixed carrier fits the maximal supported run'
  );
  assert.ok(approx(m.carrierLength, MIDPOINT_CARRIER_LENGTH), 'the published measured carrier length');
  assert.ok(
    approx(effectiveExceptionCarrierLength('midpoint', DEFAULT_JANKO_TOKENS), MIDPOINT_CARRIER_LENGTH),
    'the carrier length the engine paints'
  );
});

// ---------------------------------------------------------------------------
// 3. Count alphabet: 4/3/2/1 cuts, bare quarter, 1/2/3 rings
// ---------------------------------------------------------------------------

test('Counts 4/3/2/1 cuts, a bare quarter, then 1/2/3 rings — every plain value distinct', () => {
  const expected = new Map<number, { cuts: number; rings: number }>([
    [3, { cuts: 4, rings: 0 }],
    [6, { cuts: 3, rings: 0 }],
    [12, { cuts: 2, rings: 0 }],
    [24, { cuts: 1, rings: 0 }],
    [48, { cuts: 0, rings: 0 }],
    [96, { cuts: 0, rings: 1 }],
    [192, { cuts: 0, rings: 2 }],
    [384, { cuts: 0, rings: 3 }],
  ]);
  const seen = new Set<string>();
  for (const value of DURATION_VOCABULARY_PLAIN_VALUES) {
    const marks = compactDurationMarks(value);
    assert.equal(marks.inGrammar, true, `${value}: an in-grammar plain value`);
    assert.equal(marks.cuts, expected.get(value)!.cuts, `${value}: cuts`);
    assert.equal(marks.rings, expected.get(value)!.rings, `${value}: rings`);
    seen.add(`${marks.cuts}/${marks.rings}`);
  }
  assert.equal(seen.size, 8, 'all eight plain values are distinct in the alphabet');

  // The shared augmentation dot is preserved: 72 = dotted quarter (a bare
  // quarter + one dot), 144 = dotted half (1 ring + a dot), 288 = dotted whole
  // (2 rings + a dot); 42 is the double-dotted reading (2 dots).
  const augmented = new Map<number, { cuts: number; rings: number; dots: number }>([
    [72, { cuts: 0, rings: 0, dots: 1 }],
    [144, { cuts: 0, rings: 1, dots: 1 }],
    [288, { cuts: 0, rings: 2, dots: 1 }],
    [42, { cuts: 1, rings: 0, dots: 2 }],
  ]);
  for (const [value, marks] of augmented) {
    const got = compactDurationMarks(value);
    assert.equal(got.inGrammar, true, `${value}: an in-grammar augmented value`);
    assert.deepEqual(
      { cuts: got.cuts, rings: got.rings, dots: got.dots },
      marks,
      `${value}: the augmentation dot is preserved on the midpoint family`
    );
  }

  // Out-of-grammar composites are refused, never faked into a neighbouring glyph.
  for (const value of [108, 120, 504]) {
    const got = compactDurationMarks(value);
    assert.equal(got.inGrammar, false, `${value}: refused, not rounded into a plain value`);
    assert.deepEqual([got.cuts, got.rings, got.dots], [0, 0, 0], `${value}: no invented composite glyph`);
  }
});

// ---------------------------------------------------------------------------
// 4. Identical glyph ink on both mounts; page-raked orientation; stacking differs
// ---------------------------------------------------------------------------

test('Identical glyph ink on both mounts — one page-raked slash and one ring, only the stack direction differs', () => {
  const m = midpointMetrics(DVS_TOKS);
  const bracketSvg = renderJankoCrop(
    DVS,
    DURATION_VOCABULARY_BANDS.bracket.first,
    DURATION_VOCABULARY_BANDS.bracket.last - DURATION_VOCABULARY_BANDS.bracket.first + 1,
    DVS_OPTS,
    DVS_TOKS
  );
  const exceptionSvg = renderJankoCrop(
    DVS,
    DURATION_VOCABULARY_BANDS.exception.first,
    DURATION_VOCABULARY_BANDS.exception.last - DURATION_VOCABULARY_BANDS.exception.first + 1,
    DVS_OPTS,
    DVS_TOKS
  );

  const bracketCuts = linesOf(bracketSvg, 'janko-clasp-cut');
  const exceptionCuts = linesOf(exceptionSvg, 'janko-exception-cut');
  assert.ok(bracketCuts.length > 0 && exceptionCuts.length > 0, 'both mounts paint cuts');

  // Every slash — on either mount — is the SAME page-raked diagonal: the same
  // x length, the same rise, rising left→right (the y coordinate decreases).
  // (The emitted SVG rounds to 2 dp, so compare within half a hundredth.)
  const SVG_EPS = 0.011;
  for (const slash of [...bracketCuts, ...exceptionCuts]) {
    assert.ok(approx(slash.x2 - slash.x1, m.slashDx, SVG_EPS), 'the transverse x length is identical');
    assert.ok(approx(slash.y2 - slash.y1, -m.slashDy, SVG_EPS), 'the same up-raked rise, page orientation');
    assert.equal(slash.stroke, m.slashStroke, 'the same slash stroke');
  }

  // The bracket stacks its cuts VERTICALLY (one x, ordered y); the carrier
  // stacks them HORIZONTALLY (one y, ordered x).
  const bracketRun = bracketCuts.slice(0, 4);
  assert.equal(new Set(bracketRun.map((c) => c.x1)).size, 1, 'the bracket cuts share one x');
  assert.ok(
    bracketRun.every(
      (c, i) => i === 0 || approx(c.y1 - bracketRun[i - 1].y1, m.bracketCutSpacing, SVG_EPS)
    ),
    'the bracket cuts stack at the bracket spacing'
  );
  const carrierRun = exceptionCuts.slice(0, 4);
  assert.equal(new Set(carrierRun.map((c) => c.y1)).size, 1, 'the carrier cuts share one y');
  assert.ok(
    carrierRun.every(
      (c, i) => i === 0 || approx(c.x1 - carrierRun[i - 1].x1, m.carrierCutSpacing, SVG_EPS)
    ),
    'the carrier cuts stack at the carrier spacing'
  );

  // The ring is identical on both mounts too.
  for (const ring of [
    ...circlesOf(bracketSvg, 'janko-clasp-compact-ring'),
    ...circlesOf(exceptionSvg, 'janko-exception-ring'),
  ]) {
    assert.equal(ring.r, m.ringRadius, 'the same ring radius');
    assert.equal(ring.stroke, m.ringStroke, 'the same ring stroke');
  }
});

// ---------------------------------------------------------------------------
// 5. The collision fan: lower-on-snap / upper-right; 1-span opposite columns
// ---------------------------------------------------------------------------

test('The parity fan: a 1-span pair takes OPPOSITE rails; a 2-span pair fans lower-on-snap / upper-right', () => {
  const member = (id: string, lin: number, y: number, wx = 2.53): JankoClusterFitMember => ({
    id,
    lin,
    lower: y - 2.53,
    upper: y + 2.53,
    wx,
  });

  // A 1-span pair (adjacent lines → opposite whole-tone parity) is seated on the
  // two rails, `pairGap` apart — never merged into one column.
  const oneSpan = fitParityColumns([member('even', 48, 100), member('odd', 49, 97.5)], 0.4, 7.0);
  const oneSpanOffsets = [...oneSpan.offsets.values()].sort((a, b) => a - b);
  assert.deepEqual(oneSpanOffsets, [0, 7.0], 'the 1-span pair occupies the two parity rails');

  // A 2-span pair (same parity → one rail) collides and is fanned: the lower head
  // keeps the snap, the upper steps right by the extent-derived gap.
  const twoSpan = fitParityColumns([member('lo', 48, 100), member('hi', 50, 95)], 0.4, 7.0);
  const byId = new Map(twoSpan.offsets);
  assert.ok(approx(byId.get('lo')!, 0), 'the lower head keeps the snap');
  assert.ok(
    approx(byId.get('hi')!, 2 * 2.53 + 0.4),
    'the upper head steps right by the extent-derived gap'
  );
  assert.ok(byId.get('hi')! < 7.0, 'the fan is the extent gap, not the parity rail');

  // The parity relation the whole placement rests on, stated directly.
  assert.notEqual(
    wholeToneParity({ pitchClass: 4, octave: 4 }),
    wholeToneParity({ pitchClass: 5, octave: 4 }),
    'a 1-span pair differs in parity → opposite rails'
  );
  assert.equal(
    wholeToneParity({ pitchClass: 4, octave: 4 }),
    wholeToneParity({ pitchClass: 6, octave: 4 }),
    'a 2-span pair shares parity → one rail'
  );
});

test('On the real specimens: 1-span pairs sit in opposite columns; the 2-span pair is fanned full size', () => {
  const layouts = layoutJankoScore(PPS, PPS_OPTS, PPS_TOKS);
  const heads = new Map<string, { x: number; y: number; scale?: number; chord?: boolean }>();
  for (const l of layouts) {
    for (const p of l.notes) {
      heads.set(p.note.id, {
        x: p.x,
        y: p.y,
        scale: (p as { symbolScale?: number }).symbolScale,
        chord: (p as { symbolChord?: boolean }).symbolChord,
      });
    }
  }
  const pairGap = getClusterSpacingPreset(DEFAULT_JANKO_OPTIONS.clusterSpacing).pairGap;

  // m. 1 — the 1-span pair 4/4 · 5/4 occupies the two OPPOSITE parity columns.
  const m1a = heads.get('pps-96-4_4')!;
  const m1b = heads.get('pps-96-5_4')!;
  assert.ok(approx(Math.abs(m1a.x - m1b.x), pairGap, 1e-6), 'm. 1 1-span → opposite columns');
  assert.notEqual(wholeToneParity({ pitchClass: 4, octave: 4 }), wholeToneParity({ pitchClass: 5, octave: 4 }));

  // m. 2 — the 2-span pair 4/4 · 6/4 shares ONE column and is fanned clear (the
  // lower head keeps its snap; the upper steps right), both heads full size.
  const m2a = heads.get('pps-192-4_4')!;
  const m2b = heads.get('pps-192-6_4')!;
  assert.ok(Math.abs(m2a.x - m2b.x) >= 5.0, 'm. 2 2-span dyad is fanned clear, never overlapped');
  assert.equal(m2a.chord, undefined, 'the clean 2-span column is not admitted to a bracket');
  assert.equal(m2a.scale, undefined, 'and stays full size');
  assert.equal(m2b.scale, undefined, 'and stays full size');

  // m. 3 — the 10-span repeat re-takes 4/4’s own column 30.0pt away.
  const m3a = heads.get('pps-384-4_4')!;
  const m3b = heads.get('pps-384-4_5')!;
  assert.ok(approx(m3a.x, m3b.x, 1e-9), 'the octave repeat shares the column x');
  assert.ok(approx(Math.abs(m3a.y - m3b.y), 30.0, 1e-6), 'and sits 30.0pt (10-span) away');

  // The duration-vocabulary stress strip's next-onset 2-span dyad fans too.
  const dvsLayouts = layoutJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  const dyad = new Map<string, { x: number; y: number }>();
  for (const l of dvsLayouts) {
    for (const p of l.notes) {
      if (p.note.id === 'dvs-stress-12300-7_5' || p.note.id === 'dvs-stress-12300-9_5') {
        dyad.set(p.note.id, { x: p.x, y: p.y });
      }
    }
  }
  const lo = dyad.get('dvs-stress-12300-7_5')!;
  const hi = dyad.get('dvs-stress-12300-9_5')!;
  assert.ok(hi.y < lo.y, 'the fanned upper head is the higher pitch');
  assert.ok(hi.x > lo.x, 'the lower head keeps the snap; the upper steps right');
  assert.ok(Math.abs(hi.x - lo.x) >= 5.0, 'the next-onset 2-span dyad is fanned clear');
});

// ---------------------------------------------------------------------------
// 6. Pitch-scale eligibility: 0.75 for admitted brackets only
// ---------------------------------------------------------------------------

test('Pitch-scale eligibility: 0.75 for genuinely admitted bracket members only', () => {
  const layouts = layoutJankoScore(PPS, PPS_OPTS, PPS_TOKS);
  const byId = new Map<string, { scale?: number; chord?: boolean }>();
  for (const l of layouts) {
    for (const p of l.notes) {
      byId.set(p.note.id, {
        scale: (p as { symbolScale?: number }).symbolScale,
        chord: (p as { symbolChord?: boolean }).symbolChord,
      });
    }
  }
  // A spread 1-span pair is admitted (opposite columns → spread > the scope
  // threshold), so its two heads take 0.75.
  for (const id of ['pps-96-4_4', 'pps-96-5_4']) {
    assert.equal(byId.get(id)!.chord, true, `${id}: admitted bracket member`);
    assert.equal(byId.get(id)!.scale, 0.75, `${id}: 0.75 pitch symbol`);
  }
  // A clean 2-span column is NOT admitted: both heads stay full size.
  for (const id of ['pps-192-4_4', 'pps-192-6_4']) {
    assert.equal(byId.get(id)!.chord, undefined, `${id}: not admitted`);
    assert.equal(byId.get(id)!.scale, undefined, `${id}: full size`);
  }
  // A lone note is never admitted.
  assert.equal(byId.get('pps-0-0_4')!.scale, undefined, 'the lone opening note stays full size');
  assert.equal(byId.get('pps-624-7_4')!.scale, undefined, 'the lone next-onset note stays full size');
});

// ---------------------------------------------------------------------------
// 7. Owned exception suppression: one carrier per exception, its own value
// ---------------------------------------------------------------------------

test('Owned exception suppression: one carrier per exception, stating the member’s OWN value', () => {
  const layouts = layoutJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  const carriers = layouts.flatMap((l) => l.exceptionCarriers);
  assert.ok(carriers.length > 0, 'the study column paints carriers');
  const ownerCounts = new Map<string, number>();
  for (const c of carriers) ownerCounts.set(c.noteId, (ownerCounts.get(c.noteId) ?? 0) + 1);
  assert.ok([...ownerCounts.values()].every((n) => n === 1), 'single-note carrier ownership');
  for (const l of layouts) {
    for (const carrier of l.exceptionCarriers) {
      const clasp = l.clasps.find((c) => c.tick === carrier.tick);
      assert.ok(clasp, `tick ${carrier.tick}: the carrier sits on an admitted bracket`);
      const member = clasp!.notes.find((n) => n.id === carrier.noteId)!;
      assert.equal(member.durationTicks, carrier.durationTicks, 'the carrier states the member’s own value');
      assert.notEqual(member.durationTicks, clasp!.durationTicks, 'and differs from the carried mode');
      assert.equal(carrier.grammar, 'midpoint', 'the carrier uses the midpoint family');
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Fixed carrier extent + published shortfall + no release encoding
// ---------------------------------------------------------------------------

test('The fixed carrier length never encodes the value or a release; the tight shortfall is published', () => {
  const layouts = layoutJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  const carriers = layouts.flatMap((l) => l.exceptionCarriers);
  const lengths = new Set(carriers.map((c) => Number((c.x1 - c.x0).toFixed(6))));
  assert.deepEqual(
    [...lengths],
    [Number(MIDPOINT_CARRIER_LENGTH.toFixed(6))],
    'one fixed length for every value: independent of the member’s duration'
  );
  assert.equal(carriers.length, 11, 'the exception band (8) + the stress exceptions (3)');

  // No release-time ink rides the carrier.
  const svg = renderJankoCrop(
    DVS,
    DURATION_VOCABULARY_BANDS.exception.first,
    DURATION_VOCABULARY_BANDS.exception.last - DURATION_VOCABULARY_BANDS.exception.first + 1,
    DVS_OPTS,
    DVS_TOKS
  );
  assert.ok(!svg.includes('janko-hold'), 'the carrier is never a release endpoint');
  assert.equal(DVS_OPTS.durationEndpoint, 'none', 'the release machinery stays canonical/off');

  // The deliberately tight stress row publishes its shortfall, never clipping.
  const refusals = layouts.flatMap((l) => l.exceptionCarrierRefusals);
  assert.equal(refusals.length, 1, 'exactly one published shortfall');
  assert.ok(approx(refusals[0].required, MIDPOINT_CARRIER_LENGTH), 'the required ink is the fixed carrier length');
  assert.ok(refusals[0].available < refusals[0].required, 'the available free run is short');
  assert.match(refusals[0].reason, /never clipped/i, 'the shortfall states it is never clipped');
  // The refused carrier is still painted at its true length.
  const refused = carriers.find((c) => c.noteId === refusals[0].noteId)!;
  assert.ok(refused, 'the refused carrier is still painted');
  assert.ok(approx(Number((refused.x1 - refused.x0).toFixed(6)), Number(MIDPOINT_CARRIER_LENGTH.toFixed(6))));
});

// ---------------------------------------------------------------------------
// 9. Literal corpus source identity
// ---------------------------------------------------------------------------

test('The Brahms windows state the literal source (source of record, not the memo)', () => {
  const mstart = (m: number): number => (m === 0 ? 0 : 48 + (m - 1) * 192);
  const rhAt = (m: number, offset = 0): string[] =>
    BRAHMS.notes
      .filter(
        (n) =>
          n.hand === 'RH' &&
          n.startTick === mstart(m) + offset
      )
      .map((n) => `${n.pitch.pitchClass}/${n.pitch.octave}:${n.durationTicks}`)
      .sort();
  assert.deepEqual(rhAt(5), ['4/4:96', '4/5:96', '9/4:96'].sort(), 'm. 5 uniform triad');
  assert.deepEqual(
    rhAt(7),
    ['2/4:96', '5/4:96', '9/3:96', '9/4:96', '11/3:96'].sort(),
    'm. 7 dense five-note column'
  );
  assert.deepEqual(
    rhAt(8),
    ['11/3:96', '5/3:96', '5/4:96', '7/3:96', '7/4:96'].sort(),
    'm. 8 all-odd downbeat'
  );
  assert.ok(rhAt(8, 96).includes('11/3:48'), 'm. 8 second-onset exception is 48, not 96');
  // m. 37 — the source of record is 0/4:96 · 0/5:96 · 6/4:48 (the memo differed).
  assert.deepEqual(rhAt(37), ['0/4:96', '0/5:96', '6/4:48'].sort(), 'm. 37 source of record');
  // m. 67 — the long-value exception (384 against a carried 288).
  assert.deepEqual(rhAt(67), ['0/4:288', '0/5:288', '5/4:384'].sort(), 'm. 67 long-value exception');
});

test('The pitch-parity specimen states the 1-span / 2-span / octave / next-onset reading', () => {
  const layout = layoutJankoScore(PPS, PPS_OPTS_OWN, PPS_TOKS);
  const heads = new Map<string, { x: number; y: number }>();
  for (const l of layout) for (const p of l.notes) heads.set(p.note.id, { x: p.x, y: p.y });
  // m. 1: 1-span pair (opposite columns), off the Position of Honor tick.
  assert.ok(approx(Math.abs(heads.get('pps-96-4_4')!.x - heads.get('pps-96-5_4')!.x), getClusterSpacingPreset('tight').pairGap, 1e-6));
  // m. 2: 2-span pair (same column, 5.0pt apart) fanned.
  assert.ok(Math.abs(heads.get('pps-192-4_4')!.x - heads.get('pps-192-6_4')!.x) >= 5.0);
  // m. 3: octave repeat shares the column.
  assert.ok(approx(heads.get('pps-384-4_4')!.x, heads.get('pps-384-4_5')!.x, 1e-9));
});

// ---------------------------------------------------------------------------
// 10. Tight failed-fit distinguished from defects (nothing hidden)
// ---------------------------------------------------------------------------

test('The pitch specimen is clean; the tight stress row publishes its crossing, nothing hidden', () => {
  const ppsReport = lintJankoScore(PPS, PPS_OPTS, PPS_TOKS);
  assert.deepEqual(
    [ppsReport.violations.length, ppsReport.warnings.length],
    [0, 0],
    'the pitch-parity specimen engraves clean'
  );
  const dvsReport = lintJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  const stressIds = new Set(
    DURATION_VOCABULARY_NOTES.filter((n) => n.band === 'stress').map((n) => n.id)
  );
  for (const v of dvsReport.violations) {
    assert.ok(
      ['grid-crossing-offset', 'carrier-mark-occlusion'].includes(v.code),
      `only the published tight-fit codes (got ${v.code})`
    );
    assert.equal(v.measure, DURATION_VOCABULARY_BANDS.stress.first, 'only on the tight stress row');
    assert.ok(
      (v.noteIds ?? []).every((n) => stressIds.has(n)),
      'only a stress-row head is displaced or occluded'
    );
  }
  // The destroyed whole-value ink is a gate now, not a silent caption claim.
  const occlusionDiags = dvsReport.violations.filter((v) => v.code === 'carrier-mark-occlusion');
  assert.ok(occlusionDiags.length >= 1, 'the destroyed duration ink is published as a violation');
  assert.ok(
    occlusionDiags.some((v) => v.noteIds?.includes('dvs-stress-12288-9_5')),
    'the occluded carrier owner is named'
  );
});

// ---------------------------------------------------------------------------
// 10b. Carrier-mark occlusion: real geometry, real paint order (Round 43 repair)
// ---------------------------------------------------------------------------

test('Carrier-mark occlusion is detected by real geometry + paint order, not a nonempty SVG', () => {
  const layouts = layoutJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  const carrier = layouts
    .flatMap((l) => l.exceptionCarriers)
    .find((c) => c.noteId === 'dvs-stress-12288-9_5');
  assert.ok(carrier, 'the tight stress carrier exists');
  assert.equal(carrier!.rings, 2, 'it states a whole (two rings), so its marks carry the value');

  const occlusions = layouts.flatMap((l) =>
    (l.exceptionCarrierOcclusions ?? []).map((o) => ({ o, l }))
  );
  // Later-only bound: an erasure mask can only be a later (or same-onset) note,
  // since the carrier paints beneath every notehead.
  for (const { o } of occlusions) {
    assert.ok(o.occluderTick >= o.startTick, 'occluders never precede the carrier (paint order)');
  }

  const ring0 = occlusions.find(
    (x) =>
      x.o.noteId === 'dvs-stress-12288-9_5' &&
      x.o.markKind === 'ring' &&
      x.o.markIndex === 0 &&
      x.o.occluderId === 'dvs-stress-12300-9_5'
  );
  const ring1 = occlusions.find(
    (x) =>
      x.o.noteId === 'dvs-stress-12288-9_5' &&
      x.o.markKind === 'ring' &&
      x.o.markIndex === 1 &&
      x.o.occluderId === 'dvs-stress-12300-9_5'
  );
  assert.ok(ring0, 'the first whole-value ring is published as occluded');
  assert.ok(ring1, 'the second whole-value ring is published as occluded');
  assert.equal(ring0!.o.occluderId, 'dvs-stress-12300-9_5', 'the mask is the next-onset 16th dyad head');
  assert.ok(ring0!.o.occluderTick > ring0!.o.startTick, 'the occluder is a genuinely later note');
  assert.ok(ring0!.o.erasedFraction > 0.5, 'the first ring is mostly destroyed');
  assert.ok(
    ring1!.o.erasedFraction > 0.2 && ring1!.o.erasedFraction < 0.6,
    'the second ring is bitten into, but not wiped out'
  );

  // Reproduce the published fraction from the SAME metric the painter uses:
  // the carrier's symbolic mark box intersected with the later note's mask.
  const host = ring0!.l;
  const p = host.notes.find((n) => n.note.id === 'dvs-stress-12300-9_5')!;
  const e = knockoutHalfExtents(DVS_OPTS, DVS_TOKS, p.note.startTick, p);
  const box = exceptionCarrierMarkBoxes(carrier!, DVS_TOKS).find(
    (b) => b.kind === 'ring' && b.index === 0
  )!;
  const ox = Math.min(p.x + e.wx, box.x1) - Math.max(p.x - e.wx, box.x0);
  const oy = Math.min(p.y + e.hy, box.y1) - Math.max(p.y - e.hy, box.y0);
  const expected = (ox * oy) / ((box.x1 - box.x0) * (box.y1 - box.y0));
  assert.ok(approx(ring0!.o.erasedFraction, expected, 1e-9), 'the published fraction is the real mask∩mark fraction');

  // No other carrier mark in the displayed windows loses ink.
  const elsewhere = occlusions.filter((x) => x.o.noteId !== 'dvs-stress-12288-9_5');
  assert.deepEqual(
    elsewhere.map((x) => `${x.o.noteId}:${x.o.markKind}${x.o.markIndex}`),
    [],
    'the occlusion is confined to the labelled failed-fit stress carrier'
  );
});

// ---------------------------------------------------------------------------
// 10c. Unsupported durations: refused, never a blank carrier, never suppressed
// ---------------------------------------------------------------------------

test('Unsupported-duration exceptions are refused — no blank quarter-like carrier, no suppression', () => {
  const UNSUPPORTED_IDS = [
    'brahms-op118-no1-295',
    'brahms-op118-no1-351',
    'brahms-op118-no1-448',
    'brahms-op118-no1-581',
    'brahms-op118-no1-637',
    'brahms-op118-no1-734',
  ];
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  const unsupported = layouts.flatMap((l) => l.exceptionCarrierUnsupported ?? []);
  assert.deepEqual(
    unsupported.map((u) => u.noteId).sort(),
    [...UNSUPPORTED_IDS].sort(),
    'the six 120-tick tie-composite exceptions are refused, by id'
  );
  for (const u of unsupported) assert.equal(u.durationTicks, 120, 'the refused source duration is preserved');

  // No blank (mark-less) carrier is painted for a refused member.
  const carrierIds = new Set(layouts.flatMap((l) => l.exceptionCarriers).map((c) => c.noteId));
  for (const u of unsupported) assert.ok(!carrierIds.has(u.noteId), `${u.noteId}: no blank carrier`);

  // The refusal never suppresses the member's own ordinary duration ink.
  const suppressed = new Set(layouts.flatMap((l) => [...suppressedStemIds(l)]));
  for (const u of unsupported) {
    assert.ok(!suppressed.has(u.noteId), `${u.noteId}: own-duration ink kept (refusal never suppresses)`);
  }

  // Published honestly in the whole-score report (never faked, never hidden).
  const report = lintJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  const refusedDiags = report.warnings.filter((w) => w.code === 'carrier-duration-unsupported');
  assert.deepEqual(
    refusedDiags.map((d) => d.noteIds?.[0]).sort(),
    [...UNSUPPORTED_IDS].sort(),
    'each refusal is republished as a diagnostic'
  );
  for (const d of refusedDiags) {
    assert.match(d.message, /no plain, dotted or double-dotted reading/i, 'the reason states the limitation');
    assert.equal(d.severity, 'warning');
  }
  // The refusal keeps values that ARE stateable out of the refusal path.
  assert.ok(
    !unsupported.some((u) => [3, 6, 12, 24, 48, 96, 192, 384, 36, 72, 144, 288, 42, 84].includes(u.durationTicks)),
    'only genuinely unsupported values are refused'
  );
});

// ---------------------------------------------------------------------------
// 10d. Whole-score candidate reports: pinned by code, measure and ownership
// ---------------------------------------------------------------------------

test('Whole-score candidate reports are pinned by code, measure and ownership — nothing filtered', () => {
  // Brahms: the only errors are the pre-existing off-window m.33/m.53 folding
  // findings (NOT Round-43 regressions); plus the six unsupported refusals.
  const brahms = lintJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  assert.deepEqual(
    brahms.violations.map((v) => `${v.code}@m${v.measure}:${(v.noteIds ?? []).join('|')}`).sort(),
    [
      'stem-through-simultaneity@m33:brahms-op118-no1-445|brahms-op118-no1-444',
      'stem-through-simultaneity@m53:brahms-op118-no1-731|brahms-op118-no1-730',
    ].sort(),
    'the known folding findings only, attributed by code/measure/ownership'
  );
  assert.deepEqual(
    brahms.warnings
      .filter((w) => w.code === 'chordal-overlap')
      .map((w) => `chordal-overlap@m${w.measure}`)
      .sort(),
    ['chordal-overlap@m33', 'chordal-overlap@m53'],
    'the matching chordal-overlap warnings'
  );
  assert.equal(
    brahms.warnings.filter((w) => w.code === 'carrier-duration-unsupported').length,
    6,
    'the six unsupported refusals ride along honestly'
  );

  // The specimen: the labelled m. 33 failed-fit only.
  const dvs = lintJankoScore(DVS, DVS_OPTS, DVS_TOKS);
  assert.deepEqual(
    [...new Set(dvs.violations.map((v) => `${v.code}@m${v.measure}`))].sort(),
    ['carrier-mark-occlusion@m33', 'grid-crossing-offset@m33'],
    'the displayed synthetic failed-fit, published in full'
  );

  // The pitch specimen: clean.
  const pps = lintJankoScore(PPS, PPS_OPTS, PPS_TOKS);
  assert.deepEqual([pps.violations.length, pps.warnings.length], [0, 0], 'no invented findings');
});

// ---------------------------------------------------------------------------
// 11. Canonical equivalence: the goldens and the PDF are untouched
// ---------------------------------------------------------------------------

test('Canonical equivalence: the midpoint/parity fields add no ink to the canonical page', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.pitchPlacement, 'standard', 'the canonical placement is standard');
  assert.equal(DEFAULT_JANKO_OPTIONS.bracketDurationGrammar, 'golden');
  assert.equal(DEFAULT_JANKO_OPTIONS.exceptionCarrier, 'none');
  assert.equal(DEFAULT_JANKO_OPTIONS.chordSymbolScale, 1);
  assert.equal(DEFAULT_JANKO_TOKENS.exceptionCarrierLength, 9.0, 'the canonical carrier is unchanged');

  const bach = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.deepEqual([bach.violations.length, bach.warnings.length], [0, 0], 'Bach GOLD stays 0/0');
  const brahms = lintJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.deepEqual([brahms.violations.length, brahms.warnings.length], [0, 0], 'Brahms BRONZE stays 0/0');

  // The R43 family fields are canonical no-ops: the Bach page renders
  // byte-for-byte identically with them stated explicitly as their defaults.
  const canonical = renderJankoPage(BACH, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const explicit = renderJankoPage(
    BACH,
    0,
    resolveJankoOptions({
      ...DEFAULT_JANKO_OPTIONS,
      pitchPlacement: 'standard',
      bracketDurationGrammar: 'golden',
      exceptionCarrier: 'none',
      chordSymbolScale: 1,
    }),
    DEFAULT_JANKO_TOKENS
  );
  assert.equal(explicit, canonical, 'the new fields add no ink to the canonical page');
});

test('The parity rails never leak into the standard placement', () => {
  // The whole-tone rail is a property of the parity placement alone. On the
  // Brahms m. 5 downbeat (4/4 · 9/4 · 4/5, no vertical collision) the standard
  // fit seats the whole onset in one column, while the parity placement lifts
  // the odd 9/4 onto its own rail — so the fan/rails are demonstrably gated.
  const m5 = 48 + 4 * 192;
  const xsAt = (place: 'standard' | 'parity-columns'): Map<string, number> => {
    const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, pitchPlacement: place });
    const layout = layoutJankoScore(BRAHMS, o, resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS));
    const xs = new Map<string, number>();
    for (const l of layout) {
      for (const p of l.notes) {
        if (p.note.startTick === m5 && p.rhythm.hand === 'RH') xs.set(p.note.id, p.x);
      }
    }
    return xs;
  };
  const standard = xsAt('standard');
  const parity = xsAt('parity-columns');
  const ids = ['brahms-op118-no1-48', 'brahms-op118-no1-49', 'brahms-op118-no1-50'];
  assert.equal(new Set(ids.map((id) => standard.get(id))).size, 1, 'standard seats one column');
  assert.equal(new Set(ids.map((id) => parity.get(id))).size, 2, 'parity lifts the odd member to its rail');
  assert.ok(
    approx(
      Math.abs(parity.get('brahms-op118-no1-49')! - parity.get('brahms-op118-no1-48')!),
      getClusterSpacingPreset(DEFAULT_JANKO_OPTIONS.clusterSpacing).pairGap,
      1e-6
    ),
    'the odd member sits exactly one pairGap to the right'
  );
});

// ---------------------------------------------------------------------------
// 12. Presentation: the SSR DOM the served page mounts is complete and labelled
// ---------------------------------------------------------------------------

test('The served candidates DOM paints every window, label and digit — nothing clipped', () => {
  // The page sets `#janko-studio.innerHTML = renderStudioMarkup(...)`, so this
  // is exactly the DOM the browser mounts (the real engine, not a sketch).
  const html = renderStudioMarkup(createStudioConfig());
  const panel = html.slice(html.indexOf('id="view-candidates"'), html.indexOf('id="view-reference"'));
  const windows = [...panel.matchAll(/<figure class="candidate-window" data-window="([^"]+)">([\s\S]*?)<\/figure>/g)];
  assert.deepEqual(
    windows.map((w) => w[1]),
    [
      'brahms-op118-no1:5-5',
      'brahms-op118-no1:7-7',
      'brahms-op118-no1:8-8',
      'brahms-op118-no1:9-9',
      'brahms-op118-no1:35-36',
      'brahms-op118-no1:37-37',
      'brahms-op118-no1:67-67',
      'duration-vocabulary-specimen:17-24',
      'duration-vocabulary-specimen:25-32',
      'duration-vocabulary-specimen:33-34',
      'pitch-parity-specimen:1-4',
    ],
    'all eleven windows, in registry order, with no extras'
  );

  for (const [, id, body] of windows) {
    // 1. Label association: a titled figure with a non-empty caption.
    const title = /<figcaption><b>([^<]+)<\/b>/.exec(body);
    const caption = /<span>([^<]+)<\/span>/.exec(body);
    assert.ok(title && title[1].length > 0, `${id}: the window states a title`);
    assert.ok(caption && caption[1].length > 0, `${id}: the window states its reading caption`);

    // 2. A real SVG with a well-formed crop viewBox and finite size.
    assert.match(body, /<svg class="janko-svg"[^>]*viewBox="[\d.\- ]+"/, `${id}: paints an inline SVG`);
    const vb = /viewBox="([\d.\- ]+)"/.exec(body)![1].trim().split(/\s+/).map(Number);
    assert.equal(vb.length, 4, `${id}: a 4-number viewBox`);
    assert.ok(vb.every((n) => Number.isFinite(n)) && vb[2] > 0 && vb[3] > 0, `${id}: a finite, positive size`);

    // 3. Complete digit ink: every painted pitch digit is a single non-empty
    // duodecimal symbol (never an empty or clipped glyph).
    const digits = [...body.matchAll(/<text class="janko-digit"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
    assert.ok(digits.length > 0, `${id}: paints pitch digits`);
    for (const d of digits) {
      assert.match(d, /^[0-9AB]$/, `${id}: “${d}” is one complete duodecimal digit`);
    }

    // 4. For the synthetic specimens the crop spans the whole system, so every
    // painted coordinate must lie inside the viewBox: the crop clips nothing.
    const [minX, minY, w, h] = vb;
    const coords: [number, number][] = [];
    for (const m of body.matchAll(/<circle[^>]*cx="([\d.-]+)"[^>]*cy="([\d.-]+)"/g)) coords.push([+m[1], +m[2]]);
    for (const m of body.matchAll(/<line[^>]*x1="([\d.-]+)"[^>]*y1="([\d.-]+)"[^>]*x2="([\d.-]+)"[^>]*y2="([\d.-]+)"/g)) {
      coords.push([+m[1], +m[2]], [+m[3], +m[4]]);
    }
    for (const m of body.matchAll(/<text class="janko-digit"[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"/g)) {
      coords.push([+m[1], +m[2]]);
    }
    if (['duration-vocabulary-specimen:17-24', 'duration-vocabulary-specimen:25-32', 'pitch-parity-specimen:1-4'].includes(id)) {
      for (const [x, y] of coords) {
        assert.ok(
          x >= minX - 0.01 && x <= minX + w + 0.01 && y >= minY - 0.01 && y <= minY + h + 0.01,
          `${id}: every painted coordinate is inside the crop (x=${x}, y=${y})`
        );
      }
    }
  }
});
