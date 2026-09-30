import test from 'node:test';
import assert from 'node:assert/strict';
import { importSchumann } from '../src/scores/schumann-no43';
import { buildSchumannNo14Draft, schumannNo14WrittenFacts as facts } from '../src/scores/schumann-no14-draft';
import { createStudioConfig } from '../src/render/janko/studio';
import { layoutJankoScore, renderJankoPage, renderJankoCrop, countJankoPages, computePageGeometry, systemCompleteInkBounds, systemPaintedInkBoxes } from '../src/render/janko/engine';
import { checkExpressionIntegrity, lintJankoScore } from '../src/render/janko/linter';
import { partitionBeamGroups } from '../src/render/janko/elements/rhythm';
import { pedalIntervals, placeExpressions } from '../src/render/janko/elements/expressions';
import { resolveJankoTokens } from '../src/render/janko/types';

const pitch = (n: {pitch: {octave:number;pitchClass:number}}) => n.pitch.octave*12+n.pitch.pitchClass;

test('shared repertoire paints admitted source expression without new overlay or page defects', () => {
  const config=createStudioConfig();
  for(const id of ['primary','brahms-op118-no1','schumann-op68-no13','schumann-op68-no14','schumann-op68-no14-principal','schumann-op68-no30','schumann-op68-no43']) {
    const entry=config.scores[id];
    assert.ok(entry, id);
    const report=lintJankoScore(entry.score,entry.options,entry.tokens);
    assert.deepEqual(report.violations.filter(v=>v.code.startsWith('expression-')),[],`${id}: no new expression defects`);
    const layouts=layoutJankoScore(entry.score,entry.options,entry.tokens);
    const geo=computePageGeometry(entry.options,entry.tokens,entry.score);
    for(const l of layouts) for(const e of l.expressions??[]) {
      assert.ok(e.x0>=-1e-6&&e.x1<=geo.pageWidth+1e-6,`${id}: expression stroke bounds remain inside the SVG page`);
      assert.ok(e.y0>=geo.marginTop+geo.headerHeight-1e-6&&e.y1<=geo.pageHeight-geo.marginBottom-geo.footerHeight+1e-6,`${id}: vertical page coverage`);
    }
    const classes=Object.fromEntries([...new Set(report.violations.map(v=>v.code))].map(code=>[code,report.violations.filter(v=>v.code===code).length]));
    console.log(`${id}: pages=${countJankoPages(entry.score,entry.options,entry.tokens)} systems=${layouts.length} dynamics=${entry.score.dynamics.length} pedals=${entry.score.pedals.length} phrases=${entry.score.phrases?.length??0} violations=${report.violations.length} warnings=${report.warnings.length} classes=${JSON.stringify(classes)}`);
  }
});
test('independent No14 witnesses, source routes, final-child exit and returned passages', () => {
  const expected: Record<number,number[]> = {41:[48,52,55,36,43,52,64,60,55],43:[47,50,55,35,43,50,62,59,55],48:[55,57,55,50,48,57,50,48,40,42],49:[43,47,50,59,55,50],53:[43,47,55,67,62,59],63:[43,47,50,31,38,47,55,50,47]};
  for(const [bar,values] of Object.entries(expected)) assert.deepEqual(facts.events.filter(e=>e.bar===Number(bar)-1&&e.kind==='note').map(e=>e.pitches[0].absolutePitch),values,`written m.${bar}`);
  const score=buildSchumannNo14Draft();
  for(const [bar,values] of [[41,[36,43,52,64,60,55]],[43,[35,43,50,62,59,55]],[53,[43,47,55,67,62,59]],[63,[31,38,47,55,50,47]]] as const) {
    for(const b of [bar,bar+32]) assert.deepEqual(score.notes.filter(n=>n.startTick>=(b-1)*144&&n.startTick<b*144).map(pitch),values,`unfolded m.${b}`);
  }
  assert.deepEqual(score.notes,buildSchumannNo14Draft('optional').notes,'lower/wider is the full-score default');
});

