import { behaviorCases } from '../harness';

behaviorCases('computed', [
  {
    name: 'updates a computed const synchronously',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        const message = \`Count: \${count}\`;
        $sync(log(message));
        count = 100;
        count = 200;
      });
    `,
    logs: [['Count: 0'], ['Count: 100'], ['Count: 200']],
  },
  {
    name: 'lets $ observe only the settled computed value',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        const message = \`Count: \${count}\`;
        $(log(message));
        count = 100;
      });
    `,
    logs: [['Count: 100']],
  },
  {
    name: 'writes to a computed let and recomputes on the next dependency change',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let count = 0;
        let message = \`Count: \${count}\`;
        $sync(log('Log', message));
        count = 100;
        message = 'Hello World';
        count = 200;
      });
    `,
    logs: [
      ['Log', 'Count: 0'],
      ['Log', 'Count: 100'],
      ['Log', 'Hello World'],
      ['Log', 'Count: 200'],
    ],
  },
  {
    name: 'follows a chain of computed variables',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 1;
        const b = a + 1;
        const c = b * 10;
        const d = c + a;
        $sync(log(d));
        a = 2;
      });
    `,
    logs: [[21], [32]],
  },
  {
    name: 'combines several reactive variables',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let first = 'Ada';
        let last = 'Lovelace';
        const full = first + ' ' + last;
        $sync(log(full));
        first = 'Grace';
        last = 'Hopper';
      });
    `,
    logs: [['Ada Lovelace'], ['Grace Lovelace'], ['Grace Hopper']],
  },
  {
    name: 'resolves a diamond of computed variables',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 1;
        const left = a + 1;
        const right = a * 10;
        const total = left + right;
        $sync(log(total));
        a = 2;
      });
    `,
    logs: [[12], [23]],
  },
  {
    name: 'does not reevaluate a computed when its dependencies are unchanged',
    code: `
      import { $$, $sync } from 'silmaril';
      let calls = 0;
      const tick = (value) => {
        calls += 1;
        return value * 2;
      };
      let setOther;
      $$(() => {
        let a = 1;
        let other = 0;
        const doubled = tick(a);
        $sync(log('doubled', doubled));
        setOther = (value) => {
          other = value;
        };
      });
      setOther(1);
      setOther(2);
      log('calls', calls);
    `,
    logs: [
      ['doubled', 2],
      ['calls', 1],
    ],
  },
  {
    name: 'computes from a value that is written during setup',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 1;
        a = 4;
        const squared = a * a;
        $sync(log(squared));
      });
    `,
    logs: [[16]],
  },
]);
