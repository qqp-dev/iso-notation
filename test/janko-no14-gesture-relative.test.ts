import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureRelativeProfile,no14GestureUnderlineProfile,NO14_GESTURE_RELATIVE_ID} from '../src/render/janko/no14-gesture-relative';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {recoverReadingPitch} from '../src/render/janko/no14-relative';
import {linearPitch} from '../src/render/janko/anchor-solver';
import {PreparedJankoWindows} from '../src/render/janko/prepared-windows';
import {buildInkScene,sceneHeadSvg} from '../src/render/janko/ink-scene';
import {checkReadingHeadIntegrity,checkReadingParityIntegrity,type LintViolation} from '../src/render/janko/linter';
import {ROUND_76_CANDIDATES as CURRENT_CANDIDATES,ROUND_75_CANDIDATES,getCandidate} from '../src/render/janko/candidates';
import {getClusterSpacingPreset} from '../src/render/janko/types';
import {fitParityColumns} from '../src/render/janko/engine';

test('gesture references preserve383 literal obligations and574 performed occurrences with independently scoped aliases',()=>{
  const accepted=no14GoldProfile(),before=JSON.stringify(accepted),p=no14GestureRelativeProfile(),s=p.score;
  assert.equal(s.id,NO14_GESTURE_RELATIVE_ID);assert.equal(s.notes.length,383);
  assert.equal(s.readingPresentation!.groups!.length,125);assert.equal(s.readingPresentation!.anchors.length,125);
  assert.equal(s.readingPresentation!.cost,undefined,'no global solver objective claimed');
  s.notes.forEach((n,i)=>{const {readingDisplay,...literal}=n;assert.deepEqual(literal,accepted.score.notes[i]);assert.equal(recoverReadingPitch(n),linearPitch(n));});
  for(const key of ['ticksPerBeat','totalTicks','sourceBarTicks','timeSignatures','barlines','tempos','dynamics','pedals','phrases','sourceSilences','graceGroups','tieChains','writtenPresentation'] as const)assert.deepEqual(s[key],accepted.score[key],key);
  const {performed}=projectNo14Written(),events=s.writtenPresentation!.events.notes!;assert.equal(events.length,574);
  for(const event of events){const n=s.notes[event.writtenIndex],expected=performed.notes[event.performedIndex];assert.equal(recoverReadingPitch(n),linearPitch(expected));const {readingDisplay,...literal}=n;assert.deepEqual({...literal,...event.overrides},expected);}
  const groups=s.readingPresentation!.groups!;
  assert.deepEqual(groups.filter(g=>g.kind==='continuous-cross-hand').map(g=>g.bar),[16]);
  assert.deepEqual(s.notes.filter(n=>n.readingDisplay!.mode==='absolute').map(n=>[n.startTick,n.pitch.pitchClass]),[[6768,4],[6840,6],[9072,7]]);
  const at48=groups.filter(g=>g.bar===48);assert.equal(at48.length,2);
  assert.deepEqual(at48.map(g=>[g.referencePitch,g.anchorOwnerIds.length,g.memberIds.length]),[[55,2,4],[57,2,4]]);
  for(const g of groups){const members=s.notes.filter(n=>g.memberIds.includes(n.id));assert.equal(members.length,g.memberIds.length);for(const n of members)assert.equal(n.readingDisplay!.referencePitch,g.referencePitch);}
  assert.deepEqual(s.notes.slice(0,6).map(n=>n.readingDisplay!.pitchClass),[0,4,7,0,8,3]);
  assert.equal(JSON.stringify(accepted),before);assert.equal(JSON.stringify(no14GoldProfile()),before);
  const window=CURRENT_CANDIDATES[0].windows![0];assert.ok('scoreId' in window);assert.equal(window.scoreId,s.id);for(const c of ROUND_75_CANDIDATES)assert.equal(getCandidate(c.id),c);
});

