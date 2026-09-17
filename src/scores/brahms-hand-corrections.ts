/**
 * Brahms Op. 118 No. 1 — bounded source-informed hand corrections.
 *
 * Score-layer declarative correction applied AFTER the validated written-
 * duration overlay (which matches ORIGINAL MIDI-track keys) and BEFORE
 * hand-crossing computation. Preserves the original matching boundary and
 * fixture bytes: the duration overlay stays bijective on track labels, and
 * this step only retargets the semantic performance hand of ten explicitly
 * authorized events.
 *
 * Authority: ticket §4 plus the OPERATOR AMENDMENT (ten corrections, not
 * six). Source staff changes are NOT automatically hand changes; this table
 * is a LIMITED editorial assignment for the descending RH line in
 * mm. 23/43 and its phrase continuation in mm. 24/44, not a universal
 * hand/fingering system. Do not broaden without a new decision round.
 *
 * Source witness (pinned, see data/sources/brahms-op118-no1/):
 * - includes/intermezzo-op118-no1-parts.ily:62–63 — rightHandUpper
 *   `\staffDown c ( a fs |` (descending line, staff destination lower).
 * - includes/intermezzo-op118-no1-parts.ily:64 — rightHandUpper
 *   `ds2) e4) \staffUp` (phrase continuation through ds–e before staffUp).
 * - includes/intermezzo-op118-no1-parts.ily:285 — leftHandLower
 *   `e, ( a c ds )` ascending bass line on the same onsets.
 * Runtime track labels follow staff destination (lower → LH); operator
 * approves treating the descending c–a–fs line plus its ds–e continuation
 * as RH by source-part continuity. Performed m. 23 (ticks 4392/4416/4440)
 * and m. 24 (ticks 4464/4560), plus the source repeat in performed
 * m. 43 (ticks 8232/8256/8280) and m. 44 (ticks 8304/8400).
 */

export const BRAHMS_HAND_CORRECTIONS_VERSION = 2;

/** One authorized hand retargeting. All guards must match exactly. */
export interface BrahmsHandCorrection {
  /** Expected score id (extra assertion, e.g. brahms-op118-no1-315). */
  expectedId: string;
  /** Stable musical identity guards. */
  pitchClass: number;
  octave: number;
  startTick: number;
  durationTicks: number;
  /** Hand before correction (must match) and after. */
  expectedOriginalHand: 'RH' | 'LH';
  correctedHand: 'RH' | 'LH';
  /** Source correspondence + performed-occurrence rationale. */
  sourceFile: string;
  sourceLines: string;
  logicalPart: string;
  performedOccurrence: string;
  rationale: string;
}

const SOURCE_FILE = 'includes/intermezzo-op118-no1-parts.ily';

/**
 * The exact ten authorized corrections (all LH → RH): six 24-tick eighths
 * plus the four phrase-continuation notes (96/48 ticks). Ordered by onset
 * for determinism.
 */
export const BRAHMS_HAND_CORRECTIONS: readonly BrahmsHandCorrection[] = [
  {
    expectedId: 'brahms-op118-no1-315',
    pitchClass: 0,
    octave: 4,
    startTick: 4392,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '62',
    logicalPart: 'rightHandUpper (staffDown c)',
    performedOccurrence: 'performed m. 23, beat 1 (first of three descending eighths)',
    rationale: 'Source-part continuity: descending c–a–fs line belongs to RH despite lower-staff destination.',
  },
  {
    expectedId: 'brahms-op118-no1-317',
    pitchClass: 9,
    octave: 3,
    startTick: 4416,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '63',
    logicalPart: 'rightHandUpper (staffDown a)',
    performedOccurrence: 'performed m. 23, beat 2 (second of three descending eighths)',
    rationale: 'Source-part continuity: descending c–a–fs line belongs to RH despite lower-staff destination.',
  },
  {
    expectedId: 'brahms-op118-no1-319',
    pitchClass: 6,
    octave: 3,
    startTick: 4440,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '63',
    logicalPart: 'rightHandUpper (staffDown fs)',
    performedOccurrence: 'performed m. 23, beat 3 (third of three descending eighths)',
    rationale: 'Source-part continuity: descending c–a–fs line belongs to RH despite lower-staff destination.',
  },
  {
    expectedId: 'brahms-op118-no1-321',
    pitchClass: 3,
    octave: 3,
    startTick: 4464,
    durationTicks: 96,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '64',
    logicalPart: 'rightHandUpper (ds2 continuation before staffUp)',
    performedOccurrence: 'performed m. 24, beat 1 (phrase continuation D# half)',
    rationale: 'Operator amendment: phrase-continuation ds belongs to RH; source line 64 continues the same RH part through ds2 e4 before staffUp.',
  },
  {
    expectedId: 'brahms-op118-no1-326',
    pitchClass: 4,
    octave: 3,
    startTick: 4560,
    durationTicks: 48,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '64',
    logicalPart: 'rightHandUpper (e4 continuation before staffUp)',
    performedOccurrence: 'performed m. 24, beat 3 (phrase continuation E quarter)',
    rationale: 'Operator amendment: phrase-continuation e belongs to RH; source line 64 continues the same RH part through ds2 e4 before staffUp.',
  },
  {
    expectedId: 'brahms-op118-no1-601',
    pitchClass: 0,
    octave: 4,
    startTick: 8232,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '62',
    logicalPart: 'rightHandUpper (staffDown c, repeat)',
    performedOccurrence: 'performed m. 43, beat 1 (repeat of m. 23 line)',
    rationale: 'Same source passage under repeat; same limited editorial assignment as m. 23.',
  },
  {
    expectedId: 'brahms-op118-no1-603',
    pitchClass: 9,
    octave: 3,
    startTick: 8256,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '63',
    logicalPart: 'rightHandUpper (staffDown a, repeat)',
    performedOccurrence: 'performed m. 43, beat 2 (repeat of m. 23 line)',
    rationale: 'Same source passage under repeat; same limited editorial assignment as m. 23.',
  },
  {
    expectedId: 'brahms-op118-no1-605',
    pitchClass: 6,
    octave: 3,
    startTick: 8280,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '63',
    logicalPart: 'rightHandUpper (staffDown fs, repeat)',
    performedOccurrence: 'performed m. 43, beat 3 (repeat of m. 23 line)',
    rationale: 'Same source passage under repeat; same limited editorial assignment as m. 23.',
  },
  {
    expectedId: 'brahms-op118-no1-607',
    pitchClass: 3,
    octave: 3,
    startTick: 8304,
    durationTicks: 96,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '64',
    logicalPart: 'rightHandUpper (ds2 continuation, repeat)',
    performedOccurrence: 'performed m. 44, beat 1 (repeat of m. 24 continuation D# half)',
    rationale: 'Same source passage under repeat; same limited editorial assignment as m. 24.',
  },
  {
    expectedId: 'brahms-op118-no1-612',
    pitchClass: 4,
    octave: 3,
    startTick: 8400,
    durationTicks: 48,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '64',
    logicalPart: 'rightHandUpper (e4 continuation, repeat)',
    performedOccurrence: 'performed m. 44, beat 3 (repeat of m. 24 continuation E quarter)',
    rationale: 'Same source passage under repeat; same limited editorial assignment as m. 24.',
  },
];

