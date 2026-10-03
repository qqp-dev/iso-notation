import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {no14RelativeBaselineProfile,recoverReadingPitch} from '../src/render/janko/no14-relative';
import {ROUND_74_CANDIDATES as CURRENT_CANDIDATES,ROUND_73_CANDIDATES,getCandidate} from '../src/render/janko/candidates';
import {resolveJankoOptions} from '../src/render/janko/types';
import {GOTHIC_DEMI_GLYPHS} from '../src/render/janko/gothic-glyphs';
import {buildInkScene,sceneHeadSvg,READING_ANCHOR_PROTECTION_AIR,READING_ANCHOR_BRACKET_COLOR} from '../src/render/janko/ink-scene';
import {layoutJankoScore,renderJankoPage} from '../src/render/janko/engine';
import {lintJankoScore} from '../src/render/janko/linter';
const e=no14RelativeBaselineProfile(),o=resolveJankoOptions({...e.options,readingAnchorMark:'brackets'});

test('authentic bracket face and historical control preserve the existing reading solution',()=>{
 assert.equal(createHash('sha256').update(readFileSync(new URL('../public/fonts/URWGothic-Demi.otf',import.meta.url))).digest('hex'),'5b009410cf5231dcb1e45b155c1afedcfc63d82042fd8c414d0dd7705c9fbbae');
 assert.equal(GOTHIC_DEMI_GLYPHS['['].advance,320);assert.deepEqual(GOTHIC_DEMI_GLYPHS['['].bounds,[76.91656477634885,-137,295,739]);
 assert.deepEqual(GOTHIC_DEMI_GLYPHS[']'].bounds,[37,-137,255.08343522365115,739]);
 assert.equal(CURRENT_CANDIDATES[0].id,'no14-relative-bracketed-anchor');assert.equal(CURRENT_CANDIDATES[0].options?.readingAnchorMark,'brackets');
 assert.equal(getCandidate('no14-relative-played-anchor-baseline'),ROUND_73_CANDIDATES[0]);assert.equal(ROUND_73_CANDIDATES[0].options?.readingAnchorMark,undefined);
 assert.equal(e.score.readingPresentation!.resets,34);assert.equal(e.score.readingPresentation!.cost,41995);
 assert.deepEqual(e.score,no14RelativeBaselineProfile().score);assert.equal(e.options.readingAnchorMark,undefined);
 for(const n of e.score.notes)assert.equal(recoverReadingPitch(n),12*n.pitch.octave+n.pitch.pitchClass);
});

test('all real bracket pages own authentic glyphs with measured protection and preserve digit positions',()=>{
 const started=performance.now(),ls=layoutJankoScore(e.score,o,e.tokens),layoutMs=performance.now()-started;
 let heads=0,anchors=0;const owners=new Set<string>();
 for(const l of ls){
   const scene=buildInkScene(l,o,e.tokens,e.score),old=buildInkScene(l,e.options,e.tokens,e.score);
   for(const [id,pieces] of scene.heads){
     heads++;pieces[0].ownerIds.forEach(id=>owners.add(id));
     const digit=pieces.find(p=>p.paint.cls==='janko-digit')!,oldDigit=old.heads.get(id)!.find(p=>p.paint.cls==='janko-digit')!;
     assert.deepEqual(digit.primitive,oldDigit.primitive);assert.deepEqual(digit.box,oldDigit.box);
     const marks=pieces.filter(p=>p.paint.cls==='janko-reading-anchor-bracket');
     assert.equal(marks.length,pieces[0].reading!.isAnchor?2:0);
     assert.equal(pieces.filter(p=>p.paint.cls==='janko-reading-anchor-frame').length,0);
     if(!marks.length)assert.deepEqual(pieces.map(p=>p.primitive),old.heads.get(id)!.map(p=>p.primitive));
     else{
       anchors++;const mask=pieces.find(p=>p.primitive.kind==='erase')!.box;
       assert.deepEqual(marks.map(p=>p.primitive.kind==='glyph'?p.primitive.digit:null),['[',']']);
       for(const mark of marks){
         assert.equal(mark.paint.color,READING_ANCHOR_BRACKET_COLOR);assert.deepEqual(mark.ownerIds,digit.ownerIds);
         assert.ok(mark.box.x0>=mask.x0+READING_ANCHOR_PROTECTION_AIR-1e-8&&mark.box.x1<=mask.x1-READING_ANCHOR_PROTECTION_AIR+1e-8);
         assert.ok(mark.box.y0>=mask.y0+READING_ANCHOR_PROTECTION_AIR-1e-8&&mark.box.y1<=mask.y1-READING_ANCHOR_PROTECTION_AIR+1e-8);
         assert.match(mark.svg,/font-family="URW Gothic" text-anchor="middle"/);
       }
       assert.ok(Math.abs((digit.box.y0+digit.box.y1)/2-(marks[0].box.y0+marks[0].box.y1)/2)<1e-8);
     }
     assert.match(sceneHeadSvg(scene,id),/data-anchor-mark="brackets"/);
   }
 }
 assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(anchors,34);
 const pages=[...new Set(ls.map(l=>l.geometry.pageIndex))];assert.deepEqual(pages,[0,1,2,3]);
 let painted=0;
 for(const page of pages){const svg=renderJankoPage(e.score,page!,o,e.tokens,ls);painted+=[...svg.matchAll(/class="janko-reading-anchor-bracket"/g)].length;assert.doesNotMatch(svg,/janko-reading-anchor-frame|janko-reading-reference/);}
 assert.equal(painted,68);
 const startedLint=performance.now(),report=lintJankoScore(e.score,o,e.tokens,undefined,ls);
 console.log(JSON.stringify({layoutMs,lintMs:performance.now()-startedLint,heads,owners:owners.size,anchors,brackets:painted,errors:report.violations.length,warnings:report.warnings.length}));
 assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
});
