import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { bachBeforeM5 } from './support/bach-before-m5';
import { buildBrahmsOp118No1Score, BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } from '../src/scores/brahms-op118-no1';
import { DEFAULT_JANKO_OPTIONS, DEFAULT_JANKO_TOKENS, JANKO_REST_STYLES, resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';
import { countJankoPages, layoutJankoScore, renderJankoCrop, renderJankoPage, renderSystem, systemPaintedInkBoxes } from '../src/render/janko/engine';
import { buildInkScene, requireSceneCoverage, sceneInkAt, scenePhysicalBoxes, sceneRestSvg } from '../src/render/janko/ink-scene';
import { JANKO_REST_VALUES, placedRestPaint, renderRest, restAdmissionBox, serializeRestPaint, serializeRestPrimitive, type JankoRestInk } from '../src/render/janko/elements/rests';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const point = (x: number, y: number) => ({ x, y });

// Independent literal XML witnesses: each of the six real primitive tags and
// formatting conventions, including dash, cap, join, fill, attrs and order.
test('six normalized rest primitives retain the literal SVG paint grammar', () => {
  const pieces: Array<[JankoRestInk, string]> = [
    [{ kind:'line',cls:'line',a:point(1,2),b:point(3,4),width:0.8,cap:'round',attrs:' opacity="0.5"' },
      '    <line class="line" x1="1.00" y1="2.00" x2="3.00" y2="4.00" stroke="#111111" stroke-width="0.80" stroke-linecap="round" opacity="0.5"/>'],
    [{ kind:'curve',cls:'curve',start:point(1,2),segments:[[point(3,4),point(5,6),point(7,8)]],width:0.8 },
      '    <path class="curve" d="M 1.00 2.00 C 3.00 4.00 5.00 6.00 7.00 8.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-linecap="round" stroke-linejoin="round"/>'],
    [{ kind:'poly',cls:'poly',pts:[point(1,2),point(3,4)],close:false,stroke:0.8,fill:null },
      '    <path class="poly" d="M 1.00 2.00 L 3.00 4.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-linecap="butt" stroke-linejoin="miter"/>'],
    [{ kind:'path',cls:'path',start:point(1,2),segments:[[point(3,4),point(5,6),point(7,8)]],close:true,stroke:null,fill:'#1A1A1A' },
      '    <path class="path" d="M 1.00 2.00 C 3.00 4.00 5.00 6.00 7.00 8.00 Z" fill="#1A1A1A" stroke="none" stroke-linecap="butt" stroke-linejoin="miter"/>'],
    [{ kind:'rect',cls:'rect',x:1,y:2,w:3,h:4,rx:0.5,stroke:0.8,fill:null,dash:'2,3' },
      '    <rect class="rect" x="1.00" y="2.00" width="3.00" height="4.00" rx="0.50" ry="0.50" fill="none" stroke="#111111" stroke-width="0.80" stroke-dasharray="2,3"/>'],
    [{ kind:'ellipse',cls:'ellipse',c:point(1,2),rx:3,ry:4,stroke:0.8,fill:null,dash:'2,3' },
      '    <ellipse class="ellipse" cx="1.00" cy="2.00" rx="3.00" ry="4.00" fill="none" stroke="#111111" stroke-width="0.80" stroke-dasharray="2,3"/>'],
  ];
  for (const [primitive, literal] of pieces) assert.equal(serializeRestPrimitive(primitive),literal);
  const rest = { tick:552,durationTicks:12,hand:'RH' as const,x:200,y:300,value:'sixteenth' as const,style:'classical-urtext' as const };
  const records = placedRestPaint(rest,0,0,0,resolveJankoTokens(DEFAULT_JANKO_TOKENS));
  assert.equal(serializeRestPaint(records),renderRest(rest,DEFAULT_JANKO_TOKENS));
  assert.match(serializeRestPaint(records),/^    <g class="janko-rest-group" data-rest-tick="552" data-rest-value="sixteenth" data-rest-hand="RH" data-rest-style="classical-urtext">\n/);
  assert.ok(serializeRestPaint(records).endsWith('\n    </g>'));
});

// Golden hashes recorded from unmodified PR91 merge 60955c9, using the real
// renderRest engine at tick 552, x=200, y=300, RH. Value order is 64th→whole.
const originalCuts: Record<string,string[]> = {
  'kinetic-monoline': ['c413da0505371bd37dc912b31e167ccb2f7135c62d37bd1afd38e385ed5ca40e','a5307ef35ab01ae516fd0f2909073f1f162a92c2b92b6ad1592b97d4aa62bea6','d343278666003835efea4e08b37df87ce2c5620a97b0298ca26d58c3e5621878','5ddbebf5407dee1441f9e378708274523d22ff2268797a394682615da86a98c8','e57e2eb4e8df24bf3f3e04d74231899c1e9a1f6197813b4c2dc655c5ee47540d','4bb162e7dfe237835ca9fa7303a2bb890f9efdf0b33177e5fa474d00b7af020a','cdae9c244d8e1e0ea965deba8e6dfe5851cb11456b8110e759b132f4c251cbf3'],
  'classical-urtext': ['7a1189658fec573b0552388382bb8860b0a161f3e16af92ed1aedb0be6eac780','68c4a8f7f91a29ff2f1a91d6a7b4907e04dfcb42dfe761354747ccec96b82506','5dabf04e23f8cdd0c9469d55ebf53bc6bcd5ac59523b57570ba8b86a00ea9809','b95628ae516f67225d42d4f2bdc56e3a2a49837a194c9352fe0c42f0a327fd5d','72f0ed97349446565653221c7757d797a41028117711b78ec39960bb6e6c316b','701c589214840bd22375c2ffc2136cb5349c20f289d24dbb1485dee1b6a205b6','5a4fbeb239141384c0cd21f98ed37dede1e5deeedf2f40caa5c0ed4cd9c358e1'],
  'geometric-node': ['fbcf7c4f6c2c04c80b6fde2598da990ffbc5d22b3a4f57d4e136d9f36fa81b17','f808c492fcf3956b55bddc92118615b4d8501c53abaeed6d7aa7a9d85b105509','668eb119c4ac34090d357b3714cd32d87ac7f6024d1de5ce6a970293b0b307c7','f82b073e81f9711f69b4f8cd8d0fad16526983e9a676b076301ceb90ac011661','8d2544915b3984a0cecd4ec53d240bc77f62944ba3ed1d8641200ef240aa57eb','5cd306ad9bb5f30724b27bb7b8e2172791a3b5aa85f4b7a09fb979d61753b7c1','a200d63da1964bb71bfbbe8abc896071c325c687eea7f163e77da4c17dec20ef'],
  'bauhaus-slash': ['ae46507254c684778ba282788c4da36969f22a67ce866a3514c2e47c9e43a4f2','52f678e429509e2c9c2df9e854d863d6a9c0777e330a5c6097bb7d523524935e','da11ec76eade6f3191946bac02e086b2eb2854c000e0a588c20c81d7f0651f09','283c05a9992fe612b3f4494b58bfae39b9facee0179bb1027bc0a89952fce1fa','ce1fbb8176e6024bed94f6af24614e1aab8e3f0233ffd432d8df612c0c3b4a6a','939993cf70795201e11a043dff7292aa9a7dc616da2e3a1b70eb3cc776bc0331','99c834cb4a80fc25bbb4490730fa35d24badbfe2779e562fffa83bd439b71da0'],
  'phantom-notehead': ['a774170120b65324036145de608165845f75a76d54bd4def25f285b7798d6278','b0235f905fd350b39dd0681334bef56b1047f5c241361c3698d418f3a434e90b','c4cce443b949d290a845f935284bcaacef9b554358d7c009494455f460e1e55f','c4ff19191522eff80648d14c35f14136d8da9969043a2dfb856e47c4bbcb8104','7b127896dcbbad940fcbf528c4cfd42c93a07f00d372356cc081a2cc94a1243b','434a544b9ddee07dcf13f2b3221c30717fff3ee8442aee03147b741559d76878','59d6575fabbd6ea20baeca9d14028efc12adeb1a47a4cf48670fc950a21fb010'],
};
test('all five styles and seven values are byte-identical to pre-cutover XML', () => {
  const tokens=resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  for (const style of JANKO_REST_STYLES) for (const [i,value] of JANKO_REST_VALUES.entries()) {
    const rest={tick:552,durationTicks:3*2**i,hand:'RH' as const,x:200,y:300,value,style};
    const placed=placedRestPaint(rest,2,0,i,tokens);
    assert.equal(sha(serializeRestPaint(placed)),originalCuts[style][i],`${style}/${value}`);
    assert.equal(serializeRestPaint(placed),renderRest(rest,tokens));
    assert.deepEqual(placed.map(p=>p.order),placed.map(()=>i));
  }
});

const brahms=buildBrahmsOp118No1Score();
const bo=resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),bt=resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
const bl=layoutJankoScore(brahms,bo,bt);
test('placed semantic rest owners and paint mutation do not consult source geometry', () => {
  for (const system of [bl[0],bl[5]]) {
    const scene=buildInkScene(system,bo,bt,brahms);
    assert.deepEqual(scene.paintCoverage.stored,['rests','beamed-solo']);
    assert.ok(!scene.coverage.migrated.includes('rests' as never));
    assert.throws(()=>requireSceneCoverage(scene,'rests'),/does not cover rests/);
    assert.equal(scene.restPaint.length,system.rests.length);
    for (const [index,rest] of system.rests.entries()) {
      const group=scene.restPaint[index];
      assert.ok(group.length>0);
      for(const p of group) {
        assert.equal(p.system,system.index);assert.equal(p.pagePiece,Math.floor(system.index/bo.systemsPerPage));
        assert.equal(p.layer,'rest');assert.equal(p.groupClass,'janko-rest-group');
        assert.equal(p.tick,rest.tick);assert.equal(p.durationTicks,rest.durationTicks);
        assert.deepEqual(p.span,[rest.tick,rest.tick+rest.durationTicks]);
        assert.equal(p.hand,rest.hand);assert.equal(p.authored,rest.authored);
        assert.equal(p.sourceOrigin,rest.authored?rest.sourceOrigin:undefined);
        assert.equal(p.id,`s${system.index}:rest:${rest.tick}:${rest.hand}:${index}:${group.indexOf(p)}`);
      }
      assert.equal(sceneRestSvg(scene,index),renderRest(rest,bt));
    }
    const first=scene.restPaint[0][0];
    assert.ok(first);
    const original=renderSystem(brahms,system.geometry,system.index,bo,bt,system,scene);
    const oldGroup=sceneRestSvg(scene,0);
    const oldPhysical=scenePhysicalBoxes(scene);
    // Change the stored primitive without changing its rest seat/source or
    // rebuilding the scene. Production emission must change exactly this group.
    first.primitive={...first.primitive,cls:'rest-paint-mutation'};
    const changed=renderSystem(brahms,system.geometry,system.index,bo,bt,system,scene);
    assert.equal(changed,original.replace(oldGroup,sceneRestSvg(scene,0)));
    assert.notEqual(changed,original);
    assert.deepEqual(scenePhysicalBoxes(scene),oldPhysical);
    const box=restAdmissionBox(system.rests[0],bt);
    assert.equal(scenePhysicalBoxes(scene).some(p=>p.what.includes(':rest:')),false);
    assert.equal(sceneInkAt(scene,(box.x0+box.x1)/2,(box.y0+box.y1)/2).some(p=>p.id.includes(':rest:')),false);
    assert.ok(systemPaintedInkBoxes(system,bo,bt).some(p=>p.what.includes('rest')),'named page booking remains');
  }
  assert.equal(bl[0].rests[0].authored,true);
  assert.equal(bl[0].rests[0].sourceOrigin,'includes/intermezzo-op118-no1-parts.ily:46');
  assert.equal(bl[5].rests[0].authored,false);
  assert.equal(bl[5].rests[0].sourceOrigin,undefined);
});

