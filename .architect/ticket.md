# Ticket: Round 20 — Rest Seats + Urtext Re-cut (rests + ALL flags + whole) + Unison Merge + Nib Fix

## Kind

bounded

## Scope of this delegation

Round 20 ONLY (§§A–F + testing plan). This ticket ABSORBS
`.architect/tickets/da81a560-d651-4348-ac80-d7ac413d9aa8.md` (nib fix —
do not dispatch separately). Explicitly OUT (deferred, named so nothing
is lost): Middle-C kills + needs-round definitions; stack-yield mechanism
is DEAD (R19 approved golden/RH — record its death, do not build it).

Standing corrections to the R19 ticket's scope notes (both verified
against the code this round — the R19 notes were wrong):

- "Isolated 16th flags never render" is FALSE. Bach renders 11
  double-hook flags (all `kinetic-tab-beam`); Brahms 109 singles, 0
  doubles. ALL flags are in scope: 8th singles + 16th doubles, every
  live subdivision style.
- "Whole rests do NOT exist in the engine" is FALSE as stated. The glyph
  value set tops out at `'half'`, but 192-tick silences are statable
  (`REST_STANDARD_VALUES`) and paint through the half/whole bar path.
  The whole-bar FORM is fully in scope (re-cut + seat + specimen).

## Problem

1. **Rests don't sit where the notes are.** Operator fact, undisputed:
   rests read displaced from their rows. Root (operator's diagnosis,
   adopted): the seating math centers geometric boxes while the eye
   centers ink gravity — when box math and ink weights disagree, the
   boxes are wrong.
2. **Our rests/flags are from-memory interpretations, never measured
   against a cut.** Operator verdict after side-by-side review: "ours
   all worse." Every rest glyph + every flag hook gets re-cut to the
   classical standard. Served comparisons: `public/img/rest16-orig-vs-
   ours.png`, `sbs_resteighth.png`, `sbs_restquarter.png`,
   `sbs_resthalf.png`, `sbs_flag8.png` (8th). No 16th-flag comparison
   exists — the 11 Bach doubles are judged live.
3. **The Goldberg ends in duplicate.** `bach-var1-550` (RH) +
   `bach-var1-551` (LH): identical pc7/oct3, tick 4560, dur 48 — two
   "7"s side by side. Absurd; merge to one. Census: Bach unisons = 1
   (this one). Brahms = 7 (1 same-dur, implementer locates it; 6 with
   differing durations — see §D). Operator rule: one onset + one pitch
   = one sound event = ONE digit, always — no one draws the same note
   twice, on piano or anywhere else.
4. **Dotted-clasp nib** (absorbed ticket): the clasp dot fuses with its
   own mark (m.3 tick 432: ~1.05pt overlap of dot into ring stroke;
   10 dotted-ring + 2 dotted-slash cases in Brahms, all fused). Clasp
   dots are unaudited today.
5. **R19 verdict close-out.** R19 golden (RH anchor) APPROVED by the
   operator. The `clusterAnchor` demonstrator axis is dead: RH behavior
   becomes the only path.

## Change

### A. Optical rest seats (the boxes were wrong)

- Rests stay on phrase rows. Seating is OPTICAL: the glyph's
  ink-centroid sits on the seat point, both axes. Per-glyph boxes carry
  their gravity point (the centroid is data, computed from the glyph's
  ink, not from its bounding box).
- Linter asserts centroid-on-row (violation, not warning).
- Applies to every rest value incl. the whole-bar form.

### B. Urtext re-cut — rests + ALL flags + whole bar

- Re-cut to classical standard shapes, keeping our 0.90pt weights and
  the §A optical seats: 16th / 8th / quarter / half-bar / whole-bar
  rests (reference U+1D13B–U+1D140-class proportions: slanted stems
  with oval heads, true serpentine quarter, wide slabs) and EVERY flag
  hook the engine paints — 8th singles, 16th doubles, all live
  subdivision styles (implementer inventories ALL flag paint sites;
  reference U+1D160-class taper curve). No per-glyph special rules; no
  grid relaxation.
- Half vs whole bar: implementer FIRST verifies how 96- vs 192-tick
  silences paint today, then cuts both forms to classical standard
  (whole hangs below its seat row, half sits atop its own) under the
  optical seats. If the two forms paint identically today, that is part
  of this defect, not a separate ticket.
- Rest-duration-specimen gains a 192-tick whole-silence context (no
  whole form renders anywhere in the corpus today — Bach 16th×3/8th×3/
  qtr×3, Brahms 16th×3, RestSpec one each 16th/8th/qtr/half). Mirrors
  the Round 9/10 specimen precedent: the whole bar is judged on clean
  material.

### C. Flags — same bar as rests

Covered by §B (listed separately so it can never be scoped back out):
every `janko-flag` the renderer emits, single or double hook, re-cut to
the classical taper. Judged live on Bach (34 singles + 11 doubles) and
Brahms (109 singles).

### D. Unison merge (one sound → one digit; rhythm stays per-voice)

