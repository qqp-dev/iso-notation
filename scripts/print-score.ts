#!/usr/bin/env node
/**
 * Network Laser Printing Pipeline for Canonical Jánko Scores
 *
 * Generates vector PostScript/PJL from the canonical Jánko page rendering
 * (`renderJankoPage`) and streams the print job over the local network via
 * nacho-pi relay to the Brother HL-L3300CDW laser printer.
 *
 * Letter: the existing canonical A4 pages are uniformly fit/centered within
 * printable Letter bounds (no reflow, no new notation system) with matching
 * output media and PJL. A4 passes through untouched. The frozen Bach
 * `scripts/export-pdf.ts` contract is preserved (untouched by this script).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import { BENCHMARK_SCORES } from '../src/scores';
import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
  buildBrahmsOp118No1Score,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
  type ResolvedJankoLayoutOptions,
  type ResolvedJankoTokens,
} from '../src/render/janko/types';
import {
  countJankoPages,
  layoutJankoScore,
  renderJankoPage,
} from '../src/render/janko/engine';
import type { QuantizedGridScore } from '../src/model/types';

/** US Letter sheet size in pt (8.5 × 11 in at 72 pt/in). */
export const LETTER_WIDTH_PT = 612;
export const LETTER_HEIGHT_PT = 792;
/** Canonical A4 page size in pt, matching `renderJankoPage`. */
export const A4_WIDTH_PT = 595.28;
export const A4_HEIGHT_PT = 841.89;
/** Printer unprintable margin (pt) framing the Letter printable bounds. */
export const PRINT_MARGIN_PT = 18;

export interface PrintScoreResolution {
  score: QuantizedGridScore;
  options: ResolvedJankoLayoutOptions;
  tokens: ResolvedJankoTokens;
  title: string;
}

/**
 * Canonical Jánko resolution for one printable benchmark score. Bach prints
 * the golden defaults; Brahms prints its fixed-3 golden const — the same
 * entries the studio Reference and the lint CLI engrave.
 */
export function resolvePrintScore(scoreId: string): PrintScoreResolution {
  if (scoreId === 'bach-goldberg-var1') {
    return {
      score: buildBachGoldbergVar1Score(),
      options: resolveJankoOptions(DEFAULT_JANKO_OPTIONS),
      tokens: resolveJankoTokens(DEFAULT_JANKO_TOKENS),
      title: 'Goldberg Variations, BWV 988: Var. 1',
    };
  }
  if (scoreId === 'brahms-op118-no1') {
    return {
      score: buildBrahmsOp118No1Score(),
      options: resolveJankoOptions(BRAHMS_OP118_NO1_JANKO_OPTIONS),
      tokens: resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS),
      title: 'Intermezzo in A minor, Op. 118 No. 1',
    };
  }
  const builder = BENCHMARK_SCORES[scoreId];
  if (!builder) throw new Error(`Score '${scoreId}' not found in BENCHMARK_SCORES.`);
  return {
    score: builder(),
    options: resolveJankoOptions(DEFAULT_JANKO_OPTIONS),
    tokens: resolveJankoTokens(DEFAULT_JANKO_TOKENS),
    title: scoreId,
  };
}

export interface LetterFit {
  /** Uniform scale factor (aspect-preserving). */
  scale: number;
  /** Absolute Letter-sheet origin of the scaled page (pt). */
  dx: number;
  dy: number;
}

/**
 * Uniform Letter fit for one canonical A4 page: the largest aspect-preserving
 * scale fitting the printable Letter bounds (Letter minus `PRINT_MARGIN_PT`
 * on every side), centered within those bounds. No reflow — pagination,
 * systems and measures are unchanged; only the sheet transform differs.
 */
export function letterFitForCanonicalPage(
  pageWidth: number = A4_WIDTH_PT,
  pageHeight: number = A4_HEIGHT_PT
): LetterFit {
  const printableW = LETTER_WIDTH_PT - 2 * PRINT_MARGIN_PT;
  const printableH = LETTER_HEIGHT_PT - 2 * PRINT_MARGIN_PT;
  const scale = Math.min(printableW / pageWidth, printableH / pageHeight);
  const dx = PRINT_MARGIN_PT + (printableW - pageWidth * scale) / 2;
  const dy = PRINT_MARGIN_PT + (printableH - pageHeight * scale) / 2;
  return { scale, dx, dy };
}

/**
 * Fit one canonical page SVG onto a Letter sheet: the page keeps its vector
 * content byte-for-byte inside a single translated+scaled group, and the
 * outer sheet declares Letter media. A4 input is detected from the SVG
 * viewBox; anything else passes through with its own media.
 */
