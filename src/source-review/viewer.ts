import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { CANDIDATE_IDS, REFERENCE_IDS, SOURCE_DOCUMENTS, type SourceDocumentId } from './documents';
import { initialChoices, restoreChoices, selectDocument, setPage, setZoom, STORAGE_KEY, type SourceChoices } from './session';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const endpoint = (id: SourceDocumentId) => `/@janko-source-pdf/${id}`;
const decoderUrl = () => import.meta.env.DEV
  ? '/@janko-pdfjs-wasm/'
  : new URL('./assets/source-pdf-decoder/', document.baseURI).href;
const root = document.getElementById('source-review')!;
const prepared = document.getElementById('janko-studio')!;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-candidates-mode]'));
let state: SourceChoices;
try { state = restoreChoices(sessionStorage.getItem(STORAGE_KEY)); }
catch { state = initialChoices(); }
let mode: 'source' | 'engraving' = 'source';
try { if (sessionStorage.getItem('janko-candidates-mode') === 'engraving') mode = 'engraving'; } catch { /* private session */ }
if (!import.meta.env.DEV) {
  mode = 'engraving';
  const sourceButton = modeButtons.find((button) => button.dataset.candidatesMode === 'source');
  if (sourceButton) { sourceButton.disabled = true; sourceButton.title = 'Local source PDFs are available only in the development studio'; sourceButton.textContent = 'Source PDFs (local dev only)'; }
}
const persist = () => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private session */ } };
// A page's reading place is independent of the A/B choice. Store its vertical
// anchor relative to the fitted pane width, so a reload or orientation refit
// returns to approximately the same portion of the document.
const SCROLL_KEY = 'janko-source-scroll-v1';
const scrollPlaces: Record<string, number> = {};
try {
  const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? '{}');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const [key, value] of Object.entries(saved)) {
      const separator = key.lastIndexOf(':');
      const id = key.slice(0, separator) as SourceDocumentId;
      const page = Number(key.slice(separator + 1));
      if (Object.hasOwn(SOURCE_DOCUMENTS, id) && Number.isInteger(page) && page >= 1 && page <= SOURCE_DOCUMENTS[id].pages &&
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000) scrollPlaces[key] = value;
    }
  }
} catch { /* corrupt or blocked session storage */ }
const placeKey = (id: SourceDocumentId, page: number) => `${id}:${page}`;
const persistPlaces = () => { try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPlaces)); } catch { /* private session */ } };
const loaded = new Map<SourceDocumentId, Promise<pdfjs.PDFDocumentProxy>>();
function load(id: SourceDocumentId): Promise<pdfjs.PDFDocumentProxy> {
  let task = loaded.get(id);
  if (!task) {
    task = (async () => {
      const response = await fetch(endpoint(id), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      if (!response.headers.get('content-type')?.startsWith('application/pdf')) throw new Error('not a PDF response');
      const bytes = new Uint8Array(await response.arrayBuffer());
      // PDF.js resolves JBIG2/OpenJPEG/QCMS resources against this directory in
      // its worker. Strict parsing rejects parse failures where PDF.js supports
      // them; asynchronous image errors additionally need the resource check below.
      const doc = await pdfjs.getDocument({ data: bytes, wasmUrl: decoderUrl(), stopAtErrors: true }).promise;
      if (doc.numPages !== SOURCE_DOCUMENTS[id].pages) { await doc.destroy(); throw new Error('PDF page count mismatch'); }
      return doc;
    })();
    loaded.set(id, task);
    void task.catch(() => { if (loaded.get(id) === task) loaded.delete(id); }); // allow a retry after a missing/failed PDF
  }
  return task;
}

// PDF.js 5.7 catches asynchronous image decoder failures even with
// stopAtErrors and resolves RenderTask with an empty image. For the approved
// scanned references, verify that at least one local JBIG2 decoder path is
// viable before reporting the page ready. A failed check is retried on the
// next render (no poisoned resource cache); the JS fallback is legitimate when
// WebAssembly is unavailable. This is NOT a blank-page/ink-density check.
async function checkScanDecoder(wasmUrl: string): Promise<void> {
  try {
    const response = await fetch(`${wasmUrl}jbig2.wasm`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`JBIG2 wasm HTTP ${response.status}`);
    await WebAssembly.compile(await response.arrayBuffer());
    return;
  } catch {
    try {
      const fallback = await import(/* @vite-ignore */ `${wasmUrl}jbig2_nowasm_fallback.js`);
      if (typeof fallback.default === 'function') return;
    } catch { /* neither local decoder path is usable */ }
    throw new Error('local JBIG2 decoder unavailable (wasm and fallback); retry after restoring decoder resources');
  }
}

type Role = 'reference' | 'candidate';
interface Pane { container: HTMLElement; info: HTMLElement; page: HTMLElement; zoom: HTMLElement; status: HTMLElement; canvasHost: HTMLElement; select: HTMLSelectElement; serial: number; render?: pdfjs.RenderTask; key?: string; pixels?: { id: SourceDocumentId; page: number; width: number } }
const panes = {} as Record<Role, Pane>;
for (const role of ['reference', 'candidate'] as const) {
  const container = document.createElement('section'); container.className = `source-pane source-${role}`;
  container.setAttribute('aria-label', role === 'reference' ? 'Original scan' : 'Published transcription');
  container.innerHTML = `<h3>${role === 'reference' ? 'Original scan · provisional reference' : 'Published PDF A/B'}</h3>
    <label>Document <select class="source-select"></select></label>
    <div class="source-controls"><button data-action="previous" aria-label="Previous PDF page">◀</button>
    <span class="source-page"></span><button data-action="next" aria-label="Next PDF page">▶</button>
    <button data-action="out" aria-label="Zoom out">−</button><span class="source-zoom"></span>
    <button data-action="in" aria-label="Zoom in">+</button><button data-action="reset">Fit</button></div>
    <div class="source-canvas"></div><p class="source-status" role="status"></p><details class="source-provenance"><summary>Publication, rights &amp; uncertainty</summary><div class="source-info"></div></details>`;
  root.querySelector('.source-grid')!.append(container);
  const select = container.querySelector('select')!;
  for (const id of role === 'reference' ? REFERENCE_IDS : CANDIDATE_IDS) {
    const opt = document.createElement('option'); opt.value = id;
    opt.textContent = role === 'reference' ? SOURCE_DOCUMENTS[id].version : SOURCE_DOCUMENTS[id].edition;
    select.append(opt);
  }
  panes[role] = { container, select, info: container.querySelector('.source-info')!, page: container.querySelector('.source-page')!, zoom: container.querySelector('.source-zoom')!, status: container.querySelector('.source-status')!, canvasHost: container.querySelector('.source-canvas')!, serial: 0 };
  select.addEventListener('change', () => { rememberPlace(role); selectDocument(state, role, select.value as SourceDocumentId); persist(); void render(role); });
  container.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => {
    rememberPlace(role);
    const id = state[role], choice = state.pages[id];
    switch (button.dataset.action) {
      case 'previous': setPage(state, id, choice.page - 1); break;
      case 'next': setPage(state, id, choice.page + 1); break;
      case 'out': setZoom(state, id, choice.zoom - 0.25); break;
      case 'in': setZoom(state, id, choice.zoom + 0.25); break;
      case 'reset': setZoom(state, id, 1); break;
    }
    persist(); void render(role);
  }));
}

