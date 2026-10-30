# Adversarial review

A fresh-context reviewer checked contracts, shared files and dependency edges on 2026-10-27. All eight findings held up on inspection and were applied.

1. `switch-to-v2` and `fix-babel-plugin` overlapped with no edge. Applied: `switch-to-v2` has a `hard` dependency on `fix-babel-plugin`.
2. Behavior suite ownership overlapped and nodes that add cases owned nothing there. Applied: `behavior-tests` owns the harness, the Babel pipeline and the cases; the compiler pipeline belongs to `codegen-core`; the nodes that add cases share `cases/**`; `switch-to-v2` shares `test/behavior`, `test/runtime` and `test/compiler`.
3. `codegen-core` needed finished cases from a `contract` edge. Applied: the edge is now `behavior`. `benchmark-harness` gained a `contract` edge on `behavior-suite`.
4. The `behavior-suite` draft left `log` injection, module resolution, timers, expected failures and async compile open. Applied: listed as acceptance items for `behavior-tests` to settle when it freezes the contract.
5. Website nodes missed READMEs, `website/package.json`, CI and docs paths. Applied: shared entries added, `docs-content` owns `website/docs/**`.
6. `compiler-api` left wasm async loading, the source map type and the build platform open. Applied: written into the contract as open points the spike must answer. The removed `babel` option of the unplugin is listed in `switch-to-v2`'s changeset acceptance.
7. `reactivity-runtime` did not say where helpers are imported from, and fixtures sat inside `runtime-v2`'s paths. Applied: the import specifier and the remaining helpers are listed for the ADR; `runtime-v2` owns only `test/runtime/*.test.ts`.
8. Compiler ownership nested and `tsconfig.json` was uncovered. Applied: `compiler-core` owns named files and `analysis/**` only; `tsconfig.json` is shared with `switch-to-v2`; its verify adds lint and format checks.

Rejected: none. The lockfile warning stays: the file cannot be split, and GOAL.md records the merge order.
