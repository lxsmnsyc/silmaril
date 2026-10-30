import { $$, $, tick } from 'silmaril';

$$(() => {
  let count = 0;

  $(console.log('Count:', count));

  count = 1;
  count = 2;
});

console.log('Before tick');
await tick();
console.log('After tick');
