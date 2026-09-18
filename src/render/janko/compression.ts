/**
 * Semantic Hand-Cluster Compression Engine (Round 35)
 * ===================================================
 *
 * Implements two candidate treatments for semantic compression of simultaneous
 * octave-repeated pitch shapes at the same onset and hand:
 *
 * Treatment A: Spatial Echo
 * -------------------------
 * - Explicit numeral-bearing origin shape.
 * - Lightweight, distinctly non-note group marker at each copied register carrying
 *   the occurrence's rhythm via standard duration cues (rings, dots, slashes).
 * - Refers to the whole scoped shape, maintaining register landmarks.
 * - Local structural connector/enclosure directly disambiguates origins.
 *
 * Treatment B: Compact Coupling
 * -----------------------------
 * - Explicit numeral-bearing origin shape.
 * - Adjacent bounded additive-occurrence structure (+10 / +20 duodecimal notation).
 * - Binds each occurrence's duration cues directly to that occurrence.
 * - Copied registers require no noteheads (intentional abstraction).
 *
 * Control: Literal Baseline
 * -------------------------
 * - Every note rendered with full numeral-bearing noteheads across all registers.
 *
 * Invariants:
 * - Immutable score events and provenance.
 * - Exact lossless expansion reproduces original notes and ownership.
 * - Independent extra notes (such as B3 in mm. 8–9) remain literal outside scope.
 * - Copies with different durations (such as m. 9: 144 vs 192 ticks) are fully supported.
 * - Nonrepeating passages (such as m. 8 second half) fall back cleanly to literal.
 */

import { Hand, QuantizedNote } from '../../model/types';
import {
  ResolvedJankoLayoutOptions,
  ResolvedJankoTokens,
  getClusterSpacingPreset,
} from './types';
import { f } from './elements/style';
import type { PositionedJankoNote } from './engine';

export type JankoCompressibleItem = QuantizedNote | PositionedJankoNote;

export function isPositionedNote(item: JankoCompressibleItem): item is PositionedJankoNote {
  return typeof (item as PositionedJankoNote).x === 'number' && typeof (item as PositionedJankoNote).y === 'number';
}

export function getQuantizedNote(item: JankoCompressibleItem): QuantizedNote {
  return 'note' in item ? item.note : item;
}

/** Extract the underlying QuantizedNote whether item is QuantizedNote or PositionedJankoNote. */
export function asQuantizedNote(item: any): QuantizedNote {
  return item && item.note ? item.note : item;
}

/** Sounding linear pitch: 12 * octave + pitchClass. */
export function getSoundingLin(item: JankoCompressibleItem): number {
  const q = getQuantizedNote(item);
  const pc = ((q.pitch.pitchClass % 12) + 12) % 12;
  return q.pitch.octave * 12 + pc;
}

/** One occurrence of a pitch shape within a compressed cluster. */
export interface JankoCompressedOccurrence<T = JankoCompressibleItem> {
  /** Notes belonging to this occurrence. */
  notes: T[];
  /** Sounding base pitch of this occurrence. */
  baseLin: number;
  /** Octave displacement relative to the origin (0 for origin, +1 for +10, +2 for +20, -1 for -10). */
  octaveOffset: number;
  /** Duration (ticks) of this occurrence. Uniform across notes in this occurrence. */
  durationTicks: number;
  /** Vertical center in page pt (when positioned notes are provided). */
  centerY?: number;
  /** Vertical extents [top, bottom] in page pt. */
  yExtent?: [number, number];
  /** Horizontal column x in page pt. */
  x?: number;
}

/** A single compressed cluster of notes at a specific onset and hand. */
export interface JankoCompressedCluster<T = JankoCompressibleItem> {
  id: string;
  startTick: number;
  hand: Hand;
  /** Pitch offsets of the shape relative to baseLin, sorted ascending (e.g. [0] for single note, [0, 2] for {F, G}). */
  shapeOffsets: number[];
  /** Origin occurrence (drawn with explicit numeral-bearing noteheads). */
  origin: JankoCompressedOccurrence<T>;
  /** One or more copy occurrences (octaveOffset !== 0). */
  copies: JankoCompressedOccurrence<T>[];
  /** All note IDs in this cluster. */
  allNoteIds: Set<string>;
  /** Note IDs of copy notes (their heads are compressed/omitted). */
  copyNoteIds: Set<string>;
  /** Bounding box of the compression glyphs [minX, minY, maxX, maxY]. */
  inkBox?: [number, number, number, number];
  /** Discrete primitive ink boxes for exact collision auditing. */
  inkBoxes?: [number, number, number, number][];
}

