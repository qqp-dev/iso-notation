import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { computePageGeometry, layoutJankoScore, layoutJankoSystem, renderSystem, systemPaintedInkBoxes, systemPageBookingBoxes } from '../src/render/janko/engine';
import { buildInkScene, preliminaryStaffRules, requireSceneCoverage, sceneGridSvg, sceneHeadSvg, sceneLedgerAt, sceneLedgerBoxes, sceneLedgerSvg, sceneInkAt, scenePhysicalBoxes, sceneStaffRules, SCENE_FONT, serializeInkPiece, type InkPiece, type InkScene } from '../src/render/janko/ink-scene';
import { GOTHIC_DEMI_GLYPHS } from '../src/render/janko/gothic-glyphs';
import { renderBarlines, renderBeatGrid } from '../src/render/janko/elements/barlines';
import { renderLedgerEquator, renderOutlierRule, renderPitchGrid, outlierLedgerSpans } from '../src/render/janko/elements/staff';
import { renderNotehead } from '../src/render/janko/elements/notehead';

const score = buildBachGoldbergVar1Score();
const o = resolveJankoOptions(DEFAULT_JANKO_OPTIONS), t = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const page = computePageGeometry(o,t,score);
const layout = layoutJankoSystem(score,page,0,o,t);
const scene = buildInkScene(layout,o,t,score);
const svg = renderSystem(score,layout.geometry,0,o,t,layout);

test('placed scene emits literal pre-cutover grid, pulses, and head SVG in real system order', () => {
  const pitch = ['  <g class="janko-pitch-grid">',...scene.pitch.map(p=>p.svg),'  </g>'].join('\n');
  const beat = scene.beat.length ? ['  <g class="janko-beat-grid">',...scene.beat.map(p=>p.svg),'  </g>'].join('\n') : '';
  const bars = ['  <g class="janko-barlines">',...scene.barlines.map(p=>p.svg),'  </g>'].join('\n');
  assert.equal(pitch, renderPitchGrid(layout.geometry,o,t));
  assert.equal(beat,renderBeatGrid(layout.geometry,0,o,t,layout.columns));
  assert.equal(bars,renderBarlines(layout.geometry,o,t,layout.isFinalSystem));
  assert.ok(svg.includes(pitch)&&svg.includes(bars));
  if(beat)assert.ok(svg.includes(beat));
  for(const p of layout.notes){
    const pieces=scene.heads.get(p.note.id)!;
    const spec={x:p.x,y:p.y,pitchClass:p.coord.pitchClass,hand:p.coord.hand,isPositionOfHonor:p.note.startTick===0&&o.showHonorHalo,tallKnockout:p.tallKnockout===true,symbolScale:p.symbolScale,chordMember:p.symbolChord};
    assert.equal(pieces.map(q=>q.svg).join('\n'),renderNotehead(spec,t,o));
    assert.ok(svg.includes(pieces.map(q=>q.svg).join('\n')));
  }
  assert.ok(svg.indexOf(pitch)<svg.indexOf(beat)&&svg.indexOf(beat)<svg.indexOf(bars));
  assert.ok(svg.indexOf(bars)<svg.indexOf('class="janko-knockout"'));
  assert.match(beat,/stroke-dasharray="2,3"/);
});

