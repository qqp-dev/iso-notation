import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {no14RelativeBaselineProfile,recoverReadingPitch,NO14_RELATIVE_BASELINE_ID} from '../src/render/janko/no14-relative';
import {no14GoldProfile} from '../src/render/janko/no14-gold';
import {projectNo14Written} from '../src/render/janko/no14-written';
import {linearPitch,prepareAnchorProblem,solveAnchors} from '../src/render/janko/anchor-solver';
import {layoutJankoScore,renderJankoPage} from '../src/render/janko/engine';
import {buildInkScene,sceneHeadSvg} from '../src/render/janko/ink-scene';
import {lintJankoScore} from '../src/render/janko/linter';
import {ROUND_74_CANDIDATES as CURRENT_CANDIDATES,ROUND_60_CANDIDATES,getCandidate} from '../src/render/janko/candidates';
import {resolveBeatPulses} from '../src/render/janko/elements/barlines';
const source=no14GoldProfile(),baseline=no14RelativeBaselineProfile();
let settled:ReturnType<typeof layoutJankoScore>|undefined;
const layouts=()=>settled??=layoutJankoScore(baseline.score,baseline.options,baseline.tokens);

test('causal reading metadata preserves383 obligations and every574 performed occurrence',()=>{
 const e=baseline,anchors=e.score.readingPresentation!.anchors;
 assert.equal(e.score.notes.length,383);assert.equal(anchors.length,34);assert.equal(e.score.readingPresentation!.cost,41995);
 assert.equal(new Set(anchors.map(a=>a.bar)).size,anchors.length);
 assert.equal(anchors[0].tick,0);assert.equal(anchors.find(a=>a.bar===33)!.tick,4608);
 for(const [i,n] of e.score.notes.entries()){
   const {readingDisplay:d,...obligation}=n;assert.deepEqual(obligation,source.score.notes[i]);assert.ok(d);
   const active=anchors.filter(a=>a.tick<=n.startTick).at(-1)!;
   assert.equal(d.referencePitch,active.pitch);assert.equal(recoverReadingPitch(n),linearPitch(source.score.notes[i]));
   assert.equal(d.isAnchor,active.ownerIds.includes(n.id));assert.ok(d.pitchClass>=0&&d.pitchClass<12);
 }
 for(const key of ['ticksPerBeat','totalTicks','sourceBarTicks','timeSignatures','barlines','tempos','dynamics','pedals','phrases','sourceSilences','graceGroups','tieChains','writtenPresentation'] as const)
   assert.deepEqual(e.score[key],source.score[key],key);
 const {performed}=projectNo14Written(),events=e.score.writtenPresentation!.events.notes!;
 assert.equal(events.length,574);
 for(const event of events){
   const n=e.score.notes[event.writtenIndex],expected=performed.notes[event.performedIndex];
   assert.equal(recoverReadingPitch(n),linearPitch(expected));
   const {readingDisplay,...literal}=n;assert.deepEqual({...literal,...event.overrides},expected);
 }
 const b48=e.score.notes.filter(n=>n.startTick>=6768&&n.startTick<6912);
 assert.equal(b48.length,10);assert.equal(new Set(b48.map(n=>n.startTick)).size,6);
 assert.ok(b48.some((n,i)=>i&&n.startTick<b48[i-1].startTick),'source is voice ordered');
 const simultaneous=new Map<string,typeof b48>();
 for(const n of b48){const k=`${n.startTick}:${linearPitch(n)}`;simultaneous.set(k,[...(simultaneous.get(k)??[]),n]);}
 const pairs=[...simultaneous.values()].filter(ns=>ns.length===2);assert.equal(pairs.length,2);
 for(const [a,b] of pairs)assert.deepEqual(a.readingDisplay,b.readingDisplay);
 assert.equal(anchors.filter(a=>a.bar===48).length,1);
 assert.deepEqual(prepareAnchorProblem(e.score)[47].actions.filter(a=>a.ownerIds.length===2).map(a=>[...a.ownerIds].sort()).sort(),pairs.map(ns=>ns.map(n=>n.id).sort()).sort(),'shared played actions retain both owners independently of the selected anchor');
 assert.equal(JSON.stringify(no14GoldProfile()),JSON.stringify(source),'accepted profile remains exact');
});

