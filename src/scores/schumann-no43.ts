/** Read-only, deliberately bounded LilyPond music visitor for the approved No. 43 encoding.
 * No Scheme evaluation or LilyPond process is involved. Unsupported musical syntax fails closed.
 * Derived encodings retain the source's Free Art License / Copyleft attribution to Philippe Hardy.
 */
import { createHash } from 'node:crypto';
import { fromLinearIndex } from '../model/pitch';
import type { QuantizedGridScore, QuantizedNote, VoiceSilence, WrittenTieChain } from '../model/types';

export interface WrittenEvent {
  id: string; kind: 'note' | 'rest' | 'spacer' | 'layout-note'; onset: string; duration: string;
  pitches: { spelling: string; absolutePitch: number }[]; voice: string; staff: string;
  handPolicy: 'provisional-upper' | 'provisional-lower'; bar: number; hidden: boolean;
  line: number; column: number;
}
export interface DeferredFact {
  file: string; line: number; column: number; endLine: number; endColumn: number;
  construct: string; reason: string; effect: string; blocking: boolean; voice: string;
}
interface Token { text: string; line: number; column: number; offset: number; endOffset: number }
interface Part { events: WrittenEvent[]; bars: { number: number; duration: string }[];
  repeats: { start: number; end: number; alternatives: number[][] }[]; }
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
const pitchRe = /^([a-g])(isis!?|eses!?|is!?|es!?|s|f|!|\?)?([,']*)(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/;
const restRe = /^([rsR])(\d+)?(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/;
const letters: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const diatonic: Record<string, number> = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };
const modifiers: Record<string, number> = { is: 1, 'is!': 1, isis: 2, 'isis!': 2, es: -1, 'es!': -1, eses: -2, 'eses!': -2, s: -1, f: -1, '!': 0, '?': 0 };
function dur(digit: string | undefined, dots: string | undefined, mult: string | undefined, div: string | undefined, previous: Fraction): Fraction {
  let value = digit ? new Fraction(1, Number(digit)) : previous;
  if (dots) { let v = value; for (let j = 0; j < dots.length; j++) { v = v.mul(new Fraction(1, 2)); value = value.add(v); } }
  return mult ? value.mul(new Fraction(Number(mult), Number(div ?? '1'))) : value;
}
function exactTicks(value: string, quarter: number): number {
  const f = Fraction.parse(value); const n = f.n * quarter * 4 / f.d;
  if (!Number.isSafeInteger(n)) throw Error(`Non-integral tick for ${value} at ${quarter} ticks/quarter`);
  return n;
}

export function importSchumannNo43(source: string, file = '43-Chant-du-Nouvel-An.ly'):
  { facts: { sourceHash: string; sourceFile: string; pickup: string; events: WrittenEvent[];
    ties: { fromId: string; toId: string; fromPitch: number; toPitch: number }[];
    bars: { number: number; duration: string }[];
    repeats: Part['repeats']; occurrences: { sourceBar: number; pass: number; onset: string }[];
    handPolicy: string; provenance: { author: string; maintainer: string; sourceHeader: string; licenseNotice: string;
      approval: string } }; score: QuantizedGridScore; ledger: DeferredFact[] } {
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const approvedSource = sourceHash === '150e13d9723743fea780168fd9776525a856a99506522072185b619d3815797f';
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
  const parts: Part[] = []; let pickup = ''; let meter = '1';
  function music(staff: string, voice: string, relative: number, relativeD = 0): Part {
    let time = Z, previous = new Fraction(1, 4), anchor = relative, anchorD = relativeD;
    let bar = 0, barStart = Z, hidden = false;
    const events: WrittenEvent[] = [], bars: Part['bars'] = [], repeats: Part['repeats'] = [];
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
    const sequence = (): void => {
      expect('{', voice);
      while (i < t.length && t[i].text !== '}') {
        const tk = pop(), x = tk.text;
        if (x === '|') { const length = time.add(new Fraction(-barStart.n, barStart.d));
          if (length.n === 0) { // A barline after a multiplied whole-bar spacer does not create a new bar.
            if (bars.length === 0) error(tk, voice, 'Empty written bar');
            continue;
          }
          bars.push({ number: bar, duration: length.toString() }); barStart = time; bar++; continue; }
        if (x === '\\repeat') {
          expect('volta', voice); const times = pop(); if (times.text !== '2') error(times, voice, 'Only two-pass volta supported');
          const start = bar; sequence(); const end = bar - 1;
          expect('\\alternative', voice); expect('{', voice);
          const alternatives: number[][] = [];
          while (t[i]?.text === '{') { const a = bar; sequence(); alternatives.push(Array.from({ length: bar - a }, (_, k) => a + k)); }
          expect('}', voice);
          if (alternatives.length !== 2) error(tk, voice, 'Volta requires two endings');
          repeats.push({ start, end, alternatives }); continue;
        }
        if (x === '<<') {
          // Independent simultaneous voices share the same bar clock, not sequential time.
          const base = time, baseBar = bar;
          const branchParts: Part[] = [];
          let branch = 0;
          while (t[i]?.text !== '>>') {
            let name = `${voice}.${branch++}`;
            if (t[i]?.text === '\\context') { pop(); expect('Voice', voice); expect('=', voice); name = `${voice}.${pop().text}`; }
            const child = music(staff, name, anchor, anchorD);
            branchParts.push(child);
          }
          expect('>>', voice);
          // Branches were independently measured from zero; align them to parent position.
          for (const child of branchParts) {
            for (const e of child.events) { e.onset = Fraction.parse(e.onset).add(base).toString(); e.bar += baseBar; events.push(e); }
          }
          for (const r of branchParts[0]?.repeats ?? []) repeats.push({ start: r.start + baseBar, end: r.end + baseBar,
            alternatives: r.alternatives.map(a => a.map(b => b + baseBar)) });
          const lengths = branchParts.map(p => p.bars.reduce((sum, b) => sum.add(Fraction.parse(b.duration)), Z));
          if (lengths.some(l => l.toString() !== lengths[0].toString()) ||
              branchParts.slice(1).some(p => p.bars.length !== branchParts[0].bars.length ||
                p.bars.some((b, j) => b.duration !== branchParts[0].bars[j].duration)))
            error(tk, voice, 'Simultaneous voices disagree on bar accounting');
          for (const childBar of branchParts[0]?.bars ?? []) bars.push({ number: childBar.number + baseBar, duration: childBar.duration });
          time = base.add(lengths[0] ?? Z); bar = baseBar + (branchParts[0]?.bars.length ?? 0);
          barStart = time; // simultaneous block in the approved source covers whole bars
          continue;
        }
        if (x === '\\time') { const m = pop(); if (!/^\d+\/\d+$/.test(m.text)) error(m, voice); meter = m.text; continue; }
        if (x === '\\partial') { const m = pop(); const mm = /^(\d+)(\.*)$/.exec(m.text); if (!mm) error(m, voice); pickup = dur(mm![1], mm![2], undefined, undefined, previous).toString(); continue; }
        if (x === '\\relative') { const ref = pop(); const match = pitchRe.exec(ref.text); if (!match) error(ref, voice); const marks = match![3];
          anchorD = diatonic[match![1]] + ((marks.match(/'/g) ?? []).length - (marks.match(/,/g) ?? []).length) * 7;
          anchor = (3 + Math.floor(anchorD / 7)) * 12 + letters[match![1]]; sequence(); continue; }
        if (x === '\\hideNotes') { hidden = true; defer(tk, voice, 'Following written notes remain sounding but are not hidden by this draft'); continue; }
        if (x === '\\unHideNotes') { hidden = false; defer(tk, voice, 'End of hidden source layout span'); continue; }
        if (x === '~') continue;
        if (x === '^' || x === '_') {
          const next = t[i]?.text ?? '';
          if (next === '~') pop();
          else if (next === '\\markup') { const mk = pop(); defer(mk, voice); if (t[i]?.text === '\\override') { pop(); pop(); }
            if (t[i]?.text === '{') {
              const end = skipGroup(voice); const fact = ledger[ledger.length - 1];
              fact.construct = source.slice(mk.offset, end.endOffset); fact.endLine = end.line; fact.endColumn = end.column + end.text.length;
            } else error(t[i], voice, 'Unbounded markup'); }
          else if (next.startsWith('\\')) { defer(pop(), voice); }
          else if (/^\d+$/.test(next)) { defer(pop(), voice, 'Fingering deferred'); }
          else if (next === '(' || next === ')' || next === '[' || next === ']') defer(pop(), voice, 'Articulation or phrasing deferred');
          else error(t[i], voice, 'Unhandled note attachment');
          continue;
        }
        if ('()[]'.includes(x) && x.length === 1) { defer(tk, voice, 'Slur or beam presentation deferred'); continue; }
        if (x === '\\once') { if (t[i]?.text !== '\\override') error(tk, voice, 'Only once override is classified as layout'); continue; }
        if (x === '\\override' || x === '\\set') {
          // Scoped property assignment: stop before the following music atom. No Scheme is evaluated.
          const property = pop();
          if (!/^(?:Score\.(?:Fingering|MetronomeMark|VoltaBracketSpanner)|Staff\.(?:fingeringOrientations|Rest|Fingering)|Voice\.Arpeggio|NoteColumn|TextScript|Tie|Slur|LaissezVibrerTie|DynamicText)$/.test(property.text))
            error(property, voice, 'Unclassified property may affect music');
          if (t[i]?.text.startsWith("#'")) pop();
          expect('=', voice); const value = pop();
          if (value.text === '#') { if (t[i]) pop(); }
          else if (!value.text.startsWith('#') && !/^"/.test(value.text)) error(value, voice, 'Unsafe property value');
          defer(tk, voice, 'Layout property ignored; adjacent musical events remain'); continue;
        }
        if (x === '\\extendLV') { const arg = pop(); if (!/^#\d+(?:\.\d+)?$/.test(arg.text)) error(arg, voice); defer(tk, voice, 'Laissez-vibrer layout extension not painted'); continue; }
        if (x === '\\bar') { pop(); continue; }
        if (x === '\\clef' || x === '\\key' || x === '\\tempo') {
          if (x === '\\clef') pop(); else if (x === '\\key') { pop(); expect('\\major', voice); }
          else pop(); defer(tk, voice); continue;
        }
        if (['\\voiceOne','\\voiceTwo','\\oneVoice','\\noBeam','\\stemDown','\\stemUp','\\stemNeutral',
          '\\mergeDifferentlyDottedOn','\\arpeggio','\\arpeggioBracket','\\break','\\pageBreak'].includes(x)) { defer(tk, voice); continue; }
        if (x === '\\new') error(tk, voice, 'Nested new context not supported in voice');
        if (x.startsWith('\\')) {
          if (['\\fermata','\\laissezVibrer','\\mf','\\fp','\\cresc','\\!','\\<','\\>'].includes(x)) { defer(tk, voice); continue; }
          error(tk, voice);
        }
        let raw: { spelling: string; absolutePitch: number; d: number }[] = [];
        let kind: WrittenEvent['kind'] = 'note', length: Fraction;
        if (x === '<') {
          let prior = { n: anchor, d: anchorD };
          while (t[i]?.text !== '>') {
            const p = pop();
            const clean = { ...p, text: p.text.replace(/-\d+$/, '') };
            const segments = clean.text.match(/[a-g](?:isis!?|eses!?|is!?|es!?|!|\?)?[,']*/g);
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
          const spec = t[i]?.text ?? ''; const m = /^(\d+)(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/.exec(spec);
          if (m) { pop(); length = dur(m[1], m[2], m[3], m[4], previous); previous = dur(m[1], '', undefined, undefined, previous); }
          else length = previous;
        } else {
          const rest = restRe.exec(x), m = pitchRe.exec(x.replace(/-\d+$/, ''));
          if (!m && !rest) error(tk, voice);
          if (rest) { kind = rest[1] === 's' ? 'spacer' : 'rest'; length = dur(rest[2], rest[3], rest[4], rest[5], previous); if (rest[2]) previous = new Fraction(1, Number(rest[2])); }
          else { const item = pitch(tk, { n: anchor, d: anchorD }); raw = [item];
            length = dur(m![4], m![5], m![6], m![7], previous); if (m![4]) previous = new Fraction(1, Number(m![4])); }
        }
        if (raw.length) { anchor = raw[0].absolutePitch; anchorD = raw[0].d; }
        if (kind === 'spacer' && /^s1\*\d+$/.test(x)) {
          const count = Number(x.split('*')[1]);
          for (let k = 0; k < count; k++) {
            events.push({ id: `${file}:${tk.line}:${tk.column}:${voice}:${k}`, kind, onset: time.toString(),
              duration: '1', pitches: [], voice, staff, handPolicy: staff === 'upper' ? 'provisional-upper' : 'provisional-lower',
              bar, hidden, line: tk.line, column: tk.column });
            time = time.add(new Fraction(1)); bars.push({ number: bar++, duration: '1' }); barStart = time;
          }
          continue;
        }
        // The approved score uses two hidden duplicate heads solely to carry
        // a slur end / laissez-vibrer shape. The preceding hidden g (l.130)
        // is NOT a dummy: it is a distinct sounding note. Do not generalize
        // `hideNotes` to silence; classify these guarded source sites only.
        const layoutOnly = approvedSource && staff === 'upper' && voice === 'upper."1"' &&
          ((tk.line === 132 && tk.column === 47 && raw[0]?.absolutePitch === 45) ||
           (tk.line === 143 && tk.column === 171 && raw[0]?.absolutePitch === 52));
        if (layoutOnly) {
          kind = 'layout-note';
          defer(tk, voice, 'Hidden duplicate shape carrier is retained as a written fact; no second audible attack');
        }
        const e: WrittenEvent = { id: `${file}:${tk.line}:${tk.column}:${voice}`, kind,
          onset: time.toString(), duration: length.toString(), pitches: raw.map(({ spelling, absolutePitch }) => ({ spelling, absolutePitch })),
          voice, staff, handPolicy: staff === 'upper' ? 'provisional-upper' : 'provisional-lower', bar, hidden,
          line: tk.line, column: tk.column };
        events.push(e);
        time = time.add(length);
      }
      expect('}', voice);
    };
    sequence();
    if (time.toString() !== barStart.toString()) bars.push({ number: bar, duration: time.add(new Fraction(-barStart.n, barStart.d)).toString() });
    return { events, bars, repeats };
  }
  // A Dynamics context is music (not paper/layout): preserve its expression facts
  // even though this draft cannot yet engrave their positions or hairpins.
  const dynamics = () => {
    expect('{', 'Dynamics'); let depth = 1;
    const expressions = new Set(['\\mf', '\\fp', '\\cresc', '\\<', '\\>', '\\!']);
    while (depth && i < t.length) {
      const token = pop();
      if (token.text === '{') { depth++; continue; }
      if (token.text === '}') { depth--; continue; }
      if (expressions.has(token.text)) { defer(token, 'Dynamics', 'Expressive mark/hairpin omitted from draft; source order retained'); continue; }
      if (['\\break','\\pageBreak', '\\bar'].includes(token.text)) {
        defer(token, 'Dynamics', 'Dynamics-staff layout omitted'); if (token.text === '\\bar') pop(); continue;
      }
      if (token.text === '\\overrideProperty') {
        const args = [pop(), pop(), pop()];
        if (args.some(a => !a.text.startsWith('#'))) error(token, 'Dynamics', 'Unclassified overrideProperty');
        defer(token, 'Dynamics'); continue;
      }
      if (token.text === '|' || /^s(?:\d+)?(?:\.*)(?:\*\d+)?$/.test(token.text)) continue;
      // The reviewed source has a fused s8s4 spelling in the dynamics staff.
      // This context is omitted, so record that literal instead of claiming timing.
      if (token.text === 's8s4') { defer(token, 'Dynamics', 'Fused spacer in omitted expression staff; dynamic timing unresolved'); continue; }
      if (token.text === '\\once') continue;
      if (token.text === '\\override') { pop(); pop(); expect('=', 'Dynamics'); pop(); defer(token, 'Dynamics'); continue; }
      error(token, 'Dynamics');
    }
    if (depth) throw Error(`${file}: unterminated Dynamics context`);
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
      if (property.text !== 'PianoStaff.instrumentName') error(property, 'score', 'Unclassified score property');
      expect('=', 'score'); expect('\\markup', 'score'); skipGroup('score-markup');
    } else if (tk.text === '\\new' && t[i]?.text === 'Staff') {
      pop(); expect('{', 'staff'); const staff = parts.length ? 'lower' : 'upper';
      while (i < t.length && t[i].text !== '}') {
        const wrapper = pop();
        if (wrapper.text !== '\\relative') error(wrapper, staff, 'Unclassified staff music');
        const ref = pop(); const m = pitchRe.exec(ref.text); if (!m) error(ref, staff);
        const d = diatonic[m![1]] + ((m![3].match(/'/g) ?? []).length - (m![3].match(/,/g) ?? []).length) * 7;
        parts.push(music(staff, staff, (3 + Math.floor(d / 7)) * 12 + letters[m![1]], d));
      }
      expect('}', 'staff');
    } else if (tk.text === '\\new' && t[i]?.text === 'Dynamics') {
      pop(); if (t[i]?.text === '=') { pop(); pop(); } dynamics();
    } else if ((tk.text === '\\header' || tk.text === '\\layout') && !pianoStaffOpen) skipGroup('score-layout');
    else error(tk, 'score', 'Unclassified score music');
  }
  expect('}', 'score');
  if (pianoStaffOpen) throw Error(`${file}: unclosed PianoStaff`);
  if (!parts.length) throw Error(`${file}: no playable staves`);
  const main = parts[0]; const bars = main.bars;
  for (const part of parts.slice(1)) {
    if (part.bars.length !== bars.length || part.bars.some((b, j) => b.duration !== bars[j].duration))
      throw Error(`${file}: staff bar duration disagreement`);
    if (JSON.stringify(part.repeats) !== JSON.stringify(main.repeats))
      throw Error(`${file}: staff repeat/alternative graph disagreement`);
  }
  const meterLength = Fraction.parse(meter);
  for (const b of bars) {
    if (b.number === 0 && pickup) { if (b.duration !== pickup) throw Error(`${file}: pickup mismatch`); }
    else if (b.number !== bars.length - 1 && b.duration !== meterLength.toString())
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
      for (const n of repeat.alternatives[pass - 1]) append(n, pass);
    }
    b = repeat.alternatives[1].at(-1)! + 1;
  }
  while (b < bars.length) append(b++, 1);
  const events = parts.flatMap(p => p.events);
  const ties: { fromId: string; toId: string; fromPitch: number; toPitch: number }[] = [];
  // A written ~ belongs to its SOURCE origin, even when the next performed
  // component is back at the repeat body's opening rather than its textual neighbour.
  const outgoing = new Set<string>();
  for (const voice of new Set(events.map(e => e.voice))) {
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
  const active = new Map<string, { eventId: string; note: QuantizedNote }>();
  const pendingTie = new Map<string, { event: WrittenEvent; endTick: number }>();
  // A polyphonic staff may contain several logical voices within one Part.
  // Give each written voice its own stable grid identity, including unisons.
  const voiceNumbers = new Map([...new Set(events.map(e => e.voice))].map((v, n) => [v, n + 1]));
  for (const occurrence of occurrences) {
    const offset = Fraction.parse(occurrence.onset).add(new Fraction(-sourceStarts[occurrence.sourceBar].n, sourceStarts[occurrence.sourceBar].d));
    const passOccurrences = occurrences.filter(o => o.sourceBar === occurrence.sourceBar);
    const ordinal = passOccurrences.indexOf(occurrence) + 1;
    for (const e of events.filter(e => e.bar === occurrence.sourceBar)) {
      const onset = Fraction.parse(e.onset).add(offset).toString(), tick = exactTicks(onset, ticksPerBeat), durationTicks = exactTicks(e.duration, ticksPerBeat);
      if (e.kind === 'layout-note') continue;
      const pending = pendingTie.get(e.voice);
      if (pending) {
        if (e.kind !== 'note' || tick !== pending.endTick ||
            !e.pitches.some(p => pending.event.pitches.some(q => q.absolutePitch === p.absolutePitch)))
          throw Error(`${file}:${pending.event.line}:${pending.event.column} [${e.voice}] Written tie has no matching continuation`);
        pendingTie.delete(e.voice);
      }
      if (outgoing.has(e.id)) pendingTie.set(e.voice, { event: e, endTick: tick + durationTicks });
      if (e.kind !== 'note') { sourceSilences.push({ voice: e.voice, staff: e.staff, hand: e.staff === 'upper' ? 'RH' : 'LH',
        file, line: e.line, col: e.column, bar: e.bar, occurrence: ordinal, kind: e.kind === 'rest' ? 'rest' : 'skip', startTick: tick, durationTicks }); continue; }
      for (const p of e.pitches) {
        const key = `${e.voice}:${p.absolutePitch}`;
        const previous = active.get(key);
        if (previous && outgoing.has(previous.eventId) && previous.note.startTick + previous.note.durationTicks === tick) {
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
          chain.soundingTicks = origin.durationTicks; active.set(key, { eventId: e.id, note: origin }); continue;
        }
        const note: QuantizedNote = { id: `${e.id}:${p.absolutePitch}:${ordinal}`, pitch: fromLinearIndex(p.absolutePitch), startTick: tick, durationTicks,
          hand: e.staff === 'upper' ? 'RH' : 'LH', voice: voiceNumbers.get(e.voice)!,
          sourceProvenance: { voices: [e.voice], staves: [e.staff], hands: [e.staff === 'upper' ? 'RH' : 'LH'], unison: false } };
        notes.push(note); active.set(key, { eventId: e.id, note });
      }
    }
  }
  if (pendingTie.size) {
    const { event } = pendingTie.values().next().value!;
    throw Error(`${file}:${event.line}:${event.column} [${event.voice}] Written tie has no matching continuation`);
  }
  const totalTicks = exactTicks(cursor.toString(), ticksPerBeat);
  const score: QuantizedGridScore = { id: 'schumann-op68-no43', title: 'Chant du Nouvel An — Draft / unfolded repeats',
    composer: 'Robert Schumann', opus: 'Op. 68 No. 43', ticksPerBeat, totalTicks,
    timeSignatures: [{ tick: 0, numerator: Number(meter.split('/')[0]), denominator: Number(meter.split('/')[1]) }],
    barlines: occurrences.map((o, j) => ({ barNumber: j, tick: exactTicks(o.onset, ticksPerBeat), type: 'regular' as const })),
    tempos: [], dynamics: [], pedals: [], notes, sourceSilences, tieChains };
  return { facts: { sourceHash, sourceFile: file, pickup, events,
    ties, bars, repeats: main.repeats, occurrences, handPolicy: 'PROVISIONAL: upper part RH, lower part LH; no inferred crossings',
    provenance: { author: 'Robert Schumann', maintainer: 'Philippe Hardy', sourceHeader: 'Peters (edition unspecified)',
      licenseNotice: 'Source header: Copyleft - Licence Art Libre / Free Art License; retain attribution and applicable copyleft for derived encodings',
      approval: 'Operator reviewed recovered LilyPond against a reference edition; source hash pins approved encoding, not machine certification of Henle' } }, score, ledger };
}
