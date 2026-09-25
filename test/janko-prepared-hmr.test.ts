/**
 * Prepared-studio HMR delivery — the real Vite protocol, end to end.
 * ===================================================================
 *
 * The corrected seam must deliver refreshed prepared output through the
 * **actual Vite HMR propagation**, not a bare invalidation that assumes some
 * other path will carry the update. These tests stand up a real Vite dev
 * server (`createServer`) over a temp fixture project whose viewer module
 * accepts the virtual manifest, connect a real WebSocket client speaking the
 * Vite HMR protocol, and assert the exact payload the browser client acts on:
 *
 * - the update's `path` is the **accept-owner** (the module that imported and
 *   accepted the manifest — the viewer), because the client keys its
 *   callbacks in `hotModulesMap` by the owner path;
 * - the update's `acceptedPath` is the manifest module's own browser URL,
 *   exactly the string the import-analysis overwrite recorded in the
 *   viewer's `accept(...)` deps — the client qualifies callbacks by it and
 *   dynamic-imports it for the fresh manifest;
 * - add / change / delete of a **non-config-graph** watched input each
 *   publishes a new generation (never a config dependency: the fixture's
 *   inputs live under the fixture root and the generation is injected).
 *
 * The config-graph isolation is pinned separately: `loadConfigFromFile` on
 * the real `vite.config.ts` must report a dependency set that contains the
 * plugin seam only — no generator, studio, engine or score module.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createServer, type ViteDevServer } from 'vite';

import {
  jankoPreparedStudioPlugin,
  PREPARED_MANIFEST_ID,
  type PreparedGeneration,
} from '../src/render/janko/prepared/vite-plugin';
import { sha256 } from '../src/render/janko/prepared/seam';

const VITE_PORT_ENV = 'PREPARED_HMR_TEST_PORT';

/** A deterministic generation whose candidates artifact embeds the input bytes. */
function makeGeneration(input: string): PreparedGeneration {
  const candidates = `<candidates>${input}</candidates>`;
  const reference = `<reference>${input}</reference>`;
  const artifactHashes = { candidates: sha256(candidates), reference: sha256(reference) };
  return {
    generation: sha256(candidates + reference),
    artifactHashes,
    artifacts: { candidates, reference },
    status: { ok: true, violations: 0, warnings: 0, systems: 1, notes: 1, lintMs: 0 },
  };
}

const FIXTURE_VIEWER = `\
import prepared from 'virtual:janko-prepared-manifest';
if (import.meta.hot) {
  import.meta.hot.accept('virtual:janko-prepared-manifest', (mod) => {
    globalThis.__fixtureManifest = mod ? mod.default : undefined;
  });
}
globalThis.__fixtureManifest = prepared;
`;

/** WebSocket message awaited from the dev server's HMR channel. */
interface WsMessage {
  type: string;
  updates?: Array<{ type: string; path: string; acceptedPath: string; timestamp: number }>;
}

