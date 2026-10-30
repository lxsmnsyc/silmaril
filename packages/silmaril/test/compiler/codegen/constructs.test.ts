// Constructs that no runtime fixture covers: loop redeclares, `for` inits, `var`
// patterns, split declarations, TypeScript, and generated names that a user name takes.
import { describe, expect, it } from 'vitest';
import { compile } from '../../../compiler/index';
import { runLogs } from './helpers';

function compileCode(code: string, filename = 'input.js'): string {
  return compile(code, { filename }).code;
}

describe('codegen constructs', () => {
  it('writes a redeclared var in loop bodies, for inits and for-in/of heads', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      $$(() => {
        var x = 0;
        $sync(() => log('x', x));
        for (let i = 1; i < 3; i++) {
          var x = i;
        }
        for (var x = 5, j = 0; j < 1; j++) {}
        for (var x of [7, 8]) {}
        for (var x in { k: 1 }) log('in', x);
      });
    `);
    expect(code).toContain('for (var x = $$set($s, 0, 5), j = 0;');
    expect(code).toContain('for (const $t0 of [7, 8])');
    expect(await runLogs(code)).toStrictEqual([
      ['x', 0],
      ['x', 1],
      ['x', 2],
      ['x', 5],
      ['x', 7],
      ['x', 8],
      ['x', 'k'],
      ['in', 'k'],
    ]);
  });

  it('keeps the var of a redeclare with a pattern', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      $$(() => {
        var a = 1;
        $sync(() => log('a', a));
        var [a, b] = [2, 3];
        log('b', b);
        for (var [a, c] = [4, 5]; false; ) {}
        log('c', c);
        for (var [a] of [[6]]) {}
      });
    `);
    expect(code).toContain('var [$t0, b] = [2, 3]; $$set($s, 0, $t0);');
    expect(code).not.toMatch(/let \$t/);
    expect(await runLogs(code)).toStrictEqual([
      ['a', 1],
      ['a', 2],
      ['b', 3],
      ['a', 4],
      ['c', 5],
      ['a', 6],
    ]);
  });

  it('wraps a split declaration that is the bare body of a statement', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      $$(() => {
        if (true) var p = 1, q = 2, r;
        $sync(() => log(p, q, r));
        p = 3;
      });
    `);
    expect(code).toContain('if (true) { $$set($s, 0, 1); var q = 2, r; }');
    expect(await runLogs(code)).toStrictEqual([
      [1, 2, undefined],
      [3, 2, undefined],
    ]);
  });

  it('splits plain declarators around slots with no initializer', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let x, y = 1, z;
        $sync(() => log(x, y, z));
        x = 2;
        z = 3;
      });
    `);
    expect(code).toContain('let y = 1;');
    expect(await runLogs(code)).toStrictEqual([
      [undefined, 1, undefined],
      [2, 1, undefined],
      [2, 1, 3],
    ]);
  });

  it('gives an expression-bodied entry a block for its temps', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 0;
        let b = 0;
        $sync(() => log(a, b));
        $sync(() => [a, b] = [1, 2]);
      });
    `);
    expect(code).toContain('{ let $t0, $t1, $t2; return ');
    // The other $sync runs after the writing body returns.
    expect(await runLogs(code)).toStrictEqual([
      [0, 0],
      [1, 2],
    ]);
  });

  it('compiles compound, logical and update writes', async () => {
    const code = compileCode(`
      import { $$ } from 'silmaril';
      $$(() => {
        let n = 1;
        let s = null;
        n *= 3 + 1;
        s ??= 'set';
        s ||= 'kept';
        log(n++, ++n, n--, --n, s);
      });
    `);
    expect(await runLogs(code)).toStrictEqual([[4, 6, 6, 4, 'set']]);
  });

  it('sees through TypeScript wrappers and keeps the types', () => {
    const code = compileCode(
      `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let x: number = 0;
        (x as number) = 1;
        x! += 2;
        $sync(function (this: unknown) {
          let y: string = 'a';
          y = 'b';
          log(x, y);
        });
      });
    `,
      'input.ts',
    );
    expect(code).toContain('$$set($s, 0, 0);');
    expect(code).toContain('$$set($s, 0, 1);');
    expect(code).toContain('$$set($s, 0, $$get($s, 0) + (2));');
    expect(code).toContain('function (this: unknown, $c0) {');
    expect(code).toContain("$$set($c0, 0, 'a');");
  });

  it('renames helpers and temps that a user name takes', async () => {
    const code = compileCode(`
      import { $$, $sync } from 'silmaril';
      const $$get = 'user';
      const $t0 = 'user';
      $$(() => {
        let a = 0;
        let b = 0;
        $sync(() => log(a, b, $$get, $t0));
        [a, b] = [1, 2];
      });
    `);
    expect(code).toContain('$$get as $$get_');
    expect(code).toContain('[$t_0, $t_1] = [1, 2];');
    expect(await runLogs(code)).toStrictEqual([
      [0, 0, 'user', 'user'],
      [1, 0, 'user', 'user'],
      [1, 2, 'user', 'user'],
    ]);
  });

  it('keeps other silmaril specifiers and drops empty imports', async () => {
    const code = compileCode(`
      import { $$, tick } from 'silmaril';
      import { $ } from 'silmaril';
      $$(() => {
        let a = 0;
        $(() => log('a', a));
        a = 1;
      });
      await tick();
    `);
    expect(code).toContain(
      "import { $$root, $$get, $$set, $$effect, tick } from 'silmaril';",
    );
    expect(code).not.toContain("import { $ } from 'silmaril';");
    expect(await runLogs(code)).toStrictEqual([['a', 1]]);
  });

  it('fails on the constructs that codegen-extras compiles', () => {
    const cases = [
      `$$(() => { const s = $store(x); });`,
      `const C = $composable(() => {});`,
      `$$(() => { onMount(() => {}); });`,
      `$$(() => { onDestroy(() => {}); });`,
      `$$(() => { let a = 0; a = 1; log($skip(a)); });`,
    ];
    for (const body of cases) {
      const code = `import { $$, $store, $composable, onMount, onDestroy, $skip } from 'silmaril';\nconst x = null;\n${body}`;
      expect(() => compileCode(code)).toThrow(
        'is not supported by the compiler yet.',
      );
    }
  });
});
