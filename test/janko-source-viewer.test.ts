import { strict as assert } from 'node:assert';
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
      plugin.onResolve({ filter: /^pdfjs-dist$/ }, () => ({ path: 'pdfjs', namespace: 'fake' }));
      plugin.onResolve({ filter: /pdf\.worker\.min\.mjs\?url$/ }, () => ({ path: 'worker', namespace: 'fake' }));
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
  const fetches: string[] = [];
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
      const id = url.split('/').pop()!;
      fetches.push(id);
      const gate = deferred<object>(); pending.set(id, [...(pending.get(id) ?? []), gate]);
      return gate.promise;
    },
    __pdfDocument: ({ data }: { data: Uint8Array }) => {
      const id = new TextDecoder().decode(data);
      const doc = {
        numPages: SOURCE_DOCUMENTS[id as keyof typeof SOURCE_DOCUMENTS].pages,
        destroy: async () => undefined,
        getPage: (page: number) => pageGates.get(`${id}:${page}`)?.promise ?? Promise.resolve({
          getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
          render: () => ({ promise: Promise.resolve(), cancel: () => undefined }),
        }),
      };
      return { promise: Promise.resolve(doc) };
    },
    TextDecoder, Uint8Array, setTimeout, clearTimeout,
  };
  runInNewContext(bundle.outputFiles[0].text, context);
  const flush = async () => { for (let i = 0; i < 15; i++) await new Promise((r) => setImmediate(r)); };
  const resolveFetch = async (id: string) => {
    const gate = pending.get(id)?.shift();
    assert.ok(gate, `pending fetch for ${id}`);
    gate.resolve({ ok: true, headers: { get: () => 'application/pdf' }, arrayBuffer: async () => new TextEncoder().encode(id).buffer });
    await flush();
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
  return { root, prepared, grid, storage, fetches, pageGates, pane, action, resolveFetch, rejectFetch, flush };
}

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
