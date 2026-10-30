import { $$, $, $skip, tick } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  $(console.log('Run', a, $skip(b)));

  tick()
    .then(() => {
      // `b` is skipped: the `$` does not run again.
      b = 1;
      return tick();
    })
    .then(() => {
      // `a` is tracked: the `$` runs again and reads `b` as 1.
      a = 1;
    });
});

for (let i = 0; i < 4; i++) {
  await tick();
}
console.log('Done');
