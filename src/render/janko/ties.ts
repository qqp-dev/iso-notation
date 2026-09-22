/**
 * Round 46 — **written tie chains**: display plan, arc geometry, paint.
 * ====================================================================
 *
 * A sounding event whose source writes it as tied components (a `~` tie, a
 * `tieWaitForNote` carry) is one note in the score — one pitch, one onset, one
 * total duration — but more than one *statement* on the page. Round 46 renders
 * those statements:
 *
 * 1. **the attack head states its first component** — the head's own duration
 *    ink reads the first written component, never the composite total;
 * 2. **each further component gets a conventional tie arc** from the previous
 *    component's head to its own, anchored on the written onsets;
 * 3. **a continuation that coincides with an existing same-pitch head reuses
 *    that head** (the six hidden `tieWaitForNote` carries of mm. 39/40/65/66);
 *    a continuation no head states becomes an explicit continuation head whose
 *    own ink states its component value — never an unvalued tie-only head;
 * 4. **a coincident same-hand attack/carry group merges to one visible attack
 *    head** — the chain owns it, a shorter simultaneous voice stays a mixed
 *    duration voice (its own stem/flag), and a voice whose written value equals
 *    the chain's first component is absorbed whole (one visible attack head per
 *    source-proven group, nine-two-five at m. 66).
 *
 * The scope is bounded and derived from the provenance alone:
 *
 * - **non-grammar composites** — a sounding total with no exact plain/dotted/
 *   double-dotted reading (the six RH 120-tick eighths, m39 D3, the m61 E2 504,
 *   the m65 A2/D3 pair, m66 F3) *always* render their chain;
 * - **hidden carries** — an other-wise expressible chain (`total` in grammar)
 *   renders when **every** continuation coincides with an existing same-pitch
 *   head, i.e. when the tie costs no new head at all (mm 39, 40, 65, 66). Every
 *   other in-grammar source tie stays **consolidated** into its single symbol —
 *   no all-source-ties rewrite.
 *
 * Nothing here changes sounding data: pitch, onset and total duration are read
 * from the note, never written. The only notes created are the continuation
 * heads (`<id>~c<k>`) whose component values no existing head states.
 */

import { Hand, QuantizedNote, QuantizedGridScore, WrittenTieChain } from '../../model/types';
import { ResolvedJankoTokens, JankoTokens, resolveJankoTokens } from './types';
import { f } from './elements/style';

/** Is one sounding total exactly readable as plain/dotted/double-dotted? */
export function tieValueInGrammar(durationTicks: number): boolean {
  const plain = [3, 6, 12, 24, 48, 96, 192, 384];
  for (const p of plain) {
    if (durationTicks === p || 2 * durationTicks === 3 * p || 4 * durationTicks === 7 * p) {
      return true;
    }
  }
  return false;
}

/** One written component of a rendered chain, resolved to its painted head. */
export interface JankoTieComponentPlan {
  /** Position in the chain (0 = the sounding attack). */
  index: number;
  /** Written onset tick of the component. */
  startTick: number;
  /** Written value of the component (ticks). */
  durationTicks: number;
  /** Id of the head that states this component. */
  headId: string;
  /** True when the head was added by this plan (no existing same-pitch head). */
  added: boolean;
  /** The outgoing tie declaration on this component stands under `tieWaitForNote`. */
  tieWait: boolean;
}

/** One rendered written tie chain. */
export interface JankoTieChainPlan {
  /** Sounding note the chain belongs to. */
  noteId: string;
  /** Source voice the chain was written in. */
  voice: string;
  /** Sounding total of the event (unchanged source data). */
  soundingTicks: number;
  /** Ordered components, each with its painted head. */
  components: JankoTieComponentPlan[];
  /** True for the out-of-grammar composites (60/600-tick style values). */
  nonGrammar: boolean;
}

/** The system-independent display plan of one score's written ties. */
export interface JankoTieDisplayPlan {
  /** Per chain-head id: the component duration the head's own ink states. */
  displayTicks: Map<string, number>;
  /** Rendered chains, in source order. */
  chains: JankoTieChainPlan[];
  /** Continuation heads to add to the layout, in source order. */
  heads: QuantizedNote[];
  /** Every rendered component head id (attack heads and continuations). */
  headIds: Set<string>;
}

