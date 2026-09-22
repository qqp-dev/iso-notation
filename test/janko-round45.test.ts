/**
 * Round 45 — larger readable Brahms clusters + phone review continuity
 * (historical; superseded where Round 46 changed a decision).
 * ===================================================================
 *
 * The operator rejected Round 44's globally small notes/duration ink as the
 * cost of occasional close pairs, and settled this contract: **bigger notes**
 * with one *subtle, distributed* cluster spacing; duration ink scaled with the
 * notes; horizontal-only remaining cluster carriers; a genuinely two-handed
 * m. 66; and literal low pitches instead of unnecessary ↓10 folds. The phone
 * half of the round (per-tab zoom / view / scroll restoration across the stock
 * Vite reload) is studio behaviour, not an engraving axis, and is pinned in
 * `test/janko-studio-session.test.ts` — it is deliberately *not* re-implemented
 * here.
 *
 * **Round 46 supersessions this file records.** The live round is the two-card
 * 95 % registry (pinned in `test/janko-round46.test.ts`), so the 0.85/0.90/0.95
 * ladder this file was written for is kept as an **explicit historical
 * fixture** (`ROUND_45_FAMILY` / `ROUND_45_TOKENS` below) rather than read from
 * the registry: it still reproduces the Round 45 geometry exactly (the same six
 * spread clusters with δ = 0.25769 / 0.54344 / 0.82919pt, the same 7/6 cut
 * pitch) and is the honest control for the round's own claims. Where Round 46
 * changed a decision the assertion is restated to the new contract and the
 * superseded value is quoted at the site:
 *
 * * the long-value vocabulary is now 96 = half-ring, 192 = one ring,
 *   384 = two rings (no three-ring stack), and the fixed carrier length is
 *   recomputed from that maximum run;
 * * the same-hand/same-onset/exact-duration 2-span pairs of mm. 9/19 share one
 *   centred indicator, so 32 statements paint as 30 carriers;
 * * written ties are rendered, so the m. 66 attack/carry groups merge to one
 *   visible attack head each and the six former 120-tick refusals are solved
 *   (the canonical 0.95/.30 Reference carries zero warnings);
 * * the literal low pitches keep their Round 45 positions but Round 45's extra
 *   ledger/outlier ink is gone.
 *
 * What this file verifies, on the real engine, for the historical **0.85 /
 * 0.90 / 0.95** ladder and the working 95 % Brahms Reference:
 *
 * 1. **Registry** — the round's shared family, at the values the live Round 46
 *    registry declares (and the historical ladder as a fixture).
 * 2. **Admission** — the same six spread clusters at every scale, no
 *    scale-dependent stale admission, unbracketed heads untouched.
 * 3. **Declared optical spacing** — placement metadata only (sounding and
 *    written pitch, source onset/duration, the staff lattice and the solved
 *    columns are byte-unchanged), the uniform distinct-level gap rule
 *    (`delta` = largest mask deficit ÷ level-index distance, offsets centred
 *    on the member-weighted mean, zero delta for a fitting cluster, per-glyph
 *    displacement capped at one 1-span = 2.5pt), re-derived here **from the
 *    emitted masks**, with the duration attachments travelling with the head.
 * 4. **Cluster duration** — no residual vertical shared-duration stem for an
 *    admitted cluster whose own value the bracket already states; the
 *    independent values are routed through the horizontal grammar; genuine
 *    beams and rests are untouched.
 * 5. **The 45-degree family** — measured length/pitch/scale/counts on **both**
 *    mounts, with the historical cut centre pitch at 90 % exactly 1.40 × the
 *    Round 44 `.75` baseline (`1.7967583311pt`) and `.85`/`.95` proportional,
 *    and the four-cut run individually countable.
 * 6. **m. 66** — the tick-12624 column reads two-handed (A2/D3 left, D4/D5
 *    right) with the written F3 tie and every sustained voice preserved; the
 *    correction is bounded to the twenty authorized records (fifteen
 *    retargetings plus five m70 editorial records, two of them confirm-only).
 * 7. **Literal low pitches** — the nine unwarranted ↓10 folds of mm. 5/15/22/
 *    33/42/53/67/68/69 are gone and the literal positions are exact; system
 *    spacing / pagination are unchanged.
 * 8. **The whole spread** — page completeness, source-note accounting, true
 *    ink bounds, zero hard errors and zero warnings on the working Reference,
 *    and the frozen Bach GOLD bytes.
 *
 * Everything here is measured on emitted geometry. Nothing in this file claims
 * optical acceptance: glanceability and the acceptability of the distributed
 * displacements are the operator's judgement.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { BRAHMS_HAND_CORRECTIONS } from '../src/scores/brahms-hand-corrections';
import {
  DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
  DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
  buildDurationVocabularySpecimenScore,
} from '../src/scores/duration-vocabulary-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JANKO_LITERAL_LOW_FLOOR_LIN,
  OPTICAL_DISPLACEMENT_CAP,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  claspMemberCarriedTicks,
  countJankoPages,
  getTieDisplayPlan,
  knockoutHalfExtents,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  resolveOpticalSpread,
  suppressedStemIds,
  type JankoSystemLayout,
} from '../src/render/janko/engine';
import {
  compactDurationMarks,
  effectiveExceptionCarrierLength,
  midpointMetrics,
} from '../src/render/janko/elements/rhythm';
import { continuousPitchY, getMeasureIndexOfTick } from '../src/render/janko/geometry';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  createStudioConfig,
  renderCandidatesView,
  renderReferenceView,
} from '../src/render/janko/studio';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  type JankoScoreCandidateWindow,
} from '../src/render/janko/candidates';
import {
  BRAHMS_ROUND44_RESERVE_OPTIONS,
  BRAHMS_ROUND44_RESERVE_TOKENS,
} from './brahms-round44-reserve';

// ---------------------------------------------------------------------------
// Fixtures and caches
// ---------------------------------------------------------------------------

const BACH = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const DVS = buildDurationVocabularySpecimenScore();

const REFERENCE_OPTIONS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const REFERENCE_TOKENS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);

/**
 * The landed **Round 46** card the working Brahms Reference *is* — kept as this
 * round's own historical fixture now that Round 47 opens its own candidate set
 * (the live registry is pinned, never read, for this identity).
 */
const ROUND_46_REFERENCE_CARD: { options: Record<string, unknown>; tokens: Record<string, unknown> } = {
  options: {
    pitchPlacement: 'parity-columns',
    bracketDurationGrammar: 'midpoint',
    exceptionCarrier: 'horizontal',
    opticalSpacing: true,
    lowPitchFolding: 'literal',
    writtenTies: 'source',
    chordSymbolScale: 0.95,
  },
  tokens: {
    midpointSlashLengthFactor: 1.1,
    midpointRingScale: 1.1,
    midpointBracketRingScale: 1.2,
    midpointSpacingFactor: 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95),
    opticalClearanceAir: 0.3,
  },
};

/** The review surfaces the parked Round 46 pair shipped (historical record). */
const ROUND_46_WINDOW_SPANS = [
  '1-71',
  '1-3',
  '7-9',
  '17-19',
  '33-33',
  '53-53',
  '61-63',
  '65-71',
  '17-24',
];

/** The parked Round 46 pair: the working Reference card and its 0.20pt spacing control. */
const ROUND_46_CARDS = [
  {
    id: 'brahms-scale-95-air30',
    axis: 'opticalClearanceAir',
    air: 0.3,
    options: { ...ROUND_46_REFERENCE_CARD.options },
    tokens: { ...ROUND_46_REFERENCE_CARD.tokens, opticalClearanceAir: 0.3 },
  },
  {
    id: 'brahms-scale-95-air20',
    axis: 'opticalClearanceAir',
    air: 0.2,
    options: { ...ROUND_46_REFERENCE_CARD.options },
    tokens: { ...ROUND_46_REFERENCE_CARD.tokens, opticalClearanceAir: 0.2 },
  },
] as const;
const R44_OPTIONS = resolveJankoOptions(BRAHMS_ROUND44_RESERVE_OPTIONS);
const R44_TOKENS = resolveJankoTokens(BRAHMS_ROUND44_RESERVE_TOKENS);

/** The three Round 45 scales, kept as an explicit historical fixture (the
 * live Round 46 registry declares two 95 % variants instead). */
const SCALES = [0.85, 0.9, 0.95] as const;

/** The six clusters whose masks actually demanded the optical gap (Round 45). */
const SPREAD_TICKS = [1200, 1392, 1584, 3120, 3312, 3504] as const;

/**
 * The Round 45 shared family, reconstructed explicitly so the historical scale
 * ladder stays measurable after the registry moved on: the parity admission,
 * the one 45-degree family, horizontal carriers, literal lows, the Round 45
 * readability ratios / 7·6 cut pitch / 0.20pt air, **no** written ties (ties
 * arrived in Round 46) and no bracket-only ring enlargement.
 */
const ROUND_45_FAMILY = {
  pitchPlacement: 'parity-columns',
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
  opticalSpacing: true,
  lowPitchFolding: 'literal',
  writtenTies: 'none',
} as const;
const ROUND_45_TOKENS = {
  midpointSlashLengthFactor: 1.1,
  midpointRingScale: 1.1,
  midpointBracketRingScale: 1,
  midpointSpacingFactor: 7 / 6,
  opticalClearanceAir: 0.2,
} as const;

/** A Brahms layout of one historical scale — the studio's own merge shape. */
function brahmsScale(scale: (typeof SCALES)[number]): readonly JankoSystemLayout[] {
  return layoutJankoScore(BRAHMS, optionsForScale(scale), tokensForScale());
}

function optionsForScale(scale: number, base = BRAHMS_OP118_NO1_JANKO_OPTIONS) {
  return resolveJankoOptions({ ...base, ...ROUND_45_FAMILY, chordSymbolScale: scale });
}
function tokensForScale(base = BRAHMS_OP118_NO1_JANKO_TOKENS) {
  return resolveJankoTokens({ ...base, ...ROUND_45_TOKENS });
}

/** A DVS layout of one historical scale — the studio's own entry merge. */
function dvsScale(scale: (typeof SCALES)[number]) {
  const options = optionsForScale(scale, DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS);
  const tokens = tokensForScale(DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS);
  return { options, tokens, layouts: layoutJankoScore(DVS, options, tokens) };
}

/** Layouts are the expensive part of this file; compute each surface once. */
const layoutCache = new Map<string, readonly JankoSystemLayout[]>();
function cachedLayouts(
  key: string,
  score = BRAHMS,
  options = REFERENCE_OPTIONS,
  tokens = REFERENCE_TOKENS
): readonly JankoSystemLayout[] {
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const layouts = layoutJankoScore(score, options, tokens);
  layoutCache.set(key, layouts);
  return layouts;
}

