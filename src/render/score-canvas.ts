import { QuantizedGridScore } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { getCanonicalSyllable } from '../model/phonetics';
import {
  RenderOptions,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
  getStaffLineGeometry,
  getParityShape,
} from './types';
import { getNoteColor, getSubdivisionColor, getDurationClassColor, getLogarithmicDurationColor } from './colors';

export interface ScoreDimensions {
  width: number;
  height: number;
  minPitch: number;
  maxPitch: number;
  totalTicks: number;
}

export function calculateScoreDimensions(
  score: QuantizedGridScore,
  options: RenderOptions
): ScoreDimensions {
  let minPitch = 48; // Default 0:4
  let maxPitch = 72; // Default 0:6

  if (score.notes.length > 0) {
    const indices = score.notes.map(n => linearIndex(n.pitch));
    minPitch = Math.min(...indices) - 2;
    maxPitch = Math.max(...indices) + 2;
  }

  // Ensure whole-tone boundary
  minPitch = Math.floor(minPitch / 2) * 2;
  maxPitch = Math.ceil(maxPitch / 2) * 2;

  const pitchSpan = maxPitch - minPitch + 1;
  const timeLength = score.totalTicks * options.pixelsPerTick;
  const pitchBreadth = pitchSpan * options.pixelsPerSemitone;

  if (options.orientation === 'horizontal') {
    return {
      width: Math.max(800, Math.ceil(timeLength + 140)),
      height: Math.max(350, Math.ceil(pitchBreadth + 80)),
      minPitch,
      maxPitch,
      totalTicks: score.totalTicks,
    };
  } else {
    // Vertical timeline: Pitch is horizontal, Time is vertical
    return {
      width: Math.max(600, Math.ceil(pitchBreadth + 100)),
      height: Math.max(800, Math.ceil(timeLength + 140)),
      minPitch,
      maxPitch,
      totalTicks: score.totalTicks,
    };
  }
}

/**
 * Pure mathematical Canvas renderer for QuantizedGridScore.
 * Strict pitch-black (#000000) minimal aesthetic, zero diatonic letter names,
 * dynamic Staff Topography and Notehead Morphology variation explorer.
 */
