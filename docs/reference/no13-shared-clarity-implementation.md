# No. 13-led shared clarity — implementation receipt

Base: `8dd18fe1d5429ca4af07d02193df7da8a9dc80ca` (PR134). Changes are uncommitted, unlanded and not activated on the operator's served studio. No operator visual acceptance is claimed.

## Printed versus encoded opening

The existing Studio Source reference, Henle HN 45 folio 14, was read directly from its original public preview:
https://www.henle.de/media/1c/1b/ab/1692635407/0045_0028-1692635407-sync.jpg

Downloaded source-asset SHA256: `fe54eaa2ba7a030d27fb95540239695f8befb907930fd45f964ec5e3d10b5211`.

The last LH eighth of the first complete printed bar shows **one visible E-sharp head with two opposed voice stems**, not two adjacent heads. This is written 1 / unfolded 2, tick 96. Approved LY line 201 encodes two independent lower branches, both linear 53 (absolute symbol 5), both written duration 24. The approved LY hash remains `c9345d758fb6bb2bd88425d810e1578e4db497e7393f23bbda6504644fc3e15e`.

The new surface draws one head. Both original note IDs / logical voices remain in the score and merged contributor metadata. Necessary short-note beam/flag obligations remain separate rhythm records. Unequal engraved written values do not merge, including unequal tied statements; equal symbols an octave apart do not merge. No source LY/Scheme was executed, no source selection reopened, and no review images were generated.

## Shared implementation

- Head/component admission keeps LH first, then moves an entire conflicting RH component in whole units of the existing extent-derived 5.46pt gap. Independent same-hand source voices are not consolidated into shared chord streams. Continuation heads participate in the same solve and width admission.
- Independent rails reserve separate corridors. At genuine topological crossings, the final painted stem has a non-fusing underpass, preserving its own root and beam endpoint. Independent solo tips earn necessary length before flags/rings/ties/phrases/bounds are derived. Physical point/box queries and the linter see the actual visible intervals, including gaps, not a hypothetical minimum-length stem.
- Compatible unisons share ink, not source records. The opening's other LH rhythm survives on the common head.
- Contextual continuity is general, not a No14/hash/measure exception. The three lower.0 upper-staff/down-stem events at 3228/3240/3252 (and their repeat) are provisional LH with `contextual` evidence; logical voice, printed staff and performing hand remain distinct.
- Shared grace scale is 0.80 (4.64pt digits at the 5.8pt base), with coherent masks, stem weight, authentic flags, two-level beams and bounds. Pitch-axis distances, hosts and nonmetrical clocks are unchanged.
- Local transverse duration cuts use their own 5.0pt run, 0.65pt stroke, 0.50 rake. Genuine beam slope limits are unchanged. These are eighth/sixteenth duration marks, not time-proportional holds.
- Ties and phrasing share a slender two-cubic tapered contour constructor but retain separate semantics. Phrase tips use associated local head/chord/rhythm envelopes, unequal heights and intervening painted ink. Written continuations and merged owners resolve through the display plan. Grid-only knockouts protect contour crossings without masking foreign notes/rails; linter queries distinguish real ribbons from their empty bounding rectangles.
- Bravura dynamics remain authentic filled outlines at uniform 0.016 optical scale, with no erosion or anisotropic distortion.
- Fixed-3 upper-rule location remains linear 72; displayed/folded earning threshold is 78. Negative 77, positive 78 and folded 89→77 / 90→78 are tested. No13 unfolded 26/43 lose the line; 44 remains without it. Core/lower rows and fold boundaries are unchanged.

## Measured current repertoire

Real layouts and final physical-ink checks, not screenshots:

| Score | Pages | Systems | Main heads | Compatible merges | Violations / warnings |
|---|---:|---:|---:|---:|---:|
| No13 | 5 | 19 | 790 | 12 | 0 / 0 |
| No14 lower reading | 6 | 24 | 574 | 0 | 0 / 0 |
| No14 principal alternative | 6 | 24 | — | — | 0 / 0 |
| No30 | 5 | 17 | 744 | 1 | 0 / 0 |
| Bach | 2 | 8 | 550 | 1 | 0 / 0 |
| Brahms | 6 | 18 | 990 | 3 | 0 / 0 |

No13 retains 784 encoded attacks, all 16 pitched grace occurrences / 26 grace heads, source hosts, rational clocks and 56 unfolded occurrences. All cited windows have zero final stem/foreign-mask entries, no foreign-mask rail entries, no crossed/fused independent rails and no false independent stem/foreign-rail junctions. Tests deliberately restore a false junction to prove it is diagnosed.

