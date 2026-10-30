import { $$, $ } from 'silmaril';

$$(() => {
  // A reactive variable: it is written after its declaration
  let count = 1;

  // Logs once now, and again after a write changes `count`
  $(console.log('Count:', count));

  function multiply() {
    count *= 100;
  }

  multiply();
});
