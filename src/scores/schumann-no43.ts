import { normalizePedalEvents } from '../model/expressions';
/** Read-only, deliberately bounded LilyPond music visitor for approved Nos. 43/14/30/13.
 * No Scheme evaluation or LilyPond process is involved. Unsupported musical syntax fails closed.
 * Derived encodings retain the source's Free Art License / Copyleft attribution to Philippe Hardy.
 */
import { createHash } from 'node:crypto';
import { fromLinearIndex } from '../model/pitch';
import type { QuantizedGridScore, QuantizedNote, VoiceSilence, WrittenTieChain, GraceGroup, DynamicOverlay, PedalOverlay, PhraseOverlay, ExpressionProvenance } from '../model/types';

export interface WrittenMark { eventId: string; mark: 'outgoing-tie' | 'incoming-repeat-tie' | 'laissez-vibrer'; line: number; column: number; voice: string }
export interface OccurrenceTie { fromId: string; toId: string; pitch: number; fromOccurrence: number; toOccurrence: number; fromTick: number; toTick: number }
export interface WrittenEvent {
  id: string; kind: 'note' | 'rest' | 'spacer' | 'layout-note'; onset: string; duration: string;
  pitches: { spelling: string; absolutePitch: number }[]; voice: string; staff: string; printedStaff?: string;
  handPolicy: 'provisional-upper' | 'provisional-lower'; bar: number; hidden: boolean;
  line: number; column: number;
  stemDirection?: 'up' | 'down' | 'neutral';
  smallRoute?: boolean;
  sourceBeam?: { group?: string; noBeam?: boolean };
  /** An admitted branch of a positively identified optional route. */
  alternative?: { group: string; route: 'principal' | 'optional'; evidence: string };
}
export interface ExpressionSpacer {
  id: string; channel: string; onset: string; duration: string; bar: number; line: number; column: number;
}
export interface DeferredFact {
  file: string; line: number; column: number; endLine: number; endColumn: number;
  construct: string; reason: string; effect: string; blocking: boolean; voice: string;
}
export interface WrittenExpression {
  hostId: string; token: string; context: string; line: number; column: number; order: number;
  text?: string;
}
export interface WrittenPhrase { fromId: string; toId: string; kind: 'slur' | 'phrasing';
  start: WrittenExpression; end: WrittenExpression;
  sourceSide?: 'above' | 'below'; sourceSideOrigin?: WrittenExpression }
interface Token { text: string; line: number; column: number; offset: number; endOffset: number }
interface OpenPhrase { start: WrittenExpression; token: Token;
  sourceSide?: 'above' | 'below'; sourceSideOrigin?: WrittenExpression; deferred?: string }
