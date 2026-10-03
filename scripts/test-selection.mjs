/** Declared behavior coverage, not an assertion that a focused run is exhaustive. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, resolve } from 'node:path';

export const FAST_FILES = [
  'test/pitch.test.ts', 'test/grid.test.ts', 'test/phonetics.test.ts',
  'test/notation-variations.test.ts', 'test/test-harness.test.ts',
  'test/public-release.test.ts', 'test/janko-reference-reader.test.ts',
];
const groups = {
  tooling: ['test/test-harness.test.ts', 'test/public-release.test.ts'],
  ui: ['test/public-release.test.ts', 'test/janko-reference-reader.test.ts', 'test/janko-prepared-viewer.test.ts'],
  reader: ['test/janko-reference-reader.test.ts', 'test/janko-prepared-viewer.test.ts', 'test/janko-studio-session.test.ts', 'test/janko-published-source.test.ts'],
  prepared: ['test/janko-prepared-studio.test.ts', 'test/janko-prepared-hmr.test.ts'],
  runtime: ['test/pitch.test.ts', 'test/scores.test.ts', 'test/janko-render-performance.test.ts', 'test/janko-prepared-viewer.test.ts', 'test/janko-practice-package.test.ts'],
  compiler: ['test/janko-prepared-viewer.test.ts', 'test/janko-reference-reader.test.ts', 'test/janko-practice-package.test.ts'],
  model: ['test/pitch.test.ts', 'test/grid.test.ts', 'test/scores.test.ts', 'test/brahms-written-durations.test.ts', 'test/schumann-no14-import.test.ts', 'test/schumann-no30-import.test.ts', 'test/schumann-no43-import.test.ts', 'test/schumann-no43-repeat-edge.test.ts'],
  source: ['test/scores.test.ts', 'test/brahms-written-durations.test.ts', 'test/brahms-expressions.test.ts', 'test/schumann-no14-import.test.ts', 'test/schumann-source-slurs.test.ts', 'test/schumann-no30-import.test.ts', 'test/schumann-no43-import.test.ts', 'test/schumann-no43-repeat-edge.test.ts'],
  engraving: ['test/janko-render-performance.test.ts', 'test/janko-engraving.test.ts', 'test/janko-linter.test.ts', 'test/janko-layout-reuse.test.ts', 'test/janko-no14-gold.test.ts'],
  studio: ['test/janko-studio.test.ts', 'test/janko-layout-reuse.test.ts', 'test/janko-candidates.test.ts'],
  release: ['test/active-score-release.test.ts', 'test/public-release.test.ts'],
  pdf: ['test/janko-pdf.test.ts', 'test/janko-no14-gold.test.ts', 'test/janko-no14-pdf.test.ts'],
  practice: ['test/janko-practice.test.ts', 'test/janko-practice-package.test.ts'],
  research: ['test/source-route-inventory.test.ts', 'test/janko-source-review.test.ts', 'test/source-relative-expression.test.ts'],
  anchors: ['test/janko-anchor-solver.test.ts'],
  reading: ['test/janko-no14-relative.test.ts', 'test/janko-no14-gesture-relative.test.ts', 'test/janko-no14-open-reading.test.ts'],
  written: ['test/schumann-no14-import.test.ts', 'test/janko-no14-written.test.ts', 'test/janko-no14-open-reading.test.ts'],
  publication: ['test/janko-no14-gold.test.ts', 'test/janko-published-source.test.ts'],
  comparison: ['test/janko-published-source.test.ts'],
};

/** Changed test seams use representative cases; source contracts remain unfiltered. */
const REPRESENTATIVE_CASES = {
  'test/janko-round37.test.ts': 'Criterion 7: Studio candidates view',
  'test/janko-round38.test.ts': 'Criterion 1:',
  'test/janko-round39.test.ts': 'Candidate registry:|Round 39 metadata:|Round 38 parked record:|Studio candidate windows:',
  'test/janko-round41.test.ts': 'Round 41 metadata:|Round 41 registry:|Round 41 cards share',
  'test/janko-layout-reuse.test.ts': 'Output equivalence: Full page spread|Fresh data/options/tokens: candidate configurations remain separate',
  'test/janko-studio.test.ts': 'Parked Round 39 renders the three abstract cards',
  'test/janko-round46.test.ts': 'A. Literal-mode ink stays clean|Page-loop ownership:',
};