/** Result of resolving compression for a collection of notes. */
export interface JankoCompressionResult<T = JankoCompressibleItem> {
  clusters: JankoCompressedCluster<T>[];
  independentNotes: T[];
  copyNoteIds: Set<string>;
}

/**
 * Deterministically group notes at a single onset and hand into maximal
 * exact repeated pitch shapes at octave displacements.
 */
export function groupOnsetNotes<T extends JankoCompressibleItem>(
  notes: readonly T[]
): JankoCompressionResult<T> {
  if (notes.length < 2) {
    return { clusters: [], independentNotes: [...notes], copyNoteIds: new Set<string>() };
  }

  // Strictly partition notes by (startTick, hand) — origin and copies must sound together at same onset, same hand
  const buckets = new Map<string, T[]>();
  for (const n of notes) {
    const q = getQuantizedNote(n);
    const key = `${q.startTick}|${q.hand}`;
    const list = buckets.get(key);
    if (list) list.push(n);
    else buckets.set(key, [n]);
  }

  const allClusters: JankoCompressedCluster<T>[] = [];
  const allIndependent: T[] = [];
  const allCopyNoteIds = new Set<string>();

  // Check uniform attachments & duration within a subset
  const isUniformOccurrence = (subset: T[]): boolean => {
    if (subset.length === 0) return false;
    const first = getQuantizedNote(subset[0]);
    for (let i = 1; i < subset.length; i++) {
      const n = getQuantizedNote(subset[i]);
      if (n.durationTicks !== first.durationTicks) return false;
      if (n.tieStart !== first.tieStart || n.tieEnd !== first.tieEnd) return false;
      if (n.articulation !== first.articulation) return false;
    }
    return true;
  };

  for (const bucketNotes of buckets.values()) {
    if (bucketNotes.length < 2) {
      allIndependent.push(...bucketNotes);
      continue;
    }

    const available = [...bucketNotes].sort((a, b) => getSoundingLin(a) - getSoundingLin(b));
    const assigned = new Set<string>();

    while (true) {
      const unassigned = available.filter((n) => !assigned.has(getQuantizedNote(n).id));
      if (unassigned.length < 2) break;

      interface CandidateCluster {
        originNotes: T[];
        copyOccurrences: T[][];
        shapeOffsets: number[];
        score: number;
      }

      let bestCandidate: CandidateCluster | null = null;
      const maxShapeSize = Math.min(Math.floor(unassigned.length / 2), 6);

      // Search shape sizes descending: prefer maximal exact repeated subset
      for (let size = maxShapeSize; size >= 1; size--) {
        // Find candidate origin occurrences of this size
        const combinations: T[][] = [];
        const getCombinations = (startIdx: number, current: T[]) => {
          if (current.length === size) {
            combinations.push([...current]);
            return;
          }
          for (let i = startIdx; i < unassigned.length; i++) {
            current.push(unassigned[i]);
            getCombinations(i + 1, current);
            current.pop();
          }
        };
        getCombinations(0, []);

        for (const originCandidate of combinations) {
          if (!isUniformOccurrence(originCandidate)) continue;
          const originSorted = [...originCandidate].sort((a, b) => getSoundingLin(a) - getSoundingLin(b));
          const baseLin = getSoundingLin(originSorted[0]);
          const shapeOffsets = originSorted.map((n) => getSoundingLin(n) - baseLin);

          // Look for copy occurrences in unassigned notes at octave offsets k * 12 (k != 0)
          const unassignedWithoutOrigin = unassigned.filter(
            (n) => !originCandidate.some((o) => getQuantizedNote(o).id === getQuantizedNote(n).id)
          );

          // Group unassigned notes by pitch class / target octave
          const possibleKValues = new Set<number>();
          for (const n of unassignedWithoutOrigin) {
            const diff = getSoundingLin(n) - baseLin;
            if (diff !== 0 && diff % 12 === 0) {
              possibleKValues.add(diff / 12);
            }
          }

          const validCopies: T[][] = [];
          const sortedK = [...possibleKValues].sort((a, b) => a - b);

          for (const k of sortedK) {
            const targetPitches = shapeOffsets.map((offset) => baseLin + 12 * k + offset);
            const matchedNotes: T[] = [];
            let allFound = true;

            for (const targetPitch of targetPitches) {
              const match = unassignedWithoutOrigin.find(
                (n) =>
                  getSoundingLin(n) === targetPitch &&
                  !matchedNotes.some((m) => getQuantizedNote(m).id === getQuantizedNote(n).id) &&
                  !validCopies.some((copy) => copy.some((c) => getQuantizedNote(c).id === getQuantizedNote(n).id))
              );
              if (!match) {
                allFound = false;
                break;
              }
              matchedNotes.push(match);
            }

            if (allFound && matchedNotes.length === size && isUniformOccurrence(matchedNotes)) {
              validCopies.push(matchedNotes);
            }
          }

          if (validCopies.length > 0) {
            // Score formula: prioritize shape size, then number of copies, then lower baseLin
            const score = size * 1000 + validCopies.length * 100 - baseLin * 0.01;

            if (!bestCandidate || score > bestCandidate.score) {
              bestCandidate = {
                originNotes: originSorted,
                copyOccurrences: validCopies,
                shapeOffsets,
                score,
              };
            }
          }
        }

        // If we found a candidate at this size, don't drop to smaller shape sizes
        if (bestCandidate) break;
      }

      if (!bestCandidate) break;

      // Form the cluster
      const allOccurrences = [bestCandidate.originNotes, ...bestCandidate.copyOccurrences];
      // Normalize so lowest baseLin is origin
      allOccurrences.sort((a, b) => getSoundingLin(a[0]) - getSoundingLin(b[0]));

      const originNotes = allOccurrences[0];
      const copyOccurrences = allOccurrences.slice(1);
      const baseLin = getSoundingLin(originNotes[0]);

      const origin: JankoCompressedOccurrence<T> = {
        notes: originNotes,
        baseLin,
        octaveOffset: 0,
        durationTicks: getQuantizedNote(originNotes[0]).durationTicks,
      };

      if (originNotes.length > 0 && isPositionedNote(originNotes[0])) {
        const pNotes = originNotes as unknown as PositionedJankoNote[];
        const ys = pNotes.map((p) => p.y);
        const xs = pNotes.map((p) => p.x);
        origin.centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
        origin.yExtent = [Math.min(...ys), Math.max(...ys)];
        origin.x = Math.min(...xs);
      }

      const copies: JankoCompressedOccurrence<T>[] = copyOccurrences.map((notesGroup) => {
        const copyBase = getSoundingLin(notesGroup[0]);
        const octaveOffset = Math.round((copyBase - baseLin) / 12);
        const copyOcc: JankoCompressedOccurrence<T> = {
          notes: notesGroup,
          baseLin: copyBase,
          octaveOffset,
          durationTicks: getQuantizedNote(notesGroup[0]).durationTicks,
        };
        if (notesGroup.length > 0 && isPositionedNote(notesGroup[0])) {
          const pNotes = notesGroup as unknown as PositionedJankoNote[];
          const ys = pNotes.map((p) => p.y);
          const xs = pNotes.map((p) => p.x);
          copyOcc.centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
          copyOcc.yExtent = [Math.min(...ys), Math.max(...ys)];
          copyOcc.x = Math.min(...xs);
        }
        return copyOcc;
      });

      const allNoteIds = new Set<string>();
      const copyNoteIds = new Set<string>();

      for (const n of originNotes) {
        const id = getQuantizedNote(n).id;
        allNoteIds.add(id);
        assigned.add(id);
      }
      for (const copy of copies) {
        for (const n of copy.notes) {
          const id = getQuantizedNote(n).id;
          allNoteIds.add(id);
          copyNoteIds.add(id);
          allCopyNoteIds.add(id);
          assigned.add(id);
        }
      }

      const qFirst = getQuantizedNote(originNotes[0]);
      const clusterId = `compress-${qFirst.startTick}-${qFirst.hand}-${baseLin}`;
      allClusters.push({
        id: clusterId,
        startTick: qFirst.startTick,
        hand: qFirst.hand,
        shapeOffsets: bestCandidate.shapeOffsets,
        origin,
        copies,
        allNoteIds,
        copyNoteIds,
      });
    }

    const independentNotes = available.filter((n) => !assigned.has(getQuantizedNote(n).id));
    allIndependent.push(...independentNotes);
  }

  return { clusters: allClusters, independentNotes: allIndependent, copyNoteIds: allCopyNoteIds };
}

