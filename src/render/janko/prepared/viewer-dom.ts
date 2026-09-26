/**
 * The prepared real-engine studio — the DOM application layer (Round 49 §7).
 * ========================================================================
 *
 * Pure DOM primitives for the thin viewer (`./viewer.ts`): collect the shell,
 * switch the two panels, apply one manifest generation. No engine, no linter,
 * no score builder, no virtual import and no `window` access beyond what the
 * caller passes — so the tests can drive the exact shipped code against a
 * swap-simulating DOM.
 *
 * Two historical defects pin the contracts of this module:
 *
 * - **Live collection on every switch.** `root.innerHTML` swaps detach the
 *   panel nodes; any handler that closes over previously collected panels
 *   toggles dead markup while the studio silently stays on the wrong view.
 *   {@link showView} therefore re-queries the panels and tabs at call time.
 * - **Re-show the session view on the fresh panels after every swap.** The
 *   injected artifact markup arrives without any active panel; without an
 *   explicit re-show BOTH panels end up hidden (a blank studio under a ready
 *   label) and the scroll restore then clamps the reader's place to 0 against
 *   the collapsed document. {@link createPreparedApplier} re-shows the view
 *   before it resolves, so the caller's `restorePlace` always runs against
 *   laid-out content.
 */

import type { StudioReviewSession } from '../studio-session';
import { renderPreparedStatus, type PreparedManifest } from './status';

/** The studio zoom bounds (shared by the zoom policy and the label). */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3.0;

/** The shell elements the viewer wires: root, label, status, tabs, panels. */
export interface StudioDom {
  root: HTMLElement;
  zoomLabel: HTMLElement | null;
  status: HTMLElement | null;
  tabs: HTMLElement[];
  panels: HTMLElement[];
}

/**
 * Collect the shell DOM. Panels live inside `root` (and are replaced by every
 * artifact swap); tabs, status and the zoom label live in the page shell and
 * survive. Anything that acts on panels after a swap must re-collect.
 */
export function collectStudioDom(root: HTMLElement): StudioDom {
  const doc = root.ownerDocument;
  return {
    root,
    zoomLabel: doc.getElementById('janko-zoom-label'),
    status: doc.getElementById('janko-status'),
    tabs: Array.from(doc.querySelectorAll<HTMLElement>('[data-view-target]')),
    panels: Array.from(root.querySelectorAll<HTMLElement>('.view-panel')),
  };
}

/** Apply one clamped zoom factor to the root and the zoom label. */
export function applyZoom(dom: StudioDom, zoom: number): void {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(zoom * 100) / 100));
  dom.root.style.setProperty('--janko-zoom', String(clamped));
  dom.root.dataset.zoom = String(clamped);
  if (dom.zoomLabel) dom.zoomLabel.textContent = `${Math.round(clamped * 100)}%`;
}

/**
 * Show `view`'s panel and tab. The panels and tabs are re-queried **at call
 * time** — after an `innerHTML` swap the previous nodes are detached, and a
 * stale collection would toggle dead markup while both live panels stay
 * hidden.
 */
export function showView(root: HTMLElement, view: string): void {
  const doc = root.ownerDocument;
  for (const panel of Array.from(root.querySelectorAll<HTMLElement>('.view-panel'))) {
    panel.classList.toggle('is-active', panel.dataset.view === view);
  }
  for (const tab of Array.from(doc.querySelectorAll<HTMLElement>('[data-view-target]'))) {
    tab.classList.toggle('is-active', tab.dataset.viewTarget === view);
  }
}

/** The panel ids currently visible (live query — for tests and diagnostics). */
export function activePanelViews(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.view-panel'))
    .filter((panel) => panel.classList.contains('is-active'))
    .map((panel) => panel.dataset.view ?? '');
}

/** Everything one view switch (tab click / hash change) does, in order. */
export function selectStudioView(args: {
  session: StudioReviewSession;
  root: HTMLElement;
  view: string;
  afterLayout: (apply: () => void) => void;
  /** Address-bar update (the tab path passes it; the hash path is already there). */
  setHash?: (view: string) => void;
}): void {
  args.session.setView(args.view);
  showView(args.root, args.view);
  args.setHash?.(args.view);
  args.session.capture();
  args.session.restorePlace(args.afterLayout);
}

/** What one {@link PreparedApplier.apply} pass did — explicit, never silent. */
export type ApplyOutcome =
  /** The manifest says the first generation is still running. */
  | 'preparing'
  /** A failed regeneration: the last coherent output stays, labelled stale. */
  | 'stale-kept'
  /** A failure before any output exists: the message is shown. */
  | 'error-shown'
  /** A superseded response (out-of-order fetches): dropped, never applied. */
  | 'dropped'
  /** An artifact failed to load with output on screen: kept, labelled stale. */
  | 'artifact-failed-kept'
  /** An artifact failed to load before any output: the message is shown. */
  | 'artifact-failed-shown'
  /** A coherent generation was applied (both surfaces swapped). */
  | 'applied';

