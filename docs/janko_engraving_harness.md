# Jánko Two-Row Engraving Ergonomics Harness

> First-class iteration loop for the **Jánko Two-Row Equator** grand staff:
> modular engine, targeted macro crops and multi-variant contact sheets in
> sub-second time.

---

## 1. The iteration problem

Design rounds on the new Two-Row Equator notation used to cost 15+ minutes per
turn because:

1. **Procedural monolith** — coordinate math and inline SVG string templates
   were hardcoded in one script, so every layout tweak touched dozens of lines.
2. **Whole-page fatigue** — every micro-decision was judged on a full
   3-system A4 page (595 × 842 pt) instead of a targeted macro crop.
3. **Single-variant guessing** — one parameter choice was proposed per turn
   instead of a side-by-side contact sheet.
4. **Mechanical overhead** — images had to be copied by hand between the
   checkout, `docs/`, `public/` and the main project root.

The harness replaces all four failure modes with one command:

```bash
npm run janko:export   # ~0.4 s, five PNGs, six delivery locations each
npm run janko:watch    # same suite on every file change
```

---

## 2. Modular engine (`src/render/janko/`)

```
src/render/janko/
├── types.ts              JankoTokens + JankoLayoutOptions + defaults
├── geometry.ts           pure pitch/tick math (no SVG, no I/O)
├── engine.ts             page / crop / variant composition
└── elements/
    ├── staff.ts          octave equators, Middle C spine, row guides, ledgers
    ├── notehead.ts       white knockout, URW Gothic digit, Position of Honor halo
    ├── rhythm.ts         angled cuts · horizontal ticks · connected beams
    ├── accolade.ts       slender copperplate brace (w = 7.0, thick = 0.85)
    ├── barlines.ts       internal barlines + system boundaries
    └── style.ts          shared typographic style block
```

### Geometry invariants

| Invariant | Value |
| --- | --- |
| Whole-tone rank | `pc mod 2` (0 = evens, 1 = odds) |
| Rank 0 (0, 2, 4, 6, 8, a) | `h/2` **below** its octave equator |
| Rank 1 (1, 3, 5, 7, 9, b) | `h/2` **above** its octave equator |
| Row-to-row step `h` | 15.0 pt |
| Octave equator step | `2h` = 30.0 pt |
| Middle C spine | centred in the 45 pt inter-staff channel (o4 −22.5 / o3 +22.5) |
| Position of Honor halo | `R = 5.4 pt` at tick 0 of Measure 1 |
| Notehead knockout | `r = 4.2 pt` |

Each hand anchors its own uniform lattice on its two home equators
(RH o4/o5, LH o3/o2) and extends it by 30 pt per octave, so out-of-staff
pitches (e.g. the RH run descending into octave 3 in m. 4) emit **dynamic
ledger equators** — one per intervening octave, nearest first.

### Tokens and options

`JankoTokens` (`rowHeight`, `noteheadRadius`, `haloRadius`, `octaveStep`,
`accoladeWidth`, `accoladeThick`, `fontFamily`, plus rhythm/spacing
refinements) and `JankoLayoutOptions` (`measuresPerSystem`, `rhythmStyle`,
`interStaffGap`, `middleCSpine`, page/header/footer geometry) are the **only**
places layout constants live. Every renderer accepts partial overrides and
resolves them against `DEFAULT_JANKO_TOKENS` / `DEFAULT_JANKO_OPTIONS`.

```ts
import { renderJankoCrop } from './src/render/janko/engine';

const svg = renderJankoCrop(score, 4, 1, { rhythmStyle: 'beamed' }, { haloRadius: 6 });
```

### Public renderers

```ts
renderJankoPage(score, pageIndex, options?, tokens?): string
renderJankoCrop(score, measureStart, measureCount, options?, tokens?, caption?): string
renderJankoVariantComparison(score, variants?, measureStart?, measureCount?, baseOptions?, tokens?): string
```

Crops are exact viewBox narrowings of the full page, so a macro crop is
pixel-identical to the corresponding page region — no parallel layout path.

---

## 3. Export suite

`scripts/render_janko_suite.ts` (via `npm run janko:export`) renders:

| Artifact | Content | Zoom |
| --- | --- | --- |
| `janko_portrait_page1.png` | Full page 1, systems 1–3, mm. 1–12 | 2× |
| `janko_m1_m2.png` | m. 1–2: accolade, halo, Middle C anchor, opening theme | 4× |
| `janko_m4.png` | m. 4: RH cascading run into octave 3 with ledger equators | 4× |
| `janko_m8.png` | m. 8: 16th-cluster horizontal-spacing stress test | 4× |
| `janko_variants.png` | A Angled Cuts vs B Traditional Beams vs C Unified Continuous Lattice on mm. 1–4 | 2× |

Every PNG is mirrored automatically to:

1. current checkout root (`./`)
2. main project checkout root (`/home/qqp/projects/iso-notation/`)
3. `public/` (served by Vite on port 5175)
4. `docs/img/`

The matching `.svg` sources are written to `docs/img/` for designer
inspection. `resvg` is preferred for rasterization with an `rsvg-convert`
fallback.

---

## 4. Verification

```bash
npm test            # includes test/janko-engraving.test.ts
npm run janko:export
npm run build
```

`test/janko-engraving.test.ts` locks the geometry invariants (rank mapping,
lane offsets, 15 pt row steps, 30 pt octave steps, ledger accumulation, halo
placement, tick spacing), the engine composition (page/crop equivalence,
pluggable rhythm dialects, variant sheet), and the export suite itself
(five PNGs in every delivery location, under the 2-second budget).

The same-row 16th cluster `0 2 4 6 2` is exercised as a synthetic engine test
(Bach Variation 1 m. 8 does not contain that literal figure); the exported
`janko_m8.png` is the real m. 8 of the canonical benchmark.
