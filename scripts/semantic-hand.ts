#!/usr/bin/env node
/** JSON CLI for the candidate-only hand service. No TS editing required. */
import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import { baseline, head, readCandidate, candidateHealth, executeHandCommand, recoverHandCandidate, SEMANTIC_STATE, type HandPhaseTiming } from '../src/render/janko/semantic-hand';
const [action, ...argv] = process.argv.slice(2);
const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const root = process.cwd();
const path = option('state') ?? SEMANTIC_STATE;
const started = performance.now();
async function main() {
  if (action === 'promote') throw new Error('promotion requires separate exact-candidate operator judgment and release authorization; not implemented');
  if (!['status', 'change', 'explain', 'undo', 'recover'].includes(action)) throw new Error(`unsupported command ${action}`);
  const health = candidateHealth(root, path);
  if (action === 'status') return { ...health, baseline: baseline(root), ...(health.state === 'current' ? { saved: readCandidate(root, path).records.length > 0, records: readCandidate(root, path).records.length } : {}) };
  if (health.state === 'stale' && action !== 'recover') throw new Error(`stale candidate: ${health.diagnostic}; ${health.recovery}`);
  const state = action === 'recover' ? undefined : readCandidate(root, path);
  const resolveMs = performance.now() - started;
  if (action === 'explain') {
    const record = state!.records.at(-1);
    if (!record) return { revision: head(state!, root), saved: false, effect: 'NO_VISIBLE_EFFECT' };
    if (option('revision') && option('revision') !== record.revision) throw new Error('stale/unknown explanation revision');
    return { revision: record.revision, operation: record.operation, ...record.effects };
  }
  const input = option('json') ? JSON.parse(readFileSync(option('json')!, 'utf8')) : JSON.parse(readFileSync(0, 'utf8'));
  const phases: HandPhaseTiming = { started: performance.now(), resolveMs: 0, layoutEffectsMs: 0, saveMs: 0 };
  const result = action === 'recover' ? recoverHandCandidate(input, root, path) :
    executeHandCommand(action === 'change' ? { action, request: input } : { action: 'undo', base: input.base, revision: input.revision }, root, path, phases);
  const deriveLayoutLintMs = performance.now() - started - resolveMs;
  // Dev Vite's watcher owns publication. Poll its authoritative status endpoint;
  // a file save is never reported as a prepared, browser-ready generation.
  const url = option('server') ?? 'http://100.102.70.49:5175';
  const publishStart = performance.now();
  let publication: { state: 'pending' | 'ready'; generation?: string; candidatesHash?: string; generationMs?: number; reason?: string } = { state: 'pending', reason: 'dev studio not observed' };
  const timeout = Number(option('wait-ms') ?? 5000);
  if (timeout > 0) {
    while (performance.now() - publishStart < timeout) {
      try {
        const response = await fetch(`${url}/@janko-prepared/status`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) {
          const status = await response.json() as { candidateRevision?: string; candidateError?: string; generation: string; artifactHashes?: { candidates: string }; generationMs?: number; stale: boolean };
          publication = status.candidateRevision === result.revision && !status.stale && !status.candidateError
            ? { state: 'ready', generation: status.generation, candidatesHash: status.artifactHashes?.candidates, generationMs: status.generationMs }
            : { state: 'pending', generation: status.generation, reason: 'matching prepared generation not yet published' };
          if (publication.state === 'ready') break;
        }
      } catch { /* no server: saved candidate remains pending */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  return { ...result, publication, timingsMs: { startup: +started.toFixed(1), resolve: +resolveMs.toFixed(1), guardResolve: +phases.resolveMs.toFixed(1), layoutEffects: +phases.layoutEffectsMs.toFixed(1), save: +phases.saveMs.toFixed(1), deriveLayoutLint: +deriveLayoutLintMs.toFixed(1), publicationWait: +(performance.now() - publishStart).toFixed(1), commandTotal: +performance.now().toFixed(1) } };
}
main().then(value => console.log(JSON.stringify(value, null, 2))).catch(error => { console.error(JSON.stringify({ error: String(error) })); process.exitCode = 1; });
