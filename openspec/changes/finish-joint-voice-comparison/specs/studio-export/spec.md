## ADDED Requirements

### Requirement: Published source comparison
The published Source tab SHALL open a source-versus-ISO comparison for the active Schumann No. 13 passage. The source SHALL be the publicly hosted Henle preview with edition, printed-page and measure cues; the ISO pane SHALL use the current prepared real-engine SVG. Private cached PDFs and saved development choices SHALL remain private and intact.

#### Scenario: Open Source on the published candidates page
- **WHEN** the operator clicks Source on the published candidates page
- **THEN** Henle folio 15 and the current ISO passage are available, with printed 35–36 mapped to internal 38–40 and independent zoom/fit controls

#### Scenario: Compare readings on a narrow screen
- **WHEN** the operator selects the control or joint reading and switches Original / ISO panes
- **THEN** the selected reading is shown with its identity and the same source passage

#### Scenario: Prepared ink unavailable
- **WHEN** the current prepared passage has not loaded or is refused
- **THEN** the comparison reports unavailability without substituting another score or stale ink
