// Compiles and runs every live sample of the docs and of `src/samples`, so a sample that stops
// compiling or that throws fails the check. It runs the same code as the page.
import { readFileSync, readdirSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { importsSilmaril, runModule, runSample } from '../src/live/run.ts';

interface Sample {
  where: string;
  source: string;
}

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
  `${samples.length} samples, ${failures} problems, ${pending} compiled only (the compiler emits no code yet)`,
);
process.exitCode = failures > 0 ? 1 : 0;
