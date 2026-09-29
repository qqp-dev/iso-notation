/** Approved-source-derived No. 43 draft (no filesystem or LilyPond at browser runtime). */
import derived from './schumann-no43-derived.json';
import type { QuantizedGridScore } from '../model/types';

export const SCHUMANN_NO43_APPROVED_SHA256 = '150e13d9723743fea780168fd9776525a856a99506522072185b619d3815797f';
export const SCHUMANN_NO43_DRAFT_ID = 'schumann-op68-no43';
export const schumannNo43WrittenFacts = derived.facts;
export const schumannNo43DeferredLedger = derived.ledger;

export function buildSchumannNo43Draft(): QuantizedGridScore {
  if (derived.facts.sourceHash !== SCHUMANN_NO43_APPROVED_SHA256 || derived.score.id !== SCHUMANN_NO43_DRAFT_ID)
    throw Error('Schumann No. 43 derived record does not match the approved source identity');
  // Consumers can edit a working copy; the committed source-linked record is immutable in principle.
  return structuredClone(derived.score) as QuantizedGridScore;
}
