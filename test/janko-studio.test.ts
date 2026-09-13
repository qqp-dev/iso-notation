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
  assert.match(html, /Round 11/);
  assert.match(html, /Accolade Replacements/);
});

test('Round 11 registry pairs four system-start styles with four light duration paradigms', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 11);
  assert.match(CURRENT_ROUND_METADATA.title, /Accolade Replacements/);
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    [
      'open-halo-cross-rungs',
      'architectural-bracket-kinetic-slashes',
      'clef-pillar-down-raked-slashes',
      'double-hairline-cross-hatch-stitches',
    ],
    'candidates A–D in display order'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.chordGrouping),
    ['per-hand-clasp', 'per-hand-clasp', 'per-hand-clasp', 'per-hand-clasp']
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.systemStartStyle),
    ['open-halo', 'architectural-bracket', 'clef-pillar', 'double-hairline'],
    'each candidate demonstrates one System 1 start style'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.claspDurationStyle),
    [
      'transverse-cross-bars',
      'kinetic-cross-slashes',
      'down-raked-slashes',
      'cross-hatch-stitches',
    ],
    'each candidate carries its own light transverse duration paradigm'
  );
  // The settled beam-harmonized tab is shared by all four, so the round varies
  // exactly two variables: the margin ink and the midpoint cut.
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.subdivisionStyle),
    ['kinetic-tab-beam', 'kinetic-tab-beam', 'kinetic-tab-beam', 'kinetic-tab-beam']
  );
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
    candidateBadges(getCandidate('open-halo-cross-rungs')!).map((b) => b.key),
    ['chordGrouping'],
    'candidate A is the golden start and duration paradigm itself'
  );
  assert.deepEqual(
    candidateBadges(getCandidate('double-hairline-cross-hatch-stitches')!).map((b) => b.key),
    ['chordGrouping', 'systemStartStyle', 'claspDurationStyle']
  );
});

