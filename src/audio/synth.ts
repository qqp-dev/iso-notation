import { PitchCoordinate } from '../model/types';
import { toFrequency, linearIndex } from '../model/pitch';

class PolySynth {
  private ctx: AudioContext | null = null;
  private activeVoices = new Map<number, { osc: OscillatorNode; gain: GainNode }>();

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public playPitch(pitch: PitchCoordinate, durationSec: number = 0.5, velocity: number = 80): void {
    const ctx = this.getAudioContext();
    const freq = toFrequency(pitch);
    const key = linearIndex(pitch);

    // Stop existing voice on this pitch if any
    this.stopPitch(pitch);

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    // Warm triangle/saw hybrid waveform for rich acoustic piano harmonic richness
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // Dynamic lowpass filter based on pitch and velocity
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(8000, freq * 4 + (velocity / 127) * 2000), now);
    filter.Q.setValueAtTime(1.0, now);

    // ADSR Envelope
    const peakGain = (velocity / 127) * 0.25;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), now + 0.01); // 10ms attack
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain * 0.6), now + 0.15); // decay
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.2, durationSec)); // release

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + Math.max(0.2, durationSec) + 0.05);

    this.activeVoices.set(key, { osc, gain });

    setTimeout(() => {
      if (this.activeVoices.get(key)?.osc === osc) {
        this.activeVoices.delete(key);
      }
    }, (Math.max(0.2, durationSec) + 0.1) * 1000);
  }

  public stopPitch(pitch: PitchCoordinate): void {
    const key = linearIndex(pitch);
    const voice = this.activeVoices.get(key);
    if (voice && this.ctx) {
      const now = this.ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      voice.osc.stop(now + 0.06);
      this.activeVoices.delete(key);
    }
  }

  public stopAll(): void {
    if (this.ctx) {
      const now = this.ctx.currentTime;
      for (const voice of this.activeVoices.values()) {
        try {
          voice.gain.gain.cancelScheduledValues(now);
          voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
          voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
          voice.osc.stop(now + 0.04);
        } catch {
          // ignore
        }
      }
      this.activeVoices.clear();
    }
  }
}

export const synth = new PolySynth();