test('fixed-core ledger paint and measured rules share placed primitives, not centre-line reservations', () => {
  const first=layout.notes.find(p=>p.note.startTick<t.ticksPerMeasure)!;
  const second=layout.notes.find(p=>p.note.startTick>=t.ticksPerMeasure)!;
  assert.ok(first&&second);
  const continuous={...layout,notes:layout.notes.map(p=>p===first||p===second
    ?{...p,coord:{...p.coord,octave:6,ledgerYs:[-90]}}:p)};
  assert.ok(outlierLedgerSpans(continuous.notes,continuous.geometry,continuous.index,t).length,'two distinct measures create a span');
  const shortLayout={...layout,notes:layout.notes.map(p=>p===first
    ?{...p,coord:{...p.coord,octave:1,ledgerYs:[90]}}:p)};
  for (const placed of [shortLayout,continuous]) {
    const s=buildInkScene(placed,o,t,score), rendered=renderSystem(score,placed.geometry,placed.index,o,t,placed);
    const spans=outlierLedgerSpans(placed.notes,placed.geometry,placed.index,t);
    const expected=[...spans.map(r=>renderOutlierRule(r.x1,r.x2,r.y)),
      ...placed.notes.flatMap(p=>p.coord.ledgerYs.filter(y=>!spans.some(r=>r.key===Math.round(y*100)))
        .map(y=>renderLedgerEquator(p.x,placed.geometry.middleCY+y,t,o)))].filter(Boolean).join('\n');
    assert.equal(s.ledger.map(p=>p.svg).join('\n'),expected);
    assert.ok(rendered.includes(sceneLedgerSvg(s)));
    for(const span of spans){
      const rule=s.ledger.find(p=>p.primitive.kind==='stroke'&&p.primitive.x1===span.x1&&p.primitive.y1===span.y)!;
      assert.ok(rule&&rule.ownerIds.length>1);
      assert.equal(rule.structuralOwner,`system:${placed.index}:outlier:${span.key}`);
      assert.deepEqual(rule.span,[span.x1,span.x2]);
      assert.equal(sceneLedgerAt(s,span.x1-0.1,span.y).includes(rule),false,'butt cap ends at the emitted SVG x1');
      assert.ok(placed.notes.filter(p=>p.coord.octave>5&&p.coord.ledgerYs.some(y=>Math.round(y*100)===span.key))
        .every(p=>rule.ownerIds.includes(p.note.id)));
      assert.ok(sceneInkAt(s,(span.x1+span.x2)/2,span.y).includes(rule));
      assert.equal(s.ledger.filter(p=>p.primitive.kind==='stroke'&&p.primitive.y1===span.y&&p.paint.cls==='janko-ledger').length,0);
    }
    const short=s.ledger.find(p=>p.paint.cls==='janko-ledger');
    if(short){
      assert.equal(short.ownerIds[0],short.structuralOwner?.slice(5));
      assert.ok(sceneLedgerBoxes(s).some(b=>b.what.includes(short.id)));
      if(short.primitive.kind!=='stroke')throw new Error('ledger not stroke');
      const old=short.svg,x=short.primitive.x1,y=short.primitive.y1;
      short.primitive={...short.primitive,x1:x+0.12};
      assert.notEqual(short.svg,old);
      assert.equal(sceneInkAt(s,x+0.03,y).includes(short),false);
      assert.ok(sceneInkAt(s,x+0.15,y).includes(short));
    }
  }
  const bounded=resolveJankoOptions({...o,channelLayout:'bounded-channel'});
  const boundedLayout=layoutJankoSystem(score,computePageGeometry(bounded,t,score),0,bounded,t);
  const boundedShort={...boundedLayout,notes:boundedLayout.notes.map(p=>p.note.id===first.note.id
    ?{...p,coord:{...p.coord,octave:1,ledgerYs:[90]}}:p)};
  const b=buildInkScene(boundedShort,bounded,t,score);
  const pair=b.ledger.filter(p=>p.paint.cls==='janko-ledger').slice(0,2);
  assert.equal(pair.length,2);
  if(pair[0].primitive.kind!=='stroke'||pair[1].primitive.kind!=='stroke')throw new Error('missing bounded strokes');
  const x=(pair[0].primitive.x1+pair[0].primitive.x2)/2;
  const mid=(pair[0].primitive.y1+pair[1].primitive.y1)/2;
  assert.equal(sceneInkAt(b,x,mid).some(p=>p.family==='ledger'),false);
  assert.ok(sceneLedgerAt(b,x,pair[0].primitive.y1).includes(pair[0]));
  assert.equal(sceneLedgerAt(b,x,pair[0].primitive.y1+0.4).includes(pair[0]),false,'outside 0.75pt painted stroke');
  const merged={...shortLayout,unisonMerges:[...shortLayout.unisonMerges,{
    tick:first.note.startTick,pitchClass:first.coord.pitchClass,octave:first.coord.octave,
    survivorId:first.note.id,mergedIds:['authored-other-voice'],exact:true,
  }]};
  assert.ok(buildInkScene(merged,o,t,score).ledger.some(p=>p.ownerIds.includes('authored-other-voice')));
  const headNote=layout.notes[0];
  const line=sceneLedgerAt(buildInkScene(shortLayout,o,t,score),first.x,shortLayout.geometry.middleCY+90)[0];
  assert.ok(line&&line.primitive.kind==='stroke');
  const cross={...line,primitive:{kind:'stroke' as const,x1:headNote.x-12,y1:headNote.y,
    x2:headNote.x+12,y2:headNote.y,width:0.75,cap:'butt' as const}};
  const witness={...scene,pitch:[],ledger:[cross],beat:[],barlines:[],heads:new Map([[headNote.note.id,scene.heads.get(headNote.note.id)!]])};
  assert.equal(sceneLedgerAt(witness,headNote.x,headNote.y).length,0,'head knockout removes ledger from physical query');
  assert.ok(sceneLedgerAt(witness,headNote.x+10,headNote.y).includes(cross));
  assert.equal(sceneLedgerBoxes(witness).some(box=>box.x0<headNote.x&&headNote.x<box.x1&&box.y0<headNote.y&&headNote.y<box.y1),false);
  assert.ok(sceneLedgerBoxes(witness).some(box=>box.x0<headNote.x+10&&headNote.x+10<box.x1));
});

