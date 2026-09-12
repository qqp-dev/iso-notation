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
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { JankoSystemLayout, layoutJankoScore, renderSystem, computePageGeometry, getSystemGeometry } from '../src/render/janko/engine';
import { getStemAttachmentRadius, getStemGeometry } from '../src/render/janko/elements/rhythm';
import {
  JANKO_DIGIT_BASELINE_OFFSET,
  digitBaselineOffset,
  digitHalfExtents,
  isPositionOfHonor,
} from '../src/render/janko/elements/notehead';
import { getChordalOffset } from '../src/render/janko/engine';
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  JANKO_LINT_CHECKS,
  LintViolation,
  auditKnockoutProtection,
  auditStemBeamConnections,
  checkAccoladeClearance,
  checkBarlineClearance,
  checkBeamNoteheadClearance,
  checkHaloClearance,
  checkKnockoutCoverage,
  checkMeasureNumeralClearance,
  checkMiddleCCorridor,
  checkNoteheadClearance,
  checkStemAndBeamValidity,
  checkStemDigitClearance,
  formatLintReport,
  lintJankoScore,
} from '../src/render/janko/linter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const SCORE = buildBachGoldbergVar1Score();
const LINT = DEFAULT_JANKO_LINT_OPTIONS;
const TOKENS = DEFAULT_JANKO_TOKENS;
const R = TOKENS.noteheadRadius;
const HALO_R = TOKENS.haloRadius;
/** Canonical flush stem attachment radii (regular heads / tick-0 honor sounds). */
const REGULAR_ATTACH = R + 0.2;
const HONOR_ATTACH = HALO_R + 0.4;

// --- Tiny document fixtures for the paint-order audit -----------------------

const knockout = (cx: number, cy: number, r: number = R): string =>
  `<circle class="janko-knockout" cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="#FFFFFF"/>`;
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
  assert.equal(report.diagnostics.length, report.violations.length + report.warnings.length);
  assert.equal(report.ok, report.violations.length === 0);
  assert.equal(report.stats.systems, 8, 'four measures x eight systems of Bach Var. 1');
  assert.equal(report.stats.measures, 32);
  assert.equal(report.stats.notes, SCORE.notes.length);
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

test('Row-snapped chord tones: every same-row pair is spread by one full disc', () => {
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const layouts = layoutJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  const r = DEFAULT_JANKO_TOKENS.noteheadRadius;
  const offset = getChordalOffset(DEFAULT_JANKO_TOKENS);
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
        Math.abs(xs[1] - xs[0] - offset) < 1e-9,
        `spread pair keeps Δx = ${offset.toFixed(2)}pt (got ${(xs[1] - xs[0]).toFixed(2)})`
      );
      assert.ok(xs[1] - xs[0] >= 2 * r, 'the spread clears one full notehead disc');
      for (const p of group) assert.equal(p.coord.rank, group[0].coord.rank, 'true row preserved');
    }
  }
  assert.equal(pairs, 9, 'the nine canonical cross-hand coincidences are all spread');
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
  // coincidences of the single equator simply do not exist here; the
  // row-snapped solver keeps the layout clean in either framing.
  assert.equal(report.warnings.length, 0, 'the channel adds no diagnostics of its own');
  assert.equal(report.stats.warnings, 0);
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
  assert.match(text, /551 noteheads/);
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
    (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_TOKENS, LINT, o),
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
    (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_TOKENS, LINT, o),
    chordal
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'chordal-overlap');
  assert.equal(out[0].severity, 'warning');
});

test('Row-snapped chord tones clear the warning exactly at one notehead diameter', () => {
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
  const offset = getChordalOffset(DEFAULT_JANKO_TOKENS);
  const lintAt = (dx: number): LintViolation[] =>
    run((l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_TOKENS, LINT, o), pairAt(dx));

  assert.equal(lintAt(2 * R - 0.01).length, 1, 'one hundredth short of a disc still collides');
  assert.equal(lintAt(2 * R - 0.01)[0].code, 'chordal-overlap');
  assert.equal(lintAt(2 * R).length, 0, 'one full diameter clears the warning');
  assert.equal(lintAt(offset).length, 0, 'the canonical row-snap offset clears it as well');
});

