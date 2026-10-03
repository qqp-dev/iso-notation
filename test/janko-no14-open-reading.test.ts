import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureOpenProfile,no14GestureOpticalProfile,NO14_GESTURE_OPEN_ID} from '../src/render/janko/no14-gesture-relative';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {recoverReadingPitch} from '../src/render/janko/no14-relative';
import {linearPitch} from '../src/render/janko/anchor-solver';
import {layoutJankoScore,renderJankoPage,computePageGeometry,systemCompleteInkBounds} from '../src/render/janko/engine';
import {pageBodyBounds} from '../src/render/janko/page-booking';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {lintJankoScore} from '../src/render/janko/linter';
import {repeatFirstAttackEnvelope,repeatLeadingAir} from '../src/render/janko/repeat-signs';
import {pedalIntervals} from '../src/render/janko/elements/expressions';
import {CURRENT_CANDIDATES,CURRENT_ROUND_METADATA,ROUND_80_CANDIDATES,getCandidate,candidateBadges} from '../src/render/janko/candidates';
import {createStudioConfig} from '../src/render/janko/studio';

test('complete successor preserves notes and reconstructs both omitted piano events and every performed mapping',()=>{
 const old=no14GestureOpticalProfile(),gold=no14GoldProfile(),oldBytes=JSON.stringify(old),goldBytes=JSON.stringify(gold),p=no14GestureOpenProfile(),s=p.score;
 assert.equal(s.id,NO14_GESTURE_OPEN_ID);assert.deepEqual(s.notes,old.score.notes);assert.deepEqual(s.readingPresentation,old.score.readingPresentation);
 for(const field of ['sourceBarTicks','timeSignatures','barlines','tempos','pedals','phrases','sourceSilences','graceGroups','tieChains','performingInstruction'] as const)assert.deepEqual(s[field],old.score[field],field);
 const {readingGlyphSeats,authoredRestMode,phraseRouting,...same}=p.options;
 const {readingGlyphSeats:oldSeats,phraseRouting:oldRoute,...oldSame}=old.options;
 assert.deepEqual(same,oldSame);assert.deepEqual(oldSeats,{'1':-.0325,B:-.025});assert.deepEqual(readingGlyphSeats,{'1':-.01625,B:-.025});
 assert.equal(authoredRestMode,'source');assert.equal(phraseRouting,'optical-open');assert.equal(oldRoute,'optical-silhouette');
 assert.equal(s.printIdentity!.work,'Album für die Jugend · Op. 68');assert.equal(s.printIdentity!.piece,'No. 14 · Kleine Studie');
 assert.deepEqual(s.publicationNotices,old.score.publicationNotices!.filter(q=>!q.startsWith('Study · ')));
 const ledger=s.editionCorrections!;assert.equal(ledger.length,2);assert.deepEqual(ledger.map(q=>[q.original.tick,q.writtenIndex,q.performedMappings.length]),[[0,0,1],[4608,6,2]]);
 assert.ok(ledger.every(q=>q.kind==='omit-dynamic'&&q.original.mark==='p'&&q.witness.includes('1848')&&q.reason.includes('operator evidence, not agent certification')));
 assert.equal(s.dynamics.length,9);assert.equal(s.writtenPresentation!.events.dynamics.length,13);assert.ok(s.dynamics.every(q=>q.mark!=='p'));
 const restored=[...s.dynamics];for(const correction of ledger)restored.splice(correction.writtenIndex,0,correction.original);assert.deepEqual(restored,old.score.dynamics);
 const kept=old.score.dynamics.map((_,i)=>i).filter(i=>!ledger.some(q=>q.writtenIndex===i));
 const remapped=s.writtenPresentation!.events.dynamics.map(q=>({...q,writtenIndex:kept[q.writtenIndex]}));
 const restoredMappings=[...remapped,...ledger.flatMap(q=>q.performedMappings)].sort((a,b)=>a.performedIndex-b.performedIndex);
 assert.deepEqual(restoredMappings,[...old.score.writtenPresentation!.events.dynamics].sort((a,b)=>a.performedIndex-b.performedIndex));
 const {performed}=projectNo14Written();
 for(const event of s.writtenPresentation!.events.dynamics)assert.deepEqual({...s.dynamics[event.writtenIndex],...event.overrides},performed.dynamics[event.performedIndex]);
 assert.deepEqual(s.writtenPresentation!.events.notes,old.score.writtenPresentation!.events.notes);assert.equal(s.writtenPresentation!.events.notes.length,574);
 for(const event of s.writtenPresentation!.events.notes){const n=s.notes[event.writtenIndex],{readingDisplay,...literal}=n;assert.equal(recoverReadingPitch(n),linearPitch(performed.notes[event.performedIndex]));assert.deepEqual({...literal,...event.overrides},performed.notes[event.performedIndex]);}
 assert.equal(JSON.stringify(no14GestureOpticalProfile()),oldBytes);assert.equal(JSON.stringify(no14GoldProfile()),goldBytes);
});

