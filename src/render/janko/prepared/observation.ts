/** Browser-local diagnostic only. No server mutation or claim of compositor pixels. */
import { activePanelViews } from './viewer-dom';

export interface CandidateObservation {
  state: 'frame-opportunity' | 'unobserved';
  reason?: string;
  generation?: string;
  candidateRevision?: string;
  candidatesHash?: string;
  variantId?: string;
  apply?: string;
  observedAt?: number;
  observedEpochMs?: number;
}

/** Read live DOM facts, not the latest requested manifest or server's `ready`. */
export function candidateObservation(root: HTMLElement, doc: Document): CandidateObservation {
  const data = root.dataset;
  const identity = {
    generation: data.preparedGeneration,
    candidateRevision: data.preparedCandidateRevision,
    candidatesHash: data.preparedCandidatesHash,
    variantId: data.preparedVariantId,
    apply: data.preparedApply,
  };
  const reason = !root.isConnected ? 'disconnected' : doc.visibilityState !== 'visible' ? 'hidden' :
    data.preparedState !== 'ready' ? `prepared-${data.preparedState ?? 'unknown'}` :
    activePanelViews(root).join(',') !== 'candidates' ? 'wrong-view' :
    !Array.from(root.querySelectorAll<HTMLElement>('.view-panel')).some((panel) =>
      panel.dataset.view === 'candidates' && panel.getClientRects().length > 0) ? 'hidden-candidate-panel' :
    !identity.generation || !identity.candidateRevision || !identity.candidatesHash ? 'no-candidate' : undefined;
  return reason ? { state: 'unobserved', reason, ...identity } : { state: 'frame-opportunity', ...identity };
}

/**
 * Schedule two animation-frame callbacks after a coherent DOM swap and scroll
 * restoration. Revalidate *all* facts at the callback: an HMR fetch, tab switch,
 * hidden page or later swap invalidates an older callback. The marker documents
 * only a browser rendering opportunity, NOT a paint/compositor or human review.
 * Inspect the live document and cross-check the server's non-stale generation
 * before interpreting it; this local marker is not an acknowledgement endpoint.
 */
const serials = new WeakMap<HTMLElement, number>();
export function observeCandidateFrame(root: HTMLElement, doc: Document, win: Window): void {
  const serial = (serials.get(root) ?? 0) + 1;
  serials.set(root, serial);
  const initial = candidateObservation(root, doc);
  // Clear previous frame evidence immediately, including on a failed fetch.
  root.dataset.preparedObservation = JSON.stringify({ ...initial, state: 'unobserved', reason: 'awaiting-frame' });
  if (initial.state !== 'frame-opportunity') {
    root.dataset.preparedObservation = JSON.stringify(initial);
    return;
  }
  win.requestAnimationFrame(() => win.requestAnimationFrame(() => {
    const current = candidateObservation(root, doc);
    if (serials.get(root) !== serial) return;
    const same = current.state === 'frame-opportunity' &&
      current.apply === initial.apply && current.generation === initial.generation &&
      current.candidateRevision === initial.candidateRevision && current.candidatesHash === initial.candidatesHash &&
      current.variantId === initial.variantId;
    root.dataset.preparedObservation = JSON.stringify(same
      ? { ...current, observedAt: performance.now(), observedEpochMs: Date.now() }
      : { ...current, state: 'unobserved', reason: 'superseded-or-not-visible' });
  }));
}
