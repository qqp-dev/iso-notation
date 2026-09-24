import test from 'node:test';
import assert from 'node:assert/strict';
import { placedRestPaint, serializeRestPaint, type JankoRestInk } from '../src/render/janko/elements/rests';
import { restInkAt, restInkInBox, restDiscClearance } from '../src/render/janko/rest-physical';
import { buildInkScene } from '../src/render/janko/ink-scene';
import { checkRestClearance, lintJankoScore, DEFAULT_JANKO_LINT_OPTIONS, systemBarlines } from '../src/render/janko/linter';
import { layoutJankoScore } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { buildRestDurationSpecimenScore, REST_DURATION_SPECIMEN_JANKO_OPTIONS, REST_DURATION_SPECIMEN_JANKO_TOKENS } from '../src/scores/rest-duration-specimen';

const t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const rest = { tick: 192, durationTicks: 96, hand: 'RH' as const, x: 20, y: 30, value: 'half' as const, style: 'classical-urtext' as const };
const records = placedRestPaint(rest,0,0,0,t);
const rect = (primitive: JankoRestInk) => [{ ...records[0], primitive }];
const painted = rect({kind:'rect',cls:'janko-rest-block',x:10.123,y:20.456,w:4.321,h:3.987,fill:'#1A1A1A',stroke:null});

test('literal SVG rectangle and the certified queries share effective two-decimal ink', () => {
  assert.match(serializeRestPaint(painted), /<rect class="janko-rest-block" x="10.12" y="20.46" width="4.32" height="3.99" fill="#1A1A1A" stroke="none"\/>/);
  assert.equal(restInkAt(painted,12,22).kind,'ink');
  assert.equal(restInkAt(painted,16,22).kind,'clear');
  assert.equal(restInkAt(painted,10.12,22).kind,'unknown');
  assert.equal(restInkInBox(painted,{x0:14.439,y0:21,x1:14.441,y1:22}).kind,'ink');
  assert.equal(restInkInBox(painted,{x0:14.441,y0:21,x1:14.45,y1:22}).kind,'clear');
  assert.equal(restInkInBox(painted,{x0:14.44,y0:21,x1:14.45,y1:22}).kind,'unknown');
  assert.equal(restInkInBox(painted,{x0:10,y0:21,x1:10,y1:22}).kind,'unknown');
  assert.equal(restInkAt(painted,Infinity,22).kind,'unknown');
  assert.equal(restDiscClearance(painted,16.44,22,2).kind,'unknown');
  assert.equal(restDiscClearance(painted,16.44 + 1e-10,22,2).kind,'unknown');
  assert.equal(restDiscClearance(painted,16.45,22,2).kind,'clear');
  assert.equal(restDiscClearance(painted,16.43,22,2).kind,'ink');
  // Four sides and corner have analytic Euclidean distance to the FILLED slab.
  for (const [x,y,expected] of [[9,22,1.12],[16,22,1.56],[12,19,1.46],[12,26,1.55],[9,19,Math.hypot(1.12,1.46)]]) {
    const q = restDiscClearance(painted,x,y,0.1);
    assert.equal(q.kind,'clear');
    if(q.kind==='clear') assert.ok(Math.abs(q.certificate.distance-expected)<1e-8);
  }
});

test('unsupported shape/paint refuses whole rest including narrow dashed ellipse grazing', () => {
  const unsupported: JankoRestInk[] = [
    {kind:'rect',cls:'r',x:0,y:0,w:4,h:4,fill:null,stroke:0.8,dash:'2,3'},
    {kind:'rect',cls:'r',x:0,y:0,w:4,h:4,rx:0.4,fill:'#111111',stroke:null},
    {kind:'ellipse',cls:'phantom',c:{x:0,y:0},rx:2,ry:2,stroke:0.8,fill:null,dash:'2,3'},
    {kind:'path',cls:'cubic',start:{x:0,y:0},segments:[],close:true,fill:'#111111',stroke:null},
    {kind:'poly',cls:'poly',pts:[{x:0,y:0}],close:true,fill:'#111111',stroke:null},
    {kind:'rect',cls:'erase',x:0,y:0,w:4,h:4,fill:'#FFFFFF',stroke:null},
  ];
  for(const shape of unsupported) {
    const group=[...painted, ...rect(shape).map(p=>({...p,id:'second'}))];
    assert.equal(restInkAt(group,1,1).kind,'unknown');
    assert.equal(restInkInBox(group,{x0:2.39988,y0:-.039,x1:2.39992,y1:.039}).kind,'unknown');
    assert.equal(restDiscClearance(group,1,1,0.2).kind,'unknown');
  }
  // Future ellipse phase positive gate: the box above grazes a dashed on-arc
  // (rx=ry=2, stroke=.8). Refusal is not a false free-space certificate.
});