test('compound meter groups dotted-quarter gestures and independent moving voice at m48', () => {
  const entry=createStudioConfig().scores['schumann-op68-no14'];
  const layouts=layoutJankoScore(entry.score,entry.options,entry.tokens);
  const groups=layouts.flatMap(l=>l.beams.map(b=>b.notes.map(n=>n.startTick)));
  assert.ok(groups.some(g=>g.join(',')==='0,24,48'));
  assert.ok(groups.some(g=>g.join(',')==='72,96,120'));
  const base=47*144;
  assert.ok(groups.some(g=>g.join(',')===`${base},${base+24},${base+48}`));
  assert.ok(groups.some(g=>g.join(',')===`${base+72},${base+96},${base+120}`));
  assert.ok(!groups.some(g=>g.some(t=>t>=base&&t<base+72)&&g.some(t=>t>=base+72&&t<base+144)));
  const notes=Array.from({length:6},(_,i)=>({id:String(i),startTick:i*24,durationTicks:24,x:i*20,y:0,hand:'RH' as const}));
  assert.deepEqual(partitionBeamGroups(notes,{ticksPerMeasure:144}).groups.map(g=>g.map(n=>n.startTick)),[[0,24],[48,72],[96,120]],'3/4 remains quarter-based, not universal triples');
  const poly=[...notes.map(n=>({...n,sourceVoice:'one',beamWindowTicks:72})),...notes.map(n=>({...n,id:'b'+n.id,sourceVoice:'two',beamWindowTicks:72}))];
  assert.equal(partitionBeamGroups(poly,{ticksPerMeasure:144}).groups.length,4,'coincident independent voices are not a chord or one interleaved gesture');
  const interrupted=notes.map(n=>({...n,beamWindowTicks:72,...(n.startTick===24?{sourceBeam:{noBeam:true}}:{})}));
  assert.ok(partitionBeamGroups(interrupted,{ticksPerMeasure:144}).ungrouped.some(n=>n.startTick===24),'explicit noBeam is a genuine interruption');
  const explicit=notes.map(n=>({...n,sourceBeam:{group:'literal-source-group'}}));
  assert.equal(partitionBeamGroups(explicit,{ticksPerMeasure:144}).groups[0].length,6,'explicit source beam overrides metric default, never the clocks');
});

test('No14 source-timed expression inventory and independent musical boundaries', () => {
  const score=buildSchumannNo14Draft();
  assert.equal(facts.expressions.filter(e=>e.token==='\\sustainOn').length,53);
  assert.equal(facts.expressions.filter(e=>e.token==='\\sustainOff').length,53);
  assert.deepEqual(score.dynamics.filter(e=>e.kind==='mark').map(e=>[e.tick,e.mark,!!e.parenthesized]),[[0,'p',false],[32*144,'p',true],[64*144,'p',true]]);
  assert.ok(score.dynamics.some(e=>e.text==='diminuendo'&&e.tick===30*144+72));
  for(const [bar,offset,duration,mark] of [[5,0,120,'crescendo'],[21,24,96,'crescendo'],[8,0,120,'decrescendo'],[53,0,120,'crescendo']] as const)
    assert.ok(score.dynamics.some(e=>e.tick===(bar-1)*144+offset&&e.durationTicks===duration&&e.mark===mark));
  const intervals=pedalIntervals(score);
  for(const boundary of [4*144,7*144,63*144]) assert.ok(intervals.some(i=>i.start<boundary&&i.end>=boundary),`pedal not reset at ${boundary}`);
  assert.ok(!score.pedals.some(e=>e.tick>=47*144&&e.tick<48*144),'m48 has no pedal instruction');
  const phrase=score.phrases!.find(p=>p.startTick===0)!;
  assert.equal(phrase.endTick,120,'last eighth onset, never sounding release or a pedal endpoint');
  assert.equal(score.notes.find(n=>n.id===phrase.toNoteIds[0])?.hand,'RH');
  assert.equal(score.notes.find(n=>n.id===phrase.fromNoteIds[0])?.hand,'LH');
  assert.ok(score.phrases!.some(p=>p.startTick===40*144&&p.fromNoteIds.some(id=>id.includes('lower."1"'))),'phrase follows selected source route');
});

