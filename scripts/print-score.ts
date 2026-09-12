#!/usr/bin/env node
/**
 * Network Laser Printing Pipeline for Isomorphic Horizontal System Scores
 *
 * Generates vector PostScript/PJL via rsvg-convert and streams the print job
 * over the local network via nacho-pi relay to the Brother HL-L3300CDW laser printer.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';
import { BENCHMARK_SCORES } from '../src/scores';
import { computeColumnarLayout, renderPageToSvg, renderAllPagesToSvg } from '../src/render/print-layout';

import { NoteheadMorphology, normalizeNoteheadMorphology } from '../src/render/types';

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
  morphology: NoteheadMorphology;
  colorMode: 'color' | 'mono';
}

function parseArgs(args: string[]): PrintOptions {
  const options: PrintOptions = {
    scoreId: 'bach-goldberg-var1',
    relayHost: 'nacho@100.118.214.29',
    printerIp: '192.168.4.62',
    printerPort: 9100,
    dryRun: true,
    direct: false,
    pjl: true,
    paperSize: 'letter',
    morphology: 'duodecimal',
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
    } else if (arg === '--morphology' && i + 1 < args.length) {
      options.morphology = normalizeNoteheadMorphology(args[++i]);
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
  --morphology <type>  Notehead style: 'rectangle-square' | 'duodecimal' | 'row-parity-shape' | 'phonetic'
  --mono               Force pure monochrome Black toner only (disengages CMY color drums)
  --direct             Stream directly over TCP without SSH relay
  --output <path>      Save output PostScript file to path
  --page <num>         Print only specific 0-indexed page (default: all)
  --no-pjl             Do not wrap PostScript in PJL headers
  --send               Transmit payload to network printer (default: dry-run)
  --dry-run            Generate vector SVGs & PostScript without sending to printer (default)
  -h, --help           Show this help message
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

export async function generateScorePostscript(
  scoreId: string,
  pageIndex?: number,
  paperSize: 'letter' | 'A4' = 'letter',
  morphology: NoteheadMorphology = 'duodecimal',
  colorMode: 'color' | 'mono' = 'color'
): Promise<{ psBuffer: Buffer; svgPaths: string[]; layout: ReturnType<typeof computeColumnarLayout> }> {
  const scoreBuilder = BENCHMARK_SCORES[scoreId];
  if (!scoreBuilder) {
    throw new Error(`Score '${scoreId}' not found in BENCHMARK_SCORES.`);
  }

  const score = scoreBuilder();
  const layout = computeColumnarLayout(score, {
    paperSize,
    staffStyle: 'tritone-split',
    noteheadMorphology: morphology,
  });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-print-'));
  const svgPaths: string[] = [];

  const pagesToRender = pageIndex !== undefined
    ? [pageIndex]
    : layout.pages.map((_, idx) => idx);

  for (const pIdx of pagesToRender) {
    let svg = renderPageToSvg(layout, pIdx);
    if (colorMode === 'mono') {
      svg = svg
        .replace(/#1D4ED8/g, '#111827')
        .replace(/#D97706/g, '#111827')
        .replace(/#BE123C/g, '#111827')
        .replace(/#1E293B/g, '#000000');
    }
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
  const options = parseArgs(process.argv.slice(2));

  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║     Isomorphic Score Network Laser Printing Pipeline         ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');

  console.log(`• Score:            ${options.scoreId}`);
  console.log(`• Target Printer:   Brother HL-L3300CDW (${options.printerIp}:${options.printerPort})`);
  console.log(`• Network Relay:    ${options.direct ? 'DIRECT (No relay)' : options.relayHost}`);
  console.log(`• Paper Format:     ${options.paperSize.toUpperCase()} (${options.paperSize === 'letter' ? '8.5 × 11 in' : '210 × 297 mm'})`);
  console.log(`• Morphology:       ${options.morphology}`);
  console.log(`• Color Mode:       ${options.colorMode.toUpperCase()}`);
  console.log(`• Layout:           4 Measures/System, 3 Systems/Page (Horizontal Landscape Urtext)`);
  console.log(`• Mode:             ${options.dryRun ? 'DRY-RUN (Simulated)' : 'PRODUCTION PRINT'}\n`);

  console.log('1. Computing horizontal system engraving layout...');
  const { psBuffer, svgPaths, layout } = await generateScorePostscript(
    options.scoreId,
    options.pageIndex,
    options.paperSize,
    options.morphology,
    options.colorMode
  );

  console.log(`   ✓ Total measures:  ${layout.totalMeasures} mm`);
  console.log(`   ✓ Total systems:   ${layout.systems.length} systems`);
  console.log(`   ✓ Total pages:     ${layout.pages.length} pages`);
  layout.pages.forEach((p, idx) => {
    console.log(`     - Page ${idx + 1}: ${p.sectionName} (${p.systems.length} systems)`);
  });

  console.log('\n2. Generating vector PostScript via rsvg-convert...');
  console.log(`   ✓ Rendered ${svgPaths.length} SVG page(s)`);
  console.log(`   ✓ PostScript document size: ${(psBuffer.length / 1024).toFixed(1)} KB`);

  // Prepare final print payload
  let payload = psBuffer;
  if (options.pjl) {
    payload = wrapInPjl(
      psBuffer,
      `${layout.score.title} - ${layout.score.composer}`,
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

  console.log('\n🎉 PRINT JOB COMPLETED SUCCESSFULLY! Laser printer is now imaging Section A & Section B.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('\n❌ Print pipeline failed:', err);
    process.exit(1);
  });
}
