
## 2026-10-30 worker notes

- Nothing existed on the base. Wrote `migration.md`, `internals.md`, `limits.md` and 15 samples (`migration-*`, `internals-order`, `limits-*`).
- Every bullet of the 0.5 changeset is on the migration page. Compile errors are a table with the 0.4 behavior, since they cannot run as samples.
- `website/scripts/check-samples.ts` has an `EXPECTED` record for logs. Added the new samples there so `--strict` asserts them. This file is outside the brief's paths; it may conflict with other docs nodes that add samples.
- A link to `./api.md` was not added: the pages do not need it.
- `docs.ts`: added a "More" sidebar section after Integrations and one label (`migration`).
- The plain-writing checker passes with no warnings.
