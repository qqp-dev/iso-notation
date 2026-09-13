/**
 * Two-View Live Studio — architecture invariant suite.
 *
 * Covers:
 *  1. `renderCandidatesView()` renders every candidate declared in the
 *     registry, on **every engraving window it declares** (Round 15 judges the
 *     three crowded-column systems on the five Bach crime scenes plus the fixed
 *     context regressions, and the four rest dialects on the strictly clean
 *     rest-duration specimen, Brahms m. 68 and the chord specimen), with
 *     labels, per-axis option badges, lint chips and SVG previews.
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
import { countJankoPages, renderJankoPage, renderJankoVariantComparison } from '../src/render/janko/engine';
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

test('renderCandidatesView renders every registry candidate on every declared window', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal(
    (html.match(/data-candidate="/g) ?? []).length,
    CURRENT_CANDIDATES.length,
    'one card per registry entry'
  );
  assert.match(html, new RegExp(`data-candidate-count="${CURRENT_CANDIDATES.length}"`));
  const windows = CURRENT_CANDIDATES.reduce((n, c) => n + resolveCandidate(c).windows.length, 0);
  assert.equal(windows, 45, 'three column candidates × 7 windows + four dialect candidates × 6 windows');
  // Round 15 has two per-axis window sets; the header states the leading
  // (crowded-column) set's declared window count.
  assert.match(html, /data-window-count="7"/, 'the header states the column set window count');
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
    assert.equal(
      (body.match(/data-window="/g) ?? []).length,
      resolveCandidate(candidate).windows.length,
      `${candidate.id} renders all its declared windows and no others`
    );
  }
  assert.match(html, /Round 15/);
  assert.match(html, /Crowded Columns \+ Rest Dialects/);
});

test('Round 15 registry compares the crowded column and the rest dialect on two independent axes', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 15);
  assert.match(CURRENT_ROUND_METADATA.title, /Crowded Columns \+ Rest Dialects/);
  assert.deepEqual(CURRENT_ROUND_METADATA.openAxes, ['crowdedColumn', 'restStyle'], 'two open axes');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    [
      'stem-anchored-columns',
      'asymmetric-micro-columns',
      'symmetric-spread-control',
      'rest-kinetic-monoline',
      'rest-classical-urtext',
      'rest-geometric-node',
      'rest-phantom-notehead',
    ],
    'candidates A–C on the column axis then A–D on the dialect axis, in display order'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => c.axis),
    ['crowdedColumn', 'crowdedColumn', 'crowdedColumn', 'restStyle', 'restStyle', 'restStyle', 'restStyle'],
    'each candidate declares exactly one of the round’s open axes'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.crowdedColumn),
    [
      'stem-anchored',
      'asymmetric-micro',
      'symmetric-spread',
      'stem-anchored',
      'stem-anchored',
      'stem-anchored',
      'stem-anchored',
    ],
    'the column axis: two proposals plus the rejected Round 14 control; every dialect candidate keeps the golden column system'
  );
  assert.deepEqual(
    CURRENT_CANDIDATES.map((c) => resolveCandidate(c).options.restStyle),
    [
      'kinetic-monoline',
      'kinetic-monoline',
      'kinetic-monoline',
      'kinetic-monoline',
      'classical-urtext',
      'geometric-node',
      'phantom-notehead',
    ],
    'the dialect axis: the incumbent plus the three Round 13 finalists; every column candidate keeps the golden dialect'
  );
  // The two axes are independent: every resolved option set departs from the
  // golden master ONLY on the candidate's own axis key (incumbent values are
  // identical there, but the axis still belongs on the table).
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const goldenTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      [candidate.axis],
      `${candidate.id} states only its own open axis`
    );
    const diffs = Object.keys(golden).filter(
      (key) =>
        (resolved.options as unknown as Record<string, unknown>)[key] !==
        (golden as unknown as Record<string, unknown>)[key]
    );
    assert.ok(
      diffs.every((key) => key === candidate.axis),
      `${candidate.id} departs from golden only on ${candidate.axis} (saw ${diffs.join(', ') || 'none'})`
    );
    for (const key of Object.keys(goldenTokens)) {
      assert.equal(
        (resolved.tokens as unknown as Record<string, unknown>)[key],
        (goldenTokens as unknown as Record<string, unknown>)[key],
        `${candidate.id} keeps token ${key} at the golden value`
      );
    }
  }
  // The settled Round 14 context is fixed on both axes: the restored per-hand
  // clasp, the canonical bracket, the settled grid policy C, the kinetic tab
  // and rake.
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(
      resolved.options.chordGrouping,
      'per-hand-clasp',
      `${candidate.id} carries the restored per-hand clasp`
    );
    assert.equal(
      resolved.options.systemStartStyle,
      'architectural-bracket',
      `${candidate.id} carries the canonical flared 0.65pt bracket`
    );
    assert.equal(
      resolved.options.gridWritingPolicy,
      'overlaid-beat-grid',
      `${candidate.id} keeps the settled Round 14 grid policy C`
    );
    assert.equal(
      resolved.options.subdivisionStyle,
      'kinetic-tab-beam',
      `${candidate.id} keeps the settled kinetic tab`
    );
    assert.equal(
      resolved.options.claspDurationStyle,
      'kinetic-cross-slashes',
      `${candidate.id} carries the standardized up-raked clasp`
    );
  }
  // Every candidate keeps the canonical tokens: the delta is purely structural.
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(resolved.tokens.claspWidth, DEFAULT_JANKO_TOKENS.claspWidth);
    assert.equal(resolved.tokens.claspOffset, DEFAULT_JANKO_TOKENS.claspOffset);
    assert.equal(resolved.tokens.claspMinBarlineAir, DEFAULT_JANKO_TOKENS.claspMinBarlineAir);
    assert.equal(resolved.tokens.rowHeight, DEFAULT_JANKO_TOKENS.rowHeight);
    assert.equal(resolved.tokens.flagSpacing, DEFAULT_JANKO_TOKENS.flagSpacing);
    assert.equal(resolved.tokens.augmentationDotRadius, 0.75, 'the delicate dot');
    assert.equal(resolved.options.pageMargin, 24.0, 'the widened page margin');
    assert.equal(resolved.options.interStaffGap, 30.0, 'the symmetrical octave lattice');
  }
  // Every candidate badges exactly its own axis — never the other open axis and
  // never a locked key.
  for (const candidate of CURRENT_CANDIDATES) {
    const badges = candidateBadges(candidate);
    assert.deepEqual(
      badges.map((b) => b.key),
      [candidate.axis],
      `${candidate.id} badges only its own axis`
    );
    assert.deepEqual(
      badges[0],
      {
        key: candidate.axis,
        value: String(
          (resolveCandidate(candidate).options as unknown as Record<string, unknown>)[
            candidate.axis ?? ''
          ]
        ),
        golden: String((golden as unknown as Record<string, unknown>)[candidate.axis ?? '']),
        axis: true,
      },
      `${candidate.id} states its value on the round’s axis`
    );
  }
  // The incumbents state the golden value on their axis, without a delta.
  assert.deepEqual(
    candidateBadges(getCandidate('stem-anchored-columns')!)[0],
    {
      key: 'crowdedColumn',
      value: 'stem-anchored',
      golden: 'stem-anchored',
      axis: true,
    },
    'the incumbent column system still states its value on the axis'
  );
  assert.deepEqual(
    candidateBadges(getCandidate('rest-kinetic-monoline')!)[0],
    {
      key: 'restStyle',
      value: 'kinetic-monoline',
      golden: 'kinetic-monoline',
      axis: true,
    },
    'the incumbent rest dialect still states its value on the axis'
  );
});

test('Round 15 candidates export cleanly to the contact sheet', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    options: resolveCandidate(candidate).options,
  }));
  // The dense mm. 27–28 run remains the contact sheet's stress window: all
  // seven Round 15 candidates export side by side from the real engine.
  const sheet = renderJankoVariantComparison(
    SCORE,
    specs,
    27,
    2,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
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
    assert.ok(
      (body.match(/class="janko-digit"/g) ?? []).length >= 20,
      `${candidate.id} engraves the dense sixteenths`
    );
    assert.ok(
      (body.match(/class="janko-barline"/g) ?? []).length >= 2,
      `${candidate.id} paints the measure barlines`
    );
    seen.add(body);
  }
  assert.equal(seen.size, CURRENT_CANDIDATES.length, 'seven distinct Round 15 engravings');
  // The Bach window keeps the shared beam-harmonized rake and the continuous
  // vertical grid.
  const rakes = [
    ...sheet.matchAll(
      /<line class="janko-flag"[^>]*x1="([\d.-]+)" y1="([\d.-]+)" x2="([\d.-]+)" y2="([\d.-]+)"/g
    ),
  ].map((m) => Math.abs((Number(m[4]) - Number(m[2])) / (Number(m[3]) - Number(m[1]))));
  assert.ok(rakes.length > 0, 'the dense window carries subdivision marks');
  for (const rake of rakes) {
    assert.ok(Math.abs(rake - DEFAULT_JANKO_TOKENS.maxBeamSlope) < 5e-3, `beam rake ${rake}`);
  }
});

test('Candidate previews honour their own option deltas', () => {
  const html = renderCandidatesView(CONFIG);
  const cardOf = (id: string): string => {
    const card = html.slice(html.indexOf(`data-candidate="${id}"`));
    return card.slice(0, card.indexOf('</article>'));
  };
  const axisValue = (candidate: (typeof CURRENT_CANDIDATES)[number], key: string): string =>
    String((resolveCandidate(candidate).options as unknown as Record<string, unknown>)[key]);

  // Every candidate states exactly one macro option: its own open axis.
  for (const candidate of CURRENT_CANDIDATES) {
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      [candidate.axis],
      `${candidate.id} states its own open axis and nothing else`
    );
  }
  // The settled decisions ride along as shared context and are never badged.
  assert.ok(
    !html.includes('<b>chordGrouping</b>'),
    'the restored per-hand clasp is shared context, never a Round 15 question'
  );
  assert.ok(
    !html.includes('<b>systemStartStyle</b>'),
    'the canonical flared bracket is shared context, never a Round 15 question'
  );
  assert.ok(
    !html.includes('<b>gridWritingPolicy</b>'),
    'the settled Round 14 grid policy is shared context, never a Round 15 question'
  );
  assert.doesNotMatch(
    html,
    /<b>subdivisionStyle<\/b>/,
    'the settled kinetic tab is the golden master, no longer a candidate delta'
  );
  assert.doesNotMatch(
    html,
    /<b>claspDurationStyle<\/b>/,
    'the settled kinetic clasp is the golden master, no longer a candidate delta'
  );
  assert.doesNotMatch(html, /open-halo/, 'the retired open margin appears nowhere');

  // Exactly one axis badge per candidate; only the genuine departures from the
  // golden value carry the delta highlight.
  assert.equal(
    (html.match(/badge-axis/g) ?? []).length,
    CURRENT_CANDIDATES.length,
    'one axis badge per candidate'
  );
  const golden = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const departures = CURRENT_CANDIDATES.filter(
    (candidate) =>
      axisValue(candidate, candidate.axis ?? '') !==
      String((golden as unknown as Record<string, unknown>)[candidate.axis ?? ''])
  );
  assert.equal(
    departures.length,
    5,
    'A/B on the column axis and B/C/D on the dialect axis depart from golden'
  );
  assert.equal(
    (html.match(/badge-delta/g) ?? []).length,
    departures.length,
    'only genuine deltas are highlighted'
  );

  // The lint chips report each candidate's real verdict: the retained Round 14
  // control is the only engraving that violates (grid crossing, stem fusion,
  // time inversion); every proposal lints clean.
  assert.equal((html.match(/chip chip-error/g) ?? []).length, 1, 'only the control is dirty');
  assert.equal(
    (html.match(/chip chip-ok/g) ?? []).length,
    CURRENT_CANDIDATES.length - 1,
    'every other candidate lints clean'
  );
  assert.equal((html.match(/chip chip-warn/g) ?? []).length, 0, 'no candidate merely warns');
  assert.match(
    cardOf('symmetric-spread-control'),
    /chip chip-error/,
    'the control chip names its violations'
  );
  assert.match(cardOf('symmetric-spread-control'), /data-lint="violations"/);

  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    const axis = candidate.axis ?? '';
    const card = cardOf(candidate.id);
    assert.match(
      card,
      new RegExp(`<b>${axis}</b> = ${axisValue(candidate, axis)}`),
      `${candidate.id} states its own axis value`
    );
    const otherAxis = axis === 'crowdedColumn' ? 'restStyle' : 'crowdedColumn';
    assert.ok(!card.includes(`<b>${otherAxis}</b>`), `${candidate.id} never badges the other axis`);
    assert.equal(
      (card.match(/data-window="/g) ?? []).length,
      resolved.windows.length,
      `${candidate.id} engraves exactly its declared window set`
    );
    assert.match(
      card,
      new RegExp(
        `data-lint="${candidate.id === 'symmetric-spread-control' ? 'violations' : 'clean'}"`
      ),
      `${candidate.id} lint verdict`
    );
    // The declared windows legitimately include system starts (Bach m. 8, the
    // rest specimen's m. 1), so the bracket may appear in the engraving itself;
    // what must never appear is the settled bracket re-opened as a candidate.
    assert.ok(
      !card.includes('<b>systemStartStyle</b>'),
      `${candidate.id} never re-showcases the settled bracket as a delta`
    );
  }

  // The two axes are judged on their own windows: the column systems on the
  // five crime scenes plus the fixed-context regressions, the dialects on the
  // strictly clean rest specimen, Brahms m. 68 and the chord specimen.
  const columnCard = cardOf('stem-anchored-columns');
  for (const measure of [8, 12, 13, 14, 15, 4]) {
    assert.match(
      columnCard,
      new RegExp(`data-window="primary:${measure}-${measure}"`),
      `column m. ${measure}`
    );
  }
  assert.ok(
    !columnCard.includes('data-window="rest-duration-specimen'),
    'the column axis is never judged on the clean rest specimen'
  );
  const dialectCard = cardOf('rest-kinetic-monoline');
  for (const measure of [1, 2, 3, 4]) {
    assert.match(
      dialectCard,
      new RegExp(`data-window="rest-duration-specimen:${measure}-${measure}"`),
      `dialect specimen m. ${measure}`
    );
  }
  assert.match(dialectCard, /data-window="brahms-op118-no1:68-68"/, 'the real-world Brahms rest bar');
  assert.ok(
    !dialectCard.includes('data-window="primary:'),
    'the dialect axis is never judged on the crowded Bach bars'
  );

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
  assert.equal(pages.length, 2, 'Round 15: Bach Var. 1 is a two-page spread (4 systems/page)');
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
  // four dialects are compared at macro scale on strictly clean material.
  assert.ok(ids.includes(REST_SPECIMEN_STUDIO_SCORE_ID), 'the rest-duration specimen is registered');
  const restSpecimen = CONFIG.scores[REST_SPECIMEN_STUDIO_SCORE_ID];
  assert.equal(restSpecimen.id, REST_SPECIMEN_STUDIO_SCORE_ID);
  assert.equal(restSpecimen.options.measuresPerSystem, 4);
  assert.deepEqual(
    REST_DURATION_SPECIMEN_VALUES.map((v) => v.value),
    ['sixteenth', 'eighth', 'quarter', 'half'],
    'one genuine silence per standard rest value'
  );
  assert.equal(restSpecimen.score.notes.length, 28, 'twenty RH notes + eight LH accompaniment notes');
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
  assert.match(line, /8 systems · 551 noteheads/);
  assert.match(line, /rendered live at 12:34:56Z/);
});

test('Round metadata is exported and drives the view headline', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 15);
  assert.match(CURRENT_ROUND_METADATA.title, /Crowded Columns \+ Rest Dialects/);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.deepEqual(
    CURRENT_ROUND_METADATA.openAxes,
    ['crowdedColumn', 'restStyle'],
    'the two independent axes are declared'
  );
  assert.equal(CURRENT_CANDIDATES.length, 7, 'three column systems + four rest dialects');
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
