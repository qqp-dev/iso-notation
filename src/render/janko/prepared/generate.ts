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

import { createStudioConfig, renderCandidatesView, renderReferenceView, JankoStudioConfig } from '../studio';
import { lintJankoScore } from '../linter';
import type { PreparedGeneration, PreparedStatus } from './seam';

export type { PreparedArtifactKey, PreparedGeneration, PreparedStatus } from './seam';

/** sha256 hex digest of a UTF-8 string. */
function sha256Of(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Generate one coherent prepared studio (both views + the lint status). */
export function generatePreparedStudio(
  overrides: Partial<JankoStudioConfig> = {}
): PreparedGeneration {
  const config = createStudioConfig(overrides);
  const candidates = renderCandidatesView(config);
  const reference = renderReferenceView(config);
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
  return { generation, artifactHashes, artifacts: { candidates, reference }, status };
}
