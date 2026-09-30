import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchumannNo13Draft, schumannNo13WrittenFacts } from '../src/scores/schumann-no13-draft';
import { importSchumann } from '../src/scores/schumann-no43';
import { createStudioConfig } from '../src/render/janko/studio';
import { computePageGeometry, layoutJankoScore, renderJankoPage, renderJankoCrop, countJankoPages, systemCompleteInkBounds } from '../src/render/janko/engine';
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
    [49,54], [57,59], [63], [59,63], [62], [49,54], [57,59], [63]]);
  assert.deepEqual(pitched.map(g => g.members.map(m => [m.beamStart,m.beamEnd])), [
    [[true,false],[false,true]], [[true,false],[false,true]], [[false,false]],
    [[true,false],[false,true]], [[false,false]], [[true,false],[false,true]],
    [[true,false],[false,true]], [[false,false]]]);
  const host = (line: number) => schumannNo13WrittenFacts.events.find(e => e.id === pitched.find(g => g.source.line === line)!.hostEventId)!;
  assert.deepEqual([84,87,90].map(line => host(line).pitches.map(p => p.absolutePitch)), [[59],[54,61],[56,61]]);
  assert.equal(host(87).duration, '1/16');
  // At l.91 the first child ends E5=64, the textually following child
  // b4~ b8 gis ends G#4=56. Thus l.92 <e ais dis> starts E4=52,
  // and l.96 d' grace is D5=62, hosting F#4/C#5 (54/61), not an octave higher.
  assert.deepEqual(schumannNo13WrittenFacts.events.find(e=>e.line===92&&e.kind==='note')!.pitches.map(p=>p.absolutePitch),[52,58,63]);
  assert.deepEqual(host(96).pitches.map(p=>p.absolutePitch),[54,61]);
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
  assert.ok(layouts.length < 56, 'sparse measures share systems instead of the old one-bar-per-system fallback');
  assert.ok(layouts.some(l => l.geometry.measuresPerSystem > 1), 'at least one ordinary passage shares a system');
  assert.deepEqual(entry.score.sourceBarTicks?.slice(10,13), [888,960,984], 'first short ending / repeated pickup / next bar are separate source bars');
  assert.deepEqual(entry.score.sourceBarTicks?.slice(22,24), [1920,1944], 'second half begins with its own eighth pickup');
  const opening = layouts.flatMap(l=>l.grace ?? []).find(g=>g.group.source.line===84 && g.occurrence.pass===1)!;
  const openingSystem = layouts.find(l=>l.grace?.includes(opening))!;
  assert.equal(opening.occurrence.tick,entry.score.sourceBarTicks![2]);
  assert.ok(opening.heads[0].x > openingSystem.geometry.staffLeft + 1);
  assert.ok(Math.abs(Math.abs(opening.heads[0].y-opening.heads[1].y) - 5*entry.tokens.semitoneScale)<1e-6,
    'scaled heads retain the real five-semitone pitch-axis distance');
  const chord = layouts.flatMap(l=>l.grace ?? []).find(g=>g.group.source.line===87)!;
  assert.equal(chord.occurrence.hostNoteIds.length,2);
  assert.ok(layouts.some(l => l.grace?.some(g=>g.group.source.line===84 && g.occurrence.pass===2)), 'second-pass occurrence has its own ink');
  assert.equal(layouts.reduce((n,l)=>n+(l.grace?.length ?? 0),0),16);
  const beams = layouts.flatMap(l=>l.grace ?? []).filter(g=>g.heads.length===2);
  assert.equal(beams.length,10);
  const pages = countJankoPages(entry.score, entry.options, entry.tokens);
  assert.ok(pages < 19, 'ordinary bars no longer create nineteen three-system pages');
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
  // Historical stem/tie diagnostics may change when bars are repacked; do not
  // certify an old fixed violation count or excuse new grace-host failures.
});

