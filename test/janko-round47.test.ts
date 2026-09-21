/**
 * Round 47 — long-value symbols, the half-ring flat face and the tie-origin
 * simplification.
 * ===========================================================================
 *
 * Everything here is measured on the **real engine**: the emitted layout facts,
 * the emitted SVG text, the duration-ink census and the visual linter's own
 * report. Nothing in this file claims operator acceptance — the flat face, the
 * detached seats and the open-oval family are the operator's judgement at
 * normal size; this file certifies that the round's *contract* is implemented,
 * that the new axes are inert by default, and that the Reference surfaces are
 * byte-frozen.
 *
 * The six sections mirror the ticket:
 *
 * - **A** the new knobs are inert: the golden defaults are unchanged, the
 *   Reference is byte-identical to the committed Round 46 engraving, and
 *   declaring the defaults explicitly changes nothing;
 * - **B** the outgoing-tie simplification: the exact source chain, the shared
 *   partner, the terminal component and the crop/system boundary, with the
 *   published `tieOriginSuppressions` and the untouched ties/pitches;
 * - **C** the half-ring flat face: the cut-out mount (bracket spine and carrier
 *   line), the absent diameter stroke, and the control's unbroken spine;
 * - **D** the detached symbols: arm-free long statements, real seats with
 *   measured clearances, exact dots, and the short-value arms untouched;
 * - **E** the open-oval family: the three distinguishable shapes on both
 *   mounts, no three-mark stack, and the census/lint ownership proof across
 *   every card and every declared window;
 * - **F** the operator-facing claims: the window captions name the engine's own
 *   pitches and measures (mm. 1–3 = E5/C5, the m. 67 breve = F4, the other
 *   breve values = m. 69), and the round doc teaches the forward-safe strict
 *   invocation (`npm run lint:engraving -- --strict`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { QuantizedGridScore, QuantizedNote } from '../src/model/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  getCandidate,
} from '../src/render/janko/candidates';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoPages,
  drawnStaffRuleYs,
  getTieDisplayPlan,
  knockoutHalfExtents,
  layoutJankoScore,
  outgoingTieByHeadId,
  renderJankoCrop,
  renderJankoPage,
  renderSystem,
} from '../src/render/janko/engine';
import {
  claspInkBox,
  detachedSymbolInkBox,
  longMarkKindForBase,
  longRunName,
  midpointMetrics,
  openOvalShape,
} from '../src/render/janko/elements/rhythm';
import { lintJankoScore } from '../src/render/janko/linter';

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const OPTIONS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const LAYOUTS = layoutJankoScore(BRAHMS, OPTIONS, TOKENS);

const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

/** The committed Round 46 Brahms Reference (page 0 and the whole-score crop). */
const REFERENCE_PAGE0 = '205db94a3e9db316526cc24337b605815b50f57811110885ab482209839c2d5b';
const REFERENCE_CROP = '43f95a224a860e46eb4f554f921ff6a34bb8099ac83db6af27adf2047b04ad8f';

/** One synthetic note (the round's controlled tie-topology fixtures). */
function note(
  id: string,
  pitchClass: number,
  octave: number,
  startTick: number,
  durationTicks: number
): QuantizedNote {
  return { id, pitch: { pitchClass, octave }, startTick, durationTicks, hand: 'RH' };
}

/** A one-system synthetic score in 12/8 with a committed written-tie sidecar. */
function tiedScore(notes: QuantizedNote[], tieChains: QuantizedGridScore['tieChains']): QuantizedGridScore {
  return {
    id: 'round47-ties',
    title: 'round47 ties',
    composer: 'test',
    ticksPerBeat: 48,
    totalTicks: 12 * 192,
    timeSignatures: [{ tick: 0, numerator: 12, denominator: 8 }],
    barlines: [],
    tempos: [],
    dynamics: [],
    pedals: [],
    notes,
    ...(tieChains ? { tieChains } : {}),
  };
}

/** The round's synthetic fixture options: the Brahms duration family, tiny page. */
const FIXTURE_OPTIONS = resolveJankoOptions({
  ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
  measuresPerSystem: 4,
  systemsPerPage: 1,
  tieOriginIndicator: 'omit-outgoing',
});
const FIXTURE_TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

/** One resolved candidate card: the studio's own merge, laid out once. */
interface CardRun {
  id: string;
  options: ReturnType<typeof resolveJankoOptions>;
  tokens: ReturnType<typeof resolveJankoTokens>;
  layouts: ReturnType<typeof layoutJankoScore>;
}

const CARD_RUNS = new Map<string, CardRun>();

