import { $$, $ } from 'silmaril';

$$(() => {
  $(console.log('parent'));

  $$(() => {
    $(console.log('child'));
  });
});
