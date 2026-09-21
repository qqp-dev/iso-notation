/**
 * Implementer Visual Linter — invariant suite.
 *
 * Covers:
 *  1. Structured diagnostics from `lintJankoScore(score, options, tokens)`.
 *  2. The canonical Bach Goldberg Var. 1 engraving is clean under
 *     `DEFAULT_JANKO_OPTIONS` / `DEFAULT_JANKO_TOKENS`.
 *  3. Every geometric check catches its intentional layout defect
 *     (overlapping heads, undersized/missing knockouts, pass-through, extreme
 *     beam slope, detached stems, barline / accolade / numeral collisions,
 *     Middle C corridor intrusion).
 *  4. The document-level paint-order audit catches layer regressions.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildChordDurationSpecimenScore } from '../src/scores/chord-duration-specimen';
import { QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { continuousPitchY } from '../src/render/janko/geometry';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoChordGrouping,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  JankoSystemLayout,
  computePageGeometry,
  drawnStaffRuleYs,
  getSystemGeometry,
  layoutJankoScore,
  renderSystem,
} from '../src/render/janko/engine';
import { getStemAttachmentRadius, getStemGeometry, stemRingCenters } from '../src/render/janko/elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
} from '../src/render/janko/elements/notehead';
import { pitchGridRules } from '../src/render/janko/elements/staff';
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  JANKO_LINT_CHECKS,
  LintViolation,
  auditKnockoutProtection,
  auditStemBeamConnections,
  checkAccoladeClearance,
  checkBarlineClearance,
  checkBeamNoteheadClearance,
  checkBeamRestClearance,
  checkClaspClearance,
  checkClaspDotFusion,
  checkDotCollision,
  checkDotCountAgreement,
  checkDurationInkOwnership,
  checkHaloClearance,
  checkKnockoutCoverage,
  checkMeasureNumeralClearance,
  checkMiddleCCorridor,
  checkNoteheadClearance,
  checkOttavaClearance,
  checkOttavaCoverage,
  checkOttavaExtensions,
  checkRestClearance,
  checkRestSeat,
  checkStaffSegments,
  checkSplitStackStems,
  checkStemAndBeamValidity,
  checkStemDigitClearance,
  checkStemRingGeometry,
  checkStemForeignDigitClearance,
  checkStemThroughSimultaneity,
  checkUnwrittenRests,
  formatLintReport,
  lintJankoScore,
  systemBarlines,
} from '../src/render/janko/linter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const SCORE = buildBachGoldbergVar1Score();
/** The Round 47 linter fixtures engrave the real Brahms Intermezzo. */
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const LINT = DEFAULT_JANKO_LINT_OPTIONS;
const TOKENS = DEFAULT_JANKO_TOKENS;
const BRAHMS_TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const R = TOKENS.noteheadRadius;
const HALO_R = TOKENS.haloRadius;
/** The golden rectangular mask half-extents (Round 17B verdict `'tight'`). */
const MASK_WX = getClusterSpacingPreset('tight').wx;
const MASK_HY = getClusterSpacingPreset('tight').hy;
/** Canonical flush stem attachment radii (regular heads / tick-0 honor sounds). */
const REGULAR_ATTACH = MASK_HY + 0.2;
const HONOR_ATTACH = HALO_R + 0.4;
/** Paint-audit options for the golden mask. */
const MASK_AUDIT = { knockoutWx: MASK_WX, knockoutHy: MASK_HY, haloRadius: HALO_R };

// --- Tiny document fixtures for the paint-order audit -----------------------

/** The Round 17 sharp rectangular mask. */
const knockout = (cx: number, cy: number, wx: number = MASK_WX, hy: number = MASK_HY): string =>
  `<rect class="janko-knockout" x="${(cx - wx).toFixed(2)}" y="${(cy - hy).toFixed(2)}" width="${(2 * wx).toFixed(2)}" height="${(2 * hy).toFixed(2)}" fill="#FFFFFF"/>`;
const digit = (cx: number, cy: number): string =>
  `<text class="janko-digit" x="${cx}" y="${(cy + JANKO_DIGIT_BASELINE_OFFSET).toFixed(2)}" font-size="${TOKENS.digitFontSize}pt">7</text>`;
const halo = (cx: number, cy: number, r: number = HALO_R): string =>
  `<circle class="janko-halo" cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="#111111" stroke-width="0.75"/>`;
const stem = (x: number, y1: number, y2: number): string =>
  `<line class="janko-stem" x1="${x}" y1="${y1.toFixed(2)}" x2="${x}" y2="${y2.toFixed(2)}" stroke="#111"/>`;
/** Stem direction of a hand: -1 = RH (up), +1 = LH (down). */
const dir = (hand: string): number => (hand === 'RH' ? -1 : 1);

function run(
  check: (layout: JankoSystemLayout, out: LintViolation[]) => void,
  layout: JankoSystemLayout
): LintViolation[] {
  const out: LintViolation[] = [];
  check(layout, out);
  return out;
}

function systems(options = DEFAULT_JANKO_OPTIONS, tokens = DEFAULT_JANKO_TOKENS): JankoSystemLayout[] {
  return layoutJankoScore(SCORE, options, tokens);
}

// ---------------------------------------------------------------------------
// 1 + 2. Report shape and the clean golden master
// ---------------------------------------------------------------------------

test('lintJankoScore returns structured diagnostics for the canonical score', () => {
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.ok(Array.isArray(report.violations), 'violations is an array');
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.diagnostics));
  // Round 48 adds the `'info'` severity: a **published fact**, not a defect. It
  // is listed in `diagnostics` (so the Reference view can show it) but is
  // neither a violation nor a warning, and `--strict` never gated it.
  const notes = report.diagnostics.filter((d) => d.severity === 'info');
  assert.equal(
    report.diagnostics.length,
    report.violations.length + report.warnings.length + notes.length
  );
  assert.equal(
    report.diagnostics.filter((d) => d.severity === 'error').length,
    report.violations.length
  );
  assert.equal(report.ok, report.violations.length === 0);
  assert.equal(report.stats.systems, 8, 'four measures x eight systems of Bach Var. 1');
  assert.equal(report.stats.measures, 32);
  assert.equal(
    report.stats.notes,
    SCORE.notes.length - 1,
    'the Goldberg’s one cross-hand unison paints one head (Round 20)'
  );
  assert.ok(report.stats.beams > 100, 'beamed dialect produces beam groups');
  assert.equal(report.stats.checks, JANKO_LINT_CHECKS.length);
  for (const v of report.diagnostics) {
    assert.ok(typeof v.code === 'string' && v.code.length > 0, 'code present');
    assert.ok(v.severity === 'error' || v.severity === 'warning');
    assert.ok(typeof v.message === 'string' && v.message.length > 0, 'message present');
    assert.ok(Number.isFinite(v.system), 'system index present');
  }
});

test('Canonical Bach Goldberg Var. 1 with DEFAULT_JANKO_OPTIONS has zero violations', () => {
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.deepEqual(
    report.violations.map((v) => `${v.code}: ${v.message}`),
    [],
    'golden master must be violation-free'
  );
  assert.equal(report.ok, true);
  // Row-Snapped Parity Offset (Approach 2) closed the last open item: the nine
  // cross-hand coincidences — two voices landing on one whole-tone row of one
  // octave at one instant — are now spread horizontally around the beat instead
  // of being reported. The golden master is therefore completely clean.
  assert.deepEqual(
    report.diagnostics.map((d) => `${d.code}: ${d.message}`),
    [],
    'the golden master reports neither violations nor warnings'
  );
  assert.equal(report.stats.warnings, 0);
  assert.equal(report.stats.violations, 0);
});

test('Row-snapped chord tones: every same-row pair is fanned by the preset pair gap', () => {
  const report = lintJankoScore(SCORE, { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' }, DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(SCORE, { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' }, DEFAULT_JANKO_TOKENS);
  // Round 17B: the golden `'tight'` fan is the asymmetric preset pair gap
  // 2wx + air (5.46pt) — tighter than the old circular diameter, and wider
  // than the box-overlap bound the clearance model audits.
  const offset = getClusterSpacingPreset('tight').pairGap;
  let pairs = 0;
  for (const layout of layouts) {
    const rows = new Map<string, typeof layout.notes>();
    for (const p of layout.notes) {
      const key = `${p.note.startTick}|${(p.y + 0).toFixed(3)}`;
      const bucket = rows.get(key);
      if (bucket) bucket.push(p);
      else rows.set(key, [p]);
    }
    for (const group of rows.values()) {
      if (group.length < 2) continue;
      pairs++;
      const xs = group.map((p) => p.x).sort((a, b) => a - b);
      assert.equal(group.length, 2, 'the canonical score only doubles rows');
      assert.ok(
        Math.abs(xs[1] - xs[0] - offset) < 1e-6,
        `spread pair keeps Δx = ${offset.toFixed(2)}pt (got ${(xs[1] - xs[0]).toFixed(2)})`
      );
      assert.ok(xs[1] - xs[0] >= offset - 1e-6, 'the fan meets the preset pair gap');
      for (const p of group) assert.equal(p.coord.rank, group[0].coord.rank, 'true row preserved');
    }
  }
  // Round 20: eight of the nine canonical same-row coincidences are true
  // cross-hand doublings of *different* pitches (fanned); the ninth was the
  // final bar's unison 550/551, whose one sound now merges to one digit instead
  // of fanning into two.
  assert.equal(pairs, 8, 'the eight remaining cross-hand coincidences are all spread');
  assert.equal(report.stats.warnings, 0);
});

test('Bounded center channel (Round 4 Candidate B) engraves with zero violations', () => {
  const channel = { ...DEFAULT_JANKO_OPTIONS, channelLayout: 'bounded-channel' as const };
  const report = lintJankoScore(SCORE, channel, DEFAULT_JANKO_TOKENS);
  assert.deepEqual(
    report.violations.map((v) => `${v.code}: ${v.message}`),
    [],
    'the channel layout must be as clean as the golden master'
  );
  assert.equal(report.ok, true);
  // The channel separates the two whole-tone rows, so the same-row
  // coincidences of the single equator simply do not exist here. Round 11's
  // symmetrical 30pt corridor brings the two dynamic flank rows within 4pt of
  // each other on two cross-hand coincidences, which the linter reports as the
  // known non-blocking `chordal-overlap` risk rather than a violation.
  assert.ok(
    report.warnings.every((w) => w.code === 'chordal-overlap'),
    'the bounded channel adds no warning class of its own'
  );
  assert.equal(report.stats.warnings, report.warnings.length);
  // The corridor is structural: no beam connector may slice across the spine,
  // whichever octave framing is in force.
  assert.equal(
    report.diagnostics.filter((d) => d.code === 'corridor-intrusion').length,
    0,
    'the bounded channel keeps the Middle C corridor beam-free'
  );
});

test('Visual lint of the canonical score is a millisecond-scale operation', () => {
  const started = Date.now();
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 500, `lint must stay fast (took ${elapsed}ms)`);
  assert.ok(report.stats.durationMs <= elapsed + 5);
});

test('formatLintReport renders a human-readable summary', () => {
  const text = formatLintReport(lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS));
  assert.match(text, /Jánko visual lint/);
  assert.match(text, /8 systems · 32 measures/);
  assert.match(text, /550 noteheads/);
  assert.match(text, /✓ clean/, 'the golden master reports clean with no diagnostic lines');
});

// ---------------------------------------------------------------------------
// 3. Geometric defect detection
// ---------------------------------------------------------------------------

test('Defect: two different onsets collapsing onto one point is a notehead overlap', () => {
  const layout = systems()[0];
  // Two 16ths of different hands, forced onto one page point. The fixture is
  // narrowed to the pair under test so the score's own cross-hand coincidences
  // cannot add diagnostics.
  const a = layout.notes[2];
  const b = layout.notes[3];
  assert.notEqual(a.note.startTick, b.note.startTick, 'the defect needs distinct onsets');
  const collided: JankoSystemLayout = {
    ...layout,
    notes: [a, { ...b, x: a.x, y: a.y }],
  };
  const out = run(
    (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, o),
    collided
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'notehead-overlap');
  assert.equal(out[0].severity, 'error');
  assert.deepEqual(out[0].noteIds, [a.note.id, b.note.id]);
  assert.equal(out[0].metrics?.distance, 0);
});

