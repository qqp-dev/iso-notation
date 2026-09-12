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
npm run lint:engraving            # ~60 ms, JSON/strict/quiet flags available
npm test                          # 188 tests, < 4 s, includes the linter + candidate/studio suites
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
npm run janko:export   # ~1.2 s, twelve PNGs, six delivery locations each
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
| Octave equator step | `2h` = 30.0 pt (the o3→o4 step is the 56 pt corridor) |
| Grand staff span | **absolute, hand-independent**: o5 −58 / o4 −28 / o3 +28 / o2 +58 pt |
| Middle C corridor | **spacious spine-free**: 56 pt of negative space (o4 −28 / o3 +28), no dividing rule |
| Horizontal dotted lines | none — the vertical beat-grid pulses are the only dashed elements |
| Position of Honor halo | `R = 6.2 pt` at tick 0 of Measure 1 |
| Notehead knockout | `r = 4.8 pt` around a `5.8 pt` URW Gothic digit (≥ 1.2 pt of white on every side) |
| Digit optical centre | alphabetic baseline dropped half a cap height (`0.739 em × 4/3` per pt) below the head centre |
| Stem attachment | flush on the outer perimeter: `r + 0.2 pt` (regular), `haloR + 0.4 pt` (tick 0) |
| Stem column | `stemX === note.x` (centred on the notehead, both hands) |
| Flag hook reach / drop | `4.0 pt` right of the stem / `6.6 pt` from the tip |
| Minimum head-to-beam air | `noteheadRadius + minStemClearance` = 6.3 pt |
| Channel layouts (Round 4) | `'single-equator'` `+7.5/−7.5 pt` (4 lines) · `'on-the-line'` `0/−15 pt` (4) · `'single-line-3row'` `0/±15 pt` (4) · `'bounded-channel'` `0/±13 pt` with rules at `equator ± 6.5 pt` (8) |
| Channel boundary clearance | `6.5 − 4.8 = 1.7 pt` of clean air around every notehead disc |
| Channel contour | `Δpitch > 0 ⇒ Δy ≤ 0`, `Δpitch < 0 ⇒ Δy ≥ 0` — never inverted |

`getEquatorYForOctave` resolves **one** coordinate per octave, identical for both
hands: `octave >= 4` maps to `-halfGap - (octave - 4) * 30`, `octave <= 3` to
`+halfGap + (3 - octave) * 30`. Octaves 2–5 are the four continuous staff rules
and therefore **never** produce ledger lines, whichever hand plays them (the LH
octave-4 and RH octave-3 crossings of mm. 3–4 sit on the true rules instead of
growing phantom cuts inside the corridor). `isOutOfStaffOctave` is strictly
`octave < 2 || octave > 5`; only those out-of-staff pitches emit **dynamic
ledger equators** — one per intervening octave, nearest first. A beam whose
connector passes a foreign notehead of the shared staff is pushed uniformly
further away from its own heads until every such head keeps 6.3 pt of air.

### Channel layouts (Round 4 domain exploration)

`DEFAULT_JANKO_OPTIONS.channelLayout` is `'single-equator'`: the golden master is
untouched, and its engraving is byte-identical with the other framings in place.
`JankoChannelLayout` declares four comparative paradigms, all on the same
absolute octave lattice:

| Layout | Rules/octave | Set A (even pc) | Set B (odd pc) | Lines |
| --- | --- | --- | --- | --- |
| `'single-equator'` (golden) | 1, on the equator | `+h/2` = `+7.5 pt` below | `-h/2` = `-7.5 pt` above, static parity | 4 |
| `'on-the-line'` | 1, on the equator | `0 pt` — centred **on** the rule | `-h` = `-15 pt` above, static | 4 |
| `'single-line-3row'` | 1, on the equator | `0 pt` — centred **on** the rule | `∓h` = `∓15 pt`, contour-resolved | 4 |
| `'bounded-channel'` | 2, at `equator ± 6.5 pt` | `0 pt` — inside the channel | `∓13 pt`, contour-resolved | 8 |

- `getChannelLayoutSpec(options, tokens)` is the single source of truth for the
  table (`setAOffset`, `setBOffset`, `flankMagnitude`, `rulesPerEquator`,
  `staffRules`, `dynamicFlanks`, `setAOnRule`); the studio, the tests and the
  export suite all read it, and `JANKO_CHANNEL_LAYOUTS` fixes the A–D order.
- `renderStaffLines` paints one rule per staff octave for the first three
  layouts (4 lines across the grand staff) and **two** boundary rules per octave
  for `'bounded-channel'` (8 lines). `renderLedgerEquator` applies the same
  pairing to dynamic ledger equators.
- `usesContourFlanks(layout)` marks the two dynamic framings;
  `resolveChannelFlanks(notes, options, tokens)` resolves the side of every
  whole-tone Set B note (odd pitch classes) **per voice** with a two-state
  dynamic program over the score in tick order: `'up'` = the row above
  (`-flankOffset`), `'down'` = the row below (`+flankOffset`), where the offset
  is `rowHeight` (15 pt) for `'single-line-3row'` and `channelFlankOffset`
  (13 pt) for `'bounded-channel'`. Among the assignments that minimise contour
  contradictions the solver prefers, in order, the flank the local melodic
  direction asks for, no zigzag on a repeated pitch, and finally the canonical
  upper (odd-rank) row.
