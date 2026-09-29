// Isolated PDF.js metadata reader: no page rendering, file writes or attachment extraction.
import { parentPort } from 'node:worker_threads';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

parentPort.on('message', async ({ bytes, maxPages, maxAttachments, maxAttachmentBytes }) => {
  const loading = getDocument({ data: bytes, useSystemFonts: false, stopAtErrors: true });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > maxPages) { parentPort.postMessage({ pages: pdf.numPages, note: 'page budget reached; attachments not inventoried' }); return; }
    const files = await pdf.getAttachments(); // EmbeddedFiles name tree, not all page annotations.
    const entries = Object.entries(files ?? {});
    if (entries.length > maxAttachments) { parentPort.postMessage({ pages: pdf.numPages, note: 'attachment count budget reached; attachments not inventoried' }); return; }
    let total = 0;
    const attachments = [];
    for (const [name, file] of entries) {
      const content = file.content;
      total += content.length;
      if (content.length > maxAttachmentBytes || total > maxAttachmentBytes) { parentPort.postMessage({ pages: pdf.numPages, note: 'attachment byte budget reached; attachments not inventoried' }); return; }
      attachments.push({ name, filename: file.filename, bytes: content.length, sha256: createHash('sha256').update(content).digest('hex') });
    }
    parentPort.postMessage({ pages: pdf.numPages, attachments, attachmentDiscovery: 'PDF.js EmbeddedFiles name tree only; page annotations not exhaustively searched' });
  } catch (error) { parentPort.postMessage({ parserError: String(error) }); }
  finally { void loading.destroy().catch(() => {}); }
});
