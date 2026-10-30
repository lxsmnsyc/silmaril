// Checks of the prototype. Run with `node test.ts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { MagicString } from 'magic-string';
import { babel, babelParse } from './babel-baseline.ts';
import { compile, ready } from './compile.ts';
import { generate } from './gen.ts';
import { analyzeModel } from './model.ts';
import {
  analyzeScopes,
  type Node,
  type Reference,
  type ScopeInfo,
} from './scope.ts';
import { findSilmarilImports, parseModule, visit } from './source.ts';

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

function analyze(code: string, filename = 'a.ts') {
  const parsed = parseModule(code, filename);
  const info = analyzeScopes(parsed.program);
  return { parsed, info };
}

function model(code: string, filename = 'a.js') {
  const { parsed, info } = analyze(code, filename);
  return analyzeModel(
    parsed,
    info,
    findSilmarilImports(parsed.program, info.declarationOf),
  );
}

function refsNamed(info: ScopeInfo, name: string): Reference[] {
  const out: Reference[] = [];
  for (const ref of info.references) {
    if (ref.identifier.name === name) {
      out.push(ref);
    }
  }
  return out;
}

function compiled(code: string, filename = 'a.js'): string {
  return compile(code, { filename }).code;
}

function throwsWith(code: string, message: string, filename = 'a.js'): void {
  assert.throws(
    () => compile(code, { filename }),
    (error: Error) => error.message.includes(message),
  );
}

check('parameter defaults do not see body declarations', () => {
  const { info } = analyze('let x = 1; function f(a = x) { let x = 2; x; }');
  const [inDefault, inBody] = refsNamed(info, 'x');
  assert.equal(inDefault!.binding!.scope.kind, 'module');
  assert.equal(inBody!.binding!.scope.kind, 'function');
  // Without parameter expressions, parameters and body share one scope.
  const plain = analyze('function g(a) { let b = a; }').info;
  assert.equal(refsNamed(plain, 'a')[0]!.binding!.kind, 'param');
});

check('walks qualified namespaces', () => {
  const { info } = analyze('namespace A.B { export const y = z; }');
  assert.ok(info.root.bindings.has('A'));
  assert.equal(refsNamed(info, 'z').length, 1);
});

check('`<this.Foo />` reads no binding named this', () => {
  const { info } = analyze('const Foo = 1; <this.Foo />;', 'a.tsx');
  assert.equal(refsNamed(info, 'this').length, 0);
});

check('reference context: shorthand, JSX tag, export', () => {
  const { info } = analyze(
    'let a = 1; const C = 2; ({ a }); ({ a } = {}); <C />; export { a };',
    'a.tsx',
  );
  const contexts: string[] = [];
  for (const ref of info.references) {
    contexts.push(`${ref.identifier.name}:${ref.context}`);
  }
  assert.deepEqual(contexts, [
    'a:shorthand',
    'a:shorthand',
    'C:jsx',
    'a:export',
  ]);
});

check(
  'visit is in source order, skips types and visits a shorthand once',
  () => {
    const { parsed } = analyze(
      'let x: Foo<Bar> = y; const o = { x }; @dec class K {}',
    );
    const names: string[] = [];
    visit(parsed.program, (node) => {
      if (node.type === 'Identifier') {
        names.push(node.name);
      }
    });
    assert.deepEqual(names, ['x', 'y', 'o', 'x', 'dec', 'K']);
  },
);

check('read, write and writeExpression of references', () => {
  const { info } = analyze(
    'let x = 0; x = 1; x += 1; x++; [x] = [1]; for (x of []) {} f(x);',
  );
  const flags: string[] = [];
  for (const ref of refsNamed(info, 'x')) {
    const kind = ref.writeExpression ? ref.writeExpression.type : '-';
    flags.push(`${ref.read ? 'r' : ''}${ref.write ? 'w' : ''}:${kind}`);
  }
  assert.deepEqual(flags, [
    'w:AssignmentExpression',
    'rw:AssignmentExpression',
    'rw:UpdateExpression',
    'w:AssignmentExpression',
    'w:ForOfStatement',
    'r:-',
  ]);
});