/**
 * Exact, lossless round-trip expansion of compressed clusters and independent notes.
 * Guarantees that display representation reproduces source events and ownership.
 */
export function expandCompressedClusters<T extends JankoCompressibleItem>(
  clusters: readonly JankoCompressedCluster<T>[],
  independentNotes: readonly T[]
): T[] {
  const result: T[] = [];
  for (const c of clusters) {
    for (const n of c.origin.notes) result.push(n);
    for (const copy of c.copies) {
      for (const n of copy.notes) result.push(n);
    }
  }
  for (const n of independentNotes) result.push(n);

  return result.sort((a, b) => {
    const qa = getQuantizedNote(a);
    const qb = getQuantizedNote(b);
    if (qa.startTick !== qb.startTick) return qa.startTick - qb.startTick;
    return getSoundingLin(qa) - getSoundingLin(qb);
  });
}

/**
 * Render duration cue glyph for an occurrence (rings, dots, or slashes).
 * Speeds existing Jánko duration vocabulary:
 * - >= 192 ticks: double-pip (2 rings)
 * - 144 ticks: pip (1 ring) + dot
 * - 96 ticks: pip (1 ring)
 * - 48 ticks: quarter spire/tick
 * - 24 ticks: eighth tick
 * - 12 ticks: 16th tick
 */
