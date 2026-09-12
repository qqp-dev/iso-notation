# Ticket: Lossless Brahms Op. 118 No. 1 MIDI Ingestion & Mixed-Hand Cluster Grouping (Bach m. 3)

## Kind

bounded

## Problem

The operator inspected the Approach 2 implementation and Brahms benchmark, and provided two critical directives:

1. **Brahms Op. 118 No. 1 Score Oversight & Lossless MIDI Pipeline**:
   - Operator: *"first off at least the starting note is wrong, which worries me because maybe there's other oversights? anyhow, 040 it the start has these strange vertical lines coming out of it. what are those supposed to represent?"*
   - Operator follow-up: *"always work with a midi reference first since it's lossless when you read it. direct score is risky unless digitized some reliable way"*
   - In `src/scores/brahms-op118-no1.ts`, the previous implementer hand-coded notes and invented an opening chord of $C_5, E_4, C_4$ (`040`) at tick 0. In reality, Brahms Op. 118 No. 1 opens with an authentic quarter-note upbeat (anacrusis) of $C_5 + C_6$ in octaves, followed by $B\flat_4 + B\flat_5 + E_5$ over the $C_2$ ascending arpeggio in m. 1.
   - The "strange vertical lines" were rhythmic stems (`renderStem`) drawn individually on each notehead of unbeamed chords.
   - **Fix**: Ingest the score losslessly and deterministically from the authentic LilyPond-compiled MIDI reference `public/midi/brahms-op118-no1.mid` via `parseMidiToScore()`. Support anacrusis (upbeat) of 48 ticks in `JankoTokens`/`JankoLayoutOptions` so barlines and measure numbers align with the musical meter.

2. **Mixed-Hand Cluster Grouping & Chronological Monotonicity (Bach Goldberg Var 1, Measure 3)**:
   - Operator: *"and bar 3 of bach: the left hand 1 extending into the right hand octave exposes an issue. our rule for how we group can be refined further. the second 1 overlaps with the right hand 9 temporally right? then they form a mixed hand cluster, just like other chords."*
   - In Bach Goldberg Var 1, m. 3 at tick 408:
     - LH plays eighth note $C\sharp_4$ (pc 1, oct 4, row 1).
     - RH plays sixteenth note $A_4$ (pc 9, oct 4, row 1).
   - Currently, two defects occur:
     a) **Time Inversion in `resolveRowSnappedChordOffsets()`**: When the chord $\langle 1, 9 \rangle$ spreads by $\pm 5.5\text{pt}$, the column relaxation pushed Unit 408 left by $5.5\text{pt}$ to clear Unit 420 on Row 1, pushing Note 49 ($C\sharp_4$) to $x = 395.75$. But Note 48 ($E_5$ at tick 396) sits at $x = 397.13$! Note 49 was placed to the *left* of Note 48, so Note 48 appeared sandwiched between 1 and 9, inverting time!
     b) **Spurious Cross-Staff Beaming in `partitionBeamGroups()`**: `partitionBeamGroups` grouped LH $C\sharp_4$ (octave 4) with LH $A_2$ (octave 2) across an 86pt vertical gap and across the Middle C spine, drawing a 95pt vertical stem!
   - **Fix**:
     - Enforce strict chronological monotonicity in `resolveRowSnappedChordOffsets`: for any onsets $t_A < t_B$, $x_{\text{left}}(B) \ge x_{\text{right}}(A) + \text{minAir}$. Notes can never jump backwards in time.
     - In `partitionBeamGroups`: notes that enter the opposite hand's register to form a mixed-hand cluster must not beam across the Middle C corridor with an octave leap to a distant bass note.

## Testing Plan

1. **`src/scores/brahms-op118-no1.ts`**:
   - Ingests `public/midi/brahms-op118-no1.mid` losslessly via `parseMidiToScore()`.
   - Measure 0 (upbeat) has $C_5 + C_6$. Measure 1 has authentic $B\flat$ chord and $C$ bass arpeggio.
   - All 9 measures match authentic Urtext note-for-note.
2. **`src/render/janko/engine.ts`**:
   - `resolveRowSnappedChordOffsets`: Enforces time monotonicity across onsets. In Bach m. 3, $x(48) < x(49) < x(50) < x(51)$.
   - `partitionBeamGroups`: No spurious 95pt cross-corridor beam between $A_2$ and $C\sharp_4$.
3. **Automated Tests & Linter**:
   - `npm test` passes 100% (< 2s).
   - `npm run lint:engraving --strict` reports zero violations and zero warnings on both Bach and Brahms.
4. **Exports**:
   - Fast export refreshes all PNGs in root `./` and `public/`.
