/**
 * Fixed three-rail note placement for bracketed groups (ticket §1).
 * ================================================================
 *
 * All bracketed groups use three invisible note rails about the TRUE rhythmic
 * column X: X−d, X, X+d. The rail step `d` is the active style's common
 * pair gap (`getClusterSpacingPreset().pairGap`: 5.46pt at `'tight'`),
 * independent of numeral/letter identity. No fourth rail, no per-glyph
 * variable offsets, no changes to true timing columns.
 *
 * Precedence (operator-settled aesthetic/practical compromise):
 * - Nonconflicting/common-duration members stay CENTER wherever possible.
 * - Ordinary conflicting pair: source-lower LEFT / source-higher RIGHT;
 *   three-member alternating collision chain: bottom LEFT / middle RIGHT /
 *   top LEFT (source-pitch order, collision from displayed protection
 *   geometry). Alternation extends only where feasible; cliques that cannot
 *   fit diagnose instead of pretending.
 * - Different duration ALONE never forces a side lane: the note's COMPLETE
 *   independent duration ink (stem + flags + augmentation dots) is assessed
 *   in its actual direction against other members' masks.
 * - One obstructed internal exceptional-duration member goes RIGHT,
 *   preserving common members CENTER — explicitly outranking ordinary
 *   alternation (m1/m3: two commons CENTER, middle exception RIGHT).
 * - Outward carriers (upgoing highest / down-going lowest with a clear
 *   duration path) are NOT displaced for duration reasons (m9/m19 top pairs:
 *   lower CENTER / higher RIGHT, both paths upward).
 * - Two genuinely obstructed internal members: LONGER duration LEFT /
 *   SHORTER RIGHT (exact ticks). Equal-duration tie: source-pitch order
 *   (lower LEFT / higher RIGHT) only if complete ink fits, else diagnostic.
 *
 * Pure over member geometry: the column solve (Pass C′) and the downbeat
 * inset predictor (§2) share this one function, so prediction and placement
 * can never disagree. Infeasible groups return diagnostics; callers keep
 * honest prior offsets and surface the diagnostic (on the literal corpus any
 * diagnostic is a STOP condition per the ticket).
 */

export type ThreeRail = -1 | 0 | 1;

/** One bracket member's placement-relevant geometry (caller-resolved). */
export interface ThreeRailMember {
  /** Score-unique note id. */
  id: string;
  /** Source musical pitch (octave * 12 + pitchClass from note.pitch). */
  sourceLin: number;
  /** Displayed notehead-centre y (page pt, folded). */
  y: number;
  /** Protection half-extents (displayed/folded mask, style envelope). */
  wx: number;
  hy: number;
  /** Exact written duration (ticks). */
  durationTicks: number;
  /** Carried duration for this member (bracket mode rule, caller-resolved). */
  carriedTicks: number;
  /** Stem direction: -1 RH (up), +1 LH (down). */
  stemDir: -1 | 1;
  /**
   * Complete independent duration ink at the CENTER rail (absolute page pt),
   * or null when the member's stem is suppressed into the bracket (commons).
   */
  ink: ThreeRailInk | null;
}

/** Complete independent duration ink boxes at one rail (page pt). */
export interface ThreeRailInkBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface ThreeRailInk {
  /** Stem box (stroke included). */
  stem: ThreeRailInkBox;
  /** Flag glyph box at the tip (empty array when no flags). */
  flags: ThreeRailInkBox[];
  /** Augmentation dot discs as boxes (empty when undotted). */
  dots: ThreeRailInkBox[];
}

export interface ThreeRailDiagnostic {
  /** Member ids the diagnostic concerns (group scope when empty-ish). */
  memberIds: string[];
  /** Machine-readable reason. */
  reason:
    | 'ordinary-clique-infeasible'
    | 'exception-rail-occupied'
    | 'exception-path-blocked'
    | 'equal-tie-unresolved'
    | 'too-many-exceptions'
    | 'seated-collision';
  message: string;
}

/**
 * An immovable same-onset obstacle (a non-member at its solved offset):
 * absolute mask geometry. Bracket members seat around fixed obstacles but
 * never move them; fixed masks use no ink (a suppressed stem paints
 * nothing, and testing against unpainted stems would false-positive — the
 * linter backstops stem ink).
 */