/** Suffix of an added continuation head id (`<source id>~c<index>`). */
export const TIE_HEAD_SUFFIX = '~c';

/** True when a note id belongs to an added continuation head. */
export function isTieContinuationHead(id: string): boolean {
  return id.includes(TIE_HEAD_SUFFIX);
}

/**
 * Derive the written-tie display plan of one score (pure).
 *
 * `score.tieChains` is the committed provenance sidecar; a score without it
 * yields the empty plan, so every pre-Round-46 surface is untouched.
 *
 * Round 49 §1: every authenticated written chain is preserved — written
 * segmentation, continuation heads/arcs and component durations — even when
 * the sounding sum has one available duration symbol. Equal sounding duration
 * is NOT equivalent notation, so the former in-grammar/unanchored
 * consolidation filter is removed: an in-grammar chain whose continuations
 * coincide with no existing head gains explicit continuation heads (`<id>~c<k>`)
 * stating their own written values, exactly like a non-grammar chain. No
 * reattack is invented (added heads carry `tieStart`) and no sounding event
 * is altered; proven head reuse (anchored continuations) is unchanged.
 */
export function deriveTieDisplayPlan(score: QuantizedGridScore): JankoTieDisplayPlan {
  const empty: JankoTieDisplayPlan = {
    displayTicks: new Map(),
    chains: [],
    heads: [],
    headIds: new Set(),
  };
  const chains = score.tieChains;
  if (!chains || chains.length === 0) return empty;
  const byId = new Map(score.notes.map((n) => [n.id, n]));
  // Every sounding head, keyed by (onset, pitch) — the anchor set a
  // continuation reuses when it coincides with an existing head.
  const headAt = new Map<string, QuantizedNote[]>();
  const anchorKey = (tick: number, pitchClass: number, octave: number): string =>
    `${tick}|${pitchClass}|${octave}`;
  for (const n of score.notes) {
    const k = anchorKey(n.startTick, n.pitch.pitchClass, n.pitch.octave);
    const bucket = headAt.get(k);
    if (bucket) bucket.push(n);
    else headAt.set(k, [n]);
  }

  const displayTicks = new Map<string, number>();
  const rendered: JankoTieChainPlan[] = [];
  const heads: QuantizedNote[] = [];
  const headIds = new Set<string>();
  // The chain's source voice, for the provenance of added continuation heads
  // (see below): every component of one chain is written in one voice.
  const voiceByNoteId = new Map(chains.map((c) => [c.noteId, c.voice] as const));
  // Round 49 §1: no consolidation filter — every committed chain renders.
  // (The former `!nonGrammar && !anchored` skip conflated equal sounding
  // duration with equivalent notation.)
  for (const chain of [...chains].sort((a, b) => a.noteId.localeCompare(b.noteId))) {
    const note = byId.get(chain.noteId);
    if (!note) continue;
    const nonGrammar = !tieValueInGrammar(chain.soundingTicks);
    const continuations = chain.components.slice(1);
    const anchors = continuations.map(
      (c) => headAt.get(anchorKey(c.startTick, note.pitch.pitchClass, note.pitch.octave)) ?? []
    );

    const components: JankoTieComponentPlan[] = [];
    chain.components.forEach((component, index) => {
      if (index === 0) {
        components.push({
          index,
          startTick: component.startTick,
          durationTicks: component.durationTicks,
          headId: chain.noteId,
          added: false,
          tieWait: component.tieWait,
        });
        return;
      }
      const anchor = anchors[index - 1][0];
      if (anchor) {
        components.push({
          index,
          startTick: component.startTick,
          durationTicks: component.durationTicks,
          headId: anchor.id,
          added: false,
          tieWait: component.tieWait,
        });
        return;
      }
      const id = `${chain.noteId}${TIE_HEAD_SUFFIX}${index}`;
      // Round 49 §3: the added head is a written component of the chain's
      // own source voice, so voice-aware readers (the rest layer's
      // editorial-hand query) see it as the voice that wrote it — a
      // legitimate cross-hand continuation stays a valid tie anchor while
      // never masquerading as the displayed hand's own voice. The chain's
      // source hand is the voice's own part hand (see BRAHMS_VOICE_HAND),
      // read from the sounding note's committed provenance when present.
      const chainHands = (() => {
        const fromNote = note.sourceProvenance?.hands;
        if (fromNote !== undefined) return [...fromNote];
        return voiceByNoteId.get(chain.noteId) !== undefined &&
          /leftHand/.test(voiceByNoteId.get(chain.noteId) ?? '')
          ? (['LH'] as Hand[])
          : (['RH'] as Hand[]);
      })();
      const head: QuantizedNote = {
        id,
        pitch: { ...note.pitch },
        startTick: component.startTick,
        durationTicks: component.durationTicks,
        hand: note.hand,
        voice: note.voice,
        // The written tie also states the sounding link on the added head, so
        // every reader of the model sees a continuation rather than an attack.
        tieStart: true,
        sourceProvenance: {
          voices: [chain.voice],
          staves: note.sourceProvenance ? [...note.sourceProvenance.staves] : [],
          hands: chainHands,
          unison: false,
        },
      };
      heads.push(head);
      components.push({
        index,
        startTick: component.startTick,
        durationTicks: component.durationTicks,
        headId: id,
        added: true,
        tieWait: component.tieWait,
      });
    });
    const first = chain.components[0];
    if (first) displayTicks.set(chain.noteId, first.durationTicks);
    for (const c of components) headIds.add(c.headId);
    rendered.push({
      noteId: chain.noteId,
      voice: chain.voice,
      soundingTicks: chain.soundingTicks,
      components,
      nonGrammar,
    });
  }
  return { displayTicks, chains: rendered, heads, headIds };
}

