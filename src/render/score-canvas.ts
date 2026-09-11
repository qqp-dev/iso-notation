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
import { getNoteColor } from './colors';

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
      width: Math.max(800, timeLength + 120),
      height: Math.max(350, pitchBreadth + 80),
      minPitch,
      maxPitch,
      totalTicks: score.totalTicks,
    };
  } else {
    // Vertical timeline: Pitch is horizontal, Time is vertical
    return {
      width: Math.max(600, pitchBreadth + 100),
      height: Math.max(800, timeLength + 140),
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

      // Pitch Coordinate label on left margin: pure (pitchClass:octave), zero letters
      const isOctave0 = pc === 0;
      let textColor = '#666666';
      if (isOctave0) textColor = '#FFFFFF';
      else if (pc === 6) textColor = '#AAAAAA';

      ctx.fillStyle = textColor;
      ctx.font = isOctave0 || (pc === 6 && normStaffStyle === 'tritone-split') ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pc}:${oct}`, paddingStart - 8, y);
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
        ctx.beginPath();
        ctx.strokeStyle = lineGeom.color;
        ctx.lineWidth = lineGeom.lineWidth;
        if (lineGeom.isDashed && lineGeom.dashArray) {
          ctx.setLineDash(lineGeom.dashArray);
        } else {
          ctx.setLineDash([]);
        }
        ctx.moveTo(x, paddingStart);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }

      // Pitch class label along top margin
      const isOctave0 = pc === 0;
      let textColor = '#666666';
      if (isOctave0) textColor = '#FFFFFF';
      else if (pc === 6) textColor = '#AAAAAA';

      ctx.fillStyle = textColor;
      ctx.font = isOctave0 || (pc === 6 && normStaffStyle === 'tritone-split') ? 'bold 10px monospace' : '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(pc), x, paddingStart - 6);
    }
  }
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

  // 5. Notes Rendering with selected morphology
  ctx.save();
  for (const note of score.notes) {
    const lPitch = linearIndex(note.pitch);
    const isActive =
      options.currentTick >= note.startTick &&
      options.currentTick < note.startTick + note.durationTicks;
    const isSelected = options.selectedNoteId === note.id;
    const isHighlighted = isActive || isSelected;
    const noteColor = getNoteColor(
      note.pitch,
      note.hand,
      options.colorMode,
      isHighlighted
    );
    const strokeColor = isHighlighted ? '#FACC15' : '#000000';
    const pc = note.pitch.pitchClass;

    if (isHoriz) {
      const { x, y } = getCoords(note.startTick, lPitch);
      const spanWidth = Math.max(8, note.durationTicks * options.pixelsPerTick - 2);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      // Duration ribbon
      ctx.fillStyle = noteColor;
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight / 2, spanWidth, noteHeight, 3);
      ctx.fill();

      // Onset anchor coordinates
      const cx = x + Math.min(spanWidth / 2, 7);
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
        ctx.arc(cx, y - noteHeight / 2 - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (note.articulation === 'accent') {
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('>', cx, y - noteHeight / 2 - 4);
      }
    } else {
      // Vertical timeline
      const { x, y } = getCoords(note.startTick, lPitch);
      const spanHeight = Math.max(8, note.durationTicks * options.pixelsPerTick - 2);
      const noteWidth = Math.max(8, options.pixelsPerSemitone - 3);

      // Duration ribbon
      ctx.fillStyle = noteColor;
      ctx.beginPath();
      ctx.roundRect(x - noteWidth / 2, y, noteWidth, spanHeight, 3);
      ctx.fill();

      const cx = x;
      const cy = y + Math.min(spanHeight / 2, 7);

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
  morphology: 'classic-oval' | 'row-parity-shape' | 'phonetic' | 'numerical' | 'minimal-dot',
  pitchClass: number,
  cx: number,
  cy: number,
  baseSize: number,
  fillColor: string,
  isActive: boolean,
  strokeColor: string,
  isVertical: boolean
): void {
  const headColor = isActive ? '#FDE047' : fillColor;

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
      if (parityShape === 'disc') {
        // Row 0: Even pitch classes on lines -> Disc / Oval
        const r = Math.max(4.5, baseSize * 0.48);
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        // Row 1: Odd pitch classes in spaces -> Diamond / Lozenge
        const rw = Math.max(5.5, baseSize * 0.58);
        const rh = Math.max(5.5, baseSize * 0.58);
        const kw = rw + 3;
        const kh = rh + 3;

        // Knockout diamond
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.moveTo(cx, cy - kh);
        ctx.lineTo(cx + kw, cy);
        ctx.lineTo(cx, cy + kh);
        ctx.lineTo(cx - kw, cy);
        ctx.closePath();
        ctx.fill();

        // Notehead diamond
        ctx.fillStyle = headColor;
        ctx.beginPath();
        ctx.moveTo(cx, cy - rh);
        ctx.lineTo(cx + rw, cy);
        ctx.lineTo(cx, cy + rh);
        ctx.lineTo(cx - rw, cy);
        ctx.closePath();
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
      // Pitch-class integers 0..11
      const isTwoDigit = pitchClass >= 10;
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
      ctx.fillText(String(pitchClass), cx, cy);
      break;
    }

    case 'minimal-dot': {
      // Crisp, uncluttered circular dot with line knockout
      const r = Math.max(3.5, baseSize * 0.36);

      // Knockout
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Dot fill
      ctx.fillStyle = headColor;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.0;
      ctx.stroke();
      break;
    }
  }
}

