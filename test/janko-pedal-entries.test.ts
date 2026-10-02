import {test} from 'node:test';
import assert from 'node:assert/strict';
import {placeExpressions,expressionIntersectsBox} from '../src/render/janko/elements/expressions';
import {pedalStartInk} from '../src/render/janko/elements/pedal-starts';
import {checkPedalStartPaint,lintJankoWindowSystems,type LintViolation} from '../src/render/janko/linter';
import {no14BreathingProfile} from '../src/render/janko/no14-practice';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {NO14_INTEGRATED_CANDIDATES} from '../src/render/janko/candidates';
import type {QuantizedGridScore} from '../src/model/types';
const p={start:100,end:240,left:10,right:100,top:0,bottom:20,x:(t:number)=>10+(t-100)/2,endpointX:(_ids:string[],t:number)=>t};
const score={notes:[],totalTicks:300,pedals:[{tick:0,type:'sustain-down'},{tick:130,type:'sustain-change'},{tick:180,type:'sustain-up'},{tick:200,type:'sustain-down'},{tick:280,type:'sustain-up'}]} as unknown as QuantizedGridScore;

test('plain Ped. and downward entries preserve true continuation, gaps, retakes and exact upright release',()=>{
 for(const style of ['plain-text','downward-entry'] as const){
  const qs=placeExpressions(score,{...p,pedalStart:style});assert.deepEqual(qs.map(q=>[q.startTick,q.endTick,q.continuationStart,q.continuationEnd]),[[0,180,true,false],[200,280,false,true]]);
  assert.equal(qs[0].pedalStartInk,undefined);assert.doesNotMatch(qs[0].svg,/janko-pedal-start/);assert.ok(qs[0].x1<qs[1].x0);
  const s=qs[1].pedalStartInk!;assert.equal(s.x,p.x(200));assert.equal(s.tick,200);assert.match(s.svg,new RegExp(`data-pedal-start="${style}"`));
  for(const q of qs){const out:LintViolation[]=[];checkPedalStartPaint(q,style,0,out);assert.deepEqual(out,[]);assert.ok(q.strokeSegments!.every(s=>s.width===.65));}
  const last=qs[0].strokeSegments!.at(-1)!;assert.equal(last.x0,last.x1);assert.equal(last.x1,p.x(180));assert.equal(last.y1,last.y0-4);
  assert.equal(qs[1].strokeSegments!.at(-1)!.y1,qs[1].strokeSegments!.at(-1)!.y0,'continuation has no false release');
  const point=s.polygons[0][1];assert.ok(expressionIntersectsBox(qs[1],{x0:point[0]-.03,x1:point[0]+.03,y0:point[1]-.03,y1:point[1]+.03}));
  if(style==='plain-text'){assert.match(s.svg,/aria-label="Ped\."/);assert.ok(qs[1].strokeSegments![0].x0>s.x1);}
  else{assert.equal(s.holdX,Number((s.x+4).toFixed(3)));assert.equal(qs[1].strokeSegments![0].x0,s.holdX);}
 }
});

test('new start admission catches false paint, stale bounds and disconnected slanted holds',()=>{
 for(const style of ['plain-text','downward-entry'] as const){const q=placeExpressions(score,{...p,pedalStart:style})[1],original=structuredClone(q);
  const audit=()=>{const out:LintViolation[]=[];checkPedalStartPaint(q,style,0,out);return out;},reset=()=>Object.assign(q,structuredClone(original));assert.deepEqual(audit(),[]);
  q.svg=q.svg.replace('janko-pedal-start','janko-pedal-damaged');assert.ok(audit().length);reset();
  q.pedalStartInk!.x1-=1;assert.ok(audit().length);reset();
  q.strokeSegments![0].x0+=1;assert.ok(audit().length);reset();
  q.x0=q.pedalStartInk!.x0+.5;assert.ok(audit().length);reset();
  q.continuationStart=true;assert.ok(audit().length);reset();assert.deepEqual(audit(),[]);
 }
});

test('literal pedal carry 20–22 and accepted repeat remain unchanged in nine complete-score comparisons',()=>{
 const e=no14BreathingProfile(),source=projectNo14Written().score;
 for(const pedalStart of ['plain-text','downward-entry'] as const){
  const prepared=new PreparedJankoWindows(source,[{measureStart:20,measureCount:3}],{...e.options,phraseRouting:undefined,pedalStart,dynamicFamily:'leland'},e.tokens),lint=lintJankoWindowSystems(prepared);assert.deepEqual(lint.violations,[]);assert.deepEqual(lint.warnings,[]);
  const starts=[...prepared.systems.values()].flatMap(l=>l.expressions!.flatMap(q=>q.pedalStartInk?[q.pedalStartInk]:[]));assert.ok(starts.every(q=>q.tick!==20*144),'held pedal into21 cannot acquire another press');
 }
 assert.equal(NO14_INTEGRATED_CANDIDATES.length,9);
 for(const q of NO14_INTEGRATED_CANDIDATES){assert.equal(q.options?.repeatTreatment,'single-rule');assert.equal(q.options?.hairpinStrokeWidth,.65);assert.ok(q.windows!.some(w=>'fullScore' in w&&w.fullScore&&w.measureCount===64));}
 const a=pedalStartInk('plain-text',0,'pedal-0',20,30);assert.ok(Math.abs(a.y1-a.y0-5.805)<1e-8);
});
