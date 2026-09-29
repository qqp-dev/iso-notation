import { SOURCE_DOCUMENTS, SOURCE_IMAGES, WORKS, pageCount, type SourceDocumentId, type WorkId } from './documents';

export interface PageChoice { page: number; zoom: number }
export interface SourceChoices {
  work: WorkId;
  reference: SourceDocumentId;
  candidate: SourceDocumentId;
  mobilePane: 'reference' | 'candidate';
  pages: Record<string, PageChoice>;
  selections: Record<WorkId, { reference: SourceDocumentId; candidate: SourceDocumentId }>;
}
export const STORAGE_KEY = 'janko-source-review-v1';
export const ZOOM_MIN = 0.5, ZOOM_MAX = 3;
export const choiceKey = (work: WorkId, id: SourceDocumentId) => id === 'schumann-starter' ? `${work}:${id}` : id;
const pageChoice = (page = 1): PageChoice => ({ page, zoom: 1 });
export function initialChoices(): SourceChoices {
  const selections = Object.fromEntries(Object.entries(WORKS).map(([id, work]) => [id, { reference: work.reference[0], candidate: work.candidate[0] }])) as SourceChoices['selections'];
  const pages: Record<string, PageChoice> = Object.fromEntries([...Object.keys(SOURCE_DOCUMENTS), ...Object.keys(SOURCE_IMAGES)].map((id) => [id, pageChoice()]));
  for (const [id, work] of Object.entries(WORKS) as [WorkId, typeof WORKS[WorkId]][]) {
    if (id !== 'scriabin') pages[choiceKey(id, 'schumann-starter')] = pageChoice(work.starterPage);
  }
  return { work: 'scriabin', ...selections.scriabin, mobilePane: 'reference', pages, selections };
}
export function restoreChoices(raw: string | null): SourceChoices {
  const safe = initialChoices();
  if (!raw) return safe;
  try {
    const data = JSON.parse(raw);
    if (data.work && Object.hasOwn(WORKS, data.work)) safe.work = data.work;
    for (const work of Object.keys(WORKS) as WorkId[]) {
      for (const role of ['reference', 'candidate'] as const) {
        const id = data.selections?.[work]?.[role] ?? (work === 'scriabin' ? data[role] : undefined);
        if (typeof id === 'string' && WORKS[work][role].some((allowed) => allowed === id)) safe.selections[work][role] = id as SourceDocumentId;
      }
    }
    safe.reference = safe.selections[safe.work].reference;
    safe.candidate = safe.selections[safe.work].candidate;
    if (data.mobilePane === 'candidate') safe.mobilePane = 'candidate';
    for (const [key, current] of Object.entries(safe.pages)) {
      const id = key.includes(':') ? key.slice(key.indexOf(':') + 1) as SourceDocumentId : key as SourceDocumentId;
      const choice = data.pages?.[key];
      if (Number.isInteger(choice?.page) && choice.page >= 1 && choice.page <= pageCount(id)) current.page = choice.page;
      if (typeof choice?.zoom === 'number' && Number.isFinite(choice.zoom)) current.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, choice.zoom));
    }
  } catch { /* Corrupt storage falls back to defaults. */ }
  return safe;
}
export function selectWork(state: SourceChoices, work: WorkId): void {
  if (!Object.hasOwn(WORKS, work)) throw new Error('unknown work');
  state.work = work;
  state.reference = state.selections[work].reference;
  state.candidate = state.selections[work].candidate;
}
export function selectDocument(state: SourceChoices, role: 'reference' | 'candidate', id: SourceDocumentId): void {
  if (!WORKS[state.work][role].some((allowed) => allowed === id)) throw new Error('wrong source document role');
  state[role] = id;
  state.selections[state.work][role] = id;
}
export function currentChoice(state: SourceChoices, id: SourceDocumentId): PageChoice { return state.pages[choiceKey(state.work, id)]; }
export function setPage(state: SourceChoices, id: SourceDocumentId, page: number): void {
  currentChoice(state, id).page = Math.max(1, Math.min(pageCount(id), Math.trunc(page) || 1));
}
export function setZoom(state: SourceChoices, id: SourceDocumentId, zoom: number): void {
  if (Number.isFinite(zoom)) currentChoice(state, id).zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}
