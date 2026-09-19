/**
 * Two-View Live Studio — architecture invariant suite.
 *
 * Covers:
 *  1. `renderCandidatesView()` renders every card declared in the registry, on
 *     **every engraving window it declares** (Round 21 is a verification round:
 *     four golden cards over the rest specimen, the Bach flag measures, the
 *     Brahms seats and unisons, and the nib case), with labels, the golden
 *     baseline badge, lint chips and SVG previews.
 *  2. `renderReferenceView()` renders the Golden Master: the full page spread
 *     (every page carries glyphs) plus the macro focus crops, based on
 *     `DEFAULT_JANKO_OPTIONS`.
 *  3. The candidate registry is the single source of truth — adding an entry
 *     needs five lines and zero template edits.
 *  4. `janko.html` provides seamless two-view navigation, in-browser zoom and
 *     Vite HMR auto-refresh, and is mirrored byte-for-byte into `public/` so
 *     the dev server and the production build serve the same page.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import { buildChordDurationSpecimenScore } from '../src/scores/chord-duration-specimen';
import { REST_DURATION_SPECIMEN_VALUES } from '../src/scores/rest-duration-specimen';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { countJankoPages, renderJankoPage } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
  resolveCandidate,
} from '../src/render/janko/candidates';
import {
  BRAHMS_STUDIO_SCORE_ID,
  DEFAULT_STUDIO_SCORE_ID,
  DURATION_SPECIMEN_STUDIO_SCORE_ID,
  REST_SPECIMEN_STUDIO_SCORE_ID,
  SPECIMEN_STUDIO_SCORE_ID,
} from '../src/render/janko/candidates';
import {
  BRAHMS_STUDIO_CROPS,
  createStudioConfig,
  mountJankoStudio,
  renderCandidatesView,
  renderReferenceView,
  renderStatusLine,
  renderStudioMarkup,
} from '../src/render/janko/studio';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const SCORE = buildBachGoldbergVar1Score();
const BRAHMS = buildBrahmsOp118No1Score();
const SPECIMEN = buildChordDurationSpecimenScore();
const CONFIG = createStudioConfig({ score: SCORE });
assert.equal(CURRENT_CANDIDATES.length, 2, 'Round 36 open: the mirrored handprint pair');

/** The studio HTML-escapes labels and rationales before printing them. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function read(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Decision Candidates Matrix
// ---------------------------------------------------------------------------

test('renderCandidatesView renders every scheme card on every declared window', () => {
  const html = renderCandidatesView(CONFIG);
  const windows = CURRENT_CANDIDATES.reduce(
    (sum, candidate) => sum + resolveCandidate(candidate).windows.length,
    0
  );
  assert.equal((html.match(/data-candidate="/g) ?? []).length, CURRENT_CANDIDATES.length);
  const grid = html.slice(html.indexOf('candidate-grid'));
  const stripPanels = CURRENT_ROUND_METADATA.compareStrip ? CURRENT_CANDIDATES.length : 0;
  assert.equal(
    (html.match(/<svg/g) ?? []).length - (grid.match(/<svg/g) ?? []).length,
    stripPanels,
    'strip panels match compareStrip declaration'
  );
  assert.equal((html.match(/data-window="/g) ?? []).length, windows);
  for (const candidate of CURRENT_CANDIDATES) {
    const card = html.slice(html.indexOf(`data-candidate="${candidate.id}"`));
    const body = card.slice(0, card.indexOf('</article>'));
    assert.ok(body.includes(esc(candidate.label)), `${candidate.id} label`);
    assert.ok(body.includes(esc(candidate.description ?? '')), `${candidate.id} rationale`);
    for (const badge of candidateBadges(candidate)) {
      assert.ok(body.includes(`<b>${badge.key}</b>`), `${candidate.id} badge ${badge.key}`);
    }
    for (const window of resolveCandidate(candidate).windows) {
      const last = window.measureStart + window.measureCount - 1;
      assert.ok(
        body.includes(`data-window="${window.scoreId}:${window.measureStart}-${last}"`),
        `${candidate.id} engraves ${window.scoreId} mm. ${window.measureStart}–${last}`
      );
    }
    assert.equal(
      (body.match(/data-window="/g) ?? []).length,
      resolveCandidate(candidate).windows.length,
      `${candidate.id} renders all its declared windows and no others`
    );
  }
  assert.match(html, /Round 37/);
  assert.match(html, /indexed symmetric/i);
});

test('Round 37 open: indexed symmetric cluster candidate, one axis, two cards', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 37);
  assert.match(CURRENT_ROUND_METADATA.title, /indexed symmetric/i);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['clusterPresentation'], 'one open axis');
  assert.equal(CURRENT_CANDIDATES.length, 2, 'two cards');
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.id),
    ['indexed-symmetric-literal', 'indexed-symmetric'],
    'the Control and A candidate'
  );
  // The golden context the Reference view engraves, unchanged.
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  assert.equal(golden.clusterSpacing, 'tight', 'the decided spacing golden');
  assert.equal(golden.restStyle, 'classical-urtext', 'the settled rest dialect');
  assert.equal(golden.subdivisionStyle, 'classical-urtext', 'the settled flag cut');
  assert.equal(golden.gridWritingPolicy, 'overlaid-beat-grid', 'grid candidate C is locked');
  assert.equal(golden.systemStartStyle, 'architectural-bracket', 'the flared bracket is locked');
  assert.equal(golden.chordGrouping, 'per-hand-clasp', 'the per-hand clasp is locked');
  assert.equal(golden.systemsPerPage, 4, 'four systems per page is locked');
  assert.equal(golden.octaveLineScheme, 'grand-divider', 'the divider grid is the default scheme');
  assert.equal(golden.showPitchLabels, false, 'margin landmarks stay off unless asked');
  assert.ok(
    !('clusterAnchor' in golden),
    'the retired cluster anchor is gone from the golden master'
  );
  assert.ok(!('dotRule' in golden), 'the retired dot option is gone from the golden master');
  assert.ok(
    !('extensionWeight' in golden),
    'the retired thin option is gone from the golden master'
  );
  assert.equal(golden.durationGrammar, 'golden', 'the incomplete grammar is the incumbent');
  assert.deepEqual(golden.claspDotNudge, [0, 0], 'the judged clasp-dot seats are the default');
  assert.equal(golden.gridPulseFilter, 'all', 'the full interior grid is the default');
  assert.equal(
    golden.correctPageTopAnacrusisMeasureWidth,
    false,
    'the page-top correction is opt-in'
  );
});

test('The open studio renders the two indexed-symmetric cards on twelve declared windows', () => {
  const html = renderCandidatesView(CONFIG);

  // Two cards × six windows: control + A on mm.7–9, mm.46–47, mm.60–61, mm.66–67, m.71, and synthetic diagnostic.
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 2, 'two cards');
  assert.equal((html.match(/data-window="/g) ?? []).length, 12, 'twelve windows');
  assert.match(html, /data-candidate-count="2"/);
  assert.match(html, /data-window-count="12"/);
  assert.ok(!html.includes('data-decided="true"'), 'the open round is not marked decided');
  assert.match(html, /Round 37/);
  assert.ok(!html.includes('data-window="primary:"'), 'Bach carries no window this round');
  assert.ok(html.includes('data-window="brahms-op118-no1:7-9"'), 'the mm.7-9 window');
  assert.ok(html.includes('data-window="brahms-op118-no1:46-47"'), 'the mm.46-47 window');
  assert.ok(html.includes('data-window="brahms-op118-no1:60-61"'), 'the mm.60-61 window');
  assert.ok(html.includes('data-window="brahms-op118-no1:66-67"'), 'the mm.66-67 window');
  assert.ok(html.includes('data-window="brahms-op118-no1:71-71"'), 'the m.71 window');
  assert.ok(html.includes('data-window="synthetic-m8-diagnostic:1-1"'), 'the synthetic diagnostic window');

  // No settled decision is badged as an open question.
  for (const key of [
    'chordGrouping',
    'systemStartStyle',
    'gridWritingPolicy',
    'stemAttachmentStyle',
    'clusterSpacing',
    'subdivisionStyle',
    'claspDurationStyle',
    'restStyle',
    'clusterAnchor',
    'core',
    'dotRule',
    'extensionWeight',
    'durationGrammar',
    'claspDotNudge',
  ]) {
    assert.ok(!html.includes(`<b>${key}</b>`), `${key} is settled context, never an open question`);
  }
  assert.doesNotMatch(html, /open-halo/, 'the retired open margin appears nowhere');

  // No control card: the Reference view is the standing control.
  assert.ok(!html.includes('data-candidate="control"'), 'no control card');

  // The Reference view still carries the whole golden master, both scores.
  const reference = renderReferenceView(CONFIG);
  assert.match(reference, /Golden Master/);
  assert.match(reference, /GOLD · frozen standard/, 'the GOLD badge');
  assert.match(reference, /BRONZE · active surface/, 'the BRONZE badge');
  const brahmsAt = reference.indexOf('data-score="brahms-op118-no1"');
  const bachAt = reference.indexOf('data-score="primary"');
  const brahms = reference.slice(brahmsAt, bachAt);
  assert.ok(brahms.includes('data-lint-ok="true"'), 'the BRONZE block reports honestly clean');
  // The GOLD chip is a STOP tripwire while the Goldberg delta is
  // unadjudicated — see 'STOP tripwire: GOLD Bach block lints clean' below.
});

test('STOP tripwire (unlanded): GOLD Bach block lints clean in the Reference view', () => {
  // The settled refinements moved Goldberg (tick-1632 joint slot plus rest
  // reseats): Bach carries 1 violation until the architect/operator
  // adjudicates. Preserved, not rebased — see
  // test/janko-goldberg-frozen.test.ts.
  const reference = renderReferenceView(CONFIG);
  const bachAt = reference.indexOf('data-score="primary"');
  const bach = reference.slice(bachAt);
  assert.ok(bach.includes('data-lint-ok="true"'), 'the GOLD score lints clean');
});

// ---------------------------------------------------------------------------
// 2. Golden Reference Object
// ---------------------------------------------------------------------------

test('renderReferenceView renders the golden page spread and macro crops', () => {
  const html = renderReferenceView(CONFIG);
  // Two golden scores since Round 30, each in its own scored block.
  const blocks = html.match(/data-score="/g) ?? [];
  assert.equal(blocks.length, 2, 'Bach + Brahms reference blocks');
  // Brahms leads since the ergonomics ticket (Brahms is live); Bach follows.
  const brahmsAt = html.indexOf('data-score="brahms-op118-no1"');
  const bachAt = html.indexOf('data-score="primary"');
  assert.ok(brahmsAt < bachAt, 'the BRONZE Brahms block precedes the GOLD Bach block');
  const brahms = html.slice(brahmsAt, bachAt);
  const bach = html.slice(bachAt);
  const bachPages = bach.match(/data-page="/g) ?? [];
  const brahmsPages = brahms.match(/data-page="/g) ?? [];
  assert.equal(bachPages.length, 2, 'Round 17: Bach Var. 1 is a two-page spread (4 systems/page)');
  assert.equal(brahmsPages.length, 5, 'Brahms ships the judged five-page spread (4/system, 4-up, 18 systems)');
  const bachCrops = bach.match(/data-crop="/g) ?? [];
  const brahmsCrops = brahms.match(/data-crop="/g) ?? [];
  assert.equal(bachCrops.length, 0, 'Bach focus crops dropped by operator order (spread stays)');
  assert.equal(brahmsCrops.length, BRAHMS_STUDIO_CROPS.length);
  assert.equal(
    (html.match(/<svg/g) ?? []).length,
    bachPages.length + brahmsPages.length + bachCrops.length + brahmsCrops.length
  );
  for (const crop of BRAHMS_STUDIO_CROPS) {
    assert.ok(
      brahms.includes(`data-crop="${crop.start}-${crop.start + crop.count - 1}"`),
      `Brahms crop ${crop.title}`
    );
  }
  assert.match(html, /Golden Master/);
  assert.match(html, /Goldberg Variations/);
  assert.match(html, /Intermezzo in A minor/);
  assert.match(html, /Live linter/);
});

test('Reference view is rendered from DEFAULT_JANKO_OPTIONS (the golden master)', () => {
  const html = renderReferenceView(CONFIG);
  assert.match(html, new RegExp(`<b>middleCSpine</b> = ${DEFAULT_JANKO_OPTIONS.middleCSpine}`));
  assert.match(html, new RegExp(`<b>interStaffGap</b> = ${DEFAULT_JANKO_OPTIONS.interStaffGap.toFixed(1)}pt`));
  assert.match(html, new RegExp(`<b>rhythmStyle</b> = ${DEFAULT_JANKO_OPTIONS.rhythmStyle}`));
  assert.match(
    html,
    new RegExp(`<b>noteheadRadius</b> = ${DEFAULT_JANKO_TOKENS.noteheadRadius.toFixed(1)}pt`)
  );
  const reports = html.match(/data-lint-ok="(\w+)"/g) ?? [];
  assert.equal(reports.length, 2, 'one lint verdict per golden score');
  const brahmsAt = html.indexOf('data-score="brahms-op118-no1"');
  const bachAt = html.indexOf('data-score="primary"');
  const brahms = html.slice(brahmsAt, bachAt);
  // The GOLD chip is a STOP tripwire while the Goldberg delta is
  // unadjudicated (see above); BRONZE reports its clean surface honestly.
  assert.ok(brahms.includes('data-lint-ok="true"'), 'the BRONZE score reports clean');
});

test('Every page of the spread is engraved (no silently blank page)', () => {
  const totalPages = countJankoPages(SCORE, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
  assert.equal(totalPages, 2, 'four systems per page pack 32 measures into two pages');
  for (let page = 0; page < totalPages; page++) {
    const svg = renderJankoPage(SCORE, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
    assert.match(svg, new RegExp(`id="system-${page * DEFAULT_JANKO_OPTIONS.systemsPerPage + 1}"`));
    assert.ok((svg.match(/class="janko-digit"/g) ?? []).length > 100, `page ${page + 1} has glyphs`);
    assert.match(svg, new RegExp(`Page ${page + 1} of ${totalPages}`));
  }
});

// ---------------------------------------------------------------------------
// 3. Declarative registry invariant
// ---------------------------------------------------------------------------

test('Adding a candidate to the registry needs zero template edits', () => {
  const synthetic = [
    {
      id: 'probe-round-candidate',
      label: 'Probe · Synthetic Candidate',
      description: 'Declared only in the test.',
      options: { middleCSpine: 'continuous' as const, interStaffGap: 39.0 },
    },
    { id: 'probe-second', label: 'Probe · Second', options: { rhythmStyle: 'angled-cuts' as const } },
  ];
  const config = createStudioConfig({
    score: SCORE,
    candidates: synthetic,
    round: { round: 99, title: 'Probe Round', description: 'Synthetic.' },
  });
  const html = renderCandidatesView(config);
  assert.equal((html.match(/data-candidate="/g) ?? []).length, 2);
  assert.match(html, /data-candidate-count="2"/);
  assert.match(html, /data-candidate="probe-round-candidate"/);
  assert.match(html, /data-candidate="probe-second"/);
  assert.match(html, /Probe Round/);
  assert.ok(
    !html.includes('data-candidate="dots-new"'),
    'consumed registry entries render nowhere — nothing is hardcoded'
  );
  assert.ok((html.match(/<svg/g) ?? []).length === 2);
});

test('The registry never imports engine internals', () => {
  const source = read('src/render/janko/candidates.ts');
  const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(imports)], ['./types'], 'candidates.ts only depends on the token types');
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(!source.includes('renderJanko'), 'no renderer calls in the registry');
    assert.ok(candidate.id.length > 0 && candidate.label.length > 0);
  }
});

// ---------------------------------------------------------------------------
// 4. The live page: navigation, zoom, HMR
// ---------------------------------------------------------------------------

test('janko.html provides two-view navigation, zoom controls and the HMR entry', () => {
  const html = read('janko.html');
  assert.match(html, /data-view-target="candidates"/);
  assert.match(html, /data-view-target="reference"/);
  assert.match(html, /id="janko-studio"/);
  assert.match(html, /id="janko-zoom-in"/);
  assert.match(html, /id="janko-zoom-out"/);
  assert.match(html, /id="janko-zoom-reset"/);
  assert.match(html, /id="janko-zoom-label"/);
  assert.match(html, /id="janko-status"/);
  assert.match(html, /<script type="module" src="\/src\/render\/janko\/studio\.ts"><\/script>/);
  assert.ok(!/\.png/.test(html), 'the studio no longer depends on pre-rendered PNGs');
  assert.ok(!/localhost/i.test(html), 'no localhost references (remote Tailscale access only)');
});

test('public/janko.html is a byte-identical mirror of the Vite entry', () => {
  const root = read('janko.html');
  const mirror = read('public/janko.html');
  assert.equal(mirror, root, 'the dev-server mirror must never drift from the Vite entry');
});

test('studio.ts wires Vite HMR and re-mounts in place', () => {
  const source = read('src/render/janko/studio.ts');
  assert.match(source, /import\.meta\.hot/);
  // A bare accept() is required: a callback would re-mount from the *previous*
  // module instance and clobber the fresh render with stale tokens.
  assert.match(source, /import\.meta\.hot\.accept\(\);/);
  assert.match(source, /mountJankoStudio/);
  // No candidate-specific strings may leak into the template. The channel
  // *layout* vocabulary ('single-equator', …) is shared with the type system
  // and deliberately drives the geometry summary; what must never appear is a
  // candidate label or a hardcoded card.
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(!source.includes(candidate.label), `studio.ts must not mention ${candidate.label}`);
    assert.ok(
      !source.includes(`data-candidate="${candidate.id}"`),
      `studio.ts must not hardcode the ${candidate.id} card`
    );
  }
});

test('The studio score library exposes the benchmarks and the curated specimens to windows', () => {
  const ids = Object.keys(CONFIG.scores);
  assert.ok(ids.includes(DEFAULT_STUDIO_SCORE_ID), 'the primary benchmark is registered');
  assert.ok(ids.includes(BRAHMS_STUDIO_SCORE_ID), 'the Brahms pressure benchmark is registered');
  const brahms = CONFIG.scores[BRAHMS_STUDIO_SCORE_ID];
  assert.equal(brahms.id, BRAHMS_STUDIO_SCORE_ID);
  assert.equal(brahms.options.anacrusisTicks, 48, 'cut-time upbeat preserved');
  assert.equal(brahms.options.ticksPerMeasure, 192);
  assert.equal(brahms.tokens.ticksPerMeasure, 192);
  // Round 10: the curated wide-span specimen is a first-class window score,
  // two measures wide so its five 1.5-octave chords and their scaled marks stay
  // legible.
  assert.ok(ids.includes(SPECIMEN_STUDIO_SCORE_ID), 'the chord-duration specimen is registered');
  const specimen = CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID];
  assert.equal(specimen.id, SPECIMEN_STUDIO_SCORE_ID);
  assert.equal(specimen.options.measuresPerSystem, 2);
  assert.equal(specimen.score.notes.length, 20, 'five four-voice wide-span chords');
  assert.deepEqual(
    [...new Set(specimen.score.notes.map((n) => n.durationTicks))].sort((a, b) => b - a),
    [96, 72, 48, 24, 12],
    'the whole duration taxonomy'
  );
  const specimenReport = lintJankoScore(specimen.score, specimen.options, specimen.tokens);
  assert.equal(specimenReport.ok, true, 'the specimen engraves clean under the golden default');
  // Round 15: the curated rest-duration specimen is the dialect axis's window —
  // four measures across the staff width, one genuine silence per value, so the
  // four dialects are compared at macro scale on strictly clean material. It
  // rests this round and returns in 17B.
  assert.ok(ids.includes(REST_SPECIMEN_STUDIO_SCORE_ID), 'the rest-duration specimen is registered');
  const restSpecimen = CONFIG.scores[REST_SPECIMEN_STUDIO_SCORE_ID];
  assert.equal(restSpecimen.id, REST_SPECIMEN_STUDIO_SCORE_ID);
  assert.equal(restSpecimen.options.measuresPerSystem, 3);
  assert.equal(restSpecimen.options.ticksPerMeasure, 192, 'the 4/4 measure a whole bar needs');
  assert.equal(restSpecimen.tokens.ticksPerMeasure, 192, 'and its grid');
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((v) => v.value),
    ['sixteenth', 'eighth', 'quarter', 'half', 'whole', 'thirty-second', 'sixty-fourth'],
    'one genuine silence per standard rest value — Round 21 completes the set to the 64th'
  );
  // Round 21 §E: the constructed duration specimen is the working set's window —
  // 32nd/64th runs, mixed beam levels, lone partial beams and solo flags.
  assert.ok(ids.includes(DURATION_SPECIMEN_STUDIO_SCORE_ID), 'the duration specimen is registered');
  const durationSpecimen = CONFIG.scores[DURATION_SPECIMEN_STUDIO_SCORE_ID];
  assert.equal(durationSpecimen.id, DURATION_SPECIMEN_STUDIO_SCORE_ID);
  assert.equal(durationSpecimen.options.ticksPerMeasure, 192);
  assert.equal(
    durationSpecimen.score.gridResolution,
    3,
    'the specimen states 64ths, so its grid resolution is three ticks'
  );
  const durationReport = lintJankoScore(
    durationSpecimen.score,
    durationSpecimen.options,
    durationSpecimen.tokens
  );
  assert.equal(durationReport.ok, true, 'the constructed working set engraves clean');
  assert.equal(durationReport.warnings.length, 0, 'and adds no warning');
  assert.ok(
    [...REST_DURATION_SPECIMEN_VALUES].length === 7,
    'the rest specimen walks the complete working set'
  );
  const restReport = lintJankoScore(restSpecimen.score, restSpecimen.options, restSpecimen.tokens);
  assert.equal(restReport.ok, true, 'the dialect windows engrave clean under the golden default');
  // An unknown score id falls back to the primary score instead of blanking.
  const fallback = createStudioConfig({
    score: SCORE,
    scores: { [BRAHMS_STUDIO_SCORE_ID]: brahms },
  });
  assert.ok(fallback.scores[DEFAULT_STUDIO_SCORE_ID].score.notes.length > 0);
});

test('renderStudioMarkup contains both views and is DOM-free (SSR-safe)', () => {
  const markup = renderStudioMarkup(CONFIG);
  assert.match(markup, /id="view-candidates"/);
  assert.match(markup, /id="view-reference"/);
  assert.equal(mountJankoStudio(CONFIG), false, 'mounting without a DOM is a no-op');
});

test('renderStatusLine reports live lint statistics', () => {
  const line = renderStatusLine(CONFIG, new Date('2024-01-01T12:34:56Z'));
  // Goldberg is lint-clean (0/0): the tick-1632 inward slot steps its column
  // right to stay inside the beat cell (legitimate translation, demand still
  // reported in clusterDiagnostics). Rest-seat deltas remain unadjudicated
  // (see the GOLD hash tripwire); the line format itself stays pinned.
  assert.match(line, /✓ 0 violations · 0 warnings/, 'the line honestly reports the clean count');
  assert.match(line, /8 systems · 550 noteheads/, 'the merged unison paints one head');
  assert.match(line, /rendered live at 12:34:56Z/);
});

test('Round metadata is exported and drives the view headline', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 37);
  assert.match(CURRENT_ROUND_METADATA.title, /indexed symmetric/i);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['clusterPresentation'], 'one open axis');
  assert.equal(CURRENT_CANDIDATES.length, 2, 'two cards in the open round');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
  // The registry drives the rendered headline, never a hardcoded template string.
  const headline = renderCandidatesView(CONFIG);
  assert.match(headline, new RegExp(`Round ${CURRENT_ROUND_METADATA.round}`));
  assert.ok(
    headline.includes(esc(CURRENT_ROUND_METADATA.title)),
    'the view headline is the round title from the registry'
  );
});