test('Round81 presents one full score while Round80 remains separately addressable and unchanged',()=>{
 assert.equal(CURRENT_ROUND_METADATA.round,81);assert.equal(CURRENT_CANDIDATES.length,1);assert.equal(CURRENT_CANDIDATES[0].id,'no14-gesture-open');
 assert.equal(CURRENT_ROUND_METADATA.compareStrip,undefined);assert.equal(CURRENT_ROUND_METADATA.compareStrips,undefined);
 assert.equal(CURRENT_CANDIDATES[0].windows!.length,1);const w=CURRENT_CANDIDATES[0].windows![0];assert.ok('fullScore' in w&&w.fullScore);assert.equal(w.scoreId,NO14_GESTURE_OPEN_ID);
 assert.equal(getCandidate('no14-gesture-optical'),ROUND_80_CANDIDATES[0]);assert.deepEqual(ROUND_80_CANDIDATES[0].options!.readingGlyphSeats,{'1':-.0325,B:-.025});
 const config=createStudioConfig();assert.equal(config.scores[NO14_GESTURE_OPEN_ID].options.authoredRestMode,'source');
 assert.equal(config.scores['schumann-op68-no14-gesture-optical'].options.authoredRestMode,undefined);
 assert.ok(candidateBadges(CURRENT_CANDIDATES[0]).every(q=>!['readingGlyphSeats','productionWidthPolicy','readingUnderlineWidth'].includes(q.key)));
});

