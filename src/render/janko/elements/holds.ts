/**
 * Round 41 — exceptional-duration **hold-to-release** elements.
 *
 * An admitted per-hand bracket carries one duration for the whole group; a
 * member whose own duration differs from that carried value is an **exception**
 * and keeps its exact statement (the golden rule). This opt-in treatment
 * (`options.durationEndpoint !== 'none'`) replaces that member's own stem /
 * flags / dot with one horizontal connector that
 *
 * 1. starts **flush** with the member's protected symbol edge at its true
 *    pitch `y` (never inside the mask, never with a gap),
 * 2. runs along the member's own pitch row — so it reads as *that* note
 *    sounding, not as a new pitch rail, and
 * 3. ends in a terminal mark whose centre is the **exact resolved release
 *    time** (`startTick + durationTicks` reduced through the laid-out time map),
 *
 * and, where the row it runs on coincides with a painted staff rule, isolates
 * the local rule with a narrow white underlay — the rule segment is *replaced*
 * locally, nothing else is erased.
 *
 * Everything here is pure geometry + paint: the engine resolves the time
 * anchors and the protected-ink blockers, the linter re-audits the very same
 * numbers (`hold-endpoint-hidden`, `hold-connector-hidden`,
 * `hold-endpoint-clearance`, `hold-underlay`), so paint and audit can never
 * drift apart.
 */

import { JankoTokens, ResolvedJankoTokens, resolveJankoTokens } from '../types';
import { f } from './style';

/** The three judged terminal shapes (the round's only open axis). */
export type JankoHoldTerminalShape = 'stop-bar' | 'diamond' | 'ring';

