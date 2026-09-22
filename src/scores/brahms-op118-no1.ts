import fs from "node:fs";
import path from "node:path";
import { QuantizedGridScore } from "../model/types";
import { parseMidiToScore } from "../model/midi";
import { detectHandCrossings } from "../model/grid";
import {
  BRAHMS_VOICE_HAND,
  BrahmsSourceVoice,
  applyWrittenDurations,
  brahmsSourceHandsOf,
  deriveWrittenTieChains,
} from "./brahms-source-fidelity";
import { applyBrahmsHandCorrections } from "./brahms-hand-corrections";
import writtenDurationsFixture from "./data/brahms-op118-no1-written-durations.json";
import writtenDurationsProvenance from "./data/brahms-op118-no1-written-durations.provenance.json";
import sourceSilences from "./data/brahms-op118-no1-source-silences.json";
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
} from "../render/janko/types";

/**
 * Johannes Brahms: Intermezzo in A minor, Op. 118 No. 1
 * Allegro non assai, ma molto appassionato — the **complete** piece
 * (upbeat + 70 full cut-time measures + the closing 144-tick measure).
 *
 * Ingested deterministically and losslessly from authentic LilyPond-compiled MIDI
 * (public/midi/brahms-op118-no1.mid). Round 15 extends the ingest past m. 9 so
 * the rest-dialect review can anchor on real bars (mm. 7, 17, 39, 66, 68): the
 * full 70-bar MIDI was already vendored, and every earlier window is unchanged.
 */

/** Quarter-note resolution shared with the rest of the repository. */
const TICKS_PER_BEAT = 48;
/** Cut time: two half-note beats = four quarters. */
export const BRAHMS_OP118_NO1_TICKS_PER_MEASURE = 192;
/** Upbeat duration in ticks (cut-time quarter note upbeat). */
export const BRAHMS_OP118_NO1_ANACRUSIS_TICKS = 48;
/** Eighth note, the resolution of every arpeggio in the piece. */
const EIGHTH = TICKS_PER_BEAT / 2;
/**
 * Measures engraved: the complete Intermezzo. The upbeat (48 ticks) plus 70
 * full 192-tick measures plus the closing 144-tick measure span exactly
 * `71 × 192 = 13632` ticks, which is the vendored MIDI's own length.
 */
export const BRAHMS_OP118_NO1_MEASURES = 71;
/** Total length of the complete score (ticks), straight from the MIDI. */
export const BRAHMS_OP118_NO1_TOTAL_TICKS = 13632;

/**
 * Jánko layout options for this score: authentic cut-time measure length and
 * 48-tick anacrusis.
 */
export const BRAHMS_OP118_NO1_JANKO_OPTIONS: Partial<JankoLayoutOptions> = {
  ...DEFAULT_JANKO_OPTIONS,
  ticksPerMeasure: BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  anacrusisTicks: BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  // Canonical packing (judged): settled four-per-system — first system the
  // 48-tick pickup plus four full 192-tick measures, later systems four full
  // measures, including subsequent-page tops — on the fixed-3 core at four
  // systems/page (18 systems over 5 pages). Full interior quarter-position
  // grid (Round 33 judged: full grid selected, no comparison).
  measuresPerSystem: 4,
  correctPageTopAnacrusisMeasureWidth: true,
  gridPulseFilter: 'all',
  systemsPerPage: 4,
  // Content-aware vertical placement: facing ink clearances (including
  // ottava extent) enforced, residual page space distributed evenly —
  // reclaiming the excess air fixed slots leave between uneven systems.
  verticalPlacement: 'content-aware',
  // Title block (operator order — composer right-only, title fits): no
  // composer prefix up top (it duplicated the right-aligned composer on
  // p0 and stuttered in every running head); the subtitle keeps the
  // tempo head with 135.4pt of air to the composer (measured Liberation
  // Serif Italic v2.1.5 advances; the full marking survives verbatim in
  // score.tempos below). Renderer untouched — Bach stays byte-identical.
  title: "6 Klavierstücke, Op. 118",
  subtitle: "No. 1. Intermezzo in A minor — Allegro non assai",
  composer: "Johannes Brahms",
  // Round 46 (working Brahms Reference): the operator's settled 95 % reading —
  // larger readable symbols with declared, centred optical cluster spacing and
  // 0.30pt of extra optical air, the one 45-degree duration family on both
  // mounts with the Round 46 long-value vocabulary (96 = half-ring,
  // 192 = one ring, 384 = two rings), a bracket-only 20 % ring enlargement,
  // horizontal carriers for the remaining cluster durations, literal low
  // pitches (Round 45's unwanted ledger/outlier ink removed) and the committed
  // source ties rendered component-by-component. The surface is declared by
  // `CURRENT_CANDIDATES` as two real-engine variants (95 % at 0.30pt air and
  // the 95 % at 0.20pt air spacing control), both carrying every Round 46 fix;
  // Bach GOLD stays frozen.
  pitchPlacement: 'parity-columns',
  chordSymbolScale: 0.95,
  bracketDurationGrammar: 'midpoint',
  exceptionCarrier: 'horizontal',
  opticalSpacing: true,
  lowPitchFolding: 'literal',
  writtenTies: 'source',
};

