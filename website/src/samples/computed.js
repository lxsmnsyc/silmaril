import { $$, $ } from 'silmaril';

$$(() => {
  let count = 1;
  const double = count * 2;

  $(console.log(`${count} doubled is ${double}`));

  count = 21;
});
