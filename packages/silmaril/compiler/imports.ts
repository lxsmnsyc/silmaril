import type { ImportDefinition } from './types';

export const SOURCE_MODULE = 'silmaril';

export interface HiddenImports {
  context: ImportDefinition;
  update: ImportDefinition;
  effect: ImportDefinition;
  sync: ImportDefinition;
  subscribe: ImportDefinition;
  mount: ImportDefinition;
  destroy: ImportDefinition;
}

export const HIDDEN_IMPORTS: HiddenImports = {
  context: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$context',
  },
  update: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$update',
  },
  effect: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$effect',
  },
  sync: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$sync',
  },
  subscribe: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$subscribe',
  },
  mount: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$mount',
  },
  destroy: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$destroy',
  },
};

export interface TrackedImports {
  $$: ImportDefinition;
  $: ImportDefinition;
  $skip: ImportDefinition;
  $sync: ImportDefinition;
  $store: ImportDefinition;
  $composable: ImportDefinition;
  onMount: ImportDefinition;
  onDestroy: ImportDefinition;
}

export const TRACKED_IMPORTS: TrackedImports = {
  $$: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$$',
  },
  $: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$',
  },
  $skip: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$skip',
  },
  $sync: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$sync',
  },
  $store: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$store',
  },
  $composable: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: '$composable',
  },
  onMount: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: 'onMount',
  },
  onDestroy: {
    kind: 'named',
    source: SOURCE_MODULE,
    name: 'onDestroy',
  },
};
