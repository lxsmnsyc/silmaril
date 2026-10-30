# Checklist

- Data and migrations: N/A. silmaril stores no data. Compiled output is not persisted between versions; users recompile.
- Compatibility: `switch-to-v2` removes `/babel` and changes scheduling (breaking, allowed for 0.x, listed in the changeset). The `Store` interface and `silmaril/solid` stay compatible (GOAL constraint, `runtime-v2` acceptance). The deprecated wrapper packages keep working through `silmaril/unplugin` (`switch-to-v2` note).
- Auth and permissions: N/A. No server or credentials. Website hosting access is a manual step for the user (`website-skeleton` outcome).
- Failure modes: compile errors carry locations and code frames (`compiler-api`, `compiler-core`). Runtime errors inside effects: decided by `reactivity-adr`.
- Concurrency: N/A for threads. Ordering of writes, batching and re-entrant writes inside effects are decided by `reactivity-adr` and tested by `runtime-v2`.
- Limits: compile time on large files (`compiler-infra-spike`, `benchmark-harness`); update cost with many computeds (`benchmark-harness`); deep nesting of setups (`behavior-tests` cases).
- Security: the website runs user-edited samples in the page (`runnable-samples`). They run in the reader's own browser, with no server, so the risk is limited to the reader. The compiler parses untrusted source only at build time.
- Observability: N/A. A library; the benchmark report is the measurement.
- Performance: baseline and comparison in `benchmark-harness` and `benchmark-report`; runtime size target in `reactivity-adr`, checked by `runtime-v2`.
- Testing: behavior suite runs on both pipelines (`behavior-tests`); runtime fixtures (`reactivity-adr`, `runtime-v2`); compiler analysis tests (`compiler-core`); website samples checked in CI (`runnable-samples`). All run in parallel worktrees; benchmarks are `exclusive: [bench]`.
- Developer experience: error messages (`compiler-core`), README and migration guide (`switch-to-v2`, `docs-content`), types for `silmaril/compiler` (`compiler-core`).
- Rollout: 0.4.1 ships the fixes on the old pipeline. 0.5.0 ships the switch as one minor release behind the `switch-to-v2` gate. No flags: the old pipeline is removed, not toggled.
- Cleanup: `switch-to-v2` deletes `/babel`, the 0.4 runtime, the Babel pipeline in the behavior suite and the Babel snapshot tests. The spike prototype stays in its node folder and is not published.
- Coverage: N/A. Not imported from documents; the source is the 2026-10-27 conversation.
- Dependencies: `oxc-parser` and `magic-string` (compiler only, `compiler-core`); brumate and twinkleplop (website only). The runtime gains none (GOAL constraint). All pinned to versions that pass the pnpm release-age policy.
