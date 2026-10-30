---
'silmaril': patch
---

The `Store` class from `silmaril/store` types its `subscribe` callback as `(value: T) => void`. It already passed the new value at run time, but the type said the callback took no argument, so `store.subscribe((value) => ...)` did not type-check.
