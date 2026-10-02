import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14PracticeProfile} from '../src/render/janko/no14-practice';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {lintJankoWindowSystems} from '../src/render/janko/linter';
import {balancedBowIsCoherent} from '../src/render/janko/balanced-phrases';
const e=no14PracticeProfile(),windows=[1,16,43,48].map(measureStart=>({measureStart,measureCount:1}));
const h=new PreparedJankoWindows(e.score,windows,{...e.options,phrasePlacement:'gesture-contour'},e.tokens);
test('cleanest-side bow trial preserves source attachments, one bend and literal48 positive control',()=>{
 const report=lintJankoWindowSystems(h);assert.equal(report.violations.length,0,JSON.stringify(report.violations));assert.equal(report.warnings.length,0);
 for(const l of h.systems.values())for(const q of l.expressions!.filter(q=>q.kind==='phrase')){
  assert.equal(balancedBowIsCoherent(q.contour!),true,'rounded painted controls retain a single bend');
  assert.equal(q.routingIssue,undefined);assert.ok(q.endpointIds?.flat().every(id=>e.score.notes.some(n=>n.id===id)));
 }
 const first=[...h.systems.values()][0].expressions!.find(q=>q.kind==='phrase'&&q.startTick===0)!.contour!;
 const span=first.xEnd-first.xStart,rise=first.yEnd-first.yStart;
 assert.ok(first.depth>=.11*(span*span+rise*rise)/span-.0001,'a cheap shallow corridor cannot undercut the trial preferred bow');
 const d=new PreparedJankoWindows(e.score,[windows[3]],e.options,e.tokens),tick=47*144;
 const positive=(p:PreparedJankoWindows)=>p.containing(windows[3])[0].expressions!.filter(q=>q.kind==='phrase'&&q.startTick===tick).map(q=>({ids:q.endpointIds,contour:q.contour,svg:q.svg}));
 assert.deepEqual(positive(h),positive(d),'independentRH/LH48 bows remain the positive control');
});
test('the coherent-bow admission rejects a locally inflected depth imbalance',()=>{
 const c={xStart:0,xEnd:100,yStart:0,yEnd:-20,side:-1 as const,depth:12,thickness:.85,indent:28,chordAligned:true as const,tipThickness:.22};
 assert.equal(balancedBowIsCoherent(c),true);
 assert.equal(balancedBowIsCoherent({...c,startDepth:2,endDepth:40}),false);
});