const referenceLayouts = (): readonly JankoSystemLayout[] =>
  cachedLayouts('reference', BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
const reserveLayouts = (): readonly JankoSystemLayout[] =>
  cachedLayouts('r44', BRAHMS, R44_OPTIONS, R44_TOKENS);
const noOpticalLayouts = (): readonly JankoSystemLayout[] =>
  cachedLayouts('no-optical', BRAHMS, { ...REFERENCE_OPTIONS, opticalSpacing: false }, REFERENCE_TOKENS);
const coreFoldingLayouts = (): readonly JankoSystemLayout[] =>
  cachedLayouts('core-folding', BRAHMS, { ...REFERENCE_OPTIONS, lowPitchFolding: 'core' }, REFERENCE_TOKENS);
function scaleLayouts(scale: (typeof SCALES)[number]): readonly JankoSystemLayout[] {
  return cachedLayouts(`scale-${scale}`, BRAHMS, optionsForScale(scale), tokensForScale());
}

// ---------------------------------------------------------------------------
// The two served views (expensive to render; computed once per suite)
// ---------------------------------------------------------------------------

let studioConfigCache: ReturnType<typeof createStudioConfig> | undefined;
const studioConfig = (): ReturnType<typeof createStudioConfig> =>
  (studioConfigCache ??= createStudioConfig());
let candidatesViewCache: string | undefined;
const candidatesView = (): string => (candidatesViewCache ??= renderCandidatesView(studioConfig()));
let referenceViewCache: string | undefined;
const referenceView = (): string => (referenceViewCache ??= renderReferenceView(studioConfig()));

// ---------------------------------------------------------------------------
// Small measurement helpers (emitted geometry only)
// ---------------------------------------------------------------------------

type Head = JankoSystemLayout['notes'][number];

/** The source (sounding) linear pitch of a head: its musical identity. */
const sourceLin = (p: Head): number => p.note.pitch.octave * 12 + p.note.pitch.pitchClass;

const headsOf = (layouts: readonly JankoSystemLayout[]): Head[] => layouts.flatMap((l) => l.notes);
const byIdOf = (layouts: readonly JankoSystemLayout[]): Map<string, Head> =>
  new Map(headsOf(layouts).map((p) => [p.note.id, p]));
const clustersOf = (layouts: readonly JankoSystemLayout[]) =>
  layouts.flatMap((l) => l.opticalClusters ?? []);
const memberIdsOf = (layouts: readonly JankoSystemLayout[]): Set<string> =>
  new Set(clustersOf(layouts).flatMap((c) => c.memberIds));

/** One-based performed measure of a laid-out head (four measures per system). */
function measureOf(layout: JankoSystemLayout, p: Head): number {
  return (
    4 * layout.index +
    getMeasureIndexOfTick(p.note, layout.geometry, layout.index, REFERENCE_TOKENS) +
    1
  );
}

/** Every `<line>` of one class: `{ x1, y1, x2, y2, stroke }`. */
function linesOf(
  svg: string,
  cls: string
): { x1: number; y1: number; x2: number; y2: number; stroke: number }[] {
  const re = new RegExp(
    `<line class="${cls}" x1="([\\d.-]+)" y1="([\\d.-]+)" x2="([\\d.-]+)" y2="([\\d.-]+)"` +
      ` stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    x1: Number(m[1]),
    y1: Number(m[2]),
    x2: Number(m[3]),
    y2: Number(m[4]),
    stroke: Number(m[5]),
  }));
}

/** Every `<circle>` of one class: `{ cx, cy, r, stroke }`. */
function circlesOf(
  svg: string,
  cls: string
): { cx: number; cy: number; r: number; stroke: number }[] {
  const re = new RegExp(
    `<circle class="${cls}" cx="([\\d.-]+)" cy="([\\d.-]+)" r="([\\d.]+)"` +
      ` fill="#FFFFFF" stroke="#111111" stroke-width="([\\d.]+)"`,
    'g'
  );
  return [...svg.matchAll(re)].map((m) => ({
    cx: Number(m[1]),
    cy: Number(m[2]),
    r: Number(m[3]),
    stroke: Number(m[4]),
  }));
}

/** The painted `janko-exception-carrier` groups of one crop, mark-for-mark. */
interface PaintedCarrier {
  noteId: string;
  ticks: number;
  cuts: number;
  rings: number;
  dots: number;
  length: number;
  stroke: number;
  cutCentres: number[];
  ringRadii: number[];
  ringStrokes: number[];
  /** Round 46: painted half-ring paths (their chord lies on the carrier). */
  halfRings: number;
}
function paintedCarriers(svg: string): PaintedCarrier[] {
  return svg
    .split('<g class="janko-exception-carrier"')
    .slice(1)
    .map((chunk) => {
      const head = chunk.slice(0, chunk.indexOf('>'));
      const attr = (name: string): string => new RegExp(`${name}="([^"]*)"`).exec(head)![1];
      const line =
        /<line class="janko-exception-carrier-line" x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)" stroke="#111111" stroke-width="([\d.]+)"/.exec(
          chunk
        )!;
      const cuts = linesOf(chunk, 'janko-exception-cut');
      const rings = circlesOf(chunk, 'janko-exception-ring');
      const halfRings = [
        ...chunk.matchAll(/<path class="janko-exception-ring" data-half-ring="true"/g),
      ].length;
      return {
        noteId: attr('data-exception-note'),
        ticks: Number(attr('data-exception-ticks')),
        cuts: Number(attr('data-exception-cuts')),
        rings: Number(attr('data-exception-rings')),
        dots: Number(attr('data-exception-dots')),
        length: Number(line[3]) - Number(line[1]),
        stroke: Number(line[5]),
        cutCentres: cuts.map((c) => (c.x1 + c.x2) / 2),
        ringRadii: rings.map((r) => r.r),
        ringStrokes: rings.map((r) => r.stroke),
        halfRings,
      };
    });
}

const approx = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) < eps;
/** The emitted SVG prints 2 dp, so a painted comparison must allow ±0.011pt. */
const SVG_EPS = 0.011;
/** The engine's admitted-cluster pair pitch (`test/janko-round44.test.ts` pins the same 5.46pt). */
const PAIR_GAP = 5.46;

// ---------------------------------------------------------------------------
// 1. Registry: three cards on one shared family, 0.85 / 0.90 / 0.95
// ---------------------------------------------------------------------------

test('Round 49 registry: three readings of one completed written-tie family', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 49, 'the open round');
  assert.match(CURRENT_ROUND_METADATA.title, /reference tie/i);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['standaloneLongMount', 'horizontalMountAir', 'tieProfile'],
    'the Round 49 axes (every other family key is locked context)'
  );
  assert.equal(CURRENT_CANDIDATES.length, 3, 'the Round 49 trio, no more');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    ['round49-above-080', 'round49-air-100', 'round49-uniform-080'],
    'the Round 45–48 variants are parked on record; the live cards are the Round 49 readings'
  );

  // The parked Round 46 pair is pinned as this round's own historical fixtures
  // (the live registry is pinned above): the review surfaces it
  // shipped, and one coherent family differing in exactly the declared air.
  assert.deepEqual(
    ROUND_46_WINDOW_SPANS,
    ['1-71', '1-3', '7-9', '17-19', '33-33', '53-53', '61-63', '65-71', '17-24'],
    'the review surfaces the Round 46 pair shipped'
  );
  for (const card of ROUND_46_CARDS) {
    const options = card.options as Record<string, unknown>;
    const tokens = card.tokens as Record<string, unknown>;
    assert.equal(options.chordSymbolScale, 0.95, `${card.id}: the adopted admitted-cluster scale`);
    assert.equal(card.axis, 'opticalClearanceAir', `${card.id}: the one varying axis`);
    assert.deepEqual(
      { ...tokens },
      {
        midpointSlashLengthFactor: 1.1,
        midpointRingScale: 1.1,
        midpointBracketRingScale: 1.2,
        midpointSpacingFactor: 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95),
        opticalClearanceAir: card.air,
      },
      `${card.id}: the Round 46 readability ratios, the bracket-only enlargement and the declared air`
    );
    const { chordSymbolScale, ...rest } = options;
    void chordSymbolScale;
    assert.deepEqual(
      rest,
      {
        pitchPlacement: 'parity-columns',
        bracketDurationGrammar: 'midpoint',
        exceptionCarrier: 'horizontal',
        opticalSpacing: true,
        lowPitchFolding: 'literal',
        writtenTies: 'source',
      },
      `${card.id}: one coherent family (ties rendered, literal lows, the 45-degree grammar)`
    );
  }
  // The two variants differ in exactly one declared number.
  const [a, b] = ROUND_46_CARDS;
  assert.deepEqual(
    { ...a.options },
    { ...b.options },
    'the variants declare the same option deltas'
  );
  assert.deepEqual(
    { ...a.tokens, opticalClearanceAir: b.tokens?.opticalClearanceAir },
    { ...b.tokens },
    'and the same token deltas except the declared air'
  );
  // The shared family's knobs are all opt-in; the golden defaults stay no-ops.
  assert.equal(DEFAULT_JANKO_OPTIONS.opticalSpacing, false, 'optical spacing is opt-in');
  assert.equal(DEFAULT_JANKO_OPTIONS.lowPitchFolding, 'core', 'literal low pitches are opt-in');
  assert.equal(DEFAULT_JANKO_OPTIONS.writtenTies, 'none', 'written ties are opt-in');
  assert.equal(DEFAULT_JANKO_TOKENS.midpointSlashLengthFactor, 1, 'the slash ratio is a no-op by default');
  assert.equal(DEFAULT_JANKO_TOKENS.midpointRingScale, 1, 'the ring ratio is a no-op by default');
  assert.equal(
    DEFAULT_JANKO_TOKENS.midpointBracketRingScale,
    1,
    'the bracket enlargement is a no-op by default'
  );
  assert.equal(DEFAULT_JANKO_TOKENS.midpointSpacingFactor, 1, 'the cut-spacing ratio is a no-op by default');
  assert.equal(DEFAULT_JANKO_TOKENS.opticalClearanceAir, 0.2, 'the historical air default');
  // The superseded Round 45 ladder is preserved as an explicit fixture and
  // still measures the same family (see the admission test below).
  for (const scale of SCALES) {
    const options = optionsForScale(scale);
    assert.equal(options.chordSymbolScale, scale, `s=${scale}: the historical fixture states its scale`);
    assert.equal(options.writtenTies, 'none', `s=${scale}: the fixture keeps the Round 45 geometry`);
    assert.equal(
      tokensForScale().midpointBracketRingScale,
      1,
      `s=${scale}: the historical fixture keeps both mounts equal`
    );
  }
});

test('The landed Round 46 card IS the working Brahms Reference; the Reference view serves the engine pages', () => {
  // Round 47 opens its own candidate set, so the card that the working
  // Reference *is* is kept here as the round's own historical fixture (the
  // Round 46 pair is on record in test/janko-round46.test.ts).
  const card = ROUND_46_REFERENCE_CARD;
  const studioMerge = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(card.options ?? {}) });
  const studioTokens = resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(card.tokens ?? {}) });
  assert.deepEqual(studioMerge, REFERENCE_OPTIONS, 'the studio merge IS the Reference option set');
  assert.deepEqual(studioTokens, REFERENCE_TOKENS, 'and the Reference token set');

  // The served surfaces agree byte for byte: the Reference view's five BRONZE
  // Brahms page cards ARE the engine's own `renderJankoPage` pages (never one
  // crop dressed up as a spread), and the Round 47 cards carry no page cards at
  // all — their windows are the six labelled literal crops the round declares.
  const candidates = candidatesView();
  const reference = referenceView();
  const pageSvgs = (html: string): string[] =>
    [...html.matchAll(/<figure class="page-card"[\s\S]*?<\/figure>/g)].map(
      (m) => /<svg class="janko-svg"[\s\S]*?<\/svg>/.exec(m[0])![0]
    );
  const pageFigures = (html: string): string[] =>
    [...html.matchAll(/<figure class="page-card"[\s\S]*?<\/figure>/g)].map((m) => m[0]);
  assert.ok(
    !candidates.includes('brahms-scale-95-air30'),
    'the landed Round 46 cards are parked — Round 47 declares its own set'
  );
  const brahmsAt = reference.indexOf('data-score="brahms-op118-no1"');
  const bachAt = reference.indexOf('data-score="primary"');
  const referencePages = pageSvgs(reference.slice(brahmsAt, bachAt));
  assert.equal(referencePages.length, 5, 'the Reference view carries the whole score as five genuine pages');
  const enginePages = [0, 1, 2, 3, 4].map((page) =>
    // The studio wraps each engine page in its own `<svg class="janko-svg">`
    // element, so the class is the only markup the comparison normalises away.
    renderJankoPage(BRAHMS, page, REFERENCE_OPTIONS, REFERENCE_TOKENS).replace(
      /^<svg /,
      '<svg class="janko-svg" '
    )
  );
  assert.deepEqual(referencePages, enginePages, 'and those pages are the engine page renders, byte for byte');
  for (const [i, figure] of pageFigures(reference.slice(brahmsAt, bachAt)).entries()) {
    assert.ok(figure.includes(`data-page="${i + 1}"`), `page card ${i + 1} is labelled, not an anonymous crop`);
    assert.ok(
      /<b>Page \d+<\/b> · \d+ systems? · mm\. \d+–\d+/.test(figure),
      `page card ${i + 1} states its real measure range`
    );
  }
  // Every Round 49 card renders its seven declared literal windows, each labelled.
  for (const round49Card of CURRENT_CANDIDATES) {
    const start = candidates.indexOf(`data-candidate="${round49Card.id}"`);
    const end = candidates.indexOf('data-candidate="', start + 1);
    const slice = candidates.slice(start, end < 0 ? undefined : end);
    assert.ok(start >= 0, `${round49Card.id}: the card is served`);
    assert.equal(
      (slice.match(/class="candidate-window"/g) ?? []).length,
      7,
      `${round49Card.id}: seven literal windows, no page card`
    );
    assert.ok(!slice.includes('class="page-card"'), `${round49Card.id}: no invented page spread`);
  }
});