/** Lay one candidate card out on the real Brahms score (cached per card). */
function cardRun(id: string): CardRun {
  const cached = CARD_RUNS.get(id);
  if (cached) return cached;
  const candidate = getCandidate(id)!;
  assert.ok(candidate, `card ${id} is registered`);
  const options = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(candidate.options ?? {}) });
  const tokens = resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(candidate.tokens ?? {}) });
  const run: CardRun = { id, options, tokens, layouts: layoutJankoScore(BRAHMS, options, tokens) };
  CARD_RUNS.set(id, run);
  return run;
}

// ---------------------------------------------------------------------------
// A. The new axes are inert by default
// ---------------------------------------------------------------------------

test('A. The three new keys default to the incumbent behaviour', () => {
  assert.equal(DEFAULT_JANKO_OPTIONS.longDurationStyle, 'midpoint', 'the ring family is the default');
  assert.equal(DEFAULT_JANKO_OPTIONS.tieOriginIndicator, 'source', 'every origin states itself by default');
  assert.equal(DEFAULT_JANKO_OPTIONS.exceptionCarrier, 'none', 'no exception mount by default');
  assert.equal(DEFAULT_JANKO_TOKENS.halfRingGap, 0, 'the half-ring chord sits on the unbroken mount');
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalTiltDegrees, -30);
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalNarrowFactor, 0.66);
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalBroadFactor, 1.1);
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalHeightFactor, 0.62);
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalFlankGap, 0.3);
  assert.equal(DEFAULT_JANKO_TOKENS.openOvalFlankFactor, 0.95);
  // The new long-value family is a no-op outside its own grammar's axis.
  assert.equal(longMarkKindForBase(192, 'midpoint'), 'ring');
  assert.equal(longRunName(384, 'midpoint'), 'two-rings');
  assert.equal(longMarkKindForBase(48, 'midpoint'), null, 'the bare quarter never gains a mark');
  assert.equal(longMarkKindForBase(24, 'open-oval'), null, 'and no cut value is re-shaped');
});

test('A. Bach GOLD and the Brahms Reference are byte-identical', () => {
  let bach = '';
  for (let page = 0; page < countJankoPages(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS); page++) {
    bach += renderJankoPage(BACH, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  }
  assert.equal(
    sha(bach),
    'ccfcaecca058aa1ed7d37291d765a8ef58ed79e428c732f338f298fb5b7a104f',
    'Bach GOLD is unchanged'
  );
  assert.equal(sha(renderJankoPage(BRAHMS, 0, OPTIONS, TOKENS)), REFERENCE_PAGE0, 'Brahms page 0');
  assert.equal(sha(renderJankoCrop(BRAHMS, 1, 71, OPTIONS, TOKENS)), REFERENCE_CROP, 'the whole-score crop');
});

test('A. Declaring the new defaults explicitly changes nothing at all', () => {
  const explicit = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    longDurationStyle: 'midpoint',
    tieOriginIndicator: 'source',
  });
  const explicitTokens = resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, halfRingGap: 0 });
  assert.equal(sha(renderJankoPage(BRAHMS, 0, explicit, explicitTokens)), REFERENCE_PAGE0);
  assert.equal(sha(renderJankoCrop(BRAHMS, 1, 71, explicit, explicitTokens)), REFERENCE_CROP);
  // And the new layout metadata is empty wherever its axis is off.
  const layouts = layoutJankoScore(BRAHMS, explicit, explicitTokens);
  assert.equal(layouts.flatMap((l) => l.tieOriginSuppressions).length, 0, 'no omission without the option');
  assert.equal(layouts.flatMap((l) => l.detachedSymbols).length, 0, 'no detached seat without the option');
  assert.equal(layouts.flatMap((l) => l.detachedSeatRefusals).length, 0);
  assert.ok(layouts.every((l) => l.clasps.every((c) => c.spineGaps.length === 0)), 'no gap at gap 0');
});

// ---------------------------------------------------------------------------
// B. The outgoing-tie simplification
// ---------------------------------------------------------------------------

