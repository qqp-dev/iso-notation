/**
 * Playback mapping between score ticks and engraved page coordinates.
 *
 * Pure UI-layer adapter over the Jánko geometry: the playhead position,
 * click-to-seek and MIDI readiness checks all run through here, so the React
 * views stay free of engraving math — and everything here is unit-tested
 * headlessly in `test/janko-playback.test.ts`.
 *
 * The layout engraves every score on the token grid (`ticksPerBeat` /
 * `ticksPerMeasure`): a score's own time signatures only matter insofar as
 * they land on that grid (see {@link checkMidiReadiness}).
 */
import { computePageGeometry, countJankoSystems } from '../render/janko/engine';
import { getTickX, splitTick } from '../render/janko/geometry';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../render/janko/types';
import { QuantizedGridScore } from '../model/types';

/** Largest score the v1 landing engraves in one pass. */
export const PLAYBACK_MAX_NOTES = 6000;
export const PLAYBACK_MAX_MEASURES = 128;

/** Engraved position of one score tick: page, system and a staff-spanning segment. */
export interface PlayheadPosition {
  page: number;
  system: number;
  systemInPage: number;
  x: number;
  topY: number;
  botY: number;
}

/**
 * Page coordinates of the playhead for an absolute score tick.
 *
 * The x matches the layout's own note columns (`getTickX` with the default
 * measure insets); the segment spans the active system's staff band. Ticks
 * outside the score clamp to its ends.
 */
export function locateTick(
  score: QuantizedGridScore,
  tick: number,
  options = DEFAULT_JANKO_OPTIONS,
  tokens = DEFAULT_JANKO_TOKENS
): PlayheadPosition {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const totalTicks = Math.max(1, score.totalTicks || 0);
  const clamped = Math.min(Math.max(0, tick), totalTicks - 1);
  const totalMeasures = Math.max(1, Math.ceil(totalTicks / t.ticksPerMeasure));
  const totalSystems = Math.max(1, countJankoSystems(score, o, t));
  const { measureOffset, tickInMeasure } = splitTick(clamped, t);
  const m = Math.min(measureOffset, totalMeasures - 1);
  const s = Math.min(Math.floor(m / o.measuresPerSystem), totalSystems - 1);
  const page = Math.floor(s / o.systemsPerPage);
  const systemInPage = s % o.systemsPerPage;
  const geo = computePageGeometry(o, t, score);
  const sys = geo.systems[Math.min(systemInPage, geo.systems.length - 1)];
  const slot = Math.min(
    Math.max(0, m - s * o.measuresPerSystem),
    o.measuresPerSystem - 1
  );
  const x =
    sys.staffLeft + getTickX(clamped, slot, tickInMeasure, sys.measureWidth, t);
  return {
    page,
    system: s,
    systemInPage,
    x,
    topY: sys.staffTopY - 3,
    botY: sys.staffBotY + 3,
  };
}

/**
 * Score tick for a click at page coordinates (measure granularity).
 *
 * The click resolves to the system whose slot band holds the y and the
 * measure slot holding the x; the returned tick is that measure's downbeat.
 */
export function tickAtPoint(
  score: QuantizedGridScore,
  page: number,
  ptX: number,
  ptY: number,
  options = DEFAULT_JANKO_OPTIONS,
  tokens = DEFAULT_JANKO_TOKENS
): number {
  const o = resolveJankoOptions(options);
  const t = resolveJankoTokens(tokens);
  const totalTicks = Math.max(1, score.totalTicks || 0);
  const totalMeasures = Math.max(1, Math.ceil(totalTicks / t.ticksPerMeasure));
  const totalSystems = Math.max(1, countJankoSystems(score, o, t));
  const pages = Math.max(1, Math.ceil(totalSystems / o.systemsPerPage));
  const p = Math.min(Math.max(0, page), pages - 1);
  const geo = computePageGeometry(o, t, score);
  let systemInPage = 0;
  for (let i = 0; i < geo.systems.length; i++) {
    if (ptY >= geo.systems[i].slotTopY) systemInPage = i;
  }
  const s = Math.min(p * o.systemsPerPage + systemInPage, totalSystems - 1);
  const sys = geo.systems[Math.min(systemInPage, geo.systems.length - 1)];
  const slot = Math.min(
    Math.max(0, Math.floor((ptX - sys.staffLeft) / sys.measureWidth)),
    o.measuresPerSystem - 1
  );
  const m = Math.min(s * o.measuresPerSystem + slot, totalMeasures - 1);
  return Math.min(m * t.ticksPerMeasure, totalTicks - 1);
}

/** Verdict of the v1 engravability gate for an imported score. */
export type MidiReadiness = { ok: true } | { ok: false; reasons: string[] };

/**
 * Whether an imported score engraves cleanly on the token grid.
 *
 * The layout places notes by absolute tick on `ticksPerBeat`-tick beats and
 * draws barlines every `ticksPerMeasure` ticks, so a score only reads
 * correctly when its own grid lands on both. Oversized scores are refused so
 * one upload cannot freeze the page.
 */
export function checkMidiReadiness(
  score: QuantizedGridScore,
  tokens = DEFAULT_JANKO_TOKENS
): MidiReadiness {
  const t = resolveJankoTokens(tokens);
  const reasons: string[] = [];
  if (score.notes.length === 0) reasons.push('no notes found in the file');
  if (score.notes.length > PLAYBACK_MAX_NOTES) {
    reasons.push(
      `too large for v1 (${score.notes.length} notes; the cap is ${PLAYBACK_MAX_NOTES})`
    );
  }
  if (score.ticksPerBeat !== t.ticksPerBeat) {
    reasons.push(
      `timing grid of ${score.ticksPerBeat} ticks/beat — v1 needs ${t.ticksPerBeat} (re-export at a standard PPQ such as 480)`
    );
  }
  const meters = new Set(
    (score.timeSignatures ?? []).map((s) => `${s.numerator}/${s.denominator}`)
  );
  if (meters.size > 1) {
    reasons.push('meter changes mid-piece are not engraved in v1');
  }
  const ts = score.timeSignatures?.[0];
  if (!ts) {
    reasons.push('no time signature found');
  } else {
    const measureLen = Math.round(
      ts.numerator * ((score.ticksPerBeat * 4) / ts.denominator)
    );
    if (measureLen !== t.ticksPerMeasure) {
      reasons.push(
        `meter ${ts.numerator}/${ts.denominator} (${measureLen}-tick measures) — v1 engraves the ${t.ticksPerMeasure}-tick grid (3/4)`
      );
    }
  }
  const totalMeasures = Math.ceil((score.totalTicks || 0) / t.ticksPerMeasure);
  if (totalMeasures > PLAYBACK_MAX_MEASURES) {
    reasons.push(
      `too long for v1 (${totalMeasures} measures; the cap is ${PLAYBACK_MAX_MEASURES})`
    );
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}
