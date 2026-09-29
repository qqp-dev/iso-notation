import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { SOURCE_DOCUMENTS } from '../src/source-review/documents';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Element {
  dataset: Record<string, string> = {};
  hidden = false;
  disabled = false;
  title = '';
  value = '';
  textContent = '';
  markup = '';
  attributes = new Map<string, string>();
  href = ''; target = ''; rel = ''; src = ''; alt = '';
  onload?: () => void; onerror?: () => void;
  clientWidth = 600;
  scrollTop = 0;
  width = 0; height = 0;
  style: Record<string, string> = {};
  children: Element[] = [];
  private entries = new Map<string, Element>();
  private events = new Map<string, Array<() => void>>();
  classList = { toggle: (_name: string, _active: boolean) => undefined };
  constructor(public tag = 'div') {}
  set innerHTML(html: string) {
    // Model the fixed pane template's controls as DOM children, not its PDF content.
    this.markup = html;
    if (!html.includes('source-controls')) return;
    // Keep the legacy info node in the fake until the implementation stops
    // reading it; markup checks below assert it is absent from the reader.
    for (const name of ['source-select', 'source-info', 'source-edition', 'source-link', 'source-catalogue', 'source-page', 'source-zoom', 'source-status', 'source-canvas']) {
      this.entries.set(`.${name}`, new Element(name === 'source-select' ? 'select' : 'div'));
    }
    this.entries.set('select', this.entries.get('.source-select')!);
    const actions = ['previous', 'next', 'out', 'in', 'reset'].map((action) => {
      const button = new Element('button'); button.dataset.action = action; return button;
    });
    this.entries.set('[data-action]', Object.assign(new Element(), { children: actions }));
  }
  querySelector(selector: string): Element | null { return this.entries.get(selector) ?? null; }
  querySelectorAll(selector: string): Element[] { return this.entries.get(selector)?.children ?? []; }
  setChild(selector: string, child: Element): void { this.entries.set(selector, child); }
  append(...nodes: Element[]): void { this.children.push(...nodes); }
  insertBefore(node: Element, _other: Element | null): void { this.children.unshift(node); }
  replaceChildren(...nodes: Element[]): void { this.children = nodes; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  addEventListener(type: string, callback: () => void): void { this.events.set(type, [...(this.events.get(type) ?? []), callback]); }
  fire(type: string): void { for (const callback of this.events.get(type) ?? []) callback(); }
  getContext(_kind: string): object { return {}; }
}

async function launch(seed?: Map<string, string>) {
  // Bundle the actual Vite-only viewer and actual session. Replace only pdf.js and its
  // worker asset; the renderer and transport can be deterministically held/rejected.
  const bundle = await build({
    entryPoints: ['src/source-review/viewer.ts'], bundle: true, write: false,
    platform: 'browser', format: 'iife', logLevel: 'silent',
    define: { 'import.meta.env.DEV': 'true' },
    plugins: [{ name: 'pdf-port', setup(plugin) {
      // Node's vm cannot run a dynamic import callback under the canonical test
      // runner without an experimental flag. Redirect only the local fallback
      // import to the same controlled resource transport as the wasm fetch.
      plugin.onLoad({ filter: /source-review\/viewer\.ts$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');
        const fallbackImport = 'import(/* @vite-ignore */ `${wasmUrl}jbig2_nowasm_fallback.js`)';
        assert.ok(source.includes(fallbackImport), 'test must exercise the viewer local fallback import');
        return { contents: source.replace(fallbackImport, 'globalThis.__loadDecoder(`${wasmUrl}jbig2_nowasm_fallback.js`)'), loader: 'ts' };
      });
      plugin.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: 'pdfjs', namespace: 'fake' }));
      plugin.onResolve({ filter: /pdf\.worker\.min\.mjs\?url$/ }, () => ({ path: 'worker', namespace: 'fake' }));
      // Keep Vite asset imports resolvable without prescribing how decoder files are served.
      plugin.onResolve({ filter: /^pdfjs-dist\/.*\?url$/ }, ({ path }) => ({ path, namespace: 'fake-asset' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fake-asset' }, () => ({ contents: 'export default "/assets/pdfjs-decoder/"', loader: 'js' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fake' }, ({ path }) => ({ contents: path === 'worker'
        ? 'export default "mock-worker"'
        : 'export const GlobalWorkerOptions = {}; export const getDocument = (...args) => globalThis.__pdfDocument(...args);', loader: 'js' }));
    } }],
  });
  const root = new Element();
  const grid = new Element(); root.setChild('.source-grid', grid);
  const mobileButtons = ['reference', 'candidate'].map((role) => {
    const button = new Element('button'); button.dataset.mobilePane = role; return button;
  });
  const prepared = new Element();
  const switcher = new Element();
  const modeButtons = ['source', 'engraving'].map((mode) => {
    const button = new Element('button'); button.dataset.candidatesMode = mode; return button;
  });
  const storage = new Map<string, string>(seed);
  const windowEvents = new Map<string, Array<() => void>>();
  let resizeCallback: (() => void) | undefined;
  const pending = new Map<string, Array<ReturnType<typeof deferred<object>>>>();
  const pageGates = new Map<string, ReturnType<typeof deferred<object>>>();
  const renderGates = new Map<string, ReturnType<typeof deferred<void>>>();
  const renderCalls = new Map<string, number>();
  const documentOptions: Array<Record<string, unknown>> = [];
  const fetches: string[] = [];
  const images: Element[] = [];
  const validWasm = await readFile('node_modules/pdfjs-dist/wasm/jbig2.wasm');
  const decoder = {
    wasm: 'valid' as 'valid' | 'missing' | 'corrupt' | 'pending',
    fallback: false,
    pending: [] as Array<ReturnType<typeof deferred<object>>>,
    imports: [] as string[],
  };
  const wasmResponse = () => decoder.wasm === 'missing'
    ? { ok: false, status: 404 }
    : { ok: true, arrayBuffer: async () => Uint8Array.from(decoder.wasm === 'corrupt' ? [1, 2, 3] : validWasm).buffer };
  const context = {
    document: {
      getElementById: (id: string) => id === 'source-review' ? root : prepared,
      createElement: (tag: string) => { const element = new Element(tag); if (tag === 'img') images.push(element); return element; },
      querySelector: (selector: string) => selector === '.source-mode-switch' ? switcher : null,
      querySelectorAll: (selector: string) => selector === '[data-candidates-mode]' ? modeButtons : selector === '[data-mobile-pane]' ? mobileButtons : [],
      body: { classList: { toggle: () => undefined } },
    },
    location: { hash: '#candidates' },
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
    window: { devicePixelRatio: 1, addEventListener: (name: string, callback: () => void) => {
      windowEvents.set(name, [...(windowEvents.get(name) ?? []), callback]);
    }, clearTimeout, setTimeout: (callback: () => void) => { resizeCallback = callback; return 1; } },
    fetch: (url: string) => {
      if (url.endsWith('/jbig2.wasm')) {
        fetches.push(url);
        if (decoder.wasm === 'pending') {
          const gate = deferred<object>(); decoder.pending.push(gate); return gate.promise;
        }
        return Promise.resolve(wasmResponse());
      }
      const id = url.split('/').pop()!;
      fetches.push(id);
      const gate = deferred<object>(); pending.set(id, [...(pending.get(id) ?? []), gate]);
      return gate.promise;
    },
    WebAssembly,
    __loadDecoder: async (url: string) => {
      decoder.imports.push(url);
      if (!url.endsWith('/jbig2_nowasm_fallback.js') || !decoder.fallback) throw new Error('local fallback unavailable');
      return { default: () => undefined };
    },
    __pdfDocument: (options: { data: Uint8Array } & Record<string, unknown>) => {
      documentOptions.push(options);
      const id = new TextDecoder().decode(options.data);
      const doc = {
        numPages: SOURCE_DOCUMENTS[id as keyof typeof SOURCE_DOCUMENTS].pages,
        destroy: async () => undefined,
        getPage: (page: number) => pageGates.get(`${id}:${page}`)?.promise ?? Promise.resolve({
          getOperatorList: () => Promise.resolve({}),
          getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
          render: () => {
            const key = `${id}:${page}`;
            renderCalls.set(key, (renderCalls.get(key) ?? 0) + 1);
            return { promise: renderGates.get(key)?.promise ?? Promise.resolve(), cancel: () => undefined };
          },
        }),
      };
      return { promise: Promise.resolve(doc) };
    },
    TextDecoder, Uint8Array, setTimeout, clearTimeout,
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  const flush = async () => { for (let i = 0; i < 15; i++) await new Promise((r) => setImmediate(r)); };
  const until = async (condition: () => boolean) => {
    for (let i = 0; i < 200 && !condition(); i++) await new Promise((r) => setTimeout(r, 5));
    assert.ok(condition(), 'timed out waiting for decoder/render');
  };
  const settled = async (entry: Element) => until(() => entry.dataset.renderState !== 'loading');
  const resolveFetch = async (id: string) => {
    const gate = pending.get(id)?.shift();
    assert.ok(gate, `pending fetch for ${id}`);
    gate.resolve({ ok: true, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => new TextEncoder().encode(id).buffer });
    await flush();
    for (const entry of grid.children) if (entry.dataset.documentId === id) await settled(entry);
  };
  const rejectFetch = async (id: string) => {
    const gate = pending.get(id)?.shift(); assert.ok(gate);
    gate.reject(new Error('cache unavailable'));
    await flush();
  };
  const pane = (index: number) => grid.children[index];
  const workSelect = root.children[0].children[0];
  const switchWork = async (work: string) => { workSelect.value = work; workSelect.fire('change'); await flush(); };
  const resize = async () => {
    for (const callback of windowEvents.get('resize') ?? []) callback();
    resizeCallback?.(); await flush();
  };
  const pagehide = () => { for (const callback of windowEvents.get('pagehide') ?? []) callback(); };
  const switchMobile = async (role: 'reference' | 'candidate') => {
    mobileButtons.find((button) => button.dataset.mobilePane === role)!.fire('click'); await flush();
  };
  const switchView = async (hash: string) => {
    context.location.hash = hash;
    for (const callback of windowEvents.get('hashchange') ?? []) callback();
    await flush();
  };
  const action = (index: number, name: string) => {
    const button = pane(index).querySelectorAll('[data-action]').find((entry) => entry.dataset.action === name);
    assert.ok(button); button.fire('click');
  };
  return { root, prepared, grid, storage, workSelect, switchWork, images, fetches, decoder, pageGates, renderGates, renderCalls, documentOptions, pane, action, resolveFetch, rejectFetch, flush, settled, until, resize, pagehide, switchMobile, switchView, mobileButtons, modeButtons };
}

