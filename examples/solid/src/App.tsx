import { $$, $store, $ } from 'silmaril';
import { onCleanup, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fromSignal, fromStore } from 'silmaril/solid';
import { countSignal, countStore } from './count';

function createInterval(callback: () => void, timeout: number) {
  onSettled(() => {
    const t = setInterval(callback, timeout);

    return () => {
      clearInterval(t);
    };
  });
}

function CountFromStore() {
  const [count, setCount] = fromStore(countStore);

  createInterval(() => {
    setCount((current) => current + 1);
  }, 1000);

  return <h1>{`fromStore: ${count()}`}</h1>;
}

function CountFromSignal() {
  const store = fromSignal(countSignal);

  createInterval(() => {
    store.set?.(store.get() + 1);
  }, 1000);

  let ref: HTMLHeadingElement | undefined;

  onCleanup(
    $$(() => {
      const value = $store(store);

      $((ref!.innerText = `fromSignal: ${value}`));
    }),
  );

  return <h1 ref={ref}>{`fromSignal: ${store.get()}`}</h1>;
}

export default function App(): JSX.Element {
  return (
    <>
      <CountFromStore />
      <CountFromSignal />
    </>
  );
}
