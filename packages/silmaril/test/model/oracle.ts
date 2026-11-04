import { isLiveAt } from './program';
import type { Assign, Expr, Program } from './program';

// The oracle runs a program with plain JS semantics and no reactivity.
// After every write it recomputes each derived value from scratch. It then
// decides which effects run from the documented rules:
//
// - An effect reads the names that appear in its source, outside `$skip`.
//   The branch a conditional takes does not matter.
// - An effect runs again after a write when a name it reads got a new value
//   (`Object.is`). A derived value counts as written when it recomputes to a
//   new value.
// - `$sync` runs right after each write. `$` runs once per flush, and it runs
//   even if later writes put the old values back. The first run of `$` is in
//   the first flush.
// - An effect cleanup runs before the next run and when `$$` is stopped.
// - After `stop()` nothing reacts, and a queued `$` never runs.

export interface TraceEntry {
  marker: string | number;
  /** Every variable value at the marker, or undefined after a stop. */
  state: unknown[] | undefined;
  /** Logs of the effects since the last marker, grouped by tag. */
  effects: Record<string, unknown[][]>;
}

export type Trace = TraceEntry[];

/** Evaluates an expression against the current variable values. */
export function evaluate(expr: Expr, values: number[]): number {
  switch (expr.k) {
    case 'num':
      return expr.n;
    case 'ref':
    case 'skip':
      return values[expr.name]!;
    case 'bin': {
      const l = evaluate(expr.l, values);
      const r = evaluate(expr.r, values);
      if (expr.op === '+') {
        return l + r;
      }
      return expr.op === '-' ? l - r : l * r;
    }
    case 'mod':
      return evaluate(expr.l, values) % expr.n;
    case 'cond': {
      const l = evaluate(expr.l, values);
      const r = evaluate(expr.r, values);
      let test: boolean;
      switch (expr.op) {
        case '<':
          test = l < r;
          break;
        case '>':
          test = l > r;
          break;
        case '===':
          test = l === r;
          break;
        default:
          test = l !== r;
      }
      return evaluate(test ? expr.a : expr.b, values);
    }
  }
}

/** Collects the names an expression reads with tracking. */
export function collectDeps(expr: Expr, deps: Set<number>): void {
  switch (expr.k) {
    case 'num':
    case 'skip':
      return;
    case 'ref':
      deps.add(expr.name);
      return;
    case 'bin':
      collectDeps(expr.l, deps);
      collectDeps(expr.r, deps);
      return;
    case 'mod':
      collectDeps(expr.l, deps);
      return;
    case 'cond':
      collectDeps(expr.l, deps);
      collectDeps(expr.r, deps);
      collectDeps(expr.a, deps);
      collectDeps(expr.b, deps);
  }
}

function computeValues(program: Program, bases: number[]): number[] {
  const values = [...bases];
  for (const expr of program.deriveds) {
    values.push(evaluate(expr, values));
  }
  return values;
}

function applyOp(assign: Assign, current: number, values: number[]): number {
  switch (assign.op) {
    case '=':
      return evaluate(assign.value, values);
    case '+=':
      return current + evaluate(assign.value, values);
    case '-=':
      return current - evaluate(assign.value, values);
    case '*=':
      return current * evaluate(assign.value, values);
    case 'x++':
    case '++x':
      return current + 1;
    case 'x--':
    case '--x':
      return current - 1;
  }
}

/** Runs the program and returns what silmaril must show. */
export function simulate(program: Program): Trace {
  const bases = [...program.bases];
  let values = computeValues(program, bases);
  let alive = true;
  let dirty = new Set<number>();
  let current: Record<string, unknown[][]> = {};
  const trace: Trace = [];

  // Names each effect reads, and whether it ran at least once.
  const deps: Set<number>[] = [];
  const ran: boolean[] = [];
  for (const effect of program.effects) {
    const set = new Set<number>();
    for (const expr of effect.exprs) {
      collectDeps(expr, set);
    }
    deps.push(set);
    ran.push(false);
  }

  function emit(tag: string, args: unknown[]): void {
    const list = (current[tag] ??= []);
    list.push(args);
  }

  function runEffect(index: number): void {
    const effect = program.effects[index]!;

    // The cleanup of the previous run comes first.
    if (effect.cleanup && ran[index]) {
      emit(`c${index}`, []);
    }
    const args: unknown[] = [];
    for (const expr of effect.exprs) {
      args.push(evaluate(expr, values));
    }
    emit(`e${index}`, args);
    ran[index] = true;
  }

  function reads(index: number, names: Set<number>): boolean {
    for (const name of deps[index]!) {
      if (names.has(name)) {
        return true;
      }
    }
    return false;
  }

  function write(assign: Assign): void {
    // Compute the new variable values and every derived value.
    const previous = values;
    bases[assign.target] = applyOp(assign, values[assign.target]!, values);
    values = computeValues(program, bases);
    if (!alive) {
      return;
    }

    // Names whose value changed in this write.
    const changed = new Set<number>();
    for (const [name, value] of values.entries()) {
      if (!Object.is(value, previous[name])) {
        changed.add(name);
        dirty.add(name);
      }
    }

    // `$sync` effects run at once, in the same write.
    for (const [index, effect] of program.effects.entries()) {
      if (effect.sync && reads(index, changed)) {
        runEffect(index);
      }
    }
  }

  function flush(): void {
    if (alive) {
      for (const [index, effect] of program.effects.entries()) {
        if (!effect.sync && (!ran[index] || reads(index, dirty))) {
          runEffect(index);
        }
      }
    }
    dirty = new Set();
  }

  function stop(): void {
    if (alive) {
      alive = false;
      for (const [index, effect] of program.effects.entries()) {
        if (effect.cleanup && ran[index]) {
          emit(`c${index}`, []);
        }
      }
    }
  }

  function mark(marker: string | number, live: boolean): void {
    trace.push({
      marker,
      state: live ? [...values] : undefined,
      effects: current,
    });
    current = {};
  }

  // Setup: `$sync` effects run when declared, `$` waits for the first flush.
  for (const [index, effect] of program.effects.entries()) {
    if (effect.sync) {
      runEffect(index);
    }
  }
  for (const assign of program.setup) {
    write(assign);
  }
  mark('setup', true);

  // Actions, with a marker after each.
  for (const [index, action] of program.actions.entries()) {
    if (action.t === 'step') {
      for (const assign of action.stmts) {
        write(assign);
      }
    } else if (action.t === 'flush') {
      flush();
    } else {
      stop();
    }
    mark(index, isLiveAt(program, index));
  }
  return trace;
}

/** Splits the logs of a run into the same shape as the oracle trace. */
export function parseLogs(logs: unknown[][]): Trace {
  const trace: Trace = [];
  let current: Record<string, unknown[][]> = {};
  for (const entry of logs) {
    const tag = entry[0] as string;
    if (tag === '#') {
      trace.push({
        marker: entry[1] as string | number,
        state: entry[2] as unknown[] | undefined,
        effects: current,
      });
      current = {};
    } else {
      const list = (current[tag] ??= []);
      list.push(entry.slice(1));
    }
  }
  return trace;
}
