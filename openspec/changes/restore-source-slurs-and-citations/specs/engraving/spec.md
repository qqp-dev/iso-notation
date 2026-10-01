# Spec Delta

## ADDED Requirements

### Requirement: Source-directed slur ink

Default and candidate engraving SHALL honor a projected slur's explicit source side, preserving its own logical-voice endpoints. Collision avoidance SHALL adjust legal placement on that side rather than silently reverse the source direction. Slurs without explicit source direction SHALL retain the existing placement policy. Performing-hand authority and RH-up/LH-down SHALL remain unchanged.

#### Scenario: Explicit side overrides hand preference

- **WHEN** an LH slur explicitly specifies above while the hand-based layout preference would choose below
- **THEN** its visible curve is placed above its associated source endpoint envelopes
- **AND** placement diagnostics disclose an unresolved collision if legal placement cannot clear the ink without changing the source side

#### Scenario: Both existing rendering modes preserve source direction

- **WHEN** the same directed source slur is rendered through current default or comparison presentation options
- **THEN** its explicit side is honored in each presentation rather than depending on whether the clarity pass is enabled

### Requirement: Independent slur paths at a shared head

Each independently owned projected slur SHALL retain a distinct visible path when its endpoint resolves to a compatible shared head or written continuation. Painted contours, source endpoint queries, physical diagnostics and full page/crop bounds SHALL agree. Sharing SHALL NOT add a sound, collapse a rhythmic obligation or substitute one generic curve for multiple source paths.

#### Scenario: Two approaches to No13 E4

- **WHEN** the confirmed lower.0 and lower.1 slurs end on the shared E4 at tick3432
- **THEN** two distinct curves remain visible: the lower.0 B3–F-sharp4–E4 gesture above and lower.1 B3–E4 gesture below
- **AND** both resolve to the shared E head while retaining their independent source endpoint associations
- **AND** the quarter B gains no fabricated beam and the eighth route retains its existing rhythmic obligations

#### Scenario: Slur crosses a system or crop boundary

- **WHEN** a source slur is fragmented for system, page or crop presentation
- **THEN** each continuation fragment retains the original expression identity, endpoint ownership and explicit side
- **AND** complete physical bounds include the visible curve instead of clipping it or assigning its endpoint to an unrelated voice
