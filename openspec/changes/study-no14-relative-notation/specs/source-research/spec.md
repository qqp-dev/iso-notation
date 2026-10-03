## ADDED Requirements

### Requirement: Explicit IMSLP edition inventory and resilient access
For a classical score with an IMSLP work entry, the first research wave SHALL inspect its relevant original, critical and practical edition entries, including publisher, editor and year. A failed text-fetch route SHALL NOT establish that the edition or requested-piece coverage is unavailable. Research SHALL try the ordinary browser route and normal public download flow before declaring an access gap, while retaining existing no-bypass, no-purchase and provenance boundaries. It SHALL distinguish catalogue metadata, retrieved bytes and actually inspected score pages. Routine agent-tool access failures SHALL NOT automatically become an operator download chore.

#### Scenario: Text tool receives a bot check
- **WHEN** the text-fetch tool cannot follow IMSLP's normal download entry
- **THEN** the agent tests ordinary browser navigation without challenge evasion and records the actual outcome rather than declaring the edition unavailable

### Requirement: Operator-facing source-selection comparison
The source-selection handoff SHALL present the actual reference edition beside a candidate transcription in the existing studio when accessible and within the authorized provisioning scope. It SHALL identify each edition accurately and preserve candidate/reference/encoding distinctions. Presenting those pages for operator judgment SHALL NOT automatically initiate a full comparative musical-text certification task. Later separately scoped source-fidelity work and implementation quality duties remain applicable.

#### Scenario: Operator asks how research should be presented
- **WHEN** the operator states that they should judge similarity and difference from reference and candidate pages
- **THEN** the handoff follows that presentation requirement without expanding the discussion into an unrequested full-score audit or silently adopting another edition
