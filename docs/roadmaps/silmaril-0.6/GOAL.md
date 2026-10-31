---
milestones: [0.6.0, website]
review: auto
merge:
  mode: maintainer
branches:
---

# silmaril 0.6: compiler warnings and a readable graph

## Outcome

The compiler tells users when their code compiles but never updates. `compile()` returns `warnings` for the silent cases in `website/docs/limits.md`, and `silmaril/unplugin` reports them as bundler warnings. `compile(code, { graph: true })` returns a text dump of the static reactive graph of each setup: each variable and the code a write to it runs. A `/repl` page on the website, like brumate's, edits several files and shows their logs, compiled output, graph and warnings, with a share link.

## Acceptance

- `pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm build:examples` passes on `main`.
- Each warning code in the `compile-result` contract has a compiler test that triggers it and a test that the nearest correct code does not.
- The behavior suite (`packages/silmaril/test/behavior`) and every website sample compile with no warning, unless the sample shows a limit on purpose.
- Compiled output is byte-identical with and without `graph: true`, and with and without warnings.
- `pnpm --filter website check:samples --strict` passes, including every REPL example.

## Priorities

- must: warnings from `compile()` and in the bundler, for in-place mutation and entries that track nothing, and the REPL (maintainer, 2026-10-31).
- should: the other limits as warnings, the graph dump and docs.
- could: warnings and an Open in REPL link on live samples.
- later: nothing.

## Constraints

- No change to compiled output or to the runtime. 0.6.0 is a `minor` changeset for the new API.
- Warnings are advice, never errors. No warning on code the behavior suite uses as correct.
- `CompileResult` only gains fields. Existing callers keep working without changes.
- Node.js `^22.18.0 || >=24.11.0`, ESM only, TypeScript 7 with `isolatedDeclarations`.
- The compiler gains no dependency.

## Non-goals

- Tracking reads in other modules, or deep tracking of in-place mutation. A warning is the answer to both.
- A structured (JSON) graph API. The dump is text for people. A data API waits until someone needs it.
- A DOM preview in the REPL. silmaril output is console logs.

## Verification

- Fast check (safe in parallel worktrees): `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`
- Full check (at checkpoints): fast check plus `pnpm format:check && pnpm build:examples && pnpm --filter website check:samples --strict` (about 1 minute, no shared resources).

## Numbered resources

- None. Changeset files have unique names per node.
- Shared files: `packages/silmaril/compiler/analysis/warnings/index.ts` (the warning registry: each warning node appends one line, so a rebase conflict is one line; not split, because TypeScript has no per-file registration without a bundler) and `packages/silmaril/unplugin/index.ts` (`unplugin-warnings` first, then `graph-output`), `website/src/live/run.ts` (`repl-runner` only; `live-sample-links` waits for the story).

## Sources

- Conversation of 2026-10-31: features 2 to 4 after the 0.5 release.
- Silent cases: `website/docs/limits.md`.
- Live samples: `docs/roadmaps/silmaril-0.5/nodes/runnable-samples/outcome.md`. They already have a Compiled tab (`website/src/components/LiveSample.brm`).
- brumate REPL: `brumate/website/src/routes/repl.brm`, `src/repl/files.ts`, `src/live/run.ts` (https://github.com/lxsmnsyc/brumate/tree/main/website/src).
- Parked node: `docs/roadmaps/silmaril-0.5/nodes/playground/brief.md`.

## Coverage

- Feature 2 (compiler warnings) -> compile-api, warn-in-place-mutation, warn-untracked-entry, warn-scope-cases, unplugin-warnings
- Feature 3 (compiled output on samples) -> built: Compiled tab from runnable-samples. Replaced by the REPL (user, 2026-10-31) -> repl story (repl-runner, repl-files, repl-page), live-sample-links
- Feature 4 (print the graph) -> graph-output, Graph tab in repl-page
- 0.5 playground -> replaced by the repl story; dropped in the 0.5 roadmap
- Docs for all of it -> docs-warnings-graph

## Open questions

- Should the bundler plugin let users turn off warnings by code (`ignoreWarnings: ['untracked-entry']`)? Decided in `unplugin-warnings` unless the user says otherwise; default is yes.

## Gates

- `compile-api`: the user reviews the warning codes and the `compile()` shape before the warning nodes start.
