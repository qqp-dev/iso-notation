import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { buildInkScene } from '../src/render/janko/ink-scene';
import { createStudioConfig } from '../src/render/janko/studio';
import { layoutJankoScore, detectStemDigitCrossings, suppressedStemIds, renderJankoPage, renderJankoCrop, countJankoPages } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import { computeBarStaffRows, computeSystemStaffSegments } from '../src/render/janko/elements/staff';
import { resolveJankoTokens } from '../src/render/janko/types';
import { importSchumann } from '../src/scores/schumann-no43';
import { ROUND_55_CANDIDATES } from '../src/render/janko/candidates';
import { beamPieceIntersectsBox, beamStemBoxes, placedBeamGroup } from '../src/render/janko/beam-scene';

const linear=(n:{pitch:{octave:number;pitchClass:number}})=>n.pitch.octave*12+n.pitch.pitchClass;

test('equal written unisons share a head with all source IDs; unequal values and octave symbols do not',()=>{
  const entry=createStudioConfig().scores['schumann-op68-no13'];
  const layouts=layoutJankoScore(entry.score,entry.options,entry.tokens);
  const opening=entry.score.notes.filter(n=>n.startTick===96 && linear(n)===53);
  assert.equal(opening.length,2,'two encoded LH E-sharp voice records, not evidence of two printed heads');
  assert.ok(opening.every(n=>n.durationTicks===24 && n.hand==='LH'));
  const l=layouts.find(l=>l.notes.some(n=>n.note.startTick===96))!;
  assert.equal(l.notes.filter(n=>opening.some(o=>o.id===n.note.id)).length,1);
  assert.ok(l.unisonMerges.some(m=>[m.survivorId,...m.mergedIds].filter(id=>opening.some(n=>n.id===id)).length===2));
  assert.ok(l.unisonVoices.some(n=>opening.some(o=>o.id===n.note.id)),
    'the other source voice keeps its necessary eighth stem/flag or beam obligation on the shared head');
  const tick=entry.score.sourceBarTicks![26];
  const candidates=entry.score.notes.filter(n=>n.startTick>=tick && n.startTick<entry.score.sourceBarTicks![27] && linear(n)===59);
  const unequal=candidates.filter(n=>candidates.some(o=>o!==n && o.startTick===n.startTick && o.durationTicks!==n.durationTicks));
  assert.deepEqual(unequal.map(n=>n.durationTicks).sort((a,b)=>a-b),[12,24]);
  assert.equal(layouts.flatMap(l=>l.notes).filter(n=>unequal.some(o=>o.id===n.note.id)).length,2);
  assert.equal(layouts.reduce((s,l)=>s+(l.grace?.length??0),0),16);
  assert.equal(layouts.flatMap(l=>l.grace??[]).reduce((s,g)=>s+g.heads.length,0),26);
  const hand=entry.score.notes.filter(n=>[3228,3240,3252].includes(n.startTick) && n.sourceProvenance?.voices.includes('lower.0'));
  assert.equal(hand.length,3);
  assert.ok(hand.every(n=>n.hand==='LH' && n.handInference?.confidence==='contextual'));
  console.log('No13 source hands',hand.map(n=>[n.startTick,linear(n),n.handInference]));
});

test('shared threshold is drawn at 72, earned at displayed 78; folded high is evaluated after folding',()=>{
  assert.ok(!computeBarStaffRows([77],'fixed-3').lins.includes(72));
  assert.ok(computeBarStaffRows([78],'fixed-3').lins.includes(72));
  const t=resolveJankoTokens({ticksPerMeasure:96});
  const note=(lin:number)=>({id:String(lin),pitch:{octave:Math.floor(lin/12),pitchClass:lin%12},hand:'RH' as const,startTick:0,durationTicks:24});
  const segments=(lin:number)=>computeSystemStaffSegments([note(lin)],0,1,0,100,100,'fixed-3',t);
  assert.ok(!segments(77).extensionLines.includes(72));
  assert.ok(segments(78).extensionLines.includes(72));
  // 90 folds down one octave to 78; 89 folds to 77, not a fabricated boundary.
  assert.ok(segments(90).extensionLines.includes(72));
  assert.ok(!segments(89).extensionLines.includes(72));
});

test('unfamiliar literal cross-staff continuation requires contextual logical-voice evidence, not staff=hand',()=>{
  const source=String.raw`\score { \new PianoStaff <<
    \new Staff = "upper" { \relative c'' { \time 2/4 c4 c | c4 c | } }
    \new Staff = "lower" { \relative c' { \time 2/4 c4 d | \change Staff = "upper" \stemDown e4 f | } }
  >> }`;
  const result=importSchumann(source,{file:'unfamiliar-continuity.ly',hash:'fixture',number:13});
  const moved=result.score.notes.filter(n=>n.startTick>=96 && n.sourceProvenance?.voices.includes('lower'));
  assert.equal(moved.length,2);
  assert.ok(moved.every(n=>n.hand==='LH' && n.handInference?.confidence==='contextual'));
});