test('B. The m. 61–63 chain: three non-terminal long marks omitted, the terminal kept', () => {
  const run = cardRun('round47-mounted-control');
  const layouts = run.layouts;
  const suppressions = layouts.flatMap((l) => l.tieOriginSuppressions);
  const byId = new Map(suppressions.map((s) => [s.noteId, s]));
  // The four written components of the 504-tick E2 chain (192 · 192 · 96 · 24),
  // stated by the attack head and the three added continuation heads.
  assert.deepEqual(
    [...byId.keys()].sort(),
    [
      'brahms-op118-no1-448',
      'brahms-op118-no1-734',
      'brahms-op118-no1-858',
      'brahms-op118-no1-858~c1',
      'brahms-op118-no1-858~c2',
    ].sort(),
    'exactly the five origins the shared rule omits'
  );
  const c0 = byId.get('brahms-op118-no1-858')!;
  assert.equal(c0.tick, 11568);
  assert.equal(c0.durationTicks, 192);
  assert.equal(c0.run, 'ring');
  assert.equal(c0.component, 0);
  assert.equal(c0.toHeadId, 'brahms-op118-no1-858~c1');
  assert.equal(c0.toTick, 11760);
  const c2 = byId.get('brahms-op118-no1-858~c2')!;
  assert.equal(c2.tick, 11952);
  assert.equal(c2.run, 'half-ring');
  assert.equal(c2.toHeadId, 'brahms-op118-no1-858~c3');
  assert.equal(c2.toTick, 12048);
  // The terminal component is never omitted and never gains a long mark: its
  // own 24-tick statement is the chain's end.
  assert.ok(!byId.has('brahms-op118-no1-858~c3'), 'the terminal component is not omitted');
  assert.ok(
    !layouts.flatMap((l) => l.exceptionCarriers).some((c) => c.noteId === 'brahms-op118-no1-858~c3'),
    'and it carries no long exception mark'
  );
  // The bracket's own carried values are never omitted: m. 65's 96-tick
  // half-ring survives on all 18 systems.
  const bracketHalfRings = layouts.flatMap((l) => l.clasps).flatMap((c) =>
    c.durationInk.filter((ink) => ink.compactHalfRing).map(() => c.tick)
  );
  assert.ok(bracketHalfRings.length > 0, 'the brackets still state their own carried value');
});

test('B. The omission never touches pitches, onsets, sounding totals, ties or columns', () => {
  const layouts = cardRun('round47-mounted-control').layouts;
  // Sounding data: identical to the Reference score, by identity.
  assert.equal(BRAHMS.notes.length, 964, 'the source keeps its 964 sounding notes');
  assert.equal(
    BRAHMS.notes.reduce((sum, n) => sum + n.durationTicks, 0),
    51192,
    'and its exact sounding total'
  );
  // The tie arcs are the Reference's own (the simplification removes marks, it
  // never redraws a tie): compare the full arc geometry of every system.
  const arcs = (ls: typeof layouts): string =>
    JSON.stringify(
      ls.map((l) => (l.tieArcs ?? []).map((a) => [a.noteId, a.fromHeadId, a.toHeadId, a.x1, a.x2, a.y, a.depth, a.side]))
    );
  // Columns and heads never move: the layout is the Reference's own.
  const heads = (ls: typeof layouts): string =>
    JSON.stringify(ls.map((l) => l.notes.map((p) => [p.note.id, p.x, p.y, p.symbolScale ?? 1])));
  assert.equal(arcs(layouts), arcs(LAYOUTS), 'every tie arc is unchanged');
  assert.equal(heads(layouts), heads(LAYOUTS), 'and every head keeps its solved column');
  assert.equal(
    layouts.flatMap((l) => l.tieAnchorShortfalls).length,
    0,
    'no anchor is lost by the omission'
  );
});

test('B. Crop and system boundaries: the rule reads source topology, never the window', () => {
  // A chain whose continuation head lands in another **system** of a synthetic
  // score: the origin is still omitted (the source chain declares the tie), the
  // arc is published as a cross-system shortfall and nothing is invented at the
  // window end.
  // System 0 covers ticks 0..816 (pickup + four 192-tick measures); the
  // continuation head at tick 960 therefore lives in the **next** system.
  const notes = [note('origin', 0, 4, 0, 192), note('tail', 0, 4, 960, 192)];
  const score = tiedScore(notes, [
    {
      noteId: 'origin',
      soundingTicks: 384,
      voice: 'rightHandUpper',
      components: [
        { startTick: 0, durationTicks: 192, tieForward: true, tieWait: false, voice: 'rightHandUpper' },
        { startTick: 960, durationTicks: 192, tieForward: false, tieWait: false, voice: 'rightHandUpper' },
      ],
    },
  ]);
  const layouts = layoutJankoScore(score, FIXTURE_OPTIONS, FIXTURE_TOKENS);
  const suppressions = layouts.flatMap((l) => l.tieOriginSuppressions);
  assert.deepEqual(
    suppressions.map((s) => [s.noteId, s.component, s.toTick]),
    [['origin', 0, 960]],
    'the origin is omitted from the chain itself, not from the rendered system'
  );
  const shortfalls = layouts.flatMap((l) => l.tieAnchorShortfalls);
  assert.equal(shortfalls.length, 2, 'both systems publish the split arc, never hiding it');
  assert.ok(
    shortfalls.every((s) => /spans a system break/.test(s!.reason)),
    'each mentions the system break it refuses to fake across'
  );
  assert.ok(
    shortfalls.every((s) => s!.noteId === 'origin'),
    'and names the source chain, not a synthetic window-end note'
  );
  // A **crop** of the first system renders the same omission: no window-end
  // synthesis can resurrect the mark.
  const crop = renderJankoCrop(score, 1, 4, FIXTURE_OPTIONS, FIXTURE_TOKENS);
  assert.ok(!crop.includes('janko-exception-carrier'), 'no long exception arm in the crop');
  assert.ok(!crop.includes('janko-detached-symbol'), 'and no detached seat either');
});

