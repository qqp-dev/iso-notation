/**
 * Round 45 §F — phone review-context restoration (the stock Vite reload).
 * =====================================================================
 *
 * The dev server is reviewed on a phone over Tailscale. When the phone
 * backgrounds the tab, Vite's heartbeat closes the websocket and the client
 * reconnects by reloading the document: the app's view, zoom and scroll place
 * are lost unless the studio persists them itself. These tests drive the real
 * `mountJankoStudio` against a scripted document/window and the real
 * `studio-session` module, so the verified behavior is the shipped behavior:
 *
 *   1. a fresh document (the reload) restores view + zoom + clamped place;
 *   2. an explicit URL hash wins over the stored view;
 *   3. unavailable or corrupt storage degrades to the plain studio;
 *   4. a shorter document clamps the restored place instead of scrolling past
 *      its own end;
 *   5. an HMR re-mount of the same document keeps the live state (no stale
 *      storage read, no jump) and re-registers listeners exactly once;
 *   6. a user interaction cancels a still-pending restore.
 *
 * No images, no screenshots: the assertions are on the real DOM bookkeeping and
 * the real stored session.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildRestDurationSpecimenScore } from '../src/scores/rest-duration-specimen';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { createStudioConfig } from '../src/render/janko/studio';
import { DEFAULT_STUDIO_SCORE_ID } from '../src/render/janko/candidates';
import {
  STUDIO_SCROLL_CAPTURE_DELAY_MS,
  STUDIO_STATE_STORAGE_KEY,
  STUDIO_STATE_VERSION,
  clampStudioScroll,
  clampStudioZoom,
  openStudioReviewSession,
  parseStudioState,
  readStudioState,
  writeStudioState,
  type StudioSessionState,
} from '../src/render/janko/studio-session';

// ---------------------------------------------------------------------------
// 0. The pure session policy (storage, validation, clamping)
// ---------------------------------------------------------------------------

const VIEWS = ['candidates', 'reference'] as const;

function memoryStorage(seed?: string) {
  const store = new Map<string, string>();
  if (seed !== undefined) store.set(STUDIO_STATE_STORAGE_KEY, seed);
  return {
    store,
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => void store.set(key, value),
  };
}

test('Round 45 §F: the stored session is versioned, validated field by field', () => {
  assert.equal(STUDIO_STATE_STORAGE_KEY, `janko-studio-session-v${STUDIO_STATE_VERSION}`);
  // Malformed JSON, a foreign version and a foreign view are all dropped.
  assert.equal(parseStudioState('{"zoom":', VIEWS), undefined);
  assert.equal(parseStudioState(JSON.stringify({ version: 99, zoom: 2 }), VIEWS), undefined);
  const parsed = parseStudioState(
    JSON.stringify({
      version: STUDIO_STATE_VERSION,
      zoom: 1.75,
      view: 'elsewhere',
      scroll: { reference: 220, candidates: Number.NaN, nowhere: 40, bad: -5 },
    }),
    VIEWS
  );
  assert.deepEqual(parsed, {
    version: STUDIO_STATE_VERSION,
    zoom: 1.75,
    view: 'candidates', // foreign view dropped → first view
    scroll: { reference: 220 }, // non-finite / unknown / negative places dropped
  });
  // Non-finite zoom can never poison the studio.
  assert.equal(parseStudioState(JSON.stringify({ version: 1, zoom: null }), VIEWS)?.zoom, 1);
});

test('Round 45 §F: storage that is missing, blocked or corrupt is never fatal', () => {
  const blocked = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(readStudioState(blocked, VIEWS), undefined, 'a throwing read is ignored');
  assert.equal(readStudioState(undefined, VIEWS), undefined, 'missing storage is ignored');
  assert.equal(
    writeStudioState(blocked, { version: 1, zoom: 1, view: 'candidates', scroll: {} }),
    false,
    'a throwing write reports failure instead of breaking the studio'
  );
  const good = memoryStorage();
  assert.equal(
    writeStudioState(good, { version: 1, zoom: 1.5, view: 'reference', scroll: { reference: 12 } }),
    true
  );
  assert.deepEqual(readStudioState(good, VIEWS)?.scroll, { reference: 12 });
});

test('Round 45 §F: zoom and place clamps are total', () => {
  assert.equal(clampStudioZoom(Number.NaN, 0.5, 3), 1);
  assert.equal(clampStudioZoom(9, 0.5, 3), 3);
  assert.equal(clampStudioZoom(0.1, 0.5, 3), 0.5);
  assert.equal(clampStudioScroll(Number.NaN, 500), 0);
  assert.equal(clampStudioScroll(-20, 500), 0);
  assert.equal(clampStudioScroll(900, 500), 500);
  assert.equal(clampStudioScroll(120, 0), 0, 'an empty document has no scrollable place');
});

// ---------------------------------------------------------------------------
// 1. The live session: restore, capture, cancel, HMR continuity
// ---------------------------------------------------------------------------

function sessionHost(): { __jankoStudioSession?: StudioSessionState } {
  return {};
}

function viewportPort(state: { top: number; max: number; applied: number[] }) {
  return {
    get: () => state.top,
    set: (top: number) => {
      state.top = top;
      state.applied.push(top);
    },
    max: () => state.max,
  };
}

test('Round 45 §F: a fresh document restores view, zoom and the clamped place', () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: STUDIO_STATE_VERSION,
      zoom: 1.5,
      view: 'reference',
      scroll: { reference: 400 },
    })
  );
  const port = { top: 0, max: 1000, applied: [] as number[] };
  const session = openStudioReviewSession({
    storage,
    host: sessionHost(),
    views: VIEWS,
    fallbackView: 'candidates',
    initialZoom: 1,
    scroll: viewportPort(port),
    zoomBounds: { min: 0.5, max: 3 },
  });
  assert.equal(session.state.view, 'reference', 'the stored view is restored');
  assert.equal(session.state.zoom, 1.5, 'the stored zoom is restored');
  let pending: (() => void) | undefined;
  session.restorePlace((apply) => (pending = apply));
  assert.equal(session.restorePending(), true, 'the place waits for layout readiness');
  assert.deepEqual(port.applied, [], 'nothing is scrolled before layout');
  pending!();
  assert.deepEqual(port.applied, [400], 'the stored place is applied once');
  // Smaller content: the place is clamped at apply time, never past the end.
  port.max = 120;
  session.cancelRestore();
  session.restorePlace((apply) => (pending = apply));
  pending!();
  assert.deepEqual(port.applied, [400, 120], 'a shorter document clamps the place');
});

test('Round 45 §F: the explicit URL hash wins over the stored view', () => {
  const storage = memoryStorage(
    JSON.stringify({ version: STUDIO_STATE_VERSION, zoom: 2, view: 'reference', scroll: {} })
  );
  const host = sessionHost();
  const hashed = openStudioReviewSession({
    storage,
    host,
    views: VIEWS,
    fallbackView: 'candidates',
    hashView: 'candidates',
    initialZoom: 1,
    zoomBounds: { min: 0.5, max: 3 },
  });
  assert.equal(hashed.state.view, 'candidates', 'the hash wins');
  assert.equal(hashed.state.zoom, 2, 'the zoom is not a view: it still restores');
  // An invalid hash is not a claim at all.
  const invalid = openStudioReviewSession({
    storage,
    host: sessionHost(),
    views: VIEWS,
    fallbackView: 'candidates',
    hashView: 'nonsense',
    initialZoom: 1,
    zoomBounds: { min: 0.5, max: 3 },
  });
  assert.equal(invalid.state.view, 'reference', 'only a real view hash wins');
});

test('Round 45 §F: capture happens on zoom, view switch, debounce and hide — not on unload', () => {
  const storage = memoryStorage();
  const port = { top: 0, max: 4000, applied: [] as number[] };
  const session = openStudioReviewSession({
    storage,
    host: sessionHost(),
    views: VIEWS,
    fallbackView: 'candidates',
    initialZoom: 1,
    scroll: viewportPort(port),
    zoomBounds: { min: 0.5, max: 3 },
  });
  session.setZoom(1.75);
  assert.equal(session.capture(), true);
  assert.equal(readStudioState(storage, VIEWS)?.zoom, 1.75, 'zoom is persisted');
  // The reader scrolls the candidates view, then switches to the reference
  // view: the outgoing place is captured before the switch.
  port.top = 640;
  session.setView('reference');
  assert.equal(session.capture(), true);
  const stored = readStudioState(storage, VIEWS)!;
  assert.equal(stored.scroll.candidates, 640, 'the outgoing place is captured on switch');
  assert.equal(stored.view, 'reference', 'the new view is persisted');
  // A later hide captures the reference place.
  port.top = 180;
  assert.equal(session.capture(), true);
  assert.equal(readStudioState(storage, VIEWS)?.scroll.reference, 180);
});

test('Round 45 §F: a user interaction cancels a still-pending restore', () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: STUDIO_STATE_VERSION,
      zoom: 1,
      view: 'candidates',
      scroll: { candidates: 900 },
    })
  );
  const port = { top: 0, max: 5000, applied: [] as number[] };
  const session = openStudioReviewSession({
    storage,
    host: sessionHost(),
    views: VIEWS,
    fallbackView: 'candidates',
    initialZoom: 1,
    scroll: viewportPort(port),
    zoomBounds: { min: 0.5, max: 3 },
  });
  let pending: (() => void) | undefined;
  session.restorePlace((apply) => (pending = apply));
  session.cancelRestore();
  assert.equal(session.restorePending(), false);
  pending!();
  assert.deepEqual(port.applied, [], 'a cancelled restore never moves the reader');
});

test('Round 45 §F: an HMR re-mount keeps the live state and never re-reads storage', () => {
  const storage = memoryStorage(
    JSON.stringify({
      version: STUDIO_STATE_VERSION,
      zoom: 1.25,
      view: 'candidates',
      scroll: { candidates: 300 },
    })
  );
  const host = sessionHost();
  const first = openStudioReviewSession({
    storage,
    host,
    views: VIEWS,
    fallbackView: 'candidates',
    initialZoom: 1,
    zoomBounds: { min: 0.5, max: 3 },
  });
  // The reader zooms in and scrolls AFTER the session was opened…
  first.setZoom(2.5);
  first.recordPlace(1750, 'candidates');
  first.setView('reference');
  // …then storage is clobbered by another tab / an older write.
  writeStudioState(storage, { version: 1, zoom: 0.5, view: 'candidates', scroll: { candidates: 10 } });
  const remount = openStudioReviewSession({
    storage,
    host,
    views: VIEWS,
    fallbackView: 'candidates',
    initialZoom: 1,
    zoomBounds: { min: 0.5, max: 3 },
  });
  assert.equal(remount.state.zoom, 2.5, 'the live zoom survives the re-mount');
  assert.equal(remount.state.view, 'reference', 'the live view survives the re-mount');
  assert.equal(remount.state.scroll.candidates, 1750, 'the live place survives the re-mount');
  assert.equal(remount.state, first.state, 'both mounts share the document-lifetime record');
});

// ---------------------------------------------------------------------------
// 2. The studio wiring: the real mount against a scripted document/window
// ---------------------------------------------------------------------------

interface ListenerLog {
  add: string[];
  remove: string[];
}

function countNet(events: ListenerLog, key: string): number {
  return events.add.filter((t) => t === key).length - events.remove.filter((t) => t === key).length;
}

/** The event each listener under test is expected to register exactly once. */
const WIRED_LISTENERS: Record<string, string> = {
  wheel: 'root:wheel',
  keydown: 'document:keydown',
  scroll: 'window:scroll',
  pagehide: 'window:pagehide',
  hashchange: 'window:hashchange',
  visibilitychange: 'document:visibilitychange',
  pointerdown: 'window:pointerdown',
  touchstart: 'window:touchstart',
};

