# Design

## Context

See `proposal.md` for motivation and authorized scope. This is a cross-module source-expression change, so a design is required.

Observed in the authorized root:

- `src/scores/schumann-no43.ts` is the shared No13/14/30/43 importer. It already pairs escaped phrasing marks by logical voice and projects them through source occurrences. Ordinary parentheses, including directed attachments, are deferred.
- `WrittenPhrase` and `PhraseOverlay` preserve source endpoints but have no explicit source-side field. `src/render/janko/elements/expressions.ts` searches both sides using a hand-based preference; its older comparison presentation places curves above system ink.
- `engine.ts` already resolves merged endpoint owners to a surviving head and written continuations through the tie display plan. Reuse that ownership path.
- The derived ledgers contain 220 ordinary-parenthesis entries for No13, 4 for No14, 226 for No30 and 54 for No43. These are token counts, not certified musical-slur counts. No13 includes hidden synchronization and grace-related constructs; No14 also defers phrasing-layout directives.
- The existing canonical PDF exporter targets Bach Goldberg Variation 1. Improving the No13 default source does not itself mean that Bach's download changes.

The handoff distinguishes the dirty, older root, accepted history, live Round58 and cancelled unlanded Round59 work. Do not synchronize those states or transplant the saved planner as part of this correction.

## Goals / Non-Goals

**Goals:** Extend the existing import–projection–expression pipeline; make supported source slurs available to default rendering; preserve explicit side evidence; verify the literal two-voice passage and actual coupled consequences.

**Non-Goals:** Reconstruct arbitrary LilyPond control points or Scheme; certify every source omission; reproduce printed stem policy; introduce extra E-head rhythm attachments; resume joint beam planning; change canonical engraving options or live deployment.

## Decisions

### 1. Project supported syntax through the shared importer

Pair ordinary note-attached `(` / `)` and their directed attachments in voice-local expression state, distinct from escaped phrasing marks. Support normal note/chord hosts and existing repeat/alternative projection. Preserve source host IDs, onset-based endpoints, occurrence provenance and independent voice ownership.

Classify the existing hidden synchronization, grace and layout constructs before promoting ordinary markers. The support boundary is syntax and source semantics, not a measure whitelist. Intentionally hidden synchronization marks do not become visible musical slurs. Unsupported compound constructs retain located evidence and a precise omission; malformed syntax inside the supported boundary reports a located error. A slur whose pairing crosses an unsupported construct must be retained as an identified deferred span rather than paired with an unrelated later delimiter.

Regenerate affected derived records only from already approved, hash-guarded inert source bytes using the existing TypeScript import scripts. The mandatory No13 input is `/tmp/13-Mai-cher-Mai.ly` with the existing approved hash. Never execute LilyPond or Scheme. If another approved input is unavailable, report that specific regeneration limit instead of acquiring a replacement or manually guessing facts.

Alternative considered: inject the two curves only into candidates. Rejected because the operator explicitly selected shared/default improvement. Also reject enabling every parenthesis without classifying the existing nonmusical and unsupported forms.

### 2. Carry optional source side with provenance

Add an optional above/below source-side value to written and projected phrase records, accompanied by the location of the directional attachment. No explicit direction means an absent value, preserving compatibility with existing expression records. Do not derive source direction from staff, performing hand, opposed printed stems or source geometry coordinates.

Initially support explicit directed note attachments needed by the confirmed witness. Existing unsupported direction/layout commands remain disclosed until their semantics are deliberately supported; ordinary-slur support does not claim those commands were restored too.

Alternative considered: infer side in the painter from the LH label. Rejected because both confirmed curves belong to LH and have opposite source directions.

### 3. Constrain placement to explicit source direction

For a directed slur, search legal endpoint clearance, lift and contour depth only on its explicit side. Apply that constraint in both existing presentation modes. Preserve the existing policy for undirected phrases. If a source-directed curve cannot obtain legal clearance, report the defect rather than reverse direction, delete the curve or conceal it.

