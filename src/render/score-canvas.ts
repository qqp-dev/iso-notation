import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { linearIndex, wholeToneParity, pitchClassLabel } from '../model/pitch';
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
  let minPitch = 48; // Default C4
  let maxPitch = 72; // Default C6

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
 * Zero diffusion, deterministic vector precision.
 */
export function renderScoreToCanvas(
  ctx: CanvasRenderingContext2D,
  score: QuantizedGridScore,
  options: RenderOptions
): void {
  const dims = calculateScoreDimensions(score, options);
  const { width, height, minPitch, maxPitch } = dims;

  // Background
  ctx.fillStyle = '#0F172A'; // Slate-900
  ctx.fillRect(0, 0, width, height);

  const isHoriz = options.orientation === 'horizontal';
  const paddingStart = 60;
  const paddingPitch = 40;

  // Function to convert (tick, linearPitch) to canvas (x, y)
  const getCoords = (tick: number, lPitch: number): { x: number; y: number } => {
    if (isHoriz) {
      const x = paddingStart + tick * options.pixelsPerTick;
      const y = height - paddingPitch - (lPitch - minPitch) * options.pixelsPerSemitone;
      return { x, y };
    } else {
      // Vertical: Time flows downward, pitch left to right
      const x = paddingPitch + (lPitch - minPitch) * options.pixelsPerSemitone;
      const y = paddingStart + tick * options.pixelsPerTick;
      return { x, y };
    }
  };

  // 1. Draw Grid Background / Staff Lines
  ctx.save();
  for (let p = minPitch; p <= maxPitch; p++) {
    const parity = wholeToneParity(p);
    const isOctaveC = p % 12 === 0;

    if (isHoriz) {
      const y = height - paddingPitch - (p - minPitch) * options.pixelsPerSemitone;

      // Band shading in chromatic grid mode
      if (options.notationStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(30, 41, 59, 0.45)' : 'rgba(15, 23, 42, 0.2)';
        ctx.fillRect(
          paddingStart,
          y - options.pixelsPerSemitone / 2,
          dims.width - paddingStart,
          options.pixelsPerSemitone
        );
      }

      // 6-6 Whole-Tone Staff Lines: lines on WT-A (parity === 0), spaces on WT-B
      if (options.notationStyle === 'wholetone-staff') {
        if (parity === 0) {
          ctx.beginPath();
          ctx.strokeStyle = isOctaveC ? 'rgba(96, 165, 250, 0.65)' : 'rgba(71, 85, 105, 0.4)';
          ctx.lineWidth = isOctaveC ? 1.5 : 1;
          ctx.moveTo(paddingStart, y);
          ctx.lineTo(dims.width, y);
          ctx.stroke();
        }
      } else {
        // Chromatic grid lines
        ctx.beginPath();
        ctx.strokeStyle = isOctaveC ? 'rgba(96, 165, 250, 0.7)' : 'rgba(51, 65, 85, 0.3)';
        ctx.lineWidth = isOctaveC ? 1.5 : 0.75;
        ctx.moveTo(paddingStart, y);
        ctx.lineTo(dims.width, y);
        ctx.stroke();
      }

      // Pitch Class / Octave label on left margin
      const pc = ((p % 12) + 12) % 12;
      const oct = Math.floor(p / 12);
      ctx.fillStyle = isOctaveC ? '#60A5FA' : parity === 0 ? '#94A3B8' : '#64748B';
      ctx.font = isOctaveC ? 'bold 11px monospace' : '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const label = options.noteheadStyle === 'numerical' ? `${pc}:${oct}` : `${pitchClassLabel(pc, 'sharp')}${oct}`;
      ctx.fillText(label, paddingStart - 8, y);
    } else {
      // Vertical timeline: Pitch lines are vertical
      const x = paddingPitch + (p - minPitch) * options.pixelsPerSemitone;

      if (options.notationStyle === 'chromatic-grid') {
        ctx.fillStyle = parity === 0 ? 'rgba(30, 41, 59, 0.45)' : 'rgba(15, 23, 42, 0.2)';
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
          ctx.strokeStyle = isOctaveC ? 'rgba(96, 165, 250, 0.65)' : 'rgba(71, 85, 105, 0.4)';
          ctx.lineWidth = isOctaveC ? 1.5 : 1;
          ctx.moveTo(x, paddingStart);
          ctx.lineTo(x, dims.height);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.strokeStyle = isOctaveC ? 'rgba(96, 165, 250, 0.7)' : 'rgba(51, 65, 85, 0.3)';
        ctx.lineWidth = isOctaveC ? 1.5 : 0.75;
        ctx.moveTo(x, paddingStart);
        ctx.lineTo(x, dims.height);
        ctx.stroke();
      }

      // Pitch labels along top margin
      const pc = ((p % 12) + 12) % 12;
      const oct = Math.floor(p / 12);
      ctx.fillStyle = isOctaveC ? '#60A5FA' : parity === 0 ? '#94A3B8' : '#64748B';
      ctx.font = isOctaveC ? 'bold 10px monospace' : '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const label = options.noteheadStyle === 'numerical' ? `${pc}` : `${pitchClassLabel(pc, 'sharp')}`;
      ctx.fillText(label, x, paddingStart - 6);
    }
  }
  ctx.restore();

  // 2. Draw Barlines & Measure Numbers
  if (options.showBarlines) {
    ctx.save();
    for (const bar of score.barlines) {
      ctx.beginPath();
      ctx.strokeStyle = bar.type === 'double' || bar.type === 'final' ? 'rgba(248, 250, 252, 0.6)' : 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = bar.type === 'double' ? 2 : 1;

      if (isHoriz) {
        const x = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(x, 15);
        ctx.lineTo(x, height - 15);
        ctx.stroke();

        // Bar number badge
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`M${bar.barNumber}`, x + 4, 18);
      } else {
        const y = paddingStart + bar.tick * options.pixelsPerTick;
        ctx.moveTo(15, y);
        ctx.lineTo(width - 15, y);
        ctx.stroke();

        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`M${bar.barNumber}`, 18, y - 4);
      }
    }
    ctx.restore();
  }

  // 3. Hand-Crossing Shading Overlays
  if (options.showHandCrossings && score.handCrossings && score.handCrossings.length > 0) {
    ctx.save();
    ctx.fillStyle = 'rgba(236, 72, 153, 0.12)'; // Rose-pink hand crossing highlight
    for (const hc of score.handCrossings) {
      if (isHoriz) {
        const x1 = paddingStart + hc.tick * options.pixelsPerTick;
        const x2 = x1 + hc.durationTicks * options.pixelsPerTick;
        ctx.fillRect(x1, 15, x2 - x1, height - 30);

        ctx.fillStyle = '#F472B6';
        ctx.font = 'italic 10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('⚡ Hand Cross (LH over RH)', x1 + 4, height - 20);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
      } else {
        const y1 = paddingStart + hc.tick * options.pixelsPerTick;
        const y2 = y1 + hc.durationTicks * options.pixelsPerTick;
        ctx.fillRect(15, y1, width - 30, y2 - y1);

        ctx.fillStyle = '#F472B6';
        ctx.font = 'italic 10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('⚡ Hand Cross', width - 20, y1 + 14);
        ctx.fillStyle = 'rgba(236, 72, 153, 0.12)';
      }
    }
    ctx.restore();
  }

  // 4. Notes Rendering
  ctx.save();
  for (const note of score.notes) {
    const lPitch = linearIndex(note.pitch);
    const isActive = options.currentTick >= note.startTick && options.currentTick < note.startTick + note.durationTicks;
    const isSelected = options.selectedNoteId === note.id;
    const noteColor = getNoteColor(note.pitch, note.hand, options.colorMode, isActive || isSelected);

    if (isHoriz) {
      const { x, y } = getCoords(note.startTick, lPitch);
      const spanWidth = Math.max(8, note.durationTicks * options.pixelsPerTick - 2);
      const noteHeight = Math.max(8, options.pixelsPerSemitone - 3);

      // Duration block / sustain ribbon
      ctx.fillStyle = noteColor;
      ctx.beginPath();
      ctx.roundRect(x, y - noteHeight / 2, spanWidth, noteHeight, 4);
      ctx.fill();

      // Onset anchor circle (notehead)
      ctx.beginPath();
      ctx.arc(x + 5, y, noteHeight / 2 + 1, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#FFFFFF' : noteColor;
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Numerical notehead ($0..11) or pitch class text
      if (options.noteheadStyle === 'numerical' || options.noteheadStyle === 'both') {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(note.pitch.pitchClass), x + 5, y);
      }

      // Articulation marker (staccato dot, accent wedge)
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
      ctx.roundRect(x - noteWidth / 2, y, noteWidth, spanHeight, 4);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y + 5, noteWidth / 2 + 1, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#FFFFFF' : noteColor;
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      if (options.noteheadStyle === 'numerical' || options.noteheadStyle === 'both') {
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(note.pitch.pitchClass), x, y + 5);
      }
    }
  }
  ctx.restore();

  // 5. Dynamics & Expression Overlays
  if (options.showDynamics) {
    ctx.save();
    for (const dyn of score.dynamics) {
      if (isHoriz) {
        const x = paddingStart + dyn.tick * options.pixelsPerTick;
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold italic 12px serif';
        ctx.textAlign = 'left';
        ctx.fillText(dyn.mark, x, height - 32);
      } else {
        const y = paddingStart + dyn.tick * options.pixelsPerTick;
        ctx.fillStyle = '#38BDF8';
        ctx.font = 'bold italic 12px serif';
        ctx.textAlign = 'left';
        ctx.fillText(dyn.mark, 25, y + 10);
      }
    }
    ctx.restore();
  }

  // 6. Playhead Indicator
  ctx.save();
  const playheadCoord = isHoriz
    ? paddingStart + options.currentTick * options.pixelsPerTick
    : paddingStart + options.currentTick * options.pixelsPerTick;

  ctx.beginPath();
  ctx.strokeStyle = '#FACC15'; // Bright amber gold
  ctx.lineWidth = 2.5;

  if (isHoriz) {
    ctx.moveTo(playheadCoord, 0);
    ctx.lineTo(playheadCoord, height);
  } else {
    ctx.moveTo(0, playheadCoord);
    ctx.lineTo(width, playheadCoord);
  }
  ctx.stroke();

  // Playhead triangle badge
  ctx.fillStyle = '#FACC15';
  ctx.beginPath();
  if (isHoriz) {
    ctx.moveTo(playheadCoord - 6, 0);
    ctx.lineTo(playheadCoord + 6, 0);
    ctx.lineTo(playheadCoord, 10);
  } else {
    ctx.moveTo(0, playheadCoord - 6);
    ctx.lineTo(0, playheadCoord + 6);
    ctx.lineTo(10, playheadCoord);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
