import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { SOURCE_DOCUMENTS, SOURCE_IMAGES, WORKS, isImage, pageCount, type PdfId, type SourceDocumentId, type WorkId } from './documents';
import { choiceKey, currentChoice, initialChoices, restoreChoices, selectDocument, selectWork, setPage, setZoom, STORAGE_KEY, type SourceChoices } from './session';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
const endpoint = (id: PdfId) => `/@janko-source-pdf/${id}`;
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
      const choice = key.slice(0, separator);
      const id = choice.split(':').at(-1) as SourceDocumentId;
      const page = Number(key.slice(separator + 1));
      if (Object.hasOwn(initialChoices().pages, choice) && Number.isInteger(page) && page >= 1 && page <= pageCount(id) &&
          typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1000) scrollPlaces[key] = value;
    }
  }
} catch { /* corrupt or blocked session storage */ }
const placeKey = (id: string, page: number) => `${id}:${page}`;
const persistPlaces = () => { try { sessionStorage.setItem(SCROLL_KEY, JSON.stringify(scrollPlaces)); } catch { /* private session */ } };
const loaded = new Map<PdfId, Promise<pdfjs.PDFDocumentProxy>>();
function load(id: PdfId): Promise<pdfjs.PDFDocumentProxy> {
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
interface Pane { container: HTMLElement; page: HTMLElement; zoom: HTMLElement; status: HTMLElement; canvasHost: HTMLElement; select: HTMLSelectElement; edition: HTMLElement; link: HTMLAnchorElement; catalogue: HTMLAnchorElement; serial: number; render?: pdfjs.RenderTask; key?: string; pixels?: { id: SourceDocumentId; page: number; width: number; work: WorkId } }
const panes = {} as Record<Role, Pane>;
const workLabel = document.createElement('label');
workLabel.textContent = 'Work ';
const workSelect = document.createElement('select'); workSelect.className = 'source-work';
for (const [id, work] of Object.entries(WORKS)) { const option = document.createElement('option'); option.value = id; option.textContent = work.label; workSelect.append(option); }
workSelect.value = state.work;
workLabel.append(workSelect);
root.insertBefore(workLabel, root.querySelector('.source-grid'));
workSelect.addEventListener('change', () => {
  rememberPlace('reference'); rememberPlace('candidate');
  selectWork(state, workSelect.value as WorkId); persist();
  void render('reference'); void render('candidate');
});
for (const role of ['reference', 'candidate'] as const) {
  const container = document.createElement('section'); container.className = `source-pane source-${role}`;
  container.setAttribute('aria-label', role === 'reference' ? 'Original scan' : 'Published transcription');
  container.innerHTML = `<h3>${role === 'reference' ? 'Original scan' : 'Published PDF'}</h3>
    <label>Document <select class="source-select"></select></label>
    <div class="source-controls"><button data-action="previous" aria-label="Previous PDF page">◀</button>
    <span class="source-page"></span><button data-action="next" aria-label="Next PDF page">▶</button>
    <button data-action="out" aria-label="Zoom out">−</button><span class="source-zoom"></span>
    <button data-action="in" aria-label="Zoom in">+</button><button data-action="reset">Fit</button></div>
    <p class="source-edition"></p><a class="source-link" target="_blank" rel="noopener noreferrer">Original page ↗</a>
    <a class="source-catalogue" target="_blank" rel="noopener noreferrer">Publisher / archive catalogue ↗</a>
    <div class="source-canvas"></div><p class="source-status" role="status"></p>`;
  root.querySelector('.source-grid')!.append(container);
  const select = container.querySelector('select')!;
  panes[role] = { container, select, edition: container.querySelector('.source-edition')!, link: container.querySelector('.source-link')!, catalogue: container.querySelector('.source-catalogue')!, page: container.querySelector('.source-page')!, zoom: container.querySelector('.source-zoom')!, status: container.querySelector('.source-status')!, canvasHost: container.querySelector('.source-canvas')!, serial: 0 };
  select.addEventListener('change', () => { rememberPlace(role); selectDocument(state, role, select.value as SourceDocumentId); persist(); void render(role); });
  container.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', () => {
    rememberPlace(role);
    const id = state[role], choice = currentChoice(state, id);
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
  scrollPlaces[placeKey(choiceKey(pane.pixels.work, pane.pixels.id), pane.pixels.page)] = pane.canvasHost.scrollTop / pane.pixels.width;
  window.clearTimeout(scrollTimer);
  scrollTimer = window.setTimeout(persistPlaces, 200);
}
for (const role of ['reference', 'candidate'] as const) panes[role].canvasHost.addEventListener('scroll', () => rememberPlace(role));
window.addEventListener('pagehide', () => { rememberPlace('reference'); rememberPlace('candidate'); persistPlaces(); });

async function render(role: Role): Promise<void> {
  const pane = panes[role];
  // A hidden pane has no measurable fit. Its last valid canvas is retained and
  // checked against its actual width when made visible again.
  if (root.hidden || pane.canvasHost.clientWidth <= 0) {
    const current = `${state.work}:${state[role]}:${currentChoice(state, state[role]).page}:`;
    if (pane.key && !pane.key.startsWith(current)) {
      pane.serial++; pane.render?.cancel(); pane.render = undefined;
      pane.key = undefined; pane.pixels = undefined; pane.canvasHost.replaceChildren();
      pane.container.dataset.renderState = 'loading';
    }
    return;
  }
  const id = state[role], work = state.work, doc = isImage(id) ? SOURCE_IMAGES[id] : SOURCE_DOCUMENTS[id];
  const { page, zoom } = currentChoice(state, id);
  const width = pane.canvasHost.clientWidth;
  const key = `${work}:${id}:${page}:${zoom}:${width}`;
  if (key === pane.key && pane.container.dataset.renderState !== 'error') return;
  const serial = ++pane.serial;
  pane.key = key;
  pane.render?.cancel(); pane.render = undefined;
  // Only a same-document/page fit change may retain old pixels while work is
  // pending. A new label or a failed attempt must never inherit prior ink.
  const oldPixels = pane.pixels;
  const retain = oldPixels?.id === id && oldPixels.page === page && oldPixels.work === work && pane.container.dataset.renderState !== 'error';
  if (!retain) { pane.canvasHost.replaceChildren(); pane.pixels = undefined; }
  pane.select.replaceChildren();
  for (const allowed of WORKS[work][role]) {
    const opt = document.createElement('option'); opt.value = allowed;
    opt.textContent = isImage(allowed) ? SOURCE_IMAGES[allowed].edition : role === 'reference' ? SOURCE_DOCUMENTS[allowed].version : SOURCE_DOCUMENTS[allowed].edition;
    pane.select.append(opt);
  }
  pane.select.value = id;
  pane.edition.textContent = `${WORKS[work].label} · ${doc.edition}${isImage(id) ? ' · Original host preview; availability does not grant reproduction rights.' : id === 'schumann-starter' ? ' · Philippe Hardy / Phil Hézaine attribution relationship unverified; 2012 Free Art License announcement. Not certified against Henle or the first issue.' : id === 'kinderszenen-v70' ? ' · CC BY-NC-SA 4.0 claimed; rights not independently cleared. Not certified against Henle HN 44.' : ''}`;
  pane.link.href = isImage(id) ? SOURCE_IMAGES[id].pages[page - 1].url : SOURCE_DOCUMENTS[id].url;
  pane.link.textContent = isImage(id) ? 'Original page ↗' : 'Published PDF ↗';
  pane.catalogue.hidden = !isImage(id);
  if (isImage(id)) pane.catalogue.href = SOURCE_IMAGES[id].source;
  const imagePage = isImage(id) ? SOURCE_IMAGES[id].pages[page - 1] : undefined;
  pane.page.textContent = imagePage ? `Printed p. ${imagePage.folio}${'frame' in imagePage ? ` · preview frame ${imagePage.frame}` : ''} · ${page}/${pageCount(id)}` : `${page}/${pageCount(id)}`;
  pane.zoom.textContent = `${Math.round(zoom * 100)}%`;
  pane.container.dataset.documentId = id;
  pane.container.dataset.renderState = 'loading';
  pane.status.textContent = `Loading ${doc.title}, page ${page}…`;
  try {
    if (isImage(id)) {
      const image = document.createElement('img');
      const source = SOURCE_IMAGES[id].pages[page - 1];
      image.alt = `${doc.title}, original printed page ${source.folio}`;
      // Load privately before committing ink; obsolete events cannot replace a newer selection.
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('original image unavailable'));
        image.src = source.url;
      });
      if (serial !== pane.serial) return;
      const anchor = retain && oldPixels ? pane.canvasHost.scrollTop / oldPixels.width : scrollPlaces[placeKey(choiceKey(work, id), page)] ?? 0;
      image.style.width = `${width * zoom}px`;
      image.style.height = 'auto';
      image.style.display = 'block';
      pane.canvasHost.replaceChildren(image);
      pane.canvasHost.scrollTop = anchor * width;
      pane.pixels = { id, page, width, work };
      pane.container.dataset.renderState = 'ready';
      pane.status.textContent = '';
      return;
    }
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
    const anchor = retain && oldPixels ? pane.canvasHost.scrollTop / oldPixels.width : scrollPlaces[placeKey(choiceKey(work, id), page)] ?? 0;
    pane.canvasHost.replaceChildren(canvas);
    pane.canvasHost.scrollTop = anchor * width;
    pane.pixels = { id, page, width, work };
    pane.render = undefined;
    pane.container.dataset.renderState = 'ready';
    pane.status.textContent = '';
  } catch (error) {
    if (serial !== pane.serial) return;
    pane.render = undefined;
    pane.pixels = undefined;
    pane.canvasHost.replaceChildren();
    pane.container.dataset.renderState = 'error';
    pane.status.textContent = `${id}: could not load ${isImage(id) ? 'original image' : 'PDF page'} ${page}: ${error instanceof Error ? error.message : String(error)}. Open the original source link or retry by selecting this document again${isImage(id) ? '' : ' after checking the approved local cache'}.`;
  }
}
function updateSurface(): void {
  const sourceActive = location.hash !== '#reference' && mode === 'source';
  if (sourceActive && !prepared.hidden) window.dispatchEvent?.(new Event('janko-before-surface-hide'));
  root.hidden = !sourceActive;
  prepared.hidden = sourceActive;
  if (!sourceActive) window.dispatchEvent?.(new Event('janko-surface-show'));
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
document.querySelectorAll<HTMLButtonElement>('[data-mobile-pane]').forEach((button) => button.addEventListener('click', () => {
  rememberPlace(state.mobilePane);
  state.mobilePane = button.dataset.mobilePane as Role; persist(); updateMobile(); void render(state.mobilePane);
}));
function updateMobile(): void {
  root.dataset.mobilePane = state.mobilePane;
  document.querySelectorAll<HTMLButtonElement>('[data-mobile-pane]').forEach((button) => {
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