test('finite actual ink leaves old grid envelope whitespace free; drawn segment blocks', () => {
  const s=layout.geometry.staffSegments![0];
  // Move a real engine segment to start partway into the old full-width grid
  // envelope. This controlled placement is independent of the scene query.
  const g={...layout.geometry,staffSegments:[{...s,x1:layout.geometry.staffLeft+20,x2:layout.geometry.staffRight-20}]};
  const placed=buildInkScene({...layout,geometry:g},o,t,score);
  const y=placed.pitch[0].primitive.kind==='stroke'?placed.pitch[0].primitive.y1:NaN;
  const x=g.staffLeft+10;
  assert.ok(x>g.staffLeft&&x<g.staffRight);
  assert.equal(sceneStaffRules(placed,x).length,0);
  assert.equal(sceneInkAt(placed,x,y).some(p=>p.family==='pitch-grid'),false);
  assert.equal(placed.physical.some(b=>b.what.includes(':pitch:')&&b.x0<=x&&x<=b.x1&&b.y0<=y&&y<=b.y1),false);
  const drawnX=g.staffLeft+20.1;
  assert.ok(sceneStaffRules(placed,drawnX).length>0);
  assert.ok(sceneInkAt(placed,drawnX,y).some(p=>p.family==='pitch-grid'));
  assert.ok(placed.physical.some(b=>b.what.includes(':pitch:')&&b.x0<=drawnX&&drawnX<=b.x1&&b.y0<=y&&y<=b.y1));
  assert.ok(scenePhysicalBoxes(scene).every(b=>b.what!=='pitch grid'));
  assert.ok(systemPaintedInkBoxes(layout,o,t).every(b=>b.what!=='pitch grid'&&!b.what.startsWith('notehead ')));
  assert.ok(systemPageBookingBoxes(layout,o,t).some(b=>b.what==='pitch grid'), 'separate page policy only');
});

test('knockout erases earlier grid, keeps later digit; glyph counters and halo centre are empty', () => {
  const honor=layout.notes.find(p=>p.note.startTick===0)!;
  const honorOptions=resolveJankoOptions({...o,showHonorHalo:true});
  const haloScene=buildInkScene(layout,honorOptions,t,score);
  const pieces=haloScene.heads.get(honor.note.id)!;
  assert.deepEqual(pieces.map(p=>p.primitive.kind),['ring','erase','glyph']);
  assert.ok(renderSystem(score,layout.geometry,0,honorOptions,t,layout).includes(pieces[0].svg));
  assert.equal((pieces[2].primitive as {face:string}).face,SCENE_FONT);
  assert.equal(sceneInkAt(haloScene,honor.x,honor.y).some(p=>p.primitive.kind==='ring'),false);
  // Every glyph contour is measured from the shipped OTF; find an actual
  // painted point and an empty point in its broad-phase envelope independently.
  const digit=pieces[2],b=digit.box;
  const sample=[] as Array<{x:number;y:number;ink:boolean}>;
  for(let iy=0;iy<32;iy++)for(let ix=0;ix<32;ix++){
    const x=b.x0+(ix+0.5)*(b.x1-b.x0)/32,y=b.y0+(iy+0.5)*(b.y1-b.y0)/32;
    sample.push({x,y,ink:sceneInkAt(haloScene,x,y).includes(digit)});
  }
  assert.ok(sample.some(v=>v.ink)&&sample.some(v=>!v.ink),'ink and hollow counter are distinct');
  assert.ok(sceneInkAt(haloScene,sample.find(v=>v.ink)!.x,sample.find(v=>v.ink)!.y).includes(digit));
  assert.equal(sceneInkAt(haloScene,sample.find(v=>!v.ink)!.x,sample.find(v=>!v.ink)!.y).includes(digit),false);
  assert.ok(scene.key.includes('"score"')&&scene.key.includes('"layout"')&&scene.key.includes(SCENE_FONT));
});