- The two static framings anchor Set B on a single row, so the solver map is
  empty. `'on-the-line'` and `'single-line-3row'` put every Set A notehead
  **on** the rule, so its knockout cuts that rule — the visibility trade-off the
  round is studying. The linter reports the consequence honestly: on the
  canonical Bach score both anchored framings surface exactly two
  `measure-numeral-collision` violations (the outer Set B row reaches the
  numeral margin at mm. 9 and 29), while `'single-equator'` and
  `'bounded-channel'` stay violation-free.
- The solver is exact and pure, so the layout engine, the linter and the tests
  agree: on the canonical Bach score all dynamic-layout same-hand steps satisfy
  `Δpitch > 0 ⇒ Δy ≤ 0` and `Δpitch < 0 ⇒ Δy ≥ 0`, with hundreds of them
  absorbed as **flat** steps on the center row.

### Tokens and options

`JankoTokens` (`rowHeight`, `noteheadRadius`, `haloRadius`, `octaveStep`,
`channelHalfWidth` = 6.5, `channelFlankOffset` = 13.0, `accoladeWidth`,
`accoladeThick`, `fontFamily`, plus rhythm/spacing refinements) and
`JankoLayoutOptions` (`measuresPerSystem`, `rhythmStyle`, `interStaffGap`,
`middleCSpine`, `channelLayout` = `'single-equator' | 'on-the-line' |
'single-line-3row' | 'bounded-channel'`,
`showRowGuidelines`, page/header/footer geometry) are the **only**
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
`{ ok, violations, warnings, diagnostics, stats }` after checking, in ~60 ms:

| Check | Invariant |
| --- | --- |
| Notehead clearance | discs never overlap (true centre distance, so near rows are measured as circles); chordal heads that share a row are **spread horizontally** by the row-snapped parity offset, and only a spread narrower than `2r` is warned |
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
  Ascending/descending runs therefore never see the beam cut through a head. The
  same uniform push clears every foreign notehead of the shared staff by
  `noteheadRadius + minStemClearance`, and — when the system's Middle C spine is
  handed to the solver — keeps the connector entirely out of the corridor
  (`BEAM_SPINE_CLEARANCE` = 2.0 pt, the linter's `corridorClearance`). The
  renderer draws the **resolved** geometry it is given, so the painted connector
  is exactly the one the solver and the linter reason about.
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
| `janko_m4.png` | m. 4: RH cascading run onto the shared octave-3 staff rule (zero phantom ledgers) | 4× |
| `janko_m8.png` | m. 8: 16th-cluster horizontal-spacing stress test | 4× |
| `janko_variants.png` | A Angled Cuts vs B Traditional Beams vs C Unified Continuous Lattice on mm. 1–4 | 2× |
| `janko_domain_exploration.png` | Round 4 domain sheet: the four channel paradigms on mm. 1–2, stacked | 3× |
| `janko_domain_a.png` | Candidate A · floating single equator (golden master) on mm. 1–2 | 4× |
| `janko_domain_b.png` | Candidate B · base row anchored on the line, Set B static above | 4× |
| `janko_domain_c.png` | Candidate C · single line, three rows (contour-resolved flanks) | 4× |
| `janko_domain_d.png` | Candidate D · bounded center channel, 8 lines | 4× |

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
npm test                          # 166 tests, < 4 s
npm run lint:engraving            # visual lint of the golden master
npm run janko:export              # refresh the mobile-app PNG artifacts
npm run build                     # tsc + vite (index.html + janko.html entries)
```

| Suite | Locks |
| --- | --- |
| `test/janko-engraving.test.ts` | geometry invariants (rank mapping, lane offsets, 15 pt rows, 30 pt octave steps, unified absolute equator lattice, zero in-staff ledger cuts, halo placement, tick spacing), the bounded center channel (option/token schema, two boundary rules per equator, Set A in the channel, direction-resolved Set B flanks, zero contour contradictions on the canonical score), rhythm invariants (centred stems in every dialect, right-sided flag hooks with no crossbar, full stem length under every beam, no straddling beam group), engine composition (page/crop equivalence, pluggable dialects, variant sheet) and the export suite budget |
| `test/janko-linter.test.ts` | the report contract, the clean golden master, the clean bounded channel, every defect class (overlap, undersized/missing knockout, pass-through, beam slope, floating/off-centre stem, beam-notehead collision, barline/accolade/numeral collision, corridor intrusion) and the CLI exit code |
| `test/janko-studio.test.ts` | both views, registry-driven candidates (zero template edits), the Round-4 registry (incumbent vs bounded channel), the contact sheet, the golden-master option badges, all-pages-engraved, page-shell navigation/zoom/HMR contract and the `public/` mirror identity |

The same-row 16th cluster `0 2 4 6 2` is exercised as a synthetic engine test
(Bach Variation 1 m. 8 does not contain that literal figure); the exported
`janko_m8.png` is the real m. 8 of the canonical benchmark.
