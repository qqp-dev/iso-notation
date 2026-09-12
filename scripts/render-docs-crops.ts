#!/usr/bin/env node
/**
 * Regenerates the definitive documentation crops for the horizontal portrait engraving.
 *
 * Usage: npx tsx scripts/render-docs-crops.ts
 *
 * Produces:
 *   docs/img/definitive_m1_m2.png            (accolade + opening position of honor)
 *   docs/img/definitive_m4.png               (RH-in-bass upward chevrons)
 *   docs/img/definitive_m6.png               (continuous Middle C hold line)
 *   docs/img/definitive_m30.png              (LH-in-treble downward chevrons)
 *   docs/img/horizontal_portrait_page1.png   (full first page of the 2-page spread)
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  ColumnarScoreLayout,
  computeColumnarLayout,
  getSystemGeometry,
  renderPageToSvg,
} from '../src/render/print-layout';

const OUT_DIR = path.resolve('docs/img');
const CROP_PIXELS_PER_PT = 4; // ≈ 288 DPI for the macro crops
const PAGE_PIXELS_PER_PT = 2; // ≈ 144 DPI for the full-page figure

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Re-roots a rendered page SVG inside a cropped viewBox without rasterizing. */
function cropSvg(pageSvg: string, box: CropBox, pixelsPerPt: number): string {
  const inner = pageSvg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '');
  const width = Math.round(box.w * pixelsPerPt);
  const height = Math.round(box.h * pixelsPerPt);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box.x.toFixed(2)} ${box.y.toFixed(2)} ${box.w.toFixed(2)} ${box.h.toFixed(2)}" width="${width}" height="${height}">`,
    inner,
    `</svg>`,
  ].join('\n');
}

function rasterize(svg: string, outPath: string): void {
  const tmpPath = path.join(os.tmpdir(), `iso-docs-${path.basename(outPath)}.svg`);
  fs.writeFileSync(tmpPath, svg, 'utf-8');
  execFileSync('rsvg-convert', ['-f', 'png', '-o', outPath, tmpPath]);
  fs.rmSync(tmpPath, { force: true });
}

interface CropPad {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/** Crop box spanning a run of measures of one system (incl. measure numbers and chevrons). */
function measureBox(
  layout: ColumnarScoreLayout,
  pageIndex: number,
  systemOnPageIndex: number,
  firstMeasureIndex: number,
  measureCount: number,
  pad: CropPad = {}
): CropBox {
  const top = pad.top ?? 18;
  const bottom = pad.bottom ?? 10;
  const left = pad.left ?? 6;
  const right = pad.right ?? 6;
  const geo = getSystemGeometry(layout, pageIndex, systemOnPageIndex);
  const x = geo.xForMeasureStart(firstMeasureIndex) - left;
  const x2 = geo.xForMeasureStart(firstMeasureIndex + measureCount) + right;
  const y = geo.staffTopY - top;
  const y2 = geo.staffBotY + bottom;
  return { x, y, w: x2 - x, h: y2 - y };
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const score = buildBachGoldbergVar1Score();
  const layout = computeColumnarLayout(score);
  const pages = layout.pages.map((_, idx) => renderPageToSvg(layout, idx));

  const write = (name: string, pageIndex: number, box: CropBox, pixelsPerPt: number = CROP_PIXELS_PER_PT): void => {
    const outPath = path.join(OUT_DIR, name);
    rasterize(cropSvg(pages[pageIndex], box, pixelsPerPt), outPath);
    console.log(`  ✓ ${name} (${Math.round(box.w * pixelsPerPt)} × ${Math.round(box.h * pixelsPerPt)}px)`);
  };

  console.log('Rendering horizontal portrait documentation crops...');

  // Measures 1–2: vertical accolade, opening halo, clean measure numbering
  write('definitive_m1_m2.png', 0, measureBox(layout, 0, 0, 0, 2, { left: 22, right: 8 }));

  // Measure 4: RH-in-bass upward chevrons
  write('definitive_m4.png', 0, measureBox(layout, 0, 0, 3, 1, { left: 8, right: 8 }));

  // Measure 6: continuous Royal Blue Middle C hold line (system 2 of page 1)
  write('definitive_m6.png', 0, measureBox(layout, 0, 1, 1, 1, { left: 8, right: 8 }));

  // Measure 30: LH-in-treble downward chevrons (system 8 → page 2, system slot 4)
  write('definitive_m30.png', 1, measureBox(layout, 1, 3, 1, 1, { left: 8, right: 8 }));

  // Full first page of the 2-page zero-turn spread
  write(
    'horizontal_portrait_page1.png',
    0,
    { x: 0, y: 0, w: layout.pageDimensions.widthPt, h: layout.pageDimensions.heightPt },
    PAGE_PIXELS_PER_PT
  );
}

main();
