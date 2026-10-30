---
'silmaril': patch
---

- `silmaril/compiler` now emits code for the 0.5 runtime. It compiles `$$`, reactive `let` and `var`, computed `const` and `let`, function memos, destructuring memos, `$`, `$sync`, nested setups and local helper calls.
- Assignments, compound and logical assignments, updates, destructuring and for-in/of heads that write a reactive variable compile to runtime writes. The output imports the helpers it uses and declares the graph constants. The source map points back to the original positions.
- `$store`, `$composable`, `onMount`, `onDestroy` and `$skip` throw a `CompileError` (`<name> is not supported by the compiler yet.`) until their code generation lands.