export function renderOccurrenceDurationCue(
  x: number,
  y: number,
  durationTicks: number,
  scale: number = 1.0
): string {
  const r = 1.35 * scale;
  const dotR = 1.0 * scale;
  const strokeWidth = 0.65 * scale;
  const parts: string[] = [];

  if (durationTicks >= 192) {
    // Double open ring (whole note)
    parts.push(
      `<circle class="janko-compress-dur" cx="${f(x)}" cy="${f(y - r - 0.5)}" r="${f(r)}" fill="#FFFFFF" stroke="#111111" stroke-width="${f(strokeWidth)}"/>`
    );
    parts.push(
      `<circle class="janko-compress-dur" cx="${f(x)}" cy="${f(y + r + 0.5)}" r="${f(r)}" fill="#FFFFFF" stroke="#111111" stroke-width="${f(strokeWidth)}"/>`
    );
  } else if (durationTicks === 144) {
    // Single open ring + augmentation dot (dotted half)
    parts.push(
      `<circle class="janko-compress-dur" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#FFFFFF" stroke="#111111" stroke-width="${f(strokeWidth)}"/>`
    );
    parts.push(
      `<circle class="janko-compress-dot" cx="${f(x + r + dotR + 1.5)}" cy="${f(y)}" r="${f(dotR)}" fill="#111111"/>`
    );
  } else if (durationTicks >= 96) {
    // Single open ring (half note)
    parts.push(
      `<circle class="janko-compress-dur" cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="#FFFFFF" stroke="#111111" stroke-width="${f(strokeWidth)}"/>`
    );
  } else if (durationTicks >= 48) {
    // Quarter note: plain vertical spire / tick
    parts.push(
      `<line class="janko-compress-dur" x1="${f(x)}" y1="${f(y - 3 * scale)}" x2="${f(x)}" y2="${f(y + 3 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.5)}"/>`
    );
  } else if (durationTicks >= 24) {
    // Eighth note: vertical tick + flag notch
    parts.push(
      `<line class="janko-compress-dur" x1="${f(x)}" y1="${f(y - 3 * scale)}" x2="${f(x)}" y2="${f(y + 3 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.5)}"/>`
    );
    parts.push(
      `<line class="janko-compress-flag" x1="${f(x)}" y1="${f(y - 2 * scale)}" x2="${f(x + 2.5 * scale)}" y2="${f(y - 0.5 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.2)}"/>`
    );
  } else {
    // 16th note: vertical tick + 2 flag notches
    parts.push(
      `<line class="janko-compress-dur" x1="${f(x)}" y1="${f(y - 3 * scale)}" x2="${f(x)}" y2="${f(y + 3 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.5)}"/>`
    );
    parts.push(
      `<line class="janko-compress-flag" x1="${f(x)}" y1="${f(y - 2.5 * scale)}" x2="${f(x + 2.5 * scale)}" y2="${f(y - 1.0 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.2)}"/>`
    );
    parts.push(
      `<line class="janko-compress-flag" x1="${f(x)}" y1="${f(y - 0.5 * scale)}" x2="${f(x + 2.5 * scale)}" y2="${f(y + 1.0 * scale)}" stroke="#111111" stroke-width="${f(strokeWidth * 1.2)}"/>`
    );
  }

  return parts.join('\n');
}

