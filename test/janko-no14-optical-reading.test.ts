import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureOpticalProfile,no14GestureCondensedProfile,no14GestureCenteredProfile,NO14_GESTURE_OPTICAL_ID} from '../src/render/janko/no14-gesture-relative';
import {layoutJankoScore,renderJankoPage} from '../src/render/janko/engine';
import {buildInkScene,sceneHeadSvg} from '../src/render/janko/ink-scene';
import {lintJankoScore} from '../src/render/janko/linter';
import {GOTHIC_DEMI_GLYPHS} from '../src/render/janko/gothic-glyphs';
import {ROUND_80_CANDIDATES as CURRENT_CANDIDATES,ROUND_80_METADATA as CURRENT_ROUND_METADATA,ROUND_79_CANDIDATES,getCandidate,candidateBadges} from '../src/render/janko/candidates';
import {createStudioConfig} from '../src/render/janko/studio';

test('combined optical profile preserves all source/context/density decisions and declares only font seats and uniform mark span',()=>{
  const p=no14GestureOpticalProfile(),old=no14GestureCondensedProfile(),historical=no14GestureCenteredProfile();
  assert.equal(p.score.id,NO14_GESTURE_OPTICAL_ID);assert.deepEqual(p.score.notes,old.score.notes);
  assert.deepEqual(p.score.readingPresentation,old.score.readingPresentation);assert.deepEqual(p.score.writtenPresentation,old.score.writtenPresentation);
  const {readingUnderlineWidth,readingGlyphSeats,...unchanged}=p.options;
  const {readingUnderlineWidth:oldWidth,...oldOptions}=old.options;
  assert.equal(oldWidth,4);assert.equal(readingUnderlineWidth,4.6);assert.deepEqual(readingGlyphSeats,{'1':-.0325,B:-.025});assert.deepEqual(unchanged,oldOptions);
  assert.equal(historical.options.readingGlyphSeats,undefined);assert.equal(historical.options.readingUnderlineWidth,4);assert.equal(historical.options.measuresPerSystem,4);
  assert.equal(p.options.readingUnderlineStroke,.65);assert.equal(p.score.notes.at(-1)!.readingDisplay!.pitchClass,0);
  assert.equal(GOTHIC_DEMI_GLYPHS['1'].advance,560);assert.ok(GOTHIC_DEMI_GLYPHS['1'].contours[0].some(([x])=>x===246));assert.ok(GOTHIC_DEMI_GLYPHS['1'].contours[0].some(([x])=>x===379));
  const bx=GOTHIC_DEMI_GLYPHS.B.contours.flat().map(([x])=>x);assert.equal(Math.min(...bx),68);assert.equal(Math.max(...bx),548);assert.equal(GOTHIC_DEMI_GLYPHS.B.advance,580);
});

test('Round80 offers one complete combined score and preserves Round79 and detached density controls without technical badges',()=>{
  assert.equal(CURRENT_ROUND_METADATA.round,80);assert.equal(CURRENT_CANDIDATES.length,1);assert.equal(CURRENT_CANDIDATES[0].id,'no14-gesture-optical');
  assert.equal(CURRENT_ROUND_METADATA.compareStrip,undefined);assert.equal(CURRENT_ROUND_METADATA.compareStrips,undefined);
  assert.equal(CURRENT_CANDIDATES[0].windows!.length,1);const window=CURRENT_CANDIDATES[0].windows![0];assert.ok('fullScore' in window&&window.fullScore);
  assert.equal(getCandidate('no14-gesture-centered'),ROUND_79_CANDIDATES[0]);
  const config=createStudioConfig();assert.deepEqual(config.scores[NO14_GESTURE_OPTICAL_ID].options.readingGlyphSeats,{'1':-.0325,B:-.025});
  assert.equal(config.scores['schumann-op68-no14-gesture-condensed'].options.readingUnderlineWidth,4);
  const badges=candidateBadges(CURRENT_CANDIDATES[0]);assert.ok(badges.every(b=>b.key!=='readingGlyphSeats'&&b.key!=='productionWidthPolicy'));
});

