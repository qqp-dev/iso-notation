/**
 * The prepared real-engine studio — the thin viewer (Round 49 §7).
 * ================================================================
 *
 * This module is the browser's entire studio: it imports **no** engine, no
 * linter and no score builder — it loads the manifest of the current
 * generation, fetches the two content-addressed artifacts it names, injects
 * their markup and wires the shared session (tabs, zoom, scroll restore). All
 * engraving and all linting happened ahead of time in a Node process; the
 * viewer only renders prepared bytes. The DOM application primitives (panel
 * switching on **live** nodes, the manifest state machine, the post-swap view
 * re-show) live in `./viewer-dom`; this file owns only `window`/session wiring.
 *
 * States are explicit and never blank:
 * - `preparing` — the first generation is still running (the manifest says
 *   `pending`);
 * - `ready` — a coherent generation is on screen;
 * - `stale` — the published generation is the last coherent one but its
 *   inputs have since moved (or a regeneration failed): the status line
 *   labels it, never presenting it as current;
 * - `error` — no generation could be published: the message is shown.
 *
 * HMR: the manifest is a virtual module; the viewer `accept`s it by id, so
 * the dev server's `js-update` for that module delivers the refreshed
 * manifest (and with it the new artifact URLs) without any user action,
 * preserving the selected tab, zoom and scroll through the shared session.
 * Out-of-order fetches are guarded: an artifact response is applied only when
 * its manifest generation is still the applied one.
 */

import {
  openStudioReviewSession,
  STUDIO_SCROLL_CAPTURE_DELAY_MS,
  writeStudioState,
  type StudioScrollPort,
  type StudioSessionHost,
  type StudioStorageLike,
} from '../studio-session';

import prepared from 'virtual:janko-prepared-manifest';
import { observeCandidateFrame, observeReferenceFrame } from './observation';
import { watchDeployedRelease } from './deployed';
import { decorateReferenceReader, readReferenceReader, writeReferenceReader, type ReferenceScore } from './reference-reader';
import type { PreparedManifest } from './status';
import {
  applyZoom,
  collectStudioDom,
  createPreparedApplier,
  selectStudioView,
  showView,
  type PreparedApplier,
  type PreparedArtifactKey,
  ZOOM_MAX,
  ZOOM_MIN,
} from './viewer-dom';

const ZOOM_STEP = 0.25;
const ROOT_ID = 'janko-studio';

/** Listeners installed by the previous mount (detached on re-mount). */
interface ViewerListeners {
  detach: () => void;
}
const GLOBAL_SCOPE = globalThis as unknown as { __jankoStudioListeners?: ViewerListeners };

function detachPreviousListeners(): void {
  GLOBAL_SCOPE.__jankoStudioListeners?.detach();
  GLOBAL_SCOPE.__jankoStudioListeners = undefined;
}

function viewFromHash(fallback: string): string {
  const hash = explicitViewFromHash();
  return hash === 'candidates' || hash === 'reference' ? hash : fallback;
}

function explicitViewFromHash(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hash = window.location.hash.replace(/^#/, '');
  return hash === '' ? undefined : hash;
}

function studioScrollPort(): StudioScrollPort {
  return {
    get: () => (typeof window === 'undefined' ? 0 : window.scrollY || window.pageYOffset || 0),
    set: (top) => {
      if (typeof window !== 'undefined') window.scrollTo(0, top);
    },
    max: () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
      const height = Math.max(
        document.documentElement?.scrollHeight ?? 0,
        document.body?.scrollHeight ?? 0
      );
      return Math.max(0, height - (window.innerHeight ?? 0));
    },
  };
}

function studioSessionStorage(): StudioStorageLike | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.sessionStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function afterLayoutReady(apply: () => void): void {
  if (typeof window === 'undefined') return;
  const raf =
    typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: (time: number) => void): number =>
          window.setTimeout(() => callback(Date.now()), 0) as unknown as number;
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  const ready = fonts?.ready ? Promise.resolve(fonts.ready).catch(() => undefined) : Promise.resolve();
  void ready.then(() => raf(() => raf(() => apply())));
}

