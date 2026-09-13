/**
 * Rest symbols — the Round 12 question (how a hand's **silent span inside an
 * active measure** is written), carried into Round 13 by the four high-fidelity
 * finalists and the voice-contour anchor, and re-seated by Round 16 on the
 * **rule-hang**: the rest hangs from the nearest staff rule to its voice and
 * extends toward the Middle C corridor (see the engine's `computeJankoRests`).
 *
 * Round 16 also scales the ink to 57.5% linear of Round 15 — smaller ink on
 * standard-like proportions (not head-sized), with every dialect's shape
 * language preserved exactly (every constant below is its Round 15 value times
 * {@link REST_LINEAR_SCALE}).
 *
 * | style                | 16th                    | 8th                   | quarter                  | half / whole               |
 * | -------------------- | ----------------------- | --------------------- | ------------------------ | -------------------------- |
 * | `'kinetic-monoline'` | stem + two 12.4° tabs   | stem + one 12.4° tab  | central horizontal notch | hollow bar (W 4.0 × H 1.3pt) |
 * | `'classical-urtext'` | two calligraphic hooks  | one calligraphic hook | serpentine lightning     | solid block (W 3.5 × H 1.4pt)|
 * | `'geometric-node'`   | hollow diamond + 2 rays | hollow diamond + 1 ray| solid diamond (2.9 × 2.9pt)| open capsule / lozenge     |
 * | `'bauhaus-slash'`    | 45° slash + two wings   | 45° slash + one wing  | minimalist reversed-Z    | thin hairline box          |
 * | `'phantom-notehead'` | dashed head + stem + two downward hooks | dashed head + stem + one hook | dashed head + bare stem | dashed head + hollow bar |
 *
 * The engine's `computeJankoRests` decides *where* a rest belongs (a clean
 * standard-value silence of one hand in a measure that hand is active in),
 * hangs it from its rule and nudges it along the rule inside its beat cell; a
 * rest with no clear slot is a named unwritten diagnostic, never a silent
 * overlap. This module only paints what it is handed.
 */

import { Hand } from '../../../model/types';
import { JankoRestStyle, JankoTokens, resolveJankoTokens } from '../types';
import { f } from './style';

/** The four duration classes every dialect states. */
export type JankoRestValue = 'sixteenth' | 'eighth' | 'quarter' | 'half';

/** Every rest value, longest last, in the canonical order. */
export const JANKO_REST_VALUES: readonly JankoRestValue[] = [
  'sixteenth',
  'eighth',
  'quarter',
  'half',
];

/**
 * Round 16 linear rest-ink scale: every rest constant is its Round 15 value
 * times this factor, so each dialect keeps its exact shape language at ~55–60%
 * linear size (smaller ink on standard-like proportions, not head-sized).
 */
export const REST_LINEAR_SCALE = 0.575;

/** Vertical rest-stem height (pt) of the kinetic monoline dialect. */
export const REST_STEM_HEIGHT = 12.0 * REST_LINEAR_SCALE;
/** Stroke (pt) of every monoline rest element. */
export const REST_STROKE = 0.9 * REST_LINEAR_SCALE;
/** Horizontal reach (pt) of a kinetic tab right of its stem. */
export const REST_TAB_WIDTH = 4.0 * REST_LINEAR_SCALE;
/** Half-width (pt) of the quarter rest's central notch. */
export const REST_NOTCH_HALF = 2.2 * REST_LINEAR_SCALE;
/** Hollow half/whole bar of the kinetic dialect: `W × H` in pt. */
export const REST_BAR_WIDTH = 7.0 * REST_LINEAR_SCALE;
export const REST_BAR_HEIGHT = 2.2 * REST_LINEAR_SCALE;
/** Solid half/whole block of the urtext dialect: `W × H` in pt. */
export const REST_BLOCK_WIDTH = 6.0 * REST_LINEAR_SCALE;
export const REST_BLOCK_HEIGHT = 2.5 * REST_LINEAR_SCALE;
/** Half-diagonal (pt) of the geometric node diamonds. */
export const REST_NODE_HOLLOW_HALF = 2.0 * REST_LINEAR_SCALE;
export const REST_NODE_SOLID_HALF = 2.5 * REST_LINEAR_SCALE;
/** Horizontal reach (pt) of a geometric node's lateral tick ray. */
export const REST_RAY_REACH = 4.2 * REST_LINEAR_SCALE;
/** Air (pt) between a hollow node and its lateral tick ray. */
export const REST_RAY_GAP = 0.4 * REST_LINEAR_SCALE;
/** Half-extent (pt) of the bauhaus slash and its parallel wings. */
export const REST_SLASH_HALF = 3.5 * REST_LINEAR_SCALE;
export const REST_WING_OFFSET = 2.2 * REST_LINEAR_SCALE;
/** Half-height (pt) of the bauhaus quarter reversed-Z. */
export const REST_Z_HALF = 3.4 * REST_LINEAR_SCALE;
/** Half-height (pt) of the bauhaus half hairline box. */
export const REST_BOX_HALF = 1.5 * REST_LINEAR_SCALE;
/** Stroke (pt) of the bauhaus half hairline box. */
export const REST_BOX_STROKE = 0.6 * REST_LINEAR_SCALE;
/**
 * Round 13 phantom-notehead dialect: radius (pt) of the dashed open head that
 * stands where the unvoiced notehead would have been.
 */
