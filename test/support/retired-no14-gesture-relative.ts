/** Test-only geometry fixture; no runtime/studio score builder is exported. */
/** Bounded reading projection of the written No14 gestures, without harmonic inference. */
import {no14GoldProfile} from '../../src/render/janko/no14-gold';
import {linearPitch,relativeClass} from '../../src/render/janko/anchor-solver';
import {resolveJankoOptions} from '../../src/render/janko/types';
import type {QuantizedNote,QuantizedGridScore} from '../../src/model/types';

export const NO14_GESTURE_RELATIVE_ID='schumann-op68-no14-gesture-relative';
export const NO14_GESTURE_UNDERLINE_ID='schumann-op68-no14-gesture-underlined';
export const NO14_GESTURE_REFINED_ID='schumann-op68-no14-gesture-refined';
export const NO14_GESTURE_CENTERED_ID='schumann-op68-no14-gesture-centered';
export const NO14_GESTURE_CONDENSED_ID='schumann-op68-no14-gesture-condensed';
export const NO14_GESTURE_OPTICAL_ID='schumann-op68-no14-gesture-optical';
export const NO14_GESTURE_OPEN_ID='schumann-op68-no14-gesture-open';
type Group=NonNullable<NonNullable<QuantizedGridScore['readingPresentation']>['groups']>[number];
export function no14GestureRelativeProfile(){
  const accepted=no14GoldProfile(),score=structuredClone(accepted.score),bars=score.sourceBarTicks!;
  const groups:Group[]=[],anchors:NonNullable<QuantizedGridScore['readingPresentation']>['anchors']=[];
  const assign=(bar:number,notes:QuantizedNote[],kind:Group['kind'])=>{
    const ordered=[...notes].sort((a,b)=>a.startTick-b.startTick||linearPitch(a)-linearPitch(b)||a.id.localeCompare(b.id));
    const first=ordered[0],reference=linearPitch(first),owners=ordered.filter(n=>n.startTick===first.startTick&&linearPitch(n)===reference).map(n=>n.id);
    const id=`gesture-${bar}-${first.startTick-bars[bar-1]}-${kind}`;
    const both=new Set(ordered.map(n=>relativeClass(linearPitch(n),reference)%2)).size===2;
    groups.push({id,bar,referencePitch:reference,anchorOwnerIds:owners,memberIds:ordered.map(n=>n.id),kind});
    anchors.push({bar,tick:first.startTick,pitch:reference,ownerId:first.id,ownerIds:owners});
    for(const note of ordered){const interval=linearPitch(note)-reference;
      note.readingDisplay={pitchClass:relativeClass(linearPitch(note),reference),relativeOctave:Math.floor(interval/12),referencePitch:reference,isAnchor:owners.includes(note.id),mode:'relative',groupId:id,groupHasBothParities:both};
    }
  };
  for(let b=0;b<bars.length-1;b++){
    const notes=score.notes.filter(n=>n.startTick>=bars[b]&&n.startTick<bars[b+1]).sort((a,b)=>a.startTick-b.startTick||linearPitch(a)-linearPitch(b)||a.id.localeCompare(b.id));
    // Absolute fallback is deliberate: a long isolated note is not an invented figure.
    for(const note of notes)note.readingDisplay={pitchClass:note.pitch.pitchClass,relativeOctave:note.pitch.octave,referencePitch:0,isAnchor:false,mode:'absolute'};
    const eighth=score.ticksPerBeat/2;
    const regular=notes.length===6&&notes.every((n,i)=>n.startTick===bars[b]+i*eighth&&n.durationTicks===eighth&&n.hand===(i<3?'LH':'RH'));
    if(regular){
      const deltas=notes.slice(1).map((n,i)=>linearPitch(n)-linearPitch(notes[i]));
      const continuous=deltas.every(d=>d>0)||deltas.every(d=>d<0);
      if(continuous)assign(b+1,notes,'continuous-cross-hand');
      else{assign(b+1,notes.slice(0,3),'hand-figure');assign(b+1,notes.slice(3),'hand-figure');}
    }else{
      // A held melodic head and its simultaneous eighth alias own the same local figure.
      const melody=notes.filter(n=>n.hand==='RH'&&n.durationTicks===3*eighth);
      for(const held of melody){
        const figure=notes.filter(n=>n.hand==='RH'&&n.durationTicks===eighth&&n.startTick>=held.startTick&&n.startTick<held.startTick+3*eighth);
        if(figure.length===3&&figure.every((n,i)=>n.startTick===held.startTick+i*eighth)&&linearPitch(figure[0])===linearPitch(held))assign(b+1,[held,...figure],'held-melody-figure');
      }
    }
  }
  score.readingPresentation={sourceScoreId:score.id,anchors,groups,target:'source-gesture-local-references',resets:anchors.length};
  score.id=NO14_GESTURE_RELATIVE_ID;
  if(score.printIdentity)score.printIdentity={...score.printIdentity,scoreId:score.id,piece:'No. 14 · Kleine Studie · gesture-relative reading'};
  score.publicationNotices=[...(score.publicationNotices??[]),'Study · [pitch] starts its figure · plain interior digits relative · standalone notes absolute'];
  return {...accepted,score,options:resolveJankoOptions({...accepted.options,beatPulseTicks:72,pitchPlacement:'parity-columns',readingSequentialParity:true,readingAnchorMark:'brackets',readingAnchorSquare:{stroke:.45,sideAir:.55,verticalAir:.55,arm:.90}})};
}
/** Operator correction: temporal placement for successive actions, compact absolute starts. */
export function no14GestureUnderlineProfile(){
  const p=no14GestureRelativeProfile();
  p.score.id=NO14_GESTURE_UNDERLINE_ID;
  if(p.score.printIdentity)p.score.printIdentity={...p.score.printIdentity,scoreId:p.score.id};
  p.score.publicationNotices=p.score.publicationNotices!.map(s=>s.replace('Study · [pitch] starts its figure','Study · underlined pitch starts its figure'));
  const {readingAnchorSquare,readingSequentialParity,...base}=p.options;
  return {...p,options:resolveJankoOptions({...base,readingAnchorMark:'underline',readingUnderlineStroke:.45})};
}

