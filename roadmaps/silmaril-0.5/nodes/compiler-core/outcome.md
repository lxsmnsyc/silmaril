# Outcome: compiler-core

## Built

- `silmaril/compiler` entry (`packages/silmaril/compiler/index.ts`, built to `dist/compiler.mjs` with types): `compile(code, { filename, sourcemap? })`, `ready()`, `CompileError`, and the types `CompileOptions`, `CompileResult`, `SourceMap`, `SourceLocation`. `compile` returns `{ code, map: null }` when the module has no named import of a compile-time name from `'silmaril'`. Otherwise it runs the whole analysis (every compile error) and returns the input unchanged with a magic-string map (`file` and `sources` are the base name of `filename`). There is no codegen call yet.
- `compiler/errors.ts`: `CompileError` (`loc` 1-based line and 0-based UTF-16 column, `frame`, message ends in `(line:column)`).
- `compiler/source.ts`: `parseModule`, `getLang`, `ParsedModule`, `Lang`. `.js`, `.mjs` and `.cjs` parse as JSX.
- `compiler/analysis/`, as laid out in `contracts/compiler-api.md` v2:
  - `walk.ts`: `unwrap`, `isWrapper`, `childNodes`, `visit`, plus `climbWrappers(parentOf, node)` and `isCallee(parentOf, node)`.
  - `scope.ts`: `analyzeScopes`, `resolveName`, `createUid`, `isFunctionNode`, and the `Scope`, `Binding`, `Reference`, `ScopeInfo` types.
  - `imports.ts`: `findSilmarilImports`, `SOURCE_MODULE`, `TrackedName`, `SilmarilImports`.
  - `model.ts`: `analyzeModel`, every model type of the contract, plus `TempOwner`, `getBlockBody(scope)` (the statements of a block-bodied scope body, or null) and `pickPrefix(names)` (the `$`, `$_`... prefix of generated names). `AnalysisContext` and `SlotCandidate` are internal.
  - `reads.ts`: `collectReads` (the contract's `readsOf`), `findLocalFunction`, `findMemos` (slot rule 2 to a fixed point), `computeEntryReads`, `findEnclosingSetup`, `findTree`.
  - `writes.ts`: `findWriteSites`.
  - `checks.ts`: the compile errors not raised by other steps, and `fail`.
  - `index.ts`: `analyzeModule(code, filename): ModuleModel | null`.
- Nodes are typed with the AST types that `oxc-parser` re-exports from `@oxc-project/types` (`import type { Node, CallExpression } from 'oxc-parser'`). No `any` in `compiler/`.
- Tests in `packages/silmaril/test/compiler/analysis/` (168 tests):
  - `fixtures.test.ts`: model half of the runtime fixtures. 55 fixtures with an `output.js` match (slots, entries with kind, id and output slot, graphs), and 7 compile-error fixtures throw their message. `namespace-root` has no named import: the model is null and nothing is registered.
  - `scope.test.ts`: Babel differential and recorded references on `tricky.tsx.txt` and a generated 2,000-line file, shadowing, hoisting, parameter scopes, TS declarations, JSX references, reference contexts, read and write flags, `resolveName`, `names`, `createUid`, `visit` order.
  - `model.test.ts`: aliased imports, shadowed names, namespace imports, destructuring patterns, TS wrappers, `$store`, redeclared `var`, nested setups, entry bodies with path refs, local helpers (direct, transitive, recursive, optional call, reassigned), opaque helpers, child memos, `$skip`, scope bindings, generated names, write sites.
  - `errors.test.ts`: every row of the contract's error table, with the message, the line and the text at the column. Also aliased names, parse errors and UTF-16 columns.
  - `compile.test.ts`: the public API. `no-node-imports.test.ts`: no file under `compiler/` imports `node:` or `@babel/`.

### For codegen-core

- Call site: in `compiler/index.ts`, between `const s = new MagicString(code);` and the return, add `generate(s, model);` and its import from `./codegen/index`. That is the only edit codegen needs outside `codegen/`. `compiler/index.ts` is owned by compiler-core, so codegen-core records that one-line edit as a deviation.
- Use `!ref.write`, never `ref.read`, for runtime reads.
- `WriteSite.fn` is a `TempOwner`: a function, an arrow, or a `PropertyDefinition`/`AccessorProperty` for a class field value (change request below). Check `fn.type` before reading `body`.
- A function memo's initializer is not in the scope map for lifecycle binding: `onMount` inside `const f = () => { onMount(g); }` binds to the scope around the memo (spike change request 4, kept as the prototype did it).
- `onMount` and `onDestroy` with other than one argument fail with `<name> takes exactly one argument.`, as in the prototype. The contract's table does not list this row.
- `model.scopes` holds memo and expression child scopes too (`isBody: false`). A scope's `graph` is null unless it is a setup or a body with slots. `graphName` is set exactly when `graph` is not null, numbered in source order of the scope nodes.
- Generated temp names (`$t0`...) are not picked by the analysis. `pickPrefix(info.names)` gives the scope prefix. The temp prefix rule ("the prefix gets `_` until no user name is the prefix plus digits") is for codegen.

### Opaque helpers (for the docs)

Reads are followed into a called function only when it is a local function of the same setup tree: a `function` declaration, or a `let`/`const`/`var` with an identifier and a function or arrow initializer, declared inside the setup, never written and with no slot. Every other call is opaque, and the reads inside it are not tracked:

- imported functions, and functions declared outside the setup (module level, another setup);
- parameters (`param()`), member calls (`obj.read()`), calls through a namespace import;
- a written binding (`let f = () => a; f = ...`): it has a slot, so the call reads the slot `f`, not what `f` reads (fixture `written-function`);
- a function initializer that reads a slot is a memo (`const handler = () => count`), so calling it reads the memo's slot.

Reads inside nested plain functions are followed (`$sync(() => [1].map(() => a))` reads `a`). Reads inside `$skip(...)`, nested entries and nested setups are not.

## Deviations

- Imports inside `compiler/` have no `.ts` extension, as in the rest of the package.
- `@oxc-project/types` is not a dependency: `oxc-parser` re-exports the types, and the public `.d.ts` names no AST type.
- Extra exports beyond the contract: `isWrapper`, `climbWrappers`, `isCallee` (walk), `isFunctionNode` (scope), `SOURCE_MODULE` (imports), `TempOwner`, `getBlockBody`, `pickPrefix`, `AnalysisContext`, `SlotCandidate` (model), `SourceLocation` (errors and the public entry). The contract's `readsOf` is `collectReads`.
- `createUid` returns Babel-style `_hint`, `_hint2`... names, as the prototype's `createUidGenerator` did. The contract's "Names" rules (`$s`, `$c0`, `$g0`, `$t0`) are computed by `analyzeModel` and `pickPrefix`, not by `createUid`.
- The Babel differential in `scope.test.ts` loads `@babel/core` by a computed name and is skipped when it cannot load. `switch-to-v2` can remove Babel without touching this test.
- `tricky.tsx` is stored as `test/compiler/analysis/fixtures/tricky.tsx.txt`, so `tsc` (the `test` include) and oxfmt do not process it.

## Stubs left

- `compile` returns the input unchanged after the analysis. `codegen-core` adds the `generate(s, model)` call in `compiler/index.ts`.

## Gotchas

- Dependencies added (lockfile changed): `oxc-parser` `0.155.0` (exact), `magic-string` `^1.4.4` (1.4.4), and the optional peer `@oxc-parser/binding-wasm32-wasip1` `0.155.0`. `benchmark-harness` regenerates `pnpm-lock.yaml` after this merges.
- The lockfile resolves `@napi-rs/wasm-runtime@1.2.6` as a dependency of the wasm bindings. Browser pages need the `1.2.5` override (spike outcome). No override was added here: Node.js does not load the wasm binding.
- oxlint `import/no-cycle` is an error, type-only cycles are allowed. `reads.ts`, `writes.ts` and `checks.ts` import only types from `model.ts`, and `fail` lives in `checks.ts` for that reason. Codegen modules that import values from each other must keep a DAG.
- The vitest lint rules apply to tests: no conditional `expect`, a message for `toThrow`, string titles (`it(\`fixture ${name}\`)`), and at least one assertion per test.
- The slot fixed point re-walks each initializer per round (as the prototype did). No caching was added, and this node measured no numbers.

## Proposed learnings

- Runtime reads are references with `!write`, not `read` | `x += 1` is a JS read but not a graph edge | `packages/silmaril/compiler/analysis/` | yes (fixture model tests)
- `compiler/` imports no `node:` module and no `@babel/` package | it must run in the browser, and 0.5 drops Babel | `packages/silmaril/compiler/` | yes (`no-node-imports.test.ts`)
- Analysis modules import only types from `model.ts` | oxlint `import/no-cycle` fails on value cycles | `packages/silmaril/compiler/analysis/` | yes (lint)

## Verification

- `pnpm --filter silmaril test` (the brief's `verify`): 19 files, 249 tests pass (168 in `test/compiler/`).
- Fast check `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`: passes.
- `pnpm format:check`: passes.
- `dist/compiler.mjs` imports only `magic-string` and `oxc-parser`. `dist/compiler.d.mts` names no AST or magic-string type.
- No `@babel/*` import under `compiler/` (test and grep).

## Size

- Estimated L, actual M. The prototype ported with few changes. Typing it with the oxc AST types took most of the time.
