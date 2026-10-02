/** Preserved pre-optimization numeric query kernel. Independent reference for
 * exact floating arithmetic, positive-area boundary truth and cache mutation
 * tests; production never imports this module. */
import type {ExpressionInk} from '../../src/render/janko/elements/expressions';
/** Vertical interval occupied by a monotone two-cubic contour at page x. */
export function expressionSliceAtX(q:ExpressionInk,x:number):[number,number]|undefined {
  if(!q.contour || x<=q.contour.xStart || x>=q.contour.xEnd)return undefined;
  const c=q.contour,x0=c.xStart,x1=c.xEnd,ax=x0+(c.startIndent??c.indent),bx=x1-(c.endIndent??c.indent);
  let lo=0,hi=1;
  for(let i=0;i<32;i++){const u=(lo+hi)/2,v=1-u;
    const cx=v*v*v*x0+3*v*v*u*ax+3*v*u*u*bx+u*u*u*x1;if(cx<x)lo=u;else hi=u;}
  const u=(lo+hi)/2,v=1-u,axis=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(x-x0)/(x1-x0):c.yStart*(v*v*v+3*v*v*u)+c.yEnd*(3*v*u*u+u*u*u);
  const start=c.startDepth??c.depth,end=c.endDepth??c.depth;
  const outer=axis+c.side*(3*v*v*u*start+3*v*u*u*end)/.75;
  const inner=c.tipThickness===undefined?axis+c.side*(3*v*v*u*Math.max(0,start-c.thickness)+3*v*u*u*Math.max(0,end-c.thickness))/.75:
    outer-c.side*(c.tipThickness+(c.thickness-c.tipThickness)*4*u*v);
  return [Math.min(outer,inner),Math.max(outer,inner)];
}
export function expressionsOverlap(a:ExpressionInk,b:ExpressionInk):boolean {
  if(!a.contour || !b.contour)return expressionIntersectsBox(a,b)&&expressionIntersectsBox(b,a);
  const left=Math.max(a.contour.xStart,b.contour.xStart),right=Math.min(a.contour.xEnd,b.contour.xEnd);if(right<=left)return false;
  let previous:number|undefined;
  for(let i=1;i<256;i++){
    const x=left+(right-left)*i/256,aa=expressionSliceAtX(a,x)!,bb=expressionSliceAtX(b,x)!;
    if(Math.min(aa[1],bb[1])>Math.max(aa[0],bb[0]))return true;
    const difference=(aa[0]+aa[1]-bb[0]-bb[1])/2;
    if(previous!==undefined && previous*difference<0)return true;previous=difference;
  }
  return false;
}

/** Positive-area query of the actual tapered ribbon. Cubic boundaries are
 * flattened densely; unlike enclosure overlap, this never treats the air
 * under a local phrase as painted ink. */
export function expressionIntersectsBox(q: ExpressionInk,b:{x0:number;x1:number;y0:number;y1:number}):boolean {
  if(q.x0>=b.x1||q.x1<=b.x0||q.y0>=b.y1||q.y1<=b.y0)return false;
  if(q.strokeSegments)return q.strokeSegments.some(s=>polygonIntersectsBox(strokeSegmentPolygon(s),b))||!!q.pedalStartInk?.polygons.some(p=>polygonIntersectsBox(p,b));
  if(!q.contour)return true;
  const c=q.contour, points:number[][]=[];
  const sample=(u:number,inner:boolean)=>{
    const v=1-u,ax=c.xStart+(c.startIndent??c.indent),bx=c.xEnd-(c.endIndent??c.indent);
    const a=c.side*Math.max(0,(c.startDepth??c.depth)-(inner?c.thickness:0))/.75;
    const b=c.side*Math.max(0,(c.endDepth??c.depth)-(inner?c.thickness:0))/.75;
    const ay=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(ax-c.xStart)/(c.xEnd-c.xStart):c.yStart;
    const by=c.chordAligned?c.yStart+(c.yEnd-c.yStart)*(bx-c.xStart)/(c.xEnd-c.xStart):c.yEnd;
    const outer=v*v*v*c.yStart+3*v*v*u*(ay+c.side*(c.startDepth??c.depth)/.75)+3*v*u*u*(by+c.side*(c.endDepth??c.depth)/.75)+u*u*u*c.yEnd;
    const cy=inner&&c.tipThickness!==undefined?outer-c.side*(c.tipThickness+(c.thickness-c.tipThickness)*4*u*v):
      v*v*v*c.yStart+3*v*v*u*(ay+a)+3*v*u*u*(by+b)+u*u*u*c.yEnd;
    return [v*v*v*c.xStart+3*v*v*u*ax+3*v*u*u*bx+u*u*u*c.xEnd,cy];
  };
  for(let i=0;i<=128;i++)points.push(sample(i/128,false));
  for(let i=128;i>=0;i--)points.push(sample(i/128,true));
  return polygonIntersectsBox(points,b);
}
function strokeSegmentPolygon(s:NonNullable<ExpressionInk['strokeSegments']>[number]):number[][]{
 const length=Math.hypot(s.x1-s.x0,s.y1-s.y0)||1,dx=-(s.y1-s.y0)*s.width/(2*length),dy=(s.x1-s.x0)*s.width/(2*length);
 return [[s.x0+dx,s.y0+dy],[s.x1+dx,s.y1+dy],[s.x1-dx,s.y1-dy],[s.x0-dx,s.y0-dy]];
}
export function expressionStrokeBounds(s:NonNullable<ExpressionInk['strokeSegments']>[number]){
 const points=strokeSegmentPolygon(s);return {x0:Math.min(...points.map(p=>p[0])),x1:Math.max(...points.map(p=>p[0])),y0:Math.min(...points.map(p=>p[1])),y1:Math.max(...points.map(p=>p[1]))};
}
function polygonIntersectsBox(points:number[][],b:{x0:number;x1:number;y0:number;y1:number}):boolean{
  let poly=points;
  const clip=(axis:number,bound:number,sign:number)=>{
    const input=poly;poly=[];
    for(let i=0;i<input.length;i++){
      const a=input[i],z=input[(i+1)%input.length],da=sign*(a[axis]-bound),dz=sign*(z[axis]-bound);
      if(da>=0)poly.push(a);
      if((da<0&&dz>0)||(da>0&&dz<0)){const u=da/(da-dz);poly.push([a[0]+u*(z[0]-a[0]),a[1]+u*(z[1]-a[1])]);}
    }
  };
  clip(0,b.x0,1);clip(0,b.x1,-1);clip(1,b.y0,1);clip(1,b.y1,-1);
  let area=0;for(let i=0;i<poly.length;i++){const a=poly[i],z=poly[(i+1)%poly.length];area+=(a[0]-b.x0)*(z[1]-b.y0)-(z[0]-b.x0)*(a[1]-b.y0);}
  return Math.abs(area)>1e-9;
}