/** The terminal same-hand return closes the preceding figure without a new attack reference. */
export function no14GestureRefinedProfile(){
  const p=no14GestureUnderlineProfile(),s=p.score,lastStart=s.sourceBarTicks!.at(-2)!;
  const terminal=s.notes.filter(n=>n.startTick>=lastStart);
  if(terminal.length!==1)throw Error('No14 terminal figure requires its single written return');
  const note=terminal[0],byId=new Map(s.notes.map(n=>[n.id,n]));
  const group=s.readingPresentation!.groups!.filter(g=>g.memberIds.every(id=>{const n=byId.get(id)!;return n.hand===note.hand&&n.startTick<lastStart;})).at(-1);
  if(!group||group.referencePitch!==linearPitch(note))throw Error('No14 terminal return must match its preceding same-hand reference');
  group.memberIds.push(note.id);
  note.readingDisplay={pitchClass:0,relativeOctave:0,referencePitch:group.referencePitch,isAnchor:false,mode:'relative',groupId:group.id,groupHasBothParities:byId.get(group.anchorOwnerIds[0])!.readingDisplay!.groupHasBothParities};
  s.id=NO14_GESTURE_REFINED_ID;
  if(s.printIdentity)s.printIdentity={...s.printIdentity,scoreId:s.id};
  return {...p,options:resolveJankoOptions({...p.options,readingUnderlineStroke:.65})};
}

/** Uniform reference marks avoid deriving their meaning or alignment from letter bearings. */
export function no14GestureCenteredProfile(){
  const p=no14GestureRefinedProfile();
  p.score.id=NO14_GESTURE_CENTERED_ID;
  if(p.score.printIdentity)p.score.printIdentity={...p.score.printIdentity,scoreId:p.score.id};
  return {...p,options:resolveJankoOptions({...p.options,readingUnderlineWidth:4})};
}

/** Compact rhythmic figures through truthful production width admission. */
export function no14GestureCondensedProfile(){
  const p=no14GestureCenteredProfile();
  p.score.id=NO14_GESTURE_CONDENSED_ID;
  if(p.score.printIdentity)p.score.printIdentity={...p.score.printIdentity,scoreId:p.score.id};
  return {...p,options:resolveJankoOptions({...p.options,measuresPerSystem:6,productionWidthPolicy:'protected-heads'})};
}

/** Reading-only optical balance; sounding/temporal and stem axes stay fixed. */
export function no14GestureOpticalProfile(){
  const p=no14GestureCondensedProfile();
  p.score.id=NO14_GESTURE_OPTICAL_ID;
  if(p.score.printIdentity)p.score.printIdentity={...p.score.printIdentity,scoreId:p.score.id};
  // URW Gothic1's dominant body center312.5 differs from advance midpoint280.
  // B's optical trial gives its rounded right edge slightly more support.
  return {...p,options:resolveJankoOptions({...p.options,readingUnderlineWidth:4.6,readingGlyphSeats:{'1':-.0325,B:-.025}})};
}

/** New candidate, retaining the encoding and every historical profile separately. */
export function no14GestureOpenProfile(){
  const p=no14GestureOpticalProfile(),s=p.score,original=s.dynamics;
  const omitted=original.map((q,i)=>({q,i})).filter(({q})=>q.kind==='mark'&&q.mark==='p'&&q.origin?.file==='14-Petite-etude.ly'&&
    (q.tick===0&&q.origin.line===99&&q.origin.col===10||q.tick===4608&&q.parenthesized&&q.origin.line===136&&q.origin.col===69));
  if(omitted.length!==2)throw Error('No14 selected-edition dynamic identities differ');
  const mappings=s.writtenPresentation!.events.dynamics;
  s.editionCorrections=omitted.map(({q,i})=>({kind:'omit-dynamic',reason:'Scalar piano is encoded but absent from the inspected Schuberth1848 witness; operator independently reports no piano in Henle1977 (operator evidence, not agent certification).',witness:'Schuberth & Co.,1848, plate1232, pp.16–17',original:structuredClone(q),writtenIndex:i,performedMappings:structuredClone(mappings.filter(row=>row.writtenIndex===i))}));
  const kept=original.map((_,i)=>i).filter(i=>!omitted.some(q=>q.i===i)),reindex=new Map(kept.map((old,next)=>[old,next]));
  s.dynamics=kept.map(i=>original[i]);
  s.writtenPresentation!.events.dynamics=mappings.filter(q=>reindex.has(q.writtenIndex)).map(q=>({...q,writtenIndex:reindex.get(q.writtenIndex)!}));
  s.id=NO14_GESTURE_OPEN_ID;
  if(s.printIdentity)s.printIdentity={...s.printIdentity,scoreId:s.id,piece:'No. 14 · Kleine Studie'};
  s.publicationNotices=s.publicationNotices!.filter(q=>!q.startsWith('Study · '));
  return {...p,options:resolveJankoOptions({...p.options,readingGlyphSeats:{'1':-.01625,B:-.025},authoredRestMode:'source',phraseRouting:'optical-open'})};
}
