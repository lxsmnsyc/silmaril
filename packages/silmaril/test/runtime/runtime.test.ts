import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  $,
  $$,
  $$composable,
  $$destroy,
  $$effect,
  $$get,
  $$memo,
  $$mount,
  $$root,
  $$set,
  $$store,
  $$sync,
  $$update,
  $composable,
  $skip,
  $store,
  $sync,
  onDestroy,
  onMount,
  tick,
  type Scope,
  type Store,
} from '../../src';

function createStore<T>(initial: T): Store<T> & { size(): number } {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next) {
      value = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe(callback) {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    size: () => listeners.size,
  };
}

function one(): number {
  return 1;
}

const disposers: (() => void)[] = [];

function root(
  graph: Parameters<typeof $$root>[0],
  setup: (scope: Scope) => void,
): Scope {
  let result!: Scope;
  disposers.push(
    $$root(graph, (s) => {
      result = s;
      setup(s);
    }),
  );
  return result;
}

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

// Elements passed to Array.prototype.sort while a $ registration and a memo
// write alternate count times.
function sortedElements(count: number): number {
  let total = 0;
  const original = Array.prototype.sort;
  const spy = vi.spyOn(Array.prototype, 'sort').mockImplementation(function (
    this: unknown[],
    compare,
  ) {
    total += this.length;
    return original.call(this, compare as never);
  });
  try {
    const s = root([[0]], (t) => {
      $$set(t, 0, 0);
      $$memo(t, 0, 1, () => $$get(t, 0) + 1);
      for (let i = 1; i <= count; i++) {
        $$effect(t, i, () => {});
        $$set(t, 0, i);
      }
    });
    expect($$get(s, 1)).toBe(count + 1);
  } finally {
    spy.mockRestore();
  }
  return total;
}

describe('slots', () => {
  it('reads and writes', () => {
    const s = root([], (t) => {
      $$set(t, 0, 1);
    });
    expect($$get(s, 0)).toBe(1);
    expect($$set(s, 0, 2)).toBe(2);
    expect($$get(s, 0)).toBe(2);
  });

  it('returns the right value for update expressions', () => {
    const s = root([], (t) => {
      $$set(t, 0, 5);
    });
    expect($$update(s, 0, 1, false)).toBe(5);
    expect($$update(s, 0, 1, true)).toBe(7);
    expect($$update(s, 0, -1, false)).toBe(7);
    expect($$update(s, 0, -1, true)).toBe(5);
    expect($$get(s, 0)).toBe(5);
  });
});

describe('write ordering', () => {
  it('runs memos before $sync bodies', () => {
    const log: string[] = [];
    // Slot 0: a. Slot 1: b = a + 1. Entries: 0 memo b, 1 $sync a, 2 $sync b.
    const s = root([[0, 1], [2]], (t) => {
      $$set(t, 0, 0);
      $$memo(t, 0, 1, () => $$get(t, 0) + 1);
      $$sync(t, 1, () => log.push(`a ${$$get(t, 0)} b ${$$get(t, 1)}`));
      $$sync(t, 2, () => log.push(`b ${$$get(t, 1)}`));
    });
    log.length = 0;
    $$set(s, 0, 1);
    expect(log).toEqual(['a 1 b 2', 'b 2']);
  });

  it('runs a lower depth first and siblings by entry id', () => {
    const log: string[] = [];
    const s = root([[0, 1]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, () => {
        log.push('a');
      });
      $$sync(t, 1, () => {
        log.push('b');
      });
    });
    log.length = 0;
    $$set(s, 0, 1);
    expect(log).toEqual(['a', 'b']);
  });

  it('runs a wide fan-out in entry order', () => {
    const log: number[] = [];
    const count = 3000;
    const refs: number[] = [];
    for (let i = 0; i < count; i++) {
      refs.push(i);
    }
    const s = root([refs], (t) => {
      $$set(t, 0, 0);
      for (let i = 0; i < count; i++) {
        $$sync(t, i, () => {
          $$get(t, 0);
          log.push(i);
        });
      }
    });
    log.length = 0;
    $$set(s, 0, 1);
    expect(log).toHaveLength(count);
    expect(log).toEqual(refs);
  });

  it('runs a parent entry before its child entries', () => {
    const log: string[] = [];
    // The inner entry is listed first in the graph and still runs second.
    const s = root([[[0, 0], 0]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, (child) => {
        log.push('outer');
        $$sync(child, 0, () => {
          log.push(`inner ${$$get(t, 0)}`);
        });
      });
    });
    log.length = 0;
    $$set(s, 0, 1);
    expect(log).toEqual(['outer', 'inner 1']);
  });

  it('does not sort the $ queue again for each memo write', () => {
    // One $ registration per round, with a write that queues a memo in
    // between. Sorting the pending $ queue on each take is quadratic, so
    // count the elements the runtime sorts instead of timing it.
    const small = sortedElements(1000);
    const large = sortedElements(2000);
    // Linear work doubles with the count, quadratic work quadruples.
    expect(large).toBeLessThan(small * 3);
  });

  it('treats a missing graph list as no readers', () => {
    const log: string[] = [];
    const s = root([undefined, [0]], (t) => {
      $$set(t, 0, 0);
      $$set(t, 1, 0);
      $$sync(t, 0, () => {
        log.push(`run ${$$get(t, 1)}`);
      });
    });
    $$set(s, 0, 1);
    expect(log).toEqual(['run 0']);
    $$set(s, 1, 1);
    expect(log).toEqual(['run 0', 'run 1']);
  });
});

