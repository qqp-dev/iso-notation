# Proposal

## Why

Schumann Op. 68 No. 13 loses two independently voiced ordinary source slurs before rendering, leaving the approaches to its shared E head unclear. The operator has authorized a shared source-fidelity correction that improves default output, alongside truthful edition and printed-measure citations.

## What Changes

- Preserve supported ordinary musical slurs in the shared Schumann importer and default derived scores, including voice, source endpoints, repeat occurrence, provenance and explicit source side. Retain honest omissions for unsupported constructs.
- Render each slur independently through existing endpoint ownership and shared-head resolution. Honor explicit source sides without changing RH-up/LH-down or performing-hand authority.
- Require the confirmed No13 passage: lower.0 B3 eighth–F-sharp4 eighth–E4 eighth above, and lower.1 B3 quarter–E4 eighth below.
- Identify the passage as Robert Schumann, Album für die Jugend Op. 68 No. 13, Henle HN 45 folio 15, printed35–36 / internal38–40, with the split ending and return pickup explained.
- Audit shared-import consequences and default ink; preserve original Round58 history and distinguish corrected-source output from historical controls.

This change does not adopt or resume the cancelled joint-geometry planner, change source pitches/rhythms/hands or canonical options, acquire another source, alter saved state, switch live5175, or perform Git delivery.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `musical-model`: Require supported ordinary-slur projection with independent source associations and explicit side provenance.
- `engraving`: Require source-directed slur placement and separately visible paths through shared endpoints in default rendering.

Existing `source-research` requirements already govern the citation correction; existing `studio-export` requirements govern retained history, saved-state identity and conditional golden PDF refresh. They need no duplicate delta requirements.

## Impact

The shared importer `src/scores/schumann-no43.ts`, affected Schumann derived records, `PhraseOverlay`, expression placement/endpoint resolution, physical linter coverage and studio passage captions are coupled. Default source-expression ink may change; other Schumann imports require a bounded audit rather than assumed unchanged output. Historical Round59 edits remain preserved in their old worktree. No new dependency or viewer is required. Regenerate the canonical PDF only if golden ink actually changes.
