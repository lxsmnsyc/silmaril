// Checks of the prototype. Run with `node test.ts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { babel, babelParse } from './babel-baseline.ts';
import { compile, parseModule, visit } from './compile.ts';
import { generate } from './gen.ts';
import { analyzeScopes, type Node } from './scope.ts';

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}\n${(error as Error).message}`);
  }
}

const tricky = readFileSync(
  new URL('./fixtures/tricky.tsx', import.meta.url),
  'utf8',
);
const generated = generate(2000);

// Babel resolution of every identifier, keyed by its start offset: the start of the
// binding identifier, or -1 for a global.
function babelResolutions(code: string, filename: string): Map<number, number> {
  const ast = babelParse(code, filename)!;
  const out = new Map<number, number>();
  babel.traverse(ast, {
    'Identifier|JSXIdentifier'(path: babel.NodePath<babel.types.Identifier>) {
      const binding = path.scope.getBinding(path.node.name);
      out.set(path.node.start!, binding ? binding.identifier.start! : -1);
    },
  });
  return out;
}

// Babel misses TS enums, namespaces and parameter properties. Ours resolves them.
const BABEL_GAPS = new Set(['enum', 'namespace', 'param']);

function compareWithBabel(code: string, filename: string): string[] {
  const { program } = parseModule(code, filename);
  const info = analyzeScopes(program);
  const expected = babelResolutions(code, filename);
  const diffs: string[] = [];
  for (const ref of info.references) {
    const start = ref.identifier.start;
    const ours = ref.binding ? ref.binding.identifier.start : -1;
    const theirs = expected.get(start);
    if (theirs === -1 && ref.binding && BABEL_GAPS.has(ref.binding.kind)) {
      const declaration = ref.binding.declaration;
      if (
        ref.binding.kind !== 'param' ||
        declaration.params.some((p: Node) => p.type === 'TSParameterProperty')
      ) {
        continue;
      }
    }
    if (theirs !== undefined && theirs !== ours) {
      const line = code.slice(0, start).split('\n').length;
      diffs.push(
        `${ref.identifier.name} at line ${line}: ours ${ours}, babel ${theirs}`,
      );
    }
  }
  return diffs;
}

check('parses TSX and TS', () => {
  parseModule(tricky, 'tricky.tsx');
  parseModule(generated, 'generated.tsx');
  // `<T>x` is a type assertion in .ts and a JSX element in .tsx.
  parseModule(
    'const a = <number>b; enum E { A } let c = d satisfies E;',
    'a.ts',
  );
  assert.throws(
    () => parseModule('const a = <number>b;', 'a.tsx'),
    /CompileError|Expected|Unexpected/,
  );
});

check('resolves like Babel on fixtures/tricky.tsx', () => {
  const diffs = compareWithBabel(tricky, 'tricky.tsx');
  assert.deepEqual(diffs, []);
});

check('resolves like Babel on the generated 2,000-line file', () => {
  const diffs = compareWithBabel(generated, 'generated.tsx');
  assert.deepEqual(diffs, []);
});

const VALUE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'TSParameterProperty',
  'TSExportAssignment',
]);

// Babel's referenced value identifiers that our analysis does not record.
function missedReferences(code: string, filename: string): string[] {
  const { program } = parseModule(code, filename);
  const info = analyzeScopes(program);
  const ours = new Set<number>();
  for (const ref of info.references) {
    ours.add(ref.identifier.start);
  }
  const missed: string[] = [];
  babel.traverse(babelParse(code, filename)!, {
    'Identifier|JSXIdentifier'(path: babel.NodePath<babel.types.Identifier>) {
      if (
        !path.isReferencedIdentifier() &&
        !path.parentPath?.isAssignmentExpression({ left: path.node })
      ) {
        return;
      }
      const inType = path.findParent(
        (p) => p.node.type.startsWith('TS') && !VALUE_WRAPPERS.has(p.node.type),
      );
      // Closing JSX tags repeat the opening name. `export type {}` and parameter
      // properties are not value references (Babel counts them).
      const notValue =
        path.findParent((p) => p.isJSXClosingElement()) ||
        path.parentPath?.isTSParameterProperty() ||
        (path.parentPath?.parentPath?.node as Node | undefined)?.exportKind ===
          'type';
      if (inType || notValue || ours.has(path.node.start!)) {
        return;
      }
      if (path.isJSXIdentifier() && /^[a-z]/.test(path.node.name)) {
        return;
      }
      const line = code.slice(0, path.node.start!).split('\n').length;
      missed.push(`${path.node.name} at line ${line} (${path.parent.type})`);
    },
  });
  return missed;
}

check('records every value reference Babel sees', () => {
  assert.deepEqual(missedReferences(tricky, 'tricky.tsx'), []);
  assert.deepEqual(missedReferences(generated, 'generated.tsx'), []);
});

check('skips types and resolves shadowing', () => {
  const code = `
    import { $$ } from 'silmaril';
    type T = typeof x;
    let x: T = 1;
    function f(x: number) { return x; }
    { let x = 2; x; }
    const g = function x() { return x; };
    try {} catch (x) { x; }
    for (let x of []) x;
    use(x);
  `;
  const { program } = parseModule(code, 'a.ts');
  const info = analyzeScopes(program);
  const module = info.root.bindings.get('x')!;
  // Only `use(x)` reads the module-level x. `typeof x` in a type is not a value read.
  assert.equal(module.references.length, 1);
  const lines = info.references
    .filter((ref) => ref.identifier.name === 'x')
    .map((ref) => (ref.binding ? ref.binding.kind : 'global'));
  assert.deepEqual(lines, ['param', 'let', 'function', 'catch', 'let', 'let']);
});

function wrapped(code: string): string[] {
  return [...code.matchAll(/_\$\$update\(_ctx\d*, ([^;]*?)\)(?=[;\n}])/g)].map(
    (m) => m[1]!,
  );
}

check('rewrites writes of setup variables only', () => {
  const result = compile(tricky, { filename: 'tricky.tsx' });
  const writes = wrapped(result.code);
  assert.deepEqual(writes, [
    'count += step',
    'count++',
    '--count',
    '(count as number) = 1',
    'count! = 2',
    '[first, second] = [second, first]',
    '{ first, rest } = { first: 1, rest: {} })',
    'store = count',
    'blockVar = 2',
  ]);
  // The shadowed names inside shadowed() stay as they are.
  assert.match(result.code, /let count = 10;\n\s+count \+= 1;/);
  // The output still parses.
  parseModule(result.code, 'out.tsx');
});

check('matches the Babel plugin on the snapshot cases', () => {
  const result = compile(
    `import { $$ } from 'silmaril';\n$$(() => {\n  let x = 0;\n  function increment() {\n    x += 1;\n    x++;\n  }\n});\n`,
    { filename: 'a.js' },
  );
  assert.match(result.code, /let _ctx = _\$\$context\(\);/);
  assert.match(result.code, /_\$\$update\(_ctx, x \+= 1\)/);
  assert.match(result.code, /_\$\$update\(_ctx, x\+\+\)/);
});

check('generated names do not collide', () => {
  const result = compile(
    `import { $$ } from 'silmaril';\nconst _ctx = 1, _$$update = 2;\n$$(() => { let x = 0; x = _ctx; });\n`,
    { filename: 'a.js' },
  );
  assert.match(result.code, /let _ctx2 = /);
  assert.match(result.code, /\$\$update as _\$\$update2/);
});

check('offsets are UTF-16, so non-ASCII text does not shift edits', () => {
  const result = compile(
    `import { $$ } from 'silmaril';\n// héllo 😀 日本\n$$(() => { let s = '😀'; s = 'é' + s; });\n`,
    { filename: 'a.ts' },
  );
  assert.match(result.code, /_\$\$update\(_ctx, s = 'é' \+ s\)/);
});

