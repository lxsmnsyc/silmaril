# Outcome: reactivity-adr

## Built

- `docs/roadmaps/silmaril-0.5/decisions/0001-static-graph-runtime.md`: the decision record. It records the gate and follow-up decisions, each design decision with the alternatives rejected, the answer to the nested `$$` question, the loop guard, the full "Changes from 0.4" list by category, and what is still open.
- `docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/proposed-reactivity-runtime.md`: the full replacement for `contracts/reactivity-runtime.md` (version 4), ready to set to `frozen`. It has the exports, exact signatures, the graph format, the compiler rules (slots, entry ids, reads, names, temps, compiled forms, imports, compile errors), the runtime rules (order, phases, registration, runs, the `$` flush and `tick`, lifecycles, stores, composables, errors, limits) and the fixture protocol.
- `packages/silmaril/test/runtime/fixtures/<name>/`: 61 fixtures. 54 have `input.js`, `output.js` and `expected.json` with logs. 7 are compile errors, with `input.js` and an `expected.json` that holds `compileError`.
- `docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/runtime.js` and `run-fixtures.mjs`: a reference runtime and a runner that implement the contract. Every fixture passes. Not shipped.

Key decisions:

- Gate: outer bodies do not run again for reads inside nested entries; a queued `$` runs after its values are restored; 1.5 kB gzip cap with a 1.2 kB target; public `tick()`; the other breaking changes are accepted.
- Nested `$$` does not track outer variables. It reads their current value and its writes run outer entries. Reason: it has its own lifetime and can have any number of live instances, which a static path cannot name (decision 20).
- Loop guard: the outermost drain counts entries taken from the memo and `$sync` queues. Past 10000, each next entry throws `Error('Update loop')` in place of running, the first is held and thrown to the caller of the write, and the count resets when the outermost drain ends. The `$` flush has its own count of re-runs, and throws from the microtask.
- Backwards compatibility first: twelve free choices went back to the 0.4 behavior (decision record, "Changes from 0.4" (c) 1 to 12). Among them: a running entry can be queued again, block declarations outside loops are reactive, arrow initializers that read a slot are memos, entries can be called inside expressions, memo initializers can write, mount right after a run, dispose in registration order, composable callbacks at the place of the call, store write-backs at registration and on every change, `$$` and `$composable` run without the compiler.
- Order is total: lower depth first, then by rank of the branches under the closest common ancestor (entry id, then composables in call order, then roots by creation order). The runtime does not depend on graph list order.
- An entry whose ancestor entry is queued does not run. A running entry can be queued and runs again after it returns.
- `$sync` registration runs the body as a running `$sync` body. Inside a running body, writes run memos at once and defer `$sync` bodies until the outermost body returns.
- Store write-backs are numbered with the memos and run in the memo phase.
- A run that throws disposes its new child scope. A root or composable setup that throws is disposed. A memo that throws keeps its old value. The first held error is thrown by the outermost drain.
- A write to a slot in a memo initializer is allowed, as in 0.4. The `/* $skip */` comment is a compile error.
- A body that reads a memo of its own child scope gets that memo's reads (found while writing the fixtures, fixture `body-memo`).
- Compiled forms: parenthesized compound and logical assignments, in-place destructuring with per-site temps, `for-of`/`for-in` slot targets, chained writes, top-level `var` follows `let`, graph constants after the imports, unique generated names.

## Fixtures

- From the first version (17): `composable`, `effect-batch`, `effect-scope`, `error`, `let-write`, `lifecycle`, `local-function`, `memo`, `memo-destructure`, `memo-writable`, `nested-root`, `nested-scope`, `order`, `skip`, `store-const`, `store-let`, `update-expression`. Changed: graphs moved after the imports, `tick` imported from `'silmaril'`, the new destructuring and logical forms in `update-expression`, write-back numbering notes.
- From the review's adversarial set (14, adapted with an `input.js`): `child-memo-wasted`, `composable-glitch`, `dispose-queued`, `effect-parent-child`, `error-in-rerun`, `memo-throws`, `memo-writes-slot` (compile error), `parent-child-cycle`, `self-write`, `setup-throws`, `sibling-order-a`, `sibling-order-b`, `store-writeback-batch`, `sync-first-vs-rerun`. Plus `memo-write-runtime`, for the memo write the compiler cannot see.
- Follow-up pass (16): `update-loop`, `two-way-binding`, `dispose-order`, `composable-lifecycle`, `store-echo`, `block-slot`, `entry-in-expression`, `function-memo`, `class-field-destructure`, `namespace-root`, `object-memo`, `written-function`, and the compile errors `store-pattern`, `entry-arguments`, `root-argument`, `jsx-tag`. `memo-writes-slot` became a runtime fixture. Changed for 0.4 behavior or the PR #9 change requests: `self-write`, `parent-child-cycle`, `store-writeback-batch`, `lifecycle`, `var-slot`, `local-function`, `composable`, `entry-in-function`, `nested-scope`, `nested-root`, `for-of-slot`.
- New (13): `tick`, `chained-write`, `compound-assignment`, `destructure-assign`, `for-of-slot`, `var-slot`, `memo-local-call`, `nested-composable`, `nested-root-write`, `body-memo`, `loop-entry` (compile error), `entry-in-function` (compile error), `skip-comment` (compile error).

