// Prototype of silmaril/compiler: parse with oxc-parser, analyze scopes, edit with magic-string.
// It covers the part the spike must prove: imports, `$$` setups and the `let x` writes.
// Effects, computed values and stores are codegen work.
import { MagicString, type SourceMap } from 'magic-string';
import { parseSync } from 'oxc-parser';
import {
  analyzeScopes,
  createUidGenerator,
  type Binding,
  type Node,
  type Scope,
  type ScopeInfo,
} from './scope.ts';

export interface CompileOptions {
  filename: string;
  sourcemap?: boolean;
}

export interface CompileResult {
  code: string;
  map: SourceMap | null;
}

export class CompileError extends Error {
  loc: { line: number; column: number };
  frame: string;
  constructor(message: string, code: string, offset: number) {
    const loc = locate(code, offset);
    super(`${message} (${loc.line}:${loc.column})`);
    this.name = 'CompileError';
    this.loc = loc;
    this.frame = codeFrame(code, loc);
  }
}

function locate(
  code: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < code.length; i += 1) {
    if (code.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart };
}

function codeFrame(
  code: string,
  loc: { line: number; column: number },
): string {
  const lines = code.split('\n');
  const text = lines[loc.line - 1] ?? '';
  return `${loc.line} | ${text}\n${' '.repeat(String(loc.line).length)} | ${' '.repeat(loc.column)}^`;
}

const SOURCE_MODULE = 'silmaril';
const TRACKED = new Set([
  '$$',
  '$composable',
  '$',
  '$sync',
  '$store',
  'onMount',
  'onDestroy',
]);

function getLang(filename: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const match = /\.[cm]?([jt]sx?)$/i.exec(filename);
  return (match ? match[1]!.toLowerCase() : 'js') as
    | 'js'
    | 'jsx'
    | 'ts'
    | 'tsx';
}

export interface ParsedModule {
  code: string;
  filename: string;
  program: Node;
  comments: Node[];
}

export function parseModule(code: string, filename: string): ParsedModule {
  const result = parseSync(filename, code, {
    lang: getLang(filename),
    sourceType: 'module',
    preserveParens: true,
  });
  const error = result.errors[0];
  if (error) {
    throw new CompileError(error.message, code, error.labels[0]?.start ?? 0);
  }
  return { code, filename, program: result.program, comments: result.comments };
}

const TS_WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

export function unwrap(node: Node): Node {
  let current = node;
  while (TS_WRAPPERS.has(current.type)) {
    current = current.expression;
  }
  return current;
}

/** Imported silmaril names, keyed by the imported name, with their local bindings. */
export type SilmarilImports = Map<string, Set<Binding>>;

export function findSilmarilImports(
  program: Node,
  info: ScopeInfo,
): SilmarilImports {
  const imports: SilmarilImports = new Map();
  for (const statement of program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== SOURCE_MODULE
    ) {
      continue;
    }
    for (const specifier of statement.specifiers) {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type'
      ) {
        continue;
      }
      const imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
      const binding = info.declarationOf.get(specifier.local);
      if (TRACKED.has(imported) && binding) {
        let set = imports.get(imported);
        if (!set) {
          set = new Set();
          imports.set(imported, set);
        }
        set.add(binding);
      }
    }
  }
  return imports;
}

/** Visits every node in source order, with its parent. Return false to skip children. */
export function visit(
  node: Node,
  enter: (node: Node, parent: Node | null) => boolean | void,
): void {
  const stack: [Node, Node | null][] = [[node, null]];
  while (stack.length) {
    const [current, parent] = stack.pop()!;
    if (enter(current, parent) === false) {
      continue;
    }
    const children: Node[] = [];
    for (const key in current) {
      if (
        key === 'type' ||
        key === 'start' ||
        key === 'end' ||
        key === 'parent'
      ) {
        continue;
      }
      const value = current[key];
      if (value === null || typeof value !== 'object') {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item.type === 'string') {
            children.push(item);
          }
        }
      } else if (typeof value.type === 'string') {
        children.push(value);
      }
    }
    for (let i = children.length - 1; i >= 0; i -= 1) {
      stack.push([children[i], current]);
    }
  }
}

export interface Setup {
  call: Node;
  kind: '$$' | '$composable';
  fn: Node;
  scope: Scope;
  /** Variables declared in the setup function, outside nested functions. */
  variables: Set<Binding>;
}