test('source viewer enables supported PDF.js strict handling and local decoder resources for each loaded PDF', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  assert.equal(h.documentOptions.length, 2);
  for (const options of h.documentOptions) {
    assert.equal(options.stopAtErrors, true, 'use PDF.js supported strict handling; this alone does not surface all asynchronous image errors');
    assert.equal(typeof options.wasmUrl, 'string', 'PDF.js requires a decoder resource directory for scanned pages');
    assert.match(options.wasmUrl as string, /\/$/, 'PDF.js expects wasmUrl to end in a slash');
    assert.doesNotMatch(options.wasmUrl as string, /^https?:\/\//i, 'decoder resources must not depend on external hosts');
  }
});

test('scanned-page preflight fails closed for missing and corrupt JBIG2 wasm without a usable fallback, then retries after restoration', async () => {
  const h = await launch();
  const scan = 'imslp-936721';
  await h.resolveFetch(scan); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0);
  assert.equal(left.dataset.renderState, 'ready');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  for (const failure of ['missing', 'corrupt'] as const) {
    h.decoder.wasm = failure;
    h.decoder.fallback = false;
    h.action(0, 'in'); await h.settled(left);
    assert.equal(left.dataset.renderState, 'error', `${failure} required decoder must not become ready`);
    assert.match(left.querySelector('.source-status')!.textContent, /imslp-936721.*JBIG2 decoder unavailable/);
    assert.equal(left.querySelector('.source-canvas')!.children.length, 0, 'neither stale nor partial pixels may be committed');
    assert.ok(h.fetches.some((url) => url.endsWith('/jbig2.wasm')), 'preflight must request the configured decoder resource');
    h.decoder.wasm = 'valid';
    left.querySelector('select')!.fire('change'); await h.settled(left);
    assert.equal(left.dataset.renderState, 'ready', 'restored decoder allows ordinary same-document retry');
    assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  }
});

