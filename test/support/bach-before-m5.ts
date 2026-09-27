import type { QuantizedGridScore } from '../../src/model/types';

/** PR91/PR96 historical score witness. Reverse *all* post-witness hand edits,
 * not only m. 5; archival render tests supply inferBoundaryRests:false.
 * The identities/hands below are independently pinned to the PR112 source in
 * scores.test.ts (source sha256 bf998efd6ac58ce8d6cb58d9ffb76038b71f484ed20343704ed9021d6b5f26a9).
 */
const priorHands: Record<string, 'LH' | 'RH'> = {
  'bach-var1-68': 'LH', 'bach-var1-69': 'RH',
  'bach-var1-348': 'RH', 'bach-var1-349': 'RH', 'bach-var1-350': 'RH',
  'bach-var1-351': 'RH', 'bach-var1-354': 'RH', 'bach-var1-355': 'RH',
  'bach-var1-360': 'LH', 'bach-var1-361': 'LH',
  'bach-var1-366': 'RH', 'bach-var1-367': 'RH',
  'bach-var1-372': 'LH', 'bach-var1-373': 'LH',
  'bach-var1-408': 'LH', 'bach-var1-409': 'RH',
  'bach-var1-70': 'RH', 'bach-var1-71': 'RH',
};
export function bachBeforeM5(score: QuantizedGridScore): QuantizedGridScore {
  return { ...score, notes: score.notes.map(note =>
    priorHands[note.id] ? { ...note, hand: priorHands[note.id] } : note
  ) };
}

/** PR112 hand witness: reverse only the sixteen newly approved edits. The
 * source SHA and all 551 original tuples are pinned independently in scores.test.ts. */
export function bachPr112Hands(score: QuantizedGridScore): QuantizedGridScore {
  return { ...score, notes: score.notes.map(note =>
    note.id !== 'bach-var1-70' && note.id !== 'bach-var1-71' && priorHands[note.id]
      ? { ...note, hand: priorHands[note.id] } : note
  ) };
}
