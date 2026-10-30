import { behaviorCases } from '../harness';

behaviorCases('onDestroy', [
  {
    name: 'runs when the returned callback is called',
    code: `
      import { $$, onDestroy } from 'silmaril';
      const stop = $$(() => {
        onDestroy(() => {
          log('Destroyed!');
        });
      });
      log('before');
      stop();
      log('after');
    `,
    logs: [['before'], ['Destroyed!'], ['after']],
  },
  {
    name: 'runs once when stop is called twice',
    code: `
      import { $$, onDestroy } from 'silmaril';
      const stop = $$(() => {
        onDestroy(() => log('Destroyed!'));
      });
      stop();
      stop();
    `,
    logs: [['Destroyed!']],
  },
  {
    name: 'runs several callbacks in order',
    code: `
      import { $$, onDestroy } from 'silmaril';
      const stop = $$(() => {
        onDestroy(() => log('one'));
        onDestroy(() => log('two'));
      });
      stop();
    `,
    logs: [['one'], ['two']],
  },
  {
    name: 'cleans up an effect before it reruns',
    code: `
      import { $$, $, onDestroy } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        $(() => {
          log('run', count);
          onDestroy(() => log('cleanup'));
        });
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(1);
      await flush();
    `,
    logs: [['run', 0], ['cleanup'], ['run', 1]],
  },
  {
    name: 'cleans up an effect when the boundary is destroyed',
    code: `
      import { $$, $, onDestroy } from 'silmaril';
      const stop = $$(() => {
        let count = 0;
        $(() => {
          log('run', count);
          onDestroy(() => log('cleanup'));
        });
      });
      await flush();
      stop();
    `,
    logs: [['run', 0], ['cleanup']],
  },
  {
    name: 'stops reacting after the boundary is destroyed',
    code: `
      import { $$, $, $sync } from 'silmaril';
      let set;
      const stop = $$(() => {
        let count = 0;
        $sync(log('sync', count));
        $(log('async', count));
        set = (value) => {
          count = value;
        };
      });
      await flush();
      stop();
      set(1);
      await flush();
    `,
    logs: [
      ['sync', 0],
      ['async', 0],
    ],
  },
  {
    name: 'does not run an effect that was pending at destroy',
    code: `
      import { $$, $ } from 'silmaril';
      const stop = $$(() => {
        let count = 0;
        $(log('async', count));
      });
      stop();
    `,
    logs: [],
  },
]);
