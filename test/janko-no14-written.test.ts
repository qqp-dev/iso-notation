import {test} from 'node:test';
import type {QuantizedGridScore} from '../src/model/types';
import assert from 'node:assert/strict';
import {projectNo14Written,reconstructNo14Performed,NO14_WRITTEN_SCORE_ID} from '../src/render/janko/no14-written';
import {no14OpticalProfile,no14HeadDotProfile} from '../src/render/janko/no14-practice';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {lintJankoWindowSystems,checkRepeatIntegrity,type LintViolation} from '../src/render/janko/linter';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {repeatIntersectsBox} from '../src/render/janko/repeat-signs';
const projection=projectNo14Written();
test('written repeat projection reconstructs exact performed notes/voices/rational values/expressions and provenance, including return clocks',()=>{
 const {score,performed}=projection;assert.equal(score.id,NO14_WRITTEN_SCORE_ID);assert.equal(score.notes.length,383);assert.equal(score.notes.filter(n=>n.durationTicks===72).length,4);assert.equal(score.phrases!.length,64);assert.equal(score.totalTicks,9216);
 assert.equal(performed.notes.length,574);assert.equal(performed.totalTicks,13824);assert.equal(performed.notes.filter(n=>n.durationTicks===72).length,8);
 assert.deepEqual(reconstructNo14Performed(projection),performed);
 assert.deepEqual(score.writtenPresentation!.repeats,[{startBar:33,endBar:64,times:2}]);assert.equal(score.writtenPresentation!.occurrences[64].writtenBar,33);assert.equal(score.writtenPresentation!.occurrences[79].writtenBar,48);
 assert.ok(score.pedals.some(e=>e.tick===9072&&e.type==='sustain-up'));assert.ok(!score.pedals.some(e=>e.tick>=9216));
 const phrase=score.phrases!.find(q=>q.startTick===8928)!;assert.equal(phrase.endTick,9072);assert.ok(score.notes.some(n=>phrase.toNoteIds.includes(n.id)&&n.startTick===9072));
 const returnPress=score.writtenPresentation!.events.pedals.find(q=>q.overrides.tick===9216)!;assert.equal(score.pedals[returnPress.writtenIndex].tick,4608);
 const corrupted=structuredClone(projection);corrupted.score.notes[0].pitch.pitchClass=(corrupted.score.notes[0].pitch.pitchClass+1)%12;assert.notDeepEqual(reconstructNo14Performed(corrupted).notes,performed.notes,'reconstruction is driven by actual written musical statements');
 for(const mutate of [(s:QuantizedGridScore)=>{s.notes.find(n=>n.startTick===9216)!.pitch.octave+=1;},(s:QuantizedGridScore)=>{s.notes.find(n=>n.startTick===9216)!.voice=99;},(s:QuantizedGridScore)=>{s.pedals=s.pedals.filter(e=>e.tick!==9216);},(s:QuantizedGridScore)=>{s.dynamics.find(e=>e.tick===9216)!.mark='f';}]){
  const changed=structuredClone(performed);mutate(changed);assert.throws(()=>projectNo14Written(changed),/collapse refused/,'musical pass differences cannot disappear through truncation');
 }
});
test('written64 full optical/pedal profiles admit all repeat ink, source events and four actual duration dots',()=>{
 for(const style of [undefined,'ornate-p','pictogram'] as const){const e=no14OpticalProfile(style),p=new PreparedJankoWindows(projection.score,[{measureStart:1,measureCount:64}],e.options,e.tokens),r=lintJankoWindowSystems(p);assert.equal(r.violations.length,0,JSON.stringify(r.violations));assert.equal(r.warnings.length,0);
  const layouts=[...p.systems.values()],signs=layouts.flatMap(l=>l.repeatSigns??[]);assert.deepEqual(signs.map(q=>[q.type,q.tick]),[['repeat-start',4608],['repeat-end',9216]]);
  assert.equal(layouts.flatMap(l=>[...buildInkScene(l,e.options,e.tokens,projection.score).solos.values()].flat().filter(q=>q.shape.kind==='dot')).length,4);
  assert.equal(layouts.flatMap(l=>l.expressions!.filter(q=>q.kind==='phrase')).length,64);
  for(const s of signs){assert.deepEqual(s.strokes.map(p=>p.width).sort(),[.6,.9]);assert.ok(s.dots.every(d=>d.r===.9));assert.equal(s.dots.length,2);assert.equal(s.strokes.length,2);assert.match(s.svg,/janko-repeat-dot/);const d=s.dots[0];assert.ok(repeatIntersectsBox(s,{x0:d.cx-.05,x1:d.cx+.05,y0:d.cy-.05,y1:d.cy+.05}));assert.equal(repeatIntersectsBox(s,{x0:d.cx+d.r-.01,x1:d.cx+d.r,y0:d.cy+d.r-.01,y1:d.cy+d.r}),false,'circle corners are empty physical air');}
 }
});
test('repeat start belongs to following page/system, also works internally, and repeat end replaces the sole closing boundary',()=>{
 const e=no14OpticalProfile(),p=new PreparedJankoWindows(projection.score,[{measureStart:32,measureCount:2},{measureStart:64,measureCount:1}],e.options,e.tokens);
 const ls=[...p.systems.values()],before=ls.find(l=>l.geometry.firstBar===28)!,after=ls.find(l=>l.geometry.firstBar===32)!,last=ls.find(l=>l.geometry.firstBar===60)!;
 assert.equal(before.repeatSigns!.length,0);assert.equal(after.repeatSigns![0].tick,4608);assert.equal(last.repeatSigns![0].tick,9216);
 const internal=new PreparedJankoWindows(projection.score,[{measureStart:33,measureCount:1}],{...e.options,measuresPerSystem:3},e.tokens);
 for(const l of internal.systems.values()){const out:LintViolation[]=[];checkRepeatIntegrity(projection.score,l,internal.options,internal.tokens,out);assert.deepEqual(out,[]);assert.ok(l.repeatSigns!.some(q=>q.x>l.geometry.staffLeft));}
 const old=new PreparedJankoWindows(projection.performed,[{measureStart:33,measureCount:1}],no14HeadDotProfile().options,e.tokens);assert.ok([...old.systems.values()].every(l=>!l.repeatSigns),'unfolded historical output earns no repeat policy');
});
