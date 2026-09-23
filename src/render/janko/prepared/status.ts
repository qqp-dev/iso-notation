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
  candidateError?: string;
  error?: string;
}

/** The status line the viewer renders from the manifest's published facts. */
export function renderPreparedStatus(manifest: PreparedManifest): string {
  if (manifest.generation === 'pending') {
    return 'preparing the engraving… (the real engine is generating the views)';
  }
  const verdict = manifest.error
    ? '✗ generation failed — showing the last coherent output'
    : manifest.stale
      ? '⏳ stale — inputs changed; regenerating'
      : manifest.status.ok
        ? '✓'
        : '✗';
  const counts = `${manifest.status.violations} violations · ${manifest.status.warnings} warnings · ${manifest.status.systems} systems · ${manifest.status.notes} noteheads`;
  return `${verdict} ${counts} · prepared ${manifest.generation.slice(0, 12)}${manifest.candidateRevision ? ` · candidate ${manifest.candidateRevision.slice(0, 12)}` : ''}${manifest.candidateError ? ` · saved candidate STALE — not applied: ${manifest.candidateError}` : ''}`;
}
