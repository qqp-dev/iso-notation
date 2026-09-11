# Ticket: Continuous Uninterrupted Reference Lines (Draw Faint Dotted Holds Directly Over Lines)

## Kind

bounded

## Problem

Interrupting the structural reference staff lines (octave boundaries, Landmark 5, Landmark 9) with knockout underlays during note holds disrupts the visual continuity and spatial frame of reference of the isomorphic staff. The reference lines must remain 100% continuous and uninterrupted. Sustained notes should simply draw their faint dotted continuation lines directly over whatever is there (over staff lines or through empty spaces).

## Testing Plan

1. **Continuous Uninterrupted Reference Staff Lines (`test/print-layout.test.ts`, `test/notation-variations.test.ts`)**:
   - In SVG print layout (`src/render/print-layout.ts`), ZERO white knockout underlay lines (`stroke="#FFFFFF"`) are rendered beneath dotted continuation trails. The staff lines run continuously from staffOriginY to staffEndY.
   - In Canvas (`src/render/score-canvas.ts`), ZERO black knockout lines are rendered along dotted hold paths.
2. **Faint Dotted Holds for All Colored Notes Maintained**:
   - All 165 colored notes (`durationTicks > tauRef`) in Goldberg Var 1 still render faint dotted continuation lines (`stroke-dasharray="2,3"` in SVG, `setLineDash([2, 3])` in Canvas), drawn directly along the note's sustain path.
   - 16th notes ($d \le \tau_{\text{ref}}$) have zero hold lines.
3. **Regression & Full Suite**:
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).

## [bounded]

### Solution

1. **`src/render/print-layout.ts`**:
   - In `renderPageToSvg`:
     - In the hold trail loop for `col.notes`:
       Remove the `isOnStaffLine` white knockout line emission (`<line ... stroke="#FFFFFF" ... />`).
       Simply emit the faint dotted trail in `noteColor` for every note where `note.durationTicks > tauRef`:
       ```ts
       svgParts.push(`    <line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="${noteColor}" stroke-width="0.8" stroke-dasharray="2,3" opacity="0.50"/>`);
       ```
2. **`src/render/score-canvas.ts`**:
   - In `renderScoreToCanvas`:
     - In both vertical and horizontal orientations:
       Remove the black knockout stroke (`ctx.strokeStyle = '#000000'`).
       Simply stroke the faint dotted trail directly over the staff lines or empty space.
3. **Update Tests**:
   - In `test/print-layout.test.ts` and `test/notation-variations.test.ts`:
     - Assert that zero white or black line knockouts are rendered for hold trails.
     - Assert that all 165 colored notes still render their dotted continuation trails.