describe('prepared studio HMR delivery (real vite server, real protocol)', () => {
  let root = '';
  let server: ViteDevServer | null = null;
  let port = 0;
  let inputs = 0;
  let generationGate: Promise<void> | null = null;
  let generationFailure: string | null = null;
  // Only the publication allocator reads this injected clock. Vite timers and
  // the test watchdog continue to use the real clock.
  let publicationClockSample: number | null = null;

  before(async () => {
    root = mkdtempSync(join(tmpdir(), 'janko-prepared-hmr-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<!doctype html><html><body></body></html>\n');
    writeFileSync(join(root, 'src', 'viewer-fixture.ts'), FIXTURE_VIEWER);
    writeFileSync(join(root, 'src', 'viewer-fixture-alt.ts'), FIXTURE_VIEWER);
    writeFileSync(join(root, 'src', 'input.0.json'), JSON.stringify({ v: 0 }));
    const portEnv = process.env[VITE_PORT_ENV];
    server = await createServer({
      root,
      configFile: false,
      appType: 'spa',
      optimizeDeps: { noDiscovery: true, include: [] },
      plugins: [
        jankoPreparedStudioPlugin({
          root,
          publicationClock: () => publicationClockSample ?? Date.now(),
          generate: async () => {
            if (generationGate) await generationGate;
            if (generationFailure) throw new Error(generationFailure);
            // The fixture generation embeds every input file's bytes, so any
            // add/change/delete moves the artifact identity.
            let acc = '';
            for (let i = 0; i < inputs; i++) {
              try {
                acc += readFileSync(join(root, 'src', `input.${i}.json`), 'utf8');
              } catch {
                /* deleted inputs simply stop contributing */
              }
            }
            const candidateState = join(root, '.semantic-candidate.local');
            let revision = '';
            try { revision = (JSON.parse(readFileSync(candidateState, 'utf8')) as { revision: string }).revision; }
            catch { /* a removed candidate state is an ordinary generation */ }
            const generated = makeGeneration((acc || 'empty') + revision);
            if (revision) generated.candidateRevision = revision;
            return generated;
          },
        }),
      ],
      server: { host: '127.0.0.1', strictPort: false },
      logLevel: 'silent',
    });
    await server.listen();
    port = (server.resolvedUrls?.local?.[0] ? Number(new URL(server.resolvedUrls.local[0]).port) : 0) || 5173;
    // Wait for the initial publication AND the chokidar subscription rather
    // than sleeping through a potentially slow watcher/server startup.
    const deadline = Date.now() + 10000;
    for (;;) {
      const response = await fetch(`http://127.0.0.1:${port}/@janko-prepared/status`);
      assert.equal(response.status, 200, 'the prepared status endpoint is reachable');
      const state = await response.json() as { generation: string; stale: boolean; error?: string };
      const watched = server.watcher.getWatched()[join(root, 'src')] ?? [];
      if (state.generation !== 'pending' && !state.stale && watched.includes('input.0.json')) break;
      if (Date.now() > deadline) throw new Error(`initial generation/watcher not ready: ${JSON.stringify({ state, watched })}`);
      await new Promise((r) => setTimeout(r, 50));
    }
  });

  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  /** One browser-equivalent boot: fetch the viewer module (populating the client graph), then open the HMR socket. */
  async function browserBoot(twoOwners = false): Promise<{ ws: WebSocket; events: WsMessage[]; manifestPath: string }> {
    const res = await fetch(`http://127.0.0.1:${port}/src/viewer-fixture.ts`);
    assert.equal(res.status, 200, 'the viewer fixture transforms');
    const served = await res.text();
    // The served accept literal must be the manifest module's own URL — the
    // same string the update's acceptedPath will carry.
    assert.ok(
      served.includes('virtual:janko-prepared-manifest'),
      'the accept dep survives import analysis as the manifest identity'
    );
    const manifestPath = served.match(/\/@id\/__x00__virtual:janko-prepared-manifest/)?.[0];
    assert.ok(manifestPath, `the served viewer imports the browser manifest URL: ${served}`);
    if (twoOwners) {
      const other = await fetch(`http://127.0.0.1:${port}/src/viewer-fixture-alt.ts`);
      assert.equal(other.status, 200, 'the second accept-owner transforms');
      await other.text();
    }
    const events: WsMessage[] = [];
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, 'vite-hmr');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ws open timeout')), 5000);
      ws.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      ws.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error('ws error'));
      };
    });
    ws.onmessage = (m) => {
      try {
        events.push(JSON.parse(String(m.data)) as WsMessage);
      } catch {
        /* non-JSON frames ignored */
      }
    };
    return { ws, events, manifestPath };
  }

  /** Wait for a matching update in the live event list, beginning at an event position. */
  async function waitForUpdate(
    events: WsMessage[],
    predicate: (u: NonNullable<WsMessage['updates']>[number]) => boolean,
    fromEvent = 0,
    ms = 15000
  ): Promise<NonNullable<WsMessage['updates']>[number]> {
    const deadline = Date.now() + ms;
    for (;;) {
      for (let i = fromEvent; i < events.length; i++) {
        for (const u of events[i].updates ?? []) {
          if (predicate(u)) return u;
        }
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for the HMR update from event ${fromEvent}; events=${JSON.stringify(events)}`);
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  it('a change to a non-config-graph watched input delivers a js-update to the accept-owner with the manifest acceptedPath', async () => {
    const { ws, events } = await browserBoot();
    try {
      writeFileSync(join(root, 'src', 'input.0.json'), JSON.stringify({ v: 1 }));
      const update = await waitForUpdate(events, (u) => u.type === 'js-update');
      // The accept-owner: the fixture viewer module that imported AND
      // accepted the manifest — not the virtual module's own URL (which
      // reaches no callback: the silent staleness the correction fixes).
      assert.equal(update.path, '/src/viewer-fixture.ts');
      // The accepted path is the manifest module's own URL exactly as the
      // import-analysis overwrite recorded it in the viewer's accept deps.
      assert.equal(update.acceptedPath, '\0virtual:janko-prepared-manifest');
      assert.equal(typeof update.timestamp, 'number');
    } finally {
      ws.close();
    }
  });

  it('add and delete of watched inputs each publish again (coalesced queue, one update per settled generation)', async () => {
    const { ws, events } = await browserBoot();
    try {
      inputs = 1;
      writeFileSync(join(root, 'src', 'input.1.json'), JSON.stringify({ v: 'added' }));
      const addUpdate = await waitForUpdate(events, (u) => u.type === 'js-update');
      assert.equal(addUpdate.path, '/src/viewer-fixture.ts');

      const afterAdd = events.length;
      inputs = 0;
      rmSync(join(root, 'src', 'input.1.json'));
      const deleteUpdate = await waitForUpdate(events, (u) => u.type === 'js-update', afterAdd);
      assert.equal(deleteUpdate.path, '/src/viewer-fixture.ts');
      assert.equal(deleteUpdate.acceptedPath, '\0virtual:janko-prepared-manifest');
    } finally {
      ws.close();
    }
  });

  it('candidate publications have distinct browser URLs under equal and rollback clock samples, including pending, ready and failed/stale', async () => {
    const { ws, events, manifestPath } = await browserBoot(true);
    const state = join(root, '.semantic-candidate.local');
    type Manifest = { generation: string; candidateRevision?: string; stale: boolean; error?: string };
    const updates = () => events.flatMap(e => e.updates ?? []).filter(u =>
      u.type === 'js-update' && u.acceptedPath === '\0virtual:janko-prepared-manifest'
    );
    // One publication sends one update per owner; pick publications by event
    // position, NOT by timestamp (equal timestamps are precisely the defect).
    const ownerPairs: NonNullable<WsMessage['updates']>[] = [];
    const nextPublication = async (offset: number) => {
      const deadline = Date.now() + 15000;
      while (updates().length < offset + 2) {
        if (Date.now() > deadline) throw new Error(`missing publication at offset ${offset}; updates=${JSON.stringify(updates())}; events=${JSON.stringify(events)}`);
        await new Promise(r => setTimeout(r, 100));
      }
      const pair = updates().slice(offset, offset + 2);
      assert.deepEqual(pair.map(u => u.path).sort(), ['/src/viewer-fixture-alt.ts', '/src/viewer-fixture.ts']);
      ownerPairs.push(pair);
      return pair[0];
    };
    const readManifest = async (timestamp: number): Promise<Manifest> => {
      // fetch() has no browser script destination; ?import instructs Vite's
      // transform middleware to serve the same JS module as a dynamic import.
      const url = `http://127.0.0.1:${port}${manifestPath}?import&t=${timestamp}`;
      const response = await fetch(url, { headers: { 'sec-fetch-dest': 'script' } });
      assert.equal(response.status, 200, `the browser can fetch ${url}`);
      const source = await response.text();
      const payload = source.match(/const manifest = (\{[\s\S]*?\});\s*export default/);
      assert.ok(payload, `the browser receives a manifest module at ${url}: ${source}`);
      return JSON.parse(payload[1]) as Manifest;
    };
    let release: (() => void) | undefined;
    const holdGeneration = () => {
      generationGate = new Promise<void>(resolve => { release = resolve; });
    };
    try {
      const baseline = await readManifest(Date.now());
      // Fixed then backwards samples are injected into the publication seam,
      // never into the global Date.now used by Vite and the test watchdog.
      publicationClockSample = 4_100_000_000_000;
      holdGeneration();
      writeFileSync(state, JSON.stringify({ schema: 1, revision: 'fixture-ready' }));
      const pending = await nextPublication(0);
      // Evaluate clock identity after the generator is released: an expected
      // pre-fix assertion failure must not leave a gated run contaminating the
      // next independent watcher test.
      const pendingManifest = await readManifest(pending.timestamp);
      assert.equal(pendingManifest.generation, baseline.generation);
      assert.equal(pendingManifest.stale, true);
      publicationClockSample -= 10;
      release?.(); generationGate = null;
      const ready = await nextPublication(2);
      const readyManifest = await readManifest(ready.timestamp);
      assert.equal(readyManifest.stale, false);
      assert.equal(readyManifest.candidateRevision, 'fixture-ready');
      assert.notEqual(readyManifest.generation, pendingManifest.generation);
      const status = await fetch(`http://127.0.0.1:${port}/@janko-prepared/status`);
      assert.equal(status.status, 200);
      assert.equal(status.headers.get('cache-control'), 'no-store');
      const published = await status.json();
      assert.equal(published.generation, readyManifest.generation);
      assert.equal(typeof published.generationMs, 'number');

      // A second rapid candidate publication with an equal sample first
      // advertises stale, then preserves the last coherent output on failure.
      holdGeneration();
      generationFailure = 'fixture generation failed';
      publicationClockSample = 4_099_999_999_990;
      writeFileSync(state, JSON.stringify({ schema: 1, revision: 'fixture-failed' }));
      const failedPending = await nextPublication(4);
      const failedPendingManifest = await readManifest(failedPending.timestamp);
      assert.equal(failedPendingManifest.stale, true);
      assert.equal(failedPendingManifest.generation, readyManifest.generation);
      release?.(); generationGate = null;
      const failed = await nextPublication(6);
      const failedManifest = await readManifest(failed.timestamp);
      assert.equal(failedManifest.stale, true);
      assert.equal(failedManifest.error, 'fixture generation failed');
      assert.equal(failedManifest.generation, readyManifest.generation);

      generationFailure = null;
      holdGeneration();
      rmSync(state);
      const removed = await nextPublication(8);
      assert.equal((await readManifest(removed.timestamp)).stale, true);
      release?.(); generationGate = null;
      const recovered = await nextPublication(10);
      assert.equal((await readManifest(recovered.timestamp)).stale, false);
      // All payload/state checks above run even on the old plugin. Identity
      // assertions are collected last so a pre-fix failure cannot leave a
      // generator held open or hide which states were actually delivered.
      assert.ok(pending.timestamp >= 4_100_000_000_000, `the injected clock was used: ${JSON.stringify(updates())}`);
      for (const pair of ownerPairs) {
        assert.equal(pair[0].timestamp, pair[1].timestamp, `all owners share a publication identity: ${JSON.stringify(pair)}`);
        assert.ok(Number.isSafeInteger(pair[0].timestamp), 'Vite timestamps are safe numeric query values');
      }
      const publications = [pending, ready, failedPending, failed, removed, recovered];
      for (let i = 1; i < publications.length; i++) {
        assert.ok(publications[i].timestamp > publications[i - 1].timestamp,
          `successive publications must have distinct browser URLs: ${JSON.stringify(updates())}`);
      }
    } finally {
      release?.(); generationGate = null;
      generationFailure = null;
      publicationClockSample = null;
      rmSync(state, { force: true });
      ws.close();
    }
  });

  it('unwatched files never trigger a generation (the watcher filter stays exact)', async () => {
    const { ws, events } = await browserBoot();
    try {
      writeFileSync(join(root, 'src', 'notes.txt'), 'not an engraving input');
      writeFileSync(join(root, 'README.md'), 'not watched either');
      let quiet = true;
      const deadline = Date.now() + 2000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 200));
        if (events.some((e) => (e.updates ?? []).length > 0)) {
          quiet = false;
          break;
        }
      }
      assert.ok(quiet, 'no HMR update fires for unwatched paths');
    } finally {
      ws.close();
    }
  });
});

