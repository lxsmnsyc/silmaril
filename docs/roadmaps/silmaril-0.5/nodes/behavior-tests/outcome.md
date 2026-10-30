# Outcome: behavior-tests

## Built

- `packages/silmaril/test/behavior/harness.ts`: `Pipeline`, `RunResult`, `CaseOptions`, `BehaviorCase`, `run(pipeline, code)`, `pipelines`, `checkCase(pipeline, case)`, `behaviorCases(suite, cases)`. The final shape is in `proposed-behavior-suite.md` (contract v2, for the orchestrator to freeze).
- `packages/silmaril/test/behavior/pipelines/babel.ts`: the 0.4 pipeline (Babel plugin from `../babel`, runtime from `../src`, both from source).
- `packages/silmaril/test/behavior/cases/*.test.ts`: 10 files, 67 cases (let 10, computed 8, effect 7, sync 7, mount 6, destroy 7, store 7, composable 5, nested 6, limits 4). 63 pass, 4 are xfail on `babel`.

### Harness API

- `run(pipeline, code)` compiles the code, installs vitest fake timers, runs the module and does one final `flush()`. It returns `{ logs, flush, dispose }`. Call `dispose()` to restore real timers.
- The case code sees two free identifiers, `log` and `flush`, and may use top-level `await`. `import ... from 'silmaril'` resolves to `pipeline.runtime`. `import Store from 'silmaril/store'` resolves to the source store. A pipeline can add or override specifiers with `Pipeline.modules`. Other specifiers throw. `run` must not be called concurrently (fake timers are global); `behaviorCases` keeps each suite sequential.
- `behaviorCases(suite, cases)` registers each case for each pipeline under `describe('<suite> [<pipeline>]')` and compares the logs with `toEqual`.

### Add a pipeline

Add `packages/silmaril/test/behavior/pipelines/<name>.ts` with a `Pipeline` as the default export (`name`, `compile`, `runtime`, optional `modules`). `compile` may be async. Import the compiler and runtime from source. The harness picks the file up by itself and runs every case against it. The new pipeline starts with failing cases unless it matches 0.4, so mark them with `xfail` per pipeline name or fix them.

### Add a case

In `cases/<construct>.test.ts`, call `behaviorCases('<suite>', [{ name, code, logs }])`. `code` is plain JS that calls `log(...)`. Use `await flush()` between phases. To write from outside a boundary, save a setter in a module-level `let` inside `$$`. `logs` is the expected list of `log` argument arrays.

### xfail

`options: { xfail: ['babel'] }` on a case. On the named pipeline the case is a normal test and its title ends with ` (xfail)`. Errors from compiling or running fail it. It passes while the logs differ from `logs`, and it fails with `now passes: remove the pipeline from xfail` once they match. Other pipelines run it normally. State the 0.5 behavior in `logs`.

### Cases marked xfail on babel (all in `cases/limits.test.ts`)

- effect tracks a variable read inside a local helper: 0.4 only tracks reads in the `$` call itself, so changing `prefix` does not rerun.
- sync effect tracks a variable read inside a local helper: same limit for `$sync`.
- computed variable tracks a variable read inside a local helper: a helper that reads `offset` does not make the computed depend on it.
- computed variable stays current when its helper is declared after it: the computed reads `a` through a hoisted function and is stale after `a` changes.

## Deviations

- The brief said to update the contract. Rules forbid editing `contracts/`, so the full replacement is `proposed-behavior-suite.md`.
- The harness runs the module in an `AsyncFunction` and rewrites imports (found with `@babel/core`'s `parseSync`, replaced by source range) into lookups. The brief suggested `vm.SourceTextModule` or a data URL. `SourceTextModule` needs `--experimental-vm-modules`, and a data URL cannot resolve the bare `silmaril` specifier. The wrapper also allows top-level `await` and gives cases `log` and `flush` as free identifiers.
- `CaseOptions` is exactly `{ xfail?: string[] }`. Besides the planned `compile` async, `RunResult.dispose`, `BehaviorCase` and `behaviorCases` were added.

## Stubs left

- None.

## Gotchas

- Import linking uses a parser. Default, named, namespace and combined imports work, also several on one line. `export` and dynamic `import()` throw. A compiler that imports another specifier must list it in `Pipeline.modules`.
- Nested `$$` is an independent boundary on the 0.4 runtime (not linked to the outer variables or destroy). No case asserts either way; `runtime-v2` should decide and add one.
- Cleanup callbacks read live variables in 0.4 (`onDestroy` after a write sees the new value), so cases avoid asserting variable values inside cleanups.

## Proposed learnings

- Cases log with `log(...)` and never assert on compiled code | keeps one suite valid for every compiler | packages/silmaril/test/behavior | no
- Add a pipeline as a file in `pipelines/` and import from source, never `dist` | harness discovers it and runs the suite on it | packages/silmaril/test/behavior | yes

## Verification

- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: pass. `pnpm test`: 97 passed, 4 expected fail.
- `pnpm format:check`: pass.

## Size

- Estimated M, actual M.