check('an expression-bodied setup compiles', () => {
  const out = compiled(
    "import { $$, onMount } from 'silmaril';\n$$(() => onMount(() => log('m')));\n",
  );
  assert.match(
    out,
    /\$\$root\(\$g0, \(\$s\) => \$\$mount\(\$s, \(\) => log\('m'\)\)\)/,
  );
  assert.match(out, /const \$g0 = \[\];/);
});

check('compile errors of the runtime contract', () => {
  const head = "import { $$, $, $sync, $skip, $store } from 'silmaril';\n";
  // The review's probe: a loop and a nested function.
  throwsWith(
    `${head}$$(() => { let x = 0; for (const i of [1]) { $(x); } setTimeout(() => $(x)); x = 2; });`,
    '$ cannot be called inside a loop.',
  );
  throwsWith(
    `${head}$$(() => { let x = 0; setTimeout(() => $(x)); x = 2; });`,
    '$ must be called directly in a setup body.',
  );
  throwsWith(
    `${head}$$(() => { let x = 0; $($sync(x)); x = 1; });`,
    '$sync must be called directly in a setup body.',
  );
  throwsWith(
    `${head}$$(() => { let x = 0; const y = ($sync(x), x); x = 1; });`,
    '$sync must be called directly in a setup body.',
  );
  throwsWith(`${head}$(1);`, '$ must be called directly in a setup body.');
  throwsWith(
    `${head}$$(() => { $sync(1, 2); });`,
    '$sync can only accept a single argument',
  );
  throwsWith(
    `${head}$$(() => { $skip(1, 2); });`,
    '$skip takes exactly one argument.',
  );
  throwsWith(
    `${head}$$(() => { const { a } = $store(t); });`,
    '$store is only limited to identifiers.',
  );
  throwsWith(`${head}const f = $sync;`, '$sync can only be called.');
  throwsWith(
    `${head}$skip(1);`,
    '$skip must be used inside $$ or $composable.',
  );
  throwsWith(
    `${head}$$(() => { for (;;) { const s = $store(t); } });`,
    '$store must initialize a variable of a setup body.',
  );
  throwsWith(
    `${head}$$(() => { f($store(t)); });`,
    '$store must initialize a variable of a setup body.',
  );
  throwsWith(
    `${head}$$(() => { let T = 'a'; log(<T />); T = 'b'; });`,
    'A reactive variable cannot be used as a JSX tag.',
    'input.jsx',
  );
  throwsWith(
    `${head}$$(() => { const s = $store(t); s = 1; });`,
    'Cannot assign to a constant.',
  );
  throwsWith(
    `${head}$$(() => { let x = 0; $sync(log(/* $skip */ x)); x = 1; });`,
    'The /* $skip */ comment is not supported.',
  );
  // `$` inside if, try, switch, labels and expressions is fine (v4, as in 0.4).
  compiled(
    `${head}$$(() => { let x = 0; if (x) { $(x); } try { $(x); } catch { $(x); } switch (x) { case 1: $(x); } l: { $(x); } x && $(x); x = 1; });`,
  );
  // Writes in a memo initializer and destructuring in a class field are allowed (v4).
  compiled(
    `${head}$$(() => { let a = 0; let b = 0; function w() { a = 1; } const c = (w(), b); a = 2; b = 2; });`,
  );
  const field = compiled(
    `${head}$$(() => { let a = 0; class K { f = ([a] = [1]); } a = 2; });`,
  );
  assert.match(field, /f = \(\(\) => \{ let \$t0, \$t1; return/);
});

check(
  'reads through local helpers: transitive, recursive, optional, reassigned',
  () => {
    const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let a = 0;
  let b = 0;
  let c = 0;
  let d = 0;
  function one() { return a + two(); }
  function two() { return b + one(); }
  function three() { return c; }
  let four = () => d;
  $sync(one());
  $sync(three?.());
  $sync(four());
  $sync(() => [1].map(() => a));
  a = b = c = d = 1;
  four = () => 0;
});`);
    const root = m.scopes[0]!;
    const reads: string[][] = [];
    for (const entry of root.entries) {
      const names: string[] = [];
      for (const binding of entry.reads) {
        names.push(binding.name);
      }
      reads.push(names.toSorted());
    }
    // `four` is a written let: a slot, read as a value, not followed.
    // It also has a memo (entry 0), because its initializer reads `d`.
    assert.deepEqual(reads, [['d'], ['a', 'b'], ['c'], ['four'], ['a']]);
    assert.deepEqual(root.graph, [[1, 4], [1], [2], [0], [3]]);
  },
);

check('child memos: a body gets the reads of its own memos', () => {
  const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let x = 1;
  $sync(() => {
    const a = x * 2;
    const b = a + 1;
    log(b);
  });
  x = 2;
});`);
  const root = m.scopes[0]!;
  assert.deepEqual(root.graph, [[0, [0, 0]]]);
  const child = root.entries[0]!.child!;
  // b is read only by the body itself, which owns it.
  assert.deepEqual(child.graph, [[1], []]);
});

