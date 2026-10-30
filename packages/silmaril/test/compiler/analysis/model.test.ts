import { describe, expect, it } from 'vitest';
import { analyzeModule } from '../../../compiler/analysis/index';
import type {
  Entry,
  ModuleModel,
  ReactiveScope,
} from '../../../compiler/analysis/model';
import { model } from './helpers';

function readNames(entry: Entry): string[] {
  return [...entry.reads].map((binding) => binding.name).toSorted();
}

function readSlots(scope: ReactiveScope): string[] {
  return scope.slots.map(
    (slot) => `${slot.binding.name}:${slot.declarator.kind}`,
  );
}

function getRoot(m: ModuleModel): ReactiveScope {
  return m.scopes.find((scope) => scope.call)!;
}

describe('imports', () => {
  it('returns null when no compile-time name is imported', () => {
    expect(analyzeModule('let x = 0; x++;', 'a.js')).toBe(null);
    expect(
      analyzeModule(
        "import { $$ } from 'other';\n$$(() => { let silmaril = 0; silmaril++; });",
        'a.js',
      ),
    ).toBe(null);
    expect(
      analyzeModule("import { tick } from 'silmaril';\ntick();", 'a.js'),
    ).toBe(null);
    expect(
      analyzeModule(
        "import type { $$ } from 'silmaril';\nimport * as s from 'silmaril';\ns.$$(() => {});",
        'a.ts',
      ),
    ).toBe(null);
  });

  it('tracks aliased imports and keeps the other specifiers', () => {
    const m = model(
      "import { $$ as setup, $sync as sync, tick, type Store } from 'silmaril';\nimport { $ as effect } from 'silmaril';\nsetup(() => { let x = 0; sync(x); effect(x); x = 1; });",
      'a.ts',
    );
    expect([...m.imports.tracked.values()]).toEqual(['$$', '$sync', '$']);
    expect(
      [...m.imports.compileTime].map((specifier) => specifier.local.name),
    ).toEqual(['setup', 'sync', 'effect']);
    expect(m.imports.declarations.length).toBe(2);
    expect([...m.trackedCalls.values()]).toEqual(['$$', '$sync', '$']);
    const root = getRoot(m);
    expect(root.entries.map((entry) => entry.kind)).toEqual(['sync', 'effect']);
  });

  it('a local that shadows an import is not tracked', () => {
    const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let x = 0;
  const $sync = (v) => v;
  $sync(x);
  x = 1;
});`);
    expect(getRoot(m).entries.length).toBe(0);
    expect(m.trackedCalls.size).toBe(1);
  });

  it('a call through a namespace import is not compiled', () => {
    const m = model(
      "import { $$ } from 'silmaril';\nimport * as s from 'silmaril';\n$$(() => { let x = 0; s.$sync(x); x = 1; });",
    );
    expect(getRoot(m).entries.length).toBe(0);
  });
});

describe('slots', () => {
  it('setup declarations get slots; loops and nested functions do not', () => {
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
    expect(readSlots(getRoot(m))).toEqual([
      'x:state',
      'inner:state',
      'handler:memo',
      'double:memo',
    ]);
  });

  it('shadowed names inside a setup do not share a slot', () => {
    const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let x = 0;
  function reset() { let x = 1; x = 2; return x; }
  $sync(reset());
  $sync(log(x));
  x = 3;
});`);
    const root = getRoot(m);
    expect(readSlots(root)).toEqual(['x:state']);
    // `reset` reads only its own x, which has no slot.
    expect(root.entries.map(readNames)).toEqual([[], ['x']]);
    expect(root.graph).toEqual([[1]]);
  });

  it('destructuring patterns give one slot per name, defaults and computed keys excluded', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  let k = 'a';
  let { [k]: a, b = k, ...rest } = obj;
  const [c, [d], ...e] = [a, [b], rest];
  [a, { b = a }] = [1, {}];
  k = 'b';
});`);
    const root = getRoot(m);
    expect(readSlots(root)).toEqual([
      'k:state',
      'a:state',
      'b:state',
      'rest:state',
      'c:memo',
      'd:memo',
      'e:memo',
    ]);
    // A destructuring memo has no single output slot.
    expect(root.entries.map((entry) => [entry.kind, entry.slot])).toEqual([
      ['memo', -1],
    ]);
    const site = m.writes.find((write) => write.kind === 'destructure')!;
    expect(site.statement).toBe(true);
    expect(
      site.targets.map(
        (target) => `${target.identifier.name}:${target.shorthand}`,
      ),
    ).toEqual(['a:false', 'b:true']);
  });

  it('sees through TS wrappers in setup arguments, callees and write targets', () => {
    const m = model(
      `import { $$, $sync } from 'silmaril';
