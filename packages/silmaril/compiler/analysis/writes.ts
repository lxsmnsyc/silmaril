// Write sites: every write of a slotted binding, and the redeclares of a slotted var.
import type {
  BindingIdentifier,
  IdentifierReference,
  Node,
  VariableDeclarator,
} from 'oxc-parser';
import { fail } from './checks';
import type {
  AnalysisContext,
  Slot,
  SlotCandidate,
  TempOwner,
  WriteKind,
  WriteSite,
  WriteTarget,
} from './model';
import { isFunctionNode, type Binding } from './scope';
import { unwrap, visit } from './walk';

export interface WriteSites {
  writes: WriteSite[];
  writeOf: Map<Node, WriteSite>;
}

// The node that declares the temps of a write: the nearest function, or a class field
// whose initializer holds the write (codegen then wraps it in a called arrow).
function findTempOwner(context: AnalysisContext, node: Node): TempOwner {
  let child = node;
  let current = context.parentOf.get(node);
  while (current) {
    if (isFunctionNode(current)) {
      return current;
    }
    if (
      (current.type === 'PropertyDefinition' ||
        current.type === 'TSAbstractPropertyDefinition' ||
        current.type === 'AccessorProperty' ||
        current.type === 'TSAbstractAccessorProperty') &&
      current.value === child
    ) {
      return current;
    }
    child = current;
    current = context.parentOf.get(current);
  }
  // Slots live in setup bodies, so every write of one is inside a function.
  return fail(
    context,
    'A write to a reactive variable must be inside a function.',
    node,
  );
}

// A destructuring write that is a whole expression statement in a statement list.
function isListStatement(context: AnalysisContext, node: Node): boolean {
  let current = node;
  let parent = context.parentOf.get(current);
  while (parent && parent.type === 'ParenthesizedExpression') {
    current = parent;
    parent = context.parentOf.get(current);
  }
  if (!parent || parent.type !== 'ExpressionStatement') {
    return false;
  }
  const list = context.parentOf.get(parent);
  return (
    list?.type === 'BlockStatement' ||
    list?.type === 'Program' ||
    list?.type === 'SwitchCase'
  );
}

// The slotted targets of a pattern, in source order.
function collectTargets(
  context: AnalysisContext,
  slotOf: Map<Binding, Slot>,
  pattern: Node,
): WriteTarget[] {
  const { info, parentOf } = context;
  const targets: WriteTarget[] = [];
  visit(pattern, (node, parent) => {
    if (node.type !== 'Identifier') {
      return;
    }

    // A reference counts when it is a write target. A declaring identifier (a
    // redeclare) counts as it is.
    const ref = info.referenceOf.get(node);
    let binding: Binding | null | undefined;
    if (ref) {
      binding = ref.write ? ref.binding : null;
    } else {
      binding = info.declarationOf.get(node);
    }
    const slot = binding ? slotOf.get(binding) : undefined;
    if (!binding || !slot) {
      return;
    }

    // `{ x }` and `{ x = 1 }` print the target as `x: <temp>`.
    let shorthand = parent?.type === 'Property' && parent.shorthand;
    if (parent?.type === 'AssignmentPattern' && parent.left === node) {
      const property = parentOf.get(parent);
      shorthand = property?.type === 'Property' && property.shorthand;
    }
    targets.push({
      identifier: node as IdentifierReference | BindingIdentifier,
      binding,
      slot,
      shorthand,
    });
  });
  return targets;
}

/** True for the declarator of `for (var x of e)` or `for (var x in e)`. */
export function isForHead(
  context: AnalysisContext,
  declarator: VariableDeclarator,
): boolean {
  const declaration = context.parentOf.get(declarator);
  if (!declaration) {
    return false;
  }
  const loop = context.parentOf.get(declaration);
  return (
    (loop?.type === 'ForInStatement' || loop?.type === 'ForOfStatement') &&
    loop.left === declaration
  );
}

function getWriteKind(node: Node): { kind: WriteKind; pattern: Node } {
  switch (node.type) {
    case 'UpdateExpression':
      return { kind: 'update', pattern: node.argument };
    case 'ForInStatement':
    case 'ForOfStatement':
      return { kind: 'for', pattern: node.left };
    case 'AssignmentExpression': {
      const pattern = node.left;
      if (unwrap(pattern).type !== 'Identifier') {
        return { kind: 'destructure', pattern };
      }
      if (node.operator === '=') {
        return { kind: 'assign', pattern };
      }
      if (
        node.operator === '||=' ||
        node.operator === '&&=' ||
        node.operator === '??='
      ) {
        return { kind: 'logical', pattern };
      }
      return { kind: 'compound', pattern };
    }
    default:
      throw new Error(`Unexpected write expression ${node.type}`);
  }
}

/**
 * Step 10. Every `writeExpression` of a reference to a slotted binding, plus the
 * redeclares, in source order. A target with a `const` binding fails.
 */
export function findWriteSites(
  context: AnalysisContext,
  slotOf: Map<Binding, Slot>,
  redeclarations: Map<VariableDeclarator, SlotCandidate[]>,
): WriteSites {
  const writes: WriteSite[] = [];
  const writeOf = new Map<Node, WriteSite>();

  // The write expressions, each once.
  const siteNodes = new Set<Node>();
  for (const binding of slotOf.keys()) {
    for (const ref of binding.references) {
      if (ref.write && ref.writeExpression) {
        siteNodes.add(ref.writeExpression);
      }
    }
  }

  // Source order, so the first error is the first in the file.
  const ordered = [...siteNodes].toSorted((a, b) => a.start - b.start);
  for (const node of ordered) {
    const { kind, pattern } = getWriteKind(node);
    const targets = collectTargets(context, slotOf, pattern);
    for (const target of targets) {
      if (target.binding.kind === 'const') {
        fail(context, 'Cannot assign to a constant.', target.identifier);
      }
    }
    const site: WriteSite = {
      kind,
      node,
      pattern,
      targets,
      statement: kind === 'destructure' && isListStatement(context, node),
      fn: findTempOwner(context, node),
    };
    writes.push(site);
    writeOf.set(node, site);
  }

  // A later `var x` of a slotted candidate is a write of it. As the head of a for-in
  // or for-of loop, it is a `for` write of the loop.
  for (const declarator of redeclarations.keys()) {
    const targets = collectTargets(context, slotOf, declarator.id);
    if (targets.length === 0) {
      continue;
    }
    const declaration = context.parentOf.get(declarator)!;
    const loop = context.parentOf.get(declaration)!;
    let site: WriteSite;
    if (isForHead(context, declarator)) {
      site = {
        kind: 'for',
        node: loop,
        pattern: declaration,
        targets,
        statement: false,
        fn: findTempOwner(context, loop),
      };
    } else {
      site = {
        kind: 'redeclare',
        node: declarator,
        pattern: declarator.id,
        targets,
        // False for the init of a `for` statement, which holds no statements.
        statement: !(loop.type === 'ForStatement' && loop.init === declaration),
        fn: findTempOwner(context, declarator),
      };
    }
    writes.push(site);
    writeOf.set(site.node, site);
  }

  writes.sort((a, b) => a.node.start - b.node.start);
  return { writes, writeOf };
}
