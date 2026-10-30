import { behaviorCases } from '../harness';

behaviorCases('$sync', [
  {
    name: 'runs once during setup',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        $sync(log('sync', count));
        log('setup done');
      });
    `,
    logs: [['sync', 0], ['setup done']],
  },
  {
    name: 'runs on every write, without batching',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        $sync(log(count));
        count = 1;
        count = 2;
        count = 3;
      });
    `,
    logs: [[0], [1], [2], [3]],
  },
  {
    name: 'runs before $ and $ sees only the last value',
    code: `
      import { $$, $, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        const message = \`Count: \${count}\`;
        $sync(log('Sync', message));
        $(log('Async', message));
        count = 100;
        count = 200;
      });
    `,
    logs: [
      ['Sync', 'Count: 0'],
      ['Sync', 'Count: 100'],
      ['Sync', 'Count: 200'],
      ['Async', 'Count: 200'],
    ],
  },
  {
    name: 'accepts a function',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        $sync(() => {
          log('fn', count);
        });
        count = 1;
      });
    `,
    logs: [
      ['fn', 0],
      ['fn', 1],
    ],
  },
  {
    name: 'skips the rerun when the value is unchanged',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        $sync(log(count));
        count = 0;
        count = 1;
        count = 1;
      });
    `,
    logs: [[0], [1]],
  },
  {
    name: 'only runs when a variable it reads changes',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 0;
        let b = 0;
        $sync(log('a', a));
        a = 1;
        b = 1;
      });
    `,
    logs: [
      ['a', 0],
      ['a', 1],
    ],
  },
  {
    name: 'reacts to writes made from outside the boundary',
    code: `
      import { $$, $sync } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        $sync(log(count));
        set = (value) => {
          count = value;
        };
      });
      set(5);
      set(6);
    `,
    logs: [[0], [5], [6]],
  },
]);
