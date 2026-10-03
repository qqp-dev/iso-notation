import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14GestureCenteredProfile,no14GestureCondensedProfile,NO14_GESTURE_CONDENSED_ID} from '../src/render/janko/no14-gesture-relative';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {planProductionLayout} from '../src/render/janko/production-layout';
import {getScaledKnockoutMetrics,JANKO_HALO_STROKE_WIDTH} from '../src/render/janko/elements/notehead';
import {layoutJankoScore,renderJankoPage,computePageGeometry,systemCompleteInkBounds} from '../src/render/janko/engine';
import {pageBodyBounds} from '../src/render/janko/page-booking';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {lintJankoScore} from '../src/render/janko/linter';
import {repeatFirstAttackEnvelope,repeatLeadingAir} from '../src/render/janko/repeat-signs';
import {importSchumann} from '../src/scores/schumann-no43';

test('condensation changes only candidate admission and system cap, retaining all literal source and reading contexts',()=>{
  const p=no14GestureCondensedProfile(),old=no14GestureCenteredProfile(),gold=no14GoldProfile();
  assert.equal(p.score.id,NO14_GESTURE_CONDENSED_ID);assert.equal(p.score.productionLayout,true);
  const {productionWidthPolicy,measuresPerSystem,...unchanged}=p.options;
  assert.equal(productionWidthPolicy,'protected-heads');assert.equal(measuresPerSystem,6);
  const {measuresPerSystem:oldCap,...oldOptions}=old.options;assert.equal(oldCap,4);assert.deepEqual(unchanged,oldOptions);
  assert.deepEqual(p.tokens,old.tokens);assert.deepEqual(p.score.notes,old.score.notes);
  assert.deepEqual(p.score.readingPresentation,old.score.readingPresentation);
  for(const field of ['sourceBarTicks','writtenPresentation','barlines','phrases','pedals','dynamics','performingInstruction','publicationNotices'] as const)assert.deepEqual(p.score[field],old.score[field]);
  assert.equal(p.score.notes.length,383);assert.equal(p.score.writtenPresentation!.events.notes!.length,574);
  assert.equal(p.score.readingPresentation!.anchors.length,125);assert.equal(p.score.readingPresentation!.groups!.length,125);
  assert.equal(p.score.notes.at(-1)!.readingDisplay!.pitchClass,0);assert.equal(p.score.notes.at(-1)!.readingDisplay!.referencePitch,31);
  assert.equal(gold.options.productionWidthPolicy,undefined);assert.equal(old.options.productionWidthPolicy,undefined);
  assert.equal(planProductionLayout(old.score,old.options,old.tokens)!.systems.length,16);
});