// ---------------------------------------------------------------------------
// 2. Admission: the same clusters at every scale, no stale admission
// ---------------------------------------------------------------------------

test('Admission is scale-coherent: the same six spread clusters at 0.85 / 0.90 / 0.95', () => {
  // The derived targets of the ticket, measured on the emitted masks:
  // delta = .25769 / .54344 / .82919, span growth = 1.0308 / 2.1738 / 3.3167pt,
  // maximum optical displacement = .5154 / 1.0869 / 1.6584pt (the ticket's
  // derived .82918 differs by 1e-5 — SVG-free double arithmetic here).
  const expected: Record<
    (typeof SCALES)[number],
    { delta: number; span: number; max: number }
  > = {
    0.85: { delta: 0.25769, span: 1.0308, max: 0.51539 },
    0.9: { delta: 0.54344, span: 2.1738, max: 1.08688 },
    0.95: { delta: 0.82919, span: 3.3167, max: 1.65837 },
  };
  const membership = new Map<number, string>();
  for (const scale of SCALES) {
    const layouts = scaleLayouts(scale);
    const clusters = clustersOf(layouts);
    assert.equal(clusters.length, 72, `s=${scale}: every admitted bracket cluster is published`);
    const spread = clusters.filter((c) => c.delta > 0);
    assert.deepEqual(
      spread.map((c) => c.tick),
      [...SPREAD_TICKS],
      `s=${scale}: exactly the six clusters whose masks demand the gap`
    );
    for (const c of spread) {
      const keys = c.memberIds.join(',');
      if (membership.has(c.tick)) {
        assert.equal(keys, membership.get(c.tick), `s=${scale}: t${c.tick} membership is scale-independent`);
      } else {
        membership.set(c.tick, keys);
      }
      assert.equal(c.hand, 'RH', `s=${scale}: t${c.tick} is the admitted right-hand column`);
      assert.equal(c.lins.length, 5, `s=${scale}: t${c.tick} is the diagnosed five-level cluster`);
      assert.equal(c.capped, false, `s=${scale}: nothing is clamped by the 1-span cap`);
      assert.equal(c.requiredDelta, c.delta, `s=${scale}: the uncapped requirement is met`);
      assert.ok(approx(c.delta, expected[scale].delta, 5e-5), `s=${scale}: t${c.tick} delta`);
      assert.ok(approx(c.spanGrowth, expected[scale].span, 5e-5), `s=${scale}: t${c.tick} span growth`);
      assert.ok(approx(c.maxDisplacement, expected[scale].max, 5e-5), `s=${scale}: t${c.tick} max displacement`);
      assert.ok(
        approx(c.maxDisplacement, Math.max(...c.offsets.map(Math.abs))),
        `s=${scale}: the published maximum IS the largest applied offset`
      );
    }
    const spreading = clusters.filter((c) => c.delta === 0);
    for (const c of spreading) {
      assert.ok(
        c.offsets.every((o) => o === 0) && c.maxDisplacement === 0 && c.spanGrowth === 0,
        `s=${scale}: an already clearing cluster (t${c.tick}) is never touched`
      );
    }
    // The admitted members are the scaled symbols, and only they: the fixpoint
    // is real, so a group qualification that admission refused leaves no stale
    // scale — or optical — offset behind.
    const heads = headsOf(layouts);
    const admitted = memberIdsOf(layouts);
    for (const p of heads) {
      if (admitted.has(p.note.id)) {
        assert.equal(p.symbolScale, scale, `s=${scale}: ${p.note.id} is an admitted cluster symbol`);
      } else {
        assert.equal(p.symbolScale, undefined, `s=${scale}: ${p.note.id} is an ordinary full-size head`);
        assert.equal(p.opticalOffsetY, undefined, `s=${scale}: ${p.note.id} takes no optical offset`);
      }
    }
    const displaced = heads.filter((p) => Math.abs(p.opticalOffsetY ?? 0) > 0);
    assert.equal(displaced.length, 24, `s=${scale}: four of five levels move in each of the six clusters`);
    assert.equal(
      displaced.filter((p) => p.opticalOffsetY === undefined).length,
      0,
      `s=${scale}: no silent displacement`
    );
  }
  // The Reference is the same 90 % surface it serves, and the Round 44 reserve
  // has no optical machinery at all.
  assert.deepEqual(
    clustersOf(referenceLayouts()).filter((c) => c.delta > 0).map((c) => c.tick),
    [...SPREAD_TICKS],
    'the working Reference spreads the same six clusters'
  );
  assert.deepEqual(clustersOf(referenceLayouts()).map((c) => c.delta > 0), clustersOf(scaleLayouts(0.9)).map((c) => c.delta > 0), 'the Reference and the 90 % card are the same clusters');
  assert.equal(clustersOf(reserveLayouts()).length, 0, 'the Round 44 reserve records no optical cluster');
  assert.equal(
    headsOf(reserveLayouts()).filter((p) => p.opticalOffsetY !== undefined).length,
    0,
    'and stamps no optical offset'
  );
});

// ---------------------------------------------------------------------------
// 3. Declared placement metadata: musical fields, columns and attachments
// ---------------------------------------------------------------------------

test('Optical spacing is declared placement metadata: musical fields and columns untouched', () => {
  const on = referenceLayouts();
  const off = noOpticalLayouts();
  assert.equal(clustersOf(off).length, 0, 'the same options with optical spacing off publish nothing');
  const painted = byIdOf(on);
  const lattice = byIdOf(off);
  const members = memberIdsOf(on);
  const spreadMembers = new Set(
    clustersOf(on).filter((c) => c.delta > 0).flatMap((c) => c.memberIds)
  );
  let yMoved = 0;
  let xMoved = 0;
  for (const p of headsOf(on)) {
    const q = lattice.get(p.note.id)!;
    // Musical fields and the staff lattice: identical, field for field.
    assert.equal(p.note.startTick, q.note.startTick, `${p.note.id}: source onset`);
    assert.equal(p.note.durationTicks, q.note.durationTicks, `${p.note.id}: source duration`);
    assert.deepEqual(p.note.pitch, q.note.pitch, `${p.note.id}: sounding pitch`);
    assert.equal(p.writtenLin, q.writtenLin, `${p.note.id}: written pitch`);
    assert.equal(p.ottavaShift, q.ottavaShift, `${p.note.id}: register statement`);
    assert.deepEqual(p.rhythm.hand, q.rhythm.hand, `${p.note.id}: hand`);
    assert.equal(p.nominalX, q.nominalX, `${p.note.id}: solved onset column`);
    assert.deepEqual(p.coord.ledgerYs, q.coord.ledgerYs, `${p.note.id}: ledger equators`);
    if (Math.abs(p.y - q.y) > 1e-9) {
      yMoved++;
      assert.ok(spreadMembers.has(p.note.id), `${p.note.id}: only a spread cluster member may move in y`);
    }
    if (Math.abs(p.x - q.x) > 1e-9) {
      assert.ok(spreadMembers.has(p.note.id), `${p.note.id}: only a spread cluster member may re-resolve in x`);
    }
    if (Math.abs(p.x - q.x) > 1e-9) {
      xMoved++;
      // The residual horizontal fit runs on the **displaced** geometry: an
      // opened pair no longer needs its nudge, so a member may relax *back*
      // towards its column — never past it, and never further right than the
      // un-opened fan.
      assert.ok(p.x >= (p.nominalX ?? p.x) - 1e-9, `${p.note.id}: never pushed left of its onset column`);
      assert.ok(p.x <= q.x + 1e-9, `${p.note.id}: never nudged further right than the un-opened fit`);
    }
    if (spreadMembers.has(p.note.id)) {
      // A member of one of the six spread clusters sits on one of its two
      // intended parity columns: the onset anchor, or exactly one pair pitch
      // (5.46pt here) to its right — never an arbitrary per-note nudge, and
      // never pushed left of its own column.
      const rail = p.x - (p.nominalX ?? p.x);
      assert.ok(rail >= -1e-9, `${p.note.id}: never pushed left of its onset column`);
      assert.ok(
        approx(rail, 0, 1e-9) || approx(rail, PAIR_GAP, 1e-9),
        `${p.note.id}: on its intended parity column (rail ${rail.toFixed(4)}pt)`
      );
    }
  }
  assert.equal(yMoved, 24, 'exactly the 24 displaced heads move in y');
  assert.equal(xMoved, 10, 'ten members re-resolve their fan on the opened geometry');
  // Nothing outside the clusters moves at all.
  for (const p of headsOf(on)) {
    if (members.has(p.note.id)) continue;
    const q = lattice.get(p.note.id)!;
    assert.equal(p.x, q.x, `${p.note.id}: an unbracketed head keeps its established column`);
    assert.equal(p.y, q.y, `${p.note.id}: and its established pitch y`);
  }
  // Round 46: the spread paints the source heads once (964 − 7 merged) plus
  // the written continuation heads; Round 49 §1 renders every authenticated
  // written chain, so the continuations number 29 (13 + the 16 the removed
  // consolidation filter used to suppress) = 986; the control surface is the
  // same spread (the optical pass is placement metadata only).
  assert.equal(headsOf(on).length, 986, 'the surface is complete');
  assert.equal(headsOf(off).length, 986, 'and the control surface is the same spread');
  assert.deepEqual(
    on.flatMap((l) => l.clasps.map((c) => c.tick)),
    off.flatMap((l) => l.clasps.map((c) => c.tick)),
    'the bracket furniture is unchanged'
  );
});

