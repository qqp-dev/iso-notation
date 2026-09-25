import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { placedChordBridges, chordBridgesSvg, chordBridgeAt, chordBridgeBoxAt, chordBridgeBox,
  placedClaspShell, claspShellSvg, claspShellAt, claspShellBox, claspShellBoxAt, claspGroupAt } from '../src/render/janko/connective-scene';
import { renderChordBridges, renderChordClasp, renderClaspGroup, claspInkBox } from '../src/render/janko/elements/rhythm';
import { ROUND_49_CANDIDATES, ROUND_49_METADATA } from '../src/render/janko/candidates';
import { bachBeforeM5 } from './support/bach-before-m5';
import { DEFAULT_STUDIO_CROPS, BRAHMS_STUDIO_CROPS } from '../src/render/janko/studio';
import { resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { createStudioConfig } from '../src/render/janko/studio';
import { countJankoPages, layoutJankoScore, renderJankoCrop, renderJankoPage, renderSystem, systemPaintedInkBoxes } from '../src/render/janko/engine';
import { buildInkScene, sceneChordBridgesSvg, sceneChordBridgeAt, sceneClaspShellAt, sceneChordBridgeBoxAt, sceneClaspShellBoxAt, requireSceneCoverage } from '../src/render/janko/ink-scene';

test('historical Bach Reference and parked Round 49 Candidate windows match pinned PR97 39-record manifest', () => {
  const sha=(s:string)=>createHash('sha256').update(s,'utf8').digest('hex');
  const config=createStudioConfig({round: ROUND_49_METADATA, candidates: ROUND_49_CANDIDATES});
  const records:unknown[]=[];
  records.push({kind:'metadata',pinned:'57cf8ba0fff1fa3b77877df9d83cf2ae664f0d52',round:ROUND_49_METADATA.round,
    reference:{bachPages:config.pages,brahmsPages:config.brahmsPages,bachLiveCrops:config.crops,brahmsLiveCrops:config.brahmsCrops},
    candidateOrder:ROUND_49_CANDIDATES.map(c=>c.id)});
  for(const id of ['primary','brahms-op118-no1'] as const){
    const e=config.scores[id],score=id==='primary'?bachBeforeM5(e.score):e.score;
    const layouts=layoutJankoScore(score,e.options,e.tokens);
    const pages=id==='primary'?config.pages:config.brahmsPages;
    for(const page of pages)records.push({kind:'reference-page',score:id,page,sha256:sha(renderJankoPage(score,page,e.options,e.tokens,layouts))});
    records.push({kind:'legacy-whole-system-crop',score:id,start:1,count:4,sha256:sha(renderJankoCrop(score,1,4,e.options,e.tokens,undefined,layouts))});
    for(const crop of id==='primary'?DEFAULT_STUDIO_CROPS:BRAHMS_STUDIO_CROPS)
      records.push({kind:id==='primary'?'reference-optional-crop':'reference-live-crop',score:id,start:crop.start,count:crop.count,title:crop.title,
        sha256:sha(renderJankoCrop(score,crop.start,crop.count,e.options,e.tokens,undefined,layouts))});
  }
  for(const c of ROUND_49_CANDIDATES){
    const byScore=new Map<string,ReturnType<typeof layoutJankoScore>>();
    for(const [order,w] of (c.windows??[]).entries()){
      if(!('measureStart' in w))throw Error('unexpected abstract window');
      const id=w.scoreId??'primary',e=config.scores[id];if(!e)throw Error('missing score '+id);
      const options=resolveJankoOptions({...e.options,...(c.options??{})});
      const tokens=resolveJankoTokens({...e.tokens,...(c.tokens??{})});
      let layouts=byScore.get(id);if(!layouts){layouts=layoutJankoScore(e.score,options,tokens);byScore.set(id,layouts);}
      if(w.fullScore){for(let page=0;page<countJankoPages(e.score,options,tokens);page++)
        records.push({kind:'candidate-page',candidate:c.id,order,score:id,page,optionsDelta:c.options,tokensDelta:c.tokens,
          sha256:sha(renderJankoPage(e.score,page,options,tokens,layouts))});}
      else records.push({kind:'candidate-crop',candidate:c.id,order,score:id,start:w.measureStart,count:w.measureCount,
        optionsDelta:c.options,tokensDelta:c.tokens,
        sha256:sha(renderJankoCrop(e.score,w.measureStart,w.measureCount,options,tokens,undefined,layouts))});
    }
  }
  assert.equal(records.length,39);
  assert.equal(records.map(r=>JSON.stringify(r)).join('\n')+'\n',pr97Manifest);
});

test('straight bridge has emitted 0.90pt butt ends, positive interior and empty corners', () => {
  const input=[{x:11.234,y1:20.123,y2:40.126,noteIds:['upper','lower']}];
  const pieces=placedChordBridges(input,3,1,new Map([['upper',{id:'upper',startTick:48,
    pitch:{octave:4,pitchClass:0},durationTicks:48,hand:'RH' as const}]]));
  const p=pieces[0];
  assert.deepEqual(p.ownerIds,['upper','lower']);
  assert.equal(p.tick,48);
  assert.equal(p.system,3);
  assert.equal(p.pagePiece,1);
  assert.equal(chordBridgesSvg(pieces),
    '    <g class="janko-chord-bridges">\n' +
    '      <line class="janko-chord-bridge" data-bridge-notes="upper,lower" x1="11.23" y1="20.12" x2="11.23" y2="40.13" stroke="#111111" stroke-width="0.90" stroke-linecap="butt"/>\n' +
    '    </g>');
  assert.equal(chordBridgesSvg(pieces),renderChordBridges(input));
  assert.equal(chordBridgeAt(p,11.23,30),'ink');
  assert.equal(chordBridgeAt(p,11.23,20.11),'clear');
  assert.equal(chordBridgeAt(p,11.23,20.12),'unknown');
  assert.equal(chordBridgeBoxAt(p,{x0:11.1,x1:11.2,y0:26,y1:27}),'ink');
  assert.equal(chordBridgeBoxAt(p,{x0:11.1,x1:11.2,y0:20.0,y1:20.1}),'clear');
  assert.equal(chordBridgeBoxAt(p,{x0:11.2,x1:11.2,y0:26,y1:27}),'unknown');
  assert.equal(chordBridgeBoxAt(p,{x0:11.68,x1:12,y0:26,y1:27}),'unknown'); // tangent, not free
  const old=chordBridgesSvg(pieces),b=chordBridgeBox(p);
  p.stroke.x+=10;
  assert.notEqual(chordBridgesSvg(pieces),old);
  assert.equal(chordBridgeAt(p,11.23,30),'clear');
  assert.equal(chordBridgeAt(p,21.23,30),'ink');
  assert.equal(chordBridgeBox(p).x0,b.x0+10);
});

test('clasp shell literal former path, miter, gaps, hollow interior and stored mutation', () => {
  const {scores}=createStudioConfig(),e=scores['brahms-op118-no1'];
  const group=layoutJankoScore(e.score,e.options,e.tokens).flatMap(l=>l.clasps)[0];
  const fixture={...group,claspX:10,topY:20,botY:40,capWidth:4,strokeWidth:0.8,spineGaps:[],path:'WRONG'};
  const shell=placedClaspShell(fixture,2,1);
  assert.equal(shell.system,2);
  assert.equal(shell.pagePiece,1);
  assert.equal(shell.tick,group.tick);
  assert.deepEqual(shell.ownerIds,fixture.notes.map(n=>n.id));
  assert.equal(claspShellSvg(shell),
    '    <path class="janko-clasp" d="M 14.00 20.00 L 10.00 20.00 L 10.00 40.00 L 14.00 40.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-linejoin="miter" stroke-linecap="butt"/>');
  assert.match(renderChordClasp(fixture,e.tokens),/class="janko-clasp-group" data-clasp-tick="[0-9]+" data-clasp-duration="[^"]+" data-clasp-duration-style="[^"]+" data-clasp-notes="[^"]+">\n    <path class="janko-clasp"/);
  assert.equal(claspShellAt(shell,12,30),'clear'); // Empty bracket rectangle is not filled.
  assert.equal(claspShellAt(shell,9.8,20.2),'ink'); // Miter corner.
  assert.equal(claspShellAt(shell,13.9,20),'ink'); // cap beyond spine
  assert.equal(claspShellAt(shell,9.6,20),'unknown');
  assert.equal(claspShellBoxAt(shell,{x0:11,x1:12,y0:29,y1:30}),'clear');
  assert.equal(claspShellBoxAt(shell,{x0:9.8,x1:10.2,y0:29,y1:30}),'ink');
  assert.equal(claspShellBoxAt(shell,{x0:9.4,x1:9.6,y0:30,y1:31}),'unknown');
  assert.equal(claspShellBoxAt(shell,{x0:10,x1:10,y0:30,y1:31}),'unknown');
  const old=claspShellSvg(shell);
  shell.stroke.cap=6;
  assert.notEqual(claspShellSvg(shell),old);
  assert.equal(claspShellAt(shell,16,20),'unknown');
  shell.stroke.gaps=[{from:28,to:32}];
  assert.equal(claspShellSvg(shell),
    '    <path class="janko-clasp" d="M 16.00 20.00 L 10.00 20.00 L 10.00 28.00 M 10.00 32.00 L 10.00 40.00 L 16.00 40.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-linejoin="miter" stroke-linecap="butt"/>');
  assert.equal(renderChordClasp({...fixture,capWidth:6,spineGaps:[{from:28,to:32}]},e.tokens).split('\n')[1],claspShellSvg(shell));
  assert.equal(claspShellAt(shell,10,30),'clear');
  assert.equal(claspShellBoxAt(shell,{x0:9.8,x1:10.2,y0:29,y1:31}),'clear');
  assert.equal(claspShellAt(shell,10,27),'ink');
  const marked=placedClaspShell({...fixture,spineGaps:[{from:28,to:32}]});
  assert.equal(claspGroupAt(marked,12,30),marked.marked?'unknown':'clear');
  assert.equal(claspGroupAt(marked,10,30),marked.marked?'unknown':'clear');
  assert.equal(placedClaspShell({...fixture,durationInk:[]}).marked,true); // unresolved marks cannot certify bare.
  const bare=layoutJankoScore(e.score,e.options,e.tokens).flatMap(l=>l.clasps)
    .find(g=>!placedClaspShell(g).marked)!;
  const bareFixture={...bare,claspX:10,topY:20,botY:40,capWidth:4,strokeWidth:0.8,spineGaps:[],path:'WRONG'};
  assert.equal(renderChordClasp(bareFixture,e.tokens),
    `  <g class="janko-clasp-group" data-clasp-tick="${bare.tick}" data-clasp-duration="${bare.duration}" data-clasp-duration-style="${bare.durationStyle}" data-clasp-notes="${bare.notes.map(n=>n.id).join(',')}">\n`+
    '    <path class="janko-clasp" d="M 14.00 20.00 L 10.00 20.00 L 10.00 40.00 L 14.00 40.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-linejoin="miter" stroke-linecap="butt"/>\n'+
    '  </g>');
});

test('canonical final Brahms layout has 72 clasps, 33 bridges; placed paint and final booking are distinct', () => {
  const {scores}=createStudioConfig(),e=scores['brahms-op118-no1'];
  const layouts=layoutJankoScore(e.score,e.options,e.tokens);
  assert.equal(layouts.reduce((n,l)=>n+l.clasps.length,0),72);
  assert.equal(layouts.reduce((n,l)=>n+l.chordBridges.length,0),33);
  let bare=0,marked=0,dots=0;
  const dottedSpires:number[]=[];
  for(const l of layouts){
    const s=buildInkScene(l,e.options,e.tokens,e.score);
    assert.equal(sceneChordBridgesSvg(s),renderChordBridges(l.chordBridges));
    assert.equal(s.chordBridges.length,l.chordBridges.length);
    assert.equal(s.claspShells.length,l.clasps.length);
    const byId=new Map(e.score.notes.map(n=>[n.id,n] as const));
    for(const bridge of s.chordBridges){
      assert.equal(bridge.system,l.index);
      assert.equal(bridge.pagePiece,Math.floor(l.index/e.options.systemsPerPage!));
      bridge.sourceNotes.forEach((source,i)=>{
        const note=byId.get(bridge.ownerIds[i]);
        if(note)assert.deepEqual(source,{id:note.id,startTick:note.startTick,sourceProvenance:note.sourceProvenance,editorialHand:note.editorialHand});
      });
    }
    assert.equal(renderClaspGroup(l.clasps,l.claspRails,e.tokens,s.claspShells),renderClaspGroup(l.clasps,l.claspRails,e.tokens));
    for(const [index,g] of l.clasps.entries()){
      // Independent pre-cutover geometry and musical identity; no SVG parser or self-comparison.
      assert.equal(claspShellSvg(s.claspShells[index]).includes(`d="${g.path}"`),true);
      assert.equal(s.claspShells[index].tick,g.tick);
      assert.equal(s.claspShells[index].system,l.index);
      assert.equal(s.claspShells[index].pagePiece,Math.floor(l.index/e.options.systemsPerPage!));
      if(s.claspShells[index].marked)marked++;else bare++;
      dots+=(renderChordClasp(g,e.tokens).match(/class="janko-clasp-dot"/g)??[]).length;
      if(g.duration==='spire'&&g.durationInk.some(ink=>ink.dotted))dottedSpires.push(g.tick);
    }
    const boxes=systemPaintedInkBoxes(l,e.options,e.tokens);
    assert.equal(boxes.filter(b=>b.what.startsWith('chord-bridge ')).length,l.chordBridges.length);
    const bareBoxes=boxes.filter(b=>b.what==='clasp-shell');
    const markedBoxes=boxes.filter(b=>b.what==='legacy broad bracket');
    assert.deepEqual(bareBoxes,s.claspShells.filter(sh=>!sh.marked).map(sh=>({...claspShellBox(sh),what:'clasp-shell'})));
    assert.deepEqual(markedBoxes,l.clasps.filter((_,i)=>s.claspShells[i].marked).map(g=>({...claspInkBox(g,e.tokens),what:'legacy broad bracket'})));
  }
  // Two of the 16 spire-duration groups actually paint augmentation dots.
  assert.equal(bare,14);
  assert.equal(marked,58);
  assert.deepEqual(dottedSpires,[5520,9360]);
  assert.equal(dots,21);
});

test('frozen placed scene mutations, not stale layout, govern connective emission', () => {
  const {scores}=createStudioConfig(),e=scores['brahms-op118-no1'];
  const layout=layoutJankoScore(e.score,e.options,e.tokens).find(l=>l.clasps.length>0&&l.chordBridges.length>0)!;
  const scene=buildInkScene(layout,e.options,e.tokens,e.score);
  const bridge=scene.chordBridges[0],prior=sceneChordBridgesSvg(scene);
  const x=bridge.stroke.x,y=(bridge.stroke.y1+bridge.stroke.y2)/2;
  assert.equal(bridge.stroke.y2,Number(layout.chordBridges[0].y2.toFixed(2))); // independent musical placement
  bridge.stroke.x+=20;
  assert.notEqual(sceneChordBridgesSvg(scene),prior);
  assert.equal(chordBridgeAt(bridge,x,y),'clear');
  assert.equal(chordBridgeAt(bridge,x+20,y),'ink');
  assert.equal(Number(layout.chordBridges[0].x.toFixed(2)),x); // source layout was not rewritten
  const isolated={...scene,heads:new Map(),beat:[],barlines:[]};
  assert.equal(sceneChordBridgeAt(isolated,0,x+20,y),'ink');
  const q={x0:x+19.9,x1:x+20.1,y0:y-0.1,y1:y+0.1};
  assert.equal(sceneChordBridgeBoxAt(isolated,0,q),'ink');
  const emitted=renderSystem(e.score,layout.geometry,layout.index,e.options,e.tokens,layout,scene);
  assert.ok(emitted.includes(sceneChordBridgesSvg(scene)));
  assert.ok(!emitted.includes(prior));
  const mask=[...scene.heads.values()].flat().find(p=>p.primitive.kind==='erase')!;
  if(mask.primitive.kind!=='erase')throw Error('expected head mask');
  mask.primitive.box={x0:x+19,y0:y-1,x1:x+21,y1:y+1};
  isolated.heads=new Map([['later-mask',[mask]]]);
  assert.equal(sceneChordBridgeAt(isolated,0,x+20,y),'unknown');
  assert.equal(sceneChordBridgeBoxAt(isolated,0,q),'unknown');
  // Strict-grid white air can remove only the middle strip of the candidate
  // box; the remaining stroke is not falsely certified by a broad enclosure.
  const strict={...mask,layer:'strict-grid' as const,primitive:{kind:'erase' as const,
    protects:'strict-grid-air' as const,box:q,stroke:{kind:'stroke' as const,
      x1:x+20,y1:y-1,x2:x+20,y2:y+1,width:0.05,cap:'butt' as const}}};
  const strictScene={...isolated,heads:new Map(),beat:[strict]};
  assert.equal(sceneChordBridgeAt(strictScene,0,x+20,y),'unknown');
  assert.equal(sceneChordBridgeBoxAt(strictScene,0,q),'unknown');
  const beforeEndpoint=sceneChordBridgesSvg(scene);
  bridge.stroke.y2=y-1;
  assert.notEqual(sceneChordBridgesSvg(scene),beforeEndpoint);
  assert.equal(chordBridgeAt(bridge,x+20,y),'clear');
  assert.equal(chordBridgeAt(bridge,x+20,y-2),'ink');
  assert.ok(renderSystem(e.score,layout.geometry,layout.index,e.options,e.tokens,layout,scene).includes(sceneChordBridgesSvg(scene)));
  const shell=scene.claspShells[0],group=layout.clasps[0];
  const old=renderClaspGroup(layout.clasps,layout.claspRails,e.tokens,scene.claspShells);
  const oldShell=claspShellSvg(shell);
  const cap=Number((shell.stroke.x+shell.stroke.cap).toFixed(2)),top=Number(shell.stroke.top.toFixed(2));
  shell.stroke.cap+=10;
  assert.notEqual(renderClaspGroup(layout.clasps,layout.claspRails,e.tokens,scene.claspShells),old);
  const updated=renderSystem(e.score,layout.geometry,layout.index,e.options,e.tokens,layout,scene);
  assert.ok(updated.includes(claspShellSvg(shell)));
  assert.ok(!updated.includes(oldShell));
  assert.equal(claspShellAt(shell,cap+10,top),'unknown');
  assert.equal(group.path.includes('WRONG'),false);
  const middle=(shell.stroke.top+shell.stroke.bottom)/2;
  shell.stroke.gaps=[{from:middle-1,to:middle+1}];
  assert.equal(claspShellAt(shell,shell.stroke.x,middle),'clear');
  assert.notEqual(renderClaspGroup(layout.clasps,layout.claspRails,e.tokens,scene.claspShells),old);
  assert.ok(renderSystem(e.score,layout.geometry,layout.index,e.options,e.tokens,layout,scene).includes(claspShellSvg(shell)));
  const bareLayout=layoutJankoScore(e.score,e.options,e.tokens).find(l=>l.clasps.some(g=>g.duration==='spire'&&!g.dotted))!;
  const bareScene=buildInkScene(bareLayout,e.options,e.tokens,e.score);
  const i=bareScene.claspShells.findIndex(sh=>!sh.marked),sh=bareScene.claspShells[i];
  const sy=(sh.stroke.top+sh.stroke.bottom)/2;
  const noLater={...bareScene,heads:new Map(),beat:[],barlines:[]};
  assert.equal(sceneClaspShellAt(noLater,i,sh.stroke.x,sy),'ink');
  const shellQ={x0:sh.stroke.x-0.1,x1:sh.stroke.x+0.1,y0:sy-0.1,y1:sy+0.1};
  assert.equal(sceneClaspShellBoxAt(noLater,i,shellQ),'ink');
  noLater.heads=new Map([['later-mask',[mask]]]);
  if(mask.primitive.kind==='erase')mask.primitive.box={x0:sh.stroke.x-1,y0:sy-1,x1:sh.stroke.x+1,y1:sy+1};
  assert.equal(sceneClaspShellAt(noLater,i,sh.stroke.x,sy),'unknown');
  assert.equal(sceneClaspShellBoxAt(noLater,i,shellQ),'unknown');
  assert.throws(()=>requireSceneCoverage(noLater,'brackets'),/does not cover brackets/);
});

// Immutable PR97 independent real-engine witness, recorded BEFORE this cutover.
const pr97Manifest = `{"kind":"metadata","pinned":"57cf8ba0fff1fa3b77877df9d83cf2ae664f0d52","round":49,"reference":{"bachPages":[0,1],"brahmsPages":[0,1,2,3,4],"bachLiveCrops":[],"brahmsLiveCrops":[{"start":1,"count":2,"title":"mm. 1–2 · Upbeat and downbeat","caption":"The quarter-note upbeat, the m. 1 downbeat chord over the bass arpeggio, and the white-ring clasp dotting the dotted half."},{"start":5,"count":2,"title":"mm. 5–6 · First fold","caption":"Note #47 folds an octave below the fixed-3 core under its ↓10 bracket — the first of nine folded notes."},{"start":7,"count":2,"title":"mm. 7–8 · Five-voice chords","caption":"The massive five-voice chords with the octave-1 ledger stack whole — the seated surface carries no finding here."}]},"candidateOrder":["round49-above-080","round49-air-100","round49-uniform-080"]}
{"kind":"reference-page","score":"primary","page":0,"sha256":"2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f"}
{"kind":"reference-page","score":"primary","page":1,"sha256":"dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757"}
{"kind":"legacy-whole-system-crop","score":"primary","start":1,"count":4,"sha256":"c97fef4cea414bec819a96e1be9c0245f9230dec5fba0738dcfcb7cd5e021d61"}
{"kind":"reference-optional-crop","score":"primary","start":1,"count":2,"title":"mm. 1–2 · Inception","sha256":"65d6116cb5c372cdd7d136cb78178ed1444284cdd24fe65a0e63fb9ebe2144fe"}
{"kind":"reference-optional-crop","score":"primary","start":4,"count":1,"title":"m. 4 · RH run into octave 3","sha256":"5416b1b7a9be1f68b5c1af95abd9cc3e3ccae4b113cce48e24bc1b828bb8292c"}
{"kind":"reference-optional-crop","score":"primary","start":8,"count":1,"title":"m. 8 · 16th-note spacing stress","sha256":"75258c517b45efa08de46ef135c301e9b4f7683cbf6f150521a5675c3b6767b7"}
{"kind":"reference-optional-crop","score":"primary","start":14,"count":1,"title":"m. 14 · Cross-hand row collision","sha256":"e0b14f022935c5512b583677666a597422671b35c3e5df5b6e84657f0d6c7957"}
{"kind":"reference-optional-crop","score":"primary","start":24,"count":1,"title":"m. 24 · Register leap","sha256":"0ce80e996c6145b2b14f2632ca637df8daa542f31354f2eecc934d93c29dbfa4"}
{"kind":"reference-page","score":"brahms-op118-no1","page":0,"sha256":"7676bf9059982aac2a0a2b96b32711b32ad6b15b12016419da19d3afb29d0c90"}
{"kind":"reference-page","score":"brahms-op118-no1","page":1,"sha256":"a84166821d569d8c080b1ff98f97664d0f1d6132b7002026ea6cd66e32b85cfa"}
{"kind":"reference-page","score":"brahms-op118-no1","page":2,"sha256":"78b3fd134d5f3b4bf4269619759149a34aa9c8c95f540fcc72fe12f9495a2897"}
{"kind":"reference-page","score":"brahms-op118-no1","page":3,"sha256":"40c43f6aed8a4b4554d2e0c8c7c9d62a468dccb3766f2da15ba66d7f7fa984fd"}
{"kind":"reference-page","score":"brahms-op118-no1","page":4,"sha256":"d2237277aa13354dcc30aa2e3bdd1e42d4fb461fc78435a65343bb65d9c546a5"}
{"kind":"legacy-whole-system-crop","score":"brahms-op118-no1","start":1,"count":4,"sha256":"9e5d4d45e52bb7e834b7b55ec23041914f8a02a5cf844304a654c78d95d82076"}
{"kind":"reference-live-crop","score":"brahms-op118-no1","start":1,"count":2,"title":"mm. 1–2 · Upbeat and downbeat","sha256":"cdcc890cd6b6e88fcb60380bd3ca41deb6243750accc3aadcb0b43724f485e9f"}
{"kind":"reference-live-crop","score":"brahms-op118-no1","start":5,"count":2,"title":"mm. 5–6 · First fold","sha256":"1354bb27a9090ef5363056dae60748844dc4a64b1355cbb77295cccb3ceef631"}
{"kind":"reference-live-crop","score":"brahms-op118-no1","start":7,"count":2,"title":"mm. 7–8 · Five-voice chords","sha256":"f56d1ce4ce8648349849dada0f7ddba017358a8b4cfda3366604c0c7bdd82542"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":0,"score":"brahms-op118-no1","start":1,"count":3,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"0d774a8cfbd4fbf3f6053378afcfb327aba7a0e1a4e0154fd0a4f5c4a8b281e1"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":1,"score":"brahms-op118-no1","start":7,"count":4,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"4fe2a6140ae6601c5af2483184ca48c7a40a42908f5f14bf4ab5efd317f79669"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":2,"score":"brahms-op118-no1","start":13,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"6d8574cf7b21bbd6a254f2c7ed8e9da4ab037f2a4a68e8acdafee65ff02c6bc2"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":3,"score":"brahms-op118-no1","start":33,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"0b8d232e97376451ed4453a940a761da8852b35934027b49f60f8bedea526f28"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":4,"score":"brahms-op118-no1","start":61,"count":6,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"068f370f9648844a50e62acb5aa533f3f6f9961f14d60ba7590b73091104302c"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":5,"score":"brahms-op118-no1","start":68,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"b6316bb07e90f888c29b4add12be3f0ac61e2a4a0909709d7ffcf1261f30ad19"}
{"kind":"candidate-crop","candidate":"round49-above-080","order":6,"score":"brahms-op118-no1","start":70,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"0352ab6e147bd7ddc3e492b4c85c0a59daf2bd57ee9f78299b32a905a1fb692c"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":0,"score":"brahms-op118-no1","start":1,"count":3,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"0d774a8cfbd4fbf3f6053378afcfb327aba7a0e1a4e0154fd0a4f5c4a8b281e1"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":1,"score":"brahms-op118-no1","start":7,"count":4,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"4ab02b330ad7712a877aeec035953c3d5650c2de1b687ff93a56b3e4157bdfa2"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":2,"score":"brahms-op118-no1","start":13,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"6d8574cf7b21bbd6a254f2c7ed8e9da4ab037f2a4a68e8acdafee65ff02c6bc2"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":3,"score":"brahms-op118-no1","start":33,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"0b8d232e97376451ed4453a940a761da8852b35934027b49f60f8bedea526f28"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":4,"score":"brahms-op118-no1","start":61,"count":6,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"068f370f9648844a50e62acb5aa533f3f6f9961f14d60ba7590b73091104302c"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":5,"score":"brahms-op118-no1","start":68,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"b6316bb07e90f888c29b4add12be3f0ac61e2a4a0909709d7ffcf1261f30ad19"}
{"kind":"candidate-crop","candidate":"round49-air-100","order":6,"score":"brahms-op118-no1","start":70,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"traced","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":1},"sha256":"0352ab6e147bd7ddc3e492b4c85c0a59daf2bd57ee9f78299b32a905a1fb692c"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":0,"score":"brahms-op118-no1","start":1,"count":3,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"be1bbabe33e5728866b92f8eb531bc45b26bbc07fc78241457be81f18ae7c6a4"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":1,"score":"brahms-op118-no1","start":7,"count":4,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"e414b52a1fa5d63144da1d349885b457605b760a815b2348d886e1b6cd844efd"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":2,"score":"brahms-op118-no1","start":13,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"6f49aff937771a653c47071c6df519f8cac73c99f99451502ecbe38eb967b058"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":3,"score":"brahms-op118-no1","start":33,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"e38229c3f7b6500496834ec03ecbd974c8d616ddb10f67b19063ba4d8a95b69a"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":4,"score":"brahms-op118-no1","start":61,"count":6,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"bc2eb4e9fdd92d958a00b7dc7e8714acc542c46dba59fb229abeff5b14d11ffd"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":5,"score":"brahms-op118-no1","start":68,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"f51b8cd29fb77776b5a318e80b4f48d89ce54cbfb57293bb64b26198c069d9a8"}
{"kind":"candidate-crop","candidate":"round49-uniform-080","order":6,"score":"brahms-op118-no1","start":70,"count":1,"optionsDelta":{"pitchPlacement":"parity-columns","bracketDurationGrammar":"midpoint","exceptionCarrier":"symbol","opticalSpacing":true,"lowPitchFolding":"literal","writtenTies":"source","chordSymbolScale":0.95,"tieOriginIndicator":"omit-outgoing","tieProfile":"uniform","standaloneLongMount":"above"},"tokensDelta":{"midpointSlashLengthFactor":1.1,"midpointRingScale":1.1,"midpointBracketRingScale":1.2,"midpointSpacingFactor":1.2896963334494056,"opticalClearanceAir":0.3,"halfRingGap":0.3,"detachedRingScale":0.88,"detachedSymbolAir":0.8,"horizontalMountAir":0.8},"sha256":"99e2aa2d2fbdce75fb4122f0e3bfed648a39f487bb1dda510b8da1607955d52b"}
`;
