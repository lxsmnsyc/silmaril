// Setups (`$$`) and entries (`$sync`, `$`): the callee, the scope parameter, the
// entry id and the graph argument.
import type {
  ArrowFunctionExpression,
  CallExpression,
  Function as FunctionNode,
  Node,
} from 'oxc-parser';
import type { Entry, ReactiveScope } from '../analysis/model';
import { isFunctionNode } from '../analysis/scope';
import { unwrap } from '../analysis/walk';
import {
  failUnsupported,
  needsParens,
  useHelper,
  type GenerateContext,
} from './context';

/** Adds the scope parameter in front of the parameters of a scope body. */
export function insertParam(
  context: GenerateContext,
  fn: FunctionNode | ArrowFunctionExpression,
  param: string,
): void {
  const { s, code } = context;
  const params = fn.params;
  const first: Node | undefined = params[0];

  // A TypeScript `this` parameter stays first.
  if (
    first &&
    fn.type !== 'ArrowFunctionExpression' &&
    first.type === 'Identifier' &&
    first.name === 'this'
  ) {
    s.appendLeft(first.end, `, ${param}`);
    return;
  }

  if (first) {
    if (code.slice(fn.start, first.start).includes('(')) {
      s.appendLeft(first.start, `${param}, `);
    } else {
      // `x => ...` -> `(sc, x) => ...`
      s.appendLeft(first.start, `(${param}, `);
      s.prependRight(first.end, ')');
    }
    return;
  }

  // No parameters: after the `(` that follows the name and type parameters.
  let from = fn.start;
  if (fn.typeParameters) {
    from = fn.typeParameters.end;
  } else if (fn.type !== 'ArrowFunctionExpression' && fn.id) {
    from = fn.id.end;
  }
  s.appendLeft(code.indexOf('(', from) + 1, param);
}

/** `$$(fn)` -> `$$root($g0, ($s) => ...)`. */
export function rewriteSetup(
  context: GenerateContext,
  call: CallExpression,
  scope: ReactiveScope,
): void {
  if (scope.kind === 'composable') {
    failUnsupported(context, '$composable', call);
  }
  const { s } = context;
  s.update(call.callee.start, call.callee.end, useHelper(context, '$$root'));
  s.appendLeft(call.arguments[0]!.start, `${scope.graphName}, `);
  insertParam(
    context,
    scope.node as FunctionNode | ArrowFunctionExpression,
    scope.param,
  );
}

/** `$sync(x)` / `$(x)` -> `$$sync(sc, n, ...)` / `$$effect(sc, n, ...)`. */
export function rewriteEntry(
  context: GenerateContext,
  call: CallExpression,
  entry: Entry,
): void {
  const { s } = context;
  s.update(
    call.callee.start,
    call.callee.end,
    useHelper(context, entry.kind === 'sync' ? '$$sync' : '$$effect'),
  );
  const arg = call.arguments[0]!;
  const owner = entry.scope;
  const child = entry.child!;
  const body = unwrap(arg);
  if (child.isBody && isFunctionNode(body)) {
    // A function is the entry body: `($c0) => { body }`, with its graph when it
    // declares slots.
    s.appendLeft(arg.start, `${owner.param}, ${entry.id}, `);
    if (child.paramUsed) {
      insertParam(context, body, child.param);
    }
    if (child.graph) {
      s.prependRight(arg.end, `, ${child.graphName}`);
    }
    return;
  }

  // Any other argument is wrapped: `() => expr`, `() => ({ ... })`.
  const param = child.paramUsed ? `(${child.param})` : '()';
  const wrap = needsParens(context.code, arg);
  s.appendLeft(
    arg.start,
    `${owner.param}, ${entry.id}, ${param} => ${wrap ? '(' : ''}`,
  );
  if (wrap) {
    s.prependRight(arg.end, ')');
  }
}