export function validateSelectedFiles(files, discovered) {
  if (!files.length) throw new Error('empty test selection; request a declared profile or existing --files');
  const available = new Set(discovered), seen = new Set();
  for (const file of files) {
    if (!available.has(file)) throw new Error('unknown or missing selected test: ' + file);
    if (seen.has(file)) throw new Error('duplicate selected test: ' + file);
    seen.add(file);
  }
  return [...files].sort();
}

/** Resolve only literal local imports; execution/read-file dependencies use declared groups. */
export function testDependencies(projectRoot) {
  const graph = new Map();
  function visit(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) visit(path);
      else if (e.isFile() && /\.tsx?$/.test(e.name)) {
        const name = relative(projectRoot, path).split('\\').join('/');
        const dependencies = [];
        const text = readFileSync(path, 'utf8');
        for (const match of text.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)[\'"](\.[^\'"]+)[\'"]/g)) {
          const stem = posix.normalize(posix.join(posix.dirname(name), match[1]));
          const variants = [stem, stem.replace(/\.js$/, '.ts'), stem + '.ts', stem + '.tsx', stem + '/index.ts'];
          const target = variants.find(p => existsSync(resolve(projectRoot, p)));
          dependencies.push(target ?? stem);
        }
        graph.set(name, dependencies);
      }
    }
  }
  visit(join(projectRoot, 'test'));
  return graph;
}

function dependsOn(graph, file, target, visited = new Set()) {
  if (file === target) return true;
  if (visited.has(file)) return false;
  visited.add(file);
  return (graph.get(file) ?? []).some(dep => dependsOn(graph, dep, target, visited));
}

