# Change request: compiler-api v2 to v3

- From node: compiler-core
- Status: accepted

## Problem

1. `WriteSite.fn` is typed `oxc.Function | oxc.ArrowFunctionExpression`. Its doc comment and step 10 say it is "the nearest function, or the class field whose initializer holds the site". A destructuring write in a class field (`class K { f = ([a] = [1]); }`, allowed by runtime contract v4) has a `PropertyDefinition` there, so the declared type is wrong. `test/compiler/analysis/model.test.ts` ("write sites") checks this case.
2. The error table has no row for `onMount` or `onDestroy` with other than one argument. The prototype and `compiler-core` fail with `<name> takes exactly one argument.`, the text of the `$skip` and `$store` row.
3. Step 5 says a setup declaration is "not through a loop", and a later `var` of a candidate is a redeclare. It does not say what a `var` in a loop does when it names a setup `var`. It is the same binding, so by runtime contract v4 ("A second `var` declaration of the same name with an initializer is a write") it is a write. Step 5 also reads as if the redeclare check used the whole declarator. It has to hold per bound name: `var a = 1; a = 2; var [b, a] = arr` must not give `a` two slots.

## Proposed change

1. Type `WriteSite.fn` as:

   ```ts
   // analysis/model.ts
   export type TempOwner =
     | oxc.Function
     | oxc.ArrowFunctionExpression
     | oxc.PropertyDefinition
     | oxc.AccessorProperty;

   export interface WriteSite {
     // ...
     fn: TempOwner;
   }
   ```

   `PropertyDefinition` covers `TSAbstractPropertyDefinition`, and `AccessorProperty` covers `TSAbstractAccessorProperty`.

2. Add this row to "Compile errors":

   | Case                                                  | Message                              | Step |
   | ----------------------------------------------------- | ------------------------------------ | ---- |
   | `onMount` or `onDestroy` with other than one argument | `<name> takes exactly one argument.` | 12   |

3. Add to step 5: "The redeclare check is per bound name. A declarator that names a binding with a candidate is a redeclare of it. Its other names form a candidate of their own, which is never a memo. A `var` in a loop or a loop head is never a candidate, but one that names a candidate is a redeclare too. A redeclare counts for rule 1 when it has an initializer or heads a `for-in` or `for-of` loop. A `for (var x of e)` head gives a `for` write site whose node is the loop and whose `pattern` is the `VariableDeclaration`. A redeclare in the init of a `for` statement has `statement: false`."

## Affected nodes

- `codegen-core`: it declares the temps from `site.fn` and wraps a class field value in a called arrow. It also prints the new write sites: a redeclare in a loop body or a `for` init, and a `for (var x of e)` head. A redeclaring declarator whose other names have a slot is in both `declarators` and `writeOf`; it prints as the write.
- `codegen-extras`: none. Analysis raises the lifecycle error.

## Workaround in place

- `compiler/analysis/model.ts` exports `TempOwner` as above and types `WriteSite.fn` with it.
- The lifecycle argument error is raised and tested (`errors.test.ts`).
- Redeclares are found per name and in loops, as in item 3 (`model.test.ts`, "var redeclarations").

## Decision

Accepted as compiler-api v3 on 2026-10-30, after the fresh review of PR #15 checked each item. `codegen-core` builds against v3.