/** Jánko micro-typography for this score. */
export const BRAHMS_OP118_NO1_JANKO_TOKENS: Partial<JankoTokens> = {
  ...DEFAULT_JANKO_TOKENS,
  ticksPerMeasure: BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
  anacrusisTicks: BRAHMS_OP118_NO1_ANACRUSIS_TICKS,
  // Round 45/46 readability ratios (vs the Round 44 .75 family): the slash
  // centreline length stays ×1.10 and the **horizontal** ring keeps its ×1.10
  // radius/stroke (the existing 95 % size); the **bracket** ring and half-ring
  // grow a further ×1.20 (`midpointBracketRingScale`) — r 1.672 → 2.0064pt,
  // stroke 0.61655 → 0.73986pt, ring centre pitch 4.43555 → 5.22766pt.
  // The cut centre pitch gains another **0.20pt at the 95 % working scale**
  // (1.8965782383 → 2.09658pt) by spacing alone: the 45-degree angle, slash
  // length and stroke are untouched. 0.30pt is the round's working vertical
  // optical clearance (the 0.20 control variant overrides it back).
  midpointSlashLengthFactor: 1.1,
  midpointRingScale: 1.1,
  midpointBracketRingScale: 1.2,
  midpointSpacingFactor: 2.09658 / (Math.SQRT2 * (0.71 + 0.5) * 0.95),
  opticalClearanceAir: 0.3,
  // Round 49 §5 — the operator-preferred 48B detached-circle baseline plus the
  // family-wide rightward air: the closed circle reads at 0.88 of its Round 47
  // size, and every horizontal duration mount — detached circle, half-ring,
  // horizontal carrier arm, short carrier — keeps 0.80pt of clear air from the
  // ink it belongs to (the incumbent air was the 0.30pt optical clearance).
  // The values were bounded on the real engine by the Round 49 candidate
  // cards; the detached mount itself only paints under `exceptionCarrier:
  // 'symbol'`, so the working Reference receives the family air alone.
  detachedRingScale: 0.88,
  detachedSymbolAir: 0.8,
  horizontalMountAir: 0.8,
};

/** Embedded base64 fallback for browser and headless execution without filesystem. */
export const BRAHMS_OP118_NO1_MIDI_BASE64 = "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";

