# Outcome: docs-guide

## Built

- Rewrote `website/docs/index.md`, `basic-reactivity.md`, `computed-variables.md`, `synchronous-tracking.md`, `lifecycles.md`, `composition.md`, `stores.md` and `solid.md` for 0.5. Rules come from `reactivity-runtime` v4 and decision 0001. No Babel, `_$$context` or 0.4 scheduling remains.
- 12 live samples in `website/src/samples/`, one or more per page, each shown by an empty `js live <name>.js` fence: `index-overview`, `basic-reactivity-count`, `basic-reactivity-tracking`, `computed-variables-message`, `computed-variables-writable`, `synchronous-tracking-batching`, `synchronous-tracking-tick`, `lifecycles-mount`, `composition-squared`, `composition-nested`, `stores-counter`, `solid-store`.
- `website/scripts/expected-docs-guide.ts` holds the expected logs. `check:samples` asserts them.
- New content from the notes: the 10,000-entry `Update loop`, opaque helpers, declaration-pattern defaults, `typeof` in types, compile errors, order across scopes, store write-back rules.

## Deviations

- Edited `website/scripts/check-samples.ts` (not an owned path): one loop that merges every `scripts/expected-*.ts` into `EXPECTED` and throws on a duplicate sample name. Without it the logs of the guide samples cannot be asserted. If another docs node edits the same file, keep both.
- `solid.md` has no live sample of `silmaril/solid`, because the runner allows only `silmaril` and `silmaril/store` imports. The live sample uses a hand-written store of the same shape. The two `solid-js` blocks are static.
- Links to `./migration.md`, `./internals.md`, `./limits.md` and `./api.md` are left out. The Markdown plugin throws on a link to a page that is not on the site. Add them after `docs-reference` and `docs-migration` merge (limits for opaque helpers: `basic-reactivity.md`; update-loop and order details: `synchronous-tracking.md`).

## Stubs left

- None.

## Gotchas

- Each non-`solid` page has an asserted live sample. `solid.md` asserts the hand-written store only.
- `silmaril/solid` behavior in the page comes from reading `packages/silmaril/solid/index.ts`. It was not run.
- The sample keys in `EXPECTED` are `samples/<file>`. Docs fences with a body are only checked to run.

## Proposed learnings

- Name sample files after their page | several docs nodes add samples at once and the prefix avoids clashes | `website/src/samples` | no

## Verification

- `pnpm --filter website build`: 12 pages prerendered.
- `pnpm --filter website check:samples --strict`: 14 samples, 0 problems, 0 compiled and not run.
- `pnpm format:check`: pass.
- Non-live blocks (8, `js` and `ts`): compiled with `silmaril/compiler` by a throwaway script that wraps the one bare fragment in `$$` and asserts the output differs from the input. 0 errors. Not compiled: the two `solid-js` blocks run only as far as the compiler (it compiled them), but were not run.
- `check_prose.py` (plain-writing) on the eight pages: ok.
- Review mode `fresh`: a fresh review is needed.

## Size

- Estimated M, actual M.