test('Defect: chordal heads on one point is warned, not silently accepted', () => {
  const layout = systems()[0];
  const a = layout.notes[2];
  const b = layout.notes[3];
  assert.notEqual(a.note.startTick, b.note.startTick, 'the defect needs distinct onsets');
  const chordal: JankoSystemLayout = {
    ...layout,
    notes: [
      a,
      { ...b, x: a.x, y: a.y, note: { ...b.note, startTick: a.note.startTick } },
    ],
  };
  const out = run(
    (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, o),
    chordal
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'chordal-overlap');
  assert.equal(out[0].severity, 'warning');
});

test('Row-snapped chord tones warn exactly where their mask boxes overlap', () => {
  const layout = systems()[0];
  const a = layout.notes[2];
  const b = layout.notes[3];
  /** The same two heads forced onto one row of one octave. */
  const pairAt = (dx: number): JankoSystemLayout => ({
    ...layout,
    notes: [
      a,
      {
        ...b,
        x: a.x + dx,
        y: a.y,
        rhythm: { ...b.rhythm, x: a.x + dx, y: a.y },
        note: { ...b.note, startTick: a.note.startTick },
      },
    ],
  });
  const lintAt = (dx: number): LintViolation[] =>
    run(
      (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, o),
      pairAt(dx)
    );

  assert.equal(lintAt(2 * MASK_WX - 0.01).length, 1, 'overlapping masks still collide');
  assert.equal(lintAt(2 * MASK_WX - 0.01)[0].code, 'chordal-overlap');
  assert.equal(lintAt(2 * MASK_WX).length, 0, 'touching masks clear the warning');
  const gap = getClusterSpacingPreset('tight').pairGap;
  assert.equal(lintAt(gap - 0.01).length, 0, 'a shrunk-but-clear fan is legal');
});

test('Different-onset neighbours keep the box bound', () => {
  const layout = systems()[0];
  const a = layout.notes[2];
  const b = layout.notes[3];
  assert.notEqual(a.note.startTick, b.note.startTick, 'the pair needs distinct onsets');
  /** The same two heads forced onto one row at a horizontal distance. */
  const pairAt = (dx: number): JankoSystemLayout => ({
    ...layout,
    notes: [a, { ...b, x: a.x + dx, y: a.y }],
  });
  const lintAt = (dx: number): LintViolation[] =>
    run(
      (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, o),
      pairAt(dx)
    );

  assert.equal(lintAt(2 * MASK_WX - 0.01).length, 1, 'overlapping masks still collide');
  assert.equal(lintAt(2 * MASK_WX - 0.01)[0].code, 'notehead-overlap');
  assert.equal(lintAt(2 * MASK_WX).length, 0, 'touching masks clear the error');
});

test('Defect: a digit grown past its mask margin is caught', () => {
  const big = { ...DEFAULT_JANKO_TOKENS, digitFontSize: 9.0 };
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, big);
  const undersized = report.violations.filter((v) => v.code === 'knockout-undersized');
  assert.equal(
    undersized.length,
    SCORE.notes.length - 1,
    'every painted notehead reports its undersized mask (the merged unison paints one)'
  );
  assert.match(undersized[0].message, /cannot shield the 9pt digit/);
  assert.ok(undersized[0].metrics!.horizontal < undersized[0].metrics!.required);
  assert.ok(undersized[0].metrics!.vertical < undersized[0].metrics!.required);
});

test('Golden master: every digit keeps the preset margin of white inside its knockout rect', () => {
  const { halfWidth, halfHeight } = digitHalfExtents(TOKENS.digitFontSize);
  const preset = getClusterSpacingPreset('tight');
  const out: LintViolation[] = [];
  for (const layout of systems()) {
    checkKnockoutCoverage(layout, DEFAULT_JANKO_OPTIONS, TOKENS, LINT, out);
  }
  assert.deepEqual(out, [], 'the canonical mask shields every digit on every side');
  assert.ok(preset.wx - halfWidth >= preset.margin - 0.01, 'left/right preset margin');
  assert.ok(preset.hy - halfHeight >= preset.margin - 0.01, 'top/bottom preset margin');

  // The check is a real gate: a 9pt digit overflows the golden mask.
  const big = { ...DEFAULT_JANKO_TOKENS, digitFontSize: 9.0 };
  const bigOut: LintViolation[] = [];
  checkKnockoutCoverage(
    systems(DEFAULT_JANKO_OPTIONS, big)[0],
    DEFAULT_JANKO_OPTIONS,
    big,
    LINT,
    bigOut
  );
  assert.ok(bigOut.length > 0);
  assert.ok(bigOut.every((v) => v.code === 'knockout-undersized'));
});

test('Defect: a stem that starts inside its circle (or floats off it) is caught', () => {
  const layout = systems()[0];
  // Pull each notehead's rhythm anchor inward: the stem then emerges *inside*
  // the knockout disc — or, for the tick-0 sounds, inside the halo ring.
  const inside: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p, i) =>
      i < 2 ? { ...p, rhythm: { ...p.rhythm, y: p.y - dir(p.rhythm.hand) * 4 } } : p
    ),
  };
  const out: LintViolation[] = [];
  checkStemAndBeamValidity(inside, TOKENS, LINT, out);
  const detached = out.filter((v) => v.code === 'stem-detached');
  assert.equal(detached.length, 2, 'both opening stems are reported');
  for (const v of detached) {
    assert.ok(v.metrics!.attach < v.metrics!.required);
    assert.match(v.message, /inside the .*(ring|mask edge)/);
  }

  // Push the anchor outward instead: the stem floats off the glyph circle.
  const floating: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p, i) =>
      i < 2 ? { ...p, rhythm: { ...p.rhythm, y: p.y + dir(p.rhythm.hand) * 4 } } : p
    ),
  };
  const out2: LintViolation[] = [];
  checkStemAndBeamValidity(floating, TOKENS, LINT, out2);
  const floats = out2.filter((v) => v.code === 'stem-detached');
  assert.equal(floats.length, 2);
  for (const v of floats) {
    assert.ok(v.metrics!.attach > v.metrics!.required);
    assert.match(v.message, /floats off the head/);
  }
});

test('Golden master: stems attach flush, keep digit air and never pierce a halo', () => {
  const out: LintViolation[] = [];
  let honored = 0;
  for (const layout of systems()) {
    checkStemAndBeamValidity(layout, TOKENS, LINT, out);
    checkStemDigitClearance(layout, TOKENS, LINT, out);
    for (const p of layout.notes) {
      const stem = getStemGeometry(p.rhythm, TOKENS);
      const attach = Math.hypot(stem.stemX - p.x, stem.stemStartY - p.y);
      assert.ok(
        Math.abs(attach - getStemAttachmentRadius(p.rhythm, TOKENS)) < 1e-9,
        `${p.note.id} attaches exactly on the flush perimeter (${attach.toFixed(3)}pt)`
      );
      if (isPositionOfHonor(p.note.startTick)) honored++;
    }
  }
  // The halo rule runs against the opt-in halo paint, where the rings exist.
  for (const layout of systems({ ...DEFAULT_JANKO_OPTIONS, showHonorHalo: true })) {
    checkHaloClearance(layout, TOKENS, LINT, out);
  }
  assert.deepEqual(out, [], 'flush stems, digit air and halo clearance all hold');
  assert.equal(honored, 2, 'both opening sounds are audited against the halo');
  for (const check of ['stem-digit-clearance', 'halo-clearance'] as const) {
    assert.ok(
      (JANKO_LINT_CHECKS as readonly string[]).includes(check),
      `${check} is part of the lint contract`
    );
  }
});

test('Defect: a Position of Honor stem driven through the halo ring is caught', () => {
  const layout = systems()[0];
  const opening = layout.notes.filter((p) => p.note.startTick === 0);
  assert.equal(opening.length, 2, 'two opening sounds');
  const broken: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p) =>
      isPositionOfHonor(p.note.startTick)
        ? { ...p, rhythm: { ...p.rhythm, y: p.y - dir(p.rhythm.hand) * 4 } }
        : p
    ),
  };
  const out: LintViolation[] = [];
  checkHaloClearance(broken, TOKENS, LINT, out);
  assert.equal(out.length, 2, 'both halo-piercing stems are reported');
  assert.ok(out.every((v) => v.code === 'halo-piercing' && v.severity === 'error'));
  for (const v of out) {
    assert.ok(v.metrics!.distance < v.metrics!.required);
    assert.match(v.message, /cuts through the halo/);
  }
});

test('Golden master: every stem is engraved on its notehead centreline', () => {
  const out: LintViolation[] = [];
  for (const layout of systems()) {
    checkStemAndBeamValidity(layout, DEFAULT_JANKO_TOKENS, LINT, out);
    for (const p of layout.notes) {
      assert.equal(
        getStemGeometry(p.rhythm, DEFAULT_JANKO_TOKENS).stemX,
        p.x,
        `${p.note.id} keeps stemX === note.x — the Round 15 stagger is deleted`
      );
    }
    const split: LintViolation[] = [];
    checkSplitStackStems(layout, DEFAULT_JANKO_TOKENS, split);
    assert.deepEqual(split, [], `system ${layout.index + 1}: no onset column splits its stems`);
  }
  assert.deepEqual(out, [], 'centred stems attach inside the mask and span their beam');
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('split-stack-stems'),
    'the split-stack audit is part of the published check list'
  );
});

test('Defect: a stem engraved off the notehead centreline is caught', () => {
  const layout = systems()[0];
  const shifted: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p, i) =>
      i === 0 ? { ...p, rhythm: { ...p.rhythm, x: p.x + 1.4 } } : p
    ),
  };
  const out: LintViolation[] = [];
  checkStemAndBeamValidity(shifted, DEFAULT_JANKO_TOKENS, LINT, out);
  const offCentre = out.filter(
    (v) => v.code === 'stem-detached' && /centreline/.test(v.message)
  );
  assert.equal(offCentre.length, 1, 'the perimeter-style offset must be reported');
  assert.deepEqual(offCentre[0].noteIds, [layout.notes[0].note.id]);
  assert.ok(Math.abs(offCentre[0].metrics!.offset - 1.4) < 1e-9);
});

test('Golden master: no beam connector cuts into any notehead disc', () => {
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('beam-notehead-clearance'),
    'the beam/notehead clearance check is part of the lint contract'
  );
  const required = DEFAULT_JANKO_TOKENS.noteheadRadius + DEFAULT_JANKO_TOKENS.minStemClearance;
  const out: LintViolation[] = [];
  const layouts = systems();
  for (const layout of layouts) {
    checkBeamNoteheadClearance(layout, DEFAULT_JANKO_TOKENS, LINT, out);
  }
  assert.deepEqual(out, [], 'every head keeps noteheadRadius + minStemClearance of air');
  // The ticket's ascending runs: m. 2 (tick 156) and m. 4 (tick 540) keep a full
  // stem between the upper notehead and the beam.
  for (const tick of [156, 540]) {
    const beam = layouts[0].beams.find((b) => b.notes.some((n) => n.startTick === tick));
    assert.ok(beam, `tick ${tick} belongs to a beam group`);
    for (const n of beam.notes) {
      const stemLen =
        beam.direction === -1 ? n.y - beam.beamY(n.x) : beam.beamY(n.x) - n.y;
      assert.ok(
        stemLen >= required,
        `${n.id} keeps ${stemLen.toFixed(2)}pt of stem (${required.toFixed(2)}pt required)`
      );
    }
  }
});

