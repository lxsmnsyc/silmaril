# Log: benchmark-harness

- Package `benchmarks` with `tsx` runner. Loads pipelines from the behavior suite directory, so a 0.5 pipeline needs no edit.
- Sizes: first tried 1000 groups, babel compile took minutes (superlinear). Cut to 400 groups and 400 N.
- pnpm 12 refused install on esbuild's build script (tsx dependency). Set `allowBuilds: esbuild: false` in pnpm-workspace.yaml; tsx works without the postinstall.
- Baseline taken at load average ~11 (other agents running). Noted in README and outcome.
