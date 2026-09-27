/**
 * The prepared real-engine studio (Round 49 §7).
 * ==============================================
 *
 * The studio's two views are engraved ahead of time by the real engine in a
 * Node process; the browser runs a thin viewer that never imports the engine,
 * the linter or a score builder. This suite pins the seam:
 *
 * - **identity & determinism** — two fresh generations are byte-identical;
 *   the generation identity hashes the artifact bytes and the deterministic
 *   lint facts (a wall-clock timing is never an input);
 * - **prepared ≡ direct renderer** — each artifact is byte-equal to what the
 *   live studio's renderer produces for the same configuration;
 * - **lint facts** — the status comes from the real linter (0 violations /
 *   0 warnings on the primary score) and is rendered by the viewer from the
 *   manifest, never computed in the browser;
 * - **delivery seam** — the dev manifest names middleware URLs, the build
 *   manifest names content-addressed assets through relative
 *   `new URL(…, import.meta.url)` expressions (base-independent), and the
 *   build emits those assets;
 * - **watcher hygiene** — the generation queue coalesces and serializes,
 *   publishes only coherent snapshots (a torn result is retried, then stale),
 *   keeps the last coherent output stale-labelled after a failure, and the
 *   watched-input filter covers the engine/scores/data/registry/MIDI roots
 *   and the dependency manifests;
 * - **viewer isolation** — the viewer imports no engraving module and accepts
 *   the manifest module through the actual HMR protocol;
 * - **shell wiring** — `janko.html` loads the viewer, and the public mirror
 *   stays byte-identical to the root entry.
 */

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  PreparedGeneration,
  generatePreparedStudio,
} from '../src/render/janko/prepared/generate';
import { sha256, snapshotKey } from '../src/render/janko/prepared/seam';
import {
  GenerationQueue,
  buildPreparedEmission,
  fingerprintInputs,
  generateWithCoherenceCheck,
  isWatchedInput,
  manifestModuleSource,
  PREPARED_DEV_ARTIFACT_PREFIX,
  PREPARED_MANIFEST_ID,
} from '../src/render/janko/prepared/vite-plugin';
import { createStudioConfig, renderCandidatesView, renderReferenceView } from '../src/render/janko/studio';
import { renderPreparedStatus } from '../src/render/janko/prepared/status';

const projectRoot = process.cwd();

/**
 * One shared generation for the assertions that do not need fresh runs (each
 * full engraving of both views costs seconds); the determinism test keeps its
 * own independent pair.
 */
let shared: PreparedGeneration | undefined;
function preparedOnce(): PreparedGeneration {
  if (!shared) shared = generatePreparedStudio();
  return shared;
}

test('the prepared studio is deterministic across fresh generations', () => {
  const first = generatePreparedStudio();
  const second = generatePreparedStudio();
  assert.equal(second.generation, first.generation);
  assert.deepEqual(second.artifactHashes, first.artifactHashes);
  assert.equal(second.artifacts.candidates, first.artifacts.candidates);
  assert.equal(second.artifacts.reference, first.artifacts.reference);
  // The deterministic lint facts are identical; only the measured wall time
  // may differ (and it is never part of the identity).
  for (const key of ['ok', 'violations', 'warnings', 'systems', 'notes'] as const) {
    assert.equal(second.status[key], first.status[key]);
  }
});

test('each prepared artifact is byte-equal to the direct real renderer', () => {
  const config = createStudioConfig();
  const generation = preparedOnce();
  assert.equal(generation.artifacts.candidates, renderCandidatesView(config));
  assert.equal(generation.artifacts.reference, renderReferenceView(config));
});

test('the lint facts come from the real linter: the primary score engraves clean', () => {
  const generation = preparedOnce();
  assert.equal(generation.status.ok, true);
  assert.equal(generation.status.violations, 0);
  assert.equal(generation.status.warnings, 0);
  assert.ok(generation.status.systems >= 1);
  assert.ok(generation.status.notes >= 1);
});

test('the generation identity hashes artifact bytes plus deterministic status facts', () => {
  const generation = preparedOnce();
  const expected = sha256(
    JSON.stringify({
      candidates: generation.artifactHashes.candidates,
      reference: generation.artifactHashes.reference,
      status: {
        ok: generation.status.ok,
        violations: generation.status.violations,
        warnings: generation.status.warnings,
        systems: generation.status.systems,
        notes: generation.status.notes,
      },
    })
  );
  assert.equal(generation.generation, expected);
});

