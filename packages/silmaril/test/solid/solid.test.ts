import { createRoot, createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { $$get, $$root, $$set, $$store, type Scope } from '../../src';
import { fromSignal, fromStore } from '../../solid';
import Store from '../../store';

function first(): number {
  return 1;
}

function second(): number {
  return 2;
}

describe('fromSignal', () => {
  it('reads and writes the signal', () => {
    const [count, setCount] = createSignal(1);
    const store = fromSignal([count, setCount]);
    expect(store.get()).toBe(1);

    store.set(2);
    flush();
    expect(count()).toBe(2);
    expect(store.get()).toBe(2);
  });

  it('stores a function value instead of calling it', () => {
    const [value, setValue] = createSignal<() => number>(() => first);
    const store = fromSignal([value, setValue]);

    store.set(second);
    flush();
    expect(store.get()).toBe(second);
  });

  it('calls the subscriber when the signal changes, until unsubscribed', () => {
    const [count, setCount] = createSignal(0);
    const store = fromSignal([count, setCount]);
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls += 1;
    });
    flush();
    const initial = calls;

    setCount(1);
    flush();
    expect(calls).toBe(initial + 1);

    unsubscribe();
    setCount(2);
    flush();
    expect(calls).toBe(initial + 1);
  });

  it('keeps the subscription when the owner at subscribe time is disposed', () => {
    const [count, setCount] = createSignal(0);
    const store = fromSignal([count, setCount]);
    let calls = 0;
    let unsubscribe!: () => void;
    createRoot((dispose) => {
      unsubscribe = store.subscribe(() => {
        calls += 1;
      });
      dispose();
    });
    flush();
    const initial = calls;

    setCount(1);
    flush();
    expect(calls).toBe(initial + 1);
    unsubscribe();
  });

  it('binds to a silmaril scope inside a Solid owner', () => {
    const [count, setCount] = createSignal(1);
    const store = fromSignal([count, setCount]);
    let scope!: Scope;
    let disposeScope!: () => void;

    // Slot 0 is read by the write-back, entry 0. The write-back runs at
    // registration, inside the Solid owner.
    const disposeSolid = createRoot((dispose) => {
      disposeScope = $$root([[0]], (s) => {
        scope = s;
        $$store(s, 0, store, 0);
        $$set(s, 0, 5);
      });
      return dispose;
    });
    flush();
    expect(count()).toBe(5);

    setCount(8);
    flush();
    expect($$get(scope, 0)).toBe(8);

    disposeScope();
    disposeSolid();
  });
});

describe('fromStore', () => {
  it('follows the store and writes back to it', () => {
    const store = new Store(1);
    const [[count, setCount], dispose] = createRoot((disposeRoot) => [
      fromStore(store),
      disposeRoot,
    ]);
    expect(count()).toBe(1);

    store.set(2);
    flush();
    expect(count()).toBe(2);

    setCount(3);
    flush();
    expect(store.get()).toBe(3);
    dispose();
  });

  it('follows a store write made inside a Solid owner', () => {
    const store = new Store(1);
    const [[count], dispose] = createRoot((disposeRoot) => [
      fromStore(store),
      disposeRoot,
    ]);

    createRoot((disposeWriter) => {
      store.set(2);
      disposeWriter();
    });
    flush();
    expect(count()).toBe(2);
    dispose();
  });

  it('holds a function value instead of calling it', () => {
    const store = new Store<() => number>(first);
    const [[read, write], dispose] = createRoot((disposeRoot) => [
      fromStore(store),
      disposeRoot,
    ]);
    expect(read()).toBe(first);

    write(() => second);
    flush();
    expect(store.get()).toBe(second);
    dispose();
  });

  it('unsubscribes when the owner is disposed', () => {
    const store = new Store(1);
    let read!: () => number;
    createRoot((dispose) => {
      [read] = fromStore(store);
      dispose();
    });

    store.set(2);
    flush();
    expect(read()).toBe(1);
  });
});
