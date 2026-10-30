// Compiles a code sample with silmaril/compiler and runs it against the runtime. The page and
// `scripts/check-samples.ts` share this file, so the check runs what the page runs.
//
// - `compile` parses with oxc. In the browser that is the WebAssembly binding.
// - The compiled module loads from a blob URL (a data URL in Node.js). Its imports of
//   `silmaril` and `silmaril/store` load small modules that re-export the runtime of the page.
// - `console` in the sample is a binding that sends each call to `onLog`.
// - While `silmaril/compiler` returns its input unchanged (before the code generators land),
//   the module would throw at its first `$`, so it is compiled and not run. `ran` says which.

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
}

export interface RunResult {
  /** The compiled module. */
  code: string;
  /** False when the compiler left the code as written, so the sample was not run. */
  ran: boolean;
  logs: string[];
}

const MODULES: Record<string, object> = {
  silmaril: runtime,
  'silmaril/store': store,
};

const KEY = 'silmarilLive';
const shims = new Map<string, string>();
let runs = 0;

function toUrl(code: string): string {
  if (typeof document !== 'undefined') {
    return URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  }
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}

/** A module that re-exports a runtime module. */
function shim(name: string): string {
  let url = shims.get(name);
  if (!url) {
    const table = globalThis as Record<string, unknown>;
    table[KEY] ??= MODULES;
    const names: string[] = [];
    for (const key of Object.keys(MODULES[name]!)) {
      if (/^[A-Za-z_$][\w$]*$/.test(key)) {
        names.push(key);
      }
    }
    url = toUrl(
      [
        `const m = globalThis.${KEY}[${JSON.stringify(name)}];`,
        names.length > 0 ? `export const { ${names.join(', ')} } = m;` : '',
      ].join('\n'),
    );
    shims.set(name, url);
  }
  return url;
}

/** Points the imports of the sample at the shims. */
function rewrite(code: string): string {
  return code.replace(
    /(\bfrom\s*)(['"])([^'"]+)\2/g,
    (_match, before: string, quote: string, specifier: string) => {
      if (!(specifier in MODULES)) {
        throw new Error(
          `A sample can import silmaril and silmaril/store. "${specifier}" is not one.`,
        );
      }
      return `${before}${quote}${shim(specifier)}${quote}`;
    },
  );
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
): Promise<string[]> {
  const { onLog, settle = 50, isLatest = () => true } = options;
  const logs: string[] = [];

  // The sample calls this object through the `console` binding.
  const id = ++runs;
  const sink = (...args: unknown[]): void => {
    if (!isLatest()) {
      return;
    }
    const line = args.map(show).join(' ');
    logs.push(line);
    onLog?.(line);
  };
  const table = globalThis as Record<string, unknown>;
  const consoles = (table.silmarilConsoles ??= {}) as Record<number, object>;
  consoles[id] = {
    log: sink,
    info: sink,
    warn: sink,
    error: sink,
    debug: sink,
  };

  const module = `const console = globalThis.silmarilConsoles[${id}];\n${rewrite(code)}`;
  await import(/* @vite-ignore */ toUrl(module));
  // Updates run after the module has loaded, so wait for them.
  await new Promise((resolve) => setTimeout(resolve, settle));
  return logs;
}

/** Compiles a sample and runs it. Throws a compile error or the error the sample throws. */
export async function runSample(
  source: string,
  options: RunOptions = {},
  filename = 'sample.js',
): Promise<RunResult> {
  const { code, changed } = await compileSample(source, filename);
  if (!changed) {
    return { code, ran: false, logs: [] };
  }
  return { code, ran: true, logs: await runModule(code, options) };
}
