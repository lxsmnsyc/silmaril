import { behaviorCases } from '../harness';

behaviorCases('onMount', [
  {
    name: 'runs after the setup finishes',
    code: `
      import { $$, onMount } from 'silmaril';
      $$(() => {
        onMount(() => {
          log('Mounted!');
        });
        log('Not mounted yet!');
      });
      log('after $$');
    `,
    logs: [['Not mounted yet!'], ['Mounted!'], ['after $$']],
  },
  {
    name: 'runs several callbacks in order',
    code: `
      import { $$, onMount } from 'silmaril';
      $$(() => {
        onMount(() => log('one'));
        onMount(() => log('two'));
        onMount(() => log('three'));
      });
    `,
    logs: [['one'], ['two'], ['three']],
  },
  {
    name: 'runs once even when the boundary updates',
    code: `
      import { $$, $, onMount } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        onMount(() => log('mounted'));
        $(log('count', count));
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(1);
      await flush();
    `,
    logs: [['mounted'], ['count', 0], ['count', 1]],
  },
  {
    name: 'runs inside $ each time the effect starts',
    code: `
      import { $$, $, onMount } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        $(() => {
          onMount(() => log('mounted', count));
        });
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(1);
      await flush();
    `,
    logs: [
      ['mounted', 0],
      ['mounted', 1],
    ],
  },
  {
    name: 'runs inside $sync before the next statement after setup',
    code: `
      import { $$, $sync, onMount } from 'silmaril';
      $$(() => {
        let count = 0;
        $sync(() => {
          onMount(() => log('mounted', count));
          log('sync', count);
        });
        log('end of setup');
      });
    `,
    logs: [['sync', 0], ['mounted', 0], ['end of setup']],
  },
  {
    name: 'runs inside a composable',
    code: `
      import { $$, $composable, onMount } from 'silmaril';
      const useThing = $composable(() => {
        onMount(() => log('composable mounted'));
        log('composable setup');
      });
      $$(() => {
        useThing();
        log('boundary setup');
      });
    `,
    logs: [['composable setup'], ['boundary setup'], ['composable mounted']],
  },
]);
