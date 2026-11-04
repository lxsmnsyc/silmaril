import * as fc from 'fast-check';

// A small AST of silmaril programs. The generator builds it, `renderProgram`
// prints it as source and the oracle in `oracle.ts` evaluates it with plain
// JS semantics. A shrunk counterexample stays readable because it is printed
// as source.
//
// Names are numbers: `0..bases-1` are the `let` variables `v0..`, the next
// ones are the `const` derived values `d0..`.

export type CompareOp = '<' | '>' | '===' | '!==';

export type Expr =
  | { k: 'num'; n: number }
  | { k: 'ref'; name: number }
  | { k: 'bin'; op: '+' | '-' | '*'; l: Expr; r: Expr }
  | { k: 'mod'; l: Expr; n: number }
  | { k: 'cond'; op: CompareOp; l: Expr; r: Expr; a: Expr; b: Expr }
  // `$skip(name)`: read without tracking. Only effects use it.
  | { k: 'skip'; name: number };

export type AssignOp = '=' | '+=' | '-=' | '*=' | 'x++' | '++x' | 'x--' | '--x';

export interface Assign {
  /** Index of a `let` variable. */
  target: number;
  op: AssignOp;
  /** Right side. Unused by `++` and `--`. */
  value: Expr;
}

export interface Effect {
  /** `$sync` when true, `$` when false. */
  sync: boolean;
  /** The body is a function that registers an `onDestroy` log. */
  cleanup: boolean;
  /** Values the effect logs. */
  exprs: Expr[];
}

export type Action =
  /** Calls one write closure. Its statements are separate writes. */
  | { t: 'step'; stmts: Assign[] }
  /** Awaits the timers and microtasks so `$` effects run. */
  | { t: 'flush' }
  /** Calls the function that `$$` returned. */
  | { t: 'stop' };

export interface Program {
  /** Initial values of the `let` variables. */
  bases: number[];
  /** `d[j]` reads only names below `bases.length + j`. */
  deriveds: Expr[];
  effects: Effect[];
  /** Writes in the `$$` body after the effects are declared. */
  setup: Assign[];
  actions: Action[];
}

const NUM = fc.integer({ min: -3, max: 6 });
const NAME = fc.nat({ max: 30 });
const COMPARE = fc.constantFrom<CompareOp>('<', '>', '===', '!==');
const ASSIGN_OPS = fc.constantFrom<AssignOp>(
  '=',
  '+=',
  '-=',
  '*=',
  'x++',
  '++x',
  'x--',
  '--x',
);

function createExprArb(allowSkip: boolean): fc.Arbitrary<Expr> {
  const leaves: fc.Arbitrary<Expr>[] = [
    NUM.map((n): Expr => ({ k: 'num', n })),
    NAME.map((name): Expr => ({ k: 'ref', name })),
  ];
  if (allowSkip) {
    leaves.push(NAME.map((name): Expr => ({ k: 'skip', name })));
  }
  const leaf = fc.oneof(...leaves);
  const { expr } = fc.letrec<{ expr: Expr }>((tie) => {
    const inner = tie('expr') as fc.Arbitrary<Expr>;
    return {
      expr: fc.oneof(
        { maxDepth: 3, depthSize: 'small' },
        leaf,
        leaf,
        fc
          .record({
            op: fc.constantFrom<'+' | '-' | '*'>('+', '-', '*'),
            l: inner,
            r: inner,
          })
          .map((x): Expr => ({ k: 'bin', ...x })),
        fc
          .record({ l: inner, n: fc.integer({ min: 2, max: 5 }) })
          .map((x): Expr => ({ k: 'mod', ...x })),
        fc
          .record({ op: COMPARE, l: inner, r: inner, a: inner, b: inner })
          .map((x): Expr => ({ k: 'cond', ...x })),
      ),
    };
  });
  return expr;
}

const PLAIN_EXPR = createExprArb(false);
const EFFECT_EXPR = createExprArb(true);

const ASSIGN = fc.record({
  target: fc.nat({ max: 30 }),
  op: ASSIGN_OPS,
  value: PLAIN_EXPR,
});

