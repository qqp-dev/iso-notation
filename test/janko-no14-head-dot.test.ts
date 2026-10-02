import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14HeadDotProfile,no14PracticeProfile} from '../src/render/janko/no14-practice';
import {buildSchumannNo14Draft} from '../src/scores/schumann-no14-draft';
import {layoutJankoScore} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {getStemGeometry} from '../src/render/janko/elements/rhythm';
import {NO14_HEAD_DOT_CANDIDATES} from '../src/render/janko/candidates';
const e=no14HeadDotProfile(),layouts=layoutJankoScore(e.score,e.options,e.tokens);
test('chosen head-adjacent dots preserve all8written owners and long-left72/24shared branches',()=>{
 const old=buildSchumannNo14Draft();
 for(const field of ['notes','phrases','dynamics','pedals'] as const)assert.deepEqual(e.score[field],old[field]);
 const dots=layouts.flatMap(l=>[...buildInkScene(l,e.options,e.tokens,e.score).solos.values()].flat().filter(p=>p.shape.kind==='dot'));
 assert.equal(dots.length,8);assert.deepEqual(dots.flatMap(d=>d.ownerIds).sort(),e.score.notes.filter(n=>n.durationTicks===72).map(n=>n.id).sort());
 for(const occurrence of [48,80]){
  const tick=(occurrence-1)*144,l=layouts.find(l=>l.notes.some(n=>n.note.startTick===tick))!,scene=buildInkScene(l,e.options,e.tokens,e.score);
  const statements=[...l.notes,...l.unisonVoices].filter(n=>n.note.startTick>=tick&&n.note.startTick<tick+144&&n.rhythm.durationTicks===72);
  assert.equal(statements.length,4);
  for(const n of statements){const dot=scene.solos.get(n.note.id)!.find(p=>p.shape.kind==='dot')!;assert.deepEqual(dot.ownerIds,[n.note.id]);if(dot.shape.kind!=='dot')throw Error('dot');assert.ok(Math.abs(dot.shape.cy-n.y)<=5,'allRH/LHdotsremain beside their pitch symbols');}
  for(const m of l.unisonMerges.filter(m=>m.tick>=tick&&m.tick<tick+144)){
   const ns=[...l.notes,...l.unisonVoices].filter(n=>[m.survivorId,...m.mergedIds].includes(n.note.id)).sort((a,b)=>b.rhythm.durationTicks-a.rhythm.durationTicks);
   assert.deepEqual(ns.map(n=>n.rhythm.durationTicks),[72,24]);const long=getStemGeometry(ns[0].rhythm,e.tokens),short=getStemGeometry(ns[1].rhythm,e.tokens);
   assert.ok(long.stemX<short.stemX);assert.ok(Math.abs(short.stemX-long.stemX-2.6)<.001);
   const b=l.beams.find(b=>b.notes.some(n=>n.id===ns[1].note.id))!;assert.ok(Math.abs((b.beamY(long.stemX)-long.stemEndY)-5.2)<.001,'head-dot choice retains actual long-quarter fitting');
  }
 }
 assert.equal(no14PracticeProfile().options.sharedDurationDot,'exposed-stem','rejectedD/exportprofileisretained');
 const fuller=no14HeadDotProfile(true);assert.deepEqual({...fuller.options,hairpinStrokeWidth:.65},e.options,'fullerwidthtrialonlychangeshairpininkpolicy');
});
test('each offered No14 alternative has genuine complete-score pages and requested literal views',()=>{
 assert.equal(NO14_HEAD_DOT_CANDIDATES.length,3);
 for(const c of NO14_HEAD_DOT_CANDIDATES){const ws=c.windows!;assert.ok(ws.some(w=>'fullScore' in w&&w.fullScore&&w.measureStart===1&&w.measureCount===96));for(const m of [1,5,8,16,21,41,43,48,80])assert.ok(ws.some(w=>'measureStart' in w&&w.measureStart===m),`${c.id}:${m}`);assert.equal(c.download,undefined,'old exposedD PDF is not relabeled as this profile');}
});
