/**
 * Round 42 — duration bracket vocabulary (Phase 3 study).
 *
 * Focused proofs for the four-column candidate study:
 *
 *  1. registry: four matched columns, two open axes, shared strips;
 *  2. the registered specimen states every plain value on every carrier band,
 *     one isolated 384-tick row per value (no sustain into the next row);
 *  3. the augmentation strip and the composites stay honest;
 *  4. the compact alphabet's mark counts and **painted** outer bounds;
 *  5. every exception column row is a genuine exception on a fixed 9.0pt
 *     carrier whose length is independent of duration and of release;
 *  6. the fixed carrier's dense-case shortfall is published, never clipped;
 *  7. only actually admitted bracket members scale — a two-note dyad stays full
 *     size (the candidate scaling-eligibility rule);
 *  8. canonical equivalence: defaults, both golden spreads and the Bach page are
 *     byte-unchanged, and the PR78 resolver identity fast path still holds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID,
  candidateBadges,
  isAbstractCandidateWindow,
  resolveCandidate,
  type JankoCandidate,
} from '../src/render/janko/candidates.js';
import {
  DURATION_VOCABULARY_AUGMENT_VALUES,
  DURATION_VOCABULARY_BANDS,
  DURATION_VOCABULARY_COMPOSITES,
  DURATION_VOCABULARY_EXCEPTION_CARRIED,
  DURATION_VOCABULARY_MEASURES,
  DURATION_VOCABULARY_NOTES,
  DURATION_VOCABULARY_PLAIN_VALUES,
  DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
  DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
  DURATION_VOCABULARY_TICKS_PER_MEASURE,
  buildDurationVocabularySpecimenScore,
} from '../src/scores/duration-vocabulary-specimen.js';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1.js';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1.js';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types.js';
import {
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  type JankoSystemLayout,
} from '../src/render/janko/engine.js';
import {
  compactDurationMarks,
  exceptionCarrierInkBox,
  type JankoExceptionCarrierGeometry,
} from '../src/render/janko/elements/rhythm.js';
import { getKnockoutMetrics } from '../src/render/janko/elements/notehead.js';
import { lintJankoScore } from '../src/render/janko/linter.js';

const SPECIMEN = buildDurationVocabularySpecimenScore();
const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();

const ORDINARY = 'duration-ordinary';
const BRACKET_CURRENT = 'duration-bracket-current';
const BRACKET_COMPACT = 'duration-bracket-compact';
const EXCEPTION = 'duration-bracket-exception';
const [O_VALUES, O_TICKS] = [DURATION_VOCABULARY_PLAIN_VALUES, DURATION_VOCABULARY_TICKS_PER_MEASURE];

const cardById = (id: string): JankoCandidate => CURRENT_CANDIDATES.find((c) => c.id === id)!;
const optsFor = (id: string) =>
  resolveJankoOptions({ ...DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS, ...(cardById(id).options ?? {}) });
const toksFor = (id: string) =>
  resolveJankoTokens({ ...DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS, ...(cardById(id).tokens ?? {}) });

const layoutCache = new Map<string, readonly JankoSystemLayout[]>();
function layoutsFor(id: string): readonly JankoSystemLayout[] {
  const hit = layoutCache.get(id);
  if (hit) return hit;
  const layouts = layoutJankoScore(SPECIMEN, optsFor(id), toksFor(id));
  layoutCache.set(id, layouts);
  return layouts;
}

// --- small painted-SVG readers (one geometry, read from the real engine) -----

interface ClaspInk {
  tick: number;
  memberIds: string[];
  cuts: number;
  rings: number;
  cutLengths: number[];
  ringDiameters: number[];
  cutStroke: number | null;
  ringStroke: number | null;
}

/** One clasp group's painted compact ink, split out of the emitted SVG. */
function claspInks(svg: string): ClaspInk[] {
  const chunks = svg.split('<g class="janko-clasp-group"').slice(1);
  return chunks.map((chunk) => {
    const tick = Number(/data-clasp-tick="(\d+)"/.exec(chunk)![1]);
    const memberIds = (/data-clasp-notes="([^"]*)"/.exec(chunk)![1] ?? '').split(',').filter(Boolean);
    const cuts = [...chunk.matchAll(/<line class="janko-clasp-cut" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="([\d.]+)"/g)];
    const rings = [...chunk.matchAll(/<circle class="janko-clasp-compact-ring" cx="([\d.-]+)" cy="([\d.-]+)" r="([\d.]+)" fill="#FFFFFF" stroke="#111111" stroke-width="([\d.]+)"/g)];
    return {
      tick,
      memberIds,
      cuts: cuts.length,
      rings: rings.length,
      cutLengths: cuts.map((m) => Number(m[3]) - Number(m[1])),
      ringDiameters: rings.map((m) => 2 * Number(m[3])),
      cutStroke: cuts.length ? Number(cuts[0][5]) : null,
      ringStroke: rings.length ? Number(rings[0][4]) : null,
    };
  });
}

