import { behaviorCases } from '../harness';

behaviorCases('$', [
  {
    name: 'accepts an expression',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 1;
        $(log('expr', count));
        count = 2;
      });
    `,
    logs: [['expr', 2]],
  },
  {
    name: 'accepts a function',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 1;
        $(() => {
          log('fn', count);
        });
        count = 2;
      });
    `,
    logs: [['fn', 2]],
  },
  {
    name: 'does not run before the setup finishes',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        $(log('effect', count));
        log('setup done');
      });
    `,
    logs: [['setup done'], ['effect', 0]],
  },
  {
    name: 'runs several effects in declaration order',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        $(log('first', count));
        $(log('second', count));
        $(log('third', count));
      });
    `,
    logs: [
      ['first', 0],
      ['second', 0],
      ['third', 0],
    ],
  },
  {
    name: 'tracks only the variables read in the call',
    code: `
      import { $$, $ } from 'silmaril';
      let setPrefix;
      $$(() => {
        let count = 0;
        let prefix = 'Count';
        $(log(prefix, count));
        $(log('count only', count));
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
      ['count only', 0],
      ['Total', 0],
    ],
  },
  {
    name: 'reruns when any one of several dependencies changes',
    code: `
      import { $$, $ } from 'silmaril';
      let setA;
      let setB;
      $$(() => {
        let a = 1;
        let b = 2;
        $(log(a + b));
        setA = (value) => {
          a = value;
        };
        setB = (value) => {
          b = value;
        };
      });
      await flush();
      setA(10);
      await flush();
      setB(20);
      await flush();
    `,
    logs: [[3], [12], [30]],
  },
  {
    name: 'reruns for a computed dependency only when its value changes',
    code: `
      import { $$, $ } from 'silmaril';
      let set;
      $$(() => {
        let count = 1;
        const parity = count % 2;
        $(log('parity', parity));
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(3);
      await flush();
      set(4);
      await flush();
    `,
    logs: [
      ['parity', 1],
      ['parity', 0],
    ],
  },
]);
