import { $$, $, tick } from 'silmaril';

$$(() => {
  let count = 0;

  $(console.log('count is', count));

  tick().then(() => {
    count = 1;
    count = 0;
  });
});
