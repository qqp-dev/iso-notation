/**
 * Brahms Op. 118 No. 1 — written-durations source fidelity (duration milestone).
 *
 * First bounded correction: playback-derived durations replaced by LilyPond
 * parsed written durations (pre-playback NoteEvents + explicit ties, repeats
 * unfolded by LilyPond). Goldberg stays frozen (see janko-goldberg-frozen).
 * Full musical fidelity and operator visual acceptance are NOT claimed here;
 * dynamics/pedal/articulation-display/voices/hand-intent/phrasing/form remain
 * explicit subsequent tasks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMidiToScore } from '../src/model/midi';
import {
  BRAHMS_OP118_NO1_TOTAL_TICKS,
  buildBrahmsOp118No1Score,
  getBrahmsMidiData,
} from '../src/scores/brahms-op118-no1';
import {
  applyWrittenDurations,
  brahmsEventKey,
  normalizeWrittenDurations,
} from '../src/scores/brahms-source-fidelity';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'src', 'scores', 'data', 'brahms-op118-no1-written-durations.json');
const PROVENANCE_PATH = path.join(
  REPO_ROOT,
  'src',
  'scores',
  'data',
  'brahms-op118-no1-written-durations.provenance.json'
);
const MANIFEST_PATH = path.join(REPO_ROOT, 'data', 'sources', 'brahms-op118-no1', 'manifest.json');

interface FixtureDuration {
  pitchClass: number;
  octave: number;
  startTick: number;
  hand: 'RH' | 'LH';
  durationTicks: number;
}
interface FixtureDoc {
  version: number;
  exporterVersion: number;
  count: number;
  totalTicks: number;
  durations: FixtureDuration[];
}
interface ProvSegment {
  voice: string;
  staff: string;
  onset: string;
  duration: string;
  startTick: number;
  durationTicks: number;
  midi: number;
  file: string;
  line: number;
  col: number;
  bar: number;
  occurrence: number;
  tieForward: boolean;
  tieWait: boolean;
}
interface ProvEvent extends FixtureDuration {
  voices: string[];
  staves: string[];
  unison: boolean;
  segments: ProvSegment[];
}
interface ProvDoc {
  version: number;
  fixtureSha256: string;
  count: number;
  events: ProvEvent[];
}

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as FixtureDoc;
const provenance = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8')) as ProvDoc;
const SCORE = buildBrahmsOp118No1Score();
const provByKey = new Map(provenance.events.map((e) => [brahmsEventKey(e.pitchClass, e.octave, e.startTick, e.hand), e]));
const fixByKey = new Map(fixture.durations.map((d) => [brahmsEventKey(d.pitchClass, d.octave, d.startTick, d.hand), d]));

/** Reconstruct pre-overlay MIDI notes (IDs/order as the builder assigns). */
function buildPreOverlayNotes() {
  const parsed = parseMidiToScore(getBrahmsMidiData(), {
    id: 'brahms-op118-no1',
    title: 'Intermezzo in A minor, Op. 118 No. 1',
    composer: 'Johannes Brahms',
  });
  return parsed.notes
    .filter((n) => n.startTick < BRAHMS_OP118_NO1_TOTAL_TICKS)
    .map((n, idx) => ({ ...n, id: `brahms-op118-no1-${idx + 1}` }));
}

