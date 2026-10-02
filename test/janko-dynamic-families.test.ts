import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DYNAMIC_FAMILIES,type DynamicFamily} from '../src/render/janko/elements/dynamic-family-paths';
import {DYNAMIC_PATHS} from '../src/render/janko/elements/dynamic-paths';
import {dynamicFamilyInk} from '../src/render/janko/elements/dynamic-families';
import {placeExpressions,expressionIntersectsBox} from '../src/render/janko/elements/expressions';
import {checkDynamicFamilyPaint,type LintViolation} from '../src/render/janko/linter';
import {DEFAULT_JANKO_OPTIONS} from '../src/render/janko/types';
import type {QuantizedGridScore} from '../src/model/types';
const families=Object.keys(DYNAMIC_FAMILIES) as DynamicFamily[];
const p={start:0,end:576,left:10,right:600,top:0,bottom:20,x:(t:number)=>30+t,endpointX:(_ids:string[],t:number)=>30+t};

test('six intact alphabets retain comparable piano height and measured vector frames for every current mark',()=>{
 assert.equal(families.length,6);assert.equal(DEFAULT_JANKO_OPTIONS.dynamicFamily,undefined);
 for(const family of families){
  assert.deepEqual(Object.keys(DYNAMIC_FAMILIES[family].marks),Object.keys(DYNAMIC_PATHS));
  for(const mark of Object.keys(DYNAMIC_PATHS)){
   const q=dynamicFamilyInk(family,mark,20,40,.016);assert.ok(q.polygons.length>0);assert.ok(q.x0<q.x1&&q.y0<q.y1);
   for(const point of q.polygons.flat())assert.ok(point[0]>=q.x0-1e-7&&point[0]<=q.x1+1e-7&&point[1]>=q.y0-1e-7&&point[1]<=q.y1+1e-7,`${family} ${mark}: actual curve samples inside true font bounds`);
   if(mark==='p'){assert.ok(Math.abs(q.y1-q.y0-6.656)<1e-10);assert.notEqual(q.path,DYNAMIC_PATHS.p.path);}
  }
 }
});

test('lettering trials retain source marks, parenthesized piano and hairpins while actual outlines participate in queries',()=>{
 const score={notes:[],totalTicks:576,dynamics:[{tick:0,mark:'p'},{tick:144,mark:'p',parenthesized:true},{tick:288,mark:'crescendo',kind:'hairpin',durationTicks:144}]} as unknown as QuantizedGridScore;
 const control=placeExpressions(score,p),source=JSON.stringify(score);
 for(const family of families){
  const ink=placeExpressions(score,{...p,dynamicFamily:family});assert.deepEqual(ink.map(q=>[q.id,q.startTick,q.endTick,q.continuationStart,q.continuationEnd]),control.map(q=>[q.id,q.startTick,q.endTick,q.continuationStart,q.continuationEnd]));
  assert.equal(ink[2].svg,control[2].svg);assert.match(ink[1].svg,/aria-label="\(p\)"/);assert.match(ink[1].svg,/<text/);
  for(const q of ink.filter(q=>q.dynamicFamilyInk)){const out:LintViolation[]=[];checkDynamicFamilyPaint(q,family,'p',.016,0,out);assert.deepEqual(out,[]);}
  const q=ink[0],s=q.dynamicFamilyInk!,point=s.polygons[0][2];assert.ok(expressionIntersectsBox(q,{x0:point[0]-.01,x1:point[0]+.01,y0:point[1]-.01,y1:point[1]+.01}));
 }
 assert.equal(JSON.stringify(score),source);assert.ok(control.every(q=>!q.dynamicFamilyInk&&!q.svg.includes('data-dynamic-family')));
});

test('dynamic admission catches mismatched source glyph, altered paint, stale scale and excluded actual ink bounds',()=>{
 const score={notes:[],totalTicks:576,dynamics:[{tick:0,mark:'p'}]} as unknown as QuantizedGridScore,q=placeExpressions(score,{...p,dynamicFamily:'leland'})[0],original=structuredClone(q);
 const audit=()=>{const out:LintViolation[]=[];checkDynamicFamilyPaint(q,'leland','p',.016,0,out);return out;},reset=()=>Object.assign(q,structuredClone(original));assert.deepEqual(audit(),[]);
 q.svg=q.svg.replace('scale(0.016 -0.016)','scale(0.012 -0.012)');assert.ok(audit().length);reset();
 q.dynamicFamilyInk!.scale=.012;assert.ok(audit().length);reset();
 q.dynamicFamilyInk!.mark='f';assert.ok(audit().length);reset();
 q.x0=q.dynamicFamilyInk!.x0+1;assert.ok(audit().length);reset();
 q.dynamicFamilyInk!.polygons[0][0][0]+=1;assert.ok(audit().length);reset();assert.deepEqual(audit(),[]);
});
