# Log: reactivity-adr

- Started on `feat/reactivity-adr` at 106c75a. No decision record or fixtures existed, so the work was not already done.
- Read the 0.4 runtime, the Babel plugin, the compiler snapshots, the README and brumate's reactive graph and decisions docs.
- Baseline: 0.4 `dist/index.mjs` is 2064 B minified, 770 B gzip (rolldown minify, gzip level 9).
- Chose `.js` fixtures. tsc has no `allowJs`, so it ignores them, and vitest only picks `test/**/*.test.ts`.
- Wrote a reference runtime in `nodes/reactivity-adr/sketch/` to check that the expected logs follow from the rules, and to measure size. It is not shipped; `runtime-v2` writes the real one.
- Wrote 17 fixtures. All pass against the sketch (`node docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/run-fixtures.mjs`).
- oxlint flagged `_` prefixed names (no-underscore-dangle), unused expressions and useless spreads in the fixtures. Renamed generated names to `$s`, `$c0`, `$g0`, `$t`, made every expression a `log` argument, and dropped the spreads.
- Sketch size: 2627 B minified, 1278 B gzip. Target set to 1.5 kB gzip, aim 1.2 kB.
- Found while writing the composable fixture: ordering parents before children makes a value that crosses scopes through a store show up as two writes. Recorded as decision 12, and the fixture logs the two values separately.
- Wrote the decision record and the proposed contract. Fast check passes.

## Revision after the gate

- Read the maintainer's gate decisions on PR #8, the runtime review of PR #8 and the "reactivity-runtime" section of the compiler review of PR #9.
- Ran the review's 14 adversarial fixtures: 10 fail on the first sketch, 6 still fail on the reviewer's patched sketch (some because their expected logs were placeholders).
- Rewrote the sketch: running flag per entry, skip when an ancestor entry is queued, total order by depth then common-ancestor rank, `$sync` registration as a running body, write-backs in the memo phase, dispose on throw in runs, roots and composables, separate error holding for the `$` flush, `tick`.
- Found while writing fixtures: a body that reads its own memo never ran again, because its only read was inside the memo. Added the rule that such a body gets the memo's reads (`body-memo`).
- Changed the runner protocol: fixtures import `tick` from `'silmaril'`, and compile-error fixtures carry `compileError` instead of logs.
- Moved graph constants after the imports in every fixture.
- 45 fixtures, all pass. Sketch size 1434 B gzip.

## Follow-up pass: loop guard and changes from 0.4

- Read the follow-up maintainer decisions on PR #8 and brumate's `updates.ts` guard (`drain`, `queue`, `stuck`, `failed`).
- Added the loop guard to the sketch: one count per outermost drain, one per `$` flush that skips first runs. Past 10000 each taken entry throws `Update loop` in place of running.
- Compared every rule with 0.4 (`src/index.ts`, and `babel/index.ts` with the PR #5 fixes) and sorted the differences into gate-accepted, needed by the model, and free choices. Switched twelve free choices back to 0.4. The largest is dropping the self-skip: with the guard, a running entry can be queued again, as in 0.4.
- Applied the nine change requests of the PR #9 compiler spike.
- 61 fixtures, all pass. Sketch 1481 B gzip.