Some adversarial fixtures expect other logs than the review wrote, because the review left those rules open:

- `sync-first-vs-rerun`: both runs log `body`, `inner 0`, `body end`, `inner 1`. The review's draft expected `inner 1` before `body end`. Deferring is the review's own fix 2(a), and it keeps the drain from being re-entrant.
- `parent-child-cycle`: the outer body runs once, as the review's text says. The draft expected 2.
- `error-in-rerun`: `destroy 1` comes before `caught boom`, because the child is disposed before the error leaves the write.
- `memo-throws`: the graph now lists the `$sync` for `x` too, as the source requires.
- `composable-glitch`: the torn read is the documented behavior.

## Deviations

- The runner also maps `import * as name from 'silmaril';` to `const name = runtime;`, for `namespace-root`.
- The fixture runner no longer passes a free `tick`. Fixtures import the runtime's `tick` from `'silmaril'`, and the runner waits one macrotask after the body.
- `expected.json` has a second shape for compile errors: `{ "description", "compileError" }`, with no `output.js`.
- The contract is not edited. The orchestrator copies `proposed-reactivity-runtime.md` over it after the gate.

## Stubs left

- The fixtures are the stub for `runtime-v2` and the codegen nodes. `runtime-v2` replaces the sketch with `src/v2/index.ts` and writes `test/runtime/*.test.ts` that runs the fixtures. The sketch can be deleted after that.
- No fixture throws from a `$` body, because the error leaves a microtask. `runtime-v2` tests that case in vitest.

## Still open

- Size: the sketch measures 1481 B gzip, 19 B under the 1.5 kB cap. `runtime-v2` does the size pass toward 1.2 kB.
- The loop guard counts entry runs, so one write that fans out to more than 10000 entries throws too.
- The compiler-api contract (PR #9) needs the slot, entry, reads and graph rules of this contract.

## Gotchas

- Fixtures are `.js` modules with top-level `await`, and they use the free name `log`. tsc ignores them because `tsconfig.base.json` has no `allowJs`. vitest ignores them because it only collects `test/**/*.test.ts`. They pass oxlint and oxfmt. Do not rename them to `.ts`.
- oxlint rejects unused sequence expressions, so the statement form of destructuring writes is split into statements in the fixtures. The contract allows both.
- `var-slot` disables `block-scoped-var`, because a block-level `var` is what it tests.
- JSON cannot hold `undefined`. Fixtures log `String(...)` or `typeof` where a value can be `undefined`.
- The runner replaces only `import { ... } from 'silmaril';`. Fixtures define their stores inline instead of importing `silmaril/store`.
- The codegen nodes should compare logs, not text. The fixture comments give the expected slot and entry numbers, but other names and layouts are fine.

## Proposed learnings

- Fixture files under `packages/silmaril/test/runtime/fixtures/` stay `.js` with no `allowJs` | tsc would check the free `log` name | packages/silmaril/test/runtime/fixtures | yes (type-check fails)
- Compiled code reads and writes slots only through `$$get` and `$$set` | the scope shape stays private to the runtime | packages/silmaril/compiler | no
- Graph constants go after the imports | a function declaration called before the setup statement would read them in the TDZ | packages/silmaril/compiler | no

## Verification

- `node docs/roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/run-fixtures.mjs`: 61 of 61 pass. The `$` flush guard was checked with a scratch script: a cycle between two `$` bodies stops after 10000 runs with `Update loop` from the microtask, a later write runs as usual, and 10001 first runs in one flush do not trip it. Earlier: Against the PR's first sketch (with a `tick` shim), 36 of 45 pass. It fails `body-memo`, `child-memo-wasted`, `effect-parent-child`, `error-in-rerun`, `parent-child-cycle`, `setup-throws`, `sibling-order-b`, `store-writeback-batch` and `sync-first-vs-rerun`.
- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check`: passes.
- Size: rolldown 1.2.15 `minify: true`, gzip level 9, every export kept. Sketch 3096 B, 1481 B gzip. Version 3 3036 B, 1434 B. First sketch 2627 B, 1278 B. 0.4 2064 B, 770 B.
- No dependencies added. No changeset: nothing published changes.

## Size

- Estimated L, actual L.
