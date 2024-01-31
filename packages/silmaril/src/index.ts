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
  try {
    return callback();
  } finally {
    CURRENT = parent;
  }
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
      for (let i = 0, len = instance.syncs.length; i < len; i++) {
        instance.syncs[i]();
      }
    });
  }
}

function flushEffects(instance: Instance) {
  if (instance.alive) {
    runWithInstance(instance, () => {
      for (let i = 0, len = instance.effects.length; i < len; i++) {
        instance.effects[i]();
      }
    });
  }
}

function scheduleFlush(instance: Instance) {
  if (instance.alive) {
    if (instance.timeout) {
      clearTimeout(instance.timeout);
    }
    instance.timeout = setTimeout(() => {
      if (instance.alive) {
        flushEffects(instance);
      }
    });
  }
}

function mount(instance: Instance) {
  if (instance.alive) {
    instance.mounted = true;

    for (let i = 0, len = instance.mounts.length; i < len; i++) {
      instance.mounts[i]();
    }
    scheduleFlush(instance);
  }
}

function destroy(instance: Instance) {
  if (instance.alive) {
    instance.alive = false;
    for (let i = 0, len = instance.instances.length; i < len; i++) {
      destroy(instance.instances[i]);
    }
    for (let i = 0, len = instance.destroys.length; i < len; i++) {
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

function isEqual(a: unknown, b: unknown): boolean {
  return a === b || (a !== a && b !== b);
}

function changed(signals: any[][], index: number, size: number, next: any[]) {
  const current = signals[index];

  signals[index] = next;
  if (!current) {
    return true;
  }
  for (let i = 0; i < size; i += 1) {
    if (!isEqual(current[i], next[i])) {
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
    scheduleFlush(instance);
  }
  return value;
}

/**
 * @private
 */
export function $$sync(
  instance: Instance,
  size: number,
  next: () => any[],
  callback: () => void,
) {
  if (instance.alive) {
    const index = instance.count;
    instance.count += 1;
    const cb = () => {
      if (instance.alive && changed(instance.signals, index, size, next())) {
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
  instance: Instance,
  size: number,
  next: () => any[],
  callback: () => void,
) {
  if (instance.alive) {
    const index = instance.count;
    instance.count += 1;
    instance.effects.push(() => {
      if (instance.alive && changed(instance.signals, index, size, next())) {
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

/**
 * @private
 */
export function $$mount(instance: Instance, callback: () => void): void {
  if (instance.alive) {
    if (instance.mounted) {
      callback();
    } else {
      instance.mounts.push(callback);
    }
  }
}

/**
 * @private
 */
export function $$destroy(instance: Instance, callback: () => void): void {
  if (instance.alive) {
    instance.destroys.push(callback);
  } else {
    callback();
  }
}

export function onMount(_callback: () => void): void {
  throw new Error('onMount is meant to be compile-time only.');
}

export function onDestroy(_callback: () => void): void {
  throw new Error('onDestroy is meant to be compile-time only.');
}

export function $$(setup: () => void): () => void {
  const instance = create(setup);
  return () => {
    destroy(instance);
  };
}

export function $composable<T extends (...args: any) => any>(setup: T): T {
  return setup;
}

export function $<T>(_value: T): void {
  throw new Error('$ is meant to be compile-time only.');
}

export function $sync<T>(_value: T): void {
  throw new Error('$sync is meant to be compile-time only.');
}

export function $skip<T>(_value: T): T {
  throw new Error('$skip is meant to be compile-time only.');
}

export interface Store<T> {
  get(): T;
  set?: (value: T) => void;
  subscribe(callback: () => void): () => void;
}

export function $store<T>(_store: Store<T>): T {
  throw new Error('$store is meant to be compile-time only.');
}

/**
 * @private
 */
export function $$subscribe<T>(
  instance: Instance,
  store: Store<T>,
  listen: () => void,
  dependencies: () => any[],
  update: () => void,
) {
  if (instance.alive) {
    $$sync(instance, 1, dependencies, update);
    $$destroy(instance, store.subscribe(listen));
  } else {
    update();
  }
}
