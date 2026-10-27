// Reference sketch of the reactivity-runtime contract. Not shipped.
// It exists to check the fixtures' expected logs and to estimate size.
// runtime-v2 writes the real runtime in packages/silmaril/src/v2/.

const MEMO = 0;
const SYNC = 1;
const EFFECT = 2;
const EMPTY = [];
// Rank of composable scopes: after every entry child scope of the parent.
const COMPOSABLE = 2 ** 30;
// Entry runs per drain or per $ flush before the loop guard stops it.
const LIMIT = 10_000;

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
// Entry runs of the current synchronous drain, for the loop guard.
let runs = 0;
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
    l: [], // entry ids in registration order
    n: 0, // composable calls
    o: [], // onMount callbacks, and unmounted composable scopes
    u: [], // onDestroy callbacks, unsubscribes and composable scopes
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
  const [s, id] = queue.splice(best, 2);
  s.q[id] = false;
  return [s, id];
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
      // A running entry can be queued: it runs again after it returns.
      if (t && t.a && t.f[id] && !t.q[id]) {
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
  let value;
  try {
    value = s.f[id](child);
  } catch (e) {
    dispose(child);
    throw e;
  } finally {
    CURRENT = prev;
  }
  // As in 0.4, a child scope mounts right after its run.
  mount(child);
  if (s.k[id] === MEMO && s.w[id] >= 0) {
    $$set(s, s.w[id], value);
  }
}

// Past the limit, each entry taken from the queue throws in place of
// running, so the rest of the drain stops and its queue empties.
function drain(queue) {
  while (queue.length) {
    const [s, id] = take(queue);
    try {
      if (++runs > LIMIT) {
        throw new Error('Update loop');
      }
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
      // The outermost drain ended: the next write starts a new count.
      runs = 0;
      const held = error;
      error = undefined;
      rethrow(held);
    }
  }
}

// The $ flush has its own count. Writes in a $ body drain with the count
// above, which starts again after each of them.
function flushEffects() {
  let held;
  let count = 0;
  while (EFFECTS.length) {
    const [s, id] = take(EFFECTS);
    try {
      // First runs do not count: only a run again can be part of a loop.
      if (s.c[id] && ++count > LIMIT) {
        throw new Error('Update loop');
      }
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

// The lists hold callbacks and composable scopes, in call order, as the
// 0.4 instance shared by a composable and its caller did.
function each(list, fn) {
  for (const item of list) {
    if (typeof item === 'function') {
      item();
    } else {
      fn(item);
    }
  }
}

function mount(s) {
  if (s.a && !s.m) {
    s.m = true;
    const callbacks = s.o;
    s.o = [];
    each(callbacks, mount);
  }
}

function dispose(s) {
  if (s.a) {
    s.a = false;
    for (const id of s.l) {
      const c = s.c[id];
      if (c) {
        dispose(c);
      }
    }
    each(s.u, dispose);
  }
}

function register(s, id, kind, fn, graph) {
  s.f[id] = fn;
  s.k[id] = kind;
  s.h[id] = graph;
  s.l.push(id);
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
      throw new Error('Unexpected missing reactive boundary.');
    }
    const s = scope(parent, graph, COMPOSABLE + parent.n++);
    CURRENT = s;
    let result;
    try {
      result = setup(s, ...args);
    } catch (e) {
      dispose(s);
      throw e;
    } finally {
      CURRENT = parent;
    }
    parent.u.push(s);
    if (parent.m) {
      mount(s);
    } else {
      parent.o.push(s);
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
  if (id !== undefined) {
    // As in 0.4, the write-back runs once at registration and after each
    // change of the slot, with the memos, so the store is fresh when the
    // write returns.
    register(s, id, MEMO, () => store.set(s.v[slot]));
    s.w[id] = -1;
    enter(s, id, MEMO);
  }
  s.u.push(store.subscribe(() => $$set(s, slot, store.get())));
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

// As in 0.4, $$ and $composable work without the compiler, with no
// reactivity: for namespace calls and modules the compiler skips.
export function $$(setup) {
  return $$root(EMPTY, () => setup());
}

export function $composable(setup) {
  return setup;
}

function compileTimeOnly(name) {
  return () => {
    throw new Error(`${name} is meant to be compile-time only.`);
  };
}

export const $ = compileTimeOnly('$');
export const $sync = compileTimeOnly('$sync');
export const $skip = compileTimeOnly('$skip');
export const $store = compileTimeOnly('$store');
export const onMount = compileTimeOnly('onMount');
export const onDestroy = compileTimeOnly('onDestroy');
