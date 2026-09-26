import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { REFERENCE_READER_KEY, readReferenceReader } from '../src/render/janko/prepared/reference-reader';
import { STUDIO_STATE_STORAGE_KEY } from '../src/render/janko/studio-session';

type ScoreId = 'primary' | 'brahms-op118-no1';
const ids: ScoreId[] = ['primary', 'brahms-op118-no1'];
const names: Record<ScoreId, string> = { primary: 'Bach', 'brahms-op118-no1': 'Brahms' };
const badges: Record<ScoreId, string> = { primary: 'GOLD', 'brahms-op118-no1': 'BRONZE' };
const artifact = (generation: string, view: string) => view === 'candidates'
  ? `<section class="view-panel" data-view="candidates">${generation}:candidate</section>`
  : `<section class="view-panel" id="view-reference" data-view="reference">${ids.map((id) =>
    `<section class="reference-score" data-score="${id}"><article class="golden-card"><h2>${names[id]}</h2><span class="badges">${badges[id]}</span><div class="page-grid"><svg data-page="1"></svg><svg data-page="2"></svg></div><h2 class="section-title">Macros</h2><div class="crop-grid"><svg></svg></div><details class="diagnostics"><summary>${names[id]} findings</summary><p>${generation} diagnostics</p></details></article></section>`).join('')}</section>`;
const manifest = (generation: string) => ({ generation, artifactHashes: { candidates: generation, reference: generation },
  artifacts: { candidates: `${generation}:candidates`, reference: `${generation}:reference` },
  status: { ok: true, violations: 0, warnings: 0, systems: 2, notes: 4, lintMs: 1 }, stale: false });

class Classes {
  private entries = new Set<string>();
  toggle(key: string, force: boolean) { if (force) this.entries.add(key); else this.entries.delete(key); }
  contains(key: string) { return this.entries.has(key); }
}
class Node {
  dataset: Record<string, string> = {};
  classList = new Classes();
  hidden = false;
  value = '';
  textContent = '';
  attributes = new Map<string, string>();
  children: Node[] = [];
  parent: Node | undefined;
  private listeners = new Map<string, Set<(event: any) => void>>();
  onZoom?: (zoom: number) => void;
  style = { setProperty: (name: string, value: string) => { if (name === '--janko-zoom') { this.zoom = Number(value); this.onZoom?.(this.zoom); } } };
  zoom = 1;
  ownerDocument!: Doc;
  constructor(readonly tag: string, readonly className = '') {}
  addEventListener(type: string, handler: (event: any) => void) { const set = this.listeners.get(type) ?? new Set(); set.add(handler); this.listeners.set(type, set); }
  removeEventListener(type: string, handler: (event: any) => void) { this.listeners.get(type)?.delete(handler); }
  fire(type: string, event: any = {}) { for (const handler of this.listeners.get(type) ?? []) handler(event); }
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  removeAttribute(key: string) { this.attributes.delete(key); }
  matches(selector: string) { return selector === '.section-title' ? this.className === 'section-title' : selector === '.golden-card' ? this.className === 'golden-card' : false; }
  get previousElementSibling(): Node | null { if (!this.parent) return null; return this.parent.children[this.parent.children.indexOf(this) - 1] ?? null; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = undefined; }
  querySelectorAll(selector: string): Node[] {
    const descendants = (parent: Node): Node[] => parent.children.flatMap((child) => [child, ...descendants(child)]);
    const all = descendants(this);
    if (selector === '.view-panel') return all.filter((node) => node.className === 'view-panel');
    if (selector === '.reference-score') return all.filter((node) => node.className === 'reference-score');
    if (selector === '.crop-grid') return all.filter((node) => node.className === 'crop-grid');
    if (selector === 'details.diagnostics') return all.filter((node) => node.className === 'diagnostics');
    if (selector === '.round-card, .golden-card, .candidate-card') return []; // metadata folding is tested separately
    return [];
  }
  querySelector(selector: string): Node | null {
    if (selector === '#view-reference') return this.querySelectorAll('.view-panel').find((n) => n.dataset.view === 'reference') ?? null;
    return null;
  }
  markup = '';
  get innerHTML() { return this.markup; }
  set innerHTML(html: string) {
    this.markup = html;
    this.children = [];
    for (const view of ['candidates', 'reference']) {
      if (!html.includes(`data-view="${view}"`)) continue;
      const panel = this.add(new Node('section', 'view-panel')); panel.dataset.view = view;
      if (view === 'reference') for (const id of ['brahms-op118-no1', 'primary'] as ScoreId[]) {
        const score = panel.add(new Node('section', 'reference-score')); score.dataset.score = id;
        const card = score.add(new Node('article', 'golden-card'));
        card.add(new Node('h2')).textContent = names[id];
        card.add(new Node('span', 'badges')).textContent = badges[id];
        const pages = card.add(new Node('div', 'page-grid'));
        pages.add(new Node('svg')); pages.add(new Node('svg'));
        card.add(new Node('h2', 'section-title')).textContent = 'Macros';
        card.add(new Node('div', 'crop-grid'));
        const diagnostic = score.add(new Node('details', 'diagnostics'));
        diagnostic.textContent = `${generationFrom(html)} ${names[id]} findings`;
      }
    }
  }
  add(node: Node) { node.ownerDocument = this.ownerDocument; node.parent = this; this.children.push(node); return node; }
}
const generationFrom = (markup: string) => markup.match(/(one|two|fast|slow):candidate/)?.[1] ?? markup.match(/(one|two|fast|slow) diagnostics/)?.[1] ?? 'prepared';
class Doc extends Node {
  ids = new Map<string, Node>();
  tabs: Node[] = [];
  readyState = 'complete';
  visibilityState = 'visible';
  documentElement = { scrollHeight: 7000 };
  body = { scrollHeight: 7000 };
  fonts = { ready: Promise.resolve() };
  constructor() { super('document'); this.ownerDocument = this; }
  getElementById(id: string) { return this.ids.get(id) ?? null; }
  querySelectorAll(selector: string) { return selector === '[data-view-target]' ? this.tabs : []; }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }

