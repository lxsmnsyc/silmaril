// Static-graph runtime. The contract is roadmaps/silmaril-0.5/contracts/reactivity-runtime.md.

export interface Store<T> {
  get(): T;
  set?: (value: T) => void;
  subscribe(callback: () => void): () => void;
}

// graph[slot] lists the entries that read the slot.
// A number is an entry id in the same scope.
// [e1, ..., eN, id] is entry `id` in the child scope of e1's last run,
// then of e2's last run in that scope, and so on.
export type Ref = number | readonly number[];
export type Graph = readonly (readonly Ref[] | undefined)[];

type Fn = (scope: Scope) => unknown;
type Item = Scope | (() => void);

// An entry of a scope: a memo, a store write-back, a $sync or a $.
interface Entry {
  // Scope, id in the scope and kind.
  s: Scope;
  i: number;
  k: number;
  // Function and graph of the slots it declares.
  f: Fn;
  h: Graph | undefined;
  // Memo output slot, -1 for none.
  w: number;
  // Child scope of the last run.
  c: Scope | undefined;
  // Queued.
  q: boolean;
}

export interface Scope {
  // Parent, rank, depth and graph.
  p: Scope | undefined;
  x: number;
  d: number;
  g: Graph;
  // Slot values.
  v: unknown[];
  // Entries by id, and in registration order.
  e: Entry[];
  l: Entry[];
  // Composable calls.
  n: number;
  // onMount callbacks and unmounted composable scopes.
  o: Item[];
  // onDestroy callbacks, unsubscribes and composable scopes.
  u: Item[];
  // Alive and mounted.
  a: boolean;
  m: boolean;
}

const MEMO = 0;
const SYNC = 1;
const EFFECT = 2;
const EMPTY: Graph = [];
// Rank of composable scopes: after every entry child scope of the parent.
const COMPOSABLE = 2 ** 30;
// Entry runs per drain or per $ flush before the loop guard stops it.
const LIMIT = 10_000;

// Scope of the setup or entry run that is executing, for $composable.
let CURRENT: Scope | undefined;
// Queued entries by kind, in run order.
const QUEUES: Entry[][] = [[], [], []];
// Resolvers of tick() promises.
const WAITERS: (() => void)[] = [];
// Per kind, MEMO and SYNC: entries of that kind are running.
// MEMO busy: a write only queues. SYNC busy: a write runs memos, then returns.
const BUSY = [false, false];
// Per kind: the queue has entries added since it was last sorted.
const UNSORTED = [false, false, false];
let scheduled = false;

let roots = 0;
// Entry runs of the current synchronous drain, for the loop guard.
let runs = 0;
// First error of the synchronous batch, as [error].
let error: [unknown] | undefined;

// rank: entry id for an entry child scope, COMPOSABLE + call index for a
// composable scope, creation count for a root.
function scope(
  parent: Scope | undefined,
  graph: Graph | undefined,
  rank: number,
): Scope {
  return {
    p: parent,
    x: rank,
    d: parent ? parent.d + 1 : 0,
    g: graph || EMPTY,
    v: [],
    e: [],
    l: [],
    n: 0,
    o: [],
    u: [],
    a: true,
    m: false,
  };
}

// Total order of entries: lower depth first. At the same depth, compare
// the ranks of the two branches under the closest common ancestor.
function before(a: Entry, b: Entry): boolean {
  let i = a.i;
  let j = b.i;
  let s = a.s;
  let t = b.s;
  if (s.d !== t.d) {
    return s.d < t.d;
  }
  while (s !== t) {
    i = s.x;
    j = t.x;
    s = s.p!;
    t = t.p!;
  }
  return i < j;
}

// Takes the first entry of a queue. A queue is sorted when something was
// queued in it since its last take, so n queued entries cost O(n log n).
function take(kind: number): Entry {
  const queue = QUEUES[kind]!;
  if (UNSORTED[kind]) {
    UNSORTED[kind] = false;
    queue.sort((a, b) => (before(a, b) ? -1 : 1));
  }
  const entry = queue.shift()!;
  entry.q = false;
  return entry;
}

