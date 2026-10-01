import assert from 'node:assert/strict';
import test from 'node:test';
import { importSchumann } from '../src/scores/schumann-no43';
import { createStudioConfig } from '../src/render/janko/studio';
import { layoutJankoScore, detectStemDigitCrossings, suppressedStemIds, getTieDisplayPlan } from '../src/render/janko/engine';
import { checkVoiceBeamCorridors, checkExpressionIntegrity } from '../src/render/janko/linter';
import { placeExpressions, expressionIntersectsBox } from '../src/render/janko/elements/expressions';
import { getScaledKnockoutMetrics } from '../src/render/janko/elements/notehead';
import { renderPlacedGrace } from '../src/render/janko/grace';
import { buildInkScene } from '../src/render/janko/ink-scene';
import { beamPieceAt,beamStemBoxes } from '../src/render/janko/beam-scene';
import { soloPieceAt,soloPieceBoxAt } from '../src/render/janko/solo-scene';

const entry=()=>createStudioConfig().scores['schumann-op68-no13'];

test('unfamiliar independent LH and crossing RH voice envelopes use painted stems, never new hands',()=>{
  const source=String.raw`\score { \new PianoStaff <<
    \new Staff = "upper" { \relative c'' { \time 2/4 << { c16[ e d f] c16[ e d f] } \\ { g,8[ a] b8[ a] } >> | } }
    \new Staff = "lower" { \relative c' { \time 2/4 << { g8 a g a } \\ { c,4. c8 } >> | } }
  >> }`;
  const score=importSchumann(source,{file:'literal-voice-corridors.ly',hash:'fixture',number:13}).score;
  const e=entry(),layouts=layoutJankoScore(score,e.options,e.tokens);
  const diagnostic:Parameters<typeof checkVoiceBeamCorridors>[2]=[];
  for(const l of layouts){
    checkVoiceBeamCorridors(l,e.tokens,diagnostic);
    assert.deepEqual(detectStemDigitCrossings(l.notes,l.beams,l.ungrouped,e.options,e.tokens,suppressedStemIds(l)),[]);
    for(const n of l.notes)assert.equal(n.rhythm.hand,n.note.hand,'beam routing never changes a performing hand');
  }
  assert.deepEqual(diagnostic,[]);
  const l=layouts[0], pair=l.beams.filter(b=>b.notes[0].hand==='RH');
  assert.ok(pair.length>=2);
  const a=pair[0],b=pair.find(b=>b.notes[0].sourceVoice!==a.notes[0].sourceVoice)!;
  const aa=a.levels[0].connector,bb=b.levels[0].connector;
  bb.x1=aa.x1;bb.x2=aa.x2;bb.y1=aa.y1;bb.y2=aa.y2;
  const damaged:Parameters<typeof checkVoiceBeamCorridors>[2]=[];
  checkVoiceBeamCorridors(l,e.tokens,damaged);
  assert.ok(damaged.some(v=>v.code==='beam-voice-crossing'),'foreign crossed/fused rails are a hard lint defect');
});

test('unfamiliar compatible duplicates retain owners, unequal values and octave-spaced identical symbols',()=>{
  const source=String.raw`\score { \new PianoStaff << \new Staff = "upper" { \relative c' { \time 2/4
    << { c4 c4 } \\ { c4 c'8 c8 } >> | } } >> }`;
  const score=importSchumann(source,{file:'literal-unisons.ly',hash:'fixture',number:13}).score;
  const e=entry(),l=layoutJankoScore(score,e.options,e.tokens)[0];
  assert.equal(score.notes.filter(n=>n.startTick===0).length,2);
  assert.equal(l.notes.filter(n=>n.note.startTick===0).length,1);
  assert.equal(l.unisonMerges[0].mergedIds.length,1);
  assert.equal(l.notes.filter(n=>n.note.startTick===48).length,2,'symbol 0 an octave apart is two heads, not a unison');
  assert.deepEqual(l.notes.filter(n=>n.note.startTick===48).map(n=>n.rhythm.durationTicks).sort((a,b)=>a-b),[24,48]);
});

test('grace masks, digit and rhythm ink use the shared scale without changing pitch, clocks or hosts',()=>{
  const e=entry(),l=layoutJankoScore(e.score,e.options,e.tokens).find(l=>l.grace?.length)!;
  const grace=l.grace![0],svg=renderPlacedGrace(grace,e.options,e.tokens);
  assert.equal(e.tokens.graceScale,.8);
  const mask=getScaledKnockoutMetrics(e.options,e.tokens,e.tokens.graceScale,false);
  assert.ok(mask.hy>getScaledKnockoutMetrics(e.options,e.tokens,.68,false).hy);
  assert.match(svg,/stroke-width="1\.53"/);
  assert.match(svg,new RegExp(`font-size="${(e.tokens.digitFontSize*.8).toFixed(2)}`));
  assert.equal(grace.occurrence.tick,e.score.notes.find(n=>grace.occurrence.hostNoteIds.includes(n.id))!.startTick);
});

