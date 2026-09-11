# Ticket: Unified Euclidean Duration Lattice: Logarithmic Minimal Palette & Proportional Hold Ribbons

## Kind

bounded — mathematical duration lattice, unextended reference noteheads, and proportional hold ribbons.

## Problem

Previous iterations suffered from:
1. Drawing duration bars behind all notes (including reference 16th notes), cluttering fast motoric runs with cramped rectangles.
2. An overcomplicated color alphabet trying to give every micro-duration its own color.

We need to implement the **Unified Euclidean Duration Lattice**:
- The reference quantum ($\tau_{\text{ref}} = \gcd(S) = 12\text{t}$) renders as **pure noteheads with ZERO extension ribbon**.
- Notes longer than $\tau_{\text{ref}}$ project sleek **proportional hold ribbons** down the timeline to their release tick, physically visualizing holds and dotted values without special symbols.
- A minimal logarithmic 3-tier color alphabet ($k = \lfloor \log_2(d / \tau_{\text{ref}}) \rfloor$) spanning the entire repertoire: $1\times$ Silver/White, $2\times$ Sky Blue, $4\times$ Warm Amber, $\ge 8\times$ Rose.

## Testing plan

1. **Unextended Reference Notehead Invariant ($d \le \tau_{\text{ref}}$)**:
   - For all notes where `durationTicks <= tau_ref` (e.g. 16th notes with $d = 12\text{t}$):
     - ZERO duration ribbon is drawn.
     - Notehead (disc on lines, diamond in spaces) is centered directly on the exact onset coordinate $(x, y)$.
     - Fast streams in Bach Goldberg Variation 1 render as pristine notehead constellations without rectangles.
2. **Proportional Hold Ribbon Invariant ($d > \tau_{\text{ref}}$)**:
   - For sustained notes ($d > \tau_{\text{ref}}$, e.g. 8th notes $24\text{t}$, dotted 8th $36\text{t}$, quarters $48\text{t}$, halves $96\text{t}$):
     - The notehead sits at onset $(x, y)$.
     - A sleek hold ribbon extends from $(x, y)$ to $(x, y + d \times \text{pixelsPerTick})$ (vertical) or $(x + d \times \text{pixelsPerTick}, y)$ (horizontal).
     - Dotted 8th notes ($36\text{t}$) physically extend $1.5\times$ longer than 8th notes ($24\text{t}$).
3. **Logarithmic Minimal Color Palette Invariant**:
   - $k = \lfloor \log_2(d / \tau_{\text{ref}}) \rfloor$:
     - $k = 0$ ($1\times$, $12\text{t}$): **Crisp Silver / White** (`#E2E8F0`).
     - $k = 1$ ($2\times$ and $3\times$, $24\text{t}$ and $36\text{t}$): **Sky Blue** (`#38BDF8`).
     - $k = 2$ ($4\times$ to $7\times$, $48\text{t}$ to $72\text{t}$): **Warm Amber** (`#F59E0B`).
     - $k \ge 3$ ($\ge 8\times$, $96\text{t}+$): **Rose** (`#F43F5E`).
   - Active notes glow bright gold/white (`#FEF08A` / `#FACC15`).
4. **App Default & Presets**:
   - Preset `"Unified Duration Lattice + Parity Shapes"` set as primary default.
   - Live workbench at `http://100.102.70.49:5173`.
5. **Verification**:
   - `npm test` passes.
   - `npm run build` succeeds cleanly.

## [bounded]

### Budget

1 session.

### Solution

1. In `src/render/types.ts`:
   - Add `getLogarithmicDurationColor(durationTicks: number, tauRef: number, isActive?: boolean): string`.
   - Update `DESIGN_PRESETS` with `"Unified Duration Lattice + Parity Shapes"`.
2. In `src/render/colors.ts`:
   - Implement `getLogarithmicDurationColor` implementing $k = \lfloor \log_2(d / \tau_{\text{ref}}) \rfloor$.
3. In `src/render/score-canvas.ts`:
   - Determine $\tau_{\text{ref}} = \text{score.gridResolution || 12}$.
   - For notes with $d \le \tau_{\text{ref}}$: skip duration ribbon completely; draw notehead centered directly at onset coordinate $(x, y)$.
   - For notes with $d > \tau_{\text{ref}}$: draw hold ribbon from onset $(x, y)$ extending to $(x, y + d \times \text{pixelsPerTick})$ with width $\sim 5\text{px}$ (sleek cable/ribbon style), then draw notehead at onset $(x, y)$ with line knockout.
4. In `src/ui/App.tsx`:
   - Ensure default render options use this unified duration lattice.
5. In `test/notation-variations.test.ts`:
   - Add unit tests verifying zero ribbon for $d \le \tau_{\text{ref}}$, proportional ribbon for $d > \tau_{\text{ref}}$, and logarithmic rank colors.

