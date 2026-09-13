# Round 13: Voice Contour Rests, Flared 0.65pt Start Bracket, Multi-System Crop Robustness & Beam Discontinuity Across Rests

## Context & Objectives
User review of Round 12 identified critical bugs and clear aesthetic direction:
1. **The "Empty White Pages" Bug (`computeCropBox` Multi-System Failure)**:
   - When a crop spans multiple systems (e.g. mm. 27–29 crossing from System 6 into System 7), `computeCropBox` computed $x_0$ from measure 27 and $x_1$ from measure 29, resulting in a negative width clamped to `w = 1.00pt`. This rendered a 1px invisible strip on a white canvas.
   - Fix `computeCropBox` in `engine.ts` so multi-system crops span from `geo.margin - CROP_PAD_X` to `geo.staffRight + CROP_PAD_X`.
   - Update candidate Window 3 to **Bach mm. 27–28** (`measureStart: 27, measureCount: 2`) so the dense sixteenths and grid writing policies are tested within a single system at full width.
2. **Standardize System 1 Start Symbol: 0.65pt Bracket with Diagonally Outward Flared Spurs**:
   - The user selected the 0.65pt line weight with spurs extending slightly diagonally outwards.
   - Implement this flared architectural bracket: a straight 0.65pt vertical rule clasping Octaves 5 through 2, where the top spur extends rightward and flares slightly diagonally upward/outward (~12°–15° upward flare) and the bottom spur flares slightly diagonally downward/outward (~12°–15° downward flare).
3. **Rest Vertical Placement: Voice Contour Alignment (Fix the $y = 136$ Sky-Floating Rest)**:
   - The engine previously hardcoded RH rests to the Octave 4 equator ($y = 136.0\text{pt}$), floating 30pt above the music in m. 4 beat 3 where notes are moving in Octave 3 ($y \approx 166$).
   - Position voice rests directly along the melodic voice contour of the surrounding notes ($y = (y_{\text{prev}} + y_{\text{next}}) / 2$ or snapped to the active octave equator). In m. 4 beat 3, the RH rest at tick 552 sits at $y \approx 166.0$, smoothly nestled between note 9 ($y = 158.5$) and note 0 ($y = 173.5$).
4. **Beam Partitioning Discontinuity Across Rests**:
   - In `partitionBeamGroups`, notes 528, 540, and 564 were beamed together across the rest at 552 because the onset gap `564 - 540 = 24` was not `> 24`.
   - Check voice continuity: if a note onset has a gap from the previous note's end (`n.startTick > prev.startTick + prev.durationTicks`), or if a rest intervenes in that hand voice, break the beam run.
   - In Bach m. 4 beat 3: notes 528 and 540 form a 2-note sixteenth beam; tick 552 is the rest; note 564 is an independent flagged sixteenth note.
5. **Four High-Fidelity Rest Candidates in Candidate Registry**:
   - **A · Authentic Classical Urtext Rest (`classical-urtext`)**: True SMuFL calligraphic vector path with slanted stem and solid teardrop hooked bulbs on the left (`𝄿` 16th, `𝄾` 8th, `𝄽` quarter, solid block for half).
   - **B · Phantom Notehead Rest (`phantom-notehead`)**: Open dashed circle ($R = 3.0\text{pt}$) at the pitch/voice level with a stem and downward-hooked flag/tab, directly replacing the unvoiced notehead.
   - **C · Geometric Pause Node (`geometric-node`)**: Minimalist diamond pause node (hollow diamond with horizontal ticks), centered on the voice contour.
   - **D · Corrected Kinetic Monoline Rest (`kinetic-monoline`)**: Monoline stem with properly downward-oriented $12.4^\circ$ kinetic tabs, positioned on the voice contour.

---

## File-by-File Implementation Plan

1. `src/render/janko/engine.ts`:
   - In `computeCropBox`:
     - If `firstSystem !== lastSystem`, set `x0 = geo.margin - CROP_PAD_X` and `x1 = geo.staffRight + CROP_PAD_X`.
   - In `computeJankoRests`:
     - Determine the vertical position $y$ of each voice rest dynamically from the surrounding notes of that hand voice within the measure (averaging surrounding notes or matching the register/equator of the voice phrase), rather than hardcoding Octave 4 / Octave 3.
2. `src/render/janko/elements/rhythm.ts`:
   - In `partitionBeamGroups`:
     - Check `n.startTick > prev.startTick + prev.durationTicks` (non-contiguous onset) to break the run immediately so beams never bridge across rests or silences.
3. `src/render/janko/elements/accolade.ts` & `src/render/janko/types.ts`:
   - Implement `renderFlaredArchitecturalBracket`: 0.65pt stroke, top spur flaring diagonally upward/outward, bottom spur flaring diagonally downward/outward.
   - Update `JankoSystemStartStyle` to support `'flared-bracket'` (or integrate as the primary architectural bracket).
4. `src/render/janko/elements/rests.ts` & `src/render/janko/types.ts`:
   - Add `phantom-notehead` rest dialect.
   - Overhaul `classical-urtext` with authentic SMuFL calligraphic vector paths (proper slanted stem, teardrop bulbs).
   - In `kinetic-monoline`, correct the tab orientation so flags hook downward to the right (`sign = 1`).
5. `src/render/janko/candidates.ts`:
   - Update round metadata to Round 13.
   - Window 3 updated to Bach mm. 27–28 (`measureStart: 27, measureCount: 2`).
   - Register the 4 candidates (Urtext, Phantom Notehead, Geometric Node, Corrected Kinetic).
6. Tests & Lint:
   - Update / add tests in `test/janko-*.test.ts`.
   - Ensure `npm test` and `npm run lint:engraving --strict` pass with 0 violations and 0 warnings.
