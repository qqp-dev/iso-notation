import { SOURCE_IMAGES, SCHUMANN_NO13_ENDING_CITATION as citation } from './documents';
import { updateStudioNavigation } from '../render/janko/prepared/viewer-dom';
import { readStudioState, type StudioSessionHost } from '../render/janko/studio-session';
import { cloneComparisonSvg, comparisonReadings } from './prepared-comparison';

const root = document.getElementById('source-review')!;
const prepared = document.getElementById('janko-studio')!;
const grid = root.querySelector('.source-grid')!;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-studio-mode]'));
const imageDocument = SOURCE_IMAGES[citation.reference];
const page = imageDocument.pages.find(page => page.folio === citation.folio)!;
let mode: 'source' | 'engraving' = 'engraving';
try { if (sessionStorage.getItem('janko-candidates-mode') === 'source') mode = 'source'; } catch { /* private session */ }
// Separate from development PDF choices: no migration or deletion of saved work.
const STORAGE_KEY = 'janko-published-comparison-v1';
let readingId = 'joint-compact';
let mobilePane: 'reference' | 'candidate' = 'reference';
const zoom = { reference: 1, candidate: 1 };
try {
  const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}');
  if (typeof saved.readingId === 'string') readingId = saved.readingId;
  if (saved.mobilePane === 'candidate') mobilePane = 'candidate';
  for (const role of ['reference', 'candidate'] as const) {
    if (Number.isFinite(saved.zoom?.[role])) zoom[role] = Math.max(.5, Math.min(3, saved.zoom[role]));
  }
} catch { /* blocked or invalid storage */ }
const persist = () => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ readingId, mobilePane, zoom })); } catch { /* private session */ } };
const work = document.querySelector<HTMLSelectElement>('.source-work')!;
const workOption = document.createElement('option'); workOption.textContent = 'Schumann · Op. 68 No. 13'; workOption.value = 'schumann-13'; work.append(workOption);
work.disabled = true;
const roles = ['reference', 'candidate'] as const;
const panes = Object.fromEntries(roles.map(role => {
  const container = document.createElement('section'); container.className = `source-pane source-${role}`;
  container.setAttribute('aria-label', role === 'reference' ? 'Original Henle score' : 'ISO engraving');
  container.innerHTML = `<div class="source-identity"><strong class="source-identity-label"></strong><span class="source-page"></span>
    <details class="source-details"><summary>Details</summary><div class="source-details-content"><p class="source-edition"></p><a class="source-link" target="_blank" rel="noopener noreferrer">Original page ↗</a><a class="source-catalogue" target="_blank" rel="noopener noreferrer">Henle edition ↗</a></div></details></div>
    ${role === 'candidate' ? '<label class="comparison-reading">ISO reading <select aria-label="ISO reading"></select></label>' : ''}
    <div class="source-controls"><button data-action="out" aria-label="Zoom out">−</button><span class="source-zoom"></span><button data-action="in" aria-label="Zoom in">+</button><button data-action="reset" aria-label="Fit page">Fit</button></div>
    <div class="source-canvas"></div><p class="source-status" role="status"></p>`;
  grid.append(container);
  container.querySelector<HTMLElement>('.source-identity-label')!.textContent = role === 'reference' ? 'Original · Henle HN 45' : 'ISO · Schumann No. 13';
  container.querySelector<HTMLElement>('.source-page')!.textContent = role === 'reference' ? 'Printed p. 15 · mm. 35–36' : 'Internal 38–40 · split ending / fp pickup';
  container.querySelector<HTMLElement>('.source-edition')!.textContent = `${imageDocument.edition}. ${citation.caption}`;
  container.querySelector<HTMLAnchorElement>('.source-link')!.href = page.url;
  container.querySelector<HTMLAnchorElement>('.source-catalogue')!.href = imageDocument.source;
  for (const button of container.querySelectorAll<HTMLButtonElement>('[data-action]')) button.addEventListener('click', () => {
    zoom[role] = button.dataset.action === 'reset' ? 1 : Math.max(.5, Math.min(3, zoom[role] + (button.dataset.action === 'in' ? .25 : -.25)));
    persist(); fit(role);
  });
  return [role, { container, host: container.querySelector<HTMLElement>('.source-canvas')!, status: container.querySelector<HTMLElement>('.source-status')! }];
})) as Record<typeof roles[number], { container: HTMLElement; host: HTMLElement; status: HTMLElement }>;
const select = panes.candidate.container.querySelector<HTMLSelectElement>('select')!;
let copiedOriginal: SVGSVGElement | undefined;
let copiedId: string | undefined;
function syncInk(): void {
  const readings = comparisonReadings(prepared);
  const selected = readings.find(reading => reading.id === readingId);
  // An obsolete saved choice is retained, but never silently mapped to new ink.
  const options = readings.map(reading => [reading.id, reading.label]);
  if (!selected) options.unshift([readingId, `Unavailable reading · ${readingId}`]);
  const key = JSON.stringify(options);
  if (select.dataset.options !== key) {
    select.replaceChildren(...options.map(([id, label]) => { const option = document.createElement('option'); option.value = id; option.textContent = label; return option; }));
    select.dataset.options = key;
  }
  select.value = readingId;
  if (!selected) {
    panes.candidate.host.replaceChildren(); copiedOriginal = undefined; copiedId = undefined;
    panes.candidate.container.dataset.renderState = 'unavailable';
    panes.candidate.status.textContent = prepared.dataset.preparedState === 'ready' ? 'This saved reading is unavailable. Select a current reading above.' : 'Waiting for the current ISO engraving…';
    return;
  }
  if (copiedOriginal !== selected.svg || copiedId !== readingId) {
    const svg = cloneComparisonSvg(selected.svg, 'source-comparison');
    svg.setAttribute('aria-label', `${selected.label}, Schumann No. 13, internal 38–40`);
    panes.candidate.host.replaceChildren(svg); copiedOriginal = selected.svg; copiedId = readingId;
  }
  panes.candidate.container.dataset.readingId = readingId;
  panes.candidate.container.dataset.renderState = 'ready'; panes.candidate.status.textContent = '';
  fit('candidate');
}
select.addEventListener('change', () => { readingId = select.value; persist(); syncInk(); });
let image: HTMLImageElement | undefined;
function loadOriginal(): void {
  if (image) return;
  image = document.createElement('img'); image.alt = `${citation.work}, Henle HN 45, printed folio 15`;
  panes.reference.container.dataset.renderState = 'loading'; panes.reference.status.textContent = 'Loading Henle’s public preview…';
  image.onload = () => { retry.hidden = true; panes.reference.container.dataset.renderState = 'ready'; panes.reference.status.textContent = ''; fit('reference'); };
  image.onerror = () => { retry.hidden = false; panes.reference.container.dataset.renderState = 'error'; panes.reference.status.textContent = 'Henle’s public preview is unavailable. Open the original page above, or use Retry.'; image = undefined; };
  image.src = page.url; panes.reference.host.replaceChildren(image);
}
const retry = document.createElement('button'); retry.hidden = true; retry.textContent = 'Retry'; retry.dataset.action = 'retry'; retry.addEventListener('click', loadOriginal);
panes.reference.container.querySelector('.source-controls')!.append(retry);
function fit(role: typeof roles[number]): void {
  const pane = panes[role]; pane.container.querySelector('.source-zoom')!.textContent = `${Math.round(zoom[role]*100)}%`;
  const ink = pane.host.firstElementChild as SVGSVGElement | HTMLImageElement | null;
  if (!ink || pane.host.clientWidth <= 0) return;
  ink.style.width = `${pane.host.clientWidth*zoom[role]}px`; ink.style.height = 'auto'; ink.style.display = 'block'; ink.style.maxWidth = 'none';
}
function updateMobile(): void {
  root.dataset.mobilePane = mobilePane;
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-mobile-pane]')) {
    const active = button.dataset.mobilePane === mobilePane; button.setAttribute('aria-pressed', String(active));
    if (button.dataset.mobilePane === 'candidate') { button.setAttribute('aria-label', 'ISO'); for (const label of button.querySelectorAll('span')) label.textContent = 'ISO'; }
  }
  fit('reference'); fit('candidate');
}
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-mobile-pane]')) button.addEventListener('click', () => {
  mobilePane = button.dataset.mobilePane as typeof mobilePane; persist(); updateMobile();
});
function updateSurface(): void {
  const live = (document as unknown as StudioSessionHost).__jankoStudioSession?.view;
  const stored = !live ? readStudioState(sessionStorage, ['candidates', 'reference'])?.view : undefined;
  const referenceActive = location.hash === '#reference' || (!location.hash && (live ?? stored) === 'reference');
  const sourceActive = !referenceActive && mode === 'source';
  if (sourceActive && !prepared.hidden) window.dispatchEvent(new Event('janko-before-surface-hide'));
  root.hidden = !sourceActive; prepared.hidden = sourceActive;
  document.body.classList.toggle('source-mode', sourceActive);
  updateStudioNavigation(document, referenceActive ? 'reference' : 'candidates');
  if (sourceActive) { loadOriginal(); syncInk(); updateMobile(); }
  else window.dispatchEvent(new Event('janko-surface-show'));
}
for (const button of modeButtons) button.addEventListener('click', () => {
  mode = button.dataset.studioMode === 'source' ? 'source' : 'engraving';
  try { sessionStorage.setItem('janko-candidates-mode', mode); } catch { /* private session */ }
  if (location.hash !== '#candidates') location.hash = '#candidates';
  updateSurface();
});
new MutationObserver(syncInk).observe(prepared, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-prepared-state'] });
window.addEventListener('hashchange', updateSurface);
window.addEventListener('resize', () => { fit('reference'); fit('candidate'); });
updateMobile(); updateSurface();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateSurface);
