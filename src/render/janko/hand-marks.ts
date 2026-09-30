/* Candidate-only event hand channel: the historical f33d9e0 burin chevron,
 * extended to every head, not just register crossings. RH ^ / LH v.
 * Stored finite stroke paths and conservative bounds feed paint and audits. */
import type { QuantizedGridScore } from '../../model/types';
import type { JankoSystemLayout } from './engine';
import type { InkBox } from './ink-scene';
import { f } from './elements/style';
export interface EventHandMark { ownerIds:string[]; hand:'RH'|'LH'; x:number; y:number; box:InkBox; refused:boolean }
export function placeEventHandMarks(layout:JankoSystemLayout,score:QuantizedGridScore,obstacles:readonly InkBox[],occupied:(box:InkBox)=>boolean=()=>false):EventHandMark[]{
 const sources=new Map(score.notes.map(n=>[n.id,n]));
 const out:EventHandMark[]=[];
 const overlaps=(a:InkBox,b:InkBox)=>a.x0<b.x1+.4&&a.x1>b.x0-.4&&a.y0<b.y1+.4&&a.y1>b.y0-.4;
 for(const p of layout.notes){
  const ownerIds=[p.note.id,...layout.unisonMerges.filter(m=>m.survivorId===p.note.id).flatMap(m=>m.mergedIds)];
  const hands=[...new Set(ownerIds.map(id=>sources.get(id)?.editorialHand?.hand??sources.get(id)?.hand??p.note.hand))].sort();
  for(const hand of hands){
   const seats=[[9.7,-1.4],[-9.7,-1.4],[9.7,1.4],[-9.7,1.4],[6.2,-1.4],[-6.2,-1.4],[6.2,1.4],[-6.2,1.4],[0,-6.2],[0,6.2],[6.2,0],[-6.2,0],[9.7,0],[-9.7,0],[7.5,-7.5],[-7.5,-7.5],[7.5,7.5],[-7.5,7.5],[0,-9.7],[0,9.7],[12,-7],[-12,7],[-12,-7],[12,7],[0,-13],[0,13],[6.2,-6.2],[-6.2,-6.2],[6.2,6.2],[-6.2,6.2]];
   let mark:EventHandMark|undefined;
   for(const [dx,dy] of seats){const x=p.x+dx,y=p.y+dy;const box={x0:x-2.7,x1:x+2.7,y0:y-2,y1:y+2};
    const candidate={ownerIds,hand,x,y,box,refused:false};mark??=candidate;
    const distance=Math.hypot(dx,dy);
    const uniquelyOwned=!layout.notes.some(n=>!ownerIds.includes(n.note.id)&&Math.hypot(n.x-x,n.y-y)<distance+.5);
    if(uniquelyOwned&&!occupied({x0:box.x0-.4,x1:box.x1+.4,y0:box.y0-.4,y1:box.y1+.4})&&![...obstacles,...out.map(m=>m.box)].some(b=>overlaps(box,b))){mark=candidate;break;}
    mark.refused=true;
   }
   out.push(mark!);
  }
 }
 return out;
}
export function eventHandMarksSvg(marks:readonly EventHandMark[]):string{
 return marks.map(m=>{const d=m.hand==='RH'?-1:1;return `    <path class="janko-event-hand chevron-${m.hand==='RH'?'up':'down'}" d="M ${f(m.x-2.1)} ${f(m.y-d*1.4)} L ${f(m.x)} ${f(m.y+d*1.4)} L ${f(m.x+2.1)} ${f(m.y-d*1.4)}" fill="none" stroke="#111111" stroke-width="1.20" stroke-linecap="round" stroke-linejoin="round" data-hand="${m.hand}" data-hand-owners="${m.ownerIds.join(',')}"/>`;}).join('\n');
}