test('live linter retires certified box distance, counts unsupported fallback, keeps barline policy', () => {
  const score=buildRestDurationSpecimenScore(), o=resolveJankoOptions(REST_DURATION_SPECIMEN_JANKO_OPTIONS);
  const tokens=resolveJankoTokens(REST_DURATION_SPECIMEN_JANKO_TOKENS);
  const layout=layoutJankoScore(score,o,tokens).find(system => system.rests.some(r=>r.value==='half'||r.value==='whole'))!;
  const original=layout.rests.find(r=>r.value==='half'||r.value==='whole');
  assert.ok(original,'real Bach system has a bar rest');
  const p=layout.notes[0];
  const broken={...layout,rests:[{...original,x:p.x,y:p.y}]};
  const scene=buildInkScene(broken,o,tokens,score), group=scene.restPaint[0];
  const out: Parameters<typeof checkRestClearance>[4]=[];
  const counts={certified:0,fallback:{} as Record<string,number>};
  checkRestClearance(broken,o,tokens,DEFAULT_JANKO_LINT_OPTIONS,out,scene,counts);
  assert.ok(counts.certified>0);
  assert.ok(out.some(d=>d.code==='rest-collision'&&d.noteIds?.includes(p.note.id)));
  // Move just stored paint far away, holding original layout/admission fixed.
  const old=group[0].primitive;
  assert.equal(old.kind,'rect');
  if(old.kind!=='rect') return;
  group[0].primitive={...old,x:old.x+500};
  assert.notEqual(restDiscClearance(group,p.x,p.y,tokens.noteheadRadius).kind,'ink');
  const moved: typeof out=[];
  checkRestClearance(broken,o,tokens,DEFAULT_JANKO_LINT_OPTIONS,moved,scene);
  assert.ok(!moved.some(d=>d.noteIds?.includes(p.note.id)),'certified branch does not also calculate old box');
  assert.notEqual(serializeRestPaint(group),serializeRestPaint([{...group[0],primitive:old}]));
  group[0].primitive={kind:'ellipse',cls:'phantom',c:{x:p.x,y:p.y},rx:2,ry:2,stroke:.8,fill:null,dash:'2,3'};
  const fallback: typeof out=[];
  const reasons={certified:0,fallback:{} as Record<string,number>};
  checkRestClearance(broken,o,tokens,DEFAULT_JANKO_LINT_OPTIONS,fallback,scene,reasons);
  assert.equal(reasons.certified,0);
  assert.ok(reasons.fallback['shape not certified']>0);
  assert.ok(fallback.some(d=>d.noteIds?.includes(p.note.id)),'unsupported paint uses original admission policy');
  // Force the separately protected barline branch to fire under strict grid.
  // Stored paint movement cannot remove that named admission collision.
  const strict=resolveJankoOptions({...REST_DURATION_SPECIMEN_JANKO_OPTIONS,gridWritingPolicy:'strict-protected-grid'});
  const bar=systemBarlines(broken,strict,tokens)[0];
  assert.ok(bar);
  const onBar={...broken,rests:[{...broken.rests[0],x:bar.x,y:(bar.top+bar.bottom)/2}]};
  const barHits: typeof out=[];
  checkRestClearance(onBar,strict,tokens,DEFAULT_JANKO_LINT_OPTIONS,barHits,scene);
  assert.ok(barHits.some(d=>d.metrics?.barlineX===bar.x));
});

test('real corpus and literal seven-value specimen have certified decisions and counted fallbacks', () => {
  for(const [score,opts,tokens,expectedCertified] of [
    [buildBachGoldbergVar1Score(),DEFAULT_JANKO_OPTIONS,DEFAULT_JANKO_TOKENS,0],
    [buildBrahmsOp118No1Score(),BRAHMS_OP118_NO1_JANKO_OPTIONS,BRAHMS_OP118_NO1_JANKO_TOKENS,0],
    [buildRestDurationSpecimenScore(),REST_DURATION_SPECIMEN_JANKO_OPTIONS,REST_DURATION_SPECIMEN_JANKO_TOKENS,30],
  ] as const) {
    const report=lintJankoScore(score,opts,tokens);
    assert.equal(report.stats.restPhysical.certified,expectedCertified);
    assert.ok(report.stats.restPhysical.fallback['shape not certified']>0);
    assert.equal(report.violations.length,0);
  }
});
