import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureCenteredProfile,no14GestureRefinedProfile,NO14_GESTURE_CENTERED_ID} from '../src/render/janko/no14-gesture-relative';
import {layoutJankoScore} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {lintJankoScore,checkReadingHeadIntegrity,type LintViolation} from '../src/render/janko/linter';
import {ROUND_79_CANDIDATES as CURRENT_CANDIDATES,ROUND_78_CANDIDATES,getCandidate} from '../src/render/janko/candidates';

test('uniform underline presentation preserves the exact prior source/contexts/final zero and historical profile',()=>{
  const p=no14GestureCenteredProfile(),old=no14GestureRefinedProfile();
  assert.equal(p.score.id,NO14_GESTURE_CENTERED_ID);assert.deepEqual(p.score.notes,old.score.notes);assert.deepEqual(p.score.readingPresentation,old.score.readingPresentation);
  assert.deepEqual(p.score.writtenPresentation,old.score.writtenPresentation);assert.equal(p.score.writtenPresentation!.events.notes!.length,574);
  assert.equal(p.options.readingUnderlineWidth,4);assert.equal(p.options.readingUnderlineStroke,.65);assert.equal(old.options.readingUnderlineWidth,undefined);
  const {readingUnderlineWidth,...unchanged}=p.options;assert.deepEqual(unchanged,old.options);
  assert.equal(p.score.notes.at(-1)!.readingDisplay!.pitchClass,0);assert.equal(p.score.notes.at(-1)!.readingDisplay!.referencePitch,31);
  assert.equal(p.score.readingPresentation!.anchors.length,125);assert.equal(p.score.readingPresentation!.groups!.length,125);
  assert.equal(getCandidate('no14-gesture-refined'),ROUND_78_CANDIDATES[0]);assert.equal(CURRENT_CANDIDATES[0].id,'no14-gesture-centered');
});

test('all actual anchor marks including1/7/0/A are centered4pt lines with unchanged temporal positions and clean pages',()=>{
  const p=no14GestureCenteredProfile(),start=performance.now(),ls=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start,owners=new Set<string>(),digits=new Set<string>();let heads=0,marks=0;
  for(const l of ls){const scene=buildInkScene(l,p.options,p.tokens,p.score);
    for(const [id,pieces] of scene.heads){heads++;pieces[0].ownerIds.forEach(id=>owners.add(id));const n=l.notes.find(n=>n.note.id===id)!;
      assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!)<1e-8);
      const mark=pieces.find(p=>p.paint.cls==='janko-reading-anchor-underline'),glyph=pieces.find(p=>p.paint.cls==='janko-digit')!,mask=pieces.find(p=>p.primitive.kind==='erase')!;
      assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
      if(mark){marks++;assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke'||glyph.primitive.kind!=='glyph')throw Error('actual primitives');digits.add(glyph.primitive.digit);
        assert.equal(mark.primitive.width,.65);assert.equal(mark.paint.color,'#000000');assert.ok(Math.abs(mark.box.x1-mark.box.x0-4)<1e-8);assert.ok(Math.abs((mark.box.x0+mark.box.x1)/2-glyph.primitive.x)<1e-8);assert.ok(Math.abs(mark.box.y0-glyph.box.y1-.55)<1e-8);assert.deepEqual(mark.ownerIds,glyph.ownerIds);
        if(glyph.primitive.digit==='1')assert.ok(glyph.box.x1-glyph.box.x0<2,'actual narrow1 regression');
      }
    }
    if(l.index===14){const pieces=[...scene.heads.values()].find(ps=>ps.some(p=>p.primitive.kind==='glyph'&&p.primitive.digit==='1'&&p.reading?.isAnchor))!,mark=pieces.find(p=>p.paint.cls==='janko-reading-anchor-underline')!;
      assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('underline');const x1=mark.primitive.x1;mark.primitive.x1+=.4;
      const out:LintViolation[]=[];checkReadingHeadIntegrity(p.score,l,scene,out,p.options,p.tokens);assert.ok(out.some(d=>d.code==='reading-head-integrity'));mark.primitive.x1=x1;
    }
  }
  assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(marks,125);for(const d of ['1','7','0','A'])assert.ok(digits.has(d));
  assert.deepEqual([...new Set(ls.map(l=>l.geometry.pageIndex))],[0,1,2,3]);
  const audit=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,ls);assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
  console.log(JSON.stringify({layoutMs,auditMs:performance.now()-audit,heads,owners:owners.size,marks,digits:[...digits]}));
});
