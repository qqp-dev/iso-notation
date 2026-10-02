import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { REFERENCE_READER_KEY, readReferenceReader,availableReferenceSelection, referenceScoreFromSearch } from '../src/render/janko/prepared/reference-reader';
import { STUDIO_STATE_STORAGE_KEY } from '../src/render/janko/studio-session';

type ScoreId = 'primary' | 'brahms-op118-no1' | 'schumann-op68-no14-gold';
const ids: ScoreId[] = ['primary', 'brahms-op118-no1', 'schumann-op68-no14-gold'];
const names: Record<ScoreId, string> = { primary: 'Bach', 'brahms-op118-no1': 'Brahms', 'schumann-op68-no14-gold': 'Schumann No.14' };
const badges: Record<ScoreId, string> = { primary: 'GOLD', 'brahms-op118-no1': 'BRONZE', 'schumann-op68-no14-gold': 'GOLD' };
const artifact = (generation: string, view: string, present: ScoreId[] = ids) => view === 'candidates'
  ? `<section class="view-panel" data-view="candidates">${generation}:candidate</section>`
  : `<section class="view-panel" id="view-reference" data-view="reference">${present.map((id) =>
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
      if (view === 'reference') for (const id of ids) {
        if (!html.includes(`data-score="${id}"`)) continue;
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
  body = { scrollHeight: 7000, classList: new Classes() };
  fonts = { ready: Promise.resolve() };
  constructor() { super('document'); this.ownerDocument = this; }
  getElementById(id: string) { return this.ids.get(id) ?? null; }
  querySelectorAll(selector: string) { return selector === '[data-view-target]' || selector === '[data-studio-mode], #janko-tab-reference' ? this.tabs : []; }
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

async function mount(code: string, seed = new Map<string, string>(), hash = '#reference', search = '') {
  const doc = new Doc();
  const root = new Node('div'); root.ownerDocument = doc;
  root.dataset.initialView = 'candidates'; root.innerHTML = '';
  doc.ids.set('janko-studio', root);
  const picker = new Node('select'); picker.ownerDocument = doc; doc.ids.set('janko-reference-picker', picker);
  for (const id of ['janko-status', 'janko-zoom-label', 'janko-zoom-in', 'janko-zoom-out', 'janko-zoom-reset']) {
    const element = new Node('div'); element.ownerDocument = doc; doc.ids.set(id, element);
  }
  for (const view of ['candidates', 'reference']) { const tab = new Node('button'); tab.dataset.viewTarget = view; tab.dataset.studioMode = view === 'candidates' ? 'engraving' : 'reference'; doc.tabs.push(tab); }
  const location = { hash, search, get href() { return `https://example.test/iso-notation/janko.html${this.search}${this.hash}`; } };
  const history = { scrollRestoration: 'auto', state: { reader: true }, replaceState: (_state: unknown, _title: string, target: string | URL) => {
    const url = new URL(target, location.href);
    location.search = url.search; location.hash = url.hash;
  } };
  const storage = new Map(seed);
  if(!storage.has(REFERENCE_READER_KEY))storage.set(REFERENCE_READER_KEY,JSON.stringify({selected:'primary'}));
  const pending = new Map<string, ReturnType<typeof deferred<any>>>();
  const timers = new Map<number, () => void>(); let timerId = 0;
  let top = 0;
  const window = new Node('window') as Node & Record<string, any>;
  window.ownerDocument = doc;
  window.innerHeight = 800;
  window.location = location;
  window.history = history;
  window.sessionStorage = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } };
  Object.defineProperty(window, 'scrollY', { get: () => top });
  window.scrollTo = (_x: number, y: number) => { top = Math.max(0, Math.min(y, doc.body.scrollHeight - window.innerHeight)); };
  // Model the browser's immediate clamp when a zoom change shortens the document.
  // Before the prepared artifact is injected there is no laid-out paper.
  const layout = (zoom: number) => {
    const visible = !root.hidden && root.querySelectorAll('.view-panel').some((panel) => panel.classList.contains('is-active'));
    const height = visible ? 1100 + zoom * 1900 : window.innerHeight;
    doc.body.scrollHeight = doc.documentElement.scrollHeight = height;
    top = Math.min(top, Math.max(0, height - window.innerHeight));
  };
  root.onZoom = layout;
  // CSS display:none collapses the paper; showing it lays out the prepared
  // artifact again before the queued two-frame scroll restore runs.
  let hidden = false;
  Object.defineProperty(root, 'hidden', { get: () => hidden, set: (value: boolean) => { hidden = value; layout(root.zoom); } });
  window.setTimeout = (fn: () => void) => { const id = ++timerId; timers.set(id, fn); return id; };
  window.clearTimeout = (id: number) => timers.delete(id);
  window.requestAnimationFrame = (fn: (time: number) => void) => window.setTimeout(() => fn(0));
  const accepts: Array<(mod: { default: ReturnType<typeof manifest> }) => void> = [];
  const context = { document: doc, window, history, performance, Date, URL, URLSearchParams,
    __manifest: manifest('one'), __hot: { accept: (_id: string, handler: typeof accepts[number]) => accepts.push(handler) },
    fetch: (url: string) => { const gate = deferred<any>(); pending.set(url, gate); return gate.promise; },
  };
  runInNewContext(code, context);
  const flush = async () => { for (let i = 0; i < 20; i++) { await Promise.resolve(); const callbacks = [...timers.values()]; timers.clear(); for (const fn of callbacks) fn(); } };
  const answer = async (generation: string, beforeScrollDebounce = false, present: ScoreId[] = ids) => {
    for (const view of ['candidates', 'reference']) {
      const url = `${generation}:${view}`; const gate = pending.get(url);
      assert.ok(gate, `prepared fetch ${url}`);
      gate.resolve({ ok: true, text: async () => artifact(generation, view, present) });
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
  const swap = async (generation: string) => { assert.equal(accepts.length, 1, 'one manifest HMR accept handler'); accepts[0]({ default: manifest(generation) }); await Promise.resolve(); };
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
  assert.equal(active.querySelectorAll('.crop-grid').length, id==='schumann-op68-no14-gold'?1:0, 'only No14 playing cues are retained');
  assert.equal(inactive.querySelectorAll('.crop-grid').length, inactive.dataset.score==='schumann-op68-no14-gold'?1:0);
  for (const score of [active, inactive]) {
    assert.equal(score.children[0].children.filter((n) => n.className === 'section-title').length, score.dataset.score==='schumann-op68-no14-gold'?1:0);
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
  const picker = html.match(/<select\b[^>]*id="janko-reference-picker"[^>]*>[\s\S]*?<\/select>/)?.[0];
  assert.ok(picker, 'the keyboard-operable Reference piece picker is present');
  assert.match(picker, /aria-label="Reference piece"/, 'a compact visible label must not shorten its accessible identity');
  for (const id of ids) assert.match(picker, new RegExp(`<option value="${id}"[^>]*>[^<]*${names[id]}`), 'both works remain identifiable');
  assert.match(html, /\.reference-score\[data-score="brahms-op118-no1"\]:not\(\[data-reader-selected="true"\]\)\s*\{\s*display:\s*none/);
  assert.match(html, /\.reference-score\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(html, /:focus-visible\s*\{[^}]*outline/);
});

test('Reference reader rejects corrupt score and zoom records without breaking the browser choice', () => {
  const storage = (raw: string) => ({ getItem: () => raw, setItem: () => undefined });
  assert.equal(readReferenceReader().selected, 'schumann-op68-no14-gold');
  assert.equal(readReferenceReader(storage('{bad')).selected, 'schumann-op68-no14-gold');
  const selected = readReferenceReader(storage(JSON.stringify({ selected: 'brahms-op118-no1', places: { primary: -4, 'brahms-op118-no1': 400 }, zooms: { primary: 9, 'brahms-op118-no1': 1.75 } })));
  assert.equal(selected.selected, 'brahms-op118-no1'); assert.equal(selected.places.primary, 0);
  assert.equal(selected.places['brahms-op118-no1'], 400); assert.equal(selected.zooms.primary, 1);
  assert.equal(readReferenceReader(storage('{"selected":"unknown"}')).selected, 'schumann-op68-no14-gold');
});

test('fresh reader prefers GOLD only in payloads that contain it; legacy and saved choices remain available',()=>{
 const root=(present:ScoreId[])=>({querySelector:()=>({querySelectorAll:()=>present.map(score=>({dataset:{score}}))})}) as unknown as HTMLElement;
 const fresh=readReferenceReader();
 assert.equal(availableReferenceSelection(root(['primary','brahms-op118-no1']),fresh),'primary');
 assert.equal(availableReferenceSelection(root(ids),fresh),'schumann-op68-no14-gold');
 for(const id of ids.slice(0,2)){
  const saved=readReferenceReader({getItem:()=>JSON.stringify({selected:id,places:{[id]:760},zooms:{[id]:1.75}}),setItem:()=>{}});
  assert.equal(availableReferenceSelection(root(ids),saved),id);assert.equal(saved.places[id],760);assert.equal(saved.zooms[id],1.75);
 }
});

test('score links accept only available Reference identities and preserve saved fallback choices', () => {
  const saved = readReferenceReader({ getItem: () => '{"selected":"brahms-op118-no1"}', setItem: () => {} });
  const root = (present: ScoreId[]) => ({ querySelector: () => ({ querySelectorAll: () => present.map(score => ({ dataset: { score } })) }) }) as unknown as HTMLElement;
  assert.equal(referenceScoreFromSearch('?score=schumann-op68-no14-gold'), 'schumann-op68-no14-gold');
  for (const query of ['', '?score=', '?score=unknown', '?score=schumann-op68-no14-written-practice']) assert.equal(referenceScoreFromSearch(query), undefined);
  assert.equal(availableReferenceSelection(root(ids), saved, referenceScoreFromSearch('?score=schumann-op68-no14-gold')), 'schumann-op68-no14-gold');
  assert.equal(availableReferenceSelection(root(ids.slice(0, 2)), saved, 'schumann-op68-no14-gold'), 'brahms-op118-no1');
});

test('home-page No14 navigation overrides saved Bach once, preserves places/zooms and follows later manual choice on reload', async () => {
  const seed = new Map([
    [REFERENCE_READER_KEY, JSON.stringify({ selected: 'primary', places: { primary: 420, 'brahms-op118-no1': 790, 'schumann-op68-no14-gold': 680 }, zooms: { primary: 1.25, 'brahms-op118-no1': 1.75, 'schumann-op68-no14-gold': 1.5 }, candidatesZoom: 2.25 })],
    [STUDIO_STATE_STORAGE_KEY, JSON.stringify({ version: 1, view: 'candidates', zoom: 2.25, scroll: { candidates: 1300 } })],
    ['saved-candidate-history', 'keep this record'],
  ]);
  const code = await bundleViewer();
  const h = await mount(code, seed, '#reference', '?campaign=home&score=schumann-op68-no14-gold');
  await h.answer('one');
  assertPaper(h, 'schumann-op68-no14-gold', 'one');
  assert.equal(h.getTop(), 680); assert.equal(h.zoom(), 1.5);
  await h.swap('two'); await h.answer('two');
  assertPaper(h, 'schumann-op68-no14-gold', 'two');
  assert.equal(h.getTop(), 680); assert.equal(h.zoom(), 1.5);
  await h.select('brahms-op118-no1');
  assert.equal(h.location.search, '?campaign=home', 'only the initial score override is removed');
  assert.equal(h.location.hash, '#reference');
  assert.equal(h.getTop(), 790); assert.equal(h.zoom(), 1.75);
  const reload = await mount(code, h.storage, h.location.hash, h.location.search);
  await reload.answer('one');
  assertPaper(reload, 'brahms-op118-no1', 'one');
  assert.equal(reload.getTop(), 790); assert.equal(reload.zoom(), 1.75);
  await reload.select('primary');
  assert.equal(reload.getTop(), 420); assert.equal(reload.zoom(), 1.25);
  await reload.select('schumann-op68-no14-gold');
  assert.equal(reload.getTop(), 680); assert.equal(reload.zoom(), 1.5);
  await reload.view('candidates');
  assert.equal(reload.getTop(), 1300); assert.equal(reload.zoom(), 2.25);
  assert.equal(reload.storage.get('saved-candidate-history'), 'keep this record');
});

test('invalid and unavailable score links leave a real saved Reference visible', async () => {
  const code = await bundleViewer();
  for (const query of ['?score=unknown', '?score=schumann-op68-no14-gold']) {
    const h = await mount(code, new Map([[REFERENCE_READER_KEY, '{"selected":"brahms-op118-no1"}']]), '#reference', query);
    await h.answer('one', false, ids.slice(0, 2));
    assert.equal(h.picker.value, 'brahms-op118-no1');
    assert.equal(h.score('brahms-op118-no1').hidden, false);
    assert.equal(h.score('primary').hidden, true);
  }
});

test('new GOLD reader has its own live anchor and zoom while existing Bach selection survives reload',async()=>{
 const h=await mount(await bundleViewer(),new Map([[REFERENCE_READER_KEY,'{}']]));
 await h.answer('one');await h.flush();assertPaper(h,'schumann-op68-no14-gold','one');
 h.scroll(630);await h.flush();await h.zoomIn();const goldZoom=h.zoom();
 await h.select('primary');h.scroll(380);await h.flush();await h.zoomIn();await h.zoomIn();const bachZoom=h.zoom();
 await h.select('schumann-op68-no14-gold');assert.equal(h.getTop(),630);assert.equal(h.zoom(),goldZoom);
 await h.select('primary');assert.equal(h.getTop(),380);assert.equal(h.zoom(),bachZoom);
 const reload=await mount(await bundleViewer(),h.storage);await reload.answer('one');assertPaper(reload,'primary','one');assert.equal(reload.getTop(),380);
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

test('a tab switch before the scroll debounce preserves the latest place of each prepared view', async () => {
  const h = await mount(await bundleViewer(), undefined, '#candidates');
  await h.answer('one');
  h.scroll(430); await h.flush();
  h.scroll(1320); // No scroll timer has fired yet.
  await h.view('reference');
  assertPaper(h, 'primary', 'one');
  h.scroll(760); // Switch back before Reference's scroll debounce fires.
  await h.view('candidates');
  assert.equal(h.getTop(), 1320, 'the latest Candidates place wins over the older debounced value');
  await h.view('reference');
  assert.equal(h.getTop(), 760, 'Reference retains its own latest place');
  h.window.fire('pagehide');
  const reload = await mount(await bundleViewer(), h.storage, '#candidates');
  await reload.answer('one');
  assert.equal(reload.getTop(), 1320, 'the latest place survives reload as well');
  await reload.view('reference');
  assert.equal(reload.getTop(), 760);
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

test('pending restores and rapid view/piece changes cannot replay a stale callback into another pane', async () => {
  const seed = new Map([
    [STUDIO_STATE_STORAGE_KEY, JSON.stringify({ version: 1, view: 'candidates', zoom: 2.5, scroll: { candidates: 3500, reference: 680 } })],
    [REFERENCE_READER_KEY, JSON.stringify({ selected: 'primary', candidatesZoom: 2.5, places: { primary: 680, 'brahms-op118-no1': 930 }, zooms: { primary: 1, 'brahms-op118-no1': 1.5 } })],
  ]);
  const h = await mount(await bundleViewer(), seed, '#candidates');
  await h.answer('one');
  assert.equal(h.getTop(), 3500);
  h.doc.tabs.find((tab) => tab.dataset.viewTarget === 'reference')!.fire('click');
  h.doc.tabs.find((tab) => tab.dataset.viewTarget === 'candidates')!.fire('click');
  await h.flush();
  assert.equal(h.getTop(), 3500, 'earlier Reference restore must not land in Candidates');
  assert.equal(h.zoom(), 2.5);
  await h.view('reference');
  h.picker.value = 'brahms-op118-no1'; h.picker.fire('change');
  h.picker.value = 'primary'; h.picker.fire('change');
  await h.flush();
  assertPaper(h, 'primary', 'one');
  assert.equal(h.getTop(), 680, 'superseded Brahms callback must not land on Bach');
  await h.select('brahms-op118-no1');
  assert.equal(h.getTop(), 930, 'the other saved anchor survives rapid switching');
  await h.view('candidates');
  assert.equal(h.getTop(), 3500, 'neither pending restore nor smaller Reference layout clamps Candidates');
});

test('a hidden Source initial load retains a Reference anchor until its first visible paper and subsequent HMR', async () => {
  const seed = new Map([
    [STUDIO_STATE_STORAGE_KEY, JSON.stringify({ version: 1, view: 'reference', zoom: 1.5, scroll: { reference: 920, candidates: 1250 } })],
    [REFERENCE_READER_KEY, JSON.stringify({ selected: 'brahms-op118-no1', candidatesZoom: 2, places: { primary: 300, 'brahms-op118-no1': 920 }, zooms: { primary: 1, 'brahms-op118-no1': 1.5 } })],
  ]);
  const h = await mount(await bundleViewer(), seed, '#reference');
  h.root.hidden = true;
  h.window.fire('janko-before-surface-hide');
  await h.answer('one');
  assert.equal(h.getTop(), 0, 'hidden paper is not a valid viewport');
  h.root.hidden = false;
  h.window.fire('janko-surface-show');
  await h.flush();
  assertPaper(h, 'brahms-op118-no1', 'one');
  assert.equal(h.getTop(), 920);
  assert.equal(h.zoom(), 1.5);
  await h.swap('two'); await h.answer('two');
  assertPaper(h, 'brahms-op118-no1', 'two');
  assert.equal(h.getTop(), 920, 'the real HMR accept path keeps the visible anchor');
  await h.zoomIn();
  assert.equal(h.zoom(), 1.75, 'HMR does not duplicate zoom handlers');
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