/** One painted tie arc between two consecutive component heads. */
export interface JankoTieArcGeometry {
  /** Sounding note that owns the chain. */
  noteId: string;
  /** Component index the arc starts from (= the earlier component). */
  index: number;
  fromTick: number;
  toTick: number;
  fromHeadId: string;
  toHeadId: string;
  /** -1 = the arc bulges above the pitch axis, +1 = below. */
  side: -1 | 1;
  /** Endpoint axis y (pt, page) — outside both heads' knockout boxes. */
  y: number;
  x1: number;
  x2: number;
  /** Bulge of the curve (pt): the ink's own apex beyond the axis. */
  depth: number;
  /**
   * Round 48: which profile the arc is painted with — `'uniform'` (the Round 46
   * single quadratic of constant stroke, the canonical surface) or `'traced'`
   * (the filled two-cubic contour traced from LilyPond's tie, the round's
   * shared tie treatment on both candidates).
   */
  profile: JankoTieProfile;
  /** Painted thickness (pt): stroke width (uniform) or apex thickness (traced). */
  thickness: number;
  /** SVG path `d`. */
  path: string;
  /** True when the arc's chord crosses a system barline. */
  crossesBarline: boolean;
  /** Foreign stems measured inside the arc's ink band (published, never hidden). */
  stemCrossings: JankoTieStemCrossing[];
}

/** One rendered chain component the layout could not resolve to a head. */
export interface JankoTieAnchorShortfall {
  /** Sounding note that owns the chain. */
  noteId: string;
  /** Component index whose head is missing. */
  component: number;
  /** Id of the head the plan named. */
  headId: string;
  /** Human-readable, published reason. */
  reason: string;
}

/** One foreign stem measured inside a tie's ink band. */
export interface JankoTieStemCrossing {
  /** Id of the note whose stem crosses. */
  stemNoteId: string;
  /** Stem x (pt). */
  x: number;
  /**
   * Vertical inset (pt) inside the stem's painted extent at the crossing x:
   * 0 means the crossing is fully inside the stem's ink.
   */
  overlap: number;
}

/** Tie stroke width (pt) of the resolved token set. */
export function tieStrokeOf(tokens?: Partial<JankoTokens> | null): number {
  return resolveJankoTokens(tokens).tieStroke;
}

/**
 * Round 48 — **the tie profile**: which contour an arc paints.
 *
 * - `'uniform'` (default): the Round 46 single quadratic path stroked at
 *   `tokens.tieStroke` with butt caps — the canonical surface, unchanged.
 * - `'traced'`: the filled contour below, the round's faithfully traced tie.
 */
