# Premortem

It is some weeks from now and 0.5 shipped late or not at all. The five most likely reasons:

1. **Scope analysis on magic-string edits is wrong.** The Babel plugin calls `scope.crawl()` after it edits the AST and relies on the edited tree (`traverseIdentifiers` then `transformReads`). With magic-string the AST never changes, so a two-pass design that assumed edited nodes breaks on shadowing and nested setups.
   Change: `compiler-infra-spike` must show shadowing and nested setups working on the original AST before `compiler-core` starts (already in its acceptance). Analysis runs fully before any edit; codegen only reads analysis results.

2. **The runtime contract misses a construct, found only in codegen.** `$composable` returning stores and `$store` writing back for `let` are the least obvious in a slot model. If the ADR skips them, `codegen-extras` stalls on a change request.
   Change: `reactivity-adr` must ship a hand-written fixture for every construct, including `$composable` and both `$store` forms (already in its acceptance), and the user reviews it at the gate.

3. **New scheduling semantics break the examples and users silently.** Moving `$` from `setTimeout` to a microtask and fixing stale computeds changes observable order.
   Change: the behavior suite marks every case whose result differs between pipelines, and `switch-to-v2` turns that list into the migration section of the changeset and README.

4. **Following local helper calls blows up.** Recursion, helpers passed as callbacks, helpers reassigned at runtime, or helpers defined after use make the transitive read set wrong or the analysis loop forever.
   Change: `compiler-core` acceptance includes direct and transitive calls; add recursion and a reassigned helper to its tests, and treat any helper that is not a plain `function` declaration or `const` arrow as opaque (documented limit).

5. **Lockfile and release-age policy block merges.** Four nodes add dependencies, and fresh releases of oxc-parser, brumate or twinkleplop fail the pnpm `minimumReleaseAge` check, as oxfmt 0.75 did during the 0.4 refresh.
   Change: merge order recorded in GOAL.md; briefs say to pin versions older than the release-age cutoff.

Accepted risk: the website depends on brumate, which is at 0.3 and changes fast. Website nodes are `should`, so a brumate break delays docs, not 0.5.0.