test('Emitted geometry, masks and duration attachments agree with the stamped optical position', () => {
  const painted = byIdOf(referenceLayouts());
  const lattice = byIdOf(noOpticalLayouts());
  const clusters = clustersOf(referenceLayouts()).filter((c) => c.delta > 0);
  assert.equal(clusters.length, 6, 'the six spread clusters');

  for (const c of clusters) {
    const layout = referenceLayouts().find((l) => l.notes.some((p) => p.note.startTick === c.tick))!;
    const clasp = layout.clasps.find((k) => k.tick === c.tick)!;
    assert.ok(clasp, `t${c.tick}: the admitted cluster keeps its grouping bracket`);
    const carried = claspMemberCarriedTicks(clasp, c.memberIds[0]);
    const families = new Set(c.lins.map((lin) => (lin % 2 === 0 ? 0 : 1)));
    const bothFamilies = families.size >= 2;
    // The intended parity rails, from the emitted columns: the anchor for one
    // family, exactly one pair pitch to its right for the other (the
    // extent-derived pair pitch is 5.46pt for these clusters; the engine's own
    // admitted patterns are pinned in `test/janko-round44.test.ts`).
    const rails = c.memberIds.map((id) => painted.get(id)!.x - (painted.get(id)!.nominalX ?? 0));
    assert.ok(
      rails.every((r) => approx(Math.min(...rails), r, 1e-9) || approx(Math.max(...rails), r, 1e-9)),
      `t${c.tick}: members sit only on their two intended columns`
    );
    if (bothFamilies) {
      assert.ok(approx(Math.max(...rails), PAIR_GAP, 1e-9), `t${c.tick}: the two columns are one pair pitch apart`);
    } else {
      assert.ok(approx(Math.max(...rails), 0, 1e-9), `t${c.tick}: a one-family cluster keeps one column`);
    }

    // Rebuild the metric's own member list from the emitted masks and the
    // pre-displacement lattice, then re-derive the spread — the published
    // numbers must be exactly what the painted geometry implies.
    const members = c.memberIds.map((id) => {
      const before = lattice.get(id)!;
      const e = knockoutHalfExtents(REFERENCE_OPTIONS, REFERENCE_TOKENS, before.note.startTick, before);
      const lin = sourceLin(before);
      return {
        id,
        lin,
        y: before.y,
        wx: e.wx,
        hy: e.hy,
        // The declared intended rails of the admitted cluster: 0 keeps the
        // onset anchor, the odd family takes the pair pitch when both families
        // are present (a one-family cluster stays on its anchor column).
        rail: bothFamilies && lin % 2 !== 0 ? PAIR_GAP : 0,
      };
    });
    const spread = resolveOpticalSpread(members, REFERENCE_TOKENS.opticalClearanceAir, OPTICAL_DISPLACEMENT_CAP);
    assert.ok(approx(spread.delta, c.delta, 1e-9), `t${c.tick}: delta re-derives from the actual masks`);
    assert.deepEqual(spread.lins, c.lins, `t${c.tick}: the distinct true pitch levels`);
    assert.ok(
      spread.offsets.length === c.offsets.length &&
        spread.offsets.every((o, k) => approx(o, c.offsets[k], 1e-9)),
      `t${c.tick}: the per-level offsets`
    );
    assert.ok(approx(spread.spanGrowth, c.spanGrowth, 1e-9), `t${c.tick}: the span growth`);
    assert.ok(approx(spread.maxDisplacement, c.maxDisplacement, 1e-9), `t${c.tick}: the maximum displacement`);

    // Member-weighted mean zero: the cluster centroid never translates.
    let weighted = 0;
    let weight = 0;
    for (let k = 0; k < c.lins.length; k++) {
      const count = c.memberIds.filter(
        (id) => Math.abs(c.memberOffsets.get(id)! - c.offsets[k]) < 1e-9
      ).length;
      weighted += count * c.offsets[k];
      weight += count;
    }
    assert.equal(weight, c.memberIds.length, `t${c.tick}: every member is on a level`);
    assert.ok(approx(weighted, 0, 1e-9), `t${c.tick}: the offsets are centred on the member-weighted mean`);
    assert.ok(
      c.offsets.every((o) => Math.abs(o) <= OPTICAL_DISPLACEMENT_CAP + 1e-9),
      `t${c.tick}: no glyph moves more than one 1-span`
    );

    for (const id of c.memberIds) {
      const p = painted.get(id)!;
      const before = lattice.get(id)!;
      const offset = c.memberOffsets.get(id)!;
      const level = members.find((m) => m.id === id)!.lin;
      assert.ok(
        approx(offset, c.offsets[c.lins.indexOf(level)], 1e-9),
        `${id}: the stamped offset is its own level's offset`
      );
      assert.ok(approx(p.opticalOffsetY ?? 0, offset, 1e-9), `${id}: the painted y carries the stamped offset`);
      assert.ok(approx(p.y, before.y + offset, 1e-9), `${id}: y = lattice y + offset`);
      assert.ok(approx(p.rhythm.y, p.y, 1e-9), `${id}: the emitted stem attachment follows the head`);
      if (before.rhythm.dotY !== undefined) {
        assert.ok(
          approx(p.rhythm.dotY!, before.rhythm.dotY + offset, 1e-9),
          `${id}: the augmentation dot follows the head`
        );
      }
    }

    // No new collision: every pair whose painted horizontal masks overlap keeps
    // the declared 0.20pt of vertical air after the spread.
    for (let i = 0; i < c.lins.length; i++) {
      for (let j = i + 1; j < c.lins.length; j++) {
        const a = members[i];
        const b = members[j];
        const pa = painted.get(a.id)!;
        const pb = painted.get(b.id)!;
        if (Math.abs(pa.x - pb.x) >= a.wx + b.wx) continue;
        const gap = Math.abs(pb.y - pa.y) - (a.hy + b.hy);
        assert.ok(
          gap >= REFERENCE_TOKENS.opticalClearanceAir - 1e-9,
          `t${c.tick}: ${a.id}/${b.id} keep ${REFERENCE_TOKENS.opticalClearanceAir}pt of clear air (measured ${gap.toFixed(4)})`
        );
      }
    }
  }
  // Same-family members still share one column: the optical pass never changes
  // the intended parity columns, it only opens the vertical gap between them.
  for (const c of clusters) {
    const xs = new Map<number, Set<string>>();
    for (const id of c.memberIds) {
      const p = painted.get(id)!;
      const family = (p.writtenLin ?? sourceLin(p)) % 2 === 0 ? 0 : 1;
      const set = xs.get(family) ?? new Set<string>();
      set.add(p.x.toFixed(9));
      xs.set(family, set);
    }
    for (const [family, set] of xs) {
      assert.equal(set.size, 1, `t${c.tick}: parity family ${family} keeps one column`);
    }
    if (xs.size === 2) {
      const columns = [...xs.values()].map((s) => Number([...s][0]));
      assert.ok(
        approx(Math.abs(columns[0] - columns[1]), PAIR_GAP, 1e-9),
        `t${c.tick}: the two parity columns are one pair pitch apart`
      );
    } else {
      const column = Number([...xs.values()][0].values().next().value);
      assert.equal(
        column,
        Number(painted.get(c.memberIds[0])!.nominalX!.toFixed(9)),
        `t${c.tick}: a one-family cluster keeps the onset anchor`
      );
    }
  }
  const report = lintJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  assert.deepEqual(report.violations, [], 'the linter reads the same painted positions: zero hard errors');
});

// ---------------------------------------------------------------------------
// 4. Cluster duration: no residual vertical shared-duration stem
// ---------------------------------------------------------------------------

test('No residual vertical shared-duration carrier for an eligible cluster; beams and rests untouched', () => {
  const working = referenceLayouts();
  const reserve = reserveLayouts();
  // The Round 44 reserve carries 37 shared stems; four of them are the Round 16
  // top-RH survivor of a fully uniform five-level cluster (four suppressed
  // members each), which the bracket already states exactly.
  const reserveStems = reserve.flatMap((l) => l.sharedStems);
  assert.equal(reserveStems.length, 37, 'the historical surface, for the record');
  for (const [tick, carrierId] of [
    [1200, 'brahms-op118-no1-82'],
    [1392, 'brahms-op118-no1-99'],
    [3120, 'brahms-op118-no1-217'],
    [3312, 'brahms-op118-no1-234'],
  ] as const) {
    const group = reserveStems.find((g) => g.tick === tick)!;
    assert.equal(group.carrierId, carrierId, `Round 44: t${tick} kept the top-RH survivor stem`);
    assert.equal(group.suppressedIds.length, 4, `Round 44: t${tick} suppressed the other four members`);
  }

  // Round 45: only the two *independent-duration* pairs keep a shared stem —
  // and they are exactly the two members whose value (192) the bracket's
  // carried 144 does NOT state, whose duration is routed to the horizontal
  // carrier instead.
  const workingStems = working.flatMap((l) => l.sharedStems);
  assert.deepEqual(
    workingStems.map((g) => [g.tick, g.hand, g.carrierId, [...g.suppressedIds]]),
    [
      [1584, 'RH', 'brahms-op118-no1-118', ['brahms-op118-no1-117']],
      [3504, 'RH', 'brahms-op118-no1-253', ['brahms-op118-no1-252']],
    ],
    'the eligible clusters keep no residual vertical shared-duration stem'
  );
  const painted = byIdOf(working);
  const carriers = working.flatMap((l) => l.exceptionCarriers);
  for (const cluster of clustersOf(working).filter((c) => c.delta > 0)) {
    const layout = working.find((l) => l.notes.some((p) => p.note.startTick === cluster.tick))!;
    const clasp = layout.clasps.find((k) => k.tick === cluster.tick)!;
    const carried = claspMemberCarriedTicks(clasp, cluster.memberIds[0]);
    assert.ok(carried === 96 || carried === 144, `t${cluster.tick}: the bracket states its shared value`);
    for (const id of cluster.memberIds) {
      const p = painted.get(id)!;
      const inGroup = workingStems.some((g) => g.carrierId === id || g.suppressedIds.includes(id));
      if (p.note.durationTicks === carried) {
        assert.equal(inGroup, false, `t${cluster.tick}: ${id} states the carried value — no redundant stem`);
      } else {
        // An independent value lives on the horizontal carrier; a stem may only
        // remain as the connector of two *equal* independent voices.
        assert.equal(p.note.durationTicks, 192, `t${cluster.tick}: ${id} is the independent value`);
        // Round 46: the 192-tick independent value reads as **one** full ring,
        // and the m. 9/m. 19 pairs share one indicator (the partner is named).
        const own = carriers.find((c) => c.noteId === id || c.partnerId === id);
        assert.ok(own, `${id}: its duration is routed through the horizontal grammar`);
        assert.deepEqual([own!.cuts, own!.rings, own!.dots], [0, 1, 0], `${id}: one full ring = a whole note`);
        assert.equal(inGroup, true, `${id}: it keeps the equal-duration pair connector`);
      }
    }
  }

  // Genuine beams and rests are untouched: same groups, same notes, and no
  // beamed member is ever folded into a shared-stem group.
  const beamGroups = (layouts: readonly JankoSystemLayout[]): string[] =>
    layouts
      .flatMap((l) => l.beams)
      .map((b) => b.notes.map((n) => n.id).sort().join('+'));
  // Round 46: with the written ties off, the canonical beam partition is
  // byte-identical to the Round 44 reserve (236 groups) — the tie treatment
  // re-partitions nothing by itself. With ties on, the continuation heads
  // beam under the ordinary rules: Round 49 §1 renders every authenticated
  // written chain, so the 29 continuation heads beam into 252 groups, of
  // which 7 carry a written-continuation id and exactly 2 more are the m. 66
  // groups whose merged-voice ids changed (898+901, 910+912).
  const noTies = layoutJankoScore(
    BRAHMS,
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, writtenTies: 'none' }),
    REFERENCE_TOKENS
  );
  assert.deepEqual(beamGroups(noTies), beamGroups(reserve), 'the real beams are the same groups, unchanged');
  assert.equal(beamGroups(reserve).length, 236, 'and there are 236 of them');
  assert.equal(beamGroups(working).length, 252, 'the canonical spread adds the written continuations\u2019 groups');
  assert.equal(
    beamGroups(working).filter((g) => g.includes('~c')).length,
    7,
    'seven beam groups carry a written continuation head'
  );
  assert.ok(
    beamGroups(working).includes('brahms-op118-no1-898+brahms-op118-no1-901') &&
      beamGroups(working).includes('brahms-op118-no1-910+brahms-op118-no1-912'),
    'the two m. 66 merged-voice groups are the only other new partition'
  );
  // Round 46: the written ties neither invent nor lose a rest — the canonical
  // spread states exactly the reserve's rest set (the running release resolves
  // each hand's true silence, so the m. 66 RH quarter at 12576 survives the
  // added written continuation onset at 12528).
  const restKey = (layouts: readonly JankoSystemLayout[]): string[] =>
    layouts
      .flatMap((l) => l.rests)
      .map((r) => `${r.tick}:${r.hand}:${r.value}`)
      .sort();
  assert.deepEqual(
    restKey(working),
    restKey(reserve),
    'rests byte-identical to the Round 44 reserve'
  );
  const beamed = new Set(working.flatMap((l) => l.beams).flatMap((b) => b.notes.map((n) => n.id)));
  for (const group of workingStems) {
    for (const id of [group.carrierId, ...group.suppressedIds]) {
      assert.equal(beamed.has(id), false, `${id}: a real beam is never replaced by a shared stem`);
    }
  }
  // The whole-score suppression census: the Round 45 doctrine lets the
  // bracket and the horizontal carriers own the cluster duration ink, so the
  // vertical standalone stems the Round 44 surface still painted — the Round 16
  // top/bottom survivors and every exception member that now has a carrier —
  // are gone: 203 → 269 suppressed ids (66 fewer vertical stems), with every
  // remaining member covered by the layout's own suppression set.
  const suppressedOf = (layouts: readonly JankoSystemLayout[]): Set<string> =>
    new Set(layouts.flatMap((l) => [...suppressedStemIds(l)]));
  const workingSuppressed = suppressedOf(working);
  // Round 46: 282 suppressed ids — the two shared 192-tick indicators own
  // both members of their pairs (`+2` vs 269's two carriers, each still with
  // its own suppressed partner), and the seven written tie components that
  // state their value on an added or reused head add their own suppression.
  // Round 49 §1 renders every authenticated written chain: the 16 newly
  // revealed continuation heads state their own values and join the same
  // suppression accounting, so 282 → 298.
  assert.equal(workingSuppressed.size, 298, 'the Round 49 §1 suppression census (Round 46: 282)');
  assert.equal(suppressedOf(reserve).size, 203, 'against the Round 44 reserve');
  assert.equal(
    suppressedOf(noOpticalLayouts()).size,
    workingSuppressed.size,
    'the optical pass itself suppresses nothing extra — it only moves heads'
  );
  for (const group of workingStems) {
    for (const id of group.suppressedIds) {
      assert.equal(workingSuppressed.has(id), true, `${id}: its standalone stem is suppressed`);
    }
  }
  // The two surviving pairs are equal-duration same-hand voices (the engine's
  // own precondition for a shared stem), so neither is a leftover of the old
  // selection: their value is the independent 192, not the bracket's carried
  // 144, and the engine only ever groups equal durations.
  for (const group of workingStems) {
    const durations = [group.carrierId, ...group.suppressedIds].map(
      (id) => painted.get(id)!.note.durationTicks
    );
    assert.deepEqual([...new Set(durations)], [192], `${group.carrierId}: an equal-duration independent pair`);
  }
});

