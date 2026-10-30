import { $$ } from 'silmaril';

$$(() => {
  console.log('before:', value);

  let value = 1;
  value += 1;

  console.log('after:', value);
});
