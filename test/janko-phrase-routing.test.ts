import {test} from 'node:test';
import assert from 'node:assert/strict';
import {taperedSpanPath} from '../src/render/janko/ties';
import {expressionSliceAtX,expressionIntersectsBox,type ExpressionInk} from '../src/render/janko/elements/expressions';
import {placeExpressions} from '../src/render/janko/elements/expressions';
import {createStudioConfig} from '../src/render/janko/studio';
import {CURRENT_CANDIDATES,CURRENT_ROUND_METADATA,ROUND_59_CANDIDATES,getCandidate} from '../src/render/janko/candidates';
import {PreparedJankoWindows,renderPreparedJankoWindow} from '../src/render/janko/prepared-windows';
import {lintJankoWindowSystems} from '../src/render/janko/linter';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {knockoutHalfExtents} from '../src/render/janko/engine';
import {sourcePhraseEndpointEnvelope,phraseMusicObstacles} from '../src/render/janko/expression-anchors';
import {getStemGeometry} from '../src/render/janko/elements/rhythm';

test('unchanged span controls preserve literal legacy tapered ink',()=>{
 assert.equal(taperedSpanPath(10,20,90,30,-1,6,.45,16.8),
  'M 10.00 20.00 C 26.80 12.00 73.20 22.00 90.00 30.00 L 90.00 30.00 C 73.20 22.60 26.80 12.60 10.00 20.00 Z');
});

const config=createStudioConfig(),entry=config.scores['schumann-op68-no13'];
const window={measureStart:38,measureCount:3},source=JSON.stringify(entry.score);
const prepared=CURRENT_CANDIDATES.map(c=>new PreparedJankoWindows(entry.score,[window],{...entry.options,...c.options},entry.tokens));
const layouts=prepared.map(p=>[...p.systems.values()][0]);
const bareId='13-Mai-cher-Mai.ly:241:43:lower.1:47:1',movingId='13-Mai-cher-Mai.ly:241:16:lower.0:47:1';
test('literal No13 retains its source and aligned heads while all curves earn local routes',()=>{
 assert.equal(CURRENT_ROUND_METADATA.round,60);assert.equal(CURRENT_CANDIDATES.length,4);
 assert.deepEqual(CURRENT_CANDIDATES.map(c=>c.id),['joint-compact','local-phrasing','shared-b-short','shared-b-long']);
 assert.deepEqual(CURRENT_CANDIDATES[0].options,ROUND_59_CANDIDATES[1].options);assert.ok(getCandidate('joint-control'));
 const headIdentity=(l:typeof layouts[number])=>[...l.notes,...l.unisonVoices].map(n=>({note:n.note,x:n.x,y:n.y,offset:n.rhythm.stemOffsetX}));
 const expressionIdentity=(l:typeof layouts[number])=>l.expressions!.filter(q=>q.kind==='phrase').map(q=>({id:q.id,ids:q.endpointIds,start:q.startTick,end:q.endTick,side:q.contour!.side}));
 for(let i=1;i<prepared.length;i++){
  assert.deepEqual(headIdentity(layouts[i]),headIdentity(layouts[0]));
  const routes=(l:typeof layouts[number])=>l.beams.map(({beamY,...b})=>({...b,tipYs:b.stems.map(s=>beamY(s.stemX))}));
  assert.deepEqual(routes(layouts[i]),routes(layouts[0]));
  assert.deepEqual(expressionIdentity(layouts[i]),expressionIdentity(layouts[0]));
  assert.equal(layouts[i].expressions!.filter(q=>q.kind==='phrase').length,12);
  assert.ok(layouts[i].expressions!.every(q=>!q.routingIssue));
  const lint=lintJankoWindowSystems(prepared[i]);assert.deepEqual(lint.violations,[]);assert.deepEqual(lint.warnings,[]);
  const slur=layouts[i].expressions!.find(q=>q.id==='13-Mai-cher-Mai.ly:241:16:lower.0:slur:1')!;
  const B=layouts[i].notes.find(n=>n.note.id===bareId)!;
  assert.ok(B.y-slur.contour!.yStart<8,'moving source curve starts near its shared B, not in unrelated RH territory');
  assert.ok(slur.contour!.startDepth!==slur.contour!.endDepth,'changing corridor requires an asymmetric shape');
  assert.match(renderPreparedJankoWindow(prepared[i],window,true),/janko-phrase/);
 }
 assert.equal(JSON.stringify(entry.score),source);
});
test('short and long B have independent truthful quarter terminals and one compatible final4',()=>{
 const tips=layouts.map(l=>getStemGeometry(l.ungrouped.find(n=>n.id===bareId)!,prepared[0].tokens).stemEndY);
 assert.ok(tips[2]<tips[1]-4);assert.ok(tips[3]>tips[1]+4);
 for(let i=1;i<prepared.length;i++){
  const l=layouts[i],p=prepared[i],scene=buildInkScene(l,p.options,p.tokens,p.score),quarter=scene.solos.get(bareId)!;
  assert.deepEqual(quarter[0].ownerIds,[bareId]);assert.ok(!quarter.some(q=>q.shape.kind==='flag'));
  const B=[...l.notes,...l.unisonVoices].filter(n=>[bareId,movingId].includes(n.note.id));
  assert.deepEqual(B.map(n=>n.rhythm.durationTicks).sort(),[24,48]);
  const E=l.unisonMerges.find(m=>m.tick===3432)!;assert.equal(E.exact,true);
  assert.equal(scene.soloAliases!.get(E.mergedIds[0]),E.survivorId);
  assert.equal(scene.solos.get(E.mergedIds[0]),scene.solos.get(E.survivorId));
  assert.deepEqual(scene.solos.get(E.survivorId)![0].ownerIds,[E.survivorId,...E.mergedIds]);
 }
});
test('literal local phrase planning is source-order and coordinate-translation stable',()=>{
 const p=prepared[1],l=layouts[1],musical=[...phraseMusicObstacles(l,p.options,p.tokens),...l.notes.map(n=>{const m=knockoutHalfExtents(p.options,p.tokens,n.note.startTick,n);return {x0:n.x-m.wx,x1:n.x+m.wx,y0:n.y-m.hy,y1:n.y+m.hy};})];
 const run=(dx:number,dy:number,reverse=false)=>placeExpressions({...entry.score,dynamics:[],pedals:[],phrases:reverse?[...entry.score.phrases!].reverse():entry.score.phrases},{start:3288,end:3480,left:l.geometry.staffLeft+dx,right:l.geometry.staffRight+dx,top:dy,bottom:300+dy,phraseRouting:'local',clarity:true,
  x:tick=>(l.columns.get(tick)??0)+dx,endpointX:(ids,tick)=>([...l.notes,...l.unisonVoices].find(n=>ids.includes(n.note.id)&&n.note.startTick===tick)?.x??l.columns.get(tick)??0)+dx,
  endpointEnvelope:(ids,tick)=>{const q=sourcePhraseEndpointEnvelope(l,ids,tick,p.options,p.tokens);return q?{...q,top:q.top+dy,bottom:q.bottom+dy}:undefined;},
  obstacles:musical.map(q=>({...q,x0:q.x0+dx,x1:q.x1+dx,y0:q.y0+dy,y1:q.y1+dy}))}).sort((a,b)=>a.id.localeCompare(b.id));
 const initial=run(0,0),reversed=run(0,0,true),moved=run(800,-60,true);
 assert.deepEqual(reversed,initial);
 for(let i=0;i<initial.length;i++){
  assert.equal(moved[i].routingIssue,undefined);const a=initial[i].contour!,b=moved[i].contour!;
  for(const key of ['xStart','xEnd','yStart','yEnd','depth','startDepth','endDepth','startIndent','endIndent'] as const){const delta=key.startsWith('x')?800:key.startsWith('y')?-60:0;assert.ok(Math.abs(b[key]!-a[key]!-delta)<1e-8,`${initial[i].id} ${key}`);}
 }
});

