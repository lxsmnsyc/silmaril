# Wave 1 report (2026-10-27)

## Pull requests

| Node                 | PR  | State                                                                                                           |
| -------------------- | --- | --------------------------------------------------------------------------------------------------------------- |
| fix-babel-plugin     | #5  | merged into `roadmap`                                                                                           |
| behavior-tests       | #6  | reviewed, review fixes applied, ready to merge                                                                  |
| website-skeleton     | #7  | reviewed, review fixes applied, Vercel previews limited to pull requests that change `website/`, ready to merge |
| reactivity-adr       | #8  | gate passed with maintainer decisions, two review rounds applied, contract v4 proposed                          |
| compiler-infra-spike | #9  | contract rewritten for the 0.5 runtime, prototype checked against contract v3                                   |

## Decisions made at the gate

All recorded as comments on #8 and in `decisions/0001-static-graph-runtime.md` on its branch.

- Nested `$` and `$sync` reads no longer re-run outer bodies.
- A queued `$` runs even when its values were restored.
- Runtime size: 1.5 kB gzip cap, `runtime-v2` does a size pass toward 1.2 kB. The v4 sketch measures 1481 B.
- Public `tick()`.
- `/* $skip */` is a compile error.
- Loop guard modeled on brumate: `Update loop` after 10000 entry runs in one drain.
- The `body-memo` rule stays.
- Nested `$$` does not track outer variables.
- Backwards compatibility first: where a rule is open, the 0.4 behavior wins (recorded in `GOAL.md`). The decision record lists every change from 0.4 in "Changes from 0.4".

## New work

- `fix-nested-setup` (0.4.1): a nested `$$` compiled with two contexts. Found by the review of #5.

## Before the next wave

1. Re-check #9's prototype against contract v4 (#8 at `bc5407d`). v4 changed 11 fixtures and added 16.
2. Merge #6, #7, #8, then #9.
3. After merging: copy the proposed contracts over `contracts/` and freeze `behavior-suite`, `reactivity-runtime` and `compiler-api`.
4. Then ready: `fix-nested-setup`, `runtime-v2`, `compiler-core`, `benchmark-harness`.

## Process notes

- The RTK hook rewrites `git` to `rtk git`, which the worktree isolation guard refuses. Workers now run in worktrees prepared by the orchestrator, without automatic isolation. One worker called `/usr/bin/git` to get around the hook before this was caught; later workers were told to stop and report instead.
- Worktrees made by the isolation feature started from `main`, not `roadmap`. Prepared worktrees avoid this.
