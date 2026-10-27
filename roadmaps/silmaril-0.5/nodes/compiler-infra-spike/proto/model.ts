// The reactive model of a module: scopes, slots, entries, reads, graphs, write sites
// and compile errors, computed once on the original AST, as in the reactivity-runtime
// contract (PR #8, version 3). In the package this is compiler/analysis/model.ts and its
// neighbours. Codegen reads this model only.
import type { Binding, Node, Reference, ScopeInfo } from './scope.ts';
import {
  CompileError,
  isWrapper,
  unwrap,
  visit,
  type ParsedModule,
  type SilmarilImports,
  type TrackedName,
} from './source.ts';

export type ReactiveScopeKind =
  | 'root'
  | 'composable'
  | 'sync'
  | 'effect'
  | 'memo';

export interface ReactiveScope {
  kind: ReactiveScopeKind;
  /**
   * The function whose parameter is the scope: a setup function or an entry body.
   * For a memo or an expression entry, the expression the compiler wraps in `() =>`.
   */
  node: Node;
  /** True for a function that can declare slots and entries (a scope body). */
  isBody: boolean;
  /** The `$$` or `$composable` call of a setup scope. */
  call: Node | null;
  /** null for every setup scope, nested ones included. */
  parent: ReactiveScope | null;
  /** The entry whose runs make this scope, null for a setup scope. */
  entry: Entry | null;
  /** The setup scope of this setup tree. */
  tree: ReactiveScope;
  /** Setup nesting depth: 0 for a setup that is in no other setup tree. */
  setupDepth: number;
  slots: Slot[];
  entries: Entry[];
  /** graph[slot] = refs. null when the compiled call takes no graph argument. */
  graph: Ref[][] | null;
  /** The parameter name codegen gives this scope. */
  param: string;
  /** False when nothing in the body uses the parameter, so it can be left out. */
  paramUsed: boolean;
  /** The graph constant name, when graph is not null. */
  graphName: string | null;
}

export type Ref = number | number[];

export type EntryKind = 'memo' | 'store-writeback' | 'sync' | 'effect';

export interface Entry {
  id: number;
  kind: EntryKind;
  /** The VariableDeclarator of a memo or write-back, the `$`/`$sync` call otherwise. */
  node: Node;
  scope: ReactiveScope;
  /** Memo output slot, -1 for a destructuring memo, null for other kinds. */
  slot: number | null;
  /** Bindings with a slot that the entry reads (contract "Reads"). */
  reads: Set<Binding>;
  /** The scope of each run. null for a write-back, which has no run. */
  child: ReactiveScope | null;
}

export interface Slot {
  index: number;
  scope: ReactiveScope;
  binding: Binding;
  declarator: SlotDeclarator;
}

export type SlotDeclaratorKind = 'state' | 'memo' | 'store';

export interface SlotDeclarator {
  kind: SlotDeclaratorKind;
  declaration: Node;
  declarator: Node;
  scope: ReactiveScope;
  slots: Slot[];
  /** The memo or write-back entry. */
  entry: Entry | null;
  /** The `$store(...)` call of a store declarator. */
  store: Node | null;
}

export type WriteKind =
  | 'assign'
  | 'compound'
  | 'logical'
  | 'update'
  | 'destructure'
  | 'for'
  | 'redeclare';

export interface WriteTarget {
  identifier: Node;
  binding: Binding;
  slot: Slot;
  /** `{ x }` or `{ x = 1 }`: the target must be printed as `x: <target>`. */
  shorthand: boolean;
}

export interface WriteSite {
  kind: WriteKind;
  /** AssignmentExpression, UpdateExpression, ForIn/ForOfStatement, or a VariableDeclarator that redeclares a `var`. */
  node: Node;
  /** The assignment target as written: identifier or pattern. */
  pattern: Node;
  /** Targets with a slot, in source order. A pattern can hold other targets, which stay. */
  targets: WriteTarget[];
  /** A destructuring write that is a whole statement in a statement list. */
  statement: boolean;
  /** The nearest function, which declares the temps of this site. */
  fn: Node;
}

export interface ScopeBinding {
  call: Node;
  name: TrackedName | 'composable-call';
  scope: ReactiveScope;
}

