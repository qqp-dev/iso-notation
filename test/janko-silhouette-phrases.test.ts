import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {opticalPhraseCandidates,weakShoulderHealth,routeOpticalPhrases} from '../src/render/janko/optical-phrases';
import {balancedBowIsCoherent} from '../src/render/janko/balanced-phrases';
import {expressionIntersectsBox as referenceBox} from './support/expression-query-reference';
import type {ExpressionInk,ExpressionPlacement} from '../src/render/janko/elements/expressions';
import type {OpticalPhraseDomain} from '../src/render/janko/optical-phrase-domain';
import type {QuantizedGridScore} from '../src/model/types';
const fixture=JSON.parse(readFileSync(new URL('./support/no14-optical-pool-reference.json',import.meta.url),'utf8')) as {obstacles:NonNullable<ExpressionPlacement['obstacles']>;pools:{base:ExpressionInk;domain:OpticalPhraseDomain}[]};
const placement=(row:typeof fixture.pools[number]):ExpressionPlacement=>({start:0,end:576,left:0,right:600,top:0,bottom:241.73625,x:x=>x,endpointX:(_ids,x)=>x,obstacles:fixture.obstacles,balanceObstacles:fixture.obstacles.slice(0,-24),opticalDomain:()=>row.domain,phraseRouting:'optical-silhouette',expressionFloorActive:true});

test('literal opening retains both sides but ranks calmer admitted diagonals before formerly tied swooshes',()=>{
 for(const row of fixture.pools.slice(0,3)){
  const p=placement(row),pool=opticalPhraseCandidates(row.base,p),before=JSON.stringify(row);
  assert.equal(pool.length,24);assert.equal(pool.filter(q=>q.ink.contour!.side===-1).length,12);assert.equal(pool.filter(q=>q.ink.contour!.side===1).length,12);
  const lower=pool.filter(q=>q.ink.contour!.side===1).sort((a,b)=>a.cost-b.cost),first=lower[0],c=first.ink.contour!;
  assert.ok(Math.abs((c.yEnd-c.yStart)/(row.domain.end.y-row.domain.start.y)-.5)<1e-8,'moderate source chooses an existing softened diagonal');
  assert.equal(first.shoulder!.shoulderCost,0);assert.ok(first.shoulder!.axisCost>0);
  for(const q of pool){
   assert.ok(balancedBowIsCoherent(q.ink.contour!));assert.equal(q.ink.contour!.thickness,.85);assert.equal(q.ink.contour!.tipThickness,.22);
   assert.deepEqual(q.ink.endpointIds,row.base.endpointIds);assert.equal(q.ink.startTick,row.base.startTick);assert.equal(q.ink.endTick,row.base.endTick);
   const s=q.ink.contour!;assert.ok(s.xStart>=row.domain.start.x0&&s.xStart<=row.domain.start.x1&&s.xEnd>=row.domain.end.x0&&s.xEnd<=row.domain.end.x1);
   assert.ok(s.yStart>=row.domain.start.y0&&s.yStart<=row.domain.start.y1&&s.yEnd>=row.domain.end.y0&&s.yEnd<=row.domain.end.y1);
   assert.ok(fixture.obstacles.every(b=>!referenceBox(q.ink,{x0:b.x0-1.5,x1:b.x1+1.5,y0:b.y0-1.5,y1:b.y1+1.5})));
  }
  assert.equal(JSON.stringify(row),before);
 }
});

test('source-earned steep allowance and painted tangent health are reflection invariant and cannot be evaded by optical tilt',()=>{
 const c={xStart:0,xEnd:96.02,yStart:50,yEnd:0,side:-1 as const,depth:15,thickness:.85,tipThickness:.22,indent:96.02*.28,chordAligned:true as const};
 const steep=weakShoulderHealth(c,-50),moderate=weakShoulderHealth(c,-17.5),reflection=weakShoulderHealth({...c,yStart:-c.yStart,yEnd:-c.yEnd,side:1},50);
 assert.ok(steep.shoulderCost<moderate.shoulderCost);assert.ok(steep.axisCost<moderate.axisCost);
 assert.equal(reflection.cost,steep.cost);assert.equal(reflection.startAngle,-steep.startAngle);assert.equal(reflection.endAngle,-steep.endAngle);
 const flatter=weakShoulderHealth({...c,yEnd:40},-17.5);assert.equal(flatter.sourceSlope,moderate.sourceSlope);assert.ok(flatter.axisCost<moderate.axisCost);
 assert.equal(weakShoulderHealth(c,-60).cost,0);
});

test('successor reuse separates old policy and invalidates actual source-domain and obstacle changes',()=>{
 const row=structuredClone(fixture.pools[0]),p=placement(row),score={phrases:[{id:row.base.id}],totalTicks:576} as unknown as QuantizedGridScore;
 const old=routeOpticalPhrases(score,{...p,phraseRouting:'optical-breathing'},[row.base]);
 const first=routeOpticalPhrases(score,p,[row.base]);assert.notDeepEqual(first,old);assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),first);
 first[0].contour!.yStart+=5;assert.notDeepEqual(routeOpticalPhrases(score,p,[row.base]),first,'cached ink is isolated');
 row.domain.end.y+=10;const mutated=routeOpticalPhrases(score,p,[row.base]);assert.deepEqual(mutated,routeOpticalPhrases(structuredClone(score),p,[row.base]));
 assert.notDeepEqual(mutated,routeOpticalPhrases(score,{...p,opticalDomain:()=>fixture.pools[0].domain},[row.base]));
 p.obstacles=[...p.obstacles!,{x0:40,x1:130,y0:180,y1:260}];assert.deepEqual(routeOpticalPhrases(score,p,[row.base]),routeOpticalPhrases(structuredClone(score),p,[row.base]));
});