export type JankoTieProfile = 'uniform' | 'traced';

/**
 * Round 48 — **the traced tie profile, measured from LilyPond 2.26.0.**
 * ==================================================================
 *
 * The project's tracing precedent measures an authoritative source outline and
 * records it exactly (Round 21 §A: every rest constant traces to a fontTools
 * outline extraction of Bravura, corroborated against Noto Music, with the
 * disagreement recorded; Round 22 transplants Bravura's contours verbatim). The
 * tie follows the same method with the strongest available exemplar: **the tie
 * LilyPond itself paints**, extracted from its own vector output
 * (`lilypond -dbackend=svg`, 2.26.0 — the compiler that produced the pinned
 * Brahms source in `data/sources/brahms-op118-no1/`). Four measured ties
 * (`c'8~c'8`, `c'4~c'4`, `c'2~c'2`, `c'1~c'1`, plus a two-bar `c'1~|c'1`)
 * produced the identical construction (local grob units, ×4.984pt per staff
 * space):
 *
 * ```
 * M1.1810 3.7500 C2.2921 4.6560 7.8199 4.6560 8.9310 3.7500
 *   L8.9310 3.7500 C7.8199 4.5360 2.2921 4.5360 1.1810 3.7500 z   (7.75sp)
 * M0.8521 3.7500 C1.2833 4.2735 2.1251 4.2735 2.5563 3.7500
 *   L2.5563 3.7500 C2.1251 4.1535 1.2833 4.1535 0.8521 3.7500 z   (1.70sp)
 * ```
 *
 * - **contour** — *two* cubic boundaries, not one stroked curve: the outer
 *   boundary and the inner boundary share both endpoints, and the shape closes
 *   with `z`. The crown is wide and shallow (control points at ~14–25% of the
 *   chord, never at the midpoint), so the apex is a flat plateau rather than the
 *   peaked arc a single midpoint-control quadratic draws.
 * - **tips** — *pointed*: both boundaries meet at the endpoints, because the
 *   inner control offset is the outer one minus the mid thickness. There is no
 *   blunt butt end anywhere in the family.
 * - **thickness/profile** — the two boundaries differ by **0.12 staff space**
 *   (0.598pt at the 4.984pt space) at every measured span, exactly the same
 *   number for an eighth-note tie and a two-bar tie; with the shared cubic
 *   construction that is a mid thickness of `0.75 × 0.598 = 0.449pt` tapering
 *   linearly to zero at both tips.
 * - **span adaptation** — LilyPond's declared `details.ratio = 0.333` with
 *   `height-limit = 1.0` staff space, whose apex heights measured 3.39pt
 *   (38.6pt chord, saturating), 2.87pt (19.3pt), 2.45pt (13.0pt) and 1.96pt
 *   (8.5pt) — its scoring optimizer, not a closed form. This engine keeps its
 *   own deterministic span law (`tieArcDepth`: a 0.10 chord fraction clamped to
 *   `tieMinDepth..tieMaxDepth`) and scales the traced profile to that apex, so
 *   the *shape* is the measured one and the *span* adaptation is this
 *   notation's declared rule (recorded here rather than passed off as traced).
 */
