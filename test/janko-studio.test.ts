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
  getCandidate,
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
  DEFAULT_STUDIO_CROPS,
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
assert.ok(resolveCandidate(CURRENT_CANDIDATES[0]).windows.length > 0);

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
  assert.equal((grid.match(/<svg/g) ?? []).length, windows, 'one card preview per declared window');
  assert.equal(
    (html.match(/<svg/g) ?? []).length - (grid.match(/<svg/g) ?? []).length,
    CURRENT_CANDIDATES.length,
    'one strip panel per card'
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
  assert.match(html, /Round 26/);
  assert.match(html, /0-Line/);
});

test('Round 26 is an anchor round: one axis, four answers to one question', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 26);
  assert.match(CURRENT_ROUND_METADATA.title, /0-Line/);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['octaveLineScheme'],
    'one axis, one card per scheme'
  );
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    ['scheme-control', 'scheme-centers', 'scheme-boundaries', 'scheme-clef'],
    'the control and the schemes, in display order'
  );
  // The control is the firm anchor grid: the round mapping, no axis.
  const control = getCandidate('scheme-control')!;
  assert.deepEqual(
    Object.keys(control.options ?? {}),
    ['pitchMapping'],
    'the control states only the round mapping'
  );
  assert.equal(control.tokens, undefined, 'the control states no micro token');
  assert.equal(control.axis, undefined, 'the control declares no axis');
  assert.deepEqual(
    candidateBadges(control),
    [{ key: 'pitchMapping', value: 'continuous', golden: 'twin-rows' }],
    'the control badges its mapping delta, never an axis'
  );
  // Every scheme card owns exactly its axis and shows the shared windows.
  for (const candidate of CURRENT_CANDIDATES) {
    if (candidate.id === 'scheme-control') continue;
    assert.equal(candidate.axis, 'octaveLineScheme', `${candidate.id} owns the scheme axis`);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}).sort(),
      ['octaveLineScheme', 'pitchMapping'],
      `${candidate.id} states the axis plus the round mapping`
    );
    const resolved = resolveCandidate(candidate);
    assert.equal(resolved.windows.length, 2, `${candidate.id} shows the shared windows`);
    for (const window of resolved.windows) {
      assert.ok(window.title.length > 20, `${candidate.id} titles every window`);
    }
  }
  // The golden context every card inherits, unchanged.
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
});

test('Candidate previews honour their own option deltas', () => {
  const html = renderCandidatesView(CONFIG);
  const cardOf = (id: string): string => {
    const card = html.slice(html.indexOf(`data-candidate="${id}"`));
    return card.slice(0, card.indexOf('</article>'));
  };

  // Every paradigm badges its own axis as a delta; the control states the
  // round mapping and badges that delta, never an axis.
  assert.equal((html.match(/badge-axis/g) ?? []).length, 3, 'one axis badge per scheme card');
  assert.equal((html.match(/badge-delta/g) ?? []).length, 7, 'mapping context on every card plus the axis on three');
  for (const candidate of CURRENT_CANDIDATES) {
    const card = cardOf(candidate.id);
    if (candidate.id === 'scheme-control') {
      assert.match(card, /<b>pitchMapping<\/b>/, 'the control states the round mapping');
    } else {
      assert.match(card, new RegExp(`<b>${candidate.axis}</b>`), `${candidate.id} badges its axis`);
    }
    assert.match(card, /data-lint="clean"/, `${candidate.id} lint verdict: clean`);
    assert.match(card, /chip chip-ok/, `${candidate.id} reports its clean chip`);
    assert.equal(
      (card.match(/data-window="/g) ?? []).length,
      resolveCandidate(candidate).windows.length,
      `${candidate.id} engraves exactly its declared window set`
    );
  }

  // The settled decisions ride along as shared context and are never badged.
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
  ]) {
    assert.ok(!html.includes(`<b>${key}</b>`), `${key} is shared context, never a Round 26 question`);
  }
  assert.doesNotMatch(html, /open-halo/, 'the retired open margin appears nowhere');

  // The shared windows are the round's own evidence: page 1 plus the macro.
  for (const candidate of CURRENT_CANDIDATES) {
    const card = cardOf(candidate.id);
    assert.ok(card.includes('data-window="primary:1-16"'), `${candidate.id} shows page 1`);
    assert.ok(card.includes('data-window="primary:1-2"'), `${candidate.id} shows the macro`);
  }

  // The settled clasp grammar and grid policy are stated in the card facts.
  for (const candidate of CURRENT_CANDIDATES) {
    const card = cardOf(candidate.id);
    assert.match(card, /clasp 2\.8pt offset \/ 4\.0pt barline air/, `${candidate.id} tokens`);
    assert.match(card, /chord grouping per-hand-clasp/, `${candidate.id} grouping fact`);
    assert.match(
      card,
      new RegExp(
        `grid ${DEFAULT_JANKO_OPTIONS.gridWritingPolicy} · system start ${DEFAULT_JANKO_OPTIONS.systemStartStyle}`
      ),
      `${candidate.id} states the settled grid policy and the canonical start`
    );
  }
});

// ---------------------------------------------------------------------------
// 2. Golden Reference Object
// ---------------------------------------------------------------------------

test('renderReferenceView renders the golden page spread and macro crops', () => {
  const html = renderReferenceView(CONFIG);
  const pages = html.match(/data-page="/g) ?? [];
  const crops = html.match(/data-crop="/g) ?? [];
  assert.equal(pages.length, 2, 'Round 17: Bach Var. 1 is a two-page spread (4 systems/page)');
  assert.equal(crops.length, DEFAULT_STUDIO_CROPS.length);
  assert.equal((html.match(/<svg/g) ?? []).length, pages.length + crops.length);
  for (const crop of DEFAULT_STUDIO_CROPS) {
    assert.ok(
      html.includes(`data-crop="${crop.start}-${crop.start + crop.count - 1}"`),
      `crop ${crop.title}`
    );
  }
  assert.match(html, /Golden Master/);
  assert.match(html, /Goldberg Variations/);
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
  const report = html.match(/data-lint-ok="(\w+)"/);
  assert.equal(report?.[1], 'true', 'the golden master lints clean');
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
    !html.includes(`data-candidate="${CURRENT_CANDIDATES[0].id}"`),
    'registry entries are not hardcoded'
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
  assert.match(line, /0 violations · 0 warnings/);
  assert.match(line, /8 systems · 550 noteheads/, 'the merged unison paints one head');
  assert.match(line, /rendered live at 12:34:56Z/);
});

test('Round metadata is exported and drives the view headline', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 26);
  assert.match(CURRENT_ROUND_METADATA.title, /0-Line/);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['octaveLineScheme'],
    'one axis, one card per scheme'
  );
  assert.equal(CURRENT_CANDIDATES.length, 4, 'the control and the schemes');
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
