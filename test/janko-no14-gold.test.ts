import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {no14GoldProfile,no14GoldOriginProfile,no14GoldPrePrintProfile,no14GoldPrePrintSvgAsAccepted,no14GoldStudioSvg,NO14_GOLD_ACCEPTANCE,NO14_GOLD_IDENTITY,NO14_GOLD_REFERENCE_ID,NO14_GOLD_NOTICE} from '../src/render/janko/no14-gold';
import {assertSystemSvgTranslation,systemSvgFragments} from './support/system-svg-translation';
import {pageBodyBounds,runningHeaderBand,RUNNING_HEAD_AIR} from '../src/render/janko/page-booking';
import {lintJankoScore} from '../src/render/janko/linter';
import {layoutJankoScore,renderJankoPage,computePageGeometry,systemCompleteInkBounds,setLayoutJankoScoreObserver} from '../src/render/janko/engine';
import {createStudioConfig,renderReferenceView} from '../src/render/janko/studio';
import {fingerprintPdf} from './support/pdf-fingerprint';
import oldReferenceHashes from './support/no14-old-reference-svg-hashes.json';
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');

test('GOLD preserves selected A music while declaring the operator-requested print changes',()=>{
 const origin=no14GoldOriginProfile(),e=no14GoldProfile();
 assert.equal(hash(JSON.stringify(origin.score)),NO14_GOLD_ACCEPTANCE.modelSha256);
 assert.equal(hash(JSON.stringify(origin)),NO14_GOLD_ACCEPTANCE.profileSha256);
 assert.equal(hash(JSON.stringify(e.score)),NO14_GOLD_IDENTITY.modelSha256);
 assert.equal(hash(JSON.stringify(e)),NO14_GOLD_IDENTITY.profileSha256);
 origin.score.publicationNotices![1]=NO14_GOLD_NOTICE;
 assert.deepEqual(no14GoldPrePrintProfile(),origin,'historical pre-print profile remains notice-only');
 origin.score.printIdentity!.scoreId=origin.score.id;origin.options.runningHeaderHeight=20;assert.deepEqual(e,origin);
 assert.equal(e.score.printIdentity!.work,'Album für die Jugend · Op. 68');assert.equal(e.score.printIdentity!.piece,'No. 14 · Kleine Studie');
 assert.equal(e.score.printIdentity!.composer,'Robert Schumann');
 assert.equal(e.score.notes.length,383);assert.equal(e.score.phrases?.length,64);assert.equal(e.score.notes.filter(n=>n.durationTicks===72).length,4);
 assert.equal(e.score.writtenPresentation?.performedBars,96);assert.equal(e.score.writtenPresentation?.events.notes?.length,574);
 const changed=no14GoldProfile();changed.options.dynamicFamily='leland';assert.notEqual(hash(JSON.stringify(changed)),NO14_GOLD_IDENTITY.profileSha256);
 assert.throws(()=>no14GoldPrePrintSvgAsAccepted('<svg>Missing notice</svg>',0));
 assert.throws(()=>no14GoldPrePrintSvgAsAccepted(`<svg>${NO14_GOLD_NOTICE.replaceAll('&','&amp;')}</svg>`,1));
});

