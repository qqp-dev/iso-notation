/** Source-ordered, nonmetrical ornament geometry. No members enter the sounding grid. */
import type { GraceGroup, QuantizedNote } from '../../model/types';
import type { PositionedJankoNote } from './engine';
import type { JankoSystemGeometry, ResolvedJankoLayoutOptions, ResolvedJankoTokens } from './types';
import { getScaledKnockoutMetrics, renderNotehead } from './elements/notehead';
import { getSubdivisionGlyphBBox, verbatimFlagPath } from './elements/rhythm';
import { f } from './elements/style';

export const GRACE_SCALE = 0.80;
export const GRACE_GAP = 12.5;
export const GRACE_HOST_GAP = 15;
export const GRACE_STEM = 15;
// Normalize the existing 0.68 ornament's real ink, so the comparison is exact
// and every new scale grows flags, beams and stem weight coherently.
const GRACE_BEAM_WEIGHT = 1.3 / 0.68;
const GRACE_BEAM_SPACING = 2.3 / 0.68;
const GRACE_STEM_WEIGHT = 0.65 / 0.68;
export interface PlacedGrace {
  group: GraceGroup;
  occurrence: GraceGroup['occurrences'][number];
  heads: { id: string; pitchClass: number; x: number; y: number; duration: string; beamStart: boolean; beamEnd: boolean }[];
  beamY?: number;
}

/** Host identity is explicit; the host's solved column is used, not a tick-wide guess. */
export function placeGraceGroups(
  groups: readonly GraceGroup[], startTick: number, endTick: number,
  notes: readonly PositionedJankoNote[], geo: JankoSystemGeometry,
  o: ResolvedJankoLayoutOptions, t: ResolvedJankoTokens,
  pitchPosition: (note: QuantizedNote) => PositionedJankoNote,
  openingX: (tick: number) => number,
): PlacedGrace[] {
  const placed: PlacedGrace[] = [];
  const mask = getScaledKnockoutMetrics(o, t, t.graceScale, false);
  for (const group of groups) {
    if (!group.members.some(m => m.pitch)) continue;
    const hand = group.hand;
    if (hand === null) throw Error(`Pitched grace ${group.id} has no performing-part hand`);
    for (const occurrence of group.occurrences) {
      if (occurrence.tick < startTick || occurrence.tick >= endTick) continue;
      const host = notes.find(n => occurrence.hostNoteIds.includes(n.note.id) && n.note.startTick === occurrence.tick);
      if (!host) throw Error(`Grace ${occurrence.id}: source host ${occurrence.hostNoteIds.join(',')} absent from engraving`);
      const heads = group.members.map((member, i) => {
        if (!member.pitch) throw Error(`Grace ${group.id}: mixed spacer and pitch`);
        const x = host.x - GRACE_HOST_GAP - (group.members.length - 1 - i) * GRACE_GAP;
        const scratch: QuantizedNote = { id: member.id, pitch: member.pitch, hand, startTick: occurrence.tick, durationTicks: 0 };
        const p = pitchPosition(scratch);
        return { id: member.id, pitchClass: member.pitch.pitchClass, x, y: p.y,
          duration: member.duration, beamStart: member.beamStart, beamEnd: member.beamEnd };
      });
      const firstX = heads[0].x;
      // The barline and the page boundary are physical ink limits, never a
      // reason to silently drop a source member. Demand is expressed in pt.
      const prior = notes.filter(n => n.note.startTick < occurrence.tick && Math.abs(n.y - heads[0].y) < 10)
        .reduce((right, n) => Math.max(right, n.x + t.noteheadRadius), -Infinity);
      const left = Math.max(geo.staffLeft, openingX(occurrence.tick), prior);
      if (firstX - mask.wx < left + 1)
        throw Error(`Grace ${occurrence.id}: unmet pre-host ink demand ${(left + 1 + mask.wx - firstX).toFixed(2)}pt at tick ${occurrence.tick}`);
      const beamY = heads.length > 1 ? Math.min(...heads.map(h => h.y)) - GRACE_STEM : undefined;
      if (heads.length > 1 && (heads[0].duration !== '1/16' || heads.some(h => h.duration !== '1/16') ||
          !heads[0].beamStart || !heads.at(-1)!.beamEnd))
        throw Error(`Grace ${group.id}: connected pair requires two written sixteenth beams`);
      if (heads.length === 1 && heads[0].duration !== '1/8') throw Error(`Grace ${group.id}: unsupported lone written value`);
      placed.push({ group, occurrence, heads, beamY });
    }
  }
  return placed;
}

