export interface SourceLocation {
  /** 1-based. */
  line: number;
  /** 0-based, in UTF-16 code units. */
  column: number;
}

/** An error in the compiled module, with its location and a code frame. */
export class CompileError extends Error {
  /** 1-based line, 0-based column, in UTF-16 code units. */
  loc: SourceLocation;
  /** The source line and a caret under the column. */
  frame: string;

  constructor(message: string, code: string, offset: number) {
    const loc = locateOffset(code, offset);
    super(`${message} (${loc.line}:${loc.column})`);
    this.name = 'CompileError';
    this.loc = loc;
    this.frame = createCodeFrame(code, loc);
  }
}

function locateOffset(code: string, offset: number): SourceLocation {
  let line = 1;
  let lineStart = 0;
  const end = Math.min(offset, code.length);
  for (let i = 0; i < end; i += 1) {
    if (code.charCodeAt(i) === 10) {
      line += 1;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart };
}

function createCodeFrame(code: string, loc: SourceLocation): string {
  const lines = code.split('\n');
  const text = (lines[loc.line - 1] ?? '').replace(/\r$/, '');
  const gutter = ' '.repeat(String(loc.line).length);
  return `${loc.line} | ${text}\n${gutter} | ${' '.repeat(loc.column)}^`;
}