export function fitCanonicalPageToLetter(svg: string): string {
  const open = /^<svg[^>]*>/m.exec(svg);
  if (!open) throw new Error('fitCanonicalPageToLetter: not an SVG document');
  const viewBox = /viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/.exec(open[0]);
  if (!viewBox) throw new Error('fitCanonicalPageToLetter: SVG has no viewBox');
  const pageWidth = Number(viewBox[3]);
  const pageHeight = Number(viewBox[4]);
  const { scale, dx, dy } = letterFitForCanonicalPage(pageWidth, pageHeight);
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${LETTER_WIDTH_PT} ${LETTER_HEIGHT_PT}" width="${LETTER_WIDTH_PT}pt" height="${LETTER_HEIGHT_PT}pt" style="background:#FFFFFF;">`;
  const rest = svg.slice(open[0].length);
  const defsClose = rest.indexOf('</defs>');
  const head = defsClose >= 0 ? rest.slice(0, defsClose + '</defs>'.length) : '';
  const body = defsClose >= 0 ? rest.slice(defsClose + '</defs>'.length) : rest;
  const close = body.lastIndexOf('</svg>');
  const inner = body.slice(0, close);
  return (
    `${sheet}${head}` +
    `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${scale.toFixed(5)})">${inner}</g></svg>`
  );
}

/**
 * Pure-monochrome mapping for laser toner: every chromatic hex ink becomes
 * its luminance gray (achromatic inks pass through unchanged, paper white
 * stays white). Canonical Jánko is achromatic by construction; this keeps
 * `--mono` an honest guarantee rather than an assumption.
 */
export function mapSvgToMono(svg: string): string {
  return svg.replace(/#([0-9A-Fa-f]{6})/g, (match, hex: string) => {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if (r === g && g === b) return match;
    const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    const gray = l.toString(16).padStart(2, '0');
    return `#${gray}${gray}${gray}`;
  });
}

interface PrintOptions {
  scoreId: string;
  relayHost: string;
  printerIp: string;
  printerPort: number;
  outputFile?: string;
  dryRun: boolean;
  direct: boolean;
  pjl: boolean;
  pageIndex?: number;
  paperSize: 'letter' | 'A4';
  colorMode: 'color' | 'mono';
}

export function parsePrintArgs(args: string[]): PrintOptions {
  const options: PrintOptions = {
    scoreId: 'bach-goldberg-var1',
    relayHost: 'nacho@100.118.214.29',
    printerIp: '192.168.4.62',
    printerPort: 9100,
    dryRun: true,
    direct: false,
    pjl: true,
    paperSize: 'letter',
    colorMode: 'color',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--send' || arg === '--no-dry-run') {
      options.dryRun = false;
    } else if (arg === '--direct') {
      options.direct = true;
    } else if (arg === '--no-pjl') {
      options.pjl = false;
    } else if (arg === '--score' && i + 1 < args.length) {
      options.scoreId = args[++i];
    } else if (arg === '--relay' && i + 1 < args.length) {
      options.relayHost = args[++i];
    } else if (arg === '--printer' && i + 1 < args.length) {
      options.printerIp = args[++i];
    } else if (arg === '--port' && i + 1 < args.length) {
      options.printerPort = parseInt(args[++i], 10);
    } else if (arg === '--output' && i + 1 < args.length) {
      options.outputFile = args[++i];
    } else if (arg === '--page' && i + 1 < args.length) {
      options.pageIndex = parseInt(args[++i], 10);
    } else if (arg === '--paper' && i + 1 < args.length) {
      options.paperSize = args[++i].toLowerCase() === 'a4' ? 'A4' : 'letter';
    } else if (arg === '--morphology' || arg.startsWith('--morphology=')) {
      throw new Error(
        'Notehead morphology switching is retired: print runs the canonical Jánko engraving only.'
      );
    } else if (arg === '--mono' || arg === '--monochrome') {
      options.colorMode = 'mono';
    } else if (arg === '--color') {
      options.colorMode = 'color';
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`
Usage: npx tsx scripts/print-score.ts [options]

Options:
  --score <id>         Score ID to print (default: 'bach-goldberg-var1')
  --printer <ip>       Printer IP address (default: '192.168.4.62')
  --port <port>        Printer RAW port (default: 9100)
  --relay <user@host>  SSH relay host (default: 'nacho@100.118.214.29')
  --paper <letter|a4>  Paper format (default: 'letter' for US printer tray)
  --mono               Force pure monochrome Black toner only (disengages CMY color drums)
  --direct             Stream directly over TCP without SSH relay
  --output <path>      Save output PostScript file to path
  --page <num>         Print only specific 0-indexed page (default: all)
  --no-pjl             Do not wrap PostScript in PJL headers
  --send               Transmit payload to network printer (default: dry-run)
  --dry-run            Generate vector SVGs & PostScript without sending to printer (default)
  -h, --help           Show this help message

Notes:
  Pages are the canonical Jánko engraving (portrait). Letter fits/scales the
  existing pages within printable Letter bounds; A4 passes through untouched.
  Notehead morphology switching is retired (canonical engraving only).
`);
}

