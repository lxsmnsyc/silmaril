import { $$, $sync, onDestroy } from 'silmaril';

let setOuter;
let stopInner;

const stopOuter = $$(() => {
  let outer = 0;
  stopInner = $$(() => {
    $sync(log('inner reads outer', outer));
    onDestroy(() => log('inner destroyed'));
  });
  onDestroy(() => log('outer destroyed'));
  setOuter = (value) => {
    outer = value;
  };
});

setOuter(1);
stopOuter();
stopInner();