interface CarrierInk {
  noteId: string;
  ticks: number;
  cuts: number;
  rings: number;
  dots: number;
  inGrammar: boolean;
  length: number;
  stroke: number;
  paintedCuts: number;
  paintedRings: number;
}

/** Every painted horizontal exception carrier, split out of the emitted SVG. */
function carrierInks(svg: string): CarrierInk[] {
  const chunks = svg.split('<g class="janko-exception-carrier"').slice(1);
  return chunks.map((chunk) => {
    const head = chunk.slice(0, chunk.indexOf('>'));
    const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(head)![1];
    const line = /<line class="janko-exception-carrier-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="([\d.]+)"/.exec(chunk)!;
    return {
      noteId: attr('data-exception-note'),
      ticks: Number(attr('data-exception-ticks')),
      cuts: Number(attr('data-exception-cuts')),
      rings: Number(attr('data-exception-rings')),
      dots: Number(attr('data-exception-dots')),
      inGrammar: attr('data-exception-in-grammar') === 'true',
      length: Number(line[3]) - Number(line[1]),
      stroke: Number(line[5]),
      paintedCuts: (chunk.match(/class="janko-exception-cut"/g) ?? []).length,
      paintedRings: (chunk.match(/class="janko-exception-ring"/g) ?? []).length,
    };
  });
}

/** The compact reading of one plain value (the study's expected alphabet). */
const EXPECTED: Record<number, { cuts: number; rings: number; dots: 0 | 1 | 2 }> = {
  3: { cuts: 4, rings: 0, dots: 0 },
  6: { cuts: 3, rings: 0, dots: 0 },
  12: { cuts: 2, rings: 0, dots: 0 },
  24: { cuts: 1, rings: 0, dots: 0 },
  48: { cuts: 0, rings: 0, dots: 0 },
  96: { cuts: 0, rings: 1, dots: 0 },
  192: { cuts: 0, rings: 2, dots: 0 },
  384: { cuts: 0, rings: 3, dots: 0 },
};

// ---------------------------------------------------------------------------
// 1. Registry
// ---------------------------------------------------------------------------

test('Round 42 registry: four matched duration-vocabulary columns, two axes, shared strips', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 42);
  assert.match(CURRENT_ROUND_METADATA.title, /duration bracket vocabulary/i);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['bracketDurationGrammar', 'exceptionCarrier']);
  assert.equal(CURRENT_ROUND_METADATA.compareStrip, undefined, 'no comparison strip declared');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    [ORDINARY, BRACKET_CURRENT, BRACKET_COMPACT, EXCEPTION]
  );
  // Every column engraves the one registered specimen, on four windows: its own
  // main band plus the three shared strips, so the columns are row-for-row
  // comparable at one physical scale.
  for (const card of CURRENT_CANDIDATES) {
    const windows = (card.windows ?? []) as Array<{ scoreId?: string; measureStart: number; measureCount: number; title: string; caption?: string }>;
    assert.equal(windows.length, 4, `${card.id}: four windows`);
    for (const w of windows) {
      assert.ok(!isAbstractCandidateWindow(w), `${card.id}: score window`);
      assert.equal(w.scoreId, DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID, `${card.id}: the study specimen`);
      assert.ok(w.caption && w.caption.length > 40, `${card.id}: every window states what to inspect`);
    }
    assert.deepEqual(
      windows.slice(1).map((w) => `${w.measureStart}-${w.measureStart + w.measureCount - 1}`),
      ['9-14', '15-16', '33-34'],
      `${card.id}: the shared augmentation / beam / stress strips`
    );
  }
  const main = (id: string) => {
    const w = cardById(id).windows![0] as { measureStart: number; measureCount: number };
    return `${w.measureStart}-${w.measureStart + w.measureCount - 1}`;
  };
  assert.equal(main(ORDINARY), '1-8');
  assert.equal(main(BRACKET_CURRENT), '17-24');
  assert.equal(main(BRACKET_COMPACT), '17-24');
  assert.equal(main(EXCEPTION), '25-32');
  // The admitted-member size: full size for the ordinary control, 75 % for the
  // three bracket columns. Both study axes are badged on the right cards.
  assert.equal(optsFor(ORDINARY).chordSymbolScale, 1);
  for (const id of [BRACKET_CURRENT, BRACKET_COMPACT, EXCEPTION]) {
    assert.equal(optsFor(id).chordSymbolScale, 0.75, `${id}: admitted-member size`);
  }
  assert.equal(cardById(ORDINARY).axis, 'bracketDurationGrammar');
  assert.equal(cardById(EXCEPTION).axis, 'exceptionCarrier');
  const axisBadges = (id: string) =>
    candidateBadges(cardById(id), CURRENT_ROUND_METADATA).filter((b) => b.axis).map((b) => b.key);
  assert.deepEqual(axisBadges(ORDINARY), ['bracketDurationGrammar']);
  assert.deepEqual(axisBadges(BRACKET_COMPACT), ['bracketDurationGrammar']);
  assert.deepEqual(axisBadges(EXCEPTION), ['exceptionCarrier']);
});

