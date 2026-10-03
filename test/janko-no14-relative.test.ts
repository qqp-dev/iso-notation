import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {no14RelativeProfile,recoverRelativePitch,NO14_RELATIVE_SCORE_ID} from '../src/render/janko/no14-relative';
import {no14GoldProfile,no14GoldStudioSvg,NO14_GOLD_IDENTITY} from '../src/render/janko/no14-gold';
import {layoutJankoScore,renderJankoPage,systemCompleteInkBounds,systemPaintedInkBoxes} from '../src/render/janko/engine';
import {checkReadingReferenceIntegrity,lintJankoScore,type LintViolation} from '../src/render/janko/linter';
import {resolveBeatPulses} from '../src/render/janko/elements/barlines';
import {resolveJankoOptions} from '../src/render/janko/types';
import {signedDuodecimalSpan,READING_REFERENCE_AIR} from '../src/render/janko/reading-reference';
import {createStudioConfig,renderCandidatesView} from '../src/render/janko/studio';
import {NO14_RELATIVE_PROTOTYPE_CANDIDATES as CURRENT_CANDIDATES,ROUND_60_CANDIDATES,getCandidate} from '../src/render/janko/candidates';
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const relative=no14RelativeProfile(),accepted=no14GoldProfile();
let settled:ReturnType<typeof layoutJankoScore>|undefined;
const layouts=()=>settled??=layoutJankoScore(relative.score,relative.options,relative.tokens);
const linear=(n:{pitch:{octave:number;pitchClass:number}})=>12*n.pitch.octave+n.pitch.pitchClass;

test('relative model recovers every exact source obligation without modifying its source profile',()=>{
  const before=JSON.stringify(accepted),e=no14RelativeProfile();
  assert.equal(e.score.notes.length,383);assert.equal(e.score.relativePresentation?.anchors.length,64);
  e.score.notes.forEach((n,i)=>{
    const original=accepted.score.notes[i];assert.equal(recoverRelativePitch(e.score,n.id),linear(original));
    const {pitch,...obligation}=n,{pitch:sourcePitch,...sourceObligation}=original;
    assert.deepEqual(obligation,sourceObligation);assert.ok(pitch.pitchClass>=0&&pitch.pitchClass<12);
  });
  for(const key of ['ticksPerBeat','totalTicks','sourceBarTicks','timeSignatures','barlines','tempos','dynamics','pedals','phrases','sourceSilences','graceGroups','tieChains','writtenPresentation'] as const)
    assert.deepEqual(e.score[key],accepted.score[key],key);
  assert.equal(JSON.stringify(no14GoldProfile()),before,'accepted builder remains exact after projection');
  assert.equal(e.options.dynamicFamily,'libre-bodoni-italic');assert.equal(e.options.sharedHeadTerminal,accepted.options.sharedHeadTerminal);
});

test('twelve relative symbols preserve octave placement and transposed pattern identity',()=>{
  const e=relative,notes=(bar:number)=>e.score.notes.filter(n=>e.score.relativePresentation!.notes[n.id].bar===bar);
  assert.deepEqual(notes(1).map(n=>n.pitch.pitchClass),[0,4,7,4,0,7]);
  assert.deepEqual(notes(2).map(n=>n.pitch.pitchClass),[0,5,9,5,0,9]);
  assert.deepEqual(notes(7).map(linear),notes(1).map(linear));
  assert.deepEqual([...new Set(notes(12).map(n=>n.pitch.pitchClass))].sort((a,b)=>a-b),[0,3,6,9]);
  const a=layouts()[0].notes.filter(n=>n.note.startTick<144),b=layouts()[1].notes.filter(n=>n.note.startTick>=864&&n.note.startTick<1008);
  assert.deepEqual(a.map(n=>+(n.y-layouts()[0].geometry.middleCY).toFixed(5)),b.map(n=>+(n.y-layouts()[1].geometry.middleCY).toFixed(5)));
  const zeros=a.filter(n=>n.note.pitch.pitchClass===0);assert.equal(zeros.length,2);
  assert.equal(linear(zeros[1].note)-linear(zeros[0].note),12);assert.ok(zeros[1].y<zeros[0].y,'higher octave remains spatially higher');
});

test('compound pulse uses72 ticks while all quarter-value arithmetic remains48',()=>{
  const e=relative,l=layouts()[0];assert.equal(e.tokens.ticksPerBeat,48);assert.equal(e.score.ticksPerBeat,48);
  assert.deepEqual(resolveBeatPulses(l.geometry,0,e.options,e.tokens,l.columns).map(p=>p.tick),[72,216,360,504]);
  const old=resolveJankoOptions({...e.options,beatPulseTicks:undefined});
  assert.deepEqual(resolveBeatPulses(l.geometry,0,old,e.tokens,l.columns).map(p=>p.tick),[48,96,192,240,336,384,480,528]);
  assert.throws(()=>resolveBeatPulses(l.geometry,0,resolveJankoOptions({...e.options,beatPulseTicks:0}),e.tokens,l.columns));
  assert.equal(signedDuodecimalSpan(12),'+10');assert.equal(signedDuodecimalSpan(-11),'−B');
});

