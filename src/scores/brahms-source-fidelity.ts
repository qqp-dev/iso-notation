/**
 * Brahms Op. 118 No. 1 — source-fidelity normalization + validated overlay.
 *
 * Pure helpers only (no fs, no LilyPond, no network). The offline exporter
 * (`scripts/brahms-export-written-durations.ts`) calls `normalizeWrittenDurations`
 * on LilyPond's pre-playback NoteEvent evidence; the runtime score builder
 * calls `applyWrittenDurations` to overlay corrected durations.
 *
 * Contract: verified source → exact events → bijective durations → unchanged
 * engraving rules → automated gates → real-engine review. Articulation never
 * changes written duration. Matching hand follows the MIDI-track baseline
 * (staff destination), voice identity is retained for provenance; cross-staff
 * intended hands remain uncertified.
 */

import { fromMidi } from '../model/pitch';
import { WrittenTieChain, WrittenTieComponent } from '../model/types';

/** Whole-note grid: LilyPond moments scale by 192 to repo ticks. */
export const BRAHMS_WRITTEN_TICKS_PER_WHOLE = 192;

/** Source voices in the pinned witness (stable ids from the exporter). */
export const BRAHMS_SOURCE_VOICES = [
  'rightHandUpper',
  'rightHandLower',
  'leftHandUpper',
  'leftHandLower',
] as const;
export type BrahmsSourceVoice = (typeof BRAHMS_SOURCE_VOICES)[number];

/** Raw pre-playback NoteEvent segment from the LilyPond listener. */
export interface BrahmsRawSegment {
  voice: string;
  staff: string;
  onsetNum: number;
  onsetDen: number;
  durNum: number;
  durDen: number;
  /** LilyPond semitones relative to middle C; MIDI = 60 + semi. */
  semi: number;
  /** True when the NoteEvent carries a TieEvent articulation. */
  hasTie: boolean;
  file: string;
  line: number;
  col: number;
  bar: number;
  tieWait: boolean;
}

/** Raw stream TieEvent (chord-wide ties; no per-note flags). */
export interface BrahmsRawTie {
  onsetNum: number;
  onsetDen: number;
}

/** Raw per-voice evidence (one JSONL file per voice from the exporter). */
export interface BrahmsRawVoiceEvidence {
  voice: string;
  segments: BrahmsRawSegment[];
  ties: BrahmsRawTie[];
}

/** Normalized duration event (fixture entry + provenance head). */
export interface BrahmsWrittenDuration {
  pitchClass: number;
  octave: number;
  startTick: number;
  hand: 'RH' | 'LH';
  durationTicks: number;
}

/** Provenance segment (one written LilyPond NoteEvent). */
export interface BrahmsProvenanceSegment {
  voice: string;
  staff: string;
  onset: string;
  duration: string;
  startTick: number;
  durationTicks: number;
  midi: number;
  file: string;
  line: number;
  col: number;
  bar: number;
  occurrence: number;
  tieForward: boolean;
  tieWait: boolean;
}

/** Provenance event (one fixture entry with contributing segments). */
export interface BrahmsProvenanceEvent extends BrahmsWrittenDuration {
  voices: string[];
  staves: string[];
  segments: BrahmsProvenanceSegment[];
  unison: boolean;
}

export function brahmsEventKey(
  pitchClass: number,
  octave: number,
  startTick: number,
  hand: string
): string {
  return `${pitchClass}|${octave}|${startTick}|${hand}`;
}

/** Exact rational whole-note time → integer ticks (no rounding). */
export function brahmsRationalToTicks(num: number, den: number, what: string): number {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) {
    throw new Error(`Brahms source fidelity: ${what} has non-rational time ${num}/${den}`);
  }
  if (num < 0) {
    throw new Error(`Brahms source fidelity: ${what} has negative time ${num}/${den}`);
  }
  const scaled = (num / den) * BRAHMS_WRITTEN_TICKS_PER_WHOLE;
  if (!Number.isInteger(scaled)) {
    throw new Error(
      `Brahms source fidelity: ${what} time ${num}/${den} whole notes ` +
        `is ${scaled} ticks — fractional grid tick, refusing to round`
    );
  }
  return scaled;
}