test('unfamiliar source uses shared expression paths; attachments use onset not spacer release', () => {
  const source=String.raw`\score { \new PianoStaff <<
    \new Staff { \relative c' { \time 6/8 c8\( d e f g a\) | c8 d e f g a | } }
    \new Dynamics = "expression" { s8\p\< s2 s8\! | s4. s4.-\markup { \whiteout "diminuendo" } | }
    \new Dynamics = "pedal" { s4.\sustainOn s4. | s8\sustainOff\sustainOn s4 s4.\sustainOff | }
  >> }`;
  const result=importSchumann(source,{file:'unfamiliar-expression.ly',number:14,hash:'fixture'});
  assert.deepEqual(result.score.dynamics.map(e=>[e.tick,e.mark,e.durationTicks,e.text]),[[0,'p',undefined,undefined],[0,'crescendo',120,undefined],[216,'decrescendo',undefined,'diminuendo']]);
  assert.deepEqual(result.score.pedals.map(e=>[e.tick,e.type]),[[0,'sustain-down'],[144,'sustain-change'],[216,'sustain-up']]);
  assert.equal(result.score.pedals[1].changeOrigins?.length,2);
  assert.equal(result.score.phrases?.[0].endTick,120);
  assert.throws(()=>importSchumann(source.replace('\\p\\<','\\inventedDynamic'),{file:'unknown.ly',number:14,hash:'fixture'}),/Unhandled musical construct/);
});

test('pedal continuation strokes, true gaps, notch and split hairpin aperture', () => {
  const score={...buildSchumannNo14Draft(),notes:[],phrases:[],totalTicks:300,dynamics:[{tick:0,mark:'crescendo' as const,durationTicks:240,kind:'hairpin' as const}],pedals:[{tick:0,type:'sustain-down' as const},{tick:60,type:'sustain-change' as const},{tick:180,type:'sustain-up' as const},{tick:200,type:'sustain-down' as const},{tick:280,type:'sustain-up' as const}]};
  const p={start:100,end:220,left:10,right:130,top:0,bottom:10,x:(t:number)=>t-90,endpointX:()=>0};
  const ink=placeExpressions(score,p),pedal=ink.filter(i=>i.kind==='pedal');
  assert.deepEqual(pedal.map(i=>[i.continuationStart,i.continuationEnd]),[[true,false],[false,true]]);
  assert.ok(pedal[0].x1<pedal[1].x0,'true 20-tick gap remains open');
  assert.match(pedal[0].svg,/M10\.000 [\d.]+H90\.000V/,'no entry stroke at continuation');
  assert.equal(ink.find(i=>i.kind==='hairpin')?.continuationStart,true);
  assert.equal(ink.find(i=>i.kind==='hairpin')?.continuationEnd,true);
  const whole=placeExpressions(score,{...p,start:0,end:300,x:t=>t+10,right:310});
  assert.match(whole.find(i=>i.kind==='pedal')!.svg,/L70\.000/,'immediate redepression is a notch');
  const phraseScore={...score,dynamics:[],pedals:[],phrases:[{...buildSchumannNo14Draft().phrases![0],startTick:0,endTick:240}]};
  const fragment=placeExpressions(phraseScore,p).find(i=>i.kind==='phrase')!;
  assert.deepEqual([fragment.continuationStart,fragment.continuationEnd,fragment.x0,fragment.x1],[true,true,10,130]);
  assert.deepEqual(fragment.endpointIds,[phraseScore.phrases[0].fromNoteIds,phraseScore.phrases[0].toNoteIds],'splitting a phrase never rewrites its source associations');
});

