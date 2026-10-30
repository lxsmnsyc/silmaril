// Reads of the runtime contract: which slotted bindings a memo or an entry reads,
// through calls of local functions, and the memo rule of the slots to a fixed point.
import type { Node } from 'oxc-parser';
import type {
  AnalysisContext,
  ReactiveScope,
  Slot,
  SlotCandidate,
} from './model';
import { isFunctionNode, type Binding } from './scope';
import { isCallee, unwrap, visit } from './walk';

/** The nearest setup scope around a node, the node itself excluded. */
export function findEnclosingSetup(
  context: AnalysisContext,
  node: Node,
): ReactiveScope | null {
  let current = context.parentOf.get(node);
  while (current) {
    const scope = context.scopeOfNode.get(current);
    if (scope && scope.call) {
      return scope;
    }
    current = context.parentOf.get(current);
  }
  return null;
}

/** The setup tree of a node: the setup it is, or its nearest enclosing setup. */
export function findTree(
  context: AnalysisContext,
  node: Node,
): ReactiveScope | null {
  const scope = context.scopeOfNode.get(node);
  if (scope && scope.call) {
    return scope;
  }
  return findEnclosingSetup(context, node);
}

/** True when any of the bindings has a write reference. */
export function hasWrite(bindings: Binding[]): boolean {
  for (const binding of bindings) {
    for (const ref of binding.references) {
      if (ref.write) {
        return true;
      }
    }
  }
  return false;
}

/**
 * The function of a local function binding, or null. A local function has no slot, is
 * never written, and is a `function` declaration or a declarator with an identifier id
 * and a function or arrow initializer, inside a setup tree. Anything else called by
 * name is opaque.
 */
export function findLocalFunction(
  context: AnalysisContext,
  binding: Binding,
): Node | null {
  if (context.slotted.has(binding) || hasWrite([binding])) {
    return null;
  }
  const { declaration } = binding;
  if (
    binding.kind === 'function' &&
    declaration.type === 'FunctionDeclaration'
  ) {
    return findTree(context, declaration) ? declaration : null;
  }
  if (
    (binding.kind === 'const' ||
      binding.kind === 'let' ||
      binding.kind === 'var') &&
    declaration.type === 'VariableDeclarator' &&
    declaration.id.type === 'Identifier' &&
    declaration.init
  ) {
    const init = unwrap(declaration.init);
    if (isFunctionNode(init)) {
      return findTree(context, declaration) ? init : null;
    }
  }
  return null;
}

interface DirectReads {
  reads: Set<Binding>;
  calls: Set<Binding>;
}

// Reads and local calls in a subtree. Nested entries, `$skip` arguments, nested setups
// and the nodes in `skip` (memo initializers of a child scope) are left out.
function collectDirectReads(
  context: AnalysisContext,
  root: Node,
  tree: ReactiveScope,
  skip: Set<Node> | null,
): DirectReads {
  const { entryCalls, skipCalls, setupOf, info, slotted } = context;
  const result: DirectReads = { reads: new Set(), calls: new Set() };
  visit(root, (node) => {
    if (
      node.type === 'CallExpression' &&
      (entryCalls.has(node) || skipCalls.has(node) || setupOf.has(node))
    ) {
      return false;
    }
    if (skip && skip.has(node)) {
      return false;
    }
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') {
      return undefined;
    }

    // A runtime read is a reference that is not a write target, even `x` in `x += 1`.
    const ref = info.referenceOf.get(node);
    if (!ref || ref.write || !ref.binding) {
      return undefined;
    }
    if (slotted.has(ref.binding)) {
      result.reads.add(ref.binding);
    } else if (isCallee(context.parentOf, node)) {
      const fn = findLocalFunction(context, ref.binding);
      if (fn && findTree(context, fn) === tree) {
        result.calls.add(ref.binding);
      }
    }
    return undefined;
  });
  return result;
}

/**
 * The reads of a subtree plus the direct reads of every local function reachable
 * through its calls. A seen set ends recursion.
 */
export function collectReads(
  context: AnalysisContext,
  root: Node,
  tree: ReactiveScope,
  skip: Set<Node> | null,
): Set<Binding> {
  const first = collectDirectReads(context, root, tree, skip);
  const reads = new Set(first.reads);
  const seen = new Set<Binding>();
  const queue = [...first.calls];
  while (queue.length > 0) {
    const binding = queue.pop()!;
    if (seen.has(binding)) {
      continue;
    }
    seen.add(binding);
    const fn = findLocalFunction(context, binding);
    if (!fn) {
      continue;
    }
    const inner = collectDirectReads(context, fn, tree, null);
    for (const read of inner.reads) {
      reads.add(read);
    }
    for (const call of inner.calls) {
      queue.push(call);
    }
  }
  return reads;
}

/**
 * Rule 2 of the slots, to a fixed point: a candidate whose initializer reads a slot is
 * a memo, and all its names get slots.
 */
export function findMemos(
  context: AnalysisContext,
  candidates: SlotCandidate[],
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      const init = candidate.declarator.init;
      if (candidate.memo || candidate.neverMemo || candidate.store || !init) {
        continue;
      }
      const reads = collectReads(context, init, candidate.scope.tree, null);
      if (reads.size === 0) {
        continue;
      }
      candidate.memo = true;
      candidate.slotted = true;
      for (const binding of candidate.bindings) {
        context.slotted.add(binding);
      }
      changed = true;
    }
  }
}

/**
 * Step 8. A memo reads its initializer. An expression entry reads its argument. A
 * function entry reads its body without its own memo initializers, then trades each
 * read of a slot of its own scope for the reads of that slot's memo, to a fixed point.
 */
export function computeEntryReads(
  context: AnalysisContext,
  bodies: ReactiveScope[],
  memoInits: Map<ReactiveScope, Set<Node>>,
  slotOf: Map<Binding, Slot>,
): void {
  // Memos first: function entries use their reads.
  for (const scope of bodies) {
    for (const entry of scope.entries) {
      if (entry.kind === 'memo' && entry.child) {
        entry.reads = collectReads(context, entry.child.node, scope.tree, null);
      }
    }
  }

  for (const scope of bodies) {
    for (const entry of scope.entries) {
      if ((entry.kind !== 'sync' && entry.kind !== 'effect') || !entry.child) {
        continue;
      }
      const child = entry.child;
      if (!child.isBody) {
        entry.reads = collectReads(context, child.node, scope.tree, null);
        continue;
      }
      const reads = collectReads(
        context,
        child.node,
        scope.tree,
        memoInits.get(child) ?? null,
      );

      // A Set visits the reads added during the loop and skips deleted ones, so one
      // pass reaches the fixed point. `done` stops a memo cycle.
      const done = new Set<Binding>();
      for (const binding of reads) {
        const slot = slotOf.get(binding);
        if (!slot || slot.scope !== child) {
          continue;
        }
        reads.delete(binding);
        if (done.has(binding)) {
          continue;
        }
        done.add(binding);
        const memo = slot.declarator.entry;
        if (memo && memo.kind === 'memo') {
          for (const read of memo.reads) {
            reads.add(read);
          }
        }
      }
      entry.reads = reads;
    }
  }
}