test('a usable local JS fallback permits a scanned page when JBIG2 wasm is missing or corrupt', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0);
  for (const failure of ['missing', 'corrupt'] as const) {
    h.decoder.wasm = failure;
    h.decoder.fallback = true;
    h.action(0, 'in'); await h.settled(left);
    assert.equal(left.dataset.renderState, 'ready', `a valid JS fallback must cover ${failure} wasm`);
    assert.ok(h.decoder.imports.some((url) => url.endsWith('/jbig2_nowasm_fallback.js')));
    assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  }
});

test('stale decoder preflight rejection cannot overwrite a switched scan or leave old pixels beneath its label', async () => {
  const h = await launch();
  const left = h.pane(0);
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  h.decoder.wasm = 'pending';
  const oldCanvas = left.querySelector('.source-canvas')!.children[0];
  h.action(0, 'in'); await h.flush();
  assert.equal(left.dataset.renderState, 'loading');
  const pendingPixels = left.querySelector('.source-canvas')!.children;
  assert.ok(pendingPixels.length <= 1);
  if (pendingPixels.length) assert.equal(pendingPixels[0], oldCanvas, 'only valid pixels from the same document/page may remain while zoom is pending');
  assert.equal(h.decoder.pending.length, 1, 'real scanned-page preflight must be in flight');
  left.querySelector('select')!.value = 'imslp-10496'; left.querySelector('select')!.fire('change');
  assert.equal(left.dataset.documentId, 'imslp-10496');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  h.decoder.wasm = 'valid';
  await h.resolveFetch('imslp-10496');
  assert.equal(left.dataset.renderState, 'ready');
  h.decoder.pending[0].reject(new Error('obsolete decoder transport failure'));
  await h.flush();
  assert.equal(left.dataset.renderState, 'ready');
  assert.equal(left.dataset.documentId, 'imslp-10496');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  assert.doesNotMatch(left.querySelector('.source-status')!.textContent, /obsolete decoder transport failure|JBIG2 decoder unavailable/);
});

