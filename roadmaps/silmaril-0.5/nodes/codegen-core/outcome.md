# Outcome: codegen-core

## Built

- `packages/silmaril/compiler/codegen/`, a port of `proto/codegen.ts` onto the analysis API as built:
  - `index.ts`: `generate(s, model)`. One pre-order walk: declarations, write sites, calls (`rewriteCall`), then reads and renamed identifiers (`rewriteIdentifier`). After the walk: temps, imports, graphs.
  - `context.ts`: `GenerateContext`, `createContext`, `HELPERS` (export-table order), `useHelper`, `printGet`, `printSet`, `printSetOpen`, `takeTemp`, `needsParens`, `failUnsupported`.
  - `variables.ts`: `rewriteDeclaration`. Splits setup declarations, prints state, memos (identifier, function and destructuring), destructuring state, redeclares, the `{ }` wrap for a bare statement body, and redeclares in a `for` init.
  - `writes.ts`: `rewriteWrite`, `renamePattern`, `printSets`. Assignments, compound, logical, updates, destructuring (statement and expression forms) and for-in/of heads.
  - `entries.ts`: `rewriteSetup` (`$$`), `rewriteEntry` (`$sync`, `$`), `insertParam`.
  - `temps.ts`: `declareTemps`. One `let` per owner, the expression-bodied arrow block, and the class field arrow wrap.
  - `imports.ts`: `rewriteImports`, `emitGraphs`.
