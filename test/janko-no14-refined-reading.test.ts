import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureUnderlineProfile,no14GestureRefinedProfile,NO14_GESTURE_REFINED_ID} from '../src/render/janko/no14-gesture-relative';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {recoverReadingPitch} from '../src/render/janko/no14-relative';
import {linearPitch} from '../src/render/janko/anchor-solver';
import {layoutJankoScore} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {lintJankoScore,checkReadingHeadIntegrity,type LintViolation} from '../src/render/janko/linter';
import {ROUND_78_CANDIDATES as CURRENT_CANDIDATES,ROUND_77_CANDIDATES,getCandidate} from '../src/render/janko/candidates';

test('terminal zero continues the LH reference independently of RH and preserves every source/repeat obligation',()=>{
  const p=no14GestureRefinedProfile(),old=no14GestureUnderlineProfile(),gold=no14GoldProfile(),s=p.score,final=s.notes.at(-1)!;
  assert.equal(s.id,NO14_GESTURE_REFINED_ID);assert.equal(old.options.readingUnderlineStroke,.45);assert.equal(p.options.readingUnderlineStroke,.65);
  assert.equal(s.readingPresentation!.anchors.length,125);assert.deepEqual(s.readingPresentation!.anchors,old.score.readingPresentation!.anchors);
  assert.deepEqual(final.readingDisplay,{pitchClass:0,relativeOctave:0,referencePitch:31,isAnchor:false,mode:'relative',groupId:'gesture-63-0-hand-figure',groupHasBothParities:true});
  const group=s.readingPresentation!.groups!.find(g=>g.id===final.readingDisplay!.groupId)!;assert.equal(group.memberIds.length,4);assert.ok(group.memberIds.includes(final.id));
  assert.equal(s.readingPresentation!.groups!.find(g=>g.id==='gesture-63-72-hand-figure')!.referencePitch,55);
  assert.deepEqual(s.notes.filter(n=>n.readingDisplay!.mode==='absolute').map(n=>[n.startTick,n.pitch.pitchClass]),[[6768,4],[6840,6]]);
  s.notes.forEach((n,i)=>{const {readingDisplay,...literal}=n;assert.deepEqual(literal,gold.score.notes[i]);assert.equal(recoverReadingPitch(n),linearPitch(n));if(n!==final)assert.deepEqual(n,old.score.notes[i]);});
  const performed=projectNo14Written().performed,events=s.writtenPresentation!.events.notes!;assert.equal(events.length,574);
  for(const event of events){const n=s.notes[event.writtenIndex],{readingDisplay,...literal}=n;assert.deepEqual({...literal,...event.overrides},performed.notes[event.performedIndex]);assert.equal(recoverReadingPitch(n),linearPitch(performed.notes[event.performedIndex]));}
  for(const key of ['sourceBarTicks','timeSignatures','barlines','tempos','dynamics','pedals','phrases','sourceSilences','graceGroups','tieChains','writtenPresentation'] as const)assert.deepEqual(s[key],gold.score[key]);
  assert.equal(CURRENT_CANDIDATES[0].id,'no14-gesture-refined');assert.equal(getCandidate('no14-gesture-underlined'),ROUND_77_CANDIDATES[0]);
});

test('stronger full-page underlines retain exact timing/register/footprints and owned protection',()=>{
  const p=no14GestureRefinedProfile(),start=performance.now(),ls=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start,owners=new Set<string>();let heads=0,marks=0;
  const heights:number[]=[],busyStaffGaps:number[]=[];
  for(const l of ls){const scene=buildInkScene(l,p.options,p.tokens,p.score),first=l.notes[0];
    for(const [id,pieces] of scene.heads){heads++;pieces[0].ownerIds.forEach(id=>owners.add(id));const n=l.notes.find(n=>n.note.id===id)!;
      assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!)<1e-8);assert.ok(Math.abs(n.y-first.y+2.5*(linearPitch(n.note)-linearPitch(first.note)))<1e-8);
      const mark=pieces.find(p=>p.paint.cls==='janko-reading-anchor-underline'),glyph=pieces.find(p=>p.paint.cls==='janko-digit')!,mask=pieces.find(p=>p.primitive.kind==='erase')!;
      assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
      if(mark){marks++;assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('stroke');assert.equal(mark.primitive.width,.65);assert.equal(mark.paint.color,'#000000');assert.deepEqual(mark.ownerIds,glyph.ownerIds);assert.ok(Math.abs(mark.box.y0-glyph.box.y1-.55)<1e-8);heights.push(mask.box.y1-mask.box.y0);
        if(n.note.startTick===2016||n.note.startTick===2160){const gaps=scene.pitch.filter(p=>p.primitive.kind==='stroke'&&p.primitive.y1===p.primitive.y2&&p.box.x0<=mark.box.x1&&p.box.x1>=mark.box.x0).map(p=>Math.min(Math.abs(p.box.y0-mark.box.y1),Math.abs(p.box.y1-mark.box.y0)));busyStaffGaps.push(Math.min(...gaps));}
      }else assert.equal(n.note.readingDisplay!.isAnchor,false);
    }
    // Foreign ownership remains a defect even though the exact own underline seat is allowed.
    if(l.index===0){const pieces=[...scene.heads.values()].find(ps=>ps.some(p=>p.paint.cls==='janko-reading-anchor-underline'))!,mark=pieces.find(p=>p.paint.cls==='janko-reading-anchor-underline')!,saved=mark.ownerIds;mark.ownerIds=['foreign'];const out:LintViolation[]=[];checkReadingHeadIntegrity(p.score,l,scene,out,p.options,p.tokens);assert.ok(out.some(d=>d.code==='reading-head-integrity'));mark.ownerIds=saved;}
  }
  assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(marks,125);assert.deepEqual([...new Set(ls.map(l=>l.geometry.pageIndex))],[0,1,2,3]);
  assert.ok(busyStaffGaps.every(g=>Math.abs(g-.6925333333333)<1e-8));assert.equal(busyStaffGaps.length,2);
  const audit=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,ls);assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
  console.log(JSON.stringify({layoutMs,auditMs:performance.now()-audit,heads,owners:owners.size,marks,maskHeights:[Math.min(...heights),Math.max(...heights)],busyStaffGaps}));
});
