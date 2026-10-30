# Outcome: benchmark-harness

## Built

- `benchmarks/` workspace package (private): `src/index.ts` (entry), `src/pipelines.ts` (loads every file in `packages/silmaril/test/behavior/pipelines/` as a `Pipeline`), `src/load.ts` (compiles a source with a pipeline and runs it with `silmaril` linked to `pipeline.runtime`), `src/sources.ts` (generated sources), `src/compile.ts`, `src/update.ts`, `src/stats.ts`.
- `pnpm bench` (root script, runs `benchmarks` with `node --expose-gc --import tsx`) prints a compile table (time and heap per source size of 1.3, 12.9 and 54.5 KB) and an update table (one write to N computeds and sync effects; 50 writes of N sources and one tick; N = 10, 100, 400). One row per pipeline, so the 0.5 pipeline appears once its file is added to the behavior suite.
- `benchmarks/README.md` has the 0.4 Babel baseline, the machine (Apple M2, 8 cores, 8 GB, macOS) and Node.js v26.12.1.
- Wiring: `benchmarks` added to `pnpm-workspace.yaml`, `bench` script in root `package.json`, `allowBuilds: esbuild: false` in `pnpm-workspace.yaml`.

## Deviations

- Baseline was taken under load, not on a quiet machine (other agents were running): load average 10.9 at the start and 9.8 at the end. The curator must re-run `pnpm bench` on a quiet machine before the benchmark report. The README says the same.
- `pnpm-workspace.yaml` gained `allowBuilds: esbuild: false`. `tsx` depends on esbuild, and pnpm 12 fails an install (also `--frozen-lockfile`) on its unapproved build script. `tsx` works without it. A later node that rebases `pnpm-workspace.yaml` must keep the line.
- Sizes are smaller than first planned (400 groups, N = 400): the 0.4 compiler is slower than linear and 1000 groups took minutes.

## Stubs left

- None. No 0.5 pipeline yet; `switch-to-v2` or the codegen nodes add it as a file in the behavior suite's `pipelines/` and `pnpm bench` picks it up. If `switch-to-v2` deletes `pipelines/babel.ts`, the 0.4 baseline stays in the README only.

## Gotchas

- Dependencies added: `tsx` ^4.21.0 (resolved 4.23.15), `typescript` ^7.0.2 and `@types/node` ^26.6.5 (already in the lockfile), all devDependencies of `benchmarks` only. `pnpm-lock.yaml` changed: re-generate it after rebasing on `compiler-core`. Adding tsx also adds `tsx` and `esbuild` to some existing peer-suffixed vite and tsdown entries in the lockfile.
- Import linking in `src/load.ts` is a regex for `import { a, b as c } from 'x'`. A pipeline whose compiled output uses default or namespace imports needs it extended (use the same `parseSync` approach as the harness).
- `src/*.ts` imports the `Pipeline` type from `packages/silmaril/test/behavior/harness` as a type only; the harness is not loaded at run time.
- Memory is a lower bound (heap delta around one compile with a collection before it).
- Effects written with `$` run on a real timer, so batch rows include one `setTimeout(0)`.

## Proposed learnings

- Benchmarks load pipelines from the behavior suite directory, so one pipeline file serves tests and benchmarks | avoids a second pipeline list | benchmarks | no

## Verification

- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: pass (`pnpm test`: 104 passed).
- `pnpm format:check` and `pnpm build:examples`: pass.
- `pnpm bench`: runs both benchmarks and prints the tables (about 2 minutes).

## Size

- Estimated M, actual M.
