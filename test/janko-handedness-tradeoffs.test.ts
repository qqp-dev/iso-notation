import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSchumannNo13Draft } from '../src/scores/schumann-no13-draft';
// Historical family evidence is deliberately bound to Round 56, not live cards.
import { ROUND_56_CANDIDATES as CURRENT_CANDIDATES, ROUND_56_METADATA as CURRENT_ROUND_METADATA } from '../src/render/janko/candidates';
import { PreparedJankoWindows, renderPreparedJankoWindow } from '../src/render/janko/prepared-windows';
import { createStudioConfig } from '../src/render/janko/studio';
import { deriveTieDisplayPlan } from '../src/render/janko/ties';
import { checkSharedCarrierPaint,checkContinuousContourPaint,type LintViolation,lintJankoWindowSystems } from '../src/render/janko/linter';
import { buildInkScene } from '../src/render/janko/ink-scene';
import { beamStemBoxes,beamPieceBox } from '../src/render/janko/beam-scene';
import { getStemGeometry } from '../src/render/janko/elements/rhythm';
import { layoutJankoScore, systemCompleteInkBounds } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS } from '../src/render/janko/types';
const score=buildSchumannNo13Draft(),snapshot=JSON.stringify(score);
const windows=[{measureStart:38,measureCount:3},{measureStart:2,measureCount:1},{measureStart:27,measureCount:1}];
const options={...DEFAULT_JANKO_OPTIONS,measuresPerSystem:4,systemsPerPage:4,gridWritingPolicy:'overlaid-beat-grid' as const,writtenTies:'source' as const};
const prepared=new Map(CURRENT_CANDIDATES.filter(c=>!c.rejection).map(c=>[c.id,new PreparedJankoWindows(score,windows,{...options,...c.options},{...DEFAULT_JANKO_TOKENS,...c.tokens})]));
test('required families have declared representative status, never a numeric completion bar',()=>{
 for(const id of ['straight-seats','continuous-ribbon','shared-carrier','local-cuts','local-flags','voice-fields','layered-crossings','voice-stems'])assert.ok(CURRENT_CANDIDATES.some(c=>c.id===id));
 assert.ok(prepared.has('hand-control'));
 assert.match(CURRENT_ROUND_METADATA.description,/no.*adoption|unchanged/);
 for(const c of CURRENT_CANDIDATES.filter(c=>c.rejection)){assert.deepEqual(c.windows,[]);assert.ok(c.rejection!.reason.length>100);assert.match(c.rejection!.evidence,/tradeoff-route-families/);}
 for(const c of CURRENT_CANDIDATES.filter(c=>!c.rejection))assert.deepEqual(c.windows,CURRENT_CANDIDATES[0].windows);
});
test('same score object, exact 72-tick bar, fourteen source/value/voice obligations in all grammars',()=>{
 const from=score.sourceBarTicks![38],to=score.sourceBarTicks![39];assert.equal(from,3384);assert.equal(to-from,72);
 const expected=score.notes.filter(n=>n.startTick>=from&&n.startTick<to).map(n=>({id:n.id,tick:n.startTick,ticks:n.durationTicks})).sort((a,b)=>a.id.localeCompare(b.id));assert.equal(expected.length,14);
 for(const [id,p] of prepared){assert.equal(p.score,score);const l=p.containing({measureStart:39,measureCount:1})[0];
  assert.equal(l.scoreRevision,score);const values:typeof expected=l.rhythmicGestures!.flatMap(g=>g.values).filter(n=>n.tick>=from&&n.tick<to).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(values,expected,id);
  const report=lintJankoWindowSystems(p);assert.equal(report.scope,'window-scoped');assert.equal(report.violations.length,0,`${id}: ${JSON.stringify(report.violations)}`);
  assert.equal(report.warnings.length,0,id);
 }
 assert.equal(JSON.stringify(score),snapshot);
});
test('local classical flags genuinely remove grouped rails while retaining per-event written levels',()=>{
 const p=prepared.get('local-flags')!,l=p.containing({measureStart:39,measureCount:1})[0];assert.equal(l.beams.length,0);
 const scene=buildInkScene(l,p.options,p.tokens,score);
 for(const n of [...l.notes,...l.unisonVoices].filter(p=>p.note.startTick>=3384&&p.note.startTick<3456)){
  const flags=(scene.solos.get(n.note.id)??[]).filter(p=>p.shape.kind==='flag');
  assert.equal(flags.length,n.rhythm.durationTicks<48?1:0,n.note.id);
  if(flags.length){const shape=flags[0].shape;assert.equal(shape.kind,'flag');if(shape.kind==='flag')assert.equal(shape.count,n.rhythm.durationTicks===12?2:1);}
 }
});
test('voice stems never change hand; every head has a bounded monochrome hand channel',()=>{
 const p=prepared.get('voice-stems')!;
 for(const l of p.systems.values()){
  assert.ok(l.eventHandMarks?.length);assert.ok(l.eventHandMarks!.every(m=>!m.refused));
  for(const n of l.notes){assert.ok(l.eventHandMarks!.some(m=>m.ownerIds.includes(n.note.id)&&m.hand===n.note.hand));
   if(n.rhythm.sourceVoice?.endsWith('.1'))assert.equal(getStemGeometry(n.rhythm,p.tokens).direction,1);
   const original=score.notes.find(q=>q.id===n.note.id);if(original)assert.equal(n.note.hand,original.hand);
  }
  const bounds=systemCompleteInkBounds(l,p.options,p.tokens);assert.ok(l.eventHandMarks!.every(m=>m.box.y0>=bounds.top&&m.box.y1<=bounds.bottom));
 }
 assert.match(renderPreparedJankoWindow(p,{measureStart:39,measureCount:1}),/data-hand="RH"/);
});
test('separate fields duplicate coordinates, not source events; ties, grace, time columns and aggregate rests survive',()=>{
 const p=prepared.get('voice-fields')!;
 for(const l of p.systems.values()){
  const fields=p.voiceFields.get(l.index)!,ids=fields.flatMap(f=>f.sourceIds);
  assert.equal(ids.length,new Set(ids).size);
  for(const f of fields){assert.equal(f.layout.scoreRevision,score);assert.equal(f.layout.geometry.middleCY,l.geometry.middleCY);assert.match(f.label,/^(RH|LH).*Voice/);
   assert.equal(f.layout.columns,l.columns);assert.ok(f.layout.notes.every(n=>n.note.hand===f.label.slice(0,2)));
   const scene=buildInkScene(f.layout,p.options,p.tokens,score);assert.ok(scene.pitch.length>0);
   assert.ok(scene.beams.flat().flatMap(beamStemBoxes).every(b=>b.y1-b.y0>=1),'no tiny underpasses after honest field separation');
  }
  assert.equal(fields.flatMap(f=>f.layout.tieArcs??[]).length,l.tieArcs?.length??0);
  assert.equal(fields.flatMap(f=>f.layout.grace??[]).length,l.grace?.length??0);
  for(const r of l.rests)assert.ok(fields.some(f=>f.layout.rests.some(q=>q.tick===r.tick&&q.durationTicks===r.durationTicks&&q.hand===r.hand)));
  renderPreparedJankoWindow(p,{measureStart:(l.geometry.firstBar??0)+1,measureCount:l.geometry.measuresPerSystem});
 }
 assert.throws(()=>layoutJankoScore(score,p.options,p.tokens),/window-only|window-only|window.*only/);
});
test('reuse refuses altered source, option/token mismatch and replacement layouts (no sparse arrays)',()=>{
 const p=prepared.get('local-flags')!;
 assert.throws(()=>p.validate({...score}),/identity mismatch/);
 assert.throws(()=>p.validate(score,{...p.options,stemConvention:'voice'},p.tokens),/identity mismatch/);
 assert.throws(()=>p.validate(score,p.options,{...p.tokens,stemLength:21}),/identity mismatch/);
 const isolated=new PreparedJankoWindows(score,[windows[0]],options),map=isolated.systems as Map<number,any>,index=[...map.keys()][0];
 map.set(index,{...map.get(index)});assert.throws(()=>isolated.validate(),/system identity mismatch/);
 const altered=new PreparedJankoWindows(score,[windows[0]],options),l=[...altered.systems.values()][0];
 (l.columns as Map<number,number>).set(999999,999);assert.throws(()=>altered.validate(),/identity mismatch/);
 const changedFunction=new PreparedJankoWindows(score,[windows[0]],options),beam=[...changedFunction.systems.values()].flatMap(l=>l.beams)[0];
 beam.beamY=()=>0;assert.throws(()=>changedFunction.validate(),/function.*identity mismatch/);
 assert.equal(JSON.stringify(score),snapshot);
});
test('one LH 3b attack retains eighth and quarter branches, and final LH 44 retains both source owners',()=>{
 const source=score.notes.filter(n=>n.hand==='LH'&&n.startTick===3384&&n.pitch.octave*12+n.pitch.pitchClass===47);assert.equal(source.length,2);assert.deepEqual(source.map(n=>n.durationTicks).sort((a,b)=>a-b),[24,48]);
 for(const [id,p] of prepared){if(id==='hand-control')continue;const base=p.containing({measureStart:39,measureCount:1})[0];
  if(id==='voice-fields'){const heads=p.voiceFields.get(base.index)!.flatMap(f=>f.layout.notes).filter(n=>source.some(s=>s.id===n.note.id));assert.equal(heads.length,2);assert.equal(heads[0].x,heads[1].x);assert.equal(heads[0].y,heads[1].y);continue;}
  const heads=base.notes.filter(n=>source.some(s=>s.id===n.note.id));assert.equal(heads.length,1,id);
  const merge=base.unisonMerges.find(m=>m.survivorId===heads[0].note.id)!;assert.ok(!merge.exact);assert.deepEqual(new Set([merge.survivorId,...merge.mergedIds]),new Set(source.map(n=>n.id)));
  const obligations=[...base.notes,...base.unisonVoices].filter(n=>source.some(s=>s.id===n.note.id));assert.deepEqual(obligations.map(n=>n.rhythm.durationTicks).sort((a,b)=>a-b),[24,48],id);
  const scene=buildInkScene(base,p.options,p.tokens,score);for(const n of obligations)if(p.options.rhythmStyle==='beamed')assert.ok([...scene.solos.values()].flat().some(piece=>piece.noteId===n.note.id&&piece.shape.kind==='stem')||scene.beams.flat().some(piece=>piece.shape.kind==='stem'&&piece.ownerIds.includes(n.note.id)),`${id}: independent value route`);
  const final=score.notes.filter(n=>n.hand==='LH'&&n.startTick===3432&&n.pitch.octave*12+n.pitch.pitchClass===52);
  assert.equal(final.length,2);for(const n of final)assert.ok(base.notes.some(p=>p.note.id===n.id)||base.unisonMerges.some(m=>m.mergedIds.includes(n.id)),`${id}: final LH owner`);
 }
});
test('shared primary has a visible independent stream and exact secondary eligibility; missing stream is refused',()=>{
 const p=prepared.get('shared-carrier')!,l=p.containing({measureStart:39,measureCount:1})[0],scene=buildInkScene(l,p.options,p.tokens,score),i=l.beams.findIndex(b=>b.sharedCarrier&&b.notes[0].startTick===3384),b=l.beams[i];
 assert.equal(b.notes.length,9);assert.equal(b.notes.filter(n=>n.doubleStem).length,6);
 for(const piece of scene.beams[i].filter(p=>p.shape.kind==='stem'))if(piece.shape.kind==='stem'&&piece.shape.double){assert.equal(beamStemBoxes(piece).length,2);assert.match(piece.svg,/data-source-stream="v2"/);assert.ok(!piece.svg.includes('underpass'));}
 assert.match(renderPreparedJankoWindow(p,{measureStart:39,measureCount:1}),/Stream style is NOT duration/);
 const bad={...scene,beams:scene.beams.map((parts,index)=>index!==i?parts:parts.map(p=>p.shape.kind==='stem'&&p.shape.double?{...p,shape:{...p.shape,double:undefined}}:p))},diagnostics:LintViolation[]=[];
 checkSharedCarrierPaint(l,bad,p.tokens,diagnostics);assert.ok(diagnostics.some(d=>d.code==='shared-voice-channel'));
});
test('continuous RH contour refuses apertures instead of silently claiming continuity',()=>{
 const p=prepared.get('continuous-ribbon')!,l=p.containing({measureStart:39,measureCount:1})[0],scene=buildInkScene(l,p.options,p.tokens,score),i=l.beams.findIndex(b=>b.contourRails),parts=scene.beams[i],r=parts.findIndex(p=>p.shape.kind==='rail');assert.ok(i>=0&&r>=0);
 const bad={...scene,beams:scene.beams.map((parts,index)=>index!==i?parts:parts.filter((_,j)=>j!==r))},diagnostics:LintViolation[]=[];
 checkContinuousContourPaint(l,bad,diagnostics);assert.ok(diagnostics.some(d=>d.code==='continuous-route-contact'));
});
test('comparative complete bounds contain placed rail width/caps in every actual field and neighboring system',()=>{
 const continuous=prepared.get('continuous-ribbon')!;assert.ok([...continuous.systems.values()].some(l=>l.beams.some(b=>b.notes[0].startTick===3288&&b.notes[0].sourceVoice?.endsWith('.0'))),'literal neighboring ordinary RH rail witness retained');
 for(const [id,p] of prepared)for(const l of p.auditLayouts()){
  const bounds=systemCompleteInkBounds(l,p.options,p.tokens),scene=buildInkScene(l,p.options,p.tokens,score);
  for(const piece of scene.beams.flat().filter(p=>p.shape.kind==='rail')){const box=beamPieceBox(piece);assert.ok(bounds.top<=box.y0+1e-9&&bounds.bottom>=box.y1-1e-9,`${id} system ${l.index}: complete bounds contain actual placed rail`);}
 }
});
test('Bach 13–14 keeps direct source hand identity and separate handed rhythm owners without tiny proposed routes',()=>{
 const entry=createStudioConfig().scores.primary;
 for(const c of CURRENT_CANDIDATES.filter(c=>!c.rejection)){
  const p=new PreparedJankoWindows(entry.score,[{measureStart:13,measureCount:2}],{...entry.options,...c.options},{...entry.tokens,...c.tokens}),report=lintJankoWindowSystems(p);assert.equal(report.violations.length,0,`${c.id}: ${JSON.stringify(report.violations)}`);assert.equal(report.warnings.length,0,c.id);
  for(const l of p.auditLayouts()){for(const n of l.notes)assert.equal(n.note.hand,entry.score.notes.find(s=>s.id===n.note.id)?.hand);
   for(const b of l.beams)assert.equal(new Set(b.notes.map(n=>n.hand)).size,1,'matching RH/LH digits never join one handed gesture');
   if(c.id!=='hand-control')assert.ok(buildInkScene(l,p.options,p.tokens,entry.score).beams.flat().flatMap(beamStemBoxes).every(b=>b.y1-b.y0>=1),c.id);
  }
 }
});
test('No30 source written continuations remain protected even with candidate-only untied attack sharing',()=>{
 const entry=createStudioConfig().scores['schumann-op68-no30'],plan=deriveTieDisplayPlan(entry.score),p=new PreparedJankoWindows(entry.score,[{measureStart:18,measureCount:1},{measureStart:34,measureCount:1}],{...entry.options,shareAttackHeads:true,independentUnisonAttachments:true},entry.tokens);
 for(const tick of [3120,6192]){const chain=plan.chains.find(c=>c.components.some(k=>k.startTick===tick&&k.durationTicks===96)&&entry.score.notes.some(n=>n.id===c.noteId&&n.pitch.pitchClass===8&&n.pitch.octave===4))!,component=chain.components.find(c=>c.startTick===tick)!;
  const l=[...p.systems.values()].find(l=>l.notes.some(n=>n.note.id===component.headId))!;assert.ok(l);const held=l.notes.find(n=>n.note.id===component.headId)!;assert.equal(held.rhythm.durationTicks,96);
  const independent=l.notes.filter(n=>n.note.startTick===tick&&n.rhythm.durationTicks===24&&n.note.pitch.pitchClass===held.note.pitch.pitchClass&&n.note.pitch.octave===held.note.pitch.octave-1);assert.ok(independent.length);
  assert.ok(!l.unisonMerges.some(m=>!m.exact&&[m.survivorId,...m.mergedIds].includes(component.headId)));
 }
});