// ---------------------------------------------------------------------------
// 2. Specimen source honesty & isolation (all-row ownership)
// ---------------------------------------------------------------------------

test('Specimen: every plain value on every band, one isolated 384-tick row per value', () => {
  assert.equal(DURATION_VOCABULARY_TICKS_PER_MEASURE, 384);
  assert.deepEqual([...O_VALUES], [3, 6, 12, 24, 48, 96, 192, 384]);
  assert.equal(DURATION_VOCABULARY_MEASURES, 34);
  assert.equal(SPECIMEN.totalTicks, 34 * O_TICKS);

  const atMeasure = (m: number) => DURATION_VOCABULARY_NOTES.filter((n) => n.measure === m);
  const index = new Map(O_VALUES.map((v, i) => [v, i]));

  for (const v of O_VALUES) {
    const i = index.get(v)!;
    // Ordinary band: one lone note stating exactly v.
    const ord = atMeasure(1 + i);
    assert.equal(ord.length, 1, `ordinary ${v}: one sound`);
    assert.equal(ord[0].durationTicks, v, `ordinary ${v}: source duration preserved`);
    // Shared-bracket band: a three-note chord, every member stating v.
    const br = atMeasure(17 + i);
    assert.equal(br.length, 3, `bracket ${v}: three members`);
    assert.ok(br.every((n) => n.durationTicks === v), `bracket ${v}: every member states the value`);
    // Exception band: two carried members and one genuine exception.
    const ex = atMeasure(25 + i);
    assert.equal(ex.length, 3, `exception ${v}: three members`);
    const carried = DURATION_VOCABULARY_EXCEPTION_CARRIED.get(v)!;
    assert.equal(
      ex.filter((n) => n.durationTicks === v).length,
      1,
      `exception ${v}: exactly one member states the exception value`
    );
    assert.equal(
      ex.filter((n) => n.durationTicks === carried).length,
      2,
      `exception ${v}: two members state the carried mode`
    );
    assert.notEqual(carried, v, `exception ${v}: genuinely differs from its carried mode`);
  }

  // Authored source duration is preserved in the layout for every row, and no
  // row's own event sustains into the next measure (onset + duration ≤ 384).
  for (const note of DURATION_VOCABULARY_NOTES) {
    const offset = note.startTick - (note.measure - 1) * O_TICKS;
    assert.ok(offset >= 0, `${note.id}: onset inside its measure`);
    assert.ok(
      offset + note.durationTicks <= O_TICKS,
      `${note.id}: ${offset} + ${note.durationTicks} must fit one isolated row`
    );
  }
  const layoutById = new Map(
    layoutsFor(EXCEPTION).flatMap((l) => l.notes).map((p) => [p.note.id, p.note.durationTicks] as const)
  );
  for (const note of DURATION_VOCABULARY_NOTES) {
    assert.equal(layoutById.get(note.id), note.durationTicks, `${note.id}: layout keeps the source duration`);
  }
  assert.equal(DURATION_VOCABULARY_NOTES.length, 8 + 6 + 8 + 24 + 24 + 9, 'every authored row is present');
});