export function getBrahmsMidiData(): Uint8Array {
  if (typeof process !== "undefined" && process.versions?.node && fs && typeof fs.readFileSync === "function") {
    try {
      const candidates = [
        path.resolve(process.cwd(), "public/midi/brahms-op118-no1.mid"),
        new URL("../../public/midi/brahms-op118-no1.mid", import.meta.url).pathname,
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return fs.readFileSync(p);
      }
    } catch {
      // Fall through to embedded base64
    }
  }
  const binary =
    typeof atob === "function"
      ? atob(BRAHMS_OP118_NO1_MIDI_BASE64)
      : Buffer.from(BRAHMS_OP118_NO1_MIDI_BASE64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Builds the authentic 9-measure (+ upbeat) score for Brahms Op. 118 No. 1
 * deterministically ingested from the MIDI reference.
 */
export function buildBrahmsOp118No1Score(): QuantizedGridScore {
  const midiData = getBrahmsMidiData();
  const parsed = parseMidiToScore(midiData, {
    id: "brahms-op118-no1",
    title: "Intermezzo in A minor, Op. 118 No. 1",
    composer: "Johannes Brahms",
  });

  const totalTicks = BRAHMS_OP118_NO1_TOTAL_TICKS;

  const midiNotes = parsed.notes
    .filter((n) => n.startTick < totalTicks)
    .map((n, idx) => ({
      ...n,
      id: `brahms-op118-no1-${idx + 1}`,
    }));

  // Written-duration overlay (source-fidelity milestone): validated bijection
  // on (pitchClass, octave, startTick, hand); durationTicks only. No fallback
  // to performance durations — any mismatch throws. Hand follows the
  // MIDI-track baseline (staff destination); voice identity lives in
  // provenance for future intent work. See data/sources/brahms-op118-no1/.
  if ((writtenDurationsFixture as { version?: number }).version !== 1) {
    throw new Error('Brahms written durations: fixture version mismatch (want 1) — refusing overlay');
  }
  const durationOverlaid = applyWrittenDurations(
    midiNotes,
    (writtenDurationsFixture as { durations: { pitchClass: number; octave: number; startTick: number; hand: 'RH' | 'LH'; durationTicks: number }[] }).durations
  );

  // Bounded source-informed hand correction (ticket §4 + amendment): ten
  // authorized LH → RH retargetings for the descending RH line in mm. 23/43
  // and its phrase continuation in mm. 24/44, applied AFTER the validated
  // duration overlay (original track keys) and BEFORE hand-crossing
  // computation. Preserves order and every other field.
  // Round 46 — committed written tie chains (display only), derived on the
  // very keys the duration overlay just validated (before the hand corrections
  // retarget five notes away from the provenance's MIDI-track hands). Keyed by
  // note id, so the chains follow the corrected notes unchanged. Sounding
  // identities/timing are untouched and the fixture's 964-key bijection is
  // unchanged.
  const tieChains = deriveWrittenTieChains(
    durationOverlaid,
    (writtenDurationsProvenance as { events: Parameters<typeof deriveWrittenTieChains>[1][number][] }).events
  );

  // Round 48 — committed **source provenance** on every sounding event: the source voices
  // and staves that state the event and the hand the source's own parts assign
  // it (`BRAHMS_VOICE_HAND`, cited there). Display metadata only: no displayed
  // hand, pitch, onset or duration is touched. The engine's rest layer reads the
  // source hand *in addition to* the displayed one, so a spacer in one voice can
  // never be promoted into a hand-rest while another voice of the same hand
  // sounds.
  const provenanceByKey = new Map(
    (writtenDurationsProvenance as {
      events: Array<{
        pitchClass: number;
        octave: number;
        startTick: number;
        hand: 'RH' | 'LH';
        voices: string[];
        staves: string[];
        unison: boolean;
      }>;
    }).events.map((event) => [
      `${event.pitchClass}|${event.octave}|${event.startTick}|${event.hand}`,
      event,
    ])
  );
  const withSourceProvenance = (list: typeof durationOverlaid): typeof durationOverlaid =>
    list.map((note) => {
      const key = `${note.pitch.pitchClass}|${note.pitch.octave}|${note.startTick}|${note.hand}`;
      const event = provenanceByKey.get(key);
      if (!event) return note;
      return {
        ...note,
        sourceProvenance: {
          voices: [...event.voices].sort(),
          staves: [...event.staves].sort(),
          hands: brahmsSourceHandsOf(event, `event ${key}`),
          unison: event.unison,
        },
      };
    });
  // The added written-tie continuation heads carry no provenance event of their
  // own (they are display components of one sounding event): their source hand
  // is the chain's own source voice.
  const chainVoiceById = new Map(tieChains.map((chain) => [chain.noteId, chain.voice]));
  const sourcedNotes = withSourceProvenance(durationOverlaid).map((note) => {
    if (note.sourceProvenance) return note;
    const voice = chainVoiceById.get(note.id);
    if (!voice) return note;
    const hand = BRAHMS_VOICE_HAND[voice as BrahmsSourceVoice];
    return hand
      ? { ...note, sourceProvenance: { voices: [voice], staves: [], hands: [hand], unison: false } }
      : note;
  });
  // The bounded hand corrections run **after** the provenance is attached: the
  // table retargets the displayed hand only, and the source fact rides along
  // untouched (the correction's own rationale is the source part grouping).
  const notes = applyBrahmsHandCorrections(sourcedNotes);


  // One barline per measure opening plus the score's closing boundary. The
  // final measure is 144 ticks long (the piece's own closing bar), so the last
  // barline sits at the MIDI's true end rather than on the 192-tick lattice.
  const barlines: QuantizedGridScore["barlines"] = [];
  for (let m = 1; m <= BRAHMS_OP118_NO1_MEASURES; m++) {
    barlines.push({
      barNumber: m,
      tick: BRAHMS_OP118_NO1_ANACRUSIS_TICKS + (m - 1) * BRAHMS_OP118_NO1_TICKS_PER_MEASURE,
      type: "regular",
    });
  }
  barlines.push({
    barNumber: BRAHMS_OP118_NO1_MEASURES + 1,
    tick: totalTicks,
    type: "final",
  });

  const score: QuantizedGridScore = {
    ...parsed,
    id: "brahms-op118-no1",
    title: "Intermezzo in A minor, Op. 118 No. 1",
    composer: "Johannes Brahms",
    opus: "Op. 118",
    ticksPerBeat: TICKS_PER_BEAT,
    gridResolution: EIGHTH,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: 2, denominator: 2 }],
    barlines,
    tempos: [{ tick: 0, bpm: 88, description: "Allegro non assai, ma molto appassionato" }],
    dynamics: [],
    pedals: [],
    notes,
    tieChains,
    // Round 48: the source's authored silences (written rests *and* spacers),
    // straight from the exporter's committed sidecar — the evidence the rest
    // layer checks before it ever paints a hand-rest.
    sourceSilences: (sourceSilences as { silences: QuantizedGridScore['sourceSilences'] }).silences,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