describe('prepared studio config-graph isolation (the real config bundling)', () => {
  it('the bundled vite.config dependencies contain the seam only — no generator, studio, engine or score', async () => {
    // loadConfigFromFile reports exactly the files the config bundler pulled
    // into the config's dependency graph — the set whose edits restart the
    // dev server. The generator chain must stay out of it.
    const { loadConfigFromFile } = await import('vite');
    const configPath = fileURLToPath(new URL('../vite.config.ts', import.meta.url));
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'development' }, configPath);
    assert.ok(loaded, 'the real config loads');
    const deps = loaded.dependencies.map((d) => d.replace(/\\/g, '/'));
    const endsWith = (suffix: string): boolean => deps.some((d) => d.endsWith(suffix));
    assert.ok(endsWith('/vite.config.ts'), 'the config itself is tracked');
    assert.ok(endsWith('prepared/vite-plugin.ts'), 'the plugin seam is tracked');
    assert.ok(endsWith('prepared/seam.ts'), 'the pure payload/queue seam is tracked');
    for (const forbidden of [
      'prepared/generate.ts',
      'render/janko/studio.ts',
      'render/janko/engine.ts',
      'render/janko/linter.ts',
      'render/janko/candidates.ts',
      'scores/brahms-op118-no1.ts',
    ]) {
      assert.ok(!endsWith(forbidden), `the config graph must not contain ${forbidden} (got ${deps.join(', ')})`);
    }
  });

  it('the generation runs outside the config process graph: generate.ts imports the engine, the plugin does not', () => {
    const repo = new URL('..', import.meta.url).pathname;
    const pluginSource = readFileSync(join(repo, 'src/render/janko/prepared/vite-plugin.ts'), 'utf8');
    // The plugin's only local import is the seam; the generator is a runtime
    // `runnerImport` of `./generate.ts`, never a static import.
    assert.match(pluginSource, /from '\.\/seam'/, 'the plugin imports the pure seam');
    assert.doesNotMatch(pluginSource, /from '\.\/generate'/, 'the plugin never statically imports the generator');
    assert.match(pluginSource, /runnerImport/, 'the generator loads through the vite pipeline');
    assert.match(pluginSource, /new URL\('\.\/generate\.ts', import\.meta\.url\)/, 'resolved at generation time');
  });
});

