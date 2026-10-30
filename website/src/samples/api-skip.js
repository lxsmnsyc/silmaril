import { $$, $, $skip } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;

  $(console.log(a, $skip(b)));

  b = 1;
  a = 1;
});
