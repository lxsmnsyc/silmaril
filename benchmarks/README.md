# Benchmarks

Private workspace package. It measures a silmaril pipeline (a compiler and its runtime) on two things:

- Compile: time per file and heap allocated per compile, for sources of 1.3, 12.9 and 54.5 KB (10, 100 and 400 reactive groups of a source, a computed and an effect).
- Update: the cost of one write that reaches N computeds and N sync effects, and of 50 writes of N sources followed by one tick (N sources, each with a computed and a `$` effect).

## Run

```sh
pnpm bench
```

`pnpm bench` loads every `Pipeline` in `packages/silmaril/test/behavior/pipelines/` (the type is `Pipeline` from the behavior suite) and prints one table per benchmark with a row per pipeline. A pipeline added there is measured with no change here. It takes about 2 minutes. Run it on a quiet machine, with nothing else running.

The benchmark dependencies (`tsx`) live in this package. `packages/silmaril` gains none.

## Results: 0.4 against 0.5

- Pipelines, with paths as of commit `0f55110`: `babel` (the 0.4 plugin in `packages/silmaril/babel` and the 0.4 runtime in `packages/silmaril/src`) and `compiler` (`silmaril/compiler` and the runtime in `packages/silmaril/src/v2`).
- Commit: `0f55110` on `roadmap`, the last commit with both pipelines (2026-10-30). `switch-to-v2` deletes the `babel` pipeline, so later runs show only `compiler`.
- Machine: Apple Silicon (arm64), macOS (Darwin 27.0.0), Node.js v26.12.1. No other build or test running. Load average 5.9 at the start and 5.2 at the end (1 minute, from `uptime`).

Compile (ms per file, KiB of heap allocated per compile, a lower bound):

| pipeline | source  | median ms | min ms | max ms | heap KiB |
| -------- | ------- | --------- | ------ | ------ | -------- |
| babel    | 1.3 KB  | 5.57      | 2.86   | 5.77   | 4106.7   |
| babel    | 12.9 KB | 30.75     | 26.99  | 42.23  | 11203.7  |
| babel    | 54.5 KB | 172.88    | 163.26 | 183.13 | 52009.7  |
| compiler | 1.3 KB  | 0.55      | 0.49   | 4.16   | 994.5    |
| compiler | 12.9 KB | 3.37      | 2.96   | 3.96   | 7813.2   |
| compiler | 54.5 KB | 12.83     | 12.40  | 14.37  | 30129.0  |

Update (one write: microseconds; batch: 50 writes of N sources then one tick, ms):

| pipeline | N   | write median us | write max us | batch median ms | batch max ms |
| -------- | --- | --------------- | ------------ | --------------- | ------------ |
| babel    | 10  | 32.8            | 42.5         | 1.62            | 2.05         |
| babel    | 100 | 431.9           | 2038.2       | 20.27           | 62.15        |
| babel    | 400 | 7603.0          | 9870.5       | 431.24          | 477.30       |
| compiler | 10  | 20.3            | 30.8         | 1.28            | 1.41         |
| compiler | 100 | 28.5            | 153.5        | 2.04            | 2.41         |
| compiler | 400 | 122.7           | 243.4        | 4.93            | 7.28         |

In 0.4 the cost of one write grows faster than N. In 0.5 it grows about linearly: at N = 400, one write is about 62 times cheaper and a batch about 87 times cheaper. Compiling the 54.5 KB source is about 13 times faster.

An earlier 0.4 run under load (load average about 10) measured roughly twice these times; it is replaced by this run.

## Check after the switch (0.5.0)

`switch-to-v2` deleted the `babel` pipeline and moved the runtime from `src/v2` to `src`. The compiler code and its dependency versions did not change. `pnpm bench` was run again on `roadmap` at `25b4952` (2026-10-30, load average 2.8 to 5.0), and the commit above (`0f55110`) was run again in the same session for comparison:

| run                    | 54.5 KB compile, median ms | one write N = 400, median us | batch N = 400, median ms |
| ---------------------- | -------------------------- | ---------------------------- | ------------------------ |
| `0f55110`, run 1       | 13.79                      | 131.6                        | 5.31                     |
| `0f55110`, run 2       | 13.19                      | 122.0                        | 5.02                     |
| `25b4952`, runs 1 to 4 | 42.78, 22.80, 20.45, 16.21 | 137.4, 406.7, 139.0          | 5.22, 5.76, 5.41         |
| `25b4952`, larger heap | 14.58                      |                              |                          |

- Update cost is the same before and after the switch, apart from one noisy run.
- Compiling the small and medium sources is the same. Compiling the 54.5 KB source is slower and noisier after the switch, but the compiler is the same code. Before the switch, the `babel` pipeline ran first and grew the heap, so the `compiler` rows ran with a warm heap. Now `compiler` runs first, and the 30 MB that one compile allocates hits more young-generation collections. With `--max-semi-space-size=32`, the median drops back to 14.6 ms. It is a benchmark effect, not a compiler regression.
- The table above (`0f55110`) stays the 0.4 against 0.5 comparison. Against 0.4, 0.5 compiles the 54.5 KB source about 13 times faster. At N = 400, one write is about 60 times cheaper and a batch about 85 times cheaper.

## Notes

- Memory is `heapUsed` before and after one compile, with a forced collection before it (`--expose-gc`). A collection during the compile can lower it, so read it as a lower bound.
- The update benchmark compiles its source with the pipeline, links `import ... from 'silmaril'` to `pipeline.runtime`, and runs it in-process. Effects written with `$` run on a timer, so the batch rows include one `setTimeout(0)`.
