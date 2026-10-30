// Source maps: replaced text maps to the start of the range it replaces, and kept
// text maps to itself. One test per construct.
import { SourceMap, type SourceMapPayload } from 'node:module';
import { describe, expect, it } from 'vitest';
import { compileChecked } from './helpers';

interface Position {
  line: number;
  column: number;
}

// The 0-based line and column of the `occurrence`-th match of `needle` at or after `from`.
function locate(
  code: string,
  from: number,
  needle: string,
  occurrence = 0,
): Position {
  let index = from - 1;
  for (let i = 0; i <= occurrence; i += 1) {
    index = code.indexOf(needle, index + 1);
    if (index === -1) {
      throw new Error(`'${needle}' #${occurrence} not found in:\n${code}`);
    }
  }
  const before = code.slice(0, index);
  const line = before.split('\n').length - 1;
  return { line, column: index - (before.lastIndexOf('\n') + 1) };
}

interface Mapping {
  /** Text in the output, and which match of it. */
  generated: [string, number?];
  /** Text in the input it must map to, and which match of it. */
  original: [string, number?];
}

interface Located extends Position {
  text: string;
}

// Compiles `source` and returns, for each mapping, where its generated text maps to
// and where its original text is. Matches are counted from the first setup, so the
// import and graphs do not count.
function mapTexts(
  source: string,
  mappings: Mapping[],
): { got: (Located | null)[]; want: Located[] } {
  const result = compileChecked(source);
  const map = new SourceMap(result.map as unknown as SourceMapPayload);
  const generatedStart = Math.max(result.code.indexOf('$$root($'), 0);
  const originalStart = Math.max(source.indexOf('$$(('), 0);
  const got: (Located | null)[] = [];
  const want: Located[] = [];
  for (const { generated, original } of mappings) {
    const text = `${generated[0]} -> ${original[0]}`;
    const from = locate(result.code, generatedStart, ...generated);
    const entry = map.findEntry(from.line, from.column);
    got.push(
      'originalLine' in entry
        ? { text, line: entry.originalLine, column: entry.originalColumn }
        : null,
    );
    want.push({ text, ...locate(source, originalStart, ...original) });
  }
  return { got, want };
}

const IMPORT = "import { $$, $sync, $ } from 'silmaril';\n";

describe('codegen source maps', () => {
  it('maps a setup and its kept text', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  log('start');\n});\n`,
      [
        { generated: ['$$root'], original: ['$$('] },
        { generated: ['log'], original: ['log'] },
        { generated: ["'start'"], original: ["'start'"] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps a state declaration and its reads', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let count = 1;\n  count = 2;\n  log(count);\n});\n`,
      [
        { generated: ['$$set($s, 0, 1)'], original: ['let count'] },
        { generated: ['1);'], original: ['1;'] },
        { generated: ['$$get($s, 0)'], original: ['count', 2] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps a memo and a function memo', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let a = 1;\n  const b = a * 2;\n  const f = () => a;\n  a = 2;\n  log(b, f);\n});\n`,
      [
        { generated: ['$$memo', 0], original: ['const b'] },
        { generated: ['$$memo', 1], original: ['const f'] },
        { generated: ['* 2'], original: ['* 2'] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps a destructuring memo', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let a = { p: 1 };\n  const { p } = a;\n  a = { p: 2 };\n  log(p);\n});\n`,
      [
        { generated: ['$$memo'], original: ['const { p }'] },
        { generated: ['{ p } ='], original: ['{ p } ='] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps $sync and $ with expression and function arguments', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let a = 1;\n  $sync(log(a));\n  $(() => {\n    log(a);\n  });\n  a = 2;\n});\n`,
      [
        { generated: ['$$sync'], original: ['$sync'] },
        { generated: ['$$effect'], original: ['$(() => {\n    log'] },
        { generated: ['log', 1], original: ['log', 1] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps assignments, compound, logical and update writes', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let a = 1;\n  a = 2;\n  a += 3;\n  a ||= 4;\n  a++;\n});\n`,
      [
        { generated: ['$$set($s, 0, 2)'], original: ['a = 2'] },
        { generated: ['$$set($s, 0, $$get'], original: ['a += 3'] },
        { generated: ['($$get($s, 0) ||'], original: ['a ||= 4'] },
        { generated: ['$$update'], original: ['a++'] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps destructuring writes and declarations', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let [a, b] = [1, 2];\n  [a, b] = [b, a];\n  log(a, b);\n});\n`,
      [
        // The first match of each temp is its `let`.
        { generated: ['$t0', 1], original: ['a'] },
        { generated: ['$t1', 1], original: ['b'] },
        { generated: ['$t2', 1], original: ['a', 1] },
        { generated: ['$t3', 1], original: ['b', 1] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps for-of heads', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  let item;\n  for (item of [1]) {\n    log(item);\n  }\n});\n`,
      [
        { generated: ['const $t0'], original: ['item of'] },
        { generated: ['$$get($s, 0)'], original: ['item)'] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps nested setups and redeclared vars', () => {
    const { got, want } = mapTexts(
      `${IMPORT}$$(() => {\n  var a = 1;\n  var a = 2;\n  $$(() => {\n    let b = 1;\n    b = a;\n  });\n});\n`,
      [
        { generated: ['$$set($s, 0, 2)'], original: ['var a = 2'] },
        { generated: ['$$root', 1], original: ['$$(', 1] },
        { generated: ['$$set($s1, 0, $$get'], original: ['b = a'] },
        { generated: ['$$get($s, 0)', 0], original: ['a;'] },
      ],
    );
    expect(got).toStrictEqual(want);
  });

  it('maps the rewritten import', () => {
    const source = `${IMPORT}$$(() => {});\n`;
    const result = compileChecked(source);
    const map = new SourceMap(result.map as unknown as SourceMapPayload);
    expect(result.code.startsWith('import {')).toBe(true);
    expect(map.findEntry(0, 0)).toMatchObject({
      originalLine: 0,
      originalColumn: 0,
    });
  });
});
