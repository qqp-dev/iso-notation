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
  type StudioScrollPort,
  type StudioSessionHost,
  type StudioStorageLike,
} from '../studio-session';

import prepared from 'virtual:janko-prepared-manifest';
import { observeCandidateFrame } from './observation';
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
  if (remount) {
    if (liveView && Number.isFinite(livePlace) && livePlace > 0) session.recordPlace(livePlace, liveView);
    else session.captureScroll();
  }

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
  const saveReference = (): void => {
    if (session.state.view !== 'reference' || root.hidden || session.restorePending()) return;
    const top = port.get();
    if (Number.isFinite(top) && top >= 0) reader.places[reader.selected] = top;
    reader.zooms[reader.selected] = session.state.zoom;
    writeReferenceReader(storage, reader);
  };
  const picker = document.getElementById('janko-reference-picker') as HTMLSelectElement | null;
  if (picker) picker.value = reader.selected;
  const applier: PreparedApplier = createPreparedApplier({
    root,
    status: dom.status,
    fetchText: fetchArtifact,
    beforeSwap: () => {
      // Artifact replacement can collapse the document before the 150 ms
      // scroll debounce runs. Save the *visible* pane's live place while its
      // original layout is still present; never sample an empty first load,
      // hidden Source surface or a pending programmatic restore.
      if (root.hidden || session.restorePending() ||
          !Array.from(root.querySelectorAll<HTMLElement>('.view-panel')).some((panel) => panel.classList.contains('is-active'))) return;
      clearScrollTimer();
      session.capture();
      saveReference();
    },
    afterSwap: () => decorateReferenceReader(root, reader.selected),
  });
  activeApplier = applier;
  const currentView = (): string => session.state.view;
  const observe = (): void => observeCandidateFrame(root, document, window);

  // Every handler this mount installs is tracked for detach — including the
  // long-lived shell elements (tabs, zoom buttons): a re-mount must never
  // leave a stale or duplicated handler stepping on the live one.
  const on = (target: EventTarget, type: string, handler: (event: Event) => void): void => {
    target.addEventListener(type, handler);
    removers.push(() => target.removeEventListener(type, handler));
  };

  let viewEpoch = 0;
  const switchView = (next: string, setHash?: (view: string) => void): void => {
    if (next === session.state.view) { setHash?.(next); showView(root, next); return; }
    clearScrollTimer();
    saveReference();
    // Capture the outgoing pane while it still has its original zoom and
    // height. Shrinking it first can clamp window.scrollY irreversibly.
    if (!root.hidden && !session.restorePending()) session.capture();
    if (next === 'reference') session.state.scroll.reference = reader.places[reader.selected];
    const incomingZoom = next === 'reference' ? reader.zooms[reader.selected] : candidatesZoom;
    const epoch = ++viewEpoch;
    if (root.hidden) {
      session.state.view = next;
      showView(root, next);
      setHash?.(next);
    } else {
      selectStudioView({ session, root, view: next, afterLayout: afterLayoutReady, setHash });
    }
    session.setZoom(incomingZoom);
    zoom = incomingZoom;
    applyZoom(dom, zoom);
    session.persist();
    if (!root.hidden && session.place() === 0) afterLayoutReady(() => { if (epoch === viewEpoch && session.state.view === next) port.set(0); });
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
    const epoch = ++viewEpoch;
    reader.selected = next as ReferenceScore;
    writeReferenceReader(storage, reader);
    decorateReferenceReader(root, reader.selected);
    session.state.scroll.reference = reader.places[reader.selected];
    zoom = reader.zooms[reader.selected];
    session.setZoom(zoom);
    applyZoom(dom, zoom);
    if (reader.places[reader.selected] === 0) afterLayoutReady(() => { if (epoch === viewEpoch && reader.selected === next && session.state.view === 'reference') port.set(0); });
    else session.restorePlace(afterLayoutReady);
  });
  showView(root, session.state.view);

  let zoom = session.state.zoom;
  applyZoom(dom, zoom);
  const setZoom = (next: number): void => {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    applyZoom(dom, zoom);
    session.setZoom(zoom);
    if (session.state.view === 'reference') { reader.zooms[reader.selected] = zoom; writeReferenceReader(storage, reader); }
    else { candidatesZoom = zoom; reader.candidatesZoom = zoom; writeReferenceReader(storage, reader); }
    session.capture();
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
    if (session.restorePending() || root.hidden) return;
    if (typeof window === 'undefined') return;
    clearScrollTimer();
    scrollTimer = window.setTimeout(() => {
      scrollTimer = undefined;
      if (!root.hidden) { session.capture(); saveReference(); }
    }, STUDIO_SCROLL_CAPTURE_DELAY_MS);
  };
  const pagehide = (): void => {
    clearScrollTimer();
    if (!root.hidden && !session.restorePending()) { session.capture(); saveReference(); }
  };
  const visibilitychange = (): void => {
    if (document.visibilityState === 'hidden') pagehide();
    observe();
  };
  const gesture = (): void => {
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
    if (!root.hidden && root.dataset.preparedGeneration && !session.restorePending()) {
      session.capture(); saveReference();
    }
  });
  on(window, 'janko-surface-show', () => {
    decorateReferenceReader(root, reader.selected);
    if (root.dataset.preparedGeneration) session.restorePlace(afterLayoutReady);
  });

  claimScrollRestoration();
  if (root.dataset.preparedGeneration && !root.hidden) session.restorePlace(afterLayoutReady);

  activeSession = session;
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
    if (!root.hidden && root.dataset.preparedGeneration) session.restorePlace(afterLayoutReady);
    if (outcome === 'applied') afterLayoutReady(observe);
    else observe();
  });
}

let mounted = false;
/** The live session — HMR re-applies must restore its scroll place (the innerHTML swap collapses the document height momentarily). */
let activeSession: ReturnType<typeof openStudioReviewSession> | null = null;
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
          if (!root.hidden) activeSession?.restorePlace(afterLayoutReady);
          if (outcome === 'applied') afterLayoutReady(() => observeCandidateFrame(root, document, window));
          else observeCandidateFrame(root, document, window);
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
