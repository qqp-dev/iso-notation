import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_CANDIDATES, ROUND_56_CANDIDATES, getCandidate } from '../src/render/janko/candidates';
import { createStudioConfig } from '../src/render/janko/studio';
import { PreparedJankoWindows, renderPreparedJankoWindow } from '../src/render/janko/prepared-windows';
import { buildInkScene, sceneInkAt } from '../src/render/janko/ink-scene';
import { lintJankoWindowSystems } from '../src/render/janko/linter';
import { beamPieceAt, beamPieceBox, beamPieceIntersectsBox, beamStemBoxes, placedBeamGroup, routeVoiceOverpasses } from '../src/render/janko/beam-scene';
import { systemCompleteInkBounds } from '../src/render/janko/engine';
const entry=createStudioConfig().scores['schumann-op68-no13'];
const snapshot=JSON.stringify(entry.score);
const windows=[{measureStart:38,measureCount:3},{measureStart:26,measureCount:3},{measureStart:9,measureCount:3}];
const prepared=new Map(CURRENT_CANDIDATES.map(c=>[c.id,new PreparedJankoWindows(entry.score,windows,{...entry.options,...c.options},entry.tokens)]));
test('three curated profiles retain historical family evidence and source-exact m39',()=>{
 assert.equal(CURRENT_CANDIDATES.length,3);assert.equal(ROUND_56_CANDIDATES.filter(c=>!c.rejection&&c.id!=='hand-control').length,7);
 assert.equal(getCandidate('layered-crossings'),ROUND_56_CANDIDATES.find(c=>c.id==='layered-crossings'));
 const source=entry.score.notes.filter(n=>n.startTick>=3384&&n.startTick<3456);
 assert.equal(source.length,14);assert.equal(entry.score.sourceBarTicks![39]-entry.score.sourceBarTicks![38],72);
 for(const [id,p] of prepared){
  const l=p.containing({measureStart:39,measureCount:1})[0];
  assert.deepEqual(l.rhythmicGestures!.flatMap(g=>g.values).filter(v=>v.tick>=3384&&v.tick<3456).map(v=>[v.id,v.tick,v.ticks]).sort(),source.map(n=>[n.id,n.startTick,n.durationTicks]).sort(),id);
  const lh=source.filter(n=>n.hand==='LH'&&n.startTick===3384&&n.pitch.octave*12+n.pitch.pitchClass===47);
  assert.equal(l.notes.filter(n=>lh.some(s=>s.id===n.note.id)).length,1);
  assert.deepEqual([...l.notes,...l.unisonVoices].filter(n=>lh.some(s=>s.id===n.note.id)).map(n=>n.rhythm.durationTicks).sort(),[24,48]);
  const last=source.filter(n=>n.hand==='LH'&&n.startTick===3432&&n.pitch.octave*12+n.pitch.pitchClass===52);assert.equal(last.length,2);
  for(const n of last)assert.ok(l.notes.some(p=>p.note.id===n.id)||l.unisonMerges.some(m=>m.mergedIds.includes(n.id)));
  const report=lintJankoWindowSystems(p);assert.deepEqual(report.violations,[],id);assert.deepEqual(report.warnings,[],id);
 }
 assert.equal(JSON.stringify(entry.score),snapshot);
});
test('fitted paired profiles derive visible ink and hidden continuation from actual owners, not shading',()=>{
 for(const [id,p] of prepared){if(id==='depth-flat')continue;
  const scenes=[...p.systems.values()].map(l=>({l,scene:buildInkScene(l,p.options,p.tokens,p.score)}));
  assert.ok(scenes.some(s=>s.scene.depthRoutes?.length));
  for(const {l,scene} of scenes){const bounds=systemCompleteInkBounds(l,p.options,p.tokens);
   // Independent cross-sections of the painted polygons: no fused levels or
   // extra cap/flag strokes disguised as a depth face.
   const section=(points:readonly [number,number][],x:number)=>points.flatMap((a,i)=>{const b=points[(i+1)%points.length];return a[0]!==b[0]&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])?[a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])]:[];});
   for(const group of scene.beams)for(const a of group)for(const b of group){if(a.shape.kind!=='rail'||b.shape.kind!=='rail'||(a.level??1)>=(b.level??1))continue;
    const lo=Math.max(beamPieceBox(a).x0,beamPieceBox(b).x0),hi=Math.min(beamPieceBox(a).x1,beamPieceBox(b).x1);
    if(lo>=hi)continue;
    const xs=[lo,hi,...a.shape.points.map(v=>v[0]),...b.shape.points.map(v=>v[0])].filter(x=>x>=lo&&x<=hi).sort((a,b)=>a-b);
    for(let k=1;k<xs.length;k++){const x=(xs[k-1]+xs[k])/2,ay=section(a.shape.points,x),by=section(b.shape.points,x);if(!ay.length||!by.length)continue;
     assert.ok(Math.max(Math.min(...ay)-Math.max(...by),Math.min(...by)-Math.max(...ay))>=1.5,'visible value levels retain separation');
    }
   }
   for(const route of scene.depthRoutes??[]){assert.ok(route.ports.length);assert.equal(route.level,route.rail.level);
    const visible=scene.beams.flat().filter(v=>route.visibleIds.includes(v.id));assert.equal(visible.length,route.ports.length+1);
    for(const port of route.ports){assert.ok(port.hidden.length>=4);assert.ok(port.frontOwnerIds.length);
     assert.ok(beamStemBoxes({shape:port.front}).some(b=>beamPieceIntersectsBox(route.rail,b)));
     assert.ok(port.entry<port.front.x&&port.exit>port.front.x);
     for(const v of visible)assert.ok(!beamStemBoxes({shape:port.front}).some(b=>beamPieceIntersectsBox(v,b)),'full foreground stem has air');
     const hidden={...route.rail,shape:{kind:'rail' as const,points:port.hidden as [number,number][]}};
     const b=beamPieceBox(hidden),x=(port.entry+port.exit)/2,y=(b.y0+b.y1)/2;
     assert.ok(beamPieceAt(hidden,x,y),'hidden route is geometrically continuous');
     assert.ok(visible.every(v=>!beamPieceAt(v,x,y)),'hidden continuation is not painted');
    }
    for(const v of visible){assert.match(v.svg,/fill="#111111"/);assert.ok(!v.svg.includes('white'));const b=beamPieceBox(v);assert.ok(b.y0>=bounds.top&&b.y1<=bounds.bottom);
     assert.ok(scene.physical.some(q=>q.what.includes(v.id)&&q.y0===b.y0&&q.y1===b.y1));
     if(v.shape.kind==='rail'){const a=v.shape.points[0],z=v.shape.points.at(-1)!,x=a[0]+.05,y=(a[1]+z[1])/2;
      assert.ok(beamPieceAt(v,x,y));assert.ok(sceneInkAt(scene,x,y).some(q=>q.id===v.id),'same polygons reach physical query');}
    }
   }
  }
  assert.match(renderPreparedJankoWindow(p,windows[0],true),new RegExp(`janko-depth-${p.options.depthProfile}`));
 }
});
test('all profiles preserve exact head/onset seats and whole direct-hand stems; order reverses in context',()=>{
 const flat=prepared.get('depth-flat')!;
 for(const [id,p] of prepared){
  for(const l of p.systems.values()){const control=flat.systems.get(l.index)!;
   assert.deepEqual(l.notes.map(n=>[n.note.id,n.x,n.y]),control.notes.map(n=>[n.note.id,n.x,n.y]),id);
   const scene=buildInkScene(l,p.options,p.tokens,p.score),before=buildInkScene(control,flat.options,flat.tokens,flat.score);
   assert.deepEqual(scene.beams.flat().filter(v=>v.shape.kind==='stem').map(v=>v.shape),before.beams.flat().filter(v=>v.shape.kind==='stem').map(v=>v.shape));
   for(const b of l.beams)assert.equal(b.direction,b.notes[0].hand==='RH'?-1:1);
  }
  if(id==='depth-flat')continue;
  const routes=[...p.systems.values()].flatMap(l=>buildInkScene(l,p.options,p.tokens,p.score).depthRoutes??[]);
  const notes=[...p.systems.values()].flatMap(l=>[...l.beams.flatMap(b=>b.notes),...l.ungrouped]);
  const witnesses=routes.flatMap(r=>r.ports.map(port=>({level:r.level,behind:r.rail.sourceContributors[0]?.sourceProvenance?.voices,front:notes.find(n=>port.frontOwnerIds.includes(n.id))})));
  for(const [tick,voice] of [[3288,'upper.0'],[3312,'upper.0'],[3360,'upper.1'],[3384,'upper.0'],[3408,'upper.0'],[2304,'upper.0']] as const)
   assert.ok(witnesses.some(w=>w.front?.startTick===tick&&w.front.sourceVoice===voice),`${id}: actual foreground ${voice} at ${tick}`);
  for(const level of [1,2])assert.ok(witnesses.some(w=>w.front?.startTick===2304&&w.level===level));
  assert.ok(witnesses.some(w=>w.front?.sourceVoice==='upper.1'&&w.front.startTick>=p.score.sourceBarTicks![9]&&w.front.startTick<p.score.sourceBarTicks![10]));
 }
});
test('profile construction refuses overlapping ports, lost own joins and short rail remnants',()=>{
 const p=prepared.get('depth-dive')!,l=p.containing({measureStart:39,measureCount:1})[0];
 const scene=buildInkScene(l,p.options,p.tokens,p.score),r=scene.depthRoutes![0];
 const groups=()=>l.beams.map(b=>placedBeamGroup(b,p.tokens,p.options.durationGrammar,l.index,0));
 const original=r.rail,box=beamPieceBox(original),raw=groups(),own=raw.flat().find(q=>q.groupId===original.groupId&&q.shape.kind==='stem')!;
 assert.equal(own.shape.kind,'stem');if(own.shape.kind!=='stem')return;
 const ownX=own.shape.x;
 const fake=(x:number)=>({id:'negative-geometry-fixture',ownerIds:['not-a-source-event'],hand:'RH' as const,shape:{kind:'stem' as const,x,y1:box.y0-10,y2:box.y1+10,width:.9}});
 assert.throws(()=>routeVoiceOverpasses(groups(),l.beams,p.tokens,[fake(ownX)],'dive'),/own join|overlapping ports/);
 assert.throws(()=>routeVoiceOverpasses(groups(),l.beams,p.tokens,[fake(box.x0+.2)],'dive'),/short visible rail/);
 assert.throws(()=>routeVoiceOverpasses(groups(),l.beams,p.tokens,[fake(r.ports[0].front.x+.2)],'dive'),/overlapping ports/);
});
test('Bach temporal guard remains byte-identical to flat G, with no depth ports',()=>{
 const bach=createStudioConfig().scores.primary;
 const flat=new PreparedJankoWindows(bach.score,[{measureStart:13,measureCount:2}],{...bach.options,...CURRENT_CANDIDATES[0].options},bach.tokens);
 for(const c of CURRENT_CANDIDATES.slice(1)){const p=new PreparedJankoWindows(bach.score,[{measureStart:13,measureCount:2}],{...bach.options,...c.options},bach.tokens);
  for(const l of p.systems.values()){const s=buildInkScene(l,p.options,p.tokens,p.score),b=buildInkScene(flat.systems.get(l.index)!,flat.options,flat.tokens,flat.score);
   assert.deepEqual(s.depthRoutes,[]);assert.deepEqual(s.beams,b.beams);
  }
  assert.deepEqual(lintJankoWindowSystems(p).violations,[]);
 }
});
