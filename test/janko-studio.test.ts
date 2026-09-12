/**
 * Two-View Live Studio — architecture invariant suite.
 *
 * Covers:
 *  1. `renderCandidatesView()` renders every candidate declared in the
 *     registry, with labels, option-delta badges, lint chips and SVG previews.
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
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
import { renderJankoPage, renderJankoVariantComparison } from '../src/render/janko/engine';
import {
  CURRENT_CANDIDATES,
  CURRENT_ROUND_METADATA,
  candidateBadges,
  getCandidate,
  resolveCandidate,
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
const CONFIG = createStudioConfig({ score: SCORE });

function read(file: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, file), 'utf-8');
}

// ---------------------------------------------------------------------------
// 1. Decision Candidates Matrix
// ---------------------------------------------------------------------------

test('renderCandidatesView renders every registry candidate with label, badges and an SVG', () => {
  const html = renderCandidatesView(CONFIG);
  assert.equal(
    (html.match(/data-candidate="/g) ?? []).length,
    CURRENT_CANDIDATES.length,
    'one card per registry entry'
  );
  assert.match(html, new RegExp(`data-candidate-count="${CURRENT_CANDIDATES.length}"`));
  assert.equal((html.match(/<svg/g) ?? []).length, CURRENT_CANDIDATES.length, 'one preview each');
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(html.includes(`data-candidate="${candidate.id}"`), `${candidate.id} card`);
    assert.ok(html.includes(candidate.label), `${candidate.id} label`);
    assert.ok(html.includes(candidate.description ?? ''), `${candidate.id} rationale`);
    for (const badge of candidateBadges(candidate)) {
      assert.ok(html.includes(badge.key), `${candidate.id} badge ${badge.key}`);
    }
  }
  assert.match(html, /Round 4/);
  assert.match(html, /Domain Exploration/);
});

test('Round 4 registry declares the four comparative channel paradigms', () => {
  assert.equal(CURRENT_ROUND_METADATA.round, 4);
  assert.match(CURRENT_ROUND_METADATA.title, /Domain Exploration/);
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.deepEqual(
    ids,
    ['equator-floating', 'equator-anchored', 'single-line-3row', 'channel-bounded'],
    'candidates A, B, C and D in display order'
  );
  for (const candidate of CURRENT_CANDIDATES) {
    assert.equal(candidate.measureStart, 1, 'the matrix compares mm. 1–2');
    assert.equal(candidate.measureCount, 2);
  }
  assert.equal(
    resolveCandidate(getCandidate('equator-floating')!).options.channelLayout,
    'single-equator'
  );
  assert.equal(resolveCandidate(getCandidate('equator-anchored')!).options.channelLayout, 'on-the-line');
  assert.equal(
    resolveCandidate(getCandidate('single-line-3row')!).options.channelLayout,
    'single-line-3row'
  );
  assert.equal(
    resolveCandidate(getCandidate('channel-bounded')!).options.channelLayout,
    'bounded-channel'
  );
  // Every paradigm keeps the canonical tokens: the deltas are purely structural.
  for (const candidate of CURRENT_CANDIDATES) {
    const resolved = resolveCandidate(candidate);
    assert.equal(resolved.tokens.channelHalfWidth, DEFAULT_JANKO_TOKENS.channelHalfWidth);
    assert.equal(resolved.tokens.channelFlankOffset, DEFAULT_JANKO_TOKENS.channelFlankOffset);
    assert.equal(resolved.tokens.rowHeight, DEFAULT_JANKO_TOKENS.rowHeight);
  }
  assert.equal(candidateBadges(getCandidate('equator-floating')!)[0].key, 'baseline');
});

test('Round 4 candidates export cleanly to the contact sheet', () => {
  const specs = CURRENT_CANDIDATES.map((candidate) => ({
    id: candidate.id,
    label: candidate.label,
    options: resolveCandidate(candidate).options,
  }));
  const sheet = renderJankoVariantComparison(
    SCORE,
    specs,
    1,
    2,
    DEFAULT_JANKO_OPTIONS,
    DEFAULT_JANKO_TOKENS
  );
  assert.equal((sheet.match(/<svg/g) ?? []).length, 1, 'one contact sheet document');
  for (const candidate of CURRENT_CANDIDATES) {
    assert.ok(sheet.includes(`data-variant="${candidate.id}"`), `${candidate.id} panel`);
    assert.ok(sheet.includes(candidate.label), `${candidate.id} label`);
  }
  // The panels must be genuinely different engravings: A, B and C frame each
  // octave with one rule, D doubles that to two boundary rules.
  const panelBody = (variantId: string): string => {
    const start = sheet.indexOf(`data-variant="${variantId}"`);
    const next = sheet.indexOf('data-variant="', start + 1);
    return sheet.slice(start, next === -1 ? undefined : next);
  };
  const staffRules = (variantId: string): number => {
    const group = panelBody(variantId).match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
    return (group.match(/<line/g) ?? []).length;
  };
  assert.equal(staffRules('equator-floating'), 4, 'four single equators');
  assert.equal(staffRules('equator-anchored'), 4, 'four anchored base rules');
  assert.equal(staffRules('single-line-3row'), 4, 'four single rules in the 3-row framing');
  assert.equal(staffRules('channel-bounded'), 8, 'four equators, two rules each');
});

test('Candidate previews honour their own option deltas', () => {
  const html = renderCandidatesView(CONFIG);
  // The four Round-4 candidates differ in exactly one option: the channel.
  for (const candidate of CURRENT_CANDIDATES) {
    assert.deepEqual(
      Object.keys(candidate.options ?? {}),
      ['channelLayout'],
      `${candidate.id} declares only the channel delta`
    );
  }
  assert.match(html, /<b>channelLayout<\/b> = bounded-channel/);
  assert.match(html, /<b>channelLayout<\/b> = on-the-line/, 'the anchored paradigm shows its raw value');
  assert.match(html, /<b>baseline<\/b> = golden master/, 'candidate A is the untouched golden master');
  assert.match(html, /single equator/);
  assert.match(html, /bounded channel ±6\.5pt · flanks ∓13\.0pt/);
  assert.match(html, /badge-delta/, 'deltas against the golden master are highlighted');
  assert.match(html, /chip chip-(warn|ok|error)/, 'every candidate carries a lint verdict');

  const cardOf = (id: string): string => {
    const card = html.slice(html.indexOf(`data-candidate="${id}"`));
    return card.slice(0, card.indexOf('</article>'));
  };
  const staffRules = (card: string): number => {
    const group = card.match(/<g class="janko-staff-lines">[\s\S]*?<\/g>/)?.[0] ?? '';
    return (group.match(/<line/g) ?? []).length;
  };
  assert.equal(staffRules(cardOf('equator-floating')), 4, 'the incumbent paints one rule per octave');
  assert.equal(staffRules(cardOf('equator-anchored')), 4, 'the anchored base row keeps 4 lines');
  assert.equal(staffRules(cardOf('single-line-3row')), 4, 'the 3-row framing keeps 4 lines');
  assert.equal(staffRules(cardOf('channel-bounded')), 8, 'the channel paints two rules per octave');
  // The density axis is visible in the card facts.
  assert.match(cardOf('equator-floating'), /1 rule\/octave \(4 lines\)/);
  assert.match(cardOf('channel-bounded'), /2 rules\/octave \(8 lines\)/);
  // Two paradigms are structurally clean; the two anchored ones expose the real
  // cost of riding the rule (the outer Set B row reaches the numeral margin).
  assert.match(cardOf('equator-floating'), /data-lint="clean"/);
  assert.match(cardOf('channel-bounded'), /data-lint="clean"/);
  assert.match(cardOf('equator-anchored'), /data-lint="violations"/);
  assert.match(cardOf('single-line-3row'), /✗ 2 violations/);
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
  assert.ok(!html.includes(CURRENT_CANDIDATES[0].id), 'registry entries are not hardcoded');
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
  assert.equal(CURRENT_ROUND_METADATA.round, 4);
  assert.ok(CURRENT_ROUND_METADATA.title.length > 0);
  assert.ok(CURRENT_ROUND_METADATA.description.length > 0);
  assert.ok(CURRENT_CANDIDATES.length >= 2 && CURRENT_CANDIDATES.length <= 4, '2–4 candidates');
  const ids = CURRENT_CANDIDATES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'candidate ids are unique');
});
