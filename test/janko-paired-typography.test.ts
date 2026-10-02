import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PAIRED_DYNAMIC_FAMILIES,PAIRED_PEDAL_TEXT,type PedalTextFamily} from '../src/render/janko/elements/paired-typography-paths';
import {DYNAMIC_FAMILIES as RESEARCH_FAMILIES} from '../src/render/janko/elements/dynamic-family-paths';
import {dynamicFamilyInk,type DynamicFamily} from '../src/render/janko/elements/dynamic-families';
import {pedalStartInk} from '../src/render/janko/elements/pedal-starts';
import {placeExpressions,expressionIntersectsBox} from '../src/render/janko/elements/expressions';
import {checkPedalStartPaint,checkDynamicFamilyPaint,type LintViolation} from '../src/render/janko/linter';
import {DEFAULT_JANKO_OPTIONS} from '../src/render/janko/types';
import type {QuantizedGridScore} from '../src/model/types';
const pairs=[['libre-bodoni-italic','libre-bodoni-regular'],['source-serif-medium-italic','source-serif-regular'],['finale-legacy','maestro-text-regular']] as const;
const marks=['p','pp','ppp','mp','mf','f','ff','fff','fp','sf','sfz'];
const codes=['uniE520','uniE52B','uniE52A','uniE52C','uniE52D','uniE522','uniE52F','uniE530','uniE534','uniE536','uniE539'];
const p={start:0,end:576,left:10,right:600,top:0,bottom:20,x:(t:number)=>30+t,endpointX:(_ids:string[],t:number)=>30+t};

test('three complete freely paired alphabets preserve actual text/music glyph meanings and common ink heights',()=>{
 assert.equal(DEFAULT_JANKO_OPTIONS.dynamicFamily,undefined);assert.equal(DEFAULT_JANKO_OPTIONS.pedalTextFamily,undefined);
 assert.equal(Object.keys(PAIRED_DYNAMIC_FAMILIES).length,3);assert.equal(Object.keys(PAIRED_PEDAL_TEXT).length,3);
 for(const [dynamic,pedal] of pairs){
  const family=PAIRED_DYNAMIC_FAMILIES[dynamic];assert.deepEqual(Object.keys(family.marks),marks);
  for(const [i,mark] of marks.entries()){
   const glyph=family.marks[mark as keyof typeof family.marks],names=glyph.glyphNames;
   if(dynamic==='finale-legacy')assert.deepEqual(names,[codes[i]],'musical glyph means the requested source mark');
   else assert.equal(names.join('').replaceAll('_',''),mark,'native text ligatures retain the requested dynamic letters');
   const ink=dynamicFamilyInk(dynamic,mark,20,40,.016);assert.ok(ink.polygons.length>0);
   for(const point of ink.polygons.flat())assert.ok(point[0]>=ink.x0-1e-7&&point[0]<=ink.x1+1e-7&&point[1]>=ink.y0-1e-7&&point[1]<=ink.y1+1e-7);
   if(mark==='p')assert.ok(Math.abs(ink.y1-ink.y0-6.656)<1e-9);
  }
  assert.deepEqual(PAIRED_PEDAL_TEXT[pedal].glyphNames,['P','e','d','period']);
  const start=pedalStartInk('plain-text',0,'pedal-0',30,40,7.2,pedal);assert.equal(start.family,pedal);assert.ok(Math.abs(start.height-5.805)<1e-9);assert.ok(Math.abs(start.x0-30)<.001);
 }
 const width=(mark:'p'|'pp'|'ppp'|'f'|'ff'|'fff')=>{const b=RESEARCH_FAMILIES.leland.marks[mark].bounds;return b[2]-b[0];};
 assert.ok(width('ppp')>width('pp')&&width('pp')>width('p'));assert.ok(width('fff')>width('ff')&&width('ff')>width('f'));
 for(const mark of ['pp','ppp','mp','mf','ff','fff','fp','sf','sfz'] as const)assert.equal(RESEARCH_FAMILIES.leland.marks[mark].smuflCodepoint,'0x'+codes[marks.indexOf(mark)].slice(3).toLowerCase());
});

test('paired expressions retain source dynamics and exact carried pedal semantics with actual outline queries',()=>{
 const score={notes:[],totalTicks:576,dynamics:[{tick:0,mark:'p'},{tick:144,mark:'p',parenthesized:true},{tick:288,mark:'diminuendo',kind:'text-cresc',text:'diminuendo'}],pedals:[{tick:0,type:'sustain-down'},{tick:72,type:'sustain-change'},{tick:360,type:'sustain-up'}]} as unknown as QuantizedGridScore,source=JSON.stringify(score);
 for(const [dynamicFamily,pedalTextFamily] of pairs){
  const ink=placeExpressions(score,{...p,dynamicFamily,pedalStart:'plain-text',pedalTextFamily}),out:LintViolation[]=[];
  const dynamic=ink.find(q=>q.id==='dynamic-0')!;checkDynamicFamilyPaint(dynamic,dynamicFamily,'p',.016,0,out);
  const pedal=ink.find(q=>q.kind==='pedal')!;checkPedalStartPaint(pedal,'plain-text',0,out,pedalTextFamily);assert.deepEqual(out,[]);
  assert.equal(pedal.startTick,0);assert.equal(pedal.endTick,360);assert.ok(pedal.svg.includes('V'));assert.ok(pedal.strokeSegments!.some(s=>s.x0===s.x1));
  const point=pedal.pedalStartInk!.polygons[0][2];assert.ok(expressionIntersectsBox(pedal,{x0:point[0]-.01,x1:point[0]+.01,y0:point[1]-.01,y1:point[1]+.01}));
  const carry=placeExpressions(score,{...p,start:144,dynamicFamily,pedalStart:'plain-text',pedalTextFamily}).find(q=>q.kind==='pedal')!;
  assert.equal(carry.continuationStart,true);assert.equal(carry.pedalStartInk,undefined);assert.ok(!carry.svg.includes('janko-pedal-start'));
  assert.match(ink.find(q=>q.id==='dynamic-1')!.svg,/aria-label="\(p\)"/);assert.match(ink.find(q=>q.id==='dynamic-2')!.svg,/diminuendo/);
 }
 assert.equal(JSON.stringify(score),source);
});

test('paired press admission rejects a substituted family, altered vector or omitted actual ink',()=>{
 const score={notes:[],totalTicks:576,pedals:[{tick:0,type:'sustain-down'},{tick:300,type:'sustain-up'}]} as unknown as QuantizedGridScore;
 const q=placeExpressions(score,{...p,pedalStart:'plain-text',pedalTextFamily:'source-serif-regular'}).find(q=>q.kind==='pedal')!,original=structuredClone(q);
 const audit=(family:PedalTextFamily='source-serif-regular')=>{const out:LintViolation[]=[];checkPedalStartPaint(q,'plain-text',0,out,family);return out;},reset=()=>Object.assign(q,structuredClone(original));
 assert.deepEqual(audit(),[]);assert.ok(audit('libre-bodoni-regular').length);q.pedalStartInk!.family='maestro-text-regular';assert.ok(audit().length);reset();
 q.svg=q.svg.replace('scale(0.0075 -0.0075)','scale(0.004 -0.004)');assert.ok(audit().length);reset();q.x0=q.pedalStartInk!.x0+1;assert.ok(audit().length);reset();assert.deepEqual(audit(),[]);
});
