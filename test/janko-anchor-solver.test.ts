import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DIGIT_COST,FAMILIAR_FAMILIES,RESET_COST,prepareAnchorProblem,solveAnchors,anchorActionCost,referenceRunCost,type AnchorBar,type AnchorAction} from '../src/render/janko/anchor-solver';
import type {QuantizedGridScore,QuantizedNote} from '../src/model/types';

const note=(id:string,tick:number,pitch:number)=>({id,startTick:tick,durationTicks:1,pitch:{pitchClass:pitch%12,octave:Math.floor(pitch/12)}} as QuantizedNote);
const bar=(index:number,pitches:number[],forced=false):AnchorBar=>{
  const notes=pitches.map((p,i)=>note(`${index}:${i}`,index*10+i,p));
  return {bar:index+1,notes,forced,actions:notes.filter((_,i)=>!forced||i===0).map(n=>({bar:index+1,tick:n.startTick,pitch:n.pitch.octave*12+n.pitch.pitchClass,ownerId:n.id,ownerIds:[n.id]}))};
};
// Independent literal exhaustive evaluation: enumerate every legal itinerary,
// compute digit and complete-family costs directly, then rank complete paths.
function exhaustive(bars:AnchorBar[]){
  const families=FAMILIAR_FAMILIES.map(s=>[...s].map(c=>parseInt(c,12)).sort((a,b)=>a-b).join(','));
  const run=(notes:QuantizedNote[],reference:number)=>{
    const values=notes.map(n=>((12*n.pitch.octave+n.pitch.pitchClass-reference)%12+12)%12);
    return values.reduce((sum,c)=>sum+DIGIT_COST[c],0)+(families.includes([...new Set(values)].sort((a,b)=>a-b).join(','))?15:150)*values.length;
  };
  const complete:{cost:number;anchors:AnchorAction[]}[]=[];
  function visit(i:number,ref:number|null,cost:number,anchors:AnchorAction[]){
    if(i===bars.length){complete.push({cost,anchors});return;}
    const b=bars[i];
    if(ref!==null&&!b.forced)visit(i+1,ref,cost+run(b.notes,ref),anchors);
    for(const a of b.actions){
      const next=a.pitch%12;if(!b.forced&&next===ref)continue;
      const before=b.notes.filter(n=>n.startTick<a.tick),after=b.notes.filter(n=>n.startTick>=a.tick);
      if(ref===null&&before.length)continue;
      const value=next===ref?run(b.notes,next):(before.length?run(before,ref!):0)+run(after,next);
      visit(i+1,next,cost+RESET_COST+value,[...anchors,a]);
    }
  }
  visit(0,null,0,[]);
  complete.sort((a,b)=>{
    const d=a.cost-b.cost||a.anchors.length-b.anchors.length;if(d)return d;
    for(let i=0;i<a.anchors.length;i++){const x=a.anchors[i],y=b.anchors[i],v=x.bar-y.bar||x.tick-y.tick||x.pitch-y.pitch||x.ownerId.localeCompare(y.ownerId);if(v)return v;}
    return 0;
  });return complete[0];
}
test('exact finite-state solver agrees with exhaustive complete itineraries',()=>{
  let random=1977;
  for(let trial=0;trial<24;trial++){
    const bars=Array.from({length:4},(_,b)=>bar(b,Array.from({length:3},()=>{random=(1664525*random+1013904223)>>>0;return 36+random%12;}),b===0||trial%3===0&&b===2));
    const expected=exhaustive(bars),actual=solveAnchors(bars);
    assert.equal(actual.cost,expected.cost);assert.deepEqual(actual.anchors,expected.anchors);
  }
});
test('complete family recognition scales with content and cannot be earned by same-class segmentation',()=>{
  const b=bar(1,[36,40,43,36,36,40,43],true),action=b.actions[0];
  assert.equal(anchorActionCost(b,0,action),RESET_COST+referenceRunCost(b.notes,0));
  // A singleton generic prefix would change the score if this were split,
  // even though reference and displayed digits never changed.
  const later={...action,tick:b.notes[3].startTick};
  assert.equal(anchorActionCost(b,0,later),RESET_COST+referenceRunCost(b.notes,0));
  assert.equal(referenceRunCost([note('one',0,36)],0),150);
  assert.equal(referenceRunCost([note('a',0,36),note('b',1,40)],0),315);
  const problem=[bar(0,[36,40,43],true),b];
  assert.deepEqual(solveAnchors(problem).anchors,exhaustive(problem).anchors);
  assert.equal(solveAnchors(problem).anchors.length,2,'required same-class refresh still paints');
  b.forced=false;assert.equal(solveAnchors(problem).anchors.length,1,'optional same-class refresh is dominated');
});
test('required refreshes derive from written repeat entrances and preserve simultaneous aliases',()=>{
  const notes=[note('b1',0,43),note('b2a',10,48),note('b2b',10,48),note('b3',20,50)];
  const score={notes,sourceBarTicks:[0,10,20,30],writtenPresentation:{repeats:[{startBar:3,endBar:3,times:2}]}} as unknown as QuantizedGridScore;
  const bars=prepareAnchorProblem(score);
  assert.deepEqual(bars.map(b=>b.forced),[true,false,true]);
  assert.deepEqual(bars[1].actions[0].ownerIds,['b2a','b2b']);
  assert.deepEqual(prepareAnchorProblem(score,[1,2]).map(b=>b.forced),[true,true,false]);
});
