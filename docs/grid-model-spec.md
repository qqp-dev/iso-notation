# Lossless 12-TET Quantized Grid ("Fence") Specification

## 1. Mathematical Model of Pitch

Pitch space is defined as a discrete, zero-based, two-dimensional coordinate system within twelve-tone equal temperament (12-TET):

$$\mathcal{P} = \{ (p, o) \mid p \in \{0, 1, \dots, 11\}, \, o \in \{0, 1, \dots, N\} \}$$

where:
- $p \in \{0 \dots 11\}$ is the **pitch class** (semitone position relative to $C$):
  - $0 = C$, $1 = C\sharp / D\flat$, $2 = D$, $3 = D\sharp / E\flat$, $4 = E$, $5 = F$
  - $6 = F\sharp / G\flat$, $7 = G$, $8 = G\sharp / A\flat$, $9 = A$, $10 = A\sharp / B\flat$, $11 = B$
- $o \in \{0 \dots N\}$ is the **octave index**. Following standard acoustic registration where Octave 0 contains the lowest notes of a standard 88-key piano:
  - Key 1: $A_0 \implies (p = 9, o = 0)$
  - Key 2: $B\flat_0 \implies (p = 10, o = 0)$
  - Key 3: $B_0 \implies (p = 11, o = 0)$
  - Key 4: $C_1 \implies (p = 0, o = 1)$
  - Key 88: $C_8 \implies (p = 0, o = 8)$

### 1.1 Linear Pitch Index ($\mathcal{L}$)
The linear pitch index maps any pitch coordinate bijectively to a single non-negative integer:

$$\mathcal{L}(p, o) = o \times 12 + p$$

The inverse mapping is uniquely recovered by integer division and modulo:

$$o = \lfloor \mathcal{L} / 12 \rfloor, \quad p = \mathcal{L} \pmod{12}$$

### 1.2 Relationship to Standard MIDI Note Numbers
Standard MIDI note numbers designate $C_{-1} = 0$, $C_0 = 12$, $A_0 = 21$, $C_1 = 24$, Middle $C$ ($C_4$) = 60. Therefore:

$$\text{MIDI} = \mathcal{L}(p, o) + 12 = o \times 12 + p + 12$$
$$\mathcal{L} = \text{MIDI} - 12$$

For the standard 88-key piano:
$$\mathcal{L} \in [9, 96] \iff \text{MIDI} \in [21, 108]$$

### 1.3 Whole-Tone Parity ($\mathcal{W}$)
For isomorphic 6-6 keyboard mapping:
$$\mathcal{W}(p) = p \pmod 2$$
- $\mathcal{W}(p) = 0$: **Whole-Tone Set A** ($\{0, 2, 4, 6, 8, 10\} \iff \{C, D, E, F\sharp, G\sharp, A\sharp\}$) $\implies$ Jánko Rows 1 & 3.
- $\mathcal{W}(p) = 1$: **Whole-Tone Set B** ($\{1, 3, 5, 7, 9, 11\} \iff \{C\sharp, D\sharp, F, G, A, B\}$) $\implies$ Jánko Rows 2 & 4.

---

## 2. Temporal Quantization & The Uniform Time Grid ("The Fence")

To ensure lossless temporal representation without floating-point rounding or approximation errors, time is discretized onto an integer grid.

### 2.1 Grid Resolution ($\Delta t$)
Let a musical piece contain $K$ temporal events (note onsets, offsets, barlines, pedal events). Each event $k$ occurs at a rational time $t_k \in \mathbb{Q}$ (measured in quarter notes / beats).

Let $D = \{ \Delta t_{ij} = |t_i - t_j| \mid i, j \in \{1 \dots K\}, \, t_i \neq t_j \} \cup \{ d_k \mid d_k \text{ is duration of note } k \}$.

The fundamental grid resolution $\Delta t$ is defined as the greatest common divisor:

$$\Delta t = \gcd(D)$$

In ticks-per-beat formulation:
$$\text{ticks\_per\_beat} = \frac{1}{\Delta t}$$

For standard classical pieces containing quarter notes, 8ths, 16ths, and 32nds:
- Minimal duration = $\frac{1}{8}$ beat (32nd note) $\implies \text{ticks\_per\_beat} \ge 8$.
- Standard division $\text{ticks\_per\_beat} = 24$ or $48$ accommodates both binary subdivisions (half, quarter, 8th, 16th, 32nd) and triplet subdivisions (triplet 8ths, triplet 16ths) exactly:
  - Quarter note = 48 ticks
  - Triplet quarter = 32 ticks
  - Eighth note = 24 ticks
  - Triplet eighth = 16 ticks
  - Sixteenth note = 12 ticks
  - Triplet sixteenth = 8 ticks
  - Thirty-second note = 6 ticks

