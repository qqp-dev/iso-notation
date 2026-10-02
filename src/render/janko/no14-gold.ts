/** Operator-selected complete No14 profile. Global score defaults are separate. */
import selected from './no14-gold-profile.json';
import {projectNo14Written} from './no14-written';
import {resolveJankoOptions,resolveJankoTokens,type JankoLayoutOptions} from './types';
export const NO14_GOLD_REFERENCE_ID='schumann-op68-no14-gold';
export const NO14_GOLD_PDF='schumann-op68-no14-gold.pdf';
export const NO14_GOLD_ACCEPTANCE=selected.accepted;
export const NO14_GOLD_IDENTITY=selected.gold;
export const NO14_CANDIDATE_NOTICE='Reference: Schuberth & Co., 1848, plate 1232, pp.16–17. Practice candidate.';
export const NO14_GOLD_NOTICE=NO14_CANDIDATE_NOTICE.replace(/ Practice candidate\.$/,'');

/** The source projection and every resolved option/token are the accepted A
 * treatment. Future global-default changes cannot silently alter this piece. */
export function no14GoldOriginProfile(){
 return {score:projectNo14Written().score,options:resolveJankoOptions(selected.options as unknown as JankoLayoutOptions),tokens:resolveJankoTokens(selected.tokens)};
}
export function no14GoldPrePrintProfile(){
 const e=no14GoldOriginProfile();
 if(e.score.publicationNotices?.[1]!==NO14_CANDIDATE_NOTICE)throw Error('No14 accepted source notice differs');
 e.score.publicationNotices[1]=NO14_GOLD_NOTICE;
 return e;
}
export function no14GoldProfile(){
 const e=no14GoldPrePrintProfile();
 if(!e.score.printIdentity)throw Error('No14 source print identity missing');
 e.score.printIdentity.scoreId=e.score.id;
 e.options.runningHeaderHeight=20;
 return e;
}
const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
/** Historical pre-print evidence: restore ONLY the authorized notice removal.
 * Final GOLD has separately declared identity/header booking corrections. */
export function no14GoldPrePrintSvgAsAccepted(svg:string,page=0){
 const notice=xml(NO14_GOLD_NOTICE),matches=svg.split(notice).length-1;
 const expected=page===0?1:0;
 if(matches!==expected)throw Error(`No14 GOLD page ${page+1} has ${matches} source notices; expected ${expected}`);
 const restored=svg.replace(notice,xml(NO14_CANDIDATE_NOTICE));
 return restored.startsWith('<svg class="janko-svg" ')?restored:restored.replace('<svg ','<svg class="janko-svg" ');
}
/** The existing studio adds this class to complete page SVGs. Final Reference
 * pins use its bytes; the export manifest also records unwrapped PDF input. */
export function no14GoldStudioSvg(svg:string){
 return svg.startsWith('<svg class="janko-svg" ')?svg:svg.replace('<svg ','<svg class="janko-svg" ');
}