test('underlined current reading preserves references and returns successive attacks to the accepted temporal centers',()=>{
  const p=no14GestureUnderlineProfile(),old=no14GestureRelativeProfile(),gold=no14GoldProfile();
  assert.deepEqual(p.score.notes,old.score.notes);assert.deepEqual(p.score.readingPresentation,old.score.readingPresentation);
  assert.equal(p.options.readingSequentialParity,undefined);assert.equal(p.options.readingAnchorMark,'underline');
  const windows=[{measureStart:1,measureCount:2},{measureStart:6,measureCount:3}],prepared=new PreparedJankoWindows(p.score,windows,p.options,p.tokens),accepted=new PreparedJankoWindows(gold.score,windows,gold.options,gold.tokens);
  for(const [i,l] of prepared.systems){const ref=accepted.systems.get(i)!,xs=new Map(ref.notes.map(n=>[n.note.id,n.x])),scene=buildInkScene(l,p.options,p.tokens,p.score),out:LintViolation[]=[];
    checkReadingHeadIntegrity(p.score,l,scene,out,p.options,p.tokens);checkReadingParityIntegrity(l,p.options,out);assert.deepEqual(out,[]);
    for(const n of l.notes){assert.ok(Math.abs(n.x-xs.get(n.note.id)!)<1e-8);assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!)<1e-8);const pieces=scene.heads.get(n.note.id)!,glyph=pieces.find(p=>p.paint.cls==='janko-digit')!,mask=pieces.find(p=>p.primitive.kind==='erase')!,marks=pieces.filter(p=>p.paint.cls==='janko-reading-anchor-underline');
      assert.equal(marks.length,n.note.readingDisplay!.isAnchor?1:0);assert.equal(pieces.filter(p=>p.paint.cls==='janko-reading-anchor-bracket'||p.paint.cls==='janko-reading-anchor-frame').length,0);
      assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
      if(marks.length){const mark=marks[0];assert.equal(mark.paint.color,'#000000');assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('underline');assert.equal(mark.primitive.width,.45);assert.equal(mark.box.x0,glyph.box.x0);assert.equal(mark.box.x1,glyph.box.x1);assert.ok(Math.abs(mark.box.y0-glyph.box.y1-.55)<1e-8);assert.deepEqual(mark.ownerIds,glyph.ownerIds);assert.match(sceneHeadSvg(scene,n.note.id),/data-anchor-mark="underline"/);}
    }
    for(const bar of [1,2,6,8]){const from=p.score.sourceBarTicks![bar-1],to=p.score.sourceBarTicks![bar],ns=l.notes.filter(n=>n.note.startTick>=from&&n.note.startTick<to);for(let j=1;j<ns.length;j++)assert.ok(Math.abs(ns[j].x-ns[j-1].x-20.645)<1e-8);}
  }
});

test('simultaneous chord fitting uses relative parity without changing source register ordering',()=>{
  const p=no14GestureUnderlineProfile(),notes=p.score.notes.slice(0,3),spacing=getClusterSpacingPreset(p.options.clusterSpacing);
  // The literal G/B/D pitches form a synthetic simultaneous chord for this fitter test.
  const members=notes.map(n=>{const y=-2.5*(linearPitch(n)-43);return {id:n.id,lin:linearPitch(n),parity:n.readingDisplay!.pitchClass%2 as 0|1,lower:y-3.5,upper:y+3.5,wx:spacing.wx};});
  const before=structuredClone(members),fit=fitParityColumns(members,spacing.air,spacing.pairGap);
  assert.deepEqual(notes.map(n=>n.pitch.pitchClass),[7,11,2]);assert.deepEqual(members.map(m=>m.parity),[0,0,1]);
  assert.deepEqual(notes.map(n=>fit.offsets.get(n.id)),[0,0,spacing.pairGap]);assert.deepEqual(members,before);
});

test('real opening system uses relative physical rails and source register, with black owned brackets',()=>{
  const p=no14GestureRelativeProfile(),prepared=new PreparedJankoWindows(p.score,[{measureStart:1,measureCount:4}],p.options,p.tokens),l=[...prepared.systems.values()][0],scene=buildInkScene(l,p.options,p.tokens,p.score),out:LintViolation[]=[];
  checkReadingHeadIntegrity(p.score,l,scene,out,p.options,p.tokens);checkReadingParityIntegrity(l,p.options,out);assert.deepEqual(out,[]);
  const gap=getClusterSpacingPreset(p.options.clusterSpacing).pairGap;
  const first=l.notes[0];
  for(const n of l.notes){const d=n.note.readingDisplay!,expected=d.groupHasBothParities&&d.pitchClass%2?gap:0;assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!-expected)<1e-8);assert.ok(Math.abs(n.y-first.y+2.5*(linearPitch(n.note)-linearPitch(first.note)))<1e-8);const svg=sceneHeadSvg(scene,n.note.id);assert.ok(svg.includes(`data-reading-group="${d.groupId}"`));assert.ok(svg.includes('data-reading-mode="relative"'));const marks=scene.heads.get(n.note.id)!.filter(x=>x.paint.cls==='janko-reading-anchor-bracket');assert.equal(marks.length,d.isAnchor?6:0);assert.ok(marks.every(m=>m.paint.color==='#000000'&&m.primitive.kind==='stroke'&&m.primitive.width===.45));}
  assert.equal(p.options.beatPulseTicks,72);assert.equal(p.score.ticksPerBeat,48);assert.equal(p.options.dynamicFamily,'libre-bodoni-italic');
});
