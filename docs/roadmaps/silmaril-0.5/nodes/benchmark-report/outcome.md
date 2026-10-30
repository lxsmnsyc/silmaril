# Outcome: benchmark-report

## Built

- `benchmarks/README.md`: the 0.4 against 0.5 table (taken at `0f55110`, the last commit with both pipelines) and a new section, "Check after the switch (0.5.0)", with runs at `25b4952` and a same-session rerun of `0f55110`.
- Against 0.4: compiling the 54.5 KB source is about 13 times faster, one write at N = 400 is about 60 times cheaper, and a batch at N = 400 is about 85 times cheaper. In 0.4 the cost of one write grows faster than N; in 0.5 it grows about linearly.

## Deviations

- The brief asked to add the 0.5 pipeline. `codegen-core` already added it (`test/behavior/pipelines/compiler.ts`), so this node only ran and recorded.

## Stubs left

- None.

## Gotchas

- The compile benchmark is sensitive to the heap state: it does 7 timed runs per size, and the 54.5 KB compile allocates about 30 MB. With `compiler` as the only pipeline, its large-file median ranged from 16 to 43 ms across four runs. The same code measured 13 to 14 ms when the `babel` pipeline ran first. `--max-semi-space-size=32` brings it back to 14.6 ms. No regression: the compiler code and its dependencies are unchanged since `0f55110`.

## Proposed learnings

- Stabilize the compile benchmark before using it to find regressions (more runs, or a fixed `--max-semi-space-size`) | the median moved by 2.6x between runs of the same code | `benchmarks/` | no

## Follow-ups

- Optional `could` chore: stabilize the compile benchmark as above. No regression needs a fix.

## Verification

- `pnpm install --frozen-lockfile && pnpm build && pnpm bench` at `25b4952`, four times. The same at `0f55110`, twice, in the same session. Numbers are in the README.
- `pnpm format:check` passes.

## Size

- Estimated S, actual S.