### 2.2 Lossless Invariant
For every note $n_i$:
$$\text{startTick}(n_i) \in \mathbb{N}_0, \quad \text{durationTicks}(n_i) \in \mathbb{N}_{>0}$$
$$\text{endTick}(n_i) = \text{startTick}(n_i) + \text{durationTicks}(n_i)$$

Every note onset and duration is mapped onto the grid with **zero remainder**:
$$\forall i, \quad \text{onset}(n_i) \pmod{\Delta t} = 0 \quad \text{and} \quad \text{duration}(n_i) \pmod{\Delta t} = 0$$

This guarantees that converting between the discrete grid representation and continuous performance timestamps is an exact, reversible homomorphism.

---

## 3. Hierarchical Score Schema

A `QuantizedGridScore` consists of the presentation-agnostic 12-TET data core along with layered structural and expressive overlays.

```typescript
export interface PitchCoordinate {
  /** Pitch class in 12-TET: 0 = C, 1 = C#, ..., 11 = B */
  pitchClass: number; // 0..11
  /** Octave index: 0 = lowest octave (A0..B0), 1 = C1..B1, ..., 8 = C8 */
  octave: number; // 0..8 (or higher)
}

export interface QuantizedNote {
  id: string;
  pitch: PitchCoordinate;
  startTick: number;
  durationTicks: number;
  /** Voice / Hand partition */
  hand: 'RH' | 'LH';
  voice?: number;
  velocity?: number; // 0..127 (MIDI standard)
  dynamicMark?: string; // 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  articulation?: 'staccato' | 'tenuto' | 'accent' | 'fermata';
}

export interface TimeSignatureOverlay {
  tick: number;
  numerator: number;
  denominator: number;
}

export interface BarlineOverlay {
  barNumber: number;
  tick: number;
  type: 'regular' | 'double' | 'repeat-start' | 'repeat-end' | 'final';
}

export interface TempoOverlay {
  tick: number;
  bpm: number;
  metricModulation?: string;
}

export interface DynamicOverlay {
  tick: number;
  mark: string; // 'p', 'f', 'crescendo', 'decrescendo'
  durationTicks?: number; // for hairpins
}

export interface PedalOverlay {
  tick: number;
  type: 'sustain-down' | 'sustain-up' | 'sustain-change' | 'una-corda';
}

export interface HandCrossingEvent {
  tick: number;
  durationTicks: number;
  higherHand: 'LH' | 'RH';
  description?: string;
}

export interface QuantizedGridScore {
  title: string;
  composer: string;
  opus?: string;
  ticksPerBeat: number;
  totalTicks: number;
  notes: QuantizedNote[];
  timeSignatures: TimeSignatureOverlay[];
  barlines: BarlineOverlay[];
  tempos: TempoOverlay[];
  dynamics: DynamicOverlay[];
  pedals: PedalOverlay[];
  handCrossings?: HandCrossingEvent[];
}
```

---

## 4. Jánko 4-Row Physical Mapping

Each pitch coordinate $(p, o)$ with linear index $\mathcal{L} = o \times 12 + p$ maps directly onto the 4-row Jánko keyboard:

- **Row 1 (WT-A bottom)**: Contains keys where $\mathcal{W}(p) = 0$ ($p \in \{0, 2, 4, 6, 8, 10\}$).
- **Row 2 (WT-B lower-mid)**: Contains keys where $\mathcal{W}(p) = 1$ ($p \in \{1, 3, 5, 7, 9, 11\}$).
- **Row 3 (WT-A upper-mid)**: Duplicate of Row 1 ($\mathcal{W}(p) = 0$).
- **Row 4 (WT-B top)**: Duplicate of Row 2 ($\mathcal{W}(p) = 1$).

### Key Column Coordinate ($X$)
Let key column position $X$ be measured in whole-tone units ($1 \text{ unit} = 2 \text{ semitones}$):
$$X(p, o) = o \times 6 + \lfloor p / 2 \rfloor$$

Horizontal offset for Row 2 & 4:
$$X_{\text{stagger}} = +0.5 \text{ key units}$$

This geometric formulation ensures that the visual coordinate on a vertical isomorphic staff directly computes the physical key position on the 4-row keyboard in $\mathcal{O}(1)$ time with no conditional branching on key signature or clef.
