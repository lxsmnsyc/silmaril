// Finds the PR #8 fixtures and the sketch runtime. After PR #8 merges they are in the
// repository. Before that, `node fetch-pr8.ts` copies them from the PR branch into `.pr8/`.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../../../../../', import.meta.url));
const local = fileURLToPath(new URL('./.pr8/', import.meta.url));

const FIXTURES = 'packages/silmaril/test/runtime/fixtures/';
const RUNTIME = 'roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/runtime.js';

function base(): string {
  if (existsSync(repo + FIXTURES) && existsSync(repo + RUNTIME)) {
    return repo;
  }
  if (existsSync(local + FIXTURES)) {
    return local;
  }
  throw new Error('PR #8 fixtures not found. Run `node fetch-pr8.ts` first.');
}

export interface Fixture {
  name: string;
  input: string;
  output: string | null;
  expected: { description: string; logs?: unknown[][]; compileError?: string };
}

export function loadFixtures(): Fixture[] {
  const dir = base() + FIXTURES;
  const fixtures: Fixture[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    const outputPath = `${dir}${name}/output.js`;
    fixtures.push({
      name,
      input: readFileSync(`${dir}${name}/input.js`, 'utf8'),
      output: existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : null,
      expected: JSON.parse(readFileSync(`${dir}${name}/expected.json`, 'utf8')),
    });
  }
  return fixtures;
}

export function runtimePath(): string {
  return base() + RUNTIME;
}