test('B. An untied shared partner keeps its statement with correct surviving ownership', () => {
  // Two same-onset, same-duration 2-span neighbours: the upper member is a
  // written component with an outgoing tie, its partner is not. The shared mark
  // would be redundant only for the tied member, so it must survive for the
  // untied one — with that one owner named.
  // One admitted cluster of four levels: two 192-tick members make the bracket
  // carry 192, so the two 144-tick members are exceptions standing one 2-span
  // apart — the exact shape the shared indicator exists for. The upper one is
  // also a committed written component with an outgoing tie, and its terminal
  // statement is a short written component.
  const notes = [
    note('low-tied', 0, 3, 0, 144),
    note('low-free', 2, 3, 0, 144),
    note('upper-a', 0, 4, 0, 192),
    note('upper-b', 2, 4, 0, 192),
    note('low-tail', 0, 3, 384, 24),
  ];
  const score = tiedScore(notes, [
    {
      noteId: 'low-tied',
      soundingTicks: 168,
      voice: 'rightHandUpper',
      components: [
        { startTick: 0, durationTicks: 144, tieForward: true, tieWait: false, voice: 'rightHandUpper' },
        { startTick: 384, durationTicks: 24, tieForward: false, tieWait: false, voice: 'rightHandUpper' },
      ],
    },
  ]);
  const layouts = layoutJankoScore(score, FIXTURE_OPTIONS, FIXTURE_TOKENS);
  const suppressions = layouts.flatMap((l) => l.tieOriginSuppressions);
  assert.deepEqual(
    suppressions.map((s) => s.noteId),
    ['low-tied'],
    'only the tied exception member is omitted'
  );
  const marks = layouts.flatMap((l) => l.durationInkOwners).filter((o) => o.run === 'half-ring');
  assert.equal(marks.length, 1, 'one statement survives for the pair');
  assert.deepEqual(marks[0].ownerIds, ['low-free'], 'and it names the untied member alone');
  assert.equal(marks[0].shared, false, 'a single surviving owner is not a shared mark');
  assert.equal(marks[0].mount, 'carrier', 'stated on the round\u2019s own mount');
});

test('B. A terminal long component keeps its exact mark', () => {
  const notes = [note('head', 0, 4, 0, 192), note('tail', 0, 4, 192, 192)];
  const score = tiedScore(notes, [
    {
      noteId: 'head',
      soundingTicks: 384,
      voice: 'rightHandUpper',
      components: [
        { startTick: 0, durationTicks: 192, tieForward: true, tieWait: false, voice: 'rightHandUpper' },
        { startTick: 192, durationTicks: 192, tieForward: false, tieWait: false, voice: 'rightHandUpper' },
      ],
    },
  ]);
  const layouts = layoutJankoScore(score, FIXTURE_OPTIONS, FIXTURE_TOKENS);
  assert.deepEqual(
    layouts.flatMap((l) => l.tieOriginSuppressions).map((s) => s.noteId),
    ['head'],
    'the attack is omitted, the terminal is not'
  );
  const marks = layouts.flatMap((l) => l.durationInkOwners).filter((o) => o.run === 'ring');
  assert.equal(marks.length, 1, 'the terminal component still states its own value');
  assert.deepEqual(marks[0].ownerIds, ['tail'], 'and it is that head that owns the mark');
});

// ---------------------------------------------------------------------------
// C. The half-ring flat face
// ---------------------------------------------------------------------------

