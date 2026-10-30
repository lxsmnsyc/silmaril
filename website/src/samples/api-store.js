import { $$, $sync, $store } from 'silmaril';
import Store from 'silmaril/store';

const count = new Store(1);

count.subscribe(() => {
  console.log('Store:', count.get());
});

$$(() => {
  let current = $store(count);

  $sync(console.log('Variable:', current));

  current += 1;
});
