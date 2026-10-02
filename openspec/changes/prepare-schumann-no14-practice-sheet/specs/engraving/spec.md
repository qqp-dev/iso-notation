# Spec Delta

## ADDED Requirements

### Requirement: Equivalent geometry computation
The rendering performance pass SHALL preserve curve candidate family, count, order, costs and selection; sampling resolution, arithmetic precision, source ownership, physical clearance and painted SVG SHALL remain unchanged. Prepared numeric values, contour polygons and scratch storage SHALL be reused only within their valid dependencies. Geometry queries SHALL retain their truth after relevant scalar mutation and across independent contours.

#### Scenario: Repeated obstacle queries for a contour
- **WHEN** the same exact contour is queried against multiple obstacle rectangles
- **THEN** prepared geometry avoids repeated invariant work while yielding the same intersection and slice results as the preserved reference calculation, including boundary contacts

#### Scenario: Contour changes after a prepared query
- **WHEN** a relevant contour scalar changes or another contour is queried
- **THEN** no prior prepared value yields a stale result, and query truth matches an independent reference

#### Scenario: Optical candidate preparation
- **WHEN** optical candidates share valid x geometry or a candidate is rejected before final painting
- **THEN** invariant inversion or delayed path construction reduces work without pruning candidates, changing ranking or altering surviving SVG

### Requirement: Complete dotted-duration statements
The chosen No14 practice profile SHALL retain every written augmentation dot using the head-adjacent convention: four in the64-bar written view and eight in the96-occurrence performed view. Each shared attack SHALL retain independent written values, a longer left duration branch and one dot for its dotted-quarter owner. Physical inventories SHALL preserve actual dot coordinates and source ownership. Shared-head visual ambiguity SHALL be disclosed as the operator's accepted convention.

#### Scenario: Shared G and A in No14 bar48
- **WHEN** a dotted-quarter and an eighth voice attack the same RH G or A
- **THEN** one compatible visible attack retains two duration branches, a longer left branch and exactly one dot belonging to its dotted-quarter value

#### Scenario: Repeated bar48 and independent bass values
- **WHEN** the passage returns in unfolded occurrence80
- **THEN** the same duration reading survives, and both LH dotted quarters retain their own dots as well

#### Scenario: Head-adjacent dot with a longer branch
- **WHEN** the selected shared G/A attack uses the head-adjacent augmentation convention
- **THEN** its longer left branch remains extended, its dot follows the existing head convention and all source values/owners survive; the rejected exposed-stem option is retained only as a labeled control

### Requirement: Coherent ordinary-slur presentation
Ordinary phrasing SHALL prefer flowing, balanced curves with deliberate body/taper and clear reference to the source passage. Optical ends SHALL be allowed to stop short or float to preserve a pleasing bow. Both sides SHALL be considered unless an explicit source-side directive applies. Exact source identities/clocks SHALL survive independently of optical tip positions. Pitch ties SHALL retain their separate precise-note attachment rules.

#### Scenario: Side without a source directive
- **WHEN** the connected No14 gesture has no explicit source-side directive
- **THEN** side selection considers the complete gesture on both sides without a categorical hand or upper/lower preference; a collision-free but squashed or detached route is not established as the preferred result by lint alone

#### Scenario: Steep or unequal-height endpoints
- **WHEN** the source connects notes at different heights
- **THEN** a pleasing curve with clearly referenced beginning/end takes priority over reaching a specific head/stem extremity; optical shortening, lift and restrained asymmetry are judged together without unintended waviness or hooks

#### Scenario: Independent phrases in No14 bar48
- **WHEN** the source contains two independent short slurs in written48 and repeated occurrence80
- **THEN** both source ranges remain legible and distinct rather than being replaced by a generic whole-measure bow

#### Scenario: Musical source discrepancy
- **WHEN** a curve inventory differs between the selected reference and the starter encoding
- **THEN** the difference is disclosed for source resolution rather than silently deleting or adding a curve to simplify routing

