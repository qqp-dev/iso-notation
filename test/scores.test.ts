import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import { verifyLosslessGrid, computeOptimalGridResolution } from '../src/model/grid';
import { parseMidiToScore } from '../src/model/midi';
import { linearIndex } from '../src/model/pitch';

test('Bach Goldberg Variation 1 canonical benchmark verification', () => {
  const score = buildBachGoldbergVar1Score();

  // Invariant verification
  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);

  // Assert authentic Urtext score dimensions: 32 measures of 3/4
  assert.equal(score.id, 'bach-goldberg-var1');
  assert.equal(score.ticksPerBeat, 48);
  assert.equal(score.totalTicks, 4608); // 32 measures * 144 ticks
  assert.equal(score.notes.length, 551);

  // Minimal GCD resolution: 16th notes = 12 ticks
  const gcdRes = computeOptimalGridResolution(score.notes);
  assert.equal(gcdRes, 12);

  // Verify Hand Crossings detection
  assert.ok(score.handCrossings && score.handCrossings.length > 0, 'Should detect hand crossings');
});

test('Deterministic MIDI ingestion pipeline parses .mid losslessly into quantized fence', () => {
  const midiBuffer = fs.readFileSync('public/midi/bach-goldberg-var1.mid');
  const parsedScore = parseMidiToScore(midiBuffer, {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Variatio 1. a 1 Clav.',
    composer: 'Johann Sebastian Bach',
  });

  const verification = verifyLosslessGrid(parsedScore);
  assert.equal(verification.lossless, true, `MIDI ingest errors: ${verification.errors.join(', ')}`);

  assert.equal(parsedScore.ticksPerBeat, 48);
  assert.equal(parsedScore.totalTicks, 4608);
  assert.equal(parsedScore.notes.length, 551);
  assert.equal(computeOptimalGridResolution(parsedScore.notes), 12);

  // Assert pure numerical pitch coordinates on all notes
  for (const note of parsedScore.notes) {
    assert.ok(note.pitch.pitchClass >= 0 && note.pitch.pitchClass <= 11);
    assert.ok(note.pitch.octave >= 0);
    assert.ok(Number.isInteger(note.startTick));
    assert.ok(Number.isInteger(note.durationTicks));
    assert.ok(note.durationTicks > 0);
  }
});

/**
 * Bach pitch regression fixture (Round 14, §Testing plan).
 *
 * The canonical `src/scores/bach-goldberg-var1.ts` data is locked against the
 * **Bach-Gesellschaft** reading as typeset by JD Erickson for Mutopia and
 * vendored here as `public/midi/bach-goldberg-var1.mid`
 * (<https://www.mutopiaproject.org/ftp/BachJS/BWV988/bwv-988-v01/>, public
 * domain). The comparison is per **16th-note onset slot** — the 384 slots of
 * the 32 bars — so a single dropped, added or respelled pitch anywhere in the
 * canonical data fails the suite instead of rotting silently.
 */