test('source viewer drops obsolete pages/errors across an actual A/B switch and retries failed documents honestly', async () => {
  const h = await launch();
  const scan = 'imslp-936721', a = 'snortum-v0.4-no01', b = 'mutopia-1779-no01';
  await h.resolveFetch(scan); await h.resolveFetch(a);
  const left = h.pane(0), right = h.pane(1);
  assert.equal(left.dataset.renderState, 'ready');
  assert.equal(right.dataset.renderState, 'ready');
  h.action(0, 'next'); h.action(0, 'in');
  h.action(1, 'next'); h.action(1, 'in');
  await h.flush();
  assert.match(left.querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/);
  assert.match(right.querySelector('.source-page')!.textContent, /\b2\s*\/\s*2\b/);

  const lateA = deferred<object>();
  h.pageGates.set(`${a}:2`, lateA);
  h.action(1, 'in'); // A page 2 still rendering at 150%.
  right.querySelector('select')!.value = b;
  right.querySelector('select')!.fire('change');
  assert.equal(right.dataset.documentId, b);
  assert.equal(right.dataset.renderState, 'loading');
  assert.equal(right.querySelector('.source-canvas')!.children.length, 0, 'no A pixels under the B label');
  await h.rejectFetch(b);
  assert.equal(right.dataset.renderState, 'error');
  assert.match(right.querySelector('.source-status')!.textContent, /mutopia-1779-no01.*cache unavailable/);
  assert.equal(right.querySelector('.source-canvas')!.children.length, 0);
  right.querySelector('select')!.fire('change'); // retry after failed load
  await h.resolveFetch(b);
  assert.equal(right.dataset.renderState, 'ready');
  assert.match(right.querySelector('.source-page')!.textContent, /\b1\s*\/\s*1\b/);
  lateA.resolve({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel: () => undefined }) });
  await h.flush();
  assert.equal(right.dataset.documentId, b);
  assert.equal(right.querySelector('.source-canvas')!.children.length, 1, 'obsolete A completion cannot replace B pixels');
  assert.match(left.querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/, 'right switches do not change left');
  right.querySelector('select')!.value = a; right.querySelector('select')!.fire('change');
  await h.flush();
  assert.match(right.querySelector('.source-page')!.textContent, /\b2\s*\/\s*2\b/);
  assert.match(right.querySelector('.source-zoom')!.textContent, /150%/);
});

test('a rejected page decode never becomes ready or retains pixels; same-document retry recovers and stale failures do not overwrite a switch', async () => {
  const h = await launch();
  const scan = 'imslp-936721', alternate = 'imslp-10496';
  await h.resolveFetch(scan); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0);
  assert.equal(left.dataset.renderState, 'ready');
  const broken = deferred<void>();
  h.renderGates.set(`${scan}:1`, broken);
  const key = `${scan}:1`, before = h.renderCalls.get(key) ?? 0;
  h.action(0, 'in');
  await h.until(() => (h.renderCalls.get(key) ?? 0) > before);
  assert.equal(left.dataset.renderState, 'loading');
  assert.ok(left.querySelector('.source-canvas')!.children.length <= 1, 'same-document pending work may keep valid old pixels until replacement');
  broken.reject(new Error('JBIG2 decoder unavailable'));
  await h.flush();
  assert.equal(left.dataset.renderState, 'error');
  assert.match(left.querySelector('.source-status')!.textContent, /imslp-936721.*JBIG2 decoder unavailable/);
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0, 'partial canvas is never committed');
  h.renderGates.delete(`${scan}:1`);
  left.querySelector('select')!.fire('change');
  await h.settled(left);
  assert.equal(left.dataset.renderState, 'ready', 'ordinary retry works when decoder resources return');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 1);

  const late = deferred<void>();
  h.renderGates.set(`${scan}:1`, late);
  const beforeSwitch = h.renderCalls.get(key) ?? 0;
  h.action(0, 'in'); await h.until(() => (h.renderCalls.get(key) ?? 0) > beforeSwitch);
  left.querySelector('select')!.value = alternate; left.querySelector('select')!.fire('change');
  assert.equal(left.dataset.documentId, alternate);
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  await h.resolveFetch(alternate);
  await h.settled(left);
  assert.equal(left.dataset.renderState, 'ready');
  late.reject(new Error('late decode failure'));
  await h.flush();
  assert.equal(left.dataset.documentId, alternate);
  assert.equal(left.dataset.renderState, 'ready');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  assert.doesNotMatch(left.querySelector('.source-status')!.textContent, /late decode failure/);
});

