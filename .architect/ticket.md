# Ticket: Drop Blurry Hand-Crossing Overlays and Eliminate Vertical Hold Ribbons in Favor of Pure Noteheads + Duration Color

## Kind

bounded

## Problem

1. **Blurry Hand-Crossing Filter Overlay**: Translucent pink/gray shaded rectangles (`rgba(244, 114, 182, 0.12)` / `#F3F4F6 opacity="0.6"`) and text banners (`LH/RH Cross`) wash over the score like a blurry smudge. Hand assignment is already clearly and individually communicated on every note by Klavar lateral stems (Right for RH, Left for LH). The overlay is visual noise and should be removed completely.
2. **Elongated Note Ribbons Colliding with Lateral Stems**: Vertical hold ribbons (`roundRect` in canvas, `<line>` in SVG print layout) extend straight down from $(cx, cy)$ for all notes with $d > \tau_{ref}$. In pieces like Bach Goldberg Var 1, where 165 notes (30%) are eighth or dotted-eighth notes, these vertical rods intersect the horizontal lateral stems at $(cx, cy)$, creating ugly right-angle T-junctions and crosshairs.
3. **Pure Noteheads + Duration Color**: Note duration is already communicated through:
   - Notehead color (the duration-class logarithmic palette / DDR subdivision color coding), and
   - Metric beat-grid placement and rhythmic interval to subsequent notes.
   Eliminating the vertical hold ribbons keeps noteheads pure and crisp with their lateral stems, completely eliminating stem-ribbon collisions while staying true to Klavarskribo principles.

## Solution

1. **Drop Hand-Crossing Overlays**:
   - In `src/render/score-canvas.ts`: Remove Section 4 (`Hand-Crossing Shading Overlays`), deleting the translucent fill and `LH/RH Cross` text.
   - In `src/render/print-layout.ts`: Remove `Hand Crossings Overlay in Column`, deleting the `<rect>` overlay and `<text class="cross-label">LH/RH Cross</text>`.
   - In `src/ui/ControlsDrawer.tsx`: Remove the `showHandCrossings` checkbox.
   - In `src/ui/App.tsx`: Default `showHandCrossings: false`.
   - In `src/render/types.ts`: Keep `showHandCrossings?: boolean` for type compatibility, defaulting to `false`.

2. **Drop Vertical Hold Ribbons**:
   - In `src/render/score-canvas.ts`:
     - In vertical note rendering, remove the `if (isHold) { ctx.roundRect ... }` block.
     - In horizontal note rendering, remove horizontal hold tails.
     - Notes render cleanly as noteheads with lateral stems, with duration expressed through notehead fill color (duration class) and beat-grid location.
   - In `src/render/print-layout.ts`:
     - Remove the `Notes: First Hold Ribbons (for d > tauRef)` loop completely.
     - SVG notes render purely as notehead + lateral stem (+ optional articulation/outlier landmark).

3. **Testing Plan**:
   - In `test/print-layout.test.ts`:
     - Verify SVG print layout contains zero `Hand Crossing Overlay` rects or text.
     - Verify SVG print layout contains zero hold ribbon lines.
   - In `test/notation-variations.test.ts`:
     - Update duration lattice invariants: assert that notes are rendered as pure noteheads with lateral stems, color-coded by duration class, without hold ribbon rects.
     - Verify canvas render executes cleanly with zero hand-crossing overlay fills.
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).

