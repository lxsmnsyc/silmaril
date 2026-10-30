// The reactive model of a module: scopes, slots, entries, reads, graphs, write sites
// and compile errors, computed once on the original AST, as the reactivity-runtime
// contract (v4) defines them. Codegen reads this model only.
import type {
  AccessorProperty,
  ArrowFunctionExpression,
  BindingIdentifier,
  CallExpression,
  Function as FunctionNode,
  IdentifierReference,
  Node,
  PropertyDefinition,
  VariableDeclaration,
  VariableDeclarator,
} from 'oxc-parser';
import type { ParsedModule } from '../source';
import {
  checkJsxTags,
  checkMemoInitializers,
  checkOneArgument,
  checkPlacedNames,
  checkSkipComments,
  checkStoreCalls,
  fail,
  findTrackedCalls,
} from './checks';
import type { SilmarilImports, TrackedName } from './imports';
import {
  computeEntryReads,
  findEnclosingSetup,
  findMemos,
  hasWrite,
} from './reads';
import { isFunctionNode, type Binding, type ScopeInfo } from './scope';
import { unwrap, visit } from './walk';
import { findWriteSites, isForHead } from './writes';

export type ReactiveScopeKind =
  | 'root'
  | 'composable'
  | 'sync'
  | 'effect'
  | 'memo';

/** A scope of the runtime: a setup, or the child scope of one entry's runs. */
export interface ReactiveScope {
  kind: ReactiveScopeKind;
  /**
   * root, composable: the setup function. sync, effect with a function argument: the
   * entry body. memo, and sync or effect with another argument: the expression that
   * codegen wraps in `() =>`.
   */
  node: Node;
  /** True for a setup function or an entry body: the functions that can declare slots and entries. */
  isBody: boolean;
  /** The `$$` or `$composable` call of a setup. */
  call: CallExpression | null;
  /** The scope that holds `entry`. null for every setup, nested `$$` and `$composable` included. */
  parent: ReactiveScope | null;
  /** The entry whose runs make this scope. null for a setup. */
  entry: Entry | null;
  /** The setup of this setup tree. */
  tree: ReactiveScope;
  /** 0 for a setup in no other setup tree, +1 per enclosing setup tree. */
  setupDepth: number;
  /** Index = slot number. */
  slots: Slot[];
  /** Index = entry id. */
  entries: Entry[];
  /** graph[slot] = sorted refs. null when the compiled call takes no graph (an entry body with no slots, a memo, an expression entry). */
  graph: Ref[][] | null;
  /** The parameter name codegen prints, and whether anything uses it. */
  param: string;
  paramUsed: boolean;
  /** The module-level constant that holds `graph`. */
  graphName: string | null;
}

/** Same shape as the runtime's Ref. */
export type Ref = number | number[];

export type EntryKind = 'memo' | 'store-writeback' | 'sync' | 'effect';

export interface Entry {
  id: number;
  kind: EntryKind;
  /** The VariableDeclarator of a memo or write-back, the `$`/`$sync` call otherwise. */
  node: Node;
  /** The scope that registers the entry. */
  scope: ReactiveScope;
  /** Memo: the output slot, -1 for a destructuring memo. Write-back: its slot. Else null. */
  slot: number | null;
  /** The bindings with a slot that the entry reads (runtime contract "Reads"). */
  reads: Set<Binding>;
  /** The scope of each run. null for a write-back, which never runs a function. */
  child: ReactiveScope | null;
}

export interface Slot {
  index: number;
  scope: ReactiveScope;
  binding: Binding;
  declarator: SlotDeclarator;
}

export interface SlotDeclarator {
  /** state: rule 1 only. memo: rule 2 (also when rule 1 holds). store: rule 3. */
  kind: 'state' | 'memo' | 'store';
  declaration: VariableDeclaration;
  declarator: VariableDeclarator;
  scope: ReactiveScope;
  /** One per bound name, in source order. */
  slots: Slot[];
  /** The memo or write-back entry. */
  entry: Entry | null;
  /** The `$store(...)` call. */
  store: CallExpression | null;
}

export type WriteKind =
  | 'assign' // x = v
  | 'compound' // x op= v
  | 'logical' // x ||= v, x &&= v, x ??= v
  | 'update' // x++, --x
  | 'destructure' // P = e
  | 'for' // for (x of e), for (P in e), for await, for (var x of e) redeclaring a slotted var
  | 'redeclare'; // a later `var x = v` of a slotted var, in a loop too

