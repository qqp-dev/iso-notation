import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {expressionIntersectsBox,expressionSliceAtX,type ExpressionInk,type ExpressionPlacement} from '../src/render/janko/elements/expressions';
import {expressionIntersectsBox as referenceBox,expressionSliceAtX as referenceSlice} from './support/expression-query-reference';
import {opticalPhraseCandidates} from '../src/render/janko/optical-phrases';
import {projectNo14Written,NO14_WRITTEN_SCORE_ID} from '../src/render/janko/no14-written';
import {no14OpticalProfile} from '../src/render/janko/no14-practice';
import {hasMatchingScoreLayouts,layoutJankoScore,countJankoPages,renderJankoPage,setLayoutJankoScoreObserver} from '../src/render/janko/engine';
import {lintJankoScore} from '../src/render/janko/linter';
import {createStudioConfig,renderCandidatesView} from '../src/render/janko/studio';
import {NO14_OPTICAL_PEDAL_CANDIDATES,NO14_OPTICAL_PEDAL_ROUND} from '../src/render/janko/candidates';
import type {OpticalPhraseDomain} from '../src/render/janko/optical-phrase-domain';

const sha=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('prepared ribbon queries exactly preserve independent reference truth at boundaries and after every scalar mutation',()=>{
 let seed=7391;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let trial=0;trial<32;trial++){
  const c:NonNullable<ExpressionInk['contour']>={xStart:random()*40-20,xEnd:100+random()*40,yStart:random()*50,yEnd:random()*80-40,side:trial%2?1:-1,depth:3+random()*20,thickness:.22+random(),indent:18+random()*5,...(trial%3?{startIndent:20+random()*6,endIndent:15+random()*8,startDepth:8+random()*5,endDepth:7+random()*10}:{}),...(trial%4?{chordAligned:true}:{}),...(trial%5?{tipThickness:.22}: {})};
  const q:ExpressionInk={kind:'phrase',id:'probe',x0:-1000,x1:1000,y0:-1000,y1:1000,startTick:0,endTick:100,continuationStart:false,continuationEnd:false,svg:'',contour:c};
  for(let i=0;i<129;i++){
   const x=c.xStart+(c.xEnd-c.xStart)*i/128;
   assert.deepEqual(expressionSliceAtX(q,x),referenceSlice(q,x));
   const s=referenceSlice(q,x)??[c.yStart,c.yStart];
   for(const b of [{x0:x-.3,x1:x+.3,y0:s[0]-.03,y1:s[1]+.03},{x0:x-.2,x1:x+.2,y0:s[1],y1:s[1]+1},{x0:x-.2,x1:x+.2,y0:s[0]-1,y1:s[0]},{x0:random()*160-20,x1:0,y0:random()*100-30,y1:0}]){
    if(b.x1===0){b.x1=b.x0+random()*15;b.y1=b.y0+random()*8;}
    assert.equal(expressionIntersectsBox(q,b),referenceBox(q,b),JSON.stringify({c,b}));
   }
  }
  for(const key of ['xStart','xEnd','yStart','yEnd','side','depth','thickness','indent','startIndent','endIndent','startDepth','endDepth','chordAligned','tipThickness'] as const){
   const before=c[key];
   const mutate=c as unknown as Record<string,number|boolean|undefined>;
   mutate[key]=key==='side'?-c.side:key==='chordAligned'?!before:before===undefined?5:Number(before)+1.25;
   for(let i=0;i<12;i++){
    const x=c.xStart+(c.xEnd-c.xStart)*(i+.5)/12,s=referenceSlice(q,x)!;
    const b={x0:x-.1,x1:x+.1,y0:s[0]-.05,y1:s[1]+.05};
    assert.equal(expressionIntersectsBox(q,b),referenceBox(q,b));
    assert.deepEqual(expressionSliceAtX(q,x),referenceSlice(q,x));
    // A second independent contour and a cloned object cannot inherit scratch
    // state or prepared points from the preceding query.
    const other:ExpressionInk={...q,contour:{...c,yStart:c.yStart+13,yEnd:c.yEnd+13}};
    assert.equal(expressionIntersectsBox(other,b),referenceBox(other,b));
    assert.equal(expressionIntersectsBox(q,b),referenceBox(q,b));
   }
   mutate[key]=before;
  }
 }
});

test('literal first-system optical pools retain exact count, order, costs, contours and final SVG',()=>{
 const fixture=JSON.parse(readFileSync(new URL('./support/no14-optical-pool-reference.json',import.meta.url),'utf8')) as {obstacles:NonNullable<ExpressionPlacement['obstacles']>;pools:{base:ExpressionInk;domain:OpticalPhraseDomain;count:number;sha256:string}[]};
 for(const row of fixture.pools){
  const p:ExpressionPlacement={start:0,end:576,left:0,right:600,top:0,bottom:500,x:x=>x,endpointX:(_ids,x)=>x,obstacles:fixture.obstacles,opticalDomain:()=>row.domain};
  const pool=opticalPhraseCandidates(row.base,p);
  assert.equal(pool.length,row.count);assert.equal(sha(pool),row.sha256,row.base.id);
 }
});