const EFFECT = fc.record({
  sync: fc.boolean(),
  cleanup: fc.boolean(),
  exprs: fc.array(EFFECT_EXPR, { minLength: 1, maxLength: 2 }),
});

const ACTION = fc.oneof(
  {
    weight: 5,
    arbitrary: fc
      .array(ASSIGN, { minLength: 1, maxLength: 3 })
      .map((stmts): Action => ({ t: 'step', stmts })),
  },
  { weight: 3, arbitrary: fc.constant<Action>({ t: 'flush' }) },
  { weight: 1, arbitrary: fc.constant<Action>({ t: 'stop' }) },
);

function normalizeExpr(expr: Expr, available: number): Expr {
  switch (expr.k) {
    case 'num':
      return expr;
    case 'ref':
      return { k: 'ref', name: expr.name % available };
    case 'skip':
      return { k: 'skip', name: expr.name % available };
    case 'bin':
      return {
        ...expr,
        l: normalizeExpr(expr.l, available),
        r: normalizeExpr(expr.r, available),
      };
    case 'mod':
      return { ...expr, l: normalizeExpr(expr.l, available) };
    case 'cond':
      return {
        ...expr,
        l: normalizeExpr(expr.l, available),
        r: normalizeExpr(expr.r, available),
        a: normalizeExpr(expr.a, available),
        b: normalizeExpr(expr.b, available),
      };
  }
}

function normalizeAssign(
  assign: Assign,
  bases: number,
  available: number,
): Assign {
  return {
    target: assign.target % bases,
    op: assign.op,
    value: normalizeExpr(assign.value, available),
  };
}

/** Reduces every name to one that exists where the expression sits. */
function normalize(raw: Program): Program {
  const bases = raw.bases.length;
  const all = bases + raw.deriveds.length;

  // A derived value reads only the names declared before it.
  const deriveds: Expr[] = [];
  for (const [index, expr] of raw.deriveds.entries()) {
    deriveds.push(normalizeExpr(expr, bases + index));
  }

  // Effects, setup writes and steps see every name.
  const effects: Effect[] = [];
  for (const effect of raw.effects) {
    const exprs: Expr[] = [];
    for (const expr of effect.exprs) {
      exprs.push(normalizeExpr(expr, all));
    }
    effects.push({ ...effect, exprs });
  }
  const setup: Assign[] = [];
  for (const assign of raw.setup) {
    setup.push(normalizeAssign(assign, bases, all));
  }
  const actions: Action[] = [];
  for (const action of raw.actions) {
    if (action.t === 'step') {
      const stmts: Assign[] = [];
      for (const assign of action.stmts) {
        stmts.push(normalizeAssign(assign, bases, all));
      }
      actions.push({ t: 'step', stmts });
    } else {
      actions.push(action);
    }
  }
  return { bases: raw.bases, deriveds, effects, setup, actions };
}

/** Generates programs whose names are all valid. */
export const programArb: fc.Arbitrary<Program> = fc
  .record({
    bases: fc.array(NUM, { minLength: 1, maxLength: 4 }),
    deriveds: fc.array(PLAIN_EXPR, { maxLength: 4 }),
    effects: fc.array(EFFECT, { minLength: 1, maxLength: 4 }),
    setup: fc.array(ASSIGN, { maxLength: 3 }),
    actions: fc.array(ACTION, { maxLength: 8 }),
  })
  .map(normalize);

function renderName(program: Program, name: number): string {
  const bases = program.bases.length;
  return name < bases ? `v${name}` : `d${name - bases}`;
}

function renderNumber(n: number): string {
  return n < 0 ? `(${n})` : String(n);
}

function renderExpr(program: Program, expr: Expr): string {
  switch (expr.k) {
    case 'num':
      return renderNumber(expr.n);
    case 'ref':
      return renderName(program, expr.name);
    case 'skip':
      return `$skip(${renderName(program, expr.name)})`;
    case 'bin':
      return `(${renderExpr(program, expr.l)} ${expr.op} ${renderExpr(program, expr.r)})`;
    case 'mod':
      return `(${renderExpr(program, expr.l)} % ${expr.n})`;
    case 'cond':
      return `(${renderExpr(program, expr.l)} ${expr.op} ${renderExpr(program, expr.r)} ? ${renderExpr(program, expr.a)} : ${renderExpr(program, expr.b)})`;
  }
}

