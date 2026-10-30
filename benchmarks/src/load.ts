import type { Pipeline } from '../../packages/silmaril/test/behavior/harness';

type Entry = (...args: unknown[]) => unknown;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => Entry;

// Only the import forms the generated sources use: `import { a, b as c } from 'x'`.
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*(['"])([^'"]+)\2;?/g;

/** Turns named imports of a compiled module into lookups on a modules table. */
function linkImports(code: string): string {
  return code.replace(
    IMPORT,
    (_match, names: string, _quote, specifier: string) => {
      const bindings = names
        .split(',')
        .map((name) => name.trim().replace(/\s+as\s+/, ': '));
      return `const { ${bindings.join(', ')} } = __modules[${JSON.stringify(specifier)}];`;
    },
  );
}

/**
 * Compiles `code` with the pipeline and runs it. `scope` becomes free
 * identifiers of the module (here `expose` and `sink`, `log`).
 */
export async function runModule(
  pipeline: Pipeline,
  code: string,
  scope: Record<string, unknown>,
): Promise<void> {
  const compiled = await pipeline.compile(code, 'bench.js');
  const modules = { silmaril: pipeline.runtime, ...pipeline.modules };
  const names = Object.keys(scope);
  const fn = new AsyncFunction('__modules', ...names, linkImports(compiled));
  await fn(modules, ...names.map((name) => scope[name]));
}
