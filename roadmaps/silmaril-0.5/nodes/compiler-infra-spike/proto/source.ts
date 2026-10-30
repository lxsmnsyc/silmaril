// Parsing, errors, walking and the silmaril imports. In the package these are
// compiler/errors.ts, compiler/source.ts and compiler/analysis/{walk,imports}.ts.
import { parseSync } from 'oxc-parser';
import { childNodes, type Binding, type Node } from './scope.ts';

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

export const SOURCE_MODULE = 'silmaril';

export type TrackedName =
  | '$$'
  | '$composable'
  | '$'
  | '$sync'
  | '$skip'
  | '$store'
  | 'onMount'
  | 'onDestroy';

const TRACKED = new Set<string>([
  '$$',
  '$composable',
  '$',
  '$sync',
  '$skip',
  '$store',
  'onMount',
  'onDestroy',
]);

function getLang(filename: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const match = /\.[cm]?([jt]sx?)$/i.exec(filename);
  const lang = match ? match[1]!.toLowerCase() : 'js';
  // `.js` files parse as JSX, as the 0.4 Babel plugin did.
  return (lang === 'js' ? 'jsx' : lang) as 'js' | 'jsx' | 'ts' | 'tsx';
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

const WRAPPERS = new Set([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

export function isWrapper(node: Node): boolean {
  return WRAPPERS.has(node.type);
}

/** Sees through parentheses and the TS value wrappers. */
export function unwrap(node: Node): Node {
  let current = node;
  while (WRAPPERS.has(current.type)) {
    current = current.expression;
  }
  return current;
}

/**
 * Visits every node in source order, with its parent. Return false to skip the children.
 * Type-only keys are not walked, and a shorthand property is visited once.
 */
export function visit(
  node: Node,
  enter: (node: Node, parent: Node | null) => boolean | void,
  parent: Node | null = null,
): void {
  if (enter(node, parent) === false) {
    return;
  }
  for (const child of childNodes(node)) {
    visit(child, enter, node);
  }
}

export interface SilmarilImports {
  /** Named import declarations from 'silmaril' (not `import type`). */
  declarations: Node[];
  /** Local binding of each compile-time name, with the imported name. */
  tracked: Map<Binding, TrackedName>;
  /** The specifiers of compile-time names, removed by the import rewrite. */
  compileTime: Set<Node>;
}

export function findSilmarilImports(
  program: Node,
  declarationOf: Map<Node, Binding>,
): SilmarilImports {
  const imports: SilmarilImports = {
    declarations: [],
    tracked: new Map(),
    compileTime: new Set(),
  };
  for (const statement of program.body) {
    if (
      statement.type !== 'ImportDeclaration' ||
      statement.source.value !== SOURCE_MODULE ||
      statement.importKind === 'type'
    ) {
      continue;
    }
    let named = false;
    for (const specifier of statement.specifiers) {
      if (
        specifier.type !== 'ImportSpecifier' ||
        specifier.importKind === 'type'
      ) {
        continue;
      }
      named = true;
      const imported =
        specifier.imported.type === 'Identifier'
          ? specifier.imported.name
          : specifier.imported.value;
      const binding = declarationOf.get(specifier.local);
      if (TRACKED.has(imported) && binding) {
        imports.tracked.set(binding, imported as TrackedName);
        imports.compileTime.add(specifier);
      }
    }
    if (named) {
      imports.declarations.push(statement);
    }
  }
  return imports;
}