export interface WriteTarget {
  identifier: IdentifierReference | BindingIdentifier;
  binding: Binding;
  slot: Slot;
  /** `{ x }` or `{ x = 1 }`: the target prints as `x: <temp>`. */
  shorthand: boolean;
}

/** The node that declares the temps of a write site. */
export type TempOwner =
  | FunctionNode
  | ArrowFunctionExpression
  | PropertyDefinition
  | AccessorProperty;

export interface WriteSite {
  kind: WriteKind;
  /**
   * AssignmentExpression, UpdateExpression, ForIn/ForOfStatement, or the VariableDeclarator
   * of a redeclare. A redeclare declarator whose other names get a slot is also in
   * `declarators`; it prints as this write.
   */
  node: Node;
  /** The target as written: the left side, the update argument, the loop head (a VariableDeclaration for `for (var x of e)`), or the declarator id. */
  pattern: Node;
  /** The targets that have a slot, in source order. Other targets (plain locals, members) stay as written. */
  targets: WriteTarget[];
  /** A destructuring write that is a whole expression statement in a statement list. For a redeclare, false only in the init of a `for` statement. */
  statement: boolean;
  /** The nearest function, or the class field whose initializer holds the site: it declares the temps. */
  fn: TempOwner;
}

/** A call that binds to a scope at run time. */
export interface ScopeBinding {
  call: CallExpression;
  /** 'composable-call': a call by name of a local `const f = $composable(...)`. */
  name: 'onMount' | 'onDestroy' | 'composable-call';
  /** onMount and onDestroy print `scope.param`. A composable call is not edited: the runtime uses the running scope, which is this one. */
  scope: ReactiveScope;
}

export interface ModuleModel {
  parsed: ParsedModule;
  info: ScopeInfo;
  imports: SilmarilImports;
  /** Every reactive scope, in source order of `node`. */
  scopes: ReactiveScope[];
  setupOf: Map<CallExpression, ReactiveScope>;
  entryOfCall: Map<CallExpression, Entry>;
  /** Slot of a binding, or nothing for a plain local. */
  slotOf: Map<Binding, Slot>;
  declarators: Map<VariableDeclarator, SlotDeclarator>;
  /** Declarations that hold a slot declarator or a redeclare, with those declarators. */
  declarations: Map<VariableDeclaration, VariableDeclarator[]>;
  /** In source order. */
  writes: WriteSite[];
  writeOf: Map<Node, WriteSite>;
  /** `$skip(...)` calls. Reads inside their argument are not tracked; reads and writes there still compile. */
  skips: CallExpression[];
  bindings: ScopeBinding[];
  bindingOf: Map<CallExpression, ScopeBinding>;
  /** Every call of a compile-time name, with its imported name. */
  trackedCalls: Map<CallExpression, TrackedName>;
}

/** State shared by the steps of the analysis. Internal to `analysis/`. */
export interface AnalysisContext {
  parsed: ParsedModule;
  info: ScopeInfo;
  imports: SilmarilImports;
  parentOf: Map<Node, Node | null>;
  trackedCalls: Map<CallExpression, TrackedName>;
  /** The local name of the callee of each tracked call, alias included. */
  localNames: Map<CallExpression, string>;
  /** The tracked calls in source order. */
  calls: CallExpression[];
  scopes: ReactiveScope[];
  scopeOfNode: Map<Node, ReactiveScope>;
  setupOf: Map<CallExpression, ReactiveScope>;
  entryCalls: Set<CallExpression>;
  skipCalls: Set<CallExpression>;
  /** Bindings that have a slot, filled while the slots reach their fixed point. */
  slotted: Set<Binding>;
}

/** A setup declarator that may get slots (contract step 5). Internal to `analysis/`. */
export interface SlotCandidate {
  declaration: VariableDeclaration;
  declarator: VariableDeclarator;
  kind: 'let' | 'const' | 'var';
  scope: ReactiveScope;
  bindings: Binding[];
  neverMemo: boolean;
  store: CallExpression | null;
  /** Slotted by rule 1 or 3, or by rule 2. */
  slotted: boolean;
  memo: boolean;
}