export interface ModuleModel {
  parsed: ParsedModule;
  info: ScopeInfo;
  imports: SilmarilImports;
  /** Every reactive scope in source order of its node. */
  scopes: ReactiveScope[];
  setupOf: Map<Node, ReactiveScope>;
  entryOfCall: Map<Node, Entry>;
  slotOf: Map<Binding, Slot>;
  declarators: Map<Node, SlotDeclarator>;
  /** Declarations holding at least one slot declarator or a redeclared `var` with a slot. */
  declarations: Map<Node, Node[]>;
  writes: WriteSite[];
  writeOf: Map<Node, WriteSite>;
  /** `$skip(...)` calls. Their argument ranges are not tracked. */
  skips: Node[];
  /** onMount and onDestroy calls, and calls of local composables, with the scope they bind to. */
  bindings: ScopeBinding[];
  bindingOf: Map<Node, ScopeBinding>;
  /** Names of the compile-time calls, keyed by call node. */
  trackedCalls: Map<Node, TrackedName>;
  /** Every name written in the module, to pick generated names. */
  names: Set<string>;
}

const LOOPS = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

const STATEMENT_CONTAINERS = new Set([
  'BlockStatement',
  'IfStatement',
  'TryStatement',
  'CatchClause',
  'SwitchStatement',
  'SwitchCase',
  'LabeledStatement',
]);

function isFunctionNode(node: Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

function compareRefs(a: Ref, b: Ref): number {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  if (typeof a === 'number') {
    return -1;
  }
  if (typeof b === 'number') {
    return 1;
  }
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) {
      return a[i]! - b[i]!;
    }
  }
  return a.length - b.length;
}

