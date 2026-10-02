import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSchumannNo14Draft} from '../src/scores/schumann-no14-draft';
import {placeExpressions,expressionIntersectsBox,expressionStrokeBounds} from '../src/render/janko/elements/expressions';
test('fuller No14 hairpins preserve source apertures/continuations and expose their actual stroke width',()=>{
 const base=buildSchumannNo14Draft();
 for(const mark of base.dynamics.filter(e=>e.kind==='hairpin'&&[576,1008,2904].includes(e.tick))){
  const start=mark.tick+24,end=mark.tick+mark.durationTicks!-24,p={start,end,left:10,right:110,top:0,bottom:10,x:(tick:number)=>10+(tick-start)*100/(end-start),endpointX:()=>10};
  const score={...base,phrases:[],dynamics:[mark]},narrow=placeExpressions(score,{...p,hairpinStrokeWidth:.65}),wide=placeExpressions(score,{...p,hairpinStrokeWidth:1}),a=narrow.find(q=>q.kind==='hairpin')!,b=wide.find(q=>q.kind==='hairpin')!;
  assert.ok(a&&b);assert.deepEqual([a.startTick,a.endTick,a.continuationStart,a.continuationEnd],[mark.tick,mark.tick+mark.durationTicks!,true,true]);
  assert.deepEqual([b.startTick,b.endTick,b.continuationStart,b.continuationEnd],[a.startTick,a.endTick,true,true]);
  assert.equal(a.svg.match(/\bd="([^"]+)"/)![1],b.svg.match(/\bd="([^"]+)"/)![1],'width changes neither source aperture nor painted centerlines');
  const line=a.strokeSegments![0],dx=line.x1-line.x0,dy=line.y1-line.y0,length=Math.hypot(dx,dy),x=(line.x0+line.x1)/2-dy*.4/length,y=(line.y0+line.y1)/2+dx*.4/length,box={x0:x-.005,x1:x+.005,y0:y-.005,y1:y+.005};
  assert.equal(expressionIntersectsBox(a,box),false,'0.65pt query stops at its painted edge');assert.equal(expressionIntersectsBox(b,box),true,'1.0pt query includes the newly painted ink');
  const gapY=(a.strokeSegments![0].y0+a.strokeSegments![1].y0)/2;assert.equal(expressionIntersectsBox(b,{x0:59.99,x1:60.01,y0:gapY-.01,y1:gapY+.01}),false,'empty wedge interior is not filled query ink');
  assert.ok(Math.abs((b.y1-a.y1)-.175)<1e-8);assert.ok(Math.abs((a.x0-b.x0)-.175)<1e-8,'admission expands with actual half-width');
  for(const s of b.strokeSegments!){const bounds=expressionStrokeBounds(s);assert.ok(bounds.x0>=b.x0&&bounds.x1<=b.x1&&bounds.y0>=b.y0&&bounds.y1<=b.y1);}
  for(const q of wide.filter(q=>q.kind==='pedal'))assert.match(q.svg,/stroke-width="0\.65"/);
  assert.deepEqual(wide.filter(q=>q.kind==='pedal').map(q=>[q.id,q.startTick,q.endTick,q.continuationStart,q.continuationEnd]),narrow.filter(q=>q.kind==='pedal').map(q=>[q.id,q.startTick,q.endTick,q.continuationStart,q.continuationEnd]));
 }
});
