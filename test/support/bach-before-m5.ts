import type { QuantizedGridScore } from '../../src/model/types';

/** PR91–PR97 archive witness before the operator-judged m. 5 GOLD correction.
 * Only the two historical hands differ; this is not a current Reference score. */
export function bachBeforeM5(score: QuantizedGridScore): QuantizedGridScore {
  return { ...score, notes: score.notes.map(note =>
    note.id === 'bach-var1-70' || note.id === 'bach-var1-71'
      ? { ...note, hand: 'RH' as const } : note
  ) };
}
