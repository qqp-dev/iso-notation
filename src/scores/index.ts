import { QuantizedGridScore } from '../model/types';
import { buildBachGoldbergVar1Score } from './bach-goldberg-var1';
import { buildBrahmsOp118No1Score } from './brahms-op118-no1';

export { buildBachGoldbergVar1Score } from './bach-goldberg-var1';
export {
  buildDurationSpecimenScore,
  DURATION_SPECIMEN_MEASURES,
  DURATION_SPECIMEN_JANKO_OPTIONS,
  DURATION_SPECIMEN_JANKO_TOKENS,
  DURATION_SPECIMEN_TICKS_PER_MEASURE,
  DURATION_SPECIMEN_TOTAL_TICKS,
} from './duration-specimen';
export {
  buildBrahmsOp118No1Score,
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  BRAHMS_OP118_NO1_MEASURES,
  BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
} from './brahms-op118-no1';

export const BENCHMARK_SCORES: Record<string, () => QuantizedGridScore> = {
  'bach-goldberg-var1': buildBachGoldbergVar1Score,
  'brahms-op118-no1': buildBrahmsOp118No1Score,
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
    id: 'brahms-op118-no1',
    title: 'Intermezzo in A minor, Op. 118 No. 1 (mm. 1–9)',
    composer: 'J. Brahms',
    period: 'Romantic / Late Piano Miniature',
    description: 'Cut-time sweeping four-octave arpeggios and massive five-voice chords: the harmonic row-collision pressure test for the two-row staff.',
  },
];
