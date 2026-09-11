# Ticket: Drop Blurry Hand-Crossing Overlays and Replace Hold Rods with Pure Noteheads + Faint Dotted Long-Note Trails

## Kind

bounded

## Problem

1. **Blurry Hand-Crossing Filter Overlay**: Translucent pink/gray shaded rectangles (`rgba(244, 114, 182, 0.12)` in canvas / `#F3F4F6 opacity="0.6"` in SVG) and text banners (`LH/RH Cross`) wash over the score like a blurry smudge. Hand assignment is already clearly and individually communicated on every note by Klavar lateral stems (Right for RH, Left for LH). The overlay is visual noise and must be removed completely.
2. **Elongated Note Ribbons Colliding with Lateral Stems**: Vertical hold rods (`roundRect` in canvas, `<line>` in SVG print layout) extend straight down from $(cx, cy)$ for all notes with $d > \tau_{ref}$. In pieces like Bach Goldberg Var 1, where 165 notes (30%) are eighth or dotted-eighth notes, these vertical rods intersect the horizontal lateral stems at $(cx, cy)$, creating ugly right-angle T-junctions and crosshairs.
3. **Pure Noteheads + Duration Color vs Long Notes**: Note duration is already communicated through:
   - Notehead color (the duration-class logarithmic palette / DDR subdivision color coding), and
   - Metric beat-grid placement and rhythmic interval to subsequent notes.
   For regular notes ($d \le \text{ticksPerBeat}$), eliminating the vertical hold ribbons keeps noteheads pure and crisp with their lateral stems, completely eliminating stem-ribbon collisions.
   For true long sustained notes ($d > \text{ticksPerBeat}$, e.g. the 108-tick sustain in Bar 20 of Bach Goldberg Var 1), a faint, delicate dotted continuation trail provides visual continuity down the timeline without cluttering the score.

## Solution

1. **Drop Hand-Crossing Overlays**:
   - In `src/render/score-canvas.ts`: Remove Section 4 (`Hand-Crossing Shading Overlays`), deleting the translucent fill and `LH/RH Cross` text.
   - In `src/render/print-layout.ts`: Remove `Hand Crossings Overlay in Column`, deleting the `<rect>` overlay and `<text class="cross-label">LH/RH Cross</text>`.
   - In `src/ui/ControlsDrawer.tsx`: Remove the `showHandCrossings` checkbox.
   - In `src/ui/App.tsx`: Default `showHandCrossings: false`.
   - In `src/render/types.ts`: Keep `showHandCrossings?: boolean` for type compatibility, defaulting to `false`.

2. **Duration Modeling: Pure Noteheads for Regular Notes, Faint Dotted Trail for Long Notes ($d > \text{ticksPerBeat}$)**:
   - Threshold for long notes: `const isLongNote = note.durationTicks > ticksPerBeat;` (where `ticksPerBeat = score.ticksPerBeat || 48`).
   - For regular notes ($d \le \text{ticksPerBeat}$):
     - No hold ribbons or trails.
     - Notes render cleanly as noteheads with center-aligned Klavar lateral stems, with duration expressed through notehead color and beat-grid position.
   - For long notes ($d > \text{ticksPerBeat}$):
     - Render a **faint dotted continuation trail**:
       - **Stem Clearance (Rhythm-game gap)**: The trail starts with a clean optical gap below the notehead bottom, so it never intersects or touches the center-aligned lateral stem:
         - In vertical timeline: `trailStartY = ny + noteHeight / 2 + 2` (or `cy + noteHeight / 2 + 2`).
         - In horizontal timeline: `trailStartX = nx + noteWidth / 2 + 2` (or `cx + noteWidth / 2 + 2`).
       - **Clean termination**: The trail terminates cleanly at the note's release coordinate (`ny + note.durationTicks * ptPerTick` in print SVG, clamped to column/measure bounds if needed; `cy + note.durationTicks * options.pixelsPerTick` in canvas). Zero stop ticks, arrows, or extra glyphs.
       - **Style**:
         - In SVG print layout: `<line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="${noteColor}" stroke-width="0.75" stroke-dasharray="2,3" opacity="0.45"/>`.
         - In Canvas: `ctx.save(); ctx.setLineDash([2, 3]); ctx.lineWidth = 0.8; ctx.globalAlpha = 0.45; ctx.strokeStyle = noteColor; ctx.beginPath(); ctx.moveTo(cx, trailStartY); ctx.lineTo(cx, trailEndY); ctx.stroke(); ctx.restore();`.

3. **Testing Plan**:
   - In `test/print-layout.test.ts`:
     - Verify SVG print layout contains zero `Hand Crossing Overlay` rects or text.
     - Verify SVG print layout contains zero hold ribbon lines for notes with $d \le \text{ticksPerBeat}$ (e.g. 12t, 24t, 36t, 48t).
     - Verify SVG print layout renders the faint dotted continuation line (`stroke-dasharray="2,3"`) for long notes ($d > \text{ticksPerBeat}$, e.g. 108t note in Bar 20), starting below the notehead bottom with clean termination.
   - In `test/notation-variations.test.ts`:
     - Update duration lattice invariants: assert that regular notes are rendered as pure noteheads with lateral stems, color-coded by duration class, without hold ribbon rects.
     - Assert that long notes ($d > \text{ticksPerBeat}$) render faint dotted trails with optical stem clearance.
     - Verify canvas render executes cleanly with zero hand-crossing overlay fills.
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).
