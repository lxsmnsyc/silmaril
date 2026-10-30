# Change request: compiler-api v2 to v3

- From node: compiler-core
- Status: open

## Problem

`WriteSite.fn` is typed `oxc.Function | oxc.ArrowFunctionExpression`, but its doc comment and step 10 say it is "the nearest function, or the class field whose initializer holds the site". A destructuring write in a class field (`class K { f = ([a] = [1]); }`, allowed by runtime contract v4) has a `PropertyDefinition` there, so the declared type is wrong. `test/compiler/analysis/model.test.ts` ("write sites") checks this case.

## Proposed change

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

## Affected nodes

- `codegen-core`: it declares the temps from `site.fn` and wraps a class field value in a called arrow.

## Workaround in place

`compiler/analysis/model.ts` exports `TempOwner` as above and types `WriteSite.fn` with it. Codegen checks `site.fn.type` before it reads `body`.

## Decision

<Filled in by the orchestrator.>
