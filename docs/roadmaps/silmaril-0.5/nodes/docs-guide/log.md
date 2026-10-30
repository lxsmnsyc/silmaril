# Log: docs-guide

- Checked first: the eight pages held the 0.4 README text. Nothing to reuse except the sample code.
- Ran every sample file through `runSample` to read the real logs, then wrote the expected logs. Two samples changed after the run: `composition-nested.js` and `basic-reactivity-tracking.js` write in a `setTimeout`, so the second run shows in the logs.
- `scripts/check-samples.ts` is not in my paths. Expected logs live in the new `website/scripts/expected-docs-guide.ts`. One hunk in `check-samples.ts` merges them into `EXPECTED`, away from the object, to limit merge conflicts with the other docs nodes.
- The runner allows imports only from `silmaril` and `silmaril/store`, so `solid-js` samples cannot run. `solid.md` has a live sample with a hand-written store of the same shape.
- The Markdown plugin throws on a link to a page that is not on the site. I linked only to `getting-started.md` and `bundler-setup.md`.
- Non-live blocks checked with a script (compile each fence with `silmaril/compiler`, wrapped in `$$` when it has no import). 8 blocks, 0 errors.
- `check_prose.py` on the eight pages: ok.
- Review fixes: `index-overview` and `basic-reactivity-count` write from a timer so `$` runs twice. Added imports to the `readPrefix` and TypeScript blocks, and the `typeof` example now writes `count`. Solid examples run inside `createRoot`. Nits from the review applied.
- Recheck of the static blocks asserts the compiled output differs from the source. 8 blocks, one bare fragment (wrapped in `$$`), 0 errors.
- `check-samples.ts` loads every `scripts/expected-*.ts` and throws on a duplicate sample name. Drop `expected-api.ts`'s own import line when catching up with `roadmap`.
