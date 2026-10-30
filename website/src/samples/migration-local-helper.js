import { $$, $sync } from 'silmaril';

$$(() => {
  let name = 'Ada';

  function greeting() {
    return `Hello, ${name}`;
  }

  $sync(console.log(greeting()));

  name = 'Grace';
});
