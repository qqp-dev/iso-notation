# Jánko Two-Row Engraving Ergonomics Harness

> First-class iteration loop for the **Jánko Two-Row Equator** grand staff:
> a modular engine, a **live two-view web studio**, a **mathematical visual
> linter** and targeted macro crops in sub-second time.

---

## 0. The review loop (read this first)

Design review happens **on the live website**, never by refreshing PNGs:

| Surface | URL | Purpose |
| --- | --- | --- |
| Candidates view | `http://100.102.70.49:5175/janko.html#candidates` | the 2–4 candidates of the *current decision round*, side by side |
| Reference view | `http://100.102.70.49:5175/janko.html#reference` | the golden master: full page spread + macro crops + lint diagnostics |

- `janko.html` is a **Vite entry** that imports `src/render/janko/studio.ts`;
  every SVG is rendered in the browser by the same TypeScript engine used by the
  CLI, so the page **cannot drift** from the engraving code.
- Vite HMR (`import.meta.hot`) re-renders both views in place on every edit
  under `src/render/janko/` — zero user action.
- Candidates are declared in `src/render/janko/candidates.ts`
  (`CURRENT_ROUND_METADATA` + `CURRENT_CANDIDATES`); the page template is never
  edited.
- Zoom: `+`/`−`/`Reset` buttons, `+`/`−`/`0` keys, `Ctrl/⌘ + wheel`, 50 %–300 %.
- `public/janko.html` is a byte-identical mirror of the root entry (the dev
  server serves the public copy verbatim; the production build processes the
  root entry), enforced by `test/janko-studio.test.ts`.

Implementers verify the same engraving **without rendering anything**:

```bash
npm run lint:engraving            # ~25 ms, JSON/strict/quiet flags available
npm test                          # 147 tests, < 1.5 s, includes the linter + studio suites
```

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
├── engine.ts             page / crop / variant composition + shared layout model
├── candidates.ts         declarative candidate registry for the current round
├── linter.ts             mathematical visual linter (knockouts, clearance, beams, corridor)
├── studio.ts             two-view live studio renderer (Vite HMR entry)
└── elements/
    ├── staff.ts          octave equators, opt-in spine/row guides, ledgers
    ├── notehead.ts       white knockout, URW Gothic digit, Position of Honor halo
    ├── rhythm.ts         centred stems · angled cuts · horizontal ticks · beams + flags
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
| Middle C corridor | **spacious spine-free**: 56 pt of negative space (o4 −28 / o3 +28), no dividing rule |
| Horizontal dotted lines | none — the vertical beat-grid pulses are the only dashed elements |
| Position of Honor halo | `R = 6.2 pt` at tick 0 of Measure 1 |
| Notehead knockout | `r = 4.8 pt` around a `5.8 pt` URW Gothic digit (≥ 1.2 pt of white on every side) |
| Digit optical centre | alphabetic baseline dropped half a cap height (`0.739 em × 4/3` per pt) below the head centre |
| Stem attachment | flush on the outer perimeter: `r + 0.2 pt` (regular), `haloR + 0.4 pt` (tick 0) |
| Stem column | `stemX === note.x` (centred on the notehead, both hands) |
| Flag hook reach / drop | `4.0 pt` right of the stem / `6.6 pt` from the tip |
| Minimum head-to-beam air | `noteheadRadius + minStemClearance` = 6.3 pt |

Each hand anchors its own uniform lattice on its two home equators
(RH o4/o5, LH o3/o2) and extends it by 30 pt per octave, so out-of-staff
pitches (e.g. the RH run descending into octave 3 in m. 4) emit **dynamic
ledger equators** — one per intervening octave, nearest first.

### Tokens and options