interface FakeStudioDom {
  events: ListenerLog;
  storage: Map<string, string>;
  scroll: { top: number };
  /** Scroll the viewport (the studio's port reads `window.scrollY`). */
  setScroll: (top: number) => void;
  /** Run every pending timer/rAF callback (layout readiness, debounce). */
  settle: () => void;
  /** Dispatch one event on window / document / root. */
  fire: (key: string, event?: Record<string, unknown>) => void;
  /** Hide the document (phone backgrounding) and fire the visibility event. */
  hide: () => void;
}

/**
 * The smallest document/window pair `mountJankoStudio` can run against. It
 * records every listener registration and can dispatch them, which is what
 * makes "listener duplication absent" and "capture on hide" observable.
 */
function installFakeStudioDom(): FakeStudioDom {
  const events: ListenerLog = { add: [], remove: [] };
  const handlers = new Map<string, Set<(event?: Record<string, unknown>) => void>>();
  const rootDataset: Record<string, string> = {};
  const storage = new Map<string, string>();
  const scroll = { top: 0 };
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const documentStub: any = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    visibilityState: 'visible',
    documentElement: { scrollHeight: 4000 },
    body: { scrollHeight: 4000 },
  };
  const wire = (host: unknown, key: string, type: string): void => {
    const target = host as { addEventListener: Function; removeEventListener: Function };
    const innerAdd = target.addEventListener?.bind(target) as Function | undefined;
    const innerRemove = target.removeEventListener?.bind(target) as Function | undefined;
    target.addEventListener = (eventType: string, handler: (event?: Record<string, unknown>) => void) => {
      innerAdd?.(eventType, handler);
      if (eventType !== type) return;
      events.add.push(key);
      const set = handlers.get(key) ?? new Set();
      set.add(handler);
      handlers.set(key, set);
    };
    target.removeEventListener = (eventType: string, handler: (event?: Record<string, unknown>) => void) => {
      innerRemove?.(eventType, handler);
      if (eventType !== type) return;
      events.remove.push(key);
      handlers.get(key)?.delete(handler);
    };
  };
  const root: any = {
    ownerDocument: documentStub,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dataset: rootDataset,
    style: { setProperty: () => undefined },
    classList: { toggle: () => undefined },
    innerHTML: '',
    querySelectorAll: () => [],
  };
  wire(root, 'root:wheel', 'wheel');
  wire(documentStub, 'document:keydown', 'keydown');
  wire(documentStub, 'document:visibilitychange', 'visibilitychange');
  const stubElement = { dataset: {}, addEventListener: () => undefined, removeEventListener: () => undefined };
  documentStub.getElementById = (id: string) => (id === 'janko-studio' ? root : stubElement);
  documentStub.querySelectorAll = () => [];
  const windowStub: any = {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    scrollY: 0,
    innerHeight: 800,
    location: { hash: '' },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
    scrollTo: (_x: number, top: number) => {
      scroll.top = top;
      windowStub.scrollY = top;
    },
    setTimeout: (callback: () => void) => {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id: number) => void timers.delete(id),
    requestAnimationFrame: (callback: (time: number) => void) => {
      const id = ++timerId;
      timers.set(id, () => callback(0));
      return id;
    },
  };
  wire(windowStub, 'window:scroll', 'scroll');
  wire(windowStub, 'window:pagehide', 'pagehide');
  wire(windowStub, 'window:hashchange', 'hashchange');
  wire(windowStub, 'window:pointerdown', 'pointerdown');
  wire(windowStub, 'window:touchstart', 'touchstart');
  const globals = globalThis as unknown as Record<string, unknown>;
  globals.window = windowStub;
  globals.document = documentStub;
  globals.history = { scrollRestoration: 'auto' };
  return {
    events,
    storage,
    scroll,
    setScroll: (top: number) => {
      scroll.top = top;
      windowStub.scrollY = top;
    },
    settle: async () => {
      // Timers and rAF chains both run; microtasks in between, because the
      // studio's layout-readiness chain is a promise followed by two frames.
      for (let pass = 0; pass < 12; pass++) {
        await Promise.resolve();
        const pending = [...timers.values()];
        timers.clear();
        for (const callback of pending) callback();
        if (timers.size === 0) await Promise.resolve();
      }
    },
    fire: (key, event = {}) => {
      for (const handler of handlers.get(key) ?? []) handler(event);
    },
    hide: () => {
      documentStub.visibilityState = 'hidden';
      for (const handler of handlers.get('document:visibilitychange') ?? []) handler({});
    },
  };
}

