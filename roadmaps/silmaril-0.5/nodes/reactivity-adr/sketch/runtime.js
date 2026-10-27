// Reference sketch of the reactivity-runtime contract. Not shipped.
// It exists to check the fixtures' expected logs and to estimate size.
// runtime-v2 writes the real runtime in packages/silmaril/src/v2/.

const MEMO = 0;
const SYNC = 1;
const EFFECT = 2;
const EMPTY = [];

// Scope of the setup or entry run that is executing, for $composable.
let CURRENT;
// Entry that is running: its own writes do not queue it again.
let RUN_SCOPE;
let RUN_ID;
// Queues hold pairs: scope, entry id.
const MEMOS = [];
const SYNCS = [];
const EFFECTS = [];
let memoBusy = false;
let syncBusy = false;
let scheduled = false;
let error;

function scope(parent, graph) {
  return {
    p: parent,
    d: parent ? parent.d + 1 : 0,
    g: graph || EMPTY,
    v: [], // slot values
    f: [], // entry functions by id
    k: [], // entry kinds by id
    h: [], // child graphs by entry id
    w: [], // memo output slot by entry id
    c: [], // child scope of the last run, by entry id
    q: [], // queued flags by entry id
    n: [], // composable scopes
    o: [], // onMount callbacks
    u: [], // onDestroy callbacks and unsubscribes
    a: true, // alive
    m: false, // mounted
  };
}

function take(queue) {
  let best = 0;
  for (let i = 2; i < queue.length; i += 2) {
    const a = queue[i];
    const b = queue[best];
    if (a.d < b.d || (a === b && queue[i + 1] < queue[best + 1])) {
      best = i;
    }
  }
  return queue.splice(best, 2);
}

function schedule() {
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flushEffects);
  }
}

function mark(s, slot) {
  const refs = s.g[slot];
  if (refs) {
    for (const ref of refs) {
      let t = s;
      let id = ref;
      if (typeof ref !== 'number') {
        const last = ref.length - 1;
        for (let i = 0; t && i < last; i++) {
          t = t.c[ref[i]];
        }
        id = ref[last];
      }
      if (
        t &&
        t.a &&
        t.f[id] &&
        !t.q[id] &&
        !(t === RUN_SCOPE && id === RUN_ID)
      ) {
        t.q[id] = true;
        const kind = t.k[id];
        (kind === MEMO ? MEMOS : kind === SYNC ? SYNCS : EFFECTS).push(t, id);
        if (kind === EFFECT) {
          schedule();
        }
      }
    }
  }
}

function run(s, id) {
  s.q[id] = false;
  if (!s.a) {
    return;
  }
  const old = s.c[id];
  if (old) {
    dispose(old);
  }
  const child = scope(s, s.h[id]);
  s.c[id] = child;
  const prevCurrent = CURRENT;
  const prevScope = RUN_SCOPE;
  const prevId = RUN_ID;
  CURRENT = child;
  RUN_SCOPE = s;
  RUN_ID = id;
  let value;
  try {
    value = s.f[id](child);
  } finally {
    CURRENT = prevCurrent;
    RUN_SCOPE = prevScope;
    RUN_ID = prevId;
  }
  if (s.m) {
    mount(child);
  }
  if (s.k[id] === MEMO && s.w[id] >= 0) {
    $$set(s, s.w[id], value);
  }
}

function drain(queue) {
  while (queue.length) {
    const [s, id] = take(queue);
    try {
      run(s, id);
    } catch (e) {
      error ||= [e];
    }
    if (queue === SYNCS) {
      drainMemos();
    }
  }
}

function drainMemos() {
  if (!memoBusy) {
    memoBusy = true;
    try {
      drain(MEMOS);
    } finally {
      memoBusy = false;
    }
  }
}

