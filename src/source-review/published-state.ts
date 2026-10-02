import type {StudioStorageLike} from '../render/janko/studio-session';
export const PUBLISHED_COMPARISON_KEY='janko-published-comparison-v1';
export type PublishedWork='schumann-13'|'schumann-14';
export interface PublishedComparisonState{
 workId:PublishedWork;readingId:string;mobilePane:'reference'|'candidate';
 zoom:{reference:number;candidate:number};referencePage:number;isoPage:number;
}
export function readPublishedComparison(storage?:StudioStorageLike):PublishedComparisonState{
 const state:PublishedComparisonState={workId:'schumann-14',readingId:'local-phrasing',mobilePane:'reference',zoom:{reference:1,candidate:1},referencePage:0,isoPage:0};
 try{
  const saved=JSON.parse(storage?.getItem(PUBLISHED_COMPARISON_KEY)??'null');
  if(saved&&typeof saved==='object'){
   // Old records are No13 records. Preserve their exact reading and pane;
   // opening the new work must never retarget an obsolete saved reading.
   if(saved.workId==='schumann-13'||saved.workId==='schumann-14')state.workId=saved.workId;
   else if(typeof saved.readingId==='string')state.workId='schumann-13';
   if(typeof saved.readingId==='string')state.readingId=saved.readingId;
   if(saved.mobilePane==='candidate')state.mobilePane='candidate';
   for(const role of ['reference','candidate'] as const)if(Number.isFinite(saved.zoom?.[role]))state.zoom[role]=Math.max(.5,Math.min(3,saved.zoom[role]));
   if(Number.isInteger(saved.referencePage)&&saved.referencePage>=0&&saved.referencePage<2)state.referencePage=saved.referencePage;
   if(Number.isInteger(saved.isoPage)&&saved.isoPage>=0&&saved.isoPage<4)state.isoPage=saved.isoPage;
  }
 }catch{/* blocked/invalid storage */}
 return state;
}