test('fixture is versioned, complete and provenance-linked', () => {
  assert.equal(fixture.version, 1);
  assert.equal(fixture.count, 964);
  assert.equal(fixture.durations.length, 964);
  assert.equal(fixture.totalTicks, BRAHMS_OP118_NO1_TOTAL_TICKS);
  assert.equal(provenance.version, 1);
  assert.equal(provenance.count, 964);
  const fixtureSha = crypto.createHash('sha256').update(fs.readFileSync(FIXTURE_PATH)).digest('hex');
  assert.equal(provenance.fixtureSha256, fixtureSha);
  // Stable ordering, relative paths, no machine-local leaks or timestamps.
  const raw = fs.readFileSync(FIXTURE_PATH, 'utf8');
  assert.ok(!raw.includes('/tmp/') && !raw.includes('/home/'), 'fixture leaks absolute paths');
  assert.ok(!/20\d\d-\d\d-\d\d/.test(raw), 'fixture contains timestamps');
  for (const e of provenance.events) {
    assert.ok(e.segments.length >= 1, 'every event has source correspondence');
    for (const s of e.segments) {
      assert.ok(s.file.startsWith('includes/'), `relative source path: ${s.file}`);
      assert.ok(s.line > 0 && s.col > 0);
      assert.ok(s.bar >= 1 && s.occurrence >= 1);
    }
    assert.ok(!JSON.stringify(e).includes('playback'), 'no playback-duration reference as truth');
  }
});

test('964 pitch/onset/hand keys reconcile exactly with multiplicity 1', () => {
  assert.equal(SCORE.notes.length, 964);
  const seen = new Set<string>();
  for (const n of SCORE.notes) {
    const k = brahmsEventKey(n.pitch.pitchClass, n.pitch.octave, n.startTick, n.hand);
    assert.ok(!seen.has(k), `duplicate score key ${k}`);
    seen.add(k);
    assert.ok(fixByKey.has(k), `score key lacks fixture entry: ${k} (${n.id})`);
    assert.ok(provByKey.has(k), `score key lacks provenance: ${k}`);
  }
  assert.equal(fixByKey.size, 964);
  for (const k of fixByKey.keys()) assert.ok(seen.has(k), `fixture key lacks score note: ${k}`);
});

test('overlay changes durationTicks only; IDs/order/pitch/onset/hand/velocity preserved', () => {
  const pre = buildPreOverlayNotes();
  assert.equal(pre.length, SCORE.notes.length);
  let changed = 0;
  for (let i = 0; i < pre.length; i++) {
    const a = pre[i];
    const b = SCORE.notes[i];
    assert.equal(b.id, a.id);
    assert.deepEqual(b.pitch, a.pitch);
    assert.equal(b.startTick, a.startTick);
    assert.equal(b.hand, a.hand);
    assert.equal(b.velocity, a.velocity);
    if (a.durationTicks !== b.durationTicks) changed++;
  }
  assert.ok(changed > 200, `expected hundreds of corrected durations, got ${changed}`);
  assert.equal(SCORE.totalTicks, BRAHMS_OP118_NO1_TOTAL_TICKS);
});

test('overlay has no silent fallback: missing/malformed/extra fixture entries throw', () => {
  const pre = buildPreOverlayNotes();
  assert.throws(
    () => applyWrittenDurations(pre.slice(0, 10), fixture.durations),
    /fixture has 964 entries for 10 notes/
  );
  const missingOne = fixture.durations.filter(
    (_, i) => i !== 0
  );
  assert.throws(() => applyWrittenDurations(pre, missingOne), /no fixture entry/);
  const dup = [...fixture.durations, fixture.durations[0]];
  assert.throws(() => applyWrittenDurations(pre, dup), /duplicate key/);
  const badDur = fixture.durations.map((d, i) => (i === 0 ? { ...d, durationTicks: 0 } : d));
  assert.throws(() => applyWrittenDurations(pre, badDur), /invalid duration/);
});

test('literal whole note: rightHandLower line 114 / ID 5 / tick 48 is 192, not 168', () => {
  const n = SCORE.notes.find((x) => x.id === 'brahms-op118-no1-5')!;
  assert.equal(n.startTick, 48);
  assert.equal(n.durationTicks, 192);
  const prov = provByKey.get(brahmsEventKey(n.pitch.pitchClass, n.pitch.octave, n.startTick, n.hand))!;
  assert.equal(prov.segments.length, 1);
  assert.equal(prov.segments[0].line, 114);
  assert.equal(prov.segments[0].duration, '1/1');
  assert.equal(prov.segments[0].voice, 'rightHandLower');
});

