/** Opt-in optical gestures: fit one healthy complete bow, then translate that
 * whole shape outside musical ink. Tips can shorten only inside independently
 * admitted source-onset neighborhoods. No hand-side preference or local dents. */
import type {QuantizedGridScore} from '../../model/types';
import {balancedBowIsCoherent} from './balanced-phrases';
import {taperedSpanPath} from './ties';
import {expressionIntersectsBox,expressionContourParameterAtX,expressionSliceAtParameter,expressionContourOutwardShift,prepareExpressionOutwardFit,expressionsOverlap,pedalIntervals,type ExpressionOutwardFit,type ExpressionInk,type ExpressionPlacement} from './elements/expressions';

type Contour=NonNullable<ExpressionInk['contour']>;
const AIR=1.5,BODY=.85,TIP=.22;
export interface OpticalPhraseCandidate {
 ink:ExpressionInk;cost:number;
 /** Successor-policy diagnostics. The value is extra whole-bow air beyond
  * exact minimum fitting, not a claim of minimum normal ink distance. */
 breathing?:{extraAir:number;targetAir:number;shape:number;proximity:number;balance:number;floor:number;air:number};
 shoulder?:ReturnType<typeof weakShoulderHealth>;
 open?:{openingProximity:number;openingCost:number;axisCost:number};
}
/** Only retained, already admitted complete bows earn this bounded preference.
 * Native glyph/stem enclosures and narrow rail strips remain conservative
 * nearness evidence; white masks and guide lines carry no musical weight.
 * Saturation stops rewarding further floating once the opening is quiet. */
export function opticalOpeningHealth(ink:ExpressionInk,p:ExpressionPlacement){
 const domain=p.opticalDomain?.(ink.id),c=ink.contour;
 if(!domain||!c)return {openingProximity:0,openingCost:0,axisCost:0};
 const left=Math.max(domain.start.x,c.xStart),right=Math.min(domain.start.x+domain.span/3,c.xEnd),band=12;
 let gap=band;
 for(const box of p.balanceObstacles??[]){
  const a=Math.max(left+.00001,box.x0),b=Math.min(right-.00001,box.x1);if(b<=a)continue;
  for(const x of [a,(a+b)/2,b]){
   const u=expressionContourParameterAtX(c,x);if(u===undefined)continue;
   const slice=expressionSliceAtParameter(c,x,u);
   gap=Math.min(gap,Math.max(0,box.y0-slice[1],slice[0]-box.y1));
  }
 }
 const openingProximity=Math.max(0,1-gap/band),openingCost=.020*openingProximity;
 // A small continuous shape preference survives even a source-steep allowance.
 // It never forbids the diagonal needed by a steep source gesture.
 const axisCost=.004*Math.min(1,((c.yEnd-c.yStart)/(c.xEnd-c.xStart))**2);
 return {openingProximity,openingCost,axisCost};
}
/** A soft absolute-approach preference, with allowance earned by source pitch
 * geometry rather than the selected optical axis. The rounded outer controls
 * are the painted ribbon. No apex target or side preference is introduced. */
