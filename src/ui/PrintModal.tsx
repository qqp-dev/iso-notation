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
        noteheadMorphology: renderOptions?.noteheadMorphology ?? 'duodecimal',
        octaveExtensionMode: renderOptions?.octaveExtensionMode ?? 'spillover',
        showBeatGrid: renderOptions?.showBeatGrid ?? true,
        showGutterBrackets: false,
      }),
    [
      score,
      renderOptions?.staffStyle,
      renderOptions?.noteheadMorphology,
      renderOptions?.octaveExtensionMode,
      renderOptions?.showBeatGrid,
      renderOptions?.showGutterBrackets,
    ]
  );
  const pageSvgs = useMemo(() => renderAllPagesToSvg(layout), [layout]);

  const handleDownloadSvg = (pageIdx = 0) => {
    const svg = pageSvgs[pageIdx];
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${score.title || 'score'}-page-${pageIdx + 1}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-neutral-800 bg-black/80 gap-3 shrink-0">
            <div>
              <h2 className="text-sm font-bold font-mono text-white flex items-center gap-2">
                <span>🖨️</span>
                <span>Print Sheet Music (A4 Horizontal Portrait Engraving)</span>
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                {score.title} — {score.composer} • {layout.pages.length}-Page Urtext Spread
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDownloadSvg(0)}
                className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 font-bold font-mono text-xs rounded-full shadow transition cursor-pointer flex items-center gap-1.5"
                title="Download Page 1 as standalone vector SVG"
              >
                <span>💾</span>
                <span>Download SVG</span>
              </button>

              <button
                onClick={handlePrint}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold font-mono text-xs rounded-full shadow-lg flex items-center gap-1.5 transition cursor-pointer"
                title="Open browser print dialog / Save as PDF"
              >
                <span>Print / PDF</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-neutral-400 hover:text-white rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition cursor-pointer"
                aria-label="Close print preview"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Browser Printing Hint Bar */}
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 text-[11px] font-mono text-amber-300 flex items-center justify-between shrink-0">
            <span>
              💡 <strong>Print Dialog Tip:</strong> For exact uncropped Urtext engraving, set <strong>Margins: None</strong> (or Minimum) and <strong>Paper: A4</strong> in your browser print settings.
            </span>
            <span className="text-neutral-400 hidden md:inline">
              100% Vector • Proportional scaling active
            </span>
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