- `compiler/index.ts` calls `generate(s, model)`. `silmaril/compiler` now emits code.
- Tests in `packages/silmaril/test/compiler/codegen/`:
  - `fixtures.test.ts`: 36 fixtures compile to text equal to `output.js` (after the prototype's normalization: no comments, canonical graphs, oxfmt, blank lines dropped) and log `expected.json` on `src/v2`. 7 compile-error fixtures throw. 18 fixtures are in `WAITING_FOR_EXTRAS` and are checked to throw the "not supported" error.
  - `constructs.test.ts`: 13 tests for what no fixture covers: loop and `for` init redeclares, `for (var x of e)` heads, `var` pattern redeclares, the bare-body block wrap, split declarators around slots with no initializer, expression-bodied entry temps, compound/logical/update, TypeScript wrappers and a `this` parameter, arrow bodies that start with `{` (`{ n }.n`, `{ n } as const`, `{ n } satisfies T`), typed destructuring declarators, renamed helpers and temps, import merging, and the extras errors.
  - `sourcemap.test.ts`: 10 tests, one per construct (setup, state and reads, memo and function memo, destructuring memo, `$sync`/`$`, writes, destructuring, for-of, nested setup and redeclare, import).
  - `helpers.ts`: fixture loading, text normalization, the runner protocol, and `compileChecked`, which parses every compiled output again for its language. All codegen tests compile through it.
- `packages/silmaril/test/behavior/pipelines/compiler.ts`: pipeline `compiler` (compiler and `src/v2`, from source, `.ts` imports). All 67 + 1 cases run on it: 41 pass, 27 are `xfail: ['compiler']` waiting for codegen-extras. The 4 `limits` cases (0.4 known limits) pass on it.

### For codegen-extras

- Fill in the `failUnsupported` calls. There are four:
  - `codegen/entries.ts` `rewriteSetup`: `$composable`. Same edits as `$$` with `$$composable`.
  - `codegen/variables.ts` `openDeclarator`: `record.kind === 'store'`. The proto's store branch fits there (`lead` and `regionStart` are given, return the closing text).
  - `codegen/index.ts` `rewriteCall`: `$skip`, `onMount`, `onDestroy`.
- Then empty `WAITING_FOR_EXTRAS` in `test/compiler/codegen/fixtures.test.ts`, remove `WAITS_FOR_EXTRAS` from the 5 case files (`composable`, `destroy`, `mount`, `nested`, `store`), remove the `UNSUPPORTED` catch from `pipelines/compiler.ts`, and drop the last test of `constructs.test.ts`. The harness fails each of these the moment the construct compiles, so none can be forgotten.
- Waiting fixtures (18): composable, composable-glitch, composable-lifecycle, dispose-order, dispose-queued, effect-scope, error-in-rerun, lifecycle, memo-local-call, nested-composable, nested-root, nested-scope, setup-throws, skip, store-const, store-echo, store-let, store-writeback-batch.
- Waiting behavior cases (27): composable 5, destroy 5, mount 6, nested 4, store 7.

## Deviations

- `compiler/index.ts` (compiler-core): the `generate(s, model)` call and its import, as the brief allows.
- `test/compiler/analysis/compile.test.ts` (compiler-core): the test "leaves the text unchanged until code generation lands" asserted the stub. It now asserts the compiled text.
- `packages/silmaril/tsconfig.json`: `allowImportingTsExtensions: true`, so tsc accepts the `.ts` imports the brief asks for in the pipeline file. `noEmit` is already on.
- Two behavior cases stated 0.4 behavior that contract v4 changes. Both now state the 0.5 behavior and are `xfail: ['babel']`, with a comment naming the contract rule. **The orchestrator should confirm these and list them in the 0.5 changeset and decision record:**
  - `let`: "skips the effect when the written value is the same" did `set(1); set(0)` before one flush. v4 "Writes and phases": a queued `$` runs even if later writes put the old values back, so 0.5 logs twice. Split into the same-value case (passes on both) and "runs a queued effect even when a later write restores the value".
  - `nested`: "keeps the inner variable local to the nested effect". v4 "Reads": reads inside a nested entry do not count for the outer body, so writing `outer` reruns only the nested `$sync`, and it sees `inner` = 20. Logs `11, 21, 22`; 0.4 logged `11, 21, 12, 22`.
- Scope cut as instructed: `$store`, `$composable`, `onMount`, `onDestroy` and `$skip` throw `CompileError('<name> is not supported by the compiler yet.')`. The brief's "nested setups" pass where they use no extras (`nested-root-write`); `nested-root` and `nested-scope` use `onMount`/`onDestroy` and wait.
- Codegen choices the contract leaves open, for the new write sites of compiler-api v3:
  - A redeclare in a `for` init keeps its declaration: `for (var x = $$set($s, k, 5), j = 0; ...)`. `x` stays a dead local. A pattern there gets an extra declarator: `var [$t0, b] = e, $t1 = [$$set(...)]`.
  - A redeclare with a pattern in a statement keeps its `var`: `var [$t0, b] = e; $$set($s, k, $t0);`. The prototype dropped the `var`, which left a name without a slot (`b`) undeclared, a ReferenceError in a module.
  - `for (var x of e)` compiles like `for (x of e)`: `for (const $t0 of e) { $$set(...); ... }`. `for (var [a] of e)` keeps the `var` and its temps get no `let` (a `let` and a `var` of one name in a function is a SyntaxError).
- No change request.

## Stubs left

- The four `failUnsupported` calls and the waiting lists above. codegen-extras replaces them.

## Gotchas

- Temps that the code declares itself (`const $t0` in a loop head, temps inside a `var` pattern) go in `context.declaredTemps` and get no `let`. Pass `declared = true` to `takeTemp`/`renamePattern` for those.
- The behavior pipeline catches only the "not supported" CompileError and returns `log(<message>)`, so xfail sees a log mismatch, not an error. Other errors still throw.
- The fixture text test spawns `node_modules/.bin/oxfmt` twice per fixture (about 3 s for the file).
- A memo or expression entry whose source text starts with `{` gets `() => (...)`, not only a bare object literal. A sequence too.
- A destructuring declarator that becomes an assignment loses its TS type annotation (`let [a]: [number] = e` gives `[$t0] = e;`).
- For the docs: `type T = typeof n` naming a slot binding is left as written, because types are not walked. The output no longer declares `n`, so type-checking the compiled output would fail there. Types are erased before the code runs, so run time is not affected.
- `insertParam` puts the scope parameter after a TypeScript `this` parameter.
- Inside a `$sync` body, writes do not rerun other `$sync` bodies until the body returns. A test that writes from inside a body sees one run with both values.

## Proposed learnings

- Temps declared by the code (`const`/`var`) must not also get a `let` | a `let` and a `var` of one name in a function is a SyntaxError | `packages/silmaril/compiler/codegen/` | yes (`constructs.test.ts`)
- Behavior cases state 0.5 behavior and cite the contract rule when it differs from 0.4 | the changeset and decision record need every change from 0.4 | `packages/silmaril/test/behavior/cases/` | no

## Verification

- `pnpm --filter silmaril test` (the brief's `verify`): 24 files, 555 tests pass (121 in `test/compiler/codegen/`, 146 in `test/behavior/`).
- Fast check `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: passes.
- `pnpm format:check`: passes.
- No dependency added. Changeset `.changeset/silmaril-compiler-codegen-core.md` (patch: `silmaril/compiler` was added by an unreleased minor changeset, and this changes what it emits).

## Size

- Estimated L, actual M. The prototype passed every fixture's text and logs. The port needed types, the v3 redeclare sites and the tests.
