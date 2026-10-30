import { $$, $sync } from 'silmaril';

let setPrefix;
let loud;

$$(() => {
  let prefix = 'a';
  const sep = '';
  if (prefix) {
    let format = (value) => `${sep}${value}`;
    $sync(log(format(1)));
    loud = () => {
      format = (value) => `${prefix}:${value}!`;
    };
  }
  setPrefix = (value) => {
    prefix = value;
  };
});

setPrefix('b');
loud();
setPrefix('c');
