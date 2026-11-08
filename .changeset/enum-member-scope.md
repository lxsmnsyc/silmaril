---
'silmaril': patch
---

Resolve a reference to an enum member inside the enum body to the member, not to an outer binding with the same name. Before, `let A = 0; A = 1; enum E { A = 2, B = A }` in a setup compiled `B = A` to `B = $$get($s, 0)`.
