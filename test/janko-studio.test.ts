/**
 * Two-View Live Studio — architecture invariant suite.
 *
 * Covers:
 *  1. `renderCandidatesView()` renders every candidate declared in the
 *     registry, on **every engraving window it declares** (Round 9 judges a
 *     candidate on the Bach opening, the dense Brahms chords and the curated
 *     chord-duration specimen at once), with labels, option-delta badges, lint
 *     chips and SVG previews.
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
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { renderJankoPage, renderJankoVariantComparison } from '../src/render/janko/engine';
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

test('renderCandidatesView renders every registry candidate on every declared window', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal(
    (html.match(/data-candidate="/g) ?? []).length,
    CURRENT_CANDIDATES.length,
    'one card per registry entry'
  );
  assert.match(html, new RegExp(`data-candidate-count="${CURRENT_CANDIDATES.length}"`));
  const windows = CURRENT_CANDIDATES.reduce((n, c) => n + resolveCandidate(c).windows.length, 0);
  assert.equal((html.match(/<svg/g) ?? []).length, windows, 'one preview per declared window');
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
  }
  assert.match(html, /Round 13/);
  assert.match(html, /Voice Contour Rests/);
});

test('Round 13 registry pairs the four rest finalists with the flared bracket', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 13);
  assert.match(CURRENT_ROUND_METADATA.title, /Voice Contour Rests/);
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    [
      'classical-urtext-flared-bracket',
      'phantom-notehead-flared-bracket',
      'geometric-node-flared-bracket',
      'kinetic-monoline-flared-bracket',
    ],
    'candidates A–D in display order'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.restStyle),
    ['classical-urtext', 'phantom-notehead', 'geometric-node', 'kinetic-monoline'],
    'each candidate demonstrates one high-fidelity rest dialect'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.systemStartStyle),
    [
      'architectural-bracket',
      'architectural-bracket',
      'architectural-bracket',
      'architectural-bracket',
    ],
    'the flared 0.65pt bracket is standardized for the whole round'
  );
  // Round 13 keeps the settled clasp, the settled grid and the settled glide:
  // the round varies exactly one variable — the rest dialect.
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.chordGrouping),
    ['none', 'none', 'none', 'none'],
    'the golden chord grouping stays golden'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.subdivisionStyle),
    ['kinetic-tab-beam', 'kinetic-tab-beam', 'kinetic-tab-beam', 'kinetic-tab-beam']
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.gridWritingPolicy),
    [
      'overlaid-beat-grid',
      'overlaid-beat-grid',
      'overlaid-beat-grid',
      'overlaid-beat-grid',
    ],
    'the settled golden grid policy'
  );
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(
      resolved.options.claspDurationStyle,
      'kinetic-cross-slashes',
      `${candidate.id} carries the standardized up-raked clasp`
    );
  }
  // Every paradigm keeps the canonical tokens: the delta is purely structural.
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(resolved.tokens.claspWidth, DEFAULT_JANKO_TOKENS.claspWidth);
    assert.equal(resolved.tokens.claspOffset, DEFAULT_JANKO_TOKENS.claspOffset);
    assert.equal(resolved.tokens.claspMinBarlineAir, DEFAULT_JANKO_TOKENS.claspMinBarlineAir);
    assert.equal(resolved.tokens.rowHeight, DEFAULT_JANKO_TOKENS.rowHeight);
    assert.equal(resolved.tokens.flagSpacing, DEFAULT_JANKO_TOKENS.flagSpacing);
    assert.equal(resolved.tokens.accoladeThick, 0.55, 'the slender accolade');
    assert.equal(resolved.tokens.accoladeWidth, 4.8, 'the slender accolade reach');
    assert.equal(resolved.tokens.augmentationDotRadius, 0.75, 'the delicate dot');
    assert.equal(resolved.options.pageMargin, 24.0, 'the widened page margin');
    assert.equal(resolved.options.interStaffGap, 30.0, 'the symmetrical octave lattice');
  }
  assert.deepEqual(
    candidateBadges(getCandidate('kinetic-monoline-flared-bracket')!).map((b) => b.key),
    ['systemStartStyle'],
    'candidate D is the golden rest dialect itself'
  );
  assert.deepEqual(
    candidateBadges(getCandidate('classical-urtext-flared-bracket')!).map((b) => b.key),
    ['restStyle', 'systemStartStyle']
  );
  assert.deepEqual(
    candidateBadges(getCandidate('phantom-notehead-flared-bracket')!).map((b) => b.key),
    ['restStyle', 'systemStartStyle']
  );
});

test('Round 13 candidates export cleanly to the contact sheet', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    options: resolveCandidate(candidate).options,
  }));
  // The specimen is the contact sheet's window: five dense four-voice chords
  // with their m. 2 silence written in each candidate's own dialect, so the
  // rest ink is countable side by side.
  const specimen = CONFIG.scores[SPECIMEN_STUDIO_SCORE_ID];
  const sheet = renderJankoVariantComparison(
    SPECIMEN,
    specs,
    1,
    2,
    specimen.options,
    specimen.tokens
  );
  assert.equal((sheet.match(/<svg/g) ?? []).length, 1, 'one contact sheet document');
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(sheet.includes(`data-variant="${candidate.id}"`), `${candidate.id} panel`);
    // SVG text nodes escape `&`, `<` and `>`.
    assert.ok(sheet.includes(esc(candidate.label)), `${candidate.id} label`);
  }
  const panelBody = (variantId: string): string => {
    const start = sheet.indexOf(`data-variant="${variantId}"`);
    const next = sheet.indexOf('data-variant="', start + 1);
    return sheet.slice(start, next === -1 ? undefined : next);
  };
  const seen = new Set<string>();
  for (const candidate of CURRENT_CANDIDATES) {
    const body = panelBody(candidate.id);
    // One rest per panel — the specimen's m. 2 silence, in this dialect.
    const rests = [...body.matchAll(/<g class="janko-rest-group"[^>]*data-rest-style="([^"]*)"/g)];
    assert.equal(rests.length, 1, `${candidate.id} writes exactly the specimen silence`);
    assert.equal(rests[0][1], resolveCandidate(candidate).options.restStyle, `${candidate.id} dialect`);
    assert.match(body, /class="janko-system-bracket"/, `${candidate.id} paints the flared bracket`);
    seen.add(body.replace(/ data-rest-style="[^"]*"/g, ''));
  }
  assert.equal(seen.size, CURRENT_CANDIDATES.length, 'four distinct specimen engravings');
  // The Bach window keeps the shared beam-harmonized rake and the continuous
  // vertical grid.
  const bachSheet = renderJankoVariantComparison(
    SCORE,
    specs,
    1,
    2,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  const rakes = [
    ...bachSheet.matchAll(
      /<line class="janko-flag"[^>]*x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g
    ),
  ].map((m) => Math.abs((Number(m[4]) - Number(m[2])) / (Number(m[3]) - Number(m[1]))));
  assert.ok(rakes.length > 0, 'the Bach window carries subdivision marks');
  for (const rake of rakes) {
    assert.ok(Math.abs(rake - DEFAULT_JANKO_TOKENS.maxBeamSlope) < 5e-3, `beam rake ${rake}`);
  }
});

test('Candidate previews honour their own option deltas', () => {
  const html = renderCandidatesView(CONFIG);
  for (const candidate of CURRENT_CANDIDATES) {
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['restStyle', 'systemStartStyle'],
      `${candidate.id} declares its rest dialect and the standardized flared bracket`
    );
  }
  assert.ok(
    !html.includes('<b>chordGrouping</b>'),
    'the golden chord grouping is not a Round 13 question'
  );
  assert.match(
    html,
    /<s>kinetic-monoline<\/s>/,
    'the golden rest dialect the three replacement candidates depart from'
  );
  assert.match(
    html,
    /<s>open-halo<\/s>/,
    'the golden System 1 start every candidate departs from'
  );
  assert.ok(
    !html.includes('<b>gridWritingPolicy</b>'),
    'the settled golden grid policy is not a Round 13 question'
  );
  assert.doesNotMatch(
    html,
    /<b>subdivisionStyle<\/b>/,
    'the settled kinetic tab is the golden master, no longer a candidate delta'
  );
  assert.match(html, /badge-delta/, 'deltas against the golden master are highlighted');
  assert.match(html, /chip chip-ok/, 'every candidate lints clean in this round');

  const cardOf = (id: string): string => {
    const card = html.slice(html.indexOf(`data-candidate="${id}"`));
    return card.slice(0, card.indexOf('</article>'));
  };
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    // Candidate D *is* the golden rest dialect, so only the three replacement
    // dialects show that badge.
    if (resolved.options.restStyle === DEFAULT_JANKO_OPTIONS.restStyle) {
      assert.ok(
        !cardOf(candidate.id).includes('<b>restStyle</b>'),
        'candidate D is the golden rest dialect itself'
      );
    } else {
      assert.match(
        cardOf(candidate.id),
        new RegExp(`<b>restStyle</b> = ${resolved.options.restStyle}`),
        `${candidate.id} rest badge`
      );
    }
    assert.match(
      cardOf(candidate.id),
      /<b>systemStartStyle<\/b> = architectural-bracket/,
      `${candidate.id} always shows the flared-bracket delta`
    );
    // Round 12 standardizes the up-raked 12.4° kinetic clasp: it is the golden
    // duration paradigm now, so no candidate ever shows a duration badge.
    assert.ok(
      !cardOf(candidate.id).includes('<b>claspDurationStyle</b>'),
      `${candidate.id} carries the settled kinetic clasp without a badge`
    );
  }
  // The clasp grammar is stated in the card facts.
  for (const candidate of CURRENT_CANDIDATES) {
    assert.match(cardOf(candidate.id), /clasp 2\.8pt offset \/ 4\.0pt barline air/, `${candidate.id} tokens`);
    assert.match(cardOf(candidate.id), /chord grouping none/, `${candidate.id} grouping fact`);
    // Every candidate paints the flared bracket and its own rest layer.
    assert.ok(
      cardOf(candidate.id).includes('janko-system-bracket'),
      `${candidate.id} renders the flared bracket`
    );
    assert.ok(
      cardOf(candidate.id).includes('janko-rest-group'),
      `${candidate.id} renders its rest layer`
    );
    assert.match(cardOf(candidate.id), /data-lint="clean"/);
  }
});

// ---------------------------------------------------------------------------
// 2. Golden Reference Object
// ---------------------------------------------------------------------------

test('renderReferenceView renders the golden page spread and macro crops', () => {
  const html = renderReferenceView(CONFIG);
  const pages = html.match(/data-page="/g) ?? [];
  const crops = html.match(/data-crop="/g) ?? [];
  assert.equal(pages.length, 3, 'Bach Var. 1 is a three-page spread');
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
  for (let page = 0; page < 3; page++) {
    const svg = renderJankoPage(SCORE, page, DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS);
    assert.match(svg, new RegExp(`id="system-${page * DEFAULT_JANKO_OPTIONS.systemsPerPage + 1}"`));
    assert.ok((svg.match(/class="janko-digit"/g) ?? []).length > 100, `page ${page + 1} has glyphs`);
    assert.match(svg, new RegExp(`Page ${page + 1} of 3`));
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

test('The studio score library exposes the benchmarks and the wide-span specimen to windows', () => {
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
  assert.match(line, /8 systems · 551 noteheads/);
  assert.match(line, /rendered live at 12:34:56Z/);
});

test('Round metadata is exported and drives the view headline', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 13);
  assert.ok(CURRENT_ROUND_METADATA.title.length > 0);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.ok(CURRENT_CANDIDATES.length >= 2 && CURRENT_CANDIDATES.length <= 5, '2–5 candidates');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
});
