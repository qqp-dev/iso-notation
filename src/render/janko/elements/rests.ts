/**
 * Rest symbols — the Round 12 question: how a hand's **silent span inside an
 * active measure** is written.
 *
 * A rest is anchored on its hand's **voice equator** (RH: Octave 4, LH:
 * Octave 3 — the middle rule of that hand's own staff half) at the exact beat
 * column of the silence's onset, so the eye reads the gap in the same
 * proportional grid as the notes around it. Every dialect states the same four
 * duration classes, and every dialect is a *monoline* grammar: no heavy beads,
 * no filled picture-glyphs beyond the half/whole mark.
 *
 * | style                | 16th                    | 8th                   | quarter                  | half / whole               |
 * | -------------------- | ----------------------- | --------------------- | ------------------------ | -------------------------- |
 * | `'kinetic-monoline'` | stem + two 12.4° tabs   | stem + one 12.4° tab  | central horizontal notch | hollow bar (W 7 × H 2.2pt) |
 * | `'classical-urtext'` | calligraphic two-hook   | calligraphic one-hook | serpentine lightning     | solid block (W 6 × H 2.5pt)|
 * | `'geometric-node'`   | hollow diamond + 2 rays | hollow diamond + 1 ray| solid diamond (5 × 5pt)  | open capsule / lozenge     |
 * | `'bauhaus-slash'`    | 45° slash + two wings   | 45° slash + one wing  | minimalist reversed-Z    | thin hairline box          |
 *
 * The engine's `computeJankoRests` decides *where* a rest belongs (a clean
 * standard-value silence of one hand in a measure that hand is active in) and
 * drops any rest whose {@link restInkBox} would collide with foreign ink; this
 * module only paints what it is handed.
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

/** Vertical rest-stem height (pt) of the kinetic monoline dialect. */
export const REST_STEM_HEIGHT = 12.0;
/** Stroke (pt) of every monoline rest element. */
export const REST_STROKE = 0.90;
/** Horizontal reach (pt) of a kinetic tab right of its stem. */
export const REST_TAB_WIDTH = 4.0;
/** Half-width (pt) of the quarter rest's central notch. */
export const REST_NOTCH_HALF = 2.2;
/** Hollow half/whole bar of the kinetic dialect: `W × H` in pt. */
export const REST_BAR_WIDTH = 7.0;
export const REST_BAR_HEIGHT = 2.2;
/** Solid half/whole block of the urtext dialect: `W × H` in pt. */
export const REST_BLOCK_WIDTH = 6.0;
export const REST_BLOCK_HEIGHT = 2.5;
/** Half-diagonal (pt) of the geometric node diamonds. */
export const REST_NODE_HOLLOW_HALF = 2.0;
export const REST_NODE_SOLID_HALF = 2.5;
/** Horizontal reach (pt) of a geometric node's lateral tick ray. */
export const REST_RAY_REACH = 4.2;
/** Half-extent (pt) of the bauhaus slash and its parallel wings. */
export const REST_SLASH_HALF = 3.5;
export const REST_WING_OFFSET = 2.2;
/** Half-height (pt) of the bauhaus quarter reversed-Z. */
export const REST_Z_HALF = 3.4;

/** One resolved rest: where it stands, how long it is silent and in which dialect. */
export interface JankoRestGeometry {
  /** Absolute onset tick of the silence. */
  tick: number;
  /** Length of the silence (ticks). */
  durationTicks: number;
  /** Hand whose voice is silent. */
  hand: Hand;
  /** Beat column of the rest (page pt). */
  x: number;
  /** Voice equator of the rest's hand (page pt). */
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
  const sign = -1; // up-raked: the tab rises away from its stem.
  for (let i = 1; i <= marks; i++) {
    const cy = y - half + (i - 1) * t.flagSpacing;
    out.push(
      `    <line class="janko-rest-tab" data-rest-tab="${i}" x1="${f(x)}" y1="${f(cy)}" x2="${f(x + REST_TAB_WIDTH)}" y2="${f(cy + sign * REST_TAB_WIDTH * rake(t))}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`
    );
  }
  return out;
}