test('staccato eighths: line 327 / IDs 953+954 / ticks 13392+13416 are 24, not 18 or 12', () => {
  for (const [id, tick] of [
    ['brahms-op118-no1-953', 13392],
    ['brahms-op118-no1-954', 13416],
  ] as const) {
    const n = SCORE.notes.find((x) => x.id === id)!;
    assert.equal(n.startTick, tick);
    assert.equal(n.durationTicks, 24);
    const prov = provByKey.get(brahmsEventKey(n.pitch.pitchClass, n.pitch.octave, n.startTick, n.hand))!;
    assert.equal(prov.segments[0].line, 327);
    assert.equal(prov.segments[0].duration, '1/8');
  }
  // Articulation never changes written duration: the source line carries
  // staccato wedges ("-.") yet the written value stays a full eighth.
  const witnessLine = fs
    .readFileSync(path.join(REPO_ROOT, 'data/sources/brahms-op118-no1/includes/intermezzo-op118-no1-parts.ily'), 'utf8')
    .split('\n')[326];
  assert.ok(witnessLine.includes('-.') && witnessLine.includes('cs8'), 'line 327 carries the staccato passage');
});

test('legitimate tied 168 ticks survive (hidden 8th + dotted half, line 268+269)', () => {
  const k = brahmsEventKey(9, 3, 216, 'LH');
  const d = fixByKey.get(k)!;
  assert.equal(d.durationTicks, 168);
  const prov = provByKey.get(k)!;
  const lines = prov.segments.map((s) => s.line);
  assert.ok(lines.includes(268) && lines.includes(269), `tied segments span lines 268+269: ${lines}`);
  assert.ok(prov.segments.length >= 2, 'multi-segment tie, not a playback artifact');
});

test('legitimate tied 120 ticks survive (chord half + eighth, line 61)', () => {
  const k = brahmsEventKey(0, 6, 4080, 'RH');
  const d = fixByKey.get(k)!;
  assert.equal(d.durationTicks, 120);
  const prov = provByKey.get(k)!;
  assert.equal(prov.segments.length, 2);
  assert.deepEqual(
    prov.segments.map((s) => s.duration),
    ['1/2', '1/8']
  );
  assert.ok(prov.segments.every((s) => s.line === 61));
});

test('ties merge, reattacks stay separate (same pitch, adjacent, no tie)', () => {
  // Tied: 120-tick chain above has 2 segments merged into one event.
  const tied = provByKey.get(brahmsEventKey(0, 6, 4080, 'RH'))!;
  assert.equal(tied.segments.length, 2);
  // Reattack: RHU A4 at ticks 11280+11376 (lines 90+91), adjacent 96-tick
  // notes without a tie remain two events.
  const first = provByKey.get(brahmsEventKey(9, 4, 11280, 'RH'))!;
  const second = provByKey.get(brahmsEventKey(9, 4, 11376, 'RH'))!;
  assert.equal(first.durationTicks, 96);
  assert.equal(second.durationTicks, 96);
  assert.equal(first.segments.length, 1);
  assert.equal(first.segments[0].tieForward, false);
  assert.equal(first.startTick + first.durationTicks, second.startTick);
});

test('partial-chord tie: line-61 chord marks all, only the top continues (tick 4080)', () => {
  const at4080 = provenance.events.filter((e) => e.startTick === 4080 && e.hand === 'RH');
  assert.equal(at4080.length, 4);
  for (const e of at4080) {
    assert.equal(e.segments[0].tieForward, true, 'chord-wide tie marks every member');
    assert.equal(e.segments[0].line, 61);
  }
  const top = at4080.find((e) => e.octave === 6)!;
  assert.equal(top.durationTicks, 120);
  assert.equal(top.segments.length, 2);
  for (const e of at4080.filter((x) => x !== top)) {
    assert.equal(e.durationTicks, 96);
    assert.equal(e.segments.length, 1, 'non-continuing chord tones stay separate (LilyPond MIDI behaviour)');
  }
});