async function bundleViewer() {
  const bundle = await build({ entryPoints: ['src/render/janko/prepared/viewer.ts'], bundle: true, write: false, platform: 'browser',
    format: 'iife', logLevel: 'silent', plugins: [{ name: 'prepared-manifest', setup(plugin) {
      plugin.onResolve({ filter: /^virtual:janko-prepared-manifest$/ }, () => ({ path: 'manifest', namespace: 'test' }));
      plugin.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export default globalThis.__manifest;', loader: 'js' }));
      plugin.onLoad({ filter: /render\/janko\/prepared\/viewer\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        assert.match(source, /import\.meta\.hot/, 'the production HMR acceptance seam remains');
        return { contents: source.replaceAll('import.meta.hot', 'globalThis.__hot'), loader: 'ts' };
      });
    } }] });
  return bundle.outputFiles[0].text;
}

async function mount(code: string, seed = new Map<string, string>(), hash = '#reference') {
  const doc = new Doc();
  const root = new Node('div'); root.ownerDocument = doc;
  root.dataset.initialView = 'candidates'; root.innerHTML = '';
  doc.ids.set('janko-studio', root);
  const picker = new Node('select'); picker.ownerDocument = doc; doc.ids.set('janko-reference-picker', picker);
  for (const id of ['janko-status', 'janko-zoom-label', 'janko-zoom-in', 'janko-zoom-out', 'janko-zoom-reset']) {
    const element = new Node('div'); element.ownerDocument = doc; doc.ids.set(id, element);
  }
  for (const view of ['candidates', 'reference']) { const tab = new Node('button'); tab.dataset.viewTarget = view; doc.tabs.push(tab); }
  const location = { hash };
  const storage = new Map(seed);
  const pending = new Map<string, ReturnType<typeof deferred<any>>>();
  const timers = new Map<number, () => void>(); let timerId = 0;
  let top = 0;
  const window = new Node('window') as Node & Record<string, any>;
  window.ownerDocument = doc;
  window.innerHeight = 800;
  window.location = location;
  window.sessionStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  Object.defineProperty(window, 'scrollY', { get: () => top });
  window.scrollTo = (_x: number, y: number) => { top = Math.max(0, Math.min(y, doc.body.scrollHeight - window.innerHeight)); };
  // Model the browser's immediate clamp when a zoom change shortens the document.
  // Before the prepared artifact is injected there is no laid-out paper.
  const layout = (zoom: number) => {
    const visible = root.querySelectorAll('.view-panel').some((panel) => panel.classList.contains('is-active'));
    const height = visible ? 1100 + zoom * 1900 : window.innerHeight;
    doc.body.scrollHeight = doc.documentElement.scrollHeight = height;
    top = Math.min(top, Math.max(0, height - window.innerHeight));
  };
  root.onZoom = layout;
  window.setTimeout = (fn: () => void) => { const id = ++timerId; timers.set(id, fn); return id; };
  window.clearTimeout = (id: number) => timers.delete(id);
  window.requestAnimationFrame = (fn: (time: number) => void) => window.setTimeout(() => fn(0));
  const accepts: Array<(mod: { default: ReturnType<typeof manifest> }) => void> = [];
  const context = { document: doc, window, history: { scrollRestoration: 'auto' }, performance, Date,
    __manifest: manifest('one'), __hot: { accept: (_id: string, handler: typeof accepts[number]) => accepts.push(handler) },
    fetch: (url: string) => { const gate = deferred<any>(); pending.set(url, gate); return gate.promise; },
  };
  runInNewContext(code, context);
  const flush = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); const callbacks = [...timers.values()]; timers.clear(); for (const fn of callbacks) fn(); } };
  const answer = async (generation: string, beforeScrollDebounce = false) => {
    for (const view of ['candidates', 'reference']) {
      const url = `${generation}:${view}`; const gate = pending.get(url);
      assert.ok(gate, `prepared fetch ${url}`);
      gate.resolve({ ok: true, text: async () => artifact(generation, view) });
    }
    if (beforeScrollDebounce) {
      // Deliver fetch/DOM microtasks before any scheduled scroll or layout timer.
      for (let i = 0; i < 30 && root.dataset.preparedGeneration !== generation; i++) await Promise.resolve();
      assert.equal(root.dataset.preparedGeneration, generation, 'the prepared swap precedes scroll debounce');
    }
    await flush(); layout(root.zoom);
  };
  const score = (id: ScoreId) => root.querySelector('#view-reference')!.querySelectorAll('.reference-score').find((n) => n.dataset.score === id)!;
  const select = async (id: ScoreId) => { picker.value = id; picker.fire('change'); await flush(); };
  const view = async (next: 'reference' | 'candidates', route: 'tab' | 'hash' = 'tab') => {
    if (route === 'hash') { location.hash = `#${next}`; window.fire('hashchange'); }
    else doc.tabs.find((tab) => tab.dataset.viewTarget === next)!.fire('click');
    await flush(); layout(root.zoom);
  };
  const swap = async (generation: string) => { accepts[0]({ default: manifest(generation) }); await Promise.resolve(); };
  return { root, doc, picker, storage, pending, answer, select, score, view, swap, flush, window, location,
    scroll: (y: number) => { window.scrollTo(0, y); window.fire('scroll'); }, getTop: () => top,
    zoom: () => root.zoom, zoomIn: async () => { doc.ids.get('janko-zoom-in')!.fire('click'); await flush(); } };
}