test('Augmentation and composites stay honest: exact dots, no faked composite glyph', () => {
  // The augmentation strip is single then double dots of the shared satellite.
  assert.deepEqual([...DURATION_VOCABULARY_AUGMENT_VALUES], [36, 72, 144, 288, 42, 84]);
  const augmentation = DURATION_VOCABULARY_NOTES.filter((n) => n.band === 'augmentation');
  assert.equal(augmentation.length, 6);
  for (const [i, v] of DURATION_VOCABULARY_AUGMENT_VALUES.entries()) {
    assert.equal(augmentation[i].durationTicks, v);
    assert.equal(augmentation[i].measure, 9 + i);
  }
  // Dots read exactly from the notated value (shared with the compact family).
  assert.equal(compactDurationMarks(36).dots, 1, '36 = dotted 16th');
  assert.equal(compactDurationMarks(288).dots, 1, '288 = dotted whole');
  assert.equal(compactDurationMarks(42).dots, 2, '42 = double-dotted 8th');
  assert.equal(compactDurationMarks(84).dots, 2, '84 = double-dotted 8th (higher)');
  // The composites have no exact reading and are never rounded or fake-signed.
  assert.deepEqual(
    DURATION_VOCABULARY_COMPOSITES.map((c) => c.ticks),
    [108, 120, 504]
  );
  for (const composite of DURATION_VOCABULARY_COMPOSITES) {
    const marks = compactDurationMarks(composite.ticks);
    assert.equal(marks.inGrammar, false, `${composite.ticks}: out of grammar`);
    assert.deepEqual(
      [marks.cuts, marks.rings, marks.dots],
      [0, 0, 0],
      `${composite.ticks}: no mark is invented`
    );
    assert.ok(/^\d+ = /.test(composite.decomposition), `${composite.ticks}: a decomposition caption`);
  }
  assert.equal(
    DURATION_VOCABULARY_COMPOSITES.find((c) => c.ticks === 504)!.decomposition,
    '504 = 192 + 192 + 96 + 24 (whole + whole + half + 8th)'
  );
  // No candidate row ever authors a composite duration.
  assert.ok(
    DURATION_VOCABULARY_NOTES.every((n) => ![108, 120, 504].includes(n.durationTicks)),
    'the composites are stated as captions, never engraved'
  );
});

// ---------------------------------------------------------------------------
// 3. Compact alphabet: exact mark counts and painted outer bounds
// ---------------------------------------------------------------------------

test('Compact alphabet: 4/3/2/1 cuts, bare quarter, 1/2/3 rings — counts and painted dimensions', () => {
  for (const v of O_VALUES) {
    assert.deepEqual(
      compactDurationMarks(v),
      { ...EXPECTED[v], inGrammar: true },
      `${v}: the compact reading`
    );
  }
  const svg = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.bracket.first, 8, optsFor(BRACKET_COMPACT), toksFor(BRACKET_COMPACT));
  const inks = claspInks(svg);
  assert.equal(inks.length, 8, 'one bracket per plain value');
  const byValue = new Map<number, ClaspInk>();
  for (const ink of inks) {
    const values = new Set(ink.memberIds.map((id) => DURATION_VOCABULARY_NOTES.find((n) => n.id === id)!.durationTicks));
    assert.equal(values.size, 1, 'a shared-bracket row carries exactly one value');
    const v = [...values][0];
    byValue.set(v, ink);
    const e = EXPECTED[v];
    assert.equal(ink.cuts, e.cuts, `${v}: painted cuts`);
    assert.equal(ink.rings, e.rings, `${v}: painted rings`);
    if (e.cuts > 0) {
      assert.equal(ink.cutStroke, 0.42, `${v}: compact cut stroke`);
      for (const len of ink.cutLengths) assert.ok(Math.abs(len - 2.4) < 1e-6, `${v}: cut length 2.4pt`);
    }
    if (e.rings > 0) {
      assert.equal(ink.ringStroke, 0.38, `${v}: compact ring stroke`);
      for (const d of ink.ringDiameters) assert.ok(Math.abs(d - 1.6) < 1e-6, `${v}: ring centreline Ø1.60pt`);
    }
  }
  for (const v of O_VALUES) assert.ok(byValue.has(v), `${v}: present in the compact column`);

  // The painted envelope follows the audited metric: cut ±1.2 / ±0.21, ring
  // outer Ø1.98, stacked at a uniform 2.4pt centre pitch.
  const tokens = toksFor(BRACKET_COMPACT);
  assert.equal(tokens.compactCutLength, 2.4);
  assert.equal(tokens.compactMarkStroke, 0.42);
  assert.equal(tokens.compactRingRadius, 0.8);
  assert.equal(tokens.compactRingStroke, 0.38);
  assert.equal(tokens.compactMarkSpacing, 2.4);
  assert.ok(Math.abs(2 * (tokens.compactRingRadius + tokens.compactRingStroke / 2) - 1.98) < 1e-9, 'ring outer Ø1.98pt');
  // Four cuts stack along the bracket (vertical): 3·spacing + the 0.42pt mark
  // thickness = 7.62pt. Three rings: 2·spacing + the 1.98pt outer diameter =
  // 6.78pt. (The transverse cut ARM is 2.4pt ≤ the 5.0pt 2-span, so a carrier's
  // vertical cut never reaches a same-column neighbour.)
  assert.ok(Math.abs((3 * tokens.compactMarkSpacing + tokens.compactMarkStroke) - 7.62) < 1e-9, '4 cuts stack 7.62pt');
  assert.ok(Math.abs((2 * tokens.compactMarkSpacing + 1.98) - 6.78) < 1e-9, '3 rings stack 6.78pt');
  assert.ok(tokens.compactCutLength <= 5.0, 'the cut arm clears a 2-span same-column neighbour');
});

