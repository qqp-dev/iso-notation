/**
 * The prepared real-engine studio — the Vite seam (Round 49 §7, corrected).
 * ==========================================================================
 *
 * Vite owns the dev startup, the watch and the production generation; the
 * engraving itself happens in a fresh Node context, loaded lazily through
 * Vite's own TypeScript pipeline (`runnerImport`), never in the browser:
 *
 * - **config-graph isolation (Round 49 correction)** — the plugin imports only
 *   `./seam` (import-light by contract); the generator (`./generate.ts`) and
 *   its whole transitive chain (studio, engine, scores, linter) are loaded
 *   per generation through `runnerImport`, *outside* the config dependency
 *   graph. An engine/score/model edit therefore produces an in-place prepared
 *   regeneration — never the config-dependency server restart (a full reload)
 *   the uncorrected seam suffered.
 * - **dev** — a virtual manifest module (`virtual:janko-prepared-manifest`)
 *   serves the current generation; the artifacts are served from memory by a
 *   middleware under `/@janko-prepared/<sha256>.html`. The server's watcher
 *   observes every transitive input (engine, scores, model, options/tokens,
 *   registry, source data, external MIDI, the dependency manifests), coalesces
 *   and serializes changes, verifies the inputs stayed unchanged during each
 *   generation (else regenerates — a coherent snapshot is published, never a
 *   torn one), and pushes the refreshed manifest through the actual HMR
 *   protocol: a `js-update` whose `path` is the **accept-owner** (the client
 *   module that imported and accepted the manifest — the viewer) and whose
 *   `acceptedPath` is the manifest module's own URL. The client keys its
 *   accepting callbacks by the owner path (`hotModulesMap`), so an update
 *   addressed to the virtual module's own URL reaches no callback at all —
 *   the silent staleness the first implementation suffered.
 * - **build** — `buildStart` generates once; each artifact is emitted as a
 *   content-addressed asset (`janko-prepared/<sha256>.html`) and the manifest
 *   module resolves them with a relative `new URL(..., import.meta.url)`
 *   expression, so the URLs are correct under the repo's `'./'` base and under
 *   nested GitHub Pages bases alike. A generation failure fails the build.
 *
 * No committed review assets exist: dev serves from memory, build emits to
 * `dist`.
 */

import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { runnerImport, type Plugin, type ViteDevServer } from 'vite';

import {
  EMPTY_GENERATION,
  GenerationQueue,
  buildPreparedEmission,
  fingerprintInputs,
  generateWithCoherenceCheck,
  isWatchedInput,
  manifestModuleSource,
  type PreparedGeneration,
  type PreparedInputSnapshot,
} from './seam';

export const PREPARED_MANIFEST_ID = 'virtual:janko-prepared-manifest';
export const PREPARED_DEV_ARTIFACT_PREFIX = '/@janko-prepared/';

/** Re-exported for the tests and the thin CLI; the plugin itself needs only these. */
export {
  EMPTY_GENERATION,
  GenerationQueue,
  buildPreparedEmission,
  fingerprintInputs,
  generateWithCoherenceCheck,
  isWatchedInput,
  manifestModuleSource,
  snapshotKey,
} from './seam';
export type { PreparedGeneration, PreparedInputSnapshot, PublishedState } from './seam';

/** The publish callback receives the accepted-owner update targets. */
export interface PreparedHmrUpdate {
  /** The accept-owner module's browser URL (the client's callback key). */
  path: string;
  /** The accepted module's browser URL (what the client fetches). */
  acceptedPath: string;
}

/**
 * Compute the actual HMR update targets for the virtual manifest module:
 * the accept-owner boundary is the client-graph module that **imports and
 * accepts** the manifest (`acceptedHmrDeps`), and the accepted path is the
 * manifest module's own URL — exactly the pair Vite's own propagation would
 * name. Returns empty when the browser has not loaded the viewer yet (no
 * module graph entry: nothing to deliver, the next load reads the fresh
 * manifest anyway).
 */
export function preparedHmrTargets(
  clientGraph: {
    getModuleById: (id: string) =>
      | {
          url: string;
          importers: Set<{
            url: string;
            acceptedHmrDeps: Set<unknown>;
          }>;
        }
      | undefined;
  },
  manifestId: string
): PreparedHmrUpdate[] {
  const manifestMod = clientGraph.getModuleById(manifestId);
  if (!manifestMod) return [];
  const targets: PreparedHmrUpdate[] = [];
  for (const importer of manifestMod.importers) {
    if (!importer.acceptedHmrDeps.has(manifestMod)) continue;
    targets.push({ path: importer.url, acceptedPath: manifestMod.url });
  }
  return targets;
}

export interface JankoPreparedPluginOptions {
  /** The project root the watched inputs live under (default: cwd). */
  root?: string;
  /**
   * Test hook: replace the lazy `runnerImport` generation with a custom run
   * (fast fixtures). Production leaves it unset.
   */
  generate?: () => Promise<PreparedGeneration>;
}

