import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'index.html'),
        // Legacy workbench (duodecimal canvas, piano roll, MIDI ingest),
        // preserved for existing users while index.html is the public face.
        classic: path.resolve(process.cwd(), 'classic.html'),
        // Two-view live engraving studio (also mirrored verbatim into public/,
        // which is what the dev server hands to `/janko.html`).
        janko: path.resolve(process.cwd(), 'janko.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
  },
});
