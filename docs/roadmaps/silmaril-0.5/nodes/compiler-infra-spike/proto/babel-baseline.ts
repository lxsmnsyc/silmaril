// Loads @babel/core and the current Babel plugin from packages/silmaril, as the baseline.
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDir = fileURLToPath(
  new URL('../../../../../../packages/silmaril/', import.meta.url),
);

// babel/index.ts imports './checks' without an extension. Node needs one to strip types.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.includes('/packages/silmaril/babel/')
    ) {
      try {
        return nextResolve(specifier, context);
      } catch {
        return nextResolve(`${specifier}.ts`, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const require = createRequire(`${packageDir}package.json`);

export const babel: typeof import('@babel/core') = await import(
  pathToFileURL(require.resolve('@babel/core')).href
);

export const silmarilPlugin = (
  await import(pathToFileURL(`${packageDir}babel/index.ts`).href)
).default;

export function babelCompile(code: string, filename: string): string {
  const result = babel.transformSync(code, {
    plugins: [[silmarilPlugin, {}]],
    parserOpts: { plugins: ['jsx', 'typescript'] },
    filename,
    configFile: false,
    babelrc: false,
    sourceMaps: true,
    ast: false,
  });
  return result?.code ?? '';
}

export function babelParse(code: string, filename: string) {
  return babel.parseSync(code, {
    parserOpts: { plugins: ['jsx', 'typescript'] },
    filename,
    configFile: false,
    babelrc: false,
  });
}