test('strict grid air-channel order remains above rhythm and below heads', () => {
  const strict=resolveJankoOptions({...o,gridWritingPolicy:'strict-protected-grid'});
  const placed=layoutJankoSystem(score,computePageGeometry(strict,t,score),0,strict,t);
  const s=buildInkScene(placed,strict,t,score);
  const output=renderSystem(score,placed.geometry,0,strict,t,placed);
  assert.ok(s.beat.some(p=>p.primitive.kind==='erase'));
  assert.ok(output.indexOf('class="janko-beam"')<output.indexOf('class="janko-grid-channel"'));
  assert.ok(output.indexOf('class="janko-grid-channel"')<output.indexOf('class="janko-knockout"'));
  assert.ok(output.indexOf('class="janko-knockout"')<output.indexOf('class="janko-digit"'));
  const dashed=s.beat.find(p=>p.primitive.kind==='stroke'&&p.primitive.dash)!;
  const p=dashed.primitive as {x1:number;y1:number;dash:string};
  assert.ok(sceneInkAt(s,p.x1,p.y1+0.5).includes(dashed));
  assert.equal(sceneInkAt(s,p.x1,p.y1+3).includes(dashed),false,'dash gap is not ink');
});

test('dashed strict-grid erasure preserves ink behind gaps in queries and physical inventory', () => {
  const strict=resolveJankoOptions({...o,gridWritingPolicy:'strict-protected-grid'});
  const placed=layoutJankoSystem(score,computePageGeometry(strict,t,score),0,strict,t);
  const s=buildInkScene(placed,strict,t,score);
  const channel=s.beat.find(p=>p.primitive.kind==='erase'&&p.primitive.stroke?.dash==='2,3')!;
  assert.ok(channel.svg.includes('stroke-dasharray="2,3"'));
  const stroke=channel.primitive.kind==='erase'?channel.primitive.stroke!:null;
  assert.ok(stroke);
  const source=s.pitch[0];
  if(source.primitive.kind!=='stroke')throw new Error('missing rule stroke');
  const x=stroke.x1,half=source.primitive.width/2;
  const rules=[0.5,3].map((offset,i)=>{
    const y=stroke.y1+offset;
    return {...source,id:`witness-${i}`,primitive:{...source.primitive,x1:x-8,x2:x+8,y1:y,y2:y},box:{x0:x-8,y0:y-half,x1:x+8,y1:y+half}};
  });
  const witness={...s,pitch:rules,beat:[channel],barlines:[],heads:new Map()};
  assert.equal(sceneInkAt(witness,x,stroke.y1+0.5).includes(rules[0]),false,'white dash erases earlier ink');
  assert.ok(sceneInkAt(witness,x,stroke.y1+3).includes(rules[1]),'dash gap retains earlier ink');
  const boxes=scenePhysicalBoxes(witness);
  assert.equal(boxes.some(b=>b.what==='visible stroke witness-0'&&b.x0<=x&&b.x1>=x),false);
  assert.ok(boxes.some(b=>b.what==='visible stroke witness-1'&&b.x0<=x&&b.x1>=x));
});

test('reversed dashed strokes inventory follows the first SVG endpoint, not the minimum coordinate', () => {
  const source=scene.pitch[0];
  if(source.primitive.kind!=='stroke')throw new Error('missing pitch stroke');
  for(const [axis,at] of [['vertical',(n:number)=>[5,n]],['horizontal',(n:number)=>[n,5]]] as const){
    const primitive:InkPiece['primitive']={...source.primitive,x1:axis==='vertical'?5:10,y1:axis==='vertical'?10:5,
      x2:axis==='vertical'?5:0,y2:axis==='vertical'?0:5,width:0.65,dash:'2,3'};
    const piece:InkPiece={...source,id:`reversed-${axis}`,primitive};
    const witness:InkScene={...scene,pitch:[piece],beat:[],barlines:[],heads:new Map()};
    const boxes=scenePhysicalBoxes(witness);
    assert.match(serializeInkPiece(piece),axis==='vertical'?/y1="10.00" x2="5.00" y2="0.00"/:/x1="10.00" y1="5.00" x2="0.00"/);
    assert.match(serializeInkPiece(piece),/stroke-dasharray="2,3"/);
    for(const [coordinate,expected] of [[9,true],[1,false]] as const){
      const [x,y]=at(coordinate);
      assert.equal(sceneInkAt(witness,x,y).includes(piece),expected,`${axis} point at ${coordinate}`);
      assert.equal(boxes.some(b=>b.what===`visible stroke reversed-${axis}`&&b.x0<x&&x<b.x1&&b.y0<y&&y<b.y1),expected,
        `${axis} physical box at ${coordinate}`);
    }
  }
});