test('complete open score admits exact ending rests, quiet/steep/natural slurs and all source owners on three clean pages',()=>{
 const p=no14GestureOpenProfile(),start=performance.now(),layouts=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start;
 const at=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,layouts),auditMs=performance.now()-at;
 assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);assert.equal(layouts.length,11);assert.deepEqual([...new Set(layouts.map(l=>l.geometry.pageIndex))],[0,1,2]);
 assert.ok(layouts.every(l=>l.unwrittenRests.length===0&&l.withheldRests.length===0));
 const geo=computePageGeometry(p.options,p.tokens,p.score),owners=new Set<string>(),seenBars:number[]=[];let heads=0,marks=0,ones=0,bs=0;
 for(const l of layouts){
  const bounds=systemCompleteInkBounds(l,p.options,p.tokens),body=pageBodyBounds(geo,l.geometry.pageIndex!);assert.ok(bounds.top>=body.top-1e-6&&bounds.bottom<=body.bottom+1e-6);
  const scene=buildInkScene(l,p.options,p.tokens,p.score);
  for(const [id,pieces] of scene.heads){heads++;const n=l.notes.find(n=>n.note.id===id)!,glyph=pieces.find(q=>q.paint.cls==='janko-digit')!,mask=pieces.find(q=>q.primitive.kind==='erase')!;
   assert.equal(glyph.primitive.kind,'glyph');if(glyph.primitive.kind!=='glyph')throw Error('actual digit');
   const digit=glyph.primitive.digit,shift=(digit==='1'?-.01625:digit==='B'?-.025:0)*glyph.primitive.em;
   assert.ok(Math.abs(glyph.primitive.x-n.x-shift)<1e-8);assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!)<1e-8);
   assert.ok(Math.abs((mask.box.x0+mask.box.x1)/2-n.x)<1e-8);assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
   if(digit==='1'){ones++;assert.ok(Math.abs(glyph.primitive.x+.0325*glyph.primitive.em-n.x-.01625*glyph.primitive.em)<1e-8,'dominant1 body retains half its initial right offset');}if(digit==='B')bs++;
   pieces[0].ownerIds.forEach(id=>{assert.ok(!owners.has(id));owners.add(id);});
   const mark=pieces.find(q=>q.paint.cls==='janko-reading-anchor-underline');if(mark){marks++;assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('underline');assert.equal(mark.primitive.width,.65);assert.equal(mark.paint.color,'#000000');assert.ok(Math.abs(mark.box.x1-mark.box.x0-4.6)<1e-8);assert.ok(Math.abs((mark.box.x0+mark.box.x1)/2-n.x)<1e-8);assert.ok(Math.abs(mark.box.y0-glyph.box.y1-.55)<1e-8);}
  }
  for(let bar=l.geometry.firstBar!;bar<geo.systemBarStarts![l.index+1];bar++){seenBars.push(bar+1);
   const ts=[...l.columns.keys()].filter(t=>t>=p.score.sourceBarTicks![bar]&&t<p.score.sourceBarTicks![bar+1]).sort((a,b)=>a-b);
   const scales=ts.slice(1).map((t,i)=>(l.columns.get(t)!-l.columns.get(ts[i])!)/(t-ts[i]));assert.ok(scales.every(s=>Math.abs(s-scales[0])<1e-8),`bar${bar+1} has uniform timing`);
  }
  for(const r of l.repeatSigns??[])if(r.type==='repeat-start'){const first=repeatFirstAttackEnvelope(l,r.tick,p.options,p.tokens)!;assert.ok(first.x0-r.x1>=repeatLeadingAir(p.tokens)-.001);}
 }
 assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(marks,125);assert.ok(ones>0&&bs>0);assert.deepEqual(seenBars,Array.from({length:64},(_,i)=>i+1));
 const rests=layouts.flatMap(l=>l.rests);assert.deepEqual(rests.map(r=>[r.hand,r.tick,r.durationTicks,r.value]),[['RH',9072,144,'whole'],['LH',9096,24,'eighth'],['LH',9120,24,'eighth'],['LH',9144,48,'quarter'],['LH',9192,24,'eighth']]);
 assert.ok(rests.every(r=>r.authored===true&&r.sourceOrigin?.startsWith('14-Petite-etude.ly:')));
 const slurs=layouts.flatMap(l=>l.expressions?.filter(q=>q.kind==='phrase')??[]);assert.equal(slurs.length,64);
 const sides=Object.fromEntries([40,41,43,51,52,53,56,59].map(bar=>[bar,slurs.find(q=>q.startTick===p.score.sourceBarTicks![bar-1])!.contour!.side]));
 assert.deepEqual(sides,{40:-1,41:-1,43:-1,51:-1,52:-1,53:-1,56:1,59:-1});
 const aliases=layouts.flatMap(l=>l.unisonMerges).filter(q=>q.tick>=p.score.sourceBarTicks![47]&&q.tick<p.score.sourceBarTicks![48]);assert.equal(aliases.length,2);
 const final=layouts.at(-1)!.notes.at(-1)!.note;assert.equal(final.readingDisplay!.pitchClass,0);assert.equal(final.readingDisplay!.referencePitch,31);assert.equal(final.readingDisplay!.isAnchor,false);
 const pages=[0,1,2].map(i=>renderJankoPage(p.score,i,p.options,p.tokens,layouts)),svg=pages.join('');
 assert.equal((svg.match(/class="janko-rest-group"/g)??[]).length,5);assert.equal((svg.match(/class="janko-repeat-dot"/g)??[]).length,4);
 assert.doesNotMatch(svg,/class="janko-dynamic"|aria-label="\(p\)"|gesture-relative reading|Study ·/);assert.match(pages[0],/Album für die Jugend · Op\. 68/);assert.match(pages[0],/No\. 14 · Kleine Studie/);
 assert.ok(slurs.every(q=>q.svg.includes('data-bow="optical-open"')));assert.equal(layouts.flatMap(l=>l.expressions?.filter(q=>q.kind!=='phrase')??[]).length,p.score.dynamics.length+pedalIntervals(p.score).length);
 console.log(JSON.stringify({layoutMs,auditMs,pages:3,systems:11,heads,owners:owners.size,marks,rests:rests.map(r=>[r.hand,r.tick,r.durationTicks,r.value]),sides,violations:report.violations,warnings:report.warnings}));
});