// ---------------------------------------------------------------------------
// 4. Exception column: genuine exception, fixed length, no release meaning
// ---------------------------------------------------------------------------

test('Exception column: every row is a genuine exception on a fixed 9.0pt carrier', () => {
  const svg = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.exception.first, 8, optsFor(EXCEPTION), toksFor(EXCEPTION));
  const carriers = carrierInks(svg);
  assert.equal(carriers.length, 8, 'one carrier per plain value');
  const tokens = toksFor(EXCEPTION);
  assert.equal(tokens.exceptionCarrierLength, 9.0, 'the fixed typographic carrier length');
  for (const c of carriers) {
    assert.equal(c.inGrammar, true, `${c.noteId}: the exception reads in the compact grammar`);
    assert.equal(c.cuts, EXPECTED[c.ticks].cuts, `${c.noteId}: carrier cuts = own value`);
    assert.equal(c.rings, EXPECTED[c.ticks].rings, `${c.noteId}: carrier rings = own value`);
    assert.equal(c.paintedCuts, c.cuts, `${c.noteId}: painted cuts match the declared marks`);
    assert.equal(c.paintedRings, c.rings, `${c.noteId}: painted rings match the declared marks`);
    // Fixed length, independent of the member's own duration.
    assert.ok(Math.abs(c.length - tokens.exceptionCarrierLength) < 1e-9, `${c.noteId}: fixed 9.0pt carrier`);
  }
  assert.deepEqual(carriers.map((c) => c.ticks).sort((a, b) => a - b), [...O_VALUES].sort((a, b) => a - b));
  // The study never reuses the round-41 release machinery: no hold/terminal ink
  // rides the exception column, and the endpoint option stays canonical.
  assert.equal(optsFor(EXCEPTION).durationEndpoint, 'none');
  assert.ok(!svg.includes('janko-hold-layer'), 'no release-time hold ink in the study column');
  assert.ok(!svg.includes('janko-hold-terminal'), 'no release terminal in the study column');
  // Every carrier is owned by exactly one member (its id appears once).
  const ownerCounts = new Map<string, number>();
  for (const c of carriers) ownerCounts.set(c.noteId, (ownerCounts.get(c.noteId) ?? 0) + 1);
  assert.ok([...ownerCounts.values()].every((n) => n === 1), 'single-note carrier ownership');
});