test('reversed dashed erase clips only painted intervals and leaves the other half intact', () => {
  const source=scene.pitch[0],channel=scene.beat[0];
  if(source.primitive.kind!=='stroke')throw new Error('missing pitch stroke');
  const rule={...source,id:'reversed-erase-rule',primitive:{...source.primitive,x1:0,y1:0,x2:10,y2:0,width:0.65}};
  const erase={...channel,primitive:{kind:'erase' as const,box:{x0:0,y0:0,x1:10,y1:1},protects:'strict-grid-air' as const,
    stroke:{kind:'stroke' as const,x1:10,y1:0.5,x2:0,y2:0.5,width:1,cap:'butt' as const,dash:'2,3'}}};
  const witness={...scene,pitch:[rule],beat:[erase],barlines:[],heads:new Map()};
  const boxes=scenePhysicalBoxes(witness).filter(b=>b.what==='visible stroke reversed-erase-rule');
  assert.match(serializeInkPiece(erase),/x1="10.00" y1="0.50" x2="0.00" y2="0.50".*stroke-dasharray="2,3"/);
  for(const [x,masked] of [[9,true],[6,false],[1,false]] as const){
    assert.equal(sceneInkAt(witness,x,0.1).includes(rule),!masked,`point under reversed dash at ${x}`);
    assert.equal(boxes.some(b=>b.x0<x&&x<b.x1&&b.y0<0.1&&0.1<b.y1),!masked,`physical under reversed dash at ${x}`);
    assert.ok(sceneInkAt(witness,x,-0.1).includes(rule),'erase only covers upper half');
    assert.ok(boxes.some(b=>b.x0<x&&x<b.x1&&b.y0< -0.1&&-0.1<b.y1),'lower half retained');
  }
});

test('2D partial erasure retains the surviving half of a rule, including a dashed gap', () => {
  const source=scene.pitch[0];
  if(source.primitive.kind!=='stroke')throw new Error('missing pitch stroke');
  const rule={...source,id:'half-width-witness',primitive:{...source.primitive,x1:10,y1:0,x2:20,y2:0,width:0.65},box:{x0:10,x1:20,y0:-0.325,y1:0.325}};
  const erased={...scene.beat[0],id:'half-erase',primitive:{kind:'erase' as const,box:{x0:12,x1:18,y0:0,y1:1},protects:'strict-grid-air' as const}};
  const witness={...scene,pitch:[rule],beat:[erased],barlines:[],heads:new Map()};
  assert.ok(sceneInkAt(witness,15,-0.1).includes(rule));
  assert.equal(sceneInkAt(witness,15,0.1).includes(rule),false);
  assert.ok(scenePhysicalBoxes(witness).some(b=>b.what==='visible stroke half-width-witness'&&b.x0<=15&&b.x1>=15&&b.y0<=-0.1&&b.y1>=-0.1));
  assert.equal(scenePhysicalBoxes(witness).some(b=>b.what==='visible stroke half-width-witness'&&b.x0<15&&b.x1>15&&b.y0<0.1&&b.y1>0.1),false);
  const dashed={...erased,primitive:{...erased.primitive,stroke:{kind:'stroke' as const,x1:15,y1:-1,x2:15,y2:4,width:6,cap:'butt' as const,dash:'1,3'},box:{x0:12,x1:18,y0:-1,y1:4}}};
  const gap={...rule,primitive:{...rule.primitive,y1:1,y2:1},box:{x0:10,x1:20,y0:0.675,y1:1.325}};
  const dashedScene={...witness,pitch:[rule,gap],beat:[dashed]};
  assert.ok(sceneInkAt(dashedScene,15,1).includes(gap),'the white dash gap does not erase');
  assert.ok(scenePhysicalBoxes(dashedScene).some(b=>b.what==='visible stroke half-width-witness'&&b.y0<=1&&b.y1>=1));
});

