import { $$root, $$get, $$set, $$sync } from 'silmaril';

// slots: 0 prefix, 1 format. format is written, so it has a slot and is not
// followed as a local function. The $sync reads the format slot only.
// entry 0: $sync of format(1)
const $g0 = [[], [0]];

let setPrefix;
let loud;

$$root($g0, ($s) => {
  $$set($s, 0, 'a');
  const sep = '';
  if ($$get($s, 0)) {
    $$set($s, 1, (value) => `${sep}${value}`);
    $$sync($s, 0, () => log($$get($s, 1)(1)));
    loud = () => {
      $$set($s, 1, (value) => `${$$get($s, 0)}:${value}!`);
    };
  }
  setPrefix = (value) => {
    $$set($s, 0, value);
  };
});

setPrefix('b');
loud();
setPrefix('c');
