import { $$, $ } from 'silmaril';

$$(() => {
  let x = 0;

  $(() => {
    console.log('parent', x);

    $(console.log('child', x));
  });

  x = 1;
});