Brahms retains all 964 source events and 29 written continuation heads. Four previously merged unequal-value statements now remain visible: 964 − 3 compatible merges + 29 continuations = 990 heads. Voice/hand-aware grouping changes 72 clasps / 33 bridges to 52 / 50; all current ownership, painted coverage, source fields and zero-error assertions remain active. Former cross-voice shared duration targets (e.g. 117/118) are refused rather than silently retargeted. Source voices still produce 83 independent flags; the standalone stem inventory is 283. Contemporary six-page hashes in `test/support/brahms-current.ts` are backed by these source/geometry checks.

Bach's source/hand identities remain unchanged, but shared RH-component geometry and the upper-row earning rule change real page/PDF ink. It remains two pages, eight systems, zero hard errors/warnings. No new score freeze was introduced.

No43 remains an honest draft with **5** findings: two `dot-collision` and three `tie-endpoint-clearance`. It has no expression failures; these residual classes were not repaired with score/measure offsets or hidden.

## Presentation and limitations

Existing real-engine registry only:
http://100.102.70.49:5175/janko.html#candidates

Two No13 cards share the exact same literal windows: unfolded 2–3, 6–10, 27, 30–33, 37–39, 43, plus full pages. The pre-pass card reproduces previous engraving rules on the current derived source; it explicitly shares the new contextual hand evidence and is **not** a byte-exact reconstruction of PR134's provisional hand labels. Captions retain uncertainty about “3 to33” / “144”.

Reference consequences:
http://100.102.70.49:5175/janko.html#reference

Representative cues after activation: Bach mm.5/12/13 and upper extension near m.29; Brahms m.1 (no cross-hand owner fusion), m.9 (retired cross-voice shared duration target), m.60/66 (unequal statements / continuation admission); No14 whole spread with locally associated contours. The operator must judge aesthetics in the live studio after the architect activates this revision. No alternate viewer, screenshots, browser storage changes or default/deploy checkout edits were used.

## Verification

Final engineering gates completed:

- `npm test`: **passed**, 1104.58s, **1271/1271 tests** (all ordinary files and all four exclusive batches).
- `npm run lint:engraving -- --strict`: **passed**, 2.50s, 39 registered checks. Source-rest provenance diagnostics remain informational, not suppressed.
- `npm run build`: **passed**, 15.11s. Existing Vite native-config/module-externalization/chunk-size notices remain; no unconfigured compiler/linter flags were used.
- `npm run pdf`: **passed**, 0.84s, refreshed `public/goldberg-variation-1.pdf`, two pages. The full suite's PDF test checks semantic vector/text/font/page freshness, not random document IDs. After the final export, `node --import tsx --test test/janko-pdf.test.ts` also passed (1/1, 1.21s).
- Focused current source/geometry/contour checks: **19/19 passed**, 23.01s (`janko-clarity*.test.ts`, `janko-source-expression.test.ts`). Source/No13 coverage and gates also ran in the full suite.
- Focused source-owner/stale-state regression: semantic-hand **8/8 passed**, 322.59s; prepared HMR **7/7 passed**, 17.90s. Both are also covered by the passing full run.

Earlier full runs failed on superseded geometry/ownership pins. Archived decision-round mechanism assertions now use explicit pre-clarity fixture configurations, not current-default freezes; independent historical hashes remain unchanged. Current source/geometry/ownership assertions were updated only with observed changes and additional invariants. No assertions were deleted to excuse a defect, and no suite-speedup/caching framework was introduced.

Raw command receipts are in `/tmp/no13-full-passing.log`, `/tmp/no13-strict-final.log`, `/tmp/no13-build-final.log`, `/tmp/no13-pdf-final.log`, and `/tmp/no13-final-focused3.log` on this worker.

## Files / safety

Production changes: `src/render/janko/{engine,types,grace,ties,beam-scene,solo-scene,ink-scene,linter,candidates}.ts`, `src/render/janko/elements/{rhythm,staff,expressions}.ts`, `src/scores/{schumann-no43.ts,schumann-no13-derived.json}`; refreshed `public/goldberg-variation-1.pdf`.

Tests: new current clarity/geometry fixtures, related current source/ownership/scene/row/PDF receipts, explicit pre-clarity compatibility helpers and archived-round import updates. The pre-existing `.architect/ticket.md` modification was preserved. Everything is left uncommitted. No deploy/candidate-local/cache/auth/provider configuration, operator browser storage or dirty default checkout was changed; no temporary preview server was started.