test('stored primitives alone control scene SVG and point queries after mutation', () => {
  const s=buildInkScene(layout,o,t,score);
  const pitch=s.pitch[0];
  if(pitch.primitive.kind!=='stroke')throw new Error('missing pitch');
  const before=pitch.svg;
  pitch.primitive={...pitch.primitive,x1:pitch.primitive.x1+0.125};
  assert.notEqual(pitch.svg,before);
  assert.match(sceneGridSvg(s.pitch,'janko-pitch-grid',true),new RegExp(`x1="${(pitch.primitive.x1).toFixed(2)}"`));
  assert.equal(sceneInkAt(s,pitch.primitive.x1-0.05,pitch.primitive.y1).includes(pitch),false);
  assert.ok(sceneInkAt(s,pitch.primitive.x1+0.05,pitch.primitive.y1).includes(pitch));
  const beat=s.beat.find(p=>p.primitive.kind==='stroke')!;
  const bar=s.barlines.find(p=>p.primitive.kind==='stroke')!;
  for(const item of [beat,bar]){
    if(item.primitive.kind!=='stroke')throw new Error('missing vertical stroke');
    const original=item.svg;
    item.primitive={...item.primitive,x1:item.primitive.x1+1.2,x2:item.primitive.x2+1.2};
    assert.notEqual(item.svg,original);
    assert.ok(item.svg.includes(`x1="${item.primitive.x1.toFixed(2)}"`));
    assert.ok(sceneInkAt(s,item.primitive.x1,item.primitive.y1+0.5).includes(item));
    assert.equal(sceneInkAt(s,item.primitive.x1-1.2,item.primitive.y1+0.5).includes(item),false);
  }
  const strict=resolveJankoOptions({...o,gridWritingPolicy:'strict-protected-grid'});
  const sl=layoutJankoSystem(score,computePageGeometry(strict,t,score),0,strict,t);
  const strictScene=buildInkScene(sl,strict,t,score);
  const channel=strictScene.beat.find(p=>p.primitive.kind==='erase')!;
  if(channel.primitive.kind!=='erase'||!channel.primitive.stroke)throw new Error('missing grid channel');
  const old=channel.svg;
  const stroke=channel.primitive.stroke;
  const oldEnd=stroke.y2;
  channel.primitive={...channel.primitive,stroke:{...stroke,y2:oldEnd-2},box:{...channel.primitive.box,y1:oldEnd-2}};
  assert.notEqual(channel.svg,old);
  assert.ok(channel.svg.includes(`y2="${(oldEnd-2).toFixed(2)}"`));
  // Outside the edited channel endpoint no erase occurs, regardless of the
  // broad-phase box originally stored at construction time.
  const prior={...strictScene.pitch[0],primitive:{kind:'stroke' as const,x1:stroke.x1-3,y1:oldEnd-0.5,x2:stroke.x1+3,y2:oldEnd-0.5,width:0.65,cap:'butt' as const}};
  assert.ok(sceneInkAt({...strictScene,pitch:[prior],beat:[channel],barlines:[],heads:new Map()},stroke.x1,oldEnd-0.5).includes(prior));
  const note=s.heads.entries().next().value!;
  const [id,parts]=note;
  for(const item of parts){
    const before=item.svg;
    if(item.primitive.kind==='ring')item.primitive={...item.primitive,radius:item.primitive.radius+0.25};
    if(item.primitive.kind==='erase')item.primitive={...item.primitive,box:{...item.primitive.box,x0:item.primitive.box.x0-0.25}};
    if(item.primitive.kind==='glyph')item.primitive={...item.primitive,x:item.primitive.x+0.25};
    assert.notEqual(item.svg,before,`${item.id} must serialize its edited primitive`);
    assert.ok(sceneHeadSvg(s,id).includes(item.svg));
  }
  const mask=parts.find(p=>p.primitive.kind==='erase')!;
  if(mask.primitive.kind!=='erase')throw new Error('missing mask');
  const rule=s.pitch.find(p=>p.primitive.kind==='stroke')!;
  const y=mask.primitive.box.y0+0.1;
  const x=mask.primitive.box.x0+0.10;
  const inkRule={...rule,primitive:{kind:'stroke' as const,x1:x-1,y1:y,x2:x+1,y2:y,width:0.65,cap:'butt' as const}};
  assert.equal(sceneInkAt({...s,pitch:[inkRule],beat:[],barlines:[],heads:new Map([[id,parts]])},x,y).includes(inkRule),false,'edited mask erases an earlier rule at new extent');
  const digit=parts.find(p=>p.primitive.kind==='glyph')!;
  if(digit.primitive.kind!=='glyph')throw new Error('missing digit');
  assert.ok(digit.svg.includes(`x="${digit.primitive.x.toFixed(2)}"`));
  const withHalo=buildInkScene(layout,resolveJankoOptions({...o,showHonorHalo:true}),t,score);
  const honor=withHalo.heads.get(layout.notes.find(p=>p.note.startTick===0)!.note.id)!;
  const halo=honor.find(p=>p.primitive.kind==='ring')!;
  if(halo.primitive.kind!=='ring')throw new Error('missing ring');
  const oldRadius=halo.primitive.radius;
  halo.primitive={...halo.primitive,radius:oldRadius+0.5};
  assert.match(halo.svg,new RegExp(`r="${(oldRadius+0.5).toFixed(2)}"`));
  assert.ok(sceneInkAt(withHalo,halo.primitive.cx+oldRadius+0.5,halo.primitive.cy).includes(halo));
  assert.equal(sceneInkAt(withHalo,halo.primitive.cx+oldRadius-0.5,halo.primitive.cy).includes(halo),false);
});