test('C. Card 2 interrupts the spine across every half-ring chord — nothing closes it', () => {
  const control = cardRun('round47-mounted-control');
  const cutout = cardRun('round47-half-ring-cutout');
  const controlGaps = control.layouts.flatMap((l) => l.clasps).flatMap((c) => c.spineGaps);
  const cutoutGaps = cutout.layouts.flatMap((l) => l.clasps).flatMap((c) => c.spineGaps);
  assert.equal(controlGaps.length, 0, 'the control keeps the unbroken spine');
  assert.equal(cutoutGaps.length, 53, '53 bracket half-rings claim the break');
  // Every gap is exactly the chord plus the declared 0.30pt at each end, read
  // from the same ring metric the paint uses.
  for (const layout of cutout.layouts) {
    for (const clasp of layout.clasps) {
      for (const gap of clasp.spineGaps) {
        const m = midpointMetrics(FIXTURE_TOKENS, clasp.durationScale);
        const halfRing = clasp.durationInk.find((ink) => ink.compactHalfRing)!;
        const r = m.bracketRingRadius;
        assert.ok(Math.abs(gap.from - (halfRing.centerY - r - 0.3)) < 1e-9, 'gap start = chord − gap');
        assert.ok(Math.abs(gap.to - (halfRing.centerY + r + 0.3)) < 1e-9, 'gap end = chord + gap');
      }
    }
  }
  // The painted bracket path is emitted as the spine's own intervals: the
  // spine's ink is gone across the chord and resumes exactly at the declared
  // ends, and every half-ring group closes nothing.
  const first = cutout.layouts.find((l) => l.clasps.some((c) => c.spineGaps.length > 0))!;
  const clasp = first.clasps.find((c) => c.spineGaps.length > 0)!;
  const gap = clasp.spineGaps[0];
  const svg = renderSystem(BRAHMS, first.geometry, first.index, cutout.options, cutout.tokens, first);
  const path = /<path class="janko-clasp" d="([^"]+)"/.exec(svg)![1];
  assert.equal((path.match(/M /g) ?? []).length, 2, 'two subpaths: cap+spine above, spine+cap below');
  assert.ok(path.includes(gap!.from.toFixed(2)), 'the upper spine stops at the gap end');
  assert.ok(path.includes(gap!.to.toFixed(2)), 'and the lower spine resumes at the other');
  const group = new RegExp(
    `<g class="janko-clasp-group" data-clasp-tick="${clasp.tick}"[\\s\\S]*?</g>`
  ).exec(svg)![0];
  assert.ok(group.includes('data-half-ring="true"'), 'the half-ring is painted there');
  assert.ok(/data-half-ring="true"[^>]*fill="none"/.test(group), 'as one open arc with no fill');
  assert.equal((group.match(/<line /g) ?? []).length, 0, 'and no line closes its chord');
  assert.equal(
    (group.match(/<circle /g) ?? []).length,
    (group.match(/janko-clasp-dot/g) ?? []).length,
    'nor is any disc (ring) drawn over the gap — only the value\u2019s own dot'
  );
});

test('C. Cards 1 and 2 are the same vocabulary, arms and ink — only the mount is cut', () => {
  const control = cardRun('round47-mounted-control');
  const cutout = cardRun('round47-half-ring-cutout');
  const arms = (run: CardRun): string =>
    JSON.stringify(
      run.layouts.map((l) =>
        l.exceptionCarriers.map((c) => [
          c.noteId,
          c.tick,
          c.x0,
          c.x1,
          c.y,
          c.cuts,
          c.rings,
          c.halfRing,
          c.dots,
          c.base,
          c.partnerId ?? '',
        ])
      )
    );
  assert.equal(arms(control), arms(cutout), 'the arm geometry is identical');
  assert.deepEqual(
    control.layouts.map((l) => l.notes.map((p) => [p.note.id, p.x, p.y])),
    cutout.layouts.map((l) => l.notes.map((p) => [p.note.id, p.x, p.y])),
    'no head moves'
  );
  const rings = (run: ReturnType<typeof cardRun>): string[] =>
    run.layouts.flatMap((l) =>
      l.clasps.flatMap((c) => c.durationInk.map((ink) => `${ink.compactCuts}/${ink.compactRings}${ink.compactHalfRing ? 'H' : ''}`))
    );
  assert.deepEqual(rings(control), rings(cutout), 'the same marks on both cards');
  assert.equal(cutout.tokens.halfRingGap, 0.3);
  assert.equal(control.tokens.halfRingGap, 0);
});

// ---------------------------------------------------------------------------
// D. The detached symbols
// ---------------------------------------------------------------------------

test('D. Card 3 detaches every long statement and leaves every arm free', () => {
  const run = cardRun('round47-detached-symbols');
  const symbols = run.layouts.flatMap((l) => l.detachedSymbols);
  const carriers = run.layouts.flatMap((l) => l.exceptionCarriers);
  assert.equal(symbols.length, 16, '16 long statements are seated');
  assert.equal(
    carriers.filter((c) => longMarkKindForBase(c.base, c.longStyle) !== null).length,
    0,
    'no long value keeps a horizontal arm'
  );
  assert.ok(carriers.length > 0, 'the short-value exceptions keep their arms untouched');
  assert.ok(
    carriers.every((c) => longMarkKindForBase(c.base, c.longStyle) === null),
    'and every remaining carrier is a cut statement'
  );
  assert.equal(run.layouts.flatMap((l) => l.detachedSeatRefusals).length, 0, 'none refused');
  // Every seat hugs its owner: the "nearest legal seat" is published, never a
  // distant arm endpoint.
  for (const symbol of symbols) {
    assert.ok(symbol.distance >= 0 && symbol.distance < 6, `${symbol.noteId}: distance ${symbol.distance}`);
    assert.ok(['right', 'left', 'above', 'below', 'pair-channel'].includes(symbol.seat));
  }
  // No arm markup is painted for a long statement.
  const svg = run.layouts.map((l) => renderSystem(BRAHMS, l.geometry, l.index, run.options, run.tokens, l)).join('\n');
  for (const symbol of symbols) {
    const group = new RegExp(`<g class="janko-detached-symbol" data-symbol-note="${symbol.noteId}"[\\s\\S]*?</g>`).exec(svg);
    assert.ok(group, `${symbol.noteId}: the symbol is painted`);
    assert.ok(!group![0].includes('janko-exception-carrier-line'), `${symbol.noteId}: arm-free`);
    assert.ok(!group![0].includes('fill="#FFFFFF"'), `${symbol.noteId}: it erases nothing`);
  }
});

