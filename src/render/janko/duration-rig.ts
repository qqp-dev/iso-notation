/** Guarded candidate-only duration-mark controls. Musical score data is never edited. */
import { layoutJankoScore, knockoutHalfExtents } from './engine';
import { exceptionCarrierInkBox, detachedSymbolInkBox, claspInkBox } from './elements/rhythm';
import { lintJankoScore } from './linter';
import { resolveJankoOptions, resolveJankoTokens, type JankoLayoutOptions, type JankoTokens } from './types';
import type { QuantizedGridScore } from '../../model/types';

export interface DurationTarget { score: string; measure: number; tick: number; family: 'ring' | 'half-ring'; ownerIds: string[] }
export interface DurationVariant {
  id: string; score: string; options: Pick<JankoLayoutOptions, 'exceptionCarrier'>;
  tokens: Pick<JankoTokens, 'halfRingGap' | 'detachedSymbolAir' | 'horizontalMountAir'>;
  placements: Array<{ target: DurationTarget; preference: 'above' | 'beside' }>;
  windows: Array<{ measureStart: number; measureCount: number }>;
  revision: string;
  lint: { violations: number; warnings: number; newViolations: string[] };
  refusals: Array<{ tick: number; ownerIds: string[]; reason: string }>;
}
export interface DurationIntent { schema: 1; intent: 'engrave-duration'; score: string; base: string; variantId: string;
  options?: Record<string, unknown>; tokens?: Record<string, unknown>;
  placements?: Array<{ target: DurationTarget; preference: 'above' | 'beside' }>;
  windows?: Array<{ measureStart: number; measureCount: number }>;
  reason?: string }

