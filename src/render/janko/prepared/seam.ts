/**
 * The prepared real-engine studio — the pure delivery seam (Round 49 §7).
 * =======================================================================
 *
 * This module holds everything the Vite plugin needs that does **not** depend
 * on the engraving chain: the manifest payload, the generation queue, the
 * coherence check, the watched-input filter and the production emission. It
 * must stay import-light on purpose: `vite.config.ts` bundles it into the
 * config's dependency graph, and every file in that graph **restarts the dev
 * server** when it changes (`handleHMRUpdate` treats config dependencies as
 * restart triggers). The generator (`./generate.ts`) and everything it pulls
 * in (studio, engine, scores, linter) must therefore never be imported from
 * here — the plugin loads the generator lazily at generation time through
 * Vite's own `runnerImport`, outside the config graph entirely, so an engine
 * edit produces an in-place prepared regeneration instead of a server
 * restart.
 *
 * No committed review assets exist: dev serves from memory, build emits to
 * `dist`.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

/** The two view artifacts of one generation. */
export type PreparedArtifactKey = 'candidates' | 'reference';

/** The primary score's lint status, as the viewer's status line prints it. */
export interface PreparedStatus {
  ok: boolean;
  violations: number;
  warnings: number;
  systems: number;
  notes: number;
  lintMs: number;
}

/** One generation's deterministic payload: artifact bytes + status numbers. */
export interface PreparedGeneration {
  /** Content hash (sha256, hex) of the whole generation's inputs→outputs. */
  generation: string;
  /** sha256 of each artifact's bytes — the content-addressed asset names. */
  artifactHashes: Record<PreparedArtifactKey, string>;
  /** The artifact bytes, keyed by view. */
  artifacts: Record<PreparedArtifactKey, string>;
  /** The primary score's lint status, computed by the real linter. */
  status: PreparedStatus;
  /** Exact saved semantic revision represented by the candidate artifact, if any. */
  candidateRevision?: string;
  /** A refused stale saved candidate; the Reference artifact remains canonical. */
  candidateError?: string;
  /** Server-only measurement; excluded from content-addressed generation identity. */
  generationMs?: number;
}

/**
 * The generation's own inputs, for coherence verification: a generation must
 * never be published from inputs that changed while it ran. The watcher
 * supplies the observed input fingerprint; the plugin re-checks it after the
 * generation and retries when it moved.
 */
export interface PreparedInputSnapshot {
  /** `path → sha256(content)` of every watched input, sorted by path. */
  entries: ReadonlyMap<string, string>;
}

/** sha256 hex digest of a UTF-8 string. */
export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function snapshotKey(snapshot: PreparedInputSnapshot): string {
  return sha256(
    [...snapshot.entries]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}:${v}`)
      .join('\n')
  );
}

/** The watched input roots, relative to the project root. */
const WATCH_ROOTS = ['src', 'data', 'public/midi'];
const WATCH_FILES = ['package.json', 'package-lock.json', '.semantic-candidate.local'];
const WATCH_EXTENSIONS = ['.ts', '.tsx', '.json', '.ily', '.mid', '.midi', '.ly'];

/** Whether a watched-event path is an engraving input the prepared studio must regenerate on. */
export function isWatchedInput(path: string, root: string): boolean {
  const abs = resolve(path);
  if (WATCH_FILES.some((f) => abs === resolve(root, f))) return true;
  for (const dir of WATCH_ROOTS) {
    const base = resolve(root, dir) + sep;
    if (!abs.startsWith(base)) continue;
    return WATCH_EXTENSIONS.some((ext) => abs.endsWith(ext));
  }
  return false;
}

/**
 * Fingerprint every watched input that exists right now (path → content
 * hash). A file deleted between two fingerprints changes the key set, so the
 * comparison is coherent for add/change/delete alike.
 */
export function fingerprintInputs(root: string): PreparedInputSnapshot {
  const entries = new Map<string, string>();
  const visit = (dir: string): void => {
    let names: string[] = [];
    try {
      names = existsSync(dir) ? readdirSync(dir) : [];
    } catch {
      return;
    }
    for (const name of names) {
      const abs = join(dir, name);
      let stat;
      try {
        stat = statSync(abs);
      } catch {
        continue;
      }
      if (stat.isDirectory()) visit(abs);
      else if (WATCH_EXTENSIONS.some((ext) => abs.endsWith(ext))) {
        try {
          entries.set(abs, sha256(readFileSync(abs, 'utf8')));
        } catch {
          /* a file that vanished mid-walk is simply absent from the snapshot */
        }
      }
    }
  };
  for (const dir of WATCH_ROOTS) visit(resolve(root, dir));
  for (const file of WATCH_FILES) {
    const abs = resolve(root, file);
    if (existsSync(abs)) {
      try {
        entries.set(abs, sha256(readFileSync(abs, 'utf8')));
      } catch {
        /* unreadable → absent */
      }
    }
  }
  return { entries };
}

/** A manifest published before the first successful generation. */
export const EMPTY_GENERATION: PreparedGeneration = {
  generation: 'pending',
  artifactHashes: { candidates: 'pending', reference: 'pending' },
  artifacts: { candidates: '', reference: '' },
  status: { ok: false, violations: 0, warnings: 0, systems: 0, notes: 0, lintMs: 0 },
};

/**
 * The virtual manifest module's source. `resolveArtifact` maps an artifact
 * hash to its URL expression: in dev, the middleware's absolute path; in
 * build, a **relative `new URL(..., import.meta.url)` expression** so the
 * URL stays correct under any base (the repo's `'./'`, nested GitHub Pages).
 */
export function manifestModuleSource(
  generation: PreparedGeneration,
  stale: boolean,
  error: string | undefined,
  resolveArtifact: (key: 'candidates' | 'reference', hash: string) => string
): string {
  const payload = {
    generation: generation.generation,
    artifactHashes: generation.artifactHashes,
    status: generation.status,
    candidateRevision: generation.candidateRevision,
    candidateError: generation.candidateError,
    stale,
    ...(error !== undefined ? { error } : {}),
  };
  return [
    `// Prepared by the real engine at build/dev time — never computed in the browser.`,
    `const artifacts = {`,
    `  candidates: ${resolveArtifact('candidates', generation.artifactHashes.candidates)},`,
    `  reference: ${resolveArtifact('reference', generation.artifactHashes.reference)},`,
    `};`,
    `const manifest = ${JSON.stringify(payload, null, 2)};`,
    `export default { ...manifest, artifacts };`,
    ``,
  ].join('\n');
}