test('protected width uses painter metrics and retains conservative chord, expanded-mark, halo and literal grace/tie/fold reserves',()=>{
  const p=no14GestureCondensedProfile(),plan=planProductionLayout(p.score,p.options,p.tokens)!;
  const protectedWidth=2*getScaledKnockoutMetrics(p.options,p.tokens).wx;
  assert.ok(Math.abs(protectedWidth-5.06)<1e-8);
  assert.ok(Math.abs(plan.systems[0].minimums[0]-(6+6+12+6*(protectedWidth+4.2)))<1e-8);
  const old=planProductionLayout(p.score,{...p.options,productionWidthPolicy:undefined},p.tokens)!;
  assert.equal(old.systems.length,13);assert.ok(Math.abs(old.systems[0].minimums[0]-106.8)<1e-8);
  const expanded=planProductionLayout(p.score,{...p.options,readingAnchorMark:'brackets'},p.tokens)!;
  assert.ok(Math.abs(expanded.systems[0].minimums[0]-old.systems[0].minimums[0])<1e-8);
  const halo=planProductionLayout(p.score,{...p.options,showHonorHalo:true},p.tokens)!;
  assert.ok(Math.abs(halo.systems[0].minimums[0]-(24+6*(2*p.tokens.haloRadius+JANKO_HALO_STROKE_WIDTH+4.2)))<1e-8);
  const changed=planProductionLayout(p.score,p.options,{...p.tokens,knockoutMargin:1.7})!;
  assert.ok(changed.systems[0].minimums[0]>plan.systems[0].minimums[0]);
  const shared=plan.systems.find(s=>s.firstBar<=47&&s.lastBar>47)!;
  assert.ok(Math.abs(shared.minimums[47-shared.firstBar]-plan.systems[0].minimums[0]-2*(protectedWidth+2))<1e-8,'all simultaneous obligations keep conservative chord demand');
  const literal=importSchumann(String.raw`\score { \new Staff = "upper" { \relative c'' { \time 6/8 \grace { c16[ d16] } e8~ e8 c8 d8 e8 c8 | } } }`,{file:'protected-admission.ly',hash:'',number:13}).score;
  const compact=planProductionLayout(literal,p.options,p.tokens)!,generic=planProductionLayout(literal,{...p.options,productionWidthPolicy:undefined},p.tokens)!;
  assert.ok(literal.graceGroups?.length);assert.deepEqual(compact.systems[0].leftInsets,generic.systems[0].leftInsets);
  assert.ok(compact.systems[0].leftInsets[0]>6,'opening grace retains its own pre-host allocation');
  const clean=structuredClone(p.score);clean.tieChains=[{noteId:clean.notes[0].id,soundingTicks:48,voice:'admission-fixture',components:[{startTick:0,durationTicks:24,tieForward:true,tieWait:false,voice:'admission-fixture'},{startTick:24,durationTicks:24,tieForward:false,tieWait:false,voice:'admission-fixture'}]}];
  assert.ok(Math.abs(planProductionLayout(clean,p.options,p.tokens)!.systems[0].minimums[0]-plan.systems[0].minimums[0]-1)<1e-8,'written tie continuation reserve');
  clean.tieChains=undefined;clean.notes[0].pitch={...clean.notes[0].pitch,octave:7};
  assert.ok(Math.abs(planProductionLayout(clean,p.options,p.tokens)!.systems[0].minimums[0]-plan.systems[0].minimums[0]-14)<1e-8,'fold marker reserve');
  assert.throws(()=>planProductionLayout(p.score,{...p.options,pageWidth:70},p.tokens),/Unmet production width/,'unsupported width fails admission');
});

