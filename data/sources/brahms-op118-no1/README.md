# Brahms Op. 118 No. 1 — Source-Fidelity Contract & Regeneration Procedure

Vendored LilyPond witness (Knute Snortum, CC BY-SA 4.0) plus the deterministic
exporter that produces written durations. This directory is the offline
source boundary: ordinary `npm test` / `npm run build` / browser score
building never invoke LilyPond or the network; the compiler runs only via the
explicit export command below.

## Pinned sources (original bytes preserved)

- Upstream: `https://github.com/ksnortum/brahms-opus-118`
  commit `b792764e004ece0498ff7fc736ab9ed7bcf44b68`.
- `includes/intermezzo-op118-no1-parts.ily` — 14032 bytes,
  md5 `9d794386719fc1198890aa233c2b6c6a`,
  git blob `4ddaa2bde06f050c556e603706b5422eecd3783f`.
- `includes/global-variables.ily`, `includes/spline-sandwitch.ily` — required
  siblings (relative includes preserved verbatim).
- Full pins (sha256, blobs): `manifest.json`.
- Attribution: `licenses/CC-BY-SA-4.0-Snortum-Brahms-Op118.txt` (covers MIDI,
  vendored source and derived fixture).

## Source-fidelity contract (executable)

Verified source/version/edition scope → exact source events → bijectively
matched score durations → unchanged deterministic engraving
rules/configuration → automated musical/geometry/frozen-reference gates →
real-engine operator review for genuinely new cases.

- Coverage distinguishes duration/pitch/onset correspondence and repeat/tie
  conversion (this milestone) from uncertified dynamics, pedal, articulation
  display, notated voices/hand intent, phrasing and printed form/repeats
  (explicit subsequent working-sheet tasks). The sheet is NOT labelled
  wholly faithful.
