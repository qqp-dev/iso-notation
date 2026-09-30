import type { PositionedJankoNote } from './engine';
import { knockoutHalfExtents } from './engine';
import { getStemGeometry,type JankoBeamGroupGeometry } from './elements/rhythm';
import type { ResolvedJankoLayoutOptions,ResolvedJankoTokens } from './types';
type Point=readonly[number,number];
const snap=(n:number)=>Number(n.toFixed(2));
/** Mitered offset of a monotone centreline. Plateau shoulders keep the acute
 * joints away from heads; no normal-width collapse on steep ribbon ramps. */
function offset(points:readonly Point[],distance:number):Point[]{
 const normals=points.slice(1).map((p,k)=>{const a=points[k],dx=p[0]-a[0],dy=p[1]-a[1],len=Math.hypot(dx,dy);return [-dy/len,dx/len] as Point;});
 return points.map((p,k)=>{const a=normals[Math.max(0,k-1)],b=normals[Math.min(k,normals.length-1)],denom=1+a[0]*b[0]+a[1]*b[1];
  if(denom<.1)throw Error(`Bent ribbon refuses folded-back miter at (${p[0].toFixed(2)},${p[1].toFixed(2)}), normal denominator ${denom.toFixed(4)}`);
  return [snap(p[0]+distance*(a[0]+b[0])/denom),snap(p[1]+distance*(a[1]+b[1])/denom)];});
}
export function bendRhRibbons(beams:JankoBeamGroupGeometry[],heads:readonly PositionedJankoNote[],o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens,survivor:(id:string)=>string):JankoBeamGroupGeometry[]{
 return beams.map(b=>{
  if(b.direction!==-1||!b.notes.some(n=>n.sourceVoice?.endsWith('.1')))return b;
  const lo=Math.min(...b.stems.map(s=>s.stemX)),hi=Math.max(...b.stems.map(s=>s.stemX)),knots=new Map<number,number>();
  for(const n of b.notes){const s=getStemGeometry(n,t),p=heads.find(h=>h.note.id===survivor(n.id));if(!p)throw Error(`Bent ribbon owner missing ${n.id}`);
   const m=knockoutHalfExtents(o,t,n.startTick,p);
   for(const x of [s.stemX-m.wx-1.8,s.stemX,s.stemX+m.wx+1.8])if(x>=lo&&x<=hi)knots.set(x,s.stemEndY);
  }
  for(const h of heads.filter(h=>h.note.hand==='RH'&&!b.notes.some(n=>survivor(n.id)===h.note.id))){
   const m=knockoutHalfExtents(o,t,h.note.startTick,h),y=h.y+m.hy+2.4;
   for(const x of [h.x-m.wx-1.2,h.x,h.x+m.wx+1.2])if(x>lo&&x<hi)knots.set(x,y);
  }
  const points=[...knots].sort((a,z)=>a[0]-z[0]) as Point[];
  const yAt=(x:number)=>{if(x<=points[0][0])return points[0][1];for(let k=1;k<points.length;k++)if(x<=points[k][0]){const a=points[k-1],z=points[k];return a[1]+(z[1]-a[1])*(x-a[0])/(z[0]-a[0]);}return points.at(-1)![1];};
  const rails=b.levels.map(level=>{
   const {x1,x2}=level.connector,a=Math.min(x1,x2),z=Math.max(x1,x2);
   const spine:Point[]=[[a,yAt(a)],...points.filter(p=>p[0]>a&&p[0]<z),[z,yAt(z)]];
   const distance=(level.level-1)*(t.beamThickness+1.6),outer=offset(spine,distance+t.beamThickness/2),inner=offset(spine,distance-t.beamThickness/2);
   return {level:level.level,stub:level.stub,points:[...outer,...inner.reverse()]};
  });
  return {...b,beamY:yAt,contourRails:rails,stems:b.notes.map(n=>{const s=getStemGeometry(n,t);return {...s,stemEndY:yAt(s.stemX)};})};
 });
}