describe('batching', () => {
  it('runs a memo once for the writes of a $sync body', () => {
    const log: number[] = [];
    // 0: a, 1: b, 2: sum. Entries: 0 memo sum, 1 $sync writer, 2 $sync reader.
    const s = root([[0], [0], [2]], (t) => {
      $$set(t, 0, 0);
      $$set(t, 1, 0);
      $$set(t, 2, 0);
      $$memo(t, 0, 2, () => $$get(t, 0) + $$get(t, 1));
      $$sync(t, 2, () => {
        log.push($$get(t, 2));
      });
    });
    log.length = 0;
    $$set(s, 0, 1);
    $$set(s, 1, 1);
    expect(log).toEqual([1, 2]);
  });

  it('batches $ bodies into one microtask flush', async () => {
    const log: number[] = [];
    const s = root([[0]], (t) => {
      $$set(t, 0, 0);
      $$effect(t, 0, () => {
        log.push($$get(t, 0));
      });
    });
    await tick();
    expect(log).toEqual([0]);
    $$set(s, 0, 1);
    $$set(s, 0, 2);
    $$set(s, 0, 3);
    expect(log).toEqual([0]);
    await tick();
    expect(log).toEqual([0, 3]);
  });

  it('runs a $ body once for a write in a $sync body and a direct write', async () => {
    const log: number[] = [];
    const s = root([[0, 1], [2]], (t) => {
      $$set(t, 0, 0);
      $$set(t, 1, 0);
      $$sync(t, 0, () => {
        $$set(t, 1, $$get(t, 0) * 2);
      });
      $$effect(t, 2, () => {
        log.push($$get(t, 1));
      });
    });
    await tick();
    log.length = 0;
    $$set(s, 0, 4);
    await tick();
    expect(log).toEqual([8]);
  });
});

describe('Object.is skip', () => {
  it('does not run readers for an equal value', () => {
    const log: number[] = [];
    const s = root([[0]], (t) => {
      $$set(t, 0, 1);
      $$sync(t, 0, () => {
        log.push($$get(t, 0));
      });
    });
    $$set(s, 0, 1);
    expect(log).toEqual([1]);
    $$set(s, 0, 2);
    expect(log).toEqual([1, 2]);
  });

  it('treats NaN as equal and 0 and -0 as different', () => {
    const log: number[] = [];
    const s = root([[0]], (t) => {
      $$set(t, 0, Number.NaN);
      $$sync(t, 0, () => {
        log.push($$get(t, 0));
      });
    });
    $$set(s, 0, Number.NaN);
    expect(log).toHaveLength(1);
    $$set(s, 0, 0);
    $$set(s, 0, -0);
    expect(log).toHaveLength(3);
  });

  it('does not run a memo reader when the memo value is unchanged', () => {
    const log: boolean[] = [];
    // 0: n, 1: even. Entries: 0 memo even, 1 $sync.
    const s = root([[0], [1]], (t) => {
      $$set(t, 0, 0);
      $$memo(t, 0, 1, () => $$get(t, 0) % 2 === 0);
      $$sync(t, 1, () => {
        log.push($$get(t, 1));
      });
    });
    $$set(s, 0, 2);
    expect(log).toEqual([true]);
    $$set(s, 0, 3);
    expect(log).toEqual([true, false]);
  });
});