test('same-width resize and return from Reference preserve decoded canvas, scan preflight and scroll place', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0), right = h.pane(1);
  const canvas = (pane: Element) => pane.querySelector('.source-canvas')!.children[0];
  const first = canvas(left), second = canvas(right);
  const scans = h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length;
  const renders = [...h.renderCalls.values()].reduce((sum, n) => sum + n, 0);
  left.querySelector('.source-canvas')!.scrollTop = 120;
  right.querySelector('.source-canvas')!.scrollTop = 70;
  await h.resize(); // height-only: effective pane width has not moved
  await h.settled(left); await h.settled(right);
  assert.equal(canvas(left), first);
  assert.equal(canvas(right), second);
  assert.equal(left.querySelector('.source-canvas')!.scrollTop, 120);
  assert.equal(right.querySelector('.source-canvas')!.scrollTop, 70);
  await h.switchView('#reference');
  assert.equal(h.root.hidden, true, 'Reference hides the Source reading surface');
  await h.switchView('#candidates');
  assert.equal(h.root.hidden, false, 'Candidates restores the Source reading surface');
  assert.equal(canvas(left), first, 'returning to Source at the same fit reuses the decoded page');
  assert.equal(canvas(right), second);
  assert.equal(h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length, scans);
  assert.equal([...h.renderCalls.values()].reduce((sum, n) => sum + n, 0), renders);
});

test('phone pane switch keeps both selected pages, zooms and valid canvases when fit is unchanged', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0), right = h.pane(1);
  h.action(0, 'next'); h.action(1, 'next'); h.action(1, 'in'); await h.flush();
  await h.settled(left); await h.settled(right);
  const original = left.querySelector('.source-canvas')!.children[0];
  const candidate = right.querySelector('.source-canvas')!.children[0];
  const renders = [...h.renderCalls.values()].reduce((sum, n) => sum + n, 0);
  const scans = h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length;
  const leftHost = left.querySelector('.source-canvas')!, rightHost = right.querySelector('.source-canvas')!;
  leftHost.scrollTop = 125; rightHost.scrollTop = 75;
  assert.equal(h.root.dataset.mobilePane, 'reference');
  await h.switchMobile('candidate');
  assert.equal(h.root.dataset.mobilePane, 'candidate', 'the candidate pane is actually selected');
  assert.equal(h.mobileButtons[0].attributes.get('aria-pressed'), 'false');
  assert.equal(h.mobileButtons[1].attributes.get('aria-pressed'), 'true');
  assert.equal(JSON.parse(h.storage.get('janko-source-review-v1')!).mobilePane, 'candidate');
  assert.equal(leftHost.scrollTop, 125); assert.equal(rightHost.scrollTop, 75);
  await h.switchMobile('reference');
  assert.equal(h.root.dataset.mobilePane, 'reference', 'the original scan is selected again');
  assert.equal(h.mobileButtons[0].attributes.get('aria-pressed'), 'true');
  assert.equal(h.mobileButtons[1].attributes.get('aria-pressed'), 'false');
  await h.settled(left); await h.settled(right);
  assert.equal(leftHost.scrollTop, 125); assert.equal(rightHost.scrollTop, 75);
  assert.equal(left.querySelector('.source-canvas')!.children[0], original);
  assert.equal(right.querySelector('.source-canvas')!.children[0], candidate);
  assert.equal([...h.renderCalls.values()].reduce((sum, n) => sum + n, 0), renders);
  assert.equal(h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length, scans);
  assert.match(left.querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/);
  assert.match(right.querySelector('.source-page')!.textContent, /\b2\s*\/\s*2\b/);
  assert.match(right.querySelector('.source-zoom')!.textContent, /125%/);
  assert.equal(JSON.parse(h.storage.get('janko-source-review-v1')!).mobilePane, 'reference');
});

