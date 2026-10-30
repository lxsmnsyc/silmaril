import { $$, $sync, onMount, onDestroy } from 'silmaril';

let setCount;

const stop = $$(() => {
  let count = 0;
  onMount(() => log('mount root'));
  onDestroy(() => log('destroy root'));
  $sync(() => {
    log('count', count);
    onMount(() => log('mount child'));
    onDestroy(() => log('destroy child'));
  });
  setCount = (value) => {
    count = value;
  };
  log('setup');
});

log('before stop');
stop();
stop();
setCount(1);
log('done');