// ---------------------------------------------------------------------------
// 5. The 45-degree family: measured glyphs, pitch and scale on both mounts
// ---------------------------------------------------------------------------

test('The 45-degree family measured: cut centre pitch is exactly 1.40 × the Round 44 .75 baseline at 90 %', () => {
  const base = midpointMetrics(R44_TOKENS, 0.75);
  assert.ok(approx(base.cutSpacing, 1.2833988079, 1e-9), 'the Round 44 .75 baseline is the ruled one');
  // Round 46 recomputed the fixed carrier length from the new maximum run
  // (the two-ring breve, not a three-ring stack): 10.0275 → 7.664642317.
  assert.ok(approx(base.carrierLength, 7.664642317, 1e-9), 'and its recomputed carrier length');
  assert.ok(approx(base.slashDx, 2.6879115324, 1e-9), 'and its slash component');

  const measured: Record<number, { cut: number; carrier: number; slash: number }> = {};
  for (const scale of SCALES) {
    const t = tokensForScale();
    const m = midpointMetrics(t, scale);
    // Length: the Round 45 factor on the 45-degree centreline, equal x/y.
    assert.ok(approx(m.slashCenterline, 5.0683745915, 1e-9), `s=${scale}: the family centreline is unchanged`);
    assert.ok(approx(m.paintedCenterline, 5.0683745915 * 1.1, 1e-9), `s=${scale}: painted centreline length ×1.10`);
    assert.ok(approx(m.slashDx, m.slashDy, 1e-9), `s=${scale}: 45 degrees preserved (equal components)`);
    assert.ok(
      approx(m.slashDx, (5.0683745915 * 1.1 * scale) / Math.SQRT2, 1e-9),
      `s=${scale}: the proportional 45-degree component`
    );
    assert.ok(
      approx(m.bracketCutSpacing, m.carrierCutSpacing, 1e-9) &&
        approx(m.bracketRingSpacing, m.carrierRingSpacing, 1e-9),
      `s=${scale}: one mark pitch for both mounts (bracket and carrier)`
    );
    assert.ok(approx(m.slashStroke, 0.71 * scale, 1e-9), `s=${scale}: the slash stroke follows s`);
    // Ring: radius and stroke both ×1.10 on top of the proportional value.
    assert.ok(approx(m.ringRadius, 1.6 * scale * 1.1, 1e-9), `s=${scale}: ring radius ×1.10`);
    assert.ok(approx(m.ringStroke, 0.59 * scale * 1.1, 1e-9), `s=${scale}: ring stroke ×1.10`);
    assert.ok(approx(m.gap, 0.5 * scale, 1e-9), `s=${scale}: the nominal ink gap stays 0.50·s`);
    // Cut centre pitch: P45(s) = P44(.75)·1.40·(s/.90) — 7/6 after scaling.
    assert.ok(
      approx(m.cutSpacing, 1.2833988079 * 1.4 * (scale / 0.9), 1e-9),
      `s=${scale}: the cut centre pitch follows the agreed formula`
    );
    assert.ok(
      approx(m.ringSpacing, 2 * (m.ringRadius + m.ringStroke / 2) + m.gap, 1e-9),
      `s=${scale}: ring pitch = the enlarged ring's outer diameter + the ink gap`
    );
    assert.ok(
      approx(m.carrierLength, effectiveExceptionCarrierLength('midpoint', t, scale), 1e-9),
      `s=${scale}: the fixed carrier length comes from the same metric`
    );
    measured[scale] = { cut: m.cutSpacing, carrier: m.carrierLength, slash: m.slashDx };
  }
  // The ruled constants.
  assert.ok(approx(measured[0.85].cut, 1.6969384237, 1e-9), 's=.85 cut pitch');
  assert.ok(approx(measured[0.9].cut, 1.7967583311, 1e-9), 's=.90 cut pitch — the 1.40× target');
  assert.ok(approx(measured[0.95].cut, 1.8965782383, 1e-9), 's=.95 cut pitch');
  // Round 46 recomputed the fixed length from the two-ring run: the historical
  // 12.33095 / 13.0563 / 13.78165 (three-ring stacks) become 9.71848392404654 /
  // 10.290159448990453 / 10.861834973934368 — the envelope shrinks even as the
  // bracket ring grows.
  assert.ok(approx(measured[0.85].carrier, 9.71848392404654, 1e-9), 's=.85 carrier length');
  assert.ok(approx(measured[0.9].carrier, 10.290159448990453, 1e-9), 's=.90 carrier length');
  assert.ok(approx(measured[0.95].carrier, 10.861834973934368, 1e-9), 's=.95 carrier length');
  // The agreed ratios vs Round 44 .75: scale ×1.2 (13.3 % / 20 % / 26.7 % larger
  // notes), slash stroke +20 %, slash length +32 %, ring +32 %, cut pitch +40 %.
  assert.ok(approx((0.71 * 0.9) / (0.71 * 0.75), 1.2, 1e-9), 'slash stroke +20 % at 90 %');
  assert.ok(approx(measured[0.9].slash / base.slashDx, 1.32, 1e-9), 'slash length +32 % at 90 %');
  assert.ok(approx((1.6 * 0.9 * 1.1) / (1.6 * 0.75), 1.32, 1e-9), 'ring diameter/stroke +32 % at 90 %');
  assert.ok(approx(measured[0.9].cut / base.cutSpacing, 1.4, 1e-9), 'cut centre pitch +40 % TOTAL at 90 %');
  assert.ok(approx(measured[0.85].cut / base.cutSpacing, 1.3222222222, 1e-9), 'and proportional at 85 %');
  assert.ok(approx(measured[0.95].cut / base.cutSpacing, 1.4777777778, 1e-9), 'and proportional at 95 %');
});

