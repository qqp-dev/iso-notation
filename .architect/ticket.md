# Ticket: Minimal Pitch-Black Aesthetic, 2-Row Jánko Keyboard, and Deterministic MIDI Pipeline

## Kind

bounded — straightforward work.

## Problem

The initial visualization prototype suffered from visual clutter (dashboard cards, inspector tabs, unnecessary metric boxes), an overcomplicated 4-row keyboard, diatonic letter-name baggage, and inaccurate/hallucinated musical note data.

The system must be redesigned with radical visual minimalism, pure non-diatonic pitch recognition, and strict musical fidelity:
1. **Zero Letter Names for Pitch Recognition**:
   - Absolutely NO letter names ($A, B, C, D, E, F, G$ or $\sharp/\flat$) anywhere in the UI, keyboard, or score.
   - Pitch recognition is purely **numerical and spatial**:
     - Pitch classes are strictly integers $0 \dots 11$.
     - Octaves are strictly integers $0 \dots N$.
     - Parity is strictly mathematical: Even pitch classes ($0, 2, 4, 6, 8, 10$) belong to Whole-Tone Row 0; Odd pitch classes ($1, 3, 5, 7, 9, 11$) belong to Whole-Tone Row 1.
2. **Pitch-Black Minimal Design Language**:
   - Background: Pitch black (`#000000`) everywhere.
   - Zero superfluous UI chrome: Remove inspector tabs, HandShapeIsomorphism panel, GridInspector panel, and clutter above the keyboard.
   - Remove dynamics for now.
   - Every line, box, key, and symbol must be mathematically considered, crisp, and serve a critical purpose.
3. **Strict 2-Row Jánko Keyboard**:
   - Exactly two rows representing the fundamental non-redundant whole-tone basis:
     - Row 0: Even pitch classes ($0, 2, 4, 6, 8, 10$).
     - Row 1: Odd pitch classes ($1, 3, 5, 7, 9, 11$).
   - Keys labeled strictly with numbers $0 \dots 11$ (or minimal dots/glyphs, zero letters).
   - Clean, uncluttered vector rendering aligned directly beneath the score.
4. **Deterministic Musical Pipeline & Authentic Scores**:
   - Deterministic MIDI-to-grid ingestion module (`@tonejs/midi`) allowing drag-and-drop / loading of any `.mid` file into the quantized fence.
   - Fix Bach Goldberg Variation 1 with the exact authentic Urtext notes, encoded as pure $(pitchClass: 0..11, octave: 0..N)$.
   - Clean polyphonic Web Audio playback faithfully reproducing the exact notes.

## Testing plan

1. **Non-Diatonic & Aesthetic Invariants**:
   - Zero letter names ($A..G$) anywhere in the UI, labels, keyboard, or score renderer. All pitch identification is strictly $0 \dots 11$ and spatial.
   - Background is `#000000` (pitch black) across all surfaces.
   - All extra tabs (Isomorphism, Inspector) and dynamics controls are completely removed.
   - The Jánko keyboard displays strictly 2 rows with whole-tone alternating geometry.
2. **Deterministic MIDI & Authentic Audio**:
   - Ingesting a `.mid` file parses note onsets, durations, and 12-TET pitch coordinates deterministically into the quantized fence without human or LLM transcription error.
   - Bach Goldberg Variation 1 matches Bach's actual Urtext notes and plays with exact pitches.
   - UI provides a minimal, clean file-drop / load button for user-supplied MIDI files (e.g., Kapustin).
3. **Build & Tailscale**:
   - `npm test` and `npm run build` pass cleanly.
   - Accessible over Tailscale at `http://100.102.70.49:5173`.
