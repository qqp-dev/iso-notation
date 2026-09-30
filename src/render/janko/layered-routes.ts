/* Actual monochrome over/under convention. Only the intersected rail polygons
 * lose ink; stems stay whole. No white masks or SVG-only routing decisions. */
import type { QuantizedNote } from '../../model/types';
import { subdivisionMarkCount,type JankoBeamGroupGeometry } from './elements/rhythm';
import type { BeamPiece, BeamShape } from './beam-scene';
import { beamPieceIntersectsBox,beamStemBoxes } from './beam-scene';
import { f } from './elements/style';
const clip=(points:readonly (readonly [number,number])[],x:number,sign:number):[number,number][]=>{
 const out:[number,number][]=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=sign*(a[0]-x),db=sign*(b[0]-x);
  if(da>=0)out.push([a[0],a[1]]);if(da*db<0){const u=da/(da-db);out.push([x,a[1]+u*(b[1]-a[1])]);}
 }return out;
};
export function overpassRailFragments(groups:BeamPiece[][],beams:readonly JankoBeamGroupGeometry[],
 solos:readonly {shape:Extract<BeamShape,{kind:'stem'}>;hand:QuantizedNote['hand'];sourceVoice?:string;ownerIds?:readonly string[]}[],make:(p:Omit<BeamPiece,'svg'>)=>BeamPiece):void{
 const stems=[...groups.flatMap((pieces,index)=>pieces.filter(p=>p.shape.kind==='stem').map(p=>({index,shape:p.shape as Extract<BeamShape,{kind:'stem'}>,ownerIds:p.ownerIds,hand:beams[index].notes[0].hand,sourceVoice:beams[index].notes[0].sourceVoice}))),...solos.map(s=>({...s,index:-1}))];
 groups.forEach((pieces,index)=>{groups[index]=pieces.flatMap(p=>{
  if(p.shape.kind!=='rail')return [p];let polygons=[p.shape.points];
  for(const s of stems){
   const note=s.index>=0?beams[s.index].notes.find(n=>n.id===s.ownerIds?.[0]):undefined;
   const ineligibleOwn=s.index===index&&beams[index].sharedCarrier&&(p.level??1)>subdivisionMarkCount(note?.durationTicks??48,'complete');
   if(!ineligibleOwn&&(s.index===index||p.ownerIds.includes(s.ownerIds?.[0]??'')))continue;
   const boxes=beamStemBoxes({shape:s.shape});if(!boxes.some(b=>beamPieceIntersectsBox(p,b)))continue;
   polygons=polygons.flatMap(poly=>[clip(poly,s.shape.x-2.2,-1),clip(poly,s.shape.x+2.2,1)]).filter(poly=>poly.length>=3);
  }
  const {svg:_svg,...data}=p;
  return polygons.map((points,k)=>make({...data,id:`${p.id}:overpass:${k}`,cls:`${p.cls} janko-layered-rail`,shape:{kind:'rail',points:points.map(([x,y])=>[Number(f(x)),Number(f(y))] as [number,number])}}));
 });});
}