export const REST_PHANTOM_HEAD_RADIUS = 3.0 * REST_LINEAR_SCALE;
/** Stroke (pt) of the phantom head's dashed outline and of its bare stem. */
export const REST_PHANTOM_HEAD_STROKE = 0.8 * REST_LINEAR_SCALE;
/** Dash pattern (pt) of the phantom head — an open, unwritten notehead. */
export const REST_PHANTOM_DASH = `${(1.8 * REST_LINEAR_SCALE).toFixed(2)},${(1.5 * REST_LINEAR_SCALE).toFixed(2)}`;
/** Horizontal reach (pt) of a phantom flag hook, right of its stem. */
export const REST_PHANTOM_FLAG_REACH = 4.2 * REST_LINEAR_SCALE;
/** Drop (pt) of a phantom flag hook below the stem point it leaves. */
export const REST_PHANTOM_FLAG_DROP = 2.4 * REST_LINEAR_SCALE;
/** Hollow half/whole bar of the phantom dialect: `W × H` in pt. */
export const REST_PHANTOM_BAR_WIDTH = 7.0 * REST_LINEAR_SCALE;
export const REST_PHANTOM_BAR_HEIGHT = 2.4 * REST_LINEAR_SCALE;
/**
 * Round 13 classical urtext: the calligraphic hook geometry. The stem is a
 * slightly slanted rule; every hook leaves it at the top and sweeps left into a
 * solid teardrop bulb.
 */
export const REST_URTEXT_STEM_SLANT = 1.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_STEM_FOOT = 0.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_HOOK_REACH = 4.4 * REST_LINEAR_SCALE;
export const REST_URTEXT_HOOK_DROP = 2.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_BULB_RADIUS = 0.7 * REST_LINEAR_SCALE;
/** Half-extents (pt) of the urtext quarter serpentine around the rest centre. */
export const REST_URTEXT_LIGHTNING_HALF_WIDTH = 2.6 * REST_LINEAR_SCALE;
export const REST_URTEXT_LIGHTNING_TOP = 5.4 * REST_LINEAR_SCALE;
export const REST_URTEXT_LIGHTNING_BOTTOM = 5.8 * REST_LINEAR_SCALE;

/** One resolved rest: where it stands, how long it is silent and in which dialect. */
export interface JankoRestGeometry {
  /** Absolute onset tick of the silence. */
  tick: number;
  /** Length of the silence (ticks). */
  durationTicks: number;
  /** Hand whose voice is silent. */
  hand: Hand;
  /** Beat column of the rest (page pt), possibly nudged along its rule. */
  x: number;
  /** Glyph centre (page pt): hung from the nearest staff rule toward Middle C. */
  y: number;
  /** Duration class painted. */
  value: JankoRestValue;
  /** Active dialect. */
  style: JankoRestStyle;
}

/**
 * Duration class of a silence.
 *
 * The thresholds mirror the clasp duration grammar
 * (`rhythm.claspDurationClass`), so a rest and a clasped cluster of the same
 * value can never disagree: ≥ 96 ticks is the calm half/whole mark, a quarter
 * is anything over 38, an 8th over 14, and everything shorter is a 16th.
 */
