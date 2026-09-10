import { QuantizedGridScore } from '../model/types';
import { buildBachGoldbergVar1Score } from './bach-goldberg-var1';
import { buildKapustinOp40No7Score } from './kapustin-op40-no7';

export { buildBachGoldbergVar1Score } from './bach-goldberg-var1';
export { buildKapustinOp40No7Score } from './kapustin-op40-no7';

export const BENCHMARK_SCORES: Record<string, () => QuantizedGridScore> = {
  'bach-goldberg-var1': buildBachGoldbergVar1Score,
  'kapustin-op40-no7': buildKapustinOp40No7Score,
};

export const BENCHMARK_METADATA = [
  {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Var. 1',
    composer: 'J.S. Bach',
    period: 'Baroque / Polyphonic Counterpoint',
    description: 'Dynamic two-part hand-crossing counterpoint, wide register leaps, and continuous flowing sixteenth-note motoric motion.',
  },
  {
    id: 'kapustin-op40-no7',
    title: 'Eight Concert Études, Op. 40: No. 7 "Intermezzo"',
    composer: 'Nikolai Kapustin',
    period: 'Modern Classical Jazz Étude',
    description: 'Subtle jazz syncopations, chromatic substitutions, layered swing counterpoint, and rich extended chord voicings.',
  },
];