#### Scenario: Initial fitting estimate leaves a small collision
- **WHEN** a healthy above or below bow fails the exact obstacle query after its initial sampled clearance estimate
- **THEN** bounded complete-curve fitting considers remaining admissible outward room before rejecting that side, without fixed passage nudges, weakened clearance or altered source domains

#### Scenario: Both sides are viable
- **WHEN** multiple clear, source-referenced bows exist above and below a gesture
- **THEN** representatives from both sides survive early shortlisting within a bounded search, and ranking considers moderate fullness, breathing room and weak local musical-ink balance rather than allowing endpoint proximity alone to eliminate one side

#### Scenario: Local weight and long gestures
- **WHEN** a slur changes the visual weight within a measure or across its source phrase span
- **THEN** the local comparison remains flexible, distinguishes faint guides from musical ink, permits proportionally calmer long bows and preserves one coherent sweep rather than forcing equal upper/lower weight or changing side at each barline

### Requirement: Deferred hairpin and vertical-spacing changes
The current 0.65 pt hairpins, their aperture and vertical expression placement SHALL remain unchanged in the pedal-start comparison. The earlier 1.0 pt stroke trial SHALL remain labeled historical and unselected. Increasing hairpin opening or redesigning vertical stacking SHALL remain deferred.

#### Scenario: Pedal-start comparison baseline
- **WHEN** the operator compares the new pedal starts
- **THEN** the same current hairpin stroke, aperture, source spans and page/system spacing remain visible in every treatment

### Requirement: Explicit and quiet pedal-start candidates
The integrated review SHALL compare modest ordinary-language “Ped.” and a downward-slanted entry followed by the same hold line and upright release. Each SHALL remain opt-in, use light supporting ink and preserve source-timed sustain semantics. Painted starts and actual physical query bounds SHALL agree. The rejected ornate P and pictogram SHALL remain identified as history. No treatment SHALL be presented as a selected default or invent partial-pedal source events.

#### Scenario: Actual press beside a piano dynamic
- **WHEN** an actual source press is rendered in the opening context
- **THEN** its selected start is visible and distinguishable from the piano dynamic, with the underlying notes, clocks and hairpins unchanged

#### Scenario: Continued pedal into bar21
- **WHEN** the pedal carries from20 into21 or crosses a system/page boundary
- **THEN** no new start is manufactured, and the actual release, hold continuation, true gaps and pedal-change notches retain their source meaning

#### Scenario: New pedal-start comparison
- **WHEN** plain Ped. and a downward entry are shown in the same passage
- **THEN** both reference the same actual source press, retain identical hold/release/retake semantics and current supporting stroke, and their actual ink participates in geometry queries

#### Scenario: Slur correction is required for this round
- **WHEN** the pedal-start comparison is delivered
- **THEN** it includes the corrected optical-gesture slur policy, a new-route hooked control and old rejected-route control on complete pages; unchanged rejected routing with new pedal symbols alone does not satisfy the round

### Requirement: Source-derived written repeat signs
The No14 written presentation SHALL paint repeat start before33 and repeat end after64 from preserved source repeat facts. The operator-accepted practice repeat SHALL use one full-height stroke at the current0.90pt final-bar weight with two inward-facing dots, preserving the rejected double-rule treatment as history. Actual repeat ink SHALL participate in horizontal admission, physical inventories and collision queries, including system/page boundaries. Existing unfolded and canonical presentations SHALL remain intact; component acceptance SHALL NOT promote a global default.

#### Scenario: Start of the repeated section
- **WHEN** written33 begins internally or at a system/page edge
- **THEN** the repeat-start rule and its two inward-facing dots have deliberate leading space from the complete first-attack note/duration envelope, preserving source timing and onset identities without a passage-specific offset or a page-density change

#### Scenario: Closing repeat
- **WHEN** written64 ends
- **THEN** the repeat-end barline and its two inward-facing dots provide the repeat and closing boundary without duplicated conflicting final ink

#### Scenario: Repeat at a system start
- **WHEN** the selected full-height repeat trial begins a repeated section at a system edge
- **THEN** its rule replaces the system bracket, the measure numeral remains, and painter, margin admission and physical inventory describe only the actual repeat/furniture ink; ordinary systems retain their existing bracket treatment

