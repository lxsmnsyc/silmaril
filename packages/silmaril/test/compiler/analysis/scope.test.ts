import { describe, expect, it } from 'vitest';
import { resolveName } from '../../../compiler/analysis/scope';
import { visit } from '../../../compiler/analysis/walk';
import { CompileError } from '../../../compiler/errors';
import { parseModule } from '../../../compiler/source';
import {
  analyze,
  generateModule,
  refsNamed,
  tricky,
  type Analyzed,
} from './helpers';

const generated = generateModule(2000);

describe('parsing', () => {
  it('parses TSX and TS', () => {
    parseModule(tricky, 'tricky.tsx');
    parseModule(generated, 'generated.tsx');
    // `<T>x` is a type assertion in .ts and a JSX element in .tsx.
    parseModule(
      'const a = <number>b; enum E { A } let c = d satisfies E;',
      'a.ts',
    );
    expect(() => parseModule('const a = <number>b;', 'a.tsx')).toThrow(
      CompileError,
    );
  });

  it('parses .js as JSX', () => {
    expect(parseModule('<Tag />;', 'a.js').lang).toBe('jsx');
    expect(parseModule('<Tag />;', 'a.mjs').lang).toBe('jsx');
    expect(parseModule('let a = 1;', 'a.cts').lang).toBe('ts');
  });
});

describe('scopes', () => {
  it('skips types and resolves shadowing', () => {
    const { info } = analyze(`
      type T = typeof x;
      let x: T = 1;
      function f(x: number) { return x; }
      { let x = 2; x; }
      const g = function x() { return x; };
      try {} catch (x) { x; }
      for (let x of []) x;
      use(x);
    `);
    // Only `use(x)` reads the module-level x. `typeof x` in a type is not a value read.
    expect(info.root.bindings.get('x')!.references.length).toBe(1);
    const kinds = refsNamed(info, 'x').map((ref) =>
      ref.binding ? ref.binding.kind : 'global',
    );
    expect(kinds).toEqual(['param', 'let', 'function', 'catch', 'let', 'let']);
  });

  it('hoists var and function declarations', () => {
    const { info } = analyze('f(v); { var v = 1; } function f() {}');
    expect(refsNamed(info, 'v')[0]!.binding!.scope).toBe(info.root);
    expect(refsNamed(info, 'f')[0]!.binding!.kind).toBe('function');
  });

  it('parameter defaults do not see body declarations', () => {
    const { info } = analyze('let x = 1; function f(a = x) { let x = 2; x; }');
    const [inDefault, inBody] = refsNamed(info, 'x');
    expect(inDefault!.binding!.scope.kind).toBe('module');
    expect(inBody!.binding!.scope.kind).toBe('function');
    // Without parameter expressions, parameters and body share one scope.
    const plain = analyze('function g(a) { let b = a; }').info;
    expect(refsNamed(plain, 'a')[0]!.binding!.kind).toBe('param');
  });

  it('declares TS enums, namespaces, import-equals, declare const and parameter properties', () => {
    const { info } = analyze(`
      enum E { A }
      namespace A.B { export const y = z; }
      import fs = require('fs');
      declare const d: number;
      declare function ambient(): void;
      class K { constructor(private p: number) { p; } }
    `);
    const kinds: Record<string, string> = {};
    for (const [name, binding] of info.root.bindings) {
      kinds[name] = binding.kind;
    }
    expect(kinds).toEqual({
      E: 'enum',
      A: 'namespace',
      fs: 'import-equals',
      d: 'const',
      K: 'class',
    });
    expect(refsNamed(info, 'z').length).toBe(1);
    expect(refsNamed(info, 'p')[0]!.binding!.kind).toBe('param');
  });

  it('`<this.Foo />` reads no binding named this, and lower-case tags are not references', () => {
    const { info } = analyze(
      'const Foo = 1; <this.Foo />; <div />; <my-el />; <Foo.Bar />;',
      'a.tsx',
    );
    expect(refsNamed(info, 'this').length).toBe(0);
    expect(refsNamed(info, 'div').length).toBe(0);
    expect(refsNamed(info, 'Foo').map((ref) => ref.context)).toEqual(['jsx']);
  });

  it('records one reference per JSX element, not one per closing tag', () => {
    const { info } = analyze('const C = 1; <C>text</C>;', 'a.tsx');
    expect(refsNamed(info, 'C').length).toBe(1);
  });

  it('reference context: shorthand, JSX tag, export', () => {
    const { info } = analyze(
      'let a = 1; const C = 2; ({ a }); ({ a } = {}); ({ a = 1 } = {}); <C />; export { a };',
      'a.tsx',
    );
    expect(
      info.references.map((ref) => `${ref.identifier.name}:${ref.context}`),
    ).toEqual([
      'a:shorthand',
      'a:shorthand',
      'a:shorthand',
      'C:jsx',
      'a:export',
    ]);
  });

  it('read, write and writeExpression of references', () => {
    const { info } = analyze(
      'let x = 0; x = 1; x += 1; x++; [x] = [1]; for (x of []) {} (x as number) = 2; f(x);',
    );
    const flags = refsNamed(info, 'x').map((ref) => {
      const kind = ref.writeExpression ? ref.writeExpression.type : '-';
      return `${ref.read ? 'r' : ''}${ref.write ? 'w' : ''}:${kind}`;
    });
    expect(flags).toEqual([
      'w:AssignmentExpression',
      'rw:AssignmentExpression',
      'rw:UpdateExpression',
      'w:AssignmentExpression',
      'w:ForOfStatement',
      'w:AssignmentExpression',
      'r:-',
    ]);
  });

  it('resolveName walks up the scopes', () => {
    const { info } = analyze('let a = 1; function f() { let b = 2; b; }');
    const inner = refsNamed(info, 'b')[0]!.scope;
    expect(resolveName(inner, 'a')).toBe(info.root.bindings.get('a'));
    expect(resolveName(inner, 'b')!.kind).toBe('let');
    expect(resolveName(inner, 'missing')).toBe(null);
  });

  it('names holds every declared and referenced name, globals included', () => {
    const { info }: Analyzed = analyze('let a = b; function c() {}');
    expect([...info.names].toSorted()).toEqual(['a', 'b', 'c']);
  });
});

describe('visit', () => {
  it('is in source order, skips types and visits a shorthand once', () => {
    const { parsed } = analyze(
      'let x: Foo<Bar> = y; const o = { x }; @dec class K {}',
    );
    const names: string[] = [];
    visit(parsed.program, (node) => {
      if (node.type === 'Identifier') {
        names.push(node.name);
      }
    });
    expect(names).toEqual(['x', 'y', 'o', 'x', 'dec', 'K']);
  });

  it('skips the children when enter returns false', () => {
    const { parsed } = analyze('f(a, g(b));');
    const names: string[] = [];
    visit(parsed.program, (node) => {
      if (node.type === 'Identifier') {
        names.push(node.name);
      }
      return !(node.type === 'CallExpression' && names.includes('f'));
    });
    expect(names).toEqual(['f', 'a']);
  });
});