export function jankoPreparedStudioPlugin(options: JankoPreparedPluginOptions = {}): Plugin {
  const root = resolve(options.root ?? process.cwd());
  let devServer: ViteDevServer | null = null;
  let isBuild = false;
  let emittedReferenceIds: Record<'candidates' | 'reference', string> | null = null;
  let buildGeneration: PreparedGeneration | null = null;
  let queue: GenerationQueue | null = null;

  /**
   * The lazy generator: loads `./generate.ts` through Vite's own pipeline at
   * generation time. The path resolves against this plugin module's real
   * location (the config bundling injects the original file URL, so the
   * expression is correct both bundled and unbundled). Loading per generation
   * means every run sees the *current* engine/score code — no cache, no
   * staleness, and the module never enters the config dependency graph.
   */
  const loadGenerator = async (): Promise<PreparedGeneration> => {
    if (options.generate) return options.generate();
    const generatorPath = fileURLToPath(new URL('./generate.ts', import.meta.url));
    const { module } = await runnerImport(generatorPath);
    const gen = (module as { generatePreparedStudio: () => PreparedGeneration }).generatePreparedStudio;
    return gen();
  };

  const generateCoherently = async (): Promise<
    { generation: PreparedGeneration; coherent: boolean } | { failure: string }
  > => {
    try {
      return await generateWithCoherenceCheck(
        loadGenerator,
        () => fingerprintInputs(root),
        () => fingerprintInputs(root)
      );
    } catch (error) {
      return { failure: error instanceof Error ? error.message : String(error) };
    }
  };

  const publishToServer = (): void => {
    if (!devServer || !queue) return;
    const clientGraph = devServer.environments.client.moduleGraph;
    const targets = preparedHmrTargets(clientGraph, `\0${PREPARED_MANIFEST_ID}`);
    if (targets.length === 0) return;
    for (const target of targets) {
      // The actual HMR protocol: invalidate the virtual module (its transform
      // cache drops) and deliver a js-update addressed to the accept-owner —
      // the client keys its callbacks by the owner path and qualifies them by
      // the accepted path, so this is the only shape that reaches the
      // viewer's `import.meta.hot.accept('virtual:janko-prepared-manifest', …)`.
      const manifestMod = clientGraph.getModuleById(`\0${PREPARED_MANIFEST_ID}`);
      if (manifestMod) devServer.environments.client.moduleGraph.invalidateModule(manifestMod);
      devServer.environments.client.hot.send({
        type: 'update',
        updates: [
          {
            type: 'js-update',
            path: target.path,
            acceptedPath: target.acceptedPath,
            timestamp: Date.now(),
          },
        ],
      });
    }
  };

  return {
    name: 'janko-prepared-studio',
    enforce: 'pre',

    config(_, env) {
      isBuild = env.command === 'build';
      return {};
    },

    configResolved() {
      if (isBuild) return;
      queue = new GenerationQueue(generateCoherently, () => publishToServer());
    },

    async buildStart() {
      if (!isBuild) return;
      const outcome = await generateCoherently();
      if ('failure' in outcome) {
        // A generation failure fails the build — never a stale bundle.
        this.error(`janko-prepared-studio: ${outcome.failure}`);
      }
      buildGeneration = outcome.generation;
      emittedReferenceIds = {
        candidates: this.emitFile({
          type: 'asset',
          fileName: `janko-prepared/${outcome.generation.artifactHashes.candidates}.html`,
          source: outcome.generation.artifacts.candidates,
        }),
        reference: this.emitFile({
          type: 'asset',
          fileName: `janko-prepared/${outcome.generation.artifactHashes.reference}.html`,
          source: outcome.generation.artifacts.reference,
        }),
      };
    },

    resolveId(id) {
      if (id === PREPARED_MANIFEST_ID) return `\0${PREPARED_MANIFEST_ID}`;
      return null;
    },

    load(id) {
      if (id !== `\0${PREPARED_MANIFEST_ID}`) return null;
      if (isBuild) {
        if (!buildGeneration || !emittedReferenceIds) {
          this.error('janko-prepared-studio: the manifest was loaded before generation completed');
        }
        // Runtime-concatenated relative `new URL(…, import.meta.url)`: correct
        // under any base ('./', nested GitHub Pages) and deliberately not a
        // static path literal — the artifact is a runtime-only emitted asset,
        // so the bundler must not try to resolve it at build time.
        return manifestModuleSource(buildGeneration, false, undefined, (_key, hash) =>
          `new URL('../janko-prepared/' + ${JSON.stringify(hash)} + '.html', import.meta.url).href`
        );
      }
      const devArtifactUrl = (_key: 'candidates' | 'reference', hash: string): string =>
        `'${PREPARED_DEV_ARTIFACT_PREFIX}${hash}.html'`;
      const current = queue?.current;
      if (!current) {
        // The first generation is still running: a pending manifest that the
        // viewer renders as an explicit preparing state (never blank, never a
        // browser-side engraving).
        return manifestModuleSource(EMPTY_GENERATION, false, undefined, devArtifactUrl);
      }
      return manifestModuleSource(current.generation, current.stale, current.error, devArtifactUrl);
    },

    configureServer(server) {
      devServer = server;
      // Serve the content-addressed artifacts from memory.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (!url.startsWith(PREPARED_DEV_ARTIFACT_PREFIX)) return next();
        const hash = url.slice(PREPARED_DEV_ARTIFACT_PREFIX.length).replace(/\.html$/, '');
        const current = queue?.current;
        const key =
          hash === current?.generation.artifactHashes.candidates
            ? 'candidates'
            : hash === current?.generation.artifactHashes.reference
              ? 'reference'
              : null;
        if (!key || !current) {
          res.statusCode = 404;
          res.end('unknown prepared artifact');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.end(current.generation.artifacts[key]);
      });
      // Kick the first generation off; the viewer renders its preparing state
      // until the manifest flips to ready. Every subsequent watched change is
      // coalesced (the queue folds overlapping requests) and serialized (one
      // generation at a time), and each settled generation is published.
      queue?.request();
      const onChange = (path: string): void => {
        if (!isWatchedInput(path, root)) return;
        queue?.request();
      };
      server.watcher.on('add', onChange);
      server.watcher.on('change', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}
