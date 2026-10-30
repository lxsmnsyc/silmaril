import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as runtime from '../../src';

const ROOT = new URL('./fixtures/', import.meta.url).pathname;
const AsyncFunction = (async () => {}).constructor as new (
  ...args: string[]
) => (...args: unknown[]) => Promise<void>;
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*'silmaril';?/g;
const NAMESPACE = /import\s*\*\s*as\s+([\w$]+)\s+from\s*'silmaril';?/g;

interface Expected {
  logs?: unknown[][];
  compileError?: string;
}

// Runner protocol of the reactivity-runtime contract.
function toModuleBody(code: string): string {
  return code
    .replace(
      IMPORT,
      (_, names: string) =>
        `const {${names.replaceAll(' as ', ': ')}} = runtime;`,
    )
    .replace(NAMESPACE, (_, name: string) => `const ${name} = runtime;`);
}

function macrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('fixtures', () => {
  let ran = 0;
  for (const name of readdirSync(ROOT).toSorted()) {
    const dir = join(ROOT, name);
    const expected = JSON.parse(
      readFileSync(join(dir, 'expected.json'), 'utf8'),
    ) as Expected;
    // Compile-error fixtures are for the codegen tests.
    if (typeof expected.compileError === 'string') {
      continue;
    }
    it(`${name}`, async () => {
      expect(existsSync(join(dir, 'output.js'))).toBe(true);
      const code = readFileSync(join(dir, 'output.js'), 'utf8');
      const logs: unknown[][] = [];
      const log = (...args: unknown[]): void => {
        logs.push(args);
      };
      await new AsyncFunction('runtime', 'log', toModuleBody(code))(
        runtime,
        log,
      );
      await macrotask();
      expect(logs).toStrictEqual(expected.logs);
      ran++;
    });
  }

  it('ran every fixture that has an output', () => {
    let count = 0;
    for (const name of readdirSync(ROOT)) {
      if (existsSync(join(ROOT, name, 'output.js'))) {
        count++;
      }
    }
    expect(count).toBeGreaterThan(0);
    expect(ran).toBe(count);
  });
});