let scrollTimer: number | undefined;
function rememberPlace(role: Role): void {
  const pane = panes[role];
  if (pane.container.dataset.renderState !== 'ready' || !pane.pixels || pane.canvasHost.clientWidth <= 0) return;
  scrollPlaces[placeKey(pane.pixels.id, pane.pixels.page)] = pane.canvasHost.scrollTop / pane.pixels.width;
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(persistPlaces, 200);
}
for (const role of ['reference', 'candidate'] as const) panes[role].canvasHost.addEventListener('scroll', () => rememberPlace(role));
window.addEventListener('pagehide', () => { rememberPlace('reference'); rememberPlace('candidate'); persistPlaces(); });

async function render(role: Role): Promise<void> {
  const pane = panes[role];
  // A hidden pane has no measurable fit. Its last valid canvas is retained and
  // checked against its actual width when made visible again.
  if (root.hidden || pane.canvasHost.clientWidth <= 0) return;
  const id = state[role], doc = SOURCE_DOCUMENTS[id], { page, zoom } = state.pages[id];
  const width = pane.canvasHost.clientWidth;
  const key = `${id}:${page}:${zoom}:${width}`;
  if (key === pane.key && pane.container.dataset.renderState !== 'error') return;
  const serial = ++pane.serial;
  pane.key = key;
  pane.render?.cancel(); pane.render = undefined;
  // Only a same-document/page fit change may retain old pixels while work is
  // pending. A new label or a failed attempt must never inherit prior ink.
  const oldPixels = pane.pixels;
  const retain = oldPixels?.id === id && oldPixels.page === page && pane.container.dataset.renderState !== 'error';
  if (!retain) { pane.canvasHost.replaceChildren(); pane.pixels = undefined; }
  pane.select.value = id;
  pane.info.replaceChildren();
  const heading = document.createElement('strong'); heading.textContent = doc.title;
  const edition = document.createElement('p'); edition.textContent = `${doc.edition} · ${doc.version}`;
  const link = document.createElement('a'); link.href = doc.url; link.textContent = 'Direct published PDF / source URL'; link.target = '_blank'; link.rel = 'noopener noreferrer';
  const rights = document.createElement('p'); rights.textContent = `Access/rights claim: ${doc.rights}`;
  const differences = document.createElement('p'); differences.textContent = `Known differences/uncertainty: ${doc.differences}`;
  pane.info.append(heading, edition, link, rights, differences);
  pane.page.textContent = `PDF page ${page} of ${doc.pages}`;
  pane.zoom.textContent = `${Math.round(zoom * 100)}%`;
  pane.container.dataset.documentId = id;
  pane.container.dataset.renderState = 'loading';
  pane.status.textContent = `Loading ${id}, PDF page ${page}…`;
  try {
    const pdf = await load(id);
    if (serial !== pane.serial) return;
    const pdfPage = await pdf.getPage(page);
    if (serial !== pane.serial) return;
    if (role === 'reference') {
      await checkScanDecoder(decoderUrl());
      if (serial !== pane.serial) return;
    }
    // 100% fits one full page to the pane's width; each pane then zooms independently.
    const natural = pdfPage.getViewport({ scale: 1 });
    const fit = width / natural.width;
    const viewport = pdfPage.getViewport({ scale: zoom * fit });
    const canvas = document.createElement('canvas');
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.ceil(viewport.width * scale); canvas.height = Math.ceil(viewport.height * scale);
    canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
    canvas.setAttribute('aria-label', `${id}, PDF page ${page} of ${pdf.numPages}`);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D unavailable');
    const renderTask = pdfPage.render({ canvasContext: context, canvas, viewport, transform: [scale, 0, 0, scale, 0, 0] });
    pane.render = renderTask;
    await renderTask.promise;
    if (serial !== pane.serial) return;
    // Keep the reader near the same point on the page after a real refit.
    const anchor = retain && oldPixels ? pane.canvasHost.scrollTop / oldPixels.width : scrollPlaces[placeKey(id, page)] ?? 0;
    pane.canvasHost.replaceChildren(canvas);
    pane.canvasHost.scrollTop = anchor * width;
    pane.pixels = { id, page, width };
    pane.render = undefined;
    pane.container.dataset.renderState = 'ready';
    pane.status.textContent = `${id}: PDF page ${page} of ${pdf.numPages} drawn (${role === 'reference' ? 'local JBIG2 decoder path checked; ' : ''}image fidelity not certified). Printed page and measures are not aligned across documents.`;
  } catch (error) {
    if (serial !== pane.serial) return;
    pane.render = undefined;
    pane.pixels = undefined;
    pane.canvasHost.replaceChildren();
    pane.container.dataset.renderState = 'error';
    pane.status.textContent = `${id}: could not render PDF page ${page}: ${error instanceof Error ? error.message : String(error)}. Check the approved local cache and retry by selecting this document again.`;
  }
}
function updateSurface(): void {
  const sourceActive = location.hash !== '#reference' && mode === 'source';
  root.hidden = !sourceActive;
  prepared.hidden = sourceActive;
  const switcher = document.querySelector<HTMLElement>('.source-mode-switch');
  if (switcher) switcher.hidden = location.hash === '#reference';
  document.body.classList.toggle('source-mode', sourceActive);
  modeButtons.forEach((button) => { button.classList.toggle('is-active', button.dataset.candidatesMode === mode); button.setAttribute('aria-pressed', String(button.dataset.candidatesMode === mode)); });
  if (sourceActive) { void render('reference'); void render('candidate'); }
}
modeButtons.forEach((button) => button.addEventListener('click', () => {
  rememberPlace('reference'); rememberPlace('candidate');
  mode = !import.meta.env.DEV || button.dataset.candidatesMode === 'engraving' ? 'engraving' : 'source';
  try { sessionStorage.setItem('janko-candidates-mode', mode); } catch { /* private session */ }
  if (location.hash === '#reference') location.hash = '#candidates';
  updateSurface();
}));
root.querySelectorAll<HTMLButtonElement>('[data-mobile-pane]').forEach((button) => button.addEventListener('click', () => {
  rememberPlace(state.mobilePane);
  state.mobilePane = button.dataset.mobilePane as Role; persist(); updateMobile(); void render(state.mobilePane);
}));
function updateMobile(): void {
  root.dataset.mobilePane = state.mobilePane;
  root.querySelectorAll<HTMLButtonElement>('[data-mobile-pane]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.mobilePane === state.mobilePane));
  });
}
window.addEventListener('hashchange', updateSurface);
let resizeTimer: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (root.hidden) return;
    void render('reference'); void render('candidate');
  }, 150);
});
updateMobile(); updateSurface();
