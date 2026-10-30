import { $$, $sync } from 'silmaril';

$$(() => {
  let item = '';
  let key = '';
  let left = 0;
  let right = 0;
  $sync(log('item', item));
  $sync(log('key', key));
  $sync(log('pair', left, right));
  for (item of ['a', 'b']) {
    log('loop', item);
  }
  for (key in { x: 1, y: 2 }) {
    log('key loop', key);
  }
  for ([left, right] of [[1, 2]]) {
    log('pair loop');
  }
});