### Requirement: Comfortable bounded slur alternatives
The successor policy SHALL consider bounded whole-bow outward breathing choices without conflating air with tilt or crown. Both viable sides SHALL compete within the existing24-candidate pool and20,000-visit ceiling. Weak local balance SHALL treat nearly tied estimates cautiously. A bounded cost MAY expose the actual present expression-floor consequence without altering expression spacing. Source domains, exact clearance, body/taper, successful steep gestures, independent phrases and pitch-tie semantics SHALL remain intact.

#### Scenario: Minimum-clearance upper bow
- **WHEN** a source-referenced healthy upper bow hugs duration ink despite available admitted outward room
- **THEN** comfortable whole-bow alternatives are considered before selecting the minimum-clearance route, without a measure exception, arbitrary tip-domain widening or forced side distribution

#### Scenario: Lower bow and present expressions
- **WHEN** a lower bow would increase the existing system expression/pedal floor
- **THEN** ranking may account for that actual space consequence using bounded inexpensive context data while retaining the current placement policy and both-side competition

### Requirement: Lighter coherent dynamic alternatives
The review SHALL offer primary-prefiltered distinct dynamic families with lighter, compatible letterforms at comparable reading size. Intact measured vector outlines and applicable provenance SHALL describe actual ink and queries. Source marks/clocks and hairpins SHALL remain unchanged. No family SHALL be silently selected as the final default.

#### Scenario: Heavy opening piano rejected
- **WHEN** alternative dynamic lettering is compared at the No14 opening
- **THEN** actual different letterforms are shown in full-score context rather than shrinking, fading or eroding the rejected p

#### Scenario: Family supports the dynamic alphabet
- **WHEN** a family is offered as a score treatment
- **THEN** its supported single/combined dynamics remain coherent and measured, preserving their source identity and distinguishing plain Ped. from piano

### Requirement: Discriminating ordinary-slur silhouette
The narrowed review SHALL distinguish an unnecessarily weak-shouldered swoosh from an already admitted fuller bow through an explicit opt-in shape cost. Source-contour steepness SHALL provide a bounded allowance for legitimate diagonal gestures. Both sides SHALL use the same rule; source ownership/admission, exact clearance, accepted body/taper, breathing policy and bounded search SHALL remain intact. Numerical ranking SHALL NOT be presented as visual acceptance.

#### Scenario: Currently tied opening shapes
- **WHEN** moderate-contour bars1–3 admit a fuller approach and a weak approach with equal prior shape/crown costs
- **THEN** shape evaluation distinguishes their silhouettes rather than selecting the weak bow through candidate order or a tiny proximity advantage

#### Scenario: Liked steep gesture and contextual flow
- **WHEN** source geometry requires a steep diagonal as in16 or neighboring15–16/58–59/62–63 curves are reviewed
- **THEN** the rule permits the steep gesture and exposes contextual consequences without a central-apex mandate, per-bar freeze or required slur interconnection

### Requirement: Coherent free typography packages
The review SHALL offer a small prefiltered set pairing dynamic letterforms with compatible distinguishable ordinary-language Ped. lettering. Suitable variants of one family or a deliberately composed music/text pairing MAY be used. Every offered package SHALL have freely usable provenance, intact measured vector glyphs, a coherent correctly identified dynamic alphabet and unchanged source expression/pedal events. A tentative weight preference SHALL NOT silently select a font.

#### Scenario: Dynamics beside an actual press
- **WHEN** opening1 is compared under a package
- **THEN** both dynamic p and the complete Ped. word with its hold line use the package's intended distinct roles at legible comparable scale, while true press/release/retake/continuation clocks and quiet supporting ink survive

#### Scenario: Combined dynamic glyph identity
- **WHEN** a precomposed music-font pp/ppp/mp/mf/ff/fff/fp/sf/sfz is included in the supported alphabet
- **THEN** it represents the actual requested mark according to the font's authoritative glyph mapping rather than an adjacent codepoint; literal No14 p output remains source-faithful
