/**
 * Thin CLI over the prepared-studio generator: engrave both studio views with
 * the real engine and print the generation identity (Round 49 §7). The Vite
 * plugin is the delivery seam — this command exists for verification only
 * (determinism probes, artifact inspection) and writes nothing by default.
 */

import { generatePreparedStudio } from '../src/render/janko/prepared/generate';

const generation = generatePreparedStudio();
process.stdout.write(
  JSON.stringify(
    {
      generation: generation.generation,
      artifactHashes: generation.artifactHashes,
      status: generation.status,
      sizes: {
        candidates: generation.artifacts.candidates.length,
        reference: generation.artifacts.reference.length,
      },
    },
    null,
    2
  ) + '\n'
);