test('Defect: a beam driven through a notehead is caught', () => {
  const layout = systems()[0];
  const beam = layout.beams[0];
  const victim = beam.notes[1];
  const broken: JankoSystemLayout = {
    ...layout,
    beams: [
      {
        ...beam,
        primary: { x1: beam.primary.x1, y1: victim.y, x2: beam.primary.x2, y2: victim.y },
        secondary: null,
      },
      ...layout.beams.slice(1),
    ],
  };
  const out: LintViolation[] = [];
  checkBeamNoteheadClearance(broken, DEFAULT_JANKO_TOKENS, LINT, out);
  assert.ok(out.length > 0, 'a beam through a glyph must be reported');
  assert.ok(out.every((v) => v.code === 'beam-notehead-collision'));
  assert.ok(out.every((v) => v.severity === 'error'));
  assert.ok(out.some((v) => (v.noteIds ?? []).includes(victim.id)));
  assert.ok(out[0].metrics!.distance < out[0].metrics!.required);
});

test('Defect: a foreign-stem crossing without its tall knockout is caught', () => {
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('stem-foreign-digit-clearance'),
    'check registered'
  );
  const layout = systems()[3];
  const flagged = layout.notes.filter((p) => p.tallKnockout);
  assert.ok(flagged.length > 0, 'system 3 carries crossed notes');
  const broken: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p) => ({ ...p, tallKnockout: undefined })),
  };
  const out: LintViolation[] = [];
  checkStemForeignDigitClearance(broken, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, out);
  assert.ok(out.length > 0, 'unflagged crossings must be reported');
  assert.ok(out.every((v) => v.code === 'stem-foreign-digit-collision'));
  assert.ok(out.every((v) => v.severity === 'error'));
  const victims = new Set(flagged.map((p) => p.note.id));
  assert.ok(
    out.every((v) => (v.noteIds ?? []).some((id) => victims.has(id))),
    'every violation names a crossed digit'
  );

  const clean: LintViolation[] = [];
  checkStemForeignDigitClearance(layout, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, clean);
  assert.deepEqual(clean, [], 'flagged layout passes');
});

test('Defect: an unclamped beam slope is caught by the geometry check and the SVG audit', () => {
  const wild = { ...DEFAULT_JANKO_TOKENS, maxBeamSlope: 4.0 };
  const out: LintViolation[] = [];
  const layouts = systems(DEFAULT_JANKO_OPTIONS, wild);
  for (const layout of layouts) checkStemAndBeamValidity(layout, wild, LINT, out);
  const slopes = out.filter((v) => v.code === 'beam-slope');
  assert.ok(slopes.length > 0, 'raw slopes up to ~3.1 must be reported');
  assert.ok(Math.abs(slopes[0].metrics!.slope) > LINT.maxBeamSlope);
  assert.ok(Math.abs(slopes[0].metrics!.rawSlope) > LINT.maxBeamSlope);

  const svg = '<svg><line class="janko-beam" x1="0" y1="0" x2="10" y2="10" stroke="#111"/></svg>';
  const audit = auditStemBeamConnections(svg, {
    stemLength: DEFAULT_JANKO_TOKENS.stemLength,
    maxBeamSlope: LINT.maxBeamSlope,
  });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].code, 'beam-slope');
  assert.ok(audit[0].metrics!.slope > 0.9);
});

test('Defect: the SVG audit reads beam centrelines from filled rail paths', () => {
  const options = {
    stemLength: DEFAULT_JANKO_TOKENS.stemLength,
    maxBeamSlope: LINT.maxBeamSlope,
    stemAttachmentRadius: REGULAR_ATTACH,
    honorStemAttachmentRadius: HONOR_ATTACH,
  };
  // A rail path is a parallelogram M ax ayT L bx byT L bx byB L ax ayB Z; the
  // audit recovers the (ax,ay)-(bx,by) centreline for the slope and landing checks.
  const wild =
    '<svg><path class="janko-beam" d="M 0.00 -1.00 L 10.00 9.00 L 10.00 10.80 L 0.00 0.80 Z" fill="#111"/></svg>';
  const slopeAudit = auditStemBeamConnections(wild, {
    stemLength: DEFAULT_JANKO_TOKENS.stemLength,
    maxBeamSlope: LINT.maxBeamSlope,
  });
  assert.equal(slopeAudit.length, 1);
  assert.equal(slopeAudit[0].code, 'beam-slope');
  assert.ok(slopeAudit[0].metrics!.slope > 0.9);

  // A non-canonical stem landing on a path-drawn rail centreline is legal.
  const railY = 75;
  const legal =
    `<svg><path class="janko-beam" d="M 0.00 ${(railY - 0.9).toFixed(2)} L 20.00 ${(railY - 0.9).toFixed(2)} ` +
    `L 20.00 ${(railY + 0.9).toFixed(2)} L 0.00 ${(railY + 0.9).toFixed(2)} Z" fill="#111"/>` +
    `<line class="janko-stem" x1="10" y1="100" x2="10" y2="75" stroke="#111"/></svg>`;
  assert.deepEqual(auditStemBeamConnections(legal, options), [], 'stem lands on the rail path');
});

test('Defect: a stem that does not land on any beam is caught in the rendered SVG', () => {
  const options = {
    stemLength: DEFAULT_JANKO_TOKENS.stemLength,
    maxBeamSlope: LINT.maxBeamSlope,
    stemAttachmentRadius: REGULAR_ATTACH,
    honorStemAttachmentRadius: HONOR_ATTACH,
  };
  const svg = '<svg><line class="janko-stem" x1="10" y1="100" x2="10" y2="70" stroke="#111"/></svg>';
  const audit = auditStemBeamConnections(svg, options);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].code, 'beam-stem-gap');
  assert.match(audit[0].message, /does not land on any beam/);

  // Standalone stems of both canonical flush lengths are legal: the length is
  // measured from the outer edge of the glyph circle, not the notehead centre.
  for (const attachment of [REGULAR_ATTACH, HONOR_ATTACH]) {
    const length = DEFAULT_JANKO_TOKENS.stemLength - attachment;
    const legal = `<svg><line class="janko-stem" x1="10" y1="100" x2="10" y2="${(100 - length).toFixed(2)}" stroke="#111"/></svg>`;
    assert.deepEqual(auditStemBeamConnections(legal, options), [], `${length}pt stem is canonical`);
  }
});

test('Defect: noteheads driven into a barline are caught', () => {
  const fat = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 9.0 };
  const out: LintViolation[] = [];
  const layout = systems(DEFAULT_JANKO_OPTIONS, fat)[0];
  checkBarlineClearance(layout, DEFAULT_JANKO_OPTIONS, fat, LINT, out);
  assert.ok(out.length > 0, 'a 9pt head cannot clear the measure boundary');
  assert.ok(out.every((v) => v.code === 'barline-collision'));
});

test('Defect: a system-start mark pushed off the page and into the numeral is caught', () => {
  // Round 14's golden default *is* the ruled system start
  // (`'architectural-bracket'`), so the audit is exercised on the canonical
  // reserved margin column itself.
  const ruled = { ...DEFAULT_JANKO_OPTIONS, systemStartStyle: 'architectural-bracket' as const };
  const offPage = { ...ruled, pageMarginLeft: -20.0 };
  const out: LintViolation[] = [];
  const layout = systems(offPage)[0];
  checkAccoladeClearance(layout, offPage, DEFAULT_JANKO_TOKENS, LINT, out);
  assert.ok(
    out.some((v) => v.code === 'accolade-collision' && /leaves the left margin/.test(v.message)),
    'off-page system-start mark reported'
  );

  // …and the inkless styles paint no mark, so there is nothing to report.
  const open: LintViolation[] = [];
  const openOptions = { ...DEFAULT_JANKO_OPTIONS, systemStartStyle: 'open-halo' as const };
  const openLayout = systems(openOptions)[0];
  checkAccoladeClearance(openLayout, openOptions, DEFAULT_JANKO_TOKENS, LINT, open);
  assert.deepEqual(open, [], 'the open margin has no mark to audit');
  const goldenAudit: LintViolation[] = [];
  checkAccoladeClearance(systems()[0], DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, goldenAudit);
  assert.deepEqual(goldenAudit, [], 'the canonical flared bracket clears its own audit');

  // Round 11 sets the numeral snug above the top rule and right-aligned 10pt
  // into the margin, so the ruled column and the numeral coexist: the audit
  // reports nothing for the canonical geometry.
  const snug = { ...DEFAULT_JANKO_TOKENS, accoladeGap: 1.0 };
  const clean: LintViolation[] = [];
  checkMeasureNumeralClearance(systems(ruled)[0], ruled, snug, LINT, clean);
  assert.deepEqual(clean, [], 'the margin numeral and the ruled mark coexist');

  // A regression that drives the numeral's band down into the mark's column is
  // caught even though both sit left of the staff.
  const sunkLayout = systems(ruled)[0];
  const c5Y = sunkLayout.geometry.middleCY + continuousPitchY(60, DEFAULT_JANKO_TOKENS.semitoneScale);
  const sunk = {
    ...sunkLayout,
    geometry: {
      ...sunkLayout.geometry,
      staffTopY: c5Y + 4,
    },
  };
  const out2: LintViolation[] = [];
  checkMeasureNumeralClearance(sunk, ruled, DEFAULT_JANKO_TOKENS, LINT, out2);
  assert.ok(
    out2.some((v) => v.code === 'measure-numeral-collision' && /accolade/.test(v.message)),
    'numeral/system-start collision reported'
  );
});

test('Defect: collapsing the Middle C corridor is caught', () => {
  // Round 12: the vertical grid crosses the corridor on purpose, so the
  // remaining corridor invariant is the horizontal one — a squeezed lattice
  // drives the Octave 4 rule into the spine.
  const cramped = { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const, interStaffGap: 2.0 };
  const out: LintViolation[] = [];
  const layout = systems(cramped)[0];
  checkMiddleCCorridor(layout, cramped, DEFAULT_JANKO_TOKENS, LINT, out);
  const intrusions = out.filter((v) => v.code === 'corridor-intrusion');
  assert.ok(intrusions.length > 0, 'a horizontal rule may not cut the spine');
  assert.ok(intrusions.some((v) => /equator rule/.test(v.message)));
});

test('Round 12: the continuous grid is not a corridor intrusion by construction', () => {
  // Every barline and beat pulse spans `rhTop..lhBot`; the audit must accept
  // that continuous grid under the golden policy (and report no corridor hit).
  const out: LintViolation[] = [];
  const layout = systems(DEFAULT_JANKO_OPTIONS)[0];
  checkMiddleCCorridor(layout, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, out);
  assert.deepEqual(
    out.filter((v) => v.code === 'corridor-intrusion'),
    [],
    'the Round 12 vertical grid deliberately crosses Middle C'
  );
});

test('Defect: a rest driven into a foreign notehead is caught', () => {
  const out: LintViolation[] = [];
  const layout = systems(DEFAULT_JANKO_OPTIONS)[0];
  assert.ok(layout.rests.length > 0, 'the canonical score writes its silences');
  const rest = layout.rests.find((r) => r.tick === 552)!;
  const victim = layout.notes[0];
  const broken: JankoSystemLayout = {
    ...layout,
    rests: [{ ...rest, x: victim.x, y: victim.y }],
  };
  checkRestClearance(broken, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, out);
  const hits = out.filter((v) => v.code === 'rest-collision');
  assert.equal(hits.length, 1, 'the rest is reported once');
  assert.match(hits[0].message, /passes .* from notehead/);
  assert.ok((JANKO_LINT_CHECKS as readonly string[]).includes('rest-clearance'));

  // The engine's own rests pass the same audit untouched.
  const clean: LintViolation[] = [];
  checkRestClearance(layout, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, LINT, clean);
  assert.deepEqual(clean, []);
});