export interface ThreeRailFixed {
  id: string;
  x: number;
  y: number;
  wx: number;
  hy: number;
}

export interface ThreeRailAssignment {
  /** Rail per member id (-1 LEFT, 0 CENTER, +1 RIGHT). */
  rails: Map<string, ThreeRail>;
  /** Non-empty when the group cannot fit the rails with required ink. */
  diagnostics: ThreeRailDiagnostic[];
}

/** Strict box overlap (touching within EPS counts as clear). */
const EPS = 1e-9;

function boxesOverlap(a: ThreeRailInkBox, b: ThreeRailInkBox): boolean {
  return a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS;
}

/** Shift an ink box set horizontally by dx (rail change). */
function shiftInk(ink: ThreeRailInk | null, dx: number): ThreeRailInkBox[] {
  if (!ink) return [];
  const out: ThreeRailInkBox[] = [
    { x0: ink.stem.x0 + dx, y0: ink.stem.y0 + dx, x1: ink.stem.x1 + dx, y1: ink.stem.y1 + dx },
  ];
  for (const b of ink.flags) out.push({ x0: b.x0 + dx, y0: b.y0 + dx, x1: b.x1 + dx, y1: b.y1 + dx });
  for (const b of ink.dots) out.push({ x0: b.x0 + dx, y0: b.y0 + dx, x1: b.x1 + dx, y1: b.y1 + dx });
  return out;
}

/** Mask rect of a member at rail `rail` (nominalX + rail * gap). */
function maskAt(
  m: ThreeRailMember,
  nominalX: number,
  gap: number,
  rail: ThreeRail
): ThreeRailInkBox {
  const cx = nominalX + rail * gap;
  return { x0: cx - m.wx, y0: m.y - m.hy, x1: cx + m.wx, y1: m.y + m.hy };
}

/** Do two members' masks overlap at their rails? */
function masksOverlap(
  a: ThreeRailMember,
  railA: ThreeRail,
  b: ThreeRailMember,
  railB: ThreeRail,
  nominalX: number,
  gap: number
): boolean {
  return boxesOverlap(maskAt(a, nominalX, gap, railA), maskAt(b, nominalX, gap, railB));
}

/** Does a member's mask at `rail` overlap a fixed obstacle? */
function fixedOverlaps(
  m: ThreeRailMember,
  rail: ThreeRail,
  fixed: ThreeRailFixed,
  nominalX: number,
  gap: number
): boolean {
  return boxesOverlap(maskAt(m, nominalX, gap, rail), {
    x0: fixed.x - fixed.wx,
    y0: fixed.y - fixed.hy,
    x1: fixed.x + fixed.wx,
    y1: fixed.y + fixed.hy,
  });
}

/** Vertical mask overlap (rail-independent): do the members conflict at all? */
function verticalOverlap(a: ThreeRailMember, b: ThreeRailMember): boolean {
  return Math.min(a.y + a.hy, b.y + b.hy) - Math.max(a.y - a.hy, b.y - b.hy) > EPS;
}

/** Connected components of the vertical-overlap graph (deterministic order). */
function overlapComponents(members: readonly ThreeRailMember[]): ThreeRailMember[][] {
  const sorted = [...members].sort(
    (a, b) => a.y - b.y || a.sourceLin - b.sourceLin || (a.id < b.id ? -1 : 1)
  );
  const components: ThreeRailMember[][] = [];
  const seen = new Set<string>();
  for (const m of sorted) {
    if (seen.has(m.id)) continue;
    const component: ThreeRailMember[] = [];
    const queue = [m];
    seen.add(m.id);
    while (queue.length > 0) {
      const cur = queue.pop()!;
      component.push(cur);
      for (const other of sorted) {
        if (seen.has(other.id)) continue;
        if (verticalOverlap(cur, other)) {
          seen.add(other.id);
          queue.push(other);
        }
      }
    }
    component.sort(
      (a, b) => a.sourceLin - b.sourceLin || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );
    components.push(component);
  }
  components.sort((a, b) => (a[0].id < b[0].id ? -1 : 1));
  return components;
}