function claimScrollRestoration(): void {
  if (typeof history === 'undefined' || !('scrollRestoration' in history)) return;
  try {
    history.scrollRestoration = 'manual';
  } catch {
    /* A read-only policy is not fatal: the studio still restores its place. */
  }
}

/** Fetch one content-addressed artifact's markup. */
async function fetchArtifact(key: PreparedArtifactKey, url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${key} artifact ${response.status}`);
  return response.text();
}

function mountOnce(manifest: PreparedManifest): void {
  if (typeof document === 'undefined') return;
  const root = document.getElementById(ROOT_ID);
  if (!root) return;
  detachPreviousListeners();
  const dom = collectStudioDom(root);
  const host = document as unknown as StudioSessionHost;
  const remount = host.__jankoStudioSession !== undefined;
  const port = studioScrollPort();
  const removers: Array<() => void> = [];
  const liveView = host.__jankoStudioSession?.view;
  const livePlace = remount ? port.get() : 0;

  const initialView =
    root.dataset.initialView ?? (manifest.generation === 'pending' ? 'candidates' : 'candidates');
  const session = openStudioReviewSession({
    storage: studioSessionStorage(),
    host,
    views: ['candidates', 'reference'],
    fallbackView: initialView,
    hashView: explicitViewFromHash(),
    initialZoom: Number(root.dataset.zoom ?? '1') || 1,
    scroll: port,
    zoomBounds: { min: ZOOM_MIN, max: ZOOM_MAX },
  });
  if (remount && !root.hidden && root.dataset.preparedGeneration &&
      Array.from(root.querySelectorAll<HTMLElement>('.view-panel')).some((panel) => panel.classList.contains('is-active')) &&
      liveView && Number.isFinite(livePlace) && livePlace > 0) session.recordPlace(livePlace, liveView);

  const storage = studioSessionStorage();
  // Independent Reference anchors and zooms; Candidates keeps the original
  // session slot. This record lives on the document across a viewer remount.
  const readerHost = host as StudioSessionHost & { __jankoReferenceReader?: ReturnType<typeof readReferenceReader> };
  const reader = readerHost.__jankoReferenceReader ?? readReferenceReader(storage);
  readerHost.__jankoReferenceReader = reader;
  if (!remount) {
    if (session.state.view === 'candidates') reader.candidatesZoom = session.state.zoom;
    session.state.scroll.reference = reader.places[reader.selected];
    if (session.state.view === 'reference') session.state.zoom = reader.zooms[reader.selected];
  }
  const hasVisiblePaper = (): boolean => !root.hidden && !!root.dataset.preparedGeneration &&
    Array.from(root.querySelectorAll<HTMLElement>('.view-panel')).some((panel) => panel.classList.contains('is-active'));
  const saveReference = (): void => {
    if (session.state.view !== 'reference' || !hasVisiblePaper() || session.restorePending()) return;
    const top = port.get();
    if (Number.isFinite(top) && top >= 0) reader.places[reader.selected] = top;
    reader.zooms[reader.selected] = session.state.zoom;
    writeReferenceReader(storage, reader);
  };
  const picker = document.getElementById('janko-reference-picker') as HTMLSelectElement | null;
  if (picker) picker.value = reader.selected;
  const verifiedArtifacts = new Map<string, string>();
  const applier: PreparedApplier = createPreparedApplier({
    root,
    status: dom.status,
    fetchText: (key, url) => verifiedArtifacts.has(url) ? Promise.resolve(verifiedArtifacts.get(url)!) : fetchArtifact(key, url),
    beforeSwap: () => {
      // Artifact replacement can collapse the document before the 150 ms
      // scroll debounce runs. Save the *visible* pane's live place while its
      // original layout is still present; never sample an empty first load,
      // hidden Source surface or a pending programmatic restore.
      clearScrollTimer();
      if (hasVisiblePaper() && !session.restorePending()) {
        session.capture();
        saveReference();
      }
      ++viewEpoch;
      session.cancelRestore();
    },
    afterSwap: () => decorateReferenceReader(root, reader.selected),
  });
  activeApplier = applier;
  if (typeof import.meta.env !== 'undefined' && import.meta.env.PROD) {
    const url = new URL(`${import.meta.env.BASE_URL}active-release.json`, window.location.href).href;
    const stop = watchDeployedRelease(url, async release => {
      const candidatesUrl = new URL(release.manifest.artifacts.candidates.url, url).href;
      const referenceUrl = new URL(release.manifest.artifacts.reference.url, url).href;
      verifiedArtifacts.set(candidatesUrl, release.candidates);
      verifiedArtifacts.set(referenceUrl, release.reference);
      const outcome = await applier.apply({
        generation: release.manifest.generation,
        engineIdentity: release.manifest.engineIdentity,
        canonicalRevisions: release.manifest.canonicalRevisions,
        artifactHashes: { candidates: release.manifest.artifacts.candidates.sha256, reference: release.manifest.artifacts.reference.sha256 },
        artifacts: { candidates: candidatesUrl, reference: referenceUrl }, status: release.manifest.status, stale: false,
      }, () => session.state.view);
      if (outcome !== 'applied') throw new Error(`deployed release was not applied: ${outcome}`);
      if (!root.hidden) activeRestore?.();
      afterLayoutReady(() => { observeCandidateFrame(root, document, window); observeReferenceFrame(root, document, window); });
    }, error => {
      root.dataset.preparedState = 'stale';
      if (dom.status) { dom.status.textContent = `Stale deployed release · ${error.message}`; dom.status.dataset.healthy = 'false'; dom.status.dataset.problem = 'true'; }
    }, manifest.engineIdentity ?? 'unknown');
    removers.push(stop);
  }
  const currentView = (): string => session.state.view;
  const observe = (): void => { observeCandidateFrame(root, document, window); observeReferenceFrame(root, document, window); };

  // Every handler this mount installs is tracked for detach — including the
  // long-lived shell elements (tabs, zoom buttons): a re-mount must never
  // leave a stale or duplicated handler stepping on the live one.
  const on = (target: EventTarget, type: string, handler: (event: Event) => void): void => {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  };

  let viewEpoch = 0;
  const restore = (): void => {
    session.cancelRestore();
    if (root.hidden || !root.dataset.preparedGeneration) return;
    const epoch = ++viewEpoch;
    const view = session.state.view;
    const score = reader.selected;
    const generation = root.dataset.preparedGeneration;
    session.restorePlace((apply) => afterLayoutReady(() => {
      if (epoch === viewEpoch && !root.hidden && session.state.view === view &&
          reader.selected === score && root.dataset.preparedGeneration === generation) apply();
    }));
  };
  const switchView = (next: string, setHash?: (view: string) => void): void => {
    if (next === session.state.view) { setHash?.(next); showView(root, next); return; }
    clearScrollTimer();
    saveReference();
    if (next !== 'reference' && next !== 'candidates') return;
    if (next === 'reference') session.state.scroll.reference = reader.places[reader.selected];
    const incomingZoom = next === 'reference' ? reader.zooms[reader.selected] : candidatesZoom;
    selectStudioView({ session, root, view: next, afterLayout: afterLayoutReady, storage, setHash, deferRestore: true });
    session.setZoom(incomingZoom);
    zoom = incomingZoom;
    applyZoom(dom, zoom);
    writeStudioState(storage, session.state);
    restore();
    const epoch = viewEpoch;
    if (!root.hidden && session.place() === 0) afterLayoutReady(() => { if (epoch === viewEpoch && session.state.view === next && !root.hidden) port.set(0); });
  };
  let candidatesZoom = session.state.view === 'candidates' ? session.state.zoom : reader.candidatesZoom;
  for (const tab of dom.tabs) {
    on(tab, 'click', () => {
      switchView(tab.dataset.viewTarget ?? 'candidates', (view) => { window.location.hash = view; });
      observe();
    });
  }
  if (picker) on(picker, 'change', () => {
    const next = picker.value;
    if (next !== 'primary' && next !== 'brahms-op118-no1') return;
    clearScrollTimer();
    saveReference();
    session.cancelRestore();
    ++viewEpoch;
    reader.selected = next as ReferenceScore;
    writeReferenceReader(storage, reader);
    decorateReferenceReader(root, reader.selected);
    session.state.scroll.reference = reader.places[reader.selected];
    zoom = reader.zooms[reader.selected];
    session.setZoom(zoom);
    applyZoom(dom, zoom);
    writeStudioState(storage, session.state);
    restore();
    const epoch = viewEpoch;
    if (reader.places[reader.selected] === 0) afterLayoutReady(() => { if (epoch === viewEpoch && reader.selected === next && session.state.view === 'reference' && !root.hidden) port.set(0); });
    observe();
  });
  showView(root, session.state.view);

  let zoom = session.state.zoom;
  applyZoom(dom, zoom);
  const setZoom = (next: number): void => {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    if (hasVisiblePaper() && !session.restorePending()) { session.capture(); saveReference(); }
    session.cancelRestore();
    ++viewEpoch;
    applyZoom(dom, zoom);
    session.setZoom(zoom);
    if (session.state.view === 'reference') { reader.zooms[reader.selected] = zoom; writeReferenceReader(storage, reader); }
    else { candidatesZoom = zoom; reader.candidatesZoom = zoom; writeReferenceReader(storage, reader); }
    writeStudioState(storage, session.state);
  };
  const step = (delta: number): void => setZoom(zoom + delta);
  const zoomIn = document.getElementById('janko-zoom-in');
  const zoomOut = document.getElementById('janko-zoom-out');
  const zoomReset = document.getElementById('janko-zoom-reset');
  if (zoomIn) on(zoomIn, 'click', () => step(ZOOM_STEP));
  if (zoomOut) on(zoomOut, 'click', () => step(-ZOOM_STEP));
  if (zoomReset) on(zoomReset, 'click', () => setZoom(1));

  const wheel = (event: WheelEvent): void => {
    session.cancelRestore();
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    step(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  };
  root.addEventListener('wheel', wheel, { passive: false });

  const keydown = (event: KeyboardEvent): void => {
    session.cancelRestore();
    if (event.key === '+' || event.key === '=') step(ZOOM_STEP);
    else if (event.key === '-' || event.key === '_') step(-ZOOM_STEP);
    else if (event.key === '0') setZoom(1);
  };
  document.addEventListener('keydown', keydown);

  let scrollTimer: number | undefined;
  const clearScrollTimer = (): void => {
    if (typeof window !== 'undefined' && scrollTimer !== undefined) window.clearTimeout(scrollTimer);
    scrollTimer = undefined;
  };
  const scroll = (): void => {
    // A score swap can itself move the viewport before the two-frame restore.
    // Pointer, touch, wheel and keyboard gestures cancel it; layout scrolls
    // must not overwrite the incoming score's saved anchor.
    if (session.restorePending() || !hasVisiblePaper()) return;
    if (typeof window === 'undefined') return;
    clearScrollTimer();
    scrollTimer = window.setTimeout(() => {
      scrollTimer = undefined;
      if (hasVisiblePaper() && !session.restorePending()) { session.capture(); saveReference(); }
    }, STUDIO_SCROLL_CAPTURE_DELAY_MS);
  };
  const pagehide = (): void => {
    clearScrollTimer();
    if (hasVisiblePaper() && !session.restorePending()) { session.capture(); saveReference(); }
  };
  const visibilitychange = (): void => {
    if (document.visibilityState === 'hidden') pagehide();
    observe();
  };
  const gesture = (): void => {
    ++viewEpoch;
    session.cancelRestore();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pagehide', pagehide);
    on(window, 'hashchange', () => {
      switchView(viewFromHash(session.state.view));
      observe();
    });
    window.addEventListener('pointerdown', gesture, { passive: true });
    window.addEventListener('touchstart', gesture, { passive: true });
  }
  document.addEventListener('visibilitychange', visibilitychange);
  on(window, 'janko-before-surface-hide', () => {
    // On a Source-mode reload no prepared paper has arrived yet. Sampling the
    // empty page would destroy the saved anchor before it could be restored.
    if (hasVisiblePaper() && !session.restorePending()) {
      session.capture(); saveReference();
    }
  });
  on(window, 'janko-surface-show', () => {
    decorateReferenceReader(root, reader.selected);
    if (root.dataset.preparedGeneration) restore();
  });

  claimScrollRestoration();
  if (root.dataset.preparedGeneration && !root.hidden) restore();

  activeSession = session;
  activeRestore = restore;
  GLOBAL_SCOPE.__jankoStudioListeners = {
    detach: () => {
      clearScrollTimer();
      if (typeof window !== 'undefined') {
        window.removeEventListener('scroll', scroll);
        window.removeEventListener('pagehide', pagehide);
        window.removeEventListener('pointerdown', gesture);
        window.removeEventListener('touchstart', gesture);
      }
      document.removeEventListener('visibilitychange', visibilitychange);
      document.removeEventListener('keydown', keydown);
      root.removeEventListener('wheel', wheel);
      for (const remove of removers) remove();
      session.cancelRestore();
    },
  };

  // Apply the manifest generation; the applier re-shows the session view on
  // the fresh panels before resolving, so the place restore below always runs
  // against laid-out content (never a blank, collapsed studio).
  void applier.apply(manifest, currentView).then((outcome) => {
    if (activeApplier !== applier || outcome === 'dropped') return;
    applyZoom(dom, session.state.zoom);
    if (!root.hidden && root.dataset.preparedGeneration) restore();
    if (outcome === 'applied') afterLayoutReady(observe);
    else observe();
  });
}

let mounted = false;
/** The live session — HMR re-applies must restore its scroll place (the innerHTML swap collapses the document height momentarily). */
let activeSession: ReturnType<typeof openStudioReviewSession> | null = null;
let activeRestore: (() => void) | null = null;
/** The live applier — the HMR accept path reuses it (shared generation bookkeeping). */
let activeApplier: PreparedApplier | null = null;

function bootstrap(): void {
  if (mounted) return;
  mounted = true;
  mountOnce(prepared);
  // The actual HMR contract: this module accepts the manifest module by id,
  // so the dev server's js-update for that module delivers the refreshed
  // manifest here — the regenerated views appear in place, with the selected
  // tab, zoom and scroll preserved by the session.
  if (import.meta.hot) {
    import.meta.hot.accept('virtual:janko-prepared-manifest', (mod) => {
      if (!mod) return;
      const root = document.getElementById(ROOT_ID);
      if (!root || !activeApplier) return;
      root.dataset.preparedHmrEpochMs = String(Date.now());
      void activeApplier
        .apply((mod as unknown as { default: PreparedManifest }).default, () => activeSession?.state.view ?? 'candidates')
        .then((outcome) => {
          if (outcome === 'dropped') return;
          if (!root.hidden) activeRestore?.();
          if (outcome === 'applied') afterLayoutReady(() => { observeCandidateFrame(root, document, window); observeReferenceFrame(root, document, window); });
          else { observeCandidateFrame(root, document, window); observeReferenceFrame(root, document, window); }
        });
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}