test('Candidates Source/Engraving mode preserves each PDF document, zoom, page, ink and place', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const reference = h.pane(0), candidate = h.pane(1);
  h.action(0, 'next'); h.action(0, 'in');
  h.action(1, 'next'); h.action(1, 'in');
  await h.settled(reference); await h.settled(candidate);
  const one = reference.querySelector('.source-canvas')!, two = candidate.querySelector('.source-canvas')!;
  one.scrollTop = 140; two.scrollTop = 75;
  one.fire('scroll'); two.fire('scroll');
  const original = one.children[0], other = two.children[0];
  const calls = [...h.renderCalls.values()].reduce((sum, n) => sum + n, 0);
  h.modeButtons.find((button) => button.dataset.candidatesMode === 'engraving')!.fire('click');
  assert.equal(h.root.hidden, true);
  h.modeButtons.find((button) => button.dataset.candidatesMode === 'source')!.fire('click');
  await h.flush();
  assert.equal(h.root.hidden, false);
  assert.equal(one.children[0], original); assert.equal(two.children[0], other);
  assert.equal(one.scrollTop, 140); assert.equal(two.scrollTop, 75);
  assert.equal([...h.renderCalls.values()].reduce((sum, n) => sum + n, 0), calls, 'no extra decode on unchanged pane width');
  assert.match(reference.querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/);
  assert.match(candidate.querySelector('.source-page')!.textContent, /\b2\s*\/\s*2\b/);
  assert.match(candidate.querySelector('.source-zoom')!.textContent, /125%/);
  await h.switchView('#reference');
  assert.equal(h.root.hidden, true);
  await h.switchView('#candidates');
  assert.equal(h.root.hidden, false);
  assert.equal(one.children[0], original); assert.equal(two.children[0], other);
  assert.equal(one.scrollTop, 140); assert.equal(two.scrollTop, 75);
  assert.equal([...h.renderCalls.values()].reduce((sum, n) => sum + n, 0), calls,
    'Reference navigation does not refit unchanged PDF panes');
});

test('Source reload restores each document/page place independently without transferring another PDF’s ink', async () => {
  const first = await launch();
  await first.resolveFetch('imslp-936721'); await first.resolveFetch('snortum-v0.4-no01');
  const scan = first.pane(0).querySelector('.source-canvas')!, candidate = first.pane(1).querySelector('.source-canvas')!;
  first.action(0, 'next'); first.action(1, 'next');
  await first.settled(first.pane(0)); await first.settled(first.pane(1));
  scan.scrollTop = 150; candidate.scrollTop = 85;
  first.pagehide();
  const second = await launch(first.storage);
  await second.resolveFetch('imslp-936721'); await second.resolveFetch('snortum-v0.4-no01');
  assert.match(second.pane(0).querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/);
  assert.match(second.pane(1).querySelector('.source-page')!.textContent, /\b2\s*\/\s*2\b/);
  assert.equal(second.pane(0).querySelector('.source-canvas')!.scrollTop, 150);
  assert.equal(second.pane(1).querySelector('.source-canvas')!.scrollTop, 85);
  assert.equal(second.pane(0).querySelector('.source-canvas')!.children.length, 1);
  assert.equal(second.pane(1).querySelector('.source-canvas')!.children.length, 1);
  assert.equal(second.pane(0).dataset.documentId, 'imslp-936721');
  assert.equal(second.pane(1).dataset.documentId, 'snortum-v0.4-no01');
});

