/* Partial placed connective family: straight chord bridges and clasp bracket shells.
 * Duration marks, rails, rests and later erasures are NOT globally covered. */
import { f } from './elements/style';
import type { JankoChordBridge, JankoClaspGroupGeometry } from './elements/rhythm';
import type { QuantizedNote } from '../../model/types';
import type { InkBox } from './ink-scene';

export interface PlacedChordBridge {
  readonly kind: 'chord-bridge';
  readonly ownerIds: readonly string[];
  readonly sourceNotes: readonly (Pick<QuantizedNote, 'id' | 'startTick' | 'sourceProvenance' | 'editorialHand'> | undefined)[];
  readonly tick?: number;
  readonly system: number;
  readonly pagePiece: number;
  readonly layer: 'rhythm-bridge';
  /** These coordinates are the numbers actually emitted by SVG's f() projection. */
  stroke: { x: number; y1: number; y2: number; width: number; cap: 'butt' };
}

const projected = (n: number): number => Number(f(n));

export function placedChordBridges(
  bridges: readonly JankoChordBridge[], system: number, pagePiece: number,
  owners: ReadonlyMap<string, QuantizedNote> = new Map(),
  strokeWidth = 0.90
): PlacedChordBridge[] {
  return bridges.map(b => ({
    kind: 'chord-bridge', ownerIds: [...b.noteIds],
    sourceNotes: b.noteIds.map(id => {
      const n = owners.get(id);
      return n && { id: n.id, startTick: n.startTick, sourceProvenance: n.sourceProvenance, editorialHand: n.editorialHand };
    }),
    tick: owners.get(b.noteIds[0])?.startTick,
    system, pagePiece, layer: 'rhythm-bridge',
    stroke: { x: projected(b.x), y1: projected(b.y1), y2: projected(b.y2), width: projected(strokeWidth), cap: 'butt' },
  }));
}

/** The stored stroke is the sole source for both serialization and queries. */
export function chordBridgeSvg(piece: PlacedChordBridge): string {
  const s = piece.stroke;
  return `      <line class="janko-chord-bridge" data-bridge-notes="${piece.ownerIds.join(',')}" x1="${f(s.x)}" y1="${f(s.y1)}" x2="${f(s.x)}" y2="${f(s.y2)}" stroke="#111111" stroke-width="${s.width.toFixed(2)}" stroke-linecap="butt"/>`;
}
export function chordBridgesSvg(pieces: readonly PlacedChordBridge[]): string {
  if (!pieces.length) return '';
  return ['    <g class="janko-chord-bridges">', ...pieces.map(chordBridgeSvg), '    </g>'].join('\n');
}
export function chordBridgeBox(piece: PlacedChordBridge): InkBox {
  const s = piece.stroke;
  return { x0: s.x - s.width / 2, x1: s.x + s.width / 2,
    y0: Math.min(s.y1, s.y2), y1: Math.max(s.y1, s.y2) };
}
/** Strict guards refuse boundary/tangency instead of silently declaring clear. */
export function chordBridgeAt(piece: PlacedChordBridge, x: number, y: number): 'ink' | 'clear' | 'unknown' {
  if (![x, y].every(Number.isFinite)) return 'unknown';
  const b = chordBridgeBox(piece), tolerance = 1e-8;
  const separation = Math.max(b.x0-x, x-b.x1, b.y0-y, y-b.y1);
  if (separation > tolerance) return 'clear';
  if (Math.min(x-b.x0, b.x1-x, y-b.y0, b.y1-y) > tolerance) return 'ink';
  return 'unknown';
}
export function chordBridgeBoxAt(piece: PlacedChordBridge, query: InkBox): 'ink' | 'clear' | 'unknown' {
  if (![query.x0, query.x1, query.y0, query.y1].every(Number.isFinite) ||
      query.x0 >= query.x1 || query.y0 >= query.y1) return 'unknown';
  const b = chordBridgeBox(piece), tolerance = 1e-8;
  if (query.x1 < b.x0-tolerance || query.x0 > b.x1+tolerance ||
      query.y1 < b.y0-tolerance || query.y0 > b.y1+tolerance) return 'clear';
  if (Math.min(query.x1,b.x1)-Math.max(query.x0,b.x0)>tolerance &&
      Math.min(query.y1,b.y1)-Math.max(query.y0,b.y0)>tolerance) return 'ink';
  return 'unknown';
}