test('Exception column: each carrier is a genuine exception against its own bracket’s carried mode', () => {
  for (const layout of layoutsFor(EXCEPTION)) {
    for (const carrier of layout.exceptionCarriers) {
      const clasp = layout.clasps.find((c) => c.tick === carrier.tick);
      assert.ok(clasp, `tick ${carrier.tick}: the carrier sits on an admitted bracket`);
      const member = clasp.notes.find((n) => n.id === carrier.noteId)!;
      assert.equal(member.durationTicks, carrier.durationTicks, 'the carrier states the member’s own duration');
      assert.notEqual(
        member.durationTicks,
        clasp.durationTicks,
        `tick ${carrier.tick}: the exception differs from the carried mode`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 5. Dense-case diagnostics: published, never clipped
// ---------------------------------------------------------------------------

test('Stress strip: the fixed carrier’s shortfall is published, never clipped or hidden', () => {
  const svg = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.stress.first, 2, optsFor(EXCEPTION), toksFor(EXCEPTION));
  const carriers = carrierInks(svg);
  const refusals = layoutsFor(EXCEPTION).flatMap((l) => l.exceptionCarrierRefusals);
  assert.equal(refusals.length, 1, 'exactly one published carrier shortfall');
  const refusal = refusals[0];
  assert.equal(refusal.required, 9.0, 'the required ink is the fixed carrier length');
  assert.ok(refusal.available < refusal.required, 'the available free run is short');
  assert.match(refusal.reason, /never clipped/i, 'the shortfall states it is never clipped');
  // The refused carrier is still painted at its true length — never shortened.
  const refused = carriers.find((c) => c.noteId === refusal.noteId)!;
  assert.ok(refused, 'the refused carrier is still painted');
  assert.ok(Math.abs(refused.length - 9.0) < 1e-9, 'the refused carrier keeps its full 9.0pt length');

  // Every column engraves its specimen windows without a violation (warnings,
  // if any, stay visible and attributed rather than suppressed).
  for (const id of [ORDINARY, BRACKET_CURRENT, BRACKET_COMPACT, EXCEPTION]) {
    const report = lintJankoScore(SPECIMEN, optsFor(id), toksFor(id));
    assert.deepEqual(report.violations, [], `${id}: no violation`);
  }
  // The refusal is a measurement on the stress strip, not a hidden suppression.
  const stressIds = new Set(
    DURATION_VOCABULARY_NOTES.filter((n) => n.band === 'stress').map((n) => n.id)
  );
  assert.ok(stressIds.has(refusal.noteId), 'the refusal is attributed to a stress-row member');
});

// ---------------------------------------------------------------------------
// 6. Only admitted bracket members scale; a clean dyad stays full size
// ---------------------------------------------------------------------------

test('Scaling eligibility: only admitted bracket members take 75 %; the two-note dyad stays full size', () => {
  const layouts = layoutsFor(EXCEPTION);
  const stress = layouts.find((l) => l.index === 8)!;
  const byId = new Map(stress.notes.map((p) => [p.note.id, p]));
  // The m. 33 downbeat chord is an admitted three-note bracket → scaled.
  const chord = stress.clasps.find((c) => c.notes.some((n) => n.id === 'dvs-stress-12288-9_5'))!;
  assert.equal(chord.notes.length, 3, 'the downbeat is an admitted three-note bracket');
  const preset = getKnockoutMetrics(optsFor(EXCEPTION), toksFor(EXCEPTION));
  for (const member of chord.notes) {
    const p = byId.get(member.id)!;
    assert.equal(p.symbolChord, true, `${member.id}: admitted bracket member`);
    assert.equal(p.symbolScale, 0.75, `${member.id}: scaled`);
  }
  // The next-onset dyad is a clean two-note column: `claspQualifies` never
  // brackets it, so it keeps full-size symbols and the canonical mask.
  const dyad = stress.notes.filter((p) => p.note.startTick === 12300);
  assert.equal(dyad.length, 2, 'a two-note dyad on the next onset');
  for (const p of dyad) {
    assert.equal(p.symbolChord, undefined, `${p.note.id}: not a bracket member`);
    assert.equal(p.symbolScale, undefined, `${p.note.id}: not scaled`);
    const extents = knockoutHalfExtents(optsFor(EXCEPTION), toksFor(EXCEPTION), p.note.startTick, p);
    assert.ok(
      Math.abs(extents.wx - preset.wx) < 1e-9,
      `${p.note.id}: the dyad head keeps the canonical full-size mask`
    );
  }
  // The admitted chord member's mask is genuinely smaller than the preset.
  const scaled = knockoutHalfExtents(optsFor(EXCEPTION), toksFor(EXCEPTION), chord.notes[0].startTick, byId.get(chord.notes[0].id)!);
  assert.ok(scaled.wx < preset.wx, 'the admitted member’s mask is the scaled one');
  // Canonical scale 1 stamps nothing anywhere on the golden spreads.
  const canonical = layoutJankoScore(SPECIMEN, resolveJankoOptions({ ...DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS, chordSymbolScale: 1 }), toksFor(ORDINARY));
  assert.ok(
    canonical.every((l) => l.notes.every((p) => p.symbolChord === undefined && p.symbolScale === undefined)),
    'canonical scale stamps no chord member'
  );
});

// ---------------------------------------------------------------------------
// 7. Canonical equivalence & the PR78 resolver fast path
// ---------------------------------------------------------------------------

test('Canonical equivalence: new fields default to no-ops; both goldens stay clean', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.bracketDurationGrammar, 'golden');
  assert.equal(DEFAULT_JANKO_OPTIONS.exceptionCarrier, 'none');
  assert.equal(DEFAULT_JANKO_OPTIONS.chordSymbolScale, 1);
  assert.equal(DEFAULT_JANKO_TOKENS.exceptionCarrierLength, 9.0);

  const specEmbed = resolveJankoOptions(DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS);
  assert.ok(specEmbed.pitchPlacement !== DEFAULT_JANKO_OPTIONS.pitchPlacement, 'the specimen is not the golden master');

  for (const id of [ORDINARY, BRACKET_CURRENT, BRACKET_COMPACT, EXCEPTION]) {
    const card = resolveCandidate(cardById(id));
    for (const window of card.windows) {
      assert.ok(!isAbstractCandidateWindow(window), `${id}: score window only`);
      assert.equal((window as { scoreId?: string }).scoreId, DURATION_VOCABULARY_SPECIMEN_STUDIO_SCORE_ID);
    }
  }

  const bach = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.deepEqual([bach.violations.length, bach.warnings.length], [0, 0], 'Bach GOLD stays 0/0');
  const brahms = lintJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.deepEqual([brahms.violations.length, brahms.warnings.length], [0, 0], 'Brahms BRONZE stays 0/0');

  // The new option fields are canonical no-ops: the Bach page renders byte-for-
  // byte identically with them stated explicitly as their defaults.
  const canonical = renderJankoPage(BACH, 0, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const explicit = renderJankoPage(
    BACH,
    0,
    resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, bracketDurationGrammar: 'golden', exceptionCarrier: 'none' }),
    DEFAULT_JANKO_TOKENS
  );
  assert.equal(explicit, canonical, 'the new fields add no ink to the canonical page');
});

test('PR78 resolver identity: the new fields keep the reuse-by-identity fast path', () => {
  for (const partial of [
    { bracketDurationGrammar: 'compact' as const },
    { exceptionCarrier: 'horizontal' as const },
    { bracketDurationGrammar: 'compact' as const, exceptionCarrier: 'horizontal' as const, chordSymbolScale: 0.75 },
  ]) {
    const resolved = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, ...partial });
    assert.equal(resolveJankoOptions(resolved), resolved, 'a resolved value is reused by identity');
    assert.notEqual(resolved, DEFAULT_JANKO_OPTIONS, 'the canonical defaults are never aliased out');
  }
  const tokens = resolveJankoTokens({ ...DEFAULT_JANKO_TOKENS, exceptionCarrierLength: 9.0 });
  assert.equal(resolveJankoTokens(tokens), tokens, 'resolved tokens are reused by identity');
  // The canonical options object is never mutated by the study columns.
  assert.equal(DEFAULT_JANKO_OPTIONS.bracketDurationGrammar, 'golden');
  assert.equal(DEFAULT_JANKO_OPTIONS.exceptionCarrier, 'none');
  assert.equal(DEFAULT_JANKO_TOKENS.exceptionCarrierLength, 9.0);
});