test('all four imports share a literal-boundary system plan with local widths and complete page/crop coverage', () => {
  const config = createStudioConfig();
  for (const id of ['schumann-op68-no13', 'schumann-op68-no14', 'schumann-op68-no30', 'schumann-op68-no43']) {
    const { score, options, tokens } = config.scores[id];
    const ticks = score.sourceBarTicks!;
    const plan = computePageGeometry(options, tokens, score);
    const layouts = layoutJankoScore(score, options, tokens);
    const systems = plan.productionSystems!;
    assert.equal(systems.length, layouts.length, id);
    assert.deepEqual(plan.systemBarStarts, [0, ...systems.map(s => s.lastBar)], id);
    assert.equal(systems.at(-1)!.lastBar, ticks.length - 1, `${id} accounts for every written occurrence`);
    assert.ok(systems.some(s => s.lastBar - s.firstBar > 1), `${id}: at least one shared system`);
    const pages = Array.from({ length: countJankoPages(score, options, tokens) }, (_, page) =>
      renderJankoPage(score, page, options, tokens, layouts));
    const bookedSystems = pages.map(svg => [...svg.matchAll(/id="system-(\d+)"/g)].map(match => Number(match[1]) - 1));
    assert.deepEqual(bookedSystems.flat(), layouts.map((_, index) => index),
      `${id}: every planned system is painted exactly once, in page order`);
    assert.ok(bookedSystems.every(systemIds => systemIds.length > 0 && systemIds.length <= options.systemsPerPage),
      `${id}: no blank page or overbooked page`);
    for (const [index, system] of systems.entries()) {
      const geo = layouts[index].geometry;
      assert.equal(geo.firstBar, system.firstBar);
      assert.equal(geo.sourceBarTicks?.[geo.firstBar!], ticks[system.firstBar]);
      assert.equal(geo.measureEdges?.length, system.lastBar - system.firstBar + 1);
      assert.ok(system.widths.every((w, m) => w + 1e-6 >= system.minimums[m]),
        `${id} system ${index}: each bar reserves its own occupied ink`);
      assert.ok(geo.measureEdges!.every((x, m) => m === 0 || x > geo.measureEdges![m - 1]),
        `${id} system ${index}: strictly increasing barline boundaries`);
      assert.ok(Math.abs(geo.measureEdges!.at(-1)! - geo.staffRight) < 1e-6);
      for (const note of layouts[index].notes) assert.ok(note.note.startTick >= ticks[system.firstBar] &&
        note.note.startTick < ticks[system.lastBar], `${id}: ${note.note.id} projected into its literal system`);
    }
    for (const bar of [0, Math.floor((ticks.length - 2) / 2), ticks.length - 2]) {
      const crop = renderJankoCrop(score, bar + 1, 1, options, tokens, layouts);
      assert.match(crop, /<svg/);
      assert.match(crop, new RegExp(`m\\. ${bar + 1}(?![0-9])`), `${id}: crop addresses occurrence ${bar + 1}`);
    }
  }
});

test('vertical admission books three dense imported systems per page when four cannot fit', () => {
  // Sixteen literal bars, in two simultaneous printed staves: the extreme
  // pitches make each of four otherwise ordinary four-bar systems tall. Use
  // the actual ink demand to choose a constrained page between the three-
  // and four-system capacities, rather than guessing a score-specific offset.
  const bars = Array(16).fill('c4 c4 |').join(' ');
  const source = String.raw`\score {
    \new PianoStaff <<
      \new Staff = "upper" { \relative c''' { \time 2/4 ${bars} } }
      \new Staff = "lower" { \relative c { \time 2/4 ${bars} } }
    >>
  }`;
  const score = importSchumann(source, { file: 'vertical-demand.ly', hash: '', number: 13 }).score;
  const entry = createStudioConfig().scores['schumann-op68-no13'];
  const { tokens } = entry;
  const roomy = { ...entry.options, pageHeight: 841.89 };
  const reference = layoutJankoScore(score, roomy, tokens);
  assert.equal(score.sourceBarTicks?.length, 17, 'source has sixteen real written bars');
  assert.equal(reference.length, 4, 'horizontal content fits four bars in each system');
  const heights = reference.map(layout => {
    const ink = systemCompleteInkBounds(layout, roomy, tokens);
    return ink.bottom - ink.top;
  });
  const minimumGap = 10;
  const bodyHeight = 3 * Math.max(...heights) + 2 * minimumGap + 12;
  assert.ok(bodyHeight < heights.reduce((sum, height) => sum + height, 0) + 3 * minimumGap,
    'fixture separates feasible three-system booking from infeasible four-system booking');
  const options = { ...roomy, pageHeight: bodyHeight + (roomy.pageMarginTop ?? roomy.pageMargin) +
    (roomy.pageMarginBottom ?? roomy.pageMargin) + roomy.headerHeight + roomy.footerHeight };
  const layouts = layoutJankoScore(score, options, tokens);
  const pages = Array.from({ length: countJankoPages(score, options, tokens) }, (_, page) =>
    renderJankoPage(score, page, options, tokens, layouts));
  const pageSystems = pages.map(svg => [...svg.matchAll(/id="system-(\d+)"/g)].map(match => Number(match[1]) - 1));
  assert.deepEqual(pageSystems, [[0, 1, 2], [3]], 'one impossible fourth system moves intact to the next page');
  const top = (options.pageMarginTop ?? options.pageMargin) + options.headerHeight;
  const bottom = options.pageHeight - (options.pageMarginBottom ?? options.pageMargin) - options.footerHeight;
  for (const ids of pageSystems) {
    const ink = ids.map(id => systemCompleteInkBounds(layouts[id], options, tokens));
    assert.ok(ink[0].top >= top - 1e-6 && ink.at(-1)!.bottom <= bottom + 1e-6,
      'complete painted system ink stays in the page body');
    for (let i = 1; i < ink.length; i++) assert.ok(ink[i].top - ink[i - 1].bottom >= minimumGap - 1e-6,
      'adjacent complete ink has protected facing air');
  }
  assert.deepEqual(layouts.map(l => [l.geometry.firstBar, l.geometry.sourceBarTicks?.[l.geometry.firstBar!]]),
    [[0,score.sourceBarTicks![0]],[4,score.sourceBarTicks![4]],
      [8,score.sourceBarTicks![8]],[12,score.sourceBarTicks![12]]],
    'page break never changes source bar clocks or system membership');
  const crossing = renderJankoCrop(score, 12, 2, options, tokens, layouts);
  assert.match(crossing, /id="system-3"/);
  assert.match(crossing, /id="system-4"/);
  assert.match(crossing, /mm\. 12–13/, 'cross-page window retains both literal measures');
});
