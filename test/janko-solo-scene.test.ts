import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { buildDurationSpecimenScore } from '../src/scores/duration-specimen';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { computePageGeometry, layoutJankoScore, renderSystem, systemPaintedInkBoxes, suppressedStemIds, claspMemberCarriedTicks } from '../src/render/janko/engine';
import { buildInkScene, sceneSoloSvg, sceneSoloAt, sceneSoloBoxAt, requireSceneCoverage } from '../src/render/janko/ink-scene';
import { soloRhythmPaint, soloBox, soloPieceAt, soloPieceBoxAt } from '../src/render/janko/solo-scene';
import { renderFlags } from '../src/render/janko/elements/rhythm';
import { checkDotCountAgreement, checkStemRingGeometry } from '../src/render/janko/linter';

const t=resolveJankoTokens(DEFAULT_JANKO_TOKENS);
const note={id:'solo-witness',startTick:48,durationTicks:3,hand:'RH' as const,x:80,y:100,dotX:95,dotY:95,dot2X:98,dot2Y:95,stemAttachR:3};
const box=(x:number,y:number,r=.02)=>({x0:x-r,y0:y-r,x1:x+r,y1:y+r});

test('five real dialect keys: independent literal SVG path controls, metadata, 1–4 marks and both hands',()=>{
  const styles=['classical-urtext','kinetic-tab-30','kinetic-tab-45','kinetic-tab-beam','kinetic-tab-tapered'] as const;
  for(const style of styles)for(const hand of ['RH','LH'] as const)for(const [duration,marks] of [[24,1],[12,2],[6,3],[3,4]] as const){
    const n={...note,hand,durationTicks:duration};
    const pieces=soloRhythmPaint(n,t,style,'complete');
    assert.equal(pieces[0].shape.kind,'stem');
    const flags=pieces.filter(p=>p.shape.kind==='flag');
    assert.equal(flags.length,style==='classical-urtext'?1:marks);
    assert.equal(pieces.map(p=>p.svg).join('\n'),renderFlags(n,t,style,'complete'));
    const golden=soloRhythmPaint(n,t,style,'golden');
    assert.equal(golden.map(p=>p.svg).join('\n'),renderFlags(n,t,style,'golden'));
    assert.equal(golden.filter(p=>p.shape.kind==='flag').length,style==='classical-urtext'?1:marks);
    assert.ok(pieces.every(p=>p.noteId===n.id&&p.ownerIds[0]===n.id&&p.tick===48&&p.durationTicks===duration&&p.grammar==='complete'));
    for(const flag of flags){
      assert.match(flag.svg,/class="janko-flag".*data-stem-x="80.00".*d="M .*C .* Z".*fill="#111111" stroke="none"/);
      if(style==='classical-urtext')assert.match(flag.svg,new RegExp(`data-flag-count="${marks}".*fill-rule="evenodd"`));
      const hull=soloBox(flag);
      assert.equal(soloPieceAt(flag,hull.x1+0.01,(hull.y0+hull.y1)/2).status,'clear');
      assert.equal(soloPieceAt(flag,(hull.x0+hull.x1)/2,(hull.y0+hull.y1)/2).status,'unknown');
      assert.equal(soloPieceBoxAt(flag,box(hull.x1+0.1,(hull.y0+hull.y1)/2)).status,'clear');
      assert.equal(soloPieceBoxAt(flag,box((hull.x0+hull.x1)/2,(hull.y0+hull.y1)/2)).status,'unknown');
    }
  }
});

// Independent SVG path pixel oracle for test witnesses only: cubic flattening
// plus SVG evenodd parity. Production intentionally does NOT claim positive
// cubic occupancy from its control hull.
function svgPixelInside(d:string,x:number,y:number):boolean {
  const tokens=d.match(/[MCZ]|-?\d+(?:\.\d+)?/g)??[];
  let k=0,first:[number,number]=[0,0],last:[number,number]=[0,0],poly:[number,number][]=[],inside=false;
  const close=()=>{
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    poly=[];
  };
  while(k<tokens.length){const cmd=tokens[k++];
    if(cmd==='M'){last=[Number(tokens[k++]),Number(tokens[k++])];first=last;poly=[last];}
    else if(cmd==='C'){
      const a:[number,number]=[Number(tokens[k++]),Number(tokens[k++])],b:[number,number]=[Number(tokens[k++]),Number(tokens[k++])],e:[number,number]=[Number(tokens[k++]),Number(tokens[k++])];
      const start=last;
      for(let step=1;step<=128;step++){const u=step/128,v=1-u;
        poly.push([v*v*v*start[0]+3*v*v*u*a[0]+3*v*u*u*b[0]+u*u*u*e[0],
          v*v*v*start[1]+3*v*v*u*a[1]+3*v*u*u*b[1]+u*u*u*e[1]]);
      }last=e;
    }else if(cmd==='Z'){poly.push(first);close();}
    else throw new Error(`Unexpected SVG path command ${cmd}`);
  }
  return inside;
}