/** The published state of the prepared studio. */
export interface PublishedState {
  generation: PreparedGeneration;
  /** True when the published generation was produced from inputs that have since moved, or after a failure. */
  stale: boolean;
  error?: string;
}

/** One queued, coalesced, serialized regeneration loop. */
export class GenerationQueue {
  private running = false;
  private queued = false;
  private published: PublishedState | null = null;

  constructor(
    private readonly run: () => Promise<
      { generation: PreparedGeneration; coherent: boolean } | { failure: string }
    >,
    private readonly onPublished: (state: PublishedState) => void
  ) {}

  get current(): PublishedState | null {
    return this.published;
  }

  request(markCandidatePending = false): void {
    // Candidate writes must not advertise the previous saved revision as ready.
    // Ordinary source HMR retains its existing single-update-per-generation contract.
    if (markCandidatePending && this.published) {
      this.published = { ...this.published, stale: true };
      this.onPublished(this.published);
    }
    this.queued = true;
    if (this.running) return;
    this.running = true;
    void this.drain();
  }

  private async drain(): Promise<void> {
    while (this.queued) {
      this.queued = false;
      const outcome = await this.run();
      if ('failure' in outcome) {
        // The last coherent generation stays published, labelled stale; the
        // error is published with it — never presented as current.
        this.published = this.published
          ? { ...this.published, stale: true, error: outcome.failure }
          : { generation: EMPTY_GENERATION, stale: true, error: outcome.failure };
      } else {
        this.published = { generation: outcome.generation, stale: !outcome.coherent };
      }
      this.onPublished(this.published);
    }
    this.running = false;
  }
}

/**
 * The production emission: the two content-addressed asset files the build
 * must emit (`janko-prepared/<sha256>.html`). Pure, so the plugin's
 * `buildStart` and the tests exercise the same code.
 */
export interface PreparedEmittedAsset {
  fileName: string;
  source: string;
}

export function buildPreparedEmission(generation: PreparedGeneration): PreparedEmittedAsset[] {
  return [
    { fileName: `janko-prepared/${generation.artifactHashes.candidates}.html`, source: generation.artifacts.candidates },
    { fileName: `janko-prepared/${generation.artifactHashes.reference}.html`, source: generation.artifacts.reference },
  ];
}

/**
 * One coherence-checked generation attempt loop: fingerprint the inputs,
 * engrave, fingerprint again — only a run whose inputs did not move is
 * coherent; a torn result is retried (up to `attempts`), then published
 * labelled stale. `readBefore`/`readAfter` are injectable so tests can force
 * torn observation without racing real files. The run may be synchronous or
 * asynchronous (the lazy `runnerImport` load is async).
 */
export async function generateWithCoherenceCheck(
  run: () => PreparedGeneration | Promise<PreparedGeneration>,
  readBefore: () => PreparedInputSnapshot,
  readAfter: () => PreparedInputSnapshot,
  attempts = 3
): Promise<{ generation: PreparedGeneration; coherent: boolean }> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const before = snapshotKey(readBefore());
    const generation = await run();
    const after = snapshotKey(readAfter());
    if (before === after) return { generation, coherent: true };
  }
  return { generation: await run(), coherent: false };
}