test('Defect: a beam driven into a printed rest is caught', () => {
  const out: LintViolation[] = [];
  const layout = systems(DEFAULT_JANKO_OPTIONS)[0];
  assert.ok(layout.beams.length > 0, 'the canonical score beams');
  // The Round 17B bridged beam: m. 4 beat 3 continues across the printed RH
  // 16th rest at tick 552.
  const beam = layout.beams.find((b) => b.notes.some((n) => n.startTick === 528 && n.hand === 'RH'))!;
  const rest = layout.rests.find((r) => r.tick === 552)!;
  assert.deepEqual(
    beam.notes.map((n) => n.startTick),
    [528, 540, 564],
    'the m. 4 run beams as one gesture across its rest'
  );
  // Drive the primary connector onto the rest ink: collapse it to a
  // horizontal segment through the rest centre.
  const broken: JankoSystemLayout = {
    ...layout,
    beams: layout.beams.map((b) =>
      b === beam ? { ...b, primary: { x1: rest.x - 5, y1: rest.y, x2: rest.x + 5, y2: rest.y } } : b
    ),
  };
  checkBeamRestClearance(broken, DEFAULT_JANKO_TOKENS, LINT, out);
  const hits = out.filter((v) => v.code === 'beam-rest-clearance');
  assert.equal(hits.length, 1, 'the beam is reported once');
  assert.match(hits[0].message, /never touch it/);
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('beam-rest-clearance'),
    'the beam-rest audit is part of the published check list'
  );

  // The engine's own beams pass the same audit untouched.
  const clean: LintViolation[] = [];
  checkBeamRestClearance(layout, DEFAULT_JANKO_TOKENS, LINT, clean);
  assert.deepEqual(clean, []);
});

// ---------------------------------------------------------------------------
// 3c. Round 14 — simultaneity integrity and named rest refusals
// ---------------------------------------------------------------------------

/** A minimal two-hand score fixture (3/4, 48 ticks per beat). */
function fixtureScore(notes: QuantizedGridScore['notes'], measures: number): QuantizedGridScore {
  return {
    id: 'linter-fixture',
    title: 'Linter fixture',
    composer: 'Harness',
    ticksPerBeat: 48,
    gridResolution: 12,
    totalTicks: measures * 144,
    timeSignatures: [{ tick: 0, numerator: 3, denominator: 4 }],
    barlines: Array.from({ length: measures + 1 }, (_, m) => ({
      barNumber: m + 1,
      tick: m * 144,
      type: (m === measures ? 'final' : 'regular') as 'final' | 'regular',
    })),
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
  };
}

test('Defect: an unclasped four-voice simultaneity paints its stems through its own chord tones', () => {
  // The Round 14 linter fixture from the ticket: the wide-span specimen under
  // the historical unclasped paradigm versus the restored per-hand clasp.
  const unclasped = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    core: 'adaptive',
    chordGrouping: 'none',
    measuresPerSystem: 2,
  });
  const clasped = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    core: 'adaptive',
    chordGrouping: 'per-hand-clasp',
    measuresPerSystem: 2,
  });
  const broken = layoutJankoScore(SPECIMEN, unclasped, TOKENS)[0];
  const hits = run((l, out) => checkStemThroughSimultaneity(l, unclasped, TOKENS, out), broken);
  // Five 4-voice columns; in each, the three lower stems run through the heads
  // above them (one, two and three heads respectively): 3 pairs per column.
  assert.equal(hits.length, 15, 'every stem painted through a chord tone is named');
  assert.ok(
    hits.every((v) => v.code === 'stem-through-simultaneity' && v.severity === 'error'),
    'a stem through a same-onset chord tone is a hard violation, never a warning'
  );
  assert.match(hits[0].message, /same-onset chord tone/);
  assert.match(hits[0].message, /per-hand clasp/);
  assert.ok((JANKO_LINT_CHECKS as readonly string[]).includes('stem-simultaneity'));

  const report = lintJankoScore(SPECIMEN, unclasped, TOKENS);
  assert.equal(report.ok, false, 'the unclasped specimen is rejected');
  assert.deepEqual(
    [...new Set(report.violations.map((v) => v.code))],
    ['stem-through-simultaneity'],
    'and it is rejected for exactly this defect'
  );

  // The same chord with the restored per-hand clasp is clean: every stem but
  // the Round 16 shared carrier is replaced by the bracket, and the carrier
  // leaves outward, so nothing is painted through a head.
  const fixed = layoutJankoScore(SPECIMEN, clasped, TOKENS)[0];
  assert.deepEqual(
    run((l, out) => checkStemThroughSimultaneity(l, clasped, TOKENS, out), fixed),
    [],
    'the clasped simultaneity is clean'
  );
  const fixedReport = lintJankoScore(SPECIMEN, clasped, TOKENS);
  assert.equal(fixedReport.ok, true, 'the clasped specimen engraves clean');
  assert.equal(fixedReport.warnings.length, 0, 'with no warning');

  // A cross-hand simultaneity is not a chord: the settled opposing stem
  // directions must never be reported (Bach m. 14 / m. 16 and Brahms m. 4).
  const bach = systems()[4];
  assert.ok(
    bach.notes.some((p) => p.note.startTick === bach.notes[0].note.startTick),
    'the fixture really carries simultaneities'
  );
  assert.deepEqual(
    run((l, out) => checkStemThroughSimultaneity(l, DEFAULT_JANKO_OPTIONS, TOKENS, out), bach),
    [],
    'cross-hand voices are audited by the channel and parity rules, not by this one'
  );
});

/** Synthetic handled tuck: the retired Brahms m.24/m.44 shape (E3 quarter over G♯2 eighth, LH), whose literal instances the §4 hand correction removes by design (326/612 are RH now, stems up). The fixed-3 fold reproduces the tuck geometry exactly. */
function tuckScore(): QuantizedGridScore {
  const note = (
    id: string,
    pitchClass: number,
    octave: number,
    startTick: number,
    durationTicks: number
  ): QuantizedNote => ({ id, pitch: { pitchClass, octave }, startTick, durationTicks, hand: 'LH' });
  return {
    id: 'synthetic-handled-tuck',
    title: 'Synthetic handled tuck',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 192,
    timeSignatures: [{ tick: 0, numerator: 4, denominator: 4 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes: [note('tuck-upper', 4, 3, 48, 48), note('tuck-lower', 8, 2, 48, 24)],
  };
}

test('Handled tuck: a stem end at the grown erasure is true-ink clean, not a chop', () => {
  // The upper quarter's down-stem ends 4.00pt above the lower head's centre —
  // inside the virtual 4.8 disc but tucked under the Round 23 tall white
  // exactly at the own-stem breathing line, digit ink clear. Designed paint,
  // zero violation.
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3' });
  const sys = layoutJankoScore(tuckScore(), o, TOKENS)[0];
  assert.deepEqual(
    run((l, out) => checkStemThroughSimultaneity(l, o, TOKENS, out), sys),
    [],
    'the handled tuck is silent'
  );
  const stemNote = sys.ungrouped.find((n) => n.id === 'tuck-upper')!;
  const head = sys.notes.find((p) => p.note.id === 'tuck-lower')!;
  const s = getStemGeometry(stemNote, TOKENS);
  assert.ok(Math.abs(s.stemX - head.x) < 1e-9, 'stem on the head column');
  assert.ok(Math.abs(head.y - s.stemEndY - 4.0) < 1e-9, 'end 4.00 above centre');
  assert.equal(head.tallKnockout, true, 'the tall erasure is painted');
});

test('Handled tuck: an unpainted or too-deep tuck still violates', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3' });
  const sys = layoutJankoScore(tuckScore(), o, TOKENS)[0];
  // The layout forgot the tall erasure: the end inside the disc violates.
  const untallied = {
    ...sys,
    notes: sys.notes.map((p) => (p.note.id === 'tuck-lower' ? { ...p, tallKnockout: false } : p)),
  };
  const forgotten = run((l, out) => checkStemThroughSimultaneity(l, o, TOKENS, out), untallied);
  assert.equal(forgotten.length, 1, 'an ungrown tuck is named');
  assert.equal(forgotten[0].code, 'stem-through-simultaneity');
  assert.ok(forgotten[0].noteIds!.includes('tuck-upper'));
  assert.ok(forgotten[0].noteIds!.includes('tuck-lower'));
  // The end pushed 1.0pt deeper reaches the digit's air: violates.
  const deep = {
    ...sys,
    ungrouped: sys.ungrouped.map((n) => (n.id === 'tuck-upper' ? { ...n, y: n.y + 1.0 } : n)),
  };
  const reached = run((l, out) => checkStemThroughSimultaneity(l, o, TOKENS, out), deep);
  assert.equal(reached.length, 1, 'an end inside the digit air is named');
  assert.equal(reached[0].code, 'stem-through-simultaneity');
});

test('Round 14: an unwritable rest is a named diagnostic, never a silent drop', () => {
  // A disc wide enough to wall the m. 4 beat cell shut: no slot along the row
  // keeps the guaranteed seating air from the LH D3 head that shares the column.
  const fat = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 60.0 };
  const layout = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, fat)[0];
  assert.ok(!layout.rests.some((r) => r.tick === 552), 'the refused rest is not painted');
  const refusal = layout.unwrittenRests.find((r) => r.tick === 552);
  assert.ok(refusal, 'the refusal is recorded instead of being dropped silently');
  assert.equal(refusal!.reason, 'no-slot');
  assert.equal(refusal!.hand, 'RH');
  assert.equal(refusal!.value, 'sixteenth');
  // −4 staffLeft + 3·2 measure slots + ⅚·2 grid growth under golden margins.
  assert.ok(
    Math.abs(refusal!.x - 548.63) < 0.01,
    `the refusal keeps the canonical tick-552 beat column (x = ${refusal!.x.toFixed(2)}pt)`
  );
  assert.ok(Number.isFinite(refusal!.targetY), 'and records the phrase-row hang centre it could not honour');

  const out: LintViolation[] = [];
  checkUnwrittenRests(layout, DEFAULT_JANKO_TOKENS, out);
  const named = out.filter((v) => v.code === 'rest-unwritable');
  assert.equal(named.length, layout.unwrittenRests.length, 'every refusal is republished');
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('rest-unwritable'),
    'the refusal audit is part of the published check list'
  );
  assert.ok(named.every((v) => v.severity === 'warning'), 'an omitted sign is a named risk, not painted ink');
  assert.ok(
    named.some((v) => v.measure === 4 && /never dropped silently/.test(v.message)),
    'the m. 4 refusal is named with its measure'
  );

  // The canonical tokens refuse nothing.
  for (const system of systems()) {
    assert.deepEqual(system.unwrittenRests, [], `system ${system.index + 1} refuses no silence`);
  }

  // A silence that opens exactly on a protected barline is nudged along its
  // row instead of straddling the grid; only a walled cell is refused by name.
  const crossing = fixtureScore(
    [
      { id: 'rh-1', pitch: { pitchClass: 0, octave: 5 }, startTick: 0, durationTicks: 144, hand: 'RH', velocity: 80 },
      { id: 'rh-2', pitch: { pitchClass: 4, octave: 5 }, startTick: 192, durationTicks: 12, hand: 'RH', velocity: 80 },
      { id: 'rh-3', pitch: { pitchClass: 7, octave: 4 }, startTick: 288, durationTicks: 144, hand: 'RH', velocity: 80 },
      { id: 'lh-1', pitch: { pitchClass: 2, octave: 3 }, startTick: 0, durationTicks: 144, hand: 'LH', velocity: 80 },
      { id: 'lh-2', pitch: { pitchClass: 9, octave: 2 }, startTick: 192, durationTicks: 12, hand: 'LH', velocity: 80 },
      { id: 'lh-3', pitch: { pitchClass: 5, octave: 3 }, startTick: 288, durationTicks: 144, hand: 'LH', velocity: 80 },
    ],
    3
  );
  // A tight measure inset puts the downbeat column within the rest's own air of
  // the opening barline: the nudge carries the rest off the grid instead of
  // straddling it, and the written rest clears the barline audit.
  const tightTokens = { ...TOKENS, measureInset: 4.0 };
  const protectedLayout = layoutJankoScore(crossing, DEFAULT_JANKO_OPTIONS, tightTokens)[0];
  const nudged = protectedLayout.rests.find((r) => r.tick === 144);
  assert.ok(nudged, 'the barline-opening silence is written, not swallowed');
  assert.deepEqual(
    protectedLayout.unwrittenRests.filter((r) => r.tick === 144),
    [],
    'and nothing is refused when a clear slot exists'
  );
  const barOut: LintViolation[] = [];
  checkBarlineClearance(protectedLayout, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), tightTokens, LINT, barOut);
  assert.deepEqual(
    barOut.filter((v) => /[Rr]est/.test(v.message)),
    [],
    'the nudged rest clears the protected barline (the tight inset still crowds a head elsewhere)'
  );
  const transparentLayout = layoutJankoScore(
    crossing,
    { ...DEFAULT_JANKO_OPTIONS, gridWritingPolicy: 'unified-transparent-grid' },
    tightTokens
  )[0];
  assert.ok(
    transparentLayout.rests.some((r) => r.tick === 144),
    'the transparent policy reserves no barline, so there the rest is written too'
  );
  assert.deepEqual(
    transparentLayout.unwrittenRests,
    [],
    'and nothing is refused under the transparent policy'
  );

  // A walled downbeat cell is refused **by name**: the silence opens on the
  // grid and the nudge cannot escape it.
  const walled = layoutJankoScore(crossing, DEFAULT_JANKO_OPTIONS, { ...tightTokens, noteheadRadius: 60.0 })[0];
  const barlineRefusal = walled.unwrittenRests.find((r) => r.tick === 144);
  assert.ok(barlineRefusal, 'the walled barline-opening silence is refused, not swallowed');
  assert.equal(barlineRefusal!.reason, 'protected-barline');
  assert.ok(
    !walled.rests.some((r) => r.tick === 144),
    'and no rest is painted into the walled cell'
  );
});

