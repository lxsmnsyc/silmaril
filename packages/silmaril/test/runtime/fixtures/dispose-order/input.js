import { $$, $, $sync, onDestroy, tick } from 'silmaril';

const stop = $$(() => {
  onDestroy(() => log('root'));
  $(() => {
    onDestroy(() => log('$ child'));
  });
  $sync(() => {
    onDestroy(() => log('$sync child'));
  });
});

await tick();
stop();