const withoutTime=(r:ReturnType<typeof lintJankoScore>)=>({...r,stats:{...r.stats,durationMs:0}});
test('complete layout reuse preserves all diagnostics/pages and invalidates exact source/profile/array dependencies',()=>{
 const score=projectNo14Written().score,e=no14OpticalProfile(),options={...e.options},tokens={...e.tokens},layouts=layoutJankoScore(score,options,tokens);
 assert.ok(hasMatchingScoreLayouts(layouts,score,options,tokens));
 const before=JSON.stringify(layouts),cached=lintJankoScore(score,options,tokens,undefined,layouts),fresh=lintJankoScore(score,options,tokens);
 assert.deepEqual(withoutTime(cached),withoutTime(fresh));assert.equal(cached.violations.length,0);assert.equal(cached.warnings.length,0);
 assert.equal(JSON.stringify(layouts),before,'lint must not mutate the geometry subsequently painted');
 assert.equal(countJankoPages(score,options,tokens,layouts),4);
 for(let page=0;page<4;page++)assert.match(renderJankoPage(score,page,options,tokens,layouts),new RegExp(`Page ${page+1} of 4`));
 assert.ok(!hasMatchingScoreLayouts([...layouts],score,options,tokens),'unbound arrays are not a freshness proof');
 assert.ok(!hasMatchingScoreLayouts(layouts,structuredClone(score),options,tokens));
 const model=score.notes[0].pitch.octave;score.notes[0].pitch.octave+=1;assert.ok(!hasMatchingScoreLayouts(layouts,score,options,tokens));score.notes[0].pitch.octave=model;
 options.interStaffGap+=1;assert.ok(!hasMatchingScoreLayouts(layouts,score,options,tokens));options.interStaffGap-=1;
 tokens.stemLength+=1;assert.ok(!hasMatchingScoreLayouts(layouts,score,options,tokens));tokens.stemLength-=1;
 const last=layouts.pop()!;assert.ok(!hasMatchingScoreLayouts(layouts,score,options,tokens));layouts.push(last);
 assert.ok(hasMatchingScoreLayouts(layouts,score,options,tokens));
 let solves=0;setLayoutJankoScoreObserver(()=>solves++);
 try{
  lintJankoScore(score,options,tokens,undefined,layouts);countJankoPages(score,options,tokens,layouts);assert.equal(solves,0);
  countJankoPages(score,{...options,interStaffGap:options.interStaffGap+1},tokens,layouts);assert.equal(solves,1,'wrong profile must settle its own layout');
 }finally{setLayoutJankoScoreObserver(null);}
 const curve=layouts[0].expressions!.find(q=>q.kind==='phrase')!;curve.contour!.yStart+=500;
 assert.ok(hasMatchingScoreLayouts(layouts,score,options,tokens),'deliberate geometry defects remain subject to the full audit');
 assert.ok(lintJankoScore(score,options,tokens,undefined,layouts).violations.some(v=>v.code==='expression-local-attachment'),'shared lint must not skip optical admission diagnostics');
});

test('candidate lint, genuine pages and crops share one complete solve while window-scoped comparisons stay separate',()=>{
 const candidate=NO14_OPTICAL_PEDAL_CANDIDATES[1],config=createStudioConfig({candidates:[candidate],round:NO14_OPTICAL_PEDAL_ROUND});
 let solves=0;setLayoutJankoScoreObserver(()=>solves++);
 try{const html=renderCandidatesView(config);assert.equal(solves,1);assert.equal((html.match(/class="page-card"/g)??[]).length,4);assert.match(html,/data-lint="clean"/);}
 finally{setLayoutJankoScoreObserver(null);}
 const scoped={...candidate,id:'scoped-probe',comparisonScope:'containing-systems' as const,windows:[{scoreId:NO14_WRITTEN_SCORE_ID,measureStart:1,measureCount:1,title:'Local context'}]};
 const scopedConfig=createStudioConfig({candidates:[scoped],round:{round:99,title:'Local test',description:'Local only'}});
 solves=0;setLayoutJankoScoreObserver(()=>solves++);
 try{const html=renderCandidatesView(scopedConfig);assert.equal(solves,0);assert.match(html,/window-scoped/);assert.doesNotMatch(html,/class="page-card"/);}
 finally{setLayoutJankoScoreObserver(null);}
});
