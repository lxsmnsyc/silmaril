import { $$, $sync, $composable, $store, onDestroy } from 'silmaril';
import Store from 'silmaril/store';

// A composable has its own reactive scope
const useSquared = $composable((store) => {
  const input = $store(store);
  const squaredStore = new Store(0);

  onDestroy(() => squaredStore.destroy());

  // Runs again each time `input` changes
  $sync(squaredStore.set(input ** 2));

  return squaredStore;
});

$$(() => {
  const store = new Store(0);
  let input = $store(store);

  $sync(console.log('Value', input));

  const squared = $store(useSquared(store));

  $sync(console.log('Squared', squared));

  input = 100;
});
