import { Store } from 'silmaril';
import {
  createEffect,
  createRoot,
  createSignal,
  on,
  onCleanup,
  Signal,
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
      set(() => value);
    },
    subscribe(callback) {
      return createRoot((cleanup) => {
        createEffect(on(get, callback));
        return cleanup;
      });
    },
  };
}

export function fromStore<T>(store: Store<T>): Signal<T> {
  const [get, set] = createSignal(store.get());

  createEffect(() => {
    if (store.set) {
      store.set(get());
    }
  });

  onCleanup(store.subscribe(() => {
    set(() => store.get());
  }));

  return [get, set];
}