/** One axis-aligned box of already-painted protected ink. */
export interface JankoHoldBlocker {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** One white underlay segment replacing a coincident staff rule locally. */
export interface JankoHoldUnderlay {
  x1: number;
  x2: number;
  y: number;
}

/** Why a terminal is not centred exactly on the release time ('' when it is). */
export type JankoHoldSeatReason = '' | 'protected-ink' | 'lane-clamped';

/**
 * One exceptional member whose hold could **not** be laid out cleanly (the
 * free lane cannot hold the terminal, or the connector corridor is occupied).
 * The engine then keeps the member's canonical exception statement and
 * publishes this refusal — never a hidden or silently clipped endpoint.
 */
export interface JankoHoldRefusal {
  noteId: string;
  startTick: number;
  releaseTick: number;
  /** Why the hold was refused (human-readable, for the lint diagnostic). */
  reason: string;
}

/** Fully resolved geometry of one hold, ready to paint and to audit. */
export interface JankoHoldGeometry {
  noteId: string;
  startTick: number;
  releaseTick: number;
  /** Exact resolved time anchor (page pt) of the release tick. */
  releaseX: number;
  /** Painted centre x of the terminal mark (page pt). */
  terminalX: number;
  /**
   * Honest measured clearance shortfall (pt): `releaseX − terminalX` when the
   * exact release point already carries protected ink and the terminal is
   * seated against it. Never silent — the linter republishes it as a
   * `hold-endpoint-clearance` diagnostic.
   */
  clearanceShortfall: number;
  /** Why the terminal left the exact release x ('' = centred on it). */
  seatReason: JankoHoldSeatReason;
  /** True pitch y of the member (never moved by this treatment). */
  y: number;
  /** Connector start: flush with the symbol's protected right edge. */
  x1: number;
  /** Connector end: the terminal's leading perimeter. */
  x2: number;
  shape: JankoHoldTerminalShape;
  /**
   * True when the release lies past this system's last tick: the connector
   * reaches the line edge and **no terminal is painted** (a line break is not
   * a release).
   */
  continuesAtSystemBreak: boolean;
  /** Staff-rule underlays (empty when the row carries no rule). */
  underlays: JankoHoldUnderlay[];
  stroke: number;
  underlayWidth: number;
}

/** Ink half-extent (pt) of one terminal along x. */
export function holdTerminalReach(tokens: Partial<JankoTokens> | null | undefined, shape: JankoHoldTerminalShape): number {
  const t = resolveJankoTokens(tokens);
  if (shape === 'stop-bar') return t.holdStopBarStroke / 2;
  if (shape === 'diamond') return t.holdDiamondSize / 2;
  return t.holdRingDiameter / 2 + t.holdRingStroke / 2;
}

/** Ink half-extent (pt) of one terminal along y. */
export function holdTerminalHalfHeight(
  tokens: Partial<JankoTokens> | null | undefined,
  shape: JankoHoldTerminalShape
): number {
  const t = resolveJankoTokens(tokens);
  if (shape === 'stop-bar') return t.holdStopBarHeight / 2;
  if (shape === 'diamond') return t.holdDiamondSize / 2;
  return t.holdRingDiameter / 2 + t.holdRingStroke / 2;
}

/** One resolved terminal seat. */
export interface JankoHoldSeat {
  terminalX: number;
  shortfall: number;
  reason: JankoHoldSeatReason;
}

/**
 * Seat one terminal on the exact release time, or — when that point already
 * carries protected ink (the next attack's symbol, a barline, a bracket, a
 * rest) — in the free lane immediately **before** it, clear of that ink by the
 * terminal's own reach plus `holdTerminalAir`.
 *
 * The seat is never moved to the far side of the blocking ink (that would read
 * as a later release) and never allowed to cross the connector's own start
 * (`minSeatX`): a lane that cannot hold the mark returns `null` so the engine
 * reports it instead of hiding ink.
 */
export function seatHoldTerminal(
  releaseX: number,
  y: number,
  shape: JankoHoldTerminalShape,
  blockers: readonly JankoHoldBlocker[],
  tokens: Partial<JankoTokens> | null | undefined,
  minSeatX: number
): JankoHoldSeat | null {
  const t = resolveJankoTokens(tokens);
  const reach = holdTerminalReach(t, shape);
  const halfHeight = holdTerminalHalfHeight(t, shape);
  const air = t.holdTerminalAir;
  const bandY0 = y - halfHeight;
  const bandY1 = y + halfHeight;
  /** True when the terminal's ink box (inflated by the air) touches nothing. */
  const clear = (x: number): boolean => {
    if (x - reach < minSeatX) return false;
    return !blockers.some(
      (b) =>
        b.x1 > x - reach - air &&
        b.x0 < x + reach + air &&
        b.y1 > bandY0 - air &&
        b.y0 < bandY1 + air
    );
  };
  if (clear(releaseX)) return { terminalX: releaseX, shortfall: 0, reason: '' };
  // Otherwise the mark belongs in the nearest free lane **before** the release
  // point: the candidates are the gaps that the ink of the release instant
  // leaves open (against its left and right faces), taken nearest-first, and
  // each is verified against every neighbour — never nudged past the release,
  // never seated inside ink.
  const band = blockers.filter((b) => b.y1 > bandY0 - air && b.y0 < bandY1 + air);
  const candidates = [
    ...new Set([
      ...band.map((b) => b.x0 - air - reach),
      ...band.map((b) => b.x1 + air + reach),
    ]),
  ]
    .filter((x) => x < releaseX - 1e-9 && x - reach >= minSeatX)
    .sort((a, b) => b - a);
  for (const candidate of candidates) {
    if (!clear(candidate)) continue;
    return { terminalX: candidate, shortfall: releaseX - candidate, reason: 'protected-ink' };
  }
  // No room between the connector's start and the blocking ink: the lane
  // cannot hold the mark. Returning null makes the engine keep the member's
  // canonical exception statement and report the refusal — never a hidden or
  // silently clipped endpoint.
  return null;
}

/**
 * Staff-rule underlays for one connector span: every painted rule within half
 * the underlay band of the member's row, clipped to the connector's own
 * horizontal span (a rule the connector never reaches is untouched) **and**
 * clipped around protected ink that shares the band, so the white band only
 * ever replaces the rule it names — never another glyph, rest or bracket
 * (*no indiscriminate erasure*). The linter re-audits each emitted segment.
 */
export function holdUnderlays(
  x1: number,
  x2: number,
  y: number,
  rules: readonly { x1: number; x2: number; y: number }[],
  tokens: Partial<JankoTokens> | null | undefined,
  protectedInk: readonly JankoHoldBlocker[] = []
): JankoHoldUnderlay[] {
  const t = resolveJankoTokens(tokens);
  const half = t.holdUnderlayWidth / 2;
  const out: JankoHoldUnderlay[] = [];
  for (const rule of rules) {
    if (Math.abs(rule.y - y) > half) continue;
    let spans: Array<[number, number]> = [
      [Math.max(x1, rule.x1), Math.min(x2, rule.x2)],
    ];
    for (const ink of protectedInk) {
      if (!(ink.y1 > y - half && ink.y0 < y + half)) continue;
      const next: Array<[number, number]> = [];
      for (const [lo, hi] of spans) {
        if (ink.x1 <= lo || ink.x0 >= hi) {
          next.push([lo, hi]);
          continue;
        }
        if (ink.x0 > lo) next.push([lo, ink.x0]);
        if (ink.x1 < hi) next.push([ink.x1, hi]);
      }
      spans = next;
    }
    for (const [lo, hi] of spans) {
      if (hi <= lo) continue;
      out.push({ x1: lo, x2: hi, y });
    }
  }
  return out;
}

/**
 * Paint the whole hold layer: one white underlay per coincident rule segment,
 * then the shared connector, then the terminal mark. The layer is painted
 * between the staff rules and the rhythm layer, so it erases exactly the rule
 * segments it names and nothing that is painted later (stems, beams, claps,
 * rests, noteheads) can be cut by it.
 */
export function renderJankoHolds(
  holds: readonly JankoHoldGeometry[],
  tokens?: Partial<JankoTokens> | null
): string {
  if (holds.length === 0) return '';
  const t = resolveJankoTokens(tokens);
  const out: string[] = ['    <g class="janko-hold-layer">'];
  for (const hold of holds) {
    out.push(
      `      <g class="janko-hold" data-hold-note="${hold.noteId}" data-hold-shape="${hold.shape}" ` +
        `data-hold-release-tick="${hold.releaseTick}"` +
        `${hold.continuesAtSystemBreak ? ' data-hold-continues="true"' : ''}` +
        `${hold.clearanceShortfall > 0 ? ` data-hold-shortfall="${hold.clearanceShortfall.toFixed(2)}"` : ''}>`
    );
    for (const u of hold.underlays) {
      out.push(
        `        <rect class="janko-hold-underlay" x="${f(u.x1)}" y="${f(u.y - t.holdUnderlayWidth / 2)}" ` +
          `width="${f(u.x2 - u.x1)}" height="${f(t.holdUnderlayWidth)}" fill="#FFFFFF"/>`
      );
    }
    out.push(
      `        <line class="janko-hold-connector" x1="${f(hold.x1)}" y1="${f(hold.y)}" ` +
        `x2="${f(hold.x2)}" y2="${f(hold.y)}" stroke="#111111" ` +
        `stroke-width="${hold.stroke.toFixed(2)}" stroke-linecap="butt"/>`
    );
    if (!hold.continuesAtSystemBreak) {
      out.push(renderHoldTerminal(hold, t));
    }
    out.push('      </g>');
  }
  out.push('    </g>');
  return out.join('\n');
}

/** One terminal mark, centred on the seated release point. */
function renderHoldTerminal(hold: JankoHoldGeometry, t: ResolvedJankoTokens): string {
  const cls = `janko-hold-terminal janko-hold-terminal-${hold.shape}`;
  const cx = hold.terminalX;
  const cy = hold.y;
  if (hold.shape === 'stop-bar') {
    const half = t.holdStopBarHeight / 2;
    return (
      `        <line class="${cls}" x1="${f(cx)}" y1="${f(cy - half)}" x2="${f(cx)}" y2="${f(cy + half)}" ` +
      `stroke="#111111" stroke-width="${t.holdStopBarStroke.toFixed(2)}" stroke-linecap="butt"/>`
    );
  }
  if (hold.shape === 'diamond') {
    const h = t.holdDiamondSize / 2;
    return (
      `        <path class="${cls}" d="M ${f(cx)} ${f(cy - h)} L ${f(cx + h)} ${f(cy)} ` +
      `L ${f(cx)} ${f(cy + h)} L ${f(cx - h)} ${f(cy)} Z" fill="#111111" stroke="none"/>`
    );
  }
  return (
    `        <circle class="${cls}" cx="${f(cx)}" cy="${f(cy)}" r="${f(t.holdRingDiameter / 2)}" ` +
    `fill="none" stroke="#111111" stroke-width="${t.holdRingStroke.toFixed(2)}"/>`
  );
}