interface Part { events: WrittenEvent[]; graces: GraceGroup[]; bars: { number: number; duration: string }[];
  repeats: { start: number; end: number; alternatives: number[][] }[]; openPhrases?: Map<string, OpenPhrase>; anchor?: number; anchorD?: number; previous?: Fraction; }
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
class Fraction {
  constructor(readonly n: number, readonly d = 1) {
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d) || d <= 0) throw Error('Unsafe rational');
  }
  add(b: Fraction) { return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d).norm(); }
  mul(b: Fraction) { return new Fraction(this.n * b.n, this.d * b.d).norm(); }
  norm() { const g = gcd(Math.abs(this.n), this.d); return new Fraction(this.n / g, this.d / g); }
  toString() { const x = this.norm(); return x.d === 1 ? String(x.n) : `${x.n}/${x.d}`; }
  static parse(s: string) { const [a, b = 1] = s.split('/').map(Number); return new Fraction(a, b).norm(); }
}
const Z = new Fraction(0);
function tokenize(source: string): Token[] {
  const out: Token[] = []; let i = 0, line = 1, column = 1;
  const step = () => { if (source[i++] === '\n') { line++; column = 1; } else column++; };
  const balanced = (open: string, close: string) => {
    let depth = 0;
    do { if (source[i] === open) depth++; else if (source[i] === close) depth--; step(); }
    while (i < source.length && depth > 0);
    if (depth) throw Error(`Unclosed ${open} at ${line}:${column}`);
  };
  while (i < source.length) {
    if (/\s/.test(source[i])) { step(); continue; }
    if (source[i] === '%') { while (i < source.length && source[i] !== '\n') step(); continue; }
    const start = i, l = line, c = column;
    if (source[i] === '"' || source.startsWith('#"', i)) {
      if (source[i] === '#') step();
      step(); while (i < source.length && source[i] !== '"') { if (source[i] === '\\') step(); step(); }
      if (i >= source.length) throw Error(`Unclosed string at ${l}:${c}`); step();
    }
    else if (source.startsWith('#\'(', i)) { step(); step(); balanced('(', ')'); }
    else if (source.startsWith('#(', i)) { step(); balanced('(', ')'); }
    else if (source.startsWith('#{', i)) { step(); balanced('{', '}'); }
    else if (source.startsWith('<<', i) || source.startsWith('>>', i)) { step(); step(); }
    else if ('{}<>|~()[]^_='.includes(source[i])) step();
    else if (source[i] === '\\') { step(); while (i < source.length && /[A-Za-z]/.test(source[i])) step(); if (i === start + 1) step(); }
    else { while (i < source.length && !/\s/.test(source[i]) && !'{}<>|~()[]^_=\\"%'.includes(source[i]) && !source.startsWith('#(', i)) step(); }
    out.push({ text: source.slice(start, i), line: l, column: c, offset: start, endOffset: i });
  }
  return out;
}
const pitchRe = /^([a-g])(isis!?|eses!?|is!?|es!?|s!?|f!?|!|\?)?([,']*!?]*)(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/;
const restRe = /^([rsR])(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/;
const letters: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const diatonic: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
const modifiers: Record<string, number> = { is: 1, 'is!': 1, isis: 2, 'isis!': 2, es: -1, 'es!': -1, eses: -2, 'eses!': -2, s: -1, 's!': -1, f: -1, 'f!': -1, '!': 0, '?': 0 };
function dur(digit: string | undefined, dots: string | undefined, mult: string | undefined, div: string | undefined, previous: Fraction): Fraction {
  let value = digit ? new Fraction(1, Number(digit)) : previous;
  if (dots) { let v = value; for (let j = 0; j < dots.length; j++) { v = v.mul(new Fraction(1, 2)); value = value.add(v); } }
  return mult ? value.mul(new Fraction(Number(mult), Number(div ?? '1'))) : value;
}
function exactTicks(value: string, quarter: number): number {
  const f = Fraction.parse(value);
  const numerator = BigInt(f.n) * BigInt(quarter) * 4n, denominator = BigInt(f.d);
  if (numerator % denominator !== 0n || numerator / denominator > BigInt(Number.MAX_SAFE_INTEGER) ||
      numerator / denominator < BigInt(Number.MIN_SAFE_INTEGER))
    throw Error(`Non-integral or unsafe tick for ${value} at ${quarter} ticks/quarter`);
  return Number(numerator / denominator);
}

export interface SchumannImportIdentity { file: string; hash: string; number: 43 | 14 | 30 | 13 }
const NO43: SchumannImportIdentity = { file: '43-Chant-du-Nouvel-An.ly', hash: '150e13d9723743fea780168fd9776525a856a99506522072185b619d3815797f', number: 43 };
const NO14: SchumannImportIdentity = { file: '14-Petite-etude.ly', hash: '42aa471662af4d919f696b03e6b7b5b634a8e1f1310303aa6a92075c9b511533', number: 14 };
const NO30: SchumannImportIdentity = { file: '30-sans-titre.ly', hash: '2dbde2fc08b9204df98a6b2f93a4c67a87b9fe8ca74bcab39a6cec0e42b518d0', number: 30 };
const NO13: SchumannImportIdentity = { file: '13-Mai-cher-Mai.ly', hash: 'c9345d758fb6bb2bd88425d810e1578e4db497e7393f23bbda6504644fc3e15e', number: 13 };
export function importSchumannNo13(source: string) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== NO13.hash) throw Error(`Unapproved Schumann No. 13 source hash ${hash}; expected ${NO13.hash}`);
  return importSchumann(source, NO13);
}
export function importSchumannNo30(source: string) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== NO30.hash) throw Error(`Unapproved Schumann No. 30 source hash ${hash}; expected ${NO30.hash}`);
  return importSchumann(source, NO30);
}
export function importSchumannNo43(source: string, file = NO43.file) { return importSchumann(source, { ...NO43, file }); }
export function importSchumannNo14(source: string) {
  const hash = createHash('sha256').update(source).digest('hex');
  if (hash !== NO14.hash) throw Error(`Unapproved Schumann No. 14 source hash ${hash}; expected ${NO14.hash}`);
  return importSchumann(source, NO14);
}
/** Test seam for bounded literal fixtures; production No. 14 is hash guarded. */
export function importSchumann(source: string, identity: SchumannImportIdentity, choice: 'principal' | 'optional' = 'principal'):
  { facts: { sourceHash: string; sourceFile: string; pickup: string; events: WrittenEvent[];
    ties: { fromId: string; toId: string; fromPitch: number; toPitch: number }[];
    writtenMarks?: WrittenMark[]; occurrenceTies?: OccurrenceTie[]; graceGroups?: GraceGroup[];
    bars: { number: number; duration: string }[]; expressionSpacers?: ExpressionSpacer[];
    expressions: WrittenExpression[]; phrases: WrittenPhrase[];
    repeats: Part['repeats']; occurrences: { sourceBar: number; pass: number; onset: string }[];
    handPolicy: string; alternativeGroups?: { id: string; bar: number; principal: string[]; optional: string[]; evidence: string }[]; provenance: { author: string; maintainer: string; sourceHeader: string; licenseNotice: string;
      approval: string } }; score: QuantizedGridScore; ledger: DeferredFact[] } {
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const { file } = identity;
  const approvedSource = identity.number === 43 && sourceHash === NO43.hash;
  const no30 = identity.number === 30;
  const no13 = identity.number === 13;
  const no14 = identity.number === 14 || no30 || no13;
  const approvedNo30 = no30 && sourceHash === NO30.hash;

  const t = tokenize(source); let i = 0;
  const ledger: DeferredFact[] = [];
  const error = (tk: Token, voice: string, why = 'Unhandled musical construct'): never => { throw Error(`${file}:${tk.line}:${tk.column} [${voice}] ${why}: ${tk.text}`); };
  const pop = () => { const tk = t[i++]; if (!tk) throw Error(`${file}: unexpected end of input`); return tk; };
  const expect = (text: string, voice: string) => { const tk = pop(); if (tk.text !== text) error(tk, voice, `Expected ${text}`); };
  const skipGroup = (voice: string): Token => {
    const op = pop(); if (op.text !== '{' && op.text !== '<<') error(op, voice);
    const close = op.text === '{' ? '}' : '>>';
    while (i < t.length && t[i].text !== close) {
      if (t[i].text === '{' || t[i].text === '<<') skipGroup(voice); else pop();
    }
    const end = pop(); if (end.text !== close) error(end, voice, `Expected ${close}`);
    return end;
  }; 
  const deferSpan = (first: Token, last: Token, voice: string, effect: string) => ledger.push({
    file, line: first.line, column: first.column, endLine: last.line,
    endColumn: last.column + last.text.length,
    construct: source.slice(first.offset, last.endOffset),
    reason: 'Source expression/layout not represented by the current engraving model', effect, blocking: false, voice,
  });
  const defer = (tk: Token, voice: string, effect = 'Not painted in draft') => deferSpan(tk, tk, voice, effect);
  // This front-end scopes the music tree to the score; input headers and Scheme definitions are inert.
  const scoreAt = t.findIndex(x => x.text === '\\score');
  if (scoreAt < 0) throw Error(`${file}: no score music tree`);
  i = scoreAt + 1; expect('{', 'score');
  const parts: Part[] = []; const expressionSpacers: ExpressionSpacer[] = [];
  const dynamicGraces: GraceGroup[] = [];
  const expressions: WrittenExpression[] = [], phrases: WrittenPhrase[] = [];
  const expressionTokens = new Set(['\\ppp','\\pp','\\p','\\mp','\\mf','\\f','\\ff','\\fff','\\sf','\\sfz','\\fp','\\parenpiano','\\<','\\>','\\!','\\cresc','\\sustainOn','\\sustainOff']);
  const expression = (tk: Token, context: string, hostId: string | undefined, text?: string) => {
    if (!hostId) error(tk, context, 'Expression has no preceding music atom');
    const fact: WrittenExpression = { hostId: hostId!, token: tk.text, context, line: tk.line, column: tk.column, order: expressions.length, ...(text ? { text } : {}) };
    expressions.push(fact); return fact;
  };
  const writtenMarksAll: WrittenMark[] = [];
  let pickup = ''; let meter = '1';
  function music(staff: string, voice: string, relative: number, relativeD = 0, inheritedDuration = new Fraction(1, 4), destination = staff, allowOpenPhrase = false): Part {
    let time = Z, previous = inheritedDuration, anchor = relative, anchorD = relativeD;
    let bar = 0, barStart = Z, hidden = false, printedStaff = destination;
    let stemDirection: WrittenEvent['stemDirection']; let smallRoute = false;
    let once: Token | undefined;
    let sourceBeam: string | undefined;
    let lastEvent: WrittenEvent | undefined;
    const openPhrases = new Map<string, OpenPhrase>();
    let doubleSlurs = false;
    let slurLayout: { reason: string; once: boolean } | undefined;
    const phraseMark = (tk: Token, direction?: Token, grace?: GraceGroup) => {
      const kind = tk.text.startsWith('\\') ? 'phrasing' : 'slur';
      const unsupported = kind === 'slur' && (grace ? 'Grace slur endpoint deferred' :
        lastEvent?.kind === 'layout-note' ? 'Layout-only slur endpoint deferred' : undefined);
      if (!unsupported && (!lastEvent || lastEvent.kind !== 'note')) error(tk, voice, 'Phrase endpoint has no note');
      const fact: WrittenExpression = { hostId: grace?.id ?? lastEvent!.id, token: tk.text, context: voice, line: tk.line, column: tk.column, order: expressions.length };
      if (tk.text.endsWith('(')) {
        if (openPhrases.has(kind)) error(tk, voice, 'Nested phrase of same kind');
        const deferred = unsupported ?? (kind === 'slur' ? doubleSlurs ? 'Double-slur source layout deferred' : slurLayout?.reason : undefined);
        openPhrases.set(kind, { start: fact, token: direction ?? tk,
          ...(direction ? { sourceSide: direction.text === '^' ? 'above' : 'below',
            sourceSideOrigin: { ...fact, token: direction.text, line: direction.line, column: direction.column } } : {}),
          ...(deferred ? { deferred } : {}) });
        if (kind === 'slur' && slurLayout?.once) slurLayout = undefined;
      } else {
        const open = openPhrases.get(kind);
        if (!open && unsupported) { defer(direction ?? tk, voice, unsupported); return; }
        if (!open) error(tk, voice, 'Unopened phrase');
        const reason = open!.deferred ?? unsupported ?? (kind === 'slur' && open!.start.context !== voice ? 'Ordinary slur crosses a simultaneous voice boundary; deferred' : undefined);
        if (reason) deferSpan(open!.token, tk, open!.start.context, reason);
        else phrases.push({ fromId: open!.start.hostId, toId: fact.hostId, kind, start: open!.start, end: fact,
          ...(open!.sourceSide ? { sourceSide: open!.sourceSide, sourceSideOrigin: open!.sourceSideOrigin } : {}) });
        openPhrases.delete(kind);
      }
    };
    const localMarks: WrittenMark[] = [];
    const events: WrittenEvent[] = [], graces: GraceGroup[] = [], bars: Part['bars'] = [], repeats: Part['repeats'] = [];
    let pendingGrace: GraceGroup | undefined;
    const pitch = (token: Token, prior: { n: number; d: number }) => {
      const m = pitchRe.exec(token.text); if (!m) error(token, voice, 'Invalid pitch');
      const [, name, accidental = '', marks = ''] = m!;
      let d = diatonic[name] + Math.round((prior.d - diatonic[name]) / 7) * 7;
      // LilyPond chooses the closest diatonic pitch, with the lower pitch at a tritone.
      if (d - prior.d > 3) d -= 7;
      if (d - prior.d < -3) d += 7;
      d += (marks.match(/'/g) ?? []).length * 7 - (marks.match(/,/g) ?? []).length * 7;
      const octave = 3 + Math.floor(d / 7);
      return { spelling: `${name}${accidental}${marks}`, absolutePitch: octave * 12 + letters[name] + (modifiers[accidental] ?? 0), d };
    };
    const sequence = (ending = false): void => {
      expect('{', voice);
      while (i < t.length && t[i].text !== '}') {
        const tk = pop(), x = tk.text;
        if (x === '|') { if (pendingGrace) error(tk, voice, 'Grace has no host before barline'); const length = time.add(new Fraction(-barStart.n, barStart.d));
          if (no14 && !no13 && length.n * Fraction.parse(meter).d > Fraction.parse(meter).n * length.d)
            error(tk, voice, `Written bar overrun ${length} at ${time} bar ${bar}`);
          if (length.n === 0) { // A barline after a multiplied whole-bar spacer does not create a new bar.
            if (bars.length === 0) error(tk, voice, 'Empty written bar');
            continue;
          }
          bars.push({ number: bar, duration: length.toString() }); barStart = time; bar++; continue; }
        if (x === '\\repeat') {
          if (pendingGrace) error(tk, voice, 'Ambiguous grace host across repeat');
          expect('volta', voice); const times = pop(); if (times.text !== '2') error(times, voice, 'Only two-pass volta supported');
          const start = bar; sequence(no13); const end = bar - 1;
          const alternatives: number[][] = [];
          if (t[i]?.text === '\\alternative') {
            pop(); expect('{', voice);
            while (t[i]?.text === '{') { const a = bar; sequence(no30); alternatives.push(Array.from({ length: bar - a }, (_, k) => a + k)); }
            expect('}', voice);
            if (alternatives.length !== 2) error(tk, voice, 'Volta requires two endings');
          }
          repeats.push({ start, end, alternatives }); continue;
        }
        if (x === '<<') {
          if (pendingGrace) error(tk, voice, 'Ambiguous grace host across simultaneous voices');
          // Independent simultaneous voices share the same bar clock, not sequential time.
          const base = time, baseBar = bar, baseBarStart = barStart;
          const branchParts: Part[] = [];
          let branch = 0;
          while (t[i]?.text !== '>>') {
            let name = `${voice}.${branch++}`;
            if (t[i]?.text === '\\context') { pop(); expect('Voice', voice); expect('=', voice); name = `${voice}.${pop().text}`; }
            const child = music(staff, name, anchor, anchorD, previous, printedStaff, true);
            for (const [kind, start] of child.openPhrases ?? []) {
              if (openPhrases.has(kind)) error(tk, voice, 'Ambiguous simultaneous phrase');
              openPhrases.set(kind, start);
            }
            branchParts.push(child);
            // Relative pitch follows textual children; their clocks remain parallel.
            anchor = child.anchor!; anchorD = child.anchorD!;
            if (t[i]?.text === '\\\\') pop();
            else if (t[i]?.text !== '>>' && t[i]?.text !== '\\context') error(t[i], voice, 'Expected simultaneous voice separator');
          }
          expect('>>', voice);
          // Branches were independently measured from zero; align them to parent position.
          for (const child of branchParts) {
            for (const e of child.events) {
              const local = Fraction.parse(e.onset);
              e.onset = local.add(base).toString();
              const boundaries = branchParts[0].bars.slice(0, -1).map((_, k) =>
                branchParts[0].bars.slice(0, k + 1).reduce((v, b) => v.add(Fraction.parse(b.duration)), Z));
              e.bar = no13 ? baseBar + boundaries.filter(boundary => local.n * boundary.d >= boundary.n * local.d).length : e.bar + baseBar;
              events.push(e);
            }
            for (const g of child.graces) { g.source.bar += baseBar; graces.push(g); }
          }
          for (const r of branchParts[0]?.repeats ?? []) repeats.push({ start: r.start + baseBar, end: r.end + baseBar,
            alternatives: r.alternatives.map(a => a.map(b => b + baseBar)) });
          const lengths = branchParts.map(p => p.bars.reduce((sum, b) => sum.add(Fraction.parse(b.duration)), Z));
          if (!lengths.length || lengths.some(l => l.toString() !== lengths[0].toString()) ||
              (!no13 && branchParts.slice(1).some(p => p.bars.length !== branchParts[0].bars.length ||
                p.bars.some((b, j) => b.duration !== branchParts[0].bars[j].duration))))
            error(tk, voice, `Simultaneous voices disagree on bar accounting ${JSON.stringify(branchParts.map(p => p.bars))}`);
          if (!no14 || no30) {
            for (const childBar of branchParts[0].bars) bars.push({ number: childBar.number + baseBar, duration: childBar.duration });
            time = base.add(lengths[0]); bar = baseBar + branchParts[0].bars.length; barStart = time;
          } else {
            if (!no13 && branchParts[0].bars.length > 1) error(tk, voice, 'Unsupported simultaneous bar structure');
            time = base;
            previous = branchParts[0].previous!;
            for (const childBar of branchParts[0].bars) {
              time = time.add(Fraction.parse(childBar.duration));
              const elapsed = time.add(new Fraction(-barStart.n, barStart.d));
              if (elapsed.toString() === Fraction.parse(meter).toString()) { bars.push({ number: bar++, duration: Fraction.parse(meter).toString() }); barStart = time; }
              else if (elapsed.n * Fraction.parse(meter).d > Fraction.parse(meter).n * elapsed.d)
                error(tk, voice, 'Simultaneous voices overrun bar');
            }
          }
          continue;
        }
        if (x === '\\change' && no14) { expect('Staff', voice); expect('=', voice); const target = pop();
          if (!['"upper"','"lower"', ...(no30 ? ['"Staff_pfUpper"', '"Staff_pfLower"'] : [])].includes(target.text)) error(target, voice, 'Unknown staff destination');
          printedStaff = target.text.includes('Upper') ? 'upper' : target.text.includes('Lower') ? 'lower' : target.text.slice(1, -1); deferSpan(tk, target, voice, `Printed destination changes to ${printedStaff}; logical part and provisional hand unchanged`); continue; }
        if (x === '\\time') { const m = pop(); if (!/^\d+\/\d+$/.test(m.text)) error(m, voice); meter = m.text; continue; }
        if (x === '\\partial') { const m = pop(); const mm = /^(\d+)(\.*)$/.exec(m.text); if (!mm) error(m, voice); pickup = dur(mm![1], mm![2], undefined, undefined, previous).toString(); continue; }
        if (x === '\\relative') { const outerAnchor = anchor, outerD = anchorD; const ref = pop(); const match = pitchRe.exec(ref.text); if (!match) error(ref, voice); const marks = match![3];
          anchorD = diatonic[match![1]] + ((marks.match(/'/g) ?? []).length - (marks.match(/,/g) ?? []).length) * 7;
          anchor = (3 + Math.floor(anchorD / 7)) * 12 + letters[match![1]]; sequence();
          anchor = outerAnchor; anchorD = outerD; continue; }
        if (no13 && (x === '\\grace' || x === '\\appoggiatura')) {
          if (pendingGrace) error(tk, voice, 'Grace without unique following host');
          const group: GraceGroup = { id: `${file}:${tk.line}:${tk.column}:${voice}`, source: { file, line: tk.line, column: tk.column, endLine: tk.line, endColumn: tk.column + tk.text.length, bar },
            voice, staff, printedStaff, hand: staff === 'upper' ? 'RH' : 'LH', kind: x === '\\grace' ? 'grace' : 'appoggiatura',
            members: [], hostEventId: '', hostKind: 'note', occurrences: [] };
          const braced = t[i]?.text === '{'; if (braced) pop();
          let open = false;
          do {
            if (no13 && t[i]?.text === '\\once') {
              const first = pop(); expect('\\override', voice); const property = pop();
              if (property.text !== 'Slur') error(property, voice, 'Only source Slur stencil layout in appoggiatura');
              const field = pop(); if (field.text !== "#'stencil") error(field, voice);
              expect('=', voice); const value = pop(); if (value.text !== '##f') error(value, voice);
              deferSpan(first, value, voice, 'Synchronization slur stencil deferred');
            }
            const p = pop();
            const rest = restRe.exec(p.text), match = pitchRe.exec(p.text);
            if (!rest && !match) error(p, voice, 'Unsupported grace member');
            if (rest && rest[1] !== 's') error(p, voice, 'Grace rest is not a synchronization spacer');
            const item = match ? pitch(p, { n: anchor, d: anchorD }) : undefined;
            const value = rest ? dur(rest[2], rest[3], rest[4], rest[5], previous) : dur(match![4], match![5], match![6], match![7], previous);
            if (match?.[4] || rest?.[2]) previous = dur(match?.[4] ?? rest![2], match?.[5] ?? rest![3], undefined, undefined, previous);
            if (item) { anchor = item.absolutePitch; anchorD = item.d; }
            const member = { id: `${group.id}:${group.members.length}`, ...(item ? { spelling: item.spelling, pitch: fromLinearIndex(item.absolutePitch) } : {}),
              duration: value.toString(), beamStart: false, beamEnd: false, line: p.line, column: p.column,
              endLine: p.line, endColumn: p.column + p.text.length };
            group.members.push(member);
            while (['^', '_', '(', ')', '[', ']'].includes(t[i]?.text ?? '')) {
              const attachment = pop();
              if (attachment.text === '[') { if (open) error(attachment, voice, 'Nested grace beam'); open = true; member.beamStart = true; }
              else if (attachment.text === ']') { if (!open) error(attachment, voice, 'Unopened grace beam'); open = false; member.beamEnd = true; }
              else if (attachment.text === '^' || attachment.text === '_') {
                if (['(', ')'].includes(t[i]?.text ?? '')) phraseMark(pop(), attachment, group);
                else if (/^\d+$/.test(t[i]?.text ?? '')) deferSpan(attachment, pop(), voice, 'Grace fingering or phrasing deferred');
                else error(t[i] ?? attachment, voice, 'Unsupported grace attachment');
              } else phraseMark(attachment, undefined, group);
            }
            member.endLine = t[i - 1].line; member.endColumn = t[i - 1].column + t[i - 1].text.length;
          } while (braced && t[i]?.text !== '}');
          if (braced) expect('}', voice);
          group.source.endLine = t[i - 1].line; group.source.endColumn = t[i - 1].column + t[i - 1].text.length;
          if (open || !group.members.length || group.members.some(m => !!m.pitch !== !!group.members[0].pitch))
            error(tk, voice, 'Incomplete or mixed grace beam/contents');
          if (x === '\\appoggiatura' && group.members.some(m => m.pitch)) error(tk, voice, 'Pitched appoggiatura not supported');
          pendingGrace = group; graces.push(group); continue;
        }
        if (x === '\\hideNotes') { hidden = true; defer(tk, voice, 'Following written notes remain sounding but are not hidden by this draft'); continue; }
        if (x === '\\unHideNotes') { hidden = false; defer(tk, voice, 'End of hidden source layout span'); continue; }
        if ((no30 || no13) && (x === '~' || x === '\\repeatTie' || x === '\\laissezVibrer')) {
          if (!lastEvent || lastEvent.kind !== 'note') error(tk, voice, 'Mark has no preceding note');
          localMarks.push({ eventId: lastEvent!.id, mark: x === '~' ? 'outgoing-tie' : x === '\\repeatTie' ? 'incoming-repeat-tie' : 'laissez-vibrer', line: tk.line, column: tk.column, voice });
          if (x !== '~') defer(tk, voice, 'Source tie or laissez-vibrer glyph deferred; written mark retained');
          continue;
        }
        if (x === '~') continue;
        if (expressionTokens.has(x)) { expression(tk, voice, lastEvent?.id); continue; }
        if (['\\(','\\)'].includes(x)) { phraseMark(tk); continue; }
        if (x === '^' || x === '_') {
          const next = t[i]?.text ?? '';
          if (next === '~') pop();
          else if (next === '\\markup') { const mk = pop(); defer(mk, voice); if (t[i]?.text === '\\override') { pop(); pop(); }
            if (t[i]?.text === '{') {
              const end = skipGroup(voice); const fact = ledger[ledger.length - 1];
              fact.construct = source.slice(mk.offset, end.endOffset); fact.endLine = end.line; fact.endColumn = end.column + end.text.length;
            } else error(t[i], voice, 'Unbounded markup'); }
          else if (expressionTokens.has(next)) { expression(pop(), voice, lastEvent?.id); }
          else if (['\\(','\\)','(',')'].includes(next)) { phraseMark(pop(), tk); }
          else if (next.startsWith('\\')) { defer(pop(), voice); }
          else if (/^\d+$/.test(next)) { defer(pop(), voice, 'Fingering deferred'); }
          else if (next === '[' || next === ']') { /* boundary is parsed on the next iteration */ }
          else if (no13 && ['.', '>'].includes(next)) defer(pop(), voice, 'Articulation deferred');
          else error(t[i], voice, 'Unhandled note attachment');
          continue;
        }
        if (x === '\\noBeam') { if (!lastEvent) error(tk,voice,'Beam interruption has no atom'); lastEvent!.sourceBeam={noBeam:true}; continue; }
        if (x === '[' || x === ']') {
          if (!lastEvent || lastEvent.kind !== 'note') error(tk,voice,'Beam boundary has no note');
          if (x === '[') { if(sourceBeam)error(tk,voice,'Nested source beam'); sourceBeam=`${file}:${tk.line}:${tk.column}:${voice}`; }
          if (!sourceBeam) error(tk,voice,'Unopened source beam');
          lastEvent!.sourceBeam={group:sourceBeam};
          if(x===']')sourceBeam=undefined;
          continue;
        }
        if ('()'.includes(x) && x.length === 1) { phraseMark(tk); continue; }
        if (x === '\\once') { if (t[i]?.text !== '\\override') error(tk, voice, 'Only once override is classified as layout'); once = tk; continue; }
        if (no13 && x === '\\unset') { const property = pop(); if (property.text !== 'doubleSlurs') error(property, voice); doubleSlurs = false; deferSpan(tk, property, voice, 'Slur layout reset deferred'); continue; }
        if (x === '\\override' || x === '\\set') {
          // Scoped property assignment: stop before the following music atom. No Scheme is evaluated.
          const property = pop();
          if (!/^(?:Score\.(?:Fingering|MetronomeMark|VoltaBracketSpanner|fingeringOrientations)|Staff\.(?:fingeringOrientations|Rest|Fingering)|Voice\.(?:Arpeggio|Rest|TieColumn)|NoteColumn|TextScript|Tie|Slur|LaissezVibrerTie|DynamicText)$/.test(property.text) &&
              !(no14 && /^(?:Staff\.NoteCollision|PhrasingSlur|fontSize|Rest|Fingering)$/.test(property.text)) &&
              !(no13 && /^(?:PianoStaff\.connectArpeggios|doubleSlurs|Voice\.Rest)$/.test(property.text)))
            error(property, voice, 'Unclassified property may affect music');
          const field = t[i]?.text.startsWith("#'") ? pop() : undefined;
          expect('=', voice); const value = pop();
          if (value.text === '#') { if (t[i]) pop(); }
          else if (!value.text.startsWith('#') && !/^"/.test(value.text)) error(value, voice, 'Unsafe property value');
          if (property.text === 'fontSize' && value.text === '#-5') smallRoute = true;
          if (property.text === 'doubleSlurs') doubleSlurs = value.text === '##t';
          if (property.text === 'Slur') slurLayout = {
            reason: field?.text === "#'stencil" && value.text === '##f' ? 'Hidden source slur stencil; no visible musical curve' : 'Unsupported source Slur layout; curve deferred',
            once: !!once };
          if (no14) deferSpan(once ?? tk, value, voice, 'Layout property retained for source-context interpretation');
          else defer(tk, voice, 'Layout property ignored; adjacent musical events remain');
          once = undefined;
          continue;
        }
        if (x === '\\extendLV') { const arg = pop(); if (!/^#\d+(?:\.\d+)?$/.test(arg.text)) error(arg, voice); defer(tk, voice, 'Laissez-vibrer layout extension not painted'); continue; }
        if (x === '\\bar') { const style = pop(); if (no30) deferSpan(tk, style, voice, 'Terminal barline styling deferred'); continue; }
        if (x === '\\clef' || x === '\\key' || x === '\\tempo') {
          let last: Token;
          if (x === '\\clef') last = pop(); else if (x === '\\key') { pop(); last = pop(); if (last.text !== '\\major') error(last, voice); }
          else { last = pop(); if (no13 && /^\d+$/.test(last.text) && t[i]?.text === '=') { pop(); last = pop(); if (!/^\d+$/.test(last.text)) error(last, voice, 'Invalid tempo'); } }
          if (no30) deferSpan(tk, last, voice, x === '\\key' ? 'Source key signature deferred; absolute pitches retained' : 'Source clef or tempo presentation deferred');
          else defer(tk, voice); continue;
        }
        if (x === '\\stemDown' || x === '\\stemUp' || x === '\\stemNeutral') {
          stemDirection = x === '\\stemDown' ? 'down' : x === '\\stemUp' ? 'up' : 'neutral';
          defer(tk, voice, 'Stem direction retained as contextual gesture evidence'); continue;
        }
        if (['\\voiceOne','\\voiceTwo','\\oneVoice','\\noBeam',
          '\\mergeDifferentlyDottedOn','\\arpeggio','\\arpeggioBracket','\\break','\\pageBreak', ...(no13 ? ['\\stemNeutral','\\tieDown'] : [])].includes(x) || (no14 && x === '\\phrasingSlurUp') || (no30 && ['\\arpeggioNormal','\\shiftOnnn','\\showStaffSwitch','\\hideStaffSwitch','\\noPageBreak'].includes(x))) { defer(tk, voice); continue; }
        if (x === '\\new') error(tk, voice, 'Nested new context not supported in voice');
        if (x.startsWith('\\')) {
          if (['\\fermata','\\laissezVibrer','\\mf','\\fp','\\cresc','\\!','\\<','\\>','\\(','\\)'].includes(x) || (no30 && ['\\repeatTie','\\espressivo','\\turn','\\p','\\pp','\\sf'].includes(x)) || (no13 && ['\\p','\\f','\\fp'].includes(x))) { defer(tk, voice); continue; }
          error(tk, voice);
        }
        let raw: { spelling: string; absolutePitch: number; d: number }[] = [];
        let kind: WrittenEvent['kind'] = 'note', length: Fraction;
        if (x === '<') {
          let prior = { n: anchor, d: anchorD };
          while (t[i]?.text !== '>') {
            const p = pop();
            const clean = { ...p, text: p.text.replace(/-\d+$/, '') };
            const segments = clean.text.match(/[a-g](?:isis!?|eses!?|is!?|es!?|s!?|f!?|!|\?)?[,']*!?/g);
            if (segments?.join('') === clean.text) {
              if (clean.text !== p.text) defer(p, voice, 'Fingering not painted');
              for (const segment of segments) {
                const marked = /[,']/.test(segment);
                const item = pitch({ ...clean, text: segment }, marked && raw.length ? { n: raw[0].absolutePitch, d: raw[0].d } : prior);
                raw.push(item); prior = { n: item.absolutePitch, d: item.d };
              }
            }
            else if (p.text === '^' || p.text === '_') {
              const n = pop(); if (!/^\d+$/.test(n.text) || !raw.length) error(n, voice, 'Unhandled chord member attachment');
              deferSpan(p, n, voice, `Fingering ${n.text} on chord member ${raw.at(-1)!.spelling} not painted`);
            }
            else error(p, voice, 'Unhandled chord member');
          }
          expect('>', voice); if (!raw.length) error(tk, voice, 'Empty chord');
          const spec = t[i]?.text ?? ''; const m = /^(\d+)(\.*)(?:\*(\d+)(?:\/(\d+))?)?-?$/.exec(spec);
          if (m) { const durationToken = pop(); if (durationToken.text.endsWith('-')) defer(durationToken, voice, 'Phrasing slur attachment deferred'); length = dur(m[1], m[2], m[3], m[4], previous); previous = dur(m[1], no14 ? m[2] : '', undefined, undefined, previous); }
          else length = previous;
        } else {
          const rest = restRe.exec(x), m = pitchRe.exec(x.replace(/-\d+$/, ''));
          if (!m && !rest) error(tk, voice);
          if (rest) { kind = rest[1] === 's' ? 'spacer' : 'rest'; length = dur(rest[2], rest[3], rest[4], rest[5], previous); if (rest[2]) previous = no14 ? dur(rest[2], rest[3], undefined, undefined, previous) : new Fraction(1, Number(rest[2])); }
          else { const item = pitch(tk, { n: anchor, d: anchorD }); raw = [item];
            length = dur(m![4], m![5], m![6], m![7], previous); if (m![4]) previous = no14 ? dur(m![4], m![5], undefined, undefined, previous) : new Fraction(1, Number(m![4])); }
        }
        if (raw.length) { anchor = raw[0].absolutePitch; anchorD = raw[0].d; }
        if ((kind === 'spacer' || kind === 'rest') && /\*\d+/.test(x) && time.toString() === barStart.toString() &&
            Number.isInteger(length.n * Fraction.parse(meter).d / (length.d * Fraction.parse(meter).n)) &&
            length.n * Fraction.parse(meter).d / (length.d * Fraction.parse(meter).n) > 1) {
          const count = length.n * Fraction.parse(meter).d / (length.d * Fraction.parse(meter).n);
          for (let k = 0; k < count; k++) {
            events.push({ id: `${file}:${tk.line}:${tk.column}:${voice}:${k}`, kind, onset: time.toString(),
              duration: Fraction.parse(meter).toString(), pitches: [], voice, staff, ...(no14 ? { printedStaff } : {}), handPolicy: staff === 'upper' ? 'provisional-upper' : 'provisional-lower',
              bar, hidden, line: tk.line, column: tk.column, ...(stemDirection ? { stemDirection } : {}) });
            time = time.add(Fraction.parse(meter)); bars.push({ number: bar++, duration: Fraction.parse(meter).toString() }); barStart = time;
          }
          continue;
        }
        // The approved score uses two hidden duplicate heads solely to carry
        // a slur end / laissez-vibrer shape. The preceding hidden g (l.130)
        // is NOT a dummy: it is a distinct sounding note. Do not generalize
        // `hideNotes` to silence; classify these guarded source sites only.
        const phantomSite = staff === 'lower' && voice === 'lower.0' && tk.line === 313 &&
          tk.text === 'a2' && hidden && raw.length === 1 && raw[0].absolutePitch === 45 && printedStaff === 'upper' &&
          source.split('\n')[311]?.includes('hideNotes fantôme') &&
          t[i - 2]?.text === '\\hideNotes' && t[i]?.text === '\\change';
        if (no30 && hidden && raw.length && !((staff === 'upper' && voice === 'upper."1"' && tk.line === 153 && tk.text === 'aes,2' && raw.length === 1 && printedStaff === 'upper') || (approvedNo30 && phantomSite)))
          error(tk, voice, 'Unclassified hidden note');
        const layoutOnly = (approvedNo30 && phantomSite) || approvedSource && staff === 'upper' && voice === 'upper."1"' &&
          ((tk.line === 132 && tk.column === 47 && raw[0]?.absolutePitch === 45) ||
           (tk.line === 143 && tk.column === 171 && raw[0]?.absolutePitch === 52));
        if (layoutOnly) {
          kind = 'layout-note';
          defer(tk, voice, 'Hidden duplicate shape carrier is retained as a written fact; no second audible attack');
        }
        const e: WrittenEvent = { id: `${file}:${tk.line}:${tk.column}:${voice}`, kind,
          onset: time.toString(), duration: length.toString(), pitches: raw.map(({ spelling, absolutePitch }) => ({ spelling, absolutePitch })),
          voice, staff, ...(no14 ? { printedStaff } : {}), handPolicy: staff === 'upper' ? 'provisional-upper' : 'provisional-lower', bar, hidden,
          line: tk.line, column: tk.column, ...(stemDirection ? { stemDirection } : {}),
          ...(smallRoute ? { smallRoute: true } : {}) } as WrittenEvent;
        if(sourceBeam)e.sourceBeam={group:sourceBeam};
        events.push(e); lastEvent = e;
        if (pendingGrace) {
          if (pendingGrace.members[0]?.pitch && e.kind !== 'note') error(tk, voice, 'Pitched grace has no note/chord host');
          pendingGrace.hostEventId = e.id; pendingGrace.hostKind = e.kind === 'layout-note' ? 'note' : e.kind;
          pendingGrace = undefined;
        }
        time = time.add(length);
      }
      if (pendingGrace) error(t[i] ?? t[i - 1], voice, 'Grace has no following written host in the same voice');
      expect('}', voice);
      if (ending && time.toString() !== barStart.toString()) {
        bars.push({ number: bar++, duration: time.add(new Fraction(-barStart.n, barStart.d)).toString() }); barStart = time;
      }
    };
    sequence();
    if(sourceBeam)error(t[i-1],voice,'Unclosed source beam');
    if (!allowOpenPhrase) for (const [kind, open] of openPhrases) if (open.deferred) {
      defer(open.token, open.start.context, `${open.deferred}; unclosed unsupported span`); openPhrases.delete(kind);
    }
    if (openPhrases.size && !allowOpenPhrase) error(t[i - 1], voice, 'Unclosed phrase');
    writtenMarksAll.push(...localMarks);
    if (time.toString() !== barStart.toString()) bars.push({ number: bar, duration: time.add(new Fraction(-barStart.n, barStart.d)).toString() });
    return { events, graces, bars, repeats, openPhrases, anchor, anchorD, previous };
  }
  // Dynamics contexts are music (not paper/layout). No. 14 retains exact
  // expression-channel spacer clocks separately from playable-part silences.
  const dynamics = (channel: string) => {
    expect('{', 'Dynamics'); let depth = 1;
    let clock = Z, barStart = Z, bar = 0, previous = new Fraction(1, 4);
    let pending: GraceGroup | undefined;
    let lastSpacer: ExpressionSpacer | undefined;
    while (depth && i < t.length) {
      const token = pop();
      if (no13 && token.text === '\\repeat') { expect('volta', channel); expect('2', channel); continue; }
      if (token.text === '{') { depth++; continue; }
      if (token.text === '}') {
        depth--;
        if (no13 && depth === 1 && clock.toString() !== barStart.toString()) {
          const length = clock.add(new Fraction(-barStart.n, barStart.d));
          if (length.toString() !== '3/8') error(token, channel, `Unexpected repeat ending duration ${length}`);
          bar++; barStart = clock;
        }
        continue;
      }
      if (no13 && (token.text === '\\grace' || token.text === '\\appoggiatura')) {
        if (pending) error(token, channel, 'Grace without host');
        expect('{', channel); const spacer = pop(); const m = restRe.exec(spacer.text);
        if (!m || m[1] !== 's') error(spacer, channel, 'Only spacer dynamics grace supported');
        const value = dur(m![2], m![3], m![4], m![5], previous);
        if (m![2]) previous = dur(m![2], m![3], undefined, undefined, previous);
        expect('}', channel);
        pending = { id: `${file}:${token.line}:${token.column}:${channel}`, source: { file, line: token.line, column: token.column, endLine: t[i - 1].line, endColumn: t[i - 1].column + t[i - 1].text.length, bar },
          voice: channel, staff: 'Dynamics', printedStaff: 'Dynamics', hand: null, kind: token.text === '\\grace' ? 'grace' : 'appoggiatura',
          members: [{ id: `${file}:${spacer.line}:${spacer.column}:${channel}`, duration: value.toString(), beamStart: false, beamEnd: false, line: spacer.line, column: spacer.column,
            endLine: spacer.line, endColumn: spacer.column + spacer.text.length }],
          hostEventId: '', hostKind: 'spacer', occurrences: [] }; dynamicGraces.push(pending); continue;
      }
      if (expressionTokens.has(token.text)) { expression(token, channel, lastSpacer?.id); continue; }
      if (['\\break','\\pageBreak', '\\bar'].includes(token.text)) {
        defer(token, 'Dynamics', 'Dynamics-staff layout omitted'); if (token.text === '\\bar') pop(); continue;
      }
      if (token.text === '^' || token.text === '_') {
        const mark = pop(); if (mark.text !== '\\markup') error(mark, channel, 'Expected expression markup');
        const end = skipGroup(channel);
        const literal = source.slice(mark.offset, end.endOffset);
        const text = literal.match(/"([^"\n]+)"/g);
        if (text?.length !== 1 || !/^\\markup\s*\{\s*(?:\\normal-text\s*|\\whiteout\s*)?"[^"\n]+"\s*\}$/.test(literal)) error(mark,channel,'Unsupported expression markup');
        expression(mark,channel,lastSpacer?.id,text![0].slice(1,-1)); continue;
      }
      if (token.text === '\\overrideProperty') {
        const args = [pop(), pop(), pop()];
        if (args.some(a => !a.text.startsWith('#'))) error(token, 'Dynamics', 'Unclassified overrideProperty');
        defer(token, 'Dynamics'); continue;
      }
      if (token.text === '|') {
        {
          const length = clock.add(new Fraction(-barStart.n, barStart.d));
          if (length.n && !(no13 && length.toString() === '1/4') && length.toString() !== (pickup && (bar === 0 || no13 && bar === 11) ? pickup : Fraction.parse(meter).toString())) error(token, channel, 'Expression-staff bar duration mismatch');
          if (length.n) { bar++; barStart = clock; }
        }
        continue;
      }
      if (/^s(?:\d+)?(?:\.*)(?:\*\d+)?$/.test(token.text) || (no14 && /^s\d+\.*-$/.test(token.text))) {
        {
          const text = token.text.replace(/-$/, '');
          const match = restRe.exec(text)!;
          const length = dur(match[2], match[3], match[4], match[5], previous);
          if (match[2]) previous = dur(match[2], match[3], undefined, undefined, previous);
          const barLength = Fraction.parse(meter);
          const count = clock.toString() === barStart.toString() &&
            Number.isInteger(length.n * barLength.d / (length.d * barLength.n)) ? length.n * barLength.d / (length.d * barLength.n) : 1;
          for (let k = 0; k < count; k++) {
            const slice = count > 1 ? barLength : length;
            const spacer = { id: `${file}:${token.line}:${token.column}:${channel}:${k}`, channel,
              onset: clock.toString(), duration: slice.toString(), bar, line: token.line, column: token.column };
            expressionSpacers.push(spacer); lastSpacer = spacer;
            if (pending) { pending.hostEventId = spacer.id; pending = undefined; }
            clock = clock.add(slice);
            if (count > 1) { bar++; barStart = clock; }
          }
          if (token.text.endsWith('-')) {
            const mark = pop(); if (mark.text !== '\\markup') error(mark, channel);
            const end = skipGroup(channel); const literal = source.slice(mark.offset, end.endOffset);
            if (!/"diminuendo"/.test(literal)) error(mark, channel, 'Unsupported expression text');
            expression(mark, channel, lastSpacer?.id, 'diminuendo');
          }
        }
        continue;
      }
      if (no14 && ['\\sustainOn','\\sustainOff','\\p','\\parenpiano', ...(no30 || no13 ? ['\\pp','\\sf','\\noPageBreak','\\fp','\\<','\\>','\\!','\\f'] : [])].includes(token.text)) {
        defer(token, 'Dynamics', 'Source expression/pedal deferred; not painted'); continue;
      }
      // The reviewed source has a fused s8s4 spelling in the dynamics staff.
      // This context is omitted, so record that literal instead of claiming timing.
      if (token.text === 's8s4') {
        // Literal adjacent spacers: no macro expansion or execution.
        t.splice(i, 0, { ...token, text: 's8' }, { ...token, text: 's4', column: token.column + 2 }); continue;
      }
      if (token.text === '\\once') { if (no30) defer(token, 'Dynamics', 'Next expression override is scoped once; layout deferred'); continue; }
      if (token.text === '\\override') { const property = pop(); if (no14 && !['DynamicText','Hairpin','TextScript'].includes(property.text)) error(property, 'Dynamics');
        pop(); expect('=', 'Dynamics'); const value = pop();
        if (no14) deferSpan(token, value, 'Dynamics', 'Expression layout deferred'); else defer(token, 'Dynamics');
        continue; }
      error(token, 'Dynamics');
    }
    if (depth) throw Error(`${file}: unterminated Dynamics context`);
    if (approvedNo30 && (bar !== 33 || clock.toString() !== '33'))
      throw Error(`${file}: ${channel} expression-staff clock mismatch (${bar} bars, ${clock})`);
    if (sourceHash === NO14.hash && (bar !== 64 || clock.toString() !== '48'))
      throw Error(`${file}: ${channel} expression-staff clock mismatch (${bar} bars, ${clock})`);
  };
  // Traverse only positively identified score containers and inert layout trees.
  // A stray directive outside \relative is still music until classified otherwise.
  let pianoStaffOpen = false;
  while (i < t.length && t[i].text !== '}') {
    const tk = pop();
    if (tk.text === '\\new' && t[i]?.text === 'PianoStaff') {
      if (pianoStaffOpen) error(tk, 'score', 'Nested PianoStaff');
      pop(); expect('<<', 'score'); pianoStaffOpen = true;
    } else if (tk.text === '>>' && pianoStaffOpen) pianoStaffOpen = false;
    else if (tk.text === '\\set') {
      const property = pop();
      if ((no30 || no13) && property.text === 'PianoStaff.connectArpeggios') {
        expect('=', 'score'); const value = pop(); if (value.text !== '##t') error(value, 'score');
        deferSpan(tk, value, 'score', 'PianoStaff arpeggio connection presentation deferred');
      } else {
        if (property.text !== 'PianoStaff.instrumentName') error(property, 'score', 'Unclassified score property');
        expect('=', 'score'); expect('\\markup', 'score'); const end = skipGroup('score-markup');
        if (no30) deferSpan(tk, end, 'score', 'Source instrument number/header typography deferred');
      }
    } else if (tk.text === '\\new' && t[i]?.text === 'Staff') {
      pop(); if (t[i]?.text === '=') { pop(); const name = pop(); if (name.text !== (parts.length ? (no30 ? '"Staff_pfLower"' : '"lower"') : (no30 ? '"Staff_pfUpper"' : '"upper"'))) error(name, 'staff'); }
      expect('{', 'staff'); const staff = parts.length ? 'lower' : 'upper';
      while (i < t.length && t[i].text !== '}') {
        const wrapper = pop();
        if (wrapper.text !== '\\relative') error(wrapper, staff, 'Unclassified staff music');
        const ref = pop(); const m = pitchRe.exec(ref.text); if (!m) error(ref, staff);
        const d = diatonic[m![1]] + ((m![3].match(/'/g) ?? []).length - (m![3].match(/,/g) ?? []).length) * 7;
        parts.push(music(staff, staff, (3 + Math.floor(d / 7)) * 12 + letters[m![1]], d));
      }
      expect('}', 'staff');
    } else if (tk.text === '\\new' && t[i]?.text === 'Dynamics') {
      pop(); let channel = 'Dynamics'; if (t[i]?.text === '=') { pop(); channel = pop().text.replace(/^"|"$/g, ''); } dynamics(channel);
    } else if ((tk.text === '\\header' || tk.text === '\\layout') && !pianoStaffOpen) skipGroup('score-layout');
    else error(tk, 'score', 'Unclassified score music');
  }
  expect('}', 'score');
  if (pianoStaffOpen) throw Error(`${file}: unclosed PianoStaff`);
  if (!parts.length) throw Error(`${file}: no playable staves`);
  const main = parts[0]; const bars = main.bars;
  for (const part of parts.slice(1)) {
    if (part.bars.length !== bars.length || part.bars.some((b, j) => b.duration !== bars[j].duration))
      throw Error(`${file}: staff bar duration disagreement (${bars.length}/${part.bars.length}; first differing bar ${bars.findIndex((b, j) => b.duration !== part.bars[j]?.duration)})`);
    if (JSON.stringify(part.repeats) !== JSON.stringify(main.repeats))
      throw Error(`${file}: staff repeat/alternative graph disagreement`);
  }
  const meterLength = Fraction.parse(meter);
  for (const b of bars) {
    if (pickup && (b.number === 0 || no13 && sourceHash === NO13.hash && b.number === 11)) { if (b.duration !== pickup) throw Error(`${file}: pickup mismatch at source bar ${b.number}`); }
    else if (no13 && sourceHash === NO13.hash && (b.number === 10 || b.number === bars.length - 1)) { if (b.duration !== '3/8') throw Error(`${file}: shortened repeat ending ${b.number} has ${b.duration}`); }
    else if ((no14 && !((no30 || no13) && b.number === bars.length - 1) || !no14 && b.number !== bars.length - 1) && b.duration !== meterLength.toString())
      throw Error(`${file}: source bar ${b.number} has ${b.duration}, expected ${meter}`);
  }
  const occurrences: { sourceBar: number; pass: number; onset: string }[] = [];
  let cursor = Z;
  const append = (bar: number, pass: number) => { occurrences.push({ sourceBar: bar, pass, onset: cursor.toString() }); cursor = cursor.add(Fraction.parse(bars[bar].duration)); };
  let b = 0;
  for (const repeat of main.repeats) {
    while (b < repeat.start) append(b++, 1);
    for (let pass = 1; pass <= 2; pass++) {
      for (let n = repeat.start; n <= repeat.end; n++) append(n, pass);
      for (const n of repeat.alternatives[pass - 1] ?? []) append(n, pass);
    }
    b = repeat.alternatives.length ? repeat.alternatives[1].at(-1)! + 1 : repeat.end + 1;
  }
  while (b < bars.length) append(b++, 1);
  const events = parts.flatMap(p => p.events);
  // Admit only the hash-pinned source's explicitly smaller simultaneous route.
  // A size override on its own (in any other source) never means optional music.
  const alternativeGroups: { id: string; bar: number; principal: string[]; optional: string[]; evidence: string }[] = [];
  if (sourceHash === NO14.hash && identity.number === 14) {
    const small = events.filter(e => e.kind === 'note' && e.smallRoute && e.voice.endsWith('."1"'));
    for (const first of small.filter((e, index) => index === 0 || small[index - 1].bar !== e.bar)) {
      const optional = small.filter(e => e.bar === first.bar);
      const principal = events.filter(e => e.bar === first.bar && e.kind === 'note' &&
        e.voice.endsWith('.0') && optional.some(a => a.onset === e.onset && a.duration === e.duration));
      if (principal.length !== optional.length || principal.length !== 3 ||
          new Set(optional.map(e => e.onset)).size !== 3)
        throw Error(`${file}: ambiguous small route in written bar ${first.bar + 1}`);
      const group = `${file}:bar${first.bar + 1}:route`;
      const evidence = `Approved ${sourceHash}; simultaneous Voice 1, three coincident eighths, fontSize -5; source lines ${first.line}–${optional.at(-1)!.line}`;
      for (const e of principal) e.alternative = { group, route: 'principal', evidence };
      for (const e of optional) e.alternative = { group, route: 'optional', evidence };
      alternativeGroups.push({ id: group, bar: first.bar, principal: principal.map(e => e.id), optional: optional.map(e => e.id), evidence });
    }
    if (alternativeGroups.length !== 3) throw Error(`${file}: expected three admitted source alternatives`);
  }
  // Stem direction is meaningful only once a nearby same-voice printed lower/upstairs
  // gesture has anchored its role. It is NOT a universal stem-to-hand rule.
  const lowerAnchors = events.filter(e => e.kind === 'note' && e.staff === 'lower' &&
    (e.printedStaff ?? e.staff) === 'lower');
  const inferredHand = (e: WrittenEvent): { hand: 'RH' | 'LH'; evidence: string; confidence: 'high' | 'contextual' | 'unresolved' } => {
    const destination = e.printedStaff ?? e.staff;
    if (e.staff === 'lower' && lowerAnchors.some(a =>
        (a.voice === e.voice || a.voice === e.voice.split('.')[0]) &&
        a.bar <= e.bar && e.bar - a.bar <= 4 &&
        Fraction.parse(a.onset).n * Fraction.parse(e.onset).d <= Fraction.parse(e.onset).n * Fraction.parse(a.onset).d) &&
        e.stemDirection === 'down' && destination === 'upper')
      return { hand: 'LH', evidence: 'Same logical gesture: lower/down anchor continued on upper staff', confidence: 'contextual' };
    return { hand: destination === 'upper' ? 'RH' : 'LH', evidence: `Printed ${destination} destination${e.stemDirection ? `; source stem ${e.stemDirection}` : ''}`, confidence: 'high' };
  };
  const graceGroups = [...parts.flatMap(p => p.graces), ...dynamicGraces];
  const ties: { fromId: string; toId: string; fromPitch: number; toPitch: number }[] = [];
  // A written ~ belongs to its SOURCE origin, even when the next performed
  // component is back at the repeat body's opening rather than its textual neighbour.
  const outgoing = new Set<string>();
  const incoming = new Set<string>();
  const writtenMarks: WrittenMark[] = [];
  if (no30 || no13) for (const mark of writtenMarksAll) {
    writtenMarks.push(mark);
    if (mark.mark === 'outgoing-tie') outgoing.add(mark.eventId);
    if (mark.mark === 'incoming-repeat-tie') incoming.add(mark.eventId);
  }
  for (const voice of no30 || no13 ? [] : new Set(events.map(e => e.voice))) {
    const voiceEvents = events.filter(e => e.voice === voice);
    for (let k = 0; k < voiceEvents.length; k++) {
      const e = voiceEvents[k]; if (e.kind !== 'note') continue;
      const a = t.findIndex(x => x.line === e.line && x.column === e.column);
      const z = k + 1 < voiceEvents.length ? t.findIndex(x => x.line === voiceEvents[k + 1].line && x.column === voiceEvents[k + 1].column) : t.length;
      const close = t.findIndex((x, j) => j > a && x.text === '}');
      if (a >= 0 && t.slice(a + 1, Math.min(z < 0 ? t.length : z, close < 0 ? t.length : close)).some(x => x.text === '~')) outgoing.add(e.id);
    }
  }
  const ticksPerBeat = 48;
  const notes: QuantizedNote[] = [], sourceSilences: VoiceSilence[] = [], tieChains: WrittenTieChain[] = [];
  const sourceStarts: Fraction[] = []; let start = Z;
  for (const bar of bars) { sourceStarts.push(start); start = start.add(Fraction.parse(bar.duration)); }
  const active = new Map<string, { eventId: string; note: QuantizedNote; occurrence: number; componentTick: number }>();
  const occurrenceTies: OccurrenceTie[] = [];
  const pendingTie = new Map<string, { event: WrittenEvent; endTick: number }>();
  // A polyphonic staff may contain several logical voices within one Part.
  // Give each written voice its own stable grid identity, including unisons.
  const voiceNumbers = new Map([...new Set(events.map(e => e.voice))].map((v, n) => [v, n + 1]));
  for (const occurrence of occurrences) {
    const offset = Fraction.parse(occurrence.onset).add(new Fraction(-sourceStarts[occurrence.sourceBar].n, sourceStarts[occurrence.sourceBar].d));
    const passOccurrences = occurrences.filter(o => o.sourceBar === occurrence.sourceBar);
    const ordinal = passOccurrences.indexOf(occurrence) + 1;
    for (const e of events.filter(e => e.bar === occurrence.sourceBar &&
      (!e.alternative || e.alternative.route === choice))) {
      const onset = Fraction.parse(e.onset).add(offset).toString(), tick = exactTicks(onset, ticksPerBeat), durationTicks = exactTicks(e.duration, ticksPerBeat);
      if (e.kind === 'layout-note') continue;
      const pending = pendingTie.get(e.voice);
      if (pending) {
        if (e.kind !== 'note' || tick !== pending.endTick ||
            !e.pitches.some(p => pending.event.pitches.some(q => q.absolutePitch === p.absolutePitch)))
          throw Error(`${file}:${pending.event.line}:${pending.event.column} [${e.voice}] Written tie has no matching continuation`);
        pendingTie.delete(e.voice);
      }
      if (outgoing.has(e.id) && !no30 && !no13) pendingTie.set(e.voice, { event: e, endTick: tick + durationTicks });
      if (e.kind !== 'note') { sourceSilences.push({ voice: e.voice, staff: e.printedStaff ?? e.staff, hand: e.staff === 'upper' ? 'RH' : 'LH',
        file, line: e.line, col: e.column, bar: e.bar, occurrence: ordinal, kind: e.kind === 'rest' ? 'rest' : 'skip', startTick: tick, durationTicks }); continue; }
      for (const p of e.pitches) {
        const key = `${e.voice}:${p.absolutePitch}`;
        const previous = active.get(key);
        const continuous = previous && previous.note.startTick + previous.note.durationTicks === tick;
        const tied = no30 || no13 ? incoming.has(e.id) || (continuous && outgoing.has(previous.eventId)) : continuous && outgoing.has(previous!.eventId);
        if (no30 && incoming.has(e.id) && (!continuous || !previous || previous.eventId === e.id ||
            previous.note.sourceProvenance?.voices[0] !== e.voice))
          throw Error(`${file}:${e.line}:${e.column} [${e.voice}] Incoming repeat tie has no adjacent same-voice pitch ${p.absolutePitch} at tick ${tick} (previous ${previous?.eventId ?? 'none'})`);
        if (previous && continuous && tied) {
          if (no30 || no13) occurrenceTies.push({ fromId: previous.eventId, toId: e.id, pitch: p.absolutePitch,
            fromOccurrence: previous.occurrence, toOccurrence: ordinal, fromTick: previous.componentTick, toTick: tick });
          const edge = { fromId: previous.eventId, toId: e.id, fromPitch: p.absolutePitch, toPitch: p.absolutePitch };
          if (!ties.some(t => t.fromId === edge.fromId && t.toId === edge.toId && t.fromPitch === edge.fromPitch)) ties.push(edge);
          const origin = previous.note;
          const oldDuration = origin.durationTicks;
          origin.durationTicks += durationTicks;
          let chain = tieChains.find(c => c.noteId === origin.id);
          if (!chain) { chain = { noteId: origin.id, voice: e.voice, soundingTicks: origin.durationTicks,
            components: [{ startTick: origin.startTick, durationTicks: oldDuration, tieForward: true, tieWait: false, voice: e.voice }] }; tieChains.push(chain); }
          else chain.components[chain.components.length - 1].tieForward = true;
          chain.components.push({ startTick: tick, durationTicks, tieForward: false, tieWait: false, voice: e.voice });
          chain.soundingTicks = origin.durationTicks; active.set(key, { eventId: e.id, note: origin, occurrence: ordinal, componentTick: tick }); continue;
        }
        const inference = inferredHand(e);
        const note: QuantizedNote = { id: `${e.id}:${p.absolutePitch}:${ordinal}`, pitch: fromLinearIndex(p.absolutePitch), startTick: tick, durationTicks,
          hand: inference.hand, ...(e.sourceBeam ? {sourceBeam:{...e.sourceBeam, ...(e.sourceBeam.group?{group:`${e.sourceBeam.group}:pass${ordinal}`}:{})}} : {}), handInference: { evidence: inference.evidence, confidence: inference.confidence }, voice: voiceNumbers.get(e.voice)!,
          sourceProvenance: { voices: [e.voice], staves: [e.printedStaff ?? e.staff], hands: [inference.hand], unison: false } };
        notes.push(note); active.set(key, { eventId: e.id, note, occurrence: ordinal, componentTick: tick });
      }
    }
  }
  if (no30 || no13) for (const e of events.filter(e => outgoing.has(e.id))) {
    for (const o of occurrences.filter(o => o.sourceBar === e.bar)) {
      const offset = Fraction.parse(o.onset).add(new Fraction(-sourceStarts[e.bar].n, sourceStarts[e.bar].d));
      const fromTick = exactTicks(Fraction.parse(e.onset).add(offset).toString(), ticksPerBeat);
      if (!occurrenceTies.some(edge => edge.fromId === e.id && edge.fromTick === fromTick))
        throw Error(`${file}:${e.line}:${e.column} [${e.voice}] Outgoing written tie lacks adjacent same-voice continuation`);
    }
  }
  if (no30 || no13) for (const e of events.filter(e => incoming.has(e.id))) {
    for (const o of occurrences.filter(o => o.sourceBar === e.bar)) {
      const offset = Fraction.parse(o.onset).add(new Fraction(-sourceStarts[e.bar].n, sourceStarts[e.bar].d));
      const toTick = exactTicks(Fraction.parse(e.onset).add(offset).toString(), ticksPerBeat);
      if (!occurrenceTies.some(edge => edge.toId === e.id && edge.toTick === toTick))
        throw Error(`${file}:${e.line}:${e.column} [${e.voice}] Dangling incoming repeat tie`);
    }
  }
  if (pendingTie.size) {
    const { event } = pendingTie.values().next().value!;
    throw Error(`${file}:${event.line}:${event.column} [${event.voice}] Written tie has no matching continuation`);
  }
  // Project ornaments by their written host event, never by a coincident tick.
  // Tie continuations can reuse a sounding note id: the active voice/pitch map
  // above resolves every host member to that note's actual occurrence id.
  for (const group of graceGroups) {
    const host = events.find(e => e.id === group.hostEventId) ?? expressionSpacers.find(e => e.id === group.hostEventId);
    if (!host) throw Error(`${file}:${group.source.line}:${group.source.column} [${group.voice}] Grace host missing`);
    for (const o of occurrences.filter(o => o.sourceBar === group.source.bar)) {
      const ordinal = occurrences.filter(q => q.sourceBar === o.sourceBar).indexOf(o) + 1;
      const offset = Fraction.parse(o.onset).add(new Fraction(-sourceStarts[o.sourceBar].n, sourceStarts[o.sourceBar].d));
      const onset = Fraction.parse(host.onset).add(offset).toString();
      const tick = exactTicks(onset, ticksPerBeat);
      const hostNoteIds = 'pitches' in host ? host.pitches.map(p => {
        const id = `${host.id}:${p.absolutePitch}:${ordinal}`;
        const direct = notes.find(n => n.id === id);
        if (direct) return id;
        const chain = occurrenceTies.find(edge => edge.toId === host.id && edge.toTick === tick && edge.pitch === p.absolutePitch);
        if (chain) {
          const continuation = notes.find(n => n.pitch.octave * 12 + n.pitch.pitchClass === p.absolutePitch &&
            n.sourceProvenance?.voices.includes(host.voice) && n.startTick <= tick && n.startTick + n.durationTicks > tick);
          if (continuation) return continuation.id;
        }
        throw Error(`${file}:${group.source.line}:${group.source.column} [${group.voice}] Grace host member ${id} not projected`);
      }) : [];
      group.occurrences.push({ id: `${group.id}:pass${ordinal}`, sourceBar: o.sourceBar, pass: o.pass, tick, hostNoteIds });
    }
  }
  // Normalize expression clocks independently of sounding durations. Endpoints
  // remain attached to source atoms and then follow the same occurrence graph.
  const hosts = new Map([...events, ...expressionSpacers].map(e => [e.id, e]));
  const origin = (fact: WrittenExpression, host: WrittenEvent | ExpressionSpacer, occurrence: number): ExpressionProvenance => ({
    file, line: fact.line, col: fact.column, bar: host.bar, context: fact.context,
    occurrence, time: host.onset, order: fact.order });
  const projected = (fact: WrittenExpression) => {
    const host = hosts.get(fact.hostId); if (!host) throw Error(`${file}: missing expression host ${fact.hostId}`);
    return occurrences.flatMap((o, index) => {
      if (o.sourceBar !== host.bar) return [];
      const ordinal = occurrences.filter(q => q.sourceBar === o.sourceBar).indexOf(o) + 1;
      const offset = Fraction.parse(o.onset).add(new Fraction(-sourceStarts[host.bar].n, sourceStarts[host.bar].d));
      return [{ host, index, ordinal, offset, tick: exactTicks(Fraction.parse(host.onset).add(offset).toString(), ticksPerBeat), origin: origin(fact, host, ordinal) }];
    });
  };
  const endFor = (start: ReturnType<typeof projected>[number], fact: WrittenExpression) => {
    const end = hosts.get(fact.hostId)!;
    const found = occurrences.findIndex((o, index) => index >= start.index && o.sourceBar === end.bar);
    if (found < 0) throw Error(`${file}: expression endpoint not reachable`);
    const o = occurrences[found];
    const offset = Fraction.parse(o.onset).add(new Fraction(-sourceStarts[end.bar].n, sourceStarts[end.bar].d));
    return { tick: exactTicks(Fraction.parse(end.onset).add(offset).toString(), ticksPerBeat),
      origin: origin(fact, end, occurrences.filter(q => q.sourceBar === end.bar).indexOf(o) + 1) };
  };
  const scoreDynamics: DynamicOverlay[] = [], rawPedals: PedalOverlay[] = [];
  const openHairpins = new Map<string, WrittenExpression>();
  for (const fact of expressions) {
    if (fact.token === '\\<' || fact.token === '\\>' || fact.token === '\\cresc') {
      if (openHairpins.has(fact.context)) throw Error(`${file}:${fact.line}: overlapping hairpins`);
      openHairpins.set(fact.context, fact); continue;
    }
    if (fact.token === '\\!') {
      const from = openHairpins.get(fact.context);
      if (!from) throw Error(`${file}:${fact.line}: unopened hairpin`);
      for (const p of projected(from)) {
        const end = endFor(p, fact);
        if (end.tick <= p.tick) throw Error(`${file}:${fact.line}: nonpositive hairpin`);
        scoreDynamics.push({ tick: p.tick, mark: from.token === '\\>' ? 'decrescendo' : 'crescendo',
          durationTicks: end.tick - p.tick, kind: from.token === '\\cresc' ? 'text-cresc' : 'hairpin',
          ...(from.token === '\\cresc' ? { text: 'cresc.' } : {}), origin: p.origin, endOrigin: end.origin });
      }
      openHairpins.delete(fact.context); continue;
    }
    for (const p of projected(fact)) {
      if (fact.token === '\\sustainOn' || fact.token === '\\sustainOff') {
        rawPedals.push({ tick: p.tick, type: fact.token === '\\sustainOn' ? 'sustain-down' : 'sustain-up', origin: p.origin, order: fact.order });
      } else if (fact.text || fact.token === '\\cresc') {
        scoreDynamics.push({ tick: p.tick, mark: fact.text === 'diminuendo' ? 'decrescendo' : 'crescendo',
          text: fact.text ?? 'cresc.', kind: 'text-cresc', origin: p.origin });
      } else {
        scoreDynamics.push({ tick: p.tick, mark: (fact.token === '\\parenpiano' ? 'p' : fact.token.slice(1)) as DynamicOverlay['mark'],
          ...(fact.token === '\\parenpiano' ? { parenthesized: true } : {}), kind: 'mark', origin: p.origin });
      }
    }
  }
  if (openHairpins.size) throw Error(`${file}: unclosed hairpin`);
  rawPedals.sort((a,b) => a.tick - b.tick || a.order! - b.order!);
  const scorePedals = normalizePedalEvents(rawPedals);
  const endpointIds = (hostId: string, tick: number) => {
    let host = events.find(e => e.id === hostId)!;
    if (host.alternative && host.alternative.route !== choice) {
      host = events.find(e => e.alternative?.group === host.alternative!.group && e.alternative?.route === choice && e.onset === host.onset)!;
    }
    return notes.filter(n => n.startTick <= tick && n.startTick + n.durationTicks > tick &&
      n.sourceProvenance?.voices.includes(host.voice) && host.pitches.some(p => p.absolutePitch === n.pitch.octave * 12 + n.pitch.pitchClass)).map(n => n.id);
  };
  const scorePhrases: PhraseOverlay[] = [];
  for (const phrase of phrases) for (const p of projected(phrase.start)) {
    // A source delimiter in only one ending does not establish a closure on
    // another route. Never jump through a repeat return to fabricate a slur.
    if (phrase.kind === 'slur') {
      const endpoint = hosts.get(phrase.end.hostId)!;
      const stop = occurrences.findIndex((o, index) => index >= p.index && o.sourceBar === endpoint.bar);
      const route = stop < 0 ? [] : occurrences.slice(p.index, stop + 1);
      if (stop < 0 || route.some((o, index) => index > 0 && o.sourceBar < route[index - 1].sourceBar)) {
        const first = t.find(tk => tk.line === phrase.start.line && tk.column === phrase.start.column)!;
        const last = t.find(tk => tk.line === phrase.end.line && tk.column === phrase.end.column)!;
        deferSpan(first, last, phrase.start.context, `Ordinary slur closure unresolved in source occurrence ${p.ordinal}; repeat route not inferred`);
        continue;
      }
    }
    const end = endFor(p, phrase.end);
    const fromNoteIds = endpointIds(phrase.fromId, p.tick), toNoteIds = endpointIds(phrase.toId, end.tick);
    if (!fromNoteIds.length || !toNoteIds.length) throw Error(`${file}:${phrase.start.line}: phrase endpoint not sounding`);
    scorePhrases.push({ id: `${phrase.fromId}:${phrase.kind}:${p.ordinal}`, startTick: p.tick, endTick: end.tick,
      fromNoteIds, toNoteIds, voice: phrase.start.context, kind: phrase.kind, origin: p.origin, endOrigin: end.origin,
      ...(phrase.sourceSide ? { sourceSide: phrase.sourceSide,
        sourceSideOrigin: origin(phrase.sourceSideOrigin!, p.host, p.ordinal) } : {}) });
  }
  scoreDynamics.sort((a,b) => a.tick - b.tick || a.origin!.order - b.origin!.order);
  const totalTicks = exactTicks(cursor.toString(), ticksPerBeat);
  const piece = identity.number === 14 ? 'Nr. 14 · Kleine Studie' : identity.number === 13 ? 'Nr. 13 · Mai, lieber Mai, bald bist du wieder da!' :
    identity.number === 30 ? 'Nr. 30' : 'Nr. 43 · Sylvesterlied';
  const score: QuantizedGridScore = { id: `schumann-op68-no${identity.number}`, title: piece,
    composer: 'Robert Schumann', printIdentity: { scoreId: `schumann-op68-no${identity.number}`, work: 'Album für die Jugend · Op. 68', piece,
      composer: 'Robert Schumann', sourceAlias: identity.file }, opus: `Op. 68 No. ${identity.number}`, ticksPerBeat, totalTicks,
    timeSignatures: [{ tick: 0, numerator: Number(meter.split('/')[0]), denominator: Number(meter.split('/')[1]) }],
    barlines: occurrences.map((o, j) => ({ barNumber: j, tick: exactTicks(o.onset, ticksPerBeat), type: 'regular' as const })),
    tempos: [], dynamics: scoreDynamics, pedals: scorePedals, phrases: scorePhrases, notes, sourceSilences, tieChains,
    ...(no13 ? { graceGroups } : {}),
    // Every successfully parsed source has literal unfolded boundaries, including
    // unfamiliar sources with pickups/repeats/short endings. Hashes guard source
    // semantics above, not admission to the shared production planner.
    sourceBarTicks: [...occurrences.map(o => exactTicks(o.onset, ticksPerBeat)), totalTicks], productionLayout: true };
  return { facts: { sourceHash, sourceFile: file, pickup, events, expressionSpacers, expressions, phrases,
    ties, ...(no30 || no13 ? { writtenMarks, occurrenceTies } : {}), ...(no13 ? { graceGroups } : {}), bars, repeats: main.repeats, occurrences, ...(alternativeGroups.length ? { alternativeGroups } : {}), handPolicy: 'PROVISIONAL: printed destination anchored with local gesture context; source voice/staff and confidence retained separately',
    provenance: { author: 'Robert Schumann', maintainer: 'Philippe Hardy', sourceHeader: no30 ? 'source = "Peters "; maintainer = "Philippe Hardy"; lastupdated = "09/Mai/2012"; title = "* * *" (Peters edition unspecified)' : no13 ? 'source = "Peters "; maintainer = "Philippe Hardy"; lastupdated = "09/Mai/2012"; title = "Mai, cher Mai, Te voilà bientôt de retour!" (Peters edition unspecified)' : 'Peters (edition unspecified)',
      licenseNotice: 'Source header: Copyleft - Licence Art Libre / Free Art License; retain attribution and applicable copyleft for derived encodings',
      approval: 'Operator reviewed recovered LilyPond against a reference edition; source hash pins approved encoding, not machine certification of Henle' } }, score, ledger };
}
