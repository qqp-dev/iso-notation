/** Condensed absolute reading from the corrected source, retaining optical seats. */
import {no14GoldProfile} from './no14-gold';
import {resolveJankoOptions} from './types';

export const NO14_ABSOLUTE_CONDENSED_ID='schumann-op68-no14-absolute-condensed';
export function no14AbsoluteCondensedProfile(){
 const p=no14GoldProfile(),s=p.score,original=s.dynamics;
 const omitted=original.map((q,i)=>({q,i})).filter(({q})=>q.kind==='mark'&&q.mark==='p'&&q.origin?.file==='14-Petite-etude.ly'&&
  (q.tick===0&&q.origin.line===99&&q.origin.col===10||q.tick===4608&&q.parenthesized&&q.origin.line===136&&q.origin.col===69));
 if(omitted.length!==2)throw Error('No14 selected-edition dynamic identities differ');
 const mappings=s.writtenPresentation!.events.dynamics;
 s.editionCorrections=omitted.map(({q,i})=>({kind:'omit-dynamic',reason:'Scalar piano is encoded but absent from the inspected Schuberth1848 witness; operator independently reports no piano in Henle1977 (operator evidence, not agent certification).',witness:'Schuberth & Co.,1848, plate1232, pp.16–17',original:structuredClone(q),writtenIndex:i,performedMappings:structuredClone(mappings.filter(row=>row.writtenIndex===i))}));
 const kept=original.map((_,i)=>i).filter(i=>!omitted.some(q=>q.i===i)),reindex=new Map(kept.map((old,next)=>[old,next]));
 s.dynamics=kept.map(i=>original[i]);
 s.writtenPresentation!.events.dynamics=mappings.filter(q=>reindex.has(q.writtenIndex)).map(q=>({...q,writtenIndex:reindex.get(q.writtenIndex)!}));
 for(const note of s.notes)note.readingDisplay={pitchClass:note.pitch.pitchClass,relativeOctave:note.pitch.octave,referencePitch:0,isAnchor:false,mode:'absolute'};
 s.readingPresentation={sourceScoreId:s.id,anchors:[],groups:[],target:'absolute-source-pitches',resets:0};
 s.id=NO14_ABSOLUTE_CONDENSED_ID;
 if(s.printIdentity)s.printIdentity={...s.printIdentity,scoreId:s.id};
 return {...p,options:resolveJankoOptions({...p.options,beatPulseTicks:72,pitchPlacement:'parity-columns',measuresPerSystem:6,productionWidthPolicy:'protected-heads',
  readingGlyphSeats:{'1':-.01625,B:-.025},authoredRestMode:'source',phraseRouting:'optical-open'})};
}
