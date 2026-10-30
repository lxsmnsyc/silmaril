import { $$, onMount, onDestroy } from 'silmaril';

const stop = $$(() => {
  onMount(() => {
    console.log('Mounted!');
  });
  onDestroy(() => {
    console.log('Destroyed!');
  });
  console.log('Not mounted yet!');
});

stop();