test('simultaneous equal pitches in different voices dedup to max (F4 tick 1392)', () => {
  const e = provByKey.get(brahmsEventKey(5, 4, 1392, 'RH'))!;
  assert.equal(e.durationTicks, 96);
  assert.equal(e.unison, true);
  assert.deepEqual(e.voices, ['rightHandLower', 'rightHandUpper']);
  assert.deepEqual(
    e.segments.map((s) => s.durationTicks).sort((a, b) => a - b),
    [48, 96]
  );
});

test('cross-staff keeps voice identity while hand follows the track baseline (line 62)', () => {
  const e = provByKey.get(brahmsEventKey(0, 4, 4392, 'LH'))!;
  assert.deepEqual(e.voices, ['rightHandUpper']);
  assert.deepEqual(e.staves, ['lower']);
  assert.equal(e.hand, 'LH');
  assert.equal(e.segments[0].line, 62);
  assert.equal(e.segments[0].voice, 'rightHandUpper');
  assert.equal(e.segments[0].staff, 'lower');
});

test('written-to-unfolded map: pickup, repeats, alternatives, closing partial bar', () => {
  // Pickup origin explicit: line-44 pickup appears twice (occurrences 1+2).
  const pickupOrigins = provenance.events
    .flatMap((e) => e.segments.map((s) => ({ e, s })))
    .filter(({ s }) => s.line === 44 && s.col === 16);
  assert.equal(pickupOrigins.length, 2);
  assert.deepEqual(
    pickupOrigins.map(({ s }) => s.occurrence).sort(),
    [1, 2]
  );
  assert.deepEqual(
    pickupOrigins.map(({ e }) => e.startTick).sort((a, b) => a - b),
    [0, 1920]
  );
  // Alternatives are distinct origins (RHU alt1 line 85 vs alt2 line 90).
  const alt1 = provenance.events.filter((e) => e.segments.some((s) => s.line === 85));
  const alt2 = provenance.events.filter((e) => e.segments.some((s) => s.line === 90));
  assert.ok(alt1.length > 0 && alt2.length > 0);
  const alt1Keys = new Set(alt1.map((e) => brahmsEventKey(e.pitchClass, e.octave, e.startTick, e.hand)));
  for (const e of alt2) {
    assert.ok(!alt1Keys.has(brahmsEventKey(e.pitchClass, e.octave, e.startTick, e.hand)));
  }
  // Closing partial bar: tick 13488 + 144 = 13632, unfolded bar 71.
  const closing = provenance.events.filter((e) => e.startTick === 13488);
  assert.ok(closing.length >= 4);
  for (const e of closing) {
    assert.equal(e.durationTicks, 144);
    assert.equal(e.segments[0].bar, 71);
  }
  assert.equal(Math.max(...provenance.events.flatMap((e) => e.segments.map((s) => s.bar))), 71);
});

test('exact rational conversion: representable fractions pass, fractional grid ticks throw', () => {
  const seg = (onsetNum: number, onsetDen: number, durNum: number, durDen: number) => ({
    voice: 'rightHandUpper',
    staff: 'upper',
    onsetNum,
    onsetDen,
    durNum,
    durDen,
    semi: 0,
    hasTie: false,
    file: 'includes/test.ily',
    line: 1,
    col: 1,
    bar: 1,
    tieWait: false,
  });
  // Dotted quarter scaled by 1/3 (witness mm. 39–40): 3/8 * 1/3 = 1/8 → 24 ticks.
  const ok = normalizeWrittenDurations([
    { voice: 'rightHandUpper', segments: [seg(0, 1, 1, 8)], ties: [] },
    { voice: 'rightHandLower', segments: [], ties: [] },
    { voice: 'leftHandUpper', segments: [], ties: [] },
    { voice: 'leftHandLower', segments: [], ties: [] },
  ]);
  assert.equal(ok.events[0].durationTicks, 24);
  // 1/7 whole note is not representable on the 192 grid → no rounding.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        { voice: 'rightHandUpper', segments: [seg(0, 1, 1, 7)], ties: [] },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /fractional grid tick/
  );
  // Non-positive and negative times throw.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        { voice: 'rightHandUpper', segments: [seg(0, 1, 0, 1)], ties: [] },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /non-positive duration/
  );
});