/** The shell is a path of butt-ended subpaths with miter corners. Its owner
 * and mark state are explicit; a marked shell alone never proves clear paper. */
export interface PlacedClaspShell {
  readonly kind: 'clasp-shell';
  readonly ownerIds: readonly string[];
  readonly sourceNotes: readonly (Pick<QuantizedNote, 'id' | 'startTick' | 'sourceProvenance' | 'editorialHand'> | undefined)[];
  readonly tick: number;
  readonly system: number;
  readonly pagePiece: number;
  readonly layer: 'rhythm-clasp';
  readonly marked: boolean;
  stroke: { x: number; top: number; bottom: number; cap: number; width: number; gaps: Array<{from:number;to:number}> };
}
export function claspHasMarks(group:JankoClaspGroupGeometry):boolean {
  // An unresolved/compatibility mark list cannot certify an empty group:
  // renderClaspDurationInk resolves its fallback from durationTicks separately.
  if(!group.durationInk?.length)return true;
  return group.durationInk.some(ink=>ink.flags>0||ink.pips>0||ink.dotted||
    ('compactCuts' in ink && (ink.compactCuts>0||ink.compactRings>0)));
}
export function placedClaspShell(group:JankoClaspGroupGeometry,system=-1,pagePiece=-1,
  owners:ReadonlyMap<string,QuantizedNote>=new Map()):PlacedClaspShell {
  return {kind:'clasp-shell',ownerIds:group.notes.map(n=>n.id),
    sourceNotes:group.notes.map(n=>{
      const source=owners.get(n.id);
      return source && {id:source.id,startTick:source.startTick,sourceProvenance:source.sourceProvenance,editorialHand:source.editorialHand};
    }),tick:group.tick,system,pagePiece,layer:'rhythm-clasp',marked:claspHasMarks(group),
    stroke:{x:group.claspX,top:group.topY,bottom:group.botY,cap:group.capWidth,
      width:group.strokeWidth,gaps:group.spineGaps.map(g=>({...g}))}};
}
/** Construct the path from placed geometry, not from the renderer's cached group.path. */
function shellSubpaths(s:PlacedClaspShell['stroke']):Array<Array<[number,number]>> {
  const cuts=s.gaps.map(g=>({from:Math.max(s.top,g.from),to:Math.min(s.bottom,g.to)}))
    .filter(g=>g.to>g.from+1e-9).sort((a,b)=>a.from-b.from);
  if(!cuts.length)return [[[s.x+s.cap,s.top],[s.x,s.top],[s.x,s.bottom],[s.x+s.cap,s.bottom]]];
  const parts:Array<Array<[number,number]>>=[];
  let cursor=s.top;
  for(const cut of cuts){
    const from=Math.max(cursor,cut.from);
    parts.push(cursor===s.top?[[s.x+s.cap,s.top],[s.x,s.top],[s.x,from]]:[[s.x,cursor],[s.x,from]]);
    cursor=Math.max(cursor,cut.to);
  }
  parts.push(cursor===s.top?[[s.x+s.cap,s.top],[s.x,s.top],[s.x,s.bottom],[s.x+s.cap,s.bottom]]:
    [[s.x,cursor],[s.x,s.bottom],[s.x+s.cap,s.bottom]]);
  return parts;
}
export function claspShellPath(piece:PlacedClaspShell):string {
  return shellSubpaths(piece.stroke).map(points=>points.map(([x,y],i)=>`${i?'L':'M'} ${f(x)} ${f(y)}`).join(' ')).join(' ');
}
export function claspShellSvg(piece:PlacedClaspShell):string {
  return `    <path class="janko-clasp" d="${claspShellPath(piece)}" fill="none" stroke="#111111" stroke-width="${piece.stroke.width.toFixed(2)}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
}
/** SVG-effective rectangles of each segment, plus the 90-degree miter joins.
 * These are isolated shell geometry, NOT a filled bracket enclosure. */
export function claspShellRects(piece:PlacedClaspShell):InkBox[] {
  const half=Number(f(piece.stroke.width))/2;
  const rects:InkBox[]=[];
  for(const path of shellSubpaths(piece.stroke)){
    const projected=path.map(([x,y])=>[projectedNumber(x),projectedNumber(y)] as const);
    for(let i=1;i<projected.length;i++){
      const [x0,y0]=projected[i-1],[x1,y1]=projected[i];
      if(y0===y1 && x0!==x1)rects.push({x0:Math.min(x0,x1),x1:Math.max(x0,x1),y0:y0-half,y1:y0+half});
      if(x0===x1 && y0!==y1)rects.push({x0:x0-half,x1:x0+half,y0:Math.min(y0,y1),y1:Math.max(y0,y1)});
    }
    // Mitered right angles at the cap/spine junctions fill the square
    // between perpendicular stroke strips (including their outer corner).
    for(let i=1;i<projected.length-1;i++){
      const [x,y]=projected[i];
      if(projected[i-1][0]!==projected[i+1][0] && projected[i-1][1]!==projected[i+1][1])
        rects.push({x0:x-half,x1:x+half,y0:y-half,y1:y+half});
    }
  }
  return rects;
}
const projectedNumber=(n:number)=>Number(f(n));
export function claspShellBox(piece:PlacedClaspShell):InkBox {
  const rects=claspShellRects(piece);
  return {x0:Math.min(...rects.map(r=>r.x0)),x1:Math.max(...rects.map(r=>r.x1)),
    y0:Math.min(...rects.map(r=>r.y0)),y1:Math.max(...rects.map(r=>r.y1))};
}
export function claspShellAt(piece:PlacedClaspShell,x:number,y:number):'ink'|'clear'|'unknown' {
  if(!Number.isFinite(x)||!Number.isFinite(y))return 'unknown';
  let boundary=false;
  for(const r of claspShellRects(piece)){
    if(x>r.x0+1e-8&&x<r.x1-1e-8&&y>r.y0+1e-8&&y<r.y1-1e-8)return 'ink';
    if(x>=r.x0-1e-8&&x<=r.x1+1e-8&&y>=r.y0-1e-8&&y<=r.y1+1e-8)boundary=true;
  }
  return boundary?'unknown':'clear';
}
export function claspShellBoxAt(piece:PlacedClaspShell,q:InkBox):'ink'|'clear'|'unknown' {
  if(![q.x0,q.x1,q.y0,q.y1].every(Number.isFinite)||q.x0>=q.x1||q.y0>=q.y1)return 'unknown';
  let tangent=false;
  for(const r of claspShellRects(piece)){
    const dx=Math.min(q.x1,r.x1)-Math.max(q.x0,r.x0);
    const dy=Math.min(q.y1,r.y1)-Math.max(q.y0,r.y0);
    if(dx>1e-8&&dy>1e-8)return 'ink';
    if(dx>=-1e-8&&dy>=-1e-8)tangent=true;
  }
  return tangent?'unknown':'clear';
}
/** Marked shells are only a partial family; never call the arc/ring/dot clear. */
export function claspGroupAt(piece:PlacedClaspShell,x:number,y:number):'ink'|'clear'|'unknown' {
  return piece.marked?'unknown':claspShellAt(piece,x,y);
}
