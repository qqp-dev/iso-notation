import type { QuantizedGridScore } from '../../model/types';
import type { ResolvedJankoLayoutOptions, ResolvedJankoTokens } from './types';

/** One admission decision. Bar numbers are indices into the literal unfolded boundary list. */
export interface ProductionSystem {
  firstBar: number;
  lastBar: number; // exclusive
  widths: number[];
  minimums: number[];
  leftInsets: number[];
}
export interface ProductionPlan { systems: ProductionSystem[]; starts: number[] }

/** A bounded, monotonic ink-demand admission for imported sources. No score IDs or measure tables. */
export function planProductionLayout(score: QuantizedGridScore, o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens): ProductionPlan | undefined {
  if (!score.productionLayout || !score.sourceBarTicks) return undefined;
  const bars = score.sourceBarTicks;
  const staffWidth = o.pageWidth - (o.pageMarginRight ?? o.pageMargin) -
    (o.pageMarginLeft ?? o.pageMargin) - t.accoladeWidth - t.accoladeGap;
  const minimums: number[] = [];
  const leftInsets: number[] = [];
  for (let b = 0; b < bars.length - 1; b++) {
    const inBar = score.notes.filter(n => n.startTick >= bars[b] && n.startTick < bars[b + 1]);
    const onsets = [...new Set(inBar.map(n => n.startTick))];
    const densest = Math.max(1, ...onsets.map(tick => inBar.filter(n => n.startTick === tick).length));
    const graces = score.graceGroups?.flatMap(g => g.occurrences.filter(occ => occ.tick >= bars[b] && occ.tick < bars[b+1] && g.members.some(m => m.pitch))
      .map(occ => ({ tick: occ.tick, count: g.members.length }))) ?? [];
    const hostDemand = Math.max(0, ...graces.map(g => g.count * 12.5 + 21));
    // A downbeat host needs the entire pre-host group in its OWN bar, not
    // merely a wider bar that still places its head 6pt past the barline.
    const openingGrace = graces.filter(g => g.tick === bars[b]);
    leftInsets.push(Math.max(6, ...openingGrace.map(g => 15 + (g.count - 1) * 12.5 + 4.5)));
    // Protected barline insets; rhythmic columns, chord masks and pre-host
    // grace ink cannot borrow another measure's allocation.
    const rhythmic = Math.max(1, onsets.length) * (2 * t.noteheadRadius + 4.2);
    const chords = (densest - 1) * (2 * t.noteheadRadius + 2);
    const tied = score.tieChains?.some(chain => chain.components.some(c =>
      c.startTick >= bars[b] && c.startTick < bars[b + 1] && c.startTick !== chain.components[0].startTick));
    const folded = inBar.some(n => { const lin = n.pitch.octave * 12 + n.pitch.pitchClass;
      return lin > 78 || lin < 18; });
    const markerAir = (tied ? 1 : 0) + (folded ? 14 : 0);
    const base = leftInsets[b] + Math.max(6, t.measureInset) + 12 + rhythmic + chords + markerAir +
      (openingGrace.length ? 0 : hostDemand);
    minimums.push(Math.max(48, base));
  }
  const systems: ProductionSystem[] = [];
  const starts = [0];
  for (let first = 0; first < minimums.length;) {
    let last = first, used = 0;
    const preferred = Math.max(1, Math.round(o.measuresPerSystem));
    while (last < minimums.length && last - first < preferred &&
      (last === first || used + minimums[last] <= staffWidth)) used += minimums[last++];
    if (used > staffWidth) throw Error(`Unmet production width: written occurrence ${first + 1} requires ${used.toFixed(2)}pt, available ${staffWidth.toFixed(2)}pt`);
    const available = Math.max(0, staffWidth - used);
    const lengths = minimums.slice(first, last);
    const weight = lengths.reduce((sum, v) => sum + Math.sqrt(v), 0);
    const widths = lengths.map(v => v + available * Math.sqrt(v) / weight);
    systems.push({ firstBar: first, lastBar: last, widths, minimums: lengths,
      leftInsets: leftInsets.slice(first, last) });
    first = last; starts.push(last);
  }
  // Avoid a visually isolated, ordinary final bar when the preceding system
  // can lend a bar: this balances only neighbouring content, not the work.
  if (systems.length > 1 && systems.at(-1)!.lastBar - systems.at(-1)!.firstBar === 1) {
    const previous = systems[systems.length - 2], final = systems[systems.length - 1];
    const lend = previous.lastBar - 1;
    if (lend > previous.firstBar + 1 && minimums[lend] + minimums[final.firstBar] <= staffWidth) {
      const rewidth = (first: number, last: number): ProductionSystem => {
        const lengths = minimums.slice(first, last);
        const slack = staffWidth - lengths.reduce((sum, v) => sum + v, 0);
        const weight = lengths.reduce((sum, v) => sum + Math.sqrt(v), 0);
        return { firstBar: first, lastBar: last, minimums: lengths,
          leftInsets: leftInsets.slice(first, last),
          widths: lengths.map(v => v + slack * Math.sqrt(v) / weight) };
      };
      systems.splice(-2, 2, rewidth(previous.firstBar, lend), rewidth(lend, final.lastBar));
      starts[starts.length - 2] = lend;
    }
  }
  return { systems, starts };
}
