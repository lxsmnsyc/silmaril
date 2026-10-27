---
'rollup-plugin-silmaril': minor
'vite-plugin-silmaril': minor
'solid-silmaril': minor
---

- Deprecate `rollup-plugin-silmaril` and `vite-plugin-silmaril` in favor of `silmaril/unplugin`, which they now wrap.
- Deprecate `solid-silmaril` in favor of `silmaril/solid`, which it now re-exports.
- These packages are ESM only and require Node.js `^22.18.0 || >=24.11.0`.
