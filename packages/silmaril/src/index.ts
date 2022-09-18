/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { unwrap, pcall } from './pcall';

interface Instance {
  alive: boolean;
  mounted: boolean;
  signals: any[][];
  timeout?: ReturnType<typeof setTimeout>;
  instances: Instance[];
  syncs: (() => void)[];
  effects: (() => void)[];
  mounts: (() => void)[];
  destroys: (() => void)[];
  count: number;
}

let CURRENT: Instance | undefined;

function runWithInstance(instance: Instance | undefined, callback: () => void) {
  const parent = CURRENT;
  CURRENT = instance;
  const result = pcall(callback);
  CURRENT = parent;
  return unwrap(result);
}

function createInstance(): Instance {
  return {
    alive: true,
    mounted: false,
    count: 0,
    signals: [],
    syncs: [],
    effects: [],
    mounts: [],
    destroys: [],
    instances: [],
  };
}

function flushSync(instance: Instance) {
  if (instance.alive) {
    runWithInstance(instance, () => {
      for (let i = 0, len = instance.syncs.length; i < len; i += 1) {
        instance.syncs[i]();
      }
    });
  }
}

function flushEffects(instance: Instance) {
  if (instance.alive) {
    for (let i = 0, len = instance.effects.length; i < len; i += 1) {
      instance.effects[i]();
    }
  }
}

function mount(instance: Instance) {
  if (instance.alive) {
    instance.mounted = true;

    for (let i = 0, len = instance.mounts.length; i < len; i += 1) {
      instance.mounts[i]();
    }
    instance.timeout = setTimeout(() => {
      if (instance.alive) {
        flushEffects(instance);
      }
    });
  }
}

function destroy(instance: Instance) {
  if (instance.alive) {
    instance.alive = false;

    for (let i = 0, len = instance.instances.length; i < len; i += 1) {
      destroy(instance.instances[i]);
    }
    for (let i = 0, len = instance.destroys.length; i < len; i += 1) {
      instance.destroys[i]();
    }
  }
}

function create(setup: () => void) {
  const instance = createInstance();
  runWithInstance(instance, () => {
    setup();
    mount(instance);
  });
  return instance;
}

function changed(signals: any[][], index: number, next: any[]) {
  const current = signals[index];

  signals[index] = next;
  if (!current) {
    return true;
  }
  for (let i = 0, len = next.length; i < len; i += 1) {
    if (!Object.is(current[i], next[i])) {
      return true;
    }
  }
  return false;
}

/**
 * @private
 */
export function $$update<T>(instance: Instance, value: T): T {
  if (instance.alive) {
    flushSync(instance);

    if (instance.timeout) {
      clearTimeout(instance.timeout);
    }
    instance.timeout = setTimeout(() => {
      if (instance.alive) {
        flushEffects(instance);
      }
    });
  }
  return value;
}

/**
 * @private
 */
export function $$sync(
  next: () => any[],
  callback: () => void,
) {
  if (CURRENT && CURRENT.alive) {
    const instance = CURRENT;
    const index = instance.count;
    instance.count += 1;
    const cb = () => {
      if (instance.alive && changed(instance.signals, index, next())) {
        const prev = instance.instances[index];
        if (prev) {
          destroy(prev);
        }
        instance.instances[index] = create(callback);
      }
    };
    cb();
    instance.syncs.push(cb);
  }
}

/**
 * @private
 */
export function $$effect(
  next: () => any[],
  callback: () => void,
) {
  if (CURRENT && CURRENT.alive) {
    const instance = CURRENT;
    const index = instance.count;
    instance.count += 1;
    instance.effects.push(() => {
      if (instance.alive && changed(instance.signals, index, next())) {
        const prev = instance.instances[index];
        if (prev) {
          destroy(prev);
        }
        instance.instances[index] = create(callback);
      }
    });
  }
}

/**
 * @private
 */
export function $$context(): Instance {
  if (CURRENT) {
    return CURRENT;
  }
  throw new Error('Unexpected missing reactive boundary.');
}

export function onMount(callback: () => void): void {
  if (CURRENT && CURRENT.alive) {
    CURRENT.mounts.push(callback);
  }
}

export function onDestroy(callback: () => void): void {
  if (CURRENT && CURRENT.alive) {
    CURRENT.destroys.push(callback);
  }
}

export function $$(setup: () => void): () => void {
  const instance = create(setup);
  return () => {
    destroy(instance);
  };
}

export function $composable<T extends((...args: any) => any)>(setup: T): T {
  return setup;
}

export function $<T>(value: T): void {
  throw new Error('$ is meant to be compile-time only.');
}

export function $sync<T>(value: T): void {
  throw new Error('$sync is meant to be compile-time only.');
}

export function $skip<T>(value: T): T {
  throw new Error('$skip is meant to be compile-time only.');
}

export interface Store<T> {
  get(): T;
  set?: (value: T) => void;
  subscribe(callback: () => void): () => void;
}

export function $store<T>(store: Store<T>): T {
  throw new Error('$store is meant to be compile-time only.');
}

/**
 * @private
 */
export function $$subscribe<T>(
  store: Store<T>,
  listen: () => void,
  dependencies?: () => any[],
  update?: () => void,
) {
  if (dependencies && update) {
    $$sync(dependencies, update);
  }
  onDestroy(store.subscribe(listen));
}
