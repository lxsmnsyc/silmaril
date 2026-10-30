// Copies the PR #8 fixtures and sketch runtime into `.pr8/`, from the PR branch.
// Not needed once PR #8 has merged. Run with `node fetch-pr8.ts`.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ref = process.argv[2] ?? 'origin/feat/reactivity-adr';
const out = fileURLToPath(new URL('./.pr8/', import.meta.url));
const repo = fileURLToPath(new URL('../../../../../../', import.meta.url));
mkdirSync(out, { recursive: true });
const archive = execFileSync(
  'git',
  [
    'archive',
    ref,
    'packages/silmaril/test/runtime/fixtures',
    'docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch',
  ],
  { cwd: repo },
);
execFileSync('tar', ['-x', '-C', out], { input: archive });
console.log(`copied the fixtures of ${ref} into ${out}`);