check('which scope each lifecycle and composable call binds to', () => {
  const m =
    model(`import { $$, $, $sync, $composable, onMount } from 'silmaril';
const useThing = $composable(() => { onMount(() => {}); });
$$(() => {
  let x = 0;
  onMount(() => {});
  $sync(() => { onMount(() => {}); useThing(); });
  $(onMount(() => {}));
  const y = (useThing(), x);
  x = 1;
});`);
  const bound: string[] = [];
  for (const binding of m.bindings) {
    bound.push(`${binding.name}:${binding.scope.kind}:${binding.scope.param}`);
  }
  assert.deepEqual(bound.toSorted(), [
    'composable-call:memo:$c0',
    'composable-call:sync:$c1',
    'onMount:composable:$s',
    'onMount:effect:$c2',
    'onMount:root:$s',
    'onMount:sync:$c1',
  ]);
});

check('overwrites: compound, logical, chained and destructuring writes', () => {
  const out = compiled(`import { $$, $sync } from 'silmaril';
$$(() => {
  let x = 2;
  let a = 2;
  let b = 3;
  let y = 0;
  $sync(log(x *= a + b));
  $sync(log((x ||= a), (x = y = 1)));
  [a, { b = a }] = [1, {}];
  a = 0;
});`);
  assert.ok(
    out.includes('$$set($s, 0, $$get($s, 0) * ($$get($s, 1) + $$get($s, 2)))'),
  );
  assert.ok(out.includes('($$get($s, 0) || $$set($s, 0, $$get($s, 1)))'));
  assert.ok(out.includes('$$set($s, 0, $$set($s, 3, 1))'));
  assert.ok(
    out.includes(
      '[$t0, { b: $t1 = $t0 }] = [1, {}]; $$set($s, 1, $t0); $$set($s, 2, $t1);',
    ),
  );
  parseModule(out, 'out.js');
});

check('magic-string traps the edit rules avoid', () => {
  const lost = new MagicString('x * 2');
  lost.appendRight(0, '(');
  lost.overwrite(0, 1, '$$get($s, 0)');
  assert.equal(lost.toString(), '$$get($s, 0) * 2');
  const kept = new MagicString('x * 2');
  kept.appendRight(0, '(');
  kept.update(0, 1, '$$get($s, 0)');
  assert.equal(kept.toString(), '($$get($s, 0) * 2');
  const nested = new MagicString('abcd');
  nested.overwrite(0, 4, 'z');
  assert.throws(() => nested.overwrite(0, 1, 'y'));
});

check('imports: aliases, kept specifiers, namespace imports', () => {
  const out = compiled(
    "import { $$, $sync as sync, tick, type Store } from 'silmaril';\nimport * as s from 'silmaril';\n$$(() => { let x = 0; sync(x); x = 1; s.$sync(x); });\n",
    'a.ts',
  );
  assert.ok(
    out.startsWith(
      "import { $$root, $$get, $$set, $$sync, tick, type Store } from 'silmaril';\nimport * as s from 'silmaril';",
    ),
  );
  assert.ok(out.includes('$$sync($s, 0, () => $$get($s, 0));'));
  assert.ok(out.includes('s.$sync($$get($s, 0));'));
});