export function restValueForTicks(durationTicks: number): JankoRestValue {
  if (durationTicks >= 96) return 'half';
  if (durationTicks > 38) return 'quarter';
  if (durationTicks > 14) return 'eighth';
  return 'sixteenth';
}

/**
 * Plain note values (ticks) a rest may state exactly: 16th … whole. A silence
 * that is not one of them (a 2.5-beat gap, a 27-tick tie artefact) is left
 * unwritten rather than approximated, so a painted rest never lies about the
 * duration it covers.
 */
const REST_STANDARD_VALUES: readonly number[] = [12, 24, 48, 96, 192];

/** Is this silence exactly one standard rest value? */
export function isStandardRestValue(durationTicks: number): boolean {
  return REST_STANDARD_VALUES.includes(durationTicks);
}

/** Grid-step rake of the kinetic tabs: the score's own beam-harmonized 12.4°. */
function rake(tokens: ResolvedJankoTokens): number {
  return tokens.maxBeamSlope;
}

type ResolvedJankoTokens = ReturnType<typeof resolveJankoTokens>;

/** The kinetic monoline ink: stem, 12.4° tabs / notch, hollow bar. */
function renderKineticMonoline(rest: JankoRestGeometry, t: ResolvedJankoTokens): string[] {
  const { x, y, value } = rest;
  const out: string[] = [];
  const half = REST_STEM_HEIGHT / 2;
  const stroke = REST_STROKE.toFixed(2);

  if (value === 'half') {
    out.push(
      `    <rect class="janko-rest-bar" x="${f(x - REST_BAR_WIDTH / 2)}" y="${f(y - REST_BAR_HEIGHT / 2)}" width="${f(REST_BAR_WIDTH)}" height="${f(REST_BAR_HEIGHT)}" fill="none" stroke="#111111" stroke-width="${stroke}"/>`
    );
    return out;
  }

  out.push(
    `    <line class="janko-rest-stem" x1="${f(x)}" y1="${f(y - half)}" x2="${f(x)}" y2="${f(y + half)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
  );

  if (value === 'quarter') {
    out.push(
      `    <line class="janko-rest-notch" x1="${f(x - REST_NOTCH_HALF)}" y1="${f(y)}" x2="${f(x + REST_NOTCH_HALF)}" y2="${f(y)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
    );
    return out;
  }

  const marks = value === 'sixteenth' ? 2 : 1;
  // Round 13: the tab hooks **downward** to the right of its stem (`sign = 1`),
  // exactly like a note flag leaving the stem tip — the Round 12 up-rake read as
  // an ascending accent instead of a duration mark.
  const sign = 1;
  for (let i = 1; i <= marks; i++) {
    const cy = y - half + (i - 1) * t.flagSpacing;
    out.push(
      `    <line class="janko-rest-tab" data-rest-tab="${i}" x1="${f(x)}" y1="${f(cy)}" x2="${f(x + REST_TAB_WIDTH)}" y2="${f(cy + sign * REST_TAB_WIDTH * rake(t))}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
    );
  }
  return out;
}

/**
 * Round 13 authentic Urtext stem: a slightly slanted calligraphic rule whose
 * foot leans left, the way every engraved 8th/16th rest is cut (SMuFL
 * `restEighth` / `restSixteenth`).
 */
function urtextStem(x: number, y: number, stroke: string): string {
  const top = y - REST_STEM_HEIGHT / 2;
  const bot = y + REST_STEM_HEIGHT / 2 - REST_URTEXT_STEM_FOOT;
  const d =
    `M ${f(x + REST_URTEXT_STEM_SLANT * 0.5)} ${f(top)} ` +
    `L ${f(x - REST_URTEXT_STEM_SLANT * 0.5)} ${f(bot)}`;
  return `    <path class="janko-rest-stem-line" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`;
}

/**
 * One calligraphic Urtext hook: it leaves the stem's top, sweeps left and
 * curves down into a solid teardrop bulb — the authentic hooked-rest gesture
 * (`𝄿` carries two, `𝄾` one).
 */
function urtextHook(x: number, y: number, stroke: string): string {
  const reach = REST_URTEXT_HOOK_REACH;
  const drop = REST_URTEXT_HOOK_DROP;
  const d =
    `M ${f(x + REST_URTEXT_STEM_SLANT * 0.5)} ${f(y)} ` +
    `C ${f(x - reach * 0.35)} ${f(y - 0.7)} ${f(x - reach * 0.85)} ${f(y + drop * 0.35)} ${f(x - reach * 0.6)} ${f(y + drop)}`;
  const bulb = `    <circle class="janko-rest-hook-bulb" cx="${f(x - reach * 0.6)}" cy="${f(y + drop)}" r="${f(REST_URTEXT_BULB_RADIUS)}" fill="#111111" stroke="none"/>`;
  return [
    `    <path class="janko-rest-hook" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`,
    bulb,
  ].join('\n');
}

/** The classical urtext ink: calligraphic hooks, serpentine, solid block. */
function renderClassicalUrtext(rest: JankoRestGeometry, t: ResolvedJankoTokens): string[] {
  const { x, y, value } = rest;
  const out: string[] = [];
  const stroke = REST_STROKE.toFixed(2);

  if (value === 'half') {
    // The authentic half rest **sits on** its line (here: the voice contour),
    // so the block rests on the register it silences instead of straddling it.
    out.push(
      `    <rect class="janko-rest-block" x="${f(x - REST_BLOCK_WIDTH / 2)}" y="${f(y - REST_BLOCK_HEIGHT)}" width="${f(REST_BLOCK_WIDTH)}" height="${f(REST_BLOCK_HEIGHT)}" fill="#111111" stroke="none"/>`
    );
    return out;
  }

  if (value === 'quarter') {
    // The serpentine `𝄽`: an upper arm sweeping down-right, a return stroke, a
    // second arm and the long calligraphic tail curling down-left — the Round 13
    // gesture at the Round 16 linear scale.
    const s = REST_LINEAR_SCALE;
    const d =
      `M ${f(x - 2.1 * s)} ${f(y - 4.8 * s)} ` +
      `C ${f(x - 0.6 * s)} ${f(y - 4.4 * s)} ${f(x + 1.2 * s)} ${f(y - 3.6 * s)} ${f(x + 2.1 * s)} ${f(y - 2.6 * s)} ` +
      `C ${f(x + 0.6 * s)} ${f(y - 1.9 * s)} ${f(x - 1.5 * s)} ${f(y - 1.2 * s)} ${f(x - 2.1 * s)} ${f(y - 0.4 * s)} ` +
      `C ${f(x - 0.5 * s)} ${f(y + 0.3 * s)} ${f(x + 1.1 * s)} ${f(y + 1.1 * s)} ${f(x + 1.9 * s)} ${f(y + 2.1 * s)} ` +
      `C ${f(x + 0.4 * s)} ${f(y + 3.3 * s)} ${f(x - 1.4 * s)} ${f(y + 4.4 * s)} ${f(x - 2.5 * s)} ${f(y + 5.2 * s)}`;
    out.push(
      `    <path class="janko-rest-lightning" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
    return out;
  }

  out.push(urtextStem(x, y, stroke));
  const hooks = value === 'sixteenth' ? 2 : 1;
  for (let i = 1; i <= hooks; i++) {
    out.push(urtextHook(x, y - REST_STEM_HEIGHT / 2 + (i - 1) * t.flagSpacing, stroke));
  }
  return out;
}

