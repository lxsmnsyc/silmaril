import type { ImportDeclaration, ImportSpecifier, Program } from 'oxc-parser';
import type { Binding, ScopeInfo } from './scope';

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

export interface SilmarilImports {
  /** Named import declarations from 'silmaril', in source order (not `import type`). */
  declarations: ImportDeclaration[];
  /** The local binding of each compile-time name, aliases included. */
  tracked: Map<Binding, TrackedName>;
  /** The specifiers the import rewrite removes. */
  compileTime: Set<ImportSpecifier>;
}

/**
 * The named imports of compile-time names from 'silmaril'. Namespace and default
 * imports are not tracked, and calls through them are not compiled.
 */
export function findSilmarilImports(
  program: Program,
  declarationOf: ScopeInfo['declarationOf'],
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

    // Only value specifiers count. A declaration with none of them is left alone.
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
