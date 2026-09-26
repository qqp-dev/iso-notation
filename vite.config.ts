import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

import { jankoPreparedStudioPlugin } from './src/render/janko/prepared/vite-plugin';
import { sourcePdfPlugin } from './src/source-review/vite-plugin';

// The static config (exported so tests can pin the prepared seam); Vite is
// handed the same object as the default.
export const viteConfig = {
  base: './',
  plugins: [react(), tailwindcss(), jankoPreparedStudioPlugin(), sourcePdfPlugin()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(process.cwd(), 'index.html'),
        // Two-view engraving studio (also mirrored verbatim into public/,
        // which is what the dev server hands to `/janko.html`). The views are
        // prepared by the real engine ahead of time (Round 49 §7): the shell
        // loads a thin viewer over content-addressed artifacts.
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
};

export default defineConfig(viteConfig);