($$ as typeof $$)((() => {
  let x = 0 as number;
  ($sync!)(x satisfies number);
  (x as number) = 1;
  (x!)++;
}) as () => void);`,
      'a.ts',
    );
    const root = getRoot(m);
    expect(readSlots(root)).toEqual(['x:state']);
    expect(root.entries.map(readNames)).toEqual([['x']]);
    expect(m.writes.map((write) => write.kind)).toEqual(['assign', 'update']);
  });

  it('$store gives a store slot, and a let store a write-back entry', () => {
    const m = model(`import { $$, $store } from 'silmaril';
$$(() => {
  const a = $store(s);
  let b = $store(t);
  log(a, b);
});`);
    const root = getRoot(m);
    expect(readSlots(root)).toEqual(['a:store', 'b:store']);
    expect(root.entries.map((entry) => [entry.kind, entry.slot])).toEqual([
      ['store-writeback', 1],
    ]);
    expect(root.graph).toEqual([[], [0]]);
  });

  it('a redeclared var is a write', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  var v = 1;
  var v = 2;
  var w;
  var w;
});`);
    expect(readSlots(getRoot(m))).toEqual(['v:state']);
    expect(m.writes.map((write) => write.kind)).toEqual(['redeclare']);
  });
});

describe('nested setups', () => {
  it('a nested setup is its own tree, and its reads of outer slots give no edge', () => {
    const m = model(`import { $$, $composable, $sync } from 'silmaril';
$$(() => {
  let x = 0;
  const inner = $composable(() => {
    let y = 0;
    $sync(log(x, y));
    y = 1;
  });
  $$(() => { $sync(log(x)); });
  x = 1;
});`);
    const setups = m.scopes.filter((scope) => scope.call);
    expect(
      setups.map((scope) => [scope.kind, scope.setupDepth, scope.param]),
    ).toEqual([
      ['root', 0, '$s'],
      ['composable', 1, '$s1'],
      ['root', 1, '$s1'],
    ]);
    for (const setup of setups) {
      expect(setup.parent).toBe(null);
      expect(setup.tree).toBe(setup);
    }
    // `inner` is a setup, never a memo, and it has no slot.
    expect(readSlots(setups[0]!)).toEqual(['x:state']);
    expect(setups[0]!.graph).toEqual([[]]);
    expect(setups[1]!.graph).toEqual([[0]]);
    expect(setups[2]!.graph).toEqual([]);
    expect(m.scopes.map((scope) => scope.graphName).filter(Boolean)).toEqual([
      '$g0',
      '$g1',
      '$g2',
    ]);
  });

  it('entry bodies own slots and entries, with path refs in the setup graph', () => {
    const m = model(`import { $$, $sync, $ } from 'silmaril';
$$(() => {
  let x = 1;
  $sync(() => {
    let y = x;
    $(() => log(x, y));
    y = 2;
  });
  x = 2;
});`);
    const root = getRoot(m);
    const body = root.entries[0]!.child!;
    expect(body.isBody).toBe(true);
    expect(body.param).toBe('$c0');
    expect(readSlots(body)).toEqual(['y:memo']);
    // The body reads x only in its memo and its nested entry, so entry 0 has no edge.
    expect(root.graph).toEqual([
      [
        [0, 0],
        [0, 1],
      ],
    ]);
    expect(body.graph).toEqual([[1]]);
    expect(body.entries[1]!.child!.param).toBe('$c0_1');
  });
});

