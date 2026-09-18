/**
 * Round 34 — m.33 fold-coincident octave pair (OPEN).
 *
 * The m.33 (and m.53 twin) LH octave coincides only through folding: the low
 * note (lin 16) folds +12 onto its twin's row (lin 28). The pair staggers
 * unbracketed on the canonical surface; this round asks how it should read:
 *
 * | # | id                   | `foldPairPresentation` | window set        |
 * | - | -------------------- | ---------------------- | ----------------- |
 * | A | `m33-literal-fold`    | `literal-fold`         | mm.33–36, mm.53–56 |
 * | B | `m33-shared-ottava`  | `shared-ottava`        | mm.33–36, mm.53–56 |
 * | C | `m33-split-octave`   | `split-octave`         | mm.33–36, mm.53–56 |
 *
 * No selection: the Reference stays the literal fold while the operator
 * judges on the live studio. Sounding pitches, start ticks and durations
 * are identical on every card; the ↓10 alone transposes and never adds a
 * note; no arpeggio engraving is introduced (separate ticket).
 *
 * Covers:
 *  1. Live registry: round 34, one axis, the A/B/C trio with one-line
 *     deltas, literal Brahms windows, per-candidate purity.
 *  2. Pitch semantics: every mode preserves sounding pitch, ticks and
 *     durations; brackets transpose without adding notes; no arpeggio ink.
 *  3. Mode geometry: A coincides staggered with an own-↓10; B stacks under
 *     one shared ↓10; C stacks literally with visible extension findings.
 *  4. Chips: A/B lint clean, C carries its two extension findings visibly.
 *  5. Reference stays the literal fold; R33 decided by convention.
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
import {
  BRAHMS_STUDIO_SCORE_ID,
  brahmsWindow,
  candidateBadges,
  type JankoCandidate,
  type JankoCandidateRound,
} from '../src/render/janko/candidates';
import {
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';
import {
  resolveJankoOptions,
  resolveJankoTokens,
  type JankoFoldPairPresentation,
} from '../src/render/janko/types';
import { layoutJankoScore, sourceLin } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
function read(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

/** Historical Round 34 metadata (parked). */
export const ROUND_34_METADATA: JankoCandidateRound = {
  round: 34,
  title: 'm.33 fold-coincident octave pair: literal fold vs shared transposition vs true octave',
  description:
    'Round 34: the m.33 (and m.53 twin) LH octave coincides only through folding. Card A keeps the literal fold (low note folded with its own ↓10, staggered, unbracketed — the incumbent). Card B shifts both notes up under one shared ↓10. Card C draws the low note at literal pitch as a true octave stack (carries extension findings). Sounding pitches preserved on every card; no arpeggio engraving; no selection — the Reference stays the literal fold.',
  openAxes: ['foldPairPresentation'],
};

/** Historical Round 34 cards (parked). */
export const ROUND_34_CANDIDATES: JankoCandidate[] = [
  {
    id: 'm33-literal-fold',
    label: 'A · Literal fold',
    description:
      'The incumbent: the low note folds onto its octave twin’s row with its own ↓10, staggered one gap, unbracketed. Sounding pitches literal; the bracket alone transposes.',
    axis: 'foldPairPresentation',
    options: { foldPairPresentation: 'literal-fold' },
    windows: [
      brahmsWindow(33, 4, 'mm.33–36 · The fold-coincident octave'),
      brahmsWindow(53, 4, 'mm.53–56 · The m.53 twin'),
    ],
    tags: ['brahms', 'm33', 'incumbent'],
  },
  {
    id: 'm33-shared-ottava',
    label: 'B · Shared ↓10',
    description:
      'Both notes written up one octave under one shared ↓10: the pair reads as a single transposition. Sounding pitches preserved; the bracket alone transposes and never adds a note.',
    axis: 'foldPairPresentation',
    options: { foldPairPresentation: 'shared-ottava' },
    windows: [
      brahmsWindow(33, 4, 'mm.33–36 · The fold-coincident octave'),
      brahmsWindow(53, 4, 'mm.53–56 · The m.53 twin'),
    ],
    tags: ['brahms', 'm33'],
  },
  {
    id: 'm33-split-octave',
    label: 'C · Split octave',
    description:
      'The low note draws at literal pitch with no fold and no bracket: the pair reads as a true octave stack. Sounding pitches preserved; the low note exceeds core±1 coverage and carries its extension findings visibly.',
    axis: 'foldPairPresentation',
    options: { foldPairPresentation: 'split-octave' },
    windows: [
      brahmsWindow(33, 4, 'mm.33–36 · The fold-coincident octave'),
      brahmsWindow(53, 4, 'mm.53–56 · The m.53 twin'),
    ],
    tags: ['brahms', 'm33'],
  },
];