/**
 * Round 49 §6 — **the reference tie construction** (independently authored,
 * verified against LilyPond 2.26.0's own output).
 * ======================================================================
 *
 * The Round 48 approximation traced the *shape* of LilyPond's tie but kept
 * this engine's own span law (a fixed chord fraction clamped to
 * `tieMinDepth..tieMaxDepth`) and a single fixed median control fraction
 * (0.21), and painted the contour with `stroke: none`. That is not a precise
 * trace of the reference across spans: LilyPond's own output states both a
 * different height law and a control indent that varies with the height, and
 * its stencil edges read round, not knife-sharp.
 *
 * The two span laws are the **reference's own functional forms**, re-derived
 * from their published mathematical statement and expressed here in this
 * notation's units — not fitted approximations, and no GPL source text is
 * copied or translated (LilyPond is GPLv3+; this file is part of an
 * MIT-licensed codebase and the Bravura OFL grant does not extend to
 * LilyPond code). Primary evidence, all in LilyPond's native staff-space
 * units (`sp`):
 *
 * - **height law** — a normalized saturation `F(x) = (2/π)·atan(π·x/2)`
 *     (chosen so `F(0)=0`, `F'(0)=1`, `F(∞)=1`), applied as
 *     `h(w) = h_inf · F(w · r_0 / h_inf)` where `w` is the attachment span,
 *     `h_inf` the height limit and `r_0` the small-span slope ratio.
 *     Constants: LilyPond's Tie grob defaults `height-limit = 1.0 sp`,
 *     `ratio = 0.333` (`scm/define-grobs.scm`, v2.26.0).
 * - **control-indent law** — `G(w) = 2·h_inf − q²·m/(w + q)` with
 *     `q = 2·h_inf/m` and `m = 1/3.1` (so `G(0)=0`, `G'(0)=m`, `G(∞)=2·h_inf`:
 *     the controls pull outward as the crown flattens, never past a third of
 *     the span).
 * - **units** — every LilyPond tie length is in staff spaces
 *     (`tie-details.cc`: `staff_space_ = Staff_symbol_referencer::staff_space`);
 *     this engine converts through `tokens.tieRefStaffSpace` (4.984pt, the
 *     measured scale of the Round 48 specimens).
 * - **verification (independent oracle, not this engine's output)** —
 *     (a) LilyPond 2.26.0's *own computed* Tie control-points, dumped via an
 *     `after-line-breaking` Scheme hook at five spans (1.5563, 3.0405, 3.6621,
 *     4.5094, 6.2811 sp), reproduce under these laws to < 0.001 sp on both
 *     height and indent (`test/janko-round49.test.ts` pins the dumped
 *     numbers); (b) the four recorded output specimens of
 *     `docs/round48-rest-provenance-and-tie-trace.md` §4.1 — apexes 3.39 /
 *     2.87 / 2.45 / 1.96 pt at chords 38.56 / 19.34 / 12.96 / 8.47 pt —
 *     reproduce within 0.006 pt once the two-cubic sandwich offset (half the
 *     body's control separation, `0.5 · tieApexThickness`) is added to the
 *     centre-curve apex, exactly as the reference's own stencil offsets its
 *     two boundaries.
 *
 * `tieTracedDepth` returns the **printed outer-boundary apex** in pt (the
 * convention every ink consumer already reads); `tieTracedIndent` returns the
 * **absolute control indent** in pt (the reference law's native quantity —
 * no fraction clamp: the law itself keeps the indent under a third of the
 * span at every width).
 *
 * The contour itself stays the measured **two-cubic filled sandwich** with
 * pointed tips (both boundaries share both endpoints), now edged by a **round
 * edging stroke** of `tokens.tieEdgeStroke` (round joins and caps), so the
 * tips read as the reference's softened points instead of knife-sharp corners.
 * The musical placement — side, axis, routing — is untouched: this is contour
 * reproduction only, scoped to `options.tieProfile: 'traced'`, so the frozen
 * Bach profile (`'uniform'`) and its output stay byte-identical.
 */
export function tieTracedDepth(span: number, t: ResolvedJankoTokens): number {
  const wSp = Math.abs(span) / t.tieRefStaffSpace;
  const x = (wSp * t.tieRefRatio) / t.tieRefHeightLimit;
  const hSp = t.tieRefHeightLimit * (2 / Math.PI) * Math.atan((Math.PI / 2) * x);
  // The cubic boundary reads 0.75 of its control offset, and the outer
  // boundary's control sits half the body's control separation
  // (`0.5 · tieApexThickness` in apex terms) above the reference centre curve.
  return 0.75 * hSp * t.tieRefStaffSpace + 0.5 * t.tieApexThickness;
}

/** Absolute control indent (pt) of one traced arc, from its own span. */
export function tieTracedIndent(width: number, t: ResolvedJankoTokens): number {
  const wSp = Math.abs(width) / t.tieRefStaffSpace;
  const hInf = t.tieRefHeightLimit;
  const q = (2 * hInf) / t.tieRefIndentMaxFraction;
  const indentSp = 2 * hInf - (q * q * t.tieRefIndentMaxFraction) / (wSp + q);
  return Math.max(0, indentSp) * t.tieRefStaffSpace;
}

