import { $$, $, $sync } from 'silmaril';

$$(() => {
  let count = 0;
  const message = `Count: ${count}`;

  $sync(console.log('Sync', message));
  $(console.log('Async', message));

  count = 100;
  count = 200;
});
