# Spec Delta

## ADDED Requirements

### Requirement: Text-only source performing instruction
The model SHALL preserve a source performing instruction that has no numeric tempo without inventing a BPM. The No14 practice output SHALL include the selected reference's opening instruction with edition evidence and retain its source-linked encoding wording separately where they differ.

#### Scenario: No14 opening instruction
- **WHEN** the selected reference states “Leise und sehr egal zu spielen” without a metronome number
- **THEN** the instruction is present in the practice engraving and no fabricated numeric tempo is added to the musical model

### Requirement: Written view with preserved performed mapping
No14 SHALL expose a64-bar written presentation with33–64 repeated twice, retaining the original96-occurrence performed model and exact written/performed source mapping. Projection SHALL preserve pitch, register, voice, rational rhythm, selected alternatives, expression, pedals and source-owned phrases. The approved source hash and source facts SHALL remain unchanged. Collapsing repeat copies SHALL require equivalence of the affected written statements and source events, not simple array truncation.

#### Scenario: Repeat reconstruction
- **WHEN** the64-bar written view is expanded through its repeat graph
- **THEN** it reproduces the original96-occurrence selected notes, rhythms, voices, source relationships and expression/pedal events, including the repeat return

#### Scenario: Written ending versus return event
- **WHEN** the written view closes at9216ticks
- **THEN** it preserves the actual written release at9072 and phrase63–64 at8928–9072, and does not fabricate a final-bar press from the second-pass return event

#### Scenario: Written and performed dotted values
- **WHEN** the same source is viewed in written or performed form
- **THEN** the written view contains four source dotted-quarter statements at48, while the preserved performed view contains eight at48/80, with every independent owner intact