function assertPaper(h: Awaited<ReturnType<typeof mount>>, id: ScoreId, generation: string) {
  const active = h.score(id), inactive = h.score(ids.find((other) => other !== id)!);
  assert.equal(h.root.querySelectorAll('.view-panel').filter((panel) => panel.classList.contains('is-active')).length, 1);
  assert.equal(active.hidden, false); assert.equal(active.attributes.has('aria-hidden'), false);
  assert.equal(inactive.hidden, true); assert.equal(inactive.attributes.get('aria-hidden'), 'true');
  assert.equal(h.picker.value, id, 'picker and visible score agree');
  assert.equal(active.querySelectorAll('.crop-grid').length, 0, 'macro container is removed, not reserved');
  assert.equal(inactive.querySelectorAll('.crop-grid').length, 0);
  for (const score of [active, inactive]) {
    assert.equal(score.children[0].children.filter((n) => n.className === 'section-title').length, 0);
    assert.equal(score.children[0].children.find((n) => n.className === 'page-grid')!.children.length, 2, 'both full page sets remain');
    assert.match(score.querySelectorAll('details.diagnostics')[0].textContent, new RegExp(`${generation}.*findings`),
      'the selected score retains findings from the current generation');
  }
  assert.equal(active.children[0].children[0].textContent, names[id]);
  assert.equal(active.children[0].children[1].textContent, badges[id]);
  assert.match(h.root.innerHTML, new RegExp(generation + ':candidate'), 'fresh prepared generation is applied');
}

