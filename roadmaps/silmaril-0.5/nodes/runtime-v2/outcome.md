# Outcome: runtime-v2

## Built

- `packages/silmaril/src/v2/index.ts`: the typed runtime of contract `reactivity-runtime` v4. Exports exactly the contract's values and the types `Scope`, `Ref`, `Graph`, `Store`. Not exported from the package yet; `src/index.ts` is untouched.
- `packages/silmaril/test/runtime/fixtures.test.ts`: runs the `output.js` of the 54 runtime fixtures with the contract's runner protocol (import rewrite, async function with `runtime` and `log`, one macrotask, deep strict equal). The 7 compile-error fixtures are skipped, as the contract says.
- `packages/silmaril/test/runtime/runtime.test.ts`: 38 unit tests for write ordering, batching, `Object.is` skip, child scope disposal, `onMount`, `onDestroy`, store subscription cleanup, composables, errors (including the `$` flush error and the `$` loop guard through `uncaughtException`) and the names that run without the compiler.
- Same behavior as the reference sketch. Internals changed for size: each entry is an object (`{ s, i, k, f, h, w, c, q }`) in `scope.e` by id and `scope.l` in registration order, in place of parallel arrays. The three queues are sorted lazily.

## Deviations

- None to the contract or the fixtures. No file outside the owned paths and `nodes/runtime-v2/` changed.

## Stubs left

- None. `switch-to-v2` moves the exports into `src/index.ts`. `nodes/reactivity-adr/sketch/` can be deleted.

## Gotchas

- Queue order: the queues hold entries and are sorted by the contract's total order when something was queued since the last take (`Array.prototype.sort`, then `shift`). Order never changes for a live entry, so this is safe. A fan-out of n entries costs O(n log n) comparisons. A test runs 3000 entries from one write.
- A composable scope has rank `2 ** 30 + n`, so `scope.e` has no entry at that index. The "queued ancestor" check uses `e[x]?.q` for this reason.
- `mark` builds a small array per graph reference (`[ref].flat()`), which costs one allocation per reader per write. It saved 24 B gzip. Revert it if the benchmarks show it.
- The tests import `'../../src/v2'` directly. The fixtures `import ... from 'silmaril'` are rewritten by the runner to the namespace of that module.
- The `$` flush error and loop guard throw from a microtask, so the tests catch them with a `process.on('uncaughtException')` handler.

## Proposed learnings

- Keep the scope shape private: compiled code reads and writes slots only through `$$get` and `$$set` | the runtime changed its internals three times in the size pass without touching a fixture | packages/silmaril/src/v2 | no
- Measure size as gzip of the minified module, not the source | repeated code gzips well, so a shared helper can grow the gzip size while it shrinks the minified size (a `call` helper: -51 B minified, +6 B gzip) | packages/silmaril/src | no

## Verification

- `pnpm --filter silmaril test`: 198 pass (92 in `test/runtime`).
- Fast check from GOAL.md: `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: passes. `pnpm format:check`: passes.
- No dependencies added. No changeset: v2 is not exported.

## Size pass

Method: build `src/v2/index.ts` with tsdown (rolldown) with `minify: true`, neutral platform, target es2022, all exports kept, then gzip level 9 of the output. The script was a scratch file, not committed. The sketch measures 1481 B with it, as in the ADR outcome.

Result: 2971 B minified, 1413 B gzip. Under the 1.5 kB cap by 87 B. The 1.2 kB aim is not reached (213 B over).

Gzip size after each change (cumulative unless marked dropped):

| Change                                                                                                                                 | gzip B |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Sketch ported to TypeScript, no logic change                                                                                           | 1481   |
| Entry objects in place of eight parallel arrays; one `BUSY` array and one `drain(kind)` in place of the memo and sync flags and copies | 1423   |
| Drop the redundant `kind === MEMO` test (`w >= 0` only for memos)                                                                      | 1420   |
| Sort the queue in place of the O(n^2) scan                                                                                             | 1416   |
| Walk a graph path with `[ref].flat()` and `pop()`                                                                                      | 1392   |
| Sort once per take when dirty, O(n log n) for wide fan-out                                                                             | 1413   |
| Dropped: `Map` for entries (no `l` list)                                                                                               | 1448   |
| Dropped: lazy `o` and `u` arrays                                                                                                       | 1434   |
| Dropped: shared `call` helper for the three try/finally blocks                                                                         | 1419   |

Cost of the remaining parts (gzip with the part removed, base 1413):

| Part                                         | Cost B |
| -------------------------------------------- | ------ |
| Six compile-time stubs and `compileTimeOnly` | 113    |
| `$$composable`                               | 107    |
| `$$store` (with its write-back)              | 52     |
| Loop guard (both counts)                     | 40     |
| `tick` and its waiters                       | 30     |

The rest (about 1070 B) is the core: scopes, queues and order, marks, runs, mount and dispose, errors. The 0.4 runtime is 770 B and has none of the order, loop guard or composable rules. Reaching 1.2 kB would need a contract change (for example no total order between sibling scopes, or no loop guard).

## Size

- Estimated M, actual M.
