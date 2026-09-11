# Ticket: Baked Directional Noteheads, Red Tint Deletion, and Hold Line Obstacle Interruption

## Kind

bounded

## Problem

1. **Floating Chevrons Replaced by Baked Directional Noteheads**:
   - Separate floating `<` and `>` chevrons looked disconnected and produced an overhanging "roof eaves" artifact.
   - The user requested that handedness be **baked directly into the notehead morphology**:
     - **LH hand-crossing exception** (`hand === 'LH' && rawLPitch > 48`): the notehead extends to the **Left** with a compact pointer tip (`tip = 2.4pt`).
     - **RH hand-crossing exception** (`hand === 'RH' && rawLPitch < 48`): the notehead extends to the **Right** with a compact pointer tip (`tip = 2.4pt`).
     - **Middle C** (`rawLPitch === 48`) and default territories (`RH >= 48`, `LH <= 48`) remain standard rectangular squished squares.
     - **Row Parity Harmony**:
       - Row 0 (Lines, solid): extends into a solid filled directional pentagon (`fill="${noteColor}"`).
       - Row 1 (Spaces, hollow): extends into a hollow outline directional pentagon (`fill="#FFFFFF" stroke="${noteColor}" stroke-width="1.3"`).
     - Separate floating chevron paths and white halos are completely deleted.
2. **Red Note Faint Tint Fill Deletion**:
   - The faint red tint fill exception (`isRedNote`, `fill-opacity="0.18"`) was an obsolete workaround from when held notes lacked solid lines.
   - Delete `isRedNote` across `src/render/print-layout.ts` and `src/render/score-canvas.ts`.
   - All Row 1 hollow noteheads maintain clean, crisp white interiors (`#FFFFFF`) regardless of duration.
3. **Obstacle Registration & Interruption for Baked Noteheads**:
   - The notehead obstacle boundary incorporates the pointing tip:
     - LH exception: `x1 = bx - tip - 1.0`, `x2 = bx + nw + 1.0`
     - RH exception: `x1 = bx - 1.0`, `x2 = bx + nw + tip + 1.0`
   - Hold lines cleanly interrupt if encountering a pointing notehead in their column and finish at note release.
4. **Clean Staff-Line Replacement (Bar 6 Blue)**:
   - For notes on staff lines (`geom.isLine`), hold lines cleanly replace the underlying black staff line:
     - White knockout underlay along the sustain segment (`stroke-width="${geom.isBold ? 2.5 : 1.8}" stroke-linecap="butt"`).
     - Colored hold line stroked at full staff-line width (`stroke-width="${geom.isBold ? 1.35 : 1.0}" stroke-linecap="round"`), e.g. turning line m2 pure royal blue in Bar 6 (`bach-var1-88`).
     - Space-case notes continue rendering thin solid lines (`stroke-width="0.8"`) without knockout.

## Testing Plan

1. **Baked Directional Notehead Rendering (`test/print-layout.test.ts`, `test/notation-variations.test.ts`)**:
   - Zero standalone floating chevron `<path>` elements rendered beside notes.
   - For notes with hand-crossing exceptions, noteheads render as directional pentagons (`<path d="... Z">` in SVG; matching path in Canvas):
     - LH exceptions point left (`x_apex = bx - 2.4`).
     - RH exceptions point right (`x_apex = bx + nw + 2.4`).
     - Row 0 notes are solid filled; Row 1 notes are hollow with `fill="#FFFFFF"`.
   - Middle C (`rawLPitch === 48`) renders as standard rectangular square.
2. **Red Fill Deletion Verification**:
   - Verify zero occurrences of `fill-opacity="0.18"` or `isRedNote` tinting in SVG output and Canvas rendering.
   - Long red notes in Row 1 render pure white interiors with red outline.
3. **Obstacle Interruption in Measure 4**:
   - In Measure 4, verify that `bach-var1-68` (pitch 38, tick 552, dur 24) renders two disjoint line segments:
     - Segment 1: from onset start to before the obstacle of `bach-var1-69`'s right-pointing notehead.
     - Segment 2: resuming after the obstacle and finishing at note release (~tick 576).
4. **Measure 30 Non-Overextension**:
   - In Measure 30, for successive LH eighth notes (`bach-var1-501`, `504`, `507`, `510`, `513`), hold lines cleanly stop before subsequent baked noteheads without overextending past note release.
5. **Clean Staff-Line Drawing Over (Measure 6 Blue)**:
   - For notes on staff lines (`geom.isLine` is true, e.g. `bach-var1-88` in Measure 6, pitch 36), verify a white knockout underlay is rendered and the colored line is stroked at full staff-line width (`1.0pt` for octave line, `1.35pt` for m3), cleanly replacing the black vertical line during the hold.
6. **Full Regression Suite**:
   - All tests pass (`npm test`).
   - Production build succeeds (`npm run build`).

## [bounded]

### Solution

1. **Implement Baked Directional Noteheads in `src/render/print-layout.ts`**:
   - In `renderPageToSvg`:
     - Delete standalone chevron rendering block (lines 765–806).
     - Update obstacle collection:
       - For notes with `isHandException`:
         - If `hand === 'LH'`: `x1 = nx - nw / 2 - 2.4 - 1.0`, `x2 = nx + nw / 2 + 1.0`.
         - If `hand === 'RH'`: `x1 = nx - nw / 2 - 1.0`, `x2 = nx + nw / 2 + 2.4 + 1.0`.
         - Normal notes: `x1 = nx - nw / 2 - 1.0`, `x2 = nx + nw / 2 + 1.0`.
     - In notehead morphology rendering (`rectangle-square`, `square-ellipse`, `square-triangle`):
       - If `isHandException`:
         - Generate baked directional path with `tip = 2.4` and flat back corner radius `rx = 1.2`.
         - Underlay with white knockout path: `fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.8" stroke-linejoin="round"`.
         - If `isRow0` (solid): `<path d="${bakedPath}" fill="${noteColor}" stroke="${noteColor}" stroke-width="0.5" stroke-linejoin="round"/>`.
         - If `!isRow0` (hollow): `<path d="${bakedPath}" fill="#FFFFFF" stroke="${noteColor}" stroke-width="1.3" stroke-linejoin="round"/>`.
       - If `!isHandException`:
         - Render standard rounded rectangle notehead.
     - Delete `isRedNote` tint fill block; hollow notes always render `fill="#FFFFFF" stroke="${noteColor}" stroke-width="1.3"`.
2. **Implement Baked Directional Noteheads in `src/render/score-canvas.ts`**:
   - Remove standalone chevron drawing in canvas loops.
   - In `renderNotehead`, add support for directional baked notehead paths when `isHandException` is true (or pass `handException: 'RH' | 'LH' | null`):
     - For `hand === 'LH'`: draw path pointing left (`cx - halfW - tip`), flat back on right.
     - For `hand === 'RH'`: draw path pointing right (`cx + halfW + tip`), flat back on left.
     - Row 0: fill with `noteColor`.
     - Row 1: fill with `#000000` (canvas background knockout) / `#FFFFFF` and stroke with `noteColor`.
   - Remove `isRedNote` tint fill across all notehead render paths.
3. **Update Tests**:
   - Update unit test assertions in `test/print-layout.test.ts` and `test/notation-variations.test.ts` to assert directional baked notehead paths and absence of red tint fill.