describe('child scopes', () => {
  it('disposes the child scope of the last run before the next run', () => {
    const log: string[] = [];
    const s = root([[0]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, (child) => {
        const n = $$get(t, 0);
        log.push(`run ${n}`);
        $$destroy(child, () => {
          log.push(`destroy ${n}`);
        });
      });
    });
    $$set(s, 0, 1);
    $$set(s, 0, 2);
    expect(log).toEqual(['run 0', 'destroy 0', 'run 1', 'destroy 1', 'run 2']);
  });

  it('disposes nested child scopes with the root', () => {
    const log: string[] = [];
    const dispose = $$root([], (t) => {
      $$sync(t, 0, (child) => {
        $$sync(child, 0, (inner) => {
          $$destroy(inner, () => {
            log.push('inner');
          });
        });
        $$destroy(child, () => {
          log.push('outer');
        });
      });
    });
    dispose();
    expect(log).toEqual(['inner', 'outer']);
  });

  it('ignores writes to a disposed scope', () => {
    const log: number[] = [];
    let s!: Scope;
    const dispose = $$root([[0]], (t) => {
      s = t;
      $$set(t, 0, 0);
      $$sync(t, 0, () => {
        log.push($$get(t, 0));
      });
    });
    dispose();
    $$set(s, 0, 1);
    expect(log).toEqual([0]);
    expect($$get(s, 0)).toBe(1);
  });

  it('reaches an entry of a child scope through a path', () => {
    const log: string[] = [];
    // The outer body declares slot 0. The inner $sync reads it.
    const s = root([[[0, 0]]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, (child) => {
        $$sync(child, 0, () => {
          log.push(`inner ${$$get(t, 0)}`);
        });
      });
    });
    $$set(s, 0, 1);
    expect(log).toEqual(['inner 0', 'inner 1']);
  });
});

describe('onMount', () => {
  it('runs after the setup returns, in call order', () => {
    const log: string[] = [];
    $$root([], (t) => {
      $$mount(t, () => {
        log.push('a');
      });
      $$mount(t, () => {
        log.push('b');
      });
      log.push('setup');
    })();
    expect(log).toEqual(['setup', 'a', 'b']);
  });

  it('runs at once in a mounted scope', () => {
    const log: string[] = [];
    let s!: Scope;
    const dispose = $$root([], (t) => {
      s = t;
    });
    $$mount(s, () => {
      log.push('late');
    });
    expect(log).toEqual(['late']);
    dispose();
  });

  it('mounts a child scope right after its run', () => {
    const log: string[] = [];
    const s = root([[0]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, (child) => {
        const n = $$get(t, 0);
        $$mount(child, () => {
          log.push(`mount ${n}`);
        });
        log.push(`run ${n}`);
      });
    });
    $$set(s, 0, 1);
    expect(log).toEqual(['run 0', 'mount 0', 'run 1', 'mount 1']);
  });

  it('does not run in a disposed scope', () => {
    const log: string[] = [];
    expect(() =>
      $$root([], (t) => {
        $$mount(t, () => {
          log.push('mount');
        });
        throw new Error('stop');
      }),
    ).toThrow('stop');
    expect(log).toEqual([]);
  });
});