test('measured final ink covers cited collision windows and shared repertoire consequences',()=>{
  const config=createStudioConfig();
  for(const id of ['schumann-op68-no13','schumann-op68-no14','schumann-op68-no30','primary','brahms-op118-no1']) {
    const e=config.scores[id], layouts=layoutJankoScore(e.score,e.options,e.tokens);
    const report=lintJankoScore(e.score,e.options,e.tokens);
    const classes=Object.fromEntries([...new Set(report.violations.map(v=>v.code))].map(code=>[code,report.violations.filter(v=>v.code===code).length]));
    console.log(id,JSON.stringify({systems:layouts.length,heads:layouts.reduce((s,l)=>s+l.notes.length,0),merges:layouts.reduce((s,l)=>s+l.unisonMerges.length,0),violations:classes,warnings:report.warnings.length}));
    if(id==='brahms-op118-no1') console.log('SHARED-DURATION-PROBE',JSON.stringify(layouts.flatMap(l=>l.durationInkOwners).filter(m=>m.ownerIds.length>1 && m.mount==='carrier').map(m=>({tick:m.tick,owners:m.ownerIds,run:m.run}))), 'BRIDGES',layouts.reduce((s,l)=>s+l.chordBridges.length,0),'CLASPS',layouts.reduce((s,l)=>s+l.clasps.length,0));
    if(id==='primary'||id==='brahms-op118-no1') {
      const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
      console.log('CURRENT-SERIALIZATION',id,JSON.stringify({pages:Array.from({length:countJankoPages(e.score,e.options,e.tokens)},(_,page)=>sha(renderJankoPage(e.score,page,e.options,e.tokens,layouts))),
        opening:sha(renderJankoCrop(e.score,1,4,e.options,e.tokens,undefined,layouts)),
        whole:sha(renderJankoCrop(e.score,1,id==='primary'?32:72,e.options,e.tokens,undefined,layouts))}));
    }
    if(id==='schumann-op68-no13') {
      const ticks=e.score.sourceBarTicks!;
      const windows=[2,6,7,27,30,31,32,33,37,38,39];
      const relevant=(tick:number)=>windows.some(m=>tick>=ticks[m-1] && tick<ticks[m]);
      const crossings=layouts.flatMap(l=>detectStemDigitCrossings(l.notes,l.beams,l.ungrouped,e.options,e.tokens,suppressedStemIds(l)))
        .filter(c=>relevant(layouts.flatMap(l=>[...l.notes,...l.unisonVoices]).find(n=>n.note.id===c.stemNoteId)!.note.startTick));
      assert.deepEqual(crossings,[], 'cited independent rhythms have no final painted stem/foreign-mask entry');
      assert.deepEqual(report.violations,[], 'complete No13 has no hidden collision waivers');
      for(const measure of [26,43,44]) {
        const l=layouts.find(l=>measure-1>=l.geometry.firstBar! && measure-1<l.geometry.firstBar!+l.geometry.measuresPerSystem)!;
        const local=measure-1-l.geometry.firstBar!;
        assert.ok(!l.geometry.staffSegments?.some(s=>s.lin===72 && local>=s.mStart && local<=s.mEnd),`unfolded ${measure} earns no upper extension`);
      }
      console.log('No13 cited final stem/mask crossings',crossings.length);
      // The diagnostics are measured from beamY(stemX), including extensions.
      const railHits=layouts.flatMap(l=>{
        const pieces=l.beams.flatMap(b=>placedBeamGroup(b,e.tokens,e.options.durationGrammar,l.index,0));
        return pieces.filter(p=>p.shape.kind==='rail' && l.notes.some(n=>!p.ownerIds.includes(n.note.id) &&
          beamPieceIntersectsBox(p,{x0:n.x-2.53,x1:n.x+2.53,y0:n.y-3.1,y1:n.y+3.1}))).map(p=>p.id);
      });
      assert.deepEqual(railHits,[],'final grouped rails do not enter foreign masks');
      const railStemContacts=layouts.flatMap(l=>{
        const pieces=buildInkScene(l,e.options,e.tokens,e.score).beams.flat();
        return pieces.filter(p=>p.shape.kind==='rail').flatMap(rail=>pieces.filter(stem=>{
          if(stem.shape.kind!=='stem'||stem.groupId===rail.groupId)return false;
          const a=l.beams.find(b=>b.notes.some(n=>rail.ownerIds.includes(n.id)))!,b=l.beams.find(b=>b.notes.some(n=>stem.ownerIds.includes(n.id)))!;
          const s=stem.shape;
          return a.notes[0].hand===b.notes[0].hand && a.notes[0].sourceVoice!==b.notes[0].sourceVoice &&
            relevant(b.notes[0].startTick) && beamStemBoxes(stem).some(box=>beamPieceIntersectsBox(rail,box));
        }).map(stem=>({rail:rail.id,stem:stem.id})));
      });
      assert.deepEqual(railStemContacts,[],'actual painted underpasses never form false foreign-rail junctions');
      console.log('No13 independent stem/foreign-rail contacts',railStemContacts.length);

    }
  }
});

test('comparison cards use identical representative windows, real-engine deltas and honest hand captions',()=>{
  const a=ROUND_55_CANDIDATES.find(c=>c.id==='schumann-no13-written-draft')!;
  const b=ROUND_55_CANDIDATES.find(c=>c.id==='schumann-no13-before-clarity')!;
  assert.deepEqual(a.windows,b.windows);
  assert.equal(b.options?.clarityPass,false);
  assert.equal(b.tokens?.graceScale,.68);
});
