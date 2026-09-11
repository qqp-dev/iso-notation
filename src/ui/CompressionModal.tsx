import React, { useState } from 'react';

interface CompressionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompressionModal: React.FC<CompressionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [selectedOption, setSelectedOption] = useState<'active' | 'overview'>('active');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-md text-neutral-100 no-print overflow-y-auto">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/80 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">📐</span>
          <div>
            <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
              Staff Topography &amp; Notehead Morphology
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-0.5">
              Symmetric 1-5-9 Staff • Full Squares (Row 0) &amp; Empty Squares (Row 1)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Switcher */}
          <div className="flex bg-neutral-900 p-0.5 rounded-full border border-neutral-700 font-mono text-xs">
            <button
              onClick={() => setSelectedOption('active')}
              className={`px-3 py-1 rounded-full transition-all ${
                selectedOption === 'active'
                  ? 'bg-amber-500 text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              1-5-9 Staff + Full/Empty Squares
            </button>
            <button
              onClick={() => setSelectedOption('overview')}
              className={`px-3 py-1 rounded-full transition-all ${
                selectedOption === 'overview'
                  ? 'bg-sky-500 text-black font-bold shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              12-Lane vs 6-Lane
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors ml-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content Container */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        {selectedOption === 'active' && (
          <div className="w-full space-y-4 flex flex-col items-center">
            <div className="w-full bg-white rounded-lg p-4 shadow-2xl border border-neutral-700 flex flex-col items-center">
              <img
                src="/row_rectangles_squares.svg"
                alt="Active Design: 1-5-9 Staff with Row 0 Full Squares and Row 1 Empty Squares"
                className="w-full max-w-2xl h-auto object-contain"
              />
            </div>
            <div className="w-full p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 font-mono text-xs text-neutral-300 space-y-2">
              <div className="text-amber-400 font-bold uppercase tracking-wider text-[11px]">
                Active Score Architecture
              </div>
              <ul className="space-y-1.5 list-disc list-inside text-neutral-300">
                <li><strong className="text-white">Notehead Shapes (All Squares, Row Parity):</strong>
                  <ul className="pl-5 space-y-1 list-circle text-neutral-400 mt-1">
                    <li><strong className="text-amber-300">Row 0 (notes 1, 3, 5, 7, 9, 11):</strong> Full / Solid Squares (sitting on lines 1, 5, 9)</li>
                    <li><strong className="text-sky-300">Row 1 (notes 2, 4, 6, 8, 10, 12):</strong> Empty / Hollow Squares (in whole-tone spaces)</li>
                  </ul>
                </li>
                <li><strong className="text-white">Staff Lines (Symmetric 1-5-9 Topography):</strong>
                  <ul className="pl-5 space-y-1 list-circle text-neutral-400 mt-1">
                    <li><strong className="text-white">Line 1:</strong> Bold solid octave line (1.2pt) — marked <code className="text-amber-300 font-bold">m</code> at column top</li>
                    <li><strong className="text-white">Line 5:</strong> Small dashes (5, 2.5, 0.6pt) — 5 dropped from top</li>
                    <li><strong className="text-white">Line 9:</strong> Thin straight solid line (0.6pt, thinner than octave) — 9 dropped from top</li>
                  </ul>
                </li>
                <li><strong className="text-white">Horizontal Compression:</strong> Pitch axis compressed to 11px / 5.0pt per semitone (~21% narrower).</li>
              </ul>
            </div>
          </div>
        )}

        {selectedOption === 'overview' && (
          <div className="w-full space-y-4 flex flex-col items-center">
            <div className="w-full bg-white rounded-lg p-4 shadow-2xl border border-neutral-700 flex justify-center">
              <img
                src="/horizontal_compression_comparison.svg"
                alt="12-Lane vs 6-Lane Overview"
                className="w-full max-w-3xl h-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
