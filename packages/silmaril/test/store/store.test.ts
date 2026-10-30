import { expect, it } from 'vitest';
import type { Store as StoreLike } from '../../src';
import Store from '../../store';

it('passes the new value to subscribers', () => {
  const store = new Store(1);
  const seen: number[] = [];
  const unsubscribe = store.subscribe((value) => {
    seen.push(value);
  });
  store.set(2);
  store.set(2);
  unsubscribe();
  store.set(3);
  expect(seen).toEqual([2]);
});

it('is assignable to the Store interface', () => {
  const store: StoreLike<number> = new Store(1);
  expect(store.get()).toBe(1);
});
