# Spec Delta

## Purpose

Provide useful, explainable validation feedback at the scope of changed behavior, while retaining deliberate exhaustive regression coverage and visible progress.

## ADDED Requirements

### Requirement: Explicit validation scope
Normal development and deployment SHALL identify the selected checks and their coverage scope. Exhaustive execution SHALL require an explicit full request. A focused pass SHALL NOT be reported as a complete suite pass.

#### Scenario: Small homepage correction
- **WHEN** a change affects only homepage presentation or score selection
- **THEN** normal deployment checks cover the affected interaction and configured build without executing the complete historical rendering and saved-state suite

#### Scenario: Deliberate broad verification
- **WHEN** a full run is explicitly requested for broad model/layout/import risk or an integration checkpoint
- **THEN** every discovered test file is accounted for once, with required isolation retained

### Requirement: Explainable release coverage
Release selection SHALL account for the actual changed paths and related behavior, including both sides of renames. Unmapped or invalid changes SHALL produce an actionable failure instead of silently passing an unrelated selection or automatically launching the complete suite.

#### Scenario: Change crosses areas
- **WHEN** a change affects both reader state and score-source data
- **THEN** its reported plan includes the applicable checks for both areas

#### Scenario: Unaccounted change
- **WHEN** a changed implementation path has no declared release coverage
- **THEN** selection fails with the uncovered path and the available explicit validation choices

### Requirement: Visible progress and failure
Running checks SHALL stream results and display elapsed progress during long phases. Any selected child failure or interruption SHALL fail the command and identify the affected phase; progress SHALL NOT be a success receipt.

#### Scenario: Slow selected check
- **WHEN** a selected phase continues without test output
- **THEN** elapsed phase progress remains visible while the command stays pending

#### Scenario: Failing child
- **WHEN** a child exits unsuccessfully or is terminated
- **THEN** the command reports the failure and does not run later dependent phases

### Requirement: Preserved independent evidence
Removing duplicated registration or repeated same-owner calculation SHALL preserve original musical/geometry/history cases, source assertions, established output witnesses and independent changed-state or cold comparisons. Tests of the previous mandatory-full policy SHALL be revised to the new explicit policy. Complete coverage SHALL remain available through the full command.

#### Scenario: Shared fixture
- **WHEN** multiple test modules consume the same historical candidate fixtures
- **THEN** loading the shared data does not register another module's tests

#### Scenario: Complete page comparison
- **WHEN** unchanged pages share one resolved source/options/tokens owner
- **THEN** all page comparisons remain, while independent source states and cold-versus-precomputed proofs remain distinct