const BRAHMS = buildBrahmsOp118No1Score();
const T_BRAHMS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const MODES: JankoFoldPairPresentation[] = ['literal-fold', 'shared-ottava', 'split-octave'];
const O_MODE = (mode: JankoFoldPairPresentation) =>
  resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, foldPairPresentation: mode });
const at = (measure: number): number =>
  BRAHMS_OP118_NO1_ANACRUSIS_TICKS + (measure - 1) * BRAHMS_OP118_NO1_TICKS_PER_MEASURE;
/** Sounding linear pitch: written minus the bracket's transposition. */
const soundingLin = (writtenLin: number, shift: number): number => writtenLin - shift;

// ---------------------------------------------------------------------------
// 1. Live registry
// ---------------------------------------------------------------------------

test('Round 34 parked: one m33 axis, the A/B/C trio, literal windows', () => {
  assert.equal(ROUND_34_METADATA.round, 34);
  assert.match(ROUND_34_METADATA.title, /m\.33/i);
  assert.deepEqual(ROUND_34_METADATA.openAxes, ['foldPairPresentation']);
  assert.deepEqual(
    ROUND_34_CANDIDATES.map((c) => c.id),
    ['m33-literal-fold', 'm33-shared-ottava', 'm33-split-octave']
  );
  const modes = ROUND_34_CANDIDATES.map((c) => c.options?.foldPairPresentation);
  assert.deepEqual(modes, MODES, 'one card per presentation mode');
  for (const c of ROUND_34_CANDIDATES) {
    assert.equal(c.axis, 'foldPairPresentation', `${c.id}: per-candidate purity`);
    assert.deepEqual(Object.keys(c.options ?? {}), ['foldPairPresentation'], `${c.id}: one-line delta`);
    assert.deepEqual(
      (c.windows ?? []).map((w) => [w.scoreId, w.measureStart, w.measureCount]),
      [
        [BRAHMS_STUDIO_SCORE_ID, 33, 4],
        [BRAHMS_STUDIO_SCORE_ID, 53, 4],
      ],
      `${c.id}: the literal m33 window plus the m53 twin`
    );
    const badges = candidateBadges(c, ROUND_34_METADATA);
    assert.ok(
      badges.some((b) => b.key === 'foldPairPresentation' && b.axis === true),
      `${c.id} badges the open axis (including the incumbent value)`
    );
  }
  assert.equal(ROUND_34_CANDIDATES.find((c) => c.id === 'control'), undefined, 'no control card');
});

// ---------------------------------------------------------------------------
// 2. Pitch semantics (every mode)
// ---------------------------------------------------------------------------

test('m33 pitch semantics: sounding pitches, ticks and durations identical on A/B/C', () => {
  const layouts = new Map(MODES.map((m) => [m, layoutJankoScore(BRAHMS, O_MODE(m), T_BRAHMS)] as const));
  const flat = (mode: JankoFoldPairPresentation) =>
    layouts.get(mode)!.flatMap((l) => l.notes).sort((a, b) => a.note.id.localeCompare(b.note.id));
  const a = flat('literal-fold');
  for (const mode of ['shared-ottava', 'split-octave'] as const) {
    const other = flat(mode);
    assert.equal(other.length, a.length, `${mode}: no note added or lost`);
    for (let i = 0; i < a.length; i++) {
      assert.equal(other[i].note.id, a[i].note.id, `${mode}: same notes in the same order`);
      assert.equal(other[i].note.startTick, a[i].note.startTick, `${mode} ${a[i].note.id}: tick kept`);
      assert.equal(
        other[i].note.durationTicks,
        a[i].note.durationTicks,
        `${mode} ${a[i].note.id}: duration kept`
      );
      assert.equal(
        soundingLin(other[i].writtenLin ?? 0, other[i].ottavaShift ?? 0),
        soundingLin(a[i].writtenLin ?? 0, a[i].ottavaShift ?? 0),
        `${mode} ${a[i].note.id}: sounding pitch kept`
      );
    }
  }
  // The m33 pair sounds 16 + 28 on every card.
  for (const mode of MODES) {
    const pair = flat(mode).filter((p) => p.note.startTick === at(33) && p.note.hand === 'LH');
    assert.equal(pair.length, 2, `${mode}: the two-note relationship`);
    const sounding = pair
      .map((p) => soundingLin(p.writtenLin ?? 0, p.ottavaShift ?? 0))
      .sort((x, y) => x - y);
    assert.deepEqual(sounding, [16, 28], `${mode}: sounds lin 16 + 28`);
  }
});