test('first-page reset outlines clear all settled ink and retain all16 expected labels',()=>{
  const e=relative,ls=layouts(),page=ls.filter(l=>l.geometry.pageIndex===0);assert.equal(page.length,4);
  assert.equal(page.reduce((n,l)=>n+l.notes.length,0),96);
  assert.deepEqual(page.flatMap(l=>l.readingReferences!.map(m=>m.bar)),Array.from({length:16},(_,i)=>i+1));
  assert.deepEqual(page.flatMap(l=>l.readingReferences!.map(m=>m.label)),['7/3','=','=','=','=','+4','+1','−1','−2','−2','−1','+2','+1','−9','+2','=']);
  for(const l of page){
    const out:LintViolation[]=[];checkReadingReferenceIntegrity(e.score,l,e.options,e.tokens,out);assert.deepEqual(out,[]);
    const bare={...l,readingReferences:undefined,readingReferenceBand:undefined};const boxes=systemPaintedInkBoxes(bare,e.options,e.tokens);
    const top=Math.min(systemCompleteInkBounds(bare,e.options,e.tokens).top,...boxes.map(b=>b.y0));
    for(const m of l.readingReferences!){assert.ok(m.y1<=top-READING_REFERENCE_AIR+.02);assert.match(m.svg,/<path/);assert.doesNotMatch(m.svg,/<text|<image/);}
  }
  const report=lintJankoScore(e.score,e.options,e.tokens,undefined,ls);assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
});

test('two genuine first-page choices share identical music and historical cards remain addressable',()=>{
  const config=createStudioConfig({candidates:CURRENT_CANDIDATES});
  assert.equal(config.scores[NO14_RELATIVE_SCORE_ID].score.notes.length,383);
  const html=renderCandidatesView(config);assert.equal([...html.matchAll(/<svg\b/g)].length,2);
  assert.match(html,/data-window="schumann-op68-no14-relative-study:1-16" data-pages="1"/);
  assert.match(html,/data-page="1"/);assert.doesNotMatch(html,/data-page="2"/);
  assert.equal([...html.matchAll(/class="janko-reading-reference"/g)].length,32);
  const svg=renderJankoPage(relative.score,0,relative.options,relative.tokens,layouts());
  assert.match(svg,/viewBox="0.00 0.00 595.28 841.89"/);assert.match(svg,/id="system-4"/);assert.doesNotMatch(svg,/id="system-5"/);
  for(const candidate of ROUND_60_CANDIDATES)assert.equal(getCandidate(candidate.id),candidate);
  const absolute=resolveJankoOptions({...relative.options,readingReferenceMode:'absolute'});
  const absLayouts=layoutJankoScore(relative.score,absolute,relative.tokens);
  const absSvg=renderJankoPage(relative.score,0,absolute,relative.tokens,absLayouts);
  const body=(s:string)=>s.replace(/<g class="janko-reading-reference"[^>]*>[\s\S]*?<\/g>/g,'');
  assert.equal(body(absSvg),body(svg),'changing reset language must not change musical body');
  assert.deepEqual(absLayouts.slice(0,4).flatMap(l=>l.readingReferences!.map(m=>m.label)),['7/3','7/3','7/3','7/3','7/3','B/3','0/4','B/3','9/3','7/3','6/3','8/3','9/3','0/3','2/3','2/3']);
  const invalid={...CURRENT_CANDIDATES[0],windows:CURRENT_CANDIDATES[0].windows!.map(w=>({...w,pageIndices:[100]}))};
  assert.throws(()=>renderCandidatesView(createStudioConfig({candidates:[invalid]})),/Invalid genuine page selection/);
});

test('historical absolute GOLD page vectors and current published PDF retain their declared pins',()=>{
  const e=no14GoldProfile(),ls=layoutJankoScore(e.score,e.options,e.tokens);
  assert.deepEqual([0,1,2,3].map(page=>hash(no14GoldStudioSvg(renderJankoPage(e.score,page,e.options,e.tokens,ls)))),NO14_GOLD_IDENTITY.pageSvgSha256);
  const manifest=JSON.parse(readFileSync(new URL('../public/schumann-op68-no14-gold.pdf.manifest.json',import.meta.url),'utf8'));
  assert.equal(hash(readFileSync(new URL('../public/schumann-op68-no14-gold.pdf',import.meta.url))),manifest.pdfSha256);
});