/** Guard: the runnerImport smoke (the real generator loads through the pipeline). */
describe('prepared studio lazy generation (runnerImport seam)', () => {
  it('a fresh runnerImport executes the real generator and reports a deterministic identity', async () => {
    // Spawned as its own node process so the test process never holds the
    // inline environment alive.
    const script = `
      import { runnerImport } from 'vite';
      import { fileURLToPath } from 'node:url';
      const gen = fileURLToPath(new URL('../src/render/janko/prepared/generate.ts', import.meta.url));
      const { module } = await runnerImport(gen);
      const g = module.generatePreparedStudio();
      process.stdout.write(JSON.stringify({ generation: g.generation, ok: g.status.ok, violations: g.status.violations }));
    `;
    const repo = fileURLToPath(new URL('..', import.meta.url));
    // A unique in-repo directory keeps import.meta.url and bare Vite resolution
    // intact without two probe processes racing on a shared root filename.
    const probeDir = mkdtempSync(join(repo, '.prepared-runner-probe-'));
    const probe = join(probeDir, 'probe.mjs');
    writeFileSync(probe, script);
    try {
      const started = Date.now();
      const run = spawnSync(process.execPath, [probe], {
        cwd: repo,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const bounded = (text: string | null) => text && text.length > 8000
        ? `${text.slice(0, 2000)} … [truncated] … ${text.slice(-6000)}` : text;
      const context = `probe=${probe} cwd=${repo} node=${process.version} elapsedMs=${Date.now() - started}` +
        ` status=${run.status} signal=${run.signal} error=${run.error ? `${(run.error as NodeJS.ErrnoException).code}: ${run.error.message}` : 'none'}` +
        ` stdout=${bounded(run.stdout)} stderr=${bounded(run.stderr)}`;
      assert.equal(run.status, 0, `the probe exits clean: ${context}`);
      const out = JSON.parse(run.stdout) as { generation: string; ok: boolean; violations: number };
      assert.ok(out.generation.length === 64, 'the identity is a sha256 hex digest');
      assert.equal(out.ok, true, 'the real generator reports a clean lint');
      assert.equal(out.violations, 0, 'and zero violations');
    } finally {
      rmSync(probeDir, { recursive: true, force: true });
    }
  });
});
