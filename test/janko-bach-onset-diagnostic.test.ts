import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConfig} from '../src/render/janko/studio';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {lintJankoScore} from '../src/render/janko/linter';
import {BACH_ONSET_DIAGNOSTIC_CANDIDATES} from '../src/render/janko/candidates';
test('existing stable-onset diagnostic preserves Bach source and exposes both bar13pair gaps',()=>{
 const e=createStudioConfig().scores.primary,snapshot=structuredClone(e.score);
 const gaps=BACH_ONSET_DIAGNOSTIC_CANDIDATES.map(c=>{const o={...e.options,...c.options},p=new PreparedJankoWindows(e.score,[{measureStart:13,measureCount:1}],o,e.tokens),ns=[...p.systems.values()].flatMap(l=>l.notes),a=ns.find(n=>n.note.id==='bach-var1-214')!,b=ns.find(n=>n.note.id==='bach-var1-213')!,next=ns.find(n=>n.note.id==='bach-var1-215')!;
  assert.deepEqual([a.note.hand,b.note.hand,next.note.hand],['LH','RH','LH']);assert.equal(a.note.startTick,1752);assert.equal(b.note.startTick,1752);assert.equal(next.note.startTick,1764);
  const r=lintJankoScore(e.score,o,e.tokens);assert.equal(r.violations.length,0);assert.equal(r.warnings.length,0);assert.ok(c.windows!.some(w=>'fullScore' in w&&w.fullScore&&w.measureCount===32));return [Math.abs(b.x-a.x),Math.abs(next.x-b.x)];});
 assert.deepEqual(e.score,snapshot,'diagnostics do not change source hands, pitches, clocks or expressions');
 for(const [i,expected] of [[10.92,4.862416687],[5.46,7.5924583435]].entries())for(const [j,n] of expected.entries())assert.ok(Math.abs(gaps[i][j]-n)<.001);
});
