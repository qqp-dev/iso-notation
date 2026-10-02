/** Review-only bow family. Begin with a diagonal-relative, symmetric gesture;
 * clearance may earn bounded shoulder, lift and depth-balance changes while
 * the painted curve retains a single bend and owned endpoint attachments. */
import type {QuantizedGridScore} from '../../model/types';
import {taperedSpanPath} from './ties';
import {expressionIntersectsBox,expressionsOverlap,type ExpressionInk,type ExpressionPlacement} from './elements/expressions';

type Contour=NonNullable<ExpressionInk['contour']>;
type Candidate={ink:ExpressionInk;cost:number};
const AIR=1.5, BODY=.85, TIP=.22;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
/** Signed curvature numerator of a cubic is quadratic. Check its extrema
 * against the rounded controls that are actually painted, not a sampled
 * approximation or the unrounded planning points. */
export function balancedBowIsCoherent(c:Contour):boolean{
 const round=(n:number)=>Number(n.toFixed(2)),width=c.xEnd-c.xStart,rise=c.yEnd-c.yStart,ia=c.startIndent??c.indent,ib=c.endIndent??c.indent;
 const ps=[[c.xStart,c.yStart],[c.xStart+ia,c.yStart+rise*ia/width+c.side*(c.startDepth??c.depth)/.75],[c.xEnd-ib,c.yEnd-rise*ib/width+c.side*(c.endDepth??c.depth)/.75],[c.xEnd,c.yEnd]].map(p=>p.map(round));
 const A=[0,1].map(k=>3*(ps[3][k]-3*ps[2][k]+3*ps[1][k]-ps[0][k])),B=[0,1].map(k=>6*(ps[2][k]-2*ps[1][k]+ps[0][k])),C=[0,1].map(k=>3*(ps[1][k]-ps[0][k]));
 const cross=(a:number[],b:number[])=>a[0]*b[1]-a[1]*b[0],q2=-cross(A,B),q1=2*cross(C,A),q0=cross(C,B),vertex=-q1/(2*q2);
 return [0,1,...(vertex>0&&vertex<1?[vertex]:[])].every(u=>(q2*u*u+q1*u+q0)*-c.side>1e-8)&&ps[0][0]<ps[1][0]&&ps[1][0]<ps[2][0]&&ps[2][0]<ps[3][0];
}
export function preferredBowDepth(span:number,rise:number):number {
 const chord=Math.hypot(span,rise),slope=Math.abs(rise)/Math.max(1,span);
 // A saturating crown, reduced for steep gestures. These are trial ISO point
 // choices, not a quotation of traditional staff-space standards.
 return Math.max(2.5,(2*12/Math.PI)*Math.atan(Math.PI*.18*chord/(2*12))/(1+.65*slope));
}
function ink(base:ExpressionInk,c:Contour):ExpressionInk {
 const ai=c.startIndent??c.indent,bi=c.endIndent??c.indent,rise=c.yEnd-c.yStart;
 const a=c.yStart+rise*ai/(c.xEnd-c.xStart)+c.side*(c.startDepth??c.depth)/.75;
 const b=c.yEnd-rise*bi/(c.xEnd-c.xStart)+c.side*(c.endDepth??c.depth)/.75;
 const d=taperedSpanPath(c.xStart,c.yStart,c.xEnd,c.yEnd,c.side,c.depth,c.thickness,c.indent,c);
 return {...base,contour:c,x0:c.xStart-.6,x1:c.xEnd+.6,y0:Math.min(c.yStart,c.yEnd,a,b)-.6,y1:Math.max(c.yStart,c.yEnd,a,b)+.6,gridKnockout:true,
  svg:`<path class="janko-phrase-grid-knockout" d="${d}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/><path class="janko-phrase" data-phrase="${esc(base.id)}" data-bow="balanced-trial" d="${d}" fill="#111111"/>`};
}
export function balancedPhraseCandidates(base:ExpressionInk,p:ExpressionPlacement,sourceSide?:-1|1):Candidate[]{
 const [from,to]=base.endpointIds!,a=p.endpointEnvelope?.(from,base.startTick),b=p.endpointEnvelope?.(to,base.endTick);
 const left=base.continuationStart?p.left:p.endpointX(from,base.startTick),right=base.continuationEnd?p.right:p.endpointX(to,base.endTick);
 const span=right-left,edge=Math.min(3.6,span/8),x0=left+(base.continuationStart?0:edge),x1=right+(base.continuationEnd?0:-edge),width=x1-x0;
 // Cross-hand figurations prefer the upper bow; same-hand source gestures
 // retain the hand-side preference. Explicit source sides remain constraints.
 const preferred: -1|1=a?.hand==='LH'&&b?.hand==='LH'?1:-1;
 const obstacles=(p.obstacles??[]).filter(q=>q.x1>x0&&q.x0<x1).map(q=>({x0:q.x0-AIR,x1:q.x1+AIR,y0:q.y0-AIR,y1:q.y1+AIR}));
 const found:Candidate[]=[];
 const shoulderPairs=p.phrasePlacement==='gesture-contour'?[[.28,.28],[.24,.32],[.32,.24]]:[[.28,.28],[.24,.24],[.32,.32]];
 const samples=new Map(shoulderPairs.map(([ia,ib])=>[[ia,ib].join(':'),Array.from({length:65},(_,i)=>{
  const u=i/64,v=1-u,xx=v*v*v*x0+3*v*v*u*(x0+width*ia)+3*v*u*u*(x1-width*ib)+u*u*u*x1;
  return {u,v,xx,occupied:obstacles.filter(b=>xx>b.x0&&xx<b.x1)};
 })]));
 for(const side of sourceSide?[sourceSide]:p.phrasePlacement==='preferred-side'?[preferred]:[preferred,-preferred as -1|1]){
  const ay=a?(side===-1?a.top:a.bottom):b?(side===-1?b.top:b.bottom):side===-1?p.top:p.bottom;
  const by=b?(side===-1?b.top:b.bottom):ay;
  const preferredDepth=p.phrasePlacement==='gesture-contour'?Math.max(preferredBowDepth(width,by-ay),.11*(width*width+(by-ay)*(by-ay))/width):preferredBowDepth(width,by-ay);
  for(const lift of [0,2,4,6,8,12,16,24,32])for(const skew of [0,-2,2,-4,4])for(const [ia,ib] of shoulderPairs){
   const y0=ay+side*(2+lift+Math.max(0,skew)),y1=by+side*(2+lift+Math.max(0,-skew));
   for(const extra of [0,2,4,6,8,12,16,24])for(const bias of p.phrasePlacement==='gesture-contour'?[0,-.2,.2]:[0]){
    if(p.phrasePlacement==='gesture-contour'&&lift+Math.abs(skew)>6)continue;
    const cost=lift*2+Math.abs(skew)*1.5+extra*1.3+(Math.abs(ia-.28)+Math.abs(ib-.28))*5+Math.abs(bias)*3+(p.phrasePlacement==='gesture-contour'||side===preferred?0:12);
    if(found.length===64&&cost>=found[63].cost)continue;
    const depth=preferredDepth+extra,c:Contour={xStart:x0,xEnd:x1,yStart:y0,yEnd:y1,side,depth,thickness:BODY,indent:width*.28,startIndent:width*ia,endIndent:width*ib,chordAligned:true,tipThickness:p.phraseTaper==='pointed'?0:TIP};
    if(bias){c.startDepth=depth*(1+bias);c.endDepth=depth*(1-bias);}
    if(!balancedBowIsCoherent(c))continue;
    // Cheap samples reject obvious occupied corridors; final ribbon clipping
    // proves clearance against the same contour that the painter uses.
    let blocked=false;
    for(const {u,v,xx,occupied} of samples.get([ia,ib].join(':'))!){
     const axis=y0+(y1-y0)*(xx-x0)/width,outer=axis+side*(3*v*v*u*(c.startDepth??depth)+3*v*u*u*(c.endDepth??depth))/.75,inner=outer-side*(c.tipThickness!+(BODY-c.tipThickness!)*4*u*v);
     if(occupied.some(b=>Math.min(outer,inner)<b.y1&&Math.max(outer,inner)>b.y0)){blocked=true;break;}
    }
    if(blocked)continue;
    const q=ink(base,c);
    if(obstacles.some(b=>expressionIntersectsBox(q,b)))continue;
    found.push({ink:q,cost});found.sort((a,b)=>a.cost-b.cost);if(found.length>64)found.pop();
    if(!p.phrasePlacement||p.phrasePlacement==='preferred-side')break;
   }
  }
 }
 return found.sort((a,b)=>a.cost-b.cost).slice(0,64);
}
export function routeBalancedPhrases(score:QuantizedGridScore,p:ExpressionPlacement,bases:ExpressionInk[]):ExpressionInk[]{
 const sides=new Map((score.phrases??[]).filter(q=>q.sourceSide).map(q=>[q.id,q.sourceSide==='above'?-1 as const:1 as const]));
 const pools=bases.map(base=>balancedPhraseCandidates(base,p,sides.get(base.id))),selected=new Map<number,Candidate>();
 const order=bases.map((_,i)=>i).sort((a,b)=>pools[a].length-pools[b].length||bases[a].startTick-bases[b].startTick||bases[a].id.localeCompare(bases[b].id));
 let visits=0;
 const search=(at:number):boolean=>{
  if(at===order.length)return true;
  const index=order[at];
  for(const q of pools[index]){
   if(++visits>20000)return false;
   if([...selected.values()].some(other=>expressionsOverlap(q.ink,other.ink)))continue;
   selected.set(index,q);if(search(at+1))return true;selected.delete(index);
  }
  return false;
 };
 const solved=search(0);
 return bases.map((base,i)=>solved?selected.get(i)!.ink:{...(pools[i][0]?.ink??base),routingIssue:pools[i].length?'No compatible balanced bow combination in bounded search.':'No preferred bow clears the complete musical ink.'});
}
