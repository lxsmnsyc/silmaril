import { $$, $, $sync, $store } from 'silmaril';
import Store from 'silmaril/store';

const count = new Store(100);

count.subscribe((current) => {
  console.log('Raw Count:', current);
});

$$(() => {
  // Two-way binding. `const` would bind in one direction only.
  let current = $store(count);

  $sync(console.log('Sync Count:', current));
  $(console.log('Async Count:', current));

  // Writes the variable and the store
  current += 100;
});
