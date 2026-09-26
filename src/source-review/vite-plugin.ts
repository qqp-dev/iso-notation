import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { SOURCE_DOCUMENTS, type SourceDocumentId } from './documents';

export const SOURCE_PDF_PREFIX = '/@janko-source-pdf/';
export const PDFJS_DECODER_PREFIX = '/@janko-pdfjs-wasm/';
// Fixed filenames from the installed, pinned pdfjs-dist release. Never map a
// request path onto the filesystem: neither this route nor the PDF endpoint is
// a general-purpose asset server.
const decoderFiles = [
  'jbig2.wasm', 'jbig2_nowasm_fallback.js',
  'openjpeg.wasm', 'openjpeg_nowasm_fallback.js',
  'qcms_bg.wasm', 'quickjs-eval.js', 'quickjs-eval.wasm',
] as const;
const decoderDir = fileURLToPath(new URL('../../node_modules/pdfjs-dist/wasm/', import.meta.url));

export async function validatePdfBytes(data: Uint8Array, expected: { bytes: number; sha256: string; pages: number }): Promise<void> {
  if (data.length !== expected.bytes || Buffer.from(data.subarray(0, 8)).toString('latin1').startsWith('%PDF-') === false ||
    createHash('sha256').update(data).digest('hex') !== expected.sha256) throw new Error('PDF identity/hash mismatch');
  const loading = getDocument({ data: new Uint8Array(data), useSystemFonts: false });
  try {
    const pdf = await loading.promise;
    try { if (pdf.numPages !== expected.pages) throw new Error('PDF page count mismatch'); }
    finally { await pdf.destroy(); }
  } finally { await loading.destroy(); }
}

/** No remote proxy, uploads, or user-provided paths. The cache is operator-provisioned. */
export function sourcePdfPlugin(options: { cache?: string; root?: string } = {}): Plugin {
  const root = resolve(options.root ?? process.cwd());
  const cache = resolve(options.cache ?? process.env.JANKO_SOURCE_PDF_CACHE ?? '/tmp/iso-janko-source-pdfs');
  // Resolving an absent cache is fine: requests return a document-specific 404.
  const inside = (parent: string, child: string) => {
    const rel = relative(parent, child);
    return rel !== '' && rel !== '..' && !rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(rel);
  };
  async function documentBytes(id: SourceDocumentId): Promise<Uint8Array> {
    const dir = await realpath(cache);
    const project = await realpath(root);
    if (dir === project || inside(project, dir) || inside(dir, project)) throw new Error('cache must be outside checkout');
    const file = resolve(dir, `${id}.pdf`);
    const actual = await realpath(file);
    if (!inside(dir, actual)) throw new Error('cache file escapes cache directory');
    const info = await stat(actual);
    if (!info.isFile()) throw new Error('not a regular PDF file');
    const data = await readFile(actual);
    await validatePdfBytes(data, SOURCE_DOCUMENTS[id]);
    return data;
  }
  return {
    name: 'janko-source-pdf-dev-only',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith(PDFJS_DECODER_PREFIX)) {
          const suffix = req.url.slice(PDFJS_DECODER_PREFIX.length);
          // Vite appends ?import to worker dynamic-import fallback modules.
          const name = suffix.endsWith('.js?import') ? suffix.slice(0, -'?import'.length) : suffix;
          if (!(decoderFiles as readonly string[]).includes(name) ||
            (suffix !== name && !name.endsWith('.js'))) {
            res.statusCode = 404; res.end('unknown PDF.js decoder'); return;
          }
          void readFile(resolve(decoderDir, name)).then((data) => {
            res.statusCode = 200;
            res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.end(data);
          }, () => {
            res.statusCode = 404; res.end('PDF.js decoder unavailable');
          });
          return;
        }
        if (!req.url?.startsWith(SOURCE_PDF_PREFIX)) return next();
        const id = req.url.slice(SOURCE_PDF_PREFIX.length);
        if (!Object.hasOwn(SOURCE_DOCUMENTS, id)) {
          res.statusCode = 404; res.end('unknown source document'); return;
        }
        void documentBytes(id as SourceDocumentId).then((data) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.end(data);
        }, (error: unknown) => {
          res.statusCode = (error as NodeJS.ErrnoException).code === 'ENOENT' ? 404 : 422;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(`${id}: ${error instanceof Error ? error.message : String(error)}`);
        });
      });
    },
    // Production remains independent of the private PDF cache. Ship only the
    // standard local decoder files, adjacent to the built studio entry.
    async generateBundle() {
      for (const name of decoderFiles) {
        const source = await readFile(resolve(decoderDir, name));
        this.emitFile({ type: 'asset', fileName: `assets/source-pdf-decoder/${name}`, source });
      }
    },
  };
}
