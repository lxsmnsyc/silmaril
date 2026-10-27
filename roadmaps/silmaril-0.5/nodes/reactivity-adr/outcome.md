# Outcome: reactivity-adr

## Built

- `roadmaps/silmaril-0.5/decisions/0001-static-graph-runtime.md`: the decision record. It answers each item of the contract's Behavior list, with the rejected alternatives, and lists the breaking changes from 0.4 and the questions for the gate.
- `roadmaps/silmaril-0.5/nodes/reactivity-adr/proposed-reactivity-runtime.md`: the full replacement for `contracts/reactivity-runtime.md` (version 2), ready to set to `frozen`. It has exact signatures, the graph format, a table of compiled forms, the ordering rules and the fixture runner protocol.
- `packages/silmaril/test/runtime/fixtures/<name>/{input.js,output.js,expected.json}`: 17 fixtures, one per construct: `let-write`, `memo`, `memo-writable`, `memo-destructure`, `order`, `effect-batch`, `effect-scope`, `nested-scope`, `local-function`, `skip`, `lifecycle`, `nested-root`, `store-const`, `store-let`, `composable`, `update-expression`, `error`.
- `roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/runtime.js` and `run-fixtures.mjs`: a reference runtime and a runner that implement the runner protocol. Every fixture passes. Not shipped. It shows that the expected logs follow from the rules and gives the size estimate.

Key decisions:

- Helpers come from `'silmaril'`: `$$root`, `$$composable`, `$$get`, `$$set`, `$$update`, `$$memo`, `$$sync`, `$$effect`, `$$store`, `$$mount`, `$$destroy`. The user-facing names throw when called without the compiler.
- Values live in slots. A graph per setup body is a module-level `readonly (readonly Ref[])[]`, where a `Ref` is an entry id or a path `[e1, ..., id]` into the child scopes of entries.
- Entry ids: memos, then `$sync` and store write-backs, then `$`, each in declaration order. Queues run lowest depth first, then lowest id.
- A write runs memos and `$sync` before it returns, and memos stay fresh even for writes inside entries. `$` runs in one `queueMicrotask` flush per batch of writes.
- `$sync` stays a synchronous effect. It is not folded into memos.
- Every entry run gets a child scope, disposed before the next run. Nested entries track outer slots through paths, so outer bodies no longer rebuild for reads inside nested entries.
- Size target: at most 1.5 kB min+gzip for `src/v2/index.ts`, aim 1.2 kB. The sketch measures 1278 B. 0.4 measures 770 B.

## Deviations

- The draft's `$$scope(parent, graph, size)` is replaced by `$$root` and `$$composable`. Compiled code never makes a scope on its own, and the slot count is the graph length.
- `$$memo`, `$$sync` and `$$effect` take an entry id, and `$$sync` and `$$effect` take an optional child graph. The draft did not have these.
- The contract is not edited. The orchestrator copies `proposed-reactivity-runtime.md` over it after the gate.

## Stubs left

- The fixtures are the stub for `runtime-v2` and the codegen nodes. `runtime-v2` replaces the sketch with `src/v2/index.ts` and writes `test/runtime/*.test.ts` that runs the fixtures. The sketch can be deleted after that.

## Gotchas

- Fixtures are `.js` modules with top-level `await`, and they use the free names `log` and `tick`. tsc ignores them because `tsconfig.base.json` has no `allowJs`. vitest ignores them because it only collects `test/**/*.test.ts`. They pass oxlint and oxfmt. Do not rename them to `.ts`: tsc would check them and fail on the free names.
- oxlint warns on `_`-prefixed names (`no-underscore-dangle`). The fixtures name generated variables `$s`, `$c0`, `$g0` and `$t`. The compiler can pick any names.
- The runner replaces only `import { ... } from 'silmaril';`. Fixtures define their stores inline instead of importing `silmaril/store`.
- `$` errors are thrown from a microtask. A runner that does not catch them crashes Node. No fixture throws from a `$`.
- Store values that cross scopes are separate writes. The `composable` fixture logs `Value` and `Squared` in separate `$sync` bodies so its logs do not depend on that.
- The codegen nodes should compare logs, not text. The fixture comments give the expected slot and entry numbers, but other names and layouts are fine.

## Proposed learnings

- Fixture files under `packages/silmaril/test/runtime/fixtures/` stay `.js` with no `allowJs` | tsc would check the free `log` and `tick` names | packages/silmaril/test/runtime/fixtures | yes (type-check fails)
- Compiled code reads and writes slots only through `$$get` and `$$set` | the scope shape stays private to the runtime | packages/silmaril/compiler | no

## Verification

- `node roadmaps/silmaril-0.5/nodes/reactivity-adr/sketch/run-fixtures.mjs`: 17 of 17 fixtures pass against the sketch.
- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: passes. No new lint warnings.
- `pnpm format:check`: passes.
- Size: rolldown `minify: true`, gzip level 9, every export kept. 0.4 `dist/index.mjs` is 2064 B and 770 B gzip. The sketch is 2627 B and 1278 B gzip.
- No dependencies added. No changeset: nothing published changes.

## Size

- Estimated L, actual L. The design took most of the time. Writing the sketch caught one ordering problem (decision 12) before the contract was written.
