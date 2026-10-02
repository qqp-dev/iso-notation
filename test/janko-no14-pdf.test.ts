import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {fingerprintPdf} from './support/pdf-fingerprint';
import {no14PracticeProfile} from '../src/render/janko/no14-practice';
import {layoutJankoScore,renderJankoPage} from '../src/render/janko/engine';
test('No14 practice PDF matches explicit profile,6vector pages,8owned dots,source text and96DPI',()=>{
 const supplied=process.env.NO14_PDF_UNDER_TEST,tmp=supplied?undefined:mkdtempSync(join(tmpdir(),'no14-pdf-test-'));
 const pdf=supplied??join(tmp!,'no14.pdf');
 try{
  if(!supplied)execFileSync(process.execPath,['--import','tsx','scripts/export-no14-practice-pdf.ts','--out',pdf],{stdio:'pipe'});
  const manifest=JSON.parse(readFileSync(pdf+'.manifest.json','utf8')),e=no14PracticeProfile();
  assert.deepEqual(manifest.options,e.options);assert.deepEqual(manifest.tokens,e.tokens);assert.equal(manifest.notes,574);assert.equal(manifest.writtenBars,64);assert.equal(manifest.unfoldedOccurrences,96);
  assert.equal(manifest.pages,6);assert.equal(manifest.pageSvgSha256.length,6);assert.equal(manifest.augmentationDots.length,8);
  const layouts=layoutJankoScore(e.score,e.options,e.tokens);
  assert.deepEqual(manifest.pageSvgSha256,Array.from({length:6},(_,i)=>createHash('sha256').update(renderJankoPage(e.score,i,e.options,e.tokens,layouts)).digest('hex')),'download geometry matches the current explicit profile');
  assert.deepEqual(manifest.augmentationDots.flatMap((d:{owners:string[]})=>d.owners).sort(),e.score.notes.filter(n=>n.durationTicks===72).map(n=>n.id).sort());
  assert.equal(manifest.pdfSha256,createHash('sha256').update(readFileSync(pdf)).digest('hex'));
  const fp=fingerprintPdf(pdf,'Album f');assert.equal(fp.pages,6);assert.equal(fp.images,0);assert.ok(fp.vectorNumbers.every(n=>n>1000));assert.ok(fp.fonts.some(f=>f.includes('URWGothic-Demi')));
  assert.ok(fp.titleScales.some(n=>Math.abs(n-44/3)<.01));for(const size of fp.pageSizes)assert.equal(size,'595.28 x 841.89');
  const fonts=execFileSync('pdffonts',[pdf],{encoding:'utf8'}).split('\n').slice(2).filter(Boolean);assert.ok(fonts.every(line=>/yes\s+yes\s+yes/.test(line)),'embedded subset fonts withUnicode text');
  const text=execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});assert.match(text,/Leise und sehr egal zu spielen\./);assert.match(text,/Philippe Hardy/);assert.match(text,/Free Art License/);assert.match(text,/Practice candidate/);
  assert.equal((text.match(/Page \d of 6/g)??[]).length,6);assert.match(readFileSync(pdf+'.notices.txt','utf8'),/URW/);
 }finally{if(tmp)rmSync(tmp,{recursive:true,force:true});}
});