test('Corridor audit reads the true rule positions of the bounded channel', () => {
  // The channel displaces its boundary rules to `equator ± 6.5pt`, so a tight
  // corridor is cut by the inner rule even though the equator itself stays
  // clear. The audit must follow the painted rules, not the empty equator.
  const tight = { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' as const, interStaffGap: 12.0 };
  const channel = { ...tight, channelLayout: 'bounded-channel' as const };
  const ruleIntrusions = (options: typeof tight): LintViolation[] =>
    run((layout, out) => checkMiddleCCorridor(layout, options, DEFAULT_JANKO_TOKENS, LINT, out), systems(options)[0]).filter(
      (v) => v.code === 'corridor-intrusion' && /equator rule/.test(v.message)
    );
  assert.equal(ruleIntrusions(tight).length, 0, 'the single equator stays clear of the corridor');
  const channelHits = ruleIntrusions(channel);
  assert.ok(channelHits.length > 0, 'the displaced boundary rule is audited where it is painted');
  assert.ok(
    channelHits.some(
      (v) =>
        Math.abs(Number(v.metrics?.ruleY ?? NaN) - Number(v.metrics?.spineY ?? NaN)) <=
        LINT.corridorClearance
    ),
    'the reported rule y is the one that actually reaches the spine'
  );
});

// ---------------------------------------------------------------------------
// 3b. Round 5 — clasp clearance
// ---------------------------------------------------------------------------

/** A canonical Bach system engraved with one of the clasp paradigms. */
function claspSystem(
  mode: JankoChordGrouping,
  systemIndex: number = 0
): { layout: JankoSystemLayout; options: ReturnType<typeof resolveJankoOptions> } {
  const options = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, chordGrouping: mode });
  return { layout: systems(options)[systemIndex], options };
}

test("Clasp audit: the engine's own brackets pass every clearance rule", () => {
  for (const mode of ['left-clasp-spire', 'beamed-clasp-rail', 'bounding-phrase'] as const) {
    const { layout, options } = claspSystem(mode);
    const out = run((l, o) => checkClaspClearance(l, options, TOKENS, LINT, o), layout);
    assert.deepEqual(
      out.map((v) => `${v.code}: ${v.message}`),
      [],
      `${mode} brackets are admitted only where they stand clear`
    );
    assert.ok(layout.clasps.length > 0, `${mode} paints brackets`);
  }
  // The Brahms rail paradigm is audited the same way.
  const brahmsOptions = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    chordGrouping: 'beamed-clasp-rail',
  });
  const brahms = layoutJankoScore(
    buildBrahmsOp118No1Score(),
    brahmsOptions,
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  const rails = brahms.flatMap((l) => l.claspRails);
  assert.ok(rails.length > 0, 'the Brahms chord sequences produce rails');
  // Round 46: the Round 45 rail-paradigm findings at m. 27 and m. 47 are gone.
  // The Round 46 chord-column repair reads foreign units at their **solved**
  // columns in the bracket fit, so the pre-step and the fit no longer disagree
  // about where a neighbour's head stands (reverting that one repair restores
  // the two 2.75pt barline findings); the two trailing downbeat clusters now
  // stand clear of their opening barlines under this retired union paradigm.
  // Published by exact identity here: the retired rail paradigm now carries
  // **no** clasp-clearance finding, and neither does the canonical per-hand
  // paradigm (asserted below).
  const findings: Array<[string, number]> = [];
  for (const layout of brahms) {
    const out = run(
      (l, o) => checkClaspClearance(l, brahmsOptions, BRAHMS_TOKENS, LINT, o),
      layout
    );
    for (const violation of out) findings.push([violation.code, violation.measure ?? -1]);
  }
  assert.deepEqual(
    findings,
    [],
    'the retired rail paradigm now publishes no barline-air finding (Round 46 columns)'
  );
  const canonicalOptions = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
  for (const layout of layoutJankoScore(
    buildBrahmsOp118No1Score(),
    canonicalOptions,
    BRAHMS_TOKENS
  )) {
    assert.deepEqual(
      run((l, o) => checkClaspClearance(l, canonicalOptions, BRAHMS_TOKENS, LINT, o), layout),
      [],
      'the canonical per-hand paradigm keeps every bracket clear'
    );
  }
});

test('Defect: a clasp driven into its opening barline is caught', () => {
  const { layout, options } = claspSystem('left-clasp-spire');
  const target = layout.clasps.find(
    (c) => c.tick >= options.ticksPerMeasure && c.tick < 2 * options.ticksPerMeasure
  );
  assert.ok(target, 'm. 2 opens on a clasped dyad');
  const barline = systemBarlines(layout, options, TOKENS).reduce(
    (best, b) => (b.x <= target!.claspX + 1e-6 && b.x > best ? b.x : best),
    Number.NEGATIVE_INFINITY
  );
  const broken: JankoSystemLayout = {
    ...layout,
    clasps: layout.clasps.map((c) =>
      c.tick === target!.tick ? { ...c, claspX: barline + 1.0 } : c
    ),
  };
  const out = run((l, o) => checkClaspClearance(l, options, TOKENS, LINT, o), broken);
  const hits = out.filter((v) => v.code === 'clasp-barline-collision');
  assert.equal(hits.length, 1, 'the bracket touches the barline');
  assert.match(hits[0].message, /clears the barline/);
  assert.ok((hits[0].metrics?.gap ?? 99) < TOKENS.claspMinBarlineAir);
});

test('Defect: a clasp cutting through a foreign notehead is caught', () => {
  const { layout, options } = claspSystem('left-clasp-spire');
  const target = layout.clasps[0];
  const own = new Set(target.notes.map((n) => n.id));
  const foreign = layout.notes.find(
    (p) => !own.has(p.note.id) && p.y > target.topY && p.y < target.botY
  );
  assert.ok(foreign, 'a foreign head shares the bracket band');
  const broken: JankoSystemLayout = {
    ...layout,
    clasps: layout.clasps.map((c) =>
      c.tick === target.tick ? { ...c, claspX: foreign!.x - 1.0 } : c
    ),
  };
  const out = run((l, o) => checkClaspClearance(l, options, TOKENS, LINT, o), broken);
  const hits = out.filter(
    (v) => v.code === 'clasp-collision' && v.noteIds?.includes(foreign!.note.id)
  );
  assert.equal(hits.length, 1, 'the bracket slices the foreign disc');
  assert.ok((hits[0].metrics?.gap ?? 99) < LINT.minClearance);
});

test('Defect: a clasp pushed into the system-start column is caught', () => {
  // Round 10 audits the ruled system start — Round 14's canonical golden
  // default — so a clasp driven into the reserved margin column is caught.
  const options = resolveJankoOptions({
    ...DEFAULT_JANKO_OPTIONS,
    chordGrouping: 'left-clasp-spire',
  });
  const layout = systems(options)[0];
  const target = layout.clasps[0];
  // The ruled column spans `staffLeft − accoladeGap − accoladeWidth … + spur`,
  // so a clasp driven to `staffLeft − accoladeGap − 2` lands inside it.
  const accoladeX1 = layout.geometry.staffLeft - TOKENS.accoladeGap;
  const broken: JankoSystemLayout = {
    ...layout,
    clasps: layout.clasps.map((c) => (c.tick === target.tick ? { ...c, claspX: accoladeX1 - 2 } : c)),
  };
  const out = run((l, o) => checkClaspClearance(l, options, TOKENS, LINT, o), broken);
  assert.ok(
    out.some((v) => v.code === 'clasp-collision' && /accolade|numeral/.test(v.message)),
    'left-margin furniture collision reported'
  );
});

// ---------------------------------------------------------------------------
// 3b-2. Round 48 — the detached-seat contract and the published rest facts
// ---------------------------------------------------------------------------

test('Round 48 defect: a detached symbol off its right seat, inside a tie, or inside a sibling is caught', () => {
  const options = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    exceptionCarrier: 'symbol',
    tieProfile: 'traced',
    tieOriginIndicator: 'omit-outgoing',
  });
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, options, tokens);
  const clean = layouts.filter((l) => l.detachedSymbols.length > 0);
  assert.ok(clean.length > 0, 'the card seats detached symbols');
  for (const layout of clean) {
    assert.deepEqual(
      run((l, o) => checkDurationInkOwnership(l, options, tokens, o), layout),
      [],
      'the engine\u2019s own seats satisfy the contract they are checked against'
    );
  }

  // 1. A symbol that took any lane but the right one.
  const first = clean[0];
  const symbol = first.detachedSymbols[0];
  const offSeat: JankoSystemLayout = {
    ...first,
    detachedSymbols: [{ ...symbol, seat: 'above' }],
  };
  const seatHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), offSeat).filter(
    (v) => v.code === 'symbol-seat-inconsistent'
  );
  assert.equal(seatHits.length, 1);
  assert.match(seatHits[0]!.message, /stands to the right/);

  // 2. A symbol moved into a tie arc's own ink (its own chain excepted).
  const tieLayout = clean.find((l) => (l.tieArcs ?? []).length > 0)!;
  const arc = (tieLayout.tieArcs ?? []).find(
    (a) => !tieLayout.detachedSymbols.some((s) => s.noteId === a.fromHeadId || s.noteId === a.toHeadId)
  );
  assert.ok(arc, 'a system carries a tie arc and a foreign detached symbol');
  const moved: JankoSystemLayout = {
    ...tieLayout,
    detachedSymbols: [
      {
        ...tieLayout.detachedSymbols[0],
        x: (arc!.x1 + arc!.x2) / 2,
        // Centre the moved mark **in** the arc's ink band (the filled contour's
        // own extent), not on its endpoint axis.
        y: arc!.y + arc!.side * (arc!.depth * 0.75),
      },
      ...tieLayout.detachedSymbols.slice(1),
    ],
  };
  const tieHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), moved).filter(
    (v) => v.code === 'symbol-tie-conflict'
  );
  assert.equal(tieHits.length, 1);
  assert.match(tieHits[0]!.message, /duration symbol and a tie may never share ink/);

  // 3. Two sibling symbols sharing ink.
  const pair = first.detachedSymbols[0];
  const twin: JankoSystemLayout = {
    ...first,
    detachedSymbols: [pair, { ...first.detachedSymbols[1], x: pair.x, y: pair.y }],
  };
  const twinHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), twin).filter(
    (v) => v.code === 'symbol-symbol-conflict'
  );
  // Each sharing symbol reports the pair once (two sides, one defect).
  assert.equal(twinHits.length, 2);
  assert.ok(twinHits.every((v) => /share ink/.test(v.message)));
});