test('expression bounds participate in real page/crop admission and linter defects are not aesthetic waivers', () => {
  const entry=createStudioConfig().scores['schumann-op68-no14'];
  const layouts=layoutJankoScore(entry.score,entry.options,entry.tokens);
  const geo=computePageGeometry(entry.options,entry.tokens,entry.score);
  for(const l of layouts) for(const e of l.expressions??[]) {
    const b=systemCompleteInkBounds(l,entry.options,entry.tokens);
    assert.ok(e.y0>=b.top-1e-6&&e.y1<=b.bottom+1e-6);
    assert.ok(systemPaintedInkBoxes(l,entry.options,entry.tokens).some(b=>b.what===`expression ${e.kind} ${e.id}`));
    assert.ok(e.y0>=geo.marginTop+geo.headerHeight-1e-6&&e.y1<=geo.pageHeight-geo.marginBottom-geo.footerHeight+1e-6);
  }
  const pages=countJankoPages(entry.score,entry.options,entry.tokens);
  for(let page=0;page<pages;page++) assert.match(renderJankoPage(entry.score,page,entry.options,entry.tokens,layouts),/janko-expressions/);
  const crop=renderJankoCrop(entry.score,31,3,entry.options,entry.tokens);
  assert.match(crop,/janko-dynamic/); assert.match(crop,/janko-pedal/); assert.match(crop,/janko-phrase/);
  const full=renderJankoCrop(entry.score,1,96,entry.options,entry.tokens,undefined,layouts);
  const view=full.match(/viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/)!.slice(1).map(Number);
  for(const l of layouts) for(const ink of l.expressions??[]) {
    const offset=(l.geometry.pageIndex??0)*geo.bodyHeight;
    assert.ok(ink.y0+offset>=view[1]-.02&&ink.y1+offset<=view[1]+view[3]+.02,'full real-engine crop frames every new ink family across page breaks');
  }
  for (const l of layouts) for (const phrase of entry.score.phrases ?? []) {
    const ink = l.expressions?.find(e => e.kind === 'phrase' && e.id === phrase.id);
    if (!ink) continue;
    for (const [ids,tick,actual,continuation] of [
      [phrase.fromNoteIds,phrase.startTick,ink.x0,ink.continuationStart],
      [phrase.toNoteIds,phrase.endTick,ink.x1,ink.continuationEnd],
    ] as const) {
      const endpoint = l.notes.find(n => ids.includes(n.note.id) && n.note.startTick === tick);
      if (endpoint && !continuation) assert.ok(Math.abs(actual-endpoint.x)<=3.6+1e-6,
        'phrase tip stays just outside its solved source-head envelope, not on a detached system axis');
    }
  }
  assert.match(crop,/aria-label="\(p\)"/,'source parenthesized piano remains parenthesized in ink');
  assert.deepEqual(lintJankoScore(entry.score,entry.options,entry.tokens).violations.filter(v=>v.code.startsWith('expression-')).map(v=>v.message),[]);
  const l={...layouts[0],expressions:structuredClone(layouts[0].expressions)};
  const out: Parameters<typeof checkExpressionIntegrity>[4]=[];
  const original=l.expressions!; l.expressions=[];
  checkExpressionIntegrity(entry.score,l,entry.options,resolveJankoTokens(entry.tokens),out); assert.ok(out.some(v=>v.code==='expression-missing'));
  l.expressions=original; const q=l.expressions!.find(e=>e.kind==='dynamic')!, n=l.notes[0];
  q.x0=n.x-2;q.x1=n.x+2;q.y0=n.y-2;q.y1=n.y+2;
  checkExpressionIntegrity(entry.score,l,entry.options,resolveJankoTokens(entry.tokens),out); assert.ok(out.some(v=>v.code==='expression-clearance'));
  const phrase=l.expressions!.find(e=>e.kind==='phrase')!;phrase.endpointIds=[[],[]];
  checkExpressionIntegrity(entry.score,l,entry.options,resolveJankoTokens(entry.tokens),out); assert.ok(out.some(v=>v.code==='expression-endpoint'));
});
