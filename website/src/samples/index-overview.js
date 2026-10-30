import { $$, $ } from 'silmaril';

$$(() => {
  let count = 1;
  const double = count * 2;

  $(console.log(`${count} doubled is ${double}`));

  // Writes after the first run, so the log shows the change
  setTimeout(() => {
    count = 21;
  }, 10);
});