test('placed merged head retains every collapsed semantic owner, not just rhythm voices', () => {
  const final=layoutJankoScore(score,o,t).at(-1)!;
  const merge=final.unisonMerges.find(m=>m.mergedIds.length>0)!;
  assert.ok(merge);
  assert.equal(final.notes.some(p=>merge.mergedIds.includes(p.note.id)),false);
  const painted=buildInkScene(final,o,t,score).heads.get(merge.survivorId)!;
  assert.ok(painted.length>0);
  for(const piece of painted)assert.deepEqual(piece.ownerIds,[merge.survivorId,...merge.mergedIds]);
  const brahms=buildBrahmsOp118No1Score();
  const bo=resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),bt=resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  const mixed=layoutJankoScore(brahms,bo,bt).find(l=>l.unisonMerges.some(m=>!m.exact))!;
  const mixedMerge=mixed.unisonMerges.find(m=>!m.exact)!;
  assert.ok(mixed.unisonVoices.some(v=>v.unisonSurvivorId===mixedMerge.survivorId));
  const mixedHead=buildInkScene(mixed,bo,bt,brahms).heads.get(mixedMerge.survivorId)!;
  for(const piece of mixedHead)assert.deepEqual(piece.ownerIds,[mixedMerge.survivorId,...mixedMerge.mergedIds]);
});

test('a head mask removes earlier rule ink only, never later digit ink', () => {
  const rule=scene.pitch.find(p=>p.primitive.kind==='stroke'&&p.box.x1-p.box.x0>20)!;
  const stroke=rule.primitive as {y1:number;x1:number};
  const owner=layout.notes[0];
  const moved={...owner,x:stroke.x1+10,y:stroke.y1};
  const placed=buildInkScene({...layout,notes:[moved]},o,t,score);
  const mask=placed.heads.get(moved.note.id)![0].box;
  const before=sceneInkAt(placed,moved.x-6,moved.y).some(p=>p.family==='pitch-grid');
  assert.equal(before,true);
  assert.equal(sceneInkAt(placed,moved.x,moved.y).some(p=>p.family==='pitch-grid'),false);
  assert.equal(sceneInkAt(placed,mask.x0+0.1,moved.y).some(p=>p.family==='pitch-grid'),false);
  // A deliberately later foreign stroke is NOT erased by an earlier mask.
  const foreign={...rule,id:'foreign-later-stroke',layer:'head' as const};
  const later={...placed,heads:new Map([...placed.heads,['foreign',[foreign]]])};
  assert.ok(sceneInkAt(later,moved.x,moved.y).includes(foreign));
  const digit=placed.heads.get(moved.note.id)!.find(p=>p.primitive.kind==='glyph')!;
  const b=digit.box;
  let found=false;
  for(let ix=0;ix<20;ix++)for(let iy=0;iy<20;iy++){
    const x=b.x0+(ix+0.5)*(b.x1-b.x0)/20,y=b.y0+(iy+0.5)*(b.y1-b.y0)/20;
    if(sceneInkAt(placed,x,y).includes(digit)) found=true;
  }
  assert.ok(found);
});

