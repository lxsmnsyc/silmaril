import { describe, expect, it } from 'vitest';
import { CompileError, compile, ready } from '../../../compiler/index';

describe('compile', () => {
  it('returns the input with no map when silmaril is not imported', () => {
    const code = 'let x = 0; x++;';
    expect(compile(code, { filename: 'a.js' })).toEqual({ code, map: null });
    const other = `import { $$ } from 'other';\n$$(() => { let silmaril = 0; silmaril++; });`;
    expect(compile(other, { filename: 'a.js' })).toEqual({
      code: other,
      map: null,
    });
  });

  it('compiles the module, with a map', () => {
    const code =
      "import { $$ } from 'silmaril';\n$$(() => { let x = 0; x = 1; });\n";
    const result = compile(code, { filename: 'src/a.ts' });
    expect(result.code).toBe(
      "import { $$root, $$set } from 'silmaril';\n\nconst $g0 = [];\n$$root($g0, ($s) => { $$set($s, 0, 0); $$set($s, 0, 1); });\n",
    );
    // magic-string keeps the base name, and sources are relative to `file`.
    expect(result.map!.file).toBe('a.ts');
    expect(result.map!.sources).toEqual(['a.ts']);
    expect(result.map!.sourcesContent).toEqual([code]);
    expect(result.map!.version).toBe(3);
    expect(compile(code, { filename: 'a.ts', sourcemap: false }).map).toBe(
      null,
    );
  });

  it('throws CompileError with a location', () => {
    const code = "import { $$ } from 'silmaril';\nlet a = ;";
    expect(() => compile(code, { filename: 'a.ts' })).toThrow(CompileError);
    expect(() => compile(code, { filename: 'a.ts' })).toThrow(
      expect.objectContaining({
        loc: { line: 2, column: 8 },
        frame: expect.stringContaining('^'),
      }),
    );
  });

  it('ready() resolves to the same promise every time', async () => {
    expect(ready()).toBe(ready());
    await expect(ready()).resolves.toBe(undefined);
  });
});
