import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudioConfig,renderCandidatesView} from '../src/render/janko/studio';
import {NO14_JUDGMENT_CANDIDATES,NO14_JUDGMENT_ROUND,type JankoCandidate,isAbstractCandidateWindow} from '../src/render/janko/candidates';

test('native literal typography strip filters three profiles, shares framing and precedes score cards',()=>{
 const candidates=NO14_JUDGMENT_CANDIDATES.map(q=>{const w=q.windows!.find(w=>!isAbstractCandidateWindow(w))!;assert.ok(!isAbstractCandidateWindow(w));return {...q,comparisonScope:'containing-systems' as const,windows:[{scoreId:w.scoreId,measureStart:1,measureCount:1,title:'Actual opening'}]};});
 const config=createStudioConfig({candidates,round:NO14_JUDGMENT_ROUND});
 const html=renderCandidatesView(config),strips=[...html.matchAll(/<div class="compare-strip[^>]*>[\s\S]*?(?=<div class="compare-strip|<div class="candidate-grid)/g)].map(m=>m[0]);
 assert.equal(NO14_JUDGMENT_CANDIDATES.length,3);assert.ok(strips.length>=1);
 const first=strips[0],panels=[...first.matchAll(/<figure class="strip-panel"[\s\S]*?<\/figure>/g)].map(m=>m[0]);assert.equal(panels.length,3);
 const viewBoxes=panels.map(s=>s.match(/viewBox="([^"]+)"/)![1]);assert.equal(new Set(viewBoxes).size,1);
 assert.ok(html.indexOf('compare-strip-readable')<html.indexOf('class="candidate-grid"'));
 assert.ok(panels.every(s=>s.includes('janko-dynamic')&&s.includes('janko-pedal-start')));
 const width=Number(viewBoxes[0].split(' ')[2]);assert.ok(6.656*300/width>=12,'at a300px desktop panel the actual piano ink is readable');
 assert.equal(NO14_JUDGMENT_CANDIDATES.filter(q=>q.windows!.some(w=>!isAbstractCandidateWindow(w)&&w.measureStart===14)).length,1,'geometry contexts are shared rather than triplicated');
 assert.ok(NO14_JUDGMENT_CANDIDATES.every(q=>q.windows!.some(w=>!isAbstractCandidateWindow(w)&&w.fullScore&&w.collapsed)));
});

test('collapsed complete scores retain genuine native page cards and accessible summary',()=>{
 const candidate:JankoCandidate={id:'compact-bach-control',label:'Actual Bach score',description:'Native complete-page control',windows:[{scoreId:'primary',measureStart:1,measureCount:32,fullScore:true,collapsed:true,title:'Actual complete Bach score'}]};
 const html=renderCandidatesView(createStudioConfig({candidates:[candidate],round:{round:66,title:'Complete score',description:'Actual pages'}}));
 assert.ok(html.includes('<details class="score-pages"><summary>Complete score · 2 pages</summary>'));assert.ok(!html.includes('<details class="score-pages" open'));
 assert.deepEqual([...html.matchAll(/class="page-card" data-page="(\d+)"/g)].map(m=>Number(m[1])),[1,2]);
});
