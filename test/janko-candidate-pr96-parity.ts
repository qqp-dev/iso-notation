import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CURRENT_CANDIDATES } from '../src/render/janko/candidates';
import { createStudioConfig, DEFAULT_STUDIO_CROPS, BRAHMS_STUDIO_CROPS } from '../src/render/janko/studio';
import { countJankoPages, layoutJankoScore, renderJankoCrop, renderJankoPage } from '../src/render/janko/engine';
import { resolveJankoOptions, resolveJankoTokens } from '../src/render/janko/types';

// SHA-256 of the real SVG bytes from PR96 merge ada6ec5, captured in an
// isolated PR96 archive with its own engine and unchanged Round 49 registry.
// Entries follow the registry's window order (mm. 1–3, 7–10, 13, 33,
// 61–66, 68, 70). No rendered SVG or review image is saved in the tree.
const BASELINE = {
  'round49-above-080': [
    '0d774a8cfbd4fbf3f6053378afcfb327aba7a0e1a4e0154fd0a4f5c4a8b281e1',
    '4fe2a6140ae6601c5af2483184ca48c7a40a42908f5f14bf4ab5efd317f79669',
    '6d8574cf7b21bbd6a254f2c7ed8e9da4ab037f2a4a68e8acdafee65ff02c6bc2',
    '0b8d232e97376451ed4453a940a761da8852b35934027b49f60f8bedea526f28',
    '068f370f9648844a50e62acb5aa533f3f6f9961f14d60ba7590b73091104302c',
    'b6316bb07e90f888c29b4add12be3f0ac61e2a4a0909709d7ffcf1261f30ad19',
    '0352ab6e147bd7ddc3e492b4c85c0a59daf2bd57ee9f78299b32a905a1fb692c',
  ],
  'round49-air-100': [
    '0d774a8cfbd4fbf3f6053378afcfb327aba7a0e1a4e0154fd0a4f5c4a8b281e1',
    '4ab02b330ad7712a877aeec035953c3d5650c2de1b687ff93a56b3e4157bdfa2',
    '6d8574cf7b21bbd6a254f2c7ed8e9da4ab037f2a4a68e8acdafee65ff02c6bc2',
    '0b8d232e97376451ed4453a940a761da8852b35934027b49f60f8bedea526f28',
    '068f370f9648844a50e62acb5aa533f3f6f9961f14d60ba7590b73091104302c',
    'b6316bb07e90f888c29b4add12be3f0ac61e2a4a0909709d7ffcf1261f30ad19',
    '0352ab6e147bd7ddc3e492b4c85c0a59daf2bd57ee9f78299b32a905a1fb692c',
  ],
  'round49-uniform-080': [
    'be1bbabe33e5728866b92f8eb531bc45b26bbc07fc78241457be81f18ae7c6a4',
    'e414b52a1fa5d63144da1d349885b457605b760a815b2348d886e1b6cd844efd',
    '6f49aff937771a653c47071c6df519f8cac73c99f99451502ecbe38eb967b058',
    'e38229c3f7b6500496834ec03ecbd974c8d616ddb10f67b19063ba4d8a95b69a',
    'bc2eb4e9fdd92d958a00b7dc7e8714acc542c46dba59fb229abeff5b14d11ffd',
    'f51b8cd29fb77776b5a318e80b4f48d89ce54cbfb57293bb64b26198c069d9a8',
    '99e2aa2d2fbdce75fb4122f0e3bfed648a39f487bb1dda510b8da1607955d52b',
  ],
} as const;
const WINDOWS = [[1,3],[7,4],[13,1],[33,1],[61,6],[68,1],[70,1]] as const;
const sha = (svg:string) => createHash('sha256').update(svg,'utf8').digest('hex');

