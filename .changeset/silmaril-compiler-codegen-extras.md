---
'silmaril': patch
---

- `silmaril/compiler` now emits code for `$store` (one-way for `const`, two-way for `let`), `$composable`, `onMount`, `onDestroy` and `$skip`. They no longer throw a `CompileError`.