/** Page-slot booking uses the actual scaled mask, beam and flag ink. */
export function graceVerticalInkBounds(graces: readonly PlacedGrace[], o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens): { top: number; bottom: number } {
  let top = Infinity, bottom = -Infinity;
  const mask = getScaledKnockoutMetrics(o, t, t.graceScale, false);
  for (const grace of graces) {
    for (const h of grace.heads) {
      top = Math.min(top, h.y - mask.hy, grace.beamY !== undefined
        ? grace.beamY - GRACE_BEAM_WEIGHT * t.graceScale / 2 : h.y - GRACE_STEM - GRACE_STEM_WEIGHT * t.graceScale / 2);
      bottom = Math.max(bottom, h.y + mask.hy);
      if (grace.heads.length === 1) {
        const box = getSubdivisionGlyphBBox('classical-urtext', -1, 1, t);
        top = Math.min(top, h.y - GRACE_STEM + t.graceScale * box.y0);
        bottom = Math.max(bottom, h.y - GRACE_STEM + t.graceScale * box.y1);
      }
    }
    if (grace.beamY !== undefined) bottom = Math.max(bottom, grace.beamY + 5.3 * t.graceScale);
  }
  return { top, bottom };
}

/** Paint rhythm before masks, with true two-level connected beams or one eighth flag. */
export function renderPlacedGrace(grace: PlacedGrace, o: ResolvedJankoLayoutOptions, t: ResolvedJankoTokens): string {
  const parts = [`    <g class="janko-grace" data-grace-id="${grace.occurrence.id}" data-host="${grace.group.hostEventId}">`];
  const mask = getScaledKnockoutMetrics(o, t, t.graceScale, false);
  for (const head of grace.heads) {
    const top = grace.beamY ?? head.y - GRACE_STEM;
    parts.push(`      <path class="janko-grace-stem" data-member="${head.id}" d="M ${f(head.x)} ${f(head.y - mask.hy - 0.2)} L ${f(head.x)} ${f(top)}" fill="none" stroke="#111111" stroke-width="${f(GRACE_STEM_WEIGHT * t.graceScale)}"/>`);
    if (grace.heads.length === 1) {
      const flag = verbatimFlagPath(head.x, top, -1, 1);
      parts.push(`      <g class="janko-grace-flag" transform="translate(${f(head.x)} ${f(top)}) scale(${t.graceScale}) translate(${f(-head.x)} ${f(-top)})">${flag}</g>`);
    }
  }
  if (grace.beamY !== undefined) {
    const a = grace.heads[0].x, b = grace.heads.at(-1)!.x;
    for (let level = 0; level < 2; level++) parts.push(`      <path class="janko-grace-beam" data-level="${level + 1}" d="M ${f(a)} ${f(grace.beamY + level * GRACE_BEAM_SPACING * t.graceScale)} L ${f(b)} ${f(grace.beamY + level * GRACE_BEAM_SPACING * t.graceScale)}" fill="none" stroke="#111111" stroke-width="${f(GRACE_BEAM_WEIGHT * t.graceScale)}"/>`);
  }
  for (const h of grace.heads) parts.push(`      <g class="janko-grace-head" data-member="${h.id}" data-written="${h.duration}">` +
    renderNotehead({ x: h.x, y: h.y, pitchClass: h.pitchClass, hand: grace.group.hand ?? undefined, symbolScale: t.graceScale }, t, o) + '</g>');
  parts.push('    </g>');
  return parts.join('\n');
}