test('independent SVG pixel geometry sees actual flag lobe and hollow counter; scene hull cannot certify either',()=>{
  for(const marks of [1,2,3,4]){
    const flag=soloRhythmPaint({...note,durationTicks:[24,12,6,3][marks-1]},t,'classical-urtext','complete').find(p=>p.shape.kind==='flag')!;
    if(flag.shape.kind!=='flag')throw new Error('missing classical flag');
    const hull=soloBox(flag),step=.05;
    let positive:[number,number]|undefined,negative:[number,number]|undefined;
    for(let x=hull.x0+.2;x<hull.x1-.2;x+=step)for(let y=hull.y0+.2;y<hull.y1-.2;y+=step){
      if(svgPixelInside(flag.shape.d,x,y))positive??=[x,y];
      else if(marks>1&&svgPixelInside(flag.shape.d.match(/M [^Z]+Z/)?.[0]??'',x,y))negative??=[x,y];
    }
    assert.ok(positive,`SVG-positive flag ${marks}`);
    assert.equal(soloPieceAt(flag,...positive!).status,'unknown','production does not guess positive cubic');
    if(marks>1){assert.ok(negative);assert.equal(soloPieceAt(flag,...negative!).status,'unknown');}
  }
});

test('solo SVG-effective butt stem, white annulus, double dots and ordered repaint are bounded',()=>{
  const stem=soloRhythmPaint(note,t,'classical-urtext','golden')[0],shape=stem.shape;
  assert.equal(shape.kind,'stem');if(shape.kind!=='stem')return;
  const y=(shape.y1+shape.y2)/2;
  assert.equal(soloPieceAt(stem,shape.x,y).status,'ink');
  assert.equal(soloPieceAt(stem,shape.x+shape.width/2+0.01,y).status,'clear');
  assert.equal(soloPieceAt(stem,shape.x,Math.min(shape.y1,shape.y2)-0.01).status,'clear');
  assert.equal(soloPieceBoxAt(stem,box(shape.x,y)).status,'ink');
  assert.equal(soloPieceBoxAt(stem,box(shape.x+2,y)).status,'clear');
  assert.equal(soloPieceBoxAt(stem,{x0:0,x1:0,y0:1,y1:2}).status,'unknown');
  const long=soloRhythmPaint({...note,durationTicks:336},t,'classical-urtext','complete');
  assert.deepEqual(long.map(p=>p.shape.kind),['stem','ring','ring','dot','dot']);
  assert.ok(long[1].svg.includes('fill="#FFFFFF" stroke="#111111" stroke-width="1.00"'));
  for(const ring of long.slice(1,3)){
    if(ring.shape.kind!=='ring')continue;
    const {cx,cy,r,width}=ring.shape;
    assert.equal(soloPieceAt(ring,cx,cy).status,'clear');
    assert.equal(soloPieceAt(ring,cx+r,cy).status,'ink');
    assert.equal(soloPieceAt(ring,cx+r+width,y).status,'clear');
    assert.equal(soloPieceBoxAt(ring,box(cx+r,cy)).status,'ink');
    assert.equal(soloPieceBoxAt(ring,box(cx,cy)).status,'clear');
  }
  assert.match(long.at(-1)!.svg,/data-dot="2"/);
  for(const dot of long.slice(-2)){
    if(dot.shape.kind!=='dot')continue;
    assert.equal(soloPieceAt(dot,dot.shape.cx,dot.shape.cy).status,'ink');
    assert.equal(soloPieceAt(dot,dot.shape.cx+dot.shape.r+0.01,dot.shape.cy).status,'clear');
    assert.equal(soloPieceBoxAt(dot,box(dot.shape.cx,dot.shape.cy)).status,'ink');
  }
});