describe('reads through local functions', () => {
  it('direct, transitive, recursive, optional and reassigned helpers', () => {
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
    const root = getRoot(m);
    // `four` is a written let: a slot, read as a value, not followed. It is also a
    // memo (entry 0), because its initializer reads `d`.
    expect(root.entries.map(readNames)).toEqual([
      ['d'],
      ['a', 'b'],
      ['c'],
      ['four'],
      ['a'],
    ]);
    expect(root.graph).toEqual([[1, 4], [1], [2], [0], [3]]);
  });

  it('a written binding is not a local function', () => {
    const m = model(`import { $$, $sync } from 'silmaril';
$$(() => {
  let a = 0;
  let f = () => a;
  $sync(f());
  f = () => 0;
  a = 1;
});`);
    expect(readNames(getRoot(m).entries[1]!)).toEqual(['f']);
  });

  it('imported functions, parameters, member calls and outer functions are opaque', () => {
    const m = model(`import { $$, $composable, $sync } from 'silmaril';
import { helper } from './helper';
function outside() { return x; }
const obj = { get: () => 1 };
const use = $composable((param) => {
  let x = 0;
  const local = { read: () => x };
  $sync(helper());
  $sync(param());
  $sync(local.read());
  $sync(outside());
  x = 1;
});`);
    const setup = m.scopes.find((scope) => scope.call)!;
    expect(readSlots(setup)).toEqual(['x:state', 'local:memo']);
    expect(setup.entries.map(readNames)).toEqual([
      ['x'],
      [],
      [],
      ['local'],
      [],
    ]);
  });

  it('a body gets the reads of its own memos', () => {
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
    const root = getRoot(m);
    expect(root.graph).toEqual([[0, [0, 0]]]);
    // b is read only by the body itself, which owns it.
    expect(root.entries[0]!.child!.graph).toEqual([[1], []]);
  });

  it('reads inside $skip are not tracked', () => {
    const m = model(`import { $$, $sync, $skip } from 'silmaril';
$$(() => {
  let a = 0;
  let b = 0;
  $sync(log(a, $skip(b)));
  a = b = 1;
});`);
    expect(readNames(getRoot(m).entries[0]!)).toEqual(['a']);
    expect(m.skips.length).toBe(1);
  });
});

describe('scope bindings', () => {
  it('binds each lifecycle and composable call to its scope', () => {
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
    expect(
      m.bindings
        .map(
          (binding) =>
            `${binding.name}:${binding.scope.kind}:${binding.scope.param}`,
        )
        .toSorted(),
    ).toEqual([
      'composable-call:memo:$c0',
      'composable-call:sync:$c1',
      'onMount:composable:$s',
      'onMount:effect:$c2',
      'onMount:root:$s',
      'onMount:sync:$c1',
    ]);
  });

  it('a lifecycle call inside a function memo binds to the scope around the memo', () => {
    const m = model(`import { $$, onMount } from 'silmaril';
$$(() => {
  let x = 0;
  const f = () => { onMount(() => log(x)); };
  x = 1;
});`);
    expect(m.bindings[0]!.scope.kind).toBe('root');
  });
});

describe('generated names', () => {
  it('picks a prefix that no user name collides with', () => {
    const m = model(
      "import { $$, $sync } from 'silmaril';\nconst $s = 1, $t0 = 3;\n$$(() => { let x = 0; $sync(() => { let y = x; y = 1; }); x = 2; });\n",
    );
    expect(m.scopes.map((scope) => scope.param)).toEqual([
      '$_s',
      '$_c0',
      '$_c0_0',
    ]);
    expect(m.scopes.map((scope) => scope.graphName)).toEqual([
      '$_g0',
      '$_g1',
      null,
    ]);
  });
});

