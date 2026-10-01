/* Candidate-only owning-route profiles. The hidden ribbon is semantic geometry,
 * never painted: visible polygons, bounds and queries all use the same pieces.
 * Stems win locally, not whole voices (the order can reverse at the next onset). */
import type { BeamPiece, BeamShape } from './beam-scene';
import { beamPieceIntersectsBox, beamStemBoxes } from './beam-scene';
import type { JankoBeamGroupGeometry } from './elements/rhythm';
import type { QuantizedNote } from '../../model/types';
import { f } from './elements/style';
export type DepthProfile = 'beveled' | 'dive';
type Point = readonly [number,number];
export interface DepthPort {
  frontId:string; frontOwnerIds:readonly string[];
  front:Extract<BeamShape,{kind:'stem'}>;
  entry:number; exit:number; leftShoulder:number; rightShoulder:number;
  /** Matched entry/exit at this rail's own level, not a reconstructed symbol. */
  hidden:readonly Point[];
}
export interface DepthRoute {
  rail:BeamPiece; profile:DepthProfile; level:number; direction:-1|1;
  ports:readonly DepthPort[]; visibleIds:readonly string[];
}
const round=(x:number)=>Number(f(x));
/** A clipped affine rail; this phase deliberately refuses contour rails. */
function edges(points:readonly Point[],x:number):[number,number] {
  const ys:number[]=[];
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(a[0]===x)ys.push(a[1]);
    if(a[0]!==b[0]&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0]))ys.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
  }
  if(ys.length<2)throw Error('Depth profile has no owning rail section');
  return [Math.min(...ys),Math.max(...ys)];
}
/** Exactly the polygon the painter/physical oracle must use for this interval. */
export function depthRibbon(route:Pick<DepthRoute,'rail'|'ports'|'profile'|'direction'>,from:number,to:number):[number,number][] {
  if(route.rail.shape.kind!=='rail')throw Error('Depth route requires a rail');
  const xs=[from,...route.ports.flatMap(p=>[p.leftShoulder,p.entry,p.exit,p.rightShoulder]).filter(x=>x>from&&x<to),to].sort((a,b)=>a-b);
  const unique=[...new Set(xs)];
  const sides=unique.map(x=>{
    const [top,bottom]=edges(route.rail.shape.kind==='rail'?route.rail.shape.points:[],x);
    let depth=0;
    for(const p of route.ports){
      if(x>=p.leftShoulder&&x<=p.rightShoulder)depth=Math.max(depth,x<p.entry?(x-p.leftShoulder)/(p.entry-p.leftShoulder):x>p.exit?(p.rightShoulder-x)/(p.rightShoulder-p.exit):1);
    }
    // Paired shallow faces recess to a narrow neck; dive additionally changes
    // the actual route plane, returns symmetrically, and preserves level count.
    const scale=1-depth*(route.profile==='beveled'?.58:.25);
    const center=(top+bottom)/2+(route.profile==='dive'?route.direction*.85*depth:0);
    return [[round(x),round(center-(bottom-top)*scale/2)],[round(x),round(center+(bottom-top)*scale/2)]] as const;
  });
  return [...sides.map(s=>[...s[0]] as [number,number]),...sides.reverse().map(s=>[...s[1]] as [number,number])];
}
export function profileDepthRoutes(groups:BeamPiece[][],beams:readonly JankoBeamGroupGeometry[],
  solos:readonly {id?:string;shape:Extract<BeamShape,{kind:'stem'}>;ownerIds?:readonly string[];hand:QuantizedNote['hand'];sourceVoice?:string}[],
  profile:DepthProfile,make:(data:Omit<BeamPiece,'svg'>)=>BeamPiece):DepthRoute[] {
  if(beams.some(b=>b.sharedCarrier||b.contourRails))throw Error('Depth profile refuses shared carriers or non-affine contours');
  const stems=[...groups.flatMap((parts,index)=>parts.flatMap(p=>p.shape.kind==='stem'?[{id:p.id,index,shape:p.shape,ownerIds:p.ownerIds}]:[])),
    ...solos.map(s=>({id:s.id??`solo:${s.ownerIds?.join(',')}`,index:-1,shape:s.shape,ownerIds:s.ownerIds??[]}))];
  const routes:DepthRoute[]=[];
  groups.forEach((parts,index)=>{groups[index]=parts.flatMap(rail=>{
    if(rail.shape.kind!=='rail')return [rail];
    if(rail.shape.points.length!==4)throw Error('Depth profile refuses non-affine rails');
    const points=rail.shape.points,x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0]));
    const own=stems.filter(s=>s.index===index||s.ownerIds.some(id=>rail.ownerIds.includes(id)));
    const foreign=stems.filter(s=>!own.includes(s)&&beamStemBoxes({shape:s.shape}).some(b=>beamPieceIntersectsBox(rail,b))).sort((a,b)=>a.shape.x-b.shape.x);
    if(!foreign.length){const {svg:_svg,...data}=rail;return [make({...data,id:`${rail.id}:overpass:0`,cls:`${rail.cls} janko-layered-rail`})];}
    const ports:DepthPort[]=foreign.map(s=>{
      // Actual foreground silhouette plus 0.90pt air on either side. Double
      // stems are measured by their two physical strokes, not nominal width.
      const boxes=beamStemBoxes({shape:s.shape});
      const entry=round(Math.min(...boxes.map(b=>b.x0))-.9),exit=round(Math.max(...boxes.map(b=>b.x1))+.9);
      return {frontId:s.id,frontOwnerIds:s.ownerIds,front:{...s.shape},entry,exit,leftShoulder:entry,rightShoulder:exit,hidden:[]};
    });
    if(ports.some((p,i)=>i>0&&p.entry-ports[i-1].exit<1.2))throw Error('Depth profile refused overlapping ports or short visible rail');
    for(const [i,p] of ports.entries()){
      const previous=ports[i-1],next=ports[i+1];
      if(p.entry-x0<1.2||x1-p.exit<1.2||previous&&p.entry-previous.exit<1.2)throw Error('Depth profile refused overlapping ports or short visible rail');
      if(own.some(s=>s.shape.x+s.shape.width/2>=p.entry&&s.shape.x-s.shape.width/2<=p.exit))throw Error('Depth profile refused loss of own join');
      // Fit shoulders in available rail, including air to the nearest own join.
      const left=Math.max(x0,previous?(previous.exit+p.entry)/2:x0,...own.filter(s=>s.shape.x<p.entry).map(s=>s.shape.x+s.shape.width/2+.2));
      const right=Math.min(x1,next?(p.exit+next.entry)/2:x1,...own.filter(s=>s.shape.x>p.exit).map(s=>s.shape.x-s.shape.width/2-.2));
      const length=profile==='beveled'?1.6:3.4;
      p.leftShoulder=round(Math.max(left,p.entry-length));p.rightShoulder=round(Math.min(right,p.exit+length));
      if(p.entry-p.leftShoulder<.6||p.rightShoulder-p.exit<.6)throw Error('Depth profile refused unreadably short recession face');
    }
    const route:DepthRoute={rail,profile,level:rail.level??1,direction:beams[index].direction,ports,visibleIds:[]};
    for(const p of ports)p.hidden=depthRibbon(route,p.entry,p.exit);
    const intervals:[number,number][]=[];let cursor=x0;
    for(const p of ports){intervals.push([cursor,p.entry]);cursor=p.exit;}intervals.push([cursor,x1]);
    const {svg:_svg,...data}=rail;
    const visible=intervals.map(([from,to],k)=>make({...data,id:`${rail.id}:depth:${k}`,cls:`${rail.cls} janko-depth-${profile}`,shape:{kind:'rail',points:depthRibbon(route,from,to)}}));
    route.visibleIds=visible.map(p=>p.id);routes.push(route);return visible;
  });});
  return routes;
}
