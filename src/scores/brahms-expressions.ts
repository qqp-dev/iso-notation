import type { DynamicOverlay, PedalOverlay } from '../model/types';

export interface ExpressionWitness {
  kind: string;
  text: string;
  direction: string;
  span: string;
  num: number;
  den: number;
  file: string;
  line: number;
  col: number;
  bar: number;
  context: string;
}

export interface ExpressionOrigin {
  file: string;
  line: number;
  col: number;
  bar: number;
  context: string;
  occurrence: number;
  time: string;
  order: number;
}
export type SourceDynamic = DynamicOverlay & { origin: ExpressionOrigin; kind: 'mark' | 'hairpin' | 'text-cresc' };
export type SourcePedal = PedalOverlay & { origin: ExpressionOrigin; order: number };
export interface ExpressionSidecar {
  version: 1;
  totalTicks: number;
  dynamics: SourceDynamic[];
  /** Explicit, redundant compiler stop: retained as evidence, never painted. */
  boundaries: { tick: number; kind: 'redundant-stop'; origin: ExpressionOrigin }[];
  pedals: SourcePedal[];
}
const MARKS = new Set(['ppp', 'pp', 'p', 'mp', 'mf', 'f', 'ff', 'fff', 'sf', 'sfz']);
const CONTEXTS = new Set(['dynamics', 'pedal', 'rightHandUpper', 'rightHandLower', 'leftHandUpper', 'leftHandLower']);

/** Repeated layout downs are literal source events, not inferred changes. Every
 * up, however, must release a prior down (including the off half of \sud). */
function checkPedalSequence(pedals: SourcePedal[]): void {
  let held = false;
  let previousTick = -1;
  for (const pedal of pedals) {
    const o = pedal.origin;
    const at = `${o.file}:${o.line}:${o.col} (${o.context}, ${o.time}, bar ${o.bar}, occurrence ${o.occurrence})`;
    if (pedal.tick < previousTick) throw new Error(`Brahms expression ${at}: pedal events out of time order`);
    if (pedal.type === 'sustain-up') {
      if (!held) throw new Error(`Brahms expression ${at}: unmatched sustain-up`);
      held = false;
    } else if (pedal.type === 'sustain-down') held = true;
    else throw new Error(`Brahms expression ${at}: unsupported pedal ${pedal.type}`);
    previousTick = pedal.tick;
  }
}

