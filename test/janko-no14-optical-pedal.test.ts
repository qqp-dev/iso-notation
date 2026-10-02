import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14OpticalProfile,no14HeadDotProfile,NO14_HEAD_DOT_DELTA} from '../src/render/janko/no14-practice';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {lintJankoWindowSystems} from '../src/render/janko/linter';
import {balancedBowIsCoherent} from '../src/render/janko/balanced-phrases';
import {sourceOpticalPhraseDomain} from '../src/render/janko/optical-phrase-domain';
import {placeExpressions,expressionIntersectsBox} from '../src/render/janko/elements/expressions';
import {pedalStartInk} from '../src/render/janko/elements/pedal-starts';
import {NO14_OPTICAL_PEDAL_CANDIDATES} from '../src/render/janko/candidates';
const e=no14OpticalProfile();
test('complete optical bows retain all 96 exact source owners, admitted tips and coherent healthy shapes',()=>{
 const p=new PreparedJankoWindows(e.score,[{measureStart:1,measureCount:96}],e.options,e.tokens),r=lintJankoWindowSystems(p);
 assert.equal(r.violations.length,0,JSON.stringify(r.violations));assert.equal(r.warnings.length,0);
 const curves=[...p.systems.values()].flatMap(l=>l.expressions!.filter(q=>q.kind==='phrase'));
 assert.equal(curves.length,96);
 for(const l of p.systems.values())for(const q of l.expressions!.filter(q=>q.kind==='phrase')){
  const f=e.score.phrases!.find(f=>f.id===q.id)!,d=sourceOpticalPhraseDomain(e.score,l,f,e.options,e.tokens)!;
  assert.deepEqual([q.startTick,q.endTick,q.endpointIds],[f.startTick,f.endTick,[f.fromNoteIds,f.toNoteIds]]);
  assert.equal(q.routingIssue,undefined);assert.ok(balancedBowIsCoherent(q.contour!));assert.match(q.svg,/data-bow="optical-gesture"/);
  for(const [a,x,y] of [[d.start,q.contour!.xStart,q.contour!.yStart],[d.end,q.contour!.xEnd,q.contour!.yEnd]] as const){assert.ok(x>=a.x0&&x<=a.x1&&y>=a.y0&&y<=a.y1);}
 }
 for(const m of [48,80])assert.equal(curves.filter(q=>q.startTick===(m-1)*144).length,2);
 const cross=curves.find(q=>q.startTick===62*144)!;assert.equal(cross.endTick,63*144);assert.notDeepEqual(cross.endpointIds![0],cross.endpointIds![1]);
 const first=curves.find(q=>q.startTick===0)!.contour!;assert.equal(first.yEnd-first.yStart,-17.5,'whole bow follows pitch rather than unrelated duration-tip slope');
 assert.equal(first.thickness,.85);assert.equal(first.tipThickness,.22);
});
test('pedal start outlines use faithful glyph ink and a separate middle-height hold line, without inventing continuation presses',()=>{
 const score={...e.score,notes:[],phrases:[],dynamics:[],totalTicks:300,pedals:[{tick:0,type:'sustain-down' as const},{tick:60,type:'sustain-change' as const},{tick:180,type:'sustain-up' as const},{tick:200,type:'sustain-down' as const},{tick:280,type:'sustain-up' as const}]};
 const p={start:100,end:240,left:10,right:80,top:0,bottom:20,x:(t:number)=>10+(t-100)/2,endpointX:(_ids:string[],t:number)=>t};
 for(const style of ['ornate-p','pictogram'] as const){
  const ink=placeExpressions(score,{...p,pedalStart:style}),qs=ink.filter(q=>q.kind==='pedal');
  assert.deepEqual(qs.map(q=>[q.continuationStart,q.continuationEnd]),[[true,false],[false,true]]);
  assert.equal(qs[0].pedalStartInk,undefined);assert.doesNotMatch(qs[0].svg,/janko-pedal-start/);
  const s=qs[1].pedalStartInk!;assert.equal(s.tick,200);assert.match(s.svg,new RegExp(`data-pedal-start="${style}"`));
  assert.ok(qs[0].x1<qs[1].x0,'true gap remains open');assert.ok(qs.every(q=>q.strokeSegments!.every(s=>s.width===.65)));
  assert.ok(Math.abs(qs[1].strokeSegments![0].y0-(s.y0+s.y1)/2)<.001);
  const painted=s.polygons[0].find(p=>p[0]>s.x0+.5&&p[0]<s.x1-.5)!;
  assert.ok(expressionIntersectsBox(qs[1],{x0:painted[0]-.03,x1:painted[0]+.03,y0:painted[1]-.03,y1:painted[1]+.03}),'physical query includes true outline ink');
  const glyph=pedalStartInk(style,0,'pedal-0',20,30);assert.ok(Math.abs(glyph.y1-glyph.y0-7.2)<1e-8);
  assert.equal(expressionIntersectsBox({...qs[1],x0:-100,x1:1000,y0:-100,y1:1000},{x0:900,x1:901,y0:900,y1:901}),false,'admitted empty air is not painted ink');
 }
});
test('four full-score cards retain the historical control and isolate the two pedal starts',()=>{
 assert.equal(NO14_OPTICAL_PEDAL_CANDIDATES.length,4);assert.deepEqual(NO14_OPTICAL_PEDAL_CANDIDATES[0].options,NO14_HEAD_DOT_DELTA);
 for(const c of NO14_OPTICAL_PEDAL_CANDIDATES){assert.equal(c.download,undefined);assert.ok(c.windows!.some(w=>'fullScore' in w&&w.fullScore&&w.measureCount===64));for(const m of [1,4,16,20,32,41,43,48,63])assert.ok(c.windows!.some(w=>'measureStart' in w&&w.measureStart===m));}
 for(const field of ['notes','phrases','dynamics','pedals'] as const)assert.deepEqual(e.score[field],no14HeadDotProfile().score[field]);
});