/** The phantom notehead's dashed open head — the unvoiced notehead itself. */
function phantomHead(x: number, y: number): string {
  return `    <circle class="janko-rest-phantom-head" cx="${f(x)}" cy="${f(y)}" r="${f(REST_PHANTOM_HEAD_RADIUS)}" fill="none" stroke="#111111" stroke-width="${REST_PHANTOM_HEAD_STROKE.toFixed(2)}" stroke-dasharray="${REST_PHANTOM_DASH}"/>`;
}

/**
 * Round 13 phantom notehead: the duration grammar of a real note — an open
 * (dashed) head standing exactly where the unvoiced notehead would have been,
 * a monoline stem and one downward-hooked flag per subdivision. The quarter is
 * the bare stem, the 8th one hook and the 16th two hooks; the half/whole keeps
 * the calm hollow bar. It is the only dialect that shows *which* note is
 * missing rather than only that time passes.
 */
function renderPhantomNotehead(rest: JankoRestGeometry, t: ResolvedJankoTokens): string[] {
  const { x, y, value } = rest;
  const out: string[] = [phantomHead(x, y)];
  const stroke = REST_PHANTOM_HEAD_STROKE.toFixed(2);
  const half = REST_STEM_HEIGHT / 2;

  if (value === 'half') {
    out.push(
      `    <rect class="janko-rest-phantom-bar" x="${f(x - REST_PHANTOM_BAR_WIDTH / 2)}" y="${f(y - REST_PHANTOM_BAR_HEIGHT / 2)}" width="${f(REST_PHANTOM_BAR_WIDTH)}" height="${f(REST_PHANTOM_BAR_HEIGHT)}" fill="none" stroke="#111111" stroke-width="${REST_PHANTOM_HEAD_STROKE.toFixed(2)}" stroke-dasharray="${REST_PHANTOM_DASH}"/>`
    );
    return out;
  }

  out.push(
    `    <line class="janko-rest-phantom-stem" x1="${f(x)}" y1="${f(y - half)}" x2="${f(x)}" y2="${f(y + half)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
  );
  if (value === 'quarter') return out;

  const flags = value === 'sixteenth' ? 2 : 1;
  for (let i = 1; i <= flags; i++) {
    const cy = y - half + (i - 1) * t.flagSpacing;
    const d =
      `M ${f(x)} ${f(cy)} ` +
      `Q ${f(x + REST_PHANTOM_FLAG_REACH * 0.8)} ${f(cy + REST_PHANTOM_FLAG_DROP * 0.15)} ${f(x + REST_PHANTOM_FLAG_REACH)} ${f(cy + REST_PHANTOM_FLAG_DROP)}`;
    out.push(
      `    <path class="janko-rest-phantom-flag" data-rest-flag="${i}" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round"/>`
    );
  }
  return out;
}

