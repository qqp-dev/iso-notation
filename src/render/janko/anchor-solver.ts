/** Exact finite-state baseline for a declared readability proxy, not harmony. */
import type {QuantizedGridScore,QuantizedNote} from '../../model/types';
export const ANCHOR_TARGET='family-runs-v1';
export const RESET_COST=400;
export const DIGIT_COST=[0,180,120,15,15,60,100,15,70,70,120,160] as const;
export const FAMILIAR_FAMILIES=['047','037','036','048','047A','047B','037A','037B','036A','0369'] as const;
const familyMasks=new Set(FAMILIAR_FAMILIES.map(s=>[...s].reduce((m,c)=>m|(1<<parseInt(c,12)),0)));
export const linearPitch=(n:QuantizedNote)=>12*n.pitch.octave+n.pitch.pitchClass;
export const relativeClass=(pitch:number,reference:number)=>((pitch-reference)%12+12)%12;
export interface AnchorAction {bar:number;tick:number;pitch:number;ownerId:string;ownerIds:string[]}
export interface AnchorBar {bar:number;notes:QuantizedNote[];actions:AnchorAction[];forced:boolean}
export interface AnchorSolution {cost:number;resets:number;anchors:AnchorAction[];visitedTransitions:number}
export function prepareAnchorProblem(score:QuantizedGridScore,forcedBars?:readonly number[]):AnchorBar[] {
  const starts=score.sourceBarTicks;if(!starts||starts.length<2)throw Error('Anchor planning requires explicit source bars');
  const refreshes=forcedBars??[1,...(score.writtenPresentation?.repeats??[]).map(r=>r.startBar)];
  return starts.slice(0,-1).map((start,i)=>{
    const notes=score.notes.filter(n=>n.startTick>=start&&n.startTick<starts[i+1]).sort((a,b)=>a.startTick-b.startTick||linearPitch(a)-linearPitch(b)||a.id.localeCompare(b.id));
    if(!notes.length)throw Error(`Empty anchor bar${i+1}`);
    const events=new Map<string,QuantizedNote[]>();
    for(const n of notes){const key=`${n.startTick}:${linearPitch(n)}`;events.set(key,[...(events.get(key)??[]),n]);}
    const forced=refreshes.includes(i+1);
    const actions=[...events.values()].filter(ns=>!forced||ns[0].startTick===notes[0].startTick).map(ns=>({bar:i+1,tick:ns[0].startTick,pitch:linearPitch(ns[0]),ownerId:ns[0].id,ownerIds:ns.map(n=>n.id)}));
    return {bar:i+1,notes,actions,forced};
  });
}
export function referenceRunCost(notes:readonly QuantizedNote[],referenceClass:number):number {
  if(!notes.length)return 0;
  let mask=0,cost=0;
  for(const note of notes){const c=relativeClass(linearPitch(note),referenceClass);mask|=1<<c;cost+=DIGIT_COST[c];}
  return cost+(familyMasks.has(mask)?15:150)*notes.length;
}
export function anchorActionCost(bar:AnchorBar,incoming:number|null,action:AnchorAction|null):number {
  if(!action){if(incoming===null||bar.forced) return Infinity;return referenceRunCost(bar.notes,incoming);}
  // Refreshing the same class does not create a new dictionary run. Required
  // repeat-entry refreshes still paint, but segmentation alone earns no gain.
  if(incoming!==null&&relativeClass(action.pitch,0)===incoming)return RESET_COST+referenceRunCost(bar.notes,incoming);
  const prefix=bar.notes.filter(n=>n.startTick<action.tick),suffix=bar.notes.filter(n=>n.startTick>=action.tick);
  if(prefix.length&&incoming===null)return Infinity;
  return RESET_COST+(prefix.length?referenceRunCost(prefix,incoming!):0)+referenceRunCost(suffix,relativeClass(action.pitch,0));
}
function compare(a:AnchorSolution,b:AnchorSolution):number {
  if(a.cost!==b.cost)return a.cost-b.cost;if(a.resets!==b.resets)return a.resets-b.resets;
  for(let i=0;i<a.anchors.length;i++){const x=a.anchors[i],y=b.anchors[i];const d=x.bar-y.bar||x.tick-y.tick||x.pitch-y.pitch||x.ownerId.localeCompare(y.ownerId);if(d)return d;}
  return 0;
}
export function solveAnchors(bars:readonly AnchorBar[]):AnchorSolution {
  let states=new Map<number|null,AnchorSolution>([[null,{cost:0,resets:0,anchors:[],visitedTransitions:0}]]);let visits=0;
  for(const bar of bars){
    const next=new Map<number,AnchorSolution>();
    for(const [incoming,prior] of states)for(const action of [...(bar.forced?[]:[null]),...bar.actions]){
      if(action&&!bar.forced&&incoming===relativeClass(action.pitch,0))continue;
      const addition=anchorActionCost(bar,incoming,action);if(!Number.isFinite(addition))continue;visits++;
      const reference=action?relativeClass(action.pitch,0):incoming!;
      const proposal={cost:prior.cost+addition,resets:prior.resets+(action?1:0),anchors:action?[...prior.anchors,action]:prior.anchors,visitedTransitions:visits};
      const incumbent=next.get(reference);if(!incumbent||compare(proposal,incumbent)<0)next.set(reference,proposal);
    }
    if(!next.size)throw Error(`No causal anchor path at bar${bar.bar}`);states=next;
  }
  const best=[...states.values()].sort(compare)[0];if(!best)throw Error('Empty anchor problem');return {...best,visitedTransitions:visits};
}
