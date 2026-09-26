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
  href = ''; target = ''; rel = '';
  clientWidth = 600;
  width = 0; height = 0;
  style: Record<string, string> = {};
  children: Element[] = [];
  private entries = new Map<string, Element>();
  private events = new Map<string, Array<() => void>>();
  classList = { toggle: (_name: string, _active: boolean) => undefined };
  constructor(public tag = 'div') {}
  set innerHTML(html: string) {
    // Model the fixed pane template's controls as DOM children, not its PDF content.
    if (!html.includes('source-controls')) return;
    for (const name of ['source-select', 'source-info', 'source-page', 'source-zoom', 'source-status', 'source-canvas']) {
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
  replaceChildren(...nodes: Element[]): void { this.children = nodes; }
  setAttribute(_name: string, _value: string): void {}
  addEventListener(type: string, callback: () => void): void { this.events.set(type, [...(this.events.get(type) ?? []), callback]); }
  fire(type: string): void { for (const callback of this.events.get(type) ?? []) callback(); }
  getContext(_kind: string): object { return {}; }
}

async function launch() {
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
  const prepared = new Element();
  const switcher = new Element();
  const modeButtons = ['source', 'engraving'].map((mode) => {
    const button = new Element('button'); button.dataset.candidatesMode = mode; return button;
  });
  const storage = new Map<string, string>();
  const pending = new Map<string, Array<ReturnType<typeof deferred<object>>>>();
  const pageGates = new Map<string, ReturnType<typeof deferred<object>>>();
  const renderGates = new Map<string, ReturnType<typeof deferred<void>>>();
  const renderCalls = new Map<string, number>();
  const documentOptions: Array<Record<string, unknown>> = [];
  const fetches: string[] = [];
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
      createElement: (tag: string) => new Element(tag),
      querySelector: (selector: string) => selector === '.source-mode-switch' ? switcher : null,
      querySelectorAll: (selector: string) => selector === '[data-candidates-mode]' ? modeButtons : [],
      body: { classList: { toggle: () => undefined } },
    },
    location: { hash: '#candidates' },
    sessionStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value); } },
    window: { devicePixelRatio: 1, addEventListener: () => undefined, clearTimeout, setTimeout },
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
  const action = (index: number, name: string) => {
    const button = pane(index).querySelectorAll('[data-action]').find((entry) => entry.dataset.action === name);
    assert.ok(button); button.fire('click');
  };
  return { root, prepared, grid, storage, fetches, decoder, pageGates, renderGates, renderCalls, documentOptions, pane, action, resolveFetch, rejectFetch, flush, settled, until };
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
    h.action(0, 'in'); await h.flush();
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
  h.action(0, 'in'); await h.flush();
  assert.equal(left.dataset.renderState, 'loading');
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0);
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
  assert.match(left.querySelector('.source-page')!.textContent, /page 2 of 37/);
  assert.match(right.querySelector('.source-page')!.textContent, /page 2 of 2/);

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
  assert.match(right.querySelector('.source-page')!.textContent, /page 1 of 1/);
  lateA.resolve({ getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }), render: () => ({ promise: Promise.resolve(), cancel: () => undefined }) });
  await h.flush();
  assert.equal(right.dataset.documentId, b);
  assert.equal(right.querySelector('.source-canvas')!.children.length, 1, 'obsolete A completion cannot replace B pixels');
  assert.match(left.querySelector('.source-page')!.textContent, /page 2 of 37/, 'right switches do not change left');
  right.querySelector('select')!.value = a; right.querySelector('select')!.fire('change');
  await h.flush();
  assert.match(right.querySelector('.source-page')!.textContent, /page 2 of 2/);
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
  assert.equal(left.querySelector('.source-canvas')!.children.length, 0, 'old canvas removed before attempting a new render');
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
