import { $, $$ } from 'silmaril';

const increment = document.getElementById('increment')!;
const decrement = document.getElementById('decrement')!;
const count = document.getElementById('count')!;

$$(() => {
  let value = 0;

  $((count.innerHTML = `Count: ${value}`));

  increment.addEventListener('click', () => {
    value += 1;
  });
  decrement.addEventListener('click', () => {
    value -= 1;
  });
});
