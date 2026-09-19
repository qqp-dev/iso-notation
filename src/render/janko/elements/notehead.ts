/**
 * Notehead elements: rectangular white knockout, URW Gothic duodecimal digit and
 * the Position of Honor concentric halo ring.
 *
 * The white knockout guarantees that ledger equators, row guides and beams
 * never cross the digit; the halo is reserved for the opening sound of the
 * piece (tick 0 of Measure 1), where it is emitted at R = 6.2pt around the
 * canonical mask.
 *
 * Rectangular knockout (Round 17)
 * --------------------------------
 * The mask is a **sharp rectangle**: the digit ink box grown by the preset's
 * uniform margin on all four sides (`wx = 1.93 + m`, `hy = 2.86 + m` — no
 * rounding fudge). The Round 16 ellipse and its corner budget are deleted: to
 * protect the digit's corners where the curve pulled away, every gap paid a
 * ~0.2–0.4pt corner tax; the rect protects exactly and erases nothing extra
 * (rows sit 15pt apart, so nothing but the head's own row line ever crosses
 * the hole). The digit stays 5.8pt and the halo stays a circular ring in every
 * preset.
 *
 * Digit optics
 * ------------
 * The duodecimal digit is *optically centred* inside its mask: its ink box is
 * measured from the URW Gothic face (cap height 739/1000 em, widest glyph half
 * width ≈ 0.25 em) and its alphabetic baseline is dropped exactly half a cap
 * height below the notehead centre. Nothing here is guesswork — the linter
 * audits the very same numbers ({@link digitHalfExtents}).
 */

import { Hand } from '../../../model/types';
import { getDuodecimalDigit } from '../../types';
import { JankoPitchCoordinate } from '../geometry';
import {
  DEFAULT_JANKO_TOKENS,
  JankoLayoutOptions,
  JankoTokens,
  getClusterSpacingPreset,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../types';
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
  /**
   * True when a foreign stem crosses this note: the knockout grows taller
   * (`hy + stemAttachmentAir`, exactly the stem-start line) so the stem
   * resumes with the same breathing room as an own-stem attachment.
   */
  tallKnockout?: boolean;
  /**
   * Round 41: absolute pitch symbol scale of this head (`1` = canonical). A
   * same-hand chord member under `chordSymbolScale` renders smaller; its mask,
   * its digit size and every clearance audit derive from this one number, so
   * paint, layout and lint can never disagree.
   */
  symbolScale?: number;
  /**
   * Round 41: true when this head belongs to a same-hand co-onset chord group,
   * so the chord-margin/air tokens (not the standalone preset) size its mask.
   */
  chordMember?: boolean;
}

/** Stroke width of the Position of Honor halo ring (pt). */
export const JANKO_HALO_STROKE_WIDTH = 0.75;

/** Position of Honor concentric halo ring (R = tokens.haloRadius = 6.2pt). */
export function renderHalo(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  options: { stroke?: string; strokeWidth?: number; radius?: number } = {}
): string {
  const t = resolveJankoTokens(tokens);
  const r = options.radius ?? t.haloRadius;
  const stroke = options.stroke ?? '#111111';
  const strokeWidth = options.strokeWidth ?? JANKO_HALO_STROKE_WIDTH;
  return `    <circle class="janko-halo" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(2)}"/>`;
}

/**
 * CSS absolute-length resolution inside the engraving viewBox.
 *
 * A font size declared in `pt` is converted to CSS px at 4/3 px per pt, and
 * one CSS px is one SVG user unit — so an `fs`-pt face renders with an em box
 * of `fs * 4/3` page pt. Every digit metric below is expressed against that
 * *rendered* em box.
 */
export const JANKO_USER_UNITS_PER_PT = 4 / 3;

/** Cap height of the URW Gothic duodecimal digit face (739/1000 em). */
export const JANKO_DIGIT_CAP_HEIGHT_EM = 0.739;

/** Half width of the widest duodecimal glyph (`0`, `8`) in em units. */
export const JANKO_DIGIT_HALF_WIDTH_EM = 0.25;

/** Rendered em box (page pt) of a digit declared at `fontSize` pt. */
export function digitEmBox(fontSize: number): number {
  return fontSize * JANKO_USER_UNITS_PER_PT;
}

