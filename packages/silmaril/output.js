import { $$effect as _$$effect } from "silmaril";
import { $$update as _$$update } from "silmaril";
import { $$subscribe as _$$subscribe } from "silmaril";
import { $$context as _$$context } from "silmaril";
import { $, $$, $store } from 'silmaril';
$$(() => {
  let /*$skip*/_context = _$$context();
  let _store = someStore,
    example = _store.get(),
    _subscribe = _$$subscribe(_context, _store, () => _$$update(_context, example = _store.get()), () => [example], () => _store.get(example));
  _$$effect(_context, () => [_$$context, example], () => {
    let /*$skip*/_context2 = _$$context();
    return console.log(example);
  });
});