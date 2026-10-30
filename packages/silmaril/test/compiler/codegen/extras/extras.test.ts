// Constructs of $store, $composable, lifecycles and $skip that no fixture covers:
// aliased names, TypeScript wrappers, multiple declarators and generated names.
import { describe, expect, it } from 'vitest';
import { compileChecked } from '../helpers';

function compileCode(code: string, filename = 'input.js'): string {
  return compileChecked(code, filename).code;
}

describe('codegen extras', () => {
  it('prints a $store declarator between plain declarators', () => {
    const code = compileCode(`
      import { $$, $store } from 'silmaril';
      const src = { get: () => 1, subscribe: () => () => {} };
      $$(() => {
        let a = 1, s = $store(src), b = 2;
        a = 3;
        s = 4;
        log(a, s, b);
      });
    `);
    expect(code).toContain('$$store($s, ');
    expect(code).toContain('$$store($s, 1, src, 0); let b = 2;');
  });

  it('strips a TypeScript wrapper around the $store argument', () => {
    const code = compileCode(
      `
      import { $$, $store } from 'silmaril';
      declare const src: { get(): number; subscribe(): () => void };
      $$(() => {
        const s = $store(src as typeof src);
        log(s);
      });
    `,
      'input.ts',
    );
    expect(code).toContain('$$store($s, 0, src as typeof src);');
  });

  it('compiles aliased lifecycle and skip names', () => {
    const code = compileCode(`
      import { $$, onMount as mount, onDestroy as destroy, $skip as skip } from 'silmaril';
      $$(() => {
        let a = 0;
        a = 1;
        mount(() => log(skip(a)));
        destroy(() => log('bye'));
      });
    `);
    expect(code).toContain('$$mount($s, ');
    expect(code).toContain('$$destroy($s, ');
    expect(code).toContain('$$mount($s, () => log(($$get($s, 0))));');
    expect(code).not.toContain(' skip(');
  });

  it('compiles $skip with a slot read to a plain read', () => {
    const code = compileCode(`
      import { $$, $skip } from 'silmaril';
      $$(() => {
        let a = 0;
        a = 1;
        log($skip(a + 1));
      });
    `);
    expect(code).toContain('log(($$get($s, 0) + 1));');
  });

  it('binds onMount in a nested entry to the entry scope', () => {
    const code = compileCode(`
      import { $$, $sync, onMount } from 'silmaril';
      $$(() => {
        let a = 0;
        a = 1;
        $sync(() => {
          let b = a;
          b = 2;
          onMount(() => log(b));
        });
      });
    `);
    expect(code).toContain('$$mount($c0, ');
  });

  it('wraps a composable in its own graph', () => {
    const code = compileCode(`
      import { $$, $composable } from 'silmaril';
      const useCount = $composable(() => {
        let n = 0;
        n = 1;
        return () => n;
      });
      $$(() => { useCount(); });
    `);
    expect(code).toContain('$$composable(');
    expect(code).toContain('const useCount = $$composable($g0, ($s) =>');
  });
});