test('Round 48 fact: the withheld and inferred rests are published as info, never as defects', () => {
  const report = lintJankoScore(BRAHMS, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.equal(report.ok, true, 'the surface is ok');
  assert.deepEqual(report.violations, [], 'no violation');
  assert.deepEqual(report.warnings, [], 'no warning');
  const info = report.diagnostics.filter((d) => d.severity === 'info');
  assert.ok(info.length > 0, 'the facts are listed');
  assert.ok(
    info.every((d) => d.code === 'rest-inference-withheld' || d.code === 'rest-inferred'),
    'and every listed fact is a published rest-provenance note'
  );
  // A score without silence provenance publishes nothing new.
  const bach = lintJankoScore(
    buildBachGoldbergVar1Score(),
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.deepEqual(bach.diagnostics, [], 'Bach GOLD: the record stays empty');
});

// ---------------------------------------------------------------------------
// 3c. Round 47 — duration-ink ownership (no orphaned long-value marks)
// ---------------------------------------------------------------------------

test('Round 47 defect: an orphaned, suppressed-only or unknown-owner duration mark is caught', () => {
  // The round's own candidate engraving: detached long-value symbols with a
  // published census and five published originator omissions.
  const options = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    exceptionCarrier: 'symbol',
    longDurationStyle: 'open-oval',
    tieOriginIndicator: 'omit-outgoing',
  });
  const tokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const layouts = layoutJankoScore(BRAHMS, options, tokens);
  const withCensus = layouts.find(
    (l) => l.durationInkOwners.length > 0 && l.tieOriginSuppressions.length > 0
  );
  assert.ok(withCensus, 'the card publishes a duration-ink census and omitted origins');
  const clean = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), withCensus);
  assert.deepEqual(clean, [], 'the engine\u2019s own marks own themselves');

  const owner = withCensus.durationInkOwners[0];
  // 1. A mark with no owner at all.
  const orphan: JankoSystemLayout = {
    ...withCensus,
    durationInkOwners: [...withCensus.durationInkOwners, { ...owner, ownerIds: [] }],
  };
  const orphanHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), orphan);
  assert.equal(orphanHits.length, 1);
  assert.equal(orphanHits[0].code, 'duration-mark-orphan');
  assert.match(orphanHits[0].message, /names no\s+owning note/);

  // 2. A mark whose every owner the outgoing-tie rule suppressed.
  const suppression = withCensus.tieOriginSuppressions[0];
  assert.ok(suppression, 'the card omits at least one originator mark');
  const redundant: JankoSystemLayout = {
    ...withCensus,
    durationInkOwners: [
      ...withCensus.durationInkOwners,
      { ...owner, ownerIds: [suppression.noteId] },
    ],
  };
  const redundantHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), redundant);
  assert.equal(redundantHits.length, 1);
  assert.equal(redundantHits[0].code, 'duration-mark-suppressed-owner');
  assert.match(redundantHits[0].message, /redundant second statement/);

  // 3. A mark naming a head that is not laid out in its own system.
  const stale: JankoSystemLayout = {
    ...withCensus,
    durationInkOwners: [...withCensus.durationInkOwners, { ...owner, ownerIds: ['not-a-head'] }],
  };
  const staleHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), stale);
  assert.equal(staleHits.length, 1);
  assert.equal(staleHits[0].code, 'duration-mark-unknown-owner');
  assert.match(staleHits[0].message, /not laid out in this system/);

  // 4. A detached symbol moved onto a drawn staff rule (the seat contract).
  const withSymbols = layouts.find((l) => l.detachedSymbols.length > 0)!;
  const rule = drawnStaffRuleYs(withSymbols.geometry, options, tokens)[0];
  const symbol = withSymbols.detachedSymbols[0];
  const seated: JankoSystemLayout = {
    ...withSymbols,
    detachedSymbols: [{ ...symbol, y: rule }],
  };
  const seatHits = run((l, o) => checkDurationInkOwnership(l, options, tokens, o), seated).filter(
    (v) => v.code === 'symbol-seat-rule-conflict'
  );
  assert.ok(seatHits.length >= 1, 'the rule crossing the mark is caught');
  assert.ok(
    seatHits.every((v) => (v.noteIds ?? []).includes(symbol.noteId)),
    'and it names the symbol that was moved'
  );
  // Round 48: a rule inside a hollow interior is legal **only** when the seat
  // records its local knockout; a moved symbol that keeps the old record (or
  // loses it) is caught with the ownership of the crossing named.
  assert.match(seatHits[0]!.message, /drawn staff rule/);
  assert.match(seatHits[0]!.message, /knockout|hollow interior|staff rule/);
});

test('Defect: a rail that crosses a barline is caught', () => {
  const brahmsOptions = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    chordGrouping: 'beamed-clasp-rail',
  });
  const layouts = layoutJankoScore(
    buildBrahmsOp118No1Score(),
    brahmsOptions,
    BRAHMS_OP118_NO1_JANKO_TOKENS
  );
  const layout = layouts.find((l) => l.claspRails.length > 0)!;
  const rail = layout.claspRails[0];
  const barline = systemBarlines(layout, brahmsOptions, BRAHMS_TOKENS).find(
    (b) => b.x > rail.x2
  )!;
  const broken: JankoSystemLayout = { ...layout, claspRails: [{ ...rail, x2: barline.x + 2.0 }] };
  const out = run(
    (l, o) => checkClaspClearance(l, brahmsOptions, BRAHMS_TOKENS, LINT, o),
    broken
  );
  const hits = out.filter((v) => v.code === 'clasp-rail-crossing');
  assert.ok(hits.length >= 1, 'the rail reaches the barline');
  // Both the RH and the LH barline segment are painted at that x.
  assert.ok(hits.every((v) => v.metrics?.barlineX === barline.x));
});

// ---------------------------------------------------------------------------
// 4. Document-level paint-order audit
// ---------------------------------------------------------------------------

test('Paint audit: a digit without its knockout is a violation', () => {
  const svg = `<svg>${digit(50, 100)}</svg>`;
  const out = auditKnockoutProtection(svg, MASK_AUDIT);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-missing');
});

test('Paint audit: a knockout without its digit is a violation', () => {
  const svg = `<svg>${knockout(50, 100)}</svg>`;
  const out = auditKnockoutProtection(svg, MASK_AUDIT);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-empty');
});

test('Paint audit: a rule painted after the knockout may not cut through it', () => {
  const clean =
    '<svg><line x1="40" y1="100" x2="60" y2="100" stroke="#111"/>' +
    knockout(50, 100) +
    digit(50, 100) +
    '</svg>';
  assert.deepEqual(auditKnockoutProtection(clean, MASK_AUDIT), []);

  const regressed =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-beat-line" x1="50" y1="90" x2="50" y2="110" stroke="#D1D5DB"/></svg>';
  const out = auditKnockoutProtection(regressed, MASK_AUDIT);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');
  assert.match(out[0].message, /beat-line element painted after the knockout/);
});

test('Paint audit: the Middle C spine cutting a glyph is named explicitly', () => {
  const svg =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line x1="30" y1="100" x2="70" y2="100" stroke="#E2E8F0"/></svg>';
  const out = auditKnockoutProtection(svg, { ...MASK_AUDIT, spineY: 100 });
  assert.equal(out.length, 1);
  assert.match(out[0].message, /Middle C spine cuts through the knockout/);
});

test('Paint audit: a flush stem is exempt, a stem starting inside the mask is not', () => {
  // The notehead's own stem, painted after its mask, must start flush on the
  // mask edge …
  const own =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    stem(50, 100 - REGULAR_ATTACH, 85) +
    '</svg>';
  assert.deepEqual(auditKnockoutProtection(own, MASK_AUDIT), []);

  // … a stem emerging *inside* the mask pierces it instead.
  const inside =
    '<svg>' + knockout(50, 100) + digit(50, 100) + stem(50, 98.5, 85) + '</svg>';
  const out = auditKnockoutProtection(inside, MASK_AUDIT);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');

  // A foreign stem crossing the mask is never exempt.
  const foreign =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-stem" x1="52" y1="120" x2="52" y2="80" stroke="#111"/></svg>';
  const out2 = auditKnockoutProtection(foreign, MASK_AUDIT);
  assert.equal(out2.length, 1);
  assert.equal(out2[0].code, 'knockout-pass-through');
});

test('Paint audit: the rectangular mask is audited box-exact', () => {
  // The rect owns its digit exactly.
  const owned = `<svg>${knockout(50, 100)}${digit(50, 100)}</svg>`;
  assert.deepEqual(auditKnockoutProtection(owned, MASK_AUDIT), []);
  // A rule through the mask's horizontal interior is a cut …
  const cut =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-beat-line" x1="52" y1="90" x2="52" y2="110" stroke="#D1D5DB"/></svg>';
  const out = auditKnockoutProtection(cut, MASK_AUDIT);
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');
  // … while a rule at dx = 3.0 — inside the legacy disc, outside wx 2.73 —
  // is clean: the audit is box-exact, not circular.
  const grazing =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-beat-line" x1="53" y1="90" x2="53" y2="110" stroke="#D1D5DB"/></svg>';
  assert.deepEqual(auditKnockoutProtection(grazing, MASK_AUDIT), []);
  // The notehead's own stem stays flush on the mask edge (hy + 0.2).
  const own =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    stem(50, 100 - REGULAR_ATTACH, 85) +
    '</svg>';
  assert.deepEqual(auditKnockoutProtection(own, MASK_AUDIT), []);
});

test('Paint audit: a stem piercing the Position of Honor halo is a violation', () => {
  const clean =
    '<svg>' +
    halo(50, 100) +
    knockout(50, 100) +
    digit(50, 100) +
    stem(50, 100 - HONOR_ATTACH, 85) +
    '</svg>';
  assert.deepEqual(
    auditKnockoutProtection(clean, MASK_AUDIT),
    [],
    'the tick-0 stem starts outside the ring'
  );

  const pierced =
    '<svg>' +
    halo(50, 100) +
    knockout(50, 100) +
    digit(50, 100) +
    stem(50, 98.5, 85) +
    '</svg>';
  const out = auditKnockoutProtection(pierced, MASK_AUDIT);
  assert.ok(
    out.some((v) => v.code === 'halo-piercing'),
    'a stem emerging inside the ring must be reported'
  );
  const piercing = out.find((v) => v.code === 'halo-piercing')!;
  assert.match(piercing.message, /cuts through the Position of Honor halo/);
  assert.ok(piercing.metrics!.distance < piercing.metrics!.required);
});

test('Every engraved system of the canonical score passes the paint-order audit', () => {
  const geo = computePageGeometry(DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  for (const layout of systems()) {
    const svg = renderSystem(
      SCORE,
      getSystemGeometry(geo, layout.index),
      layout.index,
      DEFAULT_JANKO_OPTIONS,
      DEFAULT_JANKO_TOKENS,
      layout
    );
    assert.deepEqual(
      auditKnockoutProtection(svg, {
        knockoutWx: MASK_WX,
        knockoutHy: MASK_HY,
        haloRadius: DEFAULT_JANKO_TOKENS.haloRadius,
        spineY: layout.geometry.middleCY,
      }),
      [],
      `system ${layout.index + 1} must be mask-clean`
    );
  }
});

test('Paint audit honours the digit baseline of a custom token set', () => {
  // A larger digit shifts its baseline: the audit must still pair every glyph
  // with its mask instead of reporting phantom mask defects.
  const tokens = { ...DEFAULT_JANKO_TOKENS, digitFontSize: 6.5, noteheadRadius: 5.2 };
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, tokens);
  assert.equal(
    report.violations.filter(
      (v) => v.code === 'knockout-missing' || v.code === 'knockout-empty'
    ).length,
    0,
    'no phantom mask defects for custom digit tokens'
  );
  const svg = renderSystem(
    SCORE,
    getSystemGeometry(computePageGeometry(DEFAULT_JANKO_OPTIONS, tokens), 0),
    0,
    DEFAULT_JANKO_OPTIONS,
    tokens
  );
  assert.deepEqual(
    auditKnockoutProtection(svg, {
      knockoutWx: MASK_WX,
      knockoutHy: MASK_HY,
      haloRadius: tokens.haloRadius,
      digitBaselineOffset: digitBaselineOffset(tokens.digitFontSize),
    }),
    []
  );
});

