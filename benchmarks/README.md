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

## Baseline: 0.4 (Babel pipeline)

- Pipeline: `babel`, the plugin in `packages/silmaril/babel` and the runtime in `packages/silmaril/src` (0.4).
- Machine: Apple Silicon (arm64), macOS (Darwin 27.0.0), Node.js v26.12.1.
- Taken under load. Other agents were building and testing on the machine, load average 10.9 at the start and 9.8 at the end (1 minute, from `uptime`). The numbers are noisy. Re-run on a quiet machine before they go in the benchmark report.

Compile (ms per file, KiB of heap allocated per compile, a lower bound):

| pipeline | source  | median ms | min ms | max ms | heap KiB |
| -------- | ------- | --------- | ------ | ------ | -------- |
| babel    | 1.3 KB  | 15.17     | 7.81   | 18.41  | 4110.1   |
| babel    | 12.9 KB | 85.47     | 70.72  | 102.08 | 11260.7  |
| babel    | 54.5 KB | 559.17    | 436.09 | 950.11 | 52183.3  |

Update (one write: microseconds; batch: 50 writes of N sources then one tick, ms):

| pipeline | N   | write median us | write max us | batch median ms | batch max ms |
| -------- | --- | --------------- | ------------ | --------------- | ------------ |
| babel    | 10  | 63.2            | 140.2        | 2.43            | 3.85         |
| babel    | 100 | 1018.6          | 3543.7       | 67.62           | 100.81       |
| babel    | 400 | 17593.8         | 31986.6      | 697.88          | 1337.95      |

The cost of one write grows faster than N in 0.4. The static graph of 0.5 should remove that.

## Notes

- Memory is `heapUsed` before and after one compile, with a forced collection before it (`--expose-gc`). A collection during the compile can lower it, so read it as a lower bound.
- The update benchmark compiles its source with the pipeline, links `import ... from 'silmaril'` to `pipeline.runtime`, and runs it in-process. Effects written with `$` run on a timer, so the batch rows include one `setTimeout(0)`.
