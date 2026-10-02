#!/usr/bin/env node
/** Separate historical96-occurrence and selected GOLD64-bar exports. Both
 * reuse the canonical96DPI vector recipe; the Bach download stays separate. */
import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync,readFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {countJankoPages,layoutJankoScore,renderJankoPage} from '../src/render/janko/engine';
import {buildInkScene} from '../src/render/janko/ink-scene';
import {no14PracticeProfile} from '../src/render/janko/no14-practice';
import {no14GoldProfile,no14GoldOriginProfile,no14GoldStudioSvg,NO14_GOLD_ACCEPTANCE,NO14_GOLD_IDENTITY,NO14_GOLD_PDF} from '../src/render/janko/no14-gold';
import {SCHUMANN_NO14_APPROVED_SHA256} from '../src/scores/schumann-no14-draft';
import {lintJankoScore} from '../src/render/janko/linter';
const argv=process.argv.slice(2);
let profile='practice',output:string|undefined;
for(let i=0;i<argv.length;i++){
 if(argv[i]==='--out'&&argv[i+1])output=argv[++i];
 else if(argv[i]==='--profile'&&['practice','gold'].includes(argv[i+1]))profile=argv[++i];
 else throw Error('Usage: npm run pdf:no14 -- [--profile practice|gold] --out <output.pdf>');
}
const gold=profile==='gold';if(!gold&&!output)throw Error('Historical practice export requires an explicit --out path.');
const out=resolve(output??'public/'+NO14_GOLD_PDF),hash=(data:string|Buffer)=>createHash('sha256').update(data).digest('hex');
if(out.endsWith('/public/goldberg-variation-1.pdf'))throw Error('No14 export cannot overwrite the Bach canonical download.');
const e=gold?no14GoldProfile():no14PracticeProfile(),layouts=layoutJankoScore(e.score,e.options,e.tokens),pages=countJankoPages(e.score,e.options,e.tokens,layouts);
const dots=layouts.flatMap(l=>[...buildInkScene(l,e.options,e.tokens,e.score).solos.values()].flat().filter(p=>p.shape.kind==='dot'));
if(pages!==(gold?4:6)||dots.length!==(gold?4:8))throw Error(`Incomplete No14 ${profile} export: ${pages} pages / ${dots.length} dots`);
if(gold){const r=lintJankoScore(e.score,e.options,e.tokens,undefined,layouts);if(!r.ok||r.warnings.length)throw Error('No14 GOLD export fails strict physical admission');}
const origin=gold?no14GoldOriginProfile():undefined;
if(origin&&(hash(JSON.stringify(origin.score))!==NO14_GOLD_ACCEPTANCE.modelSha256||hash(JSON.stringify(origin))!==NO14_GOLD_ACCEPTANCE.profileSha256))throw Error('No14 GOLD origin differs from operator-accepted A profile');
if(gold&&(hash(JSON.stringify(e.score))!==NO14_GOLD_IDENTITY.modelSha256||hash(JSON.stringify(e))!==NO14_GOLD_IDENTITY.profileSha256))throw Error('No14 GOLD differs from declared final print identity/profile');
const tmp=mkdtempSync(join(tmpdir(),'no14-practice-pdf-'));
mkdirSync(dirname(out),{recursive:true});
try{
 const pdfs:string[]=[],pageHashes:string[]=[],studioPageHashes:string[]=[];
 for(let page=0;page<pages;page++){
  const svg=renderJankoPage(e.score,page,e.options,e.tokens,layouts),sv=join(tmp,`page-${page}.svg`),pdf=join(tmp,`page-${page}.pdf`);
  writeFileSync(sv,svg);pageHashes.push(hash(svg));
  if(gold){const final=hash(no14GoldStudioSvg(svg));if(final!==NO14_GOLD_IDENTITY.pageSvgSha256[page])throw Error(`No14 GOLD page ${page+1} differs from declared final print ink`);studioPageHashes.push(final);}
  // Deliberately omit -d/-p:96DPI pins SVGpt text at4/3 scale.
  execFileSync('rsvg-convert',['-f','pdf','-o',pdf,sv],{stdio:'pipe'});pdfs.push(pdf);
 }
 execFileSync('pdfunite',[...pdfs,out],{stdio:'pipe'});
 const manifest={status:gold?'operator-selected No14 GOLD':'unlanded practice candidate; visual acceptance pending',profile,sourceId:e.score.id,sourceHash:SCHUMANN_NO14_APPROVED_SHA256,
  notes:e.score.notes.length,writtenBars:64,unfoldedOccurrences:96,pages,augmentationDots:dots.map(d=>({owners:d.ownerIds,shape:d.shape})),options:e.options,tokens:e.tokens,pageSvgSha256:pageHashes,pdfSha256:hash(readFileSync(out)),
  ...(gold?{modelSha256:hash(JSON.stringify(e.score)),profileSha256:hash(JSON.stringify(e)),acceptedOrigin:NO14_GOLD_ACCEPTANCE,acceptedPageSvgSha256:NO14_GOLD_ACCEPTANCE.pageSvgSha256,studioPageSvgSha256:studioPageHashes,printChanges:NO14_GOLD_IDENTITY.printChanges,performedMapping:e.score.writtenPresentation}: {})};
 writeFileSync(out+'.manifest.json',JSON.stringify(manifest,null,2)+'\n');
 const notices=[...e.score.publicationNotices!,'Approved encoding SHA256: '+SCHUMANN_NO14_APPROVED_SHA256,
  'Selected scan pages are comparison evidence and are not bundled in this PDF.',
  'Source form and provenance: https://github.com/qqp-dev/iso-notation/blob/main/src/scores/schumann-no14-derived.json ; src/scores/schumann-no14-draft.ts; src/render/janko/no14-practice.ts.',
  ...(gold?['Operator-selected Libre Bodoni Regular Italic400 dynamics and Libre Bodoni Regular400 pedal text; intact vector outlines. Provenance: licenses/no14-paired-typography.json.',readFileSync(new URL('../licenses/LibreBodoni-OFL.txt',import.meta.url),'utf8'),
   'Ordinary source/heading text uses the existing rsvg system font fallback recipe. This published PDF embeds Noto Serif and Liberation Serif subsets as well as URW Gothic; family resolution can vary by export environment. Noto/Liberation source and OFL notices follow; no system font configuration is changed.',
   readFileSync(new URL('../licenses/Noto-copyright.txt',import.meta.url),'utf8'),readFileSync(new URL('../licenses/Liberation-copyright.txt',import.meta.url),'utf8')]:[]),
  readFileSync(new URL('../licenses/URW-base35-provenance.md',import.meta.url),'utf8'),
  readFileSync(new URL('../licenses/URW-base35-LICENSE',import.meta.url),'utf8'),
  readFileSync(new URL('../licenses/URW-base35-COPYING',import.meta.url),'utf8')].join('\n\n');
 writeFileSync(out+'.notices.txt',notices+'\n');
 console.log(JSON.stringify({out,pages,dots:dots.length,manifest:out+'.manifest.json',notices:out+'.notices.txt'}));
}finally{rmSync(tmp,{recursive:true,force:true});}