test('the dev manifest names middleware URLs; the build manifest is base-independent', () => {
  const generation = preparedOnce();
  const dev = manifestModuleSource(generation, false, undefined, (_key: string, hash: string) =>
    `'${PREPARED_DEV_ARTIFACT_PREFIX}${hash}.html'`
  );
  assert.ok(dev.includes(`'${PREPARED_DEV_ARTIFACT_PREFIX}${generation.artifactHashes.candidates}.html'`));
  assert.ok(dev.includes(`'${PREPARED_DEV_ARTIFACT_PREFIX}${generation.artifactHashes.reference}.html'`));
  assert.ok(dev.includes(JSON.stringify(generation.generation)));
  // The build expression is a runtime-concatenated relative URL resolved
  // against the manifest chunk's own URL — correct under './', nested Pages
  // bases, any — and not a static path literal for the bundler to resolve.
  const build = manifestModuleSource(generation, false, undefined, (_key: string, hash: string) =>
    `new URL('../janko-prepared/' + ${JSON.stringify(hash)} + '.html', import.meta.url).href`
  );
  assert.ok(build.includes(`'../janko-prepared/' + "${generation.artifactHashes.candidates}" + '.html'`));
  assert.ok(build.includes('import.meta.url'));
  assert.ok(!build.includes('"/janko-prepared/') && !build.includes("'/janko-prepared/"));
});

test('the build seam emits the two content-addressed artifacts and no committed review asset exists', async () => {
  const generation = generatePreparedStudio();
  const emission = buildPreparedEmission(generation);
  assert.deepEqual(
    emission.map((file) => file.fileName),
    [
      `janko-prepared/${generation.artifactHashes.candidates}.html`,
      `janko-prepared/${generation.artifactHashes.reference}.html`,
    ]
  );
  for (const file of emission) {
    assert.equal(file.source, generation.artifacts[file.fileName.includes(generation.artifactHashes.candidates) ? 'candidates' : 'reference']);
    // Content-addressed: the file name is the artifact's own sha256.
    assert.equal(file.fileName, `janko-prepared/${sha256(file.source)}.html`);
  }
  // No review artifact is committed: the repo ships the engine, not its bytes.
  const { existsSync, readdirSync } = await import('node:fs');
  assert.ok(!existsSync(`${projectRoot}/janko-prepared`));
  const publicDir = `${projectRoot}/public`;
  assert.equal(readdirSync(publicDir).filter((n) => n.endsWith('.html') && n.includes('prepared')).length, 0);
});

test('the generation queue coalesces and serializes; failure keeps the last coherent output stale-labelled', async () => {
  // Coalescing: two requests while one generation is running produce exactly
  // one additional generation.
  let running = 0;
  let count = 0;
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const queue = new GenerationQueue(
    async () => {
      count += 1;
      if (running > 0) throw new Error('generations must never overlap');
      running += 1;
      await gate;
      running -= 1;
      return { generation: makeGeneration(`gen-${count}`), coherent: true };
    },
    () => undefined
  );
  queue.request();
  queue.request();
  queue.request();
  assert.ok(count >= 1, 'the first generation starts immediately');
  release?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(count, 2, 'overlapping requests are coalesced into one more generation');
  assert.equal(queue.current?.generation.generation, 'gen-2');
  assert.equal(queue.current?.stale, false);

  // Failure: the last coherent generation stays, stale-labelled with the error.
  const failing = new GenerationQueue(
    async () => ({ failure: 'the linter exploded' }),
    () => undefined
  );
  failing.request();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(failing.current?.stale, true);
  assert.equal(failing.current?.error, 'the linter exploded');

  // Recovery: a successful run after a failure clears the stale flag.
  let fail = true;
  const recovering = new GenerationQueue(
    async () => (fail ? { failure: 'first run fails' } : { generation: makeGeneration('recovered'), coherent: true }),
    () => undefined
  );
  recovering.request();
  await new Promise((resolve) => setTimeout(resolve, 5));
  fail = false;
  recovering.request();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(recovering.current?.generation.generation, 'recovered');
  assert.equal(recovering.current?.stale, false);
  assert.equal(recovering.current?.error, undefined);

  // Incoherent outcome: the generation publishes but is labelled stale.
  const torn = new GenerationQueue(
    async () => ({ generation: makeGeneration('torn'), coherent: false }),
    () => undefined
  );
  torn.request();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(torn.current?.stale, true);
  assert.equal(torn.current?.generation.generation, 'torn');
});