describe('write sites', () => {
  it('records the kind, the statement flag and the function that declares the temps', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  let x = 0;
  let y = 0;
  x = 1;
  x *= 2;
  x ??= 3;
  x++;
  [x, y] = [y, x];
  if (x) [x] = [1];
  for (x of [1]) {}
  class K { f = ([y] = [1]); }
});`);
    expect(
      m.writes.map((site) => `${site.kind}:${site.statement}:${site.fn.type}`),
    ).toEqual([
      'assign:false:ArrowFunctionExpression',
      'compound:false:ArrowFunctionExpression',
      'logical:false:ArrowFunctionExpression',
      'update:false:ArrowFunctionExpression',
      'destructure:true:ArrowFunctionExpression',
      'destructure:false:ArrowFunctionExpression',
      'for:false:ArrowFunctionExpression',
      'destructure:false:PropertyDefinition',
    ]);
    expect(m.writeOf.get(m.writes[0]!.node)).toBe(m.writes[0]);
  });
});

describe('var redeclarations', () => {
  it('a var in a loop body that redeclares a setup var with an initializer is a write', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  var x = 1;
  while (c) { var x = 2; }
});`);
    expect(readSlots(getRoot(m))).toEqual(['x:state']);
    expect(
      m.writes.map(
        (site) => `${site.kind}:${site.statement}:${site.node.type}`,
      ),
    ).toEqual(['redeclare:true:VariableDeclarator']);
  });

  it('a var in a for head or loop body gives write sites of a slotted var', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  var x = 1;
  x = 5;
  for (;;) { var x = 2; }
  for (var x = 3; c; ) {}
  for (var x of xs) {}
  for (var x in o) {}
  do { var x; } while (c);
});`);
    expect(readSlots(getRoot(m))).toEqual(['x:state']);
    expect(
      m.writes.map(
        (site) =>
          `${site.kind}:${site.statement}:${site.node.type}:${site.pattern.type}`,
      ),
    ).toEqual([
      'assign:false:AssignmentExpression:Identifier',
      'redeclare:true:VariableDeclarator:Identifier',
      'redeclare:false:VariableDeclarator:Identifier',
      'for:false:ForOfStatement:VariableDeclaration',
      'for:false:ForInStatement:VariableDeclaration',
      'redeclare:true:VariableDeclarator:Identifier',
    ]);
    for (const site of m.writes) {
      expect(site.targets.map((target) => target.slot.index)).toEqual([0]);
    }
  });

  it('a for-of head var counts for slot rule 1', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  var x;
  for (var x of xs) {}
});`);
    expect(readSlots(getRoot(m))).toEqual(['x:state']);
  });

  it('a loop var with no setup var of the same name is a plain local', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  while (c) { var w = 1; w = 2; }
});`);
    expect(readSlots(getRoot(m))).toEqual([]);
    expect(m.writes).toEqual([]);
  });

  it('detects a redeclaration per bound name', () => {
    const second = model(`import { $$ } from 'silmaril';
$$(() => {
  var a = 1;
  a = 2;
  var [b, a] = arr;
});`);
    expect(readSlots(getRoot(second))).toEqual(['a:state']);
    expect(
      second.writes.map((site) =>
        site.targets.map((target) => target.identifier.name),
      ),
    ).toEqual([['a'], ['a']]);

    const first = model(`import { $$ } from 'silmaril';
$$(() => {
  var a = 1;
  a = 2;
  var [a, b] = arr;
  b = 3;
});`);
    const root = getRoot(first);
    expect(readSlots(root)).toEqual(['a:state', 'b:state']);
    const site = first.writes.find((write) => write.kind === 'redeclare')!;
    expect(site.targets.map((target) => target.slot.index)).toEqual([0, 1]);
    // The declarator holds b's slot and redeclares a. It prints as the write.
    expect(first.declarators.get(site.node as never)!.slots.length).toBe(1);
    expect([...first.declarations.values()].map((list) => list.length)).toEqual(
      [1, 1],
    );
  });

  it('a redeclaring declarator is never a memo', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  var a = 1;
  a = 2;
  var [a, c] = [a * 2];
});`);
    expect(readSlots(getRoot(m))).toEqual(['a:state']);
  });
});

describe('freeze rules of runtime contract v4', () => {
  it('a class expression initializer is never a memo, even when it reads a slot', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  let x = 0;
  const K = class { get() { return x; } };
  let L = class { f = x; };
  x = 1;
  L = null;
});`);
    const root = getRoot(m);
    expect(readSlots(root)).toEqual(['x:state', 'L:state']);
    expect(root.entries).toEqual([]);
  });

  it('a split declaration that is the bare body of an if gets slots per declarator', () => {
    const m = model(`import { $$ } from 'silmaril';
$$(() => {
  let a = 0;
  if (a) var w = 1, z = 2;
  w = 3;
});`);
    const root = getRoot(m);
    expect(readSlots(root)).toEqual(['w:state']);
    const declaration = root.slots[0]!.declarator.declaration;
    expect(declaration.declarations.length).toBe(2);
    expect(m.declarations.get(declaration)).toEqual([
      declaration.declarations[0],
    ]);
  });
});