// ---------------------------------------------------------------------------
// 8. Paint and lint share one geometry (no metric drift)
// ---------------------------------------------------------------------------

test('Paint and audit share one carrier metric: the ink box equals the painted run', () => {
  for (const layout of layoutsFor(EXCEPTION)) {
    for (const carrier of layout.exceptionCarriers) {
      const box = exceptionCarrierInkBox(carrier, toksFor(EXCEPTION));
      assert.ok(Math.abs(box.x1 - box.x0) >= toksFor(EXCEPTION).exceptionCarrierLength - 1e-9, 'the box covers the carrier');
      // The marks never leave the box the audit reads.
      const marks = compactDurationMarks(carrier.durationTicks);
      assert.equal(marks.cuts, carrier.cuts);
      assert.equal(marks.rings, carrier.rings);
    }
  }
  // A carrier's box is the union of the fixed 9.0pt line and its end marks —
  // exactly the geometry `renderExceptionCarrier` paints.
  const clean = layoutsFor(EXCEPTION)
    .flatMap((l) => l.exceptionCarriers)
    .filter((c: JankoExceptionCarrierGeometry) => c.dots === 0 && c.rings === 0);
  assert.ok(clean.some((c) => c.cuts > 0), 'at least one cut-only carrier exists');
  for (const carrier of clean) {
    const t = toksFor(EXCEPTION);
    const box = exceptionCarrierInkBox(carrier, t);
    const xm = (carrier.x0 + carrier.x1) / 2;
    const half = t.compactCutLength / 2;
    const span = ((carrier.cuts - 1) / 2) * t.compactMarkSpacing;
    const markX0 = xm - span - half;
    const markX1 = xm + span + half;
    assert.ok(Math.abs(box.x0 - Math.min(carrier.x0, markX0)) < 1e-9, 'left edge = min(line, marks)');
    assert.ok(Math.abs(box.x1 - Math.max(carrier.x1, markX1)) < 1e-9, 'right edge = max(line, marks)');
    // The vertical extent is the cut half-thickness the arm needs (0.21pt), so
    // the carrier cannot reach a 2-span same-column neighbour 5.0pt away.
    assert.ok(box.y1 - box.y0 <= t.compactCutLength + 1e-9, 'vertical extent ≤ the cut arm');
  }
});

