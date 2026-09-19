/**
 * Resolver identity fast path — semantic contract.
 *
 * `resolveJankoOptions`/`resolveJankoTokens` may return an already-resolved
 * input unchanged (by identity), because resolved values are read-only by
 * contract and value-identical to the fresh spread that used to be rebuilt for
 * them. These tests pin the boundaries of that fast path:
 *
 *  1. fresh partial inputs still fill every default and honour explicit
 *     `undefined` overrides, exactly like the spread;
 *  2. only values these resolvers produced are reused by identity; a
 *     caller-owned partial — even a structurally complete one — is never
 *     aliased and never cached by value or content;
 *  3. the canonical defaults are never handed out as an alias, so a caller
 *     mutating a resolved value cannot poison the defaults, and values stay
 *     unfrozen (no breaking freeze);
 *  4. real consumers (layout, rendered SVG, lint diagnostics) produce
 *     identical results from a resolved object and from a structurally equal
 *     fresh literal input.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildBachGoldbergVar1Score } from '../src/scores/bach-goldberg-var1';
import {
  BRAHMS_OP118_NO1_JANKO_OPTIONS,
  BRAHMS_OP118_NO1_JANKO_TOKENS,
} from '../src/scores/brahms-op118-no1';
import {
  DEFAULT_JANKO_OPTIONS,
  DEFAULT_JANKO_TOKENS,
  resolveJankoOptions,
  resolveJankoTokens,
} from '../src/render/janko/types';
import { layoutJankoScore, renderJankoCrop } from '../src/render/janko/engine';
import { lintJankoScore } from '../src/render/janko/linter';

// ---------------------------------------------------------------------------
// 1. Fresh partial inputs: defaults filled, explicit undefined preserved
// ---------------------------------------------------------------------------

test('Resolver identity: fresh partial input fills defaults and preserves explicit undefined', () => {
  assert.deepStrictEqual(
    resolveJankoOptions({ core: 'adaptive' }),
    { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' }
  );
  assert.deepStrictEqual(
    resolveJankoTokens({ rowHeight: 12.5 }),
    { ...DEFAULT_JANKO_TOKENS, rowHeight: 12.5 }
  );

  // Explicit `undefined` is an override in the spread, and must stay one.
  const explicitUndefinedOptions = resolveJankoOptions({ middleCSpine: undefined });
  assert.ok(Object.prototype.hasOwnProperty.call(explicitUndefinedOptions, 'middleCSpine'));
  assert.equal(explicitUndefinedOptions.middleCSpine, undefined);
  assert.deepStrictEqual(explicitUndefinedOptions, {
    ...DEFAULT_JANKO_OPTIONS,
    middleCSpine: undefined,
  });

  const explicitUndefinedTokens = resolveJankoTokens({ knockoutMargin: undefined });
  assert.ok(Object.prototype.hasOwnProperty.call(explicitUndefinedTokens, 'knockoutMargin'));
  assert.equal(explicitUndefinedTokens.knockoutMargin, undefined);
  assert.deepStrictEqual(explicitUndefinedTokens, {
    ...DEFAULT_JANKO_TOKENS,
    knockoutMargin: undefined,
  });

  // Absent input resolves to full canonical defaults, fresh each call.
  const fromNull = resolveJankoOptions(null);
  const fromMissing = resolveJankoOptions();
  assert.deepStrictEqual(fromNull, DEFAULT_JANKO_OPTIONS);
  assert.deepStrictEqual(fromMissing, DEFAULT_JANKO_OPTIONS);
  assert.notStrictEqual(fromNull, fromMissing);
  assert.deepStrictEqual(resolveJankoTokens(undefined), DEFAULT_JANKO_TOKENS);
});

// ---------------------------------------------------------------------------
// 2. Reuse is by identity only — never for caller-owned partials
// ---------------------------------------------------------------------------

test('Resolver identity: already-resolved input is reused and equals the fresh spread', () => {
  const resolvedOptions = resolveJankoOptions({
    ...BRAHMS_OP118_NO1_JANKO_OPTIONS,
    core: 'fixed-3',
  });
  assert.strictEqual(
    resolveJankoOptions(resolvedOptions),
    resolvedOptions,
    'an already-resolved option object is reused by identity'
  );
  assert.deepStrictEqual(resolveJankoOptions(resolvedOptions), {
    ...DEFAULT_JANKO_OPTIONS,
    ...resolvedOptions,
  });
  assert.deepStrictEqual(resolveJankoOptions(resolveJankoOptions(resolvedOptions)), resolvedOptions);

  const resolvedTokens = resolveJankoTokens(BRAHMS_OP118_NO1_JANKO_TOKENS);
  assert.strictEqual(resolveJankoTokens(resolvedTokens), resolvedTokens);
  assert.deepStrictEqual(resolveJankoTokens(resolvedTokens), {
    ...DEFAULT_JANKO_TOKENS,
    ...resolvedTokens,
  });

  // Caller-owned inputs are never aliased, even if structurally complete.
  const partial = { core: 'adaptive' as const };
  assert.notStrictEqual(resolveJankoOptions(partial), partial);
  const structuralClone = { ...DEFAULT_JANKO_OPTIONS };
  assert.notStrictEqual(
    resolveJankoOptions(structuralClone),
    structuralClone,
    'a caller-owned object that merely looks resolved is not aliased'
  );
  const tokenClone = { ...DEFAULT_JANKO_TOKENS };
  assert.notStrictEqual(resolveJankoTokens(tokenClone), tokenClone);
});

// ---------------------------------------------------------------------------
// 3. Defaults are not aliased out; values are not frozen
// ---------------------------------------------------------------------------

test('Resolver identity: canonical defaults are never aliased and resolved values stay unfrozen', () => {
  const resolvedOptions = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const resolvedTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  assert.notStrictEqual(resolvedOptions, DEFAULT_JANKO_OPTIONS);
  assert.notStrictEqual(resolvedTokens, DEFAULT_JANKO_TOKENS);
  assert.equal(Object.isFrozen(resolvedOptions), false, 'resolved options must not be frozen');
  assert.equal(Object.isFrozen(resolvedTokens), false, 'resolved tokens must not be frozen');

  // A caller mutating its resolved copy cannot poison the canonical defaults.
  resolvedOptions.core = 'adaptive';
  resolvedOptions.title = 'mutated';
  resolvedTokens.rowHeight = 99;
  assert.equal(DEFAULT_JANKO_OPTIONS.core, 'fixed-3');
  assert.equal(DEFAULT_JANKO_OPTIONS.title, 'Goldberg-Variationen');
  assert.equal(DEFAULT_JANKO_TOKENS.rowHeight, 15.0);
  assert.deepStrictEqual(resolveJankoOptions(null), DEFAULT_JANKO_OPTIONS);
});

// ---------------------------------------------------------------------------
// 4. Nothing is cached by value or content
// ---------------------------------------------------------------------------

test('Resolver identity: a mutated resolved value never leaks into other resolutions', () => {
  const first = resolveJankoOptions({ core: 'adaptive' });
  first.core = 'fixed-4';
  // Identity semantics: the resolver reuses the object it produced, so the
  // mutation is visible through that same identity (consumers treat resolved
  // values as read-only) …
  assert.strictEqual(resolveJankoOptions(first), first);
  // … but no other resolution of the same partial input sees it, because
  // caller-owned partials are always re-spread.
  const second = resolveJankoOptions({ core: 'adaptive' });
  assert.notStrictEqual(second, first);
  assert.equal(second.core, 'adaptive');
  assert.deepStrictEqual(second, { ...DEFAULT_JANKO_OPTIONS, core: 'adaptive' });
});

// ---------------------------------------------------------------------------
// 5. Consumer equivalence: resolved object vs structurally equal fresh literal
// ---------------------------------------------------------------------------

test('Resolver identity: layout, SVG and diagnostics are identical for a resolved object and an equal literal', () => {
  const score = buildBachGoldbergVar1Score();
  const resolvedOptions = resolveJankoOptions(DEFAULT_JANKO_OPTIONS);
  const resolvedTokens = resolveJankoTokens(DEFAULT_JANKO_TOKENS);
  const literalOptions = { ...resolvedOptions };
  const literalTokens = { ...resolvedTokens };

  // Kept as a shallow snapshot: the consumers below must leave the resolved
  // input untouched (the ownership assumption the fast path relies on).
  const optionsBefore = { ...resolvedOptions };
  const tokensBefore = { ...resolvedTokens };

  const resolvedLayout = layoutJankoScore(score, resolvedOptions, resolvedTokens);
  const literalLayout = layoutJankoScore(score, literalOptions, literalTokens);
  // Layouts carry per-call beam closures, so compare the serializable geometry.
  assert.equal(JSON.stringify(resolvedLayout), JSON.stringify(literalLayout));
  assert.deepStrictEqual(resolvedOptions, optionsBefore);
  assert.deepStrictEqual(resolvedTokens, tokensBefore);

  assert.equal(
    renderJankoCrop(score, 0, 2, resolvedOptions, resolvedTokens),
    renderJankoCrop(score, 0, 2, literalOptions, literalTokens)
  );
  assert.deepStrictEqual(resolvedOptions, optionsBefore);
  assert.deepStrictEqual(resolvedTokens, tokensBefore);

  const resolvedLint = lintJankoScore(score, resolvedOptions, resolvedTokens);
  const literalLint = lintJankoScore(score, literalOptions, literalTokens);
  assert.deepStrictEqual(resolvedOptions, optionsBefore);
  assert.deepStrictEqual(resolvedTokens, tokensBefore);
  assert.deepStrictEqual(resolvedLint.violations, literalLint.violations);
  assert.deepStrictEqual(resolvedLint.warnings, literalLint.warnings);
  assert.deepStrictEqual(resolvedLint.diagnostics, literalLint.diagnostics);
  const { durationMs: resolvedMs, ...resolvedStats } = resolvedLint.stats;
  const { durationMs: literalMs, ...literalStats } = literalLint.stats;
  assert.ok(resolvedMs >= 0 && literalMs >= 0);
  assert.deepStrictEqual(resolvedStats, literalStats);
});
