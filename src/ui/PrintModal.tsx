import React, { useMemo } from 'react';
import { QuantizedGridScore } from '../model/types';
import { computeColumnarLayout, renderAllPagesToSvg } from '../render/print-layout';
import { RenderOptions } from '../render/types';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: QuantizedGridScore;
  renderOptions?: Partial<RenderOptions>;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  score,
  renderOptions,
}) => {
  const layout = useMemo(
    () =>
      computeColumnarLayout(score, {
        staffStyle: renderOptions?.staffStyle ?? 'tritone-split',
        noteheadMorphology: renderOptions?.noteheadMorphology ?? 'rectangle-square',
        octaveExtensionMode: renderOptions?.octaveExtensionMode ?? 'badge',
      }),
    [score, renderOptions?.staffStyle, renderOptions?.noteheadMorphology, renderOptions?.octaveExtensionMode]
  );
  const pageSvgs = useMemo(() => renderAllPagesToSvg(layout), [layout]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Hidden container always present in DOM for browser print dialog (@media print) */}
      <div className="print-only" aria-hidden={!isOpen}>
        {pageSvgs.map((svg, idx) => (
          <div
            key={`print-page-${idx}`}
            className="print-page"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ))}
      </div>

      {/* Screen Interactive Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-md text-neutral-100 no-print">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-black/80 shrink-0">
            <div>
              <h2 className="text-base font-bold font-mono text-white flex items-center gap-2">
                <span>🖨️</span>
                <span>Print Sheet Music (A4 Columnar Engraving)</span>
              </h2>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                {score.title} — {score.composer} • {layout.pages.length}-Page Urtext Spread • Section A (mm. 1–16) / Section B (mm. 17–32)
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs rounded-full shadow-lg flex items-center gap-2 transition cursor-pointer"
                title="Open browser print dialog / Save as PDF"
              >
                <span>Print / Save PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-white rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
                aria-label="Close print preview"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Modal Body - 2-Page Side-by-Side Spread Preview */}
          <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col items-center">
            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {pageSvgs.map((svg, idx) => (
                <div key={`preview-page-${idx}`} className="flex flex-col items-center">
                  <div className="text-xs font-mono text-neutral-400 mb-2 font-semibold">
                    Page {idx + 1}: {layout.pages[idx]?.sectionName || `Page ${idx + 1}`}
                  </div>
                  <div
                    className="w-full bg-white shadow-2xl rounded-sm overflow-hidden border border-neutral-700 print-preview-card [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
