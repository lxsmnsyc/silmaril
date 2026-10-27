# Outcome: compiler-infra-spike

## Built

- `proto/` holds a throwaway prototype of `silmaril/compiler`. It is outside the pnpm workspace and has its own `package.json`. To run it: `npm install --prefix proto --no-package-lock`, then `node test.ts`, `node bench.ts` and `node browser/run.ts` inside `proto/`. The Babel baseline is loaded from `packages/silmaril/babel/index.ts`, so `pnpm install` must have run at the root.
  - `proto/scope.ts`: our own scope builder over oxc's ESTree AST (`analyzeScopes`, `createUidGenerator`). About 680 lines with comments.
  - `proto/compile.ts`: `parseModule`, `unwrap`, `visit`, `findSilmarilImports`, `findSetups`, `compile`, `CompileError`. It rewrites writes of setup variables into `_$$update(_ctx, ...)`, adds `let _ctx = _$$context();` and the hook import, and returns a magic-string map.
  - `proto/test.ts`: 13 checks, all pass.
  - `proto/bench.ts`, `proto/gen.ts`: the 2,000-line benchmark.
  - `proto/browser/`: a Vite page that runs `compile` in Playwright browsers.
- `proposed-compiler-api.md`: the proposed v2 of `contracts/compiler-api.md`. It has the internal analysis API and the answers to the three open points.

### Scope analysis: our own builder

- oxc-parser does not expose oxc's scopes or symbols to JS. `showSemanticErrors` only adds errors. So "oxc's own semantic data" is not an option today.
- periscopic is as fast (5.5 ms against 5.2 ms with parse), but it does not fit. It does not know TS: type names count as references, and enums, namespaces and type parameters are not declared. It also has no per-identifier resolution: it gives name sets per scope, so a second walk is needed to link each identifier to its declaration.
- Our builder does one walk. It declares bindings, records each reference with its scope, and resolves all references after the walk, so hoisted `var` and `function` resolve correctly. It skips every type-only key (`typeAnnotation`, `typeParameters`, `typeArguments`, `returnType`, `implements`, `superTypeArguments`) and every `TS*` node except the value wrappers, enums, namespaces, `import =` and `export =`.
- It was checked against Babel's `path.scope.getBinding` for every identifier of `proto/fixtures/tricky.tsx` (shadowing in blocks, catch, for heads, named function and class expressions, hoisting, destructuring defaults, TS wrappers, enums, namespaces, overloads, parameter properties, static blocks, JSX member tags, labels, private names) and of the generated 2,028-line file. The results match. The only differences are TS enums, namespaces and parameter properties: Babel does not register them, ours does. The test also checks that ours records every value reference that Babel sees.

### How each Babel feature is replaced

