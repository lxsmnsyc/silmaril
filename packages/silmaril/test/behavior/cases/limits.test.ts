import { behaviorCases } from '../harness';

// Limits of the 0.4 runtime. The 0.5 compiler tracks reads inside local helpers,
// so each case states the 0.5 behavior.

behaviorCases('limits', [
  {
    name: 'effect tracks a variable read inside a local helper',
    code: `
      import { $$, $ } from 'silmaril';
      let setPrefix;
      $$(() => {
        let count = 0;
        let prefix = 'Count';
        function show(current) {
          log(prefix, current);
        }
        $(show(count));
        setPrefix = (value) => {
          prefix = value;
        };
      });
      await flush();
      setPrefix('Total');
      await flush();
    `,
    logs: [
      ['Count', 0],
      ['Total', 0],
    ],
  },
  {
    name: 'sync effect tracks a variable read inside a local helper',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        let prefix = 'Count';
        function show(current) {
          log(prefix, current);
        }
        $sync(show(count));
        prefix = 'Total';
      });
    `,
    logs: [
      ['Count', 0],
      ['Total', 0],
    ],
  },
  {
    name: 'computed variable tracks a variable read inside a local helper',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let offset = 1;
        let a = 1;
        function add(x) {
          return x + offset;
        }
        const b = add(a);
        $sync(log(b));
        offset = 10;
      });
    `,
    logs: [[2], [11]],
  },
  {
    name: 'computed variable stays current when its helper is declared after it',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 1;
        const b = twice();
        $sync(log(b));
        a = 5;
        function twice() {
          return a * 2;
        }
      });
    `,
    logs: [[2], [10]],
  },
]);
