import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildDurationSpecimenScore } from '../src/scores/duration-specimen';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { computePageGeometry, layoutJankoSystem, renderSystem, systemPaintedInkBoxes } from '../src/render/janko/engine';
import { buildInkScene, sceneBeamSvg, sceneBeamIntersectsBox, sceneInkAt, scenePhysicalBoxes, requireSceneCoverage } from '../src/render/janko/ink-scene';
import { beamPieceAt, beamPieceBox, beamPieceIntersectsBox, placedBeamGroup } from '../src/render/janko/beam-scene';
import { beamRailPathD, JANKO_STEM_STROKE_WIDTH, renderBeamGroup } from '../src/render/janko/elements/rhythm';
import { checkDotCountAgreement } from '../src/render/janko/linter';

const score=buildBachGoldbergVar1Score(),o=resolveJankoOptions(DEFAULT_JANKO_OPTIONS),t=resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const layout=layoutJankoSystem(score,computePageGeometry(o,t,score),0,o,t);
const scene=buildInkScene(layout,o,t,score);
const emit=(s=scene)=>renderSystem(score,layout.geometry,layout.index,o,t,layout,s);

test('placed grouped-beam is literal production paint: stems, extended vertical-face rails, levels and dots in order',()=>{
  assert.ok(scene.beams.length>0);
  requireSceneCoverage(scene,'grouped-beam');
  assert.throws(()=>requireSceneCoverage(scene,'solo-stems'),/does not cover/);
  const rendered=emit();
  for(const [i,beam] of layout.beams.entries()){
    const pieces=scene.beams[i],group=sceneBeamSvg(scene,i);
    assert.ok(rendered.includes(group));
    assert.equal(group,renderBeamGroup(beam.notes,t,beam,o.subdivisionStyle,o.durationGrammar));
    assert.equal(pieces.filter(p=>p.shape.kind==='stem').length,beam.notes.length);
    assert.equal(pieces.filter(p=>p.shape.kind==='rail').length,beam.levels.length);
    assert.equal(pieces[0].shape.kind,'stem');
    assert.ok(pieces.every(p=>p.groupId===pieces[0].groupId&&p.system===layout.index&&p.ownerIds.length>0));
    for(const [j,stem] of beam.stems.entries()){
      const p=pieces[j];assert.equal(p.shape.kind,'stem');
      if(p.shape.kind!=='stem')continue;
      assert.equal(p.shape.width,JANKO_STEM_STROKE_WIDTH);
      assert.equal(p.shape.x,Number(stem.stemX.toFixed(2)));
      assert.match(p.svg,/class="janko-stem".*stroke-width="0.90"/);
    }
    for(const [j,strip] of beam.levels.entries()){
      const p=pieces[beam.stems.length+j],c=strip.connector;
      assert.equal(p.shape.kind,'rail');
      assert.ok(p.svg.includes(`d="${beamRailPathD(c.x1,c.y1,c.x2,c.y2,t.beamThickness)}"`));
      if(strip.level>1)assert.ok(p.svg.includes(`data-beam-level="${strip.level}"`));
      if(strip.stub)assert.ok(p.svg.includes('data-beam-stub="1"'));
      if(p.shape.kind==='rail')assert.equal(p.shape.points[0][0],p.shape.points[3][0],'vertical end face');
    }
  }
  assert.ok(rendered.indexOf(sceneBeamSvg(scene,0))<rendered.indexOf('class="janko-knockout"'));
  assert.equal(systemPaintedInkBoxes(layout,o,t).filter(b=>b.what.includes('legacy broad beam')).length,0);
});

test('filled sloped rail has no phantom corner, positive interior and finite-box obstruction',()=>{
  const rail=scene.beams.flat().find(p=>p.shape.kind==='rail'&&p.shape.points[0][1]!==p.shape.points[1][1])!;
  assert.ok(rail&&rail.shape.kind==='rail');
  if(rail.shape.kind!=='rail')return;
  const [a,b,c,d]=rail.shape.points,midX=(a[0]+b[0])/2,midY=(a[1]+c[1])/2;
  assert.equal(beamPieceAt(rail,midX,midY),true);
  assert.equal(beamPieceIntersectsBox(rail,{x0:midX-0.01,y0:midY-0.01,x1:midX+0.01,y1:midY+0.01}),true);
  const bound=beamPieceBox(rail),y=bound.y0+0.02;
  // Choose the corner above the *lower* top edge, inside the broad box.
  const cornerX=a[1]<b[1]?b[0]-0.05:a[0]+0.05;
  assert.equal(beamPieceIntersectsBox(rail,{x0:cornerX-0.01,y0:y,x1:cornerX+0.01,y1:y+0.01}),false);
  assert.throws(()=>beamPieceIntersectsBox(rail,{x0:0,x1:Number.POSITIVE_INFINITY,y0:0,y1:1}),/finite/);
  assert.throws(()=>beamPieceAt(rail,Number.NaN,y),/finite/);
  void d;
});