/** One calligraphic urtext hook, opening left and sweeping down-right. */
function urtextHook(x: number, y: number, stroke: string): string {
  const d =
    `M ${f(x - 3.0)} ${f(y)} ` +
    `C ${f(x + 2.6)} ${f(y - 0.5)} ${f(x + 3.4)} ${f(y + 2.8)} ${f(x - 0.4)} ${f(y + 4.4)}`;
  return `    <path class="janko-rest-hook" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** The classical urtext ink: calligraphic hooks, serpentine, solid block. */
function renderClassicalUrtext(rest: JankoRestGeometry): string[] {
  const { x, y, value } = rest;
  const out: string[] = [];
  const stroke = REST_STROKE.toFixed(2);

  if (value === 'half') {
    out.push(
      `    <rect class="janko-rest-block" x="${f(x - REST_BLOCK_WIDTH / 2)}" y="${f(y - REST_BLOCK_HEIGHT / 2)}" width="${f(REST_BLOCK_WIDTH)}" height="${f(REST_BLOCK_HEIGHT)}" fill="#111111" stroke="none"/>`
    );
    return out;
  }

  if (value === 'quarter') {
    const d =
      `M ${f(x - 2.0)} ${f(y - 4.6)} L ${f(x + 2.2)} ${f(y - 2.6)} ` +
      `L ${f(x - 2.2)} ${f(y - 0.2)} L ${f(x + 2.0)} ${f(y + 1.8)} L ${f(x - 1.4)} ${f(y + 3.8)}`;
    out.push(
      `    <path class="janko-rest-lightning" d="${d}" fill="none" stroke="#111111" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    );
    return out;
  }

  const hooks = value === 'sixteenth' ? 2 : 1;
  for (let i = 1; i <= hooks; i++) {
    out.push(urtextHook(x, y - 5.0 + (i - 1) * 4.2, stroke));
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
  return `    <line class="janko-rest-ray" x1="${f(x + side * (REST_NODE_HOLLOW_HALF + 0.4))}" y1="${f(y)}" x2="${f(x + side * REST_RAY_REACH)}" y2="${f(y)}" stroke="#111111" stroke-width="${stroke}" stroke-linecap="butt"/>`;
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
      `    <rect class="janko-rest-box" x="${f(x - REST_BAR_WIDTH / 2)}" y="${f(y - 1.5)}" width="${f(REST_BAR_WIDTH)}" height="3" fill="none" stroke="#111111" stroke-width="0.60"/>`
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
      ink = renderClassicalUrtext(rest);
      break;
    case 'geometric-node':
      ink = renderGeometricNode(rest);
      break;
    case 'bauhaus-slash':
      ink = renderBauhausSlash(rest);
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
    const marks = value === 'sixteenth' ? 2 : 1;
    const topTab = y - half;
    const bottomTab = topTab + (marks - 1) * t.flagSpacing;
    const tabTop = Math.min(topTab - REST_TAB_WIDTH * rake(t), bottomTab - REST_TAB_WIDTH * rake(t));
    return box(x - REST_STROKE / 2, Math.min(y - half, tabTop), x + REST_TAB_WIDTH, y + half);
  }

  if (style === 'classical-urtext') {
    if (value === 'half') {
      return box(x - REST_BLOCK_WIDTH / 2, y - REST_BLOCK_HEIGHT / 2, x + REST_BLOCK_WIDTH / 2, y + REST_BLOCK_HEIGHT / 2);
    }
    if (value === 'quarter') return box(x - 2.6, y - 5.2, x + 2.8, y + 4.4);
    const hooks = value === 'sixteenth' ? 2 : 1;
    return box(x - 3.2, y - 5.3, x + 3.6, y - 5.0 + (hooks - 1) * 4.2 + 4.8);
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
    return box(x - REST_BAR_WIDTH / 2, y - 1.5, x + REST_BAR_WIDTH / 2, y + 1.5);
  }
  if (value === 'quarter') {
    return box(x - REST_Z_HALF * 0.82, y - REST_Z_HALF, x + REST_Z_HALF * 0.82, y + REST_Z_HALF);
  }
  const wings = value === 'sixteenth' ? 2 : 1;
  const reach = REST_SLASH_HALF + (wings === 2 ? REST_WING_OFFSET : 0);
  return box(x - reach, y - REST_SLASH_HALF, x + reach, y + REST_SLASH_HALF);
}
