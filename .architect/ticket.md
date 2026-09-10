# Ticket: Initialize Project `iso-notation`

## Kind

bounded — straightforward work.

## Problem

We need a dedicated, first-class project repository for developing a new music notation system tailored for the study, comprehension, memorization, and performance of classical music on a 4-row Jánko (isomorphic) piano keyboard, registered within Orca's runtime.

The system requires:
1. **Presentation-Agnostic Lossless 12-TET Data Core ("Quantized Fence")**:
   - Zero-based pitch coordinates: `(pitch_class: 0..11, octave: 0..N)` where Octave 0 is the lowest octave on an 88-key piano ($A_0, B\flat_0, B_0$), with linear index $\text{octave} \times 12 + \text{pitch\_class}$.
   - Uniform time grid whose resolution $\Delta t$ is the minimal interval (GCD) required to losslessly map every onset and duration in the composition.
   - Hierarchical overlays for meter, barlines, dynamics, articulations, and pedaling.
2. **Deterministic Vector Visualization Workbench (Zero Generative AI)**:
   - Pure mathematical SVG/Canvas rendering with pixel-perfect precision (no diffusion or LLM hallucination).
   - Pluggable notation renderer pipelines to experiment with 6-6 whole-tone staff lines vs. chromatic grid, numerical noteheads ($0 \dots 11$), color spectrums, and horizontal vs. vertical timelines.
   - Synchronized 4-row Jánko keyboard vector model verifying physical hand-shape isomorphism.
3. **Tailscale-Accessible Mobile Workbench**:
   - Dev server configured with `--host 0.0.0.0 --port 5173` accessible over Tailscale at `http://100.102.70.49:5173`.
   - Sub-second live reload (Vite HMR) when code or notation styles update.
   - Mobile-responsive UI with touch controls (pinch-zoom, panning, collapsible controls drawer) optimized for phone viewing.
4. **Canonical Benchmark Excerpts**:
   - **J.S. Bach**: *Goldberg Variations*, BWV 988 — **Variation 1** (a 1 Clav. — dynamic two-part hand-crossing counterpoint, wide register leaps, and continuous flowing sixteenth-note motoric motion).
   - **Nikolai Kapustin**: *Eight Concert Études*, Op. 40, No. 7 "Intermezzo" (the second-to-last étude — subtle jazz syncopations, chromatic substitutions, layered swing counterpoint, and rich extended chords).

## Testing plan

1. **Repository & Orca Registration**:
   - Repository exists at `/home/qqp/projects/iso-notation` with initialized `main` branch.
   - Project is registered in Orca (`orca repo list --json` and `orca project list --json` contain `iso-notation`).
2. **Scaffolding & Philosophy Docs**:
   - `README.md`: Explaining the 4-row Jánko keyboard isomorphism, notation philosophy, and project roadmap.
   - `docs/philosophy.md`: Cognitive model of classical music reading, eliminating diatonic friction, and isomorphic spatial mapping.
   - `docs/grid-model-spec.md`: The minimal-resolution quantized grid ("fence") data model specification, with pure zero-based `(pitch_class: 0..11, octave: 0..N)` coordinate definitions.
   - `docs/symbol-taxonomy.md`: Reference catalog of classical musical symbols with isomorphic alternatives.
   - `.architect/` structure for future ticket-driven workflows.
3. **Core Grid Model & Visualization Workbench**:
   - TypeScript/Vite setup compiling cleanly (`npm run build`).
   - Lossless `QuantizedGridScore` data model implementation encoding the Bach Goldberg Variation 1 and Kapustin Op. 40 No. 7 Intermezzo benchmarks.
   - Interactive UI accessible over Tailscale at `http://100.102.70.49:5173`:
     - Responsive, touch-friendly UI for phone and desktop.
     - 4-row Jánko keyboard component displaying active note states and hand shapes.
     - Quantized grid inspector & notation canvas rendering the score deterministically.
     - Real-time parameter controls to toggle between Bach Goldberg Var. 1 and Kapustin Intermezzo scores and experiment with visual dimensions (vertical vs. horizontal timeline, color coding, numerical pitch notation, custom 6-6 whole-tone staff lines vs. continuous grid).