test('D. Every detached seat clears every mask, bracket and drawn rule (measured)', () => {
  const run = cardRun('round47-detached-symbols');
  for (const layout of run.layouts) {
    const rules = drawnStaffRuleYs(layout.geometry, run.options, run.tokens);
    for (const symbol of layout.detachedSymbols) {
      const box = detachedSymbolInkBox(symbol, run.tokens);
      for (const p of layout.notes) {
        const e = knockoutHalfExtents(run.options, run.tokens, p.note.startTick, p);
        const overlaps =
          box.x0 < p.x + e.wx &&
          p.x - e.wx < box.x1 &&
          box.y0 < p.y + e.hy &&
          p.y - e.hy < box.y1;
        assert.ok(!overlaps, `${symbol.noteId}: clear of ${p.note.id}`);
      }
      for (const clasp of layout.clasps) {
        const ink = claspInkBox(clasp, run.tokens);
        const overlaps =
          box.x0 < ink.x1 && ink.x0 < box.x1 && box.y0 < ink.y1 && ink.y0 < box.y1;
        assert.ok(!overlaps, `${symbol.noteId}: clear of the bracket at tick ${clasp.tick}`);
      }
      for (const rule of rules) {
        assert.ok(
          !(rule > box.y0 - 1e-9 && rule < box.y1 + 1e-9),
          `${symbol.noteId}: no drawn rule crosses the seat`
        );
      }
    }
  }
});

test('D. Exact dots survive the move to a detached seat', () => {
  const run = cardRun('round47-detached-symbols');
  const dotted = run.layouts.flatMap((l) => l.detachedSymbols).filter((s) => s.dots >= 1);
  assert.ok(dotted.length > 0, 'the corpus states dotted long exceptions');
  for (const symbol of dotted) {
    assert.equal(symbol.base, 96, 'a dotted value is a dotted half, never a rounded whole');
    assert.equal(symbol.rings, 1, 'and its base state is the single half-mark');
  }
  // The painted dot is a satellite of the run, not part of the mark.
  const layout = run.layouts.find((l) => l.detachedSymbols.some((s) => s.dots >= 1))!;
  const symbol = layout.detachedSymbols.find((s) => s.dots >= 1)!;
  const svg = renderSystem(BRAHMS, layout.geometry, layout.index, run.options, run.tokens, layout);
  const group = new RegExp(`data-symbol-note="${symbol.noteId}"[\\s\\S]*?</g>`).exec(svg)![0];
  assert.equal((group.match(/janko-detached-dot/g) ?? []).length, symbol.dots, 'one circle per dot');
});

// ---------------------------------------------------------------------------
// E. The open-oval family and the ownership census
// ---------------------------------------------------------------------------

