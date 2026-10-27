---
'silmaril': patch
---

- `$$(value)` throws when the argument is not an arrow function or a function expression. It compiled without an error before.
- `$skip(expr)` compiles to `expr` and leaves the variables read inside it out of dependency tracking. It threw at runtime before.