function keys(value: unknown, allowed: readonly string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k)))
    throw new Error('unsupported duration control/field');
}
const sorted = (ids: string[]) => [...ids].sort();
export function inspectDuration(score: QuantizedGridScore, options: JankoLayoutOptions, tokens: JankoTokens, measure: number, tick?: number) {
  const t = resolveJankoTokens(tokens), o = resolveJankoOptions(options);
  if (!Number.isSafeInteger(measure) || measure < 1) throw new Error('invalid measure');
  const layouts = layoutJankoScore(score, o, t);
  const marks = layouts.flatMap(layout => layout.durationInkOwners.map(mark => ({ layout, mark })))
    .filter(({ mark }) => Math.floor(Math.max(0, mark.tick - (t.anacrusisTicks ?? 0)) / t.ticksPerMeasure) + 1 === measure && (tick === undefined || tick === mark.tick));
  return marks.map(({ layout, mark }) => {
    const carrier = layout.exceptionCarriers.find(c => c.tick === mark.tick && sorted([c.noteId, ...(c.partnerId ? [c.partnerId] : [])]).join('|') === sorted(mark.ownerIds).join('|'));
    const symbol = layout.detachedSymbols.find(s => s.tick === mark.tick && sorted([s.noteId, ...(s.partnerId ? [s.partnerId] : [])]).join('|') === sorted(mark.ownerIds).join('|'));
    const clasp = layout.clasps.find(c => c.tick === mark.tick && c.durationInk.some(ink => ink.centerY === mark.y));
    const ink = carrier ? exceptionCarrierInkBox(carrier, t) : symbol ? detachedSymbolInkBox(symbol, t) : clasp ? claspInkBox(clasp, t) : undefined;
    const obstacles = layout.notes.filter(n => !mark.ownerIds.includes(n.note.id))
      .map(n => {
        const half = knockoutHalfExtents(o, t, n.note.startTick, n);
        const box = { x0: n.x - half.wx, x1: n.x + half.wx, y0: n.y - half.hy, y1: n.y + half.hy };
        const clearance = ink ? Math.hypot(Math.max(box.x0 - ink.x1, ink.x0 - box.x1, 0),
          Math.max(box.y0 - ink.y1, ink.y0 - box.y1, 0)) : undefined;
        return { id: n.note.id, tick: n.note.startTick, knockout: box, clearance };
      }).filter(n => n.clearance !== undefined && n.clearance < 20)
      .sort((a,b) => a.clearance! - b.clearance!).slice(0,8);
    return { target: { score: score.id, measure, tick: mark.tick, family: mark.run, ownerIds: sorted(mark.ownerIds) },
      mount: mark.mount, shared: mark.shared, anchor: { tick: mark.tick, ownerIds: sorted(mark.ownerIds) },
      ink: ink ?? { x: mark.x, y: mark.y, note: 'mark centre; exact ink box unavailable' },
      inkScope: mark.mount === 'bracket' && clasp ? 'whole bracket shell, caps and duration marks (conservative union)' : 'duration mount including marks and dots',
      rule: mark.mount === 'bracket' ? 'shared bracket carried value' : mark.mount === 'carrier' ? 'horizontal exception carrier' : 'fitted detached symbol',
      obstacles, staffClearance: ink ? {
        left: ink.x0 - layout.geometry.staffLeft, right: layout.geometry.staffRight - ink.x1,
        top: ink.y0 - layout.geometry.staffTopY, bottom: layout.geometry.staffBotY - ink.y1,
      } : undefined, refusals: layout.durationSeatRefusals.filter(r => r.tick === mark.tick),
      uncertainty: 'Relevant local owners and existing ink/knockout checks only; partial ink scene does not certify scene-wide free space.' };
  });
}
export function validateDurationIntent(request: DurationIntent, score: QuantizedGridScore, options: JankoLayoutOptions, tokens: JankoTokens) {
  keys(request, ['schema','intent','score','base','variantId','options','tokens','placements','windows','reason']);
  if (request.schema !== 1 || request.intent !== 'engrave-duration' || request.score !== score.id ||
      !/^[a-z][a-z0-9-]{0,39}$/.test(request.variantId)) throw new Error('invalid duration intent, score or variant id');
  const opts = request.options ?? {}, toks = request.tokens ?? {};
  keys(opts, ['exceptionCarrier']); keys(toks, ['halfRingGap', 'detachedSymbolAir', 'horizontalMountAir']);
  if (opts.exceptionCarrier !== undefined && !['horizontal','symbol'].includes(opts.exceptionCarrier as string)) throw new Error('unsupported exception mount');
  for (const [key, value] of Object.entries(toks)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'halfRingGap' ? 2 : 3))
      throw new Error(`invalid ${key}: bounded nonnegative pt required`);
  }
  if (!Array.isArray(request.placements) && request.placements !== undefined) throw new Error('invalid placements');
  if ((request.placements?.length ?? 0) > 8) throw new Error('too many preferences');
  // A requested shared seat must keep its horizontal statement on fit refusal.
  // The rule-wide detached mode can instead split it into separate symbols;
  // until that combination has a truthful shared fallback, refuse it atomically.
  if (opts.exceptionCarrier === 'symbol' && request.placements?.length)
    throw new Error('symbol mount and targeted seat preference are unsupported together');
  const seen = new Set<string>();
  for (const placement of request.placements ?? []) {
    keys(placement, ['target','preference']); keys(placement.target, ['score','measure','tick','family','ownerIds']);
    const target = placement.target;
    if (!['above','beside'].includes(placement.preference) || target.score !== score.id || !['ring','half-ring'].includes(target.family) ||
      !Number.isSafeInteger(target.measure) || !Number.isSafeInteger(target.tick) || !Array.isArray(target.ownerIds) || target.ownerIds.length < 2 ||
      target.ownerIds.some(id => typeof id !== 'string') || JSON.stringify(sorted(target.ownerIds)) !== JSON.stringify(target.ownerIds) ||
      new Set(target.ownerIds).size !== target.ownerIds.length) throw new Error('invalid full-owner duration target');
    const key = JSON.stringify(target);
    if (seen.has(key)) throw new Error('duplicate duration target');
    seen.add(key);
    const matches = inspectDuration(score, options, tokens, target.measure, target.tick)
      .filter(m => m.target.family === target.family && JSON.stringify(m.target.ownerIds) === JSON.stringify(target.ownerIds));
    if (matches.length !== 1 || matches[0].mount !== 'carrier') throw new Error('ambiguous/changed duration owner set or unsupported seat');
  }
  const windows = request.windows ?? (request.placements?.map(p => ({ measureStart: p.target.measure, measureCount: 1 })) ?? []);
  if (!Array.isArray(windows) || !windows.length || windows.length > 4 || windows.some(w => {
    keys(w, ['measureStart','measureCount']);
    return !Number.isSafeInteger(w.measureStart) || !Number.isSafeInteger(w.measureCount) || w.measureStart < 1 || w.measureCount < 1 || w.measureCount > 8 ||
      w.measureStart + w.measureCount - 1 > Math.ceil(score.totalTicks / resolveJankoTokens(tokens).ticksPerMeasure);
  })) throw new Error('invalid duration comparison windows');
  return { options: opts as DurationVariant['options'], tokens: toks as DurationVariant['tokens'], placements: request.placements ?? [], windows };
}
export function evaluateDurationVariant(score: QuantizedGridScore, baseOptions: JankoLayoutOptions, baseTokens: JankoTokens,
  controls: ReturnType<typeof validateDurationIntent>) {
  const options = resolveJankoOptions({ ...baseOptions, ...controls.options,
    durationSeatPreferences: controls.placements.map(p => ({ tick: p.target.tick, ownerIds: p.target.ownerIds, family: p.target.family, seat: p.preference })) });
  const tokens = resolveJankoTokens({ ...baseTokens, ...controls.tokens });
  const baseline = lintJankoScore(score, baseOptions, baseTokens), report = lintJankoScore(score, options, tokens);
  const signature = (v: typeof report.violations[number]) => `${v.code}:${v.message}`;
  const original = new Set(baseline.violations.map(signature));
  const newViolations = report.violations.map(signature).filter(s => !original.has(s));
  if (newViolations.length) throw new Error(`new candidate engraving violations: ${newViolations.slice(0,3).join('; ')}`);
  const refusals = layoutJankoScore(score, options, tokens).flatMap(l => l.durationSeatRefusals);
  return { lint: { violations: report.violations.length, warnings: report.warnings.length, newViolations }, refusals };
}
