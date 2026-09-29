import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchumannNo13Draft, schumannNo13WrittenFacts } from '../src/scores/schumann-no13-draft';
import { importSchumann } from '../src/scores/schumann-no43';
import { createStudioConfig } from '../src/render/janko/studio';
import { layoutJankoScore, renderJankoPage, renderJankoCrop, countJankoPages } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';
import type { GraceGroup } from '../src/model/types';

const groups: GraceGroup[] = schumannNo13WrittenFacts.graceGroups as GraceGroup[];
const lin = (m: { pitch?: { octave: number; pitchClass: number } }) => m.pitch && m.pitch.octave * 12 + m.pitch.pitchClass;

test('literal No. 13 grace values, relative pitches, beams, and full written-event hosts (linear = MIDI minus 12)', () => {
  const pitched = groups.filter(g => g.members.some(m => m.pitch));
  assert.deepEqual(pitched.map(g => g.source.line), [84, 86, 87, 90, 96, 105, 107, 108]);
  assert.deepEqual(pitched.map(g => g.members.map(m => m.duration)), [
    ['1/16','1/16'], ['1/16','1/16'], ['1/8'], ['1/16','1/16'], ['1/8'],
    ['1/16','1/16'], ['1/16','1/16'], ['1/8']]);
  assert.deepEqual(pitched.map(g => g.members.map(m => lin(m))), [
    [49,54], [57,59], [63], [59,63], [74], [61,66], [69,71], [75]]);
  assert.deepEqual(pitched.map(g => g.members.map(m => [m.beamStart,m.beamEnd])), [
    [[true,false],[false,true]], [[true,false],[false,true]], [[false,false]],
    [[true,false],[false,true]], [[false,false]], [[true,false],[false,true]],
    [[true,false],[false,true]], [[false,false]]]);
  const host = (line: number) => schumannNo13WrittenFacts.events.find(e => e.id === pitched.find(g => g.source.line === line)!.hostEventId)!;
  assert.deepEqual([84,87,90].map(line => host(line).pitches.map(p => p.absolutePitch)), [[59],[54,61],[56,61]]);
  assert.equal(host(87).duration, '1/16');
  assert.deepEqual(groups.filter(g => !g.members.some(m => m.pitch)).map(g => g.source.line).sort((a,b)=>a-b),
    [131,137,138,145,154,164,170,171,202,225,231,233].sort((a,b)=>a-b));
  assert.equal(groups.find(g => g.source.line === 225)?.kind, 'appoggiatura');
  assert.equal(groups.find(g => g.source.line === 202)?.hostKind, 'rest');
  assert.equal(groups.find(g => g.source.line === 225)?.occurrences[0].hostNoteIds.length, 2);
  assert.ok(groups.filter(g=>g.staff==='Dynamics').every(g=>g.hand===null && g.members.every(m=>!m.pitch)));
  assert.ok(groups.every(g=>g.source.endLine >= g.source.line && g.members.every(m=>m.endColumn > m.column)));
  assert.equal(groups.find(g=>g.source.line===84)?.printedStaff,'upper');
});

test('ordinary clocks/repeats and source host membership survive without metrical grace attacks', () => {
  const score = buildSchumannNo13Draft();
  assert.equal(schumannNo13WrittenFacts.bars.length, 28);
  assert.deepEqual(schumannNo13WrittenFacts.bars.map(b => b.duration), ['1/8', ...Array(9).fill('1/2'), '3/8', '1/8', ...Array(15).fill('1/2'), '3/8']);
  assert.equal(schumannNo13WrittenFacts.occurrences.length, 56);
  assert.equal(score.totalTicks, 4992);
  assert.equal(schumannNo13WrittenFacts.events.length,356);
  const projectedWrittenPitchMembers = schumannNo13WrittenFacts.events.filter(e=>e.kind==='note')
    .reduce((n,e)=>n+2*e.pitches.length,0);
  assert.equal(projectedWrittenPitchMembers,802);
  assert.equal(schumannNo13WrittenFacts.occurrenceTies?.length,18);
  assert.equal(score.notes.length, projectedWrittenPitchMembers-schumannNo13WrittenFacts.occurrenceTies!.length);
  assert.equal(score.notes.length, 784);
  assert.equal(score.graceGroups?.length, 20);
  assert.equal(score.graceGroups!.reduce((n,g)=>n+g.occurrences.length,0), 40);
  for (const g of score.graceGroups!) for (const occurrence of g.occurrences) {
    assert.equal(occurrence.sourceBar, g.source.bar);
    assert.equal(occurrence.hostNoteIds.length, schumannNo13WrittenFacts.events.find(e => e.id === g.hostEventId)?.pitches.length ?? 0);
    for (const id of occurrence.hostNoteIds) assert.ok(score.notes.some(n => n.id === id));
    assert.ok(score.notes.every(n => !n.id.startsWith(g.id + ':')));
  }
  assert.deepEqual(schumannNo13WrittenFacts.repeats.map(r=>[r.start,r.end]), [[0,10],[11,27]]);
  const fraction = (s: string) => { const [a,b=1] = s.split('/').map(Number); return a/b; };
  let start = 0;
  for (const bar of schumannNo13WrittenFacts.bars) {
    const end = start + fraction(bar.duration);
    for (const e of schumannNo13WrittenFacts.events.filter(e=>e.bar===bar.number)) {
      assert.ok(fraction(e.onset) >= start - 1e-8 && fraction(e.onset) + fraction(e.duration) <= end + 1e-8,
        `bar ${bar.number}: ${e.id} ${e.onset}+${e.duration} outside [${start},${end}]`);
    }
    start = end;
  }
});

