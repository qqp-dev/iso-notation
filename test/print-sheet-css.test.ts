import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * Structural pin for the phone-print shrink bug: the `@media print` sizing
 * of `.janko-page` / `.janko-page svg` MUST use absolute paper units (`mm`).
 * Relative widths (`%`/`vw`) resolve against the phone layout viewport in
 * mobile print pipelines, printing the narrow phone column unscaled in the
 * sheet's top-left corner — identical on Letter and A4.
 *
 * Reads the source `src/index.css` (never the built bundle). Set
 * `PRINT_CSS_UNDER_TEST` to point at an alternate file (e.g. pre-fix CSS
 * from `git show HEAD:src/index.css`) to prove fail-before.
 */
function readCssUnderTest(): { css: string; label: string } {
  const override = process.env.PRINT_CSS_UNDER_TEST;
  const cssPath = override ?? path.join(HERE, '..', 'src', 'index.css');
  return { css: fs.readFileSync(cssPath, 'utf8'), label: cssPath };
}

/** Strip `/* ... *\/` comments so prose mentioning units can't trip the pins. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Extract the inner text of the first `@media <name> { ... }` block. */
function mediaBlock(css: string, name: 'print' | 'screen'): string {
  const start = css.indexOf(`@media ${name}`);
  assert.ok(start >= 0, `expected an @media ${name} block in ${name} CSS`);
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  assert.fail(`unterminated @media ${name} block`);
}

/** Extract the declaration body of an exact-selector rule within a block. */
function ruleBody(block: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = block.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(m, `expected a print rule for selector \`${selector}\``);
  return m[1];
}

/** All `width:` values in a rule body (excludes `max-width`/`min-width`). */
function widthValues(rule: string): string[] {
  return Array.from(rule.matchAll(/(?<![-\w])width\s*:\s*([^;{}]+)/g)).map(
    (m) => m[1].replace(/!important/g, '').trim()
  );
}

function assertAbsoluteMillimeterWidth(
  rule: string,
  selector: string,
  label: string
): void {
  const values = widthValues(rule);
  assert.ok(
    values.length > 0,
    `${label}: print rule \`${selector}\` must declare an explicit width`
  );
  for (const value of values) {
    assert.match(
      value,
      /^[\d.]+\s*mm$/,
      `${label}: print rule \`${selector}\` width must use absolute paper ` +
        `units (mm) — got \`${value}\`. Relative/viewport units (%/px/vw) ` +
        `in this rule ARE the phone-shrink bug.`
    );
  }
}

test('print CSS: .janko-page uses absolute paper units (mm)', () => {
  const { css, label } = readCssUnderTest();
  const print = mediaBlock(stripComments(css), 'print');
  const rule = ruleBody(print, '.janko-page');
  assertAbsoluteMillimeterWidth(rule, '.janko-page', label);
});

test('print CSS: .janko-page svg uses absolute paper units (mm) + height auto', () => {
  const { css, label } = readCssUnderTest();
  const print = mediaBlock(stripComments(css), 'print');
  const rule = ruleBody(print, '.janko-page svg');
  assertAbsoluteMillimeterWidth(rule, '.janko-page svg', label);
  assert.match(
    rule,
    /height\s*:\s*auto/,
    `${label}: print rule \`.janko-page svg\` must keep \`height: auto\` ` +
      `(the SVG canvas is A4-proportioned; an explicit height could distort)`
  );
});

test('print CSS: .landing-root neutralizes the screen w-screen (100vw)', () => {
  const { css, label } = readCssUnderTest();
  const print = mediaBlock(stripComments(css), 'print');
  const rule = ruleBody(print, '.landing-root');
  const values = widthValues(rule);
  assert.ok(
    values.length > 0,
    `${label}: print rule \`.landing-root\` must override width — otherwise ` +
      `the screen \`w-screen\` (100vw) constrains print to phone width`
  );
  for (const value of values) {
    assert.match(
      value,
      /^([\d.]+\s*mm|auto)$/,
      `${label}: print rule \`.landing-root\` width must be paper-derived ` +
        `(mm or auto) — got \`${value}\``
    );
  }
});

test('print CSS: one-sheet guards stay on .janko-page', () => {
  const { css, label } = readCssUnderTest();
  const print = mediaBlock(stripComments(css), 'print');
  const rule = ruleBody(print, '.janko-page');
  assert.match(
    rule,
    /break-inside\s*:\s*avoid/,
    `${label}: print rule \`.janko-page\` must keep \`break-inside: avoid\``
  );
  assert.match(
    rule,
    /break-after\s*:\s*page/,
    `${label}: print rule \`.janko-page\` must keep \`break-after: page\``
  );
});

test('print CSS: @page stays A4 with zero margin (non-goal pin)', () => {
  const { css, label } = readCssUnderTest();
  const clean = stripComments(css);
  const m = clean.match(/@page\s*\{([^}]*)\}/);
  assert.ok(m, `${label}: expected an @page rule`);
  assert.match(m[1], /size\s*:\s*A4\s+portrait/, `${label}: @page size changed`);
  assert.match(m[1], /margin\s*:\s*0/, `${label}: @page margin changed`);
});

test('print CSS: screen sizing stays relative (100% is correct on screen)', () => {
  const { css, label } = readCssUnderTest();
  const screen = mediaBlock(stripComments(css), 'screen');
  const rule = ruleBody(screen, '.janko-page svg');
  const values = widthValues(rule);
  assert.ok(
    values.some((v) => v === '100%'),
    `${label}: screen rule \`.janko-page svg\` must keep \`width: 100%\` — ` +
      `relative sizing is correct on screen; only print needs paper units`
  );
});