test('ordered white ring wipe, later dot repaint, strict grid channel and later head mask preserve survivors',()=>{
  const score=buildBachGoldbergVar1Score(),o=resolveJankoOptions({...DEFAULT_JANKO_OPTIONS,gridWritingPolicy:'strict-protected-grid'});
  const layout=layoutJankoScore(score,o,t)[0],scene=buildInkScene(layout,o,t,score);
  const id='synthetic-solo';
  const ring=soloRhythmPaint({...note,id,durationTicks:96},t,'classical-urtext','complete');
  const circle=ring.find(p=>p.shape.kind==='ring')!;
  if(circle.shape.kind!=='ring')throw Error('missing ring');
  const {cx,cy,r}=circle.shape;
  const fixture={...scene,solos:new Map([[id,ring]]),heads:new Map(),beat:[],barlines:[]};
  assert.equal(sceneSoloAt(fixture,id,cx,cy).status,'clear','white centre wipes earlier stem');
  assert.equal(sceneSoloAt(fixture,id,cx,cy+r).status,'ink','annulus repaints rim');
  assert.equal(sceneSoloAt(fixture,id,cx,cy+r+1).status,'ink','unwiped stem survives');
  assert.equal(sceneSoloBoxAt(fixture,id,box(cx,cy)).status,'clear');
  assert.equal(sceneSoloBoxAt(fixture,id,box(cx,cy+r)).status,'ink');
  const dot=soloRhythmPaint({...note,id,durationTicks:72,dotX:cx,dotY:cy},t,'classical-urtext','complete').find(p=>p.shape.kind==='dot')!;
  assert.equal(sceneSoloAt({...fixture,solos:new Map([[id,[...ring,dot]]])},id,cx,cy).status,'ink','later dot repaints white centre');
  const air=[...scene.beat,...scene.barlines].find(p=>p.primitive.kind==='erase'&&p.primitive.stroke)!;
  assert.ok(air);
  const s=air.primitive.kind==='erase'?air.primitive.stroke!:null;
  assert.ok(s);
  if(!s)return;
  const stem=ring[0],old=stem.shape;
  stem.shape={kind:'stem',x:s.x1,y1:s.y1,y2:s.y1+6,width:4};
  const strict={...fixture,beat:[air]};
  assert.equal(sceneSoloAt(strict,id,s.x1,s.y1+1).status,'clear','on-phase white grid air erases prior rhythm');
  assert.equal(sceneSoloAt(strict,id,s.x1+1.9,s.y1+1).status,'ink','adjacent stem survives');
  const mask=scene.heads.values().next().value!.find(p=>p.primitive.kind==='erase')!;
  const later={...fixture,heads:new Map([['later',[{...mask,primitive:{kind:'erase' as const,box:box(cx,cy+r),protects:'own-digit' as const}}]]])};
  assert.equal(sceneSoloAt(later,id,cx,cy+r).status,'clear','later head mask erases the rim only');
  assert.equal(sceneSoloAt(later,id,cx+r,cy).status,'ink','uncovered rim survives');
  stem.shape=old;
});

