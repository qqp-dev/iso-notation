# Ticket: All 12-TET Phonetics Strictly Lowercase

## Kind

bounded — update 12-TET canonical phonetics to strictly lowercase syllables and consonants (ma, di, va, pi, la, ri, na, ti, fa, bi, sa, ki).

## Problem

The operator specified: "not m / Ma, m / ma if anything. phonetics all lowercase", and "first is 0 so m0 m1 etc." for piano octaves.
Currently `CANONICAL_PHONETICS` and notehead morphology use capitalized syllables (`Ma, Di, Va, Pi, La, Ri, Na, Ti, Fa, Bi, Sa, Ki`) and uppercase consonants (`M, D, V, P, L, R, N, T, F, B, S, K`). These must be updated so all consonants and syllables are strictly lowercase:
- Row 0 (-a): `ma`, `va`, `la`, `na`, `fa`, `sa`
- Row 1 (-i): `di`, `pi`, `ri`, `ti`, `bi`, `ki`

Additionally, octaves on the 88-key piano are 0-indexed starting at `m0` for the lowest piano C (traditionally C1, MIDI 24):
- 1st C on piano = `m0`
- 2nd C on piano = `m1`
- 3rd C on piano = `m2`
- 4th C on piano (Middle C) = `m3`
- 5th C on piano = `m4`
- 6th C on piano = `m5`
- 7th C on piano = `m6`
- 8th C on piano = `m7`

## Testing plan

1. **Strictly Lowercase Phonetics Invariant**:
   - Every `PhoneticDefinition` in `CANONICAL_PHONETICS` has lowercase `consonant` (`m, d, v, p, l, r, n, t, f, b, s, k`) and lowercase `syllable` (`ma, di, va, pi, la, ri, na, ti, fa, bi, sa, ki`).
   - `getCanonicalSyllable(pc)` returns lowercase string (e.g. `'ma'`, `'di'`).
2. **0-Indexed Piano Octave Marker Invariant**:
   - Piano octave boundaries render as `m0`, `m1`, `m2`, `m3`, `m4`... where Middle C is `m3`.
   - In `print-layout.ts` and `score-canvas.ts`, displayed octave is `m${oct - 1}`.
3. **Notehead Morphology & Pitch Label Invariant**:
   - Phonetic noteheads rendered in canvas and SVG use strictly lowercase text.
   - `pitchLabel(pitch, 'phonetic')` formats as `ma4`, `di4`, etc.
3. **Verification**:
   - Unit tests updated in `test/phonetics.test.ts`, `test/pitch.test.ts`, `test/notation-variations.test.ts`.
   - `npm test` passes cleanly.
   - `npm run build` succeeds cleanly.

## [bounded]

### Budget

1 quick iteration.

### Solution

1. In `src/model/phonetics.ts`:
   - Update `CANONICAL_PHONETICS` table so all `consonant` and `syllable` entries are strictly lowercase (`'m'`, `'ma'`, `'d'`, `'di'`, etc.).
   - Update helper functions / reverse lookup maps to work with lowercase tokens.
2. In `src/render/print-layout.ts` & `src/render/score-canvas.ts`:
   - Ensure phonetic notehead text rendering displays lowercase syllable.
   - Piano octaves are 0-indexed starting at `m0` for the lowest piano C (traditionally C1, MIDI 24). Middle C (C4, MIDI 60) is `m3`. The displayed octave index on the 88-key piano is `m${oct - 1}` (or 0-indexed: `m0` for C1, `m1` for C2, `m2` for C3, `m3` for Middle C, `m4` for C5, `m5` for C6, `m6` for C7, `m7` for C8).
3. Update tests in `test/phonetics.test.ts`, `test/pitch.test.ts`, `test/notation-variations.test.ts`, `test/print-layout.test.ts`.

---

## Verification Results

1. **Strictly Lowercase Phonetics Invariant**:
   - Updated `CANONICAL_PHONETICS` in `src/model/phonetics.ts` so all consonants (`m, d, v, p, l, r, n, t, f, b, s, k`) and syllables (`ma, di, va, pi, la, ri, na, ti, fa, bi, sa, ki`) are strictly lowercase.
   - Verified Jánko Row 0 rhymes on flowing `-a` (`ma, va, la, na, fa, sa`) and Row 1 rhymes on percussive/rolling `-i` (`di, pi, ri, ti, bi, ki`).
   - `getCanonicalSyllable(pc)` strictly returns lowercase syllables across the entire pitch-class range (`0..11`).
   - `pitchClassFromSyllable` supports reverse lookups for both lowercase syllables (`'ma'`, `'di'`) and individual consonants (`'m'`, `'d'`).
   - Updated UI descriptions in `ControlsDrawer.tsx` and candidate presets in `PhoneticSandbox.tsx`.

2. **0-Indexed Piano Octave Markers (m0..m7)**:
   - Configured `score-canvas.ts` and `print-layout.ts` to format piano octave boundaries as `m${oct - 1}`:
     - Lowest C on 88-key piano (C1, MIDI 24) = `m0`
     - C2 = `m1`
     - C3 = `m2`
     - Middle C (C4, MIDI 60) = `m3`
     - C5 = `m4`, C6 = `m5`, C7 = `m6`, C8 = `m7`
   - Verified zero diatonic `C` labels or uppercase `M` octave markers.

3. **Notehead Morphology & Pitch Labels**:
   - Canvas notehead rendering (`score-canvas.ts`) and SVG columnar print engine (`print-layout.ts`) render strictly lowercase syllables for phonetic noteheads with white halo knockouts.
   - `pitchLabel(pitch, 'phonetic')` formats as `ma4`, `di4`, `ti5`, etc.
   - `pitchClassLabel(pc, 'phonetic')` formats as `ma`, `di`, `ti`, `ki`, etc.

4. **Automated Verification**:
   - `npm test`: 62 tests passing cleanly across all test suites (0 failures).
   - `npm run build`: cleanly builds production TypeScript and Vite bundles in ~240ms without warnings or errors.