test('Defect: shrinking the knockout below the glyph box is caught', () => {
  const tiny = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 2.0 };
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, tiny);
  const undersized = report.violations.filter((v) => v.code === 'knockout-undersized');
  assert.equal(undersized.length, SCORE.notes.length, 'every notehead reports its undersized mask');
  assert.match(
    undersized[0].message,
    new RegExp(`cannot shield the ${DEFAULT_JANKO_TOKENS.digitFontSize}pt digit`)
  );
  assert.ok(undersized[0].metrics!.required > undersized[0].metrics!.radius);
  assert.ok(undersized[0].metrics!.vertical < 0, 'the glyph overflows the mask vertically');
});

test('Golden master: every digit keeps ≥1.2pt of white inside its knockout disc', () => {
  const { halfWidth, halfHeight } = digitHalfExtents(TOKENS.digitFontSize);
  const out: LintViolation[] = [];
  for (const layout of systems()) {
    checkKnockoutCoverage(layout, TOKENS, LINT, out);
  }
  assert.deepEqual(out, [], 'the canonical mask shields every digit on every side');
  assert.ok(R - halfWidth >= LINT.digitClearance, 'left/right margin');
  assert.ok(R - halfHeight >= LINT.digitClearance, 'top/bottom margin');
  assert.ok(R - Math.hypot(halfWidth, halfHeight) >= LINT.digitClearance, 'corner margin');

  // The check is a real gate: a 3.0pt mask cannot hold the digit.
  const tight = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 3.0 };
  const tightOut: LintViolation[] = [];
  checkKnockoutCoverage(systems(DEFAULT_JANKO_OPTIONS, tight)[0], tight, LINT, tightOut);
  assert.ok(tightOut.length > 0);
  assert.ok(tightOut.every((v) => v.code === 'knockout-undersized'));
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
    assert.match(v.message, /inside the .*ring|inside the .*disc/);
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
    checkHaloClearance(layout, TOKENS, LINT, out);
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
        `${p.note.id} keeps stemX === note.x`
      );
    }
  }
  assert.deepEqual(out, [], 'centred stems attach inside the disc and span their beam');
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

test('Defect: an accolade pushed off the page and into the numeral is caught', () => {
  const offPage = { ...DEFAULT_JANKO_OPTIONS, pageMargin: -20.0 };
  const out: LintViolation[] = [];
  const layout = systems(offPage)[0];
  checkAccoladeClearance(layout, offPage, DEFAULT_JANKO_TOKENS, LINT, out);
  assert.ok(
    out.some((v) => v.code === 'accolade-collision' && /leaves the left margin/.test(v.message)),
    'off-page accolade reported'
  );

  const tight = { ...DEFAULT_JANKO_TOKENS, accoladeGap: 1.0 };
  const out2: LintViolation[] = [];
  const tightLayout = systems(DEFAULT_JANKO_OPTIONS, tight)[0];
  checkMeasureNumeralClearance(tightLayout, DEFAULT_JANKO_OPTIONS, tight, LINT, out2);
  assert.ok(
    out2.some((v) => v.code === 'measure-numeral-collision' && /accolade/.test(v.message)),
    'numeral/accolade collision reported'
  );
});

test('Defect: collapsing the Middle C corridor is caught', () => {
  const cramped = { ...DEFAULT_JANKO_OPTIONS, interStaffGap: 18.0 };
  const out: LintViolation[] = [];
  const layout = systems(cramped)[0];
  checkMiddleCCorridor(layout, cramped, DEFAULT_JANKO_TOKENS, LINT, out);
  const intrusions = out.filter((v) => v.code === 'corridor-intrusion');
  assert.ok(intrusions.length > 0, 'structural rules may not cut the spine');
  assert.ok(intrusions.some((v) => /structural rules/.test(v.message)));
});