| Babel                                                  | Replacement                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope.getBindingIdentifier(name)`                     | `info.referenceOf.get(identifierNode)?.binding`. Compare `Binding` objects, not identifier nodes. `resolveName(scope, name)` for lookups without a node.                                                                                                                               |
| `scope.generateUidIdentifier(hint)`                    | `createUid(info.names)`. `names` holds every declared and referenced name in the module, globals included. It returns `_hint`, `_hint2`... and reserves each one.                                                                                                                      |
| `scope.crawl()` after edits                            | Not needed. The analysis runs once on the original AST, and magic-string edits only the text. Nothing reads the output back. Babel needed it because it changed `const` to `let` and inserted declarators into the AST.                                                                |
| `path.skip()`                                          | Not needed for edits, since inserted text is never walked. `visit` lets a callback return `false` to skip the children. The `/*$skip*/` markers on generated nodes go away. The user's `$skip` comment becomes `hasSkipComment(module, node)` over `result.comments` (not prototyped). |
| `path.replaceWith(f(ctx, node))`                       | `appendLeft(start, 'f(ctx, ')` and `prependRight(end, ')')`, outer nodes first.                                                                                                                                                                                                        |
| `insertBefore` / `insertAfter` / `unshift` into a body | `appendLeft` / `appendRight` at the right offset, such as `body.start + 1`.                                                                                                                                                                                                            |
| `addNamed` (helper-module-imports)                     | A map from hook name to a local name from `createUid`, then one `import { ... } from 'silmaril'` added at the top.                                                                                                                                                                     |
| `getFunctionParent()`                                  | `reference.scope.functionScope`, or comparing with `setup.scope`.                                                                                                                                                                                                                      |
| `unwrapNode`                                           | `unwrap(node)` over `ParenthesizedExpression` (with `preserveParens: true`) and the TS wrappers.                                                                                                                                                                                       |

### Measured numbers

The input is a generated TSX file of 2,028 lines (43 KB) with 45 setups. Apple M2, Node 26.12.1, other agents running (load average 14 to 26), so the absolute times are noisy. Median of 50 runs after 10 warm-up runs, from the last of three runs:

| Step                                                     | Median                                |
| -------------------------------------------------------- | ------------------------------------- |
| Babel parse                                              | 3.8 ms                                |
| Babel parse + scope crawl                                | 32.4 ms                               |
| Babel silmaril plugin (parse, transform, generate, map)  | 221 ms (565 to 583 ms in busier runs) |
| oxc `parseSync` + reading `program`                      | 3.9 ms                                |
| oxc parse + `analyzeScopes`                              | 5.2 ms                                |
| `analyzeScopes` alone                                    | 1.1 ms                                |
| oxc parse + periscopic                                   | 5.5 ms                                |
| Prototype `compile` (parse, analysis, magic-string, map) | 7.4 ms                                |

- Parse plus analysis is about 6x faster than Babel's parse plus scope crawl. The full prototype compile is about 30x faster than the Babel plugin. That plugin does less than the full codegen will do, so treat the 30x as an upper bound.
- The Babel plugin grows faster than linear: 14 ms at 250 lines, 31 ms at 500, 69 ms at 1,000, 255 ms at 2,000.
- `experimentalRawTransfer: true` parses the same file in 1.0 ms instead of 5.9 ms in Node. It is not available on wasm. It is an option for `compiler-core` later, behind a check of `rawTransferSupported()`.

### Browser and wasm result: works

- `compile` ran in Chromium and WebKit (Playwright 1.64.1) from a Vite 8 production build. It gave the same output as Node (9 wrapped writes on `tricky.tsx`, a v3 map).
- Both bindings work, with and without cross-origin isolation:
  - `@oxc-parser/binding-wasm32-wasip1`: the name `oxc-parser`'s `browser` export imports. No alias needed. This is the recommended one.
  - `@oxc-parser/binding-wasm32-wasi`: the threaded binding the brumate website uses, through an alias under the wasip1 name.
- Loading took 50 to 140 ms. The compile of the 2,000-line file took 6 to 17 ms (median). The wasm file is 1.48 MB (488 KB gzip). The JS chunk with the compiler, oxc's deserializer and magic-string is 285 KB minified.
- Firefox could not start in this sandbox ("Could not find profile folder"), so it is not tested.

### Answers to the three open points of the contract

1. **Async loading of the wasm binding**: no `init()` and no async `compile`. The binding module fetches and instantiates the wasm with a top-level await, so `await import('silmaril/compiler')` (or a static import in an ES module graph) is the async step. `compile` stays synchronous everywhere.
2. **Source map type**: silmaril exports its own `SourceMap` interface `{ version, file?, sources, sourcesContent?, names, mappings }`. The value is magic-string's `SourceMap` instance, which also has `toString()` and `toUrl()`. It is assignable to unplugin's `SourceMapCompact` without a cast, and the public `.d.ts` does not name magic-string.
3. **tsdown platform of the `compiler` entry**: `neutral`, with no `node:` imports in `compiler/`. `oxc-parser` stays external so the consumer's bundler picks its `browser` export. Fallback if two tsdown configs do not work with `exports: true`: one config with `platform: 'node'`, which also works as long as `compiler/` has no Node imports.

## Deviations

- The brief asked for the proposal "in this file" (`contracts/compiler-api.md`). Following the worker instructions and the roadmap rules, it is in `nodes/compiler-infra-spike/proposed-compiler-api.md` instead. The contract is unchanged.
- The prototype only rewrites writes (`$$update`). `$`, `$sync`, `onMount`, `onDestroy`, `$store`, derived values and `const` to `let` are codegen work and were not prototyped. The `$skip` comment was not prototyped.
- Nested writes behave differently from Babel: `x = y = 1` wraps both writes. The Babel plugin wrapped only the outer one. codegen should keep the new behavior, or say why not.

## Stubs left

- None in the package. `proto/` is throwaway. `compiler-core` should copy `proto/scope.ts` and the checks in `proto/test.ts` into `packages/silmaril/compiler/` and `packages/silmaril/test/compiler/`, then type them with `@oxc-project/types` (the prototype uses a loose `Node = any`).

## Gotchas

- `@napi-rs/wasm-runtime@1.2.6` declares the peers `@emnapi/core` and `@emnapi/runtime` as `^1.7.1 || 2.0.0-beta.2`. The oxc 0.155 bindings pin `2.0.0-alpha.6`, which is outside that range. The package manager then installs emnapi 1.11.3 for the runtime, and the browser load fails with `TypeError: this.bridge.setLastError is not a function`. Fix: an override `"@napi-rs/wasm-runtime": "1.2.5"` (pnpm: `overrides` in `pnpm-workspace.yaml`). This hits every browser page (`website-skeleton`, `runnable-samples`). Verified with and without the override.
- The browser page must depend on `@oxc-parser/binding-wasm32-wasip1` at the same version as `oxc-parser`. `oxc-parser` does not list any wasm binding as optional. In Vite, add `oxc-parser` and the binding to `optimizeDeps.exclude`, and use a build target that allows top-level await.
- `parseSync(...).program` is a lazy getter that builds the JS objects. Benchmarks that do not read it measure only the Rust parse.
- Pass `sourceType: 'module'`. Without it, a file with no import is parsed as a script.
- Use `preserveParens: true` so `(x as number) = 1` and `({ a } = b)` have a node to wrap. `unwrap` must then see through `ParenthesizedExpression`.
- oxc offsets are UTF-16 code units, the same as magic-string. Non-ASCII text does not shift edits (tested).
- `<T>x` is a type assertion only in `.ts`. In `.tsx` it is a parse error. The language must come from the filename.
- In oxc's AST, a shorthand property `{ a }` has `key` and `value` as two different objects with the same span. Walk only `value`.
- A `this` parameter (`function f(this: Window)`) appears as an `Identifier` named `this` in `params`. Skip it.
- magic-string 1.x exports `MagicString` as a named export (the default export still works, but oxlint warns).
- The root `oxlint` run lints `roadmaps/**` too. Test fixtures with odd code need a file-level `oxlint-disable`.

## Proposed learnings

- Analyze once, edit text, never re-read the output | magic-string does not update the AST, so a second analysis would see stale offsets | `packages/silmaril/compiler/` | no
- `compiler/` must not import `node:*` | it must run in the browser through the wasm binding | `packages/silmaril/compiler/` | yes (grep test)
- Generated names come from `createUid` over all module names | avoids collisions with locals and globals | `packages/silmaril/compiler/` | yes
- Browser pages that run the compiler pin `@napi-rs/wasm-runtime` until the oxc bindings and the runtime agree on emnapi | the load fails otherwise | `website/`, samples | yes (a browser smoke test)

## Verification

- `node test.ts` in `proto/`: 13 checks pass (TS and TSX parse, Babel differential on two files, recorded references, shadowing, writes rewritten, snapshot cases, name collisions, UTF-16 offsets, no-silmaril passthrough, error location, source map round trip of every identifier on two files).
- `node bench.ts` in `proto/`: the numbers above.
- `node browser/run.ts` in `proto/`: Chromium and WebKit pass with both bindings, with and without COOP/COEP. Firefox does not launch here.
- Fast check from `GOAL.md` at the repo root: `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint` passes (20 tests). `pnpm lint` reports nothing in this node folder.
- No change to `packages/`, the root `package.json` or `pnpm-lock.yaml`.

## Size

- Estimated M, actual M. The emnapi version mismatch in the browser took the most time.
