import toneMidi from '@tonejs/midi';
import { QuantizedGridScore, QuantizedNote, Hand } from './types';
import { fromMidi } from './pitch';
import { detectHandCrossings } from './grid';

// Handle CommonJS / ESM default export interop cleanly
const MidiClass = (toneMidi as any).Midi || (toneMidi as any).default?.Midi || toneMidi;

export interface MidiIngestOptions {
  id?: string;
  title?: string;
  composer?: string;
}

/**
 * Deterministically ingests a MIDI file (as ArrayBuffer or Uint8Array)
 * into a presentation-agnostic QuantizedGridScore ("quantized fence").
 *
 * Converts standard MIDI note numbers to pure (pitchClass: 0..11, octave: 0..N)
 * and note ticks into lossless quantized time coordinates.
 */
export function parseMidiToScore(
  data: ArrayBuffer | Uint8Array,
  options: MidiIngestOptions = {}
): QuantizedGridScore {
  const midi = new MidiClass(data);
  const ppq = midi.header.ppq || 480;

  // Attempt to normalize resolution cleanly to 48 ticks per beat if exact multiple
  let targetTpb = ppq;
  let scale = 1;
  if (ppq % 48 === 0) {
    const testScale = 48 / ppq;
    let isExact = true;
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        const scaledStart = note.ticks * testScale;
        const scaledDur = note.durationTicks * testScale;
        if (
          Math.abs(scaledStart - Math.round(scaledStart)) > 0.001 ||
          Math.abs(scaledDur - Math.round(scaledDur)) > 0.001
        ) {
          isExact = false;
          break;
        }
      }
      if (!isExact) break;
    }
    if (isExact) {
      targetTpb = 48;
      scale = testScale;
    }
  }

  const notes: QuantizedNote[] = [];
  let noteCounter = 0;
  const trackCount = midi.tracks.length;

  midi.tracks.forEach((track: any, tIdx: number) => {
    let hand: Hand = 'RH';
    const trackName = (track.name || '').toLowerCase();
    if (
      trackName.includes('lower') ||
      trackName.includes('left') ||
      trackName.includes('lh') ||
      trackName.includes('bass')
    ) {
      hand = 'LH';
    } else if (
      trackName.includes('upper') ||
      trackName.includes('right') ||
      trackName.includes('rh') ||
      trackName.includes('treble')
    ) {
      hand = 'RH';
    } else if (trackCount === 2) {
      hand = tIdx === 0 ? 'RH' : 'LH';
    }

    track.notes.forEach((n: any) => {
      const assignedHand: Hand =
        trackCount === 1 ? (n.midi < 60 ? 'LH' : 'RH') : hand;
      notes.push({
        id: `${options.id || 'midi'}-${++noteCounter}`,
        pitch: fromMidi(n.midi),
        startTick: Math.round(n.ticks * scale),
        durationTicks: Math.max(1, Math.round(n.durationTicks * scale)),
        hand: assignedHand,
        velocity: Math.round((n.velocity || 0.7) * 127),
      });
    });
  });

  notes.sort(
    (a, b) =>
      a.startTick - b.startTick ||
      a.pitch.octave - b.pitch.octave ||
      a.pitch.pitchClass - b.pitch.pitchClass
  );

  let maxTick = 0;
  for (const n of notes) {
    const end = n.startTick + n.durationTicks;
    if (end > maxTick) maxTick = end;
  }

  const ts = midi.header.timeSignatures[0]?.timeSignature || [4, 4];
  const num = ts[0];
  const den = ts[1];
  const ticksPerMeasure = Math.round(num * ((targetTpb * 4) / den));
  const totalMeasures = Math.ceil(maxTick / ticksPerMeasure) || 1;
  const totalTicks = totalMeasures * ticksPerMeasure;

  const barlines = [];
  for (let m = 1; m <= totalMeasures + 1; m++) {
    barlines.push({
      barNumber: m,
      tick: (m - 1) * ticksPerMeasure,
      type: (m === totalMeasures + 1
        ? 'final'
        : m === 1
        ? 'regular'
        : 'regular') as any,
    });
  }

  const tempos = midi.header.tempos.map((t: any) => ({
    tick: Math.round(t.ticks * scale),
    bpm: Math.round(t.bpm),
  }));
  if (tempos.length === 0) {
    tempos.push({ tick: 0, bpm: 100 });
  }

  const scoreTitle =
    options.title || midi.header.name || midi.name || 'Imported Score';

  const score: QuantizedGridScore = {
    id: options.id || 'imported-midi',
    title: scoreTitle,
    composer: options.composer || 'MIDI Source',
    ticksPerBeat: targetTpb,
    totalTicks,
    timeSignatures: [{ tick: 0, numerator: num, denominator: den }],
    barlines,
    tempos,
    dynamics: [],
    pedals: [],
    notes,
  };

  score.handCrossings = detectHandCrossings(score);
  return score;
}