/**
 * Render Treatment A: Spatial Echo SVG.
 * Origin has explicit noteheads, an enclosure bracket, and a dashed structural
 * connector extending to lightweight group markers at copied registers carrying occurrence rhythm.
 */
export function renderSpatialEchoSvg(
  cluster: JankoCompressedCluster<PositionedJankoNote>,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): {
  svg: string;
  inkBox: [number, number, number, number];
  inkBoxes: [number, number, number, number][];
} {
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const wx = preset.wx;
  const hy = preset.hy;

  const originNotes = cluster.origin.notes;
  const originXs = originNotes.map((n) => n.x);
  const originYs = originNotes.map((n) => n.y);
  const minX = Math.min(...originXs);
  const minY = Math.min(...originYs) - hy;
  const maxY = Math.max(...originYs) + hy;

  const parts: string[] = [`  <g class="janko-spatial-echo" data-cluster="${cluster.id}">`];

  // 1. Origin Enclosure Bracket (on left of origin heads)
  const encX = minX - wx - 2.2;
  const capLen = 3.0;
  const encTop = minY - 1.0;
  const encBot = maxY + 1.0;

  parts.push(
    `    <!-- Origin Enclosure -->`,
    `    <path class="janko-echo-enclosure" d="M ${f(encX + capLen)} ${f(encTop)} L ${f(encX)} ${f(encTop)} L ${f(encX)} ${f(encBot)} L ${f(encX + capLen)} ${f(encBot)}" fill="none" stroke="#111111" stroke-width="0.65"/>`
  );

  // Origin duration cue attached to the enclosure
  const origCueX = encX - 4.5;
  const origCueY = (encTop + encBot) / 2;
  const origCueSvg = renderOccurrenceDurationCue(origCueX, origCueY, cluster.origin.durationTicks, 0.95);
  parts.push(origCueSvg);

  const enclosureBox: [number, number, number, number] = [
    origCueX - 2.0,
    encTop,
    encX + capLen,
    encBot,
  ];

  let globalMinX = origCueX - 2.0;
  let globalMaxX = Math.max(...originXs) + wx;
  let globalMinY = encTop;
  let globalMaxY = encBot;

  const primitiveBoxes: [number, number, number, number][] = [enclosureBox];

  // 2. Echo markers and structural connectors at copied registers
  for (const copy of cluster.copies) {
    const copyNotes = copy.notes;
    const copyYs = copyNotes.map((n) => n.y);
    const copyMinY = Math.min(...copyYs) - hy;
    const copyMaxY = Math.max(...copyYs) + hy;
    const copyCenterY = (copyMinY + copyMaxY) / 2;

    globalMinY = Math.min(globalMinY, copyMinY - 2);
    globalMaxY = Math.max(globalMaxY, copyMaxY + 2);

    // Structural connector line between origin and echo marker
    const connYStart = copy.octaveOffset > 0 ? encTop : encBot;
    const connYEnd = copy.octaveOffset > 0 ? copyMaxY + 1.0 : copyMinY - 1.0;

    parts.push(
      `    <!-- Structural Connector -->`,
      `    <line class="janko-echo-connector" x1="${f(encX)}" y1="${f(connYStart)}" x2="${f(encX)}" y2="${f(connYEnd)}" stroke="#111111" stroke-width="0.65" stroke-dasharray="3.0, 1.8"/>`
    );

    primitiveBoxes.push([
      encX - 0.5,
      Math.min(connYStart, connYEnd),
      encX + 0.5,
      Math.max(connYStart, connYEnd),
    ]);

    // Echo group marker at copied register: a lightweight non-note group glyph
    const markerLeft = encX;
    const markerRight = encX + capLen + 3.5;
    const markerTop = copyMinY - 1.0;
    const markerBot = copyMaxY + 1.0;

    const labelStr = copy.octaveOffset > 0 ? `+${copy.octaveOffset * 10}` : `-${Math.abs(copy.octaveOffset) * 10}`;
    parts.push(
      `    <!-- Echo Group Marker (Register ${labelStr}) -->`,
      `    <path class="janko-echo-marker" d="M ${f(markerRight)} ${f(markerTop)} L ${f(markerLeft)} ${f(markerTop)} L ${f(markerLeft)} ${f(markerBot)} L ${f(markerRight)} ${f(markerBot)}" fill="none" stroke="#111111" stroke-width="0.75"/>`
    );

    // Duration cue carried by the echo marker
    const cueX = markerRight + 3.0;
    const cueSvg = renderOccurrenceDurationCue(cueX, copyCenterY, copy.durationTicks, 0.95);
    parts.push(cueSvg);

    const markerBox: [number, number, number, number] = [
      markerLeft,
      markerTop,
      cueX + 6.0,
      markerBot,
    ];
    primitiveBoxes.push(markerBox);

    globalMaxX = Math.max(globalMaxX, cueX + 6.0);
  }

  parts.push('  </g>');

  const inkBox: [number, number, number, number] = [globalMinX, globalMinY, globalMaxX, globalMaxY];
  return { svg: parts.join('\n'), inkBox, inkBoxes: primitiveBoxes };
}

