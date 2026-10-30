import { behaviorCases } from '../harness';

behaviorCases('$composable', [
  {
    name: 'composes a derived store',
    code: `
      import { $$, $sync, $composable, $store, onDestroy } from 'silmaril';
      import Store from 'silmaril/store';
      const useSquared = $composable((store) => {
        const input = $store(store);
        const squaredStore = new Store(0);
        onDestroy(() => squaredStore.destroy());
        $sync(squaredStore.set(input ** 2));
        return squaredStore;
      });
      $$(() => {
        const store = new Store(0);
        let input = $store(store);
        $sync(log('Value', input));
        const squared = $store(useSquared(store));
        $sync(log('Squared', squared));
        input = 3;
        input = 4;
      });
    `,
    logs: [
      ['Value', 0],
      ['Squared', 0],
      ['Value', 3],
      ['Squared', 9],
      ['Value', 4],
      ['Squared', 16],
    ],
  },
  {
    name: 'returns a value to the caller',
    code: `
      import { $$, $composable } from 'silmaril';
      const useAnswer = $composable((n) => n + 1);
      $$(() => {
        log(useAnswer(41));
      });
    `,
    logs: [[42]],
  },
  {
    name: 'tracks reactive variables with $sync inside the composable',
    code: `
      import { $$, $sync, $composable } from 'silmaril';
      import Store from 'silmaril/store';
      const useLogger = $composable((store) => {
        $sync(log('seen', store.get()));
      });
      $$(() => {
        let count = 1;
        const store = new Store(count);
        useLogger(store);
        count = 2;
      });
    `,
    logs: [['seen', 1]],
  },
  {
    name: 'runs onDestroy inside the composable when the boundary is destroyed',
    code: `
      import { $$, $composable, onDestroy } from 'silmaril';
      const useResource = $composable((name) => {
        log('open', name);
        onDestroy(() => log('close', name));
      });
      const stop = $$(() => {
        useResource('a');
        useResource('b');
      });
      stop();
    `,
    logs: [
      ['open', 'a'],
      ['open', 'b'],
      ['close', 'a'],
      ['close', 'b'],
    ],
  },
  {
    name: 'gives each call its own state',
    code: `
      import { $$, $sync, $composable } from 'silmaril';
      const useCounter = $composable((label) => {
        let count = 0;
        $sync(log(label, count));
        return () => {
          count += 1;
        };
      });
      $$(() => {
        const incA = useCounter('a');
        const incB = useCounter('b');
        incA();
        incA();
        incB();
      });
    `,
    logs: [
      ['a', 0],
      ['b', 0],
      ['a', 1],
      ['a', 2],
      ['b', 1],
    ],
  },
]);
