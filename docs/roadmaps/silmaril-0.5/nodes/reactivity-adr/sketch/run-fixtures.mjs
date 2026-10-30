// Runs every fixture's output.js against the sketch runtime and compares
// the logs with expected.json. A fixture whose expected.json has
// `compileError` has no output.js: the runner only checks its shape.
// Usage, from the repository root:
//   node docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/run-fixtures.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as runtime from './runtime.js';

const root = new URL(
  '../../../../../../packages/silmaril/test/runtime/fixtures/',
  import.meta.url,
);
const AsyncFunction = (async () => {}).constructor;
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*'silmaril';?/g;
const NAMESPACE = /import\s*\*\s*as\s+([\w$]+)\s+from\s*'silmaril';?/g;

function toModuleBody(code) {
  return code
    .replace(
      IMPORT,
      (_, names) => `const {${names.replaceAll(' as ', ': ')}} = runtime;`,
    )
    .replace(NAMESPACE, (_, name) => `const ${name} = runtime;`);
}

function macrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function checkCompileError(dir, expected) {
  if (typeof expected.compileError !== 'string') {
    return 'compileError must be a string';
  }
  if ('logs' in expected) {
    return 'a compile-error fixture has no logs';
  }
  if (existsSync(join(dir, 'output.js'))) {
    return 'a compile-error fixture has no output.js';
  }
  return undefined;
}

async function runFixture(dir, expected) {
  const code = readFileSync(join(dir, 'output.js'), 'utf8');
  const logs = [];
  const log = (...args) => {
    logs.push(args);
  };
  try {
    await new AsyncFunction('runtime', 'log', toModuleBody(code))(runtime, log);
    await macrotask();
  } catch (error) {
    logs.push(['threw', String(error)]);
  }
  if (isDeepStrictEqual(logs, expected.logs)) {
    return undefined;
  }
  return `expected ${JSON.stringify(expected.logs)}\n  actual   ${JSON.stringify(logs)}`;
}

let failed = 0;
let count = 0;
for (const name of readdirSync(root).toSorted()) {
  const dir = join(root.pathname, name);
  count++;
  if (!existsSync(join(dir, 'input.js'))) {
    failed++;
    console.log(`MISSING ${name}/input.js`);
    continue;
  }
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
  const compileError = 'compileError' in expected;
  let problem;
  if (compileError) {
    problem = checkCompileError(dir, expected);
  } else if (existsSync(join(dir, 'output.js'))) {
    problem = await runFixture(dir, expected);
  } else {
    problem = 'missing output.js';
  }
  if (problem) {
    failed++;
    console.log(`FAIL ${name}\n  ${problem}`);
  } else {
    console.log(`ok   ${name}${compileError ? ' (compile error)' : ''}`);
  }
}
console.log(`${count - failed} of ${count} fixtures pass`);
process.exitCode = failed ? 1 : 0;