/**
 * Render Treatment B: Compact Coupling SVG.
 * Origin has explicit noteheads, with an adjacent bounded additive-occurrence structure (+10/+20)
 * binding distinct duration cues directly to displacement labels.
 */
export function renderCompactCouplingSvg(
  cluster: JankoCompressedCluster<PositionedJankoNote>,
  o: ResolvedJankoLayoutOptions,
  t: ResolvedJankoTokens
): {
  svg: string;
  inkBox: [number, number, number, number];
  inkBoxes: [number, number, number, number][];
} {
  const preset = getClusterSpacingPreset(o.clusterSpacing);
  const wx = preset.wx;
  const hy = preset.hy;

  const originNotes = cluster.origin.notes;
  const originXs = originNotes.map((n) => n.x);
  const originYs = originNotes.map((n) => n.y);
  const maxX = Math.max(...originXs) + wx;
  const minY = Math.min(...originYs) - hy;
  const maxY = Math.max(...originYs) + hy;
  const centerY = (minY + maxY) / 2;

  const parts: string[] = [`  <g class="janko-compact-coupling" data-cluster="${cluster.id}">`];

  // Adjacent bounded additive-occurrence badge
  const standoff = 3.2;
  const badgeX = maxX + standoff;
  const badgeW = 20.5;
  const rowH = 11.0;
  const badgeH = cluster.copies.length * rowH + 2.0;
  const badgeY = centerY - badgeH / 2;

  parts.push(
    `    <!-- Bounded Additive Coupling Structure -->`,
    `    <rect class="janko-coupling-badge" x="${f(badgeX)}" y="${f(badgeY)}" width="${f(badgeW)}" height="${f(badgeH)}" rx="1.5" ry="1.5" fill="#FFFFFF" stroke="#222222" stroke-width="0.55"/>`
  );

  // Each copy occurrence gets a clearly labeled additive displacement (+10, +20) + bound duration cue
  cluster.copies.forEach((copy, idx) => {
    const rowY = badgeY + 1.0 + idx * rowH + rowH / 2;
    // Duodecimal displacement label: 1 octave = 10, 2 octaves = 20
    const dozenalStr = copy.octaveOffset > 0 ? `+${copy.octaveOffset * 10}` : `-${Math.abs(copy.octaveOffset) * 10}`;
    const textY = rowY + 2.2;

    parts.push(
      `    <text class="janko-coupling-label" x="${f(badgeX + 2.0)}" y="${f(textY)}" font-size="5.6pt" font-family="'URW Gothic', 'Avant Garde', sans-serif" font-weight="700" fill="#111111">${dozenalStr}</text>`
    );

    // Bound duration cue inside the badge, immediately adjacent to the displacement label
    const cueX = badgeX + 14.5;
    const cueSvg = renderOccurrenceDurationCue(cueX, rowY, copy.durationTicks, 0.75);
    parts.push(cueSvg);
  });

  parts.push('  </g>');

  const badgeBox: [number, number, number, number] = [
    badgeX,
    badgeY,
    badgeX + badgeW,
    badgeY + badgeH,
  ];

  const inkBox: [number, number, number, number] = [
    Math.min(...originXs) - wx,
    Math.min(minY, badgeY),
    badgeX + badgeW,
    Math.max(maxY, badgeY + badgeH),
  ];

  return { svg: parts.join('\n'), inkBox, inkBoxes: [badgeBox] };
}

