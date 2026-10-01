# Spec Delta

## ADDED Requirements

### Requirement: Ordinary musical slur projection

The shared Schumann source import SHALL project supported paired, note-attached ordinary slurs into default scores, retaining independent logical voices, endpoint identities, source locations and repeat occurrences. Ordinary slurs SHALL remain distinct from pitch ties and escaped phrasing slurs. Projection SHALL preserve pitches, rational clocks, written values, continuations and performing hands.

#### Scenario: Confirmed No13 concurrent slurs

- **WHEN** the approved No13 source passage at line241 is imported and projected into its first occurrence
- **THEN** lower.0 has a separate ordinary slur from B3 at tick3384 through F-sharp4 at tick3408 to E4 at tick3432
- **AND** lower.1 has a separate ordinary slur from its B3 quarter at tick3384 to its E4 eighth at tick3432
- **AND** both retain their own endpoint identities and provenance, while source pitches, note values, clocks and hands remain unchanged

#### Scenario: Repeated and simultaneous source contexts

- **WHEN** supported slurs appear in independent simultaneous voices or repeated source passages
- **THEN** pairing stays within the owning logical voice and each projected occurrence retains the appropriate source endpoints and occurrence provenance
- **AND** neither simultaneous voices nor repeat occurrences are collapsed into one expression

#### Scenario: Unsupported or nonmusical curve construct

- **WHEN** a source construct represents a hidden synchronization curve, unsupported grace attachment, or unsupported slur layout semantics
- **THEN** its source evidence and any remaining omission stay explicitly classified
- **AND** no visible musical slur is invented from that construct

#### Scenario: Malformed supported slur pair

- **WHEN** a supported ordinary-slur form has no valid note host or is unmatched within its source context
- **THEN** import reports a source-positioned error instead of silently dropping it or joining unrelated voices

### Requirement: Explicit slur side provenance

Imported ordinary slurs SHALL retain explicit source above/below direction and its source location separately from printed staff, performing hand and stem direction. A slur without explicit source direction SHALL remain unspecified rather than acquiring a fabricated source-side claim.

#### Scenario: Opposed source slurs in one performing hand

- **WHEN** the confirmed No13 lower.0 slur is directed above and the lower.1 slur below
- **THEN** both directions survive written and repeat-projected expression records despite both voices belonging to the existing LH authority
- **AND** no hand reassignment or stem-direction change follows from those source directions

#### Scenario: Undirected ordinary slur

- **WHEN** a supported ordinary slur has no explicit source side
- **THEN** its source-side value remains unspecified and layout preference remains a presentation decision