/**
 * Apply the bounded hand corrections to duration-overlaid notes.
 * Returns a new array; preserves order and every field except the ten
 * authorized `hand` retargetings. Throws with actionable diagnostics on
 * duplicate corrections/targets, missing targets, or any guard mismatch
 * (original hand, pitch, onset, duration, id). Never silently falls back.
 */
export function applyBrahmsHandCorrections<
  T extends {
    id: string;
    pitch: { pitchClass: number; octave: number };
    startTick: number;
    durationTicks: number;
    hand: 'RH' | 'LH';
  },
>(
  notes: readonly T[],
  corrections: readonly BrahmsHandCorrection[] = BRAHMS_HAND_CORRECTIONS
): T[] {
  // Table hygiene: no duplicate corrections or targets.
  const seenCorrection = new Set<string>();
  const seenTarget = new Set<string>();
  for (const c of corrections) {
    const ck = `${c.pitchClass}|${c.octave}|${c.startTick}|${c.expectedOriginalHand}`;
    if (seenCorrection.has(ck)) {
      throw new Error(
        `Brahms hand corrections: duplicate correction for musical key ${ck} (${c.expectedId}) — refusing overlay`
      );
    }
    seenCorrection.add(ck);
    if (seenTarget.has(c.expectedId)) {
      throw new Error(
        `Brahms hand corrections: duplicate target id ${c.expectedId} — refusing overlay`
      );
    }
    seenTarget.add(c.expectedId);
    if (!c.sourceFile || !c.sourceLines || !c.logicalPart || !c.performedOccurrence) {
      throw new Error(
        `Brahms hand corrections: ${c.expectedId} lacks source correspondence — refusing overlay`
      );
    }
  }

  // Index notes by stable musical identity (pitch/onset/original-hand).
  const byMusicalKey = new Map<string, T[]>();
  for (const n of notes) {
    const k = `${n.pitch.pitchClass}|${n.pitch.octave}|${n.startTick}|${n.hand}`;
    const bucket = byMusicalKey.get(k);
    if (bucket) bucket.push(n);
    else byMusicalKey.set(k, [n]);
  }

  const correctedIds = new Set<string>();
  const out = notes.map((n) => ({ ...n }));
  const byId = new Map(out.map((n) => [n.id, n] as const));

  for (const c of corrections) {
    const k = `${c.pitchClass}|${c.octave}|${c.startTick}|${c.expectedOriginalHand}`;
    const candidates = byMusicalKey.get(k) ?? [];
    if (candidates.length === 0) {
      throw new Error(
        `Brahms hand corrections: no score note matches ${c.expectedId} musical key ${k} ` +
          `(pc ${c.pitchClass} oct ${c.octave} tick ${c.startTick} hand ${c.expectedOriginalHand}) — refusing overlay`
      );
    }
    if (candidates.length > 1) {
      throw new Error(
        `Brahms hand corrections: musical key ${k} matches ${candidates.length} notes ` +
          `(${candidates.map((n) => n.id).join(', ')}) — ambiguous target for ${c.expectedId}; refusing overlay`
      );
    }
    const target = candidates[0];
    if (target.id !== c.expectedId) {
      throw new Error(
        `Brahms hand corrections: musical key ${k} resolves to ${target.id}, expected ${c.expectedId} — refusing overlay`
      );
    }
    if (target.durationTicks !== c.durationTicks) {
      throw new Error(
        `Brahms hand corrections: ${c.expectedId} has duration ${target.durationTicks}, expected ${c.durationTicks} — refusing overlay`
      );
    }
    if (target.hand !== c.expectedOriginalHand) {
      throw new Error(
        `Brahms hand corrections: ${c.expectedId} has original hand ${target.hand}, expected ${c.expectedOriginalHand} — refusing overlay`
      );
    }
    if (correctedIds.has(target.id)) {
      throw new Error(
        `Brahms hand corrections: duplicate target ${target.id} — refusing overlay`
      );
    }
    correctedIds.add(target.id);
    const mutable = byId.get(target.id)!;
    mutable.hand = c.correctedHand;
  }
  return out;
}
