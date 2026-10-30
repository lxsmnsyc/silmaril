import { $$, $sync } from 'silmaril';

$$(() => {
  let count = 0;
  let message = `Count: ${count}`;
  $sync(log('Log', message));
  count = 100;
  message = 'Hello World';
  count = 200;
});
