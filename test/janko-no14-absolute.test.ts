import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync,existsSync} from 'node:fs';
import {no14AbsoluteCondensedProfile,NO14_ABSOLUTE_CONDENSED_ID} from '../src/render/janko/no14-absolute-condensed';
import {no14PublishedProfile,NO14_PUBLISHED_IDENTITY} from '../src/render/janko/no14-published';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {no14GestureOpenProfile} from './support/retired-no14-gesture-relative';
import {layoutJankoScore,renderJankoPage,computePageGeometry,systemCompleteInkBounds} from '../src/render/janko/engine';
import {pageBodyBounds} from '../src/render/janko/page-booking';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {lintJankoScore} from '../src/render/janko/linter';
import {CURRENT_CANDIDATES,CURRENT_ROUND_METADATA,getCandidate} from '../src/render/janko/candidates';
import {createStudioConfig} from '../src/render/janko/studio';

const linear=(n:ReturnType<typeof no14AbsoluteCondensedProfile>['score']['notes'][number])=>12*n.pitch.octave+n.pitch.pitchClass;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const sourceOnly=(score:ReturnType<typeof no14AbsoluteCondensedProfile>['score'])=>{
 const s=structuredClone(score);delete s.readingPresentation;delete (s as Partial<typeof s>).id;
 if(s.printIdentity)delete (s.printIdentity as Partial<typeof s.printIdentity>).scoreId;
 s.notes=s.notes.map(({readingDisplay,...n})=>n);return s;
};

test('absolute successor retains all383 literal owners and574 performed notes with the complete source correction ledger',()=>{
 const p=no14AbsoluteCondensedProfile(),s=p.score,raw=no14GoldProfile().score,prior=no14GestureOpenProfile().score,{performed}=projectNo14Written();
 assert.equal(s.id,NO14_ABSOLUTE_CONDENSED_ID);assert.deepEqual(sourceOnly(s),sourceOnly(prior));
 assert.equal(s.notes.length,383);assert.equal(s.writtenPresentation!.events.notes.length,574);
 assert.equal(s.readingPresentation!.anchors.length,0);assert.equal(s.readingPresentation!.groups!.length,0);
 for(const n of s.notes){const d=n.readingDisplay!;assert.equal(d.mode,'absolute');assert.equal(d.pitchClass,n.pitch.pitchClass);assert.equal(d.relativeOctave,n.pitch.octave);assert.equal(d.referencePitch,0);assert.equal(d.isAnchor,false);assert.equal(d.groupId,undefined);}
 for(const row of s.writtenPresentation!.events.notes){const {readingDisplay,...n}=s.notes[row.writtenIndex];assert.deepEqual({...n,...row.overrides},performed.notes[row.performedIndex]);}
 assert.equal(s.notes.at(-1)!.pitch.pitchClass,7,'final source7 is absolute again');
 assert.equal(s.dynamics.length,9);assert.equal(s.writtenPresentation!.events.dynamics.length,13);assert.equal(s.editionCorrections!.length,2);
 const restored=[...s.dynamics];for(const c of s.editionCorrections!)restored.splice(c.writtenIndex,0,c.original);assert.deepEqual(restored,raw.dynamics);
 const oldIndices=raw.dynamics.map((_,i)=>i).filter(i=>!s.editionCorrections!.some(c=>c.writtenIndex===i));
 const mapping=[...s.writtenPresentation!.events.dynamics.map(r=>({...r,writtenIndex:oldIndices[r.writtenIndex]})),...s.editionCorrections!.flatMap(c=>c.performedMappings)].sort((a,b)=>a.performedIndex-b.performedIndex);
 assert.deepEqual(mapping,[...raw.writtenPresentation!.events.dynamics].sort((a,b)=>a.performedIndex-b.performedIndex));
 const shared=s.notes.filter(n=>n.startTick>=6768&&n.startTick<6912),held=shared.filter(n=>n.hand==='RH'&&n.durationTicks===72);assert.equal(held.length,2);
 for(const n of held){const aliases=shared.filter(q=>q.startTick===n.startTick&&linear(q)===linear(n));assert.equal(aliases.length,2);assert.deepEqual(aliases.map(q=>q.durationTicks).sort((a,b)=>a-b),[24,72]);assert.deepEqual(aliases[0].readingDisplay,aliases[1].readingDisplay);}
 const byId=new Map(s.notes.map(n=>[n.id,n])),phrases=s.phrases!.filter(q=>q.startTick===6768);
 assert.equal(phrases.length,2);assert.deepEqual(phrases.map(q=>[linear(byId.get(q.fromNoteIds[0])!),linear(byId.get(q.toNoteIds[0])!)]),[[55,57],[40,42]],'distinct source48 slurs survive; placement remains a disclosed limitation');
 assert.deepEqual(no14PublishedProfile(),p);assert.equal(hash(JSON.stringify(p)),NO14_PUBLISHED_IDENTITY.profileSha256);
});