/** Every event is a compiler listener event; no nearest-note or floating-point quantization. */
export function normalizeBrahmsExpressions(rows: ExpressionWitness[], totalTicks: number): ExpressionSidecar {
  const dynamics: SourceDynamic[] = [];
  const pedals: SourcePedal[] = [];
  const boundaries: ExpressionSidecar['boundaries'] = [];
  const occurrences = new Map<string, number>();
  const open = new Map<string, SourceDynamic>();
  const lastClose = new Map<string, { tick: number; file: string; line: number; col: number }>();
  let order = 0;
  for (const row of rows) {
    const at = `${row.file}:${row.line}:${row.col} (${row.context}, ${row.num}/${row.den}, bar ${row.bar})`;
    const fail = (why: string): never => { throw new Error(`Brahms expression ${at}: ${why}`); };
    if (!CONTEXTS.has(row.context) || !Number.isInteger(row.num) || !Number.isInteger(row.den) || row.den < 1 ||
      !Number.isInteger(row.line) || row.line < 1 || !Number.isInteger(row.col) || row.col < 1 ||
      !row.file.startsWith('includes/') || !Number.isInteger(row.bar) || row.bar < 1) fail('invalid origin/time/context');
    const product = row.num * 192;
    if (product % row.den !== 0) fail('fractional grid tick');
    const tick = product / row.den;
    if (tick < 0 || tick > totalTicks) fail('outside score');
    const key = `${row.context}|${row.kind}|${row.file}|${row.line}|${row.col}|${row.direction}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    const origin: ExpressionOrigin = { file: row.file, line: row.line, col: row.col, bar: row.bar,
      context: row.context, occurrence, time: `${row.num}/${row.den}`, order: order++ };
    if (row.kind === 'dynamic' && row.direction === '()' && row.span === '()') {
      if (!MARKS.has(row.text)) fail(`unsupported dynamic ${row.text}`);
      dynamics.push({ tick, mark: row.text as DynamicOverlay['mark'], kind: 'mark', origin });
    } else if ((row.kind === 'crescendo' || row.kind === 'decrescendo') && row.text === '()') {
      const active = open.get(row.context);
      if (row.direction === '-1' && row.kind === 'crescendo' && row.span === 'text') {
        // Literal standalone \\cresc (text instruction), not a bracketed span.
        dynamics.push({ tick, mark: 'crescendo', kind: 'text-cresc', origin });
      } else if (row.direction === '-1') {
        if (active) fail(`overlapping span (opened at ${active.origin.file}:${active.origin.line}:${active.origin.col})`);
        if (row.span !== '()' && !(row.kind === 'crescendo' && row.span === 'text')) fail(`unsupported span ${row.span}`);
        const item: SourceDynamic = { tick, mark: 'crescendo', kind: row.span === 'text' ? 'text-cresc' : 'hairpin', origin };
        if (row.kind === 'decrescendo') item.mark = 'decrescendo';
        dynamics.push(item);
        open.set(row.context, item);
      } else if (row.direction === '1') {
        // LilyPond's generic \\! is emitted as a crescendo stop even
        // when the active spanner is a decrescendo.
        if (!active) {
          // The transcription contains a redundant explicit stop in m. 36:
          // the preceding s8\\! has already closed the same crescendo.
          // Preserve it as an ordered, zero-ink boundary witness rather than
          // inventing a new span or silently discarding the event.
          if (row.context === 'dynamics' && row.file === 'includes/intermezzo-op118-no1-parts.ily' &&
              row.line === 383 && row.col === 10 && row.kind === 'crescendo' && row.span === '()' &&
              (tick === 6792 || tick === 10632) &&
              lastClose.get(row.context)?.tick === tick - 48 &&
              lastClose.get(row.context)?.file === row.file &&
              lastClose.get(row.context)?.line === 382 &&
              lastClose.get(row.context)?.col === 69) {
            boundaries.push({ tick, kind: 'redundant-stop', origin });
            continue;
          }
          throw new Error(`Brahms expression ${at}: unmatched span stop`);
        }
        if (tick <= active.tick) fail('nonpositive span');
        active.durationTicks = tick - active.tick;
        open.delete(row.context);
        lastClose.set(row.context, { tick, file: row.file, line: row.line, col: row.col });
      } else fail(`unsupported span direction ${row.direction}`);
    } else if (row.kind === 'sustain' && row.context === 'pedal' && row.text === '()' && row.span === '()') {
      if (row.direction !== '-1' && row.direction !== '1') fail(`unsupported sustain direction ${row.direction}`);
      pedals.push({ tick, type: row.direction === '-1' ? 'sustain-down' : 'sustain-up', origin, order: origin.order });
    } else fail(`unsupported ${row.kind} ${row.text} ${row.direction} ${row.span}`);
  }
  for (const item of open.values()) throw new Error(`Brahms expression ${item.origin.file}:${item.origin.line}:${item.origin.col} (${item.origin.context}): unmatched span start`);
  checkPedalSequence(pedals);
  // A same-tick change is represented as ordered off + on, not inferred from
  // repeated layout downs; the latter are retained as written.
  return { version: 1, totalTicks, dynamics, boundaries, pedals };
}

/** Validate every committed overlay before using it; malformed/stale data fails closed. */
export function validateBrahmsExpressions(value: ExpressionSidecar, totalTicks: number): ExpressionSidecar {
  if (value.version !== 1 || value.totalTicks !== totalTicks || !Array.isArray(value.dynamics) ||
      !Array.isArray(value.boundaries) || !Array.isArray(value.pedals))
    throw new Error('Brahms expressions: sidecar version, length or shape mismatch');
  const all = [...value.dynamics, ...value.boundaries, ...value.pedals].sort((a, b) => a.origin.order - b.origin.order);
  all.forEach((e) => {
    const o = e.origin;
    if (!o || !Number.isInteger(o.occurrence) || o.occurrence < 1 || !Number.isInteger(o.order) ||
      !Number.isInteger(e.tick) || e.tick < 0 || e.tick > totalTicks) throw new Error('Brahms expressions: invalid origin or tick');
    const [num, den] = o.time.split('/').map(Number);
    if (!Number.isInteger(num) || !Number.isInteger(den) || den <= 0 || num * 192 / den !== e.tick ||
      !o.file.startsWith('includes/') || o.line < 1 || o.col < 1 || o.bar < 1 || !CONTEXTS.has(o.context))
      throw new Error('Brahms expressions: origin/time mismatch');
    if ('type' in e) {
      if (e.type !== 'sustain-down' && e.type !== 'sustain-up' || e.order !== o.order || o.context !== 'pedal')
        throw new Error('Brahms expressions: unsupported pedal');
    } else if (e.kind === 'hairpin') {
      if (!Number.isInteger(e.durationTicks) || (e.durationTicks ?? 0) <= 0 || e.tick + e.durationTicks! > totalTicks)
        throw new Error('Brahms expressions: invalid span');
    } else if ('durationTicks' in e && e.durationTicks !== undefined) throw new Error('Brahms expressions: unexpected duration');
  });
  // Origin validations above; duplicate identity/order and malformed kinds are
  // checked without reordering away source sequence.
  if (new Set(all.map((e) => e.origin.order)).size !== all.length || all.some((e, i) => i > 0 && e.origin.order <= all[i - 1].origin.order))
    throw new Error('Brahms expressions: duplicated event order');
  for (const e of value.dynamics) {
    if ((e.kind === 'mark' && (!MARKS.has(e.mark) || e.durationTicks !== undefined)) ||
        (e.kind !== 'mark' && e.kind !== 'hairpin' && e.kind !== 'text-cresc') ||
        (e.kind !== 'mark' && e.mark !== 'crescendo' && e.mark !== 'decrescendo'))
      throw new Error('Brahms expressions: invalid dynamic');
  }
  checkPedalSequence(value.pedals);
  // The pinned corpus inventory is a guard against a truncated sidecar that
  // still happens to contain individually well-formed records.
  if (value.dynamics.length !== 89 || value.pedals.length !== 116 ||
      value.dynamics.filter(e => e.kind === 'mark').length !== 28 ||
      value.dynamics.filter(e => e.kind === 'hairpin').length !== 59 ||
      value.dynamics.filter(e => e.kind === 'text-cresc').length !== 2 ||
      value.pedals.filter(e => e.type === 'sustain-down').length !== 80 ||
      value.pedals.filter(e => e.type === 'sustain-up').length !== 36)
    throw new Error('Brahms expressions: source-event inventory mismatch');
  if (value.boundaries.length !== 2 || value.boundaries.some((e, i) =>
    e.kind !== 'redundant-stop' || e.origin.file !== 'includes/intermezzo-op118-no1-parts.ily' ||
    e.origin.line !== 383 || e.origin.col !== 10 || e.origin.context !== 'dynamics' ||
    e.tick !== [6792, 10632][i] || e.origin.occurrence !== i + 1))
    throw new Error('Brahms expressions: invalid redundant-stop evidence');
  if (scorePedalsFromExpressions(value).filter(e => e.type === 'sustain-change').length !== 7)
    throw new Error('Brahms expressions: layout pedal-change inventory mismatch');
  if (value.dynamics.some((e, i) => i > 0 && e.origin.order <= value.dynamics[i - 1].origin.order) ||
      value.pedals.some((e, i) => i > 0 && e.origin.order <= value.pedals[i - 1].origin.order))
    throw new Error('Brahms expressions: nonmonotonic source order');
  return value;
}

/** Collapse only literal adjacent off/on into a semantic layout change.
 * The sidecar keeps both raw events, their exact order and both origins. */
export function scorePedalsFromExpressions(sidecar: ExpressionSidecar): PedalOverlay[] {
  const result: PedalOverlay[] = [];
  for (let i = 0; i < sidecar.pedals.length; i++) {
    const off = sidecar.pedals[i];
    const on = sidecar.pedals[i + 1];
    if (off.type === 'sustain-up' && on?.type === 'sustain-down' && on.tick === off.tick &&
        on.origin.context === off.origin.context && on.order === off.order + 1) {
      result.push({ tick: off.tick, type: 'sustain-change', origin: off.origin,
        order: off.order, changeOrigins: [off.origin, on.origin] });
      i++;
    } else result.push(off);
  }
  return result;
}