test('the mirrored shell offers a labeled keyboard picker and hides the second score before JS layout', async () => {
  const html = await readFile('janko.html', 'utf8');
  assert.equal(html, await readFile('public/janko.html', 'utf8'));
  assert.match(html, /<label[^>]*>\s*Piece\s*<select\b[^>]*id="janko-reference-picker"[^>]*>/);
  for (const id of ids) assert.match(html, new RegExp(`<option value="${id}"[^>]*>[^<]*${badges[id]}`));
  assert.match(html, /\.reference-score\[data-score="brahms-op118-no1"\]:not\(\[data-reader-selected="true"\]\)\s*\{\s*display:\s*none/);
  assert.match(html, /\.reference-score\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(html, /:focus-visible\s*\{[^}]*outline/);
});

test('Reference reader rejects corrupt score and zoom records without breaking the browser choice', () => {
  const storage = (raw: string) => ({ getItem: () => raw, setItem: () => undefined });
  assert.equal(readReferenceReader().selected, 'primary');
  assert.equal(readReferenceReader(storage('{bad')).selected, 'primary');
  const selected = readReferenceReader(storage(JSON.stringify({ selected: 'brahms-op118-no1', places: { primary: -4, 'brahms-op118-no1': 400 }, zooms: { primary: 9, 'brahms-op118-no1': 1.75 } })));
  assert.equal(selected.selected, 'brahms-op118-no1'); assert.equal(selected.places.primary, 0);
  assert.equal(selected.places['brahms-op118-no1'], 400); assert.equal(selected.zooms.primary, 1);
  assert.equal(readReferenceReader(storage('{"selected":"unknown"}')).selected, 'primary');
});

test('real prepared reader keeps a single accessible score, independent anchors/zooms, and current selection across tabs, races, reload and HMR', async () => {
  const code = await bundleViewer();
  const h = await mount(code);
  await h.answer('one'); await h.flush();
  assertPaper(h, 'primary', 'one');
  h.scroll(480); await h.flush(); await h.zoomIn();
  const bachZoom = h.zoom();
  await h.select('brahms-op118-no1');
  assertPaper(h, 'brahms-op118-no1', 'one');
  assert.equal(h.getTop(), 0, 'first visit begins at top, not Bach’s anchor');
  h.scroll(790); await h.flush(); await h.zoomIn(); await h.zoomIn();
  const brahmsZoom = h.zoom();
  await h.view('candidates'); h.scroll(1700); await h.flush();
  await h.zoomIn(); const candidateZoom = h.zoom();
  await h.view('reference', 'hash');
  assertPaper(h, 'brahms-op118-no1', 'one');
  assert.equal(h.getTop(), 790); assert.equal(h.zoom(), brahmsZoom);
  await h.select('primary'); assert.equal(h.getTop(), 480); assert.equal(h.zoom(), bachZoom);
  await h.select('brahms-op118-no1'); assert.equal(h.getTop(), 790);
  await h.view('candidates'); assert.equal(h.getTop(), 1700); assert.equal(h.zoom(), candidateZoom);
  await h.view('reference');
  await h.swap('slow');
  await h.select('primary'); // change selection while the old generation is in flight
  await h.swap('fast');
  await h.select('brahms-op118-no1');
  await h.answer('fast');
  await h.answer('slow'); // older response cannot replace the newer chosen piece
  assertPaper(h, 'brahms-op118-no1', 'fast'); assert.equal(h.getTop(), 790);
  h.window.fire('pagehide');
  const reload = await mount(code, h.storage, '#reference');
  await reload.answer('one'); await reload.flush();
  assertPaper(reload, 'brahms-op118-no1', 'one'); assert.equal(reload.getTop(), 790);
  assert.equal(reload.zoom(), brahmsZoom);
  assert.ok(h.storage.has(REFERENCE_READER_KEY)); assert.ok(h.storage.has(STUDIO_STATE_STORAGE_KEY));
});

test('prepared replacement preserves a just-scrolled anchor before debounce in both views', async () => {
  const h = await mount(await bundleViewer());
  await h.answer('one');
  h.scroll(480); await h.flush();
  h.scroll(1200); // A pending scroll debounce must not replace the live place with 480.
  await h.swap('two'); await h.answer('two', true);
  assertPaper(h, 'primary', 'two');
  assert.equal(h.getTop(), 1200, 'Reference restores the latest visible anchor after replacement');

  await h.view('candidates');
  h.scroll(600); await h.flush();
  h.scroll(1350);
  await h.swap('fast'); await h.answer('fast', true);
  assert.equal(h.getTop(), 1350, 'Candidates also restores the latest visible anchor after replacement');
  await h.view('reference');
  assertPaper(h, 'primary', 'fast');
  assert.equal(h.getTop(), 1200, 'the other view’s replacement does not overwrite Reference place');
});

test('switching from enlarged Candidates captures its original anchor before Reference shrinks the document', async () => {
  const h = await mount(await bundleViewer(), new Map([[REFERENCE_READER_KEY, JSON.stringify({ selected: 'primary', zooms: { primary: 1 } })]]), '#candidates');
  await h.answer('one');
  for (let i = 0; i < 6; i++) await h.zoomIn();
  assert.equal(h.zoom(), 2.5);
  h.scroll(3500); await h.flush();
  assert.equal(h.getTop(), 3500);
  await h.view('reference');
  assert.equal(h.zoom(), 1);
  await h.view('candidates');
  assert.equal(h.zoom(), 2.5);
  assert.equal(h.getTop(), 3500, 'the hidden, shortened layout must not overwrite the outgoing Candidates anchor');
});

test('Source-mode reload cannot overwrite a pending prepared place before paper arrives', async () => {
  const storage = new Map([[STUDIO_STATE_STORAGE_KEY, JSON.stringify({ version: 1, view: 'candidates', zoom: 1.5, scroll: { candidates: 1400 } })]]);
  const h = await mount(await bundleViewer(), storage, '#candidates');
  // The Source viewer hides the prepared pane before its delayed first artifact
  // or font/layout restore has run. There is no laid-out paper to sample yet.
  h.window.fire('janko-before-surface-hide');
  h.root.hidden = true;
  await h.flush();
  await h.answer('one');
  h.root.hidden = false;
  h.window.fire('janko-surface-show');
  await h.flush();
  assert.equal(h.getTop(), 1400, 'the chosen prepared pane restores its original saved anchor after returning from Source');
  assert.equal(h.zoom(), 1.5);
});