function isSetupFunction(node: Node): boolean {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression'
  );
}

// Collects the bindings of `scope` and its block scopes, stopping at nested functions.
function collectVariables(scope: Scope, out: Set<Binding>): void {
  for (const binding of scope.bindings.values()) {
    if (
      binding.kind === 'let' ||
      binding.kind === 'const' ||
      binding.kind === 'var'
    ) {
      out.add(binding);
    }
  }
  for (const child of scope.children) {
    if (child.kind === 'block' || child.kind === 'catch') {
      collectVariables(child, out);
    }
  }
}

export function findSetups(
  code: string,
  program: Node,
  info: ScopeInfo,
  imports: SilmarilImports,
): Setup[] {
  const setups: Setup[] = [];
  const setupBindings = new Map<Binding, '$$' | '$composable'>();
  for (const kind of ['$$', '$composable'] as const) {
    for (const binding of imports.get(kind) ?? []) {
      setupBindings.set(binding, kind);
    }
  }
  if (setupBindings.size === 0) {
    return setups;
  }
  visit(program, (node) => {
    if (node.type !== 'CallExpression') {
      return;
    }
    const callee = unwrap(node.callee);
    if (callee.type !== 'Identifier') {
      return;
    }
    const binding = info.referenceOf.get(callee)?.binding;
    const kind = binding && setupBindings.get(binding);
    if (!kind) {
      return;
    }
    if (node.arguments.length !== 1) {
      throw new CompileError(
        `${kind} can only accept a single argument`,
        code,
        node.start,
      );
    }
    const fn = unwrap(node.arguments[0]);
    if (!isSetupFunction(fn)) {
      throw new CompileError(
        `${kind} argument must be ArrowFunctionExpression or FunctionExpression`,
        code,
        node.start,
      );
    }
    if (fn.body.type !== 'BlockStatement') {
      return;
    }
    const scope = info.scopes.get(fn)!;
    const variables = new Set<Binding>();
    collectVariables(scope, variables);
    setups.push({ call: node, kind, fn, scope, variables });
  });
  return setups;
}

export function compile(code: string, options: CompileOptions): CompileResult {
  if (!code.includes(SOURCE_MODULE)) {
    return { code, map: null };
  }
  const parsed = parseModule(code, options.filename);
  const info = analyzeScopes(parsed.program);
  const imports = findSilmarilImports(parsed.program, info);
  if (imports.size === 0) {
    return { code, map: null };
  }
  const setups = findSetups(code, parsed.program, info, imports);
  if (setups.length === 0) {
    return { code, map: null };
  }

  const uid = createUidGenerator(info.names);
  const hooks = new Map<string, string>();
  function hook(name: string): string {
    let local = hooks.get(name);
    if (!local) {
      local = uid(name);
      hooks.set(name, local);
    }
    return local;
  }

  const s = new MagicString(code);
  // Inner setups first would also work: each write is wrapped once, by the setup that owns it.
  for (const setup of setups) {
    const ctx = uid('ctx');
    s.appendLeft(
      setup.fn.body.start + 1,
      `\n  let ${ctx} = ${hook('$$context')}();`,
    );
    const writes = new Set<Node>();
    for (const binding of setup.variables) {
      for (const ref of binding.references) {
        if (
          ref.write &&
          ref.writeExpression &&
          ref.writeExpression.type !== 'ForOfStatement' &&
          ref.writeExpression.type !== 'ForInStatement'
        ) {
          writes.add(ref.writeExpression);
        }
      }
    }
    // Outer expressions open first, so sort by start, then by length.
    const sorted = [...writes].toSorted(
      (a, b) => a.start - b.start || b.end - a.end,
    );
    for (const write of sorted) {
      s.appendLeft(write.start, `${hook('$$update')}(${ctx}, `);
      s.prependRight(write.end, ')');
    }
  }

  const specifiers: string[] = [];
  for (const [name, local] of hooks) {
    specifiers.push(`${name} as ${local}`);
  }
  s.prepend(`import { ${specifiers.join(', ')} } from '${SOURCE_MODULE}';\n`);

  const sourcemap = options.sourcemap ?? true;
  return {
    code: s.toString(),
    map: sourcemap
      ? s.generateMap({
          source: options.filename,
          file: `${options.filename}.map`,
          includeContent: true,
          hires: 'boundary',
        })
      : null,
  };
}
