/* oxlint-disable vitest/expect-expect */
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import Store from '../../store';

export interface Pipeline {
  /** Unique name. Also the key used by `CaseOptions.xfail`. */
  name: string;
  /** Returns the compiled module source. May be async. */
  compile(code: string, filename: string): string | Promise<string>;
  /** What `import ... from 'silmaril'` resolves to. */
  runtime: Record<string, unknown>;
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

const IMPORT = /^[ \t]*import\s*(?:([^'";]*?)\s*from\s*)?(['"])([^'"]+)\2;?/gm;

function bindings(clause: string, table: string): string {
  const namespace = /^\*\s*as\s+([\w$]+)$/.exec(clause);
  if (namespace) {
    return `const ${namespace[1]} = ${table};`;
  }
  const lines: string[] = [];
  let rest = clause;
  const named = /\{([^}]*)\}/.exec(rest);
  if (named) {
    rest = rest.replace(named[0], '');
    const items: string[] = [];
    for (const part of named[1].split(',')) {
      const text = part.trim();
      if (text) {
        items.push(text.replace(/\s+as\s+/, ': '));
      }
    }
    lines.push(`const { ${items.join(', ')} } = ${table};`);
  }
  const def = rest.replace(/,/g, '').trim();
  if (def) {
    lines.push(`const ${def} = ${table}.default;`);
  }
  if (lines.length === 0) {
    throw new Error(`Unsupported import clause: ${clause}`);
  }
  return lines.join(' ');
}

/** Replaces static imports with lookups in the module table. */
function link(source: string, modules: Record<string, unknown>): string {
  return source.replace(
    IMPORT,
    (_, clause: string | undefined, _quote: string, id: string) => {
      if (!(id in modules)) {
        throw new Error(`Cannot resolve import '${id}'.`);
      }
      const table = `__modules[${JSON.stringify(id)}]`;
      return clause ? bindings(clause.trim(), table) : '';
    },
  );
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
 * Call `dispose()` on the result to restore real timers.
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
    const modules = {
      silmaril: pipeline.runtime,
      'silmaril/store': { default: Store },
    };
    const entry = new AsyncFunction(
      'log',
      'flush',
      '__modules',
      link(compiled, modules),
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

/** Registers each case once per pipeline. A case in `xfail` must fail. */
export function behaviorCases(suite: string, cases: BehaviorCase[]): void {
  for (const pipeline of pipelines) {
    describe(`${suite} [${pipeline.name}]`, () => {
      for (const item of cases) {
        const check = async () => {
          const result = await run(pipeline, item.code);
          try {
            expect(result.logs).toEqual(item.logs);
          } finally {
            result.dispose();
          }
        };
        const xfail = item.options?.xfail?.includes(pipeline.name) ?? false;
        const register = xfail ? it.fails : it;
        register(xfail ? `${item.name} (xfail)` : item.name, check);
      }
    });
  }
}