test('a temporarily unmeasurable phone layout keeps both documents and does not advertise stale ink on return', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const original = h.pane(0), candidate = h.pane(1);
  h.action(0, 'next'); h.action(0, 'in');
  h.action(1, 'next'); h.action(1, 'in');
  await h.settled(original); await h.settled(candidate);
  const originalHost = original.querySelector('.source-canvas')!, candidateHost = candidate.querySelector('.source-canvas')!;
  originalHost.scrollTop = 110; candidateHost.scrollTop = 75;
  const originalCanvas = originalHost.children[0], candidateCanvas = candidateHost.children[0];
  const renders = [...h.renderCalls.values()].reduce((sum, count) => sum + count, 0);
  const preflights = h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length;

  // A rotation guard or transient hidden layout can leave panes unmeasurable.
  // Returning to the same effective fit must keep valid canvases and anchors.
  originalHost.clientWidth = 0; candidateHost.clientWidth = 0;
  await h.resize();
  await h.switchMobile('candidate'); await h.switchView('#reference');
  await h.switchView('#candidates'); await h.switchMobile('reference');
  originalHost.clientWidth = 600; candidateHost.clientWidth = 600;
  await h.resize();
  assert.equal(originalHost.children[0], originalCanvas);
  assert.equal(candidateHost.children[0], candidateCanvas);
  assert.equal(originalHost.scrollTop, 110);
  assert.equal(candidateHost.scrollTop, 75);
  assert.equal([...h.renderCalls.values()].reduce((sum, count) => sum + count, 0), renders);
  assert.equal(h.fetches.filter((url) => url.endsWith('/jbig2.wasm')).length, preflights);
  assert.match(original.querySelector('.source-page')!.textContent, /\b2\s*\/\s*37\b/);
  assert.match(candidate.querySelector('.source-zoom')!.textContent, /125%/);

  // A hidden pane may retain old pixels, but a newly selected document must
  // clear them synchronously before the new label becomes visible again.
  candidateHost.clientWidth = 0;
  candidate.querySelector('select')!.value = 'mutopia-1779-no01';
  candidate.querySelector('select')!.fire('change');
  await h.flush();
  candidateHost.clientWidth = 600;
  await h.resize();
  assert.equal(candidate.dataset.documentId, 'mutopia-1779-no01');
  assert.equal(candidate.dataset.renderState, 'loading');
  assert.equal(candidateHost.children.length, 0, 'no previous candidate pixels beneath the new document label');
  await h.resolveFetch('mutopia-1779-no01');
  assert.equal(candidate.dataset.renderState, 'ready');
  assert.equal(candidateHost.children.length, 1);
  assert.notEqual(candidateHost.children[0], candidateCanvas);
});

test('real pane width change refits the same page; pending old pixels are allowed only under matching identity', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  const left = h.pane(0), host = left.querySelector('.source-canvas')!;
  const original = host.children[0];
  const before = h.renderCalls.get('imslp-936721:1') ?? 0;
  const gate = deferred<void>(); h.renderGates.set('imslp-936721:1', gate);
  host.clientWidth = 430;
  await h.resize();
  await h.until(() => (h.renderCalls.get('imslp-936721:1') ?? 0) > before);
  assert.equal(left.dataset.documentId, 'imslp-936721');
  assert.match(left.querySelector('.source-page')!.textContent, /\b1\s*\/\s*37\b/);
  if (host.children.length) assert.equal(host.children[0], original, 'pending pixels must belong to the same document/page');
  gate.resolve(); await h.settled(left);
  assert.notEqual(host.children[0], original);
  assert.equal(host.children[0].style.width, '430px', 'the new width is fitted to the available pane');
  h.action(0, 'next');
  assert.equal(host.children.length, 0, 'a new page must never inherit the old image while its label changes');
});

test('mixed Schumann originals load only fixed URLs, recover from error and discard obsolete images', async () => {
  const h = await launch();
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  await h.switchWork('schumann-14');
  const left = h.pane(0), right = h.pane(1);
  assert.equal(left.dataset.documentId, 'schuberth-14');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  assert.equal(h.images[0].src, 'https://brahmsinstitut.de/Archiv/web/bihl_digital/schumann_drucke/abh_005_002_187_s_016.jpg');
  assert.match(left.querySelector('.source-edition')!.textContent, /Schuberth.*Henle fallback/);
  assert.match(left.querySelector('.source-page')!.textContent, /Printed p\. 16.*1\/2/);
  assert.match(right.querySelector('.source-page')!.textContent, /22\/92/);
  await h.resolveFetch('schumann-starter');
  h.images[0].onerror?.(); await h.flush();
  assert.equal(left.dataset.renderState, 'error');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  assert.match(left.querySelector('.source-status')!.textContent, /original image unavailable.*original source link/);
  assert.match(left.querySelector('.source-link')!.href, /_016\.jpg$/);
  assert.match(left.querySelector('.source-catalogue')!.href, /schum_op_068/);
  left.querySelector('select')!.fire('change');
  h.images[1].onload?.(); await h.flush();
  assert.equal(left.dataset.renderState, 'ready');
  h.action(0, 'next');
  assert.match(left.querySelector('.source-page')!.textContent, /Printed p\. 17.*2\/2/);
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  await h.switchWork('schumann-30');
  h.images[2].onload?.(); await h.flush(); // obsolete p17 event
  assert.equal(left.dataset.documentId, 'schuberth-30');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
  assert.match(h.images[3].src, /_038\.jpg$/);
  h.images[3].onload?.(); await h.flush();
  assert.match(left.querySelector('.source-page')!.textContent, /Printed p\. 38/);
  assert.equal(left.querySelector('.source-canvas')!.children.length, 1);
  h.action(0, 'next'); assert.match(h.images[4].src, /_039\.jpg$/);
  h.images[4].onload?.(); await h.flush();
  await h.switchWork('schumann-13');
  assert.match(h.images[5].src, /0045_0028/);
  h.images[5].onload?.(); await h.flush();
  h.action(0, 'next'); assert.match(h.images[6].src, /0045_0029/);
  h.images[6].onload?.(); await h.flush();
  await h.switchWork('schumann-43');
  assert.match(h.images[7].src, /0045_0073/);
  assert.match(right.querySelector('.source-page')!.textContent, /86\/92/);
  h.images[7].onload?.(); await h.flush();
  await h.switchWork('schumann-14');
  assert.match(left.querySelector('.source-page')!.textContent, /Printed p\. 17/);
  assert.match(right.querySelector('.source-page')!.textContent, /22\/92/);
});

