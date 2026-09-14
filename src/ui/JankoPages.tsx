import React, { useMemo } from 'react';
import { QuantizedGridScore } from '../model/types';
import {
  countJankoPages,
  renderJankoPage,
} from '../render/janko/engine';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
} from '../render/janko/types';

/** One engraved page: the SVG document plus its viewBox in pt. */
export interface JankoPageDoc {
  svg: string;
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
}

/**
 * Engrave every page of a score with the golden-master defaults.
 *
 * Shared by the Player and Sheet views so both show byte-identical pages
 * from the real engine — never a cached export.
 */
export function useJankoPages(score: QuantizedGridScore): JankoPageDoc[] {
  return useMemo(() => {
    const count = countJankoPages(
      score,
      DEFAULT_JANKO_OPTIONS,
      DEFAULT_JANKO_TOKENS
    );
    const docs: JankoPageDoc[] = [];
    for (let i = 0; i < count; i++) {
      const svg = renderJankoPage(
        score,
        i,
        DEFAULT_JANKO_OPTIONS,
        DEFAULT_JANKO_TOKENS
      );
      const m = svg.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
      docs.push({
        svg,
        vbX: m ? Number(m[1]) : 0,
        vbY: m ? Number(m[2]) : 0,
        vbW: m ? Number(m[3]) : 595.28,
        vbH: m ? Number(m[4]) : 841.89,
      });
    }
    return docs;
  }, [score]);
}

interface JankoPagesProps {
  pages: JankoPageDoc[];
  /** Per-page overlay (playhead, markers) in the page's own pt coordinates. */
  overlay?: (pageIndex: number, doc: JankoPageDoc) => React.ReactNode;
  /** Click seeks: page index plus the click in page pt coordinates. */
  onPageClick?: (pageIndex: number, ptX: number, ptY: number) => void;
  /** Ref slots so the parent can measure pages for autoscroll. */
  pageRefs?: React.MutableRefObject<(HTMLDivElement | null)[]>;
  pageClassName?: string;
}

/**
 * The score as a vertical stack of full page SVGs.
 *
 * Overlays share each page's viewBox, so overlay ink in pt units aligns with
 * the engraving by construction at any rendered size.
 */
export const JankoPages: React.FC<JankoPagesProps> = ({
  pages,
  overlay,
  onPageClick,
  pageRefs,
  pageClassName = '',
}) => {
  return (
    <>
      {pages.map((doc, i) => (
        <div
          key={i}
          ref={(el) => {
            if (pageRefs) pageRefs.current[i] = el;
          }}
          className={`relative ${pageClassName}`}
          onClick={
            onPageClick
              ? (e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ptX =
                    doc.vbX + ((e.clientX - rect.left) / rect.width) * doc.vbW;
                  const ptY =
                    doc.vbY + ((e.clientY - rect.top) / rect.height) * doc.vbH;
                  onPageClick(i, ptX, ptY);
                }
              : undefined
          }
        >
          <div dangerouslySetInnerHTML={{ __html: doc.svg }} />
          {overlay && (
            <div className="janko-overlay pointer-events-none absolute inset-0">
              <svg
                viewBox={`${doc.vbX} ${doc.vbY} ${doc.vbW} ${doc.vbH}`}
                className="h-full w-full"
                aria-hidden="true"
              >
                {overlay(i, doc)}
              </svg>
            </div>
          )}
        </div>
      ))}
    </>
  );
};
