/**
 * Studio review-session persistence (Round 45 §F) — phone-safe view / zoom /
 * place restoration for the Live Studio.
 * ======================================================================
 *
 * The live studio is reviewed on a phone over Tailscale. Vite's dev client
 * keeps its HMR connection with a websocket heartbeat: when the phone
 * backgrounds the tab the socket is closed, the client reconnects by
 * **reloading the document**, and the review context — view, zoom and scroll
 * place — is lost. There is no supported small reconnect API, so the stock
 * reload is accepted; this module makes the *document* survive it:
 *
 *  - the session ({@link StudioSessionState}) lives in **sessionStorage**,
 *    versioned and scoped to the studio, per tab;
 *  - an explicit URL hash (`#candidates` / `#reference`) always wins over the
 *    stored view — a shared link is never silently overridden;
 *  - the session is written on zoom, after a debounced scroll, before a view
 *    switch, on `pagehide` and when the document becomes hidden — never on
 *    `unload`;
 *  - the scroll place is restored **after** layout/font readiness and is
 *    clamped to the content that actually exists (a shorter page is safe), and
 *    any user interaction cancels a still-pending restore — a delayed jump is
 *    never allowed to fight the reader;
 *  - an **HMR re-mount** of the same document never restores stale storage: the
 *    live session object is kept on `document` (document-lifetime bookkeeping,
 *    not a module-level sentinel that HMR resets), so the remount continues
 *    from exactly where the reader is;
 *  - storage that is missing, disabled or corrupt is simply ignored: the
 *    studio behaves exactly as before (zoom 1 / default view / top of page).
 *
 * This preserves the *app's* view, zoom and place. It does not preserve native
 * browser pinch-zoom, and it does not remove the brief stock reload.
 */

/** Storage schema version — bump to invalidate older stored sessions. */
export const STUDIO_STATE_VERSION = 1;

/** sessionStorage key of the studio review session (versioned, studio-scoped). */
export const STUDIO_STATE_STORAGE_KEY = `janko-studio-session-v${STUDIO_STATE_VERSION}`;

/** Debounce applied to scroll capture (ms). */
export const STUDIO_SCROLL_CAPTURE_DELAY_MS = 150;

/** The persisted per-tab review session. */
export interface StudioSessionState {
  version: number;
  /** Studio zoom factor (1 = card width). */
  zoom: number;
  /** Active view id. */
  view: string;
  /** Scroll place (px) per view id. */
  scroll: Record<string, number>;
}

/** The slice of the Web Storage API this module needs (sessionStorage fits). */
export interface StudioStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The viewport port: read/write/clamp the document scroll place. */
export interface StudioScrollPort {
  /** Current vertical scroll offset (px). */
  get(): number;
  /** Set the vertical scroll offset (px). */
  set(top: number): void;
  /** Largest valid offset for the content currently laid out (px, >= 0). */
  max(): number;
}

/** Host of the persisted document-lifetime session (a `Document` in the studio). */
export interface StudioSessionHost {
  __jankoStudioSession?: StudioSessionState;
}

/** Pure, total: a finite, in-range zoom (never NaN/Infinity/out of bounds). */
export function clampStudioZoom(zoom: number, min: number, max: number): number {
  if (!Number.isFinite(zoom)) return Math.min(max, Math.max(min, 1));
  return Math.min(max, Math.max(min, zoom));
}

/** Pure, total: a non-negative scroll offset no further than `max` (px). */
export function clampStudioScroll(top: number, max: number): number {
  const limit = Number.isFinite(max) && max > 0 ? max : 0;
  if (!Number.isFinite(top) || top <= 0) return 0;
  return Math.min(top, limit);
}

/**
 * Parse a stored session. Anything unusable — malformed JSON, the wrong
 * version, a non-finite zoom, an unknown view, a non-finite scroll place — is
 * dropped field by field, so a partially corrupt record can never break the
 * studio.
 */
export function parseStudioState(
  raw: string | null | undefined,
  views: readonly string[]
): StudioSessionState | undefined {
  if (!raw) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const record = parsed as Record<string, unknown>;
  if (record.version !== STUDIO_STATE_VERSION) return undefined;
  const zoom = typeof record.zoom === 'number' ? record.zoom : undefined;
  const view = typeof record.view === 'string' && views.includes(record.view) ? record.view : undefined;
  const scroll: Record<string, number> = {};
  if (typeof record.scroll === 'object' && record.scroll !== null) {
    for (const [key, value] of Object.entries(record.scroll as Record<string, unknown>)) {
      if (views.includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        scroll[key] = value;
      }
    }
  }
  return {
    version: STUDIO_STATE_VERSION,
    zoom: zoom !== undefined && Number.isFinite(zoom) ? zoom : 1,
    view: view ?? views[0] ?? 'candidates',
    scroll,
  };
}

/** Read the stored session; unavailable or corrupt storage is `undefined`. */
export function readStudioState(
  storage: StudioStorageLike | undefined | null,
  views: readonly string[]
): StudioSessionState | undefined {
  if (!storage) return undefined;
  let raw: string | null = null;
  try {
    raw = storage.getItem(STUDIO_STATE_STORAGE_KEY);
  } catch {
    return undefined;
  }
  return parseStudioState(raw, views);
}

