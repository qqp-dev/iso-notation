import type {JankoSystemLayout} from './engine';
import {knockoutHalfExtents,systemPaintedInkBoxes} from './engine';
import {buildInkScene} from './ink-scene';
import {beamPieceBox} from './beam-scene';
import {getStemGeometry,subdivisionMarkCount} from './elements/rhythm';
import type {ResolvedJankoLayoutOptions,ResolvedJankoTokens} from './types';

/** A shared visible head is not a shared duration branch. Resolve the actual
 * written owners first and include every eligible beam level at their seat. */
export function sourcePhraseEndpointEnvelope(layout:JankoSystemLayout,ids:readonly string[],tick:number,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens){
 const owners=new Set(ids);
 for(const chain of layout.tieChains??[])if(owners.has(chain.noteId))for(const c of chain.components)if(c.startTick===tick)owners.add(c.headId);
 let notes=[...layout.notes,...layout.unisonVoices].filter(n=>owners.has(n.note.id)&&n.note.startTick===tick);
 if(!notes.length){for(const m of layout.unisonMerges)if(m.mergedIds.some(id=>owners.has(id)))owners.add(m.survivorId);
  notes=layout.notes.filter(n=>owners.has(n.note.id)&&n.note.startTick===tick);}
 if(!notes.length)return undefined;
 const ys=notes.flatMap(n=>{
  const mask=knockoutHalfExtents(o,t,n.note.startTick,n),stem=getStemGeometry(n.rhythm,t),beam=layout.beams.find(b=>b.notes.some(q=>q.id===n.note.id));
  const ends=[n.y-mask.hy,n.y+mask.hy];
  if(beam){
   const marks=subdivisionMarkCount(n.rhythm.durationTicks,o.durationGrammar);
   for(const level of beam.levels.filter(l=>l.level<=marks)){
    const c=level.connector,x=stem.stemX;
    if(x<Math.min(c.x1,c.x2)-.5||x>Math.max(c.x1,c.x2)+.5)continue;
    const y=c.y1+(c.y2-c.y1)*(x-c.x1)/(c.x2-c.x1);
    ends.push(y-t.beamThickness/2,y+t.beamThickness/2);
   }
  }else ends.push(stem.stemEndY);
  return ends;
 });
 return {top:Math.min(...ys),bottom:Math.max(...ys),hand:notes[0].rhythm.hand};
}

/** Narrow conservative enclosures of the settled rail polygons, not the large
 * empty corners of one whole sloping-rail AABB. Each strip encloses the actual
 * painted polygon at its x interval; this is clearance admission, not a claim
 * that the enclosure itself is ink. */
export function phraseMusicObstacles(layout:JankoSystemLayout,o:ResolvedJankoLayoutOptions,t:ResolvedJankoTokens){
 const boxes=systemPaintedInkBoxes(layout,o,t).filter(b=>!b.what.startsWith('expression ')&&!/:pitch:|:beat-pulses:|:measure-barlines:/.test(b.what));
 const rails=buildInkScene(layout,o,t).beams.flat().filter(p=>p.shape.kind==='rail');
 const map=new Map(rails.map(p=>[`visible grouped-beam ${p.id}`,p]));
 return boxes.flatMap(b=>{
  const piece=map.get(b.what);if(!piece||piece.shape.kind!=='rail')return [b];
  const polygon=piece.shape.points,bounds=beamPieceBox(piece),width=bounds.x1-bounds.x0,count=Math.ceil(width/.75);
  const edges=[bounds.x0,...Array.from({length:count-1},(_,i)=>bounds.x0+width*(i+1)/count),...polygon.map(p=>p[0]),bounds.x1].sort((a,b)=>a-b);
  return edges.slice(1).flatMap((right,i)=>{
   const left=edges[i];if(right-left<1e-9)return [];
   const ys:number[]=[];
   for(let k=0;k<polygon.length;k++){
    const a=polygon[k],z=polygon[(k+1)%polygon.length];
    if(a[0]>=left&&a[0]<=right)ys.push(a[1]);
    if(a[0]!==z[0])for(const x of [left,right])if(x>=Math.min(a[0],z[0])&&x<=Math.max(a[0],z[0]))ys.push(a[1]+(z[1]-a[1])*(x-a[0])/(z[0]-a[0]));
   }
   return ys.length?[{x0:left,x1:right,y0:Math.min(...ys),y1:Math.max(...ys),what:b.what}]:[];
  });
 });
}
