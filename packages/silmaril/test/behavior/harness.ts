/* oxlint-disable vitest/expect-expect, vitest/valid-expect, vitest/valid-title */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'oxc-parser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Store from '../../store';

export interface Pipeline {
  /** Unique name. Also the key used by `CaseOptions.xfail`. */
  name: string;
  /** Returns the compiled module source. May be async. */
  compile(code: string, filename: string): string | Promise<string>;
  /** What `import ... from 'silmaril'` resolves to. */
  runtime: Record<string, unknown>;
  /**
   * Extra modules by specifier, merged over the defaults (`silmaril` is
   * `runtime`, `silmaril/store` is the source store). Use it for `silmaril/store`
   * or a runtime specifier the compiler imports, such as `silmaril/runtime`.
   * A default import reads the `default` key; named imports read the keys.
   */
  modules?: Record<string, unknown>;
}

export interface RunResult {
  /** Every call to the injected `log`, in order. */
  logs: unknown[][];
  /** Runs fake timers and microtasks until nothing is scheduled. */
  flush(): Promise<void>;
  /** Restores real timers. `behaviorCases` calls it for you. */
  dispose(): void;
}

export interface CaseOptions {
  /** Pipeline names on which this case is expected to fail. */
  xfail?: string[];
}

export interface BehaviorCase {
  name: string;
  /** Module source that uses `log(...)`, and optionally `await flush()`. */
  code: string;
  /** Expected arguments of every `log` call, in order. */
  logs: unknown[][];
  options?: CaseOptions;
}

type Entry = (...args: unknown[]) => Promise<void>;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  ...args: string[]
) => Entry;

interface Node {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'type' in value;
}

/** Throws for dynamic `import()` anywhere in the tree. */
function rejectDynamicImport(value: unknown, id: string): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      rejectDynamicImport(item, id);
    }
    return;
  }
  if (!isNode(value)) {
    return;
  }
  if (value.type === 'ImportExpression') {
    throw new Error(`Dynamic import() is not supported in ${id}.`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'loc' && typeof child === 'object') {
      rejectDynamicImport(child, id);
    }
  }
}

function nameOf(node: Node): string {
  return node.type === 'Literal'
    ? (node.value as string)
    : (node.name as string);
}

function bindings(node: Node, table: string): string {
  const lines: string[] = [];
  const named: string[] = [];
  for (const spec of node.specifiers as Node[]) {
    const local = (spec.local as Node).name as string;
    if (spec.type === 'ImportDefaultSpecifier') {
      lines.push(`const ${local} = ${table}.default;`);
    } else if (spec.type === 'ImportNamespaceSpecifier') {
      lines.push(`const ${local} = ${table};`);
    } else {
      const imported = nameOf(spec.imported as Node);
      named.push(`${JSON.stringify(imported)}: ${local}`);
    }
  }
  if (named.length > 0) {
    lines.push(`const { ${named.join(', ')} } = ${table};`);
  }
  return lines.join(' ');
}

/**
 * Replaces static imports with lookups in the module table. Imports are found
 * with oxc-parser and replaced by source range, so strings and comments
 * are never touched. `export` and dynamic `import()` throw.
 */
function link(
  source: string,
  modules: Record<string, unknown>,
  id: string,
): string {
  const result = parseSync(`${id}.js`, source, { sourceType: 'module' });
  const error = result.errors[0];
  if (error) {
    throw new Error(`Could not parse ${id}: ${error.message}`);
  }
  const ast = result as unknown as { program: { body: Node[] } };
  const imports: Node[] = [];
  for (const node of ast.program.body) {
    if (node.type === 'ImportDeclaration') {
      imports.push(node);
    } else if (node.type.startsWith('Export')) {
      throw new Error(`'export' is not supported in ${id}.`);
    }
  }
  rejectDynamicImport(ast.program.body, id);
  let out = source;
  for (const node of imports.toReversed()) {
    const specifier = (node.source as Node).value as string;
    if (!Object.hasOwn(modules, specifier)) {
      throw new Error(`Cannot resolve import '${specifier}'.`);
    }
    const table = `__modules[${JSON.stringify(specifier)}]`;
    out =
      out.slice(0, node.start) + bindings(node, table) + out.slice(node.end);
  }
  return out;
}

let counter = 0;

async function flush(): Promise<void> {
  await vi.runAllTimersAsync();
}

/**
 * Compiles `code` with the pipeline, runs it with fake timers and returns the logs.
 * The code gets two free identifiers: `log` and `flush`. `silmaril` resolves to
 * `pipeline.runtime`, `silmaril/store` to the store in `packages/silmaril/store`.
 * The code may use top-level `await`. Timers are flushed once after it ends.
 * Call `dispose()` on the result to restore real timers. Fake timers are global,
 * so `run` must not be called concurrently.
 */
export async function run(
  pipeline: Pipeline,
  code: string,
): Promise<RunResult> {
  vi.useFakeTimers();
  const logs: unknown[][] = [];
  const result: RunResult = {
    logs,
    flush,
    dispose() {
      vi.useRealTimers();
    },
  };
  try {
    counter += 1;
    const compiled = await pipeline.compile(
      code,
      `/behavior/case-${counter}.js`,
    );
    const modules: Record<string, unknown> = {
      silmaril: pipeline.runtime,
      'silmaril/store': { default: Store },
      ...pipeline.modules,
    };
    const entry = new AsyncFunction(
      'log',
      'flush',
      '__modules',
      link(compiled, modules, `case-${counter}`),
    );
    await entry((...args: unknown[]) => logs.push(args), flush, modules);
    await flush();
  } catch (error) {
    result.dispose();
    throw error;
  }
  return result;
}

async function loadPipelines(): Promise<Pipeline[]> {
  const dir = new URL('./pipelines/', import.meta.url);
  const found: Pipeline[] = [];
  for (const file of readdirSync(dir).toSorted()) {
    if (file.endsWith('.ts')) {
      const mod = (await import(
        pathToFileURL(new URL(file, dir).pathname).href
      )) as {
        default: Pipeline;
      };
      found.push(mod.default);
    }
  }
  return found;
}

/** Every pipeline file in `pipelines/`, loaded in name order. */
export const pipelines: Pipeline[] = await loadPipelines();

/** Runs one case on one pipeline and checks its logs. Throws when it fails. */
export async function checkCase(
  pipeline: Pipeline,
  item: BehaviorCase,
): Promise<void> {
  const xfail = item.options?.xfail?.includes(pipeline.name) ?? false;
  const result = await run(pipeline, item.code);
  result.dispose();
  const assertion = expect(
    result.logs,
    xfail ? 'now passes: remove the pipeline from xfail' : undefined,
  );
  const target = xfail ? assertion.not : assertion;
  target.toEqual(item.logs);
}

/**
 * Registers each case once per pipeline. On a pipeline listed in `xfail` the
 * case is a normal test that must fail only by a log mismatch: errors from
 * compiling or running fail it, and so does a case that now passes.
 */
export function behaviorCases(suite: string, cases: BehaviorCase[]): void {
  for (const pipeline of pipelines) {
    // Fake timers are shared state, so cases in a suite never run concurrently.
    describe(`${suite} [${pipeline.name}]`, { concurrent: false }, () => {
      afterEach(() => {
        vi.useRealTimers();
      });
      for (const item of cases) {
        const xfail = item.options?.xfail?.includes(pipeline.name) ?? false;
        const title = xfail ? `${item.name} (xfail)` : item.name;
        it(title, () => checkCase(pipeline, item));
      }
    });
  }
}