check('returns the input when silmaril is not imported', () => {
  const code = 'let x = 0; x++;';
  assert.deepEqual(compile(code, { filename: 'a.js' }), { code, map: null });
  const other = `import { $$ } from 'other';\n$$(() => { let silmaril = 0; silmaril++; });`;
  assert.deepEqual(compile(other, { filename: 'a.js' }), {
    code: other,
    map: null,
  });
});

check('errors carry a location', () => {
  try {
    compile(`import { $$ } from 'silmaril';\nlet a = ;`, { filename: 'a.ts' });
    assert.fail('no error');
  } catch (error) {
    const e = error as { loc: { line: number; column: number }; frame: string };
    assert.equal(e.loc.line, 2);
    assert.ok(e.frame.includes('^'));
  }
});

// Every identifier of the output that comes from the input must map back to the same name.
function checkSourceMap(
  code: string,
  filename: string,
): { checked: number; wrong: string[] } {
  const result = compile(code, { filename });
  assert.ok(result.map);
  // The map converts to unplugin's SourceMapCompact through JSON.
  const json = JSON.parse(result.map.toString());
  assert.equal(json.version, 3);
  assert.deepEqual(json.sources, [filename]);
  const trace = new TraceMap(json);
  const out = parseModule(result.code, filename);
  const lineStarts = [0];
  for (let i = 0; i < result.code.length; i += 1) {
    if (result.code.charCodeAt(i) === 10) {
      lineStarts.push(i + 1);
    }
  }
  const originalLines = code.split('\n');
  let checked = 0;
  const wrong: string[] = [];
  visit(out.program, (node: Node) => {
    // Skip the generated names and the import line the compiler adds.
    if (
      node.type !== 'Identifier' ||
      node.start < lineStarts[1]! ||
      node.name.startsWith('_$$') ||
      /^_ctx\d*$/.test(node.name)
    ) {
      return;
    }
    let line = 0;
    while (
      line + 1 < lineStarts.length &&
      lineStarts[line + 1]! <= node.start
    ) {
      line += 1;
    }
    const column = node.start - lineStarts[line]!;
    const original = originalPositionFor(trace, { line: line + 1, column });
    checked += 1;
    const text = original.line
      ? originalLines[original.line - 1]!.slice(original.column!)
      : '';
    if (!text.startsWith(node.name)) {
      wrong.push(
        `${node.name} at ${line + 1}:${column} -> ${original.line}:${original.column}`,
      );
    }
  });
  return { checked, wrong };
}

check(
  'source map points every identifier back to its origin (tricky.tsx)',
  () => {
    const { checked, wrong } = checkSourceMap(tricky, 'tricky.tsx');
    assert.ok(checked > 200, `checked ${checked}`);
    assert.deepEqual(wrong.slice(0, 10), []);
  },
);

check(
  'source map points every identifier back to its origin (generated)',
  () => {
    const { checked, wrong } = checkSourceMap(generated, 'generated.tsx');
    assert.ok(checked > 3000, `checked ${checked}`);
    assert.deepEqual(wrong.slice(0, 10), []);
  },
);

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('all passed');