test('final score census, source inventory and mutation of stored paint without changing layout',()=>{
  for(const [score,options,tokens,expected] of [
    [buildBachGoldbergVar1Score(),DEFAULT_JANKO_OPTIONS,DEFAULT_JANKO_TOKENS,undefined],
    [buildBrahmsOp118No1Score(),BRAHMS_OP118_NO1_JANKO_OPTIONS,BRAHMS_OP118_NO1_JANKO_TOKENS,71],
    [buildDurationSpecimenScore(),DEFAULT_JANKO_OPTIONS,DEFAULT_JANKO_TOKENS,undefined],
  ] as const){
    const o=resolveJankoOptions(options),t=resolveJankoTokens(tokens),layouts=layoutJankoScore(score,o,t);
    let flags=0,stems=0,rings=0,dots=0;
    for(const layout of layouts){
      const scene=buildInkScene(layout,o,t,score),paint=renderSystem(score,layout.geometry,layout.index,o,t,layout,scene);
      for(const id of suppressedStemIds(layout))assert.equal(scene.solos.has(id),false,'suppressed member paints no solo pieces');
      for(const id of layout.handprintNoteIds??[])assert.equal(scene.solos.has(id),false,'handprint replacement paints no solo pieces');
      for(const clasp of layout.clasps)for(const member of clasp.notes){
        const group=scene.solos.get(member.id);
        if(!group)continue;
        const exception=o.chordGrouping==='per-hand-clasp'&&member.durationTicks!==claspMemberCarriedTicks(clasp,member.id);
        assert.equal(group[0].grammar,exception?o.durationGrammar:'golden','clasp ownership or true exception selects grammar');
      }
      for(const [id,group] of scene.solos){
        assert.ok(paint.includes(sceneSoloSvg(scene,id)));
        assert.ok(group.every(p=>p.ownerIds.length>0&&p.noteId===id));
        assert.ok(group.every(p=>p.sourceContributors.every(s=>
          score.notes.some(n=>n.id===s.id)||layout.notes.some(n=>n.note.id===s.id))));
        assert.ok(group.every(p=>p.sourceContributors.some(s=>s.id===id)),
          'authored or performed continuation occurrence has its own source fields');
        stems+=group.filter(p=>p.shape.kind==='stem').length;
        rings+=group.filter(p=>p.shape.kind==='ring').length;
        dots+=group.filter(p=>p.shape.kind==='dot').length;
        flags+=group.filter(p=>p.shape.kind==='flag').length;
      }
      if(scene.solos.size)assert.ok(systemPaintedInkBoxes(layout,o,t).some(b=>b.what.includes('beamed-solo nonphysical enclosure')));
    }
    const name=expected===71?'Brahms':score.notes.length>500?'Bach':'duration specimen';
    assert.deepEqual([stems,rings,flags,dots],name==='Brahms'?[188,0,71,0]:name==='Bach'?[38,0,34,19]:[20,0,4,1],
      `${name} final laid-out solo piece coverage`);
    if(expected!==undefined)assert.equal(flags,expected,'all five Brahms pages retain 71 glyphs');
    assert.throws(()=>requireSceneCoverage(buildInkScene(layouts[0],o,t,score),'beamed-solo'),/does not cover/,'partial physical coverage never claims global');
  }
});

test('stored ring/dot/stem/flag mutation moves production SVG and physical answer; independent music audits detect omissions',()=>{
  const score=buildDurationSpecimenScore(),o=resolveJankoOptions({...DEFAULT_JANKO_OPTIONS,durationGrammar:'complete'}),t=resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const layout=layoutJankoScore(score,o,t).find(l=>l.ungrouped.length>0)!;
  const scene=buildInkScene(layout,o,t,score);
  for(const kind of ['stem','ring','flag','dot'] as const){
    const group=[...scene.solos.values()].find(g=>g.some(p=>p.shape.kind===kind));
    assert.ok(group,kind);if(!group)continue;
    const piece=group.find(p=>p.shape.kind===kind)!;
    const before=renderSystem(score,layout.geometry,layout.index,o,t,layout,scene);
    const original=piece.shape,old=soloBox(piece),x=(old.x0+old.x1)/2,y=(old.y0+old.y1)/2;
    piece.shape=original.kind==='flag'?{...original,d:original.d.replace(/-?\d+(?:\.\d+)?/g,v=>String(Number(v)+1000))}:
      original.kind==='stem'?{...original,x:original.x+1000}:
      original.kind==='ring'?{...original,cx:original.cx+1000}:{...original,cx:original.cx+1000};
    assert.notEqual(renderSystem(score,layout.geometry,layout.index,o,t,layout,scene),before);
    assert.equal(soloPieceAt(piece,x,y).status,'clear');
    piece.shape=original;
  }
  const ringEntry=[...scene.solos].find(([,g])=>g.some(p=>p.shape.kind==='ring'));
  if(ringEntry){
    const [id,group]=ringEntry,without=group.filter(p=>p.shape.kind!=='ring');
    const out:Parameters<typeof checkStemRingGeometry>[3]=[];
    checkStemRingGeometry(layout,o,t,out,{...scene,solos:new Map([...scene.solos,[id,without]])});
    assert.ok(out.some(v=>v.code==='ring-geometry'));
  }
  const dotEntry=[...scene.solos].find(([,g])=>g.some(p=>p.shape.kind==='dot'));
  if(dotEntry){const [id,group]=dotEntry,out:Parameters<typeof checkDotCountAgreement>[3]=[];
    checkDotCountAgreement(layout,o,t,out,{...scene,solos:new Map([...scene.solos,[id,group.filter(p=>p.shape.kind!=='dot')]])});
    assert.ok(out.some(v=>v.code==='dot-count-agreement'));
  }
});
