/**
 * The prepared viewer's DOM application layer — the two historic defects.
 * ======================================================================
 *
 * The prepared viewer applies manifest generations by swapping `root.innerHTML`
 * and switching two panels. Two deterministic browser defects were found in
 * review and are pinned here against the **shipped** application code
 * (`src/render/janko/prepared/viewer-dom.ts` + the real session):
 *
 * - **Defect A — stale panel nodes.** Handlers that close over panels collected
 *   before the swap toggle detached markup: the tab chrome changes but the live
 *   panels never switch, so the Golden Reference is unreachable. The fix is
 *   live collection at every switch ({@link showView}), pinned here by swapping
 *   the root's children and asserting the switch acts on the post-swap nodes.
 * - **Defect B — blank studio after the first HMR regeneration.** The injected
 *   artifact markup arrives with no active panel; without an explicit re-show
 *   of the session view BOTH panels end `display:none`, the document collapses,
 *   and the scroll restore clamps the reader's place to 0 under a ready label.
 *   Pinned here by asserting the applied swap leaves exactly the session's
 *   view active and `restorePlace` then lands on the recorded place.
 *
 * The DOM fake models exactly the browser semantics these defects turn on:
 * `innerHTML` replaces every child with freshly parsed nodes (old references
 * detach), and a hidden panel contributes no document height (so `max()` is 0
 * while both panels are hidden). Everything else — the session, clamping,
 * capture/restore — is the real `studio-session` module.
 */

import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  activePanelViews,
  applyZoom,
  collectStudioDom,
  createPreparedApplier,
  selectStudioView,
  showView,
  type ApplyOutcome,
  type PreparedArtifactKey,
} from '../src/render/janko/prepared/viewer-dom';
import { renderPreparedStatus, type PreparedManifest } from '../src/render/janko/prepared/status';
import {
  openStudioReviewSession,
  type StudioScrollPort,
  type StudioStorageLike,
} from '../src/render/janko/studio-session';

const projectRoot = process.cwd();

// ---------------------------------------------------------------------------
// A minimal DOM with the exact semantics the defects turn on.
// ---------------------------------------------------------------------------

class FakeClassList {
  private names = new Set<string>();
  constructor(initial = '') {
    for (const name of initial.split(/\s+/).filter(Boolean)) this.names.add(name);
  }
  toggle(name: string, force?: boolean): boolean {
    const add = force ?? !this.names.has(name);
    if (add) this.names.add(name);
    else this.names.delete(name);
    return add;
  }
  contains(name: string): boolean {
    return this.names.has(name);
  }
}

class FakeElement {
  dataset: Record<string, string> = {};
  classList: FakeClassList;
  textContent = '';
  ownerDocument: FakeDocument;
  style = { setProperty: (_name: string, _value: string): void => undefined };
  /** The nodes currently in the tree (replaced wholesale by innerHTML). */
  children: FakeElement[] = [];
  private markup = '';

  constructor(doc: FakeDocument, classes = '') {
    this.ownerDocument = doc;
    this.classList = new FakeClassList(classes);
  }

  get innerHTML(): string {
    return this.markup;
  }

  /** Browser semantics: every child is replaced by freshly parsed nodes. */
  set innerHTML(html: string) {
    this.markup = html;
    const parsed: FakeElement[] = [];
    const section = /<section class="view-panel"[^>]*data-view="([^"]+)">([\s\S]*?)<\/section>/g;
    for (const match of html.matchAll(section)) {
      const panel = new FakeElement(this.ownerDocument);
      panel.dataset.view = match[1];
      panel.markup = match[2];
      parsed.push(panel);
    }
    this.children = parsed;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === '.view-panel') return [...this.children];
    return [];
  }
}

class FakeDocument {
  byId = new Map<string, FakeElement>();
  tabs: FakeElement[] = [];

  getElementById(id: string): FakeElement | null {
    return this.byId.get(id) ?? null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === '[data-view-target]') return [...this.tabs];
    return [];
  }
}

function makeStudio(): {
  root: FakeElement;
  status: FakeElement;
  zoomLabel: FakeElement;
  tabs: FakeElement[];
  asRoot: () => HTMLElement;
  asStatus: () => HTMLElement | null;
} {
  const doc = new FakeDocument();
  const root = new FakeElement(doc);
  root.innerHTML = '<p>loading</p>';
  const status = new FakeElement(doc);
  const zoomLabel = new FakeElement(doc);
  doc.byId.set('janko-studio', root);
  doc.byId.set('janko-status', status);
  doc.byId.set('janko-zoom-label', zoomLabel);
  const tabs: FakeElement[] = [];
  for (const view of ['candidates', 'reference']) {
    const tab = new FakeElement(doc);
    tab.dataset.viewTarget = view;
    tabs.push(tab);
    doc.tabs.push(tab);
  }
  return {
    root,
    status,
    zoomLabel,
    tabs,
    asRoot: () => root as unknown as HTMLElement,
    asStatus: () => status as unknown as HTMLElement,
  };
}