function area(path) {
  if (/^(?:docs\/|openspec\/|\.agents\/|README(?:\.md)?$|AGENTS\.md$|LICENSE|NOTICE)/.test(path)) return 'documentation';
  if (/^package(?:-lock)?\.json$/.test(path)) return 'runtime';
  if (/^(?:tsconfig\.json|vite\.config\.ts)$/.test(path)) return 'compiler';
  if (/^(?:scripts\/(?:(?:run-tests|test-selection)\.mjs|test-feedback-scope\.json)$|scripts\/verify-data-release\.ts$|\.github\/workflows\/)/.test(path)) return 'tooling';
  if (/^(?:src\/ui\/|src\/main\.tsx$|src\/(?:style|index)\.css$|index\.html$|public\/img\/)/.test(path)) return 'ui';
  if (/^(?:janko\.html$|public\/janko\.html$|src\/render\/janko\/studio-session\.ts$|src\/render\/janko\/prepared\/(?:viewer|reference-reader|deployed|status)\.ts$)/.test(path)) return 'reader';
  if (/^(?:src\/render\/janko\/prepared\/|scripts\/generate-prepared-studio\.ts$)/.test(path)) return 'prepared';
  if (/^src\/model\//.test(path)) return 'model';
  if (path === 'src/scores/data/active-scores.json') return 'release';
  if (/^(?:src\/scores\/|public\/midi\/)/.test(path)) return 'source';
  if (/^(?:src\/render\/janko\/(?:studio|candidates)\.ts$)/.test(path)) return 'studio';
  if (/^(?:src\/render\/janko\/(?:active-|semantic-hand)|data\/|scripts\/(?:publish-active|semantic-hand|active-score)\.ts$)/.test(path)) return 'release';
  if (/^(?:scripts\/(?:export|print).*\.ts$|public\/fonts\/|public\/.*\.(?:pdf|pdf\.manifest\.json|pdf\.notices\.txt)$)/.test(path)) return 'pdf';
  if (/^(?:src\/render\/janko\/practice|scripts\/build-practice\.mjs$)/.test(path)) return 'practice';
  if (path === 'src/render/janko/anchor-solver.ts') return 'anchors';
  if (/^src\/render\/janko\/(?:no14-(?:gesture-)?relative|reading-reference)\.ts$/.test(path)) return 'reading';
  if (path === 'src/render/janko/no14-written.ts') return 'written';
  if (/^src\/render\/janko\/no14-published(?:\.ts|-profile\.json)$/.test(path)) return 'publication';
  if (/^src\/source-review\/(?:prepared-comparison|published-state)\.ts$/.test(path)) return 'comparison';
  if (/^(?:src\/source-review\/|src\/render\/janko\/source|scripts\/(?:source|brahms-export))/.test(path)) return 'research';
  if (/^src\/render\/janko\//.test(path)) return 'engraving';
  return undefined;
}

export function packageArea(before, after) {
  let oldPackage, newPackage;
  try { oldPackage = JSON.parse(before); newPackage = JSON.parse(after); }
  catch { throw new Error('cannot classify invalid before/head package.json'); }
  if (!oldPackage || !newPackage || typeof oldPackage !== 'object' || typeof newPackage !== 'object')
    throw new Error('invalid before/head package.json object');
  const withoutScripts = ({ scripts, ...rest }) => rest;
  if (JSON.stringify(withoutScripts(oldPackage)) !== JSON.stringify(withoutScripts(newPackage))) return 'runtime';
  const nonTestScripts = scripts => Object.fromEntries(Object.entries(scripts ?? {}).filter(([key]) => !/^test(?::|$)/.test(key)));
  if (JSON.stringify(nonTestScripts(oldPackage.scripts)) !== JSON.stringify(nonTestScripts(newPackage.scripts))) return 'compiler';
  return 'tooling';
}

export function packageCoverage(projectRoot, base, head, paths) {
  if (!paths.includes('package.json')) return undefined;
  const git = ref => execFileSync('git', ['show', ref + ':package.json'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try { return packageArea(git(base), git(head)); }
  catch (error) { throw new Error('package release coverage refused: ' + error.message); }
}

export function releasePlan(paths, discovered, dependencies = new Map(), reviewed = {}, packageDomain) {
  if (packageDomain !== undefined && !['tooling', 'compiler', 'runtime'].includes(packageDomain)) throw new Error('invalid package coverage area');
  const files = new Set(FAST_FILES), wholeFiles = new Set(FAST_FILES), coverage = [], uncovered = [], patterns = {};
  for (const path of [...new Set(paths)].sort()) {
    if (!path || path.startsWith('/') || path.split('/').includes('..')) throw new Error('invalid changed path: ' + path);
    if (path.startsWith('test/')) {
      const consumers = discovered.filter(file => dependsOn(dependencies, file, path));
      if (!consumers.length) uncovered.push(path);
      else {
        consumers.forEach(file => { files.add(file); if (reviewed[file]) patterns[file] = reviewed[file]; });
        coverage.push({ path, area: 'test dependency', checks: consumers });
      }
      continue;
    }
    const domain = path === 'package.json' && packageDomain !== undefined ? packageDomain : area(path);
    if (!domain) { uncovered.push(path); continue; }
    let checks = groups[domain] ?? [];
    // A literal score name narrows the source contract; shared source/model files retain all imports.
    if (domain === 'source') {
      const score = /schumann.*no[-_]?43/i.test(path) ? 'no43' : /schumann.*no[-_]?30/i.test(path) ? 'no30' : /schumann.*no[-_]?14/i.test(path) ? 'no14' : undefined;
      if (score) checks = ['test/scores.test.ts', ...checks.filter(file => file.includes('schumann-' + score))];
      else if (/brahms/i.test(path)) checks = checks.filter(file => !/schumann/.test(file));
      else if (/bach/i.test(path)) checks = ['test/scores.test.ts', 'test/bach-semantic-hand.test.ts', 'test/bach-gold-hand-engraving.test.ts'];
    }
    checks.forEach(file => { files.add(file); wholeFiles.add(file); });
    coverage.push({ path, area: domain, checks });
  }
  if (uncovered.length) throw new Error('unmapped changed paths: ' + uncovered.join(', ') +
    '; declare the affected coverage or choose explicit --files / --full after reviewing the risk. No full run was started.');
  // The reviewed extraction is test/tooling-only. Any actual product/runtime
  // change makes the affected historical files unfiltered, even if its own
  // declared contract cohort happens not to contain those files.
  if (coverage.some(c => !['test dependency', 'tooling', 'documentation'].includes(c.area))) {
    for (const file of Object.keys(patterns)) delete patterns[file];
  } else for (const file of wholeFiles) delete patterns[file];
  return { patterns, scope: 'focused release', files: validateSelectedFiles([...files], discovered), coverage,
    needsEngravingLint: coverage.some(c => ['model', 'source', 'engraving', 'studio', 'prepared', 'release', 'pdf', 'reading', 'written', 'publication'].includes(c.area)),
    needsScoreTools: coverage.some(c => ['source', 'engraving', 'studio', 'prepared', 'release', 'pdf', 'publication'].includes(c.area)) };
}

/** Byte-guarded one-time transformation; any subsequent fixture/body edit is unfiltered. */
export function reviewedPatterns(projectRoot, base, head, runGit) {
  const git = runGit ?? (args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  let raw, manifest;
  try { raw = git(['show', head + ':scripts/test-feedback-scope.json']); }
  catch { return {}; } // No reviewed extraction at this head: ordinary affected-file coverage.
  try { manifest = JSON.parse(raw); }
  catch { throw new Error('invalid reviewed test-feedback transformation JSON'); }
  if (manifest.schema !== 1 || !Array.isArray(manifest.files) || !manifest.files.length)
    throw new Error('invalid reviewed test-feedback transformation manifest');
  const required = [...Object.keys(REPRESENTATIVE_CASES), ...[37, 38, 39, 41].map(n => 'test/support/round' + n + '-fixtures.ts')].sort();
  if (JSON.stringify(manifest.files.map(file => file.path).sort()) !== JSON.stringify(required))
    throw new Error('reviewed test-feedback transformation must account for every original/final fixture consumer');
  for (const file of manifest.files) {
    if (!/^test\/[\w./-]+\.ts$/.test(file.path) || file.path.split('/').includes('..') ||
        !/^[a-f0-9]{64}$/.test(file.after) || (file.before !== null && !/^[a-f0-9]{64}$/.test(file.before)))
      throw new Error('invalid reviewed test-feedback file identity');
    for (const [ref, hash] of [[base, file.before], [head, file.after]]) {
      let blob;
      try { blob = git(['show', ref + ':' + file.path]); }
      catch { if (hash === null) continue; return {}; }
      if (hash === null || createHash('sha256').update(blob).digest('hex') !== hash) return {};
    }
  }
  return { ...REPRESENTATIVE_CASES };
}

/** Both rename endpoints/deletions belong to the complete pushed before/head range. */
export function changedPaths(projectRoot, base, head, runGit) {
  if (!base || !head || /^0+$/.test(base)) throw new Error('release selection requires an available pushed --base and --head; choose an explicit reviewed scope for an initial push');
  const git = runGit ?? (args => execFileSync('git', args, { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  for (const ref of [base, head]) {
    if (ref.startsWith('-')) throw new Error('invalid Git reference: ' + ref);
    try { git(['rev-parse', '--verify', ref + '^{commit}']); }
    catch { throw new Error('unavailable release reference: ' + ref + '; fetch the actual range or request an explicit reviewed scope'); }
  }
  return git(['diff', '--name-only', '--no-renames', '-z', base, head, '--']).split('\0').filter(Boolean).sort();
}

export function parseRequest(args) {
  const request = { mode: 'fast', files: [], list: false };
  let chosen;
  const mode = value => { if (chosen) throw new Error('incompatible or duplicate test modes'); chosen = value; request.mode = value; };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--fast' || arg === '--full' || arg === '--release' || arg === '--files') { mode(arg.slice(2)); continue; }
    if (arg === '--list') { if (request.list) throw new Error('duplicate --list'); request.list = true; continue; }
    if (arg === '--base' || arg === '--head' || arg === '--name-pattern') {
      const key = { '--base': 'base', '--head': 'head', '--name-pattern': 'pattern' }[arg];
      if (request[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('missing/duplicate value for ' + arg);
      request[key] = args[++i]; continue;
    }
    if (arg.startsWith('-') || request.mode !== 'files') throw new Error('unknown argument: ' + arg);
    request.files.push(arg);
  }
  if (request.mode === 'files' && !request.files.length) throw new Error('--files requires existing test paths');
  if (request.mode === 'release' && (!request.base || !request.head)) throw new Error('--release requires the actual --base and --head');
  if (request.mode !== 'release' && (request.base || request.head)) throw new Error('--base/--head require --release');
  if (request.pattern !== undefined) {
    if (request.mode !== 'files') throw new Error('--name-pattern is only supported with explicit --files');
    try { new RegExp(request.pattern); } catch { throw new Error('invalid --name-pattern'); }
  }
  return request;
}