test('Corridor audit reads the true rule positions of the bounded channel', () => {
  // The channel displaces its boundary rules to `equator ± 6.5pt`, so a tight
  // corridor is cut by the inner rule even though the equator itself stays
  // clear. The audit must follow the painted rules, not the empty equator.
  const tight = { ...DEFAULT_JANKO_OPTIONS, interStaffGap: 12.0 };
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
// 4. Document-level paint-order audit
// ---------------------------------------------------------------------------

test('Paint audit: a digit without its knockout is a violation', () => {
  const svg = `<svg>${digit(50, 100)}</svg>`;
  const out = auditKnockoutProtection(svg, { noteheadRadius: R });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-missing');
});

test('Paint audit: a knockout without its digit is a violation', () => {
  const svg = `<svg>${knockout(50, 100)}</svg>`;
  const out = auditKnockoutProtection(svg, { noteheadRadius: R });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-empty');
});

test('Paint audit: a rule painted after the knockout may not cut through it', () => {
  const clean =
    '<svg><line x1="40" y1="100" x2="60" y2="100" stroke="#111"/>' +
    knockout(50, 100) +
    digit(50, 100) +
    '</svg>';
  assert.deepEqual(auditKnockoutProtection(clean, { noteheadRadius: R }), []);

  const regressed =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-beat-line" x1="50" y1="90" x2="50" y2="110" stroke="#D1D5DB"/></svg>';
  const out = auditKnockoutProtection(regressed, { noteheadRadius: R });
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
  const out = auditKnockoutProtection(svg, { noteheadRadius: R, spineY: 100 });
  assert.equal(out.length, 1);
  assert.match(out[0].message, /Middle C spine cuts through the knockout/);
});

test('Paint audit: a flush stem is exempt, a stem starting inside the disc is not', () => {
  // The notehead's own stem, painted after its mask, must start flush on the
  // disc perimeter …
  const own =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    stem(50, 100 - REGULAR_ATTACH, 85) +
    '</svg>';
  assert.deepEqual(
    auditKnockoutProtection(own, { noteheadRadius: R, haloRadius: HALO_R }),
    []
  );

  // … a stem emerging *inside* the disc pierces the mask instead.
  const inside =
    '<svg>' + knockout(50, 100) + digit(50, 100) + stem(50, 98.5, 85) + '</svg>';
  const out = auditKnockoutProtection(inside, { noteheadRadius: R, haloRadius: HALO_R });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');

  // A foreign stem crossing the disc is never exempt.
  const foreign =
    '<svg>' +
    knockout(50, 100) +
    digit(50, 100) +
    '<line class="janko-stem" x1="52" y1="120" x2="52" y2="80" stroke="#111"/></svg>';
  const out2 = auditKnockoutProtection(foreign, { noteheadRadius: R, haloRadius: HALO_R });
  assert.equal(out2.length, 1);
  assert.equal(out2[0].code, 'knockout-pass-through');
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
    auditKnockoutProtection(clean, { noteheadRadius: R, haloRadius: HALO_R }),
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
  const out = auditKnockoutProtection(pierced, { noteheadRadius: R, haloRadius: HALO_R });
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
        noteheadRadius: DEFAULT_JANKO_TOKENS.noteheadRadius,
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
      noteheadRadius: tokens.noteheadRadius,
      haloRadius: tokens.haloRadius,
      digitBaselineOffset: digitBaselineOffset(tokens.digitFontSize),
    }),
    []
  );
});

// ---------------------------------------------------------------------------
// 5. CLI contract
// ---------------------------------------------------------------------------

test('npm run lint:engraving reports the golden master clean and exits 0', () => {
  const out = execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/lint_engraving.ts', '--quiet'],
    { cwd: REPO_ROOT, encoding: 'utf-8' }
  );
  assert.match(out, /clean violations=0 warnings=0/);
});