Retain one expression/contour per source slur. Resolve each independently owned endpoint through the existing merged-head and written-continuation mapping. The lower.0 and lower.1 curves may share the final visible E while remaining distinct above/below paths; this requires no additional sound, beam or head.

Ensure expression paint, contour queries, ownership diagnostics and complete page/crop admission include the settled curves. Extend mathematical checks for source-side mismatch and loss of an independently required path, with new defect-class coverage in `test/janko-linter.test.ts`. Do not add coordinate offsets keyed to this passage.

Alternative considered: treat source side as a weak cost preference and allow automatic reversal. Rejected because the confirmed opposed source paths would again become uncertain presentation inference.

### 4. Add truthful passage citations without reindexing playback

Use the confirmed edition/occurrence relationship in existing studio captions or source metadata. Keep internal indices available for navigation and tests; label them as internal segments, not conventional printed measures. Avoid claiming that the approved encoding's parent is Henle merely because Henle is the comparison edition.

| Internal segment | Encoding occurrence | Tick interval | Henle HN45 folio15 |
| --- | --- | --- | --- |
| 38 | sourceBar26, second section/pass1 | 3288–3384 | printed35 |
| 39 | sourceBar27/pass1 | 3384–3456 | first three eighths of printed36 |
| 40 | sourceBar11/pass2 | 3456–3480 | final eighth of printed36, returning fp pickup |

Identify the work as Robert Schumann, Album für die Jugend Op. 68 No. 13, “Mai, lieber Mai, bald bist du wieder da!”; do not label the passage Brahms or printed39. Explain 28 written / 56 expanded as source segments. Do not extrapolate a whole-score printed-measure map from this verified passage.

### 5. Preserve historical controls while improving current defaults

The correction changes source-expression ink for every presentation using the corrected score, including comparison controls. Original Round58 COMPACT B and its historical pins remain historical evidence under their original source/options/engine; current corrected-source output must not be called byte-identical to that archive. Future geometry comparisons must use the same corrected source expressions on both sides.

Use the existing source/engine identity guards. A changed expression or source-side value must affect relevant prepared/saved identity; stale saves remain preserved and activation is refused. Do not migrate saves, edit browser storage, reset checkout state or activate the cancelled candidate cards.

Alternative considered: keep the control caption or pins unchanged after changing its source-expression ink. Rejected because that would make the comparison and historical identity claim false.

## Risks / Trade-offs

- Broad shared-import consequences → Inventory projected changes by construct/voice/occurrence; retain omissions for unsupported forms; verify No13/14/30/43 without claiming whole-score edition certification.
- Directed curves may require more page space or reveal collisions → Use the mathematical linter before placement diagnosis, include actual expression contours in page/crop bounds, and inspect complete gestures and neighboring onsets in the existing inline SVG studio.
- Source-side fields can affect identity and cached layouts → Extend source/prepared identity coverage and preserve refusal of stale saved candidates.
- Historical and currently served outputs differ → Give explicit source/version/presentation status in the handoff; do not equate an unlanded root build with live5175.
- Expensive unrelated regression reruns → Choose focused behavior and coupling coverage, then strict engraving/build checks; run broader tests only for a concrete unresolved need and record elapsed times. Do not schedule a blanket 33-minute suite based on filenames alone.

## Migration Plan

Implement only after a subsequent apply request, in the authorized checkout with unrelated edits and the cancelled worktree preserved. Add optional side fields without changing legacy undirected records; regenerate only audited supported source-expression facts; update truthful captions and current identity evidence. Inspect the No13 passage and affected repertoire in the existing real-engine studio when that checkout is legitimately available there, without restarting or switching live5175 under this change.

Keep Bach at zero mathematical violations. Compare Bach and Brahms default ink for actual shared-renderer consequences. If golden ink changes, run `npm run pdf`, verify the existing semantic PDF contract and include the updated download; otherwise retain the canonical PDF and record the evidence for leaving it unchanged. The Bach download must not be represented as a Schumann export.

No Git delivery, landing or deployment is part of these planning artifacts. Any later release follows existing reviewed delivery authority. If an implementation needs revision, revise only its scoped edits; preserve unrelated work, all saved candidates and historical evidence.
