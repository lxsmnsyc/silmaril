# Premortem

It is some weeks from now and 0.6 shipped late, or users turned the warnings off. The five most likely reasons:

1. **False positives.** `untracked-entry` warns on `$(console.log('ready'))` or on calls users meant to run once, and users stop reading warnings. Mitigation: the brief makes misses cheaper than false positives, and the acceptance requires the behavior suite and all website samples to compile with no unexpected warning.
2. **Warnings change the output.** A check mutates the model by accident. Mitigation: checks get the finished model and the acceptance compares compiled output with and without each warning case.
3. **Bundlers print the warning badly.** `this.warn` with `loc` behaves differently across Vite, Rollup, esbuild and webpack. Mitigation: `unplugin-warnings` puts line and column in the message text too, and says in its outcome which bundlers were checked.
4. **The graph dump is unreadable on real code.** Refs into nested scopes print as numbers. Mitigation: snapshot tests on nested cases, and the format is declared not an API so it can change in a patch.
5. **The registry file conflicts.** Four nodes append to `warnings/index.ts`. Mitigation: one line each, merged in wave order; a conflict is a one-line rebase.
