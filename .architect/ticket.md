# Ticket: Stemless Middle C, Fixed m3 Linear Coordinate (48), and Red-Only Faint Fill

## Kind

bounded

## Problem

1. **Off-by-12 Coordinate Bug on Handedness Stems**: In `iso-notation`, Middle C ($m3$, $C_4$) has `linearIndex = 48` (MIDI note 60). The previous code checked `lPitch < 60` and `lPitch >= 60`. Because of this off-by-12 bug, every single Right Hand note in the entire octave between Middle C and $C_5$ (linear pitches 48 to 59, $m3$ to $m4$) was evaluated as `lPitch < 60` and erroneously given a rightward stem on the right-hand side of the staff!
2. **Middle C ($m3$) Should Be Stemless**: Middle C is shared territory between both hands. Applying complex or artificial exception rules to $m3$ causes unnecessary visual clutter. On $m3$ itself (`linearIndex === 48`), no stems should be drawn for either hand.
3. **Faint Tint Fill Only for Red Notes**: Sky Blue (8th notes) and Amber/Orange (quarter notes) have strong contrast and are perfectly legible as empty outline boxes. Only Crimson/Rose/Red notes ($d \ge 96\text{t}$, half notes and long pedal sustains) lack chromatic weight when hollow. Faint tint fill (~18% opacity) should be restricted strictly to Red notes; Blue and Orange should remain 100% void / empty inside to maximize the alternating fill/void whole-tone legibility.

## Solution

1. **Handedness Stems: Stemless m3 and Correct Linear Boundary (48)**:
   - In `src/render/score-canvas.ts` and `src/render/print-layout.ts`:
   - Middle C ($m3$) has `linearIndex = 48`.
   - On $m3$ itself (`lPitch === 48`): **DO NOT DRAW STEMS** for either hand.
   - Strict exceptions only:
     - `hand === 'RH' && lPitch < 48`: render Right stem ($\to$).
     - `hand === 'LH' && lPitch > 48`: render Left stem ($\leftarrow$).
     - All other notes (`RH >= 48`, `LH <= 48`, and both hands on 48) render **NO stem** (clean, pure noteheads).
   - This eliminates all false rightward stems on the right-hand side of $m3$.

2. **Faint Tint Fill Restricted Strictly to Red Notes ($d \ge 96\text{t}$)**:
   - In `src/render/score-canvas.ts` and `src/render/print-layout.ts`:
   - In `rectangle-square`, `square-ellipse`, and `square-triangle` morphologies:
     - Row 0 (even PC): 100% solid fill in `noteColor` / `headColor`.
     - Row 1 (odd PC):
       - If note duration is less than 96 ticks ($d < 96\text{t}$ / ratio $< 8.0$, covering 16ths, 8ths, dotted 8ths, quarters):
         Render 100% VOID / transparent (pure black interior on canvas, pure white on paper) with crisp border in `noteColor` / `headColor`. Blue and Orange noteheads remain completely hollow.
       - If note is a **Red note** ($d \ge 96\text{t}$ / ratio $\ge 8.0$, half notes and pedal holds):
         Render a faint interior tint (~18% opacity, e.g. `fill-opacity="0.18"` in SVG, `globalAlpha = 0.18` in canvas) of the red color before stroking the full-opacity border.

3. **Testing Plan**:
   - In `test/print-layout.test.ts` and `test/notation-variations.test.ts`:
     - Assert that notes on Middle C (`lPitch === 48`) have zero stems for both RH and LH.
     - Assert that RH notes with `lPitch >= 48` have zero stems.
     - Assert that RH notes with `lPitch < 48` render Right stems.
     - Assert that LH notes with `lPitch > 48` render Left stems.
     - Assert that Blue (8th) and Orange (quarter) hollow noteheads have void fills (zero `fill-opacity`), while Red ($d \ge 96\text{t}$) hollow noteheads have faint tint fill (`fill-opacity="0.18"` / `globalAlpha = 0.18`).
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).
