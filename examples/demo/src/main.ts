import { $, $$ } from 'silmaril';

const increment = document.getElementById('increment')!;
const decrement = document.getElementById('decrement')!;
const count = document.getElementById('count')!;

$$(() => {
  let value = 0;

  $((count.innerHTML = `Count: ${value}`));

  increment.onclick = () => {
    value += 1;
  };
  decrement.onclick = () => {
    value -= 1;
  };
});