test('E. Card 4: three distinguishable shapes, no three-mark stack, both mounts alike', () => {
  const run = cardRun('round47-detached-ovals');
  const m = midpointMetrics(run.tokens, 0.95);
  const narrow = openOvalShape('oval-narrow', 'carrier', m, run.tokens);
  const broad = openOvalShape('oval-broad', 'carrier', m, run.tokens);
  const breve = openOvalShape('oval-breve', 'carrier', m, run.tokens);
  assert.ok(narrow.rx < broad.rx * 0.75, 'the 96 oval is measurably narrower than the whole-value oval');
  assert.ok(narrow.tilt !== 0, 'and it is tilted');
  assert.equal(broad.tilt, 0, 'the whole-value oval is horizontal');
  assert.equal(breve.tilt, 0);
  assert.equal(broad.rx, breve.rx, 'the breve is the whole-value oval, not a third size');
  assert.equal(narrow.ry, broad.ry, 'one height for the family');
  assert.ok(broad.rx > broad.ry, 'the broad oval is horizontal (wider than tall)');
  assert.equal(narrow.flanks, false);
  assert.equal(breve.flanks, true, 'and only the breve carries its flank strokes');
  assert.ok(breve.flankOffset > breve.rx, 'the flanks stand clear of the oval, not on it');
  // The mapping is exact and total: 96 / 192 / 384, and nothing else.
  assert.equal(longMarkKindForBase(96, 'open-oval'), 'oval-narrow');
  assert.equal(longMarkKindForBase(192, 'open-oval'), 'oval-broad');
  assert.equal(longMarkKindForBase(384, 'open-oval'), 'oval-breve');
  assert.equal(longMarkKindForBase(48, 'open-oval'), null);
  // Painted on both mounts with one vocabulary, and no run ever stacks three.
  const svg = run.layouts.map((l) => renderSystem(BRAHMS, l.geometry, l.index, run.options, run.tokens, l)).join('\n');
  assert.ok(svg.includes('data-open-oval="oval-narrow"'), 'the 96 shape paints on the bracket spine');
  assert.ok(/janko-clasp-compact-ring"[^>]*data-open-oval="oval-broad"/.test(svg), 'and on the bracket for 192');
  assert.ok(svg.includes('data-open-oval="oval-breve"'), 'the breve paints too');
  assert.ok(svg.includes('janko-detached-mark" data-open-oval='), 'and the same shapes on the detached seats');
  assert.equal(
    (svg.match(/data-open-oval-flank=/g) ?? []).length,
    2 * (svg.match(/data-open-oval="oval-breve"/g) ?? []).length,
    'every breve carries exactly two flanks'
  );
  for (const owner of run.layouts.flatMap((l) => l.durationInkOwners)) {
    assert.ok(
      ['oval-narrow', 'oval-broad', 'oval-breve'].includes(owner.run),
      `the oval family states only its three shapes (saw ${owner.run})`
    );
  }
  assert.ok(!/'two-rings'|'ring'|'half-ring'/.test(JSON.stringify(run.layouts.flatMap((l) => l.durationInkOwners))), 'no ring run survives in this family');
});

test('E. Ownership census: no orphan, no suppressed owner, no unknown owner — every card', () => {
  for (const candidate of CURRENT_CANDIDATES) {
    const run = cardRun(candidate.id);
    for (const layout of run.layouts) {
      const suppressed = new Set(layout.tieOriginSuppressions.map((s) => s.noteId));
      const painted = new Set(layout.notes.map((p) => p.note.id));
      assert.ok(
        layout.durationInkOwners.every((owner) => owner.ownerIds.length > 0),
        `${candidate.id}: every painted mark names an owner`
      );
      for (const owner of layout.durationInkOwners) {
        assert.ok(
          owner.ownerIds.some((id) => !suppressed.has(id)),
          `${candidate.id}: no mark states only suppressed origins`
        );
        for (const id of owner.ownerIds) {
          assert.ok(painted.has(id), `${candidate.id}: ${id} is laid out where its mark is painted`);
        }
      }
      // No member's value is stated twice: one long mark per (owner, run).
      const seen = new Set<string>();
      for (const owner of layout.durationInkOwners) {
        for (const id of owner.ownerIds) {
          const key = `${id}|${owner.run}`;
          assert.ok(!seen.has(key), `${candidate.id}: ${key} is stated twice`);
          seen.add(key);
        }
      }
      // And the converse: an omitted origin never leaves a mark behind.
      for (const id of suppressed) {
        assert.ok(
          !layout.durationInkOwners.some((owner) => owner.ownerIds.length === 1 && owner.ownerIds[0] === id),
          `${candidate.id}: ${id} has no orphaned mark of its own`
        );
      }
    }
  }
});

test('E. Every card lints clean on the whole Brahms score and renders every declared window', () => {
  const windows = [1, 7, 33, 61, 64, 67].map((start) => [start, start === 33 || start === 67 ? 1 : 3]);
  for (const candidate of CURRENT_CANDIDATES) {
    const run = cardRun(candidate.id);
    const report = lintJankoScore(BRAHMS, run.options, run.tokens);
    assert.deepEqual(report.violations, [], `${candidate.id}: zero violations`);
    assert.deepEqual(report.warnings, [], `${candidate.id}: zero warnings (nothing suppressed)`);
    assert.deepEqual(
      report.diagnostics.filter((d) => d.code.startsWith('duration-mark') || d.code.startsWith('symbol-seat')),
      [],
      `${candidate.id}: the ownership and seat checks report nothing`
    );
    for (const [start, count] of windows) {
      const svg = renderJankoCrop(BRAHMS, start, count, run.options, run.tokens);
      assert.ok(svg.includes('<svg'), `${candidate.id}: mm. ${start}–${start + count - 1} renders`);
    }
  }
});

test('E. The round registry is coherent: one window set, one shared rule, three axes', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 47);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['halfRingGap', 'exceptionCarrier', 'longDurationStyle']);
  assert.equal(CURRENT_CANDIDATES.length, 4, 'exactly four cards');
  for (const id of [
    'round47-mounted-control',
    'round47-half-ring-cutout',
    'round47-detached-symbols',
    'round47-detached-ovals',
  ]) {
    const candidate = getCandidate(id)!;
    assert.ok(candidate, `${id} is registered`);
    assert.equal(candidate.options?.tieOriginIndicator, 'omit-outgoing', `${id}: the shared rule`);
    assert.deepEqual(
      (candidate.windows ?? []).map((w) => [
        (w as { measureStart: number }).measureStart,
        (w as { measureCount: number }).measureCount,
      ]),
      [
        [1, 3],
        [7, 3],
        [33, 1],
        [61, 3],
        [64, 3],
        [67, 1],
      ],
      `${id}: the common literal windows`
    );
    assert.ok(
      (candidate.windows ?? []).every((w) => (w as { fullScore?: boolean }).fullScore !== true),
      `${id}: no invented page spread`
    );
  }
});