export function renderScoreToCanvas(
  ctx: CanvasRenderingContext2D,
  score: QuantizedGridScore,
  options: RenderOptions
): void {
  const dims = calculateScoreDimensions(score, options);
  const { width, height, minPitch, maxPitch } = dims;

  // 1. Pitch-Black Background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  const isHoriz = options.orientation === 'horizontal';
  const paddingStart = 60;
  const paddingPitch = 40;

  const normStaffStyle = normalizeStaffStyle(options.staffStyle || options.notationStyle);
  const normNoteheadMorph = normalizeNoteheadMorphology(options.noteheadMorphology || options.noteheadStyle);

  // Convert (tick, linearPitch) to canvas (x, y)
  const getCoords = (tick: number, lPitch: number): { x: number; y: number } => {
    if (isHoriz) {
      const x = paddingStart + tick * options.pixelsPerTick;
      const y = height - paddingPitch - (lPitch - minPitch) * options.pixelsPerSemitone;
      return { x, y };
    } else {
      const x = paddingPitch + (lPitch - minPitch) * options.pixelsPerSemitone;
      const y = paddingStart + tick * options.pixelsPerTick;
      return { x, y };
    }
  };

  // 2. Draw Grid Background / Staff Lines
  ctx.save();

  const isPianoRoll = options.viewMode === 'pianoroll';

  if (isPianoRoll) {
    const isBlackKey = (pc: number) => [1, 3, 6, 8, 10].includes(pc);
    const semitoneWidth = options.pixelsPerSemitone;

    // 2a. Fill only black key lanes (white key lanes remain pitch-black canvas background)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      if (isBlackKey(pc)) {
        if (isHoriz) {
          const y = height - paddingPitch - (p - minPitch) * semitoneWidth;
          ctx.fillRect(paddingStart, y - semitoneWidth / 2, dims.width - paddingStart, semitoneWidth);
        } else {
          const x = paddingPitch + (p - minPitch) * semitoneWidth;
          ctx.fillRect(x - semitoneWidth / 2, paddingStart, semitoneWidth, dims.height - paddingStart);
        }
      }
    }

    // 2b. Batched chromatic lane separator lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      if (pc !== 0) {
        if (isHoriz) {
          const y = height - paddingPitch - (p - minPitch) * semitoneWidth;
          ctx.moveTo(paddingStart, y - semitoneWidth / 2);
          ctx.lineTo(dims.width, y - semitoneWidth / 2);
        } else {
          const x = paddingPitch + (p - minPitch) * semitoneWidth;
          ctx.moveTo(x - semitoneWidth / 2, paddingStart);
          ctx.lineTo(x - semitoneWidth / 2, dims.height);
        }
      }
    }
    ctx.stroke();

    // 2c. Batched octave boundary lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (let p = minPitch; p <= maxPitch; p++) {
      const pc = ((p % 12) + 12) % 12;
      if (pc === 0 && p !== 48) {
        if (isHoriz) {
          const y = height - paddingPitch - (p - minPitch) * semitoneWidth;
          ctx.moveTo(paddingStart, y - semitoneWidth / 2);
          ctx.lineTo(dims.width, y - semitoneWidth / 2);
        } else {
          const x = paddingPitch + (p - minPitch) * semitoneWidth;
          ctx.moveTo(x - semitoneWidth / 2, paddingStart);
          ctx.lineTo(x - semitoneWidth / 2, dims.height);
        }
      }
    }
    ctx.stroke();

    // 2d. Middle C (C4 / m3) prominent amber axis
    if (minPitch <= 48 && maxPitch >= 48) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (isHoriz) {
        const y = height - paddingPitch - (48 - minPitch) * semitoneWidth;
        ctx.moveTo(paddingStart, y - semitoneWidth / 2);
        ctx.lineTo(dims.width, y - semitoneWidth / 2);
      } else {
        const x = paddingPitch + (48 - minPitch) * semitoneWidth;
        ctx.moveTo(x - semitoneWidth / 2, paddingStart);
        ctx.lineTo(x - semitoneWidth / 2, dims.height);
      }
      ctx.stroke();
    }

    // 2e. Piano Keyboard Header (pre-allocate active pitches efficiently)
    const activePitchSet = new Set<number>();
    for (let i = 0; i < score.notes.length; i++) {
      const n = score.notes[i];
      if (options.currentTick >= n.startTick && options.currentTick < n.startTick + n.durationTicks) {
        activePitchSet.add(linearIndex(n.pitch));
      }
    }

    if (!isHoriz) {
      // Vertical timeline keyboard at top margin
      const keyH = paddingStart - 8;
      const bkH = keyH * 0.62;

      // White keys
      for (let p = minPitch; p <= maxPitch; p++) {
        const pc = ((p % 12) + 12) % 12;
        if (!isBlackKey(pc)) {
          const x = paddingPitch + (p - minPitch) * semitoneWidth;
          const isActive = activePitchSet.has(p);
          ctx.fillStyle = isActive ? '#F59E0B' : '#E5E7EB';
          ctx.fillRect(x - semitoneWidth / 2 + 0.5, 4, semitoneWidth - 1, keyH);
          ctx.strokeStyle = '#4B5563';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x - semitoneWidth / 2 + 0.5, 4, semitoneWidth - 1, keyH);

          if (pc === 0) {
            const oct = Math.floor(p / 12);
            ctx.fillStyle = isActive ? '#000000' : '#4B5563';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`C${oct}`, x, keyH + 2);
          }
        }
      }

      // Black keys
      for (let p = minPitch; p <= maxPitch; p++) {
        const pc = ((p % 12) + 12) % 12;
        if (isBlackKey(pc)) {
          const x = paddingPitch + (p - minPitch) * semitoneWidth;
          const isActive = activePitchSet.has(p);
          const bkW = Math.max(4, semitoneWidth * 0.75);
          ctx.fillStyle = isActive ? '#D97706' : '#111827';
          ctx.fillRect(x - bkW / 2, 4, bkW, bkH);
          ctx.strokeStyle = '#6B7280';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(x - bkW / 2, 4, bkW, bkH);
        }
      }
    } else {
      // Horizontal timeline keyboard at left margin
      const keyW = paddingStart - 8;
      const bkW = keyW * 0.62;

      // White keys
      for (let p = minPitch; p <= maxPitch; p++) {
        const pc = ((p % 12) + 12) % 12;
        if (!isBlackKey(pc)) {
          const y = height - paddingPitch - (p - minPitch) * semitoneWidth;
          const isActive = activePitchSet.has(p);
          ctx.fillStyle = isActive ? '#F59E0B' : '#E5E7EB';
          ctx.fillRect(4, y - semitoneWidth / 2 + 0.5, keyW, semitoneWidth - 1);
          ctx.strokeStyle = '#4B5563';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(4, y - semitoneWidth / 2 + 0.5, keyW, semitoneWidth - 1);

          if (pc === 0) {
            const oct = Math.floor(p / 12);
            ctx.fillStyle = isActive ? '#000000' : '#4B5563';
            ctx.font = 'bold 8px sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`C${oct}`, keyW, y);
          }
        }
      }

      // Black keys
      for (let p = minPitch; p <= maxPitch; p++) {
        const pc = ((p % 12) + 12) % 12;
        if (isBlackKey(pc)) {
          const y = height - paddingPitch - (p - minPitch) * semitoneWidth;
          const isActive = activePitchSet.has(p);
          const bkH = Math.max(4, semitoneWidth * 0.75);
          ctx.fillStyle = isActive ? '#D97706' : '#111827';
          ctx.fillRect(4, y - bkH / 2, bkW, bkH);
          ctx.strokeStyle = '#6B7280';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(4, y - bkH / 2, bkW, bkH);
        }
      }
    }
  } else {
    // 2a. Octave Ribbons Shading (if octave-ribbons)
    if (normStaffStyle === 'octave-ribbons') {
    const minOct = Math.floor(minPitch / 12);
    const maxOct = Math.floor(maxPitch / 12);
    for (let oct = minOct; oct <= maxOct; oct++) {
      if (Math.abs(oct) % 2 === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
        if (isHoriz) {
          const pBottom = oct * 12 - 0.5;
          const pTop = (oct + 1) * 12 - 0.5;
          const yBottom = height - paddingPitch - (pBottom - minPitch) * options.pixelsPerSemitone;
          const yTop = height - paddingPitch - (pTop - minPitch) * options.pixelsPerSemitone;
          ctx.fillRect(paddingStart, yTop, dims.width - paddingStart, yBottom - yTop);
        } else {
          const pLeft = oct * 12 - 0.5;
          const pRight = (oct + 1) * 12 - 0.5;
          const xLeft = paddingPitch + (pLeft - minPitch) * options.pixelsPerSemitone;
          const xRight = paddingPitch + (pRight - minPitch) * options.pixelsPerSemitone;
          ctx.fillRect(xLeft, paddingStart, xRight - xLeft, dims.height - paddingStart);
        }
      }
    }
  }

  // 2b. Pitch Lines & Labels
  for (let p = minPitch; p <= maxPitch; p++) {
    const pc = ((p % 12) + 12) % 12;
    const oct = Math.floor(p / 12);
    const parity = wholeToneParity(p);
    const lineGeom = getStaffLineGeometry(pc, normStaffStyle);

    if (isHoriz) {
      const y = height - paddingPitch - (p - minPitch) * options.pixelsPerSemitone;

      // Band shading in chromatic grid mode
      if (normStaffStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0)';
        ctx.fillRect(
          paddingStart,
          y - options.pixelsPerSemitone / 2,
          dims.width - paddingStart,
          options.pixelsPerSemitone
        );
      }

      if (lineGeom.isLine) {
        ctx.beginPath();
        ctx.strokeStyle = lineGeom.color;
        ctx.lineWidth = lineGeom.lineWidth;
        if (lineGeom.isDashed && lineGeom.dashArray) {
          ctx.setLineDash(lineGeom.dashArray);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(paddingStart, y);
        ctx.lineTo(dims.width, y);
        ctx.stroke();
      }

      // Pitch Coordinate label on left margin: 1-based (noteNum:octave), with m${oct - 1} at octave boundaries
      const isOctave0 = pc === 0;
      let textColor = '#666666';
      if (isOctave0) textColor = '#FFFFFF';

      ctx.fillStyle = textColor;
      ctx.font = isOctave0 ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const isAfterC = pc >= 9;
      const displayOct = isAfterC ? oct : Math.max(0, oct - 1);
      const label = isOctave0 ? `m${displayOct}` : `${pc + 1}:${displayOct}`;
      ctx.fillText(label, paddingStart - 8, y);
    } else {
      // Vertical timeline
      const x = paddingPitch + (p - minPitch) * options.pixelsPerSemitone;

      if (normStaffStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0)';
        ctx.fillRect(
          x - options.pixelsPerSemitone / 2,
          paddingStart,
          options.pixelsPerSemitone,
          dims.height - paddingStart
        );
      }

      if (lineGeom.isLine) {
        const isCenterM3 = pc === 0 && Math.max(0, oct - 1) === 3;
        ctx.beginPath();
        ctx.strokeStyle = isCenterM3 ? 'rgba(255, 255, 255, 0.95)' : lineGeom.color;
        ctx.lineWidth = isCenterM3 ? Math.max(1.8, lineGeom.lineWidth * 1.5) : lineGeom.lineWidth;
        if (lineGeom.isDashed && lineGeom.dashArray) {
          ctx.setLineDash(lineGeom.dashArray);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(x, paddingStart);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }

      // Pitch class label along top margin: strictly octave markers m${oct - 1} in tritone-split, zero 5 and 9 at top
      const isOctave0 = pc === 0;
      if (isOctave0) {
        const displayOct = Math.max(0, oct - 1);
        const isCenterM3 = displayOct === 3;
        ctx.fillStyle = isCenterM3 ? '#F59E0B' : '#FFFFFF';
        ctx.font = isCenterM3 ? 'bold 12px monospace' : 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`m${displayOct}`, x, paddingStart - 6);
      } else if (normStaffStyle !== 'tritone-split') {
        ctx.fillStyle = '#666666';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(pc + 1), x, paddingStart - 6);
      }
    }
  }
  }
  ctx.setLineDash([]);
  ctx.restore();

  // 3. Barlines & Measure Numbers
  if (options.showBarlines) {
    ctx.save();
    for (const bar of score.barlines) {
      ctx.beginPath();
      ctx.strokeStyle =
        bar.type === 'double' || bar.type === 'final'
          ? 'rgba(255, 255, 255, 0.7)'
          : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = bar.type === 'double' ? 2 : 1;

      if (isHoriz) {
        const x = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(x, 15);
        ctx.lineTo(x, height - 15);
        ctx.stroke();

        ctx.fillStyle = '#888888';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`M${bar.barNumber}`, x + 4, 18);
      } else {
        const y = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(15, y);
        ctx.lineTo(width - 15, y);
        ctx.stroke();

        ctx.fillStyle = '#888888';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`M${bar.barNumber}`, 18, y - 4);
      }
    }
    ctx.restore();
  }

  // 4. Hand-Crossing Shading Overlays
  if (options.showHandCrossings && score.handCrossings && score.handCrossings.length > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(244, 114, 182, 0.12)';
    for (const hc of score.handCrossings) {
      if (isHoriz) {
        const x1 = paddingStart + hc.tick * options.pixelsPerTick;
        const x2 = x1 + hc.durationTicks * options.pixelsPerTick;
        ctx.fillRect(x1, 15, x2 - x1, height - 30);

        ctx.fillStyle = '#F472B6';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('LH / RH Cross', x1 + 4, height - 18);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.12)';
      } else {
        const y1 = paddingStart + hc.tick * options.pixelsPerTick;
        const y2 = y1 + hc.durationTicks * options.pixelsPerTick;
        ctx.fillRect(15, y1, width - 30, y2 - y1);

        ctx.fillStyle = '#F472B6';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('LH/RH Cross', width - 20, y1 + 14);
        ctx.fillStyle = 'rgba(244, 114, 182, 0.12)';
      }
    }
    ctx.restore();
  }

  // 5. Notes Rendering with selected morphology and Unified Duration Lattice
  ctx.save();
  const tauRef = score.gridResolution || 12;

  for (const note of score.notes) {
    const lPitch = linearIndex(note.pitch);
    const isActive =
      options.currentTick >= note.startTick &&
      options.currentTick < note.startTick + note.durationTicks;
    const isSelected = options.selectedNoteId === note.id;
    const isHighlighted = isActive || isSelected;
    const noteColor = options.colorMode === 'ddr-subdivision'
      ? getSubdivisionColor(note.startTick, score.ticksPerBeat, isHighlighted)
      : options.colorMode === 'duration-class'
      ? getLogarithmicDurationColor(note.durationTicks, tauRef, isHighlighted)
      : getNoteColor(
          note.pitch,
          note.hand,
          options.colorMode,
          isHighlighted,
          note.startTick,
          score.ticksPerBeat,
          note.durationTicks
        );
    const strokeColor = isHighlighted ? '#FACC15' : '#000000';
    const pc = note.pitch.pitchClass;
    const isHold = note.durationTicks > tauRef;

    if (isPianoRoll) {
      const isSounding =
        options.currentTick >= note.startTick &&
        options.currentTick < note.startTick + note.durationTicks;
      const hand = note.hand ?? (lPitch >= 60 ? 'RH' : 'LH');

      let blockFill = hand === 'RH' ? '#D97706' : '#2563EB';
      let headerFill = hand === 'RH' ? '#FBBF24' : '#60A5FA';
      let strokeColor = hand === 'RH' ? '#F59E0B' : '#3B82F6';

      if (isHighlighted || isSounding) {
        blockFill = '#F59E0B';
        headerFill = '#FEF08A';
        strokeColor = '#FFFFFF';
      }

      if (isHoriz) {
        const { x, y } = getCoords(note.startTick, lPitch);
        const blockW = Math.max(3, note.durationTicks * options.pixelsPerTick);
        const blockH = Math.max(4, options.pixelsPerSemitone - 2);
        const bx = x;
        const by = y - blockH / 2;

        ctx.fillStyle = blockFill;
        ctx.fillRect(bx, by, blockW, blockH);

        ctx.fillStyle = headerFill;
        ctx.fillRect(bx, by, Math.min(blockW, 3), blockH);
      } else {
        const { x, y } = getCoords(note.startTick, lPitch);
        const blockW = Math.max(4, options.pixelsPerSemitone - 2);
        const blockH = Math.max(3, note.durationTicks * options.pixelsPerTick);
        const bx = x - blockW / 2;
        const by = y;

        ctx.fillStyle = blockFill;
        ctx.fillRect(bx, by, blockW, blockH);

        ctx.fillStyle = headerFill;
        ctx.fillRect(bx, by, blockW, Math.min(blockH, 3));
      }
      continue;
    }

    if (isHoriz) {
      const { x, y } = getCoords(note.startTick, lPitch);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      // Proportional hold line/tail down the timeline for d > tauRef
      if (isHold) {
        const holdLength = note.durationTicks * options.pixelsPerTick;
        const ribbonWidth = 1.5;
        ctx.fillStyle = noteColor;
        ctx.beginPath();
        ctx.roundRect(x, y - ribbonWidth / 2, holdLength, ribbonWidth, 0.75);
        ctx.fill();
      }

      // Notehead centered directly on exact onset coordinate (x, y)
      const cx = x;
      const cy = y;

      // Render notehead morphology with line knockout
      renderNotehead(
        ctx,
        normNoteheadMorph,
        pc,
        cx,
        cy,
        noteHeight,
        noteColor,
        isHighlighted,
        strokeColor,
        false
      );

      // Articulation marker
      if (note.articulation === 'staccato') {
        ctx.fillStyle = noteColor;
        ctx.beginPath();
        ctx.arc(cx, cy - noteHeight / 2 - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (note.articulation === 'accent') {
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('>', cx, cy - noteHeight / 2 - 4);
      }
    } else {
      // Vertical timeline
      const { x, y } = getCoords(note.startTick, lPitch);
      const noteWidth = Math.max(10, options.pixelsPerSemitone);

      // Proportional thin hold line/tail down the timeline for d > tauRef
      if (isHold) {
        const holdHeight = note.durationTicks * options.pixelsPerTick;
        const ribbonWidth = 1.5;
        ctx.fillStyle = noteColor;
        ctx.beginPath();
        ctx.roundRect(x - ribbonWidth / 2, y, ribbonWidth, holdHeight, 0.75);
        ctx.fill();
      }

      // Notehead centered directly on exact onset coordinate (x, y)
      const cx = x;
      const cy = y;

      // Klavar lateral stems for hand assignment:
      // Right Hand (RH) -> horizontal stem pointing Right (->)
      // Left Hand (LH) -> horizontal stem pointing Left (<-)
      const hand = note.hand ?? (lPitch >= 60 ? 'RH' : 'LH');
      const stemLength = Math.max(16, options.pixelsPerSemitone * 1.1);
      const stemEndX = hand === 'RH' ? cx + stemLength : cx - stemLength;

      ctx.beginPath();
      ctx.strokeStyle = isHighlighted ? '#FACC15' : noteColor;
      ctx.lineWidth = 0.8;
      ctx.moveTo(cx, cy);
      ctx.lineTo(stemEndX, cy);
      ctx.stroke();

      renderNotehead(
        ctx,
        normNoteheadMorph,
        pc,
        cx,
        cy,
        noteWidth,
        noteColor,
        isHighlighted,
        strokeColor,
        true
      );

      if (note.articulation === 'staccato') {
        ctx.fillStyle = noteColor;
        ctx.beginPath();
        ctx.arc(cx + noteWidth / 2 + 4, cy, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (note.articulation === 'accent') {
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('>', cx + noteWidth / 2 + 4, cy);
      }
    }
  }
  ctx.restore();

  // 6. Playhead Indicator
  ctx.save();
  const playheadCoord = paddingStart + options.currentTick * options.pixelsPerTick;

  ctx.beginPath();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;

  if (isHoriz) {
    ctx.moveTo(playheadCoord, 0);
    ctx.lineTo(playheadCoord, height);
  } else {
    ctx.moveTo(0, playheadCoord);
    ctx.lineTo(width, playheadCoord);
  }
  ctx.stroke();

  // Minimal triangle marker
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  if (isHoriz) {
    ctx.moveTo(playheadCoord - 5, 0);
    ctx.lineTo(playheadCoord + 5, 0);
    ctx.lineTo(playheadCoord, 8);
  } else {
    ctx.moveTo(0, playheadCoord - 5);
    ctx.lineTo(0, playheadCoord + 5);
    ctx.lineTo(8, playheadCoord);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Renders individual notehead according to NoteheadMorphology with crisp line knockout.
 */
function renderNotehead(
  ctx: CanvasRenderingContext2D,
  morphology: 'classic-oval' | 'row-parity-shape' | 'phonetic' | 'numerical' | 'minimal-dot' | 'rectangle-square' | 'square-ellipse' | 'square-triangle',
  pitchClass: number,
  cx: number,
  cy: number,
  baseSize: number,
  fillColor: string,
  isActive: boolean,
  strokeColor: string,
  isVertical: boolean
): void {
  const headColor = isActive
    ? (fillColor === '#FEF08A' || fillColor === '#FFFFFF' ? fillColor : '#FDE047')
    : fillColor;

  switch (morphology) {
    case 'classic-oval': {
      // Tilted elliptical notehead with crisp knockout
      const rx = Math.max(6, baseSize * 0.7);
      const ry = Math.max(4.2, baseSize * 0.46);
      const tiltAngle = isVertical ? 0.38 : -0.38; // ~22 degrees tilt

      // Knockout line-masking
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 2.5, ry + 2.5, tiltAngle, 0, Math.PI * 2);
      ctx.fill();

      // Notehead fill
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, tiltAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      break;
    }

    case 'row-parity-shape': {
      const parityShape = getParityShape(pitchClass);
      // Optical balance with maximum geometric contrast (Oval vs Crisp Brick):
      // Row 0 (Lines, Even PC): Smooth horizontal oval (continuous curvature, zero straight edges)
      // Row 1 (Spaces, Odd PC): Crisp rectangular brick (four 90° corners, flat edges parallel to lines)
      //
      // In vertical mode (time is Y, pitch is X):
      // - Oval: rx = Math.max(6.5, baseSize * 0.65), ry = Math.max(4.2, baseSize * 0.42)
      // - Brick: width = Math.max(11.0, baseSize * 1.10), height = Math.max(7.8, baseSize * 0.78)
      //
      // In horizontal mode (time is X, pitch is Y):
      // - Oval: rx = Math.max(4.2, baseSize * 0.42), ry = Math.max(6.5, baseSize * 0.65)
      // - Brick: width = Math.max(7.8, baseSize * 0.78), height = Math.max(11.0, baseSize * 1.10)
      //
      // Optical areas match within 0.05%:
      //   Oval area: pi * 0.65 * 0.42 * baseSize^2 ≈ 0.8576 * baseSize^2
      //   Brick area: 1.10 * 0.78 * baseSize^2 ≈ 0.8580 * baseSize^2
      const pitchRadius = Math.max(6.5, baseSize * 0.65);
      const timeRadius = Math.max(4.2, baseSize * 0.42);
      const rx = isVertical ? pitchRadius : timeRadius;
      const ry = isVertical ? timeRadius : pitchRadius;

      const pitchBrick = Math.max(11.0, baseSize * 1.10);
      const timeBrick = Math.max(7.8, baseSize * 0.78);
      const bw = isVertical ? pitchBrick : timeBrick;
      const bh = isVertical ? timeBrick : pitchBrick;

      if (parityShape === 'disc') {
        // Row 0: Even pitch classes on lines -> Oval sitting cleanly on staff line (zero external shield)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Row 1: Odd pitch classes in spaces -> Crisp Rectangular Brick filling the slot
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 1.2);
        ctx.fill();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, 1.2);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      break;
    }

    case 'phonetic': {
      // 12-TET monosyllabic tokens (Ma..Ki)
      const syllable = getCanonicalSyllable(pitchClass);
      const pw = Math.max(22, baseSize * 1.85);
      const ph = Math.max(12, baseSize + 2);

      // Knockout pill
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx - (pw + 4) / 2, cy - (ph + 4) / 2, pw + 4, ph + 4, 4);
      ctx.fill();

      // Notehead pill
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 3.5);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Text label
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(syllable, cx, cy);
      break;
    }

    case 'numerical': {
      // 1-based note numbers 1..12
      const noteNum = pitchClass + 1;
      const isTwoDigit = noteNum >= 10;
      const pw = isTwoDigit ? 18 : 14;
      const ph = Math.max(12, baseSize + 1);

      // Knockout
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.roundRect(cx - (pw + 4) / 2, cy - (ph + 4) / 2, pw + 4, ph + 4, 4);
      ctx.fill();

      // Shape
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, 3.5);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Number text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(noteNum), cx, cy);
      break;
    }

    case 'minimal-dot': {
      // Crisp dot with line knockout, time-axis compressed when vertical
      const rx = isVertical ? Math.max(3.8, baseSize * 0.40) : Math.max(2.4, baseSize * 0.25);
      const ry = isVertical ? Math.max(2.4, baseSize * 0.25) : Math.max(3.8, baseSize * 0.40);

      // Knockout
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx + 2.5, ry + 2.0, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dot fill
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      break;
    }

    case 'rectangle-square':
    case 'square-ellipse':
    case 'square-triangle': {
      const isRow0 = (pitchClass % 2 === 0); // Row 0 = even PC = notes 1, 3, 5, 7, 9, 11
      // Vertically squished square: width fills semitone lane for cluster tiling, height squished vertically
      const nw = Math.max(11.0, baseSize);
      const nh = Math.max(8.2, baseSize * 0.75);
      const sw = isVertical ? nw : nh;
      const sh = isVertical ? nh : nw;

      // Knockout line-masking (along time axis without lateral bleed into cluster neighbors)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      if (isVertical) {
        ctx.roundRect(cx - sw / 2, cy - (sh + 2) / 2, sw, sh + 2, 1.0);
      } else {
        ctx.roundRect(cx - (sw + 2) / 2, cy - sh / 2, sw + 2, sh, 1.0);
      }
      ctx.fill();

      if (isRow0) {
        // Row 0: Full (Solid) squished square
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.roundRect(cx - sw / 2, cy - sh / 2, sw, sh, 1.5);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Row 1: Empty (Hollow) squished square
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(cx - sw / 2, cy - sh / 2, sw, sh, 1.5);
        ctx.fill();
        ctx.strokeStyle = headColor;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
      break;
    }
  }
}

