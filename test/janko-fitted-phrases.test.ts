import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expressionContourOutwardShift,prepareExpressionOutwardFit,type ExpressionInk,type ExpressionPlacement} from '../src/render/janko/elements/expressions';
import {expressionIntersectsBox as referenceBox} from './support/expression-query-reference';
import {opticalPhraseCandidates,routeOpticalPhrases} from '../src/render/janko/optical-phrases';
import {balancedBowIsCoherent} from '../src/render/janko/balanced-phrases';
import type {OpticalPhraseDomain} from '../src/render/janko/optical-phrase-domain';
import type {QuantizedGridScore} from '../src/model/types';

const fixture=JSON.parse(readFileSync(new URL('./support/no14-optical-pool-reference.json',import.meta.url),'utf8')) as {obstacles:NonNullable<ExpressionPlacement['obstacles']>;pools:{base:ExpressionInk;domain:OpticalPhraseDomain}[]};
const expanded=fixture.obstacles.map(b=>({x0:b.x0-1.5,x1:b.x1+1.5,y0:b.y0-1.5,y1:b.y1+1.5}));
const placement=(row:typeof fixture.pools[number]):ExpressionPlacement=>({start:0,end:576,left:0,right:600,top:0,bottom:500,x:x=>x,endpointX:(_ids,x)=>x,obstacles:fixture.obstacles,opticalDomain:()=>row.domain,phraseRouting:'optical-fitted'});

test('complete dense-ribbon fit clears independent physical query, including expanded x edges and scalar mutation',()=>{
 for(const side of [-1,1] as const)for(const tilt of [-35,0,43]){
  const c:NonNullable<ExpressionInk['contour']>={xStart:0,xEnd:100,yStart:20,yEnd:20+tilt,side,depth:16,thickness:.85,tipThickness:.22,indent:28,chordAligned:true};
  const boxes=[{x0:-1,x1:1.2,y0:15,y1:35},{x0:34.7,x1:45.4,y0:0,y1:43},{x0:97.8,x1:101,y0:25,y1:60}];
  for(const change of [0,5]){
   c.startDepth=16+change;const original={...c},shift=expressionContourOutwardShift(c,boxes);
   const fit=prepareExpressionOutwardFit(c,boxes);assert.equal(expressionContourOutwardShift(c,boxes,fit),shift);
   c.startIndent=23;assert.equal(expressionContourOutwardShift(c,boxes,fit),expressionContourOutwardShift(c,boxes));delete c.startIndent;
   boxes[1].x0+=.7;assert.equal(expressionContourOutwardShift(c,boxes,fit),expressionContourOutwardShift(c,boxes));boxes[1].x0-=.7;
   assert.deepEqual(c,original,'fit computation cannot mutate source shape');
   const q:ExpressionInk={kind:'phrase',id:'probe',x0:-1000,x1:1000,y0:-1000,y1:1000,startTick:0,endTick:1,continuationStart:false,continuationEnd:false,svg:'',contour:{...c,yStart:c.yStart+side*(shift+1e-7),yEnd:c.yEnd+side*(shift+1e-7)}};
   assert.ok(boxes.every(b=>!referenceBox(q,b)));
   if(shift>.001){q.contour!.yStart-=side*.001;q.contour!.yEnd-=side*.001;assert.ok(boxes.some(b=>referenceBox(q,b)),'positive fit is determined by actual ribbon ink, not an oversized fixed lift');}
  }
 }
});

test('literal first four bars complete both-side fit before a bounded balanced shortlist; explicit source side survives',()=>{
 for(const row of fixture.pools){
  const before=JSON.stringify(row),p=placement(row),old=opticalPhraseCandidates(row.base,{...p,phraseRouting:'optical-gesture'});
  assert.ok(old.every(q=>q.ink.contour!.side===1),'recorded premature upper rejection remains the control');
  const pool=opticalPhraseCandidates(row.base,p);assert.equal(pool.length,24);
  for(const side of [-1,1] as const){
   assert.equal(pool.filter(q=>q.ink.contour!.side===side).length,12);
   const directed=opticalPhraseCandidates(row.base,{...p,phrasePlacement:'above-diagnostic'},side);assert.equal(directed.length,24);assert.ok(directed.every(q=>q.ink.contour!.side===side));
  }
  for(const q of pool){
   const c=q.ink.contour!;assert.ok(balancedBowIsCoherent(c));assert.equal(c.thickness,.85);assert.equal(c.tipThickness,.22);
   assert.ok(expanded.every(b=>!referenceBox(q.ink,b)),'same expanded physical clearance, independent reference query');
   assert.ok(c.xStart>=row.domain.start.x0&&c.xStart<=row.domain.start.x1&&c.xEnd>=row.domain.end.x0&&c.xEnd<=row.domain.end.x1);
   assert.ok(c.yStart>=row.domain.start.y0&&c.yStart<=row.domain.start.y1&&c.yEnd>=row.domain.end.y0&&c.yEnd<=row.domain.end.y1);
  }
  assert.equal(JSON.stringify(row),before);assert.equal(opticalPhraseCandidates(row.base,{...p,phrasePlacement:'above-diagnostic'})[0].ink.contour!.side,-1);
 }
});

test('weak local musical-ink balance changes a symmetric choice without becoming a source-side rule or using outside-span ink',()=>{
 const base:ExpressionInk={...fixture.pools[0].base,id:'balance'},domain:OpticalPhraseDomain={start:{x:0,y:0,x0:0,x1:4,y0:-40,y1:40},end:{x:100,y:0,x0:96,x1:100,y0:-40,y1:40},span:100,pitchRange:0};
 const p:ExpressionPlacement={...placement(fixture.pools[0]),obstacles:[{x0:0,x1:100,y0:-2,y1:2}],opticalDomain:()=>domain};
 const above=[{x0:20,x1:80,y0:-18,y1:-10}],below=[{x0:20,x1:80,y0:10,y1:18}];
 assert.equal(opticalPhraseCandidates(base,{...p,balanceObstacles:above})[0].ink.contour!.side,1);
 assert.equal(opticalPhraseCandidates(base,{...p,balanceObstacles:below})[0].ink.contour!.side,-1);
 assert.deepEqual(opticalPhraseCandidates(base,{...p,balanceObstacles:above}),opticalPhraseCandidates(base,{...p,balanceObstacles:[...above,{x0:101,x1:200,y0:-100,y1:100}]}));
 const score={phrases:[{id:'balance',sourceSide:'above'}]} as unknown as QuantizedGridScore;
 assert.equal(routeOpticalPhrases(score,{...p,balanceObstacles:above},[base])[0].contour!.side,-1,'source directive outranks local weight');
});
