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
import {
  DEFAULT_JANKO_LINT_OPTIONS,
  JANKO_LINT_CHECKS,
  LintViolation,
  auditKnockoutProtection,
  auditStemBeamConnections,
  checkAccoladeClearance,
  checkBarlineClearance,
  checkMeasureNumeralClearance,
  checkMiddleCCorridor,
  checkNoteheadClearance,
  checkStemAndBeamValidity,
  formatLintReport,
  lintJankoScore,
} from '../src/render/janko/linter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const SCORE = buildBachGoldbergVar1Score();
const LINT = DEFAULT_JANKO_LINT_OPTIONS;

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
  // The two known cross-hand chordal collisions are surfaced, never hidden.
  assert.equal(report.warnings.length, 2);
  for (const warning of report.warnings) {
    assert.equal(warning.code, 'chordal-overlap');
    assert.match(warning.message, /erases the earlier digit/);
  }
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
  assert.match(text, /chordal-overlap/);
});

// ---------------------------------------------------------------------------
// 3. Geometric defect detection
// ---------------------------------------------------------------------------

test('Defect: two different onsets collapsing onto one point is a notehead overlap', () => {
  const layout = systems()[0];
  // Two 16ths of different hands, forced onto one page point.
  const a = layout.notes[2];
  const b = layout.notes[3];
  assert.notEqual(a.note.startTick, b.note.startTick, 'the defect needs distinct onsets');
  const collided: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p) => (p === b ? { ...p, x: a.x, y: a.y } : p)),
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
  const chordal: JankoSystemLayout = {
    ...layout,
    notes: layout.notes.map((p, i) =>
      i === 1 ? { ...p, x: layout.notes[0].x, y: layout.notes[0].y, note: { ...p.note, startTick: layout.notes[0].note.startTick } } : p
    ),
  };
  const out = run(
    (l, o) => checkNoteheadClearance(l, DEFAULT_JANKO_TOKENS, LINT, o),
    chordal
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'chordal-overlap');
  assert.equal(out[0].severity, 'warning');
});

test('Defect: shrinking the knockout below the glyph box is caught', () => {
  const tiny = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 2.0 };
  const report = lintJankoScore(SCORE, DEFAULT_JANKO_OPTIONS, tiny);
  const undersized = report.violations.filter((v) => v.code === 'knockout-undersized');
  assert.equal(undersized.length, SCORE.notes.length, 'every notehead reports its undersized mask');
  assert.match(undersized[0].message, /cannot shield the 6.5pt digit/);
  assert.ok(undersized[0].metrics!.required > undersized[0].metrics!.radius);
});

test('Defect: a stem that no longer reaches into its own disc is caught', () => {
  const tokens = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 2.5 };
  const out: LintViolation[] = [];
  checkStemAndBeamValidity(systems(DEFAULT_JANKO_OPTIONS, tokens)[0], tokens, LINT, out);
  const detached = out.filter((v) => v.code === 'stem-detached');
  assert.ok(detached.length > 0, 'floating stems must be reported');
  // 2.41pt attachment on a 2.5pt disc is a hair inside, but the ±1.5pt optical
  // offset pushes the anchor out of the disc for tighter radii.
  const tighter = { ...DEFAULT_JANKO_TOKENS, noteheadRadius: 2.0 };
  const out2: LintViolation[] = [];
  checkStemAndBeamValidity(systems(DEFAULT_JANKO_OPTIONS, tighter)[0], tighter, LINT, out2);
  assert.ok(out2.some((v) => v.code === 'stem-detached' && v.metrics!.attach > 2.0));
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
  const svg = '<svg><line class="janko-stem" x1="10" y1="100" x2="10" y2="70" stroke="#111"/></svg>';
  const audit = auditStemBeamConnections(svg, {
    stemLength: DEFAULT_JANKO_TOKENS.stemLength,
    maxBeamSlope: LINT.maxBeamSlope,
  });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].code, 'beam-stem-gap');
  assert.match(audit[0].message, /does not land on any beam/);

  // A standalone stem of the canonical length is legal.
  const legal = '<svg><line class="janko-stem" x1="10" y1="100" x2="10" y2="85.5" stroke="#111"/></svg>';
  assert.deepEqual(
    auditStemBeamConnections(legal, {
      stemLength: DEFAULT_JANKO_TOKENS.stemLength,
      maxBeamSlope: LINT.maxBeamSlope,
    }),
    []
  );
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

// ---------------------------------------------------------------------------
// 4. Document-level paint-order audit
// ---------------------------------------------------------------------------

test('Paint audit: a digit without its knockout is a violation', () => {
  const svg = '<svg><text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text></svg>';
  const out = auditKnockoutProtection(svg, { noteheadRadius: 4.2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-missing');
});

test('Paint audit: a knockout without its digit is a violation', () => {
  const svg = '<svg><circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/></svg>';
  const out = auditKnockoutProtection(svg, { noteheadRadius: 4.2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-empty');
});

test('Paint audit: a rule painted after the knockout may not cut through it', () => {
  const clean =
    '<svg><line x1="40" y1="100" x2="60" y2="100" stroke="#111"/>' +
    '<circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/>' +
    '<text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text></svg>';
  assert.deepEqual(auditKnockoutProtection(clean, { noteheadRadius: 4.2 }), []);

  const regressed =
    '<svg><circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/>' +
    '<text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text>' +
    '<line class="janko-beat-line" x1="50" y1="90" x2="50" y2="110" stroke="#D1D5DB"/></svg>';
  const out = auditKnockoutProtection(regressed, { noteheadRadius: 4.2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');
  assert.match(out[0].message, /beat-line element painted after the knockout/);
});

test('Paint audit: the Middle C spine cutting a glyph is named explicitly', () => {
  const svg =
    '<svg><circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/>' +
    '<text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text>' +
    '<line x1="30" y1="100" x2="70" y2="100" stroke="#E2E8F0"/></svg>';
  const out = auditKnockoutProtection(svg, { noteheadRadius: 4.2, spineY: 100 });
  assert.equal(out.length, 1);
  assert.match(out[0].message, /Middle C spine cuts through the knockout/);
});

test('Paint audit: a notehead’s own stem is exempt, a foreign stem is not', () => {
  const own =
    '<svg><line class="janko-stem" x1="53.8" y1="98.5" x2="53.8" y2="85" stroke="#111"/>' +
    '<circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/>' +
    '<text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text></svg>';
  assert.deepEqual(auditKnockoutProtection(own, { noteheadRadius: 4.2 }), []);

  const foreign =
    '<svg><circle class="janko-knockout" cx="50" cy="100" r="4.20" fill="#FFFFFF"/>' +
    '<text class="janko-digit" x="50" y="100.35" font-size="6.5pt">7</text>' +
    '<line class="janko-stem" x1="52" y1="120" x2="52" y2="80" stroke="#111"/></svg>';
  const out = auditKnockoutProtection(foreign, { noteheadRadius: 4.2 });
  assert.equal(out.length, 1);
  assert.equal(out[0].code, 'knockout-pass-through');
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
        spineY: layout.geometry.middleCY,
      }),
      [],
      `system ${layout.index + 1} must be mask-clean`
    );
  }
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
  assert.match(out, /clean violations=0 warnings=2/);
});