test('complete real pages paint381 heads,383 owners and34 bounded actual anchors with zero lint',()=>{
 const start=performance.now(),ls=layouts();const layoutMs=performance.now()-start;
 const e=baseline,owners=new Set<string>();let headCount=0,anchorCount=0;
 const gold=layoutJankoScore(source.score,source.options,source.tokens);
 const literalYs=new Map(gold.flatMap(l=>l.notes.map(p=>[p.note.id,p.y-l.geometry.middleCY] as const)));
 for(const l of ls){
   assert.equal(l.readingReferences?.length??0,0);assert.equal(l.readingReferenceBand,undefined);
   const scene=buildInkScene(l,e.options,e.tokens,e.score);
   for(const [id,pieces] of scene.heads){
     headCount++;pieces[0].ownerIds.forEach(id=>owners.add(id));
     const p=l.notes.find(p=>p.note.id===id)!;
     assert.ok(Math.abs((p.y-l.geometry.middleCY)-literalYs.get(id)!)<1e-8,'source register geometry remains exact');
     const text=sceneHeadSvg(scene,id),d=p.note.readingDisplay!;
     assert.match(text,/class="janko-reading-head"/);assert.ok(text.includes(`data-active-reference="${d.referencePitch}"`));
     assert.ok(text.includes(`data-relative-octave="${d.relativeOctave}"`));
     const frames=pieces.filter(p=>p.paint.cls==='janko-reading-anchor-frame');
     assert.equal(frames.length,d.isAnchor?4:0);if(d.isAnchor)anchorCount++;
     for(const f of frames)assert.ok([f.box.x0,f.box.y0,f.box.x1,f.box.y1].every(Number.isFinite));
   }
 }
 assert.equal(headCount,381);assert.equal(owners.size,383);assert.equal(anchorCount,34);
 const pages=[...new Set(ls.map(l=>l.geometry.pageIndex))];assert.deepEqual(pages,[0,1,2,3]);
 let painted=0;
 for(const page of pages){const svg=renderJankoPage(e.score,page!,e.options,e.tokens,ls);painted+=[...svg.matchAll(/class="janko-reading-head"/g)].length;
   assert.match(svg,/viewBox="0.00 0.00 595.28 841.89"/);assert.doesNotMatch(svg,/janko-reading-reference/);}
 assert.equal(painted,381);
 const audit=performance.now(),report=lintJankoScore(e.score,e.options,e.tokens,undefined,ls);
 console.log(JSON.stringify({layoutMs,lintMs:performance.now()-audit,heads:headCount,owners:owners.size,anchors:anchorCount,pages:pages.length,violations:report.violations.length,warnings:report.warnings.length}));
 assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
 assert.equal(CURRENT_CANDIDATES.length,1);const window=CURRENT_CANDIDATES[0].windows?.[0];
 assert.ok(window&&'measureCount' in window);assert.equal(window.scoreId,NO14_RELATIVE_BASELINE_ID);
 assert.equal(window.measureCount,64);
 for(const candidate of ROUND_60_CANDIDATES)assert.equal(getCandidate(candidate.id),candidate);
 assert.deepEqual(resolveBeatPulses(ls[0].geometry,0,e.options,e.tokens,ls[0].columns).map(p=>p.tick),[72,216,360,504]);
 assert.equal(e.score.ticksPerBeat,48);assert.equal(e.tokens.ticksPerBeat,48);assert.equal(e.options.dynamicFamily,'libre-bodoni-italic');
});

test('solver-only runtime is separated from prepared source and layout work',()=>{
 const setup=performance.now(),bars=prepareAnchorProblem(source.score),setupMs=performance.now()-setup;
 const cold=performance.now(),solution=solveAnchors(bars),coldMs=performance.now()-cold;
 const samples=Array.from({length:21},()=>{const start=performance.now();assert.equal(solveAnchors(bars).cost,solution.cost);return performance.now()-start;}).sort((a,b)=>a-b);
 console.log(JSON.stringify({setupMs,coldMs,medianMs:samples[10],cost:solution.cost,anchors:solution.resets,visitedTransitions:solution.visitedTransitions}));
 assert.equal(solution.resets,34);assert.equal(solution.cost,41995);
});