test('normalizer rejects dangling, ambiguous and same-voice-duplicate ties with diagnostics', () => {
  const seg = (over: Record<string, unknown>) => ({
    voice: 'rightHandUpper',
    staff: 'upper',
    onsetNum: 0,
    onsetDen: 1,
    durNum: 1,
    durDen: 4,
    semi: 0,
    hasTie: false,
    file: 'includes/test.ily',
    line: 1,
    col: 1,
    bar: 1,
    tieWait: false,
    ...over,
  });
  // Dangling: tie with no following same-pitch segment.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        { voice: 'rightHandUpper', segments: [seg({ hasTie: true })], ties: [{ onsetNum: 0, onsetDen: 1 }] },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /dangling tie/
  );
  // Ambiguous: per-note flag + stream tie on a 2-note onset.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        {
          voice: 'rightHandUpper',
          segments: [seg({ semi: 0, hasTie: true, col: 1 }), seg({ semi: 4, hasTie: false, col: 5 })],
          ties: [{ onsetNum: 0, onsetDen: 1 }],
        },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /ambiguous tie evidence/
  );
  // Same-voice duplicate key.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        {
          voice: 'rightHandUpper',
          segments: [seg({ col: 1 }), seg({ col: 9 })],
          ties: [],
        },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /duplicated event key/
  );
  // Unknown staff and unknown voice.
  assert.throws(
    () =>
      normalizeWrittenDurations([
        { voice: 'rightHandUpper', segments: [seg({ staff: 'middle' })], ties: [] },
        { voice: 'rightHandLower', segments: [], ties: [] },
        { voice: 'leftHandUpper', segments: [], ties: [] },
        { voice: 'leftHandLower', segments: [], ties: [] },
      ]),
    /unknown staff/
  );
  assert.throws(
    () =>
      normalizeWrittenDurations([
        {
          voice: 'mysteryVoice',
          segments: [seg({ voice: 'mysteryVoice' })],
          ties: [],
        },
      ]),
    /unexpected voice/
  );
});

test('independent normalizer fixtures: tie/unison/tieWait and partial-chord (no compiler)', () => {
  for (const name of ['brahms-normalizer-basic.json', 'brahms-normalizer-partial-chord.json']) {
    const doc = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8')) as {
      evidence: Parameters<typeof normalizeWrittenDurations>[0];
      expected: { pitchClass: number; octave: number; startTick: number; hand: 'RH' | 'LH'; durationTicks: number }[];
    };
    const { events, provenance: prov } = normalizeWrittenDurations(doc.evidence);
    assert.equal(events.length, doc.expected.length, `${name}: event count`);
    for (let i = 0; i < doc.expected.length; i++) {
      const { pitchClass, octave, startTick, hand, durationTicks } = doc.expected[i];
      assert.deepEqual(
        events[i],
        { pitchClass, octave, startTick, hand, durationTicks },
        `${name}: event ${i}`
      );
    }
    assert.equal(prov.length, doc.expected.length);
  }
  // Basic fixture spot checks: unison max duration + tieWait gap sounding.
  const basic = JSON.parse(
    fs.readFileSync(path.join(HERE, 'fixtures', 'brahms-normalizer-basic.json'), 'utf8')
  ) as { evidence: Parameters<typeof normalizeWrittenDurations>[0] };
  const { provenance: basicProv } = normalizeWrittenDurations(basic.evidence);
  const unison = basicProv.find((e) => e.unison)!;
  assert.equal(unison.durationTicks, 192);
  const gap = basicProv.find((e) => e.durationTicks === 168)!;
  assert.equal(gap.segments.length, 2);
});