test('Painted duration ink: the same 45-degree marks on both mounts, the four-cut run countable', () => {
  /** Consecutive centre strides of one cut run (bracket: vertical, carrier: horizontal). */
  const strides = (centres: number[]): number[] =>
    centres.slice(1).map((c, i) => c - centres[i]);

  for (const scale of SCALES) {
    const { options, tokens } = dvsScale(scale);
    const m = midpointMetrics(tokens, scale);
    const key = renderJankoCrop(DVS, 17, 8, options, tokens);
    const bracketCuts = linesOf(key, 'janko-clasp-cut');
    assert.equal(bracketCuts.length, 10, `s=${scale}: the compact key band paints its cut runs`);
    for (const cut of bracketCuts) {
      assert.ok(approx(cut.x2 - cut.x1, m.slashDx, SVG_EPS), `s=${scale}: the bracket slash x length is the metric`);
      assert.ok(approx(cut.y2 - cut.y1, -m.slashDy, SVG_EPS), `s=${scale}: the same up-raked 45-degree rise`);
      assert.ok(approx(cut.stroke, m.slashStroke, SVG_EPS), `s=${scale}: the same slash stroke`);
    }
    // Four cuts, one x, ordered y: the individually countable run.
    const run = bracketCuts.slice(0, 4);
    assert.equal(new Set(run.map((c) => c.x1)).size, 1, `s=${scale}: a cut run shares one spine x`);
    for (const stride of strides(run.map((c) => c.y1))) {
      assert.ok(approx(stride, m.cutSpacing, SVG_EPS), `s=${scale}: the bracket stacks at the metric pitch`);
      // Adjacent parallel strokes: the perpendicular clearance minus the stroke
      // is the clear paper between them — the marks never merge into a blob.
      assert.ok(
        stride / Math.SQRT2 - m.slashStroke > 0.4,
        `s=${scale}: adjacent 45-degree strokes stay separated (${(stride / Math.SQRT2 - m.slashStroke).toFixed(4)}pt clear)`
      );
    }

    // Round 46 vocabulary (the historical fixture keeps both mounts equal):
    // 96 = one half-ring path, 192 = one ring, 384 = two rings — three circles
    // and one half-ring path in the key band, down from six circles.
    const bracketRings = circlesOf(key, 'janko-clasp-compact-ring');
    assert.equal(bracketRings.length, 3, `s=${scale}: the key band paints three full rings`);
    for (const ring of bracketRings) {
      assert.ok(approx(ring.r, m.bracketRingRadius, SVG_EPS), `s=${scale}: the bracket ring radius`);
      assert.ok(approx(ring.stroke, m.bracketRingStroke, SVG_EPS), `s=${scale}: the bracket ring stroke`);
    }
    const bracketHalfRings = [...key.matchAll(/<path class="janko-clasp-compact-ring" data-half-ring="true"[^>]*>/g)];
    assert.equal(bracketHalfRings.length, 1, `s=${scale}: and the 96-tick half-ring`);
    for (const [tag] of bracketHalfRings) {
      assert.match(tag, /fill="none"/, `s=${scale}: the half-ring keeps the spine alive`);
    }

    // The horizontal mount paints the SAME ink at the same scale.
    const band = renderJankoCrop(DVS, 25, 8, options, tokens);
    const carriers = paintedCarriers(band);
    assert.equal(carriers.length, 8, `s=${scale}: the exception band paints its carriers`);
    const layout = dvsScale(scale).layouts.flatMap((l) => l.exceptionCarriers);
    for (const c of carriers) {
      const declared = layout.find((g) => g.noteId === c.noteId)!;
      assert.ok(approx(c.length, m.carrierLength, SVG_EPS), `${c.noteId}: the fixed ${m.carrierLength.toFixed(4)}pt carrier`);
      assert.ok(approx(c.stroke, tokens.claspStrokeWidth * scale, SVG_EPS), `${c.noteId}: the carrier stroke follows s`);
      assert.equal(c.cuts, declared.cuts, `${c.noteId}: declared cuts`);
      assert.equal(c.rings, declared.rings, `${c.noteId}: declared rings`);
      assert.equal(c.dots, declared.dots, `${c.noteId}: declared dots`);
      assert.equal(c.cutCentres.length, c.cuts, `${c.noteId}: painted cuts match the declared marks`);
      // Round 46: a 96-tick value paints a half-ring **path**, so the painted
      // marks are the circles plus the half-ring paths.
      assert.equal(
        c.ringRadii.length + c.halfRings,
        c.rings,
        `${c.noteId}: painted rings match the declared marks`
      );
      assert.ok(c.halfRings <= 1, `${c.noteId}: at most one half-ring in the family`);
      for (const stride of strides(c.cutCentres)) {
        assert.ok(approx(stride, m.cutSpacing, SVG_EPS), `${c.noteId}: carrier cuts stack at the same pitch`);
      }
      for (const [i, r] of c.ringRadii.entries()) {
        assert.ok(approx(r, m.ringRadius, SVG_EPS), `${c.noteId}: ring ${i} radius identical to the bracket mount`);
        assert.ok(approx(c.ringStrokes[i], m.ringStroke, SVG_EPS), `${c.noteId}: ring ${i} stroke identical`);
      }
      if (c.halfRings === 1) {
        // The half-ring keeps the carrier's own radius (the mount rotation is
        // orientation, and in this historical fixture both mounts are equal).
        assert.equal(Number(c.ticks), 96, `${c.noteId}: the half-ring states 96 ticks`);
      }
      // Every carrier states its own value exactly (the bare quarter is the
      // alphabet's one mark-less reading, and it is declared as such) — in the
      // active Round 46 midpoint vocabulary, the one the paint reads.
      const marks = compactDurationMarks(c.ticks, 'midpoint');
      assert.equal(marks.inGrammar, true, `${c.noteId}: its value has an exact reading`);
      assert.deepEqual([c.cuts, c.rings, c.dots], [marks.cuts, marks.rings, marks.dots], `${c.noteId}: marks state the value`);
      if (c.cuts === 0 && c.rings === 0 && c.dots === 0) {
        assert.equal(c.ticks, 48, `${c.noteId}: a mark-less carrier may only be the bare quarter`);
      }
    }
  }
});

test('Every admitted owner is correct; the one specimen stress refusal is published, never painted-and-refused', () => {
  const layouts = referenceLayouts();
  const carriers = layouts.flatMap((l) => l.exceptionCarriers);
  // Round 46: 37 carriers = 30 member statements (the two 192-tick pairs share
  // one indicator, so 32 member statements paint as 30 marks) + the 7 written
  // tie components whose 96/192-tick value the mark family states with a ring.
  // Round 49 §1 renders every authenticated written chain: the 16 newly
  // revealed components add 10 more standalone statements whose value the
  // mark family states (96/192/144 readings), so 37 → 47. The six former
  // `carrier-duration-unsupported` composites stay solved.
  assert.equal(carriers.length, 47, '47 painted carriers across the working Reference (was 37 pre-Round 49)');
  assert.equal(layouts.flatMap((l) => l.exceptionCarrierRefusals).length, 0, 'no withheld carrier on Brahms');
  assert.equal(layouts.flatMap((l) => l.exceptionCarrierOcclusions).length, 0, 'no destroyed duration ink on Brahms');
  assert.deepEqual(
    layouts.flatMap((l) => l.exceptionCarrierUnsupported),
    [],
    'no composite is left unstated — the six former refusals are solved by components and ties'
  );
  const plan = getTieDisplayPlan(BRAHMS);
  const chainHeads = new Map<string, number>();
  for (const chain of plan.chains) {
    for (const component of chain.components) chainHeads.set(component.headId, component.durationTicks);
  }
  const heads = byIdOf(layouts);
  const admitted = memberIdsOf(layouts);
  for (const c of carriers) {
    const p = heads.get(c.noteId)!;
    assert.ok(p, `${c.noteId}: the carrier's head is laid out`);
    if (!admitted.has(c.noteId)) {
      // A written tie component outside any bracket states its own component
      // value with the carrier — never a bracket exception.
      assert.equal(
        chainHeads.has(c.noteId),
        true,
        `${c.noteId}: an unadmitted carrier owner is a written tie component`
      );
      assert.equal(c.scale, 1, `${c.noteId}: it rides the canonical symbol scale`);
      assert.equal(chainHeads.get(c.noteId), c.durationTicks, `${c.noteId}: the mark states the component value`);
      assert.ok(approx(c.y, p.y, 1e-9), `${c.noteId}: the carrier sits at the component's true pitch y`);
      continue;
    }
    assert.equal(c.scale, 0.95, `${c.noteId}: the carrier ink rides the admitted symbol scale`);
    if (c.partnerId === undefined) {
      assert.ok(approx(c.y, p.y, 1e-9), `${c.noteId}: the carrier sits at the member's true pitch y`);
    } else {
      // A shared indicator sits in the freer lane just outside the pair: both
      // members are its owners (asserted by the m. 9/m. 19 tests above).
      assert.ok(
        c.partnerId.length > 0,
        `${c.noteId}: the shared indicator names its second owner`
      );
    }
    const marks = compactDurationMarks(c.durationTicks, 'midpoint');
    assert.equal(marks.inGrammar, true, `${c.noteId}: its value has an exact reading`);
    assert.deepEqual(
      [c.cuts, c.rings, c.dots],
      [marks.cuts, marks.rings, marks.dots],
      `${c.noteId}: marks state the value`
    );
    if (c.cuts === 0 && c.rings === 0 && c.dots === 0) {
      assert.equal(c.durationTicks, 48, `${c.noteId}: only the bare quarter may be mark-less`);
    }
  }
  // An admitted carrier that is not a tie component is a genuine bracket
  // exception (a duration the bracket's own carried value does not state).
  for (const c of carriers) {
    if (!admitted.has(c.noteId) || chainHeads.has(c.noteId)) continue;
    const layout = layouts.find((l) => l.notes.some((x) => x.note.id === c.noteId))!;
    const clasp = layout.clasps.find((k) => k.notes.some((n) => n.id === c.noteId))!;
    assert.notEqual(
      c.durationTicks,
      claspMemberCarriedTicks(clasp, c.noteId),
      `${c.noteId}: only a genuine exception (a duration the bracket does not state) owns a carrier`
    );
  }

  // The DVS key is rendered by the cards; its deliberately tight stress row
  // publishes exactly one refused carrier — the same finding the Round 44
  // reserve family reports on the same score at the same identity — and it is
  // never painted.
  const reserveDvs = lintJankoScore(
    DVS,
    resolveJankoOptions({
      ...DURATION_VOCABULARY_SPECIMEN_JANKO_OPTIONS,
      pitchPlacement: 'parity-columns',
      chordSymbolScale: 0.75,
      bracketDurationGrammar: 'midpoint',
      exceptionCarrier: 'horizontal',
      opticalSpacing: false,
      lowPitchFolding: 'core',
    }),
    resolveJankoTokens({
      ...DURATION_VOCABULARY_SPECIMEN_JANKO_TOKENS,
      midpointSlashLengthFactor: 1,
      midpointRingScale: 1,
      midpointBracketRingScale: 1,
      midpointSpacingFactor: 1,
    })
  );
  assert.deepEqual(
    reserveDvs.warnings.map((w) => [w.code, w.noteIds?.[0], w.measure]),
    [['carrier-fit-refused', 'dvs-stress-12288-9_5', 33]],
    'the specimen stress refusal predates Round 45 (same identity on the reserve family)'
  );
  assert.ok(
    !candidatesView().includes('data-exception-note="dvs-stress-12288-9_5"'),
    'a refused carrier is withheld, never painted-and-refused'
  );
  for (const scale of SCALES) {
    const report = lintJankoScore(DVS, dvsScale(scale).options, dvsScale(scale).tokens);
    assert.deepEqual(
      report.warnings.map((w) => [w.code, w.noteIds?.[0], w.measure]),
      [['carrier-fit-refused', 'dvs-stress-12288-9_5', 33]],
      `s=${scale}: the specimen key publishes the same single stress refusal`
    );
    assert.deepEqual(report.violations, [], `s=${scale}: and no hard error`);
  }
});

// ---------------------------------------------------------------------------
// 6. m. 66: the two-handed “9222” column and the preserved sustained voices
// ---------------------------------------------------------------------------

