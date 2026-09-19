/**
 * Layout Reuse & Studio First-Render Performance — Invariant Suite.
 *
 * Verifies:
 *  1. Output equivalence: Standalone and precomputed paths produce byte-identical
 *     SVGs for crops, pages, and systems bodies across canonical scores and candidates.
 *  2. Deterministic computation counts:
 *     - Crop frame and renderSystemsBody share computed layouts (standalone calls
 *       invoke layoutJankoScore exactly once; precomputed calls invoke it 0 times).
 *     - Studio Reference view computes layout once for Brahms and reuses it for
 *       all 5 pages and all 3 macro crops.
 *     - Studio Candidates view computes layout once per distinct candidate configuration
 *       and reuses it across all declared windows.
 *     - Full Studio render (renderStudioMarkup) executes exactly 1 layout computation
 *       per distinct score/options/tokens configuration, eliminating 19 redundant
 *       content-aware layout calls.
 *  3. Fresh data/options/tokens across renders:
 *     - No cross-render global cache or stale HMR reuse. Subsequent renders with
 *       updated options/tokens compute fresh layouts.
 *  4. Candidate isolation:
 *     - Candidate configurations remain separate from each other and from the
 *       Reference view.
 *  5. Mismatched precomputed layout safety:
 *     - Safely falls back to standalone computation if precomputed layouts do not
 *       match the score/options requirements.
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
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import {
  computePageGeometry,
  countJankoPages,
  countJankoSystems,
  isContentAwarePlacement,
  isMatchingPrecomputedLayouts,
  layoutJankoScore,
  renderJankoCrop,
  renderJankoPage,
  renderSystemsBody,
  setLayoutJankoScoreObserver,
} from '../src/render/janko/engine';
import {
  BRAHMS_STUDIO_CROPS,
  createStudioConfig,
  renderCandidatesView,
  renderCompareStrip,
  renderReferenceView,
  renderStudioMarkup,
} from '../src/render/janko/studio';
import { BRAHMS_STUDIO_SCORE_ID, resolveCandidate } from '../src/render/janko/candidates';
import { ROUND_37_CANDIDATES, ROUND_37_METADATA } from './janko-round37.test';
import { ROUND_39_CANDIDATES, ROUND_39_METADATA } from './janko-round39.test';
import { ROUND_41_CANDIDATES } from './janko-round41.test';

const BRAHMS = buildBrahmsOp118No1Score();
const BACH = buildBachGoldbergVar1Score();
const BRAHMS_OPTS = resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS);
const BRAHMS_TOKS = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const BACH_OPTS = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
const BACH_TOKS = resolveJankoTokens(DEFAULT_JANKO_TOKENS);

// ---------------------------------------------------------------------------
// 1. Output Equivalence
// ---------------------------------------------------------------------------

test('Output equivalence: Brahms macro focus crops are byte-identical standalone vs precomputed', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);

  for (const crop of BRAHMS_STUDIO_CROPS) {
    const standalone = renderJankoCrop(
      BRAHMS,
      crop.start,
      crop.count,
      BRAHMS_OPTS,
      BRAHMS_TOKS
    );
    const precomputed = renderJankoCrop(
      BRAHMS,
      crop.start,
      crop.count,
      BRAHMS_OPTS,
      BRAHMS_TOKS,
      undefined,
      layouts
    );
    assert.equal(
      precomputed,
      standalone,
      `Brahms focus crop mm. ${crop.start}–${crop.start + crop.count - 1} must be byte-identical`
    );
  }
});

test('Output equivalence: Candidate windows across score candidates are byte-identical standalone vs precomputed', () => {
  for (const candidate of ROUND_37_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    const opts = resolveJankoOptions({ ...BRAHMS_OPTS, ...(candidate.options ?? {}) });
    const toks = resolveJankoTokens({ ...BRAHMS_TOKS, ...(candidate.tokens ?? {}) });
    const layouts = layoutJankoScore(BRAHMS, opts, toks);

    for (const window of resolved.windows) {
      if (!('measureStart' in window)) continue;
      const standalone = renderJankoCrop(
        BRAHMS,
        window.measureStart,
        window.measureCount,
        opts,
        toks
      );
      const precomputed = renderJankoCrop(
        BRAHMS,
        window.measureStart,
        window.measureCount,
        opts,
        toks,
        undefined,
        layouts
      );
      assert.equal(
        precomputed,
        standalone,
        `Candidate ${candidate.id} window mm. ${window.measureStart}–${window.measureStart + window.measureCount - 1} must be byte-identical`
      );
    }
  }
});

test('Output equivalence: Full page spread is byte-identical standalone vs precomputed', () => {
  const bLayouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  const totalBrahmsPages = countJankoPages(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  assert.equal(totalBrahmsPages, 5, 'Brahms canonical fixed-3 produces 5 pages');

  for (let p = 0; p < totalBrahmsPages; p++) {
    const standalone = renderJankoPage(BRAHMS, p, BRAHMS_OPTS, BRAHMS_TOKS);
    const precomputed = renderJankoPage(BRAHMS, p, BRAHMS_OPTS, BRAHMS_TOKS, bLayouts);
    assert.equal(precomputed, standalone, `Brahms page ${p + 1} must be byte-identical`);
  }

  const bachLayouts = layoutJankoScore(BACH, BACH_OPTS, BACH_TOKS);
  const bachStandalone = renderJankoPage(BACH, 0, BACH_OPTS, BACH_TOKS);
  const bachPrecomputed = renderJankoPage(BACH, 0, BACH_OPTS, BACH_TOKS, bachLayouts);
  assert.equal(bachPrecomputed, bachStandalone, 'Bach page 1 must be byte-identical');
});

test('Output equivalence: renderSystemsBody is byte-identical standalone vs precomputed', () => {
  const geo = computePageGeometry(BRAHMS_OPTS, BRAHMS_TOKS, BRAHMS);
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);

  const standalone = renderSystemsBody(BRAHMS, geo, 0, 3, BRAHMS_OPTS, BRAHMS_TOKS);
  const precomputed = renderSystemsBody(BRAHMS, geo, 0, 3, BRAHMS_OPTS, BRAHMS_TOKS, layouts);
  assert.equal(precomputed, standalone, 'renderSystemsBody systems 0..3 must be byte-identical');
});

test('Output equivalence: renderJankoCrop accepts caption string or precomputed layouts in parameter 6', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  const withUndefCaption = renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS, undefined, layouts);
  const withLayoutsAtParam6 = renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS, layouts as any);
  assert.equal(withLayoutsAtParam6, withUndefCaption, 'Passing layouts at parameter 6 produces identical SVG');
});

// ---------------------------------------------------------------------------
// 2. Deterministic Computation Counts
// ---------------------------------------------------------------------------

test('Deterministic counts: crop frame and renderSystemsBody share computed layouts (standalone calls invoke layoutJankoScore exactly once)', () => {
  let calls = 0;
  setLayoutJankoScoreObserver(() => {
    calls++;
  });

  try {
    calls = 0;
    renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS);
    assert.equal(
      calls,
      1,
      'Standalone renderJankoCrop must call layoutJankoScore exactly once (crop frame and body share it)'
    );

    const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
    calls = 0;
    renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS, undefined, layouts);
    assert.equal(
      calls,
      0,
      'Precomputed renderJankoCrop must call layoutJankoScore exactly zero times'
    );
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

test('Deterministic counts: renderJankoPage and renderSystemsBody with precomputed layout make zero layout calls', () => {
  let calls = 0;
  setLayoutJankoScoreObserver(() => {
    calls++;
  });

  try {
    const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
    const geo = computePageGeometry(BRAHMS_OPTS, BRAHMS_TOKS, BRAHMS);

    calls = 0;
    renderJankoPage(BRAHMS, 0, BRAHMS_OPTS, BRAHMS_TOKS, layouts);
    assert.equal(calls, 0, 'Precomputed renderJankoPage makes 0 layout calls');

    calls = 0;
    renderSystemsBody(BRAHMS, geo, 0, 1, BRAHMS_OPTS, BRAHMS_TOKS, layouts);
    assert.equal(calls, 0, 'Precomputed renderSystemsBody makes 0 layout calls');
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

test('Deterministic counts: renderCandidatesView computes each candidate layout once per score and reuses across windows', () => {
  let contentAwareCalls = 0;
  setLayoutJankoScoreObserver((score, o) => {
    if (isContentAwarePlacement(o)) contentAwareCalls++;
  });

  try {
    // Score candidate configuration (Round 37) computes layout once per score
    const scoreConfig = createStudioConfig({
      candidates: ROUND_37_CANDIDATES,
      round: ROUND_37_METADATA,
    });
    contentAwareCalls = 0;
    renderCandidatesView(scoreConfig);
    // 2 candidates * 2 scores * (1 lint call + 1 candidate layout) = 8 calls.
    assert.equal(
      contentAwareCalls,
      8,
      'renderCandidatesView with score candidates must invoke content-aware layout exactly 8 times'
    );

    // Abstract candidate configuration (Round 39) makes zero score layout calls
    const abstractConfig = createStudioConfig({
      candidates: ROUND_39_CANDIDATES,
      round: ROUND_39_METADATA,
    });
    contentAwareCalls = 0;
    renderCandidatesView(abstractConfig);
    assert.equal(
      contentAwareCalls,
      0,
      'renderCandidatesView with abstract candidates makes zero score layout calls'
    );
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

test('Deterministic counts: renderReferenceView computes Brahms reference layout once and reuses across pages and crops', () => {
  let contentAwareCalls = 0;
  setLayoutJankoScoreObserver((score, o) => {
    if (isContentAwarePlacement(o)) contentAwareCalls++;
  });

  try {
    const config = createStudioConfig();
    contentAwareCalls = 0;
    renderReferenceView(config);
    // 1 lint call + 1 layout call reused across all 5 pages and all 3 crops = 2 calls.
    // Previously: 1 lint + 5 pages + 3 crops * 2 = 12 calls.
    assert.equal(
      contentAwareCalls,
      2,
      'renderReferenceView must invoke content-aware layout exactly 2 times (1 lint + 1 layout for all pages and crops)'
    );
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

test('Deterministic counts: renderStudioMarkup eliminates redundant content-aware calls across windows and pages', () => {
  let contentAwareCalls = 0;
  setLayoutJankoScoreObserver((score, o) => {
    if (isContentAwarePlacement(o)) contentAwareCalls++;
  });

  try {
    // Score candidates: Reference view (2) + Candidates view (8) = 10 calls
    const scoreConfig = createStudioConfig({
      candidates: ROUND_37_CANDIDATES,
      round: ROUND_37_METADATA,
    });
    contentAwareCalls = 0;
    renderStudioMarkup(scoreConfig);
    assert.equal(
      contentAwareCalls,
      10,
      'renderStudioMarkup with score candidates makes exactly 10 content-aware layout calls'
    );

    // Abstract candidates: Reference view (2) + Candidates view (0) = 2 calls
    const abstractConfig = createStudioConfig({
      candidates: ROUND_39_CANDIDATES,
      round: ROUND_39_METADATA,
    });
    contentAwareCalls = 0;
    renderStudioMarkup(abstractConfig);
    assert.equal(
      contentAwareCalls,
      2,
      'renderStudioMarkup with abstract candidates makes exactly 2 content-aware layout calls (Reference view only)'
    );
  } finally {
    setLayoutJankoScoreObserver(null);
  }
});

// ---------------------------------------------------------------------------
// 3. Fresh Data/Options/Tokens Across Renders (No Stale HMR Reuse, No Cross-Render Cache)
// ---------------------------------------------------------------------------

test('Fresh data/options/tokens: subsequent render with changed options computes fresh layout without stale cache', () => {
  const config1 = createStudioConfig();
  const config2 = createStudioConfig({
    scores: {
      ...createStudioConfig().scores,
      [BRAHMS_STUDIO_SCORE_ID]: {
        ...createStudioConfig().scores[BRAHMS_STUDIO_SCORE_ID],
        tokens: resolveJankoTokens({
          ...createStudioConfig().scores[BRAHMS_STUDIO_SCORE_ID].tokens,
          semitoneScale: 6.0, // Modified scale
        }),
      },
    },
  });

  const markup1 = renderStudioMarkup(config1);
  const markup2 = renderStudioMarkup(config2);

  // Both renders succeed and produce distinct SVG geometry reflecting the changed tokens
  assert.notEqual(markup1, markup2, 'Changing semitoneScale must produce different markup across renders');
});

test('Fresh data/options/tokens: candidate configurations remain separate from each other', () => {
  // Round 37 score candidates have different clusterPresentation options
  assert.equal(ROUND_37_CANDIDATES.length, 2);
  const [candA, candB] = ROUND_37_CANDIDATES;

  const optsA = resolveJankoOptions({ ...BRAHMS_OPTS, ...(candA.options ?? {}) });
  const optsB = resolveJankoOptions({ ...BRAHMS_OPTS, ...(candB.options ?? {}) });

  assert.equal(optsA.clusterPresentation, 'literal');
  assert.equal(optsB.clusterPresentation, 'indexed-symmetric');

  const svgA = renderJankoCrop(BRAHMS, 8, 2, optsA, BRAHMS_TOKS);
  const svgB = renderJankoCrop(BRAHMS, 8, 2, optsB, BRAHMS_TOKS);

  assert.notEqual(svgA, svgB, 'Literal baseline and indexed symmetric produce distinct SVGs');

  // The parked Round 41 candidates (imported from their own suite) still
  // produce distinct SVGs: identical layout ink, three different terminal
  // shapes. See test/janko-round41.test.ts for the live-round proofs.
  assert.equal(ROUND_41_CANDIDATES.length, 3);
  // The studio engraves a candidate window as **entry options + candidate
  // delta** (the Brahms goldens are that entry: mps 4, cut time, anacrusis).
  const optFor = (c: (typeof ROUND_41_CANDIDATES)[number]) =>
    resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, ...(c.options ?? {}) });
  const tokFor = (c: (typeof ROUND_41_CANDIDATES)[number]) =>
    resolveJankoTokens({ ...BRAHMS_OP118_NO1_JANKO_TOKENS, ...(c.tokens ?? {}) });
  const svg0 = renderJankoCrop(BRAHMS, 8, 1, optFor(ROUND_41_CANDIDATES[0]), tokFor(ROUND_41_CANDIDATES[0]));
  const svg1 = renderJankoCrop(BRAHMS, 8, 1, optFor(ROUND_41_CANDIDATES[1]), tokFor(ROUND_41_CANDIDATES[1]));
  const svg2 = renderJankoCrop(BRAHMS, 8, 1, optFor(ROUND_41_CANDIDATES[2]), tokFor(ROUND_41_CANDIDATES[2]));
  for (const svg of [svg0, svg1, svg2]) {
    assert.ok(svg.includes('janko-hold-layer'), 'the hold layer paints in the window');
    assert.ok(svg.includes('janko-hold-connector'), 'the shared connector paints');
  }
  assert.notEqual(svg0, svg1, 'Stop bar and diamond endpoints produce distinct SVGs');
  assert.notEqual(svg0, svg2, 'Stop bar and ring endpoints produce distinct SVGs');
  assert.notEqual(svg1, svg2, 'Diamond and ring endpoints produce distinct SVGs');
});

// ---------------------------------------------------------------------------
// 4. Mismatched Precomputed Layout Validation
// ---------------------------------------------------------------------------

test('Mismatched precomputed layouts: isMatchingPrecomputedLayouts validates system count and measuresPerSystem', () => {
  const layouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);
  const total = countJankoSystems(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS);

  assert.equal(isMatchingPrecomputedLayouts(layouts, total, BRAHMS_OPTS.measuresPerSystem), true);
  assert.equal(isMatchingPrecomputedLayouts(null, total, BRAHMS_OPTS.measuresPerSystem), false);
  assert.equal(isMatchingPrecomputedLayouts(undefined, total, BRAHMS_OPTS.measuresPerSystem), false);
  assert.equal(isMatchingPrecomputedLayouts([] as any, total, BRAHMS_OPTS.measuresPerSystem), false);
  assert.equal(isMatchingPrecomputedLayouts(layouts.slice(0, 2), total, BRAHMS_OPTS.measuresPerSystem), false);
  assert.equal(isMatchingPrecomputedLayouts(layouts, total, BRAHMS_OPTS.measuresPerSystem + 1), false);
});

test('Mismatched precomputed layouts: renderJankoCrop falls back safely to standalone layout on mismatch', () => {
  // If an incomplete array is passed, renderJankoCrop must not crash or output invalid SVG; it computes fresh layout.
  const partialLayouts = layoutJankoScore(BRAHMS, BRAHMS_OPTS, BRAHMS_TOKS).slice(0, 1);
  const expected = renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS);
  const fallback = renderJankoCrop(BRAHMS, 1, 2, BRAHMS_OPTS, BRAHMS_TOKS, undefined, partialLayouts);
  assert.equal(fallback, expected, 'Fallback output must match standalone output exactly');
});