test('stored rail, stem and dot mutation changes emission and point/box queries; independent music oracle catches omitted ink',()=>{
  const beamed={...layout.beams[0],notes:layout.beams[0].notes.map((v,i)=>i===0?{...v,durationTicks:36,dotX:v.x+10,dotY:v.y+4}:v)};
  const group=placedBeamGroup(beamed,t,'complete',layout.index,0);
  const fixture={...scene,beams:[group],pitch:[],ledger:[],beat:[],barlines:[],heads:new Map()};
  for(const kind of ['rail','stem','dot'] as const){
    const p=group.find(v=>v.shape.kind===kind)!;
    assert.ok(p,`real score contains ${kind}`);
    const old=p.shape,markup=p.svg,b=beamPieceBox(p),x=(b.x0+b.x1)/2,y=(b.y0+b.y1)/2;
    const inserted={...scene,beams:[group,...scene.beams.slice(1)]};
    const before=emit(inserted);
    p.shape=kind==='stem'&&old.kind==='stem'?{...old,x:old.x+1000}:
      kind==='dot'&&old.kind==='dot'?{...old,cx:old.cx+1000}:
      old.kind==='rail'?{...old,points:old.points.map(([px,py])=>[px+1000,py] as [number,number])}:old;
    assert.notEqual(p.svg,markup);
    assert.notEqual(emit(inserted),before,'production reads stored group');
    assert.ok(sceneBeamSvg(fixture,0).includes(p.svg));
    assert.equal(beamPieceAt(p,x,y),false);
    assert.equal(beamPieceIntersectsBox(p,{x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1}),false);
    p.shape=old;
  }
  const target=group.find(p=>p.shape.kind==='dot')!;
  const missing=group.filter(p=>p!==target);
  const violations:Parameters<typeof checkDotCountAgreement>[3]=[];
  const mutant={...scene,beams:[missing,...scene.beams.slice(1)]};
  checkDotCountAgreement({...layout,beams:[beamed,...layout.beams.slice(1)]},resolveJankoOptions({...o,durationGrammar:'complete'}),t,violations,mutant);
  assert.ok(violations.some(v=>v.code==='dot-count-agreement'));
  const missingStem=group.filter(p=>p.shape.kind!=='stem'||p!==group[0]);
  const connection:Parameters<typeof checkDotCountAgreement>[3]=[];
  checkDotCountAgreement({...layout,beams:[beamed,...layout.beams.slice(1)]},resolveJankoOptions({...o,durationGrammar:'complete'}),t,connection,
    {...scene,beams:[missingStem,...scene.beams.slice(1)]});
  assert.ok(connection.some(v=>v.code==='beam-connection'));
  const shiftedRail=group.map(p=>p.shape.kind==='rail'&&p.level===1?
    {...p,shape:{kind:'rail' as const,points:p.shape.points.map(([px,py])=>[px,py+10] as [number,number])}}:p);
  const disconnected:Parameters<typeof checkDotCountAgreement>[3]=[];
  checkDotCountAgreement({...layout,beams:[beamed,...layout.beams.slice(1)]},resolveJankoOptions({...o,durationGrammar:'complete'}),t,disconnected,
    {...scene,beams:[shiftedRail,...scene.beams.slice(1)]});
  assert.ok(disconnected.some(v=>v.code==='beam-connection'));
});