test('held/moving Brahms and quiet Bach preserve source obligations under both terminal rules',()=>{
 for(const scoreId of ['brahms-op118-no1','primary']){
  const e=config.scores[scoreId],w=scoreId==='primary'?{measureStart:13,measureCount:2}:{measureStart:64,measureCount:4},original=JSON.stringify(e.score);
  const old=new PreparedJankoWindows(e.score,[w],{...e.options,...ROUND_59_CANDIDATES[1].options},e.tokens);
  for(const c of CURRENT_CANDIDATES.slice(2)){
   const p=new PreparedJankoWindows(e.score,[w],{...e.options,...c.options},e.tokens);
   for(const [index,l] of p.systems){const before=old.systems.get(index)!;
    assert.deepEqual(l.tieChains,before.tieChains);assert.deepEqual(l.tieArcs,before.tieArcs);assert.deepEqual(l.unisonMerges,before.unisonMerges);
    assert.deepEqual([...l.notes,...l.unisonVoices].map(n=>({note:n.note,x:n.x,y:n.y})),[...before.notes,...before.unisonVoices].map(n=>({note:n.note,x:n.x,y:n.y})));
   }
   const lint=lintJankoWindowSystems(p);assert.deepEqual(lint.violations,[]);assert.deepEqual(lint.warnings,[]);
  }
  assert.equal(JSON.stringify(e.score),original);
 }
});

test('asymmetric painted controls and positive ribbon queries agree at an independently calculated point',()=>{
 const contour={xStart:10,xEnd:90,yStart:20,yEnd:30,side:-1 as const,depth:6,thickness:.45,indent:16.8,startDepth:9,endDepth:1.5,startIndent:12,endIndent:10};
 const q:ExpressionInk={kind:'phrase',id:'physical',x0:9.4,x1:90.6,y0:7.4,y1:30.6,startTick:0,endTick:48,continuationStart:false,continuationEnd:false,svg:'',contour};
 assert.equal(taperedSpanPath(10,20,90,30,-1,6,.45,16.8,contour),
  'M 10.00 20.00 C 22.00 8.00 80.00 28.00 90.00 30.00 L 90.00 30.00 C 80.00 28.60 22.00 8.60 10.00 20.00 Z');
 const slice=expressionSliceAtX(q,50.75)!;
 assert.ok(Math.abs(slice[0]-19.75)<1e-7);assert.ok(Math.abs(slice[1]-20.2)<1e-7);
 assert.ok(expressionIntersectsBox(q,{x0:50.7,x1:50.8,y0:19.8,y1:20.1}));
 assert.equal(expressionIntersectsBox(q,{x0:50.7,x1:50.8,y0:22,y1:23}),false,'empty enclosure is not ribbon ink');
 const moved={...q,x0:q.x0+200,x1:q.x1+200,y0:q.y0-100,y1:q.y1-100,contour:{...contour,xStart:210,xEnd:290,yStart:-80,yEnd:-70}};
 const translated=expressionSliceAtX(moved,250.75)!;
 assert.ok(Math.abs(translated[0]-(slice[0]-100))<1e-7);assert.ok(Math.abs(translated[1]-(slice[1]-100))<1e-7);
 assert.ok(expressionIntersectsBox(moved,{x0:250.7,x1:250.8,y0:-80.2,y1:-79.9}));
});
