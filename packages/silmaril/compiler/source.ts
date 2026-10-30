import { parseSync, type Comment, type Program } from 'oxc-parser';
import { CompileError } from './errors';

export type Lang = 'js' | 'jsx' | 'ts' | 'tsx';

export interface ParsedModule {
  code: string;
  filename: string;
  lang: Lang;
  program: Program;
  comments: Comment[];
}

/**
 * The language of a file from its extension. `.js` parses as JSX, as the 0.4 Babel
 * plugin did. `.mjs`, `.cjs`, `.mts` and `.cts` follow their base extension.
 */
export function getLang(filename: string): Lang {
  const match = /\.[cm]?([jt]sx?)$/i.exec(filename);
  const lang = match ? match[1]!.toLowerCase() : 'js';
  if (lang === 'js') {
    return 'jsx';
  }
  return lang as Lang;
}

/** parseSync with sourceType 'module' and preserveParens true. Throws CompileError on the first error. */
export function parseModule(code: string, filename: string): ParsedModule {
  const lang = getLang(filename);
  const result = parseSync(filename, code, {
    lang,
    sourceType: 'module',
    preserveParens: true,
  });
  const error = result.errors[0];
  if (error) {
    throw new CompileError(error.message, code, error.labels[0]?.start ?? 0);
  }
  return {
    code,
    filename,
    lang,
    program: result.program,
    comments: result.comments,
  };
}