export function wrapInPjl(
  postscriptData: Buffer,
  jobName: string = 'Isomorphic Score',
  paperSize: 'letter' | 'A4' = 'letter',
  colorMode: 'color' | 'mono' = 'color'
): Buffer {
  const isMono = colorMode === 'mono';
  const pjlHeader = Buffer.from(
    `\x1b%-12345X@PJL\r\n` +
    `@PJL JOB NAME = "${jobName}"\r\n` +
    `@PJL SET PAPER = ${paperSize === 'A4' ? 'A4' : 'LETTER'}\r\n` +
    `@PJL SET ORIENTATION = PORTRAIT\r\n` +
    `@PJL SET PRINTQUALITY = HIGH\r\n` +
    `@PJL SET RESOLUTION = 1200\r\n` +
    `@PJL SET ECONOMODE = OFF\r\n` +
    `@PJL SET RENDERMODE = ${isMono ? 'GRAYSCALE' : 'COLOR'}\r\n` +
    `@PJL SET COLORMODE = ${isMono ? 'MONO' : 'COLOR'}\r\n` +
    `@PJL ENTER LANGUAGE = POSTSCRIPT\r\n`,
    'binary'
  );
  const pjlFooter = Buffer.from(
    `\x1b%-12345X@PJL EOJ\r\n` +
    `\x1b%-12345X`,
    'binary'
  );
  return Buffer.concat([pjlHeader, postscriptData, pjlFooter]);
}

export interface CanonicalPrintLayout {
  totalMeasures: number;
  totalSystems: number;
  totalPages: number;
  pages: Array<{ systems: number[] }>;
  title: string;
}

export async function generateScorePostscript(
  scoreId: string,
  pageIndex?: number,
  paperSize: 'letter' | 'A4' = 'letter',
  colorMode: 'color' | 'mono' = 'color'
): Promise<{ psBuffer: Buffer; svgPaths: string[]; layout: CanonicalPrintLayout }> {
  const { score, options, tokens, title } = resolvePrintScore(scoreId);
  const layouts = layoutJankoScore(score, options, tokens);
  const totalPages = countJankoPages(score, options, tokens);
  const layout: CanonicalPrintLayout = {
    totalMeasures: Math.max(1, Math.ceil((score.totalTicks || 0) / tokens.ticksPerMeasure)),
    totalSystems: layouts.length,
    totalPages,
    pages: Array.from({ length: totalPages }, (_, page) => ({
      systems: layouts
        .map((l, index) => ({ l, index }))
        .filter(({ index }) => Math.floor(index / options.systemsPerPage) === page)
        .map(({ index }) => index),
    })),
    title,
  };

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-print-'));
  const svgPaths: string[] = [];

  const pagesToRender = pageIndex !== undefined
    ? [pageIndex]
    : Array.from({ length: totalPages }, (_, idx) => idx);

  for (const pIdx of pagesToRender) {
    let svg = renderJankoPage(score, pIdx, options, tokens);
    if (paperSize === 'letter') svg = fitCanonicalPageToLetter(svg);
    if (colorMode === 'mono') svg = mapSvgToMono(svg);
    const svgPath = path.join(tmpDir, `page-${pIdx + 1}.svg`);
    fs.writeFileSync(svgPath, svg, 'utf-8');
    svgPaths.push(svgPath);
  }

  // Convert SVGs to multi-page PDF via rsvg-convert (-d 72 -p 72 for PostScript 72 pt/in points),
  // then PDF to Level 3 vector PostScript via pdftops.
  // We strictly enforce -rasterize never so Cairo/pdftops will never fallback to a blurry bitmap.
  const pdfPath = path.join(tmpDir, 'score.pdf');
  const psPath = path.join(tmpDir, 'score.ps');
  const rsvgCmd = `rsvg-convert -d 72 -p 72 -f pdf -o "${pdfPath}" ${svgPaths.map(p => `"${p}"`).join(' ')}`;
  execSync(rsvgCmd, { stdio: 'pipe' });
  const pdftopsCmd = `pdftops -level3 -origpagesizes -rasterize never "${pdfPath}" "${psPath}"`;
  execSync(pdftopsCmd, { stdio: 'pipe' });

  const psBuffer = fs.readFileSync(psPath);
  return { psBuffer, svgPaths, layout };
}

