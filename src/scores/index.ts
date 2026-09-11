import { QuantizedGridScore } from '../model/types';
import { buildBachGoldbergVar1Score } from './bach-goldberg-var1';

export { buildBachGoldbergVar1Score } from './bach-goldberg-var1';

export const BENCHMARK_SCORES: Record<string, () => QuantizedGridScore> = {
  'bach-goldberg-var1': buildBachGoldbergVar1Score,
};

export const BENCHMARK_METADATA = [
  {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Var. 1',
    composer: 'J.S. Bach',
    period: 'Baroque / Polyphonic Counterpoint',
    description: 'Dynamic two-part hand-crossing counterpoint, wide register leaps, and continuous flowing sixteenth-note motoric motion.',
  },
];