/** One open diamond (hollow node). */
function hollowDiamond(x: number, y: number, stroke: string): string {
  const h = REST_NODE_HOLLOW_HALF;
  return `    <path class="janko-rest-node" d="M ${f(x)} ${f(y - h)} L ${f(x + h)} ${f(y)} L ${f(x)} ${f(y + h)} L ${f(x - h)} ${f(y)} Z" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linejoin="miter"/>`;
}

/** One lateral tick ray of a pause node. */
function nodeRay(x: number, y: number, side: -1 | 1, stroke: string): string {
  return `    <line class="janko-rest-ray" x1="${f(x + side * (REST_NODE_HOLLOW_HALF + REST_RAY_GAP))}" y1="${f(y)}" x2="${f(x + side * REST_RAY_REACH)}" y2="${f(y)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`;
}

/** The geometric node ink: hollow/solid diamonds, rays, open capsule. */
function renderGeometricNode(rest: JankoRestGeometry): string[] {
  const { x, y, value } = rest;
  const out: string[] = [];
  const stroke = REST_STROKE.toFixed(2);

  if (value === 'half') {
    out.push(
      `    <rect class="janko-rest-capsule" x="${f(x - REST_BAR_WIDTH / 2)}" y="${f(y - REST_BAR_HEIGHT)}" width="${f(REST_BAR_WIDTH)}" height="${f(REST_BAR_HEIGHT * 2)}" rx="${f(REST_BAR_HEIGHT)}" ry="${f(REST_BAR_HEIGHT)}" fill="none" stroke="#111111" stroke-width="${stroke}"/>`
    );
    return out;
  }

  if (value === 'quarter') {
    const h = REST_NODE_SOLID_HALF;
    out.push(
      `    <path class="janko-rest-node janko-rest-node-solid" d="M ${f(x)} ${f(y - h)} L ${f(x + h)} ${f(y)} L ${f(x)} ${f(y + h)} L ${f(x - h)} ${f(y)} Z" fill="#111111" stroke="none"/>`
    );
    return out;
  }

  out.push(hollowDiamond(x, y, stroke));
  const rays = value === 'sixteenth' ? 2 : 1;
  out.push(nodeRay(x, y, -1, stroke));
  if (rays === 2) out.push(nodeRay(x, y, 1, stroke));
  return out;
}

/** One 45° beveled bauhaus slash (or wing) rising left to right. */
function beveledSlash(
  x: number,
  y: number,
  half: number,
  cls: string,
  stroke: string
): string {
  return `    <line class="${cls}" x1="${f(x - half)}" y1="${f(y + half)}" x2="${f(x + half)}" y2="${f(y - half)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`;
}