// PR96 pinned-archive witness manifest: all 7 Reference pages, 3 live Brahms
// macros, 5 optional historic Bach macros and 2 explicitly historic systems.
// These hashes are NOT a baseline produced by the changed implementation.
const REFERENCE = {
  primary: {
    pages: ['2a5c2abe6365250e9e9e5acd46f4effdc5f8b380cb0fc7cf689764dd239a534f',
      'dbfb83dcf008782d34e5260548c706d0cb980689eac58b24c7d0e7ae1e828757'],
    whole: 'c97fef4cea414bec819a96e1be9c0245f9230dec5fba0738dcfcb7cd5e021d61',
    crops: ['65d6116cb5c372cdd7d136cb78178ed1444284cdd24fe65a0e63fb9ebe2144fe',
      '5416b1b7a9be1f68b5c1af95abd9cc3e3ccae4b113cce48e24bc1b828bb8292c',
      '75258c517b45efa08de46ef135c301e9b4f7683cbf6f150521a5675c3b6767b7',
      'e0b14f022935c5512b583677666a597422671b35c3e5df5b6e84657f0d6c7957',
      '0ce80e996c6145b2b14f2632ca637df8daa542f31354f2eecc934d93c29dbfa4'],
  },
  'brahms-op118-no1': {
    pages: ['7676bf9059982aac2a0a2b96b32711b32ad6b15b12016419da19d3afb29d0c90',
      'a84166821d569d8c080b1ff98f97664d0f1d6132b7002026ea6cd66e32b85cfa',
      '78b3fd134d5f3b4bf4269619759149a34aa9c8c95f540fcc72fe12f9495a2897',
      '40c43f6aed8a4b4554d2e0c8c7c9d62a468dccb3766f2da15ba66d7f7fa984fd',
      'd2237277aa13354dcc30aa2e3bdd1e42d4fb461fc78435a65343bb65d9c546a5'],
    whole: '9e5d4d45e52bb7e834b7b55ec23041914f8a02a5cf844304a654c78d95d82076',
    crops: ['cdcc890cd6b6e88fcb60380bd3ca41deb6243750accc3aadcb0b43724f485e9f',
      '1354bb27a9090ef5363056dae60748844dc4a64b1355cbb77295cccb3ceef631',
      'f56d1ce4ce8648349849dada0f7ddba017358a8b4cfda3366604c0c7bdd82542'],
  },
} as const;

test('PR96 pinned-archive Reference full pages and real-engine macro windows remain byte-identical',()=>{
  const config=createStudioConfig();
  assert.deepEqual(config.pages,[0,1]);
  assert.deepEqual(config.brahmsPages,[0,1,2,3,4]);
  assert.deepEqual(config.crops,[],'Bach historical crops are optional, not live');
  assert.deepEqual(config.brahmsCrops,BRAHMS_STUDIO_CROPS);
  for(const id of ['primary','brahms-op118-no1'] as const){
    const entry=config.scores[id],baseline=REFERENCE[id];
    const layouts=layoutJankoScore(entry.score,entry.options,entry.tokens);
    const pages=id==='primary'?config.pages:config.brahmsPages;
    assert.deepEqual(pages.map(page=>sha(renderJankoPage(entry.score,page,entry.options,entry.tokens,layouts))),baseline.pages);
    assert.equal(sha(renderJankoCrop(entry.score,1,4,entry.options,entry.tokens,undefined,layouts)),baseline.whole);
    const crops=id==='primary'?DEFAULT_STUDIO_CROPS:BRAHMS_STUDIO_CROPS;
    assert.deepEqual(crops.map(c=>sha(renderJankoCrop(entry.score,c.start,c.count,entry.options,entry.tokens,undefined,layouts))),baseline.crops);
  }
});

test('all current real-engine Candidate windows retain PR96 serialized SVG bytes', () => {
  const config = createStudioConfig();
  assert.equal(config.round.round, 49, 'new round requires fresh independent baseline');
  assert.deepEqual(CURRENT_CANDIDATES.map(c=>c.id), Object.keys(BASELINE));
  for (const candidate of CURRENT_CANDIDATES) {
    const expected = BASELINE[candidate.id as keyof typeof BASELINE];
    const windows = candidate.windows ?? [];
    assert.deepEqual(windows.map(w=>[('measureStart' in w ? w.measureStart : null),('measureCount' in w ? w.measureCount : null)]), WINDOWS);
    assert.equal(windows.length, expected.length);
    // Studio caches one layout per candidate/score; do the same rather than
    // recomputing the complete 71-measure score for each macro window.
    const layoutsByScore = new Map<string, ReturnType<typeof layoutJankoScore>>();
    for (const [i,window] of windows.entries()) {
      assert.notEqual(window.kind,'abstract');
      if (!('measureStart' in window)) throw new Error('unexpected abstract window');
      const entry = config.scores[window.scoreId ?? 'primary'];
      assert.ok(entry, `missing score ${window.scoreId}`);
      assert.equal(entry.id, 'brahms-op118-no1');
      const options = resolveJankoOptions({ ...entry.options, ...(candidate.options ?? {}) });
      const tokens = resolveJankoTokens({ ...entry.tokens, ...(candidate.tokens ?? {}) });
      let layouts = layoutsByScore.get(entry.id);
      if (!layouts) {
        layouts = layoutJankoScore(entry.score, options, tokens);
        layoutsByScore.set(entry.id, layouts);
      }
      const actual = window.fullScore
        ? Array.from({length:countJankoPages(entry.score,options,tokens)},(_,page)=>sha(renderJankoPage(entry.score,page,options,tokens,layouts)))
        : [sha(renderJankoCrop(entry.score,window.measureStart,window.measureCount,options,tokens,undefined,layouts))];
      assert.deepEqual(actual,[expected[i]],`${candidate.id} mm. ${window.measureStart}–${window.measureStart+window.measureCount-1} vs PR96`);
    }
  }
});