// ---------------------------------------------------------------------------
// F. Operator-facing claims: the window captions and the round's recipe
// ---------------------------------------------------------------------------

/** The bench's own pitch naming (cf. `brahms-engraving.test.ts`: 4/5 reads E5). */
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const pitchName = (note: QuantizedNote): string =>
  `${PITCH_NAMES[note.pitch.pitchClass]}${note.pitch.octave}`;

/** The tick a measure of the Brahms score opens on (m. 1 opens after the 48-tick pickup). */
const measureTick = (measure: number): number =>
  BRAHMS.barlines.find((bar) => bar.barNumber === measure)!.tick;

/** The measure a tick opens in, under the score's own anacrusis-aware numbering. */
const measureOf = (tick: number): number =>
  BRAHMS.barlines.filter((bar) => bar.type !== 'final' && bar.tick <= tick).length;

/** The caption of one declared Round 47 window. */
function windowCaption(measureStart: number): string {
  const window = (CURRENT_CANDIDATES[0].windows ?? []).find(
    (w) => (w as { measureStart: number }).measureStart === measureStart
  ) as { caption?: string } | undefined;
  assert.ok(window, `the registry declares the m. ${measureStart} window`);
  return window!.caption ?? '';
}

test('F. The mm. 1–3 caption names the window’s own 192-tick exceptions', () => {
  const open = measureTick(1);
  const end = measureTick(4);
  // The caption's own rule: the long (192-tick) exception members of the window.
  const exceptions = BRAHMS.notes.filter(
    (n) => n.startTick >= open && n.startTick < end && n.durationTicks === 192
  );
  assert.deepEqual(
    [...new Set(exceptions.map((n) => `${pitchName(n)} @${n.startTick}`))].sort(),
    ['C5 @432', 'E5 @48'],
    'the window holds exactly two 192-tick exceptions — E5 at m. 1 and C5 at m. 3, never F4/D4'
  );
  const caption = windowCaption(1);
  assert.ok(caption.includes('E5 at m. 1'), 'the caption names the m. 1 exception as E5');
  assert.ok(caption.includes('C5 at m. 3'), 'and the m. 3 exception as C5');
  assert.ok(!caption.includes('D4') && !caption.includes('F4'), 'the caption names neither D4 nor F4 as a 192-tick exception');
});

test('F. The m. 67 cue states the real pitch and measure of the breve values', () => {
  const cue = BRAHMS.notes.filter(
    (n) =>
      n.durationTicks === 384 &&
      n.startTick >= measureTick(67) &&
      n.startTick < measureTick(68)
  );
  const elsewhere = BRAHMS.notes.filter((n) => n.durationTicks === 384 && !cue.includes(n));
  assert.deepEqual(cue.map(pitchName), ['F4'], 'the literal m. 67 breve is F4 (pc5 o4), not F3');
  assert.deepEqual(
    [...new Set(elsewhere.map((n) => measureOf(n.startTick)))],
    [69],
    'the score’s other breve values open in m. 69 (their written tie carrying them through m. 70)'
  );
  assert.deepEqual(
    [...new Set(elsewhere.map(pitchName))].sort(),
    ['C#4', 'E3', 'E4'],
    'and they are the three-note m. 69 chord'
  );
  const caption = windowCaption(67);
  assert.ok(caption.includes('this F4'), 'the cue names the m. 67 breve as F4');
  assert.match(caption, /m\. 69 chord/, 'and places the second breve in m. 69');
  assert.ok(!/m\. 70 chord/.test(caption), 'never m. 70 (that is its tied continuation)');
});

test('F. The round doc teaches the forward-safe strict invocation', () => {
  const doc = readFileSync(new URL('../docs/round47-long-value-symbols.md', import.meta.url), 'utf-8');
  // The executable recipe (the fenced block with the three canonical commands)
  // must use the `--` separator; npm parses a bare `--strict` after the script
  // name as its own config and never hands it to `scripts/lint_engraving.ts`.
  const recipe = (doc.match(/```[\s\S]*?```/g) ?? [])
    .map((block) => block.replace(/```/g, ''))
    .find((block) => block.includes('npm test'));
  assert.ok(recipe, 'the doc carries its canonical verification recipe');
  assert.match(recipe!, /npm run lint:engraving -- --strict/, 'the strict gate forwards its flag');
  assert.ok(
    !recipe!.includes('npm run lint:engraving --strict'),
    'the swallowed bare form is never part of the recipe'
  );
});