function staffToHand(staff: string, where: string): 'RH' | 'LH' {
  if (staff === 'upper') return 'RH';
  if (staff === 'lower') return 'LH';
  throw new Error(`Brahms source fidelity: ${where} has unknown staff "${staff}" (want upper/lower)`);
}

interface WorkingSeg extends BrahmsRawSegment {
  onsetTick: number;
  durTick: number;
  endTick: number;
  midi: number;
}

/**
 * Normalize raw LilyPond evidence to written durations.
 *
 * Pure and deterministic. Throws with actionable diagnostics on dangling /
 * ambiguous / noncontiguous explicit note-specific ties, duplicate keys,
 * unknown voices/staves, fractional ticks or missing correspondence.
 * Chord-wide partial ties leave unmatched tones untied per LilyPond source
 * semantics (https://lilypond.org/doc/v2.26/Documentation/notation/writing-rhythms#ties):
 * only matching pitches of the immediately following adjacent event connect;
 * unmatched tones are legitimate reattacks, independent of later recurrence.
 * Explicit tieWaitForNote gaps merge to the next same-pitch segment.
 * Cross-voice unisons collapse to max (sounding) duration.
 */
export function normalizeWrittenDurations(
  evidence: BrahmsRawVoiceEvidence[]
): { events: BrahmsWrittenDuration[]; provenance: BrahmsProvenanceEvent[] } {
  const allowedVoices = new Set<string>(BRAHMS_SOURCE_VOICES);
  // Per-voice merged notes (before cross-voice unison dedup).
  const perVoice: {
    voice: string;
    staff: string;
    hand: 'RH' | 'LH';
    midi: number;
    pitchClass: number;
    octave: number;
    startTick: number;
    durationTicks: number;
    segs: WorkingSeg[];
    tieForward: boolean[];
  }[] = [];

  for (const ev of evidence) {
    if (!allowedVoices.has(ev.voice)) {
      if (ev.segments.length === 0 && ev.ties.length === 0) continue; // implicit empty voice
      throw new Error(
        `Brahms source fidelity: unexpected voice "${ev.voice}" with ` +
          `${ev.segments.length} segments — want one of ${BRAHMS_SOURCE_VOICES.join(', ')}`
      );
    }
    const raw: WorkingSeg[] = ev.segments.map((s, i) => {
      const where = `voice ${ev.voice} segment #${i + 1} (${s.file}:${s.line}:${s.col})`;
      if (s.voice !== ev.voice) {
        throw new Error(`Brahms source fidelity: ${where} voice mismatch "${s.voice}" vs "${ev.voice}"`);
      }
      if (!Number.isInteger(s.semi)) {
        throw new Error(`Brahms source fidelity: ${where} has non-integer semi ${s.semi}`);
      }
      const midi = 60 + s.semi;
      if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
        throw new Error(`Brahms source fidelity: ${where} has unsupported MIDI ${midi} (semi ${s.semi})`);
      }
      const pitch = fromMidi(midi);
      if (pitch.octave < 0) {
        throw new Error(`Brahms source fidelity: ${where} maps to negative octave ${pitch.octave} (MIDI ${midi})`);
      }
      const onsetTick = brahmsRationalToTicks(s.onsetNum, s.onsetDen, `${where} onset`);
      const durTick = brahmsRationalToTicks(s.durNum, s.durDen, `${where} duration`);
      if (durTick <= 0) {
        throw new Error(`Brahms source fidelity: ${where} has non-positive duration ${durTick} ticks`);
      }
      if (!s.file || !Number.isInteger(s.line) || s.line <= 0) {
        throw new Error(`Brahms source fidelity: ${where} lacks source correspondence`);
      }
      staffToHand(s.staff, where); // validates staff now; hand assigned at merge time
      return { ...s, onsetTick, durTick, endTick: onsetTick + durTick, midi };
    });

    // Stream ties by rational onset key.
    const tiesByOnset = new Map<string, number>();
    for (const t of ev.ties) {
      const k = `${t.onsetNum}/${t.onsetDen}`;
      tiesByOnset.set(k, (tiesByOnset.get(k) ?? 0) + 1);
    }
    // Segments by tick onset (tick equality implies rational equality here
    // because all rationals scaled exactly; rational keys used for ties).
    const byOnset = new Map<number, WorkingSeg[]>();
    for (const s of raw) {
      const bucket = byOnset.get(s.onsetTick);
      if (bucket) bucket.push(s);
      else byOnset.set(s.onsetTick, [s]);
    }
    const sortedOnsets = [...byOnset.keys()].sort((a, b) => a - b);
    const onsetIndex = new Map<number, number>();
    sortedOnsets.forEach((t, i) => onsetIndex.set(t, i));

    // Explicit tie-forward per segment: per-note flags plus stream ties.
    // Single-note `e~`: flag + one stream tie. Chord-wide `<..>~`: zero
    // flags + exactly one stream tie. Per-note chord `<a~ ..>`: flags only.
    // `tieForward` is the raw outgoing declaration (provenance truth);
    // `tieKind` preserves the declaration kind for fail-closed resolution:
    // chord-wide ties connect only matching pitches of the immediately
    // following adjacent event (LilyPond source semantics), while explicit
    // note-specific ties require an eligible continuation.
    type BrahmsTieKind = 'none' | 'note' | 'chord';
    const tieForward = new Map<WorkingSeg, boolean>();
    const tieKind = new Map<WorkingSeg, BrahmsTieKind>();
    for (const [tick, grp] of byOnset) {
      const rk = `${grp[0].onsetNum}/${grp[0].onsetDen}`;
      for (const s of grp) {
        if (`${s.onsetNum}/${s.onsetDen}` !== rk && s.onsetTick === tick) {
          // Same tick via different rationals (e.g. 2/4 vs 1/2) — allowed;
          // stream ties keyed by the group's first rational. If ties exist
          // under an alternate spelling, count them too.
        }
      }
      let tieCount = tiesByOnset.get(rk) ?? 0;
      if (tieCount === 0) {
        for (const s of grp) {
          const alt = `${s.onsetNum}/${s.onsetDen}`;
          if (alt !== rk && tiesByOnset.has(alt)) tieCount += tiesByOnset.get(alt)!;
        }
      }
      const hasCount = grp.filter((s) => s.hasTie).length;
      const where = `voice ${ev.voice} onset tick ${tick} (${rk})`;
      if (hasCount > 0 && tieCount > 0) {
        if (grp.length === 1 && hasCount === 1 && tieCount === 1) {
          tieForward.set(grp[0], true);
          tieKind.set(grp[0], 'note');
        } else {
          throw new Error(
            `Brahms source fidelity: ${where} has ambiguous tie evidence ` +
              `(${grp.length} notes, ${hasCount} per-note flags, ${tieCount} stream ties) — ` +
              `chord-wide versus per-note ties cannot be distinguished; refusing to guess`
          );
        }
      } else if (hasCount > 0) {
        for (const s of grp) {
          tieForward.set(s, s.hasTie);
          tieKind.set(s, s.hasTie ? 'note' : 'none');
        }
      } else if (tieCount > 0) {
        if (tieCount !== 1) {
          throw new Error(
            `Brahms source fidelity: ${where} has ${tieCount} stream ties for ` +
              `${grp.length} notes — chord-wide tie must carry exactly one; refusing to guess`
          );
        }
        for (const s of grp) {
          tieForward.set(s, true);
          // A lone single-note stream tie is still an explicit tie on that
          // pitch (no partial-continuation concept); only multi-note
          // chord-wide declarations leave unmatched tones legitimately untied.
          tieKind.set(s, grp.length === 1 ? 'note' : 'chord');
        }
      } else {
        for (const s of grp) {
          tieForward.set(s, false);
          tieKind.set(s, 'none');
        }
      }
    }

    // Per-pitch chains in onset order.
    const byPitch = new Map<number, WorkingSeg[]>();
    for (const s of raw) {
      const bucket = byPitch.get(s.midi);
      if (bucket) bucket.push(s);
      else byPitch.set(s.midi, [s]);
    }
    for (const [midi, lst] of byPitch) {
      lst.sort((a, b) => a.onsetTick - b.onsetTick);
      let cur: WorkingSeg[] = [];
      let curEnd = 0;
      const flush = () => {
        if (cur.length === 0) return;
        const staffs = new Set(cur.map((s) => s.staff));
        if (staffs.size > 1) {
          throw new Error(
            `Brahms source fidelity: voice ${ev.voice} MIDI ${midi} tie chain crosses staves ` +
              `(${[...staffs].join(', ')}, lines ${cur.map((s) => s.line).join(', ')}) — refusing to guess hand`
          );
        }
        const hand = staffToHand(cur[0].staff, `voice ${ev.voice} MIDI ${midi} line ${cur[0].line}`);
        const pitch = fromMidi(midi);
        perVoice.push({
          voice: ev.voice,
          staff: cur[0].staff,
          hand,
          midi,
          pitchClass: pitch.pitchClass,
          octave: pitch.octave,
          startTick: cur[0].onsetTick,
          durationTicks: curEnd - cur[0].onsetTick,
          segs: [...cur],
          tieForward: cur.map((s) => tieForward.get(s)!),
        });
        cur = [];
        curEnd = 0;
      };
      for (let i = 0; i < lst.length; i++) {
        const s = lst[i];
        if (cur.length === 0) {
          cur = [s];
          curEnd = s.endTick;
        } else {
          const prev = lst[i - 1];
          const prevTF = tieForward.get(prev)!;
          if (!prevTF) {
            flush();
            cur = [s];
            curEnd = s.endTick;
          } else {
            const kind = tieKind.get(prev)!;
            const prevIdx = onsetIndex.get(prev.onsetTick)!;
            const curIdx = onsetIndex.get(s.onsetTick)!;
            const isImmediate = curIdx === prevIdx + 1;
            const adjacent = prev.endTick === s.onsetTick;
            if (isImmediate && adjacent) {
              cur.push(s);
              curEnd = s.endTick;
            } else if (prev.tieWait) {
              // Explicit tieWaitForNote gap (witness mm. 39–40): sounding
              // duration spans the gap to the next same-pitch segment.
              cur.push(s);
              curEnd = s.endTick;
            } else if (kind === 'note') {
              // Explicit note-specific tie with no eligible continuation:
              // fail closed rather than silently flushing into a reattack.
              throw new Error(
                `Brahms source fidelity: voice ${ev.voice} MIDI ${midi} explicit note-specific tie ` +
                  `at ${prev.file}:${prev.line}:${prev.col} tick ${prev.onsetTick} has no eligible same-pitch ` +
                  `continuation (next same-pitch tick ${s.onsetTick} at ${s.file}:${s.line}:${s.col}; ` +
                  `immediate=${isImmediate} adjacent=${adjacent} tieWait=false) — refusing to silently reattack`
              );
            } else {
              // Chord-wide partial tie with no adjacent same-pitch
              // successor (e.g. `<chord>2~` into arpeggiated eighths):
              // unmatched tones stay untied per LilyPond source semantics
              // (only matching pitches of the next event connect), not an
              // error — independent of any later recurrence.
              flush();
              cur = [s];
              curEnd = s.endTick;
            }
          }
        }
        if (i === lst.length - 1) {
          if (tieForward.get(s)!) {
            const kind = tieKind.get(s)!;
            if (kind === 'note') {
              throw new Error(
                `Brahms source fidelity: voice ${ev.voice} MIDI ${midi} ${s.file}:${s.line}:${s.col} ` +
                  `tick ${s.onsetTick} carries an explicit note-specific tie with no following same-pitch segment — dangling tie`
              );
            }
            // Chord-wide unmatched final tone: legitimately untied per
            // LilyPond source semantics (no matching successor); the later
            // recurrence of an unrelated pitch must not decide validity.
          }
          flush();
        }
      }
    }
  }

  // Occurrence per raw origin (repeat iteration) in unfolded onset order.
  const originOrder = new Map<string, number>();
  const allSegs = perVoice.flatMap((m) => m.segs);
  const sortedSegs = [...allSegs].sort((a, b) => a.onsetTick - b.onsetTick);
  for (const s of sortedSegs) {
    const k = `${s.file}:${s.line}:${s.col}:${s.midi}`;
    originOrder.set(k, (originOrder.get(k) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const occurrenceOf = (s: WorkingSeg): number => {
    const k = `${s.file}:${s.line}:${s.col}:${s.midi}`;
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    void originOrder;
    return n;
  };

  // Cross-voice unison dedup within hand (max sounding duration).
  const byKey = new Map<string, typeof perVoice>();
  for (const m of perVoice) {
    const k = brahmsEventKey(m.pitchClass, m.octave, m.startTick, m.hand);
    const bucket = byKey.get(k);
    if (bucket) bucket.push(m);
    else byKey.set(k, [m]);
  }
  const events: BrahmsWrittenDuration[] = [];
  const provenance: BrahmsProvenanceEvent[] = [];
  const sortedKeys = [...byKey.keys()].sort((a, b) => {
    const [apc, ao, ast, ah] = a.split('|');
    const [bpc, bo, bst, bh] = b.split('|');
    return (
      Number(ast) - Number(bst) ||
      ah.localeCompare(bh) ||
      Number(apc) - Number(bpc) ||
      Number(ao) - Number(bo)
    );
  });
  for (const k of sortedKeys) {
    const bucket = byKey.get(k)!;
    // Same-voice duplicates are malformed input (one voice cannot hold two
    // identical keys); cross-voice unisons are legitimate and deduped.
    const voicesInBucket = bucket.map((m) => m.voice);
    if (new Set(voicesInBucket).size !== voicesInBucket.length) {
      throw new Error(
        `Brahms source fidelity: key ${k} appears ${bucket.length} times within one voice ` +
          `(${voicesInBucket.join(', ')}) — duplicated event key; refusing to guess`
      );
    }
    const base = bucket[0];
    const durationTicks = Math.max(...bucket.map((m) => m.durationTicks));
    const voices = [...new Set(bucket.map((m) => m.voice))].sort();
    const staves = [...new Set(bucket.map((m) => m.staff))].sort();
    const mergedSegs = bucket
      .flatMap((m, bi) => m.segs.map((s, si) => ({ s, tf: m.tieForward[si], bi })))
      .sort((a, b) => a.s.onsetTick - b.s.onsetTick || a.s.voice.localeCompare(b.s.voice));
    events.push({
      pitchClass: base.pitchClass,
      octave: base.octave,
      startTick: base.startTick,
      hand: base.hand,
      durationTicks,
    });
    provenance.push({
      pitchClass: base.pitchClass,
      octave: base.octave,
      startTick: base.startTick,
      hand: base.hand,
      durationTicks,
      voices,
      staves,
      unison: bucket.length > 1,
      segments: mergedSegs.map(({ s, tf }) => ({
        voice: s.voice,
        staff: s.staff,
        onset: `${s.onsetNum}/${s.onsetDen}`,
        duration: `${s.durNum}/${s.durDen}`,
        startTick: s.onsetTick,
        durationTicks: s.durTick,
        midi: s.midi,
        file: s.file,
        line: s.line,
        col: s.col,
        bar: s.bar,
        occurrence: occurrenceOf(s),
        tieForward: tf,
        tieWait: s.tieWait,
      })),
    });
  }
  return { events, provenance };
}

/**
 * Round 46 — **display tie chains** from the committed provenance.
 *
 * For every sounding note, the provenance holds the ordered written segments
 * of every voice that produced it (cross-voice unisons are deduped into one
 * event with the max sounding duration). A voice with **two or more** segments
 * is a written tie chain: the segments are the components, `tieForward` the
 * outgoing tie of each, `tieWait` its `tieWaitForNote` context. When several
 * voices of one event carry a chain (the m61 E2, whose coincident RH statement
 * is subsumed) the **dominant** one — the longest total written value, ties
 * broken by voice name — is the chain the display states.
 *
 * Pure and non-mutating: no fixture, note, pitch, onset or duration is changed,
 * and the (pitchClass, octave, startTick, hand) bijection the duration overlay
 * validates is untouched. A note with no multi-segment voice gets no chain.
 */
export function deriveWrittenTieChains<
  T extends {
    id: string;
    pitch: { pitchClass: number; octave: number };
    startTick: number;
    hand: 'RH' | 'LH';
  },
>(notes: readonly T[], provenance: readonly BrahmsProvenanceEvent[]): WrittenTieChain[] {
  const byKey = new Map<string, BrahmsProvenanceEvent>();
  for (const p of provenance) {
    const k = brahmsEventKey(p.pitchClass, p.octave, p.startTick, p.hand);
    if (byKey.has(k)) {
      throw new Error(`Brahms written tie chains: provenance has duplicate key ${k}`);
    }
    byKey.set(k, p);
  }
  const chains: WrittenTieChain[] = [];
  for (const note of notes) {
    const k = brahmsEventKey(note.pitch.pitchClass, note.pitch.octave, note.startTick, note.hand);
    const event = byKey.get(k);
    if (!event) {
      throw new Error(`Brahms written tie chains: no provenance entry for note ${note.id} key ${k}`);
    }
    const byVoice = new Map<string, BrahmsProvenanceEvent['segments']>();
    for (const seg of event.segments) {
      const bucket = byVoice.get(seg.voice);
      if (bucket) bucket.push(seg);
      else byVoice.set(seg.voice, [seg]);
    }
    let best: { voice: string; segs: BrahmsProvenanceEvent['segments'] } | null = null;
    for (const [voice, segs] of byVoice) {
      if (segs.length < 2) continue;
      const total = segs.reduce((a, b) => a + b.durationTicks, 0);
      if (
        best === null ||
        total > best.segs.reduce((a, b) => a + b.durationTicks, 0) ||
        (total === best.segs.reduce((a, b) => a + b.durationTicks, 0) && voice < best.voice)
      ) {
        best = { voice, segs };
      }
    }
    if (!best) continue;
    const components: WrittenTieComponent[] = [...best.segs]
      .sort((a, b) => a.startTick - b.startTick || a.durationTicks - b.durationTicks)
      .map((seg) => ({
        startTick: seg.startTick,
        durationTicks: seg.durationTicks,
        tieForward: seg.tieForward,
        tieWait: seg.tieWait,
        voice: seg.voice,
      }));
    chains.push({
      noteId: note.id,
      components,
      soundingTicks: event.durationTicks,
      voice: best.voice,
    });
  }
  return chains;
}

/**
 * Validated duration overlay: returns a new note array with corrected
 * durations. Matches (pitchClass, octave, startTick, hand) exactly and
 * requires a bijection; changes durationTicks only. No fallback — any
 * missing/malformed fixture entry throws with actionable diagnostics.
 */
export function applyWrittenDurations<
  T extends {
    id: string;
    pitch: { pitchClass: number; octave: number };
    startTick: number;
    durationTicks: number;
    hand: 'RH' | 'LH';
  },
>(notes: readonly T[], fixture: readonly BrahmsWrittenDuration[]): T[] {
  const fixtureMap = new Map<string, BrahmsWrittenDuration>();
  for (const f of fixture) {
    const k = brahmsEventKey(f.pitchClass, f.octave, f.startTick, f.hand);
    if (fixtureMap.has(k)) {
      throw new Error(`Brahms written durations: fixture has duplicate key ${k} — refusing overlay`);
    }
    if (!Number.isInteger(f.durationTicks) || f.durationTicks <= 0) {
      throw new Error(`Brahms written durations: fixture key ${k} has invalid duration ${f.durationTicks}`);
    }
    fixtureMap.set(k, f);
  }
  const seen = new Set<string>();
  const out = notes.map((n) => {
    const k = brahmsEventKey(n.pitch.pitchClass, n.pitch.octave, n.startTick, n.hand);
    if (seen.has(k)) {
      throw new Error(`Brahms written durations: score has duplicate key ${k} (${n.id}) — refusing overlay`);
    }
    seen.add(k);
    const f = fixtureMap.get(k);
    if (!f) {
      throw new Error(
        `Brahms written durations: no fixture entry for score note ${n.id} key ${k} — ` +
          `no fallback to performance durations`
      );
    }
    return { ...n, durationTicks: f.durationTicks };
  });
  if (fixtureMap.size !== notes.length) {
    const extra: string[] = [];
    for (const k of fixtureMap.keys()) if (!seen.has(k)) extra.push(k);
    throw new Error(
      `Brahms written durations: fixture has ${fixtureMap.size} entries for ${notes.length} notes; ` +
        `${extra.length} unmatched fixture keys (e.g. ${extra.slice(0, 5).join(', ')}) — refusing overlay`
    );
  }
  return out;
}