/** Saturation ceiling (pt) of the traced apex: the law's asymptotic depth. */
export function tieTracedMaxDepth(t: ResolvedJankoTokens): number {
  return 0.75 * t.tieRefHeightLimit * t.tieRefStaffSpace + 0.5 * t.tieApexThickness;
}

/**
 * One traced contour's control geometry: `indentAbs` is the **absolute**
 * control indent in pt (the reference law's native quantity, see
 * {@link tieTracedIndent}) — the law self-bounds it under a third of the
 * span, so only the degenerate zero-chord case needs a guard.
 */
export function tieTracedGeometry(
  x1: number,
  y: number,
  x2: number,
  side: -1 | 1,
  depth: number,
  thickness: number,
  indentAbs: number
): { ax: number; bx: number; outerControlY: number; innerControlY: number } {
  // The cubic's apex is 3/4 of its control offset, so the control offset is
  // `depth / 0.75` for an ink apex of exactly `depth` at the endpoint axis y.
  const outer = depth / 0.75;
  const inner = Math.max(0, outer - thickness / 0.75);
  const chord = Math.max(1e-6, Math.abs(x2 - x1));
  const f = Math.max(0, indentAbs) / chord;
  return {
    ax: x1 + f * (x2 - x1),
    bx: x2 - f * (x2 - x1),
    outerControlY: y + side * outer,
    innerControlY: y + side * inner,
  };
}

/**
 * Bulge (pt) of one tie arc: a shallow constant fraction of the chord, capped
 * at both ends so a two-column tie still curves and a system-wide tie never
 * becomes a semicircle. The depth states nothing but the arc's own ink — the
 * tie's *time* is its chord.
 */
export function tieArcDepth(x1: number, x2: number, t: ResolvedJankoTokens): number {
  const span = Math.abs(x2 - x1);
  return Math.max(t.tieMinDepth, Math.min(t.tieMaxDepth, span * t.tieDepthRatio));
}

/**
 * One quadratic tie arc: endpoints on the arc's axis, the control point pushing
 * the apex `depth` beyond it. Written as an explicit path so the paint, the
 * ink box and the lint read one string.
 */
export function tieArcPath(
  x1: number,
  y: number,
  x2: number,
  side: -1 | 1,
  depth: number,
  profile: JankoTieProfile = 'uniform',
  thickness: number = 0.7,
  indentAbs: number = 0
): string {
  if (profile === 'traced') {
    const g = tieTracedGeometry(x1, y, x2, side, depth, thickness, indentAbs);
    return (
      `M ${f(x1)} ${f(y)} C ${f(g.ax)} ${f(g.outerControlY)} ${f(g.bx)} ${f(g.outerControlY)} ${f(x2)} ${f(y)} ` +
      `L ${f(x2)} ${f(y)} C ${f(g.bx)} ${f(g.innerControlY)} ${f(g.ax)} ${f(g.innerControlY)} ${f(x1)} ${f(y)} Z`
    );
  }
  const cx = (x1 + x2) / 2;
  const cy = y + side * 2 * depth;
  return `M ${f(x1)} ${f(y)} Q ${f(cx)} ${f(cy)} ${f(x2)} ${f(y)}`;
}

/** Axis-aligned ink box of one tie arc (stroke padded). */
export function tieArcInkBox(
  arc: Pick<JankoTieArcGeometry, 'x1' | 'x2' | 'y' | 'side' | 'depth'> & {
    profile?: JankoTieProfile;
    thickness?: number;
  },
  tokens?: Partial<JankoTokens> | null
): { x0: number; y0: number; x1: number; y1: number } {
  const yApex = arc.y + arc.side * arc.depth;
  if (arc.profile === 'traced') {
    // The contour's own bounds plus its round edging stroke (Round 49 §6):
    // the tips sit exactly on the axis, the outer boundary's apex exactly
    // `depth` beyond it — the filled region is exact, and the round-cap edge
    // grows it by half the declared edge stroke on every face.
    const edge = resolveJankoTokens(tokens).tieEdgeStroke / 2;
    return {
      x0: Math.min(arc.x1, arc.x2) - edge,
      x1: Math.max(arc.x1, arc.x2) + edge,
      y0: Math.min(arc.y, yApex) - edge,
      y1: Math.max(arc.y, yApex) + edge,
    };
  }
  const half = (arc.thickness ?? tieStrokeOf(tokens)) / 2;
  return {
    x0: Math.min(arc.x1, arc.x2) - half,
    x1: Math.max(arc.x1, arc.x2) + half,
    y0: Math.min(arc.y, yApex) - half,
    y1: Math.max(arc.y, yApex) + half,
  };
}