/**
 * Half extents (page pt) of the digit's ink box.
 *
 * Digits are cap-height figures: `2 * halfHeight` tall (the round glyphs `0`
 * and `8` overshoot the cap line by ≈0.02 em, absorbed by the clearance
 * margin) and at most `2 * halfWidth` wide, centred on the glyph's optical
 * middle.
 */
export function digitHalfExtents(fontSize: number): {
  halfWidth: number;
  halfHeight: number;
} {
  const em = digitEmBox(fontSize);
  return {
    halfWidth: JANKO_DIGIT_HALF_WIDTH_EM * em,
    halfHeight: (JANKO_DIGIT_CAP_HEIGHT_EM / 2) * em,
  };
}

/**
 * Optical baseline offset (page pt) of a digit declared at `fontSize` pt: the
 * alphabetic baseline is dropped exactly half a cap height below the notehead
 * centre, so the ink box is vertically centred on the mask instead of hanging
 * against its upper edge.
 */
export function digitBaselineOffset(fontSize: number): number {
  return digitHalfExtents(fontSize).halfHeight;
}

/** Canonical baseline offset of the 5.8pt digit (≈ 2.86pt). */
export const JANKO_DIGIT_BASELINE_OFFSET = digitBaselineOffset(
  DEFAULT_JANKO_TOKENS.digitFontSize
);

/**
 * Rectangular white knockout (erases staff lines and beams beneath the digit).
 *
 * `wx`/`hy` are the mask half-extents of the active cluster-spacing preset
 * (2.73 × 3.66 on the golden `'snug'`), painted with sharp corners. The
 * explicit override is for callers that resolve the preset themselves;
 * otherwise the layout options select it (defaulting to the golden preset).
 */
/**
 * Round 41: knockout metrics of **one head** at an explicit symbol scale.
 *
 * `scale === 1` and `chordMember === false` returns {@link getKnockoutMetrics}
 * untouched (bit-for-bit canonical for every existing surface). A chord member
 * resolves against the Round 41 chord tokens (`chordKnockoutMargin` /
 * `chordKnockoutAir`) and a scaled digit, both measured from the actual glyph
 * half-extents — the same numbers {@link renderNotehead} paints and the linter
 * audits.
 */
export function getScaledKnockoutMetrics(
  layoutOptions: Partial<JankoLayoutOptions> | null | undefined,
  tokens: Partial<JankoTokens> | null | undefined,
  symbolScale = 1,
  chordMember = false
): KnockoutMetrics {
  if (symbolScale === 1 && !chordMember) return getKnockoutMetrics(layoutOptions, tokens);
  const o = resolveJankoOptions(layoutOptions);
  const t = resolveJankoTokens(tokens);
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const margin = chordMember
    ? t.chordKnockoutMargin ?? t.knockoutMargin ?? preset.margin
    : t.knockoutMargin ?? preset.margin;
  const air = chordMember
    ? t.chordKnockoutAir ?? t.knockoutAir ?? preset.air
    : t.knockoutAir ?? preset.air;
  const { halfWidth, halfHeight } = digitHalfExtents(t.digitFontSize * symbolScale);
  return { margin, air, wx: halfWidth + margin, hy: halfHeight + margin, pairGap: preset.pairGap };
}

/** Resolved metrics for a knockout mask and spacing. */
export interface KnockoutMetrics {
  margin: number;
  air: number;
  wx: number;
  hy: number;
  pairGap: number;
}

/**
 * Knockout mask extents and breathing air resolved for the active options/tokens.
 *
 * For canonical 5.8pt tokens, returns the preset wx/hy/margin/air exactly (bit-for-bit).
 * For scaled candidates (e.g. Round 40 68% and 80%), derives wx and hy from actual
 * digit glyph half-extents plus margin.
 */
export function getKnockoutMetrics(
  layoutOptions?: Partial<JankoLayoutOptions> | null,
  tokens?: Partial<JankoTokens> | null
): KnockoutMetrics {
  const o = resolveJankoOptions(layoutOptions);
  const t = resolveJankoTokens(tokens);
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const isCustom = t.knockoutMargin !== undefined || t.knockoutAir !== undefined;
  if (isCustom) {
    const margin = t.knockoutMargin ?? preset.margin;
    const air = t.knockoutAir ?? preset.air;
    const { halfWidth, halfHeight } = digitHalfExtents(t.digitFontSize);
    return {
      margin,
      air,
      wx: halfWidth + margin,
      hy: halfHeight + margin,
      pairGap: preset.pairGap,
    };
  }
  return {
    margin: preset.margin,
    air: preset.air,
    wx: preset.wx,
    hy: preset.hy,
    pairGap: preset.pairGap,
  };
}