/**
 * Does `exc`'s complete duration ink (at `rail`) overlap any seated
 * member's mask or any fixed obstacle? `seated` maps member id → rail for
 * already-seated members. Returns the blocking member, or a synthetic
 * obstacle reference for fixed blockers.
 */
function durationPathObstructed(
  exc: ThreeRailMember,
  rail: ThreeRail,
  members: readonly ThreeRailMember[],
  seated: ReadonlyMap<string, ThreeRail>,
  nominalX: number,
  gap: number,
  fixed: readonly ThreeRailFixed[] = []
): { id: string } | null {
  const dx = rail * gap;
  // Ink was resolved at CENTER (nominalX); shift to the candidate rail.
  const inkBoxes = shiftInk(exc.ink, dx);
  for (const other of members) {
    if (other.id === exc.id) continue;
    const otherRail = seated.get(other.id);
    if (otherRail === undefined) continue;
    const mask = maskAt(other, nominalX, gap, otherRail);
    if (inkBoxes.some((b) => boxesOverlap(b, mask))) return other;
  }
  for (const obstacle of fixed) {
    const mask = {
      x0: obstacle.x - obstacle.wx,
      y0: obstacle.y - obstacle.hy,
      x1: obstacle.x + obstacle.wx,
      y1: obstacle.y + obstacle.hy,
    };
    if (inkBoxes.some((b) => boxesOverlap(b, mask))) return { id: obstacle.id };
  }
  return null;
}

/**
 * Assign fixed three-rail seats (-1/0/+1) to one bracket group's members.
 * `nominalX` is the true rhythmic column; `gap` the style's rail step.
 * Members' `ink` must be resolved at the CENTER rail (absolute page pt).
 * `fixed` carries immovable same-onset obstacles (non-members at their
 * solved offsets); members seat around them, staggering off CENTER only
 * where CENTER is genuinely taken ("wherever possible").
 */