/** One axis-aligned protected box a tie must not enter (a knockout box). */
export interface JankoTieBox {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Sample one quadratic tie arc into straight segments (exact curve points). */
export function tieArcSegments(
  arc: Pick<JankoTieArcGeometry, 'x1' | 'x2' | 'y' | 'side' | 'depth'> & {
    profile?: JankoTieProfile;
    thickness?: number;
  },
  samples: number = 16,
  indentAbs: number = 0
): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const out: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  if (arc.profile === 'traced') {
    // Both boundaries of the filled contour: sampled exactly like the painted
    // path, so the fit, the paint and the lint read the same ink.
    const g = tieTracedGeometry(
      arc.x1,
      arc.y,
      arc.x2,
      arc.side,
      arc.depth,
      arc.thickness ?? 0.45,
      indentAbs
    );
    const cubic = (controlY: number): Array<{ x: number; y: number }> => {
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const v = 1 - u;
        points.push({
          x:
            v * v * v * arc.x1 +
            3 * v * v * u * g.ax +
            3 * v * u * u * g.bx +
            u * u * u * arc.x2,
          y:
            v * v * v * arc.y +
            3 * v * v * u * controlY +
            3 * v * u * u * controlY +
            u * u * u * arc.y,
        });
      }
      return points;
    };
    const chain = (points: Array<{ x: number; y: number }>): void => {
      for (let i = 1; i < points.length; i++) {
        out.push({ x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y });
      }
    };
    const outer = cubic(g.outerControlY);
    const inner = cubic(g.innerControlY);
    chain(outer);
    chain([...inner].reverse());
    // Round 48: the contour is a **filled** shape, so the sampled ink must
    // include its interior too. One rib per sample joins the two boundaries, so
    // a box that lies wholly between them (thin enough to fit inside the crown)
    // is caught like any other overlap — the predicate the fit, the routing and
    // the linter share.
    for (let i = 0; i <= samples; i++) {
      const a = outer[i];
      const b = inner[i];
      out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
    }
    return out;
  }
  const cx = (arc.x1 + arc.x2) / 2;
  const cy = arc.y + arc.side * 2 * arc.depth;
  const at = (t: number): { x: number; y: number } => {
    const u = 1 - t;
    return {
      x: u * u * arc.x1 + 2 * u * t * cx + t * t * arc.x2,
      y: u * u * arc.y + 2 * u * t * cy + t * t * arc.y,
    };
  };
  let prev = at(0);
  for (let i = 1; i <= samples; i++) {
    const next = at(i / samples);
    out.push({ x1: prev.x, y1: prev.y, x2: next.x, y2: next.y });
    prev = next;
  }
  return out;
}

/** Does a straight segment come within `air` of an axis-aligned box? */
function segmentTouchesBox(
  s: { x1: number; y1: number; x2: number; y2: number },
  b: JankoTieBox,
  air: number
): boolean {
  const x0 = b.x0 - air;
  const y0 = b.y0 - air;
  const x1 = b.x1 + air;
  const y1 = b.y1 + air;
  // Trivial accept: either endpoint inside, or the segment straddles the box
  // in both axes with the crossing inside the box's extent.
  const inside = (x: number, y: number): boolean => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (inside(s.x1, s.y1) || inside(s.x2, s.y2)) return true;
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  for (const [ex, ey] of [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ] as const) {
    // Does the infinite line cross the slab?
    if (Math.abs(dx) < 1e-12) {
      if (s.x1 < x0 || s.x1 > x1) continue;
      if ((y0 - s.y1) * (y1 - s.y1) <= 0) return true;
      continue;
    }
    if (Math.abs(dy) < 1e-12) {
      if (s.y1 < y0 || s.y1 > y1) continue;
      if ((x0 - s.x1) * (x1 - s.x1) <= 0) return true;
      continue;
    }
    const tx0 = (x0 - s.x1) / dx;
    const tx1 = (x1 - s.x1) / dx;
    const ty0 = (y0 - s.y1) / dy;
    const ty1 = (y1 - s.y1) / dy;
    const tMin = Math.max(Math.min(tx0, tx1), Math.min(ty0, ty1));
    const tMax = Math.min(Math.max(tx0, tx1), Math.max(ty0, ty1));
    if (tMax >= Math.max(tMin, 0) && Math.min(tMax, 1) >= tMin && tMax >= 0 && tMin <= 1) {
      return true;
    }
  }
  return false;
}