test('eleven complete systems retain source owners, equal within-bar timing, shared durations and protected furniture across three pages',()=>{
  const p=no14GestureCondensedProfile(),start=performance.now(),layouts=layoutJankoScore(p.score,p.options,p.tokens),layoutMs=performance.now()-start;
  const auditStart=performance.now(),report=lintJankoScore(p.score,p.options,p.tokens,undefined,layouts),auditMs=performance.now()-auditStart;
  assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
  assert.equal(layouts.length,11);assert.deepEqual([...new Set(layouts.map(l=>l.geometry.pageIndex))],[0,1,2]);
  const geometry=computePageGeometry(p.options,p.tokens,p.score),plan=geometry.productionSystems!;
  assert.deepEqual(geometry.systemBarStarts,[0,6,12,18,24,30,36,42,48,54,60,64]);
  const owners=new Set<string>(),bars:number[]=[],gapByBar:Record<number,number>={};let heads=0,marks=0;
  for(const l of layouts){
    const first=l.geometry.firstBar!,last=geometry.systemBarStarts![l.index+1];assert.ok(last-first<=6);
    const minimum=plan[l.index];assert.ok(minimum.widths.every((w,i)=>w>=minimum.minimums[i]));
    const ink=systemCompleteInkBounds(l,p.options,p.tokens),body=pageBodyBounds(geometry,l.geometry.pageIndex!);
    assert.ok(ink.top>=body.top-1e-6);assert.ok(ink.bottom<=body.bottom+1e-6);
    const scene=buildInkScene(l,p.options,p.tokens,p.score);
    for(const pieces of scene.heads.values()){heads++;pieces[0].ownerIds.forEach(id=>{assert.ok(!owners.has(id));owners.add(id);});
      const mark=pieces.find(p=>p.paint.cls==='janko-reading-anchor-underline');
      if(mark){marks++;assert.equal(mark.primitive.kind,'stroke');if(mark.primitive.kind!=='stroke')throw Error('actual underline');assert.equal(mark.primitive.width,.65);assert.ok(Math.abs(mark.box.x1-mark.box.x0-4)<1e-8);assert.equal(mark.paint.color,'#000000');}
      const mask=pieces.find(p=>p.primitive.kind==='erase')!;assert.ok(Math.abs(mask.box.x1-mask.box.x0-5.06)<1e-8);
    }
    for(let bar=first;bar<last;bar++){bars.push(bar+1);
      const ticks=[...l.columns.keys()].filter(t=>t>=p.score.sourceBarTicks![bar]&&t<p.score.sourceBarTicks![bar+1]).sort((a,b)=>a-b);
      const gaps=ticks.slice(1).map((t,i)=>(l.columns.get(t)!-l.columns.get(ticks[i])!)/(t-ticks[i]));
      if(gaps.length){assert.ok(gaps.every(g=>Math.abs(g-gaps[0])<1e-8),`bar${bar+1}: one consistent temporal scale`);gapByBar[bar+1]=gaps[0]*24;}
      for(const n of l.notes.filter(n=>n.note.startTick>=p.score.sourceBarTicks![bar]&&n.note.startTick<p.score.sourceBarTicks![bar+1]))assert.ok(Math.abs(n.x-l.columns.get(n.note.startTick)!)<1e-8,'successive placement retains onset column');
    }
    for(const repeat of l.repeatSigns??[])if(repeat.type==='repeat-start'){
      const firstAttack=repeatFirstAttackEnvelope(l,repeat.tick,p.options,p.tokens)!;
      assert.ok(firstAttack.x0-repeat.x1>=repeatLeadingAir(p.tokens)-.001);
    }
  }
  assert.equal(heads,381);assert.equal(owners.size,383);assert.equal(marks,125);assert.deepEqual(bars,Array.from({length:64},(_,i)=>i+1));
  assert.ok(Math.abs(gapByBar[1]-13.0966666666667)<1e-8);assert.ok(gapByBar[1]<20.645);
  const shared=layouts.find(l=>l.geometry.firstBar!<=47&&geometry.systemBarStarts![l.index+1]>47)!;
  assert.equal(shared.unisonMerges.filter(m=>m.tick>=p.score.sourceBarTicks![47]&&m.tick<p.score.sourceBarTicks![48]).length,2);
  assert.equal(shared.expressions!.filter(e=>e.kind==='phrase').length,p.score.phrases!.filter(e=>e.startTick>=p.score.sourceBarTicks![42]&&e.startTick<p.score.sourceBarTicks![48]).length);
  assert.equal(layouts.flatMap(l=>l.expressions?.filter(e=>e.kind==='phrase')??[]).length,64);
  const pages=[0,1,2].map(i=>renderJankoPage(p.score,i,p.options,p.tokens,layouts));
  assert.deepEqual(pages.flatMap(svg=>[...svg.matchAll(/id="system-(\d+)"/g)].map(m=>Number(m[1]))),Array.from({length:11},(_,i)=>i+1));
  assert.match(pages[0],/Album für die Jugend · Op\. 68/);assert.ok(pages.slice(1).every(svg=>svg.includes('janko-running-head')));
  assert.equal((pages.join('').match(/class="janko-repeat-dot"/g)??[]).length,4);
  console.log(JSON.stringify({layoutMs,auditMs,pages:3,systems:11,heads,owners:owners.size,marks,firstBars:layouts.map(l=>l.geometry.firstBar!+1),gapByBar,violations:report.violations,warnings:report.warnings,phraseSides:layouts.flatMap(l=>l.expressions?.filter(e=>e.kind==='phrase').map(e=>e.contour?.side)??[])}));
});
