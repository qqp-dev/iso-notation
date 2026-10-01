import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CURRENT_CANDIDATES, CURRENT_ROUND_METADATA, ROUND_58_CANDIDATES, ROUND_57_CANDIDATES, ROUND_56_CANDIDATES, getCandidate} from '../src/render/janko/candidates';
import {createStudioConfig} from '../src/render/janko/studio';
import {PreparedJankoWindows, renderPreparedJankoWindow} from '../src/render/janko/prepared-windows';
import {lintJankoWindowSystems} from '../src/render/janko/linter';
import {computeJointVoiceBeams} from '../src/render/janko/joint-beams';
import {buildInkScene, sceneInkAt} from '../src/render/janko/ink-scene';
import {beamPieceAt, beamPieceBox, beamPieceIntersectsBox, beamStemBoxes} from '../src/render/janko/beam-scene';
import {knockoutHalfExtents, systemCompleteInkBounds} from '../src/render/janko/engine';
const config=createStudioConfig(), e=config.scores['schumann-op68-no13'];
const source=JSON.stringify(e.score), windows=[{measureStart:38,measureCount:3}];
const [control,joint]=CURRENT_CANDIDATES.map(c=>new PreparedJankoWindows(e.score,windows,{...e.options,...c.options},e.tokens));
const old=[...control.systems.values()][0], now=[...joint.systems.values()][0];
const course=(tick:number,voice:string)=>now.beams.find(b=>b.notes[0].sourceVoice===voice&&b.notes.some(n=>n.startTick===tick))!;
test('Round59 has exactly two useful presentations and preserves the explicit retained registries',()=>{
 assert.equal(CURRENT_ROUND_METADATA.round,59);assert.equal(CURRENT_CANDIDATES.length,2);
 assert.deepEqual(CURRENT_CANDIDATES[0].options,ROUND_58_CANDIDATES[2].options);
 assert.deepEqual(CURRENT_CANDIDATES[1].options,{...ROUND_58_CANDIDATES[2].options,jointVoices:true});
 assert.deepEqual(CURRENT_CANDIDATES[0].windows,CURRENT_CANDIDATES[1].windows);
 for(const c of [...ROUND_58_CANDIDATES,...ROUND_57_CANDIDATES,...ROUND_56_CANDIDATES])assert.equal(getCandidate(c.id),c);
 const archived=new PreparedJankoWindows(e.score,windows,{...e.options,...ROUND_58_CANDIDATES[2].options},e.tokens);
 assert.equal(renderPreparedJankoWindow(control,windows[0],true),renderPreparedJankoWindow(archived,windows[0],true));
});
test('complete No13 clocks, spelling, values, tie carry from37 and independent owner branches survive unchanged',()=>{
 assert.equal(JSON.stringify(e.score),source);
 const {equatorY: eqNow,...geoNow}=now.geometry,{equatorY:eqOld,...geoOld}=old.geometry;
 assert.deepEqual(geoNow,geoOld);for(const hand of ['RH','LH'] as const)for(const octave of [2,3,4,5])assert.equal(eqNow(hand,octave),eqOld(hand,octave));
 assert.deepEqual(now.notes,old.notes);assert.deepEqual(now.unisonVoices,old.unisonVoices);
 for(const key of ['rhythmicGestures','tieChains','tieArcs','tieSplitHeadIds','unisonMerges','rests','grace'] as const)assert.deepEqual(now[key],old[key],key);
 const expressionIdentity=(l:typeof now)=>l.expressions!.map(x=>({id:x.id,kind:x.kind,startTick:x.startTick,endTick:x.endTick,endpointIds:x.endpointIds,continuationStart:x.continuationStart,continuationEnd:x.continuationEnd,side:x.contour?.side}));
 assert.deepEqual(expressionIdentity(now),expressionIdentity(old),'ordinary slur semantics survive obstacle-driven placement');
 assert.ok(now.beams.some(b=>b.notes.some(n=>n.startTick===3288&&n.id.endsWith('~c1'))),'written carry at38 from37');
 const actual=e.score.notes.filter(n=>n.startTick>=3312&&n.startTick<3456);
 const values=now.rhythmicGestures!.flatMap(g=>g.values);
 for(const n of actual)assert.ok(values.some(v=>v.id===n.id&&v.tick===n.startTick&&v.ticks===n.durationTicks),n.id);
 for(const [tick,pcs] of [[3312,[1,9]],[3324,[11,8]],[3336,[10,6]]] as const){
  assert.deepEqual(now.notes.filter(p=>p.note.startTick===tick&&p.note.hand==='RH').map(p=>p.note.pitch.pitchClass).sort((a,b)=>a-b),[...pcs].sort((a,b)=>a-b));
  const heads=now.notes.filter(p=>p.note.startTick===tick&&p.note.hand==='RH');assert.ok(Math.abs(Math.abs(heads[0].x-heads[1].x)-5.46)<1e-8);
 }
 const lower=now.rhythmicGestures!.flatMap(g=>g.values).filter(v=>v.tick===3384&&v.id.includes(':lower.'));
 assert.deepEqual(lower.map(v=>v.ticks).sort(),[24,48]);
});
test('the opening and changing contours now move together, but not by merging primaries or equalizing heads',()=>{
 for(const tick of [3312,3336,3384]){
  const a=course(tick,'upper.0'),b=course(tick,'upper.1');assert.equal(a.slope,b.slope);assert.notDeepEqual(a.primary,b.primary);
  assert.ok(Math.abs(a.primary.y1-b.beamY(a.primary.x1))>=6.8-1e-8);
 }
 const a=course(3312,'upper.0'),b=course(3312,'upper.1');
 const before=old.beams.filter(b=>b.notes[0].hand==='RH'&&b.notes.some(n=>n.startTick===3312));
 assert.ok(Math.abs(before[0].slope-before[1].slope)*74.6086>4.9);
 assert.equal(a.slope,b.slope);assert.ok(a.slope>.1&&a.slope<.168);
 assert.equal(now.beams.length,old.beams.length);
 for(const [i,beam] of now.beams.entries()){
  assert.equal(beam.direction,beam.notes[0].hand==='RH'?-1:1);
  assert.deepEqual(beam.notes.map(n=>[n.id,n.durationTicks]),old.beams[i].notes.map(n=>[n.id,n.durationTicks]));
  assert.deepEqual(beam.levels.map(l=>[l.level,l.stub,l.connector.x1,l.connector.x2]),old.beams[i].levels.map(l=>[l.level,l.stub,l.connector.x1,l.connector.x2]));
 }
});
test('joint fit is partition-order and coordinate-translation stable on the whole real gesture',()=>{
 const groups=now.beams.map(b=>b.notes),notes=[...now.notes,...now.unisonVoices].map(p=>p.rhythm);
 const fit=(gs:typeof groups,ns:typeof notes,spine:number)=>computeJointVoiceBeams(gs,joint.tokens,ns,spine,[],joint.options.durationGrammar);
 const geometry=(bs:ReturnType<typeof fit>,dx=0,dy=0)=>bs.map(b=>({ids:b.notes.map(n=>n.id).sort(),slope:b.slope,levels:b.levels.map(l=>[l.level,l.connector.x1-dx,l.connector.y1-dy,l.connector.x2-dx,l.connector.y2-dy])})).sort((a,b)=>a.ids.join().localeCompare(b.ids.join()));
 const first=geometry(fit(groups,notes,now.geometry.middleCY)), reversed=geometry(fit([...groups].reverse().map(g=>[...g].reverse()),[...notes].reverse(),now.geometry.middleCY));
 assert.deepEqual(reversed,first);
 for(const [dx,dy] of [[800,60],[-300,-700],[1e5,1e4]]){
  const moved=new Map(notes.map(n=>[n.id,{...n,x:n.x+dx,y:n.y+dy}]));
  const result=geometry(fit(groups.map(g=>g.map(n=>moved.get(n.id)!)),[...moved.values()],now.geometry.middleCY+dy),dx,dy);
  for(let i=0;i<first.length;i++){assert.deepEqual(result[i].ids,first[i].ids);assert.ok(Math.abs(result[i].slope-first[i].slope)<1e-10);
   for(let j=0;j<first[i].levels.length;j++)for(let k=0;k<5;k++)assert.ok(Math.abs(result[i].levels[j][k]-first[i].levels[j][k])<1e-8);
  }
 }
});
test('settled ink, owner-linked compact ports, queries and complete bounds agree; foreign heads and joins stay protected',()=>{
 const lint=lintJankoWindowSystems(joint);assert.deepEqual(lint.violations,[]);assert.deepEqual(lint.warnings,[]);
 const scene=buildInkScene(now,joint.options,joint.tokens,joint.score),bounds=systemCompleteInkBounds(now,joint.options,joint.tokens);
 assert.ok(scene.depthRoutes!.length>0);
 const pieces=scene.beams.flat();
 for(const r of scene.depthRoutes!){
  assert.ok(r.rail.ownerIds.length);assert.ok(r.ports.length);
  for(const port of r.ports){assert.ok(Math.abs(port.exit-port.entry-2)<.011);assert.ok(port.frontOwnerIds.length);
   const visible=pieces.filter(p=>r.visibleIds.includes(p.id));
   for(const p of visible)assert.ok(beamStemBoxes({shape:port.front}).every(box=>!beamPieceIntersectsBox(p,box)));
  }
 }
 for(const p of pieces){
  const box=beamPieceBox(p);assert.ok(box.y0>=bounds.top-1e-8&&box.y1<=bounds.bottom+1e-8);
  assert.ok(scene.physical.some(q=>q.what.includes(p.id)&&q.y0===box.y0&&q.y1===box.y1));
  if(p.shape.kind==='rail'){
   const [x,y]=p.shape.points[0],tail=p.shape.points.at(-1)!,insideX=x+.01,insideY=(y+tail[1])/2;
   assert.ok(beamPieceAt(p,insideX,insideY));assert.ok(sceneInkAt(scene,insideX,insideY).some(q=>q.id===p.id));
  }
  if(p.shape.kind==='stem')for(const n of now.notes){
   const owners=now.unisonMerges.filter(m=>m.survivorId===n.note.id).flatMap(m=>m.mergedIds);
   if(p.ownerIds.includes(n.note.id)||owners.some(id=>p.ownerIds.includes(id)))continue;
   const m=knockoutHalfExtents(joint.options,joint.tokens,n.note.startTick,n);
   assert.ok(beamStemBoxes(p).every(b=>Math.min(b.x1,n.x+m.wx)<=Math.max(b.x0,n.x-m.wx)||Math.min(b.y1,n.y+m.hy)<=Math.max(b.y0,n.y-m.hy)),`foreign ${n.note.id}`);
  }
 }
 const svg=renderPreparedJankoWindow(joint,windows[0],true);assert.match(svg,/janko-depth-/);
});
test('held/moving Brahms remains truthful regression context, not padded current cards; Bach quiet guard stays quiet',()=>{
 const b=config.scores['brahms-op118-no1'];
 const p=new PreparedJankoWindows(b.score,[{measureStart:64,measureCount:4}],{...b.options,...CURRENT_CANDIDATES[1].options},b.tokens);
 assert.deepEqual(lintJankoWindowSystems(p).violations,[]);assert.deepEqual(lintJankoWindowSystems(p).warnings,[]);
 const l=p.systems.get(16)!;assert.deepEqual(l.notes.filter(n=>['brahms-op118-no1-910','brahms-op118-no1-911'].includes(n.note.id)).map(n=>n.rhythm.durationTicks).sort(),[24,48]);
 assert.ok(l.tieChains!.length);
 const bach=config.scores.primary,q=new PreparedJankoWindows(bach.score,[{measureStart:13,measureCount:2}],{...bach.options,...CURRENT_CANDIDATES[1].options},bach.tokens);
 assert.deepEqual(lintJankoWindowSystems(q).violations,[]);assert.ok([...q.systems.values()].every(l=>!buildInkScene(l,q.options,q.tokens,q.score).depthRoutes!.length));
});
