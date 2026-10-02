/** Explicit, unaccepted No14 practice trial. Canonical/default profiles remain separate. */
import {buildSchumannNo14Draft} from '../../scores/schumann-no14-draft';
import {DEFAULT_JANKO_OPTIONS,DEFAULT_JANKO_TOKENS,resolveJankoOptions,resolveJankoTokens} from './types';

export const NO14_PRACTICE_SCORE_ID='schumann-op68-no14-practice';
export const NO14_PRACTICE_DELTA={durationGrammar:'complete' as const,shareAttackHeads:true as const,
 independentUnisonAttachments:true as const,sharedHeadTerminal:'long' as const,
 sharedDurationDot:'exposed-stem' as const,phraseRouting:'balanced' as const,phraseTaper:'gentle' as const,completeFlagClearance:true as const};
export const NO14_DOT_CONTROL_DELTA={durationGrammar:'complete' as const,shareAttackHeads:true as const,independentUnisonAttachments:true as const};
/** Chosen augmentation convention; historicalH routing is retained solely as
 * a diagnostic control. Curve placement is rejected and not repaired here. */
export const NO14_HEAD_DOT_DELTA={...NO14_PRACTICE_DELTA,sharedDurationDot:'head-adjacent' as const,
 phrasePlacement:'gesture-contour' as const,hairpinStrokeWidth:.65};
export const NO14_FULLER_HAIRPIN_DELTA={...NO14_HEAD_DOT_DELTA,hairpinStrokeWidth:1};
export function no14PracticeScore(){
 const score=buildSchumannNo14Draft();
 score.printIdentity={scoreId:score.id,work:'Album für die Jugend · Op. 68',piece:'No. 14 · Kleine Studie',composer:'Robert Schumann',sourceAlias:'Schuberth 1848 first issue / Hardy encoding'};
 score.performingInstruction={text:'Leise und sehr egal zu spielen.',edition:'Schuberth & Co., December 1848 first issue, plate 1232',pages:'16–17',encodingText:'Léger et très égal',encodingFile:'14-Petite-etude.ly',encodingLine:80};
 score.publicationNotices=['Encoding: Philippe Hardy · Copyleft / Licence Art Libre / Free Art License. Attribution and source-form provenance retained.',
  'Reference: Schuberth & Co., 1848, plate 1232, pp.16–17. Practice candidate.'];
 return score;
}
export function no14PracticeProfile(){
 return {score:no14PracticeScore(),options:resolveJankoOptions({...DEFAULT_JANKO_OPTIONS,
  measuresPerSystem:4,systemsPerPage:4,headerHeight:66,gridWritingPolicy:'overlaid-beat-grid',writtenTies:'source',verticalPlacement:'content-aware',...NO14_PRACTICE_DELTA}),
  tokens:resolveJankoTokens({...DEFAULT_JANKO_TOKENS,ticksPerMeasure:144,anacrusisTicks:0})};
}
export function no14HeadDotProfile(fullerHairpins=false){
 const e=no14PracticeProfile();
 return {...e,options:resolveJankoOptions({...e.options,...(fullerHairpins?NO14_FULLER_HAIRPIN_DELTA:NO14_HEAD_DOT_DELTA)})};
}

/** Explicit optical placement comparison; source, durations, hairpins and
 * historical I/H controls are retained unchanged. */
export const NO14_OPTICAL_DELTA={...NO14_HEAD_DOT_DELTA,phraseRouting:'optical-gesture' as const};
export function no14OpticalProfile(pedalStart?:'ornate-p'|'pictogram'){
 const e=no14HeadDotProfile();
 return {...e,options:resolveJankoOptions({...e.options,...NO14_OPTICAL_DELTA,...(pedalStart?{pedalStart}:{})})};
}
/** Complete both-side fitting/ranking trial; M's earlier optical policy stays
 * available independently. All other score and expression controls are fixed. */
export const NO14_FITTED_DELTA={...NO14_OPTICAL_DELTA,phraseRouting:'optical-fitted' as const};
export function no14FittedProfile(aboveDiagnostic=false){
 const e=no14OpticalProfile();
 return {...e,options:resolveJankoOptions({...e.options,...NO14_FITTED_DELTA,...(aboveDiagnostic?{phrasePlacement:'above-diagnostic' as const}:{})})};
}
/** Successor trial keeps the operator's chosen repeat/duration components;
 * breathing, lettering and pedal starts remain review choices. */
export const NO14_BREATHING_DELTA={...NO14_FITTED_DELTA,phraseRouting:'optical-breathing' as const,repeatTreatment:'single-rule' as const};
export function no14BreathingProfile(aboveDiagnostic=false){
 const e=no14FittedProfile(aboveDiagnostic);
 return {...e,options:resolveJankoOptions({...e.options,...NO14_BREATHING_DELTA,...(aboveDiagnostic?{phrasePlacement:'above-diagnostic' as const}:{})})};
}

/** Explicit silhouette successor; prior breathing controls retain their policy. */
export const NO14_SILHOUETTE_DELTA={...NO14_BREATHING_DELTA,phraseRouting:'optical-silhouette' as const};
