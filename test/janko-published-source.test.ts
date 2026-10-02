import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {comparisonReadings,cloneComparisonSvg,no14GoldComparisonPages} from '../src/source-review/prepared-comparison';
import gold from '../src/render/janko/no14-gold-profile.json';
import {readPublishedComparison} from '../src/source-review/published-state';

test('published Source path excludes local PDF transport, decoder and engraving execution',async()=>{
 const result=await build({entryPoints:['src/source-review/viewer.ts'],bundle:true,write:false,metafile:true,format:'esm',platform:'browser',logLevel:'silent',define:{'import.meta.env.DEV':'false'}});
 const inputs=Object.keys(result.metafile!.inputs);
 assert.ok(inputs.some(p=>p.endsWith('published-viewer.ts')));
 assert.ok(!inputs.some(p=>/development-viewer|pdfjs|source-review\/session|scores\/|janko\/engine|janko\/linter/.test(p)),inputs.join('\n'));
 assert.doesNotMatch(result.outputFiles[0].text,/@janko-source-pdf|@janko-pdfjs-wasm|local dev only/);
});

test('published No14 Source requires the ready selected profile and four ordered genuine page vectors',()=>{
 const figures=Array.from({length:4},(_,i)=>({dataset:{page:String(i+1)},querySelector:(q:string)=>q==='svg'?{page:i+1}:{textContent:`Page ${i+1}`}}));
 const score={dataset:{revision:gold.gold.profileSha256},querySelectorAll:()=>figures};
 const root={dataset:{preparedState:'ready'},querySelector:()=>score};
 const pages=()=>no14GoldComparisonPages(root as unknown as HTMLElement);
 assert.deepEqual(pages().map(q=>q.page),[1,2,3,4]);
 for(const state of ['loading','refreshing','stale','error']){root.dataset.preparedState=state;assert.deepEqual(pages(),[]);}root.dataset.preparedState='ready';
 score.dataset.revision=gold.accepted.profileSha256;assert.deepEqual(pages(),[]);score.dataset.revision=gold.gold.profileSha256;
 figures[2].dataset.page='2';assert.deepEqual(pages(),[]);figures[2].dataset.page='3';
 figures.pop();assert.deepEqual(pages(),[]);
});

test('published work state preserves old No13 choices and separate No14 source and ISO pages',()=>{
 const read=(saved:unknown)=>readPublishedComparison({getItem:()=>JSON.stringify(saved),setItem:()=>{}});
 assert.equal(readPublishedComparison().workId,'schumann-14');
 const old=read({readingId:'saved-unavailable',mobilePane:'candidate',zoom:{candidate:1.75,reference:1.25}});
 assert.equal(old.workId,'schumann-13');assert.equal(old.readingId,'saved-unavailable');assert.equal(old.zoom.candidate,1.75);
 const current=read({...old,workId:'schumann-14',referencePage:1,isoPage:3});
 assert.equal(current.referencePage,1);assert.equal(current.isoPage,3);assert.equal(current.readingId,'saved-unavailable');
 assert.equal(read({...current,isoPage:4,referencePage:9}).isoPage,0);assert.equal(read({...current,workId:'foreign'}).workId,'schumann-13');
});

test('comparison uses only a ready exact No13 passage and refuses stale or other-window ink',()=>{
 const selector='.candidate-window[data-score="schumann-op68-no13"][data-measure-start="38"][data-measure-count="3"]';
 const svg={identity:'actual-prepared-vector'};
 const card=(id:string,match:boolean,lint='clean')=>({dataset:{candidate:id,lint},querySelector:(s:string)=>s==='h3'?{textContent:id}:s===selector&&match?{querySelector:()=>svg}:null});
 const root={dataset:{preparedState:'ready'},querySelectorAll:()=>[card('joint-compact',true),card('foreign-score',false),card('rejected',true,'rejected')]};
 assert.deepEqual(comparisonReadings(root as unknown as HTMLElement),[{id:'joint-compact',label:'joint-compact',svg}]);
 for(const state of ['loading','refreshing','stale','error']){root.dataset.preparedState=state;assert.deepEqual(comparisonReadings(root as unknown as HTMLElement),[]);}
});

class SvgNode {
 constructor(public values:Record<string,string>,public children:SvgNode[]=[]){ }
 get id(){return this.values.id??'';}
 get attributes(){return Object.entries(this.values).map(([name,value])=>({name,value}));}
 querySelectorAll():SvgNode[]{return this.children.flatMap(n=>[n,...n.querySelectorAll()]);}
 setAttribute(name:string,value:string){this.values[name]=value;}
 cloneNode():SvgNode{return new SvgNode({...this.values},this.children.map(n=>n.cloneNode()));}
}
test('comparison clone retains musical ownership and rewrites SVG references without duplicate IDs',()=>{
 const original=new SvgNode({id:'page','aria-labelledby':'title'},[
  new SvgNode({id:'title'}),new SvgNode({id:'clip'}),new SvgNode({id:'owner',fill:'url(#clip)','clip-path':'url(#clip)','data-note-id':'source-note',href:'#title','xlink:href':'#clip'})]);
 const clone=cloneComparisonSvg(original as unknown as SVGSVGElement,'comparison') as unknown as SvgNode;
 assert.equal(original.children[2].values.fill,'url(#clip)');
 assert.equal(clone.id,'comparison-page');assert.equal(clone.values['aria-labelledby'],'comparison-title');
 assert.deepEqual(clone.children[2].values,{id:'comparison-owner',fill:'url(#comparison-clip)','clip-path':'url(#comparison-clip)','data-note-id':'source-note',href:'#comparison-title','xlink:href':'#comparison-clip'});
});