export function analyzeModel(
  parsed: ParsedModule,
  info: ScopeInfo,
  imports: SilmarilImports,
): ModuleModel {
  const { code, program } = parsed;
  const fail = (message: string, node: Node): never => {
    throw new CompileError(message, code, node.start);
  };

  // Parents of every node, from one walk.
  const parentOf = new Map<Node, Node | null>();
  visit(program, (node, parent) => {
    parentOf.set(node, parent);
  });

  // 1. Compile-time names: each reference must be the callee of a call.
  const trackedCalls = new Map<Node, TrackedName>();
  const localName = new Map<Node, string>();
  for (const [binding, name] of imports.tracked) {
    for (const ref of binding.references) {
      let current = ref.identifier;
      let parent = parentOf.get(current);
      while (parent && isWrapper(parent)) {
        current = parent;
        parent = parentOf.get(current);
      }
      if (
        !parent ||
        parent.type !== 'CallExpression' ||
        parent.callee !== current
      ) {
        fail(`${binding.name} can only be called.`, ref.identifier);
      }
      trackedCalls.set(parent, name);
      localName.set(parent, binding.name);
    }
  }
  const calls = [...trackedCalls.keys()].toSorted((a, b) => a.start - b.start);

  function nameOf(call: Node): string {
    return localName.get(call)!;
  }

  function oneArgument(call: Node): Node {
    if (
      call.arguments.length !== 1 ||
      call.arguments[0].type === 'SpreadElement'
    ) {
      fail(`${nameOf(call)} takes exactly one argument.`, call);
    }
    return call.arguments[0];
  }

  const scopes: ReactiveScope[] = [];
  const scopeOfNode = new Map<Node, ReactiveScope>();
  const setupOf = new Map<Node, ReactiveScope>();

  function makeScope(
    kind: ReactiveScopeKind,
    node: Node,
    isBody: boolean,
    call: Node | null,
    entry: Entry | null,
    parent: ReactiveScope | null,
    tree: ReactiveScope | null,
    setupDepth: number,
  ): ReactiveScope {
    const scope: ReactiveScope = {
      kind,
      node,
      isBody,
      call,
      parent,
      entry,
      tree: null as unknown as ReactiveScope,
      setupDepth,
      slots: [],
      entries: [],
      graph: null,
      param: '',
      paramUsed: false,
      graphName: null,
    };
    scope.tree = tree ?? scope;
    scopes.push(scope);
    scopeOfNode.set(node, scope);
    return scope;
  }

  // The nearest setup function around a node, and the number of setups around it.
  function enclosingSetup(node: Node): ReactiveScope | null {
    let current = parentOf.get(node);
    while (current) {
      const scope = scopeOfNode.get(current);
      if (scope && scope.call) {
        return scope;
      }
      current = parentOf.get(current);
    }
    return null;
  }

  // 2. Setup trees: each `$$` and `$composable` call, outer ones first.
  for (const call of calls) {
    const name = trackedCalls.get(call)!;
    if (name !== '$$' && name !== '$composable') {
      continue;
    }
    const fn = unwrap(oneArgument(call));
    if (
      fn.type !== 'ArrowFunctionExpression' &&
      fn.type !== 'FunctionExpression'
    ) {
      fail(`${nameOf(call)} must be called with a function.`, call);
    }
    const outer = enclosingSetup(call);
    const scope = makeScope(
      name === '$$' ? 'root' : 'composable',
      fn,
      true,
      call,
      null,
      null,
      null,
      outer ? outer.setupDepth + 1 : 0,
    );
    setupOf.set(call, scope);
  }

  // 3. `$` and `$sync`: statement position, owner scope, entry bodies. Outer calls come
  // first, so the body of an outer entry is known when an inner call is checked.
  interface PendingEntry {
    call: Node;
    kind: 'sync' | 'effect';
    owner: ReactiveScope;
    arg: Node;
  }
  const pendingEntries: PendingEntry[] = [];
  const entryChildOf = new Map<Node, ReactiveScope>();
  for (const call of calls) {
    const name = trackedCalls.get(call)!;
    if (name !== '$' && name !== '$sync') {
      continue;
    }
    const arg = oneArgument(call);
    let current = call;
    let parent = parentOf.get(current);
    while (parent && parent.type === 'ParenthesizedExpression') {
      current = parent;
      parent = parentOf.get(current);
    }
    const statementError = `${nameOf(call)} must be called as a statement of a setup body.`;
    if (!parent || parent.type !== 'ExpressionStatement') {
      fail(statementError, call);
    }
    let inLoop = false;
    let owner: ReactiveScope | null = null;
    current = parent;
    parent = parentOf.get(current);
    while (parent) {
      if (STATEMENT_CONTAINERS.has(parent.type)) {
        current = parent;
        parent = parentOf.get(current);
        continue;
      }
      if (LOOPS.has(parent.type) && parent.body === current) {
        inLoop = true;
        current = parent;
        parent = parentOf.get(current);
        continue;
      }
      if (isFunctionNode(parent) && parent.body === current) {
        const scope = scopeOfNode.get(parent);
        if (scope && scope.isBody) {
          owner = scope;
        }
      }
      break;
    }
    if (!owner) {
      fail(statementError, call);
    }
    if (inLoop) {
      fail(`${nameOf(call)} cannot be called inside a loop.`, call);
    }
    const kind = name === '$sync' ? 'sync' : 'effect';
    const fn = unwrap(arg);
    if (
      fn.type === 'ArrowFunctionExpression' ||
      fn.type === 'FunctionExpression'
    ) {
      const child = makeScope(
        kind,
        fn,
        true,
        null,
        null,
        owner,
        owner!.tree,
        owner!.setupDepth,
      );
      entryChildOf.set(call, child);
    }
    pendingEntries.push({ call, kind, owner: owner!, arg });
  }

  // 4. Names that must be in a setup tree, and `$store` placement.
  const skips: Node[] = [];
  for (const call of calls) {
    const name = trackedCalls.get(call)!;
    if (name === '$skip' || name === 'onMount' || name === 'onDestroy') {
      if (!enclosingSetup(call)) {
        fail(`${nameOf(call)} must be used inside $$ or $composable.`, call);
      }
      if (name === '$skip') {
        oneArgument(call);
        skips.push(call);
      }
    }
    if (name === '$store') {
      oneArgument(call);
      let current = call;
      let parent = parentOf.get(current);
      while (parent && isWrapper(parent)) {
        current = parent;
        parent = parentOf.get(current);
      }
      const declaration = parent && parentOf.get(parent);
      const block = declaration && parentOf.get(declaration);
      const fn = block && parentOf.get(block);
      if (
        !parent ||
        parent.type !== 'VariableDeclarator' ||
        parent.init !== current ||
        parent.id.type !== 'Identifier' ||
        block.type !== 'BlockStatement' ||
        !scopeOfNode.get(fn)?.isBody
      ) {
        fail('$store must initialize a top-level variable.', call);
      }
    }
  }

  // 5. The `/* $skip */` comment of 0.4.
  for (const comment of parsed.comments) {
    if (comment.value.trim() !== '$skip') {
      continue;
    }
    for (const scope of scopes) {
      if (
        scope.call &&
        comment.start >= scope.node.start &&
        comment.end <= scope.node.end
      ) {
        fail(
          'The /* $skip */ comment is not supported. Use $skip(expression).',
          comment,
        );
      }
    }
  }

  const skipCalls = new Set(skips);
  const entryCalls = new Set<Node>();
  for (const pending of pendingEntries) {
    entryCalls.add(pending.call);
  }

  // The setup tree of a node: its nearest setup scope.
  function treeOf(node: Node): ReactiveScope | null {
    const scope = scopeOfNode.get(node);
    if (scope && scope.call) {
      return scope;
    }
    return enclosingSetup(node);
  }

  // 6. Slot candidates: top-level declarators of each scope body.
  interface Candidate {
    declaration: Node;
    declarator: Node;
    kind: 'let' | 'const' | 'var';
    scope: ReactiveScope;
    bindings: Binding[];
    neverMemo: boolean;
    store: Node | null;
  }
  const candidates: Candidate[] = [];
  const candidateOf = new Map<Binding, Candidate>();
  const redeclarations = new Map<Node, Candidate>();

  function patternBindings(pattern: Node): Binding[] {
    const out: Binding[] = [];
    visit(pattern, (node) => {
      if (node.type === 'Identifier') {
        const binding = info.declarationOf.get(node);
        if (binding) {
          out.push(binding);
        }
      }
      // Defaults and computed keys hold no declarations.
      if (node.type === 'AssignmentPattern') {
        visit(node.left, (inner) => {
          if (inner.type === 'Identifier') {
            const binding = info.declarationOf.get(inner);
            if (binding) {
              out.push(binding);
            }
          }
        });
        return false;
      }
      if (node.type === 'Property' && node.computed) {
        visit(node.value, (inner) => {
          if (inner.type === 'Identifier') {
            const binding = info.declarationOf.get(inner);
            if (binding) {
              out.push(binding);
            }
          }
        });
        return false;
      }
    });
    return out;
  }

  for (const scope of scopes) {
    if (!scope.isBody || scope.node.body.type !== 'BlockStatement') {
      continue;
    }
    for (const statement of scope.node.body.body) {
      if (statement.type !== 'VariableDeclaration') {
        continue;
      }
      const kind = statement.kind;
      if (kind !== 'let' && kind !== 'const' && kind !== 'var') {
        continue;
      }
      for (const declarator of statement.declarations) {
        const bindings = patternBindings(declarator.id);
        // A second `var x` of a name that already has a candidate is a write of it.
        const earlier =
          bindings.length > 0 ? candidateOf.get(bindings[0]!) : undefined;
        if (earlier) {
          redeclarations.set(declarator, earlier);
          continue;
        }
        const init = declarator.init ? unwrap(declarator.init) : null;
        const initName =
          init && init.type === 'CallExpression'
            ? trackedCalls.get(init)
            : undefined;
        const candidate: Candidate = {
          declaration: statement,
          declarator,
          kind,
          scope,
          bindings,
          neverMemo:
            init !== null &&
            (isFunctionNode(init) ||
              init.type === 'ClassExpression' ||
              initName === '$$' ||
              initName === '$composable'),
          store: initName === '$store' ? init : null,
        };
        candidates.push(candidate);
        for (const binding of bindings) {
          candidateOf.set(binding, candidate);
        }
      }
    }
  }

  // Rule 1: a let or var written anywhere other than by its own initializer.
  function written(candidate: Candidate): boolean {
    if (candidate.kind === 'const') {
      return false;
    }
    for (const binding of candidate.bindings) {
      for (const ref of binding.references) {
        if (ref.write) {
          return true;
        }
      }
    }
    for (const [declarator, earlier] of redeclarations) {
      if (earlier === candidate && declarator.init) {
        return true;
      }
    }
    return false;
  }

  const slotted = new Set<Binding>();
  const memoCandidates = new Set<Candidate>();
  const slottedCandidates = new Set<Candidate>();
  function giveSlots(candidate: Candidate): void {
    slottedCandidates.add(candidate);
    for (const binding of candidate.bindings) {
      slotted.add(binding);
    }
  }
  for (const candidate of candidates) {
    if (candidate.store || written(candidate)) {
      giveSlots(candidate);
    }
  }

  // Local functions: function declarations, and declarators with a function initializer
  // and no slot, inside a setup tree. Keyed by binding, with the function node.
  function localFunction(binding: Binding): Node | null {
    if (slotted.has(binding)) {
      return null;
    }
    const declaration = binding.declaration;
    if (
      binding.kind === 'function' &&
      declaration.type === 'FunctionDeclaration'
    ) {
      return treeOf(declaration) ? declaration : null;
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
        return treeOf(declaration) ? init : null;
      }
    }
    return null;
  }

  interface DirectReads {
    reads: Set<Binding>;
    calls: Set<Binding>;
  }

  function isCallee(identifier: Node): boolean {
    let current = identifier;
    let parent = parentOf.get(current);
    while (parent && isWrapper(parent)) {
      current = parent;
      parent = parentOf.get(current);
    }
    return parent?.type === 'CallExpression' && parent.callee === current;
  }

  // Reads and local calls in a subtree. Nested entries, `$skip` arguments, nested setups
  // and the nodes in `skip` (memo initializers of a child scope) are left out.
  function directReads(
    root: Node,
    tree: ReactiveScope,
    skip: Set<Node> | null,
  ): DirectReads {
    const result: DirectReads = { reads: new Set(), calls: new Set() };
    visit(root, (node) => {
      if (entryCalls.has(node) || skipCalls.has(node) || setupOf.has(node)) {
        return false;
      }
      if (skip && skip.has(node)) {
        return false;
      }
      if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') {
        return;
      }
      const ref = info.referenceOf.get(node);
      if (!ref || ref.write || !ref.binding) {
        return;
      }
      if (slotted.has(ref.binding)) {
        result.reads.add(ref.binding);
      } else if (isCallee(node)) {
        const fn = localFunction(ref.binding);
        if (fn && treeOf(fn) === tree) {
          result.calls.add(ref.binding);
        }
      }
    });
    return result;
  }

  // Reads of a subtree, with the reads of the local functions it calls, to a fixed point.
  function readsOf(
    root: Node,
    tree: ReactiveScope,
    skip: Set<Node> | null,
  ): Set<Binding> {
    const first = directReads(root, tree, skip);
    const reads = new Set(first.reads);
    const seen = new Set<Binding>();
    const queue = [...first.calls];
    while (queue.length > 0) {
      const binding = queue.pop()!;
      if (seen.has(binding)) {
        continue;
      }
      seen.add(binding);
      const fn = localFunction(binding)!;
      const inner = directReads(fn, tree, null);
      for (const read of inner.reads) {
        reads.add(read);
      }
      for (const call of inner.calls) {
        queue.push(call);
      }
    }
    return reads;
  }

  // Rule 2, to a fixed point: a declarator whose initializer reads a slot is a memo.
  let changed = true;
  while (changed) {
    changed = false;
    for (const candidate of candidates) {
      if (
        memoCandidates.has(candidate) ||
        candidate.neverMemo ||
        candidate.store ||
        !candidate.declarator.init
      ) {
        continue;
      }
      const reads = readsOf(
        candidate.declarator.init,
        candidate.scope.tree,
        null,
      );
      if (reads.size > 0) {
        memoCandidates.add(candidate);
        if (!slottedCandidates.has(candidate)) {
          giveSlots(candidate);
        }
        changed = true;
      }
    }
  }

  // 7. Slots, numbered in source order of the declarators.
  const slotOf = new Map<Binding, Slot>();
  const declarators = new Map<Node, SlotDeclarator>();
  const declarations = new Map<Node, Node[]>();
  for (const candidate of candidates) {
    if (!slottedCandidates.has(candidate)) {
      continue;
    }
    const kind: SlotDeclaratorKind = candidate.store
      ? 'store'
      : memoCandidates.has(candidate)
        ? 'memo'
        : 'state';
    const record: SlotDeclarator = {
      kind,
      declaration: candidate.declaration,
      declarator: candidate.declarator,
      scope: candidate.scope,
      slots: [],
      entry: null,
      store: candidate.store,
    };
    for (const binding of candidate.bindings) {
      const slot: Slot = {
        index: candidate.scope.slots.length,
        scope: candidate.scope,
        binding,
        declarator: record,
      };
      candidate.scope.slots.push(slot);
      record.slots.push(slot);
      slotOf.set(binding, slot);
    }
    declarators.set(candidate.declarator, record);
    let list = declarations.get(candidate.declaration);
    if (!list) {
      list = [];
      declarations.set(candidate.declaration, list);
    }
    list.push(candidate.declarator);
  }

  // 8. Entries: memos and write-backs, then `$sync`, then `$`, each in source order.
  const entryOfCall = new Map<Node, Entry>();
  const memoInits = new Map<ReactiveScope, Set<Node>>();
  const bodies = scopes.filter((scope) => scope.isBody);
  for (const scope of bodies) {
    const inits = new Set<Node>();
    memoInits.set(scope, inits);
    for (const record of declarators.values()) {
      if (record.scope !== scope) {
        continue;
      }
      if (record.kind === 'memo') {
        const entry: Entry = {
          id: scope.entries.length,
          kind: 'memo',
          node: record.declarator,
          scope,
          slot:
            record.declarator.id.type === 'Identifier'
              ? record.slots[0]!.index
              : -1,
          reads: new Set(),
          child: null,
        };
        entry.child = makeScope(
          'memo',
          record.declarator.init,
          false,
          null,
          entry,
          scope,
          scope.tree,
          scope.setupDepth,
        );
        scope.entries.push(entry);
        record.entry = entry;
        inits.add(record.declarator.init);
      } else if (
        record.kind === 'store' &&
        record.declaration.kind !== 'const'
      ) {
        const entry: Entry = {
          id: scope.entries.length,
          kind: 'store-writeback',
          node: record.declarator,
          scope,
          slot: record.slots[0]!.index,
          reads: new Set([record.slots[0]!.binding]),
          child: null,
        };
        scope.entries.push(entry);
        record.entry = entry;
      }
    }
    for (const kind of ['sync', 'effect'] as const) {
      for (const pending of pendingEntries) {
        if (pending.owner !== scope || pending.kind !== kind) {
          continue;
        }
        const entry: Entry = {
          id: scope.entries.length,
          kind,
          node: pending.call,
          scope,
          slot: null,
          reads: new Set(),
          child: null,
        };
        const body = entryChildOf.get(pending.call);
        if (body) {
          body.entry = entry;
          entry.child = body;
        } else {
          entry.child = makeScope(
            kind,
            pending.arg,
            false,
            null,
            entry,
            scope,
            scope.tree,
            scope.setupDepth,
          );
        }
        scope.entries.push(entry);
        entryOfCall.set(pending.call, entry);
      }
    }
  }

  // 9. Reads of each entry.
  const memoReads = new Map<Entry, Set<Binding>>();
  for (const scope of bodies) {
    for (const entry of scope.entries) {
      if (entry.kind === 'memo') {
        entry.reads = readsOf(entry.node.init, scope.tree, null);
        memoReads.set(entry, entry.reads);
      }
    }
  }
  for (const scope of bodies) {
    for (const entry of scope.entries) {
      if (entry.kind !== 'sync' && entry.kind !== 'effect') {
        continue;
      }
      const child = entry.child!;
      if (!child.isBody) {
        entry.reads = readsOf(child.node, scope.tree, null);
        continue;
      }
      const reads = readsOf(
        child.node,
        scope.tree,
        memoInits.get(child) ?? null,
      );
      // Reads of the child's own slots are removed. A read of a child memo brings the
      // memo's reads instead, to a fixed point (fixture body-memo).
      const done = new Set<Binding>();
      let again = true;
      while (again) {
        again = false;
        // A Set visits the reads added during the loop, and skips deleted ones.
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
            for (const read of memoReads.get(memo)!) {
              reads.add(read);
            }
            again = true;
          }
        }
      }
      entry.reads = reads;
    }
  }

  // 10. Graphs.
  for (const scope of bodies) {
    if (scope.call || scope.slots.length > 0) {
      scope.graph = [];
      for (let i = 0; i < scope.slots.length; i += 1) {
        scope.graph.push([]);
      }
    }
  }
  for (const scope of bodies) {
    for (const entry of scope.entries) {
      for (const binding of entry.reads) {
        const slot = slotOf.get(binding)!;
        if (slot.scope.tree !== scope.tree) {
          continue;
        }
        const path: number[] = [];
        let current: ReactiveScope | null = scope;
        while (current && current !== slot.scope) {
          path.unshift(current.entry ? current.entry.id : -1);
          current = current.entry ? current.entry.scope : null;
        }
        if (current !== slot.scope) {
          continue;
        }
        slot.scope.graph![slot.index]!.push(
          path.length === 0 ? entry.id : [...path, entry.id],
        );
      }
    }
  }
  for (const scope of bodies) {
    if (scope.graph) {
      for (const list of scope.graph) {
        list.sort(compareRefs);
      }
    }
  }

  // 11. Write sites.
  const writes: WriteSite[] = [];
  const writeOf = new Map<Node, WriteSite>();

  function nearestFunction(node: Node): Node {
    let current = parentOf.get(node);
    while (current) {
      if (isFunctionNode(current)) {
        return current;
      }
      current = parentOf.get(current);
    }
    return fail(
      'A write to a reactive variable must be inside a function.',
      node,
    );
  }

  function inClassField(node: Node): boolean {
    let current = node;
    let parent = parentOf.get(current);
    while (parent) {
      if (isFunctionNode(parent)) {
        return false;
      }
      if (
        (parent.type === 'PropertyDefinition' ||
          parent.type === 'AccessorProperty') &&
        parent.value === current
      ) {
        return true;
      }
      current = parent;
      parent = parentOf.get(current);
    }
    return false;
  }

  function isStatement(node: Node): boolean {
    let current = node;
    let parent = parentOf.get(current);
    while (parent && parent.type === 'ParenthesizedExpression') {
      current = parent;
      parent = parentOf.get(current);
    }
    if (!parent || parent.type !== 'ExpressionStatement') {
      return false;
    }
    const list = parentOf.get(parent);
    return (
      list !== undefined &&
      list !== null &&
      (list.type === 'BlockStatement' ||
        list.type === 'Program' ||
        list.type === 'SwitchCase')
    );
  }

  function patternTargets(pattern: Node): WriteTarget[] {
    const targets: WriteTarget[] = [];
    visit(pattern, (node, parent) => {
      if (node.type !== 'Identifier') {
        return;
      }
      const ref: Reference | undefined = info.referenceOf.get(node);
      const binding = ref
        ? ref.write
          ? ref.binding
          : null
        : info.declarationOf.get(node);
      if (!binding) {
        return;
      }
      const slot = slotOf.get(binding);
      if (!slot) {
        return;
      }
      const shorthand =
        (parent?.type === 'Property' && parent.shorthand) ||
        (parent?.type === 'AssignmentPattern' &&
          parent.left === node &&
          parentOf.get(parent)?.type === 'Property' &&
          parentOf.get(parent).shorthand);
      targets.push({ identifier: node, binding, slot, shorthand });
    });
    return targets;
  }

  const siteNodes = new Set<Node>();
  for (const [binding, slot] of slotOf) {
    for (const ref of binding.references) {
      if (ref.write && ref.writeExpression) {
        siteNodes.add(ref.writeExpression);
      }
    }
    void slot;
  }
  for (const node of [...siteNodes].toSorted((a, b) => a.start - b.start)) {
    let kind: WriteKind;
    let pattern: Node;
    if (node.type === 'UpdateExpression') {
      kind = 'update';
      pattern = node.argument;
    } else if (
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement'
    ) {
      kind = 'for';
      pattern = node.left;
    } else {
      pattern = node.left;
      const target = unwrap(pattern);
      if (target.type !== 'Identifier') {
        kind = 'destructure';
      } else if (node.operator === '=') {
        kind = 'assign';
      } else if (
        node.operator === '||=' ||
        node.operator === '&&=' ||
        node.operator === '??='
      ) {
        kind = 'logical';
      } else {
        kind = 'compound';
      }
    }
    const targets = patternTargets(pattern);
    for (const target of targets) {
      if (target.binding.kind === 'const') {
        fail('Cannot assign to a constant.', target.identifier);
      }
    }
    const destructures =
      kind === 'destructure' ||
      (kind === 'for' && unwrap(pattern).type !== 'Identifier');
    if (destructures && inClassField(node)) {
      fail(
        'Cannot destructure into a reactive variable in a class field.',
        node,
      );
    }
    const site: WriteSite = {
      kind,
      node,
      pattern,
      targets,
      statement: kind === 'destructure' && isStatement(node),
      fn: nearestFunction(node),
    };
    writes.push(site);
    writeOf.set(node, site);
  }
  for (const [declarator, candidate] of redeclarations) {
    if (!slottedCandidates.has(candidate)) {
      continue;
    }
    const pattern = declarator.id;
    const targets = patternTargets(pattern);
    const site: WriteSite = {
      kind: 'redeclare',
      node: declarator,
      pattern,
      targets,
      statement: true,
      fn: nearestFunction(declarator),
    };
    writes.push(site);
    writeOf.set(declarator, site);
    let list = declarations.get(parentOf.get(declarator));
    if (!list) {
      list = [];
      declarations.set(parentOf.get(declarator), list);
    }
    list.push(declarator);
  }
  writes.sort((a, b) => a.node.start - b.node.start);

  // 12. Writes in memo initializers, outside nested functions and through local calls.
  function checkMemoWrites(
    root: Node,
    tree: ReactiveScope,
    seen: Set<Binding>,
  ): void {
    visit(root, (node) => {
      if (node !== root && isFunctionNode(node)) {
        return false;
      }
      if (node.type !== 'Identifier') {
        return;
      }
      const ref = info.referenceOf.get(node);
      if (!ref || !ref.binding) {
        return;
      }
      if (ref.write && slotted.has(ref.binding)) {
        fail(
          'Cannot write a reactive variable in the initializer of a derived value.',
          node,
        );
      }
      if (!ref.write && isCallee(node)) {
        const fn = localFunction(ref.binding);
        if (fn && treeOf(fn) === tree && !seen.has(ref.binding)) {
          seen.add(ref.binding);
          const body = fn.body;
          checkMemoWrites(body, tree, seen);
          for (const param of fn.params) {
            checkMemoWrites(param, tree, seen);
          }
        }
      }
    });
  }
  for (const record of declarators.values()) {
    if (record.kind === 'memo') {
      checkMemoWrites(record.declarator.init, record.scope.tree, new Set());
    }
  }

  // 13. Which scope each lifecycle call and local composable call binds to.
  const bindings: ScopeBinding[] = [];
  const bindingOf = new Map<Node, ScopeBinding>();
  function nearestScope(node: Node): ReactiveScope | null {
    // The node itself can be the expression of an expression entry: `$(onMount(f))`.
    let current: Node | null | undefined = node;
    while (current) {
      const scope = scopeOfNode.get(current);
      if (scope) {
        return scope;
      }
      current = parentOf.get(current);
    }
    return null;
  }
  for (const call of calls) {
    const name = trackedCalls.get(call)!;
    if (name === 'onMount' || name === 'onDestroy') {
      const scope = nearestScope(call)!;
      oneArgument(call);
      scope.paramUsed = true;
      const record: ScopeBinding = { call, name, scope };
      bindings.push(record);
      bindingOf.set(call, record);
    }
  }
  visit(program, (node) => {
    if (node.type !== 'CallExpression') {
      return;
    }
    const callee = unwrap(node.callee);
    if (callee.type !== 'Identifier') {
      return;
    }
    const binding = info.referenceOf.get(callee)?.binding;
    const init = binding?.declaration?.init
      ? unwrap(binding.declaration.init)
      : null;
    if (init && setupOf.get(init)?.kind === 'composable') {
      const scope = nearestScope(node);
      if (scope) {
        const record: ScopeBinding = {
          call: node,
          name: 'composable-call',
          scope,
        };
        bindings.push(record);
        bindingOf.set(node, record);
      }
    }
  });

  // 14. Names: scope parameters, graphs. A prefix that no user name can collide with.
  const names = info.names;
  let prefix = '$';
  const taken = (p: string): boolean => {
    const pattern = new RegExp(`^${p.replaceAll('$', '\\$')}[sctg](\\d|_|$)`);
    for (const name of names) {
      if (pattern.test(name)) {
        return true;
      }
    }
    return false;
  };
  while (taken(prefix)) {
    prefix += '_';
  }
  scopes.sort((a, b) => a.node.start - b.node.start);
  let graphCount = 0;
  for (const scope of scopes) {
    if (scope.call) {
      scope.param =
        scope.setupDepth === 0 ? `${prefix}s` : `${prefix}s${scope.setupDepth}`;
      scope.paramUsed = true;
    } else {
      const path: number[] = [];
      let current: ReactiveScope | null = scope;
      while (current && current.entry) {
        path.unshift(current.entry.id);
        current = current.entry.scope;
      }
      const depth = scope.setupDepth === 0 ? '' : `s${scope.setupDepth}_`;
      scope.param = `${prefix}c${depth}${path.join('_')}`;
      if (scope.slots.length > 0 || scope.entries.length > 0) {
        scope.paramUsed = true;
      }
    }
    if (scope.graph) {
      scope.graphName = `${prefix}g${graphCount}`;
      graphCount += 1;
    }
  }

  return {
    parsed,
    info,
    imports,
    scopes,
    setupOf,
    entryOfCall,
    slotOf,
    declarators,
    declarations,
    writes,
    writeOf,
    skips,
    bindings,
    bindingOf,
    trackedCalls,
    names,
  };
}