test('Round 11 candidates export cleanly to the contact sheet', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    options: resolveCandidate(candidate).options,
  }));
  // The specimen is the contact sheet's window: its five chords carry the whole
  // taxonomy, so each paradigm's own midpoint ink is countable side by side.
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
    // SVG text nodes escape `&`, `<` and `>` (the Round 9 hub label carries one).
    assert.ok(sheet.includes(esc(candidate.label)), `${candidate.id} label`);
  }
  const panelBody = (variantId: string): string => {
    const start = sheet.indexOf(`data-variant="${variantId}"`);
    const next = sheet.indexOf('data-variant="', start + 1);
    return sheet.slice(start, next === -1 ? undefined : next);
  };
  /** The cut each paradigm paints on the specimen's 8th / 16th chord. */
  const SIGNATURES: Record<string, RegExp> = {
    'transverse-cross-bars': /janko-clasp-bar/,
    'kinetic-cross-slashes': /janko-clasp-slash/,
    'down-raked-slashes': /janko-clasp-slash/,
    'cross-hatch-stitches': /janko-clasp-stitch/,
  };
  const FOREIGN: Record<string, RegExp> = {
    'transverse-cross-bars': /janko-clasp-(ring|slash|stitch|dot|pip)/,
    'kinetic-cross-slashes': /janko-clasp-(ring|bar|stitch|dot|pip)/,
    'down-raked-slashes': /janko-clasp-(ring|bar|stitch|dot|pip)/,
    'cross-hatch-stitches': /janko-clasp-(ring|bar|slash|dot|pip)/,
  };
  for (const candidate of CURRENT_CANDIDATES) {
    const body = panelBody(candidate.id);
    assert.match(body, /class="janko-clasp-layer"/, `${candidate.id} paints its clasps`);
    const durationStyle = resolveCandidate(candidate).options.claspDurationStyle;
    assert.match(
      body,
      new RegExp(`data-clasp-duration-style="${durationStyle}"`),
      `${candidate.id} tags its duration paradigm`
    );
    const groups = [...body.matchAll(
      /<g class="janko-clasp-group"[^>]*data-clasp-duration="([^"]*)"[^>]*>([\s\S]*?)<\/g>/g
    )];
    const eighth = groups.find((m) => m[1] === 'spire-one-flag')![2];
    const sixteenth = groups.find((m) => m[1] === 'spire-two-flags')![2];
    assert.equal(
      (eighth.match(new RegExp(SIGNATURES[durationStyle], 'g')) ?? []).length,
      1,
      `${candidate.id} 8th ink`
    );
    assert.equal(
      (sixteenth.match(new RegExp(SIGNATURES[durationStyle], 'g')) ?? []).length,
      2,
      `${candidate.id} 16th ink`
    );
    const spires = groups.filter((m) => m[1] === 'spire');
    assert.equal(spires.length, 2, `${candidate.id} quarter + dotted quarter`);
    assert.match(spires[1][2], /janko-clasp-dot/, `${candidate.id} dotted-quarter dot`);
    // Every paradigm shares the one open white ring for the half note.
    const half = groups.find((m) => m[1] === 'pip')![2];
    assert.equal((half.match(/janko-clasp-ring/g) ?? []).length, 1, `${candidate.id} half ring`);
    const quarter = spires[0][2];
    assert.doesNotMatch(quarter, FOREIGN[durationStyle], `${candidate.id} plain quarter`);
    assert.doesNotMatch(quarter, SIGNATURES[durationStyle], `${candidate.id} plain quarter mark`);
  }
  // The Bach window keeps the shared beam-harmonized rake.
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
      ['chordGrouping', 'systemStartStyle', 'claspDurationStyle', 'subdivisionStyle'],
      `${candidate.id} declares the per-hand clasp, its start style, its duration paradigm and the kinetic tab`
    );
  }
  assert.match(html, /<b>chordGrouping<\/b> = per-hand-clasp/);
  assert.match(html, /<s>none<\/s>/, 'the golden grouping value every candidate departs from');
  assert.match(
    html,
    /<s>transverse-cross-bars<\/s>/,
    'the golden duration value the three modern candidates depart from'
  );
  assert.match(
    html,
    /<s>open-halo<\/s>/,
    'the golden System 1 start the three replacement candidates depart from'
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
    // Candidate A *is* the golden start + duration paradigm, so only the three
    // replacement candidates show those badges.
    if (resolved.options.claspDurationStyle === DEFAULT_JANKO_OPTIONS.claspDurationStyle) {
      assert.ok(
        !cardOf(candidate.id).includes('<b>claspDurationStyle</b>'),
        'candidate A is the golden duration paradigm itself'
      );
    } else {
      assert.match(
        cardOf(candidate.id),
        new RegExp(`<b>claspDurationStyle</b> = ${resolved.options.claspDurationStyle}`),
        `${candidate.id} duration badge`
      );
    }
    if (resolved.options.systemStartStyle === DEFAULT_JANKO_OPTIONS.systemStartStyle) {
      assert.ok(
        !cardOf(candidate.id).includes('<b>systemStartStyle</b>'),
        'candidate A is the golden System 1 start itself'
      );
    } else {
      assert.match(
        cardOf(candidate.id),
        new RegExp(`<b>systemStartStyle</b> = ${resolved.options.systemStartStyle}`),
        `${candidate.id} system-start badge`
      );
    }
  }
  // The clasp grammar is stated in the card facts.
  for (const candidate of CURRENT_CANDIDATES) {
    assert.match(cardOf(candidate.id), /clasp 2\.8pt offset \/ 4\.0pt barline air/, `${candidate.id} tokens`);
    assert.match(cardOf(candidate.id), /chord grouping per-hand-clasp/, `${candidate.id} grouping fact`);
    // Every candidate paints the refined per-hand clasps of the Brahms window.
    assert.ok(
      cardOf(candidate.id).includes('janko-clasp-layer'),
      `${candidate.id} renders its clasp layer`
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
  assert.equal(CURRENT_ROUND_METADATA.round, 11);
  assert.ok(CURRENT_ROUND_METADATA.title.length > 0);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.ok(CURRENT_CANDIDATES.length >= 2 && CURRENT_CANDIDATES.length <= 5, '2–5 candidates');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
});