// Whole-system/page hashes from PR91 real-engine output, including rest order,
// masks, reference page framing and Brahms content-aware folded crop.
const originalPages = {
  bach: ['2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f','dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757'],
  brahms: ['7676bf9059982aac2a0a2b96b32711b32ad6b15b12016419da19d3afb29d0c90','a84166821d569d8c080b1ff98f97664d0f1d6132b7002026ea6cd66e32b85cfa','78b3fd134d5f3b4bf4269619759149a34aa9c8c95f540fcc72fe12f9495a2897','40c43f6aed8a4b4554d2e0c8c7c9d62a468dccb3766f2da15ba66d7f7fa984fd','d2237277aa13354dcc30aa2e3bdd1e42d4fb461fc78435a65343bb65d9c546a5'],
};
test('archival Bach hands and Brahms BRONZE pages and cropped system remain byte-identical to PR91', () => {
  for(const [name,score,options,tokens,crop] of [
    ['bach',bachBeforeM5(buildBachGoldbergVar1Score()),DEFAULT_JANKO_OPTIONS,DEFAULT_JANKO_TOKENS,'c97fef4cea414bec819a96e1be9c0245f9230dec5fba0738dcfcb7cd5e021d61'],
    ['brahms',brahms,BRAHMS_OP118_NO1_JANKO_OPTIONS,BRAHMS_OP118_NO1_JANKO_TOKENS,'9e5d4d45e52bb7e834b7b55ec23041914f8a02a5cf844304a654c78d95d82076'],
  ] as const) {
    assert.equal(countJankoPages(score,options,tokens),originalPages[name].length);
    originalPages[name].forEach((expected,i)=>assert.equal(sha(renderJankoPage(score,i,options,tokens)),expected,`${name} page ${i}`));
    assert.equal(sha(renderJankoCrop(score,1,4,options,tokens)),crop,`${name} crop`);
  }
});
