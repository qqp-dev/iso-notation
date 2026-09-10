import React, { useRef, useEffect, useCallback, useState } from 'react';
import { QuantizedGridScore, QuantizedNote } from '../model/types';
import { RenderOptions } from '../render/types';
import { renderScoreToCanvas, calculateScoreDimensions } from '../render/score-canvas';
import { synth } from '../audio/synth';

interface NotationCanvasProps {
  score: QuantizedGridScore;
  options: RenderOptions;
  onTickSeek?: (tick: number) => void;
  onNoteSelect?: (note: QuantizedNote) => void;
}

export const NotationCanvas: React.FC<NotationCanvasProps> = ({
  score,
  options,
  onTickSeek,
  onNoteSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Touch tracking for pinch-zoom and pan
  const touchState = useRef<{
    initialDist: number;
    initialZoom: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  }>({
    initialDist: 0,
    initialZoom: options.zoom,
    startX: 0,
    startY: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const dimensions = calculateScoreDimensions(score, options);

  // Render score to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);
    renderScoreToCanvas(ctx, score, options);
    ctx.restore();
  }, [score, options, dimensions.width, dimensions.height]);

  // Handle click to seek or select note
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const paddingStart = 60;
    const isHoriz = options.orientation === 'horizontal';

    const clickCoord = isHoriz ? x - paddingStart : y - paddingStart;
    const clickedTick = Math.max(0, Math.min(score.totalTicks, Math.round(clickCoord / options.pixelsPerTick)));

    if (onTickSeek) {
      onTickSeek(clickedTick);
    }
  };

  // Touch handling for mobile pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchState.current.initialDist = dist;
      touchState.current.initialZoom = options.zoom;
    } else if (e.touches.length === 1 && containerRef.current) {
      touchState.current.startX = e.touches[0].clientX;
      touchState.current.startY = e.touches[0].clientY;
      touchState.current.scrollLeft = containerRef.current.scrollLeft;
      touchState.current.scrollTop = containerRef.current.scrollTop;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && touchState.current.initialDist > 0) {
      // Pinch zoom can be triggered via zoom callback if needed
    } else if (e.touches.length === 1 && containerRef.current) {
      const dx = e.touches[0].clientX - touchState.current.startX;
      const dy = e.touches[0].clientY - touchState.current.startY;
      containerRef.current.scrollLeft = touchState.current.scrollLeft - dx;
      containerRef.current.scrollTop = touchState.current.scrollTop - dy;
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-0 w-full overflow-auto bg-black relative select-none touch-pan-x touch-pan-y"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="cursor-crosshair block shadow-2xl"
      />
    </div>
  );
};
