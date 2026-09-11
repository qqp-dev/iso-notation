# Ticket: Delete Beam Grouping and Implement Solid Thin Hold Lines with Collision Truncation

## Kind

bounded

## Problem

1. **Beam Grouping Deletion**: In vertical isomorphic notation, time flows vertically downwards. Beam grouping cannot occur across vertical time, and any code paths for beam grouping (Elaine Gould angled beams, `computeBeamClusters`, `showBeamGrouping`) must be completely deleted from the codebase. Handedness is represented purely and cleanly by independent Klavar lateral stems (horizontal stems pointing right for RH and left for LH for hand crossing exceptions).
2. **Solid Thin Hold Lines**: Faint dotted continuation trails were found to be too faint to be practically useful at reading distance and against black staff lines. Isomorphic columnar engraving should use **solid thin lines** (`stroke-width="0.8"`, `opacity="1.0"`, `stroke-linecap="round"`, colored by duration class) for held notes (`durationTicks > tauRef`).
3. **Tasteful Collision Truncation**: When a hold line's vertical path would intersect a **handedness line** (a lateral stem indicating hand crossing exception), the hold line must be **cut tastefully short** before the collision (`intersectY - 2.5pt`). Reference staff lines ($m1\dots m5$, Landmark 5, Landmark 9) remain 100% continuous and uninterrupted.

## Testing Plan

1. **Beam Grouping Completely Deleted**:
   - `computeBeamClusters` is removed from `src/model/grid.ts`.
   - `showBeamGrouping` is removed from `src/render/types.ts`, `src/render/print-layout.ts`, `src/ui/PrintModal.tsx`, and `src/ui/App.tsx`.
   - Zero beam lines rendered in SVG print layout or Canvas renderer.
   - Outdated beam tests in `test/notation-variations.test.ts` removed.
2. **Solid Thin Hold Line Rendering (`test/print-layout.test.ts`, `test/notation-variations.test.ts`)**:
   - In SVG (`src/render/print-layout.ts`), hold lines for colored notes (`durationTicks > tauRef`) are rendered as solid lines (no `stroke-dasharray` attribute, `stroke-width="0.8"`, `stroke-linecap="round"`).
   - In Canvas (`src/render/score-canvas.ts`), hold lines are drawn with empty line dash (`ctx.setLineDash([])`, `lineWidth = 0.8`, `globalAlpha = 1.0`).
3. **Tasteful Truncation Before Handedness Lateral Stems**:
   - For any held note at coordinate $nx$ whose hold path $[Y_{\text{start}}, Y_{\text{end}}]$ intersects a lateral stem of another note, the hold line terminates early at `stemY - 2.5pt`.
   - Verified on Measure 4 (`bach-var1-68` at tick 552, pitch 38 held to 576): stops cleanly before the lateral stem of `bach-var1-69` ($C_3$ at tick 564, RH stem reaching across pitch 38).
   - If truncation results in $Y_{\text{end}} \le Y_{\text{start}}$, zero line is emitted.
4. **Continuous Staff Lines Preserved**:
   - Zero knockout underlays beneath hold lines; structural reference staff lines remain 100% continuous.
5. **Regression & Full Suite**:
   - All tests pass (`npm test`).
   - Clean production build (`npm run build`).

## [bounded]

### Solution

1. **Delete Beam Grouping**:
   - **`src/model/grid.ts`**: Remove `computeBeamClusters` function and `BeamCluster` interface.
   - **`src/render/types.ts`**: Remove `showBeamGrouping` from `RenderOptions`.
   - **`src/render/print-layout.ts`**:
     - Remove `computeBeamClusters` import.
     - Remove `showBeamGrouping` from `ColumnarScoreLayoutOptions` and `defaultLayoutOptions`.
     - Remove Elaine Gould angled beam block (lines 648–694).
   - **`src/render/score-canvas.ts`**:
     - Remove `computeBeamClusters` import.
     - Remove Elaine Gould angled beam canvas rendering block (lines 733–795).
   - **`src/ui/PrintModal.tsx` & `src/ui/App.tsx`**: Remove `showBeamGrouping` references.
   - **`test/notation-variations.test.ts`**: Remove tests asserting beam clusters and Elaine Gould beam rendering.
2. **Implement Solid Thin Hold Lines with Collision Truncation in `src/render/print-layout.ts`**:
   - In `renderPageToSvg`:
     - Collect all lateral stems in the column:
       For each note where `isStemException` is true, record its horizontal span $[\min(nx, \text{stemEndX}), \max(nx, \text{stemEndX})]$ at $Y = ny$.
     - For each note where `note.durationTicks > tauRef`:
       - `trailStartY = ny + noteHeight / 2 + 2`
       - `rawReleaseY = ny + note.durationTicks * ptPerTick`
       - `trailEndY = Math.min(rawReleaseY, staffEndY)`
       - For every lateral stem in the column (where `stem.id !== note.id`):
         - If $nx \ge \text{stem.x1} - 0.5$ and $nx \le \text{stem.x2} + 0.5$:
           - If $\text{stem.y} > \text{trailStartY}$ and $\text{stem.y} \le \text{trailEndY}$:
             `trailEndY = Math.min(trailEndY, stem.y - 2.5)`
       - If $\text{trailEndY} > \text{trailStartY}$:
         Emit `<line x1="${nx.toFixed(2)}" y1="${trailStartY.toFixed(2)}" x2="${nx.toFixed(2)}" y2="${trailEndY.toFixed(2)}" stroke="${noteColor}" stroke-width="0.8" stroke-linecap="round"/>`
3. **Implement in `src/render/score-canvas.ts`**:
   - For vertical timeline:
     - Check lateral stems and truncate `trailEndY = Math.min(trailEndY, stemY - 2.5)`.
     - Draw solid thin line: `ctx.setLineDash([])`, `ctx.lineWidth = 0.8`, `ctx.strokeStyle = noteColor`, `ctx.globalAlpha = 1.0`, `ctx.lineCap = 'round'`.
   - For horizontal timeline:
     - Check lateral stems and truncate `trailEndX = Math.min(trailEndX, stemX - 2.5)`.
     - Draw solid thin line.
4. **Update Tests**:
   - In `test/print-layout.test.ts` and `test/notation-variations.test.ts`:
     - Assert that hold lines are solid lines (`stroke-width="0.8"`, no `stroke-dasharray`).
     - Assert that `bach-var1-68` hold line terminates before `bach-var1-69`'s lateral stem at tick 564.