describe('onDestroy', () => {
  it('runs on dispose in call order', () => {
    const log: string[] = [];
    const dispose = $$root([], (t) => {
      $$destroy(t, () => {
        log.push('a');
      });
      $$destroy(t, () => {
        log.push('b');
      });
    });
    expect(log).toEqual([]);
    dispose();
    expect(log).toEqual(['a', 'b']);
  });

  it('runs once when disposed twice', () => {
    const log: string[] = [];
    const dispose = $$root([], (t) => {
      $$destroy(t, () => {
        log.push('a');
      });
    });
    dispose();
    dispose();
    expect(log).toEqual(['a']);
  });

  it('runs at once in a disposed scope', () => {
    const log: string[] = [];
    let s!: Scope;
    $$root([], (t) => {
      s = t;
    })();
    $$destroy(s, () => {
      log.push('late');
    });
    expect(log).toEqual(['late']);
  });

  it('runs when the setup throws', () => {
    const log: string[] = [];
    expect(() =>
      $$root([], (t) => {
        $$destroy(t, () => {
          log.push('destroy');
        });
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(log).toEqual(['destroy']);
  });
});

describe('store subscription', () => {
  it('reads the store and follows its changes', () => {
    const store = createStore(1);
    const s = root([[0]], (t) => {
      $$store(t, 0, store);
    });
    expect($$get(s, 0)).toBe(1);
    store.set!(2);
    expect($$get(s, 0)).toBe(2);
  });

  it('unsubscribes on dispose', () => {
    const store = createStore(1);
    let s!: Scope;
    const dispose = $$root([], (t) => {
      s = t;
      $$store(t, 0, store);
    });
    expect(store.size()).toBe(1);
    dispose();
    expect(store.size()).toBe(0);
    store.set!(5);
    expect($$get(s, 0)).toBe(1);
  });

  it('unsubscribes a store declared in a child scope when it reruns', () => {
    const store = createStore(0);
    const s = root([[0]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, (child) => {
        $$get(t, 0);
        $$store(child, 0, store);
      });
    });
    expect(store.size()).toBe(1);
    $$set(s, 0, 1);
    expect(store.size()).toBe(1);
  });

  it('writes a let slot back to the store', () => {
    const store = createStore(1);
    // Slot 0 is read by the write-back, entry 0.
    const s = root([[0]], (t) => {
      $$store(t, 0, store, 0);
    });
    $$set(s, 0, 7);
    expect(store.get()).toBe(7);
    store.set!(9);
    expect($$get(s, 0)).toBe(9);
  });

  it('unsubscribes when the setup throws', () => {
    const store = createStore(1);
    expect(() =>
      $$root([], (t) => {
        $$store(t, 0, store);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(store.size()).toBe(0);
  });
});

describe('composables', () => {
  it('throws outside a reactive boundary', () => {
    const fn = $$composable([], () => 1);
    expect(() => fn()).toThrow('Unexpected missing reactive boundary.');
  });

  it('shares the lifetime of the caller', () => {
    const log: string[] = [];
    const use = $$composable([], (t, name: string) => {
      $$destroy(t, () => {
        log.push(`destroy ${name}`);
      });
      return name.toUpperCase();
    });
    const dispose = $$root([], () => {
      log.push(use('a'));
      log.push(use('b'));
    });
    dispose();
    expect(log).toEqual(['A', 'B', 'destroy a', 'destroy b']);
  });
});

describe('errors', () => {
  it('throws the first error of a batch and keeps running the rest', () => {
    const log: string[] = [];
    const s = root([[0, 1]], (t) => {
      $$set(t, 0, 0);
      $$sync(t, 0, () => {
        if ($$get(t, 0) === 1) {
          throw new Error('first');
        }
      });
      $$sync(t, 1, () => {
        log.push(`second ${$$get(t, 0)}`);
      });
    });
    expect(() => $$set(s, 0, 1)).toThrow('first');
    expect(log).toEqual(['second 0', 'second 1']);
  });

  it('throws Update loop from a loop of memos and $sync bodies', () => {
    expect(() =>
      root([[0, 1], [0]], (t) => {
        $$set(t, 0, 0);
        $$set(t, 1, 0);
        $$sync(t, 0, () => {
          $$set(t, 1, $$get(t, 0) + 1);
        });
        $$sync(t, 1, () => {
          $$set(t, 0, $$get(t, 1) + 1);
        });
      }),
    ).toThrow('Update loop');
  });

  it('rethrows an error of a $ flush from the microtask', async () => {
    const seen: unknown[] = [];
    const handler = (error: unknown): void => {
      seen.push(error);
    };
    process.on('uncaughtException', handler);
    try {
      root([], (t) => {
        $$effect(t, 0, () => {
          throw new Error('effect');
        });
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    } finally {
      process.off('uncaughtException', handler);
    }
    expect(seen.map(String)).toEqual(['Error: effect']);
  });

  it('stops a loop between $ bodies with Update loop', async () => {
    const seen: unknown[] = [];
    const handler = (error: unknown): void => {
      seen.push(error);
    };
    process.on('uncaughtException', handler);
    try {
      const s = root([[0], [1]], (t) => {
        $$set(t, 0, 0);
        $$set(t, 1, 0);
        $$effect(t, 0, () => {
          $$set(t, 1, $$get(t, 0) + 1);
        });
        $$effect(t, 1, () => {
          $$set(t, 0, $$get(t, 1) + 1);
        });
      });
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      expect($$get(s, 0)).toBeGreaterThan(1000);
    } finally {
      process.off('uncaughtException', handler);
    }
    expect(seen.map(String)).toEqual(['Error: Update loop']);
  });
});

describe('without the compiler', () => {
  it('runs $$ at once and returns its disposer', () => {
    const log: string[] = [];
    const dispose = $$(() => {
      log.push('setup');
    });
    expect(log).toEqual(['setup']);
    dispose();
  });

  it('returns the function from $composable', () => {
    expect($composable(one)).toBe(one);
  });

  it('throws for the compile-time names', () => {
    const names = { $, $sync, $skip, $store, onMount, onDestroy };
    for (const [name, fn] of Object.entries(names)) {
      expect(() => (fn as () => void)()).toThrow(
        `${name} is meant to be compile-time only.`,
      );
    }
  });

  it('resolves tick with nothing queued', async () => {
    const spy = vi.fn<() => void>();
    await tick().then(spy);
    expect(spy).toHaveBeenCalledOnce();
  });
});