test('retired relative IDs have no profile, card or runtime import route and current studio offers the absolute successor',()=>{
 const config=createStudioConfig();assert.equal(CURRENT_ROUND_METADATA.round,83);assert.equal(CURRENT_CANDIDATES.length,1);assert.equal(CURRENT_CANDIDATES[0].id,'no14-absolute-condensed');
 assert.deepEqual(config.scores[NO14_ABSOLUTE_CONDENSED_ID].score,no14PublishedProfile().score);
 for(const id of ['relative-study','relative-baseline','gesture-relative','gesture-underlined','gesture-refined','gesture-centered','gesture-condensed','gesture-optical','gesture-open','bar-relative'])assert.equal(config.scores['schumann-op68-no14-'+id],undefined);
 for(const id of ['relative-first-page','relative-absolute-references','relative-played-anchor-baseline','relative-bracketed-anchor','gesture-relative','gesture-underlined','gesture-refined','gesture-centered','gesture-optical','gesture-open','bar-relative'])assert.equal(getCandidate('no14-'+id),undefined);
 assert.equal(existsSync('src/render/janko/no14-relative.ts'),false);assert.equal(existsSync('src/render/janko/no14-gesture-relative.ts'),false);
});

test('absolute three-page ink preserves settled axes and source obligations with no underlines and audited optical seats',()=>{
 const p=no14AbsoluteCondensedProfile(),start=performance.now(),layouts=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start;
 const at=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,layouts),auditMs=performance.now()-at;
 assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);assert.equal(layouts.length,11);
 const prior=no14GestureOpenProfile(),old=layoutJankoScore(prior.score,prior.options,prior.tokens),geometry=computePageGeometry(p.options,p.tokens,p.score);
 assert.deepEqual(geometry.systemBarStarts,[0,6,12,18,24,30,36,42,48,54,60,64]);assert.deepEqual(geometry.productionSystems,computePageGeometry(prior.options,prior.tokens,prior.score).productionSystems);
 const owners=new Set<string>();let heads=0;
 for(const[i,l]of layouts.entries()){
  assert.deepEqual(l.columns,old[i].columns);assert.equal(l.geometry.pageIndex,old[i].geometry.pageIndex);
  for(const n of l.notes){const was=old[i].notes.find(q=>q.note.id===n.note.id)!;assert.equal(n.x,was.x);assert.equal(n.y,was.y);assert.equal(n.symbolScale,was.symbolScale);}
  const ink=systemCompleteInkBounds(l,p.options,p.tokens),body=pageBodyBounds(geometry,l.geometry.pageIndex!);assert.ok(ink.top>=body.top-1e-6&&ink.bottom<=body.bottom+1e-6);
  const scene=buildInkScene(l,p.options,p.tokens,p.score);
  for(const [id,pieces]of scene.heads){heads++;const n=l.notes.find(q=>q.note.id===id)!,glyph=pieces.find(q=>q.paint.cls==='janko-digit')!,mask=pieces.find(q=>q.primitive.kind==='erase')!;
   assert.equal(glyph.primitive.kind,'glyph');if(glyph.primitive.kind!=='glyph')throw Error('digit');assert.equal(glyph.primitive.digit,n.note.pitch.pitchClass.toString(12).toUpperCase());
   const seat=(glyph.primitive.digit==='1'?-.01625:glyph.primitive.digit==='B'?-.025:0)*glyph.primitive.em;assert.ok(Math.abs(glyph.primitive.x-n.x-seat)<1e-8);
   assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);assert.ok(pieces.every(q=>!q.paint.cls?.startsWith('janko-reading-anchor')));
   pieces[0].ownerIds.forEach(id=>{assert.ok(!owners.has(id));owners.add(id);});
  }
  for(const q of l.expressions?.filter(q=>q.kind==='phrase')??[])assert.deepEqual(q.contour,old[i].expressions!.find(r=>r.id===q.id)!.contour,'presentation conversion retains existing slurs, including the disclosed48 limitation');
 }
 assert.equal(heads,381);assert.equal(owners.size,383);
 const rests=layouts.flatMap(l=>l.rests??[]);assert.deepEqual(rests.map(r=>[r.hand,r.tick,r.durationTicks,r.value]),[['RH',9072,144,'whole'],['LH',9096,24,'eighth'],['LH',9120,24,'eighth'],['LH',9144,48,'quarter'],['LH',9192,24,'eighth']]);
 const pages=[0,1,2].map(i=>renderJankoPage(p.score,i,p.options,p.tokens,layouts)),svg=pages.join('');
 assert.equal((svg.match(/class="janko-rest-group"/g)??[]).length,5);assert.equal((svg.match(/class="janko-repeat-dot"/g)??[]).length,4);assert.doesNotMatch(svg,/janko-reading-anchor|class="janko-dynamic"|gesture-relative reading|Study ·/);
 assert.match(pages[0],/Album für die Jugend · Op\. 68/);assert.match(pages[0],/No\. 14 · Kleine Studie/);
 const receipt={layoutMs,auditMs,pages:3,systems:11,heads,owners:owners.size,underlines:0,sourceNotes:383,performedNotes:574,positionsChanged:0,slurContoursChanged:0,rests:5,knownLimitation:'Distinct source48 slurs still occupy nearly identical LH-side seats; no placement acceptance claimed.',violations:report.violations,warnings:report.warnings};
 writeFileSync('/tmp/iso-no14-absolute-complete-audit-20261003.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
});