const LOOPS = new Set<string>([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
]);

// Class members: a `$` or `$sync` in a field value, a computed key or a static block
// is not directly in a setup body.
const CLASS_MEMBERS = new Set<string>([
  'MethodDefinition',
  'PropertyDefinition',
  'AccessorProperty',
  'StaticBlock',
  'TSAbstractMethodDefinition',
  'TSAbstractPropertyDefinition',
  'TSAbstractAccessorProperty',
]);

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

/** The block body of a scope body, or null for an expression-bodied arrow or a non-body scope. */
export function getBlockBody(scope: ReactiveScope): Node[] | null {
  if (!scope.isBody || !isFunctionNode(scope.node)) {
    return null;
  }
  const { body } = scope.node;
  if (body && body.type === 'BlockStatement') {
    return body.body;
  }
  return null;
}

interface BodyDeclarations {
  /** Setup declarations: in the block or nested blocks, outside nested functions and loops. */
  setup: VariableDeclaration[];
  /** `var` declarations in a loop or a loop head of the body, outside nested functions. */
  loopVars: VariableDeclaration[];
}

// The `var` declarations inside a loop, heads included, outside nested functions and
// static blocks. They declare the same binding as a setup `var` of the same name.
function collectLoopVars(loop: Node, out: VariableDeclaration[]): void {
  visit(loop, (node) => {
    if (isFunctionNode(node) || node.type === 'StaticBlock') {
      return false;
    }
    if (node.type === 'VariableDeclaration' && node.kind === 'var') {
      out.push(node);
    }
    return undefined;
  });
}

// The declarations of a scope body (runtime contract "Setup declaration").
function collectBodyDeclarations(statements: Node[]): BodyDeclarations {
  const out: VariableDeclaration[] = [];
  const loopVars: VariableDeclaration[] = [];
  function walk(node: Node | null | undefined): void {
    if (!node) {
      return;
    }
    if (LOOPS.has(node.type)) {
      collectLoopVars(node, loopVars);
      return;
    }
    switch (node.type) {
      case 'VariableDeclaration':
        if (
          node.kind === 'let' ||
          node.kind === 'const' ||
          node.kind === 'var'
        ) {
          out.push(node);
        }
        return;
      case 'BlockStatement':
        for (const statement of node.body) {
          walk(statement);
        }
        return;
      case 'IfStatement':
        walk(node.consequent);
        walk(node.alternate);
        return;
      case 'TryStatement':
        walk(node.block);
        walk(node.handler);
        walk(node.finalizer);
        return;
      case 'CatchClause':
        walk(node.body);
        return;
      case 'SwitchStatement':
        for (const item of node.cases) {
          walk(item);
        }
        return;
      case 'SwitchCase':
        for (const statement of node.consequent) {
          walk(statement);
        }
        return;
      case 'LabeledStatement':
        walk(node.body);
        return;
      default:
    }
  }
  for (const statement of statements) {
    walk(statement);
  }
  return { setup: out, loopVars };
}

// The declared bindings of a binding pattern, in source order. Defaults and computed
// keys hold no declarations.
function collectPatternBindings(info: ScopeInfo, pattern: Node): Binding[] {
  const out: Binding[] = [];
  visit(pattern, (node, parent) => {
    if (parent?.type === 'AssignmentPattern' && parent.right === node) {
      return false;
    }
    if (parent?.type === 'Property' && parent.computed && parent.key === node) {
      return false;
    }
    if (node.type === 'Identifier') {
      const binding = info.declarationOf.get(node);
      if (binding) {
        out.push(binding);
      }
    }
    return undefined;
  });
  return out;
}

