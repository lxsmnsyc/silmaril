import { behaviorCases } from '../harness';

behaviorCases('nested', [
  {
    name: 'restarts a nested $ when the outer variable changes',
    code: `
      import { $$, $, onDestroy } from 'silmaril';
      $$(() => {
        let y = 0;
        $(() => {
          let x = 0;
          $(log('x + y', x + y));
          onDestroy(() => {
            log('cleanup');
          });
          x += 100;
        });
        y += 100;
      });
    `,
    logs: [['x + y', 200]],
  },
  {
    name: 'cleans up a nested effect and starts a fresh one on outer change',
    code: `
      import { $$, $, onDestroy } from 'silmaril';
      let set;
      $$(() => {
        let y = 0;
        $(() => {
          let x = 0;
          log('outer', y);
          $(log('inner', x, y));
          onDestroy(() => log('cleanup', y));
        });
        set = (value) => {
          y = value;
        };
      });
      await flush();
      set(1);
      await flush();
    `,
    logs: [
      ['outer', 0],
      ['inner', 0, 0],
      ['cleanup', 1],
      ['outer', 1],
      ['inner', 0, 1],
    ],
  },
  {
    name: 'keeps the inner variable local to the nested effect',
    code: `
      import { $$, $, $sync } from 'silmaril';
      $$(() => {
        let outer = 1;
        $sync(() => {
          let inner = 10;
          $sync(log('sum', inner + outer));
          inner = 20;
        });
        outer = 2;
      });
    `,
    logs: [
      ['sum', 11],
      ['sum', 21],
      ['sum', 12],
      ['sum', 22],
    ],
  },
  {
    name: 'destroys nested effects together with the boundary',
    code: `
      import { $$, $, onDestroy } from 'silmaril';
      const stop = $$(() => {
        let y = 0;
        onDestroy(() => log('outer destroyed'));
        $(() => {
          log('inner run', y);
          onDestroy(() => log('inner destroyed'));
        });
      });
      await flush();
      stop();
    `,
    logs: [['inner run', 0], ['inner destroyed'], ['outer destroyed']],
  },
  {
    name: 'gives a nested $$ boundary its own stop callback',
    code: `
      import { $$, $sync, onDestroy } from 'silmaril';
      $$(() => {
        let a = 1;
        const stopInner = $$(() => {
          let b = 2;
          $sync(log('inner', b));
          onDestroy(() => log('inner destroyed'));
        });
        log('outer', a);
        stopInner();
        log('inner stopped');
      });
    `,
    logs: [['inner', 2], ['outer', 1], ['inner destroyed'], ['inner stopped']],
  },
  {
    name: 'computes a variable inside a nested $sync',
    code: `
      import { $$, $sync } from 'silmaril';
      $$(() => {
        let a = 1;
        $sync(() => {
          const doubled = a * 2;
          $sync(log('doubled', doubled));
        });
        a = 5;
      });
    `,
    logs: [
      ['doubled', 2],
      ['doubled', 10],
    ],
  },
]);
