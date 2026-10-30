import { $$, $composable, onMount, onDestroy } from 'silmaril';

const useThing = $composable(() => {
  onMount(() => log('mount thing'));
  onDestroy(() => log('destroy thing'));
});

const stop = $$(() => {
  onMount(() => log('mount A'));
  onDestroy(() => log('destroy A'));
  useThing();
  onMount(() => log('mount C'));
  onDestroy(() => log('destroy C'));
});

stop();