- Articulation never changes written duration. MIDI remains a performance
  witness and identity baseline, never notation-duration truth. Tie
  interpretation follows the pinned source and LilyPond documented semantics
  (https://lilypond.org/doc/v2.26/Documentation/notation/writing-rhythms#ties),
  not MIDI playback behaviour.
- Matching hand is ONLY the existing MIDI-track matching label (staff
  destination: upper→RH, lower→LH) to preserve the approved 964-key track
  assignment. Logical source voices (`rightHandUpper/Lower`,
  `leftHandUpper/Lower`) remain separately preserved in provenance;
  intended hands are NOT certified, especially at cross-staff passages.
  Voice-based hand alone yields 958 keys with 61 missing / 55 extra and is
  rejected by the bijection gate. This track-label projection must not be
  reinterpreted as permission to coerce event counts or duration data.
- Unfamiliar constructs or ambiguous mappings produce explicit diagnostics
  and stop certification; no optimistic fallback, no duration guessing.

## Extraction (LilyPond's own parser, pre-playback)

- `scripts/brahms-written-durations-listener.ly` — Scheme event listener
  (Voice `\consists`, page printing disabled via `-dno-print-pages`).
  Captures per NoteEvent: exact rational onset/duration (whole-note
  moments), pitch semitones, TieEvent articulation flag, origin
  file/line/column, voice id, staff destination (parent Staff id, tracks
  `\change Staff`), unfolded bar number, `tieWaitForNote` property; plus
  stream TieEvents per onset for chord-wide ties.
- `scripts/brahms-export-written-durations.ts` — configured driver:
  verifies `manifest.json`, generates a temp wrapper (no repo artifacts),
  runs LilyPond, normalizes via `src/scores/brahms-source-fidelity.ts`,
  writes the versioned fixture + provenance. No MIDI note-off timing, no
  articulate, no handwritten LilyPond parsing, no ratios/guessing, no
  SVG/PDF/PNG artifacts (transient compiler text stays in temp dir).

## Normalization (pure, tested TypeScript)

`src/scores/brahms-source-fidelity.ts`:

- Scales exact rational whole-note times by 192; requires representable
  integer ticks (rejects fractional grid ticks, no rounding). Pickup origin
  explicit: onset 0 = pickup start = tick 0; anacrusis 48 ticks is the
  pickup duration, not an offset.
- Tie association per source voice and pitch, explicitly declared:
  per-note TieEvent articulations plus stream TieEvents (chord-wide ties
  carry exactly one stream TieEvent per onset with zero per-note flags;
  single-note ties carry both; per-note chord ties carry flags only).
  Mixed per-note + stream evidence on a multi-note onset is ambiguous and
  rejected. No adjacency-inferred ties.
- Merges only explicitly tied same-pitch segments in the same source voice
  at exact temporal adjacency to the immediate successor onset; reattacks
  stay separate. Declaration kind is preserved through resolution: explicit
  note-specific ties (per-note flags, single-note ties) require an eligible
  continuation and fail closed with voice/pitch/source/onset diagnostics
  when nonadjacent without `tieWaitForNote` or dangling; ordinary
  chord-wide ties apply only to matching pitches of the immediately
  following adjacent event per LilyPond source semantics, and unmatched
  chord tones remain legitimately untied — independent of any later
  recurrence — not an error (e.g. line 61 `<c ds fs c'>2~` into arpeggiated
  eighths: only the top C merges to 120 ticks). `tieWaitForNote` gaps
  (leftHand mm. 39–40 `a,4.*1/3~` / `d4~` into `<a d>2`, plus line 320–321
  A2 spanning a 48-tick gap to 168 ticks) merge across the gap to the next
  same-pitch segment with sounding duration (end − start, gap included).
  Unresolved explicit delayed ties need diagnostics, not fallback.
- Co-onset same-pitch/same-track voice unions (e.g. RHU half + RHL quarter
  on F4 at tick 1392) project to one runtime event with max (sounding)
  duration — an exact projection of source sounding coverage for this
  flattened runtime model, with all original voices/durations retained in
  provenance. This preserves the 964 bijection; it does not certify
  independently notated voices and must not coerce event counts.
- Rejects dangling/nonadjacent explicit note-specific ties,
  duplicate/ambiguous keys, unexplained timing, unsupported constructs and
  missing correspondence with actionable diagnostics. Mixed-staff tie chains
  are rejected.

## Regeneration

```sh
npm run brahms:export-durations        # verify + export + check fixture
LILYPOND_BIN=/path/to/lilypond npm run brahms:export-durations
```

- Verifies runtime `lilypond --version` (tested 2.26.0/Guile 3.0; witness
  declares 2.24; any 2.24+ accepted, actual recorded in provenance).
- Runs the exporter twice and requires byte-identical canonical fixture +
  provenance (determinism gate); `npm test` validates the checked-in files
  without a compiler.
- Known environment note: the `ly224root` 2.24.3 bundle hangs in this
  container (100% CPU, no output even on a one-note score); Homebrew 2.26.0
  completes in seconds and reproduces the 964 bijection plus the
  source-anchored whole-note (line 114 → 192 ticks) and staccato-eighth
  (line 327 → 24 ticks) expectations. A 2.26-only stub for the removed
  `ly:arpeggio::brew-chord-bracket` is injected before includes (layout-only,
  extraction unaffected).

## Provenance

- Runtime: `src/scores/data/brahms-op118-no1-written-durations.json`
  (versioned, stable ordering, relative paths, no timestamps).
- Companion: `src/scores/data/brahms-op118-no1-written-durations.provenance.json`
  (per-event tied segments, origins, voice/staff/bar/occurrence; linked by
  fixture sha256). `tieForward` there is the raw outgoing declaration
  (per-note TieEvent flag and/or chord-wide stream tie), not proof of a
  resolved tie: resolved connections are multi-segment events (e.g. line-61
  chord marks all four tones `tieForward: true`, but only the continuing
  top C has two segments for 120 ticks; the others have one segment each
  for 96 ticks).
- Microfixtures + negative tests: `test/fixtures/brahms-*`,
  `test/brahms-written-durations.test.ts`.