// ---------------------------------------------------------------------------
// 4b. Round 27 ottava spanner & core extension invariants
// ---------------------------------------------------------------------------

test('checkOttavaClearance catches brackets too close to noteheads', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const fakeNote: any = {
    note: { id: 'n1', startTick: 0, durationTicks: 48, pitch: { pitchClass: 0, octave: 4 } },
    x: 100,
    y: 100,
    rhythm: { id: 'n1', startTick: 0, durationTicks: 48, hand: 'LH', x: 100, y: 100 },
  };

  // down10 bracket (shift > 0, below note) with 2pt clearance (requires 6pt)
  const tightLayout: any = {
    index: 0,
    notes: [fakeNote],
    ottavaBrackets: [
      {
        kind: 'down10',
        shift: 12,
        numeral: 'down10',
        glyph: 'down10',
        x0: 80,
        x1: 120,
        dashStartX: 100,
        dashEndX: 120,
        lineY: 100 + t.noteheadRadius + 2.0, // 2pt clearance < 6pt
        hookLength: 4.0,
        hookDirection: -1,
        noteIds: ['n1'],
      },
    ],
  };

  const violations: LintViolation[] = [];
  checkOttavaClearance(tightLayout, o, t, violations);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].code, 'ottava-clearance');

  // Adequate clearance (8pt >= 6pt)
  const okLayout: any = {
    ...tightLayout,
    ottavaBrackets: [
      {
        ...tightLayout.ottavaBrackets[0],
        lineY: 100 + t.noteheadRadius + 8.0,
      },
    ],
  };
  const okViolations: LintViolation[] = [];
  checkOttavaClearance(okLayout, o, t, okViolations);
  assert.equal(okViolations.length, 0);
});

test('checkOttavaCoverage catches unbracketed folded notes and unfolded bracketed notes', () => {
  const fakeFoldedNote: any = {
    note: { id: 'folded-1', startTick: 0, durationTicks: 48, pitch: { pitchClass: 9, octave: 0 } },
    x: 100,
    y: 100,
    ottavaShift: 12,
  };
  const fakePlainNote: any = {
    note: { id: 'plain-1', startTick: 0, durationTicks: 48, pitch: { pitchClass: 0, octave: 4 } },
    x: 150,
    y: 100,
    ottavaShift: undefined,
  };

  // Note is folded, but no bracket exists
  const unbracketedLayout: any = {
    index: 0,
    notes: [fakeFoldedNote],
    ottavaBrackets: [],
  };
  const v1: LintViolation[] = [];
  checkOttavaCoverage(unbracketedLayout, v1);
  assert.equal(v1.length, 1);
  assert.equal(v1[0].code, 'ottava-unbracketed');

  // Bracket exists covering an unfolded note
  const unfoldedBracketLayout: any = {
    index: 0,
    notes: [fakePlainNote],
    ottavaBrackets: [
      {
        kind: 'down10',
        shift: 12,
        numeral: 'down10',
        glyph: 'down10',
        x0: 130,
        x1: 170,
        dashStartX: 150,
        dashEndX: 170,
        lineY: 120,
        hookLength: 4.0,
        hookDirection: -1,
        noteIds: ['plain-1'],
      },
    ],
  };
  const v2: LintViolation[] = [];
  checkOttavaCoverage(unfoldedBracketLayout, v2);
  assert.equal(v2.length, 1);
  assert.equal(v2[0].code, 'ottava-unfolded');

  // Bracket covers folded note: clean
  const cleanLayout: any = {
    index: 0,
    notes: [fakeFoldedNote],
    ottavaBrackets: [
      {
        kind: 'down10',
        shift: 12,
        numeral: 'down10',
        glyph: 'down10',
        x0: 80,
        x1: 120,
        dashStartX: 100,
        dashEndX: 120,
        lineY: 120,
        hookLength: 4.0,
        hookDirection: -1,
        noteIds: ['folded-1'],
      },
    ],
  };
  const v3: LintViolation[] = [];
  checkOttavaCoverage(cleanLayout, v3);
  assert.equal(v3.length, 0);
});

test('checkOttavaExtensions catches lines and written notes exceeding core±1 range', () => {
  const o = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, core: 'fixed-3' });

  // Extension line lin=12 is outside core±1 range [24, 72] for fixed-3
  const badExtLayout: any = {
    index: 0,
    geometry: {
      extensionLines: [12],
    },
    notes: [
      {
        note: { id: 'n1', startTick: 0, durationTicks: 48, pitch: { pitchClass: 0, octave: 4 } },
        x: 100,
        y: 100,
        writtenLin: 48,
      },
    ],
  };
  const v1: LintViolation[] = [];
  checkOttavaExtensions(badExtLayout, o, v1);
  assert.equal(v1.length, 1);
  assert.equal(v1[0].code, 'extension-beyond-core');

  // Written note lin=82 is outside written range [18, 78] for fixed-3
  const badNoteLayout: any = {
    index: 0,
    geometry: {
      extensionLines: [24],
    },
    notes: [
      {
        note: { id: 'n2', startTick: 0, durationTicks: 48, pitch: { pitchClass: 10, octave: 6 } },
        x: 100,
        y: 100,
        writtenLin: 82,
      },
    ],
  };
  const v2: LintViolation[] = [];
  checkOttavaExtensions(badNoteLayout, o, v2);
  assert.equal(v2.length, 1);
  assert.equal(v2[0].code, 'extension-beyond-core');

  // Clean fixed-3 layout within bounds
  const cleanLayout: any = {
    index: 0,
    geometry: {
      extensionLines: [24],
    },
    notes: [
      {
        note: { id: 'n3', startTick: 0, durationTicks: 48, pitch: { pitchClass: 0, octave: 4 } },
        x: 100,
        y: 100,
        writtenLin: 48,
      },
    ],
  };
  const v3: LintViolation[] = [];
  checkOttavaExtensions(cleanLayout, o, v3);
  assert.equal(v3.length, 0);
});

test('checkStaffSegments flags missing anchors, gaps, and degenerate segments', () => {
  const o = resolveJankoOptions({ core: 'fixed-3' });
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  // 1. Missing anchor: measure 0 has no row 1 (lin 48)
  const missingAnchorLayout: any = {
    index: 0,
    geometry: {
      measuresPerSystem: 2,
      staffSegments: [
        { lin: 60, rowId: 2, mStart: 0, mEnd: 1, x1: 50, x2: 250 },
      ],
    },
    notes: [],
  };
  const vAnchor: LintViolation[] = [];
  checkStaffSegments(missingAnchorLayout, o, t, vAnchor);
  assert.ok(vAnchor.some((v) => v.code === 'staff-anchor-missing'));

  // 2. Gaps: row 4 (72) present without row 2 (60)
  const gappyLayout: any = {
    index: 0,
    geometry: {
      measuresPerSystem: 2,
      staffSegments: [
        { lin: 48, rowId: 1, mStart: 0, mEnd: 1, x1: 50, x2: 250 },
        { lin: 72, rowId: 4, mStart: 0, mEnd: 0, x1: 50, x2: 150 }, // missing row 2
      ],
    },
    notes: [],
  };
  const vGap: LintViolation[] = [];
  checkStaffSegments(gappyLayout, o, t, vGap);
  assert.ok(vGap.some((v) => v.code === 'staff-segment-gap'));

  // 3. Degenerate: x2 <= x1
  const degenerateLayout: any = {
    index: 0,
    geometry: {
      measuresPerSystem: 2,
      staffSegments: [
        { lin: 48, rowId: 1, mStart: 0, mEnd: 1, x1: 250, x2: 50 }, // reversed x
      ],
    },
    notes: [],
  };
  const vDegen: LintViolation[] = [];
  checkStaffSegments(degenerateLayout, o, t, vDegen);
  assert.ok(vDegen.some((v) => v.code === 'staff-segment-degenerate'));

  // 4. Degenerate: overlapping segments for same line
  const overlapLayout: any = {
    index: 0,
    geometry: {
      measuresPerSystem: 2,
      staffSegments: [
        { lin: 48, rowId: 1, mStart: 0, mEnd: 1, x1: 50, x2: 250 },
        { lin: 48, rowId: 1, mStart: 1, mEnd: 1, x1: 150, x2: 250 },
      ],
    },
    notes: [],
  };
  const vOverlap: LintViolation[] = [];
  checkStaffSegments(overlapLayout, o, t, vOverlap);
  assert.ok(vOverlap.some((v) => v.code === 'staff-segment-degenerate'));
});

test('junction-aware barline and segment audits: conjoin spans outer rows while wide-gap and default keep short heights', () => {
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layout = layoutJankoScore(SCORE, resolveJankoOptions(DEFAULT_JANKO_OPTIONS), t)[7];

  // Conjoin
  const oConjoin = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, extensionJunction: 'conjoin' });
  const conjoinBarlines = systemBarlines(layout, oConjoin, t);
  const geo = layout.geometry;
  const outerTopY = geo.middleCY + continuousPitchY(72, t.semitoneScale);
  const outerBotY = geo.middleCY + continuousPitchY(24, t.semitoneScale);
  assert.equal(conjoinBarlines[0].top.toFixed(2), outerTopY.toFixed(2));
  assert.equal(conjoinBarlines[0].bottom.toFixed(2), outerBotY.toFixed(2));

  // Wide gap
  const oWide = resolveJankoOptions({ ...DEFAULT_JANKO_OPTIONS, extensionJunction: 'wide-gap' });
  const wideBarlines = systemBarlines(layout, oWide, t);
  assert.notEqual(wideBarlines[0].top.toFixed(2), outerTopY.toFixed(2));

  // Segments check clean under both
  const vConjoin: LintViolation[] = [];
  checkStaffSegments(layout, oConjoin, t, vConjoin);
  assert.equal(vConjoin.length, 0);

  const vWide: LintViolation[] = [];
  checkStaffSegments(layout, oWide, t, vWide);
  assert.equal(vWide.length, 0);
});

test('semitone rest-centroid audit: hanging rest on integer semitone is clean; off-semitone drift is caught', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layout = layoutJankoScore(SCORE, o, t)[0];

  // Golden Bach m.4 rest is on semitone lin 46 (y = 179.48625)
  const vClean: LintViolation[] = [];
  checkRestSeat(layout, o, t, vClean);
  assert.equal(vClean.length, 0, 'golden semitone seats lint 100% clean');

  // Artificial drift of 1.4pt off semitone
  const driftedLayout: JankoSystemLayout = {
    ...layout,
    rests: layout.rests.map((r, i) => (i === 0 ? { ...r, y: r.y + 1.4 } : r)),
  };
  const vDrift: LintViolation[] = [];
  checkRestSeat(driftedLayout, o, t, vDrift);
  assert.equal(vDrift.length, 1);
  assert.equal(vDrift[0].code, 'rest-centroid-off-row');
});

test('checkDotCollision: the golden dot standard clears every flag (no option)', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  // System 0 of Bach has m.1 tick 24 dotted 8th note
  const sys = layoutJankoScore(SCORE, o, t)[0];

  // The engine-resolved golden layout is collision-free
  const vClean: LintViolation[] = [];
  checkDotCollision(sys, o, t, vClean);
  assert.equal(vClean.length, 0, 'golden dot standard with engine resolution reports 0 dot-collisions');

  // If a note has its dot forced into its own flag ink box, the audit catches it:
  const victim = sys.notes.find((q) => q.note.id === 'bach-var1-5')!;
  const stem = getStemGeometry(victim.rhythm, t);
  const collidingNotes = sys.notes.map((n) => {
    if (n.note.id === 'bach-var1-5') {
      return {
        ...n,
        rhythm: {
          ...n.rhythm,
          dotX: stem.stemX + 1.0,
          dotY: stem.stemEndY - 2.0,
        },
      };
    }
    return n;
  });
  const collidingLayout: JankoSystemLayout = {
    ...sys,
    notes: collidingNotes,
  };
  const vColliding: LintViolation[] = [];
  checkDotCollision(collidingLayout, o, t, vColliding);
  const flagViolations = vColliding.filter(
    (v) => v.code === 'dot-collision' && v.message.includes('flag ink box')
  );
  assert.equal(flagViolations.length, 1, 'flag clearance audit catches a colliding dot');
  assert.equal(flagViolations[0].noteIds?.[0], 'bach-var1-5');
});