/**
 * Does this arc's painted ink enter any of `boxes`? The exact curve (sampled
 * into straight segments) is tested with the stroke's own half-width, so the
 * paint, the fit and the lint share one predicate.
 */
export function tieArcEntersBoxes(
  arc: Pick<JankoTieArcGeometry, 'x1' | 'x2' | 'y' | 'side' | 'depth'> & {
    profile?: JankoTieProfile;
    thickness?: number;
  },
  boxes: readonly JankoTieBox[],
  tokens?: Partial<JankoTokens> | null
): JankoTieBox | null {
  // The traced ink is the contour plus its round edging stroke (Round 49 §6),
  // so it keeps half the declared edge stroke as padding; the uniform profile
  // keeps its half-stroke air. The sampled boundaries follow the reference
  // control-indent law — the same absolute indent the paint uses, read from
  // the arc's own span.
  const resolved = resolveJankoTokens(tokens);
  const half =
    arc.profile === 'traced' ? resolved.tieEdgeStroke / 2 : (arc.thickness ?? tieStrokeOf(tokens)) / 2;
  const segments = tieArcSegments(arc, 16, tieTracedIndent(Math.abs(arc.x2 - arc.x1), resolved));
  for (const box of boxes) {
    for (const segment of segments) {
      if (segmentTouchesBox(segment, box, half)) return box;
    }
  }
  return null;
}

/** Paint the whole tie layer of one system. */
export function renderJankoTieArcs(
  arcs: readonly JankoTieArcGeometry[],
  tokens?: Partial<JankoTokens> | null
): string {
  if (arcs.length === 0) return '';
  const t = resolveJankoTokens(tokens);
  const out: string[] = ['    <g class="janko-tie-layer">'];
  for (const arc of arcs) {
    const traced = arc.profile === 'traced';
    out.push(
      `      <path class="janko-tie${traced ? ' janko-tie-traced' : ''}" data-tie-note="${arc.noteId}" data-tie-component="${arc.index}" ` +
        `data-tie-from="${arc.fromHeadId}" data-tie-to="${arc.toHeadId}" ` +
        `data-tie-from-tick="${arc.fromTick}" data-tie-to-tick="${arc.toTick}" ` +
        `data-tie-side="${arc.side < 0 ? 'above' : 'below'}" data-tie-profile="${arc.profile}"` +
        `${arc.crossesBarline ? ' data-tie-crosses-barline="true"' : ''}` +
        `${arc.stemCrossings.length > 0 ? ` data-tie-stem-crossings="${arc.stemCrossings.map((c) => c.stemNoteId).join(',')}"` : ''} ` +
        `d="${arc.path}" ` +
        (traced
          ? `fill="#111111" stroke="#111111" stroke-width="${t.tieEdgeStroke.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`
          : `fill="none" stroke="#111111" stroke-width="${t.tieStroke.toFixed(2)}"/>`)
    );
  }
  out.push('    </g>');
  return out.join('\n');
}

/** Ranked order of the arc sides: the conventional side first, then the other. */
export function tieSideOrder(hand: Hand): Array<-1 | 1> {
  // Stems are up for the right hand and down for the left, so the conventional
  // tie sits on the opposite side of the head's own stem.
  return hand === 'RH' ? [1, -1] : [-1, 1];
}

/** Export for callers that need the chain type without importing the model. */
export type { WrittenTieChain };
