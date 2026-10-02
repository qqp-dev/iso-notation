import {test} from 'node:test';
import assert from 'node:assert/strict';
import {no14PracticeProfile,NO14_DOT_CONTROL_DELTA} from '../src/render/janko/no14-practice';
import {buildSchumannNo14Draft,schumannNo14WrittenFacts} from '../src/scores/schumann-no14-draft';
import {createStudioConfig} from '../src/render/janko/studio';
import {layoutJankoScore,renderJankoPage,countJankoPages,computePageGeometry} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {getStemGeometry} from '../src/render/janko/elements/rhythm';
import {checkExpressionIntegrity,checkSharedHeadTerminals,type LintViolation} from '../src/render/janko/linter';
import {expressionSliceAtX} from '../src/render/janko/elements/expressions';
import {preferredBowDepth} from '../src/render/janko/balanced-phrases';
const e=no14PracticeProfile(),old=buildSchumannNo14Draft(),layouts=layoutJankoScore(e.score,e.options,e.tokens);
const dots=layouts.flatMap(l=>[...buildInkScene(l,e.options,e.tokens,e.score).solos.values()].flat().filter(p=>p.shape.kind==='dot'));
test('No14 practice preserves all source events, voices, alternatives and clocks; nonnumeric source text survives',()=>{
 assert.deepEqual(e.score.notes,old.notes);assert.deepEqual(e.score.phrases,old.phrases);assert.deepEqual(e.score.pedals,old.pedals);assert.deepEqual(e.score.dynamics,old.dynamics);
 assert.equal(e.score.notes.length,574);assert.equal(e.score.totalTicks,13824);assert.equal(schumannNo14WrittenFacts.bars.length,64);assert.equal(schumannNo14WrittenFacts.occurrences.length,96);
 assert.deepEqual(e.score.tempos,[]);assert.equal(e.score.performingInstruction?.encodingText,'Léger et très égal');assert.equal(e.score.performingInstruction?.encodingLine,80);
 const page=renderJankoPage(e.score,0,e.options,e.tokens,layouts);assert.match(page,/Leise und sehr egal zu spielen\./);assert.match(page,/Schuberth &amp; Co/);assert.match(page,/Philippe Hardy/);assert.match(page,/Free Art License/);
 assert.ok(!renderJankoPage(e.score,1,e.options,e.tokens,layouts).includes('Leise und'),'opening direction does not become a repeated instruction');
 assert.equal(countJankoPages(e.score,e.options,e.tokens),6);
});
test('all8dotted-quarter statements paint once; sharedG/A retain longleft72 and distinctmoving24 owners',()=>{
 assert.equal(dots.length,8);assert.deepEqual(dots.flatMap(d=>d.ownerIds).sort(),e.score.notes.filter(n=>n.durationTicks===72).map(n=>n.id).sort());
 for(const occurrence of [48,80]){
  const tick=(occurrence-1)*144,l=layouts.find(l=>l.notes.some(n=>n.note.startTick===tick))!,scene=buildInkScene(l,e.options,e.tokens,e.score);
  const ownDots=[...scene.solos.values()].flat().filter(p=>p.shape.kind==='dot'&&p.sourceContributors.some(s=>e.score.notes.find(n=>n.id===s.id)!.startTick>=tick&&e.score.notes.find(n=>n.id===s.id)!.startTick<tick+144));
  assert.equal(ownDots.length,4);
  for(const m of l.unisonMerges.filter(m=>m.tick>=tick&&m.tick<tick+144)){
   const ns=[...l.notes,...l.unisonVoices].filter(n=>[m.survivorId,...m.mergedIds].includes(n.note.id)).sort((a,b)=>b.rhythm.durationTicks-a.rhythm.durationTicks);
   assert.deepEqual(ns.map(n=>n.rhythm.durationTicks),[72,24]);const long=getStemGeometry(ns[0].rhythm,e.tokens),short=getStemGeometry(ns[1].rhythm,e.tokens);
   assert.ok(long.stemX<short.stemX);assert.ok(Math.abs(short.stemX-long.stemX-2.6)<.001);
   const b=l.beams.find(b=>b.notes.some(n=>n.id===ns[1].note.id))!,carrier=b.beamY(short.stemX);
   assert.ok(long.stemEndY<carrier-5);const dot=scene.solos.get(ns[0].note.id)!.find(p=>p.shape.kind==='dot')!;
   assert.deepEqual(dot.ownerIds,[ns[0].note.id]);if(dot.shape.kind!=='dot')throw Error('dot');assert.ok(dot.shape.cy<carrier-e.tokens.beamThickness/2-e.tokens.augmentationDotRadius-e.tokens.augmentationDotGap);
  }
  const failures:LintViolation[]=[];checkSharedHeadTerminals(l,e.options,e.tokens,failures,scene);assert.deepEqual(failures,[]);
 }
 const current=createStudioConfig().scores['schumann-op68-no14'];
 const control=layoutJankoScore(current.score,{...current.options,...NO14_DOT_CONTROL_DELTA},current.tokens);
 assert.equal(control.flatMap(l=>[...buildInkScene(l,{...current.options,...NO14_DOT_CONTROL_DELTA},current.tokens,current.score).solos.values()].flat().filter(p=>p.shape.kind==='dot')).length,8);
});
test('everyNo14bow has coherent chordcontrols, positive curvature and actual gentlebody/tips; complete geometry is admitted',()=>{
 let curves=0;const geo=computePageGeometry(e.options,e.tokens,e.score);
 for(const l of layouts){
  const failures:LintViolation[]=[];checkExpressionIntegrity(e.score,l,e.options,e.tokens,failures);assert.deepEqual(failures,[]);
  for(const q of l.expressions!.filter(q=>q.kind==='phrase')){
   curves++;const c=q.contour!;assert.equal(c.chordAligned,true);assert.equal(c.thickness,.85);assert.equal(c.tipThickness,.22);
   const middle=expressionSliceAtX(q,(c.xStart+c.xEnd)/2)!;assert.ok(Math.abs(middle[1]-middle[0]-.85)<1e-8);
   const d=q.svg.match(/class="janko-phrase"[^>]*d="([^"]+)"/)![1],nums=d.match(/-?\d+\.\d+/g)!.map(Number),ps=[[nums[0],nums[1]],[nums[2],nums[3]],[nums[4],nums[5]],[nums[6],nums[7]]];
   let sign=0;for(let i=0;i<=128;i++){
    const u=i/128,v=1-u,dx=3*(v*v*(ps[1][0]-ps[0][0])+2*v*u*(ps[2][0]-ps[1][0])+u*u*(ps[3][0]-ps[2][0])),dy=3*(v*v*(ps[1][1]-ps[0][1])+2*v*u*(ps[2][1]-ps[1][1])+u*u*(ps[3][1]-ps[2][1]));
    const ddx=6*(v*(ps[2][0]-2*ps[1][0]+ps[0][0])+u*(ps[3][0]-2*ps[2][0]+ps[1][0])),ddy=6*(v*(ps[2][1]-2*ps[1][1]+ps[0][1])+u*(ps[3][1]-2*ps[2][1]+ps[1][1]));
    const now=Math.sign(dx*ddy-dy*ddx);assert.ok(dx>0);if(sign)assert.equal(now,sign,'no accidental inflection');sign=now;
   }
   assert.ok(q.y0>=geo.marginTop+geo.headerHeight-.01&&q.y1<=geo.pageHeight-geo.marginBottom-geo.footerHeight+.01);
  }
 }
 assert.equal(curves,96);assert.ok(preferredBowDepth(96,63)<preferredBowDepth(96,0),'steep gesture earns less preferred crown');
});