export type PreparedArtifactKey = 'candidates' | 'reference';

export interface PreparedApplier {
  /**
   * Apply one manifest generation. `view` is read **after** the artifact swap
   * (the reader may switch tabs while the fetches are in flight) and re-shown
   * on the fresh panels before this promise resolves.
   */
  apply(manifest: PreparedManifest, view: () => string): Promise<ApplyOutcome>;
  /** The generation whose bytes are on screen (null before the first swap). */
  appliedGeneration(): string | null;
  /** How many generations this document has applied (`data-prepared-apply`). */
  appliedCount(): number;
}

/**
 * Create the manifest applier: the explicit preparing/ready/stale/error state
 * machine over `root`, with the out-of-order fetch guard and the post-swap
 * view re-show. `fetchText` is injected so the tests exercise failures and
 * races without a network.
 */
export function createPreparedApplier(args: {
  root: HTMLElement;
  status: HTMLElement | null;
  fetchText: (key: PreparedArtifactKey, url: string) => Promise<string>;
}): PreparedApplier {
  const { root, status, fetchText } = args;
  // Survive a viewer re-mount (HMR of the viewer module itself): the applied
  // generation and the apply counter live on the root element, so the
  // stale/error semantics and the browser harness's cycle marker stay honest.
  let applied: string | null = root.dataset.preparedGeneration ?? null;
  let serial = 0;
  let count = Number(root.dataset.preparedApply ?? '0') || 0;

  return {
    appliedGeneration: () => applied,
    appliedCount: () => count,

    async apply(manifest, view): Promise<ApplyOutcome> {
      const token = ++serial;
      // Any pending/failing generation invalidates a prior frame marker, even
      // while the last coherent panels are still displayed.
      root.dataset.preparedObservation = JSON.stringify({ state: 'unobserved', reason: 'manifest-requested' });
      if (status) {
        status.textContent = renderPreparedStatus(manifest);
        status.dataset.live = 'false';
      }
      if (manifest.generation === 'pending') {
        root.dataset.preparedState = 'preparing';
        return 'preparing';
      }
      if (manifest.error && applied !== null) {
        // A failed regeneration: the last coherent output stays on screen, now
        // labelled stale — never silently presented as current.
        root.dataset.preparedState = 'stale';
        return 'stale-kept';
      }
      if (manifest.error) {
        root.dataset.preparedState = 'error';
        root.innerHTML =
          `<p style="color:#f87171;font-size:13px">The prepared studio failed to generate: ` +
          `${manifest.error}</p>`;
        return 'error-shown';
      }
      root.dataset.preparedState = manifest.stale && applied !== null ? 'refreshing' : 'loading';
      const fetchStart = performance.now();
      const generationToken = manifest.generation;
      let candidates: string;
      let reference: string;
      try {
        [candidates, reference] = await Promise.all([
          fetchText('candidates', manifest.artifacts.candidates),
          fetchText('reference', manifest.artifacts.reference),
        ]);
      } catch (error) {
        if (token !== serial) return 'dropped';
        // A malformed or missing artifact is explicit, never a blank panel —
        // and the last-good output stays if one was applied.
        const message = error instanceof Error ? error.message : String(error);
        if (applied !== null) {
          root.dataset.preparedState = 'stale';
        } else {
          root.dataset.preparedState = 'error';
          root.innerHTML =
            `<p style="color:#f87171;font-size:13px">The prepared artifact could not be loaded: ` +
            `${message}</p>`;
        }
        if (status) status.textContent = renderPreparedStatus({ ...manifest, error: message });
        return applied !== null ? 'artifact-failed-kept' : 'artifact-failed-shown';
      }
      // Out-of-order guard: a response for a superseded generation is dropped.
      if (token !== serial) return 'dropped';
      root.dataset.preparedFetchMs = (performance.now() - fetchStart).toFixed(1);
      root.dataset.preparedAppliedEpochMs = String(Date.now());
      applied = generationToken;
      root.dataset.preparedGeneration = generationToken;
      // Identities describe the bytes actually swapped, never an in-flight or
      // failed manifest. A candidate-free apply must clear an older identity.
      if (manifest.candidateRevision) root.dataset.preparedCandidateRevision = manifest.candidateRevision;
      else delete root.dataset.preparedCandidateRevision;
      root.dataset.preparedCandidatesHash = manifest.artifactHashes.candidates;
      if (manifest.variantId) root.dataset.preparedVariantId = manifest.variantId;
      else delete root.dataset.preparedVariantId;
      count += 1;
      root.dataset.preparedApply = String(count);
      root.innerHTML = `${candidates}\n${reference}`;
      root.dataset.preparedState = manifest.stale ? 'stale' : 'ready';
      if (status) status.textContent = renderPreparedStatus(manifest);
      // The fresh markup redefines the panels and arrives with no active one;
      // re-show the session's view NOW, before the caller restores the scroll
      // place — a hidden panel collapses the document and clamps the reader
      // back to the top.
      showView(root, view());
      return 'applied';
    },
  };
}
