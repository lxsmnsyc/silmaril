// Compiles a code sample with silmaril/compiler and runs it against the runtime. The page and
// `scripts/check-samples.ts` share this file, so the check runs what the page runs.
//
// - `compile` parses with oxc. In the browser that is the WebAssembly binding.
// - The compiled module loads from a blob URL (a data URL in Node.js). Its imports of
//   `silmaril` and `silmaril/store` load small modules that re-export the runtime.
// - `console`, `setTimeout`, `setInterval` and their `clear` functions in the sample are
//   bindings of its run, so `dispose` can stop what the sample started. `$$` and `$$root`
//   are wrapped to collect the disposers they return.
// - A module that imports `silmaril` and that the compiler returns unchanged is compiled and
//   not run. `ran` says which.

import { compile, ready } from 'silmaril/compiler';
import * as runtime from 'silmaril';
import * as store from 'silmaril/store';

export interface RunOptions {
  /** Called for each `console` call of the sample, with the arguments written as text. */
  onLog?: (line: string) => void;
  /** Milliseconds to wait for updates that run after the module has loaded. Default 50. */
  settle?: number;
  /** False when a newer run started, so this one stops writing logs. */
  isLatest?: () => boolean;
  /**
   * Names the sample on the page. A new run with the same owner disposes the previous one, and
   * `disposeOwner` disposes the last one.
   */
  owner?: string;
}

export interface RunResult {
  /** The compiled module. */
  code: string;
  /** False when the sample was compiled and not run. */
  ran: boolean;
  logs: string[];
  /** Stops the timers of the sample, calls the disposers of its `$$` and frees its modules. */
  dispose: () => void;
}

// The runtime of the compiled output, under the name samples import it by.
const MODULES: Record<string, object> = {
  silmaril: runtime,
  'silmaril/store': store,
};

/** Runtime functions that return a disposer. */
const DISPOSING = ['$$', '$$root'];

interface Context {
  console: object;
  setTimeout: typeof setTimeout;
  setInterval: typeof setInterval;
  clearTimeout: typeof clearTimeout;
  clearInterval: typeof clearInterval;
  modules: Record<string, object>;
  disposers: (() => void)[];
}

const KEY = 'silmarilRuns';
const owners = new Map<string, () => void>();
let runs = 0;

function table(): Record<number, Context> {
  const global = globalThis as Record<string, unknown>;
  return (global[KEY] ??= {}) as Record<number, Context>;
}

function inBrowser(): boolean {
  return typeof document !== 'undefined';
}

