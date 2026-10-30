# Log: runtime-v2

- Ported the sketch to `src/v2/index.ts` with types, no logic change: 3096 B min, 1481 B gzip (same as the sketch).
- Added `test/runtime/fixtures.test.ts` (54 runtime fixtures, contract runner protocol) and `runtime.test.ts` (unit tests). All pass.
- Size method: `.size-tmp.mjs` in the package (not committed): tsdown `build` with `minify: true`, neutral platform, es2022, then gzip level 9 of the output. Run `node .size-tmp.mjs src/v2/index.ts <dir>`.
- Size pass, gzip after each change (method in the outcome): sketch port 1481; entry objects in place of parallel arrays 1423; drop `kind === MEMO` check 1420; sort in place of the scan 1416; path walk with `[ref].flat()` 1392; sort once per take when dirty, O(n log n) 1413 (kept, +21 B). Tried and dropped: Map for entries 1448, lazy `o` and `u` 1434, shared `call` helper 1419.
