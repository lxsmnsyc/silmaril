// Compiles and runs every live sample of the docs and of `src/samples`, so a sample that stops
// compiling or that throws fails the check. It runs the same code as the page.
import { readFileSync, readdirSync } from 'node:fs';
import MarkdownIt from 'markdown-it';
import { runSample } from '../src/live/run.ts';

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
      /^(?:js|jsx|ts|tsx)\s+live\b/.test(token.info.trim())
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

let failures = 0;
let pending = 0;
for (const sample of samples) {
  try {
    const result = await runSample(sample.source);
    if (!result.ran) {
      pending++;
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
