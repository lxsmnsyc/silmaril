import { createSignal } from 'solid-js';
import Store from 'silmaril/store';

export const countStore = new Store(0);

export const countSignal = createSignal(0);
