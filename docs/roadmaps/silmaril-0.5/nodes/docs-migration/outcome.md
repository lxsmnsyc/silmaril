# Outcome: docs-migration

## Built

- `website/docs/migration.md`: every item of `.changeset/silmaril-0-5-compiler-and-runtime.md` (removed and added, deprecated packages, scheduling, tracking, compile errors), plus the unchanged 0.4 rules. The 0.4 result of each change is text.
- `website/docs/internals.md`: step by step compile of one setup (slots, entry ids, graph, a write), scopes, phases, order of runs, loop guard, errors, reads.
- `website/docs/limits.md`: opaque functions, mutation in place, pattern defaults, `typeof`, the 10,000-entry loop guard.
- 14 live samples in `website/src/samples/` (`migration-*`, `internals-order`, `limits-*`). Their logs are in `website/scripts/expected-docs-migration.ts`.
- `website/src/docs.ts`: a "More" sidebar section (`migration`, `internals`, `limits`) after Integrations, and the label "Migrating from 0.4".

## Deviations

- `check-samples.ts` has two temporary lines that load `expected-docs-migration.ts`, until docs-guide (PR #25) loads every `expected-*.ts`. The catch-up removes them (restore the file to the `roadmap` state, or to PR #25's).
- Edited `.changeset/silmaril-0-5-compiler-and-runtime.md`: `$skip` outside a setup compiled to its argument in 0.4 and did not throw, so it left the list of code that threw.
- Dropped the memo-order sample: its logs are the same on 0.4. The flush-order sample uses a nested `$$`, where 0.4 logged `child` then `parent`.
- The sidebar section is called "More" and comes after "Integrations". The brief says "after the guide pages".
- Three changes have no live sample: compile errors (they cannot run), plain values (the logs do not differ) and the nested `$$`. They are in the text.
- No link to `./api.md`.

## Stubs left

- None.

## Gotchas

- Merging after `docs-reference`: `website/src/docs.ts` (`api` page and labels) and `check-samples.ts` may conflict. Take PR #25's `check-samples.ts`.
- `bundler-setup.md` still mentions the `babel` option. It belongs to `docs-reference`.

## Proposed learnings

- Keep expected logs of file samples in one record | a changed runtime rule then fails the build | `website/scripts` | yes (`check:samples --strict`)

## Verification

- `pnpm --filter website build && pnpm --filter website check:samples --strict`: pass (17 samples, 0 problems).
- `pnpm format:check`: pass.
- `check_prose.py` on the three pages: no warnings.

## Size

- Estimated M, actual M.