// ---------------------------------------------------------------------------
// 9. Ordinary semantics untouched; the strips stay honest
// ---------------------------------------------------------------------------

test('Ordinary column is the untouched canonical vocabulary: 4/3/2/1 flags, no bracket ink, no rests', () => {
  const svg = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.ordinary.first, 8, optsFor(ORDINARY), toksFor(ORDINARY));
  // 3/6/12/24 paint their flags in order — 3 and 6 DO show 4 and 3 flags —
  // and every value from 48 up is a bare stem (no flag anywhere in mm. 5–8).
  assert.deepEqual(
    [...svg.matchAll(/data-flag-count="(\d+)"/g)].map((m) => Number(m[1])),
    [4, 3, 2, 1],
    'the ordinary isolated flags, never replaced by a bracket'
  );
  assert.ok(!svg.includes('janko-clasp-group'), 'a lone note is never bracketed');
  assert.ok(!svg.includes('janko-clasp-cut'), 'no compact bracket ink on the ordinary column');
  assert.ok(!svg.includes('janko-exception-carrier-line'), 'no exception carrier on the ordinary column');
  assert.ok(!svg.includes('janko-rest-group'), 'a sparse row paints no rest');
});

test('Study strips: no rests anywhere; the beam strip is real beams, not flags', () => {
  for (const id of [ORDINARY, BRACKET_CURRENT, BRACKET_COMPACT, EXCEPTION]) {
    const o = optsFor(id);
    const t = toksFor(id);
    // Augmentation strip: dots only, no rests.
    const aug = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.augmentation.first, 6, o, t);
    assert.ok(!aug.includes('janko-rest-group'), `${id}: augmentation strip has no rest`);
    // Beam strip: real beam ink, never a flag substituting for a beam.
    const beam = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.beamed.first, 2, o, t);
    assert.ok(beam.includes('janko-beam'), `${id}: the beam strip paints beams`);
    assert.ok(!beam.includes('janko-rest-group'), `${id}: beam strip has no rest`);
    // Stress strip: no rests either, and the carrier column publishes its one
    // shortfall while the others keep the current exact statement.
    const stress = renderJankoCrop(SPECIMEN, DURATION_VOCABULARY_BANDS.stress.first, 2, o, t);
    assert.ok(!stress.includes('janko-rest-group'), `${id}: stress strip has no rest`);
    if (id === EXCEPTION) {
      assert.ok(stress.includes('janko-exception-carrier-line'), 'the exception column paints carriers');
    } else {
      assert.ok(!stress.includes('janko-exception-carrier-line'), `${id}: no carrier outside the study column`);
    }
  }
});
