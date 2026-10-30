// Scope analysis over the ESTree AST of oxc-parser.
// One walk declares bindings and records references. References resolve after
// the walk, so hoisted declarations (var, function) resolve like in the engine.
// Types are skipped: a name inside a type annotation is not a reference.

// The prototype types nodes loosely. compiler-core uses @oxc-project/types.
// oxlint-disable-next-line typescript/no-explicit-any
export type Node = any;

export type ScopeKind =
  | 'module'
  | 'function'
  | 'params'
  | 'block'
  | 'class'
  | 'catch';

export type BindingKind =
  | 'var'
  | 'let'
  | 'const'
  | 'using'
  | 'param'
  | 'function'
  | 'class'
  | 'import'
  | 'catch'
  | 'enum'
  | 'namespace'
  | 'import-equals';

export interface Scope {
  kind: ScopeKind;
  node: Node;
  parent: Scope | null;
  /** The nearest function or module scope, where `var` goes. */
  functionScope: Scope;
  bindings: Map<string, Binding>;
  children: Scope[];
}

export interface Binding {
  name: string;
  kind: BindingKind;
  /** The identifier node that declares the name. */
  identifier: Node;
  /** The declaring node: VariableDeclarator, FunctionDeclaration, ImportSpecifier... */
  declaration: Node;
  scope: Scope;
  references: Reference[];
}

/**
 * Where a reference sits, for code generators that replace it with an expression.
 * - plain: an expression position.
 * - shorthand: the value of a shorthand property, `{ x }` or `{ x = 1 }` in a pattern.
 * - jsx: a JSX tag name, or the object of a JSX member tag.
 * - export: the local name of `export { x }`.
 */
export type ReferenceContext = 'plain' | 'shorthand' | 'jsx' | 'export';

export interface Reference {
  identifier: Node;
  context: ReferenceContext;
  scope: Scope;
  binding: Binding | null;
  read: boolean;
  write: boolean;
  /** For a write: the AssignmentExpression, UpdateExpression or for-in/of statement. */
  writeExpression: Node | null;
}

export interface ScopeInfo {
  root: Scope;
  /** Scope created by a node (Program, function, block, class, catch clause, for statement). */
  scopes: Map<Node, Scope>;
  references: Reference[];
  /** Reference record of an identifier node, if it is a reference. */
  referenceOf: Map<Node, Reference>;
  /** Binding declared by an identifier node, if it declares one. */
  declarationOf: Map<Node, Binding>;
  /** Every name declared or referenced in the module, for unique name generation. */
  names: Set<string>;
}

// Keys that only hold types. They are never walked.
const TYPE_KEYS = new Set([
  'typeAnnotation',
  'typeParameters',
  'typeArguments',
  'returnType',
  'implements',
  'superTypeArguments',
]);

// TS nodes whose `expression` is a value.
const TS_VALUE_WRAPPERS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSNonNullExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
]);

const SKIP_KEYS = new Set(['type', 'start', 'end', 'range', 'loc', 'parent']);

/**
 * The child nodes of a node, in source order. Type-only keys are left out, and a
 * shorthand property yields only its value (its key is a second node with the same span).
 */
export function childNodes(node: Node): Node[] {
  const children: Node[] = [];
  const shorthand = node.type === 'Property' && node.shorthand;
  for (const key in node) {
    if (SKIP_KEYS.has(key) || TYPE_KEYS.has(key)) {
      continue;
    }
    if (shorthand && key === 'key') {
      continue;
    }
    const value = node[key];
    if (value === null || typeof value !== 'object') {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item !== null &&
          typeof item === 'object' &&
          typeof item.type === 'string'
        ) {
          children.push(item);
        }
      }
    } else if (typeof value.type === 'string') {
      children.push(value);
    }
  }
  // Key order is not always source order (decorators, for example).
  children.sort((a, b) => a.start - b.start);
  return children;
}

function isFunction(node: Node): boolean {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  );
}

