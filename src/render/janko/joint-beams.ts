import type { ResolvedJankoTokens, ResolvedJankoLayoutOptions } from './types';
import { computeBeamGroupGeometry, getStemGeometry, type JankoBeamGroupGeometry,
  type JankoBeamRestObstacle, type JankoRhythmNote } from './elements/rhythm';

/** Candidate-only pre-ink planning. Overlap means sounding/written obligation,
 * not equal attack, equal value, or an inferred relationship between voices.
 * Opposite hand directions remain separate courses in the same obstacle field.
 * Solos/held branches without rails participate as head obstacles, not invented
 * beam levels. Continuation notes in the partition participate normally. */
export function computeJointVoiceBeams(
  groups: JankoRhythmNote[][], t: ResolvedJankoTokens, notes: JankoRhythmNote[],
  spine: number, restInk: JankoBeamRestObstacle[],
  grammar: ResolvedJankoLayoutOptions['durationGrammar']
): JankoBeamGroupGeometry[] {
  const obligations = groups.filter(g => g.length >= 2).map(group => {
    const stems = group.map(n => getStemGeometry(n, t));
    const lo = stems.reduce((a,b) => a.stemX < b.stemX ? a : b);
    const hi = stems.reduce((a,b) => a.stemX > b.stemX ? a : b);
    const width = hi.stemX - lo.stemX;
    return { group, direction: lo.direction, voice: group[0].sourceVoice,
      start: Math.min(...group.map(n => n.startTick)),
      end: Math.max(...group.map(n => n.startTick + n.durationTicks)),
      width, slope: width ? Math.max(-t.maxBeamSlope, Math.min(t.maxBeamSlope,
        (hi.stemEndY - lo.stemEndY) / width)) : 0,
      key: group.map(n => n.id).sort().join('|') };
  }).sort((a,b) => a.start-b.start || a.key.localeCompare(b.key));
  const pending = new Set(obligations);
  const beams: JankoBeamGroupGeometry[] = [];
  while (pending.size) {
    const first = pending.values().next().value!;
    pending.delete(first);
    const component = [first];
    for (let i=0; i<component.length; i++) {
      const a = component[i];
      for (const b of pending) {
        if (a.direction !== b.direction || a.voice === b.voice ||
          Math.max(a.start,b.start) >= Math.min(a.end,b.end)) continue;
        pending.delete(b); component.push(b);
      }
    }
    // Span-weighted preferred course: no voice's enumeration order wins.
    // Actual head contours still choose each route's minimum legal anchor.
    const weight = component.reduce((s,a) => s+a.width,0);
    const slope = weight ? component.reduce((s,a) => s+a.slope*a.width,0)/weight : 0;
    const fitted = component.map(a => ({ a, beam: computeBeamGroupGeometry(
      a.group,t,notes,spine,restInk,grammar,{slope})! }));
    const referenceX = Math.min(...fitted.map(f => f.beam.primary.x1));
    // Inner course first; move only outward from real head/level constraints.
    // This is a local rail reservation, not a permanent source-voice plane.
    fitted.sort((a,b) => first.direction * (a.beam.beamY(referenceX)-b.beam.beamY(referenceX)) ||
      a.a.key.localeCompare(b.a.key));
    const settled: JankoBeamGroupGeometry[] = [];
    for (const {a,beam} of fitted) {
      let shift = 0;
      for (const other of settled) {
        const x0 = Math.max(beam.primary.x1,other.primary.x1);
        const x1 = Math.min(beam.primary.x2,other.primary.x2);
        if (x1 < x0) continue;
        // Two primaries must not read as the usual 3.40pt duration stack.
        const primaryAir = 2*(t.beamThickness+1.6);
        for (const x of [x0,x1]) shift = Math.max(shift,
          primaryAir-a.direction*(beam.beamY(x)-other.beamY(x)));
        for (const l of beam.levels) for (const r of other.levels) {
          const left = Math.max(Math.min(l.connector.x1,l.connector.x2),Math.min(r.connector.x1,r.connector.x2));
          const right = Math.min(Math.max(l.connector.x1,l.connector.x2),Math.max(r.connector.x1,r.connector.x2));
          if (right < left) continue;
          const y = (c: typeof l.connector,x:number) => c.y1+slope*(x-c.x1);
          for (const x of [left,right]) shift = Math.max(shift,
            2*(t.beamThickness+1.6)-a.direction*(y(l.connector,x)-y(r.connector,x)));
        }
      }
      // Rebuild from the plan, never translate finished ink or beamY closures.
      settled.push(shift > 0 ? computeBeamGroupGeometry(a.group,t,notes,spine,
        restInk,grammar,{slope,outwardShift:shift})! : beam);
    }
    beams.push(...settled);
  }
  // Partition order remains the engine's owner/index contract, even though
  // solving and reservation were independent of that order.
  return groups.flatMap(g => {
    const b = beams.find(b => b.notes.length===g.length && b.notes.every(n=>g.includes(n)));
    return b ? [b] : [];
  });
}