test('golden pitch grid weight audit: extension rows 0.35pt, core rows 0.50pt', () => {
  const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

  const sys = layoutJankoScore(SCORE, o, t)[7];

  // Extension row lin 72 (C6) in m. 29, core row lin 48 (C4)
  const rules = pitchGridRules(sys.geometry, o, t);
  const ext = rules.find((r) => r.y === sys.geometry.middleCY + continuousPitchY(72, t.semitoneScale));
  const core = rules.find((r) => r.y === sys.geometry.middleCY + continuousPitchY(48, t.semitoneScale));

  assert.ok(ext, 'extension rule found');
  assert.ok(core, 'core rule found');
  assert.equal(ext.width, 0.35, 'golden extension weight is 0.35pt');
  assert.equal(core.width, 0.50, 'golden core weight is 0.50pt');
});

// ---------------------------------------------------------------------------
// 5. CLI contract
// ---------------------------------------------------------------------------

test('npm run forwards --strict to the engraving CLI — the `--` separator is required', () => {
  // The round's canonical gate is `npm run lint:engraving -- --strict`: npm
  // parses a flag that directly follows the script name as its own config
  // (`npm run lint:engraving --strict` warns `Unknown cli config "--strict"`
  // and drops it), so only the separator form reaches the linter. npm echoes
  // the executed script line, which is the observable proof of forwarding
  // (npm is present by construction — the canonical suite runs under `npm
  // test`). The flag's own effect on the exit code is covered by the direct
  // strict spawn above; here the forwarding itself is what is asserted.
  const run = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'lint:engraving', '--', '--quiet', '--strict'],
    { cwd: REPO_ROOT, encoding: 'utf-8' }
  );
  assert.equal(run.status, 0, 'the canonical strict gate exits 0');
  assert.match(
    run.stdout,
    /clean violations=0 warnings=0/,
    'and reports zero violations and zero warnings'
  );
  assert.match(
    run.stdout,
    /tsx scripts\/lint_engraving\.ts --quiet --strict/,
    'npm handed --strict to the script, not to its own config parser'
  );
});

test('npm run lint:engraving reports canonical clean and exits 0', () => {
  // Canonical fixed-3 everywhere: the gate exits 0 with zero violations and —
  // as of Round 46 — zero warnings. Bach GOLD and the three curator specimens
  // carry no warning at all, and the working Brahms Reference's six former
  // 120-tick composites are now stated exactly by their written components
  // (first 96 + tied 24), so its warning list must be empty; the former
  // refusals are checked below to be gone by identity, never by a broad count.
  const run = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/lint_engraving.ts', '--quiet'],
    { cwd: REPO_ROOT, encoding: 'utf-8' }
  );
  assert.equal(run.status, 0, 'the gate exits 0 on the canonical clean record');
  assert.match(
    run.stdout,
    /clean violations=0 warnings=0/,
    'zero violations and zero warnings — the six composites are solved, not suppressed'
  );
  const json = spawnSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/lint_engraving.ts', '--json'],
    { cwd: REPO_ROOT, encoding: 'utf-8' }
  );
  const reports = JSON.parse(json.stdout) as Record<
    string,
    { violations: Array<{ code: string; system: number }>; warnings: unknown[] }
  >;
  assert.deepEqual(reports.bach.violations, [], 'Bach GOLD: zero violations');
  assert.deepEqual(reports.bach.warnings, [], 'Bach GOLD: zero warnings');
  assert.deepEqual(reports.brahms.violations, [], 'Brahms canonical: zero violations');
  assert.deepEqual(reports.brahms.warnings, [], 'Brahms canonical: zero warnings');
  const brahmsWarningText = JSON.stringify(reports.brahms.warnings);
  for (const id of [295, 351, 448, 581, 637, 734]) {
    assert.ok(
      !brahmsWarningText.includes(`brahms-op118-no1-${id}`),
      `Brahms canonical: the former ${id} refusal never reappears`
    );
  }
  for (const key of ['chordSpecimen', 'restSpecimen', 'durationSpecimen']) {
    assert.deepEqual(reports[key].violations, [], `${key}: zero violations`);
    assert.deepEqual(reports[key].warnings, [], `${key}: zero warnings`);
  }
});

// ---------------------------------------------------------------------------
// 6. Round 30: the duration-grammar audits catch their intentional defects
// ---------------------------------------------------------------------------

const BRAHMS_SCORE = buildBrahmsOp118No1Score();
const BRAHMS_PREVIEW = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  core: 'adaptive',
  durationGrammar: 'complete',
});
const BRAHMS_PREVIEW_TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

test('dot-collision names a fused single second dot (sibling air)', () => {
  const layouts = layoutJankoScore(BRAHMS_SCORE, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS);
  // Source correction eliminated all 21s (ID 336 now a standard 24 eighth);
  // the double-dotted audit now uses a legitimate 168 (ID 15, hidden-8th +
  // dotted-half tie, lines 268+269) which resolves two dots under preview.
  const sys = layouts.find((s) => s.notes.some((p) => p.note.id === 'brahms-op118-no1-15'))!;
  const victim = sys.notes.find((p) => p.note.id === 'brahms-op118-no1-15')!;
  assert.ok(victim.rhythm.dot2X !== undefined, 'the 168 resolves a second dot');
  // Fuse the pair: park the second dot exactly on the first.
  victim.rhythm.dot2X = victim.rhythm.dotX;
  victim.rhythm.dot2Y = victim.rhythm.dotY;
  const out: LintViolation[] = [];
  checkDotCollision(sys, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS, out);
  assert.ok(
    out.some((v) => v.code === 'dot-collision' && v.message.includes('two augmentation dots')),
    'the fused pair is named'
  );
});

test('clasp-dot-fusion names a fused bracket second dot (mark + sibling airs)', () => {
  const layouts = layoutJankoScore(BRAHMS_SCORE, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS);
  // No double-dotted brackets remain in source-correct Brahms (all 42/84/336
  // corrected to standard values); synthesize the second dot on the real
  // single-dot tick-432 bracket (144 dotted half; the tick-48 twin stands
  // bare at canonical packing under adaptive) to prove the fusion audit
  // still catches a collapsed pair. Engine rules unchanged.
  const sys = layouts.find((s) => s.clasps.some((c) => c.tick === 432))!;
  const clasp = sys.clasps.find((c) => c.tick === 432)!;
  assert.ok(clasp.durationDots[0], 'the 144-bracket resolves its first dot');
  assert.ok(!clasp.durationSecondDots[0], 'and no second dot (single-dot source value)');
  // Synthesize a double-dotted bracket: claim two dots, resolve the second,
  // then fuse the pair onto the first (sibling air collapses to zero).
  clasp.durationInk[0].dots = 2;
  clasp.durationSecondDots[0] = { ...clasp.durationDots[0]! };
  const out: LintViolation[] = [];
  checkClaspDotFusion(sys, BRAHMS_PREVIEW_TOKENS, DEFAULT_JANKO_LINT_OPTIONS, out, BRAHMS_PREVIEW);
  const codes = out.filter((v) => v.code === 'clasp-dot-fusion').map((v) => v.message);
  assert.ok(codes.some((m) => m.includes('two augmentation dots')), 'the sibling fusion is named');
});

test('dot-count-agreement names a bracket resolved without the active grammar', () => {
  const layouts = layoutJankoScore(BRAHMS_SCORE, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS);
  const sys = layouts.find((s) => s.clasps.some((c) => c.tick === 432))!;
  const clasp = sys.clasps.find((c) => c.tick === 432)!;
  // Simulate a forgotten call site: golden ink (undotted) under preview.
  // Tick 432 carries a source-correct 144 dotted half (the tick-48 twin
  // stands bare at canonical packing under adaptive).
  clasp.durationInk[0].dots = 0;
  clasp.durationInk[0].dotted = false;
  clasp.durationDots[0] = null;
  clasp.durationSecondDots[0] = null;
  const out: LintViolation[] = [];
  checkClaspDotFusion(sys, BRAHMS_PREVIEW_TOKENS, DEFAULT_JANKO_LINT_OPTIONS, out, BRAHMS_PREVIEW);
  assert.ok(
    out.some(
      (v) =>
        v.code === 'dot-count-agreement' &&
        v.message.includes('carries 144 ticks') &&
        v.message.includes('paints 0')
    ),
    'the undotted 144-bracket is named'
  );
});

test('dot-count-agreement names a beamed member the bracket would double-dot', () => {
  const layouts = layoutJankoScore(BRAHMS_SCORE, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS);
  const sys = layouts.find((s) => s.beams.some((b) => b.notes.some((n) => n.id === 'brahms-op118-no1-331')))!;
  const beam = sys.beams.find((b) => b.notes.some((n) => n.id === 'brahms-op118-no1-331'))!;
  const member = beam.notes.find((n) => n.id === 'brahms-op118-no1-331')!;
  // Simulate the future hazard: a dotted beamed member joins a bracket, so
  // the bracket owns its duration but the beam still paints grammar dots.
  // Source correction left no dotted beamed members (all beamed 24s); the
  // hazard is synthesized with a 21 double-dotted member to prove the check.
  assert.ok(sys.clasps.length > 0, 'the system carries real brackets');
  (member as { durationTicks: number }).durationTicks = 21;
  sys.clasps.push({ ...sys.clasps[0], tick: member.startTick, durationTicks: 21, notes: [member] });
  const out: LintViolation[] = [];
  checkDotCountAgreement(sys, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS, out);
  assert.ok(
    out.some((v) => v.code === 'dot-count-agreement'),
    'the double-ink hazard is named'
  );
});

test('ring-geometry names a stem ring a later knockout would cut', () => {
  const layouts = layoutJankoScore(BRAHMS_SCORE, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS);
  const sys = layouts.find((s) => s.notes.some((p) => p.note.id === 'brahms-op118-no1-321'))!;
  const half = sys.notes.find((p) => p.note.id === 'brahms-op118-no1-321')!;
  const [center] = stemRingCenters(half.rhythm, BRAHMS_PREVIEW_TOKENS, 'complete');
  assert.ok(center, 'the lone half resolves a ring centre');
  // Park a foreign head exactly on the ring: the head's later knockout
  // would chop the ring's stroke.
  const foreign = sys.notes.find((p) => p.note.id !== half.note.id)!;
  foreign.x = center.x;
  foreign.y = center.y;
  const out: LintViolation[] = [];
  checkStemRingGeometry(sys, BRAHMS_PREVIEW, BRAHMS_PREVIEW_TOKENS, out);
  assert.ok(
    out.some(
      (v) =>
        v.code === 'ring-geometry' &&
        v.message.includes('brahms-op118-no1-321') &&
        v.message.includes('would cut the ring')
    ),
    'the chopped ring is named'
  );
});

test('the Round 30 audits are silent under golden and listed in the registry', () => {
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('dot-count-agreement'),
    'dot-count-agreement is registered'
  );
  assert.ok(
    (JANKO_LINT_CHECKS as readonly string[]).includes('ring-geometry'),
    'ring-geometry is registered'
  );
  // Golden predates the grammar: the new checks no-op (proven by the gate
  // staying green), and the option-aware paths never fire without preview.
  const golden = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
  const sys = layoutJankoScore(BRAHMS_SCORE, golden, BRAHMS_PREVIEW_TOKENS)[0];
  const out: LintViolation[] = [];
  checkDotCountAgreement(sys, golden, BRAHMS_PREVIEW_TOKENS, out);
  checkStemRingGeometry(sys, golden, BRAHMS_PREVIEW_TOKENS, out);
  assert.equal(out.length, 0, 'golden silence');
});
