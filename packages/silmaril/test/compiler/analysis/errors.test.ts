import { describe, expect, it } from 'vitest';
import { analyzeModule } from '../../../compiler/analysis/index';
import { CompileError } from '../../../compiler/errors';

const head =
  "import { $$, $, $sync, $skip, $store, onMount, $composable } from 'silmaril';\n";

// Analyzes the module and returns the error it throws.
function catchError(code: string, filename = 'a.js'): CompileError {
  try {
    analyzeModule(code, filename);
  } catch (error) {
    if (error instanceof CompileError) {
      return error;
    }
    throw error;
  }
  throw new Error('no compile error');
}

// The source text at the error location.
function readAt(code: string, error: CompileError): string {
  const line = code.split('\n')[error.loc.line - 1]!;
  return line.slice(error.loc.column);
}

describe('compile errors of the runtime contract', () => {
  const cases: [string, string, string][] = [
    // [body, message, text at the location]
    ['const f = $sync;', '$sync can only be called.', '$sync;'],
    ['$$(1);', '$$ must be called with a function.', '$$(1)'],
    [
      '$composable();',
      '$composable takes exactly one argument.',
      '$composable()',
    ],
    [
      '$$(() => { let x = 0; for (const i of [1]) { $(x); } x = 2; });',
      '$ cannot be called inside a loop.',
      '$(x)',
    ],
    [
      '$$(() => { let x = 0; setTimeout(() => $(x)); x = 2; });',
      '$ must be called directly in a setup body.',
      '$(x)',
    ],
    [
      '$$(() => { let x = 0; $($sync(x)); x = 1; });',
      '$sync must be called directly in a setup body.',
      '$sync(x)',
    ],
    [
      '$$(() => { let x = 0; const y = ($sync(x), x); x = 1; });',
      '$sync must be called directly in a setup body.',
      '$sync(x), x)',
    ],
    [
      '$$(() => { class K { f = $(1); } });',
      '$ must be called directly in a setup body.',
      '$(1)',
    ],
    ['$(1);', '$ must be called directly in a setup body.', '$(1)'],
    [
      '$$(() => { $sync(1, 2); });',
      '$sync can only accept a single argument',
      '$sync(1, 2)',
    ],
    [
      '$$(() => { $(...a); });',
      '$ can only accept a single argument',
      '$(...a)',
    ],
    [
      '$$(() => { $skip(1, 2); });',
      '$skip takes exactly one argument.',
      '$skip(1, 2)',
    ],
    [
      '$$(() => { const s = $store(); });',
      '$store takes exactly one argument.',
      '$store()',
    ],
    ['$skip(1);', '$skip must be used inside $$ or $composable.', '$skip(1)'],
    [
      'onMount(() => {});',
      'onMount must be used inside $$ or $composable.',
      'onMount(',
    ],
    [
      '$$(() => { const { a } = $store(t); });',
      '$store is only limited to identifiers.',
      '$store(t)',
    ],
    [
      '$$(() => { for (;;) { const s = $store(t); } });',
      '$store must initialize a variable of a setup body.',
      '$store(t)',
    ],
    [
      '$$(() => { f($store(t)); });',
      '$store must initialize a variable of a setup body.',
      '$store(t)',
    ],
    [
      '$$(() => { let x = 0; $sync(log(/* $skip */ x)); x = 1; });',
      'The /* $skip */ comment is not supported. Use $skip(expression).',
      '/* $skip */',
    ],
    [
      '$$(() => { const s = $store(t); s = 1; });',
      'Cannot assign to a constant.',
      's = 1',
    ],
    [
      "$$(() => { let T = 'a'; log(<T />); T = 'b'; });",
      'A reactive variable cannot be used as a JSX tag.',
      'T />',
    ],
  ];

  for (const [body, message, text] of cases) {
    it(message + ' ' + body, () => {
      const code = head + body;
      const error = catchError(code);
      expect(error.message).toBe(
        `${message} (${error.loc.line}:${error.loc.column})`,
      );
      expect(error.loc.line).toBe(2);
      expect(readAt(code, error).startsWith(text)).toBe(true);
    });
  }

  it('uses the local name of an aliased import', () => {
    const error = catchError(
      "import { $sync as sync } from 'silmaril';\nconst f = sync;",
    );
    expect(error.message).toContain('sync can only be called.');
    expect(error.message).not.toContain('$sync');
  });

  it('runs the checks even when the module has no setup', () => {
    expect(() => analyzeModule(`${head}$(1);`, 'a.js')).toThrow(CompileError);
  });

  it('allows $ in if, try, switch, labels and expressions (v4)', () => {
    expect(() =>
      analyzeModule(
        `${head}$$(() => { let x = 0; if (x) { $(x); } try { $(x); } catch { $(x); } switch (x) { case 1: $(x); } l: { $(x); } x && $(x); x = 1; });`,
        'a.js',
      ),
    ).not.toThrow();
  });

  it('allows a write in a memo initializer and destructuring in a class field (v4)', () => {
    expect(() =>
      analyzeModule(
        `${head}$$(() => { let a = 0; let b = 0; function w() { a = 1; } const c = (w(), b); a = 2; b = 2; });`,
        'a.js',
      ),
    ).not.toThrow();
    expect(() =>
      analyzeModule(
        `${head}$$(() => { let a = 0; class K { f = ([a] = [1]); } a = 2; });`,
        'a.js',
      ),
    ).not.toThrow();
  });
});

describe('CompileError', () => {
  it('parse errors carry the location of the first label and a frame', () => {
    const code = "import { $$ } from 'silmaril';\nlet a = ;";
    const error = catchError(code, 'a.ts');
    expect(error.name).toBe('CompileError');
    expect(error.loc).toEqual({ line: 2, column: 8 });
    expect(error.frame).toBe('2 | let a = ;\n  |         ^');
  });

  it('columns are UTF-16 code units', () => {
    const code =
      "import { $sync } from 'silmaril';\n/* 😀 é */ const f = $sync;";
    const error = catchError(code);
    expect(error.loc).toEqual({ line: 2, column: 21 });
    expect(readAt(code, error)).toBe('$sync;');
  });
});