async function main(): Promise<void> {
  const options = parsePrintArgs(process.argv.slice(2));

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     Isomorphic Score Network Laser Printing Pipeline         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`• Score:            ${options.scoreId}`);
  console.log(`• Target Printer:   Brother HL-L3300CDW (${options.printerIp}:${options.printerPort})`);
  console.log(`• Network Relay:    ${options.direct ? 'DIRECT (No relay)' : options.relayHost}`);
  console.log(`• Paper Format:     ${options.paperSize.toUpperCase()} (${options.paperSize === 'letter' ? '8.5 × 11 in' : '210 × 297 mm'})`);
  console.log(`• Engraving:        canonical Jánko (fixed-3)`);
  console.log(`• Color Mode:       ${options.colorMode.toUpperCase()}`);
  console.log(`• Mode:             ${options.dryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION PRINT'}\n`);

  console.log('1. Computing canonical Jánko page engraving...');
  const { psBuffer, svgPaths, layout } = await generateScorePostscript(
    options.scoreId,
    options.pageIndex,
    options.paperSize,
    options.colorMode
  );

  console.log(`   ✓ Total measures:  ${layout.totalMeasures} mm`);
  console.log(`   ✓ Total systems:   ${layout.totalSystems} systems`);
  console.log(`   ✓ Total pages:     ${layout.totalPages} pages`);
  layout.pages.forEach((p, idx) => {
    console.log(`     - Page ${idx + 1}: systems ${p.systems.map((s) => s + 1).join(', ')}`);
  });

  console.log('\n2. Generating vector PostScript via rsvg-convert...');
  console.log(`   ✓ Rendered ${svgPaths.length} SVG page(s)`);
  console.log(`   ✓ PostScript document size: ${(psBuffer.length / 1024).toFixed(1)} KB`);

  // Prepare final print payload
  let payload = psBuffer;
  if (options.pjl) {
    payload = wrapInPjl(
      psBuffer,
      layout.title,
      options.paperSize,
      options.colorMode
    );
    console.log(`   ✓ Wrapped in PJL container (${(payload.length / 1024).toFixed(1)} KB)`);
  }

  // Save to output file if requested
  if (options.outputFile) {
    fs.writeFileSync(options.outputFile, payload);
    console.log(`   ✓ Saved PostScript job to: ${options.outputFile}`);
  }

  if (options.dryRun) {
    console.log('\n✨ DRY RUN complete. Zero bytes sent to network printer.');
    return;
  }

  console.log('\n3. Transmitting print job to Brother HL-L3300CDW...');
  if (options.direct) {
    console.log(`   Connecting directly to ${options.printerIp}:${options.printerPort}...`);
    // Direct TCP streaming via net.Socket
    await new Promise<void>((resolve, reject) => {
      const socket = new (require('net').Socket)();
      socket.connect(options.printerPort, options.printerIp, () => {
        console.log('   Connected to printer port 9100. Streaming payload...');
        socket.write(payload, () => {
          socket.end();
        });
      });
      socket.on('close', () => {
        console.log('   ✓ Connection closed. Job submitted successfully.');
        resolve();
      });
      socket.on('error', (err: Error) => {
        reject(err);
      });
    });
  } else {
    console.log(`   Relaying via SSH to ${options.relayHost}...`);
    const sshCmd = `ssh -o BatchMode=yes -o ConnectTimeout=10 ${options.relayHost} "nc -w 15 ${options.printerIp} ${options.printerPort}"`;

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('bash', ['-c', sshCmd], { stdio: ['pipe', 'inherit', 'inherit'] });
      proc.stdin.write(payload);
      proc.stdin.end();

      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`   ✓ Streamed ${(payload.length / 1024).toFixed(1)} KB via ${options.relayHost} to ${options.printerIp}:${options.printerPort}.`);
          resolve();
        } else {
          reject(new Error(`SSH relay command exited with code ${code}`));
        }
      });
      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  console.log('\n🎉 PRINT JOB COMPLETED SUCCESSFULLY!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('\n❌ Print pipeline failed:', err);
    process.exit(1);
  });
}
