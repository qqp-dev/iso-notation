# Definitive Duodecimal Solfège System for 12-TET Iso-Notation

> **An intuitive, monosyllabic phonetic notation for 12-TET equal temperament, derived directly from the duodecimal numerals (0..9, a, b) and Jánko keyboard whole-tone row parities.**

---

## 1. The Duodecimal Breakthrough

Traditional solfège (*Do-Re-Mi-Fa-Sol-La-Ti*) was created for 7-note diatonic church modes in the 11th century. When extended to modern 12-TET music, it breaks down:
- It requires arbitrary multisyllabic names ("seven", "eleven") or convoluted accidental modifiers (*Di, Ri, Fi, Si, Li*).
- It forces musicians to memorize arbitrary abstract syllables that have no relation to the physical notes on an isomorphic keyboard.

In duodecimal iso-notation, notes are represented directly by their base-12 pitch-class numerals:
$$\mathbf{0,\; 1,\; 2,\; 3,\; 4,\; 5,\; 6,\; 7,\; 8,\; 9,\; a,\; b}$$

The **Definitive Duodecimal Solfège System** creates an instantaneous, 1-to-1 phonetic shorthand for each numeral. Each syllable is a natural, monosyllabic reduction of the word used to pronounce the symbol itself:

| Pitch Class | Numeral | Word / Origin | Definitive Syllable | Jánko Row | Description |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **0** | `0` | *oh / zero* | **o** | **Row 0** (Even) | Clean open vowel grounding root of Row 0 |
| **1** | `1` | *one* | **wa** | **Row 1** (Odd) | Gliding semi-vowel onset of Row 1 |
| **2** | `2` | *two* | **tu** | **Row 0** (Even) | Crisp dental strike on Row 0 |
| **3** | `3` | *three* | **ti** | **Row 1** (Odd) | High dental continuant on Row 1 |
| **4** | `4` | *four* | **fo** | **Row 0** (Even) | Labiodental fricative on Row 0 (5th landmark) |
| **5** | `5` | *five* | **fa** | **Row 1** (Odd) | Open labiodental release on Row 1 |
| **6** | `6` | *six* | **si** | **Row 0** (Even) | Sibilant tritone landmark on Row 0 |
| **7** | `7` | *seven* | **se** | **Row 1** (Odd) | Mid-vowel sibilant fifth landmark on Row 1 |
| **8** | `8` | *eight* | **e** | **Row 0** (Even) | Bright mid-front vowel on Row 0 |
| **9** | `9` | *nine* | **na** | **Row 1** (Odd) | Alveolar nasal resonance on Row 1 |
| **10** | `a` | *ten / a* | **a** | **Row 0** (Even) | Low open central vowel on Row 0 |
| **11** | `b` | *eleven / b* | **bi** | **Row 1** (Odd) | Voiced bilabial pop leading into octave on Row 1 |

---

## 2. Structural & Biomechanical Invariants

### 2.1 Direct Numeral Isomorphism
Because every syllable is the natural phonetic pronunciation of the symbol on the page:
- **Zero Translation Latency**: There is no secondary lookup table or mnemonic cipher. When a musician reads `7`, they instinctively say **`se`**. When they read `b`, they say **`bi`**.
- **Intuitive Acquisition**: New readers master all 12 syllables in minutes rather than weeks.

### 2.2 Whole-Tone Row Parity Invariant
Physical Jánko keyboards and iso-notation score matrices are organized into two alternating whole-tone rows separated by semitones:
- **Whole-Tone Row 0 (Evens)**: $\{0, 2, 4, 6, 8, a\} \longrightarrow \{\mathbf{o, tu, fo, si, e, a}\}$
- **Whole-Tone Row 1 (Odds)**: $\{1, 3, 5, 7, 9, b\} \longrightarrow \{\mathbf{wa, ti, fa, se, na, bi}\}$

Odd and even numbers partition the notes between physical keyboard rows with mathematical precision. Sight-singing or reciting the syllables immediately informs the player of the physical hand position and keyboard tier.

### 2.3 Interval Geometry & Mental Tracking
- **Semitone Steps ($\Delta = \pm 1$)**: Strictly alternate row parity:
  $$\text{Even} \longleftrightarrow \text{Odd}$$
  Example: $\mathbf{o \to wa \to tu \to ti \to fo \to fa \to si \to se \to e \to na \to a \to bi \to o}$
- **Whole-Tone Steps ($\Delta = \pm 2$)**: Strictly preserve row parity:
  $$\text{Row 0:}\; \mathbf{o \to tu \to fo \to si \to e \to a \to o}$$
  $$\text{Row 1:}\; \mathbf{wa \to ti \to fa \to se \to na \to bi \to wa}$$
- **Tritone Symmetry ($\Delta = 6$)**: Always lands on the same row with identical parity:
  - $0 \leftrightarrow 6$: **`o`** $\leftrightarrow$ **`si`** (Row 0)
  - $1 \leftrightarrow 7$: **`wa`** $\leftrightarrow$ **`se`** (Row 1)
  - $2 \leftrightarrow 8$: **`tu`** $\leftrightarrow$ **`e`** (Row 0)
  - $4 \leftrightarrow a$: **`fo`** $\leftrightarrow$ **`a`** (Row 0)

---

## 3. Benchmark Recitation: Bach Goldberg Variations (Var. 1)

Theme mm. 1–2 (Right Hand running 16th notes):
- **Numerals**: `7 - 6 - 7 - 2 - 4 - 6 - 7 - 9 - b - 1 - 2 - 1 - 2`
- **Definitive Solfège**:
  $$\mathbf{se - si - se - tu - fo - si - se - na - bi - wa - tu - wa - tu}$$

### Rapid Recitation Dynamics
1. **`se - si - se`**: High-speed sibilant alternation between Row 1 and Row 0 ($7 \to 6 \to 7$).
2. **`tu - fo - si - se`**: Crisp dental-labial whole-tone ascent across Row 0 ($2 \to 4 \to 6$) terminating in Row 1 ($7$).
3. **`na - bi - wa - tu - wa - tu`**: Resonant nasal-bilabial drive reaching the upper octave ($9 \to b \to 1 \to 2$).

The syllables roll off the tongue effortlessly at allegro tempos (120–160 BPM), with immediate, transparent feedback of both pitch-class value and physical hand coordinates.
