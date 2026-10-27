# Outcome: compiler-infra-spike

## Built

- `proto/` holds a throwaway prototype of `silmaril/compiler` for the 0.5 runtime. It is outside the pnpm workspace and has its own `package.json`. To run it, inside `proto/`: `npm install --no-package-lock`, then `node fetch-pr8.ts` (copies the PR #8 fixtures and sketch runtime into the ignored `.pr8/`; not needed once PR #8 has merged), then `node test.ts`, `node fixtures.test.ts`, `node bench.ts` and `node browser/run.ts`. The Babel baseline and oxfmt are loaded from the repository root, so `pnpm install` must have run there.
  - `proto/source.ts`: `CompileError`, `parseModule`, `unwrap`, `visit`, `findSilmarilImports`.
  - `proto/scope.ts`: the scope builder over oxc's ESTree AST, with `Reference.context` and the fixes of the design review (below).
  - `proto/model.ts`: the reactive model of `reactivity-runtime` v3: `ReactiveScope` tree, slots, entries, reads, graphs, write sites, `$skip` calls, scope bindings, names and compile errors.
  - `proto/codegen.ts`: the code generator, from the model only, with the edit rules of the contract.
  - `proto/compile.ts`: `compile` and `ready`.
  - `proto/test.ts`: 30 checks. `proto/fixtures.test.ts`: the PR #8 fixtures.
  - `proto/bench.ts`, `proto/gen.ts`, `proto/browser/`: benchmark and browser run, now on the new compiler.
- `proposed-compiler-api.md`: the proposed v2 of `contracts/compiler-api.md`, rewritten against `reactivity-runtime` v3 (PR #8, 937424c).

## What changed after the design review

The design review of PR #9, and where each item went:

1. Analysis had no reactivity model (blocking). The contract now has the computed model: `ReactiveScope` (roots, composables, entry bodies, memo and expression children), `Slot`, `SlotDeclarator`, `Entry` (id, kind, output slot, reads, child), graphs with path refs, `slotOf`, and the order of the steps that compute them. Reads follow local helpers (direct, transitive, recursive, `f?.()`), skip nested entries, `$skip` and nested setups, and apply the child-memo rule of `body-memo`. A written top-level `let` helper has a slot, so it is a read, not a helper.
2. `Setup` was the wrong unit (blocking). Replaced by the `ReactiveScope` tree. Function-bodied `$` and `$sync` own slots, entries and lifecycles. A nested `$$` or `$composable` is a separate tree with `parent: null`, and graph edges stop at it. `ScopeBinding` records which scope parameter each `onMount`/`onDestroy` binds to (the nearest reactive scope node, an expression entry or memo included), and the scope of each local composable call (no edit needed: the runtime uses the running scope).
3. Compile errors and `$skip` (blocking). `$skip` is a tracked name, its calls are in `model.skips`, and reads inside them are not tracked. Every error of the runtime contract's table is raised in analysis, with the step that raises it. The checks run whenever a compile-time name is imported, even with no setup. The `/* $skip */` comment is an error (decided in PR #8).
4. Overwrites (should-fix). The wrap rule is replaced by an edit discipline: `update` instead of `overwrite`, no overlapping ranges, each identifier edited once, a write owns its target and operator range, `appendLeft` at a node's start and `prependRight` at its end, `prependLeft`/`appendRight` for a late wrap. Both magic-string traps are reproduced in `test.ts`. `Reference.context` (`plain`, `shorthand`, `jsx`, `export`) tells codegen how to print a replaced read.
5. Destructuring and for-in/of (should-fix). `WriteSite` has the kind, the pattern node, the slotted targets in source order, the statement flag and the function that declares the temps. The in-place form with per-site temps is prototyped, defaults that read an earlier target included. `for (x of e)` compiles to the runtime contract's form. `for (P of e)` uses an in-place form (change request below).
6. Public API, wasm and tsdown (should-fix). `ready(): Promise<void>` is exported as a no-op. `SourceMap.file` names the generated file. `oxc-parser` is pinned exactly and the wasm binding is an optional peer at the same version. One tsdown config with `platform: 'node'`, plus a test that `compiler/` has no `node:` import.
7. Scope builder (should-fix). A `params` scope when parameters have expressions (`function f(a = x) { let x }` now reads the outer `x`; Babel gets it wrong). Qualified namespaces (`namespace A.B`) declare `A` and walk the body. Expression-bodied setups compile (`$$(() => expr)` to `$$root($g0, ($s) => expr)`, as the runtime contract allows). `childNodes` and `visit` skip type keys, visit a shorthand property once and follow source order. `<this.Foo />` records no reference. `test.ts` now checks `read`, `write`, `writeExpression` and `context`, not only resolution.
8. Nit. `x = y = 1` gives two disjoint edits, `$$set($s, 0, $$set($s, 1, 1))` (fixture `chained-write` matches). The import rewrite follows the runtime contract. Graph constants go after the last import. File names match the owned paths of compiler-core and the codegen nodes.

## What the prototype now proves

Against the 45 fixtures of PR #8 (`node fixtures.test.ts`):

- **Model: 41 of 41** fixtures with an `output.js`. For each, the slots, the entries (kind, id, output slot, in source order) and every graph of the model equal the ones `output.js` encodes. Graphs are compared as sets, without trailing empty lists. The comment numbering of each `input.js` is the same numbering.
- **Compile errors: 4 of 4** (`entry-in-function`, `loop-entry`, `memo-writes-slot`, `skip-comment`) throw the expected message.
- **Logs: 41 of 41.** The compiled `input.js`, run on the sketch runtime with the contract's runner protocol, logs `expected.json`.
- **Text: 38 of 41.** The compiled `input.js` equals `output.js` after removing comments, writing graph lists in canonical order without trailing empty lists, and formatting both with oxfmt. This includes the three with the most overwrites: `nested-scope`, `update-expression` and `destructure-assign` (in-place destructuring with defaults that read an earlier target, rest elements, a member target, both the expression and the statement form, and a destructuring declarator), plus `compound-assignment`, `chained-write`, `memo-destructure`, `order`, `var-slot`, `store-let` and the rest. The three that differ:
  - `composable`, `composable-glitch`: the fixture numbers the composable's graph `$g1` and the root's `$g0`, against source order. Only the names differ.
  - `for-of-slot`: the pattern loop uses the in-place form (change request below).

Other checks in `node test.ts` (30, all pass): the Babel differential and recorded references on `tricky.tsx` and the 2,028-line file, the scope fixes of finding 7, read and write flags, every compile error of the table, reads through helpers and child memos, scope bindings, the overwrite cases (`x *= a + b`, logical, chained, destructuring with a default), the magic-string traps, the import rewrite (alias, kept `tick` and `type Store`, namespace import left as is), generated names next to user names `$s`, `$$get` and `$t0`, UTF-16 offsets, the source map of every kept identifier, and no `node:` import in the compiler files.

### Measured numbers

Generated TSX file of 2,028 lines (43 KB) with 45 `$composable` setups. Apple M2, Node 26.12.1, load average about 2.6. Median of 50 runs after 10 warm-up runs:

| Step                                                        | Median  |
| ----------------------------------------------------------- | ------- |
| Babel parse + scope crawl                                   | 12.7 ms |
| Babel silmaril 0.4 plugin (parse, transform, generate, map) | 175 ms  |
| oxc `parseSync` + reading `program`                         | 3.2 ms  |
| oxc parse + `analyzeScopes`                                 | 4.1 ms  |
| oxc parse + `analyzeScopes` + reactive model                | 8.9 ms  |
| Prototype `compile` (parse, analysis, full v2 codegen, map) | 13.9 ms |

- The full 0.5 compile is about 12x faster than the 0.4 Babel plugin, and does more (memos, entries, graphs, temps).
- The model costs about 4.8 ms here, because the prototype walks each initializer again in every round of the slot fixed point. `compiler-core` can cache the direct reads per node and only redo the reachability.
- In the browser (Vite 8 build, Playwright 1.64.1), the new compiler runs in Chromium and WebKit with both wasm bindings, with and without cross-origin isolation: 11 to 14 ms per compile of the same file, 26 to 64 ms to load. Firefox still does not launch in this sandbox.

## What compiler-core and the codegen nodes must know

- Copy `proto/source.ts`, `scope.ts` and `model.ts` into `compiler/` as laid out in the contract, then type them with `@oxc-project/types`. Copy `codegen.ts` into `codegen/`. Port `test.ts` and `fixtures.test.ts`.
- Use `!ref.write`, not `ref.read`, for the runtime's reads: `x += 1` is a JS read but not a runtime read.
- The analysis covers the extras too: `$store` slots and write-backs, lifecycle bindings, `$skip` and their errors. `codegen-extras` only prints them.
- Always edit with `update`. `overwrite` and `remove` drop the inserts of outer nodes at the same offsets.
- Edit in one pre-order walk, outer nodes first. Take the right-side temp of a destructuring expression before the target temps, so the numbering matches the fixtures.
- A destructuring write that is a statement uses the statement form only when its statement is in a statement list. `if (c) [a, b] = e;` needs the expression form, or the writes leave the `if`.
- A memo initializer or an expression entry that is an object literal or a sequence needs parentheses after `() =>`.
- magic-string makes `sources` relative to `file`. Pass the module path as both.
- Compare fixture text after normalizing graph list order and trailing empty lists, or compare logs. The fixtures are not consistent on either (below).

## Change requests for the runtime contract (PR #8)

None of the contract is impossible to compile. These are gaps and small inconsistencies found while making all 41 fixtures pass:

1. **Rule 1 of "Slots" says "written anywhere in the setup tree".** The setup tree excludes nested `$$`, but `nested-root-write` needs `outer` to get a slot from a write inside a nested `$$`. Say "anywhere in the module" (any write reference of the binding). The prototype does that.
2. **A write-back reads its own slot.** The graphs list it (`store-let`: `[[0, 1, 2]]`, `composable`: `[[0, 1], [2]]`), but "Reads" does not say so.
3. **Graph list order in `nested-scope`.** `$g0 = [[[0, 0], 1]]` puts a path before a number, against "numbers ascending, then paths". Write `[[1, [0, 0]]]`.
4. **Trailing empty lists.** `nested-root` writes `$g0 = [[]]`, while `child-memo-wasted` and `compound-assignment` leave them out. Pick one for the fixtures. The prototype leaves them out.
5. **`for (P of e)` with a pattern.** The contract's form `for (const $t0 of e) { P' = $t0; ... }` moves the pattern into the body, which needs `MagicString.move`. Allow the in-place form `for (P' of e) { $$set(...); ...; body }` with the targets' temps in the function's `let`. It is equivalent and needs no move.
6. **Errors missing from the table**: `$$` or `$composable` with an argument that is not one function, and a slot used as a JSX tag (`<Comp />` where `Comp` has a slot). A JSX tag cannot be a call, so the second has no compiled form. The prototype throws `<name> must be called with a function.` and `A reactive variable cannot be used as a JSX tag.`
7. **Local functions and writes.** "A declarator ... that has no slot" lets a written `let f = () => ...` inside a nested block count as a local function, so the reads of its first value are added. Consider treating any written binding as opaque. The prototype follows the contract as written.
8. **Merged import.** "Imports" says the compiler adds one new declaration before the first statement, but the fixtures (`order`, `store-let`) merge the helpers into the user's import: `import { $$root, ..., tick } from 'silmaril'`. Allow both. The prototype merges.
9. **Object literal or sequence initializers.** The table shows `$$memo($s, n, k, () => e)`. Add that `e` is parenthesized when it is an object literal or a sequence.

## Deviations

- The brief asked for the proposal in `contracts/compiler-api.md`. It is in `nodes/compiler-infra-spike/proposed-compiler-api.md` instead, following the roadmap rules. The contract is unchanged.
- The prototype went past the brief: it is a full code generator for the runtime contract, because the review asked to prove the edit pattern with overwrites on real fixtures.
- `gen.ts` and `fixtures/tricky.tsx` now use `$composable((props) => ...)` instead of `$$((props) => ...)`: a 0.5 root setup takes no arguments.

## Stubs left

- None in the package. `proto/` is throwaway. The prototype types nodes as `any`.
- The JSX-tag case throws in codegen. compiler-core should raise it in analysis.

## Gotchas

- `@napi-rs/wasm-runtime@1.2.6` declares the peers `@emnapi/core` and `@emnapi/runtime` as `^1.7.1 || 2.0.0-beta.2`. The oxc 0.155 bindings pin `2.0.0-alpha.6`, which is outside that range. The package manager then installs emnapi 1.11.3 for the runtime, and the browser load fails with `TypeError: this.bridge.setLastError is not a function`. Fix: an override `"@napi-rs/wasm-runtime": "1.2.5"` (pnpm: `overrides` in `pnpm-workspace.yaml`). This hits every browser page (`website-skeleton`, `runnable-samples`).
- The browser page must depend on `@oxc-parser/binding-wasm32-wasip1` at the same version as `oxc-parser`. In Vite, add `oxc-parser` and the binding to `optimizeDeps.exclude`, and use a build target that allows top-level await.
- `parseSync(...).program` is a lazy getter that builds the JS objects. Benchmarks that do not read it measure only the Rust parse.
- Pass `sourceType: 'module'` and `preserveParens: true`. `unwrap` must then see through `ParenthesizedExpression`.
- oxc offsets are UTF-16 code units, the same as magic-string.
- `<T>x` is a type assertion only in `.ts`. In `.tsx` it is a parse error. The language must come from the filename.
- In oxc's AST, a shorthand property `{ a }` has `key` and `value` as two objects with the same span. Walk only `value`.
- `for...in` over an oxc node is not source order for every node type. Sort children by `start`.
- A `this` parameter appears as an `Identifier` named `this` in `params`. Skip it. `<this.Foo />` has a `JSXIdentifier` named `this`.
- magic-string's `generateMap` keeps only the base name of `file`, and makes `sources` relative to it.
- magic-string 1.x exports `MagicString` as a named export.
- The root `oxlint` run lints `roadmaps/**` too. Test fixtures with odd code need a file-level `oxlint-disable`.

## Proposed learnings

- Analyze once, edit text, never re-read the output | magic-string does not update the AST, so a second analysis would see stale offsets | `packages/silmaril/compiler/` | no
- Edit with `update`, never `overwrite` or `remove` | they drop inserts made by outer nodes at the same offsets | `packages/silmaril/compiler/codegen/` | yes (fixture text tests)
- Runtime reads are references with `!write`, not `read` | `x += 1` is a JS read but not a graph edge | `packages/silmaril/compiler/analysis/` | yes (fixture model tests)
- `compiler/` must not import `node:*` | it must run in the browser through the wasm binding | `packages/silmaril/compiler/` | yes (grep test)
- Browser pages that run the compiler pin `@napi-rs/wasm-runtime` until the oxc bindings and the runtime agree on emnapi | the load fails otherwise | `website/`, samples | yes (a browser smoke test)

## Verification

- `node test.ts` in `proto/`: 30 checks pass.
- `node fixtures.test.ts` in `proto/`: 45 fixtures, 0 failures (model 41, logs 41, text 38, compile errors 4).
- `node bench.ts` in `proto/`: the numbers above.
- `node browser/run.ts` in `proto/`: Chromium and WebKit pass with both bindings, with and without COOP/COEP.
- At the repository root: `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check` passes.
- No change to `packages/`, the root `package.json` or `pnpm-lock.yaml`.

## Size

- Estimated M, actual M for the first round. The revision was another M: the model and the code generator.