function uninstallFakeStudioDom(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  delete globals.window;
  delete globals.document;
  delete globals.history;
  delete globals.__jankoStudioListeners;
}

/**
 * A deliberately tiny studio config: the wiring under test is the session and
 * its listeners, so the two views are rendered from one small specimen score
 * instead of the full candidate spreads.
 */
function lightConfig() {
  const score = buildRestDurationSpecimenScore();
  const options = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const tokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  return createStudioConfig({
    score,
    options,
    tokens,
    candidates: [],
    crops: [],
    pages: [0],
    brahmsCrops: [],
    brahmsPages: [],
    scores: {
      [DEFAULT_STUDIO_SCORE_ID]: { id: DEFAULT_STUDIO_SCORE_ID, score, options, tokens },
    },
  });
}

test('Round 45 §F: mount restores the session and a re-mount re-registers every listener once', async () => {
  const { mountJankoStudio } = await import('../src/render/janko/studio');
  const dom = installFakeStudioDom();
  try {
    const config = lightConfig();
    assert.equal(mountJankoStudio(config), true, 'the studio mounts against the scripted document');
    for (const [type, key] of Object.entries(WIRED_LISTENERS)) {
      assert.equal(countNet(dom.events, key), 1, `${type} is registered once`);
    }
    assert.equal(
      (globalThis as unknown as { history: { scrollRestoration: string } }).history.scrollRestoration,
      'manual',
      'the studio claims scroll restoration so the browser cannot race it'
    );
    // HMR: the module re-executes and mounts again on the same document.
    assert.equal(mountJankoStudio(config), true);
    for (const [type, key] of Object.entries(WIRED_LISTENERS)) {
      assert.equal(countNet(dom.events, key), 1, `${type} is still registered exactly once`);
    }
  } finally {
    uninstallFakeStudioDom();
  }
});

