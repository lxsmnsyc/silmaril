// Compile errors of the runtime contract that no other step of the model finds.
import type { CallExpression, Node } from 'oxc-parser';
import { CompileError } from '../errors';
import type { AnalysisContext, Slot, SlotCandidate } from './model';
import { findEnclosingSetup } from './reads';
import type { Binding } from './scope';
import { climbWrappers, visit } from './walk';

/** Throws a CompileError at the start of a node. */
export function fail(
  context: AnalysisContext,
  message: string,
  node: { start: number },
): never {
  throw new CompileError(message, context.parsed.code, node.start);
}

/**
 * Step 1. Every reference to a compile-time name must be the callee of a call, through
 * parentheses and TS wrappers. Fills `trackedCalls`, `localNames` and `calls`.
 */
export function findTrackedCalls(context: AnalysisContext): void {
  for (const [binding, name] of context.imports.tracked) {
    for (const ref of binding.references) {
      const { node, parent } = climbWrappers(context.parentOf, ref.identifier);
      if (
        !parent ||
        parent.type !== 'CallExpression' ||
        parent.callee !== node
      ) {
        fail(context, `${binding.name} can only be called.`, ref.identifier);
      }
      context.trackedCalls.set(parent, name);
      context.localNames.set(parent, binding.name);
    }
  }
  context.calls = [...context.trackedCalls.keys()].toSorted(
    (a, b) => a.start - b.start,
  );
}

/** The only argument of a call. Fails with `<name> takes exactly one argument.` otherwise. */
export function checkOneArgument(
  context: AnalysisContext,
  call: CallExpression,
): Node {
  const arg = call.arguments[0];
  if (call.arguments.length !== 1 || !arg || arg.type === 'SpreadElement') {
    fail(
      context,
      `${context.localNames.get(call)} takes exactly one argument.`,
      call,
    );
  }
  return arg;
}

export interface PlacedNames {
  skips: CallExpression[];
  storeCalls: CallExpression[];
}

/**
 * Step 4. `$skip`, `onMount` and `onDestroy` must be in a setup tree. `$skip` and
 * `$store` take one argument, and `$store` cannot initialize a pattern.
 */
export function checkPlacedNames(context: AnalysisContext): PlacedNames {
  const skips: CallExpression[] = [];
  const storeCalls: CallExpression[] = [];
  for (const call of context.calls) {
    const name = context.trackedCalls.get(call);
    const localName = context.localNames.get(call);

    // Names that bind to a running setup.
    if (name === '$skip' || name === 'onMount' || name === 'onDestroy') {
      if (!findEnclosingSetup(context, call)) {
        fail(
          context,
          `${localName} must be used inside $$ or $composable.`,
          call,
        );
      }
      if (name === '$skip') {
        checkOneArgument(context, call);
        skips.push(call);
        context.skipCalls.add(call);
      }
      continue;
    }

    // `$store` must initialize an identifier. Where it may sit is checked once the
    // slot candidates are known.
    if (name === '$store') {
      checkOneArgument(context, call);
      const { node, parent } = climbWrappers(context.parentOf, call);
      if (
        parent &&
        parent.type === 'VariableDeclarator' &&
        parent.init === node &&
        parent.id.type !== 'Identifier'
      ) {
        fail(context, '$store is only limited to identifiers.', call);
      }
      storeCalls.push(call);
    }
  }
  return { skips, storeCalls };
}

/** Step 4. The `/* $skip *\/` comment of 0.4 is an error inside a setup function. */
export function checkSkipComments(context: AnalysisContext): void {
  for (const comment of context.parsed.comments) {
    if (comment.value.trim() !== '$skip') {
      continue;
    }
    for (const scope of context.setupOf.values()) {
      if (comment.start >= scope.node.start && comment.end <= scope.node.end) {
        fail(
          context,
          'The /* $skip */ comment is not supported. Use $skip(expression).',
          comment,
        );
      }
    }
  }
}

/** Step 4. Each `$store` call is the whole initializer of a slot candidate. */
export function checkStoreCalls(
  context: AnalysisContext,
  storeCalls: CallExpression[],
  candidates: SlotCandidate[],
): void {
  const placed = new Set<CallExpression>();
  for (const candidate of candidates) {
    if (candidate.store) {
      placed.add(candidate.store);
    }
  }
  for (const call of storeCalls) {
    if (!placed.has(call)) {
      fail(context, '$store must initialize a variable of a setup body.', call);
    }
  }
}

/** Step 6. A memo initializer holds no `$` or `$sync` call. */
export function checkMemoInitializers(
  context: AnalysisContext,
  candidates: SlotCandidate[],
): void {
  for (const candidate of candidates) {
    const init = candidate.declarator.init;
    if (!candidate.memo || !init) {
      continue;
    }
    visit(init, (node) => {
      if (node.type === 'CallExpression' && context.entryCalls.has(node)) {
        fail(
          context,
          `${context.localNames.get(node)} must be called directly in a setup body.`,
          node,
        );
      }
    });
  }
}

/** Step 11. A slot used as a JSX tag cannot become a call. */
export function checkJsxTags(
  context: AnalysisContext,
  slotOf: Map<Binding, Slot>,
): void {
  for (const binding of slotOf.keys()) {
    for (const ref of binding.references) {
      if (!ref.write && ref.context === 'jsx') {
        fail(
          context,
          'A reactive variable cannot be used as a JSX tag.',
          ref.identifier,
        );
      }
    }
  }
}