/** Write the session; a throwing (private-mode/quota) storage is never fatal. */
export function writeStudioState(
  storage: StudioStorageLike | undefined | null,
  state: StudioSessionState
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STUDIO_STATE_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

/**
 * The live session: document-lifetime state plus the capture/restore policy.
 *
 * The studio owns the listeners; this object owns *when* state is captured and
 * *how* a restored place is applied.
 */
export interface StudioReviewSession {
  /** The live (document-lifetime) session record. */
  readonly state: StudioSessionState;
  /** The active view's stored scroll place (px, pre-clamp). */
  place(view?: string): number;
  /** Record one scroll offset (default: the live offset) for a view (no write). */
  recordPlace(top: number, view?: string): void;
  /** Record the live scroll offset for the active view (no write). */
  captureScroll(): void;
  /** Capture and persist the session (never throws). */
  capture(): boolean;
  /** Switch the active view, capturing the outgoing view's place first. */
  setView(view: string): void;
  /** Set the active zoom (already clamped by the caller's zoom policy). */
  setZoom(zoom: number): void;
  /**
   * Restore the stored place for the active view once the host says the layout
   * is ready. The place is clamped against the content that exists *at apply
   * time*; a cancelled restore (user interaction) is a no-op.
   */
  restorePlace(afterLayout: (apply: () => void) => void): void;
  /** Cancel a still-pending restore (user interaction / re-mount). */
  cancelRestore(): void;
  /** True while a restore is scheduled but not yet applied. */
  restorePending(): boolean;
}

/** Everything the session needs from its host document. */
export interface StudioReviewSessionInit {
  /** Storage (sessionStorage); absent/blocked storage simply disables persistence. */
  storage?: StudioStorageLike | null;
  /** Document-lifetime host record (keeps HMR re-mounts on the live state). */
  host: StudioSessionHost;
  /** Every view the studio can show, in stable order. */
  views: readonly string[];
  /** View used when neither the hash nor the stored session names a valid one. */
  fallbackView: string;
  /** Valid view named by the URL hash — explicit hash wins over storage. */
  hashView?: string;
  /** Zoom from the markup (`data-zoom`) when no session exists yet. */
  initialZoom?: number;
  /** Viewport port; when absent (no DOM/scroll) restore is a no-op. */
  scroll?: StudioScrollPort;
  /** Zoom bounds enforced on every stored/explicit zoom value. */
  zoomBounds: { min: number; max: number };
}

/** Open (or reopen) the document's live review session. */
export function openStudioReviewSession(init: StudioReviewSessionInit): StudioReviewSession {
  const views = [...init.views];
  const existing = init.host.__jankoStudioSession;
  // Document-lifetime bookkeeping: an HMR re-mount of the same document
  // continues from the live session (identity included) instead of re-reading
  // storage, so no stale view/zoom/place can ever be restored mid-review.
  // Only a fresh document applies the hash precedence and the stored session.
  const state: StudioSessionState = existing ?? {
    version: STUDIO_STATE_VERSION,
    zoom: 1,
    view: views.includes(init.fallbackView) ? init.fallbackView : views[0] ?? 'candidates',
    scroll: {},
  };
  if (!existing) {
    const stored = readStudioState(init.storage, views);
    state.zoom = clampStudioZoom(
      stored?.zoom ?? init.initialZoom ?? 1,
      init.zoomBounds.min,
      init.zoomBounds.max
    );
    state.view =
      (init.hashView && views.includes(init.hashView) ? init.hashView : undefined) ??
      (stored && views.includes(stored.view) ? stored.view : undefined) ??
      state.view;
    state.scroll = { ...(stored?.scroll ?? {}) };
    init.host.__jankoStudioSession = state;
  } else {
    state.zoom = clampStudioZoom(state.zoom, init.zoomBounds.min, init.zoomBounds.max);
  }

  let pending: { target: number; cancelled: boolean } | undefined;

  const recordPlace = (top: number, view = state.view): void => {
    if (views.includes(view) && Number.isFinite(top) && top >= 0) state.scroll[view] = top;
  };
  const captureScroll = (): void => {
    const port = init.scroll;
    if (!port) return;
    recordPlace(port.get());
  };

  return {
    state,
    place(view = state.view) {
      const stored = state.scroll[view];
      return Number.isFinite(stored) && stored && stored > 0 ? stored : 0;
    },
    recordPlace,
    captureScroll,
    capture() {
      captureScroll();
      return writeStudioState(init.storage, state);
    },
    setView(view) {
      if (!views.includes(view)) return;
      captureScroll();
      state.view = view;
    },
    setZoom(zoom) {
      state.zoom = clampStudioZoom(zoom, init.zoomBounds.min, init.zoomBounds.max);
    },
    restorePlace(afterLayout) {
      const port = init.scroll;
      const target = this.place();
      if (!port || target <= 0) return;
      const record = { target, cancelled: false };
      pending = record;
      afterLayout(() => {
        if (record.cancelled || pending !== record) return;
        pending = undefined;
        // Clamp at apply time: a shorter document (or a different font metric)
        // can never scroll past its own end.
        const top = clampStudioScroll(record.target, port.max());
        port.set(top);
        if (top > 0) state.scroll[state.view] = top;
      });
    },
    cancelRestore() {
      if (pending) {
        pending.cancelled = true;
        pending = undefined;
      }
    },
    restorePending() {
      return pending !== undefined;
    },
  };
}