test('unsupported ornaments and missing pitched host fail with source position, not omission', () => {
  const wrap = (body: string) => `\\score { \\new Staff = "upper" { \\relative c'' { \\time 2/4 ${body} } } }`;
  const id = { file: 'literal-grace.ly', hash: '', number: 13 as const };
  assert.throws(()=>importSchumann(wrap('\\grace { c16[ d16] }'), id), /literal-grace.ly:1:.*Grace has no following written host/);
  assert.throws(()=>importSchumann(wrap('\\grace { c16 \\turn } d4'), id), /literal-grace.ly:1:.*Unsupported grace member/);
  assert.throws(()=>importSchumann(wrap('\\grace c8 r4'), id), /literal-grace.ly:1:.*Pitched grace has no note\/chord host/);
  assert.throws(()=>importSchumann(wrap('\\grace c8 << { d4 } \\\\ { e4 } >>'), id), /literal-grace.ly:1:.*Ambiguous grace host/);
  assert.throws(()=>importSchumann(wrap('c4*1/7'), id), /Non-integral or unsafe tick/);
});

test('tiny literal relative fixture: grace stays zero time and updates host anchor/value inheritance', () => {
  const source = `\\score { \\new Staff = "upper" { \\relative c'' { \\time 2/4 \\partial 8 b8 | \\grace { cis,16[ fis16] } b4 a4 | } } }`;
  const result = importSchumann(source,{file:'literal-relative.ly',hash:'',number:13});
  assert.deepEqual(result.facts.graceGroups![0].members.map(m=>[lin(m),m.duration,m.beamStart,m.beamEnd]),
    [[49,'1/16',true,false],[54,'1/16',false,true]]);
  assert.deepEqual(result.facts.events.filter(e=>e.kind==='note').map(e=>[e.onset,e.duration,e.pitches[0].absolutePitch]),
    [['0','1/8',59],['1/8','1/4',59],['3/8','1/4',57]]);
  assert.deepEqual(result.facts.bars.map(b=>b.duration),['1/8','1/2']);
  assert.equal(result.score.notes.length,3);
});

test('real No. 13 candidate engraves all pitched occurrences across its complete pages', () => {
  const entry = createStudioConfig().scores['schumann-op68-no13'];
  const layouts = layoutJankoScore(entry.score, entry.options, entry.tokens);
  assert.equal(layouts.length,56, 'one literal source bar per system, including both pickups/shortened endings');
  assert.deepEqual(entry.score.sourceBarTicks?.slice(10,13), [888,960,984], 'first short ending / repeated pickup / next bar are separate source bars');
  assert.deepEqual(entry.score.sourceBarTicks?.slice(22,24), [1920,1944], 'second half begins with its own eighth pickup');
  const opening = layouts[2].grace!.find(g=>g.group.source.line===84)!;
  assert.equal(opening.occurrence.tick,entry.score.sourceBarTicks![2]);
  assert.ok(opening.heads[0].x > layouts[2].geometry.staffLeft + 1);
  assert.ok(Math.abs(Math.abs(opening.heads[0].y-opening.heads[1].y) - 5*entry.tokens.semitoneScale)<1e-6,
    'scaled heads retain the real five-semitone pitch-axis distance');
  const chord = layouts.flatMap(l=>l.grace ?? []).find(g=>g.group.source.line===87)!;
  assert.equal(chord.occurrence.hostNoteIds.length,2);
  assert.ok(layouts.some(l => l.grace?.some(g=>g.group.source.line===84 && g.occurrence.pass===2)), 'second-pass occurrence has its own ink');
  assert.equal(layouts.reduce((n,l)=>n+(l.grace?.length ?? 0),0),16);
  const beams = layouts.flatMap(l=>l.grace ?? []).filter(g=>g.heads.length===2);
  assert.equal(beams.length,10);
  const pages = countJankoPages(entry.score, entry.options, entry.tokens);
  assert.equal(pages,19);
  const svg = Array.from({length:pages},(_,i)=>renderJankoPage(entry.score,i,entry.options,entry.tokens,layouts)).join('');
  assert.equal((svg.match(/class="janko-grace"/g) ?? []).length,16);
  assert.equal((svg.match(/class="janko-grace-beam"/g) ?? []).length,20);
  assert.equal((svg.match(/class="janko-grace-flag"/g) ?? []).length,6);
  for (const [measure,line] of [[3,84],[9,90],[23,96],[29,105]]) {
    const crop = renderJankoCrop(entry.score,measure,1,entry.options,entry.tokens,layouts);
    assert.ok(crop.includes(`13-Mai-cher-Mai.ly:${line}:`), `literal window m.${measure} includes source line ${line} grace`);
  }
  const report = lintJankoScore(entry.score,entry.options,entry.tokens);
  assert.deepEqual(report.violations.filter(v=>v.code.startsWith('grace-')), [],
    JSON.stringify(report.violations.filter(v=>v.code.startsWith('grace-'))));
  assert.deepEqual([...new Set(report.violations.map(v=>v.code))].sort(), ['stem-through-simultaneity','tie-endpoint-clearance']);
  assert.equal(report.violations.length, 16, JSON.stringify(report.violations.map(v=>[v.code,v.system])));

});
