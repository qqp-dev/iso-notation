import { QuantizedGridScore } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { getCanonicalSyllable } from '../model/phonetics';
import {
  RenderOptions,
  normalizeStaffStyle,
  normalizeNoteheadMorphology,
  getStaffLineGeometry,
  getParityShape,
  DUODECIMAL_DIGITS,
} from './types';
import { getNoteColor, getSubdivisionColor, getDurationClassColor, getLogarithmicDurationColor } from './colors';
import { subtractInterval } from './print-layout';

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
  let minPitch = 24; // Default m1 (C2)
  let maxPitch = 72; // Default m5 (C6)

  if (score.notes.length > 0) {
    const indices = score.notes.map(n => linearIndex(n.pitch));
    const minNote = Math.min(...indices);
    const maxNote = Math.max(...indices);
    if (minNote < minPitch) {
      minPitch = Math.floor((minNote - 2) / 12) * 12;
    }
    if (maxNote > maxPitch + 4) {
      maxPitch = Math.ceil((maxNote + 2) / 12) * 12;
    }
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

    // 2d. Middle C (C4 / o3) prominent amber axis
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
      ctx.font = isOctave0 ? 'italic bold 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const isAfterC = pc >= 9;
      const displayOct = isAfterC ? oct : Math.max(0, oct - 1);
      const label = isOctave0 ? `o${displayOct}` : `${pc + 1}:${displayOct}`;
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
        const isCenterO3 = pc === 0 && Math.max(0, oct - 1) === 3;
        ctx.beginPath();
        ctx.strokeStyle = isCenterO3 ? 'rgba(255, 255, 255, 0.95)' : lineGeom.color;
        ctx.lineWidth = isCenterO3 ? 2.0 : (pc === 0 ? 0.9 : lineGeom.lineWidth);
        if (lineGeom.isDashed && lineGeom.dashArray) {
          ctx.setLineDash(lineGeom.dashArray);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(x, paddingStart);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }

      // Pitch class label along top margin: strictly octave markers o${oct - 1} in tritone-split, zero 5 and 9 at top
      const isOctave0 = pc === 0;
      if (isOctave0) {
        const displayOct = Math.max(0, oct - 1);
        if (displayOct === 2 || displayOct === 4) {
          // Drop o2 and o4 to declutter header landmarks
        } else {
          const isCenterO3 = displayOct === 3;
          ctx.fillStyle = isCenterO3 ? '#F59E0B' : '#FFFFFF';
          ctx.font = 'italic bold 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(`o${displayOct}`, x, paddingStart - 6);
        }
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

  // 2c. Local Dashed Outlier Staff Lines for notes extending past octave boundaries
  const ticksPerBeat = score.ticksPerBeat || 48;
  const numBeats = score.timeSignatures?.[0]?.numerator || 3;
  const ticksPerMeasure = ticksPerBeat * numBeats;
  const totalMeasures = score.barlines && score.barlines.length > 0
    ? score.barlines.length
    : Math.max(1, Math.ceil(score.totalTicks / ticksPerMeasure));

  for (let i = 0; i < totalMeasures; i++) {
    const mStartTick = score.barlines && score.barlines[i] ? score.barlines[i].tick : i * ticksPerMeasure;
    const mEndTick = score.barlines && score.barlines[i + 1] ? score.barlines[i + 1].tick : (mStartTick + ticksPerMeasure);

    const measureNotes = score.notes.filter(
      n => n.startTick >= mStartTick && n.startTick < mEndTick
    );

    const outlierHigh = measureNotes.filter(n => linearIndex(n.pitch) > maxPitch);
    if (outlierHigh.length > 0) {
      const maxOutlierPitch = Math.max(...outlierHigh.map(n => linearIndex(n.pitch)));
      for (let p = maxPitch + 1; ; p++) {
        const geom = getStaffLineGeometry(p, normStaffStyle);
        if (geom.isLine) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = geom.color;
          ctx.lineWidth = geom.lineWidth;
          if (geom.isDashed && geom.dashArray) {
            ctx.setLineDash(geom.dashArray);
          } else {
            ctx.setLineDash([]);
          }
          if (isHoriz) {
            const y = height - paddingPitch - (p - minPitch) * options.pixelsPerSemitone;
            const x1 = paddingStart + mStartTick * options.pixelsPerTick;
            const x2 = paddingStart + mEndTick * options.pixelsPerTick;
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
          } else {
            const x = paddingPitch + (p - minPitch) * options.pixelsPerSemitone;
            const y1 = paddingStart + mStartTick * options.pixelsPerTick;
            const y2 = paddingStart + mEndTick * options.pixelsPerTick;
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
          }
          ctx.stroke();
          ctx.restore();
          if (p >= maxOutlierPitch) break;
        }
      }
    }

    const outlierLow = measureNotes.filter(n => linearIndex(n.pitch) < minPitch);
    if (outlierLow.length > 0) {
      const minOutlierPitch = Math.min(...outlierLow.map(n => linearIndex(n.pitch)));
      for (let p = minPitch - 1; ; p--) {
        const geom = getStaffLineGeometry(p, normStaffStyle);
        if (geom.isLine) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = geom.color;
          ctx.lineWidth = geom.lineWidth;
          if (geom.isDashed && geom.dashArray) {
            ctx.setLineDash(geom.dashArray);
          } else {
            ctx.setLineDash([]);
          }
          if (isHoriz) {
            const y = height - paddingPitch - (p - minPitch) * options.pixelsPerSemitone;
            const x1 = paddingStart + mStartTick * options.pixelsPerTick;
            const x2 = paddingStart + mEndTick * options.pixelsPerTick;
            ctx.moveTo(x1, y);
            ctx.lineTo(x2, y);
          } else {
            const x = paddingPitch + (p - minPitch) * options.pixelsPerSemitone;
            const y1 = paddingStart + mStartTick * options.pixelsPerTick;
            const y2 = paddingStart + mEndTick * options.pixelsPerTick;
            ctx.moveTo(x, y1);
            ctx.lineTo(x, y2);
          }
          ctx.stroke();
          ctx.restore();
          if (p <= minOutlierPitch) break;
        }
      }
    }
  }

  const staffMinX = paddingPitch;
  const staffMaxX = paddingPitch + (maxPitch - minPitch) * options.pixelsPerSemitone;
  const staffMinY = height - paddingPitch - (maxPitch - minPitch) * options.pixelsPerSemitone;
  const staffMaxY = height - paddingPitch;

  // 3. Barlines & Measure Numbers
  if (options.showBarlines) {
    ctx.save();
    for (const bar of score.barlines) {
      ctx.beginPath();
      ctx.strokeStyle =
        bar.type === 'double' || bar.type === 'final'
          ? 'rgba(255, 255, 255, 0.85)'
          : 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = bar.type === 'double' || bar.type === 'final' ? 2 : 1;

      if (isHoriz) {
        const x = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(x, staffMinY);
        ctx.lineTo(x, staffMaxY);
        ctx.stroke();

        if (bar.barNumber === 1 || (bar.barNumber - 1) % 4 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
          ctx.font = 'italic 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(bar.barNumber), x + 4, staffMinY - 6);
        }
      } else {
        const y = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(staffMinX, y);
        ctx.lineTo(staffMaxX, y);
        ctx.stroke();

        if (bar.barNumber === 1 || (bar.barNumber - 1) % 4 === 0) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
          ctx.font = 'italic 11px "Century Schoolbook", "Baskerville", "Liberation Serif", serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(bar.barNumber), 14, y - 4);
        }
      }
    }
    ctx.restore();
  }

  // 3b. Option 1: Klavarskribo Beat Grid (Horizontal pulse lines for Beat 2, Beat 3, etc.)
  if (options.showBeatGrid) {
    ctx.save();
    const totalTicks = score.totalTicks;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 3]);

    for (let i = 0; i < score.barlines.length; i++) {
      const bar = score.barlines[i];
      const nextBar = score.barlines[i + 1];
      const barEndTick = nextBar ? nextBar.tick : bar.tick + ticksPerMeasure;

      for (let b = 1; b < numBeats; b++) {
        const bTick = bar.tick + b * ticksPerBeat;
        if (bTick >= barEndTick || bTick >= totalTicks) break;

        if (isHoriz) {
          const x = paddingStart + bTick * options.pixelsPerTick;
          ctx.beginPath();
          ctx.moveTo(x, staffMinY);
          ctx.lineTo(x, staffMaxY);
          ctx.stroke();
        } else {
          const y = paddingStart + bTick * options.pixelsPerTick;
          ctx.beginPath();
          ctx.moveTo(staffMinX, y);
          ctx.lineTo(staffMaxX, y);
          ctx.stroke();
        }
      }
    }
    ctx.setLineDash([]);

    // Left-Gutter Beat Counter Column (1 · 2 · 3) in vertical canvas
    if (!isHoriz) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.40)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      for (let i = 0; i < score.barlines.length; i++) {
        const bar = score.barlines[i];
        const nextBar = score.barlines[i + 1];
        const barEndTick = nextBar ? nextBar.tick : bar.tick + ticksPerMeasure;
        const barY = paddingStart + bar.tick * options.pixelsPerTick;

        // Subtle beat count number 1 at Beat 1 (aligned with the solid barline)
        ctx.fillText('1', staffMinX - 10, barY);

        // Subtle beat count numbers 2, 3... aligned with the dotted pulse lines
        for (let b = 1; b < numBeats; b++) {
          const bTick = bar.tick + b * ticksPerBeat;
          if (bTick >= barEndTick || bTick >= totalTicks) break;
          const beatY = paddingStart + bTick * options.pixelsPerTick;
          ctx.fillText(String(b + 1), staffMinX - 10, beatY);
        }
      }
    }

    ctx.restore();
  }


  // 4b. Option 2: Gutter Beat Brackets (Outer margin beat grouping framing)
  if (options.showGutterBrackets) {
    ctx.save();
    const ticksPerBeat = score.ticksPerBeat || 48;
    const numBeats = score.timeSignatures?.[0]?.numerator || 3;

    const lhBeats = new Set<number>();
    const rhBeats = new Set<number>();
    for (const n of score.notes) {
      const bIdx = Math.floor(n.startTick / ticksPerBeat);
      const hand = n.hand ?? (linearIndex(n.pitch) >= 48 ? 'RH' : 'LH');
      if (hand === 'RH') {
        rhBeats.add(bIdx);
      } else {
        lhBeats.add(bIdx);
      }
    }

    const totalBeats = Math.ceil(score.totalTicks / ticksPerBeat);
    const staffLeft = paddingPitch;
    const staffRight = paddingPitch + (maxPitch - minPitch) * options.pixelsPerSemitone;
    const capLen = 4;

    for (let bIdx = 0; bIdx < totalBeats; bIdx++) {
      const bStart = bIdx * ticksPerBeat;
      const bEnd = bStart + ticksPerBeat;
      const beatNum = (bIdx % numBeats) + 1;
      const isBeatActive = options.currentTick >= bStart && options.currentTick < bEnd;

      if (isHoriz) {
        // Horizontal timeline: time along X, RH gutter along top, LH gutter along bottom
        const x1 = paddingStart + bStart * options.pixelsPerTick + 1.5;
        const x2 = paddingStart + bEnd * options.pixelsPerTick - 1.5;
        if (x2 <= x1) continue;

        // RH Gutter Bracket (Top margin above staff)
        if (rhBeats.has(bIdx)) {
          const rhRailY = 18;
          ctx.beginPath();
          ctx.strokeStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = isBeatActive ? 2.0 : 1.0;
          ctx.moveTo(x1, rhRailY - capLen);
          ctx.lineTo(x1, rhRailY);
          ctx.lineTo(x2, rhRailY);
          ctx.lineTo(x2, rhRailY - capLen);
          ctx.stroke();

          ctx.fillStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.45)';
          ctx.font = isBeatActive ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(beatNum), (x1 + x2) / 2, rhRailY - 2);
        }

        // LH Gutter Bracket (Bottom margin below staff)
        if (lhBeats.has(bIdx)) {
          const lhRailY = height - 18;
          ctx.beginPath();
          ctx.strokeStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = isBeatActive ? 2.0 : 1.0;
          ctx.moveTo(x1, lhRailY + capLen);
          ctx.lineTo(x1, lhRailY);
          ctx.lineTo(x2, lhRailY);
          ctx.lineTo(x2, lhRailY + capLen);
          ctx.stroke();

          ctx.fillStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.45)';
          ctx.font = isBeatActive ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(String(beatNum), (x1 + x2) / 2, lhRailY + 2);
        }
      } else {
        // Vertical timeline: time along Y, LH gutter to left of staff, RH gutter to right of staff
        const y1 = paddingStart + bStart * options.pixelsPerTick + 1.5;
        const y2 = paddingStart + bEnd * options.pixelsPerTick - 1.5;
        if (y2 <= y1) continue;

        // LH Gutter Bracket (Left margin)
        if (lhBeats.has(bIdx)) {
          const lhRailX = staffLeft - 12;
          ctx.beginPath();
          ctx.strokeStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = isBeatActive ? 2.0 : 1.0;
          ctx.moveTo(lhRailX - capLen, y1);
          ctx.lineTo(lhRailX, y1);
          ctx.lineTo(lhRailX, y2);
          ctx.lineTo(lhRailX - capLen, y2);
          ctx.stroke();

          ctx.fillStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.50)';
          ctx.font = isBeatActive ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(beatNum), lhRailX - capLen - 2, (y1 + y2) / 2);
        }

        // RH Gutter Bracket (Right margin)
        if (rhBeats.has(bIdx)) {
          const rhRailX = staffRight + 12;
          ctx.beginPath();
          ctx.strokeStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = isBeatActive ? 2.0 : 1.0;
          ctx.moveTo(rhRailX + capLen, y1);
          ctx.lineTo(rhRailX, y1);
          ctx.lineTo(rhRailX, y2);
          ctx.lineTo(rhRailX + capLen, y2);
          ctx.stroke();

          ctx.fillStyle = isBeatActive ? '#FACC15' : 'rgba(255, 255, 255, 0.50)';
          ctx.font = isBeatActive ? 'bold 10px monospace' : '9px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(beatNum), rhRailX + capLen + 2, (y1 + y2) / 2);
        }
      }
    }
    ctx.restore();
  }

  // 5. Notes Rendering with selected morphology and Unified Duration Lattice
  ctx.save();
  const tauRef = score.gridResolution || 12;

  // Pre-collect obstacles for collision truncation & interruption
  interface CanvasObstacle {
    noteId: string;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }
  const canvasObstacles: CanvasObstacle[] = [];
  const horizCanvasObstacles: CanvasObstacle[] = [];

  if (!isHoriz && !isPianoRoll) {
    for (const note of score.notes) {
      const lPitch = linearIndex(note.pitch);
      const { x: nx, y: ny } = getCoords(note.startTick, lPitch);
      const noteWidth = Math.max(10, options.pixelsPerSemitone);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      const hand = note.hand ?? (lPitch >= 48 ? 'RH' : 'LH');
      const isHandException = (hand === 'RH' && lPitch < 48) || (hand === 'LH' && lPitch > 48);
      const halfW = noteWidth / 2;
      const tip = 2.4;
      let x1 = nx - halfW - 1.0;
      let x2 = nx + halfW + 1.0;
      if (isHandException) {
        if (hand === 'LH') {
          x1 = nx - halfW - tip - 2.0;
        } else {
          x2 = nx + halfW + tip + 2.0;
        }
      }

      // Notehead obstacle incorporating baked pointer tip
      canvasObstacles.push({
        noteId: note.id,
        x1,
        x2,
        y1: ny - noteHeight / 2 - 2.0,
        y2: ny + noteHeight / 2 + 2.0,
      });
    }
  }

  if (isHoriz && !isPianoRoll) {
    for (const note of score.notes) {
      const lPitch = linearIndex(note.pitch);
      const { x: cx, y: cy } = getCoords(note.startTick, lPitch);
      const noteWidth = Math.max(8, options.pixelsPerSemitone - 3);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      horizCanvasObstacles.push({
        noteId: note.id,
        x1: cx - noteWidth / 2 - 2.0,
        x2: cx + noteWidth / 2 + 2.0,
        y1: cy - noteHeight / 2 - 1.0,
        y2: cy + noteHeight / 2 + 1.0,
      });
    }
  }

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
    const ticksPerBeat = score.ticksPerBeat || 48;
    const showDottedTrail = note.durationTicks > tauRef;

    if (isPianoRoll) {
      const isSounding =
        options.currentTick >= note.startTick &&
        options.currentTick < note.startTick + note.durationTicks;
      const hand = note.hand ?? (lPitch >= 48 ? 'RH' : 'LH');

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
      const noteWidth = Math.max(8, options.pixelsPerSemitone - 3);

      // Notehead centered directly on exact onset coordinate (x, y)
      const cx = x;
      const cy = y;

      // Solid thin hold lines for colored notes with obstacle interruption
      if (showDottedTrail) {
        const trailStartX = cx + noteWidth / 2 + 2;
        const rawReleaseX = cx + note.durationTicks * options.pixelsPerTick;
        const trailEndX = rawReleaseX;

        const baseGeom = getStaffLineGeometry(lPitch, normStaffStyle);
        const isOnStaffLine = baseGeom.isLine;
        const isBold = isOnStaffLine && (lPitch === 48);

        let intervals: [number, number][] = [[trailStartX, trailEndX]];

        for (const obs of horizCanvasObstacles) {
          if (obs.noteId !== note.id) {
            if (cy >= obs.y1 && cy <= obs.y2) {
              intervals = subtractInterval(intervals, obs.x1, obs.x2);
            }
          }
        }

        for (const [segX1, segX2] of intervals) {
          if (segX2 - segX1 >= 1.5) {
            ctx.save();
            ctx.setLineDash([]);

            // Staff lines are permanent reference lines and must NEVER be overwritten or interrupted by hold lines.
            // Hold lines are rendered only in open space (when not on a staff line).
            if (!isOnStaffLine) {
              ctx.lineCap = 'round';
              ctx.lineWidth = 0.8;
              ctx.strokeStyle = isHighlighted ? '#FACC15' : noteColor;
              ctx.beginPath();
              ctx.moveTo(segX1, cy);
              ctx.lineTo(segX2, cy);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      // Render notehead morphology with line knockout
      const hand = note.hand ?? (lPitch >= 48 ? 'RH' : 'LH');
      const isHandException = (hand === 'RH' && lPitch < 48) || (hand === 'LH' && lPitch > 48);

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
        false,
        isHandException ? hand : null
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
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      // Notehead centered directly on exact onset coordinate (x, y)
      const cx = x;
      const cy = y;

      // Solid thin hold lines for colored notes with obstacle interruption
      if (showDottedTrail) {
        const trailStartY = cy + noteHeight / 2 + 2;
        const rawReleaseY = cy + note.durationTicks * options.pixelsPerTick;
        const trailEndY = rawReleaseY;

        const baseGeom = getStaffLineGeometry(lPitch, normStaffStyle);
        const isOnStaffLine = baseGeom.isLine;
        const isBold = isOnStaffLine && (lPitch === 48);

        let intervals: [number, number][] = [[trailStartY, trailEndY]];

        for (const obs of canvasObstacles) {
          if (obs.noteId !== note.id) {
            if (cx >= obs.x1 && cx <= obs.x2) {
              intervals = subtractInterval(intervals, obs.y1, obs.y2);
            }
          }
        }

        for (const [segY1, segY2] of intervals) {
          if (segY2 - segY1 >= 1.5) {
            ctx.save();
            ctx.setLineDash([]);

            // Staff lines are permanent reference lines and must NEVER be overwritten or interrupted by hold lines.
            // Hold lines are rendered only in open space (when not on a staff line).
            if (!isOnStaffLine) {
              ctx.lineCap = 'round';
              ctx.lineWidth = 0.8;
              ctx.strokeStyle = isHighlighted ? '#FACC15' : noteColor;
              ctx.beginPath();
              ctx.moveTo(cx, segY1);
              ctx.lineTo(cx, segY2);
              ctx.stroke();
            }

            ctx.restore();
          }
        }
      }

      const hand = note.hand ?? (lPitch >= 48 ? 'RH' : 'LH');
      const isHandException = (hand === 'RH' && lPitch < 48) || (hand === 'LH' && lPitch > 48);

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
        true,
        isHandException ? hand : null
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
/**
 * Draws a directional baked notehead pentagon on a Canvas 2D context.
 * For LH: pointer tip extends to the left (cx - halfW - tip), flat back on right.
 * For RH: pointer tip extends to the right (cx + halfW + tip), flat back on left.
 */
export function drawBakedCanvasPath(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  nw: number,
  nh: number,
  cy: number,
  hand: 'RH' | 'LH',
  tip: number = 2.4,
  rx: number = 1.2
): void {
  if (hand === 'LH') {
    const rightX = bx + nw;
    const apexX = bx - tip;
    ctx.moveTo(rightX - rx, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(apexX, cy);
    ctx.lineTo(bx, by + nh);
    ctx.lineTo(rightX - rx, by + nh);
    if (typeof ctx.arcTo === 'function') {
      ctx.arcTo(rightX, by + nh, rightX, by + nh - rx, rx);
      ctx.lineTo(rightX, by + rx);
      ctx.arcTo(rightX, by, rightX - rx, by, rx);
    } else {
      ctx.lineTo(rightX, by + nh);
      ctx.lineTo(rightX, by);
    }
    ctx.closePath();
  } else {
    const rightX = bx + nw;
    const apexX = rightX + tip;
    ctx.moveTo(bx + rx, by);
    ctx.lineTo(rightX, by);
    ctx.lineTo(apexX, cy);
    ctx.lineTo(rightX, by + nh);
    ctx.lineTo(bx + rx, by + nh);
    if (typeof ctx.arcTo === 'function') {
      ctx.arcTo(bx, by + nh, bx, by + nh - rx, rx);
      ctx.lineTo(bx, by + rx);
      ctx.arcTo(bx, by, bx + rx, by, rx);
    } else {
      ctx.lineTo(bx, by + nh);
      ctx.lineTo(bx, by);
    }
    ctx.closePath();
  }
}

export function renderNotehead(
  ctx: CanvasRenderingContext2D,
  morphology: 'classic-oval' | 'row-parity-shape' | 'phonetic' | 'numerical' | 'duodecimal' | 'minimal-dot' | 'rectangle-square' | 'square-ellipse' | 'square-triangle',
  pitchClass: number,
  cx: number,
  cy: number,
  baseSize: number,
  fillColor: string,
  isActive: boolean,
  strokeColor: string,
  isVertical: boolean,
  handException: 'RH' | 'LH' | null = null
): void {
  const headColor = isActive
    ? (fillColor === '#FEF08A' || fillColor === '#FFFFFF' ? fillColor : '#FDE047')
    : fillColor;

  if (handException !== null && morphology !== 'duodecimal') {
    const isRow0 = pitchClass % 2 === 0;
    const nw = Math.max(11.0, baseSize);
    const nh = Math.max(8.2, baseSize * 0.75);
    const sw = isVertical ? nw : nh;
    const sh = isVertical ? nh : nw;
    const halfW = sw / 2;
    const halfH = sh / 2;
    const bx = cx - halfW;
    const by = cy - halfH;
    const tip = 2.4;
    const rx = 1.2;

    // Knockout line-masking (canvas background is black)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    drawBakedCanvasPath(ctx, bx, by, sw, sh, cy, handException, tip, rx);
    ctx.fill();

    if (isRow0) {
      // Row 0: Solid directional pentagon
      // Inset by strokeWidth / 2 (0.6px) so outer bounding box after 1.2px stroke matches hollow notehead exactly!
      const strokeW = 1.2;
      const halfStroke = strokeW / 2;
      const sbx = bx + halfStroke;
      const sby = by + halfStroke;
      const ssw = sw - strokeW;
      const ssh = sh - strokeW;
      const srx = Math.max(0.5, rx - halfStroke);
      ctx.fillStyle = headColor;
      ctx.beginPath();
      drawBakedCanvasPath(ctx, sbx, sby, ssw, ssh, cy, handException, tip, srx);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    } else {
      // Row 1: Hollow directional pentagon with void black interior
      // Inset by strokeWidth / 2 (0.9px) so outer bounding box after 1.8px stroke matches solid notehead exactly
      const strokeW = 1.8;
      const halfStroke = strokeW / 2;
      const hbx = bx + halfStroke;
      const hby = by + halfStroke;
      const hsw = sw - strokeW;
      const hsh = sh - strokeW;
      const hrx = Math.max(0.5, rx - halfStroke);
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      drawBakedCanvasPath(ctx, bx, by, sw, sh, cy, handException, tip, rx);
      ctx.fill();
      ctx.beginPath();
      drawBakedCanvasPath(ctx, hbx, hby, hsw, hsh, cy, handException, tip, hrx);
      ctx.strokeStyle = headColor;
      ctx.lineWidth = strokeW;
      ctx.stroke();
    }
    return;
  }

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

    case 'duodecimal': {
      const pc = ((pitchClass % 12) + 12) % 12;
      const digit = DUODECIMAL_DIGITS[pc];
      const isEven = pc % 2 === 0;
      const r = 6.8;
      const cyOpt = cy - 0.8;

      // Crisp circular line-knockout centered at optical center
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cyOpt, r, 0, Math.PI * 2);
      ctx.fill();

      // Standalone naked digit in URW Gothic
      ctx.fillStyle = headColor;
      ctx.font = isEven
        ? 'bold 11px "URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif'
        : '600 11px "URW Gothic", "Century Gothic", "ITC Avant Garde Gothic", "Avant Garde", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(digit, cx, cy);

      // Sculpted French Guillemet for hand-crossing exceptions (« for LH, » for RH)
      if (handException !== null) {
        const h = 4.4;
        const w = 2.4;
        const clr = 3.6;
        const thick = 0.9;

        let bx = handException === 'LH' ? cx - clr : cx + clr;
        let ax = handException === 'LH' ? bx - w : bx + w;
        let ctrlX = handException === 'LH' ? bx - w * 0.30 : bx + w * 0.30;
        const ty = cyOpt - h / 2;
        const by = cyOpt + h / 2;
        const inAx = handException === 'LH' ? ax + thick : ax - thick;
        const inCtrlX = handException === 'LH' ? ctrlX + thick * 0.45 : ctrlX - thick * 0.45;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(bx, ty);
        ctx.quadraticCurveTo(ctrlX, cyOpt - h * 0.22, ax, cyOpt);
        ctx.quadraticCurveTo(ctrlX, cyOpt + h * 0.22, bx, by);
        ctx.quadraticCurveTo(inCtrlX, cyOpt + h * 0.16, inAx, cyOpt);
        ctx.quadraticCurveTo(inCtrlX, cyOpt - h * 0.16, bx, ty);
        ctx.closePath();

        // Direct solid fill without stroke halo knockout
        ctx.fillStyle = headColor;
        ctx.fill();
        ctx.restore();
      }
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
        // 100% VOID / transparent (pure black interior on canvas)
        // Inset by strokeWidth / 2 (0.9px) so outer bounding box after 1.8px stroke matches solid notehead exactly
        const strokeW = 1.8;
        const halfStroke = strokeW / 2;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.roundRect(
          cx - sw / 2 + halfStroke,
          cy - sh / 2 + halfStroke,
          sw - strokeW,
          sh - strokeW,
          Math.max(0.5, 1.5 - halfStroke)
        );
        ctx.fill();

        ctx.strokeStyle = headColor;
        ctx.lineWidth = strokeW;
        ctx.stroke();
      }
      break;
    }
  }
}