test('phrase contour follows unequal associated envelopes; its interior air is not painted ink',()=>{
  const e=entry();
  const phrase={...e.score.phrases![0],id:'literal-phrase',startTick:0,endTick:48,fromNoteIds:['a'],toNoteIds:['b']};
  const score={...e.score,notes:[],dynamics:[],pedals:[],phrases:[phrase]};
  const ink=placeExpressions(score,{start:0,end:96,left:0,right:100,top:-100,bottom:60,x:t=>t*1.5,
    clarity:true,endpointX:ids=>ids[0]==='a'?10:80,
    endpointEnvelope:ids=>ids[0]==='a'?{top:30,bottom:36,hand:'RH'}:{top:45,bottom:51,hand:'RH'},obstacles:[]})[0];
  assert.notEqual(ink.contour!.yStart,ink.contour!.yEnd);
  assert.ok(ink.contour!.yStart>0 && ink.contour!.yEnd>0,'neither tip floats at the system top -100');
  const x=(ink.x0+ink.x1)/2;
  assert.ok(!expressionIntersectsBox(ink,{x0:x-1,x1:x+1,y0:40,y1:42}),'unpainted under-arch air remains clear');
  const l={...layoutJankoScore(e.score,e.options,e.tokens)[0],expressions:[{...ink,svg:'',endpointIds:[[],[]] as [string[],string[]]}]};
  const diagnostics:Parameters<typeof checkExpressionIntegrity>[4]=[];
  checkExpressionIntegrity(score,l,e.options,e.tokens,diagnostics);
  assert.ok(diagnostics.some(v=>v.code==='expression-endpoint'));
  assert.ok(diagnostics.some(v=>v.code==='expression-paint'));
});


test('true crossings use non-fusing painted underpasses, preserving every own root and beam endpoint',()=>{
  const e=entry(),layouts=layoutJankoScore(e.score,e.options,e.tokens);
  const l=layouts.find(l=>buildInkScene(l,e.options,e.tokens,e.score).beams.flat().some(p=>p.shape.kind==='stem' && p.shape.gaps?.length))!;
  assert.ok(l,'literal crossing source passage has an actual underpass');
  const scene=buildInkScene(l,e.options,e.tokens,e.score);
  const stem=scene.beams.flat().find(p=>p.shape.kind==='stem' && p.shape.gaps?.length)!;
  assert.equal(stem.shape.kind,'stem');if(stem.shape.kind!=='stem')throw Error('not a stem');
  const s=stem.shape,gap=s.gaps![0],y=(gap.y0+gap.y1)/2;
  assert.equal(beamPieceAt(stem,s.x,y),false,'the underpass is clear paint, not just changed metadata');
  assert.ok(beamPieceAt(stem,s.x,s.y1)&&beamPieceAt(stem,s.x,s.y2),'own attachment and beam connection both remain painted');
  assert.ok(beamStemBoxes(stem).length>=2);
  assert.match(stem.svg,/janko-voice-underpass/);
  const clean:Parameters<typeof checkVoiceBeamCorridors>[2]=[];
  checkVoiceBeamCorridors(l,e.tokens,clean,e.options,scene);assert.deepEqual(clean,[]);
  s.gaps=[]; // restore the false junction without changing a source event
  const broken:Parameters<typeof checkVoiceBeamCorridors>[2]=[];
  checkVoiceBeamCorridors(l,e.tokens,broken,e.options,scene);
  assert.ok(broken.some(v=>v.code==='beam-voice-crossing'),'the linter catches actual foreign-rail fusion');
});

test('unfamiliar solo-quarter / foreign-sixteenth crossing uses the same physical routing',()=>{
  const source=String.raw`\score { \new Staff = "upper" { \relative c'' { \time 2/4
    << { g4 g4 } \\ { c,16[ d e f] c16[ d e f] } >> | } } }`;
  const score=importSchumann(source,{file:'literal-quarter-crossing.ly',hash:'fixture',number:13}).score;
  const e=entry(),l=layoutJankoScore(score,e.options,e.tokens)[0],scene=buildInkScene(l,e.options,e.tokens,score);
  const stem=[...scene.solos.values()].flat().find(p=>p.shape.kind==='stem' && p.shape.gaps?.length)!;
  assert.ok(stem,'the solo-quarter crossing is not silently joined to a foreign eighth/sixteenth rhythm');
  if(stem.shape.kind!=='stem')throw Error('not a stem');
  const gap=stem.shape.gaps![0],x=stem.shape.x,y=(gap.y0+gap.y1)/2;
  assert.equal(soloPieceAt(stem,x,y).status,'clear');
  assert.equal(soloPieceBoxAt(stem,{x0:x-.1,x1:x+.1,y0:y-.1,y1:y+.1}).status,'clear');
  const diagnostics:Parameters<typeof checkVoiceBeamCorridors>[2]=[];
  checkVoiceBeamCorridors(l,e.tokens,diagnostics,e.options,scene);assert.deepEqual(diagnostics,[]);
});

test('phrase source association resolves the written continuation, never the wrong same-tick hand column',()=>{
  const source=String.raw`\score { \new PianoStaff <<
    \new Staff = "upper" { \relative c' { \time 2/4 c4~ c4^( | d4 e4) | } }
    \new Staff = "lower" { \relative g' { \time 2/4 g4 g4 | g4 g4 | } }
  >> }`;
  const score=importSchumann(source,{file:'literal-tied-phrase.ly',hash:'fixture',number:13}).score;
  const e=entry(),l=layoutJankoScore(score,e.options,e.tokens)[0],phrase=score.phrases![0];
  const chain=getTieDisplayPlan(score).chains.find(c=>phrase.fromNoteIds.includes(c.noteId))!;
  const head=chain.components.find(c=>c.startTick===phrase.startTick)!;
  const placed=l.notes.find(n=>n.note.id===head.headId)!;
  const ink=l.expressions!.find(q=>q.id===phrase.id)!;
  assert.equal(phrase.sourceSide,'above');
  assert.equal(ink.contour!.side,-1,'the ordinary source-directed path keeps its side at a written continuation');
  assert.ok(placed,'written continuation has a solved head');
  assert.deepEqual(ink.endpointIds,[phrase.fromNoteIds,phrase.toNoteIds]);
  assert.ok(Math.abs(ink.contour!.xStart-placed.x)<=3.6+.001,'tip follows the associated continued head, not a detached or foreign column');
});