function flush() {
  if (memoBusy) {
    return;
  }
  drainMemos();
  if (!syncBusy) {
    syncBusy = true;
    try {
      drain(SYNCS);
    } finally {
      syncBusy = false;
    }
    if (error) {
      const [e] = error;
      error = undefined;
      throw e;
    }
  }
}

function flushEffects() {
  try {
    drain(EFFECTS);
  } finally {
    scheduled = false;
  }
  if (error) {
    const [e] = error;
    error = undefined;
    throw e;
  }
}

function mount(s) {
  if (s.a && !s.m) {
    s.m = true;
    for (const c of s.c) {
      if (c) {
        mount(c);
      }
    }
    for (const c of s.n) {
      mount(c);
    }
    const callbacks = s.o;
    s.o = [];
    for (const cb of callbacks) {
      cb();
    }
  }
}

function dispose(s) {
  if (s.a) {
    s.a = false;
    for (const c of s.c) {
      if (c) {
        dispose(c);
      }
    }
    for (const c of s.n) {
      dispose(c);
    }
    for (const cb of s.u) {
      cb();
    }
  }
}

function register(s, id, kind, fn, graph) {
  s.f[id] = fn;
  s.k[id] = kind;
  s.h[id] = graph;
}

export function $$root(graph, setup) {
  const s = scope(undefined, graph);
  const prev = CURRENT;
  CURRENT = s;
  try {
    setup(s);
  } finally {
    CURRENT = prev;
  }
  mount(s);
  return () => dispose(s);
}

export function $$composable(graph, setup) {
  return (...args) => {
    const parent = CURRENT;
    if (!parent) {
      throw new Error('A $composable was called outside a reactive scope.');
    }
    const s = scope(parent, graph);
    parent.n.push(s);
    CURRENT = s;
    try {
      return setup(s, ...args);
    } finally {
      CURRENT = parent;
      if (parent.m) {
        mount(s);
      }
    }
  };
}

export function $$get(s, slot) {
  return s.v[slot];
}

export function $$set(s, slot, value) {
  if (!Object.is(s.v[slot], value)) {
    s.v[slot] = value;
    if (s.a) {
      mark(s, slot);
      flush();
    }
  }
  return value;
}

export function $$update(s, slot, delta, prefix) {
  let n = s.v[slot];
  const result = delta > 0 ? (prefix ? ++n : n++) : prefix ? --n : n--;
  $$set(s, slot, n);
  return result;
}

export function $$memo(s, id, slot, compute) {
  register(s, id, MEMO, compute);
  s.w[id] = slot;
  run(s, id);
}

export function $$sync(s, id, body, graph) {
  register(s, id, SYNC, body, graph);
  run(s, id);
}

export function $$effect(s, id, body, graph) {
  register(s, id, EFFECT, body, graph);
  s.q[id] = true;
  EFFECTS.push(s, id);
  schedule();
}

export function $$store(s, slot, store, id) {
  s.v[slot] = store.get();
  s.u.push(store.subscribe(() => $$set(s, slot, store.get())));
  if (id !== undefined) {
    register(s, id, SYNC, () => {
      const value = s.v[slot];
      if (!Object.is(store.get(), value)) {
        store.set(value);
      }
    });
  }
}

export function $$mount(s, callback) {
  if (s.a) {
    if (s.m) {
      callback();
    } else {
      s.o.push(callback);
    }
  }
}

export function $$destroy(s, callback) {
  if (s.a) {
    s.u.push(callback);
  } else {
    callback();
  }
}

function compileTimeOnly(name) {
  return () => {
    throw new Error(`${name} is meant to be compile-time only.`);
  };
}

export const $$ = compileTimeOnly('$$');
export const $ = compileTimeOnly('$');
export const $sync = compileTimeOnly('$sync');
export const $skip = compileTimeOnly('$skip');
export const $store = compileTimeOnly('$store');
export const $composable = compileTimeOnly('$composable');
export const onMount = compileTimeOnly('onMount');
export const onDestroy = compileTimeOnly('onDestroy');