// ---------------------------------------------------------------------------
// Manifest / artifact fixtures (byte shapes match the real artifacts).
// ---------------------------------------------------------------------------

function artifact(label: string, key: PreparedArtifactKey): string {
  return `<section class="view-panel" id="view-${key}" data-view="${key}"><figure>${label}:${key}</figure></section>`;
}

function manifest(label: string, over: Partial<PreparedManifest> = {}): PreparedManifest {
  return {
    generation: `gen-${label}`,
    artifactHashes: { candidates: `h-${label}-c`, reference: `h-${label}-r` },
    artifacts: { candidates: `url:${label}:candidates`, reference: `url:${label}:reference` },
    status: { ok: true, violations: 0, warnings: 0, systems: 2, notes: 4, lintMs: 1 },
    stale: false,
    ...over,
  };
}

/** fetchText that serves `artifact(label, key)` per manifest url, with failure/hold knobs. */
function fetchTextFor(opts: {
  failOn?: (url: string) => boolean;
  hold?: (url: string) => Promise<void>;
} = {}) {
  return async (key: PreparedArtifactKey, url: string): Promise<string> => {
    if (opts.failOn?.(url)) throw new Error(`artifact ${key} exploded`);
    if (opts.hold) await opts.hold(url);
    return artifact(url.split(':')[1] ?? 'x', key);
  };
}

function memoryStorage(): StudioStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/** A scroll port whose max reflects the laid-out content: hidden panels collapse the document. */
function scrollPort(root: FakeElement, initial = 0) {
  const calls: number[] = [];
  let y = initial;
  const port: StudioScrollPort = {
    get: () => y,
    set: (top) => {
      calls.push(top);
      y = top;
    },
    max: () => (activePanelViews(root as unknown as HTMLElement).length > 0 ? 1200 : 0),
  };
  return { port, calls, setY: (next: number) => (y = next), getY: () => y };
}

function makeSession(port: StudioScrollPort) {
  return openStudioReviewSession({
    storage: memoryStorage(),
    host: {},
    views: ['candidates', 'reference'],
    fallbackView: 'candidates',
    initialZoom: 1,
    scroll: port,
    zoomBounds: { min: 0.5, max: 3 },
  });
}

const runNow = (apply: () => void): void => apply();

// ---------------------------------------------------------------------------
// Defect A — panel switching must act on the live (post-swap) nodes.
// ---------------------------------------------------------------------------

test('Defect A regression: a view switch after a manifest swap acts on the fresh panels', async () => {
  const studio = makeStudio();
  const root = studio.root;
  const applier = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor(),
  });
  const { port } = scrollPort(root);
  const session = makeSession(port);
  const view = (): string => session.state.view;

  assert.equal(await applier.apply(manifest('one'), view), 'applied');
  selectStudioView({ session, root: studio.asRoot(), view: 'reference', afterLayout: runNow });
  assert.deepEqual(activePanelViews(studio.asRoot()), ['reference']);

  // The swap: fresh nodes replace the collected ones (browser innerHTML).
  const detached = root.children;
  assert.equal(await applier.apply(manifest('two'), view), 'applied');
  const fresh = root.children;
  assert.notEqual(fresh[0], detached[0], 'the swap replaced the panel nodes');

  // The tab click after the swap switches the LIVE panels, not the dead ones.
  selectStudioView({ session, root: studio.asRoot(), view: 'candidates', afterLayout: runNow });
  assert.deepEqual(activePanelViews(studio.asRoot()), ['candidates']);
  assert.ok(fresh[0].classList.contains('is-active'), 'the post-swap candidates panel is the one toggled');
  assert.ok(!fresh[1].classList.contains('is-active'), 'and the post-swap reference panel is off');
  assert.match(fresh[0].innerHTML, /two:candidates/, 'the active panel carries the applied generation');
  // Tab chrome stays matched to the live panel.
  assert.ok(studio.tabs[0].classList.contains('is-active'));
  assert.ok(!studio.tabs[1].classList.contains('is-active'));
});

// ---------------------------------------------------------------------------
// Defect B — every applied swap re-shows the session view before the restore.
// ---------------------------------------------------------------------------