/** Computes the model. Throws CompileError for every error of the runtime contract. */
export function analyzeModel(
  parsed: ParsedModule,
  info: ScopeInfo,
  imports: SilmarilImports,
): ModuleModel {
  const { program } = parsed;

  // Parents of every node, from one walk.
  const parentOf = new Map<Node, Node | null>();
  visit(program, (node, parent) => {
    parentOf.set(node, parent);
  });

  const context: AnalysisContext = {
    parsed,
    info,
    imports,
    parentOf,
    trackedCalls: new Map(),
    localNames: new Map(),
    calls: [],
    scopes: [],
    scopeOfNode: new Map(),
    setupOf: new Map(),
    entryCalls: new Set(),
    skipCalls: new Set(),
    slotted: new Set(),
  };
  const { scopes, scopeOfNode, setupOf } = context;

  // 1. Compile-time names: each reference must be the callee of a call.
  findTrackedCalls(context);
  const { calls, trackedCalls } = context;

  function makeScope(
    kind: ReactiveScopeKind,
    node: Node,
    isBody: boolean,
    call: CallExpression | null,
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

  // 2. Setup trees: each `$$` and `$composable` call, outer ones first.
  for (const call of calls) {
    const name = trackedCalls.get(call);
    if (name !== '$$' && name !== '$composable') {
      continue;
    }
    // The only argument is a function or arrow, through wrappers.
    const arg = call.arguments[0];
    const fn =
      call.arguments.length === 1 && arg && arg.type !== 'SpreadElement'
        ? unwrap(arg)
        : null;
    if (
      !fn ||
      (fn.type !== 'ArrowFunctionExpression' &&
        fn.type !== 'FunctionExpression')
    ) {
      fail(
        context,
        `${context.localNames.get(call)} must be called with a function.`,
        call,
      );
    }
    const outer = findEnclosingSetup(context, call);
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

  // 3. `$` and `$sync`: the owner scope and the entry bodies. Outer calls come first,
  // so the body of an outer entry is known when an inner call is checked.
  interface PendingEntry {
    call: CallExpression;
    kind: 'sync' | 'effect';
    owner: ReactiveScope;
    arg: Node;
  }
  const pendingEntries: PendingEntry[] = [];
  const entryChildOf = new Map<CallExpression, ReactiveScope>();
  for (const call of calls) {
    const name = trackedCalls.get(call);
    if (name !== '$' && name !== '$sync') {
      continue;
    }
    const localName = context.localNames.get(call)!;
    const arg = call.arguments[0];
    if (call.arguments.length !== 1 || !arg || arg.type === 'SpreadElement') {
      fail(context, `${localName} can only accept a single argument`, call);
    }

    // The call can sit in any expression of a scope body outside loops, nested
    // functions, class members and the argument of another `$` or `$sync`, as in 0.4.
    const placeError = `${localName} must be called directly in a setup body.`;
    let inLoop = false;
    let owner: ReactiveScope | null = null;
    let current: Node = call;
    let parent = parentOf.get(current) ?? null;
    while (parent) {
      if (LOOPS.has(parent.type)) {
        inLoop = true;
      } else if (CLASS_MEMBERS.has(parent.type)) {
        fail(context, placeError, call);
      } else if (parent.type === 'CallExpression') {
        const outer = trackedCalls.get(parent);
        if (outer === '$' || outer === '$sync') {
          fail(context, placeError, call);
        }
      } else if (isFunctionNode(parent)) {
        const scope = scopeOfNode.get(parent);
        if (parent.body === current && scope && scope.isBody) {
          owner = scope;
          break;
        }
        fail(context, placeError, call);
      }
      current = parent;
      parent = parentOf.get(current) ?? null;
    }
    if (!owner) {
      fail(context, placeError, call);
    }
    if (inLoop) {
      fail(context, `${localName} cannot be called inside a loop.`, call);
    }

    // A function argument is a scope body, so calls inside it can be checked next.
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
        owner.tree,
        owner.setupDepth,
      );
      entryChildOf.set(call, child);
    }
    pendingEntries.push({ call, kind, owner, arg });
    context.entryCalls.add(call);
  }

  // 4. Names that must be in a setup tree, `$store` arguments, the `/* $skip */` comment.
  const { skips, storeCalls } = checkPlacedNames(context);
  checkSkipComments(context);

  // 5. Slot candidates: the setup declarators of each scope body. A `var` that names a
  // binding which already has a candidate is a write of it (a redeclare), checked per
  // bound name. A `var` in a loop is never a candidate, but it can redeclare one.
  const candidates: SlotCandidate[] = [];
  const candidateOf = new Map<Binding, SlotCandidate>();
  const redeclarations = new Map<VariableDeclarator, SlotCandidate[]>();
  function findRedeclared(bindings: Binding[]): SlotCandidate[] {
    const earlier: SlotCandidate[] = [];
    for (const binding of bindings) {
      const candidate = candidateOf.get(binding);
      if (candidate && !earlier.includes(candidate)) {
        earlier.push(candidate);
      }
    }
    return earlier;
  }
  for (const scope of scopes) {
    const statements = getBlockBody(scope);
    if (!statements) {
      continue;
    }
    const { setup, loopVars } = collectBodyDeclarations(statements);
    for (const declaration of setup) {
      const kind = declaration.kind as 'let' | 'const' | 'var';
      for (const declarator of declaration.declarations) {
        const bindings = collectPatternBindings(info, declarator.id);

        // Names that already have a candidate make this declarator a redeclare. The
        // other names still form a candidate of their own.
        const earlier = findRedeclared(bindings);
        if (earlier.length > 0) {
          redeclarations.set(declarator, earlier);
        }
        const fresh: Binding[] = [];
        for (const binding of bindings) {
          if (!candidateOf.has(binding)) {
            fresh.push(binding);
          }
        }
        if (fresh.length === 0) {
          continue;
        }

        // Class expressions, setups and redeclares are never memos. `$store` gives a
        // store slot.
        const init = declarator.init ? unwrap(declarator.init) : null;
        const initName =
          init && init.type === 'CallExpression'
            ? trackedCalls.get(init)
            : undefined;
        const candidate: SlotCandidate = {
          declaration,
          declarator,
          kind,
          scope,
          bindings: fresh,
          neverMemo:
            earlier.length > 0 ||
            (init !== null &&
              (init.type === 'ClassExpression' ||
                initName === '$$' ||
                initName === '$composable')),
          store:
            initName === '$store' && init?.type === 'CallExpression'
              ? init
              : null,
          slotted: false,
          memo: false,
        };
        candidates.push(candidate);
        for (const binding of fresh) {
          candidateOf.set(binding, candidate);
        }
      }
    }
    for (const declaration of loopVars) {
      for (const declarator of declaration.declarations) {
        const earlier = findRedeclared(
          collectPatternBindings(info, declarator.id),
        );
        if (earlier.length > 0) {
          redeclarations.set(declarator, earlier);
        }
      }
    }
  }

  // 6. Slots: rule 1 (a written let or var, or a redeclare with an initializer) and
  // rule 3 (`$store`) first, then rule 2 (memos) to a fixed point.
  // A redeclare writes when it has an initializer or heads a for-in or for-of loop.
  const redeclared = new Set<SlotCandidate>();
  for (const [declarator, earlier] of redeclarations) {
    if (declarator.init || isForHead(context, declarator)) {
      for (const candidate of earlier) {
        redeclared.add(candidate);
      }
    }
  }
  for (const candidate of candidates) {
    const written =
      candidate.kind !== 'const' &&
      (redeclared.has(candidate) || hasWrite(candidate.bindings));
    if (candidate.store || written) {
      candidate.slotted = true;
      for (const binding of candidate.bindings) {
        context.slotted.add(binding);
      }
    }
  }
  findMemos(context, candidates);
  checkStoreCalls(context, storeCalls, candidates);
  checkMemoInitializers(context, candidates);

  // Slots are numbered per scope in source order of the declarators.
  const slotOf = new Map<Binding, Slot>();
  const declarators = new Map<VariableDeclarator, SlotDeclarator>();
  const declarations = new Map<VariableDeclaration, VariableDeclarator[]>();
  function addDeclarator(
    declaration: VariableDeclaration,
    declarator: VariableDeclarator,
  ): void {
    let list = declarations.get(declaration);
    if (!list) {
      list = [];
      declarations.set(declaration, list);
    }
    if (!list.includes(declarator)) {
      list.push(declarator);
    }
  }
  for (const candidate of candidates) {
    if (!candidate.slotted) {
      continue;
    }
    let kind: SlotDeclarator['kind'] = 'state';
    if (candidate.store) {
      kind = 'store';
    } else if (candidate.memo) {
      kind = 'memo';
    }
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
    addDeclarator(candidate.declaration, candidate.declarator);
  }

  // 7. Entries per scope body: memos and write-backs in source order, then `$sync`
  // calls, then `$` calls.
  const entryOfCall = new Map<CallExpression, Entry>();
  const memoInits = new Map<ReactiveScope, Set<Node>>();
  const bodies: ReactiveScope[] = [];
  for (const scope of scopes) {
    if (scope.isBody) {
      bodies.push(scope);
    }
  }
  for (const scope of bodies) {
    const inits = new Set<Node>();
    memoInits.set(scope, inits);
    for (const record of declarators.values()) {
      if (record.scope !== scope) {
        continue;
      }
      const init = record.declarator.init;
      if (record.kind === 'memo' && init) {
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
          init,
          false,
          null,
          entry,
          scope,
          scope.tree,
          scope.setupDepth,
        );
        // A function initializer is the memo's value, not a scope its body runs in.
        // So a lifecycle call inside it binds to the scope around the memo.
        if (isFunctionNode(init)) {
          scopeOfNode.delete(init);
        }
        scope.entries.push(entry);
        record.entry = entry;
        inits.add(init);
      } else if (
        record.kind === 'store' &&
        record.declaration.kind !== 'const'
      ) {
        const slot = record.slots[0]!;
        const entry: Entry = {
          id: scope.entries.length,
          kind: 'store-writeback',
          node: record.declarator,
          scope,
          slot: slot.index,
          // A write-back reads its own slot (runtime contract "Reads").
          reads: new Set([slot.binding]),
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

  // 8. Reads of each entry.
  computeEntryReads(context, bodies, memoInits, slotOf);

  // 9. Graphs. A setup always has one, an entry body when it has slots.
  for (const scope of bodies) {
    if (scope.call || scope.slots.length > 0) {
      const graph: Ref[][] = [];
      for (let i = 0; i < scope.slots.length; i += 1) {
        graph.push([]);
      }
      scope.graph = graph;
    }
  }
  for (const scope of bodies) {
    for (const entry of scope.entries) {
      for (const binding of entry.reads) {
        // Reads of a slot in another setup tree give no edge.
        const slot = slotOf.get(binding)!;
        if (slot.scope.tree !== scope.tree) {
          continue;
        }

        // The path holds the entry ids from the slot's scope down to the entry's scope.
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

  // 10. Write sites. A write to a `const` with a slot fails.
  const { writes, writeOf } = findWriteSites(context, slotOf, redeclarations);
  for (const site of writes) {
    if (site.kind === 'redeclare') {
      addDeclarator(
        parentOf.get(site.node) as VariableDeclaration,
        site.node as VariableDeclarator,
      );
    }
  }

  // 11. A reactive variable cannot be a JSX tag.
  checkJsxTags(context, slotOf);

  // 12. The scope each lifecycle call and local composable call binds to: the nearest
  // reactive scope node around it, the call itself included (`$(onMount(f))`).
  const bindings: ScopeBinding[] = [];
  const bindingOf = new Map<CallExpression, ScopeBinding>();
  function findNearestScope(node: Node): ReactiveScope | null {
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
    const name = trackedCalls.get(call);
    if (name === 'onMount' || name === 'onDestroy') {
      checkOneArgument(context, call);
      const scope = findNearestScope(call)!;
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
    const declaration = info.referenceOf.get(callee)?.binding?.declaration;
    if (declaration?.type !== 'VariableDeclarator' || !declaration.init) {
      return;
    }
    const init = unwrap(declaration.init);
    if (
      init.type !== 'CallExpression' ||
      setupOf.get(init)?.kind !== 'composable'
    ) {
      return;
    }
    const scope = findNearestScope(node);
    if (scope) {
      const record: ScopeBinding = {
        call: node,
        name: 'composable-call',
        scope,
      };
      bindings.push(record);
      bindingOf.set(node, record);
    }
  });

  // 13. Names of scope parameters and graphs, with a prefix no user name collides with.
  const prefix = pickPrefix(info.names);
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
  };
}

/**
 * The prefix of generated scope, graph and temp names: `$`, or `$_`, `$__`... until no
 * user name starts with the prefix followed by `s`, `c`, `t` or `g` and then a digit,
 * `_` or the end.
 */
export function pickPrefix(names: Set<string>): string {
  let prefix = '$';
  while (isPrefixTaken(names, prefix)) {
    prefix += '_';
  }
  return prefix;
}

function isPrefixTaken(names: Set<string>, prefix: string): boolean {
  const pattern = new RegExp(
    `^${prefix.replaceAll('$', '\\$')}[sctg](\\d|_|$)`,
  );
  for (const name of names) {
    if (pattern.test(name)) {
      return true;
    }
  }
  return false;
}
