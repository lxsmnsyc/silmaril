import { $$sync as _$$sync } from "silmaril";
import { $$update as _$$update } from "silmaril";
import { $$context as _$$context } from "silmaril";
import { $$, $sync } from 'silmaril';
$$(() => {
  let /*$skip*/_context = _$$context();
  let y = 0;
  _$$sync(_context, () => [_$$context, y], () => {
    let /*$skip*/_context2 = _$$context();
    return console.log('Count', y);
  });
  _$$update(_context, y += 100);
});