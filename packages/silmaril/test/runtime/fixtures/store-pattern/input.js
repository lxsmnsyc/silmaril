import { $$, $store } from 'silmaril';

const st = { get: () => ({ a: 1 }), subscribe: () => () => {} };

$$(() => {
  const { a } = $store(st);
  log(a);
});