check('generated names do not collide', () => {
  const out = compiled(
    "import { $$, $sync } from 'silmaril';\nconst $s = 1, $$get = 2, $t0 = 3;\n$$(() => { let x = 0; $sync(x); [x] = [$s + $$get + $t0]; });\n",
  );
  assert.match(out, /\$\$root\(\$_g0, \(\$_s\) =>/);
  assert.match(out, /\$\$get as \$\$get_/);
  assert.match(out, /let \$t_0;/);
});

check('offsets are UTF-16, so non-ASCII text does not shift edits', () => {
  const out = compiled(
    "import { $$ } from 'silmaril';\n// héllo 😀 日本\n$$(() => { let s = '😀'; s = 'é' + s; });\n",
    'a.ts',
  );
  assert.ok(
    out.includes("$$set($s, 0, '😀'); $$set($s, 0, 'é' + $$get($s, 0));"),
  );
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

check('ready() resolves to the same promise every time', () => {
  assert.equal(ready(), ready());
});

check('the source map names the generated file', () => {
  const result = compile("import { $$ } from 'silmaril';\n$$(() => {});\n", {
    filename: 'src/a.ts',
  });
  // magic-string keeps the base name.
  assert.equal(result.map!.file, 'a.ts');
  // Sources are relative to `file`, so both are in the same folder.
  assert.deepEqual(result.map!.sources, ['a.ts']);
});

check('tricky.tsx and the generated file compile to code that parses', () => {
  parseModule(compiled(tricky, 'tricky.tsx'), 'out.tsx');
  parseModule(compiled(generated, 'generated.tsx'), 'out.tsx');
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
    // Skip the rewritten imports and the generated names.
    if (node.type === 'ImportDeclaration') {
      return false;
    }
    // `$$set($s, k, name)` after a destructuring memo is generated text. It maps to
    // the start of its edit, like any inserted text.
    if (
      node.type === 'CallExpression' &&
      node.callee.name === '$$set' &&
      node.arguments[2]?.type === 'Identifier'
    ) {
      return false;
    }
    if (
      node.type !== 'Identifier' ||
      node.name.startsWith('$$') ||
      /^\$[sctg]\d/.test(node.name) ||
      /^\$[sc](_|$)/.test(node.name)
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
    assert.ok(checked > 100, `checked ${checked}`);
    assert.deepEqual(wrong.slice(0, 10), []);
  },
);

check(
  'source map points every identifier back to its origin (generated)',
  () => {
    const { checked, wrong } = checkSourceMap(generated, 'generated.tsx');
    assert.ok(checked > 1000, `checked ${checked}`);
    assert.deepEqual(wrong.slice(0, 10), []);
  },
);

check('setup declarations get slots; loops and nested functions do not', () => {
  const m = model(`import { $$ } from 'silmaril';
$$(() => {
  let x = 0;
  { let inner = 0; inner = 1; }
  for (const n of [1]) { let w = n; w += 1; }
  const handler = () => x;
  const plain = () => 1;
  const double = x * 2;
  const f = () => { let local = 0; local = 1; };
  x = 1;
});`);
  const names: string[] = [];
  for (const slot of m.scopes[0]!.slots) {
    names.push(`${slot.binding.name}:${slot.declarator.kind}`);
  }
  assert.deepEqual(names, [
    'x:state',
    'inner:state',
    'handler:memo',
    'double:memo',
  ]);
});

check('a split declaration without a statement list gets a block', () => {
  const out = compiled(
    "import { $$ } from 'silmaril';\n$$(() => { let a = 0; if (a) var w = 1, z = 2; w = 3; });",
  );
  assert.match(out, /if \(a\) \{ \$\$set\(\$s, 0, 1\); var z = 2; \}/);
});

check('a written binding is not a local function', () => {
  const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let a = 0;
  let f = () => a;
  $sync(f());
  f = () => 0;
  a = 1;
});`);
  const root = m.scopes[0]!;
  const reads: string[] = [];
  for (const binding of root.entries[1]!.reads) {
    reads.push(binding.name);
  }
  assert.deepEqual(reads, ['f']);
});

check('the compiler files import no node: module', () => {
  for (const file of [
    'compile.ts',
    'source.ts',
    'scope.ts',
    'model.ts',
    'codegen.ts',
  ]) {
    const text = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(text, /from ['"]node:/, file);
  }
});

if (failures) {
  console.log(`${failures} failed`);
  process.exit(1);
}
console.log('all passed');