test('performance shortening cannot masquerade as a notated rest (real rest computation)', async () => {
  const { layoutJankoScore } = await import('../src/render/janko/engine');
  const { resolveJankoOptions, resolveJankoTokens } = await import('../src/render/janko/types');
  const { BRAHMS_OP118_NO1_JANKO_OPTIONS, BRAHMS_OP118_NO1_JANKO_TOKENS } = await import(
    '../src/scores/brahms-op118-no1'
  );
  const o = resolveJankoOptions({ ...BRAHMS_OP118_NO1_JANKO_OPTIONS, core: 'adaptive' });
  const t = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  // Source-grounded passage: LH staccato eighths (line 327) at 13392+13416.
  // Corrected 24-tick notes abut exactly (no gap); artificial 18-tick
  // shortening opens a 6-tick gap that the real engine notates as a rest.
  const corrected = layoutJankoScore(SCORE, o, t);
  const correctedHits = corrected.flatMap((l) => l.rests).filter((r) => r.tick === 13410);
  assert.equal(correctedHits.length, 0, 'corrected durations leave no notated rest at tick 13410');
  const shortened = {
    ...SCORE,
    notes: SCORE.notes.map((n) =>
      n.id === 'brahms-op118-no1-953' || n.id === 'brahms-op118-no1-954'
        ? { ...n, durationTicks: 18 }
        : n
    ),
  };
  const shortLayouts = layoutJankoScore(shortened, o, t);
  const shortHits = shortLayouts.flatMap((l) => l.rests).filter((r) => r.tick === 13410 && r.hand === 'LH');
  assert.equal(shortHits.length, 1, 'artificial shortening produces exactly one false LH rest');
  assert.equal(shortHits[0].durationTicks, 6);
});

test('pinned manifest matches vendored bytes (no network, ordinary validation)', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as {
    upstream: { commit: string };
    sources: { path: string; bytes: number; md5: string; sha256: string }[];
  };
  assert.equal(manifest.upstream.commit, 'b792764e004ece0498ff7fc736ab9ed7bcf44b68');
  for (const s of manifest.sources) {
    const data = fs.readFileSync(path.join(REPO_ROOT, 'data/sources/brahms-op118-no1', s.path));
    assert.equal(data.length, s.bytes, `${s.path} bytes`);
    assert.equal(crypto.createHash('md5').update(data).digest('hex'), s.md5, `${s.path} md5`);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), s.sha256, `${s.path} sha256`);
  }
  const main = manifest.sources.find((s) => s.path.endsWith('intermezzo-op118-no1-parts.ily'))!;
  assert.equal(main.bytes, 14032);
  assert.equal(main.md5, '9d794386719fc1198890aa233c2b6c6a');
});

function findCompilerForTest(): string | false {
  const candidates = [
    process.env.LILYPOND_BIN,
    'lilypond',
    '/home/linuxbrew/.linuxbrew/bin/lilypond',
  ].filter(Boolean) as string[];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 30000 });
      return bin;
    } catch {
      // Not usable; try next.
    }
  }
  return false;
}

const COMPILER_BIN = findCompilerForTest();
const NEEDS_COMPILER = COMPILER_BIN === false ? 'LilyPond compiler absent — explicit regeneration only' : false;

