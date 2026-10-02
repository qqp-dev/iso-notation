import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectNo14Written,reconstructNo14Performed} from '../src/render/janko/no14-written';
import {no14FittedProfile} from '../src/render/janko/no14-practice';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {systemPaintedInkBoxes,renderSystem,getMarginFurniture,systemFurniture} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {gridTopY,gridBotY} from '../src/render/janko/elements/barlines';
import {repeatFirstAttackEnvelope,repeatLeadingAir} from '../src/render/janko/repeat-signs';
import {checkRepeatIntegrity,type LintViolation} from '../src/render/janko/linter';

test('single-repeat trial admits full first-attack room at internal/system starts and replaces only actual source-start bracket',()=>{
 const projection=projectNo14Written(),score=projection.score,before=JSON.stringify(score),e=no14FittedProfile();
 for(const measuresPerSystem of [4,3]){
  const o={...e.options,phraseRouting:undefined,repeatTreatment:'single-rule' as const,measuresPerSystem},p=new PreparedJankoWindows(score,[{measureStart:33,measureCount:1},{measureStart:64,measureCount:1}],o,e.tokens);
  for(const l of p.systems.values()){
   const diagnostics:LintViolation[]=[];checkRepeatIntegrity(score,l,p.options,p.tokens,diagnostics);assert.deepEqual(diagnostics,[]);
   const q=l.repeatSigns![0];assert.equal(q.strokes.length,1);assert.equal(q.strokes[0].width,.9);assert.equal(q.dots.length,2);
   assert.equal(q.strokes[0].y0,gridTopY(l.geometry,p.options,p.tokens));assert.equal(q.strokes[0].y1,gridBotY(l.geometry,p.options,p.tokens));
   const svg=renderSystem(score,l.geometry,l.index,p.options,p.tokens,l),scene=buildInkScene(l,p.options,p.tokens,score);
   assert.ok(scene.barlines.every(b=>b.tick!==q.tick),'no duplicate ordinary or final rule');
   assert.equal((svg.match(/class="janko-repeat-barline"/g)??[]).length,1);
   if(q.type==='repeat-start'){
    const a=repeatFirstAttackEnvelope(l,q.tick,p.options,p.tokens)!;assert.ok(a.x0-q.x1>=repeatLeadingAir(p.tokens)-.01);
    assert.equal(a.tick,4608);assert.ok(q.dots.every(d=>d.cx>q.strokes[0].x));
    const atSystemStart=measuresPerSystem===4;assert.equal(!!l.geometry.repeatStartReplacesBracket,atSystemStart);
    assert.equal(svg.includes('class="janko-system-bracket"'),!atSystemStart);assert.match(svg,/janko-measure-num/);
    assert.equal(getMarginFurniture(l.geometry,p.tokens,33,undefined,p.options.systemStartStyle,false).accolade===null,atSystemStart);
    assert.equal(systemPaintedInkBoxes(l,p.options,p.tokens).some(b=>b.what.endsWith('system start')),!atSystemStart);
    const furniture=systemFurniture(l.geometry,p.options,p.tokens,l.index);assert.equal(furniture.length,atSystemStart?1:2);
   }else{assert.ok(q.dots.every(d=>d.cx<q.strokes[0].x));assert.equal(!!l.geometry.repeatStartReplacesBracket,false);assert.match(svg,/janko-system-bracket/);}
  }
 }
 assert.equal(JSON.stringify(score),before);assert.deepEqual(reconstructNo14Performed(projection),projection.performed);
});

test('single-repeat audit catches missing stroke/dots, phantom bracket, false paint and inadequate noncolliding leading room',()=>{
 const e=no14FittedProfile(),score=projectNo14Written().score,o={...e.options,phraseRouting:undefined,repeatTreatment:'single-rule' as const},p=new PreparedJankoWindows(score,[{measureStart:33,measureCount:1}],o,e.tokens),l=[...p.systems.values()][0],q=l.repeatSigns![0],original=structuredClone(q);
 const audit=()=>{const out:LintViolation[]=[];checkRepeatIntegrity(score,l,p.options,p.tokens,out);return out;},reset=()=>Object.assign(q,structuredClone(original));assert.deepEqual(audit(),[]);
 q.strokes.push({...q.strokes[0],x:q.x-3,width:.6});assert.ok(audit().some(v=>v.code==='repeat-geometry'));reset();
 q.dots.pop();assert.ok(audit().some(v=>v.code==='repeat-geometry'));reset();
 delete l.geometry.repeatStartReplacesBracket;assert.ok(audit().some(v=>v.code==='repeat-geometry'));l.geometry.repeatStartReplacesBracket=true;
 q.svg=q.svg.replace('stroke-width="0.9"','stroke-width="1.5"');assert.ok(audit().some(v=>v.code==='repeat-geometry'));reset();
 const notes=l.notes.filter(n=>n.note.startTick===q.tick),saved=notes.map(n=>n.x);notes.forEach(n=>n.x-=2);
 assert.ok(audit().some(v=>v.code==='repeat-clearance'&&v.message.includes('leading room')),'a visible breathing-room defect is caught before actual overlap');notes.forEach((n,i)=>n.x=saved[i]);assert.deepEqual(audit(),[]);
});
