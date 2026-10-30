import { MagicString } from 'magic-string';
import { analyzeModule } from './analysis/index';
import { generate } from './codegen/index';

export { CompileError } from './errors';
export type { SourceLocation } from './errors';

export interface CompileOptions {
  /** Picks the language (.js and .jsx parse as JSX; .ts, .tsx; also .mjs/.cjs/.mts/.cts) and names the source in the map. */
  filename: string;
  /** Default true. */
  sourcemap?: boolean;
}

/** Source map v3. Assignable to unplugin's SourceMapCompact without a cast. */
export interface SourceMap {
  version: number;
  /** The generated file: the base name of `filename`. */
  file?: string;
  /** Relative to `file`, so the base name of `filename`. */
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export interface CompileResult {
  code: string;
  map: SourceMap | null;
}

const READY: Promise<void> = Promise.resolve();

/**
 * Resolves when `compile` can run. Today it resolves at once: the parser is ready when
 * the module has loaded. Callers that may run in a browser await it before the first
 * compile, so a later parser that loads its wasm on demand does not change the API.
 */
export function ready(): Promise<void> {
  return READY;
}

/** Synchronous in Node.js and in the browser. Throws CompileError. */
export function compile(code: string, options: CompileOptions): CompileResult {
  // Modules with no named import of a compile-time name stay as they are.
  const model = analyzeModule(code, options.filename);
  if (!model) {
    return { code, map: null };
  }

  // Analysis has finished on the original AST. Code generation edits the text from the
  // model only.
  const s = new MagicString(code);
  generate(s, model);

  if (options.sourcemap === false) {
    return { code: s.toString(), map: null };
  }
  return {
    code: s.toString(),
    map: s.generateMap({
      source: options.filename,
      file: options.filename,
      includeContent: true,
      hires: 'boundary',
    }),
  };
}
