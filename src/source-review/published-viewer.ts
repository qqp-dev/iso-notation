import { SOURCE_IMAGES, SCHUMANN_NO13_ENDING_CITATION as citation } from './documents';
import { updateStudioNavigation } from '../render/janko/prepared/viewer-dom';
import { readStudioState, type StudioSessionHost } from '../render/janko/studio-session';
import { cloneComparisonSvg, comparisonReadings, no14GoldComparisonPages } from './prepared-comparison';

import {readPublishedComparison,PUBLISHED_COMPARISON_KEY} from './published-state';

const root = document.getElementById('source-review')!;
const prepared = document.getElementById('janko-studio')!;
const grid = root.querySelector('.source-grid')!;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-studio-mode]'));
const imageDocument = SOURCE_IMAGES[citation.reference];
const page = imageDocument.pages.find(page => page.folio === citation.folio)!;
let mode: 'source' | 'engraving' = 'engraving';
try { if (sessionStorage.getItem('janko-candidates-mode') === 'source') mode = 'source'; } catch { /* private session */ }
// Separate from development PDF choices: no migration or deletion of saved work.
const state=readPublishedComparison(sessionStorage);
let {readingId,mobilePane,workId,referencePage,isoPage}=state;
const zoom=state.zoom;
const persist=()=>{try{sessionStorage.setItem(PUBLISHED_COMPARISON_KEY,JSON.stringify({readingId,mobilePane,workId,referencePage,isoPage,zoom}));}catch{/* private session */}};
const work=document.querySelector<HTMLSelectElement>('.source-work')!;
work.replaceChildren(...(['schumann-14','schumann-13'] as const).map(id=>{
 const option=document.createElement('option');option.value=id;option.textContent=id==='schumann-14'?'Schumann · Op. 68 No. 14 · GOLD':'Schumann · Op. 68 No. 13';return option;
}));
work.disabled=false;work.value=workId;
const roles = ['reference', 'candidate'] as const;
const panes = Object.fromEntries(roles.map(role => {
  const container = document.createElement('section'); container.className = `source-pane source-${role}`;
  container.setAttribute('aria-label', role === 'reference' ? 'Original Henle score' : 'ISO engraving');
  container.innerHTML = `<div class="source-identity"><strong class="source-identity-label"></strong><span class="source-page"></span>
    <details class="source-details"><summary>Details</summary><div class="source-details-content"><p class="source-edition"></p><a class="source-link" target="_blank" rel="noopener noreferrer">Original page ↗</a><a class="source-catalogue" target="_blank" rel="noopener noreferrer">Henle edition ↗</a></div></details></div>
    ${role === 'candidate' ? '<label class="comparison-reading">ISO reading <select aria-label="ISO reading"></select></label>' : ''}
    <div class="source-controls"><button data-page-action="previous" aria-label="Previous page">←</button><button data-page-action="next" aria-label="Next page">→</button><button data-action="out" aria-label="Zoom out">−</button><span class="source-zoom"></span><button data-action="in" aria-label="Zoom in">+</button><button data-action="reset" aria-label="Fit page">Fit</button></div>
    <div class="source-canvas"></div><p class="source-status" role="status"></p>`;
  grid.append(container);
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
  updateIdentity();
  select.closest<HTMLElement>('.comparison-reading')!.hidden=workId==='schumann-14';
  if(workId==='schumann-14'){
    const pages=no14GoldComparisonPages(prepared),selected=pages[isoPage];
    if(!selected){panes.candidate.host.replaceChildren();copiedOriginal=undefined;copiedId=undefined;panes.candidate.container.dataset.renderState='unavailable';panes.candidate.status.textContent='Waiting for the verified No. 14 GOLD pages…';return;}
    const key=`no14-gold-page-${selected.page}`;
    if(copiedOriginal!==selected.svg||copiedId!==key){const svg=cloneComparisonSvg(selected.svg,'source-no14');svg.setAttribute('aria-label',`Schumann No. 14 GOLD, ${selected.label}`);panes.candidate.host.replaceChildren(svg);copiedOriginal=selected.svg;copiedId=key;}
    panes.candidate.container.dataset.readingId=key;panes.candidate.container.dataset.renderState='ready';panes.candidate.status.textContent='';fit('candidate');return;
  }
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
let imageKey:string|undefined;
function currentOriginal(){return workId==='schumann-14'?SOURCE_IMAGES['schuberth-14'].pages[referencePage]:page;}
function updateIdentity():void{
 const no14=workId==='schumann-14',doc=no14?SOURCE_IMAGES['schuberth-14']:imageDocument,original=currentOriginal();
 panes.reference.container.setAttribute('aria-label',no14?'Original Schuberth score':'Original Henle score');
 for(const role of roles){
  const container=panes[role].container;
  container.querySelector<HTMLElement>('.source-identity-label')!.textContent=role==='reference'?(no14?'Original · Schuberth 1848':'Original · Henle HN 45'):(no14?'ISO · Schumann No. 14 GOLD':'ISO · Schumann No. 13');
  container.querySelector<HTMLElement>('.source-page')!.textContent=no14?(role==='reference'?`Printed p. ${original.folio} · ${referencePage+1} / 2`:`ISO page ${isoPage+1} / 4 · 64 written bars`):(role==='reference'?'Printed p. 15 · mm. 35–36':'Internal 38–40 · split ending / fp pickup');
  container.querySelector<HTMLElement>('.source-edition')!.textContent=no14?`Schuberth & Co., December 1848 first issue, plate 1232, pp. 16–17 · Brahms-Institut ABH 5.2.187. ISO: operator-selected No. 14 GOLD; Philippe Hardy encoding under the Free Art License; separate source and encoding provenance.`:`${imageDocument.edition}. ${citation.caption}`;
  container.querySelector<HTMLAnchorElement>('.source-link')!.href=original.url;
  const catalogue=container.querySelector<HTMLAnchorElement>('.source-catalogue')!;catalogue.href=doc.source;catalogue.textContent=no14?'First-issue catalogue ↗':'Henle edition ↗';
  for(const button of container.querySelectorAll<HTMLButtonElement>('[data-page-action]')){const current=role==='reference'?referencePage:isoPage,max=role==='reference'?1:3;button.hidden=!no14;button.disabled=button.dataset.pageAction==='previous'?current===0:current===max;}
 }
}
for(const role of roles)for(const button of panes[role].container.querySelectorAll<HTMLButtonElement>('[data-page-action]'))button.addEventListener('click',()=>{
 if(workId!=='schumann-14')return;const step=button.dataset.pageAction==='next'?1:-1;
 if(role==='reference')referencePage=Math.max(0,Math.min(1,referencePage+step));else isoPage=Math.max(0,Math.min(3,isoPage+step));
 persist();updateIdentity();if(role==='reference')loadOriginal();else syncInk();
});
work.addEventListener('change',()=>{workId=work.value as typeof workId;persist();updateIdentity();loadOriginal();syncInk();updateMobile();});
function loadOriginal(): void {
  const original=currentOriginal();if(image&&imageKey===original.url)return;
  const current=document.createElement('img');image=current;imageKey=original.url;
  const no14=workId==='schumann-14';
  current.alt=no14?`Schumann Op. 68 No. 14, Schuberth first issue 1848, printed folio ${original.folio}`:`${citation.work}, Henle HN 45, printed folio 15`;
  panes.reference.container.dataset.renderState='loading';panes.reference.status.textContent=no14?'Loading the public first-issue page…':'Loading Henle’s public preview…';
  current.onload=()=>{if(image!==current)return;retry.hidden=true;panes.reference.container.dataset.renderState='ready';panes.reference.status.textContent='';fit('reference');};
  current.onerror=()=>{if(image!==current)return;retry.hidden=false;panes.reference.container.dataset.renderState='error';panes.reference.status.textContent='The public original is unavailable. Open the original page above, or use Retry.';image=undefined;imageKey=undefined;};
  current.src=original.url;panes.reference.host.replaceChildren(current);
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
updateIdentity(); updateMobile(); updateSurface();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateSurface);
