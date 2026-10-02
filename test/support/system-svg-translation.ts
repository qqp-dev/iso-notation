/** Complete engine system comparison under one declared rigid y translation.
 * Checks all text/attributes, native transforms and every path coordinate;
 * unknown path vocabulary fails rather than silently omitting painted ink. */
import assert from 'node:assert/strict';

export function systemSvgFragments(svg:string):string[]{
 const out:string[]=[];
 for(const match of svg.matchAll(/<g id="system-\d+">/g)){
  let depth=0,end=-1;
  for(const tag of svg.slice(match.index).matchAll(/<\/?g\b[^>]*>/g)){
   depth+=tag[0].startsWith('</')?-1:1;
   if(depth===0){end=match.index!+tag.index!+tag[0].length;break;}
  }
  assert.ok(end>0,'complete system group');out.push(svg.slice(match.index,end));
 }
 return out;
}
const near=(before:number,after:number,dy:number,label:string)=>assert.ok(Math.abs(after-before-dy)<.0021,`${label}: ${before} → ${after}; expected dy ${dy}`);
const number=/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
function comparePath(before:string,after:string,dy:number,label:string){
 const a=before.match(/[MLCQHVZ]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)??[];
 const b=after.match(/[MLCQHVZ]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)??[];
 assert.equal(a.join(''),before.replace(/[\s,]/g,''),`${label}: recognized path vocabulary`);
 assert.equal(b.join(''),after.replace(/[\s,]/g,''),`${label}: recognized path vocabulary`);
 assert.equal(a.length,b.length,label);
 let command='',parameter=0;
 for(let i=0;i<a.length;i++){
  if(/^[A-Z]$/.test(a[i])){assert.equal(a[i],b[i],label);command=a[i];parameter=0;continue;}
  assert.ok(command&&command!=='Z',`${label}: coordinate owner`);
  const y=command==='V'||(command!=='H'&&parameter%2===1);
  near(Number(a[i]),Number(b[i]),y?dy:0,`${label} ${command}[${parameter}]`);parameter++;
 }
}
export function assertSystemSvgTranslation(before:string,after:string,dy:number,label:string){
 assert.equal(before.replace(/<[^>]*>/g,''),after.replace(/<[^>]*>/g,''),`${label}: text`);
 const a=[...before.matchAll(/<[^>]*>/g)].map(m=>m[0]),b=[...after.matchAll(/<[^>]*>/g)].map(m=>m[0]);
 assert.equal(a.length,b.length,`${label}: painted element count`);
 for(let i=0;i<a.length;i++){
  assert.equal(a[i].replace(/="[^"]*"/g,'=""'),b[i].replace(/="[^"]*"/g,'=""'),`${label}: tag/attribute structure ${i}`);
  const attrs=[...a[i].matchAll(/([\w-]+)="([^"]*)"/g)],other=[...b[i].matchAll(/([\w-]+)="([^"]*)"/g)];
  const transformed=attrs.some(m=>m[1]==='transform');
  assert.ok(!a[i].startsWith('<g ')||!transformed,`${label}: no omitted inherited transform`);
  for(let j=0;j<attrs.length;j++){
   const [,_key,value]=attrs[j],[,,next]=other[j],key=attrs[j][1],where=`${label} ${i}.${key}`;
   if(['y','y1','y2','cy'].includes(key))near(Number(value),Number(next),dy,where);
   else if(key==='d'&&!transformed)comparePath(value,next,dy,where);
   else if(key==='transform'){
    assert.equal(value.replace(/translate\([^)]*\)/g,'translate()'),next.replace(/translate\([^)]*\)/g,'translate()'),where);
    const av=value.match(/^translate\(([^)]+)\)/)?.[1].match(number),bv=next.match(/^translate\(([^)]+)\)/)?.[1].match(number);
    assert.equal(av?.length,2,where);assert.equal(bv?.length,2,where);
    near(Number(av![0]),Number(bv![0]),0,where);near(Number(av![1]),Number(bv![1]),dy,where);
   }else assert.equal(value,next,where);
  }
 }
}