test('source panes give a compact, accessible reading UI without success or provenance narration, even after rerender', async () => {
  const h = await launch();
  const left = h.pane(0), right = h.pane(1);
  for (const pane of [left, right]) {
    assert.match(pane.markup, /<label[^>]*>[^<]*Document\s*<select/i, 'document selector has a real label');
    const choices = pane.querySelector('select')!.children;
    assert.ok(choices.length >= 2, 'document A/B choice remains usable');
    for (const option of choices) {
      assert.ok(option.textContent.trim().length > 0 && option.textContent.length < 90, 'short human-readable option');
      assert.notEqual(option.textContent, option.value, 'the reader sees a title, not an internal ID');
    }
    assert.doesNotMatch(pane.markup, /source-provenance|source-info|rights|uncertainty|source-context/i);
    assert.match(pane.markup, /<[^>]*(?=[^>]*class="source-status")(?=[^>]*role="(?:status|alert)")[^>]*>/,
      'loading and failure have an assistive status outlet');
    assert.match(pane.markup, /data-action="reset"[^>]*>Fit</);
    for (const action of ['previous', 'next', 'out', 'in', 'reset']) {
      const button = pane.markup.match(new RegExp(`<button\\b(?=[^>]*data-action="${action}")[^>]*>[^<]*<\\/button>`, 'i'))?.[0];
      assert.ok(button && (/aria-label=/.test(button) || /title=/.test(button) || />\s*[A-Za-z]{2,}/.test(button)),
        `${action} has an accessible name, not just a symbol`);
    }
    assert.match(pane.querySelector('.source-status')!.textContent, /load/i, 'only pending work announces progress');
  }
  await h.resolveFetch('imslp-936721'); await h.resolveFetch('snortum-v0.4-no01');
  for (const pane of [left, right]) {
    assert.equal(pane.querySelector('.source-status')!.textContent.trim(), '', 'successful render needs no fidelity or telemetry paragraph');
    assert.match(pane.querySelector('.source-page')!.textContent, /\b1\s*\/\s*\d+\b/);
    assert.ok(pane.querySelector('.source-canvas')!.children.length, 'actual page ink remains');
  }
  assert.ok(SOURCE_DOCUMENTS['imslp-936721'].rights && SOURCE_DOCUMENTS['imslp-936721'].differences,
    'the underlying catalog still retains its source facts');
  h.action(0, 'next'); await h.settled(left);
  h.action(0, 'in'); await h.settled(left);
  assert.equal(left.querySelector('.source-status')!.textContent.trim(), '', 'page and zoom rerenders stay quiet on success');
  right.querySelector('select')!.value = 'mutopia-1779-no01'; right.querySelector('select')!.fire('change');
  assert.match(right.querySelector('.source-status')!.textContent, /load/i);
  await h.rejectFetch('mutopia-1779-no01');
  assert.equal(right.dataset.renderState, 'error');
  assert.match(right.querySelector('.source-status')!.textContent, /mutopia-1779-no01.*cache unavailable.*retry/i);
  assert.equal(left.querySelector('.source-status')!.textContent.trim(), '', 'an unrelated healthy pane stays quiet');
  right.querySelector('select')!.fire('change');
  await h.resolveFetch('mutopia-1779-no01');
  assert.equal(right.querySelector('.source-status')!.textContent.trim(), '', 'retry removes the old error and healthy narration');
  assert.doesNotMatch(right.markup, /source-provenance|source-info/i);
});