- Same onset + same pitch + both hands → ONE digit at the
  anchor-winner's column x (golden: the RH head's x). NO duration veto
  (the architect's veto idea is withdrawn — the operator is right: one
  onset+pitch is one sound event, it can only be produced once, and no
  one draws it twice). All 8 corpus unisons merge: Bach final 550/551,
  Brahms same-dur ×1, and the 6 Brahms differing-duration unisons
  (11376:6:2 84/24, 11472:3:2 84/24, 12360:9:2 21/156, 12384:2:3
  21/132, 12552:9:2 21/156, 12576:2:3 21/132).
- Exact duplicates (Bach final + Brahms same-dur): voices identical →
  one digit + one rhythm voice.
- Differing durations: one digit + BOTH rhythm voices via the EXISTING
  mixed-duration machinery (coincident stems, each voice's beam/flag at
  its own end — the R16 rule; clasp duration groups are already
  per-hand per R19). Rationale: heads merge because there is one sound;
  rhythm voices stay per-voice because beams carry meter and phrasing —
  longest-only would punch holes in beam groups. No new doctrine: the
  merged head is an ordinary two-voice mixed-duration unit. Same deal
  as traditional notation's one-head-two-stems.
- STOP: if the mixed-duration machinery assumes single-hand somewhere
  load-bearing, STOP and report — do not fork the doctrine silently.
- Linter: same-onset+same-pitch both-hands rendering two digits is a
  violation after this ticket, no duration exception (the defect class
  may never return silently).

### E. Nib fix (absorbed — result binding, mechanism free)

- Dotted clasps (all 12 Brahms cases): the dot reads as a clean
  satellite of its mark — daylight ≥ hug air vs mark ink AND vs every
  neighbor ink box, in 2D. Recommended (NOT binding): up-and-right of
  the mark tracking its edge, through a shared helper with note dots.
  Firmly rejected with reason: wedging at `yMid` (channel infeasible).
  Hug air from existing dot tokens; no new magic numbers; note-dot
  pixels byte-identical (guard it — unification with note dots is
  optional, only if zero-move).
- `claspInkBox` / `CLASP_MARK_REACH` follow the paint exactly.
- New linter violation on clasp-dot/mark fusion (kebab-case, existing
  style). STOP CONDITION: if hug air can't be met in 2D on any corpus
  case, STOP and report numbers — no graze, no unilateral air shrink,
  no spine move.

### F. Verdict close-out + Round 20 registry

- Retire `clusterAnchor`: RH behavior canonical, demonstrator + option
  removed, tests/registry updated. Record the stack-yield's death in
  the harness doc (one line: decided against by R19 approval, not
  deferred).
- Registry: Round 20 is a VERIFICATION round — no open axis. Windows on
  fixed golden (implementer follows the studio's no-open-axis form per
  `test/janko-studio.test.ts` + studio arch): rest specimen incl. new
  whole context; Bach 8th-flag + 16th-flag windows; Brahms seat
  windows; unison windows (Bach final + Brahms merges, beams visible);
  m.3 nib window.
- Record seats + re-cut + unison + nib in `docs/janko_engraving_harness.md`.

## Testing plan

- `npm test` — green. `npm run lint:engraving --strict` — clean on
  Bach + Brahms (+ specimens) golden. `npm run build` — clean.
- Seats: centroid-on-row pinned per value (incl. whole-bar form).
- Re-cut: shape-proportion pins where the reference gives numbers;
  everything else judged live (macro windows) — no fake-precision
  assertions on curves.
- Whole: hang-vs-sit pinned (whole hangs below seat row, half sits
  atop); RestSpec whole context renders exactly one whole bar.
- Unison: 550/551 render one digit; all 7 Brahms unisons render one
  digit with both beams/flags intact (no beam holes); violation
  fixture on same-pitch doubling.
- Nib: m.3 satellite daylight (mechanism-free pin + recorded position);
  score-wide sweep all 12 dotted clasps; note-dot no-move guard;
  violation fixture on old fused geometry.
- Full-score visual sweep (/tmp renders, never committed): every moved
  rest, every re-cut flag, both merges, all 12 moved dots — both
  scores + specimens. Rest/flag ink moves score-wide; the sweep is the
  gate, not the windows.
- `public/img/` + checkout root untouched.

## Risks

- Seats move every rest; re-cut moves every rest + flag. Blast radius
  is total ink, judgment is the operator's eye on live macros — the
  implementer's sweep must be genuinely full-score, not window-deep.
- Whole-bar hang must not collide with the row below (linter + sweep).
- Unison merge touches Bach's final bar + 7 Brahms onsets. The
  differing-duration six keep both rhythm voices — the sweep must
  confirm every beam group survives whole.
- Dots move toward heads: the digit side is the tight side (see §E
  STOP). Spine never moves.
- Registry form: no-open-axis rounds must still satisfy the studio
  architecture tests — implementer reads those tests before writing the
  registry.

## Review

Post-land studio `http://100.102.70.49:5175/janko.html` — Round 20
verification windows. Operator verdicts: (1) seats read — rests sit
where the notes are; (2) urtext cuts approved — rests, ALL flags,
whole bar; (3) unisons merged — Bach final single 7, all 7 Brahms
single digits with beams intact; (4) nib gone.
