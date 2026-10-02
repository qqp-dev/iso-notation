import type { StudioStorageLike } from '../studio-session';

export type ReferenceScore = 'primary' | 'brahms-op118-no1' | 'schumann-op68-no14-gold';
export const REFERENCE_READER_KEY = 'janko-reference-reader-v1';
export interface ReferenceReaderState {
  selected: ReferenceScore;
  places: Record<ReferenceScore, number>;
  zooms: Record<ReferenceScore, number>;
  candidatesZoom: number;
  /** Transient: a fresh browser follows GOLD only when that payload exists. */
  fresh?: boolean;
}
const scores: ReferenceScore[] = ['primary', 'brahms-op118-no1', 'schumann-op68-no14-gold'];
const validZoom = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0.5 && value <= 3;
const validPlace = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function readReferenceReader(storage?: StudioStorageLike): ReferenceReaderState {
  const state: ReferenceReaderState = { selected: 'schumann-op68-no14-gold', places: { primary: 0, 'brahms-op118-no1': 0, 'schumann-op68-no14-gold': 0 }, zooms: { primary: 1, 'brahms-op118-no1': 1, 'schumann-op68-no14-gold': 1 }, candidatesZoom: 1, fresh:true };
  try {
    const saved = JSON.parse(storage?.getItem(REFERENCE_READER_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      if (scores.includes(saved.selected)) {state.selected = saved.selected;state.fresh=false;}
      if (validZoom(saved.candidatesZoom)) state.candidatesZoom = saved.candidatesZoom;
      for (const score of scores) {
        if (validPlace(saved.places?.[score])) state.places[score] = saved.places[score];
        if (validZoom(saved.zooms?.[score])) state.zooms[score] = saved.zooms[score];
      }
    }
  } catch { /* blocked or corrupt storage */ }
  return state;
}
export function writeReferenceReader(storage: StudioStorageLike | undefined, state: ReferenceReaderState): void {
  const {fresh:_fresh,...saved}=state;
  try { storage?.setItem(REFERENCE_READER_KEY, JSON.stringify(saved)); } catch { /* private session */ }
}

/** An explicit link may select a known score, without resetting any reader state. */
export function referenceScoreFromSearch(search = ''): ReferenceScore | undefined {
  const requested = new URLSearchParams(search).get('score');
  return scores.find(score => score === requested);
}

export function availableReferenceSelection(root:HTMLElement,state:ReferenceReaderState,requested?:ReferenceScore):ReferenceScore{
 const available=Array.from(root.querySelector<HTMLElement>('#view-reference')?.querySelectorAll<HTMLElement>('.reference-score')??[]).map(q=>q.dataset.score);
 if(requested&&available.includes(requested))return requested;
 if(state.fresh&&available.includes('schumann-op68-no14-gold'))return 'schumann-op68-no14-gold';
 return available.includes(state.selected)?state.selected:available.includes('primary')?'primary':scores.find(q=>available.includes(q))??state.selected;
}

/** Decorate only the reader DOM, never the content-addressed artifact bytes. */
export function decorateReferenceReader(root: HTMLElement, selected: ReferenceScore): void {
  root.dataset.preparedReferenceScore = selected;
  const panel = root.querySelector<HTMLElement>('#view-reference');
  if (!panel) return;
  for (const score of panel.querySelectorAll<HTMLElement>('.reference-score')) {
    const active = score.dataset.score === selected;
    score.hidden = !active;
    if (active) score.dataset.readerSelected = 'true';
    else delete score.dataset.readerSelected;
    if (active) score.removeAttribute('aria-hidden');
    else score.setAttribute('aria-hidden', 'true');
    // The artifact still carries every real-engine macro; they are not part of
    // the paper-first reader. Remove their entire section (including heading).
    for (const grid of score.dataset.score === 'schumann-op68-no14-gold' ? [] : score.querySelectorAll<HTMLElement>('.crop-grid')) {
      const previous = grid.previousElementSibling;
      if (previous?.matches('.section-title')) previous.remove();
      grid.remove();
    }
  }
  const picker = root.ownerDocument.getElementById('janko-reference-picker') as HTMLSelectElement | null;
  if (picker) {
   picker.value = selected;
   const available=Array.from(panel.querySelectorAll<HTMLElement>('.reference-score')).map(q=>q.dataset.score);
   for(const option of Array.from(picker.options??[]))option.disabled=!available.includes(option.value);
  }
}
