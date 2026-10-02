import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {opticalPhraseCandidates,routeOpticalPhrases} from '../src/render/janko/optical-phrases';
import {balancedBowIsCoherent} from '../src/render/janko/balanced-phrases';
import type {ExpressionInk,ExpressionPlacement} from '../src/render/janko/elements/expressions';
import {expressionIntersectsBox as referenceBox} from './support/expression-query-reference';
import type {OpticalPhraseDomain} from '../src/render/janko/optical-phrase-domain';
import type {QuantizedGridScore} from '../src/model/types';
const fixture=JSON.parse(readFileSync(new URL('./support/no14-optical-pool-reference.json',import.meta.url),'utf8')) as {obstacles:NonNullable<ExpressionPlacement['obstacles']>;pools:{base:ExpressionInk;domain:OpticalPhraseDomain}[]};
const placement=(row:typeof fixture.pools[number]):ExpressionPlacement=>({start:0,end:576,left:0,right:600,top:0,bottom:500,x:x=>x,endpointX:(_ids,x)=>x,obstacles:fixture.obstacles,opticalDomain:()=>row.domain,phraseRouting:'optical-breathing'});

test('literal comfortable alternatives retain both sides, exact domains, source owners and independent physical clearance',()=>{
 for(const row of fixture.pools){
  const p=placement(row),pool=opticalPhraseCandidates(row.base,p),before=JSON.stringify(row);assert.equal(pool.length,24);
  for(const side of [-1,1] as const){
   const rows=pool.filter(q=>q.ink.contour!.side===side);assert.equal(rows.length,12);
   assert.ok(rows.some(q=>q.breathing!.extraAir===0));assert.ok(rows.some(q=>q.breathing!.extraAir===q.breathing!.targetAir));
   assert.equal(opticalPhraseCandidates(row.base,p,side).length,24);
  }
  for(const q of pool){const c=q.ink.contour!;assert.ok(balancedBowIsCoherent(c));assert.equal(c.thickness,.85);assert.equal(c.tipThickness,.22);
   assert.deepEqual(q.ink.endpointIds,row.base.endpointIds);assert.equal(q.ink.startTick,row.base.startTick);assert.equal(q.ink.endTick,row.base.endTick);
   assert.ok(c.xStart>=row.domain.start.x0&&c.xStart<=row.domain.start.x1&&c.xEnd>=row.domain.end.x0&&c.xEnd<=row.domain.end.x1);
   assert.ok(c.yStart>=row.domain.start.y0&&c.yStart<=row.domain.start.y1&&c.yEnd>=row.domain.end.y0&&c.yEnd<=row.domain.end.y1);
   assert.ok(fixture.obstacles.every(b=>!referenceBox(q.ink,{x0:b.x0-1.5,x1:b.x1+1.5,y0:b.y0-1.5,y1:b.y1+1.5})));
  }
  // Translation, not extra steepening or crown, earns the additional air.
  const comfortable=pool.find(q=>q.breathing!.extraAir===q.breathing!.targetAir)!;
  const c=comfortable.ink.contour!,minimum={...c,yStart:c.yStart-c.side*comfortable.breathing!.extraAir,yEnd:c.yEnd-c.side*comfortable.breathing!.extraAir};
  assert.ok(balancedBowIsCoherent(minimum));assert.ok(Math.abs((c.yEnd-c.yStart)-(minimum.yEnd-minimum.yStart))<1e-10);
  assert.equal(JSON.stringify(row),before);
 }
});

test('uncertain balance has a deadband; existing expression-floor consequence is conditional and source-side remains authoritative',()=>{
 const base={...fixture.pools[0].base,id:'balance'},domain:OpticalPhraseDomain={start:{x:0,y:0,x0:0,x1:4,y0:-60,y1:60},end:{x:100,y:0,x0:96,x1:100,y0:-60,y1:60},span:100,pitchRange:0};
 const p:ExpressionPlacement={...placement(fixture.pools[0]),bottom:10,obstacles:[{x0:0,x1:100,y0:-2,y1:2}],opticalDomain:()=>domain,balanceObstacles:[{x0:20,x1:80,y0:-1,y1:0}]};
 const pool=opticalPhraseCandidates(base,p);assert.ok(pool.every(q=>q.breathing!.balance===0&&q.breathing!.floor===0));
 const demand=opticalPhraseCandidates(base,{...p,expressionFloorActive:true});assert.ok(demand.some(q=>q.breathing!.floor>0));assert.ok(demand.filter(q=>q.ink.contour!.side===-1).every(q=>q.breathing!.floor===0));
 const directed={phrases:[{id:'balance',sourceSide:'below'}],totalTicks:576} as unknown as QuantizedGridScore;
 assert.equal(routeOpticalPhrases(directed,{...p,phrasePlacement:'above-diagnostic'},[base])[0].contour!.side,1);
 const held={phrases:[{id:'balance'}],pedals:[{tick:0,type:'sustain-down'},{tick:576,type:'sustain-up'}],totalTicks:576} as unknown as QuantizedGridScore;
 assert.deepEqual(routeOpticalPhrases(held,p,[base])[0],demand[0].ink,'actual held source interval supplies the existing floor consequence');
 assert.equal(p.expressionFloorActive,undefined,'derived context cannot mutate the caller');
});

test('score-local route reuse returns isolated ink and invalidates after actual source/domain/obstacle/floor mutations',()=>{
 const row=structuredClone(fixture.pools[0]),p=placement(row),score={phrases:[{id:row.base.id}],totalTicks:576} as unknown as QuantizedGridScore;
 const original=routeOpticalPhrases(score,p,[row.base]);original[0].contour!.yStart=1e8;original[0].endpointIds![0].push('damaged');
 const reused=routeOpticalPhrases(score,p,[row.base]);assert.notEqual(reused[0].contour!.yStart,1e8);assert.ok(!reused[0].endpointIds![0].includes('damaged'));
 const uncached=()=>routeOpticalPhrases(structuredClone(score),p,[row.base]);
 row.domain.start.y0-=5;row.domain.end.y0-=5;assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),uncached());
 p.obstacles=structuredClone(fixture.obstacles);p.obstacles[0].y0-=7;assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),uncached());
 p.bottom=30;score.pedals=[{tick:0,type:'sustain-down'},{tick:576,type:'sustain-up'}];assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),uncached());
 score.phrases![0].sourceSide='above';assert.equal(routeOpticalPhrases(score,p,[row.base])[0].contour!.side,-1);assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),uncached());
 row.base.endpointIds![0]=['changed-owner'];assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),uncached());assert.deepEqual(routeOpticalPhrases(score,p,[row.base])[0].endpointIds![0],['changed-owner']);
 const included={...p,include:(kind:ExpressionInk['kind'])=>kind==='phrase'};assert.deepEqual(routeOpticalPhrases(score,included,[row.base]),routeOpticalPhrases(structuredClone(score),included,[row.base]));
});
