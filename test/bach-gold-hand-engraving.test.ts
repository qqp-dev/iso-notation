import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { renderJankoCrop, layoutJankoScore } from '../src/render/janko/engine';
import { DEFAULT_JANKO_OPTIONS as O, DEFAULT_JANKO_TOKENS as T } from '../src/render/janko/types';
import { bachPr112Hands } from './support/bach-before-m5';

// The PR112 witness reverses precisely the approved sixteen, retains PR112's
// settled m5 pair, and is checked against original source tuples in scores.test.
// Both scores go through the same production engine and current rest policy;
// this test neither manufactures SVG nor mistakes a self-projection for A/B.
const gold = buildBachGoldbergVar1Score();
const pr112 = bachPr112Hands(gold);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const restFacts = (score: typeof gold) => layoutJankoScore(score,O,T).flatMap(s=>s.rests).map(r=>[r.tick,r.hand,r.value] as const);

test('PR112 and GOLD engrave distinct real ink on all three approved literal windows', () => {
  for (const [start,count] of [[4,2],[20,4],[24,2]] as const) {
    const before=renderJankoCrop(pr112,start,count,O,T);
    const after=renderJankoCrop(gold,start,count,O,T);
    assert.notEqual(before,after,`mm${start}–${start+count-1}: the approved hands alter real-engine ink`);
    for (const [kind,pattern] of [['beam',/class="janko-beam"/],['stem',/class="janko-stem"/],['rest',/class="janko-rest-group"/]] as const) {
      assert.match(after,pattern,`mm${start}–${start+count-1}: printed ${kind}`);
    }
  }
});

test('wholly unaffected systems retain real ink; the two system-opening RH eighth rests survive', () => {
  // renderJankoCrop emits whole systems even if the viewBox frames fewer bars.
  // The other systems contain at least one corrected measure and cannot be
  // byte-compared as a whole without masking or inventing a second renderer.
  for (const [start,count] of [[9,4],[13,4],[29,4]] as const)
    assert.equal(hash(renderJankoCrop(gold,start,count,O,T)),hash(renderJankoCrop(pr112,start,count,O,T)),
      `mm${start}–${start+count-1} outside approved windows`);
  for (const tick of [576,3456]) {
    assert.deepEqual(restFacts(gold).filter(([t])=>t===tick),[[tick,'RH','eighth']],`RH t${tick} still printed`);
    assert.deepEqual(restFacts(pr112).filter(([t])=>t===tick),[[tick,'RH','eighth']],`PR112 under current rest policy`);
  }
});

test('m4/m24 corrected hand beams and actual rest occupancy differ from PR112', () => {
  const layouts=layoutJankoScore(gold,O,T);
  const old=layoutJankoScore(pr112,O,T);
  const beamAt=(systems: typeof layouts,tick:number,hand:'RH'|'LH')=>systems.flatMap(s=>s.beams)
    .filter(b=>b.notes[0].hand===hand && b.notes.some(n=>n.startTick===tick))
    .map(b=>b.notes.map(n=>n.startTick));
  assert.ok(beamAt(layouts,552,'RH').some(t=>t.join(',')==='528,540,552'), 'new RH beam includes D3 t552');
  assert.ok(beamAt(layouts,528,'LH').some(t=>t.join(',')==='528,564'), 'LH bridges the t552 printed rest');
  assert.ok(beamAt(old,528,'RH').some(t=>t.join(',')==='528,540,564'), 'PR112 RH bridged the rest');
  assert.deepEqual(restFacts(gold).filter(([t])=>t===552),[[552,'LH','sixteenth']]);
  assert.deepEqual(restFacts(pr112).filter(([t])=>t===552),[[552,'RH','sixteenth']]);
  assert.deepEqual(restFacts(gold).filter(([t])=>t===3432),[[3432,'LH','sixteenth']]);
  assert.deepEqual(restFacts(pr112).filter(([t])=>t===3432),[[3432,'RH','sixteenth']]);
  for (const tick of [2988,3060,3132])
    assert.ok(!restFacts(gold).some(([t])=>t===tick),`corrected hand occupies former rest t${tick}`);
  assert.ok(restFacts(gold).some(([t,h])=>t===3024 && h==='RH'),'new RH rest before m22');
});