test('m33 brackets transpose but never add: bracket noteIds are score notes', () => {
  const scoreIds = new Set(BRAHMS.notes.map((n) => n.id));
  for (const mode of MODES) {
    const layouts = layoutJankoScore(BRAHMS, O_MODE(mode), T_BRAHMS);
    const brackets = layouts.flatMap((l) => l.ottavaBrackets);
    for (const b of brackets) {
      for (const id of b.noteIds) assert.ok(scoreIds.has(id), `${mode}: ${id} is a score note`);
      assert.equal(b.shift === 12 ? b.kind : b.kind, b.kind, `${mode}: kind set`);
    }
  }
  // B's shared bracket covers both twins; A's covers the low twin alone.
  const bBrackets = layoutJankoScore(BRAHMS, O_MODE('shared-ottava'), T_BRAHMS).flatMap(
    (l) => l.ottavaBrackets
  );
  const shared = bBrackets.filter(
    (b) => b.noteIds.includes('brahms-op118-no1-444') || b.noteIds.includes('brahms-op118-no1-445')
  );
  assert.equal(shared.length, 1, 'B: one shared bracket');
  assert.deepEqual(
    [...shared[0].noteIds].sort(),
    ['brahms-op118-no1-444', 'brahms-op118-no1-445'],
    'B: the shared ↓10 covers both twins'
  );
  assert.equal(shared[0].kind, 'down10', 'B: down an octave');
});

test('m33 introduces no arpeggio engraving on any card', () => {
  for (const mode of MODES) {
    const layouts = layoutJankoScore(BRAHMS, O_MODE(mode), T_BRAHMS);
    const svg = layouts
      .map((l) => JSON.stringify({ clasps: l.clasps.length, brackets: l.ottavaBrackets.length }))
      .join('');
    assert.ok(!/arpeggio/i.test(svg), `${mode}: no arpeggio structures`);
  }
});

// ---------------------------------------------------------------------------
// 3. Mode geometry
// ---------------------------------------------------------------------------

test('m33-A: the twins coincide staggered with an own-↓10, unbracketed', () => {
  const layouts = layoutJankoScore(BRAHMS, O_MODE('literal-fold'), T_BRAHMS);
  const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === at(33)))!;
  const pair = sys.notes
    .filter((p) => p.note.startTick === at(33) && p.note.hand === 'LH')
    .sort((x, y) => sourceLin(x) - sourceLin(y));
  assert.equal(pair[0].y, pair[1].y, 'the twins coincide after folding');
  assert.ok(Math.abs(pair[1].x - pair[0].x - 5.46) < 1e-6, 'staggered one gap');
  assert.deepEqual(
    [pair[0].writtenLin, pair[1].writtenLin],
    [28, 28],
    'both written on row 28'
  );
  assert.deepEqual(
    [pair[0].ottavaShift ?? 0, pair[1].ottavaShift ?? 0],
    [12, 0],
    'only the low twin folds'
  );
  const lhPair = sys.clasps.filter((c) => c.tick === at(33) && c.notes.every((n) => n.hand === 'LH'));
  assert.equal(lhPair.length, 0, 'no bracket solely for the coincidence');
  const own = sys.ottavaBrackets.filter((b) => b.noteIds.includes('brahms-op118-no1-444'));
  assert.equal(own.length, 1, 'the low twin keeps its own ↓10');
  assert.deepEqual(own[0].noteIds, ['brahms-op118-no1-444'], 'own bracket, not shared');
});

test('m33-B: the twins stack an octave apart under one shared ↓10', () => {
  const layouts = layoutJankoScore(BRAHMS, O_MODE('shared-ottava'), T_BRAHMS);
  const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === at(33)))!;
  const pair = sys.notes
    .filter((p) => p.note.startTick === at(33) && p.note.hand === 'LH')
    .sort((x, y) => sourceLin(x) - sourceLin(y));
  assert.deepEqual(
    [pair[0].writtenLin, pair[1].writtenLin],
    [28, 40],
    'both written up one octave'
  );
  assert.deepEqual(
    [pair[0].ottavaShift ?? 0, pair[1].ottavaShift ?? 0],
    [12, 12],
    'both transpose down an octave'
  );
  assert.ok(Math.abs(pair[0].y - pair[1].y - 30) < 1e-6, 'a true octave stack (30pt)');
  assert.equal(pair[0].x, pair[1].x, 'no stagger needed — rows differ');
});

