---
'silmaril': minor
---

- Add `silmaril/compiler`, a compiler built on `oxc-parser` and `magic-string`. It exports `compile`, `ready`, `CompileError` and the `CompileOptions`, `CompileResult` and `SourceMap` types. `compile` parses the module, runs every compile-time check of the 0.5 runtime and throws `CompileError` with a location and a code frame. It does not rewrite code yet: the output is the input, with a source map.
- `silmaril` depends on `oxc-parser` (exact version) and `magic-string`. Only `silmaril/compiler` uses them. `@oxc-parser/binding-wasm32-wasip1` is an optional peer dependency at the same version as `oxc-parser`, for running the compiler in a browser.
