import { $, $$, $store } from 'silmaril';

$$(() => {
  let example = $store(someStore);

  $(console.log(example));
});
