import { CANDIDATE_IDS, REFERENCE_IDS, SOURCE_DOCUMENTS, type SourceDocumentId } from './documents';

export interface PageChoice { page: number; zoom: number }
export interface SourceChoices {
  reference: SourceDocumentId;
  candidate: SourceDocumentId;
  mobilePane: 'reference' | 'candidate';
  pages: Record<SourceDocumentId, PageChoice>;
}
export const STORAGE_KEY = 'janko-source-review-v1';
export const ZOOM_MIN = 0.5, ZOOM_MAX = 3;
const pageChoice = (): PageChoice => ({ page: 1, zoom: 1 });
export function initialChoices(): SourceChoices {
  return { reference: REFERENCE_IDS[0], candidate: CANDIDATE_IDS[0], mobilePane: 'reference',
    pages: Object.fromEntries(Object.keys(SOURCE_DOCUMENTS).map((id) => [id, pageChoice()])) as SourceChoices['pages'] };
}
export function restoreChoices(raw: string | null): SourceChoices {
  const safe = initialChoices();
  if (!raw) return safe;
  try {
    const data = JSON.parse(raw);
    if (REFERENCE_IDS.includes(data.reference)) safe.reference = data.reference;
    if (CANDIDATE_IDS.includes(data.candidate)) safe.candidate = data.candidate;
    if (data.mobilePane === 'candidate') safe.mobilePane = 'candidate';
    for (const id of Object.keys(SOURCE_DOCUMENTS) as SourceDocumentId[]) {
      const choice = data.pages?.[id];
      if (Number.isInteger(choice?.page) && choice.page >= 1 && choice.page <= SOURCE_DOCUMENTS[id].pages) safe.pages[id].page = choice.page;
      if (Number.isFinite(choice?.zoom)) safe.pages[id].zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, choice.zoom));
    }
  } catch { /* Untrusted/corrupt storage falls back to defaults. */ }
  return safe;
}
export function selectDocument(state: SourceChoices, role: 'reference' | 'candidate', id: SourceDocumentId): void {
  if (!(role === 'reference' ? REFERENCE_IDS : CANDIDATE_IDS).includes(id)) throw new Error('wrong source document role');
  state[role] = id; // No page or zoom mutation, even when switching A/B.
}
export function setPage(state: SourceChoices, id: SourceDocumentId, page: number): void {
  state.pages[id].page = Math.max(1, Math.min(SOURCE_DOCUMENTS[id].pages, Math.trunc(page) || 1));
}
export function setZoom(state: SourceChoices, id: SourceDocumentId, zoom: number): void {
  if (Number.isFinite(zoom)) state.pages[id].zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}
