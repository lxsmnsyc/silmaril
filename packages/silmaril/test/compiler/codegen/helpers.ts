// Shared by the codegen tests: the runtime fixtures, the text normalization of the
// prototype and the runner protocol of the reactivity-runtime contract.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Node } from 'oxc-parser';
import type { Ref } from '../../../compiler/analysis/model';
import { parseModule } from '../../../compiler/source';
import * as runtime from '../../../src/v2';

const dir = new URL('../../runtime/fixtures/', import.meta.url);
const repo = fileURLToPath(new URL('../../../../../', import.meta.url));

export interface Fixture {
  name: string;
  input: string;
  output: string | null;
  expected: { description: string; logs?: unknown[][]; compileError?: string };
}

export function loadFixtures(): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    const outputUrl = new URL(`${name}/output.js`, dir);
    fixtures.push({
      name,
      input: readFileSync(new URL(`${name}/input.js`, dir), 'utf8'),
      output: existsSync(outputUrl) ? readFileSync(outputUrl, 'utf8') : null,
      expected: JSON.parse(
        readFileSync(new URL(`${name}/expected.json`, dir), 'utf8'),
      ),
    });
  }
  return fixtures;
}

// Removes comments. A line left with only spaces goes too.
function stripComments(code: string): string {
  const { comments } = parseModule(code, 'file.js');
  let out = '';
  let last = 0;
  for (const comment of comments) {
    let start = comment.start;
    let end = comment.end;
    const lineStart = code.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = code.indexOf('\n', end);
    if (lineEnd === -1) {
      lineEnd = code.length;
    }
    if (
      code.slice(lineStart, start).trim() === '' &&
      code.slice(end, lineEnd).trim() === ''
    ) {
      start = lineStart;
      end = Math.min(lineEnd + 1, code.length);
    }
    start = Math.max(start, last);
    out += code.slice(last, start);
    last = end;
  }
  return out + code.slice(last);
}

function compareRefs(a: Ref, b: Ref): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'number') {
    return -1;
  }
  if (typeof b === 'number') {
    return 1;
  }
  return JSON.stringify(a).localeCompare(JSON.stringify(b));
}

// The value of an array of numbers, arrays and holes, read from the AST.
function readLiteral(node: Node): unknown {
  if (node.type === 'ArrayExpression') {
    const out: unknown[] = [];
    for (const element of node.elements) {
      out.push(element === null ? undefined : readLiteral(element));
    }
    return out;
  }
  if (node.type === 'Literal' && typeof node.value === 'number') {
    return node.value;
  }
  throw new Error(`not a graph literal: ${node.type}`);
}

// Rewrites each graph constant in canonical list order, without trailing empty lists.
function canonicalGraphs(code: string): string {
  const { program } = parseModule(code, 'file.js');
  let out = '';
  let last = 0;
  for (const statement of program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    const declarator = statement.declarations[0]!;
    const { id, init } = declarator;
    if (id.type !== 'Identifier' || !/^\$g\d+$/.test(id.name) || !init) {
      continue;
    }
    const value = readLiteral(init) as (Ref[] | undefined)[];
    const sorted: Ref[][] = [];
    for (const list of value) {
      sorted.push([...(list ?? [])].toSorted(compareRefs));
    }
    while (sorted.length > 0 && sorted.at(-1)!.length === 0) {
      sorted.pop();
    }
    out += code.slice(last, init.start) + JSON.stringify(sorted);
    last = init.end;
  }
  return out + code.slice(last);
}

// Blank lines are layout: the fixtures group the graph constants differently.
function format(code: string): string {
  return execFileSync(
    `${repo}node_modules/.bin/oxfmt`,
    ['--stdin-filepath=file.js'],
    { input: code, cwd: repo },
  )
    .toString()
    .replaceAll(/\n\s*\n/g, '\n');
}

/** The text the comparison sees: no comments, canonical graphs, formatted with oxfmt. */
export function normalize(code: string): string {
  return format(canonicalGraphs(stripComments(code)));
}

const AsyncFunction = (async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

/** Runs a compiled module with the contract's runner protocol and returns its logs. */
export async function runLogs(code: string): Promise<unknown[][]> {
  const body = code
    .replaceAll(
      /import\s*\*\s*as\s+([\w$]+)\s+from\s*'silmaril';?/g,
      (_, name: string) => `const ${name} = runtime;`,
    )
    .replaceAll(
      /import\s*\{([^}]*)\}\s*from\s*'silmaril';?/g,
      (_, names: string) =>
        `const {${names.replaceAll(' as ', ': ')}} = runtime;`,
    );
  const logs: unknown[][] = [];
  const log = (...args: unknown[]): void => {
    logs.push(args);
  };
  await new AsyncFunction('runtime', 'log', body)(runtime, log);
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
  return logs;
}