function enqueue(entry: Entry): void {
  const queue = QUEUES[entry.k]!;
  queue.push(entry);
  UNSORTED[entry.k] = true;
  entry.q = true;
  if (entry.k === EFFECT) {
    schedule();
  }
}

function schedule(): void {
  if (!scheduled) {
    scheduled = true;
    queueMicrotask(flushEffects);
  }
}

function rethrow(held: [unknown] | undefined): void {
  if (held) {
    throw held[0];
  }
}

function mark(s: Scope, slot: number): void {
  const refs = s.g[slot];
  if (refs) {
    for (const ref of refs) {
      // A path goes through the child scope of each entry but the last.
      const path = [ref].flat();
      const id = path.pop()!;
      let t: Scope | undefined = s;
      for (const step of path) {
        t = t?.e[step]?.c;
      }
      const entry = t?.e[id];
      // A running entry can be queued: it runs again after it returns.
      if (entry && t!.a && !entry.q) {
        enqueue(entry);
      }
    }
  }
}

function run(entry: Entry): void {
  const s = entry.s;
  if (!s.a) {
    return;
  }
  // A queued ancestor entry will dispose this scope when it runs.
  for (let t = s; t.p; t = t.p) {
    if (t.p.e[t.x]?.q) {
      return;
    }
  }
  if (entry.c) {
    dispose(entry.c);
  }
  const child = scope(s, entry.h, entry.i);
  entry.c = child;
  const prev = CURRENT;
  CURRENT = child;
  let value: unknown;
  try {
    value = entry.f(child);
  } catch (e) {
    dispose(child);
    throw e;
  } finally {
    CURRENT = prev;
  }
  // As in 0.4, a child scope mounts right after its run.
  mount(child);
  if (entry.w >= 0) {
    $$set(s, entry.w, value);
  }
}

// Past the limit, each entry taken from the queue throws in place of
// running, so the rest of the drain stops and its queue empties.
function drain(kind: number): void {
  const queue = QUEUES[kind]!;
  BUSY[kind] = true;
  while (queue.length) {
    const entry = take(kind);
    try {
      if (++runs > LIMIT) {
        throw new Error('Update loop');
      }
      run(entry);
    } catch (e) {
      error ||= [e];
    }
  }
  BUSY[kind] = false;
}

