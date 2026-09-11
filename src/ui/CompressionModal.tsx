import React from 'react';

interface CompressionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompressionModal: React.FC<CompressionModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-md text-neutral-100 no-print overflow-y-auto">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/80 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">📐</span>
          <div>
            <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
              Horizontal Compression Analysis
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Current 12-Lane Isometric Layout vs. Hypothetical 6-Lane Folded Layout
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/horizontal_compression_comparison.svg"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-mono text-xs rounded-full border border-neutral-700 transition"
          >
            Open Full SVG ↗
          </a>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition cursor-pointer"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="flex-1 p-6 md:p-10 flex flex-col items-center max-w-5xl mx-auto w-full space-y-8">
        {/* Rendered Comparison Graphic */}
        <div className="w-full bg-white rounded-lg p-4 shadow-2xl border border-neutral-700 flex justify-center">
          <img
            src="/horizontal_compression_comparison.svg"
            alt="12-Lane vs 6-Lane Horizontal Compression Comparison"
            className="w-full max-w-3xl h-auto object-contain"
          />
        </div>

        {/* Technical Tradeoff Breakdown */}
        <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
          <div className="p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-2">
            <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>●</span> CURRENT: 12-Lane Isometric
            </div>
            <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
              <li><strong className="text-white">Width per Octave:</strong> 72 pt (12 dedicated semitone lanes)</li>
              <li><strong className="text-white">Page Density:</strong> 2 columns per A4 portrait page</li>
              <li><strong className="text-white">Interval Slope:</strong> 100% linear isometry (all semitones have equal Δx = 1)</li>
              <li><strong className="text-white">Consecutive Pairs:</strong> Completely un-paired (notes 1 and 2 occupy independent coordinates)</li>
            </ul>
          </div>

          <div className="p-4 rounded-lg bg-neutral-900/80 border border-emerald-900/50 space-y-2">
            <div className="text-emerald-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>●</span> 6-LANE FOLDED (Hypothetical)
            </div>
            <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
              <li><strong className="text-white">Width per Octave:</strong> 36 pt (6 whole-tone lanes) — <span className="text-emerald-400 font-bold">50% narrower!</span></li>
              <li><strong className="text-white">Page Density:</strong> 4 columns per A4 portrait page</li>
              <li><strong className="text-white">Interval Slope:</strong> Broken (semitones alternate between Δx = 0 and Δx = 1)</li>
              <li><strong className="text-white">Consecutive Pairs:</strong> 1 & 2 share Lane 0, 3 & 4 share Lane 1 (re-introduces pairing)</li>
            </ul>
          </div>
        </div>

        {/* Summary Note */}
        <div className="w-full p-4 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400 space-y-2 leading-relaxed font-sans">
          <p>
            <strong className="text-neutral-200">Pitch Range Note:</strong> The layout does not reserve an 88-key piano span. In both modes, the bounding box tightly crops to the actual minimum and maximum notes played in the score (with a ±2 semitone margin).
          </p>
          <p>
            The difference between the two layouts is purely in the <strong className="text-neutral-200">pitch-to-lane coordinate mapping</strong>: whether 12 pitch classes map 1:1 to 12 physical columns, or fold pairwise into 6 whole-tone columns distinguished by notehead shape (Oval vs. Brick).
          </p>
        </div>
      </div>
    </div>
  );
};