/** The bauhaus ink: beveled slashes + parallel wings, reversed-Z, hairline box. */
function renderBauhausSlash(rest: JankoRestGeometry): string[] {
  const { x, y, value } = rest;
  const out: string[] = [];
  const stroke = REST_STROKE.toFixed(2);

  if (value === 'half') {
    out.push(
      `    <rect class="janko-rest-box" x="${f(x - REST_BAR_WIDTH / 2)}" y="${f(y - REST_BOX_HALF)}" width="${f(REST_BAR_WIDTH)}" height="${f(2 * REST_BOX_HALF)}" fill="none" stroke="#111111" stroke-width="${REST_BOX_STROKE.toFixed(2)}"/>`
    );
    return out;
  }

  if (value === 'quarter') {
    const h = REST_Z_HALF;
    const d =
      `M ${f(x + h * 0.82)} ${f(y + h)} L ${f(x - h * 0.82)} ${f(y + h)} ` +
      `L ${f(x + h * 0.82)} ${f(y - h)} L ${f(x - h * 0.82)} ${f(y - h)}`;
    out.push(
      `    <path class="janko-rest-z" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt" stroke-linejoin="miter"/>`
    );
    return out;
  }

  out.push(beveledSlash(x, y, REST_SLASH_HALF, 'janko-rest-slash', stroke));
  const wings = value === 'sixteenth' ? 2 : 1;
  out.push(
    beveledSlash(x - REST_WING_OFFSET, y, REST_SLASH_HALF * 0.6, 'janko-rest-wing', stroke)
  );
  if (wings === 2) {
    out.push(
      beveledSlash(x + REST_WING_OFFSET, y, REST_SLASH_HALF * 0.6, 'janko-rest-wing', stroke)
    );
  }
  return out;
}

/**
 * Paint one rest in the active dialect. The group carries the rest's musical
 * identity as data attributes (`data-rest-tick`, `-value`, `-hand`, `-style`),
 * so the studio, the tests and a future audition pass can address it without
 * parsing coordinates.
 */
export function renderRest(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): string {
  const t = resolveJankoTokens(tokens);
  let ink: string[];
  switch (rest.style) {
    case 'classical-urtext':
      ink = renderClassicalUrtext(rest, t);
      break;
    case 'geometric-node':
      ink = renderGeometricNode(rest);
      break;
    case 'bauhaus-slash':
      ink = renderBauhausSlash(rest);
      break;
    case 'phantom-notehead':
      ink = renderPhantomNotehead(rest, t);
      break;
    case 'kinetic-monoline':
    default:
      ink = renderKineticMonoline(rest, t);
      break;
  }
  return [
    `    <g class="janko-rest-group" data-rest-tick="${rest.tick}" data-rest-value="${rest.value}" data-rest-hand="${rest.hand}" data-rest-style="${rest.style}">`,
    ...ink,
    '    </g>',
  ].join('\n');
}

/**
 * Axis-aligned ink box of one rest, in the active dialect. The engine's fit
 * rule measures foreign notehead discs against this same box, so a painted rest
 * can never be a surprise collision — the box and the ink are defined together.
 */