export function assignThreeRails(
  members: readonly ThreeRailMember[],
  nominalX: number,
  gap: number,
  fixed: readonly ThreeRailFixed[] = []
): ThreeRailAssignment {
  const rails = new Map<string, ThreeRail>();
  const diagnostics: ThreeRailDiagnostic[] = [];
  const byId = new Map(members.map((m) => [m.id, m] as const));

  const commons = members.filter((m) => m.durationTicks === m.carriedTicks);
  const exceptions = members.filter((m) => m.durationTicks !== m.carriedTicks);

  /** First seated member or fixed obstacle colliding with `m` at `rail`. */
  const collisionAt = (
    m: ThreeRailMember,
    rail: ThreeRail
  ): { id: string; sourceLin: number } | null => {
    for (const [id, seated] of rails) {
      const other = byId.get(id)!;
      if (masksOverlap(m, rail, other, seated, nominalX, gap)) {
        return { id: other.id, sourceLin: other.sourceLin };
      }
    }
    for (const obstacle of fixed) {
      if (fixedOverlaps(m, rail, obstacle, nominalX, gap)) {
        return { id: obstacle.id, sourceLin: Number.NEGATIVE_INFINITY };
      }
    }
    return null;
  };

  /**
   * Ordinary relative seat: CENTER when clear, else one rail away from the
   * conflict (higher staggers RIGHT, lower LEFT), the other side when the
   * first is taken, diagnostic when neither fits. `label` names the mover
   * for diagnostics.
   */
  const seatOrdinaryRelative = (m: ThreeRailMember, label: string): boolean => {
    if (!collisionAt(m, 0)) {
      rails.set(m.id, 0);
      return true;
    }
    const first: ThreeRail =
      m.sourceLin >=
      (members.find((c) => c.id !== m.id && verticalOverlap(m, c))?.sourceLin ?? m.sourceLin)
        ? 1
        : -1;
    for (const dir of [first, (first > 0 ? -1 : 1) as ThreeRail]) {
      if (!collisionAt(m, dir)) {
        rails.set(m.id, dir);
        return true;
      }
    }
    const blocker = collisionAt(m, 0);
    diagnostics.push({
      memberIds: [m.id, blocker?.id ?? ''],
      reason: 'exception-rail-occupied',
      message:
        `${label} ${m.id} cannot stagger off CENTER: both side rails collide ` +
        `(blocked at CENTER by ${blocker?.id ?? 'unknown'}).`,
    });
    return false;
  };

  // --- Step 1: seat commons per ordinary rules (ignoring exceptions). ---
  for (const component of overlapComponents(commons)) {
    if (component.length === 1) {
      // Singles stay CENTER wherever possible, staggering only around
      // fixed same-onset obstacles that genuinely take CENTER.
      if (!collisionAt(component[0], 0)) {
        rails.set(component[0].id, 0);
        continue;
      }
      seatOrdinaryRelative(component[0], 'Common member');
      continue;
    }
    // Compact ordinary seating from protected mask bounds: a conflicting
    // pair needs exactly one rail step (dx = gap ≥ 2wx + air), so it seats
    // ADJACENT — lower CENTER / higher RIGHT first, then lower LEFT /
    // higher CENTER — and only falls back to the outer rails when a fixed
    // obstacle genuinely takes the compact seats. Longer chains alternate
    // from LEFT by source pitch; a three-member TRUE CLIQUE (every pair
    // overlaps) cannot alternate — it seats the only feasible three-rail
    // pattern, LEFT/CENTER/RIGHT by source pitch — while larger infeasible
    // components diagnose honestly.
    const patterns: ThreeRail[][] =
      component.length === 3
        ? [
            [-1, 1, -1],
            [-1, 0, 1],
          ]
        : component.length === 2
          ? [
              [0, 1],
              [-1, 0],
              [-1, 1],
            ]
          : [component.map((_, i) => ((i % 2 === 0 ? -1 : 1) as ThreeRail))];
    let seated: ThreeRail[] | null = null;
    for (const seats of patterns) {
      let fits = true;
      for (let i = 0; i < component.length && fits; i++) {
        for (let j = i + 1; j < component.length; j++) {
          if (masksOverlap(component[i], seats[i], component[j], seats[j], nominalX, gap)) {
            fits = false;
            break;
          }
        }
        if (fits && collisionAt(component[i], seats[i])) fits = false;
      }
      if (fits) {
        seated = seats;
        break;
      }
    }
    if (!seated) {
      diagnostics.push({
        memberIds: component.map((m) => m.id),
        reason: 'ordinary-clique-infeasible',
        message:
          `Ordinary collision component (${component.map((m) => m.id).join(', ')}) ` +
          `cannot seat on three rails: every pattern collides.`,
      });
      continue;
    }
    component.forEach((m, i) => rails.set(m.id, seated[i]));
  }

  if (exceptions.length === 0) {
    return finalize(members, rails, diagnostics, nominalX, gap, fixed);
  }

  // --- Step 2: seat exceptions. ---
  /** Highest/lowest source pitch of the whole group (outward test). */
  const lins = members.map((m) => m.sourceLin);
  const topLin = Math.max(...lins);
  const botLin = Math.min(...lins);
  const isOutward = (m: ThreeRailMember): boolean =>
    (m.stemDir === -1 && m.sourceLin === topLin) || (m.stemDir === 1 && m.sourceLin === botLin);

  if (exceptions.length === 1) {
    const exc = exceptions[0];
    const outward = isOutward(exc);
    const blocker = durationPathObstructed(exc, 0, members, rails, nominalX, gap, fixed);
    if (outward && !blocker) {
      // Outward carrier with a clear path: no duration displacement.
      seatOrdinaryRelative(exc, 'Exempt exception');
    } else if (!blocker) {
      // Unobstructed internal exception: CENTER when clear, else ordinary.
      seatOrdinaryRelative(exc, 'Exempt exception');
    } else {
      // One obstructed internal exception: preferential RIGHT, commons stay.
      const collision = collisionAt(exc, 1);
      if (collision) {
        diagnostics.push({
          memberIds: [exc.id, collision.id],
          reason: 'exception-rail-occupied',
          message:
            `Obstructed exception ${exc.id} cannot take RIGHT: rail occupied by ${collision.id} ` +
            `(blocked at CENTER by ${blocker.id}).`,
        });
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      }
      rails.set(exc.id, 1);
      // The move must actually clear the path; else honest diagnostic.
      const still = durationPathObstructed(exc, 1, members, rails, nominalX, gap, fixed);
      if (still) {
        diagnostics.push({
          memberIds: [exc.id, still.id],
          reason: 'exception-path-blocked',
          message:
            `Exception ${exc.id} at RIGHT still obstructed by ${still.id}: ` +
            `three rails cannot fit its duration ink.`,
        });
      }
    }
    return finalize(members, rails, diagnostics, nominalX, gap, fixed);
  }

  if (exceptions.length === 2) {
    // Assess each against seated commons. Co-exceptions are unseated at this
    // point, so the assessment ignores them: a member blocked ONLY by its
    // co-exception (which staggers away) is not genuinely obstructed — the
    // m9/m19 top-pair case. Members blocked by seated commons are.
    const [e1, e2] = [...exceptions].sort((a, b) => a.sourceLin - b.sourceLin);
    const b1 = durationPathObstructed(e1, 0, members, rails, nominalX, gap, fixed);
    const b2 = durationPathObstructed(e2, 0, members, rails, nominalX, gap, fixed);
    const obstructed = exceptions.filter((e) => (e.id === e1.id ? b1 : b2) !== null);
    if (obstructed.length === 0) {
      // Neither blocked by seated commons (m9/m19): seat lower CENTER when
      // clear, higher staggering relative. Do not force both RIGHT.
      if (!seatOrdinaryRelative(e1, 'Exempt exception'))
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      if (!seatOrdinaryRelative(e2, 'Exempt exception'))
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      return finalize(members, rails, diagnostics, nominalX, gap, fixed);
    }
    if (obstructed.length === 1) {
      const ob = obstructed[0];
      const other = ob.id === e1.id ? e2 : e1;
      // Seat the unobstructed one first (ordinary relative), then the
      // obstructed one preferentially RIGHT.
      if (!seatOrdinaryRelative(other, 'Exempt exception'))
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      const recheck = durationPathObstructed(ob, 0, members, rails, nominalX, gap, fixed);
      if (!recheck) {
        if (!seatOrdinaryRelative(ob, 'Exempt exception'))
          return finalize(members, rails, diagnostics, nominalX, gap, fixed);
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      }
      const collision = collisionAt(ob, 1);
      if (collision) {
        diagnostics.push({
          memberIds: [ob.id, collision.id],
          reason: 'exception-rail-occupied',
          message: `Obstructed exception ${ob.id} cannot take RIGHT: rail occupied by ${collision.id}.`,
        });
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      }
      rails.set(ob.id, 1);
      return finalize(members, rails, diagnostics, nominalX, gap, fixed);
    }
    // Two genuinely obstructed internal members: LONGER LEFT / SHORTER
    // RIGHT (exact ticks); equal durations fall back to source-pitch order.
    let left: ThreeRailMember;
    let right: ThreeRailMember;
    let tie = false;
    if (e1.durationTicks !== e2.durationTicks) {
      left = e1.durationTicks > e2.durationTicks ? e1 : e2;
      right = left.id === e1.id ? e2 : e1;
    } else {
      tie = true;
      left = e1;
      right = e2;
    }
    for (const [m, rail] of [[left, -1], [right, 1]] as const) {
      const collision = collisionAt(m, rail);
      if (collision) {
        diagnostics.push({
          memberIds: [m.id, collision.id],
          reason: tie ? 'equal-tie-unresolved' : 'exception-rail-occupied',
          message:
            `Two obstructed exceptions cannot seat ${m.id} ${rail > 0 ? 'RIGHT' : 'LEFT'}: ` +
            `rail occupied by ${collision.id}${tie ? ' (equal-duration tie)' : ''}.`,
        });
        return finalize(members, rails, diagnostics, nominalX, gap, fixed);
      }
    }
    rails.set(left.id, -1);
    rails.set(right.id, 1);
    return finalize(members, rails, diagnostics, nominalX, gap, fixed);
  }

  diagnostics.push({
    memberIds: exceptions.map((m) => m.id),
    reason: 'too-many-exceptions',
    message:
      `${exceptions.length} exceptional-duration members exceed the bounded two-exception rule.`,
  });
  return finalize(members, rails, diagnostics, nominalX, gap, fixed);
}