test('Defect B regression: an HMR re-apply re-shows the session view and the place restore lands intact', async () => {
  const studio = makeStudio();
  const root = studio.root;
  const applier = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor(),
  });
  const { port, calls, setY } = scrollPort(root);
  const session = makeSession(port);
  const view = (): string => session.state.view;

  assert.equal(await applier.apply(manifest('one'), view), 'applied');
  selectStudioView({ session, root: studio.asRoot(), view: 'reference', afterLayout: runNow });
  setY(600);
  session.capture();

  // The first HMR regeneration: same path the accept callback drives.
  assert.equal(await applier.apply(manifest('two'), view), 'applied');

  // Exactly the session's view is visible — never both panels hidden (the
  // blank-studio-under-a-ready-label defect).
  assert.deepEqual(activePanelViews(studio.asRoot()), ['reference']);
  // Both matched surfaces carry the new generation.
  assert.equal(root.children.length, 2);
  for (const panel of root.children) assert.match(panel.innerHTML, /two:/);

  // The restore now clamps against laid-out content and lands on the
  // recorded place — not 0 (the collapsed-document clamp).
  session.restorePlace(runNow);
  assert.deepEqual(calls, [600], 'the reader is restored to the recorded place');
  assert.equal(session.place('reference'), 600, 'the place is not clobbered by the restore');
});

// ---------------------------------------------------------------------------
// The explicit state machine: preparing / ready / stale / error, never blank.
// ---------------------------------------------------------------------------

test('the manifest states are explicit: preparing, loading→ready, refreshing→stale, and failures keep the last output labelled', async () => {
  const studio = makeStudio();
  const root = studio.root;
  const applier = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor(),
  });
  const view = (): string => 'candidates';

  // preparing — the first generation is still running.
  assert.equal(await applier.apply(manifest('p', { generation: 'pending' }), view), 'preparing');
  assert.equal(root.dataset.preparedState, 'preparing');
  assert.match(studio.status.textContent, /preparing/);

  // loading → ready (the loading state is observable while the fetch is open).
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
  const gated = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor({ hold: () => firstGate }),
  });
  const first = gated.apply(manifest('one'), view);
  assert.equal(root.dataset.preparedState, 'loading');
  releaseFirst();
  assert.equal(await first, 'applied');
  assert.equal(root.dataset.preparedState, 'ready');
  assert.match(studio.status.textContent, /prepared/);
  assert.equal(root.dataset.preparedApply, '1', 'the browser harness cycle marker advanced');
  assert.equal(root.dataset.preparedGeneration, 'gen-one');

  // refreshing → stale-labelled apply of an already-stale generation.
  let releaseSecond!: () => void;
  const secondGate = new Promise<void>((resolve) => (releaseSecond = resolve));
  const gated2 = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor({ hold: () => secondGate }),
  });
  const second = gated2.apply(manifest('two', { stale: true }), view);
  assert.equal(root.dataset.preparedState, 'refreshing');
  releaseSecond();
  assert.equal(await second, 'applied');
  assert.equal(root.dataset.preparedState, 'stale', 'a stale generation is labelled, never current');

  // A failed regeneration keeps the last coherent output, labelled stale.
  const failing = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor({ failOn: () => true }),
  });
  assert.equal(await failing.apply(manifest('three'), view), 'artifact-failed-kept');
  assert.equal(root.dataset.preparedState, 'stale');
  assert.match(root.innerHTML, /two:/, 'the last coherent output stays on screen');
  assert.match(studio.status.textContent, /failed/);
  assert.equal(
    await failing.apply(manifest('four', { error: 'the linter exploded' }), view),
    'stale-kept'
  );
  assert.equal(root.dataset.preparedState, 'stale');

  // Failures before any output are explicit messages, never a blank panel.
  const fresh = makeStudio();
  const freshApplier = createPreparedApplier({
    root: fresh.asRoot(),
    status: fresh.asStatus(),
    fetchText: fetchTextFor({ failOn: () => true }),
  });
  assert.equal(await freshApplier.apply(manifest('five'), view), 'artifact-failed-shown');
  assert.equal(fresh.root.dataset.preparedState, 'error');
  assert.match(fresh.root.innerHTML, /could not be loaded/);
  assert.equal(await freshApplier.apply(manifest('six', { error: 'boom' }), view), 'error-shown');
  assert.match(fresh.root.innerHTML, /failed to generate/);
});