function renderAssign(program: Program, assign: Assign): string {
  const target = `v${assign.target}`;
  switch (assign.op) {
    case 'x++':
      return `${target}++;`;
    case '++x':
      return `++${target};`;
    case 'x--':
      return `${target}--;`;
    case '--x':
      return `--${target};`;
    default:
      return `${target} ${assign.op} ${renderExpr(program, assign.value)};`;
  }
}

function renderEffect(program: Program, effect: Effect, index: number): string {
  const call = effect.sync ? '$sync' : '$';
  const args = [`'e${index}'`];
  for (const expr of effect.exprs) {
    args.push(renderExpr(program, expr));
  }
  const log = `log(${args.join(', ')})`;
  if (!effect.cleanup) {
    return `${call}(${log});`;
  }
  return `${call}(() => { ${log}; onDestroy(() => log('c${index}')); });`;
}

/** True when no `stop` action has run at or before `index`. */
export function isLiveAt(program: Program, index: number): boolean {
  for (let i = 0; i <= index; i++) {
    if (program.actions[i]?.t === 'stop') {
      return false;
    }
  }
  return true;
}

function collectImports(program: Program): string[] {
  const used = new Set(['$$']);
  for (const effect of program.effects) {
    used.add(effect.sync ? '$sync' : '$');
    if (effect.cleanup) {
      used.add('onDestroy');
    }
    if (JSON.stringify(effect.exprs).includes('"skip"')) {
      used.add('$skip');
    }
  }
  return [...used];
}

/**
 * Prints the program as a module for the behavior harness. After the setup
 * and after each action it logs `['#', marker, snapshot]`, where the snapshot
 * lists every variable value. Effects log `[tag, ...values]`: `e<n>` for a
 * run and `c<n>` for a cleanup.
 */
export function renderProgram(program: Program): string {
  const lines: string[] = [];
  const bases = program.bases.length;
  const names: string[] = [];
  for (let i = 0; i < bases + program.deriveds.length; i++) {
    names.push(renderName(program, i));
  }

  lines.push(
    `import { ${collectImports(program).join(', ')} } from 'silmaril';`,
  );
  lines.push('let steps;', 'let read;');
  lines.push('const stop = $$(() => {');

  // Reactive variables and the derived values that read them.
  for (const [index, value] of program.bases.entries()) {
    lines.push(`  let v${index} = ${renderNumber(value)};`);
  }
  for (const [index, expr] of program.deriveds.entries()) {
    lines.push(`  const d${index} = ${renderExpr(program, expr)};`);
  }

  // The closures the test calls after the setup.
  lines.push(`  read = () => [${names.join(', ')}];`);
  const steps: string[] = [];
  for (const action of program.actions) {
    if (action.t === 'step') {
      const body: string[] = [];
      for (const stmt of action.stmts) {
        body.push(renderAssign(program, stmt));
      }
      steps.push(`    () => { ${body.join(' ')} },`);
    }
  }
  lines.push('  steps = [', ...steps, '  ];');

  // Effects, then writes during the setup.
  for (const [index, effect] of program.effects.entries()) {
    lines.push(`  ${renderEffect(program, effect, index)}`);
  }
  for (const assign of program.setup) {
    lines.push(`  ${renderAssign(program, assign)}`);
  }
  lines.push("  log('#', 'setup', read());");
  lines.push('});');

  // The script of actions, with a marker after each.
  let stepIndex = 0;
  for (const [index, action] of program.actions.entries()) {
    const snapshot = isLiveAt(program, index) ? ', read()' : '';
    if (action.t === 'step') {
      lines.push(`steps[${stepIndex}]();`);
      stepIndex += 1;
    } else if (action.t === 'flush') {
      lines.push('await flush();');
    } else {
      lines.push('stop();');
    }
    lines.push(`log('#', ${index}${snapshot});`);
  }
  return lines.join('\n');
}
