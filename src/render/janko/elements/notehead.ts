/**
 * Notehead elements: circular white knockout, URW Gothic duodecimal digit and
 * the Position of Honor concentric halo ring.
 *
 * The white knockout guarantees that ledger equators, row guides and beams
 * never cross the digit; the halo is reserved for the opening sound of the
 * piece (tick 0 of Measure 1), where it is emitted at R = 5.4pt.
 */

import { Hand } from '../../../model/types';
import { getDuodecimalDigit } from '../../types';
import { JankoPitchCoordinate } from '../geometry';
import { JankoTokens, resolveJankoTokens } from '../types';
import { f } from './style';

/** Input accepted by {@link renderNotehead}. */
export interface JankoNoteheadSpec {
  /** Notehead centre x in page pt. */
  x: number;
  /** Notehead centre y in page pt. */
  y: number;
  /** Pitch class 0..11 (already normalized by the geometry layer). */
  pitchClass: number;
  /** Hand, used only for the digit weight (RH heavier than LH). */
  hand?: Hand;
  /** True for the opening sound of the piece (tick 0 of Measure 1). */
  isPositionOfHonor?: boolean;
  /** Optional per-note digit override (defaults to the duodecimal digit). */
  digit?: string;
}

/** Position of Honor concentric halo ring (R = tokens.haloRadius = 5.4pt). */
export function renderHalo(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  options: { stroke?: string; strokeWidth?: number; radius?: number } = {}
): string {
  const t = resolveJankoTokens(tokens);
  const r = options.radius ?? t.haloRadius;
  const stroke = options.stroke ?? '#111111';
  const strokeWidth = options.strokeWidth ?? 0.75;
  return `    <circle class="janko-halo" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"/>`;
}

/** Circular white knockout (erases staff lines and beams beneath the digit). */
export function renderNoteheadKnockout(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  radius?: number
): string {
  const t = resolveJankoTokens(tokens);
  const r = radius ?? t.noteheadRadius;
  return `    <circle class="janko-knockout" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#FFFFFF"/>`;
}

/** Duodecimal digit notehead glyph in URW Gothic / Avant Garde. */
export function renderNoteheadDigit(
  x: number,
  y: number,
  pitchClass: number,
  hand: Hand = 'RH',
  tokens?: Partial<JankoTokens> | null,
  digitOverride?: string
): string {
  const t = resolveJankoTokens(tokens);
  const digit = digitOverride ?? getDuodecimalDigit(pitchClass);
  // Whole-tone rank 0 (evens) gets the heavier cut for instant row legibility.
  const weight = pitchClass % 2 === 0 ? '800' : '700';
  void hand;
  void t;
  return `    <text class="janko-digit" x="${f(x)}" y="${f(y + 0.35)}" font-weight="${weight}" font-size="6.5pt" fill="#111111">${digit}</text>`;
}

/**
 * Complete notehead: optional halo, white knockout, duodecimal digit.
 * Staff lines must be rendered before noteheads so the knockout masks them.
 */
export function renderNotehead(
  spec: JankoNoteheadSpec,
  tokens?: Partial<JankoTokens> | null
): string {
  const parts: string[] = [];
  if (spec.isPositionOfHonor) {
    parts.push(renderHalo(spec.x, spec.y, tokens));
  }
  parts.push(renderNoteheadKnockout(spec.x, spec.y, tokens));
  parts.push(
    renderNoteheadDigit(spec.x, spec.y, spec.pitchClass, spec.hand ?? 'RH', tokens, spec.digit)
  );
  return parts.join('\n');
}

/** Convenience: derive the halo predicate from an absolute score tick. */
export function isPositionOfHonor(startTick: number): boolean {
  return startTick === 0;
}

/** Convenience: notehead spec from a resolved pitch coordinate. */
export function noteheadFromCoordinate(
  coord: JankoPitchCoordinate,
  x: number,
  middleCY: number,
  isHonor: boolean = false
): JankoNoteheadSpec {
  return {
    x,
    y: middleCY + coord.y,
    pitchClass: coord.pitchClass,
    hand: coord.hand,
    isPositionOfHonor: isHonor,
  };
}