/**
 * Final verification: every seated pair's masks must clear (including
 * fixed obstacles), every seated exception's complete duration ink must
 * clear every other seated member's mask and every fixed mask, and
 * co-exception ink must not collide (flag/dot vs stem). Commons carry
 * empty ink (suppressed into the bracket), so only exceptions constrain.
 */
function finalize(
  members: readonly ThreeRailMember[],
  rails: Map<string, ThreeRail>,
  diagnostics: ThreeRailDiagnostic[],
  nominalX: number,
  gap: number,
  fixed: readonly ThreeRailFixed[] = []
): ThreeRailAssignment {
  const seated = members.filter((m) => rails.has(m.id));
  for (let i = 0; i < seated.length; i++) {
    for (let j = i + 1; j < seated.length; j++) {
      const a = seated[i];
      const b = seated[j];
      if (masksOverlap(a, rails.get(a.id)!, b, rails.get(b.id)!, nominalX, gap)) {
        diagnostics.push({
          memberIds: [a.id, b.id],
          reason: 'seated-collision',
          message: `Seated members ${a.id} and ${b.id} still collide: three rails cannot fit.`,
        });
      }
    }
    for (const obstacle of fixed) {
      if (fixedOverlaps(seated[i], rails.get(seated[i].id)!, obstacle, nominalX, gap)) {
        diagnostics.push({
          memberIds: [seated[i].id, obstacle.id],
          reason: 'seated-collision',
          message:
            `Seated member ${seated[i].id} collides with fixed obstacle ${obstacle.id}: ` +
            `three rails cannot fit.`,
        });
      }
    }
  }
  const exceptions = seated.filter((m) => m.durationTicks !== m.carriedTicks);
  for (const exc of exceptions) {
    const inkBoxes = shiftInk(exc.ink, rails.get(exc.id)! * gap);
    if (inkBoxes.length === 0) continue;
    for (const other of seated) {
      if (other.id === exc.id) continue;
      const mask = maskAt(other, nominalX, gap, rails.get(other.id)!);
      if (inkBoxes.some((b) => boxesOverlap(b, mask))) {
        diagnostics.push({
          memberIds: [exc.id, other.id],
          reason: 'exception-path-blocked',
          message:
            `Exception ${exc.id} at rail ${rails.get(exc.id)} still obstructs ${other.id}: ` +
            `three rails cannot fit its duration ink.`,
        });
      }
    }
    for (const obstacle of fixed) {
      const mask = {
        x0: obstacle.x - obstacle.wx,
        y0: obstacle.y - obstacle.hy,
        x1: obstacle.x + obstacle.wx,
        y1: obstacle.y + obstacle.hy,
      };
      if (inkBoxes.some((b) => boxesOverlap(b, mask))) {
        diagnostics.push({
          memberIds: [exc.id, obstacle.id],
          reason: 'exception-path-blocked',
          message:
            `Exception ${exc.id} at rail ${rails.get(exc.id)} still obstructs fixed obstacle ` +
            `${obstacle.id}: three rails cannot fit its duration ink.`,
        });
      }
    }
  }
  for (let i = 0; i < exceptions.length; i++) {
    for (let j = i + 1; j < exceptions.length; j++) {
      const aBoxes = shiftInk(exceptions[i].ink, rails.get(exceptions[i].id)! * gap);
      const bBoxes = shiftInk(exceptions[j].ink, rails.get(exceptions[j].id)! * gap);
      if (aBoxes.some((a) => bBoxes.some((b) => boxesOverlap(a, b)))) {
        diagnostics.push({
          memberIds: [exceptions[i].id, exceptions[j].id],
          reason: 'seated-collision',
          message:
            `Exceptions ${exceptions[i].id} and ${exceptions[j].id} collide ink-to-ink: ` +
            `three rails cannot fit.`,
        });
      }
    }
  }
  return { rails, diagnostics };
}
