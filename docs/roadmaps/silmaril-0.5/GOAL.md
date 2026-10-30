---
milestones: [0.4.1, 0.5.0, docs]
merge:
  mode: maintainer
branches:
---

# silmaril 0.5: oxc compiler and static-graph reactivity

## Outcome

silmaril 0.5.0 compiles with `silmaril/compiler` (oxc-parser and magic-string, no Babel) and runs on a new runtime built on a static reactive graph that the compiler emits, in the style of brumate. A write runs only the code that reads the written variable. `silmaril/babel` and the old runtime are removed. The runtime has zero dependencies. A documentation website built with brumate explains the library with samples that compile and run in the page.

## Acceptance

- `pnpm build && pnpm test && pnpm type-check && pnpm lint && pnpm build:examples` passes on `main`.
- The behavior suite (`packages/silmaril/test/behavior`) passes against `silmaril/compiler` and the new runtime.
- `packages/silmaril/package.json` has no `@babel/*` dependency and no `./babel` export.
- The benchmark report shows compile time and update cost against the 0.4 baseline.
- The website builds, and every sample on it compiles and runs.

## Priorities

- must: needed to release 0.5.0 (new compiler, new runtime, `/babel` removed) and the 0.4.1 fixes.
- should: benchmarks, the website and its content.
- could: work that improves 0.5 but does not block it.
- later: the playground, parked until runnable samples show whether it is needed.

## Constraints

- Zero runtime dependencies for `silmaril` (the `.`, `./store` and `./solid` entries). Compiler-only dependencies (oxc-parser, magic-string) are fine.
- 0.x may break semantics. 0.5.0 is a `minor` changeset that lists the breaking changes.
- Node.js `^22.18.0 || >=24.11.0`, ESM only, TypeScript 7 with `isolatedDeclarations`.
- The public store interface (`get`, `set?`, `subscribe`) and `silmaril/solid` keep their API.
- Backwards compatibility comes first (maintainer, 2026-10-27). Where a rule is open, or two rules are equally sound, pick the behavior closest to 0.4. Each change from 0.4 needs a reason in the decision record and a line in the 0.5 changeset.
- Every pull request that changes published behavior adds a changeset.

## Non-goals

- Resumability, server rendering or serialization (brumate's domain).
- A component or template language. silmaril stays plain JS and TS.
- Tracking reads inside functions imported from other modules. That limit stays and is documented.

## Verification

- Fast check (safe in parallel worktrees): `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm type-check && pnpm lint`
- Full check (at checkpoints): fast check plus `pnpm format:check && pnpm build:examples` (under 1 minute, no shared resources).
- Benchmarks are a single-use resource (`exclusive: [bench]`): their numbers are noisy when other work runs at the same time.

## Numbered resources

- None. Changeset files have unique names per node.
- Shared files: `pnpm-lock.yaml` cannot be split. Nodes that add dependencies (`compiler-core`, `website-skeleton`, `benchmark-harness`, `switch-to-v2`) merge one at a time, in that order, and the later one regenerates it after rebasing, `packages/silmaril/tsdown.config.ts` and `packages/silmaril/package.json` (entry points and dependencies).

## Sources

- Conversation of 2026-10-27 that agreed the direction: static graph over runtime signals, zero runtime dependencies, Svelte-like aim, `/babel` removed together with the old runtime, website built with brumate.
- brumate reactive graph: https://github.com/lxsmnsyc/brumate/blob/main/website/docs/reactive-graph.md
- brumate website: https://github.com/lxsmnsyc/brumate/tree/main/website
- Current compiler: `packages/silmaril/babel/index.ts`. Current runtime: `packages/silmaril/src/index.ts`.

## Open questions

- Is a playground needed beyond runnable samples? Decided after `runnable-samples` (blocks `playground`).

## Gates

- `reactivity-adr`: the user reviews the runtime contract before any runtime or codegen work starts.
- `switch-to-v2`: the user reviews the 0.5 switch before it merges.

## Manual steps outside the roadmap

- After 0.4.0 is published: `npm deprecate` for `rollup-plugin-silmaril`, `vite-plugin-silmaril` and `solid-silmaril`.
