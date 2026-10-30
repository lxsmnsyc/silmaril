# Wave 2 report (2026-10-30)

## Before the wave

- #9 re-checked against contract v4: 18 of 61 fixtures failed, then 0 after a revision round.
- #6, #7, #8, #9 merged. Six open cases from #9 settled with the maintainer and written into `reactivity-runtime` v4: graph numbering in source order (fixtures `composable` and `composable-glitch` renumbered), class expressions are never memos, a split declaration that is a bare statement body gets a block, lifecycles in a function memo's body bind to the scope that holds the memo, `$`/`$sync` in a class field or static block is an error, `.js` parses as JSX.
- `behavior-suite` v2, `reactivity-runtime` v4 and `compiler-api` v2 frozen.

## Pull requests

| Node              | PR  | Review rounds | State                                 |
| ----------------- | --- | ------------- | ------------------------------------- |
| fix-nested-setup  | #12 | self          | merged                                |
| runtime-v2        | #13 | fresh, 1 fix  | merged                                |
| benchmark-harness | #14 | self          | merged                                |
| compiler-core     | #15 | fresh, 1 fix  | merged; change request became v3      |
| runnable-samples  | #16 | fresh, 1 fix  | ready; lockfile regenerated after #14 |
| codegen-core      | #17 | fresh, 1 fix  | merged                                |

What the fresh reviews caught:

- #13: every write re-sorted all queues, including the pending `$` queue (12,000 registrations took 7.9 s). Fixed with a dirty flag per queue and a regression test.
- #15: wrong error text for `$$`/`$composable` arguments, loop `var` redeclares not counted as writes, redeclares checked by first name only, untested freeze rules.
- #16: "compiled, not run" decided by string equality, runs not isolated (timers kept running after an edit).
- #17: memo and entry bodies starting with `{` emitted block-bodied arrows, TS type annotations left on destructuring assignments. Codegen tests now re-parse every output.

## Decisions (maintainer, 2026-10-30)

- `compiler-api` v3: `WriteSite.fn` is a `TempOwner` (class fields), a row for `onMount`/`onDestroy` argument counts, per-name and loop `var` redeclares.
- Runtime size 1417 B gzip accepted (cap 1.5 kB, aim 1.2 kB missed; costs per feature in `runtime-v2`'s outcome).
- One write that reaches more than 10,000 entries throws `Update loop`; documented in `docs-content`.
- `oxc-parser` and `magic-string` stay regular dependencies of `silmaril` for now; `switch-to-v2` weighs optional peers or a separate package.
- 0.4.1 keeps 0.4's tracking of outer variables in a nested `$$`.

## Carried forward

- `switch-to-v2`: point the live sample runtime (`website/src/live/run.ts`, `MODULES`) at v2 and turn on `check:samples --strict` in CI; write the 0.5.0 changeset lines for the two behavior cases that changed (a queued `$` runs when the old value is restored; nested entry reads no longer rerun outer bodies), both already in the decision record.
- `benchmark-report`: the 0.4 baseline in `benchmarks/README.md` was taken under load (load average about 10). Re-run on a quiet machine.
- `tsx` and `allowBuilds: esbuild: false` can go once `pipelines/babel.ts` and `harness.ts` import with explicit `.ts` paths (`pipelines/compiler.ts` already does).
- Perf pass candidates in `runtime-v2`'s outcome: an array per graph reference per write, five arrays per scope, an unused child scope per store write-back.
- `docs-content` notes: opaque helpers, reads in declaration-pattern defaults do not make memos, `typeof n` type queries keep naming a slot binding, the loop guard limit.
- `fix-nested-setup` is `should` while `switch-to-v2` (must) depends on it. It is done, so the warning has no effect.

## Next

- Ready: `codegen-extras` (must). `docs-content` is an outline within two waves and needs refining into briefs.
- Then `switch-to-v2` (gate: the maintainer reviews it before merge), then `benchmark-report`.

## Process notes

- Worktrees prepared by the orchestrator worked for every worker; no hook bypass this wave.
- A rebase with force-push was refused by the permission check. Merging the base into the branch and pushing normally worked for lockfile catch-ups.
- `gh pr merge` needed a permission rule; the maintainer added `Bash(gh pr merge:*)`.
