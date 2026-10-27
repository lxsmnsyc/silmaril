import { behaviorCases } from '../harness';

behaviorCases('$store', [
  {
    name: 'binds a store in both directions',
    code: `
      import { $$, $, $sync, $store } from 'silmaril';
      import Store from 'silmaril/store';
      const count = new Store(100);
      count.subscribe(() => {
        log('Raw Count:', count.get());
      });
      $$(() => {
        let current = $store(count);
        $sync(log('Sync Count:', current));
        $(log('Async Count:', current));
        current += 100;
      });
    `,
    logs: [
      ['Sync Count:', 100],
      ['Raw Count:', 200],
      ['Sync Count:', 200],
      ['Async Count:', 200],
    ],
  },
  {
    name: 'writes the variable through to the store',
    code: `
      import { $$, $store } from 'silmaril';
      import Store from 'silmaril/store';
      const count = new Store(1);
      $$(() => {
        let current = $store(count);
        current = 7;
      });
      log(count.get());
    `,
    logs: [[7]],
  },
  {
    name: 'reflects a store update in the variable',
    code: `
      import { $$, $sync, $store } from 'silmaril';
      import Store from 'silmaril/store';
      const count = new Store(1);
      $$(() => {
        let current = $store(count);
        $sync(log('current', current));
      });
      count.set(2);
      count.set(3);
    `,
    logs: [
      ['current', 1],
      ['current', 2],
      ['current', 3],
    ],
  },
  {
    name: 'feeds computed variables from a store',
    code: `
      import { $$, $sync, $store } from 'silmaril';
      import Store from 'silmaril/store';
      const count = new Store(2);
      $$(() => {
        const current = $store(count);
        const doubled = current * 2;
        $sync(log('doubled', doubled));
      });
      count.set(5);
    `,
    logs: [
      ['doubled', 4],
      ['doubled', 10],
    ],
  },
  {
    name: 'reads a store without a set method',
    code: `
      import { $$, $sync, $store } from 'silmaril';
      let value = 1;
      const listeners = new Set();
      const readonly = {
        get: () => value,
        subscribe: (callback) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
      };
      $$(() => {
        const current = $store(readonly);
        $sync(log('current', current));
      });
      value = 2;
      for (const listener of listeners) listener();
    `,
    logs: [
      ['current', 1],
      ['current', 2],
    ],
  },
  {
    name: 'stops listening to the store when destroyed',
    code: `
      import { $$, $sync, $store } from 'silmaril';
      let value = 1;
      const listeners = new Set();
      const custom = {
        get: () => value,
        subscribe: (callback) => {
          listeners.add(callback);
          return () => listeners.delete(callback);
        },
      };
      const stop = $$(() => {
        const current = $store(custom);
        $sync(log('current', current));
      });
      log('listeners', listeners.size);
      stop();
      log('listeners', listeners.size);
      value = 2;
      for (const listener of listeners) listener();
    `,
    logs: [
      ['current', 1],
      ['listeners', 1],
      ['listeners', 0],
    ],
  },
  {
    name: 'keeps two bindings of one store in step',
    code: `
      import { $$, $sync, $store } from 'silmaril';
      import Store from 'silmaril/store';
      const count = new Store(0);
      $$(() => {
        let a = $store(count);
        const b = $store(count);
        $sync(log('b', b));
        a = 4;
      });
    `,
    logs: [
      ['b', 0],
      ['b', 4],
    ],
  },
]);