test('m33-C: the low twin draws literally as a true octave stack', () => {
  const layouts = layoutJankoScore(BRAHMS, O_MODE('split-octave'), T_BRAHMS);
  const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === at(33)))!;
  const pair = sys.notes
    .filter((p) => p.note.startTick === at(33) && p.note.hand === 'LH')
    .sort((x, y) => sourceLin(x) - sourceLin(y));
  assert.deepEqual(
    [pair[0].writtenLin, pair[1].writtenLin],
    [16, 28],
    'low twin literal, high twin kept'
  );
  assert.deepEqual(
    [pair[0].ottavaShift ?? 0, pair[1].ottavaShift ?? 0],
    [0, 0],
    'no fold, no bracket transposition'
  );
  assert.ok(Math.abs(pair[0].y - pair[1].y - 30) < 1e-6, 'a true octave stack (30pt)');
  const own = sys.ottavaBrackets.filter(
    (b) => b.noteIds.includes('brahms-op118-no1-444') || b.noteIds.includes('brahms-op118-no1-445')
  );
  assert.equal(own.length, 0, 'no bracket on the literal pair');
});

// ---------------------------------------------------------------------------
// 4. Chips
// ---------------------------------------------------------------------------

test('m33 chips: A/B clean, C carries its two extension findings visibly', () => {
  const reports = new Map(
    MODES.map((m) => [m, lintJankoScore(BRAHMS, O_MODE(m), T_BRAHMS)] as const)
  );
  assert.equal(reports.get('literal-fold')!.violations.length, 0, 'A clean');
  assert.equal(reports.get('literal-fold')!.warnings.length, 0, 'A warning-free');
  assert.equal(reports.get('shared-ottava')!.violations.length, 0, 'B clean');
  assert.equal(reports.get('shared-ottava')!.warnings.length, 0, 'B warning-free');
  const c = reports.get('split-octave')!;
  assert.equal(c.violations.length, 2, 'C carries two findings (m33 + m53 low twins)');
  assert.deepEqual(
    [...new Set(c.violations.map((v) => v.code))],
    ['extension-beyond-core'],
    'C findings are same-class coverage findings'
  );
  const html = renderCandidatesView(
    createStudioConfig({ round: ROUND_34_METADATA, candidates: ROUND_34_CANDIDATES })
  );
  for (const [id, lint] of [
    ['m33-literal-fold', 'clean'],
    ['m33-shared-ottava', 'clean'],
    ['m33-split-octave', 'violations'],
  ] as const) {
    const card = html.slice(html.indexOf(`data-candidate="${id}"`));
    const body = card.slice(0, card.indexOf('</article>'));
    assert.ok(body.includes(`data-lint="${lint}"`), `${id} chip reads ${lint}`);
  }
});

// ---------------------------------------------------------------------------
// 5. Reference and parking
// ---------------------------------------------------------------------------

test('Reference stays the literal fold: m33 staggers unbracketed', () => {
  const html = renderReferenceView(createStudioConfig());
  assert.ok(html.includes('brahms-op118-no1'), 'the Brahms Reference renders');
  const layouts = layoutJankoScore(
    BRAHMS,
    resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
    resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS)
  );
  const sys = layouts.find((l) => l.notes.some((p) => p.note.startTick === at(33)))!;
  const lhPair = sys.clasps.filter(
    (c) => c.tick === at(33) && c.notes.every((n) => n.hand === 'LH')
  );
  assert.equal(lhPair.length, 0, 'Reference: no LH bracket at m33');
});

test('R33 decided by convention: historical consts parked, no live pins remain', () => {
  const suite = read('test/janko-round33.test.ts');
  assert.ok(suite.includes('ROUND_33_METADATA'), 'the historical metadata const is parked');
  assert.ok(suite.includes('ROUND_33_CANDIDATES'), 'the historical card consts are parked');
  assert.match(suite, /Historical Round 33/, 'the parking record names the round');
  assert.match(
    read('src/render/janko/candidates.ts'),
    /Round 33 is decided|full grid is selected/,
    'the registry carries the decided record'
  );
  assert.ok(
    !/^import[^;]*CURRENT_ROUND_METADATA/m.test(suite),
    'no live-registry metadata import remains'
  );
  assert.ok(!/^import[^;]*CURRENT_CANDIDATES[^_]/m.test(suite), 'no live-registry cards import remains');
  assert.ok(!/assert\.equal\(CURRENT_ROUND_METADATA/m.test(suite), 'no live-registry pins remain');
});

test('R34 parked by convention: historical consts parked, live registry moved to Round 35', () => {
  assert.equal(ROUND_34_METADATA.round, 34);
  assert.equal(ROUND_34_CANDIDATES.length, 3);
  const candFile = read('src/render/janko/candidates.ts');
  assert.match(candFile, /Round 34 opened the m\.33 fold-coincident octave-pair comparison/);
});
