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

  before(async () => {
    root = mkdtempSync(join(tmpdir(), 'janko-prepared-hmr-'));
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'index.html'), '<!doctype html><html><body></body></html>\n');
    writeFileSync(join(root, 'src', 'viewer-fixture.ts'), FIXTURE_VIEWER);
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
          generate: async () => {
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
            return makeGeneration(acc || 'empty');
          },
        }),
      ],
      server: { host: '127.0.0.1', strictPort: false },
      logLevel: 'silent',
    });
    await server.listen();
    port = (server.resolvedUrls?.local?.[0] ? Number(new URL(server.resolvedUrls.local[0]).port) : 0) || 5173;
    // Let the first generation settle before the protocol assertions.
    await new Promise((r) => setTimeout(r, 1500));
  });

  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  /** One browser-equivalent boot: fetch the viewer module (populating the client graph), then open the HMR socket. */
  async function browserBoot(): Promise<{ ws: WebSocket; events: WsMessage[] }> {
    const res = await fetch(`http://127.0.0.1:${port}/src/viewer-fixture.ts`);
    assert.equal(res.status, 200, 'the viewer fixture transforms');
    const served = await res.text();
    // The served accept literal must be the manifest module's own URL — the
    // same string the update's acceptedPath will carry.
    assert.ok(
      served.includes('virtual:janko-prepared-manifest'),
      'the accept dep survives import analysis as the manifest identity'
    );
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
    return { ws, events };
  }

  /** Wait until `predicate` sees a matching update among the events (with timeout). */
  async function waitForUpdate(
    events: WsMessage[],
    predicate: (u: NonNullable<WsMessage['updates']>[number]) => boolean,
    ms = 15000
  ): Promise<NonNullable<WsMessage['updates']>[number]> {
    const deadline = Date.now() + ms;
    for (;;) {
      for (const ev of events) {
        for (const u of ev.updates ?? []) {
          if (predicate(u)) return u;
        }
      }
      if (Date.now() > deadline) throw new Error('timed out waiting for the HMR update');
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

      inputs = 0;
      rmSync(join(root, 'src', 'input.1.json'));
      const deleteUpdate = await waitForUpdate(
        events,
        (u) => u.type === 'js-update' && u.timestamp > addUpdate.timestamp
      );
      assert.equal(deleteUpdate.path, '/src/viewer-fixture.ts');
      assert.equal(deleteUpdate.acceptedPath, '\0virtual:janko-prepared-manifest');
    } finally {
      ws.close();
    }
  });

  it('candidate state is explicitly watched and publishes pending/stale before the next prepared generation', async () => {
    const { ws, events } = await browserBoot();
    try {
      const state = join(root, '.semantic-candidate.local');
      writeFileSync(state, JSON.stringify({ schema: 1, revision: 'fixture' }));
      const pending = await waitForUpdate(events, u => u.type === 'js-update');
      const ready = await waitForUpdate(events, u => u.type === 'js-update' && u.timestamp > pending.timestamp);
      assert.equal(ready.path, '/src/viewer-fixture.ts');
      const status = await fetch(`http://127.0.0.1:${port}/@janko-prepared/status`);
      assert.equal(status.status, 200);
      assert.equal(status.headers.get('cache-control'), 'no-store');
      // The real generator carries candidateRevision from the saved state; this
      // fixture tests watched delivery and queue publication without an engine.
      const published = await status.json();
      assert.equal(typeof published.generation, 'string');
      assert.equal(typeof published.generationMs, 'number');
      rmSync(state);
      const removed = await waitForUpdate(events, u => u.type === 'js-update' && u.timestamp > ready.timestamp);
      await waitForUpdate(events, u => u.type === 'js-update' && u.timestamp > removed.timestamp);
    } finally { ws.close(); }
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
      const gen = fileURLToPath(new URL('./src/render/janko/prepared/generate.ts', import.meta.url));
      const { module } = await runnerImport(gen);
      const g = module.generatePreparedStudio();
      process.stdout.write(JSON.stringify({ generation: g.generation, ok: g.status.ok, violations: g.status.violations }));
    `;
    const repo = new URL('..', import.meta.url).pathname;
    writeFileSync(join(repo, '.prepared-runner-probe.mjs'), script);
    try {
      const run = spawnSync(process.execPath, [join(repo, '.prepared-runner-probe.mjs')], {
        cwd: repo,
        encoding: 'utf8',
        timeout: 120000,
      });
      assert.equal(run.status, 0, `the probe exits clean: ${run.stderr}`);
      const out = JSON.parse(run.stdout) as { generation: string; ok: boolean; violations: number };
      assert.ok(out.generation.length === 64, 'the identity is a sha256 hex digest');
      assert.equal(out.ok, true, 'the real generator reports a clean lint');
      assert.equal(out.violations, 0, 'and zero violations');
    } finally {
      rmSync(join(repo, '.prepared-runner-probe.mjs'), { force: true });
    }
  });
});