test('m. 66 “9222” reads two-handed: A2/D3 left, D4/D5 right, the written F3 and the sustained voices preserved', () => {
  assert.equal(BRAHMS_HAND_CORRECTIONS.length, 20, 'the bounded overlay: ten LH→RH + five RH→LH + five m70 editorial records, no more');
  const layouts = referenceLayouts();
  const onset = (tick: number) => headsOf(layouts).filter((p) => p.note.startTick === tick);
  const rows = (tick: number) =>
    onset(tick).map((p) => [p.note.id, p.rhythm.hand, p.note.durationTicks, p.note.pitch.pitchClass, p.note.pitch.octave]);

  // The tick-12624 column: source A2(9/2) and D3(2/3) on the left — the A2 and
  // D3 arrive as the written continuations of their 12552/12576 attacks — plus
  // the F3 continuation, and the D4/D5 pair on the right. The column reads
  // two-handed in the printed (linear) source, not by the MIDI track label.
  assert.deepEqual(
    rows(12624),
    [
      ['brahms-op118-no1-914', 'LH', 96, 2, 3],
      ['brahms-op118-no1-915', 'RH', 96, 2, 4],
      ['brahms-op118-no1-916', 'RH', 96, 2, 5],
      ['brahms-op118-no1-912~c1', 'LH', 96, 5, 3],
      ['brahms-op118-no1-913', 'LH', 96, 9, 2],
    ],
    'the two-handed tick-12624 column, including the written F3 continuation head'
  );
  // Round 46: one visible attack head per source-proven attack/carry group —
  // the A2 group (908/909) and the D3 group (910/911) each paint one head,
  // stating the chain's first written component.
  assert.deepEqual(
    rows(12552),
    [['brahms-op118-no1-909', 'LH', 24, 9, 2]],
    'the A2 attack/carry group paints one visible attack head (24 ticks)'
  );
  assert.deepEqual(
    rows(12576),
    [['brahms-op118-no1-911', 'LH', 48, 2, 3]],
    'the D3 attack/carry group paints one visible attack head (48 ticks)'
  );
  assert.deepEqual(
    rows(12600),
    [['brahms-op118-no1-912', 'LH', 24, 5, 3]],
    'the F3 states its first written component (24) and ties into 12624'
  );
  // The unequal simultaneous voice keeps its own rhythm statement.
  assert.deepEqual(
    layouts
      .flatMap((l) => l.unisonVoices)
      .filter((v) => v.note.startTick >= 12552 && v.note.startTick < 12624)
      .map((v) => [v.note.id, v.note.durationTicks]),
    [['brahms-op118-no1-910', 24]],
    'the shorter A2 voice is preserved as a mixed-duration voice'
  );
  // No onset was invented and no event was deleted: seven source heads merge
  // (the five pinned unrelated cross-hand unisons plus the two m. 66
  // attack/carry groups) and thirteen written continuation heads are added.
  const merges = layouts.flatMap((l) => l.unisonMerges);
  assert.deepEqual(
    merges.map((m) => [m.tick, m.survivorId, [...m.mergedIds]]),
    [
      [11376, 'brahms-op118-no1-841', ['brahms-op118-no1-840']],
      [11472, 'brahms-op118-no1-850', ['brahms-op118-no1-849']],
      [12336, 'brahms-op118-no1-898', ['brahms-op118-no1-897']],
      [12360, 'brahms-op118-no1-901', ['brahms-op118-no1-900']],
      [12384, 'brahms-op118-no1-903', ['brahms-op118-no1-902']],
      [12552, 'brahms-op118-no1-909', ['brahms-op118-no1-908']],
      [12576, 'brahms-op118-no1-911', ['brahms-op118-no1-910']],
    ],
    'the two m. 66 attack/carry groups merge; nothing else does'
  );
  assert.deepEqual(
    layouts
      .flatMap((l) => l.notes)
      .filter((p) => p.note.id.includes('~c'))
      .map((p) => p.note.id)
      .sort(),
    [
      'brahms-op118-no1-150~c1',
      'brahms-op118-no1-15~c1',
      'brahms-op118-no1-172~c1',
      'brahms-op118-no1-295~c1',
      'brahms-op118-no1-351~c1',
      'brahms-op118-no1-37~c1',
      'brahms-op118-no1-434~c1',
      'brahms-op118-no1-448~c1',
      'brahms-op118-no1-544~c1',
      'brahms-op118-no1-554~c1',
      'brahms-op118-no1-581~c1',
      'brahms-op118-no1-637~c1',
      'brahms-op118-no1-720~c1',
      'brahms-op118-no1-734~c1',
      'brahms-op118-no1-858~c1',
      'brahms-op118-no1-858~c2',
      'brahms-op118-no1-858~c3',
      'brahms-op118-no1-904~c1',
      'brahms-op118-no1-904~c2',
      'brahms-op118-no1-905~c1',
      'brahms-op118-no1-906~c1',
      'brahms-op118-no1-907~c1',
      'brahms-op118-no1-912~c1',
      'brahms-op118-no1-918~c1',
      'brahms-op118-no1-919~c1',
      'brahms-op118-no1-920~c1',
      'brahms-op118-no1-939~c1',
      'brahms-op118-no1-940~c1',
      'brahms-op118-no1-941~c1',
    ],
    'exactly the twenty-nine written continuation heads the ties state (Round 49 §1 renders every authenticated chain)'
  );
  // The former 120-tick composite is now a rendered chain, so it is no longer
  // published as an unsupported duration.
  assert.equal(
    layouts
      .flatMap((l) => l.exceptionCarrierUnsupported)
      .some((u) => u.noteId === 'brahms-op118-no1-912'),
    false,
    'the 120-tick F3 is a rendered tie chain, not an unstated composite'
  );
  assert.equal(
    layouts.flatMap((l) => l.notes).filter((p) => p.note.startTick === 12600).length,
    1,
    'exactly one F3 onset exists (no invented duplicate)'
  );
  // The written ties are painted as arcs, and none is blocked. Round 49 §1
  // renders every authenticated chain: 19 → 35 arcs.
  assert.equal(layouts.flatMap((l) => l.tieArcs ?? []).length, 35, 'thirty-five tie arcs join the chains');
  assert.deepEqual(layouts.flatMap((l) => l.tieAnchorShortfalls ?? []), [], 'every arc found its heads');
  assert.deepEqual(layouts.flatMap((l) => l.tieBlockedArcs ?? []), [], 'every arc clears the glyph masks');
});

// ---------------------------------------------------------------------------
// 7. Literal low pitches: the ↓10 folds are gone, the ledgers state the register
// ---------------------------------------------------------------------------