test('out-of-order artifact responses are dropped; the latest generation stays applied', async () => {
  const studio = makeStudio();
  const root = studio.root;
  let releaseSlow!: () => void;
  const slowGate = new Promise<void>((resolve) => (releaseSlow = resolve));
  const applier = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor({ hold: (url) => (url.includes(':slow:') ? slowGate : Promise.resolve()) }),
  });
  const view = (): string => 'candidates';

  const older = applier.apply(manifest('slow'), view);
  const newer = applier.apply(manifest('fast'), view);
  assert.equal(await newer, 'applied');
  // The slow generation's responses arrive afterwards — and are dropped.
  releaseSlow();
  assert.equal(await older, 'dropped');
  assert.match(root.innerHTML, /fast:/, 'the superseded generation never lands');
  assert.equal(root.dataset.preparedState, 'ready');
  assert.equal(root.dataset.preparedApply, '1', 'a dropped response is not an applied generation');
});

test('a re-apply preserves the selected tab and the zoom', async () => {
  const studio = makeStudio();
  const root = studio.root;
  const dom = collectStudioDom(studio.asRoot());
  const applier = createPreparedApplier({
    root: studio.asRoot(),
    status: studio.asStatus(),
    fetchText: fetchTextFor(),
  });
  const { port } = scrollPort(root);
  const session = makeSession(port);
  const view = (): string => session.state.view;

  applyZoom(dom, 1.75);
  assert.equal(root.dataset.zoom, '1.75');
  assert.equal(studio.zoomLabel.textContent, '175%');
  assert.equal(await applier.apply(manifest('one'), view), 'applied');
  selectStudioView({ session, root: studio.asRoot(), view: 'reference', afterLayout: runNow });

  assert.equal(await applier.apply(manifest('two'), view), 'applied');
  assert.deepEqual(activePanelViews(studio.asRoot()), ['reference'], 'the tab survives the swap');
  assert.ok(studio.tabs[1].classList.contains('is-active'));
  assert.equal(root.dataset.zoom, '1.75', 'the zoom survives the swap');
  assert.equal(studio.zoomLabel.textContent, '175%');
});

// ---------------------------------------------------------------------------
// Source pins: the viewer routes both switch paths and every apply through the
// live-collecting layer (the defects were call-site bugs, not API bugs).
// ---------------------------------------------------------------------------

test('the viewer wires both switch paths through selectStudioView and restores place after every apply', () => {
  const source = readFileSync(`${projectRoot}/src/render/janko/prepared/viewer.ts`, 'utf8');
  assert.equal(
    source.split('selectStudioView({').length - 1,
    2,
    'the tab click and the hash change both switch through selectStudioView'
  );
  assert.ok(!source.includes('dom.panels'), 'no collected panel list survives in the viewer');
  assert.ok(!source.includes('showView(dom'), 'no stale-dom switch call survives');
  const adds = source.split('addEventListener').length - 1;
  const removes = source.split('removeEventListener').length - 1;
  assert.ok(
    removes >= adds - 1,
    'every handler except the one-shot DOMContentLoaded boot is detached on re-mount (no stale/duplicated handlers)'
  );
  assert.ok(source.includes('createPreparedApplier'), 'the manifest is applied by the tested applier');
  assert.equal(
    source.split('restorePlace').length - 1,
    3,
    'place restore runs after the mount apply, the HMR re-apply and view switches (inside selectStudioView)'
  );
  const hot = source.slice(source.indexOf("import.meta.hot.accept('virtual:janko-prepared-manifest'"));
  assert.ok(hot.length > 0, 'the HMR accept contract is intact');
  assert.match(hot, /\.apply\(/, 'the accept path re-applies the delivered manifest');
  assert.match(hot, /restorePlace/, 'and restores the scroll place afterwards');
  // The applier re-shows the session view on the fresh panels before it resolves.
  const domSource = readFileSync(`${projectRoot}/src/render/janko/prepared/viewer-dom.ts`, 'utf8');
  const applyBody = domSource.slice(domSource.indexOf('async apply(manifest, view)'));
  assert.ok(
    applyBody.indexOf('showView(root, view())') > applyBody.indexOf('root.innerHTML ='),
    'the session view is re-shown on the fresh panels right after the swap'
  );
});

test('the status line renders every state from manifest facts (no live claim)', () => {
  const base = manifest('one');
  assert.match(renderPreparedStatus(base), /prepared/);
  assert.match(renderPreparedStatus({ ...base, generation: 'pending' }), /preparing/);
  assert.match(renderPreparedStatus({ ...base, stale: true }), /stale/);
  assert.match(renderPreparedStatus({ ...base, error: 'x' }), /failed/);
  assert.ok(!renderPreparedStatus(base).includes('live'));
});

// Keep the outcome type exercised end to end (exhaustiveness aid).
const outcomes: ApplyOutcome[] = [
  'preparing',
  'stale-kept',
  'error-shown',
  'dropped',
  'artifact-failed-kept',
  'artifact-failed-shown',
  'applied',
];
void outcomes;