test('the input-snapshot coherence check distinguishes coherent from torn runs', async () => {
  const realFingerprint = fingerprintInputs(projectRoot);
  assert.ok(realFingerprint.entries.size >= 60, 'the watched roots fingerprint the real inputs');
  // A coherent run: the fingerprint does not move between the two reads.
  const coherent = await generateWithCoherenceCheck(
    () => makeGeneration('coherent'),
    () => realFingerprint,
    () => realFingerprint
  );
  assert.deepEqual(coherent, { generation: makeGeneration('coherent'), coherent: true });
  // A torn run: the fingerprint moved under the engraving and keeps moving →
  // every attempt retries, then the last one publishes labelled stale.
  const before = fingerprintInputs(projectRoot);
  const changedEntries = new Map(fingerprintInputs(projectRoot).entries);
  changedEntries.set('__torn__/input.ts', 'moved');
  const changed = { entries: changedEntries };
  let attempt = 0;
  const exhausted = await generateWithCoherenceCheck(
    () => makeGeneration(`torn-${(attempt += 1)}`),
    () => before,
    () => changed
  );
  assert.equal(exhausted.coherent, false);
  assert.equal(exhausted.generation.generation, 'torn-4');
});

test('the watched-input filter covers the engraving roots and the dependency manifests', () => {
  assert.equal(isWatchedInput(`${projectRoot}/src/render/janko/engine.ts`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/src/scores/brahms-op118-no1.ts`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/src/render/janko/candidates.ts`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/data/some.source.json`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/public/midi/clip.mid`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/package.json`, projectRoot), true);
  assert.equal(isWatchedInput(`${projectRoot}/package-lock.json`, projectRoot), true);
  // Outside the roots: not watched.
  assert.equal(isWatchedInput(`${projectRoot}/test/janko-prepared-studio.test.ts`, projectRoot), false);
  assert.equal(isWatchedInput(`${projectRoot}/janko.html`, projectRoot), false);
  assert.equal(isWatchedInput(`${projectRoot}/public/janko.html`, projectRoot), false);
  assert.equal(isWatchedInput(`${projectRoot}/docs/reference/definitive_landscape_engraving.md`, projectRoot), false);
  // Inside the roots but not an engraving input: not watched.
  assert.equal(isWatchedInput(`${projectRoot}/src/render/janko/sketch.txt`, projectRoot), false);
});

test('the fingerprint changes when an input changes and its key is stable', () => {
  const first = fingerprintInputs(projectRoot);
  const key = snapshotKey(first);
  assert.equal(snapshotKey(fingerprintInputs(projectRoot)), key, 'stable across repeated fingerprints');
  const mutatedEntries = new Map(fingerprintInputs(projectRoot).entries);
  mutatedEntries.set('__synthetic__/engine.ts', 'changed');
  assert.notEqual(snapshotKey({ entries: mutatedEntries }), key, 'a changed input moves the snapshot key');
});

test('the thin viewer and its observer import no engraving module', async () => {
  const source = readFileSync(`${projectRoot}/src/render/janko/prepared/viewer.ts`, 'utf8');
  const imports = [...source.matchAll(/^import[^;]*from\s+'([^']+)';/gm)].map((m) => m[1]);
  assert.ok(imports.includes('virtual:janko-prepared-manifest') && imports.includes('./viewer-dom') && imports.includes('../studio-session'),
    'the viewer retains the prepared manifest, application and session seams');
  assert.ok(imports.every((name) => !/engine|linter|scores/.test(name)), 'the browser bundle carries no engraver');
  const domSource = readFileSync(`${projectRoot}/src/render/janko/prepared/viewer-dom.ts`, 'utf8');
  const domImports = [...domSource.matchAll(/^import[^;]*from\s+'([^']+)';/gm)].map((m) => m[1]);
  assert.ok(domImports.every((name) => !/engine|linter|scores|virtual:janko/.test(name)),
    'the DOM application layer has no engine, linter, score or virtual manifest dependency');
  const observerSource = readFileSync(`${projectRoot}/src/render/janko/prepared/observation.ts`, 'utf8');
  const observerImports = [...observerSource.matchAll(/^import[^;]*from\s+'([^']+)';/gm)].map((m) => m[1]);
  assert.ok(observerImports.every((name) => !/engine|linter|scores/.test(name)), 'the observer does not import engraving');
  for (const forbidden of ['../engine', '../linter', '../../scores', 'buildBachGoldberg', 'lintJankoScore', 'renderReferenceView', 'renderCandidatesView']) {
    assert.ok(!source.includes(forbidden), `the viewer must not reference ${forbidden}`);
    assert.ok(!domSource.includes(forbidden), `the DOM layer must not reference ${forbidden}`);
    assert.ok(!observerSource.includes(forbidden), `the observer must not reference ${forbidden}`);
  }
  assert.ok(!domSource.includes('virtual:janko-prepared-manifest'), 'the DOM layer stays free of the virtual seam (testable without a dev server)');
  // The actual HMR contract: the viewer accepts the manifest module by id —
  // the refresh path the dev seam pushes through.
  assert.ok(source.includes(`import.meta.hot.accept('${PREPARED_MANIFEST_ID}'`));
});

test('the viewer renders every manifest state explicitly, never blank, never live', () => {
  const generation = preparedOnce();
  const ready: Parameters<typeof renderPreparedStatus>[0] = {
    generation: generation.generation,
    artifactHashes: generation.artifactHashes,
    artifacts: generation.artifacts,
    status: generation.status,
    stale: false,
  };
  const preparedLine = renderPreparedStatus(ready);
  assert.ok(preparedLine.includes('0 violations'), 'the counts come from the manifest');
  assert.ok(preparedLine.includes('prepared'), 'the line names the prepared identity, not a live run');
  assert.equal(renderPreparedStatus({ ...ready, generation: 'pending' }).includes('preparing'), true);
  const stale = renderPreparedStatus({ ...ready, stale: true });
  assert.ok(stale.includes('stale'), 'a stale generation is labelled, never presented as current');
  const error = renderPreparedStatus({ ...ready, stale: true, error: 'the linter exploded' });
  assert.ok(error.includes('failed'), 'a failed regeneration is labelled');
  // The live studio's own marker is absent: the viewer never claims liveness.
  assert.ok(!preparedLine.includes('live'));
});

test('janko.html loads the thin viewer; the public mirror stays byte-identical', () => {
  const root = readFileSync(`${projectRoot}/janko.html`, 'utf8');
  const mirror = readFileSync(`${projectRoot}/public/janko.html`, 'utf8');
  assert.equal(sha256(root), sha256(mirror));
  assert.ok(root.includes('<script type="module" src="/src/render/janko/prepared/viewer.ts"></script>'));
  assert.ok(!root.includes('/src/render/janko/studio.ts'), 'the shell must not boot the in-browser engraving');
  assert.equal(root.indexOf('src/render/janko/prepared/viewer.ts'), root.lastIndexOf('src/render/janko/prepared/viewer.ts'), 'exactly one boot module');
  assert.match(root, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/, 'native browser zoom is not disabled');
  assert.deepEqual([...root.matchAll(/data-view-target="([^"]+)"/g)].map((match) => match[1]), ['candidates', 'reference'], 'exactly the approved two studio surfaces');
  assert.ok(root.includes('data-candidates-mode="source"') && root.includes('data-candidates-mode="engraving"'), 'the source comparison and prepared engraving remain available');
  assert.ok(root.includes('data-mobile-pane="reference"') && root.includes('data-mobile-pane="candidate"'), 'phone comparison keeps both Original and Published PDF controls');
  assert.match(root, />\s*Rotate to portrait\s*</i, 'the phone-landscape guard needs a readable rotation instruction, not inaccessible paper');
});

test('the portrait notice guards short phone landscape, not a fine-pointer desktop window', () => {
  const html = readFileSync(`${projectRoot}/janko.html`, 'utf8');
  const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(css, 'the studio shell must include its responsive styles');
  assert.match(css, /\.portrait-notice\s*\{\s*display:\s*none\s*;/,
    'the notice is not shown over normal studio content');

  // Inspect the actual media rules controlling the notice, not a single
  // breakpoint or a copy of the message. This covers comma-separated arms:
  // one unguarded narrow arm would still blank a desktop browser window.
  const rules: { query: string; body: string }[] = [];
  for (const match of css.matchAll(/@media\s+([^{}]+)\{/g)) {
    let depth = 1;
    let end = match.index! + match[0].length;
    for (; end < css.length && depth; end++) {
      if (css[end] === '{') depth++;
      if (css[end] === '}') depth--;
    }
    rules.push({ query: match[1], body: css.slice(match.index! + match[0].length, end - 1) });
  }
  const noticeRules = rules.filter(({ body }) => /\.portrait-notice\s*\{[^}]*display:\s*flex\s*;/.test(body));
  assert.ok(noticeRules.length, 'phone landscape must expose a readable notice');
  const matches = (query: string, width: number, height: number, pointer: 'coarse' | 'fine') =>
    query.split(',').some((arm) => arm.split(/\s+and\s+/i).every((condition) => {
      const feature = condition.trim().match(/^\(\s*(orientation|max-width|min-width|max-height|min-height|max-device-width|pointer|hover)\s*:\s*([\w-]+)\s*\)$/i);
      assert.ok(feature, `unsupported guard condition needs an explicit test case: ${condition}`);
      const [, name, value] = feature;
      if (name === 'orientation') return value === (width > height ? 'landscape' : 'portrait');
      if (name === 'pointer') return value === pointer;
      if (name === 'hover') return value === (pointer === 'fine' ? 'hover' : 'none');
      const size = name.includes('height') ? height : width;
      // A regular desktop's physical device width exceeds these narrow viewport
      // probes; a max-device-width condition cannot activate solely on resize.
      const actual = name === 'max-device-width' && pointer === 'fine' ? 1440 : size;
      const threshold = Number.parseInt(value, 10);
      return name.startsWith('min-') ? actual >= threshold : actual <= threshold;
    }));
  const visible = (width: number, height: number, pointer: 'coarse' | 'fine') =>
    noticeRules.some(({ query }) => matches(query, width, height, pointer));
  for (const height of [320, 450]) {
    assert.equal(visible(700, height, 'coarse'), true, 'short phone landscape needs the rotation notice');
    assert.equal(visible(700, height, 'fine'), false, 'resizing a desktop window must not hide the studio');
  }
  assert.equal(visible(390, 844, 'coarse'), false, 'portrait must keep the existing view and paper usable');
  assert.equal(visible(1440, 900, 'fine'), false, 'desktop landscape must remain usable');
  for (const rule of noticeRules) {
    assert.match(rule.body, /body\s*>\s*header\s*,\s*body\s*>\s*main\s*,\s*body\s*>\s*footer\s*\{\s*visibility:\s*hidden/, 'hidden ready frames must not appear behind the notice');
    assert.match(rule.body, /\.portrait-notice\s*\{[^}]*background:\s*#000(?:000)?\s*;/, 'the rotation surface is pitch black');
  }
});

test('reader shell keeps the prepared failure outlet, focus treatment and black surroundings', () => {
  const html = readFileSync(`${projectRoot}/janko.html`, 'utf8');
  assert.equal(html, readFileSync(`${projectRoot}/public/janko.html`, 'utf8'));
  assert.match(html, /id="janko-status"[^>]*role="status"/, 'real prepared failures retain an announced status outlet');
  assert.match(html, /:focus-visible\s*\{[^}]*outline/, 'keyboard focus remains visibly painted');
  assert.match(html, /--bg:\s*#000;/, 'authentic PDF and engraving paper remain surrounded by black');
  // Source pane creation, PDF rendering and canvas reuse are exercised against
  // the running viewer in janko-source-viewer.test.ts; do not pin this shell to
  // one grid or spacer selector instead of the reading behavior.
});

test('the round badge has black paper-first chrome in the mirrored studio shell', () => {
  const root = readFileSync(`${projectRoot}/janko.html`, 'utf8');
  // Check the final matching declaration, not the presence of a black token
  // elsewhere: earlier badge rules used to leave a tinted background visible.
  const declarations = [...root.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => selectors.split(',').some((selector) => selector.trim() === '.round-badge'))
    .flatMap(([, , body]) => [...body.matchAll(/(?:^|;)\s*background\s*:\s*([^;]+)/g)].map((match) => match[1].trim()));
  assert.ok(declarations.length > 0, 'badge background should be explicitly painted black');
  const last = declarations.at(-1)!;
  assert.ok(last === '#000' || last === '#000000' || (last === 'var(--bg)' && /--bg\s*:\s*#000(?:000)?\s*;/.test(root)),
    `round badge must finish on pure black, got ${last}`);
});

test('the vite config carries the prepared seam and the shell inputs', async () => {
  const { viteConfig } = await import('../vite.config');
  const plugins = (viteConfig as { plugins: { name?: string }[] }).plugins;
  assert.ok(plugins.some((p) => p.name === 'janko-prepared-studio'));
  const build = (viteConfig as { build: { rollupOptions: { input: Record<string, string> } } }).build;
  assert.equal(build.rollupOptions.input.janko, `${projectRoot}/janko.html`);
  assert.equal((viteConfig as { base: string }).base, './');
});

function makeGeneration(label: string): PreparedGeneration {
  return {
    generation: label,
    artifactHashes: { candidates: sha256(`c-${label}`), reference: sha256(`r-${label}`) },
    artifacts: { candidates: `<div>${label}</div>`, reference: `<div>${label}</div>` },
    status: { ok: true, violations: 0, warnings: 0, systems: 1, notes: 1, lintMs: 0 },
  };
}
