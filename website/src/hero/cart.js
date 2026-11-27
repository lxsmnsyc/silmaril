import { $$, $ } from 'silmaril';

export function cart(ui) {
  return $$(() => {
    let quantity = 1;
    let note = '';
    const total = quantity * 12;

    $(ui.show('total', total));
    $(ui.show('note', note));

    ui.add = () => (quantity += 1);
    ui.write = (text) => (note = text);
  });
}
