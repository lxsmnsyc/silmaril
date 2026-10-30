// Checks the model and the compiler against the PR #8 fixtures. Run with `node fixtures.test.ts`.
// - model: slots, entries (kind, id, output slot) and graphs equal those of output.js.
// - text: the compiled input equals output.js after removing comments, putting graph
//   lists in canonical order without trailing empty lists, and formatting both with oxfmt.
// - logs: the compiled input, run on the sketch runtime, logs expected.json.
// - compile errors: compiling input.js throws the expected message.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { compile } from './compile.ts';
import { loadFixtures, runtimePath, type Fixture } from './fixtures.ts';
import { analyzeModel, type Ref } from './model.ts';
import { analyzeScopes, type Node } from './scope.ts';
import { findSilmarilImports, parseModule, unwrap, visit } from './source.ts';

const runtime = await import(runtimePath());
const repo = fileURLToPath(new URL('../../../../../../', import.meta.url));

// The fixtures picked for the text comparison: the ones with overwrites.
const TEXT_REQUIRED = new Set([
  'nested-scope',
  'update-expression',
  'destructure-assign',
]);

type Registration = (string | number | null)[];
interface Shape {
  graphs: (Ref[][] | null)[];
  registrations: Registration[];
}

function normalizeGraph(graph: (Ref[] | undefined)[]): Ref[][] {
  const out: Ref[][] = [];
  for (const list of graph) {
    const copy = [...(list ?? [])];
    copy.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    out.push(copy);
  }
  while (out.length > 0 && out[out.length - 1]!.length === 0) {
    out.pop();
  }
  return out;
}

function literal(node: Node): number {
  const inner = unwrap(node);
  if (inner.type === 'UnaryExpression' && inner.operator === '-') {
    return -literal(inner.argument);
  }
  return inner.value;
}

// The shape the hand-written output.js encodes.
function outputShape(code: string): Shape {
  const { program } = parseModule(code, 'output.js');
  const constants = new Map<string, Ref[][]>();
  visit(program, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.init
    ) {
      if (node.init.type === 'ArrayExpression') {
        constants.set(
          node.id.name,
          new Function(
            `return ${code.slice(node.init.start, node.init.end)}`,
          )(),
        );
      }
    }
  });
  const graphs: (Ref[][] | null)[] = [];
  const registrations: Registration[] = [];
  const graphOf = (node: Node | undefined): Ref[][] | null =>
    node && node.type === 'Identifier' && constants.has(node.name)
      ? normalizeGraph(constants.get(node.name)!)
      : null;
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
      return;
    }
    const args = node.arguments;
    switch (node.callee.name) {
      case '$$root':
      case '$$composable':
        graphs.push(graphOf(args[0]));
        break;
      case '$$sync':
      case '$$effect': {
        const kind = node.callee.name === '$$sync' ? 'sync' : 'effect';
        registrations.push([kind, literal(args[1])]);
        const body = unwrap(args[2]);
        if (
          (body.type === 'ArrowFunctionExpression' ||
            body.type === 'FunctionExpression') &&
          (body.body.type === 'BlockStatement' || args.length > 3)
        ) {
          graphs.push(graphOf(args[3]));
        }
        break;
      }
      case '$$memo':
        registrations.push(['memo', literal(args[1]), literal(args[2])]);
        break;
      case '$$store':
        registrations.push([
          'store',
          literal(args[1]),
          args[3] ? literal(args[3]) : null,
        ]);
        break;
      default:
        break;
    }
  });
  return { graphs, registrations };
}

// The same shape from the model of input.js.
function modelShape(code: string): Shape {
  const parsed = parseModule(code, 'input.js');
  const info = analyzeScopes(parsed.program);
  const imports = findSilmarilImports(parsed.program, info.declarationOf);
  const model = analyzeModel(parsed, info, imports);
  const graphs: (Ref[][] | null)[] = [];
  const items: { start: number; registration: Registration }[] = [];
  for (const scope of model.scopes) {
    if (scope.call) {
      graphs.push(normalizeGraph(scope.graph!));
    } else if (scope.isBody && scope.node.body.type === 'BlockStatement') {
      graphs.push(scope.graph ? normalizeGraph(scope.graph) : null);
    }
    for (const entry of scope.entries) {
      if (entry.kind === 'sync' || entry.kind === 'effect') {
        items.push({
          start: entry.node.start,
          registration: [entry.kind, entry.id],
        });
      } else if (entry.kind === 'memo') {
        items.push({
          start: entry.node.start,
          registration: ['memo', entry.id, entry.slot],
        });
      }
    }
  }
  for (const record of model.declarators.values()) {
    if (record.kind === 'store') {
      items.push({
        start: record.declarator.start,
        registration: [
          'store',
          record.slots[0]!.index,
          record.entry ? record.entry.id : null,
        ],
      });
    }
  }
  items.sort((a, b) => a.start - b.start);
  const registrations: Registration[] = [];
  for (const item of items) {
    registrations.push(item.registration);
  }
  return { graphs, registrations };
}