function toUrl(code: string): string {
  if (inBrowser()) {
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

function show(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'function') {
    return `[Function ${value.name || 'anonymous'}]`;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** A module that re-exports a runtime module, for one run. */
function shim(id: number, name: string): string {
  const names: string[] = [];
  for (const key of Object.keys(MODULES[name]!)) {
    if (key === 'default') {
      continue;
    }
    if (/^[A-Za-z_$][\w$]*$/.test(key)) {
      names.push(key);
    }
  }
  const lines = [`const { modules, disposers } = globalThis.${KEY}[${id}];`];
  lines.push(`const m = modules[${JSON.stringify(name)}];`);
  for (const key of names) {
    if (DISPOSING.includes(key)) {
      lines.push(
        `export const ${key} = (...args) => { const result = m.${key}(...args); if (typeof result === 'function') { disposers.push(result); } return result; };`,
      );
    } else {
      lines.push(`export const ${key} = m.${key};`);
    }
  }
  if ('default' in MODULES[name]!) {
    lines.push('export default m.default;');
  }
  return toUrl(lines.join('\n'));
}

const FROM =
  /^([ \t]*(?:import|export)\b[^;'"`]*?\bfrom\s*)(['"])([^'"\n]+)\2/gm;
const SIDE_EFFECT = /^([ \t]*import\s*)(['"])([^'"\n]+)\2/gm;

/**
 * Points the imports of the sample at the shims. It reads the statements that start a line, so
 * a string that holds the word `from` is left alone.
 */
function rewrite(code: string, resolve: (specifier: string) => string): string {
  const replace = (
    _match: string,
    before: string,
    quote: string,
    specifier: string,
  ): string => `${before}${quote}${resolve(specifier)}${quote}`;
  return code.replace(FROM, replace).replace(SIDE_EFFECT, replace);
}

/** True when the sample imports from `silmaril`, as every sample of the docs does. */
export function importsSilmaril(source: string): boolean {
  return /^[ \t]*import\b[^;'"`]*?\bfrom\s*['"]silmaril(?:\/store)?['"]/m.test(
    source,
  );
}

/** Compiles a sample. Throws the CompileError of the compiler, with its code frame. */
export async function compileSample(
  source: string,
  filename = 'sample.js',
): Promise<{ code: string; changed: boolean }> {
  await ready();
  try {
    const { code } = compile(source, { filename, sourcemap: false });
    return { code, changed: code !== source };
  } catch (error) {
    const frame = (error as { frame?: string }).frame;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(frame ? `${message}\n${frame}` : message, { cause: error });
  }
}

/** Runs a compiled module. Throws the error the sample throws. */
export async function runModule(
  code: string,
  options: RunOptions = {},
): Promise<{ logs: string[]; dispose: () => void }> {
  const { onLog, settle = 50, isLatest = () => true, owner } = options;
  const logs: string[] = [];
  const id = ++runs;
  let disposed = false;

  const sink = (...args: unknown[]): void => {
    if (disposed || !isLatest()) {
      return;
    }
    const line = args.map(show).join(' ');
    logs.push(line);
    onLog?.(line);
  };

  // What the sample starts, so `dispose` can stop it.
  const timeouts = new Set<unknown>();
  const intervals = new Set<unknown>();
  const urls: string[] = [];
  const context: Context = {
    console: { log: sink, info: sink, warn: sink, error: sink, debug: sink },
    setTimeout: ((callback: () => void, delay?: number, ...rest: unknown[]) => {
      const timer = setTimeout(
        () => {
          timeouts.delete(timer);
          callback();
        },
        delay,
        ...rest,
      );
      timeouts.add(timer);
      return timer;
    }) as typeof setTimeout,
    setInterval: ((
      callback: () => void,
      delay?: number,
      ...rest: unknown[]
    ) => {
      const timer = setInterval(callback, delay, ...rest);
      intervals.add(timer);
      return timer;
    }) as typeof setInterval,
    clearTimeout: (timer) => {
      timeouts.delete(timer);
      clearTimeout(timer);
    },
    clearInterval: (timer) => {
      intervals.delete(timer);
      clearInterval(timer);
    },
    modules: MODULES,
    disposers: [],
  };
  table()[id] = context;

  function dispose(): void {
    if (disposed) {
      return;
    }
    disposed = true;
    for (const stop of context.disposers) {
      try {
        stop();
      } catch {
        // A sample that throws while it stops still stops the rest.
      }
    }
    for (const timer of timeouts) {
      clearTimeout(timer as never);
    }
    for (const timer of intervals) {
      clearInterval(timer as never);
    }
    timeouts.clear();
    intervals.clear();
    delete table()[id];
    if (inBrowser()) {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    }
    if (owner !== undefined && owners.get(owner) === dispose) {
      owners.delete(owner);
    }
  }

  // A new run of the same sample replaces the last one.
  if (owner !== undefined) {
    owners.get(owner)?.();
    owners.set(owner, dispose);
  }

  try {
    const body = rewrite(code, (specifier) => {
      if (!(specifier in MODULES)) {
        throw new Error(
          `A sample can import silmaril and silmaril/store. "${specifier}" is not one.`,
        );
      }
      const url = shim(id, specifier);
      urls.push(url);
      return url;
    });
    const module = `const { console, setTimeout, setInterval, clearTimeout, clearInterval } = globalThis.${KEY}[${id}];\n${body}`;
    const url = toUrl(module);
    urls.push(url);
    await import(/* @vite-ignore */ url);
    // Updates run after the module has loaded, so wait for them.
    await new Promise((resolve) => setTimeout(resolve, settle));
  } catch (error) {
    dispose();
    throw error;
  }
  // A newer run started while this one loaded.
  if (!isLatest()) {
    dispose();
  }
  return { logs, dispose };
}

/** Disposes the last run of a sample on the page, such as when its component goes away. */
export function disposeOwner(owner: string): void {
  owners.get(owner)?.();
}

/** Compiles a sample and runs it. Throws a compile error or the error the sample throws. */
export async function runSample(
  source: string,
  options: RunOptions = {},
  filename = 'sample.js',
): Promise<RunResult> {
  const { code, changed } = await compileSample(source, filename);
  if (options.owner !== undefined) {
    owners.get(options.owner)?.();
  }
  // Compiled code that is the source is only run when it needs no compiler: a module that
  // imports silmaril would throw at its first `$`.
  if (!changed && importsSilmaril(source)) {
    return { code, ran: false, logs: [], dispose: () => {} };
  }
  const { logs, dispose } = await runModule(code, options);
  return { code, ran: true, logs, dispose };
}
