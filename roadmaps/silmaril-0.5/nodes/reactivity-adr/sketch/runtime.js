// Reference sketch of the reactivity-runtime contract. Not shipped.
// It exists to check the fixtures' expected logs and to estimate size.
// runtime-v2 writes the real runtime in packages/silmaril/src/v2/.

const MEMO = 0;
const SYNC = 1;
const EFFECT = 2;
const EMPTY = [];
// Rank of composable scopes: after every entry child scope of the parent.
const COMPOSABLE = 2 ** 30;

// Scope of the setup or entry run that is executing, for $composable.
let CURRENT;
// Queues hold pairs: scope, entry id.
const MEMOS = [];
const SYNCS = [];
const EFFECTS = [];
// Resolvers of tick() promises.
const WAITERS = [];
// memoBusy: memos are running. A write only queues.
// syncBusy: a $sync body is running. A write runs memos, then returns.
let memoBusy = false;
let syncBusy = false;
let scheduled = false;
let roots = 0;
// First error of the synchronous batch, as [error].
let error;

// rank: entry id for an entry child scope, COMPOSABLE + call index for a
// composable scope, creation count for a root.
function scope(parent, graph, rank) {
  return {
    p: parent,
    x: rank,
    d: parent ? parent.d + 1 : 0,
    g: graph || EMPTY,
    v: [], // slot values
    f: [], // entry functions by id
    k: [], // entry kinds by id
    h: [], // child graphs by entry id
    w: [], // memo output slot by entry id
    c: [], // child scope of the last run, by entry id
    q: [], // queued flags by entry id
    r: [], // running flags by entry id
    n: [], // composable scopes
    o: [], // onMount callbacks
    u: [], // onDestroy callbacks and unsubscribes
    a: true, // alive
    m: false, // mounted
  };
}

// Total order of entries: lower depth first. At the same depth, compare
// the ranks of the two branches under the closest common ancestor.
function before(a, i, b, j) {
  if (a.d !== b.d) {
    return a.d < b.d;
  }
  while (a !== b) {
    i = a.x;
    j = b.x;
    a = a.p;
    b = b.p;
  }
  return i < j;
}

function take(queue) {
  let best = 0;
  for (let i = 2; i < queue.length; i += 2) {
    if (before(queue[i], queue[i + 1], queue[best], queue[best + 1])) {
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

function rethrow(held) {
  if (held) {
    throw held[0];
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
      if (t && t.a && t.f[id] && !t.q[id] && !t.r[id]) {
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
  // A queued ancestor entry will dispose this scope when it runs.
  for (let t = s; t.p; t = t.p) {
    if (t.p.q[t.x]) {
      return;
    }
  }
  const old = s.c[id];
  if (old) {
    dispose(old);
  }
  const child = scope(s, s.h[id], id);
  s.c[id] = child;
  const prev = CURRENT;
  CURRENT = child;
  s.r[id] = true;
  let value;
  try {
    value = s.f[id](child);
  } catch (e) {
    dispose(child);
    throw e;
  } finally {
    CURRENT = prev;
    s.r[id] = false;
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
  }
}

function flush() {
  if (!memoBusy) {
    memoBusy = true;
    drain(MEMOS);
    memoBusy = false;
    if (!syncBusy) {
      syncBusy = true;
      drain(SYNCS);
      syncBusy = false;
      const held = error;
      error = undefined;
      rethrow(held);
    }
  }
}

function flushEffects() {
  let held;
  while (EFFECTS.length) {
    const [s, id] = take(EFFECTS);
    try {
      run(s, id);
    } catch (e) {
      held ||= [e];
    }
  }
  scheduled = false;
  for (const resolve of WAITERS.splice(0)) {
    resolve();
  }
  rethrow(held);
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

// First run of a memo or $sync, with its phase marked busy, then the
// rest of the batch if this call is the outermost.
function enter(s, id, kind) {
  const memo = kind === MEMO;
  const busy = memo ? memoBusy : syncBusy;
  if (memo) {
    memoBusy = true;
  } else {
    syncBusy = true;
  }
  try {
    run(s, id);
  } catch (e) {
    error ||= [e];
  }
  if (memo) {
    memoBusy = busy;
  } else {
    syncBusy = busy;
  }
  flush();
}

export function $$root(graph, setup) {
  const s = scope(undefined, graph, roots++);
  const prev = CURRENT;
  CURRENT = s;
  try {
    setup(s);
  } catch (e) {
    dispose(s);
    throw e;
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
    const s = scope(parent, graph, COMPOSABLE + parent.n.length);
    parent.n.push(s);
    CURRENT = s;
    let result;
    try {
      result = setup(s, ...args);
    } catch (e) {
      dispose(s);
      parent.n.pop();
      throw e;
    } finally {
      CURRENT = parent;
    }
    if (parent.m) {
      mount(s);
    }
    return result;
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
  enter(s, id, MEMO);
}

export function $$sync(s, id, body, graph) {
  register(s, id, SYNC, body, graph);
  enter(s, id, SYNC);
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
    // The write-back runs with the memos, so the store is fresh when the
    // write returns. It has no first run.
    register(s, id, MEMO, () => {
      const value = s.v[slot];
      if (!Object.is(store.get(), value)) {
        store.set(value);
      }
    });
    s.w[id] = -1;
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

export function tick() {
  return new Promise((resolve) => {
    WAITERS.push(resolve);
    schedule();
  });
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
