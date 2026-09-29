/**
 * The prepared real-engine studio — the manifest's type and the viewer's
 * status line (Round 49 §7).
 *
 * Pure and engine-free: importable from Node (tests, scripts) as well as from
 * the browser viewer. The status line is rendered by the viewer **from the
 * manifest's published facts** — the browser never runs the linter and never
 * claims a live engraving.
 */

/** The manifest the Vite seam serves (virtual module; see vite-plugin.ts). */
export interface PreparedManifest {
  generation: string;
  artifactHashes: { candidates: string; reference: string };
  artifacts: { candidates: string; reference: string };
  status: {
    ok: boolean;
    violations: number;
    warnings: number;
    systems: number;
    notes: number;
    lintMs: number;
  };
  stale: boolean;
  candidateRevision?: string;
  canonicalRevisions?: Record<string, string>;
  engineIdentity?: string;
  variantId?: string;
  candidateError?: string;
  error?: string;
}

/** Short live announcement only; identities and errors belong in the closed diagnostics. */
export function renderPreparedStatus(manifest: PreparedManifest): string {
  if (manifest.generation === 'pending') return 'preparing engraving…';
  if (manifest.error) return 'Engraving generation failed — last coherent output retained if available.';
  if (manifest.stale) return 'Engraving output is stale — inputs changed; regenerating.';
  if (manifest.candidateError) return 'Engraving prepared; saved draft was not applied.';
  if (!manifest.status.ok) return 'Engraving lint failed — see diagnostics.';
  return 'Engraving prepared.';
}

/** Full published facts, never placed in the live region. */
export function renderPreparedDiagnostics(manifest: PreparedManifest): string {
  const counts = `${manifest.status.violations} violations · ${manifest.status.warnings} warnings · ${manifest.status.systems} systems · ${manifest.status.notes} noteheads`;
  return `${renderPreparedStatus(manifest)} ${counts} · prepared ${manifest.generation}${manifest.candidateRevision ? ` · candidate revision ${manifest.candidateRevision}` : ''}${manifest.engineIdentity ? ` · engine ${manifest.engineIdentity}` : ''}${manifest.canonicalRevisions ? ` · canonical revisions ${JSON.stringify(manifest.canonicalRevisions)}` : ''}${manifest.error ? ` · generation error: ${manifest.error}` : ''}${manifest.candidateError ? ` · saved candidate diagnostic: ${manifest.candidateError}` : ''}`;
}