export function restInkBox(
  rest: JankoRestGeometry,
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const t = resolveJankoTokens(tokens);
  const { x, y, value, style } = rest;
  const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

  if (style === 'kinetic-monoline') {
    if (value === 'half') {
      return box(
        x - REST_BAR_WIDTH / 2 - REST_STROKE / 2,
        y - REST_BAR_HEIGHT / 2 - REST_STROKE / 2,
        x + REST_BAR_WIDTH / 2 + REST_STROKE / 2,
        y + REST_BAR_HEIGHT / 2 + REST_STROKE / 2
      );
    }
    const half = REST_STEM_HEIGHT / 2;
    if (value === 'quarter') {
      return box(x - REST_NOTCH_HALF, y - half, x + REST_NOTCH_HALF, y + half);
    }
    // Round 13: the tabs hook downward, so the only ink above the stem top is
    // the stem itself; the tab rakes stay inside the stem's own 12pt band.
    const marks = value === 'sixteenth' ? 2 : 1;
    const topTab = y - half;
    const tabBottom =
      topTab + (marks - 1) * t.flagSpacing + REST_TAB_WIDTH * rake(t) + REST_STROKE / 2;
    return box(x - REST_STROKE / 2, y - half, x + REST_TAB_WIDTH, Math.max(y + half, tabBottom));
  }

  if (style === 'classical-urtext') {
    if (value === 'half') {
      // The authentic half rest sits **on** the contour.
      return box(
        x - REST_BLOCK_WIDTH / 2,
        y - REST_BLOCK_HEIGHT,
        x + REST_BLOCK_WIDTH / 2,
        y
      );
    }
    if (value === 'quarter') {
      return box(
        x - REST_URTEXT_LIGHTNING_HALF_WIDTH,
        y - REST_URTEXT_LIGHTNING_TOP,
        x + REST_URTEXT_LIGHTNING_HALF_WIDTH,
        y + REST_URTEXT_LIGHTNING_BOTTOM
      );
    }
    const hooks = value === 'sixteenth' ? 2 : 1;
    const top = y - REST_STEM_HEIGHT / 2;
    const bulbBottom =
      top + (hooks - 1) * t.flagSpacing + REST_URTEXT_HOOK_DROP + REST_URTEXT_BULB_RADIUS;
    return box(
      x - REST_URTEXT_HOOK_REACH * 0.85,
      top - REST_URTEXT_BULB_RADIUS,
      x + REST_URTEXT_STEM_SLANT * 0.5 + REST_STROKE / 2,
      Math.max(y + REST_STEM_HEIGHT / 2, bulbBottom)
    );
  }

  if (style === 'phantom-notehead') {
    if (value === 'half') {
      return box(
        x - REST_PHANTOM_BAR_WIDTH / 2 - REST_PHANTOM_HEAD_STROKE / 2,
        y - REST_PHANTOM_BAR_HEIGHT / 2 - REST_PHANTOM_HEAD_STROKE / 2,
        x + REST_PHANTOM_BAR_WIDTH / 2 + REST_PHANTOM_HEAD_STROKE / 2,
        y + REST_PHANTOM_BAR_HEIGHT / 2 + REST_PHANTOM_HEAD_STROKE / 2
      );
    }
    const half = REST_STEM_HEIGHT / 2;
    const head = REST_PHANTOM_HEAD_RADIUS + REST_PHANTOM_HEAD_STROKE / 2;
    if (value === 'quarter') return box(x - head, y - half, x + head, y + half);
    const flags = value === 'sixteenth' ? 2 : 1;
    const flagBottom =
      y - half + (flags - 1) * t.flagSpacing + REST_PHANTOM_FLAG_DROP + REST_PHANTOM_HEAD_STROKE / 2;
    return box(
      x - head,
      y - half,
      x + REST_PHANTOM_FLAG_REACH + REST_PHANTOM_HEAD_STROKE / 2,
      Math.max(y + half, flagBottom)
    );
  }

  if (style === 'geometric-node') {
    if (value === 'half') {
      return box(x - REST_BAR_WIDTH / 2, y - REST_BAR_HEIGHT * 2, x + REST_BAR_WIDTH / 2, y + REST_BAR_HEIGHT * 2);
    }
    if (value === 'quarter') {
      const h = REST_NODE_SOLID_HALF;
      return box(x - h, y - h, x + h, y + h);
    }
    return box(x - REST_RAY_REACH, y - REST_NODE_HOLLOW_HALF, x + REST_RAY_REACH, y + REST_NODE_HOLLOW_HALF);
  }

  // bauhaus-slash
  if (value === 'half') {
    return box(x - REST_BAR_WIDTH / 2, y - REST_BOX_HALF, x + REST_BAR_WIDTH / 2, y + REST_BOX_HALF);
  }
  if (value === 'quarter') {
    return box(x - REST_Z_HALF * 0.82, y - REST_Z_HALF, x + REST_Z_HALF * 0.82, y + REST_Z_HALF);
  }
  const wings = value === 'sixteenth' ? 2 : 1;
  const reach = REST_SLASH_HALF + (wings === 2 ? REST_WING_OFFSET : 0);
  return box(x - reach, y - REST_SLASH_HALF, x + reach, y + REST_SLASH_HALF);
}
