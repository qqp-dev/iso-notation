import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_CANDIDATES, CURRENT_ROUND_METADATA, ROUND_57_CANDIDATES, getCandidate, type JankoScoreCandidateWindow } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { PreparedJankoWindows, renderPreparedJankoWindow } from '../src/render/janko/prepared-windows';
import { lintJankoWindowSystems } from '../src/render/janko/linter';
import { buildInkScene, sceneInkAt } from '../src/render/janko/ink-scene';
import { beamPieceAt, beamPieceBox, beamPieceIntersectsBox, beamStemBoxes } from '../src/render/janko/beam-scene';
import { knockoutHalfExtents, systemCompleteInkBounds } from '../src/render/janko/engine';
import { onsetSlotShift } from '../src/render/janko/onset-slots';
const config=createStudioConfig();
const prepared=new Map(CURRENT_CANDIDATES.map(c=>[c.id,new Map(['schumann-op68-no13',...(c.options?.stableOnsets?['brahms-op118-no1']:[])].map(id=>{
 const e=config.scores[id];return [id,new PreparedJankoWindows(e.score,c.windows!.filter((w):w is JankoScoreCandidateWindow=>'scoreId' in w&&w.scoreId===id),{...e.options,...c.options},e.tokens)];
}))]));
const no13=(id:string)=>prepared.get(id)!.get('schumann-op68-no13')!;
const refinements=CURRENT_CANDIDATES.slice(1);
test('slot quantization is translation-stable at boundaries, but allocates genuinely required extra slots',()=>{
 for(const origin of [0,248.7563412278053,308.44662274999064,-800,1e6])for(const slots of [1,2,3]){
  const gap=5.46,right=origin+2.53,left=origin-2.53-(slots-1)*gap;
  assert.equal(onsetSlotShift(right,left,.4,gap),slots*gap);
  assert.equal(onsetSlotShift(right+.0001,left,.4,gap),(slots+1)*gap);
 }
 assert.equal(onsetSlotShift(2,3,.4,5.46),0);
 assert.throws(()=>onsetSlotShift(0,0,.4,0));
});
test('Round58 is a small literal study; archive57 and56 remain addressable; quiet Bach is internal only',()=>{
 assert.equal(CURRENT_ROUND_METADATA.round,58);assert.equal(CURRENT_CANDIDATES.length,3);
 for(const c of ROUND_57_CANDIDATES)assert.equal(getCandidate(c.id),c);
 assert.ok(getCandidate('layered-crossings'));
 for(const c of CURRENT_CANDIDATES)assert.ok(c.windows!.every(w=>'scoreId' in w&&w.scoreId!=='primary'));
 assert.equal(CURRENT_CANDIDATES[0].windows!.length,1,'known broken Brahms control refused');
 for(const c of refinements)assert.equal(c.windows!.length,3,'one No13 and one Brahms passage in context + detail');
});
test('real No13 onset clusters use one necessary slot, retain fourteen values and both LH continuations',()=>{
 const source=config.scores['schumann-op68-no13'].score,events=source.notes.filter(n=>n.startTick>=3384&&n.startTick<3456);
 assert.equal(events.length,14);
 const control=no13('economical-control').containing({measureStart:39,measureCount:1})[0];
 for(const c of refinements){const p=no13(c.id),l=p.containing({measureStart:39,measureCount:1})[0];
  assert.deepEqual(l.notes.map(n=>n.note.id).sort(),control.notes.map(n=>n.note.id).sort());
  assert.deepEqual(l.rhythmicGestures!.flatMap(g=>g.values).filter(v=>v.tick>=3384&&v.tick<3456).map(v=>[v.id,v.tick,v.ticks]).sort(),events.map(n=>[n.id,n.startTick,n.durationTicks]).sort());
  for(const tick of [3360,3384,3408,3432]){
   const a=l.notes.find(n=>n.note.startTick===tick&&n.rhythm.sourceVoice==='upper.0')!,b=l.notes.find(n=>n.note.startTick===tick&&n.rhythm.sourceVoice==='upper.1')!;
   assert.ok(Math.abs(a.x-b.x-5.46)<1e-8);
   if(tick===3360||tick===3384){const old=control.notes.find(n=>n.note.id===a.note.id)!;assert.ok(Math.abs(old.x-a.x-5.46)<1e-8);}
  }
  const lh=events.filter(n=>n.startTick===3384&&n.hand==='LH'&&n.pitch.octave*12+n.pitch.pitchClass===47);
  assert.equal(lh.length,2);assert.equal(l.notes.filter(n=>lh.some(v=>v.id===n.note.id)).length,1);
  assert.deepEqual([...l.notes,...l.unisonVoices].filter(n=>lh.some(v=>v.id===n.note.id)).map(n=>n.rhythm.durationTicks).sort(),[24,48]);
  assert.deepEqual(lintJankoWindowSystems(p).violations,[]);assert.deepEqual(lintJankoWindowSystems(p).warnings,[]);
 }
});
test('compact bevel saves contour without moving corrected seats, route centerlines, owners or levels',()=>{
 for(const score of ['schumann-op68-no13','brahms-op118-no1']){
  const a=prepared.get('economical-slots')!.get(score)!,b=prepared.get('economical-bevel')!.get(score)!;
  for(const l of b.systems.values()){
   const before=a.systems.get(l.index)!;assert.deepEqual(l.notes.map(n=>[n.note.id,n.x,n.y]),before.notes.map(n=>[n.note.id,n.x,n.y]));
   const scene=buildInkScene(l,b.options,b.tokens,b.score),old=buildInkScene(before,a.options,a.tokens,a.score),bounds=systemCompleteInkBounds(l,b.options,b.tokens);
   assert.deepEqual(scene.beams.flat().filter(p=>p.shape.kind==='stem'),old.beams.flat().filter(p=>p.shape.kind==='stem'));
   assert.equal(scene.depthRoutes!.length,old.depthRoutes!.length);
   for(const [i,r] of scene.depthRoutes!.entries()){
    const prior=old.depthRoutes![i];assert.deepEqual(r.rail,prior.rail);assert.equal(r.level,prior.level);
    for(const [j,p] of r.ports.entries()){
     const q=prior.ports[j];assert.deepEqual(p.frontOwnerIds,q.frontOwnerIds);assert.deepEqual(p.front,q.front);
     assert.ok(Math.abs(p.exit-p.entry-2)<.011);assert.ok(Math.abs(q.exit-q.entry-2.7)<.011);
     assert.ok(Math.abs(p.entry-p.leftShoulder-1.2)<.011);assert.ok(Math.abs(p.rightShoulder-p.exit-1.2)<.011);
     const visible=scene.beams.flat().filter(v=>r.visibleIds.includes(v.id));
     for(const v of visible){assert.ok(beamStemBoxes({shape:p.front}).every(box=>!beamPieceIntersectsBox(v,box)));
      const box=beamPieceBox(v);assert.ok(box.y0>=bounds.top&&box.y1<=bounds.bottom);assert.ok(scene.physical.some(x=>x.what.includes(v.id)&&x.y0===box.y0&&x.y1===box.y1));
      if(v.shape.kind==='rail'){const head=v.shape.points[0],tail=v.shape.points.at(-1)!,x=head[0]+.05,y=(head[1]+tail[1])/2;
       assert.ok(beamPieceAt(v,x,y));assert.ok(sceneInkAt(scene,x,y).some(q=>q.id===v.id));}
     }
     const hidden={...r.rail,shape:{kind:'rail' as const,points:p.hidden as [number,number][]}},box=beamPieceBox(hidden),x=(p.entry+p.exit)/2,y=(box.y0+box.y1)/2;
     assert.ok(beamPieceAt(hidden,x,y));assert.ok(visible.every(v=>!beamPieceAt(v,x,y)));
    }
   }
   // Do not allow the timing improvement to run a real stroke through a
   // foreign head enclosure. Shared attacks exempt only their actual owners.
   for(const stem of [...scene.beams.flat(),...Array.from(scene.solos.values()).flat()].filter(v=>v.shape.kind==='stem'))for(const n of l.notes){
    const owners=l.unisonMerges.filter(m=>m.survivorId===n.note.id).flatMap(m=>m.mergedIds);
    if(stem.ownerIds.includes(n.note.id)||owners.some(id=>stem.ownerIds.includes(id)))continue;
    const m=knockoutHalfExtents(b.options,b.tokens,n.note.startTick,n);
    assert.equal(stem.shape.kind,'stem');if(stem.shape.kind!=='stem')continue;
    assert.ok(beamStemBoxes({shape:stem.shape}).every(box=>Math.min(box.x1,n.x+m.wx)<=Math.max(box.x0,n.x-m.wx)||Math.min(box.y1,n.y+m.hy)<=Math.max(box.y0,n.y-m.hy)),`foreign enclosure ${n.note.id}`);
   }
   for(const beam of l.beams)assert.equal(beam.direction,beam.notes[0].hand==='RH'?-1:1);
  }
 }
});
test('Brahms routine projection defects fixed: tie-owned sharing, distinct unequal values and two genuine level1 contacts',()=>{
 const e=config.scores['brahms-op118-no1'],snapshot=JSON.stringify(e.score);
 for(const c of refinements){const p=prepared.get(c.id)!.get(e.id)!,l=p.systems.get(16)!,scene=buildInkScene(l,p.options,p.tokens,p.score);
  assert.deepEqual([...p.systems.keys()],[15,16]);assert.deepEqual(lintJankoWindowSystems(p).violations,[]);assert.deepEqual(lintJankoWindowSystems(p).warnings,[]);
  for(const [a,b,survivor] of [['900','901','901'],['908','909','909']]){
   const ids=[a,b].map(n=>`brahms-op118-no1-${n}`),m=l.unisonMerges.find(m=>[m.survivorId,...m.mergedIds].includes(ids[0]))!;
   assert.deepEqual([m.survivorId,...m.mergedIds].sort(),ids);assert.equal(m.survivorId,`brahms-op118-no1-${survivor}`);assert.equal(m.exact,true);
   assert.equal(l.notes.filter(n=>ids.includes(n.note.id)).length,1);
  }
  const independent=l.notes.filter(n=>['brahms-op118-no1-910','brahms-op118-no1-911'].includes(n.note.id));
  assert.equal(independent.length,2);assert.deepEqual(independent.map(n=>n.rhythm.durationTicks).sort(),[24,48]);
  const routes=scene.depthRoutes!;assert.equal(routes.length,2);assert.ok(routes.every(r=>r.level===1));
  assert.deepEqual(routes.flatMap(r=>r.ports.flatMap(p=>p.frontOwnerIds)),['brahms-op118-no1-899','brahms-op118-no1-911']);
  assert.ok(routes[0].rail.ownerIds.includes('brahms-op118-no1-897'));assert.ok(routes[0].rail.ownerIds.includes('brahms-op118-no1-900'));
  assert.deepEqual(routes[1].rail.ownerIds,['brahms-op118-no1-910','brahms-op118-no1-912']);
  const values=[...p.systems.values()].flatMap(l=>l.rhythmicGestures!.flatMap(g=>g.values));
  for(const n of e.score.notes.filter(n=>n.startTick>=12336&&n.startTick<12720))assert.ok(values.some(v=>v.id===n.id&&v.tick===n.startTick),'each source obligation retained');
  assert.match(renderPreparedJankoWindow(p,{measureStart:65,measureCount:2}),/janko-depth-/);
 }
 assert.equal(JSON.stringify(e.score),snapshot);
});
test('Bach quiet temporal guard has no depth ports; no claim of association repair',()=>{
 const e=config.scores.primary;
 for(const c of CURRENT_CANDIDATES){const p=new PreparedJankoWindows(e.score,[{measureStart:13,measureCount:2}],{...e.options,...c.options},e.tokens);
  assert.ok([...p.systems.values()].every(l=>!buildInkScene(l,p.options,p.tokens,p.score).depthRoutes!.length));assert.deepEqual(lintJankoWindowSystems(p).violations,[]);
 }
});
