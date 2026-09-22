/**
 * Brahms Op. 118 No. 1 — bounded source-informed hand corrections.
 *
 * Score-layer declarative correction applied AFTER the validated written-
 * duration overlay (which matches ORIGINAL MIDI-track keys) and BEFORE
 * hand-crossing computation. Preserves the original matching boundary and
 * fixture bytes: the duration overlay stays bijective on track labels, and
 * this step only retargets the semantic performance hand of explicitly
 * authorized events.
 *
 * Authority: ticket §4 plus the OPERATOR AMENDMENT (ten corrections, not
 * six), plus the approved m70 editorial hands (three flips, two
 * confirmations — see the Round 49 table below). Source staff changes are
 * NOT automatically hand changes; each table entry is a LIMITED editorial
 * assignment, not a universal hand/fingering system. Do not broaden without
 * a new decision round.
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

import type { EditorialHandResolution } from '../model/types';

export const BRAHMS_HAND_CORRECTIONS_VERSION = 4;

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
 * The exact fifteen authorized corrections, ordered by onset:
 *
 * - the original ten (all **LH → RH**): six 24-tick eighths plus the four
 *   phrase-continuation notes (96/48 ticks) of the descending RH line in
 *   performed mm. 23/43 and its mm. 24/44 continuation;
 * - Round 45, five **RH → LH** corrections in performed m. 66 — the printed
 *   (linear) reading of bar 37 / second ending: `leftHandUpper` :254 prints on
 *   the **lower** staff there, so the low A2/D3 reattacks and the tied F3 are
 *   left-hand events and the tick-12624 “9222” column must read two-handed
 *   (A2, D3 left; D4, D5 right). The performed (unfolded) run applies
 *   :232's \voiceUp a second time, so the MIDI track says “upper” for these
 *   events — the reported mistake this bounded correction repairs. The
 *   distinct sustained `leftHandLower` A2 (168t) / D3 (144t) tie-wait events at
 *   the same pitches are preserved exactly, and no new onset is invented.
 * - Round 49 §4, the m70 editorial hands — three **flips** plus two
 *   **confirm-only** records in performed m. 70 (ticks 13392–13464): 953/954
 *   change LH → RH (the run's second half belongs to the right hand under the
 *   operator's explicit authority, even though the source parts keep them in
 *   `leftHandLower`), 955 changes RH → LH (the tick-13440 A1 bass is a
 *   left-hand event), and 956/957 confirm RH (already on the performed upper
 *   staff — guarded, no hand change). Raw source voice/staff/hand provenance
 *   is retained on every record; the table retargets the displayed hand only.
 *   Editorial authority governs display grouping, rest inference and conflict
 *   diagnostics for these events (see the engine's rest layer and
 *   `detectHandCrossings`, which both run after this table).
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
  },  // --- Round 45: performed m. 66 (printed bar 37, second ending), RH -> LH ---
  {
    expectedId: 'brahms-op118-no1-908',
    pitchClass: 9,
    octave: 2,
    startTick: 12552,
    durationTicks: 24,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '254:23',
    logicalPart: 'leftHandUpper (\\voiceThree a eighth)',
    performedOccurrence: 'performed m. 66, A2 reattack (tick 12552)',
    rationale:
      'The second ending contains no staff change of its own; in the PRINTED reading :243\'s ' +
      '\\voiceDown is still in force, so this leftHandUpper eighth prints on the lower staff. ' +
      'The performed (unfolded) run re-applies :232\'s \\voiceUp, so the MIDI track label is ' +
      '“upper” — the low A2 belongs to the left hand, as the part name, the printed staff and ' +
      'the operator\'s two-handed reading of the “9222” column all agree.',
  },
  {
    expectedId: 'brahms-op118-no1-910',
    pitchClass: 2,
    octave: 3,
    startTick: 12576,
    durationTicks: 24,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '254:25',
    logicalPart: 'leftHandUpper (\\voiceThree d eighth)',
    performedOccurrence: 'performed m. 66, D3 reattack (tick 12576)',
    rationale:
      'Same leftHandUpper eighth pair as the A2 reattack: printed lower staff, performed upper ' +
      'staff; the low D3 is a left-hand event under the printed reading.',
  },
  {
    expectedId: 'brahms-op118-no1-912',
    pitchClass: 5,
    octave: 3,
    startTick: 12600,
    durationTicks: 120,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '254:27,254:38',
    logicalPart: 'leftHandUpper (f!~ tied into the half-note chord)',
    performedOccurrence:
      'performed m. 66, F3 eighth tied into the tick-12624 half chord (120 ticks)',
    rationale:
      'The tied F3 is a leftHandUpper event; the tie makes it sound into the tick-12624 column, ' +
      'so its hand must agree with the A2/D3 chord members the operator requires on the left. ' +
      'The 120-tick tie composite keeps its published unsupported-duration finding — this ' +
      'correction changes only the hand.',
  },
  {
    expectedId: 'brahms-op118-no1-913',
    pitchClass: 9,
    octave: 2,
    startTick: 12624,
    durationTicks: 96,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '254:33',
    logicalPart: 'leftHandUpper (<a, d f>2 half chord, a,)',
    performedOccurrence: 'performed m. 66, third quarter, low A2 of the “9222” column',
    rationale:
      'Operator two-handed reading of the tick-12624 column (A2/D3 left, D4/D5 right); the ' +
      'printed lower staff and the leftHandUpper part both assign the low head to the left hand. ' +
      'The distinct sustained leftHandLower A2 (brahms-op118-no1-909, 168 ticks) is untouched.',
  },
  {
    expectedId: 'brahms-op118-no1-914',
    pitchClass: 2,
    octave: 3,
    startTick: 12624,
    durationTicks: 96,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '254:36',
    logicalPart: 'leftHandUpper (<a, d f>2 half chord, d)',
    performedOccurrence: 'performed m. 66, third quarter, low D3 of the “9222” column',
    rationale:
      'Companion of the low A2 in the same leftHandUpper half chord; with it the tick-12624 ' +
      'column reads two-handed while D4/D5 stay right hand. The distinct sustained ' +
      'leftHandLower D3 (brahms-op118-no1-911, 144 ticks) is untouched.',
  },
  // --- Round 49 §4: performed m. 70 (source bar 70), LH → RH run halves ---
  {
    expectedId: 'brahms-op118-no1-953',
    pitchClass: 1,
    octave: 3,
    startTick: 13392,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '327:22',
    logicalPart: 'leftHandLower (run eighth, second half)',
    performedOccurrence: 'performed m. 70, run tick 13392 (fifth of eight eighths)',
    rationale:
      'Operator §4 editorial authority: the run\'s second half (ticks 13392/13416) belongs to ' +
      'the right hand. The source parts keep this event in leftHandLower on the lower staff ' +
      '(parts.ily:327), so the source voice/staff/hand provenance stays LH — only the displayed ' +
      'hand changes.',
  },
  {
    expectedId: 'brahms-op118-no1-954',
    pitchClass: 9,
    octave: 3,
    startTick: 13416,
    durationTicks: 24,
    expectedOriginalHand: 'LH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '327:28',
    logicalPart: 'leftHandLower (run eighth, second half)',
    performedOccurrence: 'performed m. 70, run tick 13416 (sixth of eight eighths)',
    rationale:
      'Operator §4 editorial authority: the run\'s second half (ticks 13392/13416) belongs to ' +
      'the right hand. The source parts keep this event in leftHandLower on the lower staff ' +
      '(parts.ily:327), so the source voice/staff/hand provenance stays LH — only the displayed ' +
      'hand changes.',
  },
  {
    expectedId: 'brahms-op118-no1-955',
    pitchClass: 9,
    octave: 1,
    startTick: 13440,
    durationTicks: 48,
    expectedOriginalHand: 'RH',
    correctedHand: 'LH',
    sourceFile: SOURCE_FILE,
    sourceLines: '258:12',
    logicalPart: 'leftHandUpper (low A1 bass, quarter)',
    performedOccurrence: 'performed m. 70, low A1 bass tick 13440 (48 ticks)',
    rationale:
      'Operator §4 editorial authority: the separate low A1 at tick 13440 is a left-hand event. ' +
      'The source already assigns it to leftHandUpper (parts.ily:258), so the source provenance ' +
      'stays LH — the correction moves the displayed hand from the performed upper staff to LH. ' +
      'No LH rest may be painted at 13440 while this bass sounds.',
  },
  {
    expectedId: 'brahms-op118-no1-956',
    pitchClass: 1,
    octave: 4,
    startTick: 13440,
    durationTicks: 24,
    expectedOriginalHand: 'RH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '327:58',
    logicalPart: 'leftHandLower (run eighth, confirm RH)',
    performedOccurrence: 'performed m. 70, run tick 13440 (seventh of eight eighths)',
    rationale:
      'Operator §4 confirm-only record: this event already displays RH (performed upper staff) ' +
      'and stays RH. The guard pins the musical identity so a future track-label change fails ' +
      'closed instead of silently reassigning the hand.',
  },
  {
    expectedId: 'brahms-op118-no1-957',
    pitchClass: 9,
    octave: 4,
    startTick: 13464,
    durationTicks: 24,
    expectedOriginalHand: 'RH',
    correctedHand: 'RH',
    sourceFile: SOURCE_FILE,
    sourceLines: '327:63',
    logicalPart: 'leftHandLower (run eighth, confirm RH)',
    performedOccurrence: 'performed m. 70, run tick 13464 (eighth of eight eighths)',
    rationale:
      'Operator §4 confirm-only record: this event already displays RH (performed upper staff) ' +
      'and stays RH. The guard pins the musical identity so a future track-label change fails ' +
      'closed instead of silently reassigning the hand.',
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
    const mutable = byId.get(target.id)! as T & { editorialHand?: EditorialHandResolution };
    mutable.hand = c.correctedHand;
    // Round 49 §4: the flip alone is display-only — the authority must travel
    // with the note so the engine's occupancy, rest-inference and conflict
    // decisions read the *resolved* hand instead of re-vetoing through the
    // raw source label. Confirm-only records carry the same resolution (kind
    // 'confirm'), so a guarded confirmation is auditable and authoritative
    // too. The raw sourceProvenance is never touched.
    mutable.editorialHand = {
      hand: c.correctedHand,
      kind: c.expectedOriginalHand === c.correctedHand ? 'confirm' : 'flip',
      authorityId: c.expectedId,
    };
  }
  return out;
}
