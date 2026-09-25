/**
 * The prepared real-engine studio — generation (Round 49 §7).
 * ============================================================
 *
 * The studio's two views are **engraved once, ahead of time**, by a fresh Node
 * context (the Vite plugin loads this module through `runnerImport` at
 * generation time) running the real engine and the real linter — never in the
 * browser. This module is the pure, deterministic generator:
 *
 * - **input** — the studio configuration exactly as the live studio builds it
 *   (`createStudioConfig`), so the prepared markup and the direct renderer's
 *   markup are the same bytes by construction (pinned by
 *   `test/janko-prepared-studio.test.ts`);
 * - **output** — the two view panels as inline-SVG HTML plus the linter status
 *   numbers of the primary score, hashed by content (no engine version, no
 *   timestamp: the same inputs always produce the same bytes and the same
 *   identity).
 *
 * The DOM/session/zoom viewer (`./viewer.ts`) never imports the engine, the
 * linter or any score builder: it loads a content-addressed artifact named by
 * a manifest and injects it. No review JSON and no raster image is ever
 * committed: in dev the artifacts live in the dev server's memory; in
 * production they are emitted `dist` assets.
 *
 * **Config-graph isolation (Round 49 correction):** this file deliberately
 * sits outside the `vite.config.ts` dependency graph — it is loaded lazily
 * per generation, so an engine/score/model edit triggers an in-place prepared
 * regeneration, never a dev-server restart. The shared payload types live in
 * `./seam` (import-light by contract).
 */

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { createStudioConfig, renderCandidatesView, renderReferenceView, type StaticCandidateMarkup, JankoStudioConfig } from '../studio';
import { lintJankoScore } from '../linter';
import { fingerprintInputs, snapshotKey, type PreparedGeneration, type PreparedInputSnapshot, type PreparedStatus } from './seam';
import { readCandidate, candidateScore, head, candidateHealth, SEMANTIC_STATE } from '../semantic-hand';

export type { PreparedArtifactKey, PreparedGeneration, PreparedStatus } from './seam';
export function staticInputKey(snapshot: PreparedInputSnapshot, stateFile: string): string {
  return snapshotKey({ entries: new Map([...snapshot.entries].filter(([file]) => file !== stateFile)) });
}

/** sha256 hex digest of a UTF-8 string. */
function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Process-local, read-only reuse of canonical view bytes. The semantic card is never cached. */
export interface PreparedStaticCache {
  key?: string;
  cards?: StaticCandidateMarkup;
  reference?: string;
}

/** Generate one coherent prepared studio (both views + the lint status). */
export function generatePreparedStudio(
  overrides: Partial<JankoStudioConfig> = {},
  candidateRoot?: string,
  candidatePath = SEMANTIC_STATE,
  cache?: PreparedStaticCache
): PreparedGeneration {
  const started = performance.now();
  const health = candidateRoot ? candidateHealth(candidateRoot, candidatePath) : undefined;
  const state = candidateRoot && health?.state === 'current' ? readCandidate(candidateRoot, candidatePath) : undefined;
  const semanticCandidate = state?.records.length ? { score: candidateScore(state), revision: head(state, candidateRoot), reviewWindows: state.records.at(-1)!.effects.reviewWindows } : undefined;
  const semanticCandidateError = health?.state === 'stale' ? health.diagnostic : undefined;
  const config = createStudioConfig({ ...overrides, ...(semanticCandidate ? { semanticCandidate } : {}), ...(semanticCandidateError ? { semanticCandidateError } : {}) });
  // The full watched content snapshot (including font binaries) is the
  // dependency identity. Exclude ONLY the ignored semantic state: its output
  // lives in the independently rendered semantic card. Coherence is still
  // checked around the entire generation by the plugin, including that state.
  const eligible = !!cache && !!candidateRoot && Object.keys(overrides).length === 0;
  const snapshot = eligible ? fingerprintInputs(candidateRoot!) : undefined;
  const staticKey = snapshot && staticInputKey(snapshot, resolve(candidateRoot!, candidatePath));
  const hit = !!staticKey && cache?.key === staticKey && !!cache.cards && !!cache.reference;
  const configMs = performance.now() - started;
  let cards: StaticCandidateMarkup | undefined;
  const candidates = renderCandidatesView(config, hit ? cache!.cards : undefined, value => { cards = value; });
  const candidatesMs = performance.now() - started - configMs;
  const reference = hit ? cache!.reference! : renderReferenceView(config);
  if (eligible && staticKey && cards && !hit) {
    cache!.key = staticKey;
    cache!.cards = cards;
    cache!.reference = reference;
  }
  const referenceMs = performance.now() - started - configMs - candidatesMs;
  // The status line of the primary score, computed by the real linter — the
  // same call the live studio's footer makes, here resolved once at generation
  // time so the browser never runs the linter.
  const report = lintJankoScore(config.score, config.options, config.tokens);
  const status: PreparedStatus = {
    ok: report.ok,
    violations: report.stats.violations,
    warnings: report.stats.warnings,
    systems: report.stats.systems,
    notes: report.stats.notes,
    lintMs: Math.round(report.stats.durationMs),
  };
  const lintMs = performance.now() - started - configMs - candidatesMs - referenceMs;
  const phaseMs = { config: +configMs.toFixed(1), candidates: +candidatesMs.toFixed(1), reference: +referenceMs.toFixed(1), lint: +lintMs.toFixed(1) };
  const artifactHashes = {
    candidates: sha256Of(candidates),
    reference: sha256Of(reference),
  };
  // The identity hashes the artifact bytes and the deterministic status facts;
  // the measured lint wall-time is reported but never hashed (a timing is not
  // an input, and the same engraving must always carry the same identity).
  const generation = sha256Of(
    JSON.stringify({
      candidates: artifactHashes.candidates,
      reference: artifactHashes.reference,
      status: { ok: status.ok, violations: status.violations, warnings: status.warnings, systems: status.systems, notes: status.notes },
    })
  );
  return { generation, artifactHashes, artifacts: { candidates, reference }, status, phaseMs, candidateRevision: semanticCandidate?.revision, ...(semanticCandidateError ? { candidateError: semanticCandidateError } : {}) };
}
