import { $$, $sync } from 'silmaril';

$$(() => {
  let a = 0;
  let b = 0;
  let rest = [];
  const target = { p: 0 };
  $sync(log('values', a, b, rest));
  log(
    'result',
    String(
      ([a, { q: b = a * 10 } = {}, target.p, ...rest] = [
        1,
        undefined,
        7,
        8,
        9,
      ]),
    ),
  );
  log('target', target.p);
  ({ a, ...rest } = { a: 2, z: 3 });

  let [first = 5, ...others] = [undefined, 1];
  $sync(log('first', first, others));
  [first, others] = [first + 1, []];
});
