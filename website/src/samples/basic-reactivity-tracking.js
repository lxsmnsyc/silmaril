import { $$, $ } from 'silmaril';

$$(() => {
  let count = 0;
  let prefix = 'Count';

  function log(current) {
    console.log(`${prefix}:`, current);
  }

  // Tracks `count`, and `prefix` through the local function `log`
  $(log(count));

  // Writes after the first run, so the log shows the change
  setTimeout(() => {
    prefix = 'Total';
  }, 10);
});