export function analyzeScopes(program: Node): ScopeInfo {
  const scopes = new Map<Node, Scope>();
  const references: Reference[] = [];
  const referenceOf = new Map<Node, Reference>();
  const declarationOf = new Map<Node, Binding>();
  const names = new Set<string>();

  function createScope(
    kind: ScopeKind,
    node: Node,
    parent: Scope | null,
  ): Scope {
    const scope: Scope = {
      kind,
      node,
      parent,
      functionScope: null as unknown as Scope,
      bindings: new Map(),
      children: [],
    };
    scope.functionScope =
      kind === 'function' || kind === 'module' || parent === null
        ? scope
        : parent.functionScope;
    if (parent) {
      parent.children.push(scope);
    }
    scopes.set(node, scope);
    return scope;
  }

  function declare(
    scope: Scope,
    identifier: Node,
    kind: BindingKind,
    declaration: Node,
  ): void {
    const { name } = identifier;
    names.add(name);
    // A redeclaration (var x; var x, or function overloads) keeps the first binding.
    let binding = scope.bindings.get(name);
    if (!binding) {
      binding = { name, kind, identifier, declaration, scope, references: [] };
      scope.bindings.set(name, binding);
    }
    declarationOf.set(identifier, binding);
  }

  function reference(
    identifier: Node,
    scope: Scope,
    read: boolean,
    write: boolean,
    writeExpression: Node | null,
    context: ReferenceContext = 'plain',
  ): void {
    names.add(identifier.name);
    const ref: Reference = {
      identifier,
      context,
      scope,
      binding: null,
      read,
      write,
      writeExpression,
    };
    references.push(ref);
    referenceOf.set(identifier, ref);
  }

  // Declares the names of a binding pattern. Default values and computed keys are expressions.
  function declarePattern(
    pattern: Node,
    target: Scope,
    kind: BindingKind,
    declaration: Node,
    exprScope: Scope,
  ): void {
    switch (pattern.type) {
      case 'Identifier':
        declare(target, pattern, kind, declaration);
        walkList(pattern.decorators, exprScope);
        break;
      case 'ObjectPattern':
        for (const property of pattern.properties) {
          if (property.type === 'RestElement') {
            declarePattern(
              property.argument,
              target,
              kind,
              declaration,
              exprScope,
            );
          } else {
            if (property.computed) {
              walk(property.key, exprScope);
            }
            declarePattern(
              property.value,
              target,
              kind,
              declaration,
              exprScope,
            );
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of pattern.elements) {
          if (element) {
            declarePattern(element, target, kind, declaration, exprScope);
          }
        }
        break;
      case 'AssignmentPattern':
        declarePattern(pattern.left, target, kind, declaration, exprScope);
        walk(pattern.right, exprScope);
        break;
      case 'RestElement':
        declarePattern(pattern.argument, target, kind, declaration, exprScope);
        break;
      case 'TSParameterProperty':
        walkList(pattern.decorators, exprScope);
        declarePattern(pattern.parameter, target, kind, declaration, exprScope);
        break;
      default:
        break;
    }
  }

  // Walks an assignment target. Identifiers in it are writes of `writeExpression`.
  function walkTarget(
    target: Node,
    scope: Scope,
    read: boolean,
    writeExpression: Node,
    context: ReferenceContext = 'plain',
  ): void {
    switch (target.type) {
      case 'Identifier':
        reference(target, scope, read, true, writeExpression, context);
        break;
      case 'ObjectPattern':
        for (const property of target.properties) {
          if (property.type === 'RestElement') {
            walkTarget(property.argument, scope, false, writeExpression);
          } else {
            if (property.computed) {
              walk(property.key, scope);
            }
            walkTarget(
              property.value,
              scope,
              false,
              writeExpression,
              property.shorthand ? 'shorthand' : 'plain',
            );
          }
        }
        break;
      case 'ArrayPattern':
        for (const element of target.elements) {
          if (element) {
            walkTarget(element, scope, false, writeExpression);
          }
        }
        break;
      case 'AssignmentPattern':
        walkTarget(target.left, scope, false, writeExpression, context);
        walk(target.right, scope);
        break;
      case 'RestElement':
        walkTarget(target.argument, scope, false, writeExpression);
        break;
      case 'ParenthesizedExpression':
        walkTarget(target.expression, scope, read, writeExpression);
        break;
      default:
        if (TS_VALUE_WRAPPERS.has(target.type)) {
          walkTarget(target.expression, scope, read, writeExpression);
        } else {
          // MemberExpression and others: a read of the object, not a write of a binding.
          walk(target, scope);
        }
        break;
    }
  }

  function walkList(list: Node[] | null | undefined, scope: Scope): void {
    if (list) {
      for (const item of list) {
        if (item) {
          walk(item, scope);
        }
      }
    }
  }

  function walkChildren(node: Node, scope: Scope): void {
    for (const child of childNodes(node)) {
      walk(child, scope);
    }
  }

  function walkFunction(node: Node, scope: Scope): void {
    let outer = scope;
    if (node.type === 'FunctionExpression' && node.id) {
      // The name of a function expression is visible only inside it.
      outer = createScope('block', node.id, scope);
      declare(outer, node.id, 'function', node);
    }
    const { body } = node;
    // With parameter expressions (defaults, computed keys), the parameters get their
    // own scope, and the body's declarations live in a scope under it. So
    // `function f(a = x) { let x; }` reads the outer x, as in the engine.
    const separate =
      body?.type === 'BlockStatement' && hasParameterExpressions(node.params);
    const fnScope = createScope(separate ? 'params' : 'function', node, outer);
    if (separate) {
      fnScope.functionScope = fnScope;
    }
    for (const param of node.params) {
      if (param.type === 'Identifier' && param.name === 'this') {
        continue;
      }
      declarePattern(param, fnScope, 'param', node, fnScope);
    }
    if (!body) {
      return;
    }
    if (body.type === 'BlockStatement') {
      if (separate) {
        const bodyScope = createScope('function', body, fnScope);
        walkList(body.body, bodyScope);
      } else {
        // The body shares the scope of the parameters.
        scopes.set(body, fnScope);
        walkList(body.body, fnScope);
      }
    } else {
      walk(body, fnScope);
    }
  }

  function walkClass(node: Node, scope: Scope): void {
    walkList(node.decorators, scope);
    if (node.superClass) {
      walk(node.superClass, scope);
    }
    const classScope = createScope('class', node, scope);
    if (node.id && node.type === 'ClassExpression') {
      declare(classScope, node.id, 'class', node);
    }
    for (const member of node.body.body) {
      walkList(member.decorators, classScope);
      switch (member.type) {
        case 'MethodDefinition':
        case 'PropertyDefinition':
        case 'AccessorProperty':
        case 'TSAbstractMethodDefinition':
        case 'TSAbstractPropertyDefinition':
        case 'TSAbstractAccessorProperty':
          if (member.computed) {
            walk(member.key, classScope);
          }
          if (member.value) {
            walk(member.value, classScope);
          }
          break;
        case 'StaticBlock': {
          const blockScope = createScope('function', member, classScope);
          walkList(member.body, blockScope);
          break;
        }
        default:
          // TSIndexSignature and other type-only members.
          break;
      }
    }
  }

  function walkJSXName(name: Node, scope: Scope): void {
    if (name.type === 'JSXIdentifier') {
      // `div` and `my-tag` are intrinsic elements. `Foo` and `$foo` are references.
      if (!/^[a-z]/.test(name.name) && !name.name.includes('-')) {
        reference(name, scope, true, false, null, 'jsx');
      }
    } else if (name.type === 'JSXMemberExpression') {
      let object = name.object;
      while (object.type === 'JSXMemberExpression') {
        object = object.object;
      }
      // `<this.Foo />` reads `this`, not a binding.
      if (object.type === 'JSXIdentifier' && object.name !== 'this') {
        reference(object, scope, true, false, null, 'jsx');
      }
    }
  }

  function walk(node: Node, scope: Scope): void {
    switch (node.type) {
      case 'Identifier':
        reference(node, scope, true, false, null);
        return;
      case 'BlockStatement': {
        const blockScope = createScope('block', node, scope);
        walkList(node.body, blockScope);
        return;
      }
      case 'StaticBlock': {
        const blockScope = createScope('function', node, scope);
        walkList(node.body, blockScope);
        return;
      }
      case 'SwitchStatement': {
        walk(node.discriminant, scope);
        const blockScope = createScope('block', node, scope);
        for (const switchCase of node.cases) {
          if (switchCase.test) {
            walk(switchCase.test, blockScope);
          }
          walkList(switchCase.consequent, blockScope);
        }
        return;
      }
      case 'ForStatement': {
        const forScope = createScope('block', node, scope);
        if (node.init) {
          walk(node.init, forScope);
        }
        if (node.test) {
          walk(node.test, forScope);
        }
        if (node.update) {
          walk(node.update, forScope);
        }
        walk(node.body, forScope);
        return;
      }
      case 'ForInStatement':
      case 'ForOfStatement': {
        const forScope = createScope('block', node, scope);
        if (node.left.type === 'VariableDeclaration') {
          walk(node.left, forScope);
        } else {
          walkTarget(node.left, forScope, false, node);
        }
        walk(node.right, forScope);
        walk(node.body, forScope);
        return;
      }
      case 'CatchClause': {
        const catchScope = createScope('catch', node, scope);
        if (node.param) {
          declarePattern(node.param, catchScope, 'catch', node, catchScope);
        }
        scopes.set(node.body, catchScope);
        walkList(node.body.body, catchScope);
        return;
      }
      case 'VariableDeclaration': {
        // `declare const x` still declares x for the module, like Babel does.
        const kind: BindingKind =
          node.kind === 'var'
            ? 'var'
            : node.kind === 'let'
              ? 'let'
              : node.kind === 'const'
                ? 'const'
                : 'using';
        const target = kind === 'var' ? scope.functionScope : scope;
        for (const declarator of node.declarations) {
          declarePattern(declarator.id, target, kind, declarator, scope);
          if (declarator.init) {
            walk(declarator.init, scope);
          }
        }
        return;
      }
      case 'FunctionDeclaration':
        if (node.declare || !node.body) {
          // Overload signature or `declare function`.
          return;
        }
        if (node.id) {
          declare(scope, node.id, 'function', node);
        }
        walkFunction(node, scope);
        return;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        walkFunction(node, scope);
        return;
      case 'TSDeclareFunction':
        return;
      case 'ClassDeclaration':
        if (node.declare) {
          return;
        }
        if (node.id) {
          declare(scope, node.id, 'class', node);
        }
        walkClass(node, scope);
        return;
      case 'ClassExpression':
        walkClass(node, scope);
        return;
      case 'ImportDeclaration':
        if (node.importKind === 'type') {
          return;
        }
        for (const specifier of node.specifiers) {
          if (specifier.importKind === 'type') {
            continue;
          }
          declare(scope, specifier.local, 'import', specifier);
        }
        return;
      case 'TSImportEqualsDeclaration':
        if (node.importKind !== 'type') {
          declare(scope, node.id, 'import-equals', node);
          if (node.moduleReference.type !== 'TSExternalModuleReference') {
            let left = node.moduleReference;
            while (left.type === 'TSQualifiedName') {
              left = left.left;
            }
            if (left.type === 'Identifier') {
              reference(left, scope, true, false, null);
            }
          }
        }
        return;
      case 'ExportNamedDeclaration':
        if (node.exportKind === 'type') {
          return;
        }
        if (node.declaration) {
          walk(node.declaration, scope);
        }
        if (!node.source) {
          for (const specifier of node.specifiers) {
            if (
              specifier.exportKind !== 'type' &&
              specifier.local.type === 'Identifier'
            ) {
              reference(specifier.local, scope, true, false, null, 'export');
            }
          }
        }
        return;
      case 'ExportDefaultDeclaration':
        walk(node.declaration, scope);
        return;
      case 'ExportAllDeclaration':
        return;
      case 'TSEnumDeclaration': {
        if (node.declare) {
          return;
        }
        declare(scope, node.id, 'enum', node);
        const enumScope = createScope('block', node, scope);
        for (const member of node.body.members) {
          if (member.initializer) {
            walk(member.initializer, enumScope);
          }
        }
        return;
      }
      case 'TSModuleDeclaration': {
        // `declare module 'x'` and `declare global` hold only types.
        if (node.declare || node.global || node.id.type === 'Literal') {
          return;
        }
        // `namespace A.B {}` declares A. B is a property of it.
        let id = node.id;
        while (id.type === 'TSQualifiedName') {
          id = id.left;
        }
        declare(scope, id, 'namespace', node);
        if (node.body) {
          const moduleScope = createScope('function', node, scope);
          if (node.body.type === 'TSModuleBlock') {
            walkList(node.body.body, moduleScope);
          } else {
            walk(node.body, moduleScope);
          }
        }
        return;
      }
      case 'TSExportAssignment':
        walk(node.expression, scope);
        return;
      case 'AssignmentExpression':
        walkTarget(node.left, scope, node.operator !== '=', node);
        walk(node.right, scope);
        return;
      case 'UpdateExpression':
        walkTarget(node.argument, scope, true, node);
        return;
      case 'MemberExpression':
        walk(node.object, scope);
        if (node.computed) {
          walk(node.property, scope);
        }
        return;
      case 'Property':
        if (node.computed) {
          walk(node.key, scope);
        }
        if (node.shorthand && node.value.type === 'Identifier') {
          reference(node.value, scope, true, false, null, 'shorthand');
        } else {
          walk(node.value, scope);
        }
        return;
      case 'LabeledStatement':
        walk(node.body, scope);
        return;
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'MetaProperty':
      case 'PrivateIdentifier':
      case 'Super':
      case 'ThisExpression':
      case 'Literal':
        return;
      case 'JSXElement':
        walkJSXName(node.openingElement.name, scope);
        for (const attribute of node.openingElement.attributes) {
          if (attribute.type === 'JSXSpreadAttribute') {
            walk(attribute.argument, scope);
          } else if (attribute.value) {
            walk(attribute.value, scope);
          }
        }
        walkList(node.children, scope);
        return;
      case 'JSXIdentifier':
      case 'JSXText':
      case 'JSXEmptyExpression':
        return;
      default:
        if (TS_VALUE_WRAPPERS.has(node.type)) {
          walk(node.expression, scope);
          return;
        }
        if (node.type.startsWith('TS')) {
          // Interfaces, type aliases and other type-only declarations.
          return;
        }
        walkChildren(node, scope);
    }
  }

  const root = createScope('module', program, null);
  walkList(program.body, root);

  // Resolve after the walk so hoisted declarations are known.
  for (const ref of references) {
    const { name } = ref.identifier;
    let current: Scope | null = ref.scope;
    while (current) {
      const binding = current.bindings.get(name);
      if (binding) {
        ref.binding = binding;
        binding.references.push(ref);
        break;
      }
      current = current.parent;
    }
  }

  return { root, scopes, references, referenceOf, declarationOf, names };
}

/** Returns a function that makes names unused in the module, like Babel's generateUidIdentifier. */
export function createUidGenerator(
  names: Set<string>,
): (hint: string) => string {
  return (hint: string) => {
    const base = `_${hint.replace(/^_+/, '').replace(/[^\w$]/g, '')}`;
    let name = base;
    let index = 1;
    while (names.has(name)) {
      index += 1;
      name = `${base}${index}`;
    }
    names.add(name);
    return name;
  };
}

function hasParameterExpressions(params: Node[]): boolean {
  let found = false;
  function check(node: Node): void {
    if (found || node === null || typeof node !== 'object') {
      return;
    }
    if (
      node.type === 'AssignmentPattern' ||
      (node.type === 'Property' && node.computed)
    ) {
      found = true;
      return;
    }
    for (const child of childNodes(node)) {
      check(child);
    }
  }
  for (const param of params) {
    check(param);
  }
  return found;
}

export { isFunction };