// Removes comments. A line left with only spaces is removed too.
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
    if (start < last) {
      start = last;
    }
    out += code.slice(last, start);
    last = end;
  }
  return out + code.slice(last);
}

// Rewrites each graph constant in canonical list order, as the compiler prints it.
function canonicalGraphs(code: string): string {
  const { program } = parseModule(code, 'file.js');
  let out = '';
  let last = 0;
  for (const statement of program.body) {
    if (statement.type !== 'VariableDeclaration') {
      continue;
    }
    const declarator = statement.declarations[0];
    if (!/^\$g\d+$/.test(declarator.id.name ?? '') || !declarator.init) {
      continue;
    }
    const value = new Function(
      `return ${code.slice(declarator.init.start, declarator.init.end)}`,
    )();
    const sorted: Ref[][] = [];
    for (const list of value) {
      const copy = [...(list ?? [])];
      copy.sort((a: Ref, b: Ref) => {
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
      });
      sorted.push(copy);
    }
    // Trailing empty lists can be left out (contract "Graph format").
    while (sorted.length > 0 && sorted[sorted.length - 1]!.length === 0) {
      sorted.pop();
    }
    out += code.slice(last, declarator.init.start) + JSON.stringify(sorted);
    last = declarator.init.end;
  }
  return out + code.slice(last);
}

// Blank lines are layout: the fixtures group the graph constants differently.
function format(code: string): string {
  return execFileSync(
    `${repo}node_modules/.bin/oxfmt`,
    ['--stdin-filepath=file.js'],
    {
      input: code,
      cwd: repo,
    },
  )
    .toString()
    .replaceAll(/\n\s*\n/g, '\n');
}

const AsyncFunction = (async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;

async function runLogs(code: string): Promise<unknown[][]> {
  const body = code
    .replace(
      /import\s*\*\s*as\s+(\w+)\s+from\s*'silmaril';?/g,
      (_, name: string) => `const ${name} = runtime;`,
    )
    .replace(
      /import\s*\{([^}]*)\}\s*from\s*'silmaril';?/g,
      (_, names: string) =>
        `const {${names.replaceAll(' as ', ': ')}} = runtime;`,
    );
  const logs: unknown[][] = [];
  const log = (...args: unknown[]): void => {
    logs.push(args);
  };
  try {
    await new AsyncFunction('runtime', 'log', body)(runtime, log);
    await new Promise((resolve) => setTimeout(resolve, 0));
  } catch (error) {
    logs.push(['threw', String(error)]);
  }
  return logs;
}

let failures = 0;
const modelOk: string[] = [];
const textOk: string[] = [];
const textDiffers: string[] = [];
const logsOk: string[] = [];
const errorsOk: string[] = [];

async function check(fixture: Fixture): Promise<void> {
  const { name, expected } = fixture;
  if (expected.compileError !== undefined) {
    try {
      compile(fixture.input, { filename: 'input.js' });
      failures += 1;
      console.log(`FAIL ${name}: no compile error`);
    } catch (error) {
      if ((error as Error).message.includes(expected.compileError)) {
        errorsOk.push(name);
      } else {
        failures += 1;
        console.log(`FAIL ${name}: ${(error as Error).message}`);
      }
    }
    return;
  }
  const want = outputShape(fixture.output!);
  let got: Shape;
  try {
    got = modelShape(fixture.input);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name} model threw: ${(error as Error).message}`);
    return;
  }
  if (isDeepStrictEqual(want, got)) {
    modelOk.push(name);
  } else {
    failures += 1;
    console.log(
      `FAIL ${name} model\n  want ${JSON.stringify(want)}\n  got  ${JSON.stringify(got)}`,
    );
  }
  const compiled = compile(fixture.input, { filename: 'input.js' }).code;
  const a = format(canonicalGraphs(stripComments(compiled)));
  const b = format(canonicalGraphs(stripComments(fixture.output!)));
  if (a === b) {
    textOk.push(name);
  } else {
    textDiffers.push(name);
    if (TEXT_REQUIRED.has(name)) {
      failures += 1;
      console.log(`FAIL ${name} text\n--- compiled\n${a}\n--- output.js\n${b}`);
    }
  }
  const logs = await runLogs(compiled);
  if (isDeepStrictEqual(logs, expected.logs)) {
    logsOk.push(name);
  } else {
    failures += 1;
    console.log(
      `FAIL ${name} logs\n  want ${JSON.stringify(expected.logs)}\n  got  ${JSON.stringify(logs)}`,
    );
  }
}

const fixtures = loadFixtures();
for (const fixture of fixtures) {
  await check(fixture);
}

console.log(
  `model matches output.js: ${modelOk.length} (${modelOk.join(', ')})`,
);
console.log(`text matches output.js: ${textOk.length} (${textOk.join(', ')})`);
console.log(`text differs: ${textDiffers.length} (${textDiffers.join(', ')})`);
console.log(`logs match expected.json: ${logsOk.length}`);
console.log(
  `compile errors match: ${errorsOk.length} (${errorsOk.join(', ')})`,
);
console.log(`${fixtures.length} fixtures, ${failures} failures`);
process.exitCode = failures ? 1 : 0;