test('all combined pages use truthful optical seats while rhythmic axes, owner masks and wider marks remain fixed and clean',()=>{
  const p=no14GestureOpticalProfile(),old=no14GestureCondensedProfile(),start=performance.now(),layouts=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start;
  const auditStart=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,layouts),auditMs=performance.now()-auditStart;
  assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);assert.equal(layouts.length,11);
  assert.deepEqual([...new Set(layouts.map(l=>l.geometry.pageIndex))],[0,1,2]);
  const owners=new Set<string>(),seated:Record<string,number>={'1':0,B:0},controls:Record<string,number>={'7':0,'9':0};let heads=0,marks=0;
  for(const l of layouts){const scene=buildInkScene(l,p.options,p.tokens,p.score),baseline=buildInkScene(l,old.options,p.tokens,p.score);
    for(const [id,pieces] of scene.heads){heads++;const placed=l.notes.find(n=>n.note.id===id)!;
      const glyph=pieces.find(q=>q.paint.cls==='janko-digit')!,previous=baseline.heads.get(id)!.find(q=>q.paint.cls==='janko-digit')!,mask=pieces.find(q=>q.primitive.kind==='erase')!;
      assert.equal(glyph.primitive.kind,'glyph');assert.equal(previous.primitive.kind,'glyph');if(glyph.primitive.kind!=='glyph'||previous.primitive.kind!=='glyph')throw Error('actual glyphs');
      const digit=glyph.primitive.digit,shift=(digit==='1'?-.0325:digit==='B'?-.025:0)*glyph.primitive.em;
      assert.ok(Math.abs(glyph.primitive.x-placed.x-shift)<1e-8);assert.equal(glyph.primitive.em,previous.primitive.em);assert.equal(glyph.primitive.baseline,previous.primitive.baseline);
      assert.ok(Math.abs(glyph.box.x0-previous.box.x0-shift)<1e-8);assert.ok(Math.abs(glyph.box.x1-previous.box.x1-shift)<1e-8);
      assert.ok(Math.abs((mask.box.x0+mask.box.x1)/2-placed.x)<1e-8);assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
      assert.ok(Math.abs(placed.x-l.columns.get(placed.note.startTick)!)<1e-8);
      pieces[0].ownerIds.forEach(owner=>{assert.ok(!owners.has(owner));owners.add(owner);});assert.ok(pieces.every(q=>q.reading?.noteX===placed.x));
      assert.ok(sceneHeadSvg(scene,id).includes(`data-note-x="${placed.x}"`));assert.ok(!sceneHeadSvg(baseline,id).includes('data-note-x='),'old SVG grammar retained when option absent');
      if(digit==='1'){seated['1']++;const body=(246+379)/2,advance=GOTHIC_DEMI_GLYPHS['1'].advance;assert.ok(Math.abs(glyph.primitive.x+(body-advance/2)*glyph.primitive.em/1000-placed.x)<1e-8);}
      if(digit==='B')seated.B++;if(digit==='7'||digit==='9'){controls[digit]++;assert.equal(glyph.primitive.x,previous.primitive.x);}
      const mark=pieces.find(q=>q.paint.cls==='janko-reading-anchor-underline');if(mark){marks++;
        assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('actual underline');assert.equal(mark.primitive.width,.65);assert.equal(mark.paint.color,'#000000');
        assert.ok(Math.abs(mark.box.x1-mark.box.x0-4.6)<1e-8);assert.ok(Math.abs((mark.box.x0+mark.box.x1)/2-placed.x)<1e-8);assert.ok(Math.abs(mark.box.y0-glyph.box.y1-.55)<1e-8);
        assert.ok(Math.abs(mark.box.x0-mask.box.x0-.23)<1e-8);assert.ok(Math.abs(mask.box.x1-mark.box.x1-.23)<1e-8);
        if(digit==='B'){const left=glyph.box.x0-mark.box.x0,right=mark.box.x1-glyph.box.x1;assert.ok(Math.abs(left-.3898666666667)<1e-8);assert.ok(Math.abs(right-.4981333333333)<1e-8);assert.ok(right>left);}
      }
    }
  }
  assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(marks,125);assert.ok(seated['1']>0&&seated.B>0&&controls['7']>0&&controls['9']>0);
  const pages=[0,1,2].map(i=>renderJankoPage(p.score,i,p.options,p.tokens,layouts));
  assert.equal(pages.join('').match(/class="janko-reading-head"/g)!.length,381);assert.equal(pages.join('').match(/class="janko-reading-anchor-underline"/g)!.length,125);
  console.log(JSON.stringify({layoutMs,auditMs,pages:3,systems:11,heads,owners:owners.size,marks,seated,controls,violations:report.violations,warnings:report.warnings,firstBars:layouts.map(l=>l.geometry.firstBar!+1)}));
});
