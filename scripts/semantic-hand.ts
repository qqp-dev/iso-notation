#!/usr/bin/env node
/** JSON CLI for the candidate-only hand service. No TS editing required. */
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { baseline, head, readCandidate, candidateHealth, executeHandCommand, recoverHandCandidate, inspectDurationCandidate, activeDurationVariants, SEMANTIC_STATE, SEMANTIC_SCORE, selectScore, type HandPhaseTiming } from '../src/render/janko/semantic-hand';
import { executeCanonicalCommand, type CanonicalIntent } from '../src/render/janko/active-transaction';
const [action, ...argv] = process.argv.slice(2);
const option = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const root = process.cwd();
const path = option('state') ?? SEMANTIC_STATE;
const started = performance.now();
async function main() {
  if (action === 'promote') throw new Error('No candidate promotion: an approved canonical data edit uses active-change directly.');
  if (action === 'active-status' || action === 'active-change' || action === 'active-undo') {
    const selected = option('score');
    if (!selected) throw new Error('active transactions require an explicit --score');
    const input = action === 'active-status' ? undefined : option('json') ? JSON.parse(readFileSync(option('json')!, 'utf8')) : JSON.parse(readFileSync(0, 'utf8'));
    const result = executeCanonicalCommand(action.slice('active-'.length) as 'status' | 'change' | 'undo', selected,
      input as CanonicalIntent | { base: string; revision: string } | undefined, root,
      option('active-file') ?? 'src/scores/data/active-scores.json', option('history-file') ?? '.canonical-history.local');
    if (action === 'active-status' || option('active-file')) return result;
    // A guarded no-op against the initial revision has no history to publish.
    // Retried submitted requests may still require the publisher to finish
    // verifying Pages propagation, so only skip a replay without a record.
    if ('replay' in result && result.replay) {
      const status = executeCanonicalCommand('status', selected, undefined, root,
        'src/scores/data/active-scores.json', option('history-file') ?? '.canonical-history.local');
      if (status.records === 0) return { ...result, publication: status.publication };
    }
    // Only the explicitly designated persistent service/deployment checkout
    // can submit an automatic release. Isolated state files never publish.
    if (!process.env.JANKO_DEPLOY_CHECKOUT) return { ...result, publication: 'pending', reason: 'persistent publisher not configured' };
    const published = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/publish-active.ts'],
      { cwd: root, encoding: 'utf8', timeout: 720000 })) as { state: string; revision: string };
    if (published.revision !== result.revision) throw new Error('publisher returned a different active revision');
    return { ...result, publication: published.state };
  }
  if (!['status', 'change', 'explain', 'undo', 'recover', 'inspect-duration'].includes(action)) throw new Error(`unsupported command ${action}`);
  const score = selectScore(option('score') ?? SEMANTIC_SCORE);
  const health = candidateHealth(root, path, score);
  if (action === 'inspect-duration') {
    if (health.state !== 'current') throw new Error(`stale candidate: ${health.diagnostic}`);
    return { score, revision: health.revision, marks: inspectDurationCandidate(score, Number(option('measure')), option('tick') === undefined ? undefined : Number(option('tick')), readCandidate(root, path, score)) };
  }
  if (action === 'status') return { ...health, baseline: baseline(root, score), ...(health.state === 'current' ? {
    saved: readCandidate(root, path, score).records.length > 0, records: readCandidate(root, path, score).records.length,
    variants: activeDurationVariants(readCandidate(root, path, score)).map(v => ({ id: v.id, score: v.score, revision: v.revision, lint: v.lint, refusals: v.refusals, windows: v.windows })),
  } : {}) };
  if (health.state === 'stale' && action !== 'recover') throw new Error(`stale candidate: ${health.diagnostic}; ${health.recovery}`);
  const state = action === 'recover' ? undefined : readCandidate(root, path, score);
  const resolveMs = performance.now() - started;
  if (action === 'explain') {
    const record = state!.records.at(-1);
    if (!record) return { revision: head(state!, root, score), saved: false, effect: 'NO_VISIBLE_EFFECT' };
    if (option('revision') && option('revision') !== record.revision) throw new Error('stale/unknown explanation revision');
    return { revision: record.revision, operation: record.operation, ...record.effects };
  }
  const input = option('json') ? JSON.parse(readFileSync(option('json')!, 'utf8')) : JSON.parse(readFileSync(0, 'utf8'));
  const phases: HandPhaseTiming = { started: performance.now(), resolveMs: 0, layoutEffectsMs: 0, saveMs: 0 };
  const result = action === 'recover' ? recoverHandCandidate(input, root, path, score) :
    executeHandCommand(action === 'change' ? { action, request: input } : { action: 'undo', base: input.base, revision: input.revision }, root, path, phases, score);
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
