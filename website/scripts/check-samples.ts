// Compiles and runs every live sample of the docs and of `src/samples`, so a sample that stops
// compiling or that throws fails the check. It runs the same code as the page.
import { readFileSync, readdirSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { importsSilmaril, runModule, runSample } from '../src/live/run.ts';

interface Sample {
  where: string;
  source: string;
}

/** The logs of the samples of `src/samples`, by file. Other samples are only checked to run. */
const EXPECTED: Record<string, string[]> = {
  'samples/counter.js': ['Count: 100'],
  'samples/computed.js': ['21 doubled is 42'],
  'samples/internals-order.js': [
    '$sync sees 1 and 2',
    '$sync sees 5 and 10',
    '$ sees 5',
  ],
  'samples/limits-in-place.js': ['name: Ada', 'after the change: Grace'],
  'samples/limits-pattern-default.js': ['b is 1'],
  'samples/limits-settled-loop.js': ['n is 3'],
  'samples/limits-update-loop.js': ['Update loop'],
  'samples/migration-destructuring.js': [
    'a and b: 0 0',
    'a and b: 1 0',
    'a and b: 1 2',
  ],
  'samples/migration-error-isolation.js': [
    'second ran with 0',
    'second ran with 1',
    'write threw: first failed',
  ],
  'samples/migration-flush-order.js': ['parent 1', 'child 1'],
  'samples/migration-local-helper.js': ['Hello, Ada', 'Hello, Grace'],
  'samples/migration-memo-order.js': ['1 2 4', '5 10 20'],
  'samples/migration-nested-entry.js': [
    'outer body: 0',
    'nested: 0',
    'nested: 1',
  ],
  'samples/migration-read-before-declaration.js': [
    'before: undefined',
    'after: 2',
  ],
  'samples/migration-reads-only.js': ['reads a: 0', 'reads b: 0', 'reads a: 1'],
  'samples/migration-restored-value.js': ['count is 0', 'count is 0'],
  'samples/migration-sync-batch.js': ['a is 0', 'a is 0'],
};

const parser = new MarkdownIt();
const samples: Sample[] = [];

function addFenced(folder: URL, file: string): void {
  const text = readFileSync(new URL(file, folder), 'utf8');
  for (const token of parser.parse(text, {})) {
    // A block with no code reads a file of src/samples, which is checked on its own.
    if (
      token.type === 'fence' &&
      token.content.trim() &&
      /^js\s+live\b/.test(token.info.trim())
    ) {
      samples.push({
        where: `${file}:${(token.map?.[0] ?? 0) + 1}`,
        source: token.content,
      });
    }
  }
}

// Samples written in the Markdown of the pages.
const docs = new URL('../docs/', import.meta.url);
for (const file of readdirSync(docs).toSorted()) {
  if (file.endsWith('.md')) {
    addFenced(docs, file);
  }
}

// Samples that live in files, shown by `<Sample>` components or Markdown.
const folder = new URL('../src/samples/', import.meta.url);
for (const file of readdirSync(folder).toSorted()) {
  if (/\.(?:js|jsx)$/.test(file)) {
    samples.push({
      where: `samples/${file}`,
      source: readFileSync(new URL(file, folder), 'utf8'),
    });
  }
}

// A run that is disposed stops its timers, and a new run of the same owner disposes the last.
async function checkDispose(): Promise<string | undefined> {
  const code = `setInterval(() => console.log('tick'), 5);`;
  const first = await runModule(code, { settle: 30, owner: 'check' });
  const before = first.logs.length;
  const second = await runModule('console.log("second")', {
    settle: 0,
    owner: 'check',
  });
  await new Promise((resolve) => setTimeout(resolve, 40));
  second.dispose();
  if (before === 0) {
    return 'the interval of the sample did not run';
  }
  if (first.logs.length !== before) {
    return 'the interval of the sample kept running after a new run';
  }
  return undefined;
}

// `--strict` also fails on samples that were compiled and not run. Turn it on in CI once
// codegen-core has merged and the compiler emits code.
const strict = process.argv.includes('--strict');
let failures = 0;
let pending = 0;
const disposeProblem = await checkDispose();
if (disposeProblem) {
  failures++;
  console.error(`dispose: ${disposeProblem}`);
}
for (const sample of samples) {
  if (!importsSilmaril(sample.source)) {
    failures++;
    console.error(
      `${sample.where}: the sample does not import from 'silmaril'`,
    );
    continue;
  }
  try {
    const result = await runSample(sample.source);
    result.dispose();
    const expected = EXPECTED[sample.where];
    if (
      result.ran &&
      expected &&
      JSON.stringify(result.logs) !== JSON.stringify(expected)
    ) {
      failures++;
      console.error(
        `${sample.where}: logged ${JSON.stringify(result.logs)}, expected ${JSON.stringify(expected)}`,
      );
    }
    if (!result.ran) {
      pending++;
      if (strict) {
        failures++;
        console.error(`${sample.where}: compiled and not run`);
      }
    }
  } catch (error) {
    failures++;
    console.error(
      `${sample.where}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

console.log(
  `${samples.length} samples, ${failures} problems, ${pending} compiled and not run`,
);
process.exitCode = failures > 0 ? 1 : 0;