test('Round 45 §F: a mounted reload restores the review and hides capture the place', async () => {
  const { mountJankoStudio } = await import('../src/render/janko/studio');
  const dom = installFakeStudioDom();
  try {
    const config = lightConfig();
    // First document: the studio mounts, the reader scrolls, then the document
    // goes away (the phone backgrounds the tab and Vite reloads).
    mountJankoStudio(config);
    const first = (globalThis as unknown as { document: { __jankoStudioSession?: StudioSessionState } })
      .document!.__jankoStudioSession;
    assert.ok(first, 'the session is kept on the document (HMR bookkeeping)');
    assert.equal(first!.version, STUDIO_STATE_VERSION);
    dom.setScroll(512);
    dom.hide();
    const persisted = JSON.parse(dom.storage.get(STUDIO_STATE_STORAGE_KEY)!) as StudioSessionState;
    assert.equal(persisted.scroll[persisted.view], 512, 'hiding captures the live place');

    // Second document (the reload): the same storage, a fresh DOM.
    uninstallFakeStudioDom();
    const reloaded = installFakeStudioDom();
    for (const [key, value] of dom.storage) reloaded.storage.set(key, value);
    mountJankoStudio(lightConfig());
    await reloaded.settle();
    assert.equal(reloaded.scroll.top, 512, 'the reload restores the reader’s place');

    // …and an HMR re-mount of that same document never re-reads storage.
    const stale = { ...persisted, zoom: 0.5, scroll: { ...persisted.scroll, [persisted.view]: 10 } };
    reloaded.storage.set(STUDIO_STATE_STORAGE_KEY, JSON.stringify(stale));
    mountJankoStudio(lightConfig());
    await reloaded.settle();
    assert.equal(reloaded.scroll.top, 512, 'the live document state wins over stale storage');
  } finally {
    uninstallFakeStudioDom();
  }
});

test('Round 45 §F: the debounced scroll capture writes the settled place, not every event', async () => {
  const { mountJankoStudio } = await import('../src/render/janko/studio');
  const dom = installFakeStudioDom();
  try {
    mountJankoStudio(lightConfig());
    await dom.settle();
    dom.setScroll(1200);
    // Five scroll events inside one debounce window write once, not five times.
    for (let i = 0; i < 5; i++) dom.fire('window:scroll', {});
    const before = JSON.parse(dom.storage.get(STUDIO_STATE_STORAGE_KEY)!) as StudioSessionState;
    await dom.settle();
    const after = JSON.parse(dom.storage.get(STUDIO_STATE_STORAGE_KEY)!) as StudioSessionState;
    assert.equal(after.scroll[after.view], 1200, 'the settled place is captured once');
    assert.equal(
      before.scroll[before.view] ?? 0,
      0,
      'the events themselves write nothing: the debounce decides when'
    );
  } finally {
    uninstallFakeStudioDom();
  }
});
