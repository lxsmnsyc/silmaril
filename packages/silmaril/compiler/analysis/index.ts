import { parseModule } from '../source';
import { findSilmarilImports, SOURCE_MODULE } from './imports';
import { analyzeModel, type ModuleModel } from './model';
import { analyzeScopes } from './scope';

/** parse + scopes + imports + model. null when no compile-time name is imported. Throws CompileError. */
export function analyzeModule(
  code: string,
  filename: string,
): ModuleModel | null {
  // A module that never names silmaril has nothing to compile.
  if (!code.includes(SOURCE_MODULE)) {
    return null;
  }
  const parsed = parseModule(code, filename);
  const info = analyzeScopes(parsed.program);
  const imports = findSilmarilImports(parsed.program, info.declarationOf);
  if (imports.tracked.size === 0) {
    return null;
  }
  return analyzeModel(parsed, info, imports);
}