/**
 * Check whether compression ink boxes collide with obstacles (barlines, independent noteheads, rests).
 */
export function checkCompressionInkCollisions(
  cluster: JankoCompressedCluster<PositionedJankoNote>,
  primitives: readonly [number, number, number, number][],
  barlineXs: readonly number[],
  independentNotes: readonly PositionedJankoNote[],
  rests: readonly any[],
  minClearance: number = 0.8
): { collides: boolean; obstacle?: string; details?: string } {
  for (const [minX, minY, maxX, maxY] of primitives) {
    // 1. Check barlines
    for (const bx of barlineXs) {
      if (bx >= minX - minClearance && bx <= maxX + minClearance) {
        return {
          collides: true,
          obstacle: 'barline',
          details: `Primitive [${minX.toFixed(1)}, ${maxX.toFixed(1)}] touches barline at x=${bx.toFixed(1)}`,
        };
      }
    }

    // 2. Check independent noteheads
    for (const n of independentNotes) {
      const noteId = n.note?.id ?? (n as any).id;
      if (cluster.allNoteIds.has(noteId)) continue;
      const nx = n.x;
      const ny = n.y;
      if (nx === undefined || ny === undefined) continue;
      const wx = 2.53;
      const hy = 3.46;
      const overlapsX = minX - minClearance <= nx + wx && maxX + minClearance >= nx - wx;
      const overlapsY = minY - minClearance <= ny + hy && maxY + minClearance >= ny - hy;
      if (overlapsX && overlapsY) {
        return {
          collides: true,
          obstacle: 'notehead',
          details: `Primitive touches notehead ${noteId} at (${nx.toFixed(1)}, ${ny.toFixed(1)})`,
        };
      }
    }

    // 3. Check rests
    for (const r of rests) {
      if (r && typeof r.x === 'number' && typeof r.y === 'number') {
        const rx = r.x;
        const ry = r.y;
        const rw = 4.0;
        const rh = 6.0;
        const overlapsX = minX - minClearance <= rx + rw && maxX + minClearance >= rx - rw;
        const overlapsY = minY - minClearance <= ry + rh && maxY + minClearance >= ry - rh;
        if (overlapsX && overlapsY) {
          return {
            collides: true,
            obstacle: 'rest',
            details: `Primitive touches rest at (${rx.toFixed(1)}, ${ry.toFixed(1)})`,
          };
        }
      }
    }
  }

  return { collides: false };
}
