/* oxlint-disable -- a test input full of odd but valid code. */
import { $composable, $, $sync, $store, onMount, type Store } from 'silmaril';
import * as ns from './ns';
import Default, { named as alias } from './mod';
import type { OnlyType } from './types';
import fs = require('fs');

declare const declared: number;
declare function ambient(x: number): void;

enum Color {
  Red = 1,
  Green = Red + 1,
}

namespace Space {
  export const inner = 1;
  export function get() {
    return inner;
  }
}

interface Shape<T> {
  value: T;
  other: Color;
}

type Alias<T> = { item: T } | OnlyType;

function overload(x: string): string;
function overload(x: number): number;
function overload(x: unknown): unknown {
  return x;
}

function hoisted() {
  return later + useBeforeDeclare();
}
var later = 1;
function useBeforeDeclare() {
  return later;
}

abstract class Base<T> implements Shape<T> {
  value!: T;
  other = Color.Red;
  static count = 0;
  #secret = 1;
  [Symbol.iterator]() {
    return [this.#secret][Symbol.iterator]();
  }
  abstract method(): void;
  static {
    var inStatic = Base.count;
    Base.count = inStatic + 1;
  }
  constructor(
    public readonly name: string,
    private age = later,
  ) {
    this.value = name as unknown as T;
  }
}

const Named = class Inner extends Base<number> {
  method() {
    return Inner.count + alias + Default;
  }
};

export const counter = $composable((props: { start: number }) => {
  let count = props.start;
  let [first, { second = count, ...rest }] = [1, { second: 2, third: 3 }];
  const doubled = count * 2;
  let store = $store(someStore as Store<number>);

  function increment(this: Window, step = count) {
    count += step;
    count++;
    --count;
    (count as number) = 1;
    count! = 2;
    [first, second] = [second, first];
    ({ first, rest } = { first: 1, rest: {} });
    for (first of [1, 2]) {
      void first;
    }
    store = count;
  }

  function shadowed() {
    let count = 10;
    count += 1;
    const inner = (count: number) => {
      count++;
      return count;
    };
    try {
      throw count;
    } catch (count) {
      count = 1;
    }
    {
      let first = 1;
      first++;
    }
    for (let second = 0; second < 1; second++) {}
    label: for (const x of [1]) {
      if (x) break label;
      continue label;
    }
    return inner(count);
  }

  if (props.start) {
    let blockVar = 1;
    blockVar = 2;
  }

  $(console.log(count, doubled satisfies number, ns.value, Space.get()));
  $sync(() => {
    const local = count<string>;
    return local;
  });
  onMount(() => {
    const el = (
      <Base.Inner value={count} other={Color.Red} {...rest}>
        <div class={first as string}>{second}</div>
        <Named />
        <my-element data-x={count} />
        <ns.Component />
      </Base.Inner>
    );
    return el;
  });

  const obj = {
    count,
    [first]: second,
    method() {
      return count;
    },
    get prop() {
      return doubled;
    },
  };
  const tagged = String.raw<string>`${count}`;
  return {
    increment,
    shadowed,
    obj,
    tagged,
    fs,
    overload,
    hoisted,
    declared,
    ambient,
  };
});

export { counter as default2, later };
export type { Alias };
export default Named;