test('Bach pitch regression: 0 onset-slot mismatches against the vendored Bach-Gesellschaft MIDI', () => {
  const repo = buildBachGoldbergVar1Score();
  const reading = parseMidiToScore(fs.readFileSync('public/midi/bach-goldberg-var1.mid'), {
    id: 'bach-goldberg-var1',
    title: 'Goldberg Variations, BWV 988: Variatio 1. a 1 Clav.',
    composer: 'Johann Sebastian Bach',
  });

  assert.equal(repo.totalTicks, 4608, '32 bars of 3/4 at 48 ticks per beat');
  assert.equal(reading.totalTicks, repo.totalTicks, 'the reading spans the same 32 bars');

  // Every onset + pitch + duration of the reading exists in the repo score.
  const key = (n: { startTick: number; durationTicks: number; pitch: { pitchClass: number; octave: number } }) =>
    `${n.startTick}|${n.durationTicks}|${linearIndex(n.pitch)}`;
  const repoNotes = new Set(repo.notes.map(key));
  const readingNotes = new Set(reading.notes.map(key));
  assert.deepEqual(
    [...readingNotes].filter((k) => !repoNotes.has(k)),
    [],
    'no note of the Bach-Gesellschaft reading is missing from the canonical score'
  );
  assert.deepEqual(
    [...repoNotes].filter((k) => !readingNotes.has(k)),
    [],
    'and the canonical score adds no note the reading does not carry'
  );

  // The per-slot comparison: the exact pitch set sounding at each 16th.
  const slots = repo.totalTicks / 12;
  assert.equal(slots, 384, '384 sixteenth-note slots');
  const pitchesAt = (notes: typeof repo.notes, tick: number): number[] =>
    notes
      .filter((n) => n.startTick === tick)
      .map((n) => linearIndex(n.pitch))
      .sort((a, b) => a - b);
  const mismatches: Array<{ measure: number; slot: number; tick: number }> = [];
  for (let measure = 0; measure < 32; measure++) {
    for (let slot = 0; slot < 12; slot++) {
      const tick = measure * 144 + slot * 12;
      const a = pitchesAt(repo.notes, tick);
      const b = pitchesAt(reading.notes, tick);
      if (a.length !== b.length || a.some((p, i) => p !== b[i])) {
        mismatches.push({ measure: measure + 1, slot, tick });
      }
    }
  }
  assert.deepEqual(
    mismatches,
    [],
    `0 onset-slot mismatches over the 384 slots (mismatches: ${JSON.stringify(mismatches.slice(0, 5))})`
  );
});

test('approved Bach GOLD: exact sixteen identities change hand, other 535 hands and all 551 non-hand fields stay PR112', () => {
  // PR112 source bf998efd6ac58ce8d6cb58d9ffb76038b71f484ed20343704ed9021d6b5f26a9;
  // baseline checked against its createNote declarations, not derived from the changed score.
  // Two complete modern textual source parts and the operator judgment support
  // these identities; MIDI track/staff/stem/pitch alone does not assign hands.
  const score = buildBachGoldbergVar1Score();
  const changes = [
    // [ID, measure, onset, pitch class, octave, duration, before, after]
    [68,4,552,2,3,24,'LH','RH'], [69,4,564,0,3,12,'RH','LH'],
    [348,20,2844,3,4,12,'RH','LH'], [349,20,2856,6,4,12,'RH','LH'], [350,20,2868,9,4,12,'RH','LH'],
    [351,21,2880,7,4,36,'RH','LH'], [354,21,2916,6,4,12,'RH','LH'], [355,21,2928,7,4,36,'RH','LH'],
    [360,21,2988,3,3,12,'LH','RH'], [361,21,3000,4,3,24,'LH','RH'],
    [366,22,3060,11,4,12,'RH','LH'], [367,22,3072,0,5,36,'RH','LH'],
    [372,22,3132,8,3,12,'LH','RH'], [373,22,3144,9,3,36,'LH','RH'],
    [408,24,3432,4,3,24,'LH','RH'], [409,24,3444,2,3,12,'RH','LH'],
  ] as const;
  const hash = (data: unknown) => createHash('sha256').update(JSON.stringify(data)).digest('hex');
  assert.equal(score.notes.length, 551);
  assert.deepEqual(score.notes.map(n=>n.id), Array.from({length:551},(_,i)=>`bach-var1-${i+1}`), '551 stable IDs, no additions or deletions');
  const ids = new Set(changes.map(([id]) => `bach-var1-${id}`));
  assert.equal(ids.size, 16);
  for (const [id, measure, tick, pc, octave, duration, before, after] of changes) {
    const note = score.notes.find(n=>n.id===`bach-var1-${id}`)!;
    assert.ok(note, `ID ${id} exists`);
    assert.equal(Math.floor(note.startTick / 144) + 1, measure, `m${measure} #${id}`);
    assert.deepEqual([note.startTick,note.pitch.pitchClass,note.pitch.octave,note.durationTicks,note.velocity,note.hand],
      [tick,pc,octave,duration,90,after], `m${measure} #${id}: ${before} to ${after}, otherwise identical`);
  }
  assert.equal(score.notes.filter(n=>n.hand==='RH').length,297);
  assert.equal(score.notes.filter(n=>n.hand==='LH').length,254);
  assert.equal(score.notes.filter(n=>!ids.has(n.id)).length,535);
  assert.equal(hash(score.notes.filter(n=>!ids.has(n.id)).map(n=>[n.id,n.hand])),
    'ea278f585546e25812ae332c8734229f8200e7c66cdd1536e3b1b0ed3595099b',
    'all other 535 hands stay in PR112 order');
  assert.equal(hash(score.notes.map(({hand,...fields})=>fields)),
    'd0d6479399ec8b317c0dc081f95d84f66d2f2aff5614107ebef8bfffed84a965',
    'all fields other than hand, for all 551 events, match PR112');
  assert.equal(hash(Object.fromEntries(Object.entries(score).filter(([key]) => key !== 'notes' && key !== 'handCrossings'))),
    '96cb01a53b011f7623a0e92a2b9a685baf83f5ec1a546aa1b17392583d907115',
    'score metadata stays fixed; crossings are derived from hands');
});

