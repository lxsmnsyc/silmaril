// Highlights the code of live samples with twinkleplop, the highlighter of the static code
// blocks (`plugins/markdown.ts`). It runs on the server and in the browser.
import { language as typescript } from '@twinkleplop/typescript';
import { raw } from 'brumate/html';
import type { Raw } from 'brumate/html';

// Samples and the code the compiler generates are JavaScript, which the TypeScript grammar reads.
const javascript = typescript();

/** The highlighted HTML of JavaScript code, for markup to insert as is. */
export function highlight(code: string): Raw {
  return raw(javascript(code));
}
