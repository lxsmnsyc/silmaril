# Outcome: docs-migration

## Built

- `website/docs/migration.md`: every item of `.changeset/silmaril-0-5-compiler-and-runtime.md` (removed and added, deprecated packages, scheduling, tracking, compile errors), plus the unchanged 0.4 rules. The 0.4 result of each change is text.
- `website/docs/internals.md`: step by step compile of one setup (slots, entry ids, graph, a write), scopes, phases, order of runs, loop guard, errors, reads.
- `website/docs/limits.md`: opaque functions, mutation in place, pattern defaults, `typeof`, the 10,000-entry loop guard.
- 15 live samples in `website/src/samples/` (`migration-*`, `internals-order`, `limits-*`). Their logs are asserted in `EXPECTED` of `website/scripts/check-samples.ts`.
- `website/src/docs.ts`: a "More" sidebar section (`migration`, `internals`, `limits`) after Integrations, and the label "Migrating from 0.4".

## Deviations

- Edited `website/scripts/check-samples.ts` (outside the brief's paths) to assert sample logs. It is the only way to have `--strict` assert logs.
- The sidebar section is called "More" and comes after "Integrations". The brief says "after the guide pages".
- Compile errors, the plain-values change and the nested `$$` change have no live sample, because a compile error cannot run and a plain value shows no difference in logs. They are in the text.
- No link to `./api.md`.

## Stubs left

- None.

## Gotchas

- Merging after `docs-reference`: `website/src/docs.ts` (`api` page and labels) and `EXPECTED` in `check-samples.ts` may conflict. Keep both sides.
- `bundler-setup.md` still mentions the `babel` option. It belongs to `docs-reference`.

## Proposed learnings

- Keep expected logs of file samples in one record | a changed runtime rule then fails the build | `website/scripts` | yes (`check:samples --strict`)

## Verification

- `pnpm --filter website build && pnpm --filter website check:samples --strict`: pass (17 samples, 0 problems).
- `pnpm format:check`: pass.
- `check_prose.py` on the three pages: no warnings.

## Size

- Estimated M, actual M.