test('approved sixteen carry bounded textual source-part provenance without claiming historical hand marks', () => {
  const ledger=fs.readFileSync(new URL('../docs/bach-var1-gold-hands.md',import.meta.url),'utf8');
  assert.match(ledger,/Mutopia #980[\s\S]*24fcef149fc4ac2b562020f7db2c38084bee0c47c73adec9cea7134d1aa18b5c/);
  assert.match(ledger,/Knute Snortum[\s\S]*53009b0f55011c7d7f9ec54771a7ffc7a09ac519394f6773d52d2c20d1276773/);
  for (const [measure,ids,parts] of [
    ['4','68 t552 2 (D3); 69 t564 0 (C3)','soprano'],
    ['20','348 t2844 3 (D#4); 349 t2856 6 (F#4); 350 t2868 9 (A4)','bass'],
    ['21','351 t2880 7 (G4); 354 t2916 6 (F#4); 355 t2928 7 (G4)','bass'],
    ['21','360 t2988 3 (D#3); 361 t3000 4 (E3)','soprano'],
    ['22','366 t3060 B (B4); 367 t3072 0 (C5)','bass'],
    ['22','372 t3132 8 (G#3); 373 t3144 9 (A3)','soprano'],
    ['24','408 t3432 4 (E3); 409 t3444 2 (D3)','soprano'],
  ]) {
    const row=ledger.split('\n').find(line=>line.startsWith(`| ${measure} |`) && line.includes(ids));
    assert.ok(row && row.includes(parts) && row.includes('K '),`m${measure}: both textual part readings for ${ids}`);
  }
  assert.match(ledger,/not optically collated/);
  assert.match(ledger,/unresolved/i);
});

test('hand correction boundaries preserve sustained events, m5 judgment and unresolved/unison identities', () => {
  const notes = new Map(buildBachGoldbergVar1Score().notes.map(n=>[n.id,n]));
  const witness = (id:number) => { const n=notes.get(`bach-var1-${id}`)!; assert.ok(n); return n; };
  assert.deepEqual([witness(70).startTick,witness(70).hand,witness(71).startTick,witness(71).hand], [576,'LH',588,'LH']);
  assert.deepEqual([witness(343).startTick,witness(343).durationTicks,witness(343).hand], [2784,108,'RH']); // through t2892, no new m21 attack
  assert.deepEqual([witness(373).startTick,witness(373).durationTicks,witness(373).hand], [3144,36,'RH']); // through t3180
  assert.deepEqual([witness(362).startTick,witness(362).hand,witness(363).startTick,witness(363).hand], [3012,'LH',3024,'LH']);
  assert.equal(witness(374).startTick,3156);
  assert.deepEqual([witness(375).startTick,witness(375).hand], [3168,'LH'], 'm23 starts a different texture');
  assert.deepEqual([witness(282).startTick,witness(282).pitch,witness(282).durationTicks,witness(282).hand],
    [2256,{pitchClass:2,octave:4},48,'LH'], 'm16 coincident two-part D4 is unresolved: one unflipped event');
  assert.deepEqual([witness(550).startTick,witness(550).pitch,witness(550).hand,witness(551).startTick,witness(551).pitch,witness(551).hand],
    [4560,{pitchClass:7,octave:3},'RH',4560,{pitchClass:7,octave:3},'LH'], 'm32 two separate G3 events');
});

test('Hand Attribution Invariants: BWV 988 mm. 4 & 24 and playable hand spans', () => {
  const score = buildBachGoldbergVar1Score();

  // In Measure 4 (ticks 432–575), A3, G3, F#3, A3 remain RH; C3 at 564 is now LH.
  // Ticks 576 and 588 start Measure 5 and are pinned separately as LH above.
  const m4RhSixteenthTicks = [504, 516, 528, 540];
  for (const tick of m4RhSixteenthTicks) {
    const rhNotes = score.notes.filter((n) => n.startTick === tick && n.durationTicks === 12);
    assert.equal(rhNotes.length, 1, `Expected 1 sixteenth note at tick ${tick}`);
    assert.equal(rhNotes[0].hand, 'RH', `Sixteenth note at tick ${tick} must be assigned to RH`);
  }

  // D3 at 552 now RH; C3 at 564 now LH. B2 at 600 stays LH.
  const m4LhTicks = [504, 528, 564, 600];
  for (const tick of m4LhTicks) {
    const lhNotes = score.notes.filter((n) => n.startTick === tick && n.hand === 'LH');
    assert.ok(lhNotes.length >= 1, `Expected LH note at tick ${tick}`);
  }

  // In Measure 24:
  // B3, A3, G3, B3 remain RH; D3 at 3444 now LH.
  const m24RhSixteenthTicks = [3384, 3396, 3408, 3420];
  for (const tick of m24RhSixteenthTicks) {
    const rhNotes = score.notes.filter((n) => n.startTick === tick && n.durationTicks === 12);
    assert.equal(rhNotes.length, 1, `Expected 1 sixteenth note at tick ${tick}`);
    assert.equal(rhNotes[0].hand, 'RH', `Sixteenth note at tick ${tick} must be assigned to RH`);
  }

  // E3 at 3432 now RH; the earlier E3/E2 remain LH.
  const m24LhTicks = [3384, 3408, 3444];
  for (const tick of m24LhTicks) {
    const lhNotes = score.notes.filter((n) => n.startTick === tick && n.hand === 'LH');
    assert.ok(lhNotes.length >= 1, `Expected LH note at tick ${tick}`);
  }

  // Across all 32 measures of the score, no single hand plays simultaneous onsets spanning > 12 semitones.
  const onsetsByHandAndTick = new Map<string, number[]>();
  for (const note of score.notes) {
    const key = `${note.hand}-${note.startTick}`;
    const list = onsetsByHandAndTick.get(key) || [];
    list.push(linearIndex(note.pitch));
    onsetsByHandAndTick.set(key, list);
  }
  for (const [key, pitches] of onsetsByHandAndTick.entries()) {
    if (pitches.length > 1) {
      const minP = Math.min(...pitches);
      const maxP = Math.max(...pitches);
      const span = maxP - minP;
      assert.ok(span <= 12, `Hand onset ${key} has unplayable simultaneous span of ${span} semitones > 12`);
    }
  }

  // verifyLosslessGrid(score) passes.
  const verification = verifyLosslessGrid(score);
  assert.equal(verification.lossless, true, `Errors: ${verification.errors.join(', ')}`);
});