test('real complete-grammar 32nd/64th and Gould stubs, strict-grid ordered erasure and later head mask',()=>{
  const specimen=buildDurationSpecimenScore();
  const complete=resolveJankoOptions({...o,durationGrammar:'complete',gridWritingPolicy:'strict-protected-grid'});
  const l=layoutJankoSystem(specimen,computePageGeometry(complete,t,specimen),0,complete,t);
  const s=buildInkScene(l,complete,t,specimen);
  const rails=s.beams.flat().filter(p=>p.shape.kind==='rail');
  assert.ok(rails.some(p=>p.level===3));
  const all=Array.from({length:Math.ceil(5/complete.measuresPerSystem)},(_,i)=>{
    const placed=layoutJankoSystem(specimen,computePageGeometry(complete,t,specimen),i,complete,t);
    return buildInkScene(placed,complete,t,specimen).beams.flat();
  }).flat();
  assert.ok(all.some(p=>p.stub));
  assert.ok(renderSystem(specimen,l.geometry,0,complete,t,l,s).includes(sceneBeamSvg(s,0)));
  // Inject a placed beam where the strict-grid air channel crosses; the
  // channel erases old ink but must not erase a later head repaint.
  const rail=rails[0],old=rail.shape;
  const air=[...s.beat,...s.barlines].find(p=>p.primitive.kind==='erase'&&p.primitive.stroke);
  assert.ok(air&&air.primitive.kind==='erase');
  if(!air||air.primitive.kind!=='erase')return;
  const channel=air.primitive.stroke!;
  const x=channel.x1,y=channel.y1+1;
  rail.shape={kind:'rail',points:[[x-4,y-0.2],[x+4,y-0.2],[x+4,y+0.2],[x-4,y+0.2]]};
  const local={...s,beams:[[rail]],pitch:[],ledger:[],heads:new Map()};
  assert.equal(sceneInkAt(local,x,y).some(p=>p.family==='grouped-beam'),false);
  assert.ok(sceneInkAt(local,x+2,y).some(p=>p.family==='grouped-beam'));
  assert.equal(sceneBeamIntersectsBox(local,{x0:x-0.02,y0:y-0.02,x1:x+0.02,y1:y+0.02}),false);
  assert.ok(scenePhysicalBoxes(local).some(b=>b.what.includes('grouped-beam')));
  const template=s.heads.values().next().value!;
  const mask={...template.find(p=>p.primitive.kind==='erase')!,primitive:{kind:'erase' as const,box:{x0:x+1,y0:y-1,x1:x+1.5,y1:y+1},protects:'own-digit' as const}};
  const withMask={...local,heads:new Map([['later',[mask]]])};
  assert.equal(sceneInkAt(withMask,x+1.25,y).some(p=>p.family==='grouped-beam'),false);
  assert.equal(sceneBeamIntersectsBox(withMask,{x0:x+1.2,y0:y-0.05,x1:x+1.3,y1:y+0.05}),false);
  assert.ok(sceneInkAt(withMask,x+1.7,y).some(p=>p.family==='grouped-beam'),'partial-width ink survives');
  const repaint={...withMask,heads:new Map([['later',[mask,{...template[2],primitive:{kind:'beam' as const,beam:rail},paint:{cls:'later-repaint'}}]]])};
  assert.ok(sceneInkAt(repaint,x+1.25,y).some(p=>p.paint.cls==='later-repaint'));
  rail.shape=old;
});

test('real Bach m31 and Brahms mm7–10/m70 retain placed grouped beats on their score windows',()=>{
  const corpus=[{score,opts:o,tok:t,measures:[31]},
    {score:buildBrahmsOp118No1Score(),opts:resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),tok:resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS),measures:[7,8,9,10,70]}];
  for(const entry of corpus){
    const g=computePageGeometry(entry.opts,entry.tok,entry.score);
    for(const measure of entry.measures){
      const index=Math.floor((measure-1)/entry.opts.measuresPerSystem);
      const placed=layoutJankoSystem(entry.score,g,index,entry.opts,entry.tok);
      const s=buildInkScene(placed,entry.opts,entry.tok,entry.score);
      assert.ok(s.beams.length,`measure ${measure} system ${index} contains grouped ink`);
      const local=s.beams.flat().filter(p=>Math.floor(p.tick/entry.tok.ticksPerMeasure)+1===measure);
      assert.ok(local.length,`measure ${measure} directly owns grouped ink`);
      assert.ok(renderSystem(entry.score,placed.geometry,index,entry.opts,entry.tok,placed,s).includes(sceneBeamSvg(s,0)));
    }
  }
});