test('pinned face metrics, scaled tall knockout and exact emitted attributes agree independently', () => {
  const glyph=GOTHIC_DEMI_GLYPHS['7'];
  const points=glyph.contours.flat();
  assert.equal(glyph.advance,560);
  assert.equal(Math.min(...points.map(p=>p[0])),65);
  assert.equal(Math.max(...points.map(p=>p[0])),500);
  assert.equal(Math.max(...points.map(p=>p[1])),739);
  const head=layout.notes.find(p=>p.coord.pitchClass===7)!;
  const mod={...head,tallKnockout:true,symbolScale:0.68,symbolChord:true};
  const placed=buildInkScene({...layout,notes:[mod]},o,t,score);
  const pieces=placed.heads.get(mod.note.id)!;
  const spec={x:mod.x,y:mod.y,pitchClass:mod.coord.pitchClass,hand:mod.coord.hand,tallKnockout:true,symbolScale:0.68,chordMember:true,isPositionOfHonor:false};
  assert.equal(pieces.map(p=>p.svg).join('\n'),renderNotehead(spec,t,o));
  assert.ok(pieces[0].svg.includes('class="janko-knockout"'));
  assert.ok(pieces[1].svg.includes('class="janko-digit"'));
  assert.ok(pieces[1].svg.includes('font-size="3.944pt"'));
  const g=pieces[1].primitive;
  if(g.kind!=='glyph')throw new Error('missing glyph');
  assert.ok(Math.abs(pieces[1].box.x0-(mod.x+(65-280)*g.em/1000))<1e-9);
  // Existing GOLD protection policy is NOT silently changed by the cutover:
  // the pinned A contour extends 0.0776pt beyond each 2.73pt white mask side.
  const a=GOTHIC_DEMI_GLYPHS.A;
  assert.equal(a.advance,740);
  assert.equal(Math.min(...a.contours.flat().map(p=>p[0])),7);
  assert.equal(Math.max(...a.contours.flat().map(p=>p[0])),733);
  const overhang=(733-a.advance/2)*t.digitFontSize*4/3/1000-2.73;
  assert.ok(Math.abs(overhang-0.0772)<0.001,'record the existing unjudged readability issue, not a hidden mask change');
  const aLayout=layoutJankoScore(score,o,t).find(l=>l.notes.some(n=>n.coord.pitchClass===10))!;
  const aNote=aLayout.notes.find(n=>n.coord.pitchClass===10)!;
  const aHead=buildInkScene(aLayout,o,t,score).heads.get(aNote.note.id)!;
  const aMask=aHead.find(p=>p.primitive.kind==='erase')!;
  const aGlyph=aHead.find(p=>p.primitive.kind==='glyph')!;
  assert.ok(aGlyph.box.x0<aMask.box.x0&&aGlyph.box.x1>aMask.box.x1,
    'a real placed Bach A has measured ink on both sides of its GOLD mask');
});

test('pre-layout and final structural rules share geometry but scene refuses absent coverage/custom faces', () => {
  const x=layout.geometry.staffLeft+0.5;
  assert.deepEqual(preliminaryStaffRules(layout.geometry,o,t,x).map(p=>p.y),sceneStaffRules(scene,x).map(p=>(p.primitive as {y1:number}).y1));
  assert.throws(()=>requireSceneCoverage(scene,'rests'),/does not cover rests/);
  assert.throws(()=>requireSceneCoverage(scene,'beams'),/does not cover beams/);
  assert.throws(()=>buildInkScene(layout,o,{...t,fontFamily:'Other Sans'},score),/custom digit face/);
  assert.notEqual(buildInkScene({...layout,geometry:{...layout.geometry,middleCY:layout.geometry.middleCY+0.5}},o,t,score).key,scene.key);
  const placed=buildInkScene(layout,o,t,score);
  const digit=placed.heads.values().next().value!.find(p=>p.primitive.kind==='glyph')!;
  if(digit.primitive.kind!=='glyph')throw new Error('missing digit');
  digit.primitive={...digit.primitive,face:'Other Sans' as typeof SCENE_FONT};
  assert.throws(()=>digit.svg,/Measured ink unavailable/);
  assert.throws(()=>sceneInkAt(placed,digit.box.x0,digit.box.y0),/Measured ink unavailable/);
});
