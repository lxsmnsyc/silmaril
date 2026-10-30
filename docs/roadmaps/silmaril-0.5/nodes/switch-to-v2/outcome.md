# Outcome: switch-to-v2

## Built

- `packages/silmaril/src/index.ts` is the runtime of contract `reactivity-runtime` v4 (moved from `src/v2/index.ts`). The 0.4 runtime and `src/v2/` are gone. `silmaril/solid` imports `Store` from it; the interface is unchanged.
- `packages/silmaril/unplugin/index.ts` calls `compile` from `silmaril/compiler`. The `babel` option is gone. It returns `undefined` when the module imports no compile-time name. The compiler gets the id without its query when the path ends in a JS or TS extension. Otherwise the extension that ends the full id is appended (`/a.vue?vue&lang.ts` compiles as `/a.vue.ts`), as 0.4 read `lang.ts` from the full id. The source map then names `a.vue.ts`.
- Removed: `packages/silmaril/babel/`, `test/compiler.test.ts`, `test/__snapshots__/compiler.test.ts.snap`, `test/behavior/pipelines/babel.ts`, the `xfail: ['babel']` markers (`let`, `nested`, `limits`), the `@babel/*` dependencies, the `./babel` export, the `babel` tsdown entry, `babel` in tsconfig `include` and in `keywords`. `pnpm-lock.yaml` regenerated (185 lines removed).
- `test/behavior/harness.ts` links imports with `oxc-parser` in place of `@babel/core`.
- Test imports of `src/v2` point at `src` (`test/runtime/*`, `test/compiler/codegen/helpers.ts`, `pipelines/compiler.ts`).
- `test/unplugin.test.ts`: expects `$$set` output, plus tests for `.ts?v=123`, `?lang.ts`, `?lang.tsx`, `.js` (JSX parses, TS throws) and an unchanged module.
- `website/src/live/run.ts` imports the runtime from `silmaril`.
- `README.md` and `packages/silmaril/README.md` (identical): compiler section, no Babel, scheduling and tracking text for 0.5, `tick()`. Every sample was compiled and run on 0.5; the wrong ones were fixed (see log).
- Review fixes: the Babel differential in `test/compiler/analysis/scope.test.ts` deleted (it could not run). `silmaril-compiler-entry.md`, `silmaril-compiler-codegen-core.md` and `silmaril-compiler-codegen-extras.md` deleted; their facts (the `./compiler` entry, `oxc-parser` pinned, `magic-string`, the optional wasm peer) moved into the 0.5 changeset. `benchmarks/README.md` says its pipeline paths are as of `0f55110`.
- `.changeset/silmaril-0-5-compiler-and-runtime.md` (minor): removals and additions, scheduling, tracking and compile-error changes from the decision record's "Changes from 0.4" ((a) 1-8, (b) 1-10, (c) 13-16), the loop guard, and the behavior cases that differed between the pipelines (`let` queued effect, `nested` inner variable, the 4 `limits` cases).
- Examples needed no change.

Runtime size: 2985 B minified, 1412 B gzip -9 (tsdown CLI, `--platform neutral --target es2022 --minify`). Cap 1.5 kB. `dist/index.mjs` and `dist/store.mjs` have no imports; `dist/solid.mjs` imports only `solid-js` (optional peer).

### Dependency decision: `oxc-parser` and `magic-string`

Kept as regular dependencies, as the maintainer decided on 2026-10-30. Weighed:

- Regular dependencies (kept): `silmaril/unplugin` works with one install. Runtime-only users also install `oxc-parser` with its native binding (about 3 MB on darwin-arm64: 1.2 MB package, 1.7 MB binding) and `magic-string` (104 KB). The runtime entries still import nothing, so bundles do not change.
- Optional peers: lighter install for runtime-only users, but every bundler user must add `oxc-parser` at the exact pinned version themselves, and gets an error at build time if it is missing or another version. It also breaks the single-install setup the README shows.
- A separate compiler package (for example `silmaril-compiler` holding `/compiler` and `/unplugin`): the cleanest split, but it is a new package to publish and version in step with the runtime, and it moves `silmaril/unplugin`, which 0.4 users already import. Worth it if install size becomes a complaint.

## Deviations

- `test/behavior/harness.ts` (shared) changed parser, because it imported `@babel/core`.
- Review fixes outside owned paths: deleted `.changeset/silmaril-compiler-entry.md`, `silmaril-compiler-codegen-core.md` and `silmaril-compiler-codegen-extras.md`, as the review asked.
- `website/src/live/run.ts` keeps the `ran` guard for a module that imports `silmaril` and comes back unchanged. Only its comment changed. `check:samples --strict` stays as is.
- `tsx` and `allowBuilds: esbuild: false` stay. Plain Node cannot load `compiler/index.ts`: the compiler's own imports have no extensions (`./analysis/index`), so Node throws ERR_MODULE_NOT_FOUND. Dropping `tsx` needs `.ts` extensions throughout `packages/silmaril/compiler/` (not owned here).
- No change request.

## Stubs left

- None.

## Gotchas

- `website/docs/getting-started.md` and `website/docs/bundler-setup.md` still describe `silmaril/babel` and the `babel` unplugin option. They belong to `docs-content`.
- The unreleased 0.4.1 changesets `fix-setup-argument-and-skip.md` and `nested-setup-single-context.md` describe the removed Babel plugin. They are left for the maintainer (release 0.4.1 first, or drop them).
- `benchmarks/README.md` now matches what `pnpm bench` prints only for the `compiler` rows. The `babel` rows are the recorded baseline.

## Proposed learnings

- Run every README sample through the compiler and runtime before a release | 3 samples were wrong on 0.4 or 0.5 (`0 * 100`, a log comment, the nested `onDestroy`) | `README.md` | yes (same approach as `check:samples`)

## Verification

- `pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm format:check && pnpm build:examples` (the brief's verify, after `pnpm install --frozen-lockfile`): passes. `pnpm test`: 24 files, 488 passed.
- `pnpm --filter website build`: passes. `pnpm --filter website check:samples --strict`: 2 samples, 0 problems, 0 compiled and not run.
- `pnpm bench`: runs, one `compiler` row per size (numbers not recorded, the report node re-runs it).
- Examples in Chrome, built with `vite preview` and in `vite` dev:
  - `demo` (preview): starts at `Count: 0`. Increment by `click()` shows `Count: 1` after a microtask (still `0` right after the click), two more show `3`, Decrement shows `2`, and a real mouse click on Increment shows `3`. Dev: two Increments show `2`, a Decrement `1`. No console errors.
  - `solid`: `fromStore` and `fromSignal` headings both read `0` at load and increase by one each second in step (0, 1, 2, 3 over 3.3 s). No console errors.
  - In dev, `/src/main.ts` is served compiled (`$$root`, `$$effect`, imports from `silmaril/dist/index.mjs`).

## Size

- Estimated M, actual M.