`JankoTokens` (`rowHeight`, `noteheadRadius`, `haloRadius`, `octaveStep`,
`accoladeWidth`, `accoladeThick`, `fontFamily`, plus rhythm/spacing
refinements) and `JankoLayoutOptions` (`measuresPerSystem`, `rhythmStyle`,
`interStaffGap`, `middleCSpine`, `showRowGuidelines`, page/header/footer geometry) are the **only**
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
layoutJankoScore(score, options?, tokens?): JankoSystemLayout[]   // shared geometry model
```

Crops are exact viewBox narrowings of the full page, so a macro crop is
pixel-identical to the corresponding page region — no parallel layout path.
`layoutJankoScore` is the single source of truth for positioned noteheads and
resolved beam geometry; the renderers, the linter and the studio all consume it.

### Visual linter

`lintJankoScore(score, options?, tokens?, lintOptions?)` returns
`{ ok, violations, warnings, diagnostics, stats }` after checking, in ~25 ms:

| Check | Invariant |
| --- | --- |
| Notehead clearance | discs never overlap; chordal heads that land on one page point are warned |
| Knockout coverage | the 5.8 pt digit's ink box fits the `r = 4.8 pt` mask with ≥ 1.2 pt of white on **every** side (top, bottom, left, right, corner) |
| Knockout paint order | every digit owns a mask, every mask owns a digit, and nothing painted later may cut through it |
| Stem & beam validity | stems sit on the notehead centreline (`stemX === note.x`), attach **flush on the outside** of their glyph circle (`r + 0.2` / `haloR + 0.4`), land exactly on the beam centerline, slope ≤ 0.25 |
| Stem/digit clearance | no stem comes within 1.2 pt of its own digit glyph box |
| Halo clearance | no stem pierces the Position of Honor ring (outer stroke edge included) |
| Beam/notehead clearance | no beam connector (primary or 16th secondary) comes closer than `noteheadRadius + minStemClearance` to any notehead centre |
| Barline clearance | heads, stems and beams keep ≥ 1 pt from every barline |
| Margin furniture | measure numeral and accolade stay on the page, clear of the staff and each other |
| Middle C corridor | no structural rule or beam crosses the corridor centre line; when a spine is opted in it never cuts a glyph |

`npm run lint:engraving [--json|--strict|--quiet]` is the CLI (`0` clean,
`1` violations, `--strict` also fails on warnings).

### Rhythm engraving invariants

- **Centred stems** — `getStemGeometry` engraves every stem on the notehead's
  vertical centreline, so duration indicators begin exactly on the note column
  instead of staggering around a round-notehead perimeter.
- **Standard flags** — solitary / unbeamed notes of the `beamed` dialect carry
  calligraphic flag hooks latched to the stem tip (two for 16ths, one for 8ths,
  plus the augmentation dot for dotted values). Every hook sample stays strictly
  right of the stem, so no cross/dagger is ever drawn over the notehead. The
  `angled-cuts` and `horizontal-ticks` dialects keep their crossbar identity.
- **Elevated beams** — `computeBeamGroupGeometry` clamps the slope first, then
  raises (RH) or lowers (LH) the baseline until the extreme notehead in the stem
  direction keeps a full `stemLength`; every other stem in the group is longer.
  Ascending/descending runs therefore never see the beam cut through a head.
- **No straddling beams** — `partitionBeamGroups` splits a run when a longer
  value of the same hand sits between two beamable notes, so a connector never
  crosses a notehead that is not part of its own group.

### Two-view studio

```ts
renderCandidatesView(config?): string   // View 1 · Decision Candidates Matrix
renderReferenceView(config?): string    // View 2 · Golden Reference Object
mountJankoStudio(config?, rootId?)      // DOM mount + tabs + zoom + HMR re-mount
```

---

## 3. Export suite

`scripts/render_janko_suite.ts` (via `npm run janko:export`) renders:

| Artifact | Content | Zoom |
| --- | --- | --- |
| `janko_portrait_page1.png` | Full page 1, systems 1–3, mm. 1–12 | 2× |
| `janko_m1_m2.png` | m. 1–2: accolade, halo, spacious spine-free corridor, opening theme | 4× |
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
npm test                          # 136 tests, < 1.5 s
npm run lint:engraving            # visual lint of the golden master
npm run janko:export              # refresh the mobile-app PNG artifacts
npm run build                     # tsc + vite (index.html + janko.html entries)
```

| Suite | Locks |
| --- | --- |
| `test/janko-engraving.test.ts` | geometry invariants (rank mapping, lane offsets, 15 pt rows, 30 pt octave steps, ledger accumulation, halo placement, tick spacing), rhythm invariants (centred stems in every dialect, right-sided flag hooks with no crossbar, full stem length under every beam, no straddling beam group), engine composition (page/crop equivalence, pluggable dialects, variant sheet) and the export suite budget |
| `test/janko-linter.test.ts` | the report contract, the clean golden master, every defect class (overlap, undersized/missing knockout, pass-through, beam slope, floating/off-centre stem, beam-notehead collision, barline/accolade/numeral collision, corridor intrusion) and the CLI exit code |
| `test/janko-studio.test.ts` | both views, registry-driven candidates (zero template edits), the golden-master option badges, all-pages-engraved, page-shell navigation/zoom/HMR contract and the `public/` mirror identity |

The same-row 16th cluster `0 2 4 6 2` is exercised as a synthetic engine test
(Bach Variation 1 m. 8 does not contain that literal figure); the exported
`janko_m8.png` is the real m. 8 of the canonical benchmark.
