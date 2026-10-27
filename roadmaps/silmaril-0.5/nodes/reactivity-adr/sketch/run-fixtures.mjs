// Runs every fixture's output.js against the sketch runtime and compares
// the logs with expected.json. Usage, from the repository root:
//   node roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/run-fixtures.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as runtime from './runtime.js';

const root = new URL(
  '../../../../../packages/silmaril/test/runtime/fixtures/',
  import.meta.url,
);
const AsyncFunction = (async () => {}).constructor;
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*'silmaril';?/g;

function toModuleBody(code) {
  return code.replace(
    IMPORT,
    (_, names) => `const {${names.replaceAll(' as ', ': ')}} = runtime;`,
  );
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let failed = 0;
for (const name of readdirSync(root).toSorted()) {
  const dir = join(root.pathname, name);
  if (!existsSync(join(dir, 'output.js'))) {
    failed++;
    console.log(`MISSING ${name}`);
    continue;
  }
  const code = readFileSync(join(dir, 'output.js'), 'utf8');
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));
  const logs = [];
  const log = (...args) => {
    logs.push(args);
  };
  try {
    await new AsyncFunction('runtime', 'log', 'tick', toModuleBody(code))(
      runtime,
      log,
      tick,
    );
    await tick();
  } catch (error) {
    logs.push(['threw', String(error)]);
  }
  if (isDeepStrictEqual(logs, expected.logs)) {
    console.log(`ok   ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}`);
    console.log('  expected', JSON.stringify(expected.logs));
    console.log('  actual  ', JSON.stringify(logs));
  }
}
process.exitCode = failed ? 1 : 0;
