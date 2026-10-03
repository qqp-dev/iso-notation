/** First-page reading experiment. These are practical bass references, not roots. */
import { no14GoldProfile } from './no14-gold';
import { resolveJankoOptions } from './types';
import {ANCHOR_TARGET,linearPitch,prepareAnchorProblem,relativeClass,solveAnchors,type AnchorSolution} from './anchor-solver';
export const NO14_RELATIVE_SCORE_ID = 'schumann-op68-no14-relative-study';
export const NO14_RELATIVE_BASELINE_ID = 'schumann-op68-no14-relative-baseline';
export function no14RelativeBaselineProfile(solution?:AnchorSolution) {
  const accepted=no14GoldProfile(),score=structuredClone(accepted.score);
  const plan=solution??solveAnchors(prepareAnchorProblem(score));
  score.readingPresentation={sourceScoreId:score.id,anchors:structuredClone(plan.anchors),target:ANCHOR_TARGET,cost:plan.cost,resets:plan.resets};
  for(const note of score.notes){
    const active=plan.anchors.filter(a=>a.tick<=note.startTick).at(-1);if(!active)throw Error(`Missing causal reference for${note.id}`);
    const interval=linearPitch(note)-active.pitch;
    note.readingDisplay={pitchClass:relativeClass(linearPitch(note),active.pitch),relativeOctave:Math.floor(interval/12),referencePitch:active.pitch,isAnchor:active.ownerIds.includes(note.id)};
  }
  score.id=NO14_RELATIVE_BASELINE_ID;
  if(score.printIdentity)score.printIdentity={...score.printIdentity,scoreId:score.id,piece:'No. 14 · Kleine Studie · relative reading'};
  score.publicationNotices=[...(score.publicationNotices??[]),'Study · framed pitch absolute; plain pitches relative · exact source register'];
  return {...accepted,score,options:resolveJankoOptions({...accepted.options,beatPulseTicks:72})};
}
export function recoverReadingPitch(note:ReturnType<typeof no14RelativeBaselineProfile>['score']['notes'][number]):number {
  const d=note.readingDisplay;if(!d)throw Error(`Missing reading metadata for${note.id}`);
  return d.referencePitch+d.pitchClass+12*d.relativeOctave;
}
export function no14RelativeProfile() {
  const accepted = no14GoldProfile();
  const score = structuredClone(accepted.score);
  const bars = score.sourceBarTicks;
  if (!bars || bars.length !== 65) throw Error('Relative study requires all64 written bars');
  const anchors = bars.slice(0,-1).map((tick,index) => {
    const notes = score.notes.filter(n => n.startTick >= tick && n.startTick < bars[index+1]);
    const first = Math.min(...notes.map(n => n.startTick));
    const pitch = Math.min(...notes.filter(n => n.startTick === first).map(n => 12*n.pitch.octave+n.pitch.pitchClass));
    if (!Number.isFinite(pitch)) throw Error(`Relative bar${index+1} has no sounding anchor`);
    return {bar:index+1,tick,pitch,movement:0};
  });
  anchors.forEach((a,i) => a.movement = i ? a.pitch-anchors[i-1].pitch : 0);
  const notes: NonNullable<typeof score.relativePresentation>['notes'] = {};
  for (const note of score.notes) {
    const index = bars.findIndex((start,i) => i < bars.length-1 && note.startTick >= start && note.startTick < bars[i+1]);
    if (index < 0) throw Error(`Relative note${note.id} lies outside written bars`);
    const sourcePitch = 12*note.pitch.octave+note.pitch.pitchClass;
    const displayPitch = 48+sourcePitch-anchors[index].pitch;
    notes[note.id] = {sourcePitch,displayPitch,bar:index+1};
    note.pitch = {octave:Math.floor(displayPitch/12),pitchClass:((displayPitch%12)+12)%12};
  }
  score.relativePresentation = {sourceScoreId:score.id,displayZero:48,visibleBars:16,anchors,notes};
  score.id = NO14_RELATIVE_SCORE_ID;
  if (score.printIdentity) score.printIdentity = {...score.printIdentity,scoreId:score.id,piece:'No. 14 · Kleine Studie · relative study'};
  score.publicationNotices = [...(score.publicationNotices ?? []),'Experimental opening16 bars · per-bar first bass = 0 · reset spans in base12'];
  return {...accepted,score,options:resolveJankoOptions({...accepted.options,beatPulseTicks:72,showOctaveLabels:false,showPitchLabels:false})};
}
export function recoverRelativePitch(score:ReturnType<typeof no14RelativeProfile>['score'],noteId:string):number {
  const projection = score.relativePresentation,record = projection?.notes[noteId];
  if (!projection || !record) throw Error(`Missing relative note${noteId}`);
  const note = score.notes.find(n => n.id === noteId);
  if (!note) throw Error(`Missing projected note${noteId}`);
  return 12*note.pitch.octave+note.pitch.pitchClass-projection.displayZero+projection.anchors[record.bar-1].pitch;
}