/**
 * Rectangular white knockout (erases staff lines and beams beneath the digit).
 *
 * `wx`/`hy` are the mask half-extents of the active cluster-spacing preset
 * (2.73 × 3.66 on the golden `'snug'`), painted with sharp corners. The
 * explicit override is for callers that resolve the preset themselves;
 * otherwise the layout options select it (defaulting to the golden preset).
 */
export function renderNoteheadKnockout(
  x: number,
  y: number,
  tokens?: Partial<JankoTokens> | null,
  layoutOptions?: Partial<JankoLayoutOptions> | null,
  maskOverride?: { wx: number; hy: number }
): string {
  const metrics = getKnockoutMetrics(layoutOptions, tokens);
  const wx = maskOverride?.wx ?? metrics.wx;
  const hy = maskOverride?.hy ?? metrics.hy;
  return `    <rect class="janko-knockout" x="${f(x - wx)}" y="${f(y - hy)}" width="${f(2 * wx)}" height="${f(2 * hy)}" fill="#FFFFFF"/>`;
}

/** Duodecimal digit notehead glyph in URW Gothic / Avant Garde. */
export function renderNoteheadDigit(
  x: number,
  y: number,
  pitchClass: number,
  hand: Hand = 'RH',
  tokens?: Partial<JankoTokens> | null,
  digitOverride?: string,
  fontSizeOverride?: number
): string {
  const t = resolveJankoTokens(tokens);
  const fontSize = fontSizeOverride ?? t.digitFontSize;
  const digit = digitOverride ?? getDuodecimalDigit(pitchClass);
  // One weight for every digit: the old even/odd 800/700 split was
  // indistinguishable (single-face fonts render both the same) and read as
  // inconsistent printing under zoom rather than as row information.
  const weight = '700';
  void hand;
  // The digit is positioned by its alphabetic baseline (not by
  // `dominant-baseline`), so the optical centring is renderer-independent.
  const baseline = y + digitBaselineOffset(fontSize);
  const sizeStr =
    fontSize % 1 === 0 ? fontSize.toFixed(1) : Number(fontSize.toFixed(3));
  return `    <text class="janko-digit" x="${f(x)}" y="${f(baseline)}" font-weight="${weight}" font-size="${sizeStr}pt" fill="#111111">${digit}</text>`;
}

/**
 * Complete notehead: optional halo, white knockout, duodecimal digit.
 * Staff lines must be rendered before noteheads so the knockout masks them.
 */
export function renderNotehead(
  spec: JankoNoteheadSpec,
  tokens?: Partial<JankoTokens> | null,
  layoutOptions?: Partial<JankoLayoutOptions> | null
): string {
  const parts: string[] = [];
  if (spec.isPositionOfHonor) {
    parts.push(renderHalo(spec.x, spec.y, tokens));
  }
  const t = resolveJankoTokens(tokens);
  const scale = spec.symbolScale ?? 1;
  const chordMember = spec.chordMember === true;
  const metrics = getScaledKnockoutMetrics(layoutOptions, tokens, scale, chordMember);
  // Round 41: the painted mask is the **same** box the layout and the linter
  // audit — a scaled chord member paints its scaled mask (and a tall knockout
  // still grows to the stem-start line). Canonical heads (`scale === 1`,
  // standalone, no tall knockout) keep the untouched preset paint path.
  const scaled = scale !== 1 || chordMember;
  const maskOverride =
    spec.tallKnockout || scaled
      ? { wx: metrics.wx, hy: metrics.hy + (spec.tallKnockout ? t.stemAttachmentAir : 0) }
      : undefined;
  parts.push(renderNoteheadKnockout(spec.x, spec.y, tokens, layoutOptions, maskOverride));
  parts.push(
    renderNoteheadDigit(
      spec.x,
      spec.y,
      spec.pitchClass,
      spec.hand ?? 'RH',
      tokens,
      spec.digit,
      t.digitFontSize * scale
    )
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
