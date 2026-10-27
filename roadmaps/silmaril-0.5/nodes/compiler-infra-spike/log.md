# Log: compiler-infra-spike

- Reset the worktree to `origin/roadmap` (106c75a). Renamed the branch to `spike/compiler-infra-spike`.
- Nothing existed yet: no `compiler/` folder, no oxc dependency. Work needed.
- Prototype lives in `proto/`, installed with `npm install --prefix proto --no-package-lock`. The folder is outside the pnpm workspace globs (`packages/*`, `examples/*`). `node_modules/` and `browser/dist-*/` are ignored.
- Versions picked older than a day: oxc-parser 0.155.0 (0.156.0 is from today), magic-string 1.4.4, playwright 1.64.1 (its Chromium was cached), vite 8.3.5.
- oxc-parser does not expose scopes or symbols to JS. `showSemanticErrors` only adds errors. So the choice is periscopic or our own builder.
- Wrote `proto/scope.ts`, a one-walk scope builder that skips types. References resolve after the walk, so hoisting works.
- Differential test against Babel's `scope.getBinding` on `fixtures/tricky.tsx` and a generated 2,028-line TSX file. Differences left: TS enums, namespaces and parameter properties, which Babel does not register. Ours does. `declare const` now declares a binding, like Babel.
- `program` from `parseSync` is a lazy getter. The first bench measured parse without it and looked 3x too fast. Fixed.
- The Babel plugin grows faster than linear: 14 ms at 250 lines, 69 ms at 1,000, 255 ms at 2,000 (nested `path.traverse` and `scope.crawl()` per setup).
- Browser: the first run failed with `this.bridge.setLastError is not a function`. Cause: `@napi-rs/wasm-runtime@1.2.6` declares the peer `@emnapi/core ^1.7.1 || 2.0.0-beta.2`, which excludes the `2.0.0-alpha.6` that the oxc bindings pin. npm then nests emnapi 1.11.3 and the two halves do not match. Pinning `@napi-rs/wasm-runtime` to 1.2.5 fixes it. Checked both ways.
- `@oxc-parser/binding-wasm32-wasip1` exists and is what `oxc-parser`'s browser entry imports by name. It needs no alias and no cross-origin isolation. The threaded `-wasi` binding (brumate's choice, through an alias) also works without isolation in Chromium and WebKit.
- Firefox did not launch in this sandbox ("Could not find profile folder"). Not tested.
- oxc offsets are UTF-16, so magic-string edits line up with non-ASCII text. Added a test.
- Lint: the fixture has a file-level `oxlint-disable`. Ran oxfmt on the node folder.
