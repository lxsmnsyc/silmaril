# Synchronous tracking

`$` reacts after the code that wrote the variable. `$sync` reacts during the write.

| Call    | First run                      | After a write                               |
| ------- | ------------------------------ | ------------------------------------------- |
| `$sync` | At once, where it is declared. | Before the write returns.                   |
| `$`     | In the next microtask.         | In the next microtask, once for all writes. |

```js live synchronous-tracking-batching.js

```

`$sync` logs after each write. `$` logs once, with the last value. Writing a variable many times in one block causes one `$` run.

## `tick`

`tick()` returns a promise. It resolves after the queued `$` bodies have run, including the ones queued during the flush. It never rejects.

```js live synchronous-tracking-tick.js

```

## Order

Entries that wait for the same phase run in this order:

1. An entry in a scope closer to its `$$` runs before an entry in a deeper scope.
2. Entries in the same scope run in the order of their declaration. `$sync` bodies keep source order, and so do `$` bodies.
3. Scopes of the same depth compare at their closest common ancestor. The branch with the lower entry id runs first, and a composable runs after the entry scopes of its parent, in call order.

A write runs its phases in this order:

1. Computed variables and store write-backs.
2. `$sync` bodies.
3. `$` bodies wait for the microtask.

A write inside a `$sync` body updates computed variables before it returns. The `$sync` bodies it queued run after the outermost running `$sync` body returns. So the effects of a body come in the same order on its first run and on later runs.

A `$` that was queued runs even if later writes put the old value back.

## Errors

- An error in a computed variable or a `$sync` body is held until the pass ends, then thrown to the caller of the write. The other queued entries still run.
- An error in a `$` body is thrown from the microtask, so the host reports it. The other `$` bodies still run.

## Loops

One write that runs more than 10,000 entries in one pass throws `Update loop`. A `$` flush counts the `$` bodies that ran before, and throws the same error after 10,000. A first run does not count.

## Choosing

- Use `$` for effects such as logging, drawing and requests. Batching avoids repeated work.
- Use `$sync` when code after the write needs the effect to have run.
