# Wave 3 report (2026-10-30)

## Pull requests

| Node or fix             | PR  | Review          | State                                    |
| ----------------------- | --- | --------------- | ---------------------------------------- |
| runnable-samples        | #16 | fresh, 2 rounds | merged; samples run on the v2 runtime    |
| flaky timing test       | #18 | self            | merged; counts sorts instead of timing   |
| codegen-extras          | #19 | fresh, clean    | merged; the compiler is complete         |
| switch-to-v2 (gate)     | #20 | fresh, 1 fix    | merged after the maintainer's gate       |
| 0.4.1 release           | #21 | reused reviews  | merged into `main`, 0.4.1 published      |
| docs-reference          | #23 | fresh, 1 fix    | merged                                   |
| docs-migration          | #24 | fresh, 1 fix    | merged                                   |
| docs-guide              | #25 | fresh, 1 fix    | merged                                   |
| Store subscribe type    | #26 | self            | merged                                   |
| docs cross-links        | #27 | self            | merged                                   |
| benchmark-report        | #28 | self            | merged                                   |
| sample-highlighting     | #29 | self            | merged; highlighted editor, gutter, Tab  |
| theme across navigation | #30 | self            | merged; works around a brumate 0.3.0 bug |

What the fresh reviews caught:

- #20: Vite sub-module ids (`Comp.vue?...&lang.ts`) parsed as JSX; changesets that described intermediate states.
- #23: `$` described as running at once; a `$skip` sample that did not show `$skip`; the `Store` class typed its listener without the value (fixed in #26).
- #24: a wrong 0.4 claim about `$skip` (also in the 0.5 changeset); two samples that logged the same on 0.4 and 0.5. The reviewer built 0.4 at `0f55110` to check every 0.4 claim.
- #25: samples that never showed a reaction; a compile check that passed without compiling.

## Decisions (maintainer, 2026-10-30)

- Release 0.4.1 from `main` before 0.5, by cherry-picking the two fixes. Their changesets were then deleted on `roadmap`.
- Move the roadmap under `docs/`, so the `docs/**` ignore of #11 covers it.
- Docs: three briefs (`docs-guide`, `docs-reference`, `docs-migration`) instead of one outline node.

## Results

- 0.4 against 0.5 (`benchmarks/README.md`, quiet machine at `0f55110`): compile about 13 times faster on 54.5 KB, one write at N = 400 about 60 times cheaper, a batch about 85 times cheaper.
- After the switch, the large compile benchmark is noisier with one pipeline. Same code, a heap warm-up effect (`benchmark-report`'s outcome).
- Runtime: 1412 B gzip, under the 1.5 kB cap.

## Carried forward

- brumate 0.3.0 removes every attribute on `<html>` during a client navigation (`src/runtime/navigate.ts`), which drops the saved `data-theme`. #30 works around it in the website's inline theme script; the lasting fix belongs in brumate.

- `tsx` stays in `benchmarks/`: the compiler's own imports have no `.ts` extensions, so plain Node cannot load it.
- Optional: stabilize the compile benchmark (more runs or a fixed `--max-semi-space-size`).
- Perf candidates from `runtime-v2`'s outcome.
- `playground` stays parked (`later`).

## Process notes

- Drafts until the review is clean, then ready: CI ran once per PR on `roadmap` after `main` was merged in.
- Catch-up merges replaced rebases. A merge of #23 and #25 left a duplicate import that broke `check:samples`; the #24 catch-up fixed it. Run `check:samples` after resolving conflicts in website scripts.
- The orchestrator tried an amend and force-push once; the permission check refused it. New commits only.
