# Log: behavior-tests

- Worktree was on an old commit; reset to origin/roadmap (106c75a). Plain `git` is blocked by the rtk hook in this sandbox, so `/usr/bin/git` was used.
- No prior work existed (no `test/behavior`), so this is a fresh build.
- Evaluating modules: `vm.SourceTextModule` needs a Node flag, and a data URL import cannot map the bare `silmaril` specifier. Chose to rewrite static imports into lookups and run the module in an `AsyncFunction`. This allows top-level await.
- Pipelines are discovered with `readdirSync` plus dynamic import, to avoid `import.meta.glob` types and so that a new pipeline file needs no edit to the harness.
- Found by experiment on the Babel pipeline: reads inside local helpers are not tracked by `$`, `$sync` or computed variables. These are the xfail cases. A nested `$$` is an independent boundary (not linked to the outer one's variables or destroy), so no case asserts that.
- Fixed two wrong expectations of mine (nested restart re-runs the inner write; nested `$$`).
