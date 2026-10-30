import type { Node } from 'oxc-parser';

// Wrappers whose `expression` is the value: parentheses and the TS value wrappers.
const WRAPPERS = new Set<string>([
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

// Keys that only hold types. They are never walked.
const TYPE_KEYS = new Set<string>([
  'typeAnnotation',
  'typeParameters',
  'typeArguments',
  'returnType',
  'implements',
  'superTypeArguments',
]);

const SKIP_KEYS = new Set<string>([
  'type',
  'start',
  'end',
  'range',
  'loc',
  'parent',
]);

/** A node that `unwrap` sees through. */
export function isWrapper(node: Node): boolean {
  return WRAPPERS.has(node.type);
}

/** Sees through ParenthesizedExpression, as, satisfies, !, <T>x and x<T>. */
export function unwrap(node: Node): Node {
  let current = node;
  while (WRAPPERS.has(current.type)) {
    current = (current as { expression: Node }).expression;
  }
  return current;
}

function isNode(value: unknown): value is Node {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

/**
 * Child nodes in source order (sorted by start). Type-only keys (typeAnnotation,
 * typeParameters, typeArguments, returnType, implements, superTypeArguments) are left
 * out, and a shorthand property yields its value only: its key is a second node with
 * the same span, and a pass that edits by span would edit twice.
 */
export function childNodes(node: Node): Node[] {
  const children: Node[] = [];
  const shorthand = node.type === 'Property' && node.shorthand;
  const record = node as unknown as Record<string, unknown>;
  for (const key in record) {
    if (SKIP_KEYS.has(key) || TYPE_KEYS.has(key)) {
      continue;
    }
    if (shorthand && key === 'key') {
      continue;
    }
    const value = record[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          children.push(item);
        }
      }
    } else if (isNode(value)) {
      children.push(value);
    }
  }
  // Key order is not always source order (decorators, for example).
  children.sort((a, b) => a.start - b.start);
  return children;
}

/** Pre-order walk over childNodes, with the parent. Return false to skip the children. */
export function visit(
  node: Node,
  enter: (node: Node, parent: Node | null) => boolean | void,
): void {
  visitNode(node, null, enter);
}

function visitNode(
  node: Node,
  parent: Node | null,
  enter: (node: Node, parent: Node | null) => boolean | void,
): void {
  if (enter(node, parent) === false) {
    return;
  }
  for (const child of childNodes(node)) {
    visitNode(child, node, enter);
  }
}

/** The parent of a node, and the child of that parent the node sits in. */
export interface Placement {
  /** The node, or the outermost wrapper around it. */
  node: Node;
  parent: Node | null;
}

/** Walks up from a node through parentheses and TS wrappers. */
export function climbWrappers(
  parentOf: Map<Node, Node | null>,
  node: Node,
): Placement {
  let current = node;
  let parent = parentOf.get(current) ?? null;
  while (parent && isWrapper(parent)) {
    current = parent;
    parent = parentOf.get(current) ?? null;
  }
  return { node: current, parent };
}

/** True when the node is the callee of a call, through wrappers (`f()`, `f?.()`, `(f as F)()`). */
export function isCallee(
  parentOf: Map<Node, Node | null>,
  node: Node,
): boolean {
  const { node: current, parent } = climbWrappers(parentOf, node);
  return parent?.type === 'CallExpression' && parent.callee === current;
}
