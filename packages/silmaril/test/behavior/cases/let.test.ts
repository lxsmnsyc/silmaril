import { behaviorCases } from '../harness';

behaviorCases('let', [
  {
    name: 'runs $ once with the initial value',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        $(log('count', count));
      });
    `,
    logs: [['count', 0]],
  },
  {
    name: 'reacts to a write made during setup',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        $(log('Count:', count));
        function multiply() {
          count *= 100;
        }
        count += 1;
        multiply();
      });
    `,
    logs: [['Count:', 100]],
  },
  {
    name: 'reacts to ++, -- and compound assignment',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 1;
        $(log(count));
        count++;
        count += 2;
        --count;
        count **= 2;
      });
    `,
    logs: [[9]],
  },
  {
    name: 'reacts to a write from a timer',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let count = 0;
        $(log(count));
        setTimeout(() => {
          count = 1;
        }, 10);
      });
    `,
    logs: [[0], [1]],
  },
  {
    name: 'batches writes made after the first run',
    code: `
      import { $$, $ } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        $(log(count));
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(1);
      set(2);
      set(3);
      await flush();
    `,
    logs: [[0], [3]],
  },
  {
    name: 'skips the effect when the written value is the same',
    code: `
      import { $$, $ } from 'silmaril';
      let set;
      $$(() => {
        let count = 0;
        $(log(count));
        set = (value) => {
          count = value;
        };
      });
      await flush();
      set(0);
      await flush();
      set(1);
      set(0);
      await flush();
    `,
    logs: [[0]],
  },
  {
    name: 'does not rerun $ for a variable it does not read',
    code: `
      import { $$, $ } from 'silmaril';
      let setOther;
      $$(() => {
        let count = 0;
        let other = 0;
        $(log('count', count));
        setOther = (value) => {
          other = value;
        };
      });
      await flush();
      setOther(5);
      await flush();
    `,
    logs: [['count', 0]],
  },
  {
    name: 'handles a declaration without an initializer',
    code: `
      import { $$, $ } from 'silmaril';
      $$(() => {
        let value;
        $(log(value));
        value = 'ready';
      });
    `,
    logs: [['ready']],
  },
]);