function flush(): void {
  if (!BUSY[MEMO]) {
    drain(MEMO);
    if (!BUSY[SYNC]) {
      drain(SYNC);
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
function flushEffects(): void {
  const queue = QUEUES[EFFECT]!;
  let held: [unknown] | undefined;
  let count = 0;
  while (queue.length) {
    const entry = take(EFFECT);
    try {
      // First runs do not count: only a run again can be part of a loop.
      if (entry.c && ++count > LIMIT) {
        throw new Error('Update loop');
      }
      run(entry);
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
function each(list: Item[], fn: (s: Scope) => void): void {
  for (const item of list) {
    if (typeof item === 'function') {
      item();
    } else {
      fn(item);
    }
  }
}

function mount(s: Scope): void {
  if (s.a && !s.m) {
    s.m = true;
    const callbacks = s.o;
    s.o = [];
    each(callbacks, mount);
  }
}

function dispose(s: Scope): void {
  if (s.a) {
    s.a = false;
    for (const entry of s.l) {
      if (entry.c) {
        dispose(entry.c);
      }
    }
    each(s.u, dispose);
  }
}

function register(
  s: Scope,
  i: number,
  k: number,
  f: Fn,
  h?: Graph,
  w = -1,
): Entry {
  const entry: Entry = { s, i, k, f, h, w, c: undefined, q: false };
  s.e[i] = entry;
  s.l.push(entry);
  return entry;
}

// First run of a memo or $sync, with its phase marked busy, then the
// rest of the batch if this call is the outermost.
function enter(entry: Entry): void {
  const busy = BUSY[entry.k]!;
  BUSY[entry.k] = true;
  try {
    run(entry);
  } catch (e) {
    error ||= [e];
  }
  BUSY[entry.k] = busy;
  flush();
}

export function $$root(
  graph: Graph,
  setup: (scope: Scope) => void,
): () => void {
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

export function $$composable<A extends unknown[], R>(
  graph: Graph,
  setup: (scope: Scope, ...args: A) => R,
): (...args: A) => R {
  return (...args) => {
    const parent = CURRENT;
    if (!parent) {
      throw new Error('Unexpected missing reactive boundary.');
    }
    const s = scope(parent, graph, COMPOSABLE + parent.n++);
    CURRENT = s;
    let result: R;
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

export function $$get(s: Scope, slot: number): any {
  return s.v[slot];
}

export function $$set<T>(s: Scope, slot: number, value: T): T {
  if (!Object.is(s.v[slot], value)) {
    s.v[slot] = value;
    if (s.a) {
      mark(s, slot);
      flush();
    }
  }
  return value;
}

export function $$update(
  s: Scope,
  slot: number,
  delta: 1 | -1,
  prefix: boolean,
): number {
  let n = s.v[slot] as number;
  const result = delta > 0 ? (prefix ? ++n : n++) : prefix ? --n : n--;
  $$set(s, slot, n);
  return result;
}

export function $$memo(s: Scope, id: number, slot: number, compute: Fn): void {
  enter(register(s, id, MEMO, compute, undefined, slot));
}

export function $$sync(s: Scope, id: number, body: Fn, graph?: Graph): void {
  enter(register(s, id, SYNC, body, graph));
}

export function $$effect(s: Scope, id: number, body: Fn, graph?: Graph): void {
  enqueue(register(s, id, EFFECT, body, graph));
}

export function $$store<T>(
  s: Scope,
  slot: number,
  store: Store<T>,
  id?: number,
): void {
  s.v[slot] = store.get();
  if (id !== undefined) {
    // As in 0.4, the write-back runs once at registration and after each
    // change of the slot, with the memos, so the store is fresh when the
    // write returns.
    enter(register(s, id, MEMO, () => store.set!(s.v[slot] as T)));
  }
  s.u.push(store.subscribe(() => $$set(s, slot, store.get())));
}

export function $$mount(s: Scope, callback: () => void): void {
  if (s.a) {
    if (s.m) {
      callback();
    } else {
      s.o.push(callback);
    }
  }
}

export function $$destroy(s: Scope, callback: () => void): void {
  if (s.a) {
    s.u.push(callback);
  } else {
    callback();
  }
}

export function tick(): Promise<void> {
  return new Promise((resolve) => {
    WAITERS.push(resolve);
    schedule();
  });
}

// As in 0.4, $$ and $composable work without the compiler, with no
// reactivity: for namespace calls and modules the compiler skips.
export function $$(setup: () => void): () => void {
  return $$root(EMPTY, () => setup());
}

export function $composable<T extends (...args: any[]) => any>(setup: T): T {
  return setup;
}

function compileTimeOnly(name: string): (...args: any[]) => never {
  return () => {
    throw new Error(`${name} is meant to be compile-time only.`);
  };
}

export const $: <T>(value: T) => void = compileTimeOnly('$');
export const $sync: <T>(value: T) => void = compileTimeOnly('$sync');
export const $skip: <T>(value: T) => T = compileTimeOnly('$skip');
export const $store: <T>(store: Store<T>) => T = compileTimeOnly('$store');
export const onMount: (callback: () => void) => void =
  compileTimeOnly('onMount');
export const onDestroy: (callback: () => void) => void =
  compileTimeOnly('onDestroy');