export function weakShoulderHealth(c:Contour,sourceRise:number){
 const width=c.xEnd-c.xStart,rise=c.yEnd-c.yStart,a=c.startIndent??c.indent,b=c.endIndent??c.indent;
 const round=(n:number)=>Number(n.toFixed(2));
 const points=[[c.xStart,c.yStart],[c.xStart+a,c.yStart+rise*a/width+c.side*(c.startDepth??c.depth)/.75],
  [c.xEnd-b,c.yEnd-rise*b/width+c.side*(c.endDepth??c.depth)/.75],[c.xEnd,c.yEnd]].map(p=>p.map(round));
 const startAngle=Math.atan2(points[1][1]-points[0][1],points[1][0]-points[0][0])*180/Math.PI;
 const endAngle=Math.atan2(points[3][1]-points[2][1],points[3][0]-points[2][0])*180/Math.PI;
 const sourceSlope=Math.abs(sourceRise)/width,u=Math.max(0,Math.min(1,(sourceSlope-.36)/(.55-.36))),steepAllowance=1-u*u*(3-2*u);
 const comfortableAngle=(29-10*Math.min(sourceSlope,.36))*steepAllowance,weakerAngle=Math.min(Math.abs(startAngle),Math.abs(endAngle));
 const shoulderCost=comfortableAngle<1e-9?0:.12*Math.max(0,Math.min(1,(comfortableAngle-weakerAngle)/comfortableAngle));
 // A source-steep gesture earns a diagonal; in moderate contours a softened
 // axis may give a calmer complete silhouette even after crown/entry improve.
 const axisCost=.06*(rise/width)**2*steepAllowance;
 return {sourceSlope,comfortableAngle,weakerAngle,startAngle,endAngle,steepAllowance,shoulderCost,axisCost,cost:shoulderCost+axisCost};
}
// Lettering and pedal-start profiles act after the phrase solve. Reuse only
// exact, completely declared route inputs on the same score; this never
// caches pages or skips the normal layout/linter for another profile.
const breathingRouteCache=new WeakMap<QuantizedGridScore,Map<string,ExpressionInk[]>>();
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
function opticalBowBounds(c:Contour){
 const w=c.xEnd-c.xStart,r=c.yEnd-c.yStart,ia=c.startIndent??c.indent,ib=c.endIndent??c.indent;
 const ys=[c.yStart,c.yEnd,c.yStart+r*ia/w+c.side*(c.startDepth??c.depth)/.75,c.yEnd-r*ib/w+c.side*(c.endDepth??c.depth)/.75];
 return {x0:c.xStart-.6,x1:c.xEnd+.6,y0:Math.min(...ys)-.6,y1:Math.max(...ys)+.6};
}
export function opticalBowInk(base:ExpressionInk,c:Contour,policy='optical-gesture'):ExpressionInk{
 const d=taperedSpanPath(c.xStart,c.yStart,c.xEnd,c.yEnd,c.side,c.depth,c.thickness,c.indent,c);
 return {...base,contour:c,...opticalBowBounds(c),gridKnockout:true,
 svg:`<path class="janko-phrase-grid-knockout" d="${d}" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/><path class="janko-phrase" data-phrase="${esc(base.id)}" data-bow="${policy}" d="${d}" fill="#111111"/>`};
}
export function opticalPhraseCandidates(base:ExpressionInk,p:ExpressionPlacement,sourceSide?:-1|1){
 const domain=p.opticalDomain?.(base.id);if(!domain)return [];
 const {start:a,end:b}=domain;
 const open=p.phraseRouting==='optical-open',silhouette=p.phraseRouting==='optical-silhouette'||open,breathing=p.phraseRouting==='optical-breathing'||silhouette,fitted=p.phraseRouting==='optical-fitted'||breathing;
 // Weight only the source span's musical ink. Pitch guides are omitted by
 // the inventory provider; head-clearance masks are not balance weight.
 // This bounded first moment is a weak local preference, never a side rule.
 const balanceInk=p.balanceObstacles??p.obstacles??[],scale=Math.max(12,domain.pitchRange/2+12),middle=(a.y+b.y)/2;
 let weight=0,moment=0;
 if(fitted)for(const q of balanceInk){const width=Math.min(b.x,q.x1)-Math.max(a.x,q.x0);if(width<=0)continue;
  const area=width*Math.min(12,q.y1-q.y0);weight+=area;moment+=area*Math.max(-1,Math.min(1,((q.y0+q.y1)/2-middle)/scale));}
 const balance=weight?moment/weight:0;
 const xs=(lo:number,hi:number,start:boolean)=>lo===hi?[lo]:[start?lo+Math.min(3.6,(hi-lo)*.7):hi-Math.min(3.6,(hi-lo)*.7),(lo+hi)/2,start?hi-.2:lo+.2];
 const found:OpticalPhraseCandidate[]=[];
 // Only x controls determine these exact inverses. Keep their reuse local
 // to one immutable placement/domain; every candidate still runs in its
 // original order and uses the original five samples per obstacle.
 type Box=NonNullable<ExpressionPlacement['obstacles']>[number];
 type Sample={x:number;u:number;obstacle:Box};
 type Geometry={obstacles:Box[];expanded:Box[];samples:Map<string,Sample[]>;fits:Map<string,ExpressionOutwardFit>};
 const byX=new Map<number,Map<number,Geometry>>();
 for(const side of sourceSide?[sourceSide]:[-1 as const,1 as const])for(const x0 of xs(a.x0,a.x1,true))for(const x1 of xs(b.x0,b.x1,false)){
  const w=x1-x0;if(w<=8)continue;
  let byEnd=byX.get(x0);if(!byEnd){byEnd=new Map();byX.set(x0,byEnd);}
  let geometry=byEnd.get(x1);
  if(!geometry){const obstacles=(p.obstacles??[]).filter(q=>q.x1+(fitted?AIR:0)>x0&&q.x0-(fitted?AIR:0)<x1);geometry={obstacles,expanded:obstacles.map(q=>({x0:q.x0-AIR,x1:q.x1+AIR,y0:q.y0-AIR,y1:q.y1+AIR})),samples:new Map(),fits:new Map()};byEnd.set(x1,geometry);}
  for(const diagonal of [0,.5,1])for(const shoulders of [[.28,.28],[.24,.32],[.32,.24]])for(const bias of [0,-.15,.15])for(const extra of [0,2,4]){
   const rise=(b.y-a.y)*diagonal,mid=(a.y+b.y)/2,y0=mid-rise/2,y1=mid+rise/2;
   const depth=.12*(w*w+rise*rise)/w+extra;
   const c:Contour={xStart:x0,xEnd:x1,yStart:y0,yEnd:y1,side,depth,thickness:BODY,indent:w*.28,startIndent:w*shoulders[0],endIndent:w*shoulders[1],startDepth:depth*(1+bias),endDepth:depth*(1-bias),chordAligned:true,tipThickness:TIP};
   if(!balancedBowIsCoherent(c))continue;
   let shift=0;
   // All relevant complete-gesture ink earns outward room. A bow is never
   // flattened merely because a cheap narrow interior corridor exists.
   if(fitted){
    const key=shoulders.join(':');let fit=geometry.fits.get(key);
    if(!fit){fit=prepareExpressionOutwardFit(c,geometry.expanded);geometry.fits.set(key,fit);}
    shift=expressionContourOutwardShift(c,geometry.expanded,fit);
    // Sub-pixel floating-point guard at tangency, not a visual displacement
    // convention. Final independent positive-area admission still decides.
    if(shift>0)shift+=1e-7;
   }else{
    const key=shoulders.join(':');let samples=geometry.samples.get(key);
    if(!samples){samples=[];
     for(const q of geometry.obstacles){const left=Math.max(x0+.00001,q.x0),right=Math.min(x1-.00001,q.x1);if(right<=left)continue;
      for(let i=0;i<=4;i++){const x=left+(right-left)*i/4;samples.push({x,u:expressionContourParameterAtX(c,x)!,obstacle:q});}}
     geometry.samples.set(key,samples);
    }
    for(const sample of samples){
     const s=expressionSliceAtParameter(c,sample.x,sample.u),q=sample.obstacle;
     shift=Math.max(shift,side===-1?s[1]-q.y0+AIR:q.y1+AIR-s[0]);
    }
   }
   c.yStart+=side*shift;c.yEnd+=side*shift;
   if(c.yStart<a.y0||c.yStart>a.y1||c.yEnd<b.y0||c.yEnd>b.y1)continue;
   // Rejected candidates require physical geometry, but never a path string.
   const query={...base,contour:c,...opticalBowBounds(c),gridKnockout:true};
   if(geometry.expanded.some(q=>expressionIntersectsBox(query,q)))continue;
   const affiliation=(Math.abs(c.yStart-a.y)+Math.abs(c.yEnd-b.y))/w;
   const shape=Math.abs(bias)*.5+(Math.abs(shoulders[0]-.28)+Math.abs(shoulders[1]-.28))*2+extra/w;
   let cost=shape+affiliation*.7+Math.abs(rise)/w*.15+((x0-a.x)+(b.x-x1))/w*.3;
   if(fitted){
    // Normal crown/chord ratio. The moderate plateau charges neither added
    // crown nor endpoint movement as a dominant objective. Longer gestures
    // allow a proportionally calmer bow; admitted shapes remain single-bend.
    let crown=0;for(let i=1;i<16;i++){const u=i/16,v=1-u;crown=Math.max(crown,(3*v*v*u*c.startDepth!+3*v*u*u*c.endDepth!)/.75);}
    const ratio=crown*w/(w*w+rise*rise),upper=.17-Math.min(.025,Math.max(0,w-100)*.0002);
    const fullness=20*Math.max(0,.13-ratio,ratio-upper)**2;
    const shouldersCost=(Math.abs(shoulders[0]-.28)+Math.abs(shoulders[1]-.28))*.35;
    const tilt=.4*Math.max(0,Math.abs(rise)/w-.65)**2;
    const shortening=((x0-a.x)+(b.x-x1))/w;
    cost=fullness+shouldersCost+Math.abs(bias)*.1+tilt+Math.min(1,affiliation)*.035+shortening*.1+side*balance*.08;
    if(p.phrasePlacement==='above-diagnostic'&&!sourceSide&&side===1)cost+=1;
   }
   if(breathing){
    // Near-zero moments have no meaningful confidence as a side judgment.
    // Actual system expression demand is a bounded consequence, not a new
    // placement rule or an unconditional preference for the upper side.
    const balanceCost=side*Math.sign(balance)*Math.max(0,Math.abs(balance)-.08)*.025;
    const proximity=Math.min(1,affiliation)*.01;
    const floor=p.expressionFloorActive ? .06*Math.min(1,Math.max(0,query.y1-p.bottom)/Math.max(24,w*.5)) : 0;
    const shapeCost=cost-Math.min(1,affiliation)*.035-side*balance*.08-(p.phrasePlacement==='above-diagnostic'&&!sourceSide&&side===1?1:0);
    const shoulder=silhouette?weakShoulderHealth(c,b.y-a.y):undefined;
    cost=shapeCost+proximity+balanceCost+floor+(shoulder?.cost??0);
    if(p.phrasePlacement==='above-diagnostic'&&!sourceSide&&side===1)cost+=1;
    found.push({ink:query,cost,...(shoulder?{shoulder}:{}),breathing:{extraAir:0,targetAir:Math.max(3,Math.min(6,w*.05)),shape:shapeCost+(shoulder?.cost??0),proximity,balance:balanceCost,floor,air:0}});
   }else found.push({ink:opticalBowInk(base,c,fitted?'optical-fitted':'optical-gesture'),cost});
  }
 }
 const ranked=found.sort((a,b)=>a.cost-b.cost);
 if(breathing){
  const expanded=(p.obstacles??[]).map(q=>({x0:q.x0-AIR,x1:q.x1+AIR,y0:q.y0-AIR,y1:q.y1+AIR}));
  const alternatives:OpticalPhraseCandidate[]=[];
  for(const side of sourceSide?[sourceSide]:[-1 as const,1 as const]){
   const rows=ranked.filter(q=>q.ink.contour!.side===side),axes=new Map<number,OpticalPhraseCandidate[]>();
   for(const q of rows){const c=q.ink.contour!,rise=Number((c.yEnd-c.yStart).toFixed(6));let group=axes.get(rise);if(!group){group=[];axes.set(rise,group);}group.push(q);}
   // A bounded post-fit shortlist, rather than multiplying every shape by
   // slack choices. Each admitted diagonal keeps representatives first.
   const seeds=[...axes.values()].flatMap(q=>q.slice(0,Math.max(1,Math.floor(12/axes.size))));
   for(const q of seeds)for(const factor of [0,.5,1,1.5]){
    const minimum=q.ink.contour!,target=q.breathing!.targetAir,slack=target*factor;
    const c={...minimum,yStart:minimum.yStart+side*slack,yEnd:minimum.yEnd+side*slack};
    if(c.yStart<a.y0||c.yStart>a.y1||c.yEnd<b.y0||c.yEnd>b.y1)continue;
    const ink={...q.ink,contour:c,...opticalBowBounds(c)};
    if(expanded.some(box=>expressionIntersectsBox(ink,box)))continue;
    const affiliation=(Math.abs(c.yStart-a.y)+Math.abs(c.yEnd-b.y))/(c.xEnd-c.xStart);
    const proximity=Math.min(1,affiliation)*.01;
    const floor=p.expressionFloorActive ? .06*Math.min(1,Math.max(0,ink.y1-p.bottom)/Math.max(24,(c.xEnd-c.xStart)*.5)) : 0;
    const air=.05*(factor-1)**2;
    const shoulder=q.shoulder?weakShoulderHealth(c,b.y-a.y):undefined,healthChange=(shoulder?.cost??0)-(q.shoulder?.cost??0);
    alternatives.push({ink,cost:q.cost-q.breathing!.proximity-q.breathing!.floor+proximity+floor+air+healthChange,...(shoulder?{shoulder}:{}),
     breathing:{...q.breathing!,shape:q.breathing!.shape+healthChange,extraAir:slack,proximity,floor,air}});
   }
  }
  alternatives.sort((a,b)=>a.cost-b.cost);
  const sideGroups=[-1,1].map(side=>alternatives.filter(q=>q.ink.contour!.side===side)).filter(q=>q.length);
  const limit=sideGroups.length===2?12:24;
  const keep=sideGroups.flatMap(rows=>{
   // Reserve actual minimum and breathing alternatives when available,
   // then fill by cost; total retained/search budgets remain unchanged.
   const selected:OpticalPhraseCandidate[]=[];
   for(const factor of [0,.5,1,1.5]){const q=rows.find(q=>Math.abs(q.breathing!.extraAir/q.breathing!.targetAir-factor)<1e-8);if(q)selected.push(q);}
   for(const q of rows)if(selected.length<limit&&!selected.includes(q))selected.push(q);
   return selected;
  }).sort((a,b)=>a.cost-b.cost);
  const retained=keep.map(q=>({...q,ink:opticalBowInk(base,q.ink.contour!,p.phraseRouting)}));
  return open?retained.map(q=>{const health=opticalOpeningHealth(q.ink,p);return {...q,open:health,cost:q.cost+health.openingCost+health.axisCost};}).sort((a,b)=>a.cost-b.cost):retained;
 }
 if(!fitted)return ranked.slice(0,24);
 const above=ranked.filter(q=>q.ink.contour!.side===-1),below=ranked.filter(q=>q.ink.contour!.side===1);
 // Both viable sides survive early elimination. Total pool and combination
 // budgets stay unchanged; source-directed one-side pools may use all24.
 return (above.length&&below.length?[...above.slice(0,12),...below.slice(0,12)]:ranked.slice(0,24)).sort((a,b)=>a.cost-b.cost);
}
export function routeOpticalPhrases(score:QuantizedGridScore,p:ExpressionPlacement,bases:ExpressionInk[]):ExpressionInk[]{
 if(p.phraseRouting==='optical-breathing'||p.phraseRouting==='optical-silhouette'||p.phraseRouting==='optical-open'){
  const dynamics=(score.dynamics??[]).some((e,i)=>{
   const hairpin=e.kind==='hairpin'||(!e.kind&&['crescendo','decrescendo'].includes(e.mark)&&!!e.durationTicks);
   if(p.include&&!p.include(hairpin?'hairpin':'dynamic',`dynamic-${i}`))return false;
   return hairpin?e.tick+(e.durationTicks??0)>p.start&&e.tick<p.end:e.tick>=p.start&&e.tick<p.end;
  });
  const pedals=pedalIntervals(score).some((q,i)=>(!p.include||p.include('pedal',`pedal-${i}`))&&q.end>p.start&&q.start<p.end);
  p={...p,expressionFloorActive:dynamics||pedals};
 }
 const sides=new Map((score.phrases??[]).filter(q=>q.sourceSide).map(q=>[q.id,q.sourceSide==='above'?-1 as const:1 as const]));
 let cache:Map<string,ExpressionInk[]>|undefined,key:string|undefined;
 if(p.phraseRouting==='optical-breathing'||p.phraseRouting==='optical-silhouette'||p.phraseRouting==='optical-open'){
  key=JSON.stringify({policy:p.phraseRouting,placement:p.phrasePlacement,start:p.start,end:p.end,left:p.left,right:p.right,top:p.top,bottom:p.bottom,floor:p.expressionFloorActive,
   source:{phrases:score.phrases,dynamics:score.dynamics,pedals:score.pedals},obstacles:p.obstacles,balance:p.balanceObstacles,bases,domains:bases.map(q=>p.opticalDomain?.(q.id)),sides:[...sides]});
  cache=breathingRouteCache.get(score);if(!cache){cache=new Map();breathingRouteCache.set(score,cache);}
  const previous=cache.get(key);if(previous)return structuredClone(previous);
 }
 const pools=bases.map(base=>opticalPhraseCandidates(base,p,sides.get(base.id))),selected=new Map<number,{ink:ExpressionInk;cost:number}>();
 const order=bases.map((_,i)=>i).sort((a,b)=>pools[a].length-pools[b].length||bases[a].startTick-bases[b].startTick||bases[a].id.localeCompare(bases[b].id));let visits=0;
 const search=(at:number):boolean=>{if(at===order.length)return true;const index=order[at];
  for(const q of pools[index]){if(++visits>20000)return false;if([...selected.values()].some(other=>expressionsOverlap(q.ink,other.ink)))continue;
   selected.set(index,q);if(search(at+1))return true;selected.delete(index);}return false;};
 const solved=search(0);
 const result=bases.map((base,i)=>solved?selected.get(i)!.ink:{...(pools[i][0]?.ink??base),routingIssue:pools[i].length?'No compatible optical bow combination in bounded search.':'No complete optical bow clears musical ink inside its source neighborhood.'});
 if(cache&&key){if(cache.size>=64)cache.delete(cache.keys().next().value!);cache.set(key,structuredClone(result));return structuredClone(result);}
 return result;
}
