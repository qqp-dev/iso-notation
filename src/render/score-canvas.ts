import { QuantizedGridScore } from '../model/types';
import { linearIndex, wholeToneParity } from '../model/pitch';
import { RenderOptions } from './types';
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
 * deterministic vector precision.
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
  for (let p = minPitch; p <= maxPitch; p++) {
    const parity = wholeToneParity(p);
    const isOctave0 = p % 12 === 0;

    if (isHoriz) {
      const y = height - paddingPitch - (p - minPitch) * options.pixelsPerSemitone;

      // Band shading in chromatic grid mode
      if (options.notationStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0)';
        ctx.fillRect(
          paddingStart,
          y - options.pixelsPerSemitone / 2,
          dims.width - paddingStart,
          options.pixelsPerSemitone
        );
      }

      // 6-6 Whole-Tone Staff Lines: lines on WT Row 0 (parity === 0), spaces on WT Row 1
      if (options.notationStyle === 'wholetone-staff') {
        if (parity === 0) {
          ctx.beginPath();
          ctx.strokeStyle = isOctave0 ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = isOctave0 ? 1.5 : 0.8;
          ctx.moveTo(paddingStart, y);
          ctx.lineTo(dims.width, y);
          ctx.stroke();
        }
      } else {
        // Chromatic grid lines
        ctx.beginPath();
        ctx.strokeStyle = isOctave0 ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = isOctave0 ? 1.5 : 0.6;
        ctx.moveTo(paddingStart, y);
        ctx.lineTo(dims.width, y);
        ctx.stroke();
      }

      // Pitch Coordinate label on left margin: pure (pitchClass:octave), zero letters
      const pc = ((p % 12) + 12) % 12;
      const oct = Math.floor(p / 12);
      ctx.fillStyle = isOctave0 ? '#60A5FA' : parity === 0 ? '#CCCCCC' : '#666666';
      ctx.font = isOctave0 ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${pc}:${oct}`, paddingStart - 8, y);
    } else {
      // Vertical timeline
      const x = paddingPitch + (p - minPitch) * options.pixelsPerSemitone;

      if (options.notationStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0)';
        ctx.fillRect(
          x - options.pixelsPerSemitone / 2,
          paddingStart,
          options.pixelsPerSemitone,
          dims.height - paddingStart
        );
      }

      if (options.notationStyle === 'wholetone-staff') {
        if (parity === 0) {
          ctx.beginPath();
          ctx.strokeStyle = isOctave0 ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.18)';
          ctx.lineWidth = isOctave0 ? 1.5 : 0.8;
          ctx.moveTo(x, paddingStart);
          ctx.lineTo(x, dims.height);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.strokeStyle = isOctave0 ? 'rgba(96, 165, 250, 0.7)' : 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = isOctave0 ? 1.5 : 0.6;
        ctx.moveTo(x, paddingStart);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }

      // Pitch class label along top margin
      const pc = ((p % 12) + 12) % 12;
      ctx.fillStyle = isOctave0 ? '#60A5FA' : parity === 0 ? '#CCCCCC' : '#666666';
      ctx.font = isOctave0 ? 'bold 10px monospace' : '9px monospace';
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

  // 5. Notes Rendering with strictly numerical noteheads (0..11)
  ctx.save();
  for (const note of score.notes) {
    const lPitch = linearIndex(note.pitch);
    const isActive =
      options.currentTick >= note.startTick &&
      options.currentTick < note.startTick + note.durationTicks;
    const isSelected = options.selectedNoteId === note.id;
    const noteColor = getNoteColor(
      note.pitch,
      note.hand,
      options.colorMode,
      isActive || isSelected
    );

    if (isHoriz) {
      const { x, y } = getCoords(note.startTick, lPitch);
      const spanWidth = Math.max(8, note.durationTicks * options.pixelsPerTick - 2);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      // Duration ribbon
      ctx.fillStyle = noteColor;
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight / 2, spanWidth, noteHeight, 3);
      ctx.fill();

      // Onset anchor circle
      ctx.beginPath();
      ctx.arc(x + 5, y, noteHeight / 2 + 1, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#FFFFFF' : noteColor;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pure numerical notehead: pitch class 0..11
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(note.pitch.pitchClass), x + 5, y);

      // Articulation marker
      if (note.articulation === 'staccato') {
        ctx.fillStyle = noteColor;
        ctx.beginPath();
        ctx.arc(x + 5, y - noteHeight / 2 - 4, 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (note.articulation === 'accent') {
        ctx.fillStyle = '#F43F5E';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('>', x + 5, y - noteHeight / 2 - 4);
      }
    } else {
      // Vertical timeline
      const { x, y } = getCoords(note.startTick, lPitch);
      const spanHeight = Math.max(8, note.durationTicks * options.pixelsPerTick - 2);
      const noteWidth = Math.max(8, options.pixelsPerSemitone - 3);

      ctx.fillStyle = noteColor;
      ctx.beginPath();
      ctx.roundRect(x - noteWidth / 2, y, noteWidth, spanHeight, 3);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y + 5, noteWidth / 2 + 1, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#FFFFFF' : noteColor;
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(note.pitch.pitchClass), x, y + 5);
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
