# Ticket: Handedness Symmetry Around m3, Faint Tint for Colored Hollow Notes, and Polyphonic Dotted Trails

## Kind

bounded

## Problem

1. **Hollow Noteheads Lack Chromatic Weight for Colored Notes**: In `rectangle-square` (and related parity morphologies), Row 1 (odd PC) notes are rendered hollow with a thin stroke. When a Row 1 note is colored (e.g. the Crimson/Red 108t B4 pedal note in Bar 20, or Amber quarter notes, or Sky Blue eighth notes), the empty interior leaves the notehead visually dim and weak. It needs chromatic body while preserving the stark fill/void alternation against solid Row 0 noteheads.
2. **Dotted Trails Should Trigger When Useful (Polyphonic Overlap)**: A hold line is only useful when something else is sounding during the sustain. Sustained quarter notes (Amber/Orange) and dotted notes that ring while sixteenth-note counterpoint moves in another voice/hand need visual continuity, while isolated cadence quarter notes with no concurrent motion should remain clean noteheads.
3. **Lateral Stems on Every Note Cause Visual Clutter ("Hairy Caterpillar")**: Rendering a lateral stem on all 551 notes creates massive visual noise. Following Elaine Gould (*Behind Bars*) and advanced Klavarskribo principles, keyboard hand distribution should assume natural symmetry around Middle C ($m3$), indicating **only exceptions**.

## Solution

1. **Handedness Stems: Symmetry Around m3 (Indicate Only Exceptions)**:
   - In `src/render/score-canvas.ts` and `src/render/print-layout.ts`:
   - Middle C ($m3$, linear pitch 60) is the natural keyboard symmetry axis.
   - Default assumption:
     - Pitch $\ge 60$ ($m3$) is Right Hand (RH).
     - Pitch $< 60$ ($m3$) is Left Hand (LH).
   - Render lateral stems **only for exceptions**:
     - `note.hand === 'RH' && lPitch < 60`: render Right stem ($\to$).
     - `note.hand === 'LH' && lPitch >= 60`: render Left stem ($\leftarrow$).
     - Notes in default territory (`RH >= 60` or `LH < 60`) render **NO stem** (clean, pure noteheads).
   - In Bach Goldberg Var 1, this cleans up 75% of the score (412 notes become stemless), while the 139 notes where RH crosses into the bass pop out with clear $\to$ alert stems.

2. **Faint Tint for Colored Hollow Noteheads**:
   - In `src/render/score-canvas.ts` and `src/render/print-layout.ts`:
   - In `rectangle-square`, `square-ellipse`, and `square-triangle` morphologies:
     - Row 0 (even PC): remains 100% solid fill in `headColor` / `noteColor`.
     - Row 1 (odd PC):
       - If note is a 16th note ($d \le \tau_{ref}$ / White / `#E2E8F0` / `#1E293B`):
         Render 100% VOID / transparent (pure black interior on canvas, pure white on paper) with crisp border in `headColor`. Alternating fill/void legibility is completely preserved for the majority of the score.
       - If note is a **COLORED note** ($d > \tau_{ref}$, e.g. Sky Blue 8th, Indigo dotted-8th, Amber quarter, Crimson/Red pedal):
         Add a **FAINT (!!)** wash inside the hollow notehead (~18% opacity, e.g. `fill-opacity="0.18"` in SVG, `globalAlpha = 0.18` in canvas):
         - SVG: `<rect ... fill="${noteColor}" fill-opacity="0.18" stroke="${noteColor}" stroke-width="1.3"/>`.
         - Canvas: fill with `headColor` at `globalAlpha = 0.18`, then stroke border at full opacity `headColor` (`lineWidth = 1.8`).
         - Preserves the distinct hollow identity relative to 100% opaque solid Row 0 notes, while giving immediate chromatic recognition across registers.

3. **Polyphonic Dotted Continuation Trails ("Draw Dots When Useful")**:
   - In `src/render/score-canvas.ts` and `src/render/print-layout.ts`:
   - A note receives a faint dotted continuation trail (`stroke-dasharray="2,3"`, `0.75pt`/`0.8px`, ~45% opacity) down to its release tick if and only if:
     1. `note.durationTicks >= ticksPerBeat` (where `ticksPerBeat = score.ticksPerBeat || 48`, capturing quarter notes, dotted quarters, and long pedal sustains), **AND**
     2. At least one other note in the score begins during its sustain:
        `score.notes.some(other => other.id !== note.id && other.startTick > note.startTick && other.startTick < note.startTick + note.durationTicks)`
   - Optical clearance: starts 2px below the bottom of the notehead (`trailStartY = ny + noteHeight / 2 + 2`).
   - Clean termination: stops cleanly at release coordinate clamped to column/staff bounds.

4. **Testing Plan**:
   - In `test/print-layout.test.ts` and `test/notation-variations.test.ts`:
     - Assert that notes in default territory (RH $\ge 60$, LH $< 60$) have zero lateral stems.
     - Assert that notes crossing $m3$ (RH $< 60$, LH $\ge 60$) render lateral stems with correct direction.
     - Assert that hollow Row 1 noteheads for 16th notes have zero fill (100% void), while colored hollow noteheads have faint tint fill (`fill-opacity="0.18"` or equivalent).
     - Assert that notes with $d \ge \text{ticksPerBeat}$ that have concurrent onsets render the faint dotted trail, while notes without concurrent onsets do not.
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).
