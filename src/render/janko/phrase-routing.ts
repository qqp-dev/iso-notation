/** Plan local source curves together. Musical owners constrain endpoints;
 * actual music excludes corridors, and neighboring curves share the remaining
 * space. A failed bounded search remains an explicit diagnostic. */
import type {QuantizedGridScore} from '../../model/types';
import {taperedSpanPath} from './ties';
import {expressionIntersectsBox, type ExpressionInk, type ExpressionPlacement} from './elements/expressions';

type Contour=NonNullable<ExpressionInk['contour']>;
type Candidate={ink:ExpressionInk;cost:number;points:number[][]};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const air=.6;
function curve(base:ExpressionInk,c:Contour,paint=true):ExpressionInk {
 const a=c.side*(c.startDepth??c.depth)/.75,b=c.side*(c.endDepth??c.depth)/.75;
 const y=[c.yStart,c.yStart+a,c.yEnd+b,c.yEnd];
 const d=paint?taperedSpanPath(c.xStart,c.yStart,c.xEnd,c.yEnd,c.side,c.depth,c.thickness,c.indent,c):'';
 return {...base,x0:c.xStart-.6,x1:c.xEnd+.6,y0:Math.min(...y)-.6,y1:Math.max(...y)+.6,contour:c,gridKnockout:true,
  svg:paint?`<path class="janko-phrase-grid-knockout" d="${d}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/><path class="janko-phrase" data-phrase="${esc(base.id)}" d="${d}" fill="#111111"/>`:''};
}
function points(c:Contour):number[][] {
 return Array.from({length:129},(_,i)=>{
  const u=i/128,v=1-u,aa=3*v*v*u,bb=3*v*u*u;
  const x=v*v*v*c.xStart+aa*(c.xStart+(c.startIndent??c.indent))+bb*(c.xEnd-(c.endIndent??c.indent))+u*u*u*c.xEnd;
  const axis=c.yStart*(v*v*v+aa)+c.yEnd*(bb+u*u*u);
  const outer=axis+c.side*(aa*(c.startDepth??c.depth)+bb*(c.endDepth??c.depth))/.75;
  const inner=axis+c.side*(aa*Math.max(0,(c.startDepth??c.depth)-c.thickness)+bb*Math.max(0,(c.endDepth??c.depth)-c.thickness))/.75;
  return [x,Math.min(outer,inner),Math.max(outer,inner)];
 });
}
function at(ps:number[][],x:number):number[] {
 let lo=0,hi=ps.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;if(ps[m][0]<x)lo=m;else hi=m;}
 const a=ps[lo],b=ps[hi],u=(x-a[0])/(b[0]-a[0]);
 return [a[1]+u*(b[1]-a[1]),a[2]+u*(b[2]-a[2])];
}
export function localPhrasesCompatible(a:Candidate,b:Candidate):boolean {
 const left=Math.max(a.ink.contour!.xStart,b.ink.contour!.xStart),right=Math.min(a.ink.contour!.xEnd,b.ink.contour!.xEnd);
 if(right<=left)return true;
 let order=0;
 const xs=[left+1e-6,right-1e-6,...a.points.map(p=>p[0]),...b.points.map(p=>p[0])].filter(x=>x>left&&x<right).sort((a,b)=>a-b);
 for(const x of xs){const aa=at(a.points,x),bb=at(b.points,x);
  const above=bb[0]-aa[1],below=aa[0]-bb[1],side=above>=air?1:below>=air?-1:0;
  if(!side||order&&side!==order)return false;order=side;
 }
 return true;
}
export function localPhraseCandidates(base:ExpressionInk,p:ExpressionPlacement,sourceSide?:-1|1):Candidate[] {
 const [from,to]=base.endpointIds!,a=p.endpointEnvelope?.(from,base.startTick),b=p.endpointEnvelope?.(to,base.endTick);
 const left=base.continuationStart?p.left:p.endpointX(from,base.startTick),right=base.continuationEnd?p.right:p.endpointX(to,base.endTick),span=right-left;
 const preferred=(a??b)?.hand==='LH'?1:-1,sides=preferred===-1?[-1,1] as const:[1,-1] as const;
 const obstacles=(p.obstacles??[]).filter(q=>q.x1>left&&q.x0<right).map(q=>({x0:q.x0-air,x1:q.x1+air,y0:q.y0-air,y1:q.y1+air}));
 const found:Candidate[]=[];
 for(const side of sourceSide?[sourceSide]:sides){
  const ay=a?(side===-1?a.top:a.bottom):b?(side===-1?b.top:b.bottom):side===-1?p.top:p.bottom;
  const by=b?(side===-1?b.top:b.bottom):ay;
  const maximum=span<40?10:Math.min(48,Math.max(16,span*.4));
  const depths=span<40?[.75,1.5,2.5,4,6,8,10]:Array.from({length:Math.floor(maximum/2)+1},(_,i)=>i*2);
  const indents=span<40?[[.21,.21],[.08,.08],[.35,.35]]:[[.21,.21],[.08,.08],[.14,.14],[.3,.3],[.08,.21],[.21,.08]];
  for(const distance of [.8,1.2,2])for(const liftA of [0,2,4,6])for(const liftB of [0,2,4,6])for(const [ia,ib] of indents){
   const x0=left+(base.continuationStart?0:Math.min(3.6,span/8)),x1=right-(base.continuationEnd?0:Math.min(3.6,span/8));
   const y0=ay+side*(distance+liftA),y1=by+side*(distance+liftB);
   const samples=Array.from({length:65},(_,i)=>{
    const u=i/64,v=1-u,aa=3*v*v*u,bb=3*v*u*u;
    const x=v*v*v*x0+aa*(x0+(x1-x0)*ia)+bb*(x1-(x1-x0)*ib)+u*u*u*x1;
    return {aa,bb,axis:y0*(v*v*v+aa)+y1*(bb+u*u*u),occupied:obstacles.filter(q=>x>q.x0&&x<q.x1)};
   });
   for(const da of depths)for(const db of depths){
    if(da+db<2)continue;
    if(samples.some(({aa,bb,axis,occupied})=>{
     const thickness=p.contourThickness??.45,outer=axis+side*(aa*da+bb*db)/.75,inner=axis+side*(aa*Math.max(0,da-thickness)+bb*Math.max(0,db-thickness))/.75;
     return occupied.some(q=>Math.min(outer,inner)<q.y1&&Math.max(outer,inner)>q.y0);
    }))continue;
    const c:Contour={xStart:x0,xEnd:x1,yStart:y0,yEnd:y1,side,depth:(da+db)/2,thickness:p.contourThickness??.45,indent:(x1-x0)*.21,startDepth:da,endDepth:db,startIndent:(x1-x0)*ia,endIndent:(x1-x0)*ib};
    const ink=curve(base,c,false),cost=4*(liftA+liftB+2*distance)+(da+db)/2+Math.abs(da-db)*.08+2*(Math.max(0,2-da)+Math.max(0,2-db))+(side===preferred?0:4)+Math.abs(ia-.21)+Math.abs(ib-.21);
    found.push({ink,cost,points:[]});
   }
  }
 }
 found.sort((a,b)=>a.cost-b.cost);
 // Preserve shape diversity as well as cheapest alternatives: a short phrase
 // may have to yield a different corridor to a longer concurrent gesture.
 const bins=new Map<string,number>(),pool:Candidate[]=[];
 for(const c of found){
  const q=c.ink.contour!,key=[q.side,Math.round((q.yStart-(a?(q.side===-1?a.top:a.bottom):q.yStart))/2),Math.round((q.yEnd-(b?(q.side===-1?b.top:b.bottom):q.yEnd))/2),Math.round(((q.startDepth??q.depth)-(q.endDepth??q.depth))/4)].join(':');
  if((bins.get(key)??0)>=4)continue;
  if(obstacles.some(box=>expressionIntersectsBox(c.ink,box)))continue;
  bins.set(key,(bins.get(key)??0)+1);c.ink=curve(base,q);c.points=points(q);pool.push(c);if(pool.length>=192)break;
 }
 return pool;
}
export function routeLocalPhrases(score:QuantizedGridScore,p:ExpressionPlacement,bases:ExpressionInk[]):ExpressionInk[] {
 const sourceSides=new Map((score.phrases??[]).filter(q=>q.sourceSide).map(q=>[q.id,q.sourceSide==='above'?-1 as const:1 as const]));
 const pools=bases.map(base=>localPhraseCandidates(base,p,sourceSides.get(base.id)));
 const order=bases.map((_,i)=>i).sort((a,b)=>pools[a].length-pools[b].length||bases[a].startTick-bases[b].startTick||bases[a].id.localeCompare(bases[b].id));
 const selected=new Map<number,Candidate>(),memo=new Map<string,boolean>();let visits=0;
 const fits=(a:number,ai:number,b:number,bi:number)=>{
  const key=a<b?`${a}:${ai}:${b}:${bi}`:`${b}:${bi}:${a}:${ai}`;
  if(!memo.has(key))memo.set(key,localPhrasesCompatible(pools[a][ai],pools[b][bi]));return memo.get(key)!;
 };
 const chosen=new Map<number,number>();
 const search=(remaining:number[]):boolean=>{
  if(!remaining.length)return true;
  const available=remaining.map(id=>({id,indices:pools[id].map((_,i)=>i).filter(ci=>![...chosen].some(([other,oi])=>!fits(id,ci,other,oi)))}));
  if(available.some(q=>!q.indices.length))return false;
  available.sort((a,b)=>a.indices.length-b.indices.length||order.indexOf(a.id)-order.indexOf(b.id));
  const {id,indices}=available[0];
  for(const ci of indices){
   if(++visits>120000)return false;
   chosen.set(id,ci);selected.set(id,pools[id][ci]);
   if(search(remaining.filter(i=>i!==id)))return true;
   chosen.delete(id);selected.delete(id);
  }
  return false;
 };
 const ranges=pools.map((pool,i)=>pool.length?{x0:bases[i].contour!.xStart,x1:bases[i].contour!.xEnd,y0:Math.min(...pool.flatMap(c=>c.points.map(p=>p[1]))),y1:Math.max(...pool.flatMap(c=>c.points.map(p=>p[2])))}:bases[i]);
 const unseen=new Set(order),failed=new Set<number>();
 while(unseen.size){
  const first=[...unseen][0],component=[first];unseen.delete(first);
  for(let k=0;k<component.length;k++)for(const next of unseen){const a=ranges[component[k]],b=ranges[next];
   if(a.x0<b.x1&&b.x0<a.x1&&a.y0<b.y1+air&&b.y0<a.y1+air){component.push(next);unseen.delete(next);}}
  chosen.clear();visits=0;
  if(!search(component))for(const id of component){failed.add(id);selected.delete(id);}
 }
 // Keep source ink visible and explicitly refuse success rather than deleting
 // a curve or silently claiming a distant lane as a local solution. One
 // unavailable component never invalidates unrelated solved phrases.
 return bases.map((base,i)=>failed.has(i)?{...(pools[i][0]?.ink??base),routingIssue:pools[i].length?'No nonconflicting local curve combination within the bounded search.':'No local curve clears the musical ink.'}:selected.get(i)!.ink);
}