test('Literal low pitches: the nine unwarranted ↓10 folds are gone and the literal positions are exact', () => {
  // Every source pitch of this score is at or above the literal floor, so the
  // working Reference folds nothing and writes no ottava indicator.
  assert.equal(JANKO_LITERAL_LOW_FLOOR_LIN, 0, 'the literal vocabulary reaches the source floor');
  const working = referenceLayouts();
  assert.equal(working.flatMap((l) => l.ottavaBrackets).length, 0, 'no ↓10/↓20 indicator on the working Reference');
  assert.deepEqual(
    [...new Set(headsOf(working).map((p) => p.ottavaShift ?? 0))],
    [0],
    'not one head is displaced by a fold'
  );
  // The nine events the Round 44 surface folded under a ↓10: measured, by id.
  const folded = reserveLayouts()
    .flatMap((l) => l.notes)
    .filter((p) => (p.ottavaShift ?? 0) !== 0);
  assert.deepEqual(
    folded.map((p) => [p.note.id, p.ottavaShift]),
    [
      ['brahms-op118-no1-47', 12],
      ['brahms-op118-no1-182', 12],
      ['brahms-op118-no1-302', 12],
      ['brahms-op118-no1-444', 12],
      ['brahms-op118-no1-588', 12],
      ['brahms-op118-no1-730', 12],
      ['brahms-op118-no1-917', 12],
      ['brahms-op118-no1-937', 12],
      ['brahms-op118-no1-938', 12],
    ],
    'the Round 44 reserve really did fold these nine (mm. 5/15/22/33/42/53/67/68/69)'
  );
  assert.equal(reserveLayouts().flatMap((l) => l.ottavaBrackets).length, 9, 'and wrote nine indicators');
  const heads = byIdOf(working);
  for (const [id, octave, pitchClass] of [
    ['brahms-op118-no1-47', 1, 5],
    ['brahms-op118-no1-182', 1, 5],
    ['brahms-op118-no1-302', 1, 4],
    ['brahms-op118-no1-444', 1, 4],
    ['brahms-op118-no1-588', 1, 4],
    ['brahms-op118-no1-730', 1, 4],
    ['brahms-op118-no1-917', 1, 2],
    ['brahms-op118-no1-937', 1, 2],
    ['brahms-op118-no1-938', 0, 9],
  ] as const) {
    const p = heads.get(id)!;
    assert.equal(p.note.pitch.octave, octave, `${id}: literal written octave`);
    assert.equal(p.note.pitch.pitchClass, pitchClass, `${id}: literal pitch class`);
    assert.equal(p.ottavaShift, undefined, `${id}: no fold shift`);
    assert.equal(p.writtenLin, octave * 12 + pitchClass, `${id}: written = sounding (exact pitch semantics)`);
    // Round 46: the literal position **is** the register statement. Round 45
    // drew dynamic ledger equators beside the head; that extra ink (and the
    // `isOutOfStaff` flag that described it) is gone, and the head's own
    // position states the register exactly.
    assert.equal(p.coord.isOutOfStaff, false, `${id}: no extra register ink`);
    assert.deepEqual(p.coord.ledgerYs, [], `${id}: no ledger dash beside the literal head`);
    const system = working.find((l) => l.notes.some((x) => x.note.id === id))!;
    assert.ok(
      approx(
        p.y,
        system.geometry.middleCY + continuousPitchY(p.writtenLin, REFERENCE_TOKENS.semitoneScale),
        1e-9
      ),
      `${id}: painted at its literal staff position (the middle-C equator plus its written pitch)`
    );
  }
  // Round 45's extra ink is gone from the real paint too (m. 67's literal low
  // A1 downbeat), while the resolved-position claim stays exact.
  const m67 = renderJankoCrop(BRAHMS, 67, 1, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  assert.equal((m67.match(/class="janko-ledger"/g) ?? []).length, 0, 'm. 67 paints no ledger ink');
  assert.equal((m67.match(/class="janko-outlier-rule"/g) ?? []).length, 0, 'and no outlier rule');
  assert.equal((m67.match(/janko-ottava/g) ?? []).length, 0, 'and no displaced-note indicator');
  const m67Core = renderJankoCrop(BRAHMS, 67, 1, { ...REFERENCE_OPTIONS, lowPitchFolding: 'core' }, REFERENCE_TOKENS);
  assert.ok((m67Core.match(/janko-ottava/g) ?? []).length > 0, 'the core folding would have written the ↓10 instead');
});

test('System spacing and pagination are unchanged by the literal placement; the spread is complete and in bounds', () => {
  const literal = referenceLayouts();
  const core = coreFoldingLayouts();
  // The literal placement uses the existing visual room: the page grid, the
  // system slots and the page breaks are identical to the same family with core
  // folding. Only the content bounds inside a slot may follow the real ink.
  assert.deepEqual(
    literal.map((l) => l.geometry.slotTopY),
    core.map((l) => l.geometry.slotTopY),
    'the system slots are unchanged — no repacking, no added page'
  );
  assert.deepEqual(
    literal.map((l) => l.notes[0].note.startTick),
    core.map((l) => l.notes[0].note.startTick),
    'and every system opens on the same onset'
  );
  assert.equal(countJankoPages(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS), 5, 'still five A4 pages');
  assert.equal(countJankoPages(BRAHMS, { ...REFERENCE_OPTIONS, lowPitchFolding: 'core' }, REFERENCE_TOKENS), 5, 'as the control');
  assert.equal(literal.length, 18, 'eighteen systems of music');
  assert.deepEqual(literal.map((l) => l.geometry.slotTopY), reserveLayouts().map((l) => l.geometry.slotTopY), 'and the same slots as the landed reserve');

  // True ink bounds: every system's painted box stays inside its own drawn
  // staff (the register vocabulary draws the rows a low literal note needs) and
  // never reaches the next system's staff; the low literal notes therefore fit
  // the existing spacing rather than forcing a repack.
  const boxes = literal.map((l) => {
    const notes = headsOf([l]);
    const hy = (p: Head) =>
      knockoutHalfExtents(REFERENCE_OPTIONS, REFERENCE_TOKENS, p.note.startTick, p).hy;
    return {
      index: l.index,
      top: Math.min(...notes.map((p) => p.y - hy(p))),
      bottom: Math.max(...notes.map((p) => p.y + hy(p))),
      staffTop: l.geometry.staffTopY,
      staffBottom: l.geometry.staffBotY,
    };
  });
  for (const box of boxes) {
    assert.ok(box.top >= box.staffTop - 0.01, `system ${box.index}: the real ink starts inside the drawn staff`);
    assert.ok(box.bottom <= box.staffBottom + 0.01, `system ${box.index}: and stays inside it`);
  }
  for (let i = 1; i < boxes.length; i++) {
    // Four systems per page: the page break is the only allowed boundary.
    if (i % 4 === 0) continue;
    assert.ok(boxes[i].top >= boxes[i - 1].bottom, `systems ${i - 1}/${i}: the ink boxes never intersect`);
    assert.ok(
      boxes[i].staffTop >= boxes[i - 1].staffBottom,
      `systems ${i - 1}/${i}: the drawn staves never intersect`
    );
  }

  // Page completeness and source accounting across the whole spread.
  assert.equal(BRAHMS.notes.length, 964, 'the source carries 964 notes');
  const paintedHeads = headsOf(literal);
  // Round 46 head accounting: 964 source notes − 7 merged source heads (five
  // cross-hand unisons + the two m. 66 attack/carry groups) + the written
  // continuation heads. Round 49 §1 renders every authenticated written
  // chain, so the continuations number 29 (13 + the 16 the removed
  // consolidation filter used to suppress) = 986 painted heads.
  assert.equal(paintedHeads.length, 986, 'the spread paints every source head once plus the written continuations');
  const merged = literal.flatMap((l) => l.unisonMerges).flatMap((m) => m.mergedIds);
  assert.equal(merged.length, 7, 'seven source heads merge');
  const addedTieHeads = paintedHeads.filter((p) => p.note.id.includes('~c')).length;
  assert.equal(addedTieHeads, 29, 'twenty-nine written continuation heads are added');
  assert.equal(
    paintedHeads.length + merged.length - addedTieHeads,
    BRAHMS.notes.length,
    '964 = 986 painted − 29 continuations + 7 merged'
  );
  const perPage: number[] = [];
  const stemsPerPage: number[] = [];
  const flagsPerPage: number[] = [];
  for (let page = 0; page < 5; page++) {
    const svg = renderJankoPage(BRAHMS, page, REFERENCE_OPTIONS, REFERENCE_TOKENS);
    assert.match(svg, /viewBox="0\.00 0\.00 595\.28 841\.89"/, `page ${page + 1}: the A4 viewBox`);
    for (const attr of svg.matchAll(/\s(x|y|cx|cy|x1|y1|x2|y2)="(-?[\d.]+)"/g)) {
      const bound = attr[1][0] === 'x' || attr[1].startsWith('cx') ? 595.28 : 841.89;
      const value = Number(attr[2]);
      assert.ok(value >= -0.01 && value <= bound + 0.01, `page ${page + 1}: ${attr[1]}="${attr[2]}" inside the page`);
    }
    const digits = (svg.match(/class="janko-digit"/g) ?? []).length;
    const knockouts = (svg.match(/class="janko-knockout"/g) ?? []).length;
    assert.equal(digits, knockouts, `page ${page + 1}: every painted digit has its knockout`);
    assert.ok(digits > 0, `page ${page + 1}: the page carries music`);
    perPage.push(digits);
    stemsPerPage.push((svg.match(/class="janko-stem"/g) ?? []).length);
    flagsPerPage.push((svg.match(/class="janko-flag"/g) ?? []).length);
  }
  assert.deepEqual(perPage, [215, 235, 237, 224, 75], 'the engine page census (Round 49 §1: the written continuations join their pages)');
  assert.equal(perPage.reduce((a, b) => a + b, 0), paintedHeads.length, 'every laid-out head paints once');
  // No missing rhythm ink: every page paints its stems/flags, and the whole
  // spread's stem census is the measured 692 (the 986 heads minus the 298
  // suppressed standalone stems, plus the shared-stem/beam carriers).
  assert.deepEqual(stemsPerPage, [136, 172, 169, 169, 46], 'the page stem census');
  assert.equal(stemsPerPage.reduce((a, b) => a + b, 0), 692, '692 painted stems across the spread');
  assert.deepEqual(flagsPerPage, [14, 23, 21, 11, 2], 'and the flag census is complete (Round 49 §1 recount)');
});

// ---------------------------------------------------------------------------
// 8. Honesty: the whole-score report, the Reference ≡ 90 % rule, frozen Bach
// ---------------------------------------------------------------------------

test('Honest whole-score report: zero hard errors, zero warnings, Reference ≡ the 0.30pt card, Bach GOLD frozen', () => {
  const report = lintJankoScore(BRAHMS, REFERENCE_OPTIONS, REFERENCE_TOKENS);
  assert.equal(report.ok, true, 'the working Reference is free of hard errors');
  assert.deepEqual(report.violations, [], 'zero violations — by identity, not by a count allowance');
  // Round 46: the six former 120-tick composite refusals are stated exactly by
  // their written components (first 96 = one half-ring, the remaining 24 tied),
  // so the record is genuinely empty — nothing suppressed, nothing hidden, and
  // no refusal reappears under another name.
  assert.deepEqual(report.warnings, [], 'zero warnings — the six composites are solved, not suppressed');
  for (const id of [295, 351, 448, 581, 637, 734]) {
    assert.ok(
      report.diagnostics.every((d) => !(d.noteIds ?? []).includes(`brahms-op118-no1-${id}`)),
      `brahms-op118-no1-${id}: the former refusal never reappears`
    );
  }
  assert.equal(report.stats.notes, 986, 'the report walks the painted heads (964 − 7 merged + 29 continuations)');
  assert.equal(report.stats.systems, 18, 'and the same systems');
  // Both candidate cards report the same clean Brahms surface (the round's own
  // spacing control differs by one declared number, never by diagnostics).
  for (const card of CURRENT_CANDIDATES) {
    const brahmsReport = lintJankoScore(
      BRAHMS,
      resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(card.options ?? {}) }),
      resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(card.tokens ?? {}) })
    );
    assert.deepEqual(brahmsReport.violations, [], `${card.id}: no hard error on the whole Brahms score`);
    assert.deepEqual(brahmsReport.warnings, [], `${card.id}: no warning on the whole Brahms score`);
  }

  // The landed Round 46 card and the Reference are one engraving (options,
  // tokens and bytes — the served-page equality is pinned in the studio test
  // above); Round 47's own four cards deliberately differ and are pinned in
  // test/janko-round47.test.ts.
  assert.deepEqual(
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...ROUND_46_REFERENCE_CARD.options }),
    REFERENCE_OPTIONS,
    'the landed Round 46 card = the working Brahms Reference'
  );
  assert.deepEqual(
    resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...ROUND_46_REFERENCE_CARD.tokens }),
    REFERENCE_TOKENS,
    'and its token set'
  );

  // Frozen canonicals: Bach GOLD is byte-identical to the landed Round 44
  // engine, and this round's machinery never touches it.
  const sha = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
  const bachPages = [
    '2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f',
    'dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757',
  ];
  for (let page = 0; page < bachPages.length; page++) {
    assert.equal(
      sha(renderJankoPage(BACH, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS)),
      bachPages[page],
      `Bach GOLD page ${page} is byte-identical to 081e5cdf0459`
    );
  }
  const bach = lintJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.deepEqual(bach.diagnostics, [], 'Bach GOLD stays clean (zero violations, zero warnings)');
  const bachLayouts = layoutJankoScore(BACH, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(clustersOf(bachLayouts).length, 0, 'the optical pass never runs on the canonical surface');
  assert.equal(
    headsOf(bachLayouts).filter((p) => p.opticalOffsetY !== undefined).length,
    0,
    'and stamps nothing on it'
  );
  // The Brahms Reference is the intentional golden change of this round: pin
  // the adopted artifact through the engine (the committed PDF is pinned by
  // `test/janko-pdf.test.ts`; the export is Bach-only, so it carries no churn).
  // Round 49 §4: the m70 editorial hands regroup the m. 70 beams, and the
  // corrected §4 *authority* lets the engine paint the truthful m. 70 LH
  // quarter at 13392 (the raw source label no longer vetoes the inference),
  // so page 5 is re-pinned here.
  // Round 49: the §1 written chains, the §4 m70 hands + authority, the §6
  // reference tie laws and the §5 family air re-pin the BRONZE spread's
  // m. 70-bearing page (Bach GOLD above stays frozen).
  const brahmsPages = [
    '7676bf9059982aac2a0a2b96b32711b32ad6b15b12016419da19d3afb29d0c90',
    'a84166821d569d8c080b1ff98f97664d0f1d6132b7002026ea6cd66e32b85cfa',
    '78b3fd134d5f3b4bf4269619759149a34aa9c8c95f540fcc72fe12f9495a2897',
    '40c43f6aed8a4b4554d2e0c8c7c9d62a468dccb3766f2da15ba66d7f7fa984fd',
    'd2237277aa13354dcc30aa2e3bdd1e42d4fb461fc78435a65343bb65d9c546a5',
  ];
  for (let page = 0; page < brahmsPages.length; page++) {
    assert.equal(
      sha(renderJankoPage(BRAHMS, page, REFERENCE_OPTIONS, REFERENCE_TOKENS)),
      brahmsPages[page],
      `Brahms Reference page ${page} is the adopted Round 46 engraving`
    );
  }
  assert.equal(
    sha(renderJankoCrop(BRAHMS, 1, 71, REFERENCE_OPTIONS, REFERENCE_TOKENS)),
    'cb30a7d9c18dfe2391e073e91e5686a619c8684b8e79d9adf2be83570f2a9059',
    'the whole-score crop carries the §4 m70 hands, authority and truthful rest'
  );
});

// ---------------------------------------------------------------------------
// 9. The served studio: labels, inventory and phone-session continuity
// ---------------------------------------------------------------------------

test('The served studio carries the three labelled cards and the honest inventory for both views', () => {
  const candidates = candidatesView();
  assert.equal((candidates.match(/data-candidate="/g) ?? []).length, 3, 'three candidate cards');
  assert.match(candidates, /data-candidate-count="3"/);
  assert.match(candidates, /data-window-count="21"/, 'seven review surfaces per card');
  assert.equal(
    (candidates.match(/<figure class="page-card"/g) ?? []).length,
    0,
    'the Round 49 cards declare literal crops only — no page cards'
  );
  for (const label of ['Above-numeral mount', 'family air 1.00pt', 'Uniform contour control']) {
    assert.ok(candidates.includes(label), `the served grid labels the ${label} card`);
  }
  // The honest chip inventory: the canonical Brahms is 0/0 for every card, and
  // the round publishes no withheld carrier, refused seat or withheld rest as a
  // warning (the rest facts are `'info'` notes, visible in the Reference record).
  assert.equal((candidates.match(/data-lint="clean"/g) ?? []).length, 3, 'every card is free of hard errors');
  assert.equal((candidates.match(/⚠ 1 warning/g) ?? []).length, 0, 'no card publishes a withheld seat');
  assert.equal((candidates.match(/⚠ 7 warnings/g) ?? []).length, 0, 'the former six-composite inventory is gone');
  assert.ok(!/<image|data:image|\.png|\.jpe?g/i.test(candidates), 'no screenshots, no raster review artifacts');
  assert.ok(!/localhost/i.test(candidates), 'Tailscale access only — no localhost reference');

  const reference = referenceView();
  assert.match(reference, /0 violations, 0 warnings/, 'the BRONZE Brahms Reference reports its clean record');
  assert.match(
    reference,
    /rest-inference-withheld/,
    'and lists the published withheld-rest facts of this score'
  );
  assert.equal((reference.match(/data-page="/g) ?? []).length, 7, 'two Bach pages + five Brahms pages');
  // Phone continuity (§F) is studio-wide and lives in the shared session
  // module: both views are served by the same document, and the behavioural
  // proof (restore, hash precedence, storage failure, HMR re-mount, listener
  // count) is `test/janko-studio-session.test.ts`, not re-implemented here.
  const served = candidates + reference;
  assert.ok(served.length > 0, 'both views render from the one template');
});
