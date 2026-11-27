import type { Store } from '../src';
import {
  createEffect,
  createRoot,
  createSignal,
  onCleanup,
  runWithOwner,
  type Signal,
  untrack,
} from 'solid-js';

export interface SignalStore<T> extends Store<T> {
  set(value: T): void;
}

export function fromSignal<T>([get, set]: Signal<T>): SignalStore<T> {
  return {
    get() {
      return untrack(get);
    },
    set(value: T) {
      // A store write comes from outside Solid, even when silmaril runs it
      // inside a component body. Without an owner, Solid does not treat it as
      // a write from a computation.
      runWithOwner(null, () => {
        set(() => value);
      });
    },
    subscribe(callback) {
      // The root is detached, so the subscription lasts until the returned
      // function runs, not until the owner active at subscribe time is
      // disposed.
      return runWithOwner(null, () =>
        createRoot((dispose) => {
          createEffect(get, () => {
            callback();
          });
          return dispose;
        }),
      );
    },
  };
}

export function fromStore<T>(store: Store<T>): Signal<T> {
  // The compute form holds any value, functions included. The plain form
  // would call a function value as a compute function.
  const [get, set] = createSignal<T>(() => untrack(() => store.get()));

  // Writes from Solid reach the store.
  createEffect(get, (value) => {
    if (store.set) {
      store.set(value);
    }
  });

  // Changes from the store reach the signal, until the owner is disposed.
  // The store can change inside a Solid owner, for example from a silmaril
  // scope in a component body, so the write runs without one.
  onCleanup(
    store.subscribe(() => {
      runWithOwner(null, () => {
        set(() => store.get());
      });
    }),
  );

  return [get, set];
}