test('Reference settles GOLD lazily once, preserves all11 prior SVGs and exposes accepted complete pages',()=>{
 const solves:string[]=[];setLayoutJankoScoreObserver(score=>solves.push(score.id??''));
 try{
  const config=createStudioConfig();const no14Id=config.scores[NO14_GOLD_REFERENCE_ID].score.id;
  assert.equal(solves.filter(id=>id===no14Id).length,0,'Candidates/config registration does not solve No14');solves.length=0;
  // Candidate-library mutation cannot masquerade as selected Reference ink.
  config.scores[NO14_GOLD_REFERENCE_ID].score.notes[0].pitch.pitchClass=0;
  const html=renderReferenceView(config);
  assert.equal(solves.filter(id=>id===no14Id).length,1,'audit/count/pages/crops share one settled layout');
  const svgs=[...html.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map(m=>m[0]);
  assert.equal(svgs.length,19);assert.deepEqual(svgs.slice(8).map(hash),oldReferenceHashes,'all prior canonical page/crop vectors remain exact');
  assert.deepEqual(svgs.slice(0,4).map(hash),NO14_GOLD_IDENTITY.pageSvgSha256);
  assert.match(svgs[0],/Album für die Jugend · Op\. 68/);assert.match(svgs[0],/No\. 14 · Kleine Studie/);
  for(const svg of svgs.slice(1,4)){assert.match(svg,/class="janko-running-head"/);assert.match(svg,/Album für die Jugend · Op\. 68/);assert.match(svg,/No\. 14 · Kleine Studie/);}
  const no14=html.slice(0,html.indexOf('data-score="brahms-op118-no1"'));
  assert.match(no14,/Robert Schumann/);assert.match(no14,/No\. 14 · Kleine Studie/);assert.doesNotMatch(no14,/Variatio 1|draft|Practice candidate/);
  assert.match(no14,/schumann-op68-no14-gold\.pdf" download/);assert.match(no14,/data-lint-ok="true"/);assert.match(no14,/0 violations, 0 warnings/);
  assert.deepEqual([...no14.matchAll(/data-page="(\d+)"/g)].map(m=>Number(m[1])),[1,2,3,4]);
 }finally{setLayoutJankoScoreObserver(null);}
});

test('compact running headers preserve page1 music and every later complete system under a rigid translation',()=>{
 const before=no14GoldPrePrintProfile(),after=no14GoldProfile();
 const a=layoutJankoScore(before.score,before.options,before.tokens),b=layoutJankoScore(after.score,after.options,after.tokens);
 const report=lintJankoScore(after.score,after.options,after.tokens,undefined,b);
 assert.deepEqual(report.violations,[]);assert.deepEqual(report.warnings,[]);
 assert.equal(a.length,16);assert.equal(b.length,16);
 const phrases=b.flatMap(l=>l.expressions?.filter(e=>e.kind==='phrase')??[]);
 assert.equal(phrases.length,64);assert.equal(phrases.filter(e=>e.contour?.side===-1).length,17);assert.equal(phrases.filter(e=>e.contour?.side===1).length,47);
 const page=computePageGeometry(after.options,after.tokens,after.score),header=runningHeaderBand(page);
 assert.equal(pageBodyBounds(page,0).headerHeight,66);assert.equal(pageBodyBounds(page,1).headerHeight,20);
 assert.equal(pageBodyBounds(page,1).height-pageBodyBounds(page,0).height,46);
 for(let p=0;p<4;p++){
  const old=renderJankoPage(before.score,p,before.options,before.tokens,a),final=renderJankoPage(after.score,p,after.options,after.tokens,b);
  assert.equal(hash(no14GoldPrePrintSvgAsAccepted(old,p)),NO14_GOLD_ACCEPTANCE.pageSvgSha256[p],'independent accepted-origin witness');
  assert.equal(hash(no14GoldStudioSvg(final)),NO14_GOLD_IDENTITY.pageSvgSha256[p]);
  const oldSystems=systemSvgFragments(old),newSystems=systemSvgFragments(final);assert.equal(oldSystems.length,4);assert.equal(newSystems.length,4);
  for(let s=0;s<4;s++){
   const i=p*4+s,dy=b[i].geometry.middleCY-a[i].geometry.middleCY;
   assert.equal(b[i].geometry.pageIndex,p);assert.equal(a[i].geometry.pageIndex,p);
   assert.ok(Math.abs(dy-(p===0?0:-46+(s+1)*46/5))<1e-8,'page-wide compact reservation, no system exception');
   if(p===0)assert.equal(newSystems[s],oldSystems[s],'title-page music remains byte-exact');
   assertSystemSvgTranslation(oldSystems[s],newSystems[s],dy,`page${p+1} system${s+1}`);
  }
  const first=systemCompleteInkBounds(b[p*4],after.options,after.tokens).top;
  assert.ok(first>=pageBodyBounds(page,p).top);
  if(p>0)assert.ok(first-header.bottom>RUNNING_HEAD_AIR,'complete music clears actual running-header band');
 }
 // This comparator itself must reject independent ink changes, including a
 // locally transformed glyph whose outlines must never be translated.
 const original=systemSvgFragments(renderJankoPage(after.score,0,after.options,after.tokens,b))[0];
 assert.throws(()=>assertSystemSvgTranslation(original,original.replace(/(<line[^>]*y1=")([\d.]+)/,(_,prefix,n)=>prefix+(Number(n)+1)),0,'mutated stem/grid'));
 assert.throws(()=>assertSystemSvgTranslation(original,original.replace('Robert Schumann','foreign')+'<path d="M 0 0 L 1 1"/>',0,'extra ink'));
});

test('published GOLD PDF is fresh, matches accepted page ink and has four complete vector pages with font/source notices',()=>{
 const publicPdf='public/schumann-op68-no14-gold.pdf',dir=mkdtempSync(join(tmpdir(),'no14-gold-freshness-'));
 try{
  const fresh=join(dir,'gold.pdf');execFileSync(process.execPath,['--import','tsx','scripts/export-no14-practice-pdf.ts','--profile','gold','--out',fresh],{stdio:'pipe'});
  const current=JSON.parse(readFileSync(publicPdf+'.manifest.json','utf8')),regenerated=JSON.parse(readFileSync(fresh+'.manifest.json','utf8'));
  assert.equal(current.pdfSha256,hash(readFileSync(publicPdf)));assert.equal(current.pages,4);assert.equal(current.notes,383);assert.equal(current.augmentationDots.length,4);
  assert.equal(current.modelSha256,NO14_GOLD_IDENTITY.modelSha256);assert.equal(current.profileSha256,NO14_GOLD_IDENTITY.profileSha256);
  assert.deepEqual(current.acceptedOrigin,NO14_GOLD_ACCEPTANCE);assert.deepEqual(current.acceptedPageSvgSha256,NO14_GOLD_ACCEPTANCE.pageSvgSha256);
  assert.deepEqual(current.studioPageSvgSha256,NO14_GOLD_IDENTITY.pageSvgSha256);
  assert.deepEqual(current.studioPageSvgSha256,regenerated.studioPageSvgSha256);assert.deepEqual(current.printChanges,NO14_GOLD_IDENTITY.printChanges);
  assert.deepEqual(current.pageSvgSha256,regenerated.pageSvgSha256);assert.deepEqual(current.performedMapping,regenerated.performedMapping);
  const fp=fingerprintPdf(publicPdf,'Album f'),freshFp=fingerprintPdf(fresh,'Album f');
  const {fonts:_publishedFonts,...publishedInk}=fp,{fonts:_freshFonts,...freshInk}=freshFp;
  // Only the environment-resolved names are excluded: text, every vector,
  // page dimensions, image count and96DPI scales remain exact cross-machine gates.
  assert.deepEqual(publishedInk,freshInk,'actual published content/geometry equals fresh selected export');
  assert.equal(fp.pages,4);assert.equal(fp.images,0);assert.ok(fp.vectorNumbers.every(n=>n>1000));assert.ok(fp.fonts.some(f=>f.includes('URWGothic-Demi')));
  assert.ok(fp.titleScales.some(n=>Math.abs(n-44/3)<.01));for(const size of fp.pageSizes)assert.equal(size,'595.28 x 841.89');
  for(const pdf of [publicPdf,fresh]){
   const fonts=execFileSync('pdffonts',[pdf],{encoding:'utf8'}).split('\n').slice(2).filter(Boolean);assert.ok(fonts.length>0&&fonts.every(line=>/yes\s+yes\s+yes/.test(line)),'all fonts embedded, subset andUnicode in each output');
   assert.ok(fingerprintPdf(pdf,'Kleine Studie').fonts.some(f=>f.includes('URWGothic-Demi')));
  }
  const text=execFileSync('pdftotext',[publicPdf,'-'],{encoding:'utf8'});assert.match(text,/Album für die Jugend/);assert.match(text,/Op\. 68/);assert.match(text,/No\. 14 · Kleine Studie/);assert.match(text,/Robert Schumann/);assert.match(text,/Leise und sehr egal zu spielen/);assert.match(text,/Philippe Hardy/);assert.match(text,/Free Art License/);assert.doesNotMatch(text,/Practice candidate|Variatio/);
  assert.equal((text.match(/Page \d of 4/g)??[]).length,4);
  const notices=readFileSync(publicPdf+'.notices.txt','utf8');assert.match(notices,/Libre Bodoni/);assert.match(notices,/SIL OPEN FONT LICENSE/);assert.match(notices,/Free Art License/);assert.match(notices,/URW/);assert.match(notices,/Upstream-Name: Noto/);assert.match(notices,/Upstream-Name: Liberation Fonts/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
