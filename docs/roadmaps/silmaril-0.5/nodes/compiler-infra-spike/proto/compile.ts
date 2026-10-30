// Prototype of silmaril/compiler: parse with oxc-parser, analyze once, edit with magic-string.
// The package layout is in proposed-compiler-api.md. Here: source.ts holds errors, parsing,
// walking and imports; scope.ts the scope builder; model.ts the reactive analysis;
// codegen.ts the edits.
import { MagicString } from 'magic-string';
import { generate } from './codegen.ts';
import { analyzeModel } from './model.ts';
import { analyzeScopes } from './scope.ts';
import { findSilmarilImports, parseModule, SOURCE_MODULE } from './source.ts';

export { CompileError, parseModule, visit } from './source.ts';

export interface CompileOptions {
  filename: string;
  sourcemap?: boolean;
}

export interface SourceMap {
  version: number;
  /** The generated file. */
  file?: string;
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

/** Resolves when `compile` can run. The parser is ready once this module has loaded. */
export function ready(): Promise<void> {
  return READY;
}

export function compile(code: string, options: CompileOptions): CompileResult {
  if (!code.includes(SOURCE_MODULE)) {
    return { code, map: null };
  }
  const parsed = parseModule(code, options.filename);
  const info = analyzeScopes(parsed.program);
  const imports = findSilmarilImports(parsed.program, info.declarationOf);
  if (imports.tracked.size === 0) {
    return { code, map: null };
  }
  const model = analyzeModel(parsed, info, imports);
  const s = new MagicString(code);
  generate(s, model);
  const sourcemap = options.sourcemap ?? true;
  return {
    code: s.toString(),
    map: sourcemap
      ? s.generateMap({
          source: options.filename,
          file: options.filename,
          includeContent: true,
          hires: 'boundary',
        })
      : null,
  };
}