test('semantic microfixtures export via the real LilyPond parser (explicit regeneration)', { skip: NEEDS_COMPILER }, () => {
  const bin = COMPILER_BIN as string;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'brahms-micro-'));
  try {
    const microMusic = path.join(HERE, 'fixtures', 'brahms-micro-music.ily');
    const listener = path.join(REPO_ROOT, 'scripts', 'brahms-written-durations-listener.ly');
    const wrapper = `\\version "2.24.0"
\\language "english"
\\include "${microMusic.replace(/"/g, '\\"')}"
outDir = "${tmp.replace(/"/g, '\\"')}"
\\include "${listener.replace(/"/g, '\\"')}"
\\score {
  \\unfoldRepeats \\new PianoStaff <<
    \\new Staff = "upper" << \\new Voice = "rightHandUpper" \\microUpper >>
    \\new Staff = "lower" << \\new Voice = "leftHandLower" \\microLower >>
  >>
  \\layout { \\context { \\Voice \\consists #brahms-durations-listener } }
}
`;
    const wrapperPath = path.join(tmp, 'wrapper.ly');
    fs.writeFileSync(wrapperPath, wrapper, 'utf8');
    execFileSync(bin, ['-dno-print-pages', '-o', path.join(tmp, 'out'), wrapperPath], {
      encoding: 'utf8',
      timeout: 120000,
      stdio: 'pipe',
    });
    const readVoice = (v: string) => {
      const file = path.join(tmp, `voice-${v}.jsonl`);
      assert.ok(fs.existsSync(file), `missing voice file ${v}`);
      const segments: never[] = [];
      const ties: never[] = [];
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        const o = JSON.parse(line) as Record<string, unknown>;
        if (o.type === 'tie') {
          (ties as unknown as { onsetNum: number; onsetDen: number }[]).push({
            onsetNum: o.onsetNum as number,
            onsetDen: o.onsetDen as number,
          });
        } else {
          (segments as unknown as Record<string, unknown>[]).push({
            voice: v,
            staff: o.staff,
            onsetNum: o.onsetNum,
            onsetDen: o.onsetDen,
            durNum: o.durNum,
            durDen: o.durDen,
            semi: o.semi,
            hasTie: o.hasTie,
            file: `includes/${path.basename(String(o.file))}`,
            line: o.line,
            col: o.col,
            bar: o.bar,
            tieWait: o.tieWait,
          });
        }
      }
      return { voice: v, segments: segments as never, ties: ties as never };
    };
    const { events, provenance: prov } = normalizeWrittenDurations([
      readVoice('rightHandUpper'),
      readVoice('leftHandLower'),
    ]);
    // Hand-computed from the micro source rhythms (independent of exporter):
    // c4(48) e1(192) d8(24) tied e(384) f2/g4/a4/b2/f2/g4/a4/c2.
    assert.equal(events.length, 12);
    const durs = events.map((e) => e.durationTicks).sort((a, b) => a - b);
    assert.deepEqual(durs, [24, 48, 48, 48, 48, 48, 96, 96, 96, 96, 192, 384]);
    const tied = prov.find((e) => e.durationTicks === 384)!;
    assert.equal(tied.segments.length, 2);
    // Repeat occurrence: body f2 shares one origin across two onsets.
    const byOrigin = new Map<string, typeof prov>();
    for (const e of prov) {
      for (const s of e.segments) {
        const k = `${s.file}:${s.line}:${s.col}:${s.midi}`;
        if (!byOrigin.has(k)) byOrigin.set(k, []);
        byOrigin.get(k)!.push(e);
      }
    }
    const repeated = [...byOrigin.values()].filter((lst) => lst.length === 2);
    assert.ok(repeated.length >= 3, 'body f2/g4/a4 each repeat once');
    for (const lst of repeated) {
      assert.notEqual(lst[0].startTick, lst[1].startTick);
    }
    // Alternatives are distinct origins (no shared line between alt endings).
    const altEvents = prov.filter((e) => e.durationTicks === 96 && e.segments.length === 1);
    const altLines = new Set(altEvents.flatMap((e) => e.segments.map((s) => s.line)));
    assert.ok(altLines.size >= 2, 'alternatives use distinct source lines');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('clean regeneration reproduces the committed fixture (explicit, compiler)', { skip: NEEDS_COMPILER }, () => {
  // The configured command runs LilyPond twice internally and requires
  // byte-identical raw evidence; --check additionally requires the committed
  // fixture/provenance events to match a fresh export (compiler block
  // normalized for version portability).
  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/brahms-export-written-durations.ts', '--check'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 300000,
    stdio: 'pipe',
  });
});
