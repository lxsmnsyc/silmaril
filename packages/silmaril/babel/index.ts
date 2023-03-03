import { PluginObj, PluginPass } from '@babel/core';
import { addNamed } from '@babel/helper-module-imports';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { getImportSpecifierName } from './checks';
import unwrapNode from './unwrap-node';

const SOURCE_MODULE = 'silmaril';

type SilmarilTopLevel = '$$' | '$composable';
type SilmarilEffects = '$' | '$sync';
type SilmarilLifecycles = 'onMount' | 'onDestroy';
type SilmarilStores = '$store';

type SilmarilCTFS =
  | SilmarilTopLevel
  | SilmarilEffects
  | SilmarilLifecycles
  | SilmarilStores;

const TRACKED_IMPORTS: Record<SilmarilCTFS, boolean> = {
  $$: true,
  $: true,
  $sync: true,
  $store: true,
  $composable: true,
  onMount: true,
  onDestroy: true,
};

const TRUE_CONTEXT = '$$context';
const TRUE_UPDATE = '$$update';
const TRUE_EFFECT = '$$effect';
const TRUE_SYNC = '$$sync';
const TRUE_SUBSCRIBE = '$$subscribe';
const TRUE_ON_MOUNT = '$$mount';
const TRUE_ON_DESTROY = '$$destroy';

const SKIP = '$skip';
const CAN_SKIP = /^\s*\$skip\s*$/;

function canSkip(node: t.Node) {
  if (node.leadingComments) {
    for (let i = 0, len = node.leadingComments.length; i < len; i += 1) {
      if (CAN_SKIP.test(node.leadingComments[i].value)) {
        return true;
      }
    }
  }
  return false;
}

type ImportIdentifiers =  {
  [key in SilmarilCTFS]: Set<t.Identifier>;
}

interface StateContext {
  hooks: Map<string, t.Identifier>;
  identifiers: ImportIdentifiers;
}

function getHookIdentifier(
  ctx: StateContext,
  path: NodePath,
  name: string,
): t.Identifier {
  const current = ctx.hooks.get(name);
  if (current) {
    return current;
  }
  const newID = addNamed(path, name, SOURCE_MODULE);
  ctx.hooks.set(name, newID);
  return newID;
}

function extractImportIdentifiers(
  ctx: StateContext,
  path: NodePath<t.ImportDeclaration>,
) {
  if (path.node.source.value === SOURCE_MODULE) {
    for (let i = 0, len = path.node.specifiers.length; i < len; i += 1) {
      const specifier = path.node.specifiers[i];
      if (t.isImportSpecifier(specifier)) {
        const specifierName = getImportSpecifierName(specifier);
        if (specifierName in TRACKED_IMPORTS) {
          ctx.identifiers[specifierName as SilmarilCTFS].add(specifier.local);
        }
      }
    }
  }
}

function unwrapLVal(identifiers: Set<t.Identifier>, value: t.LVal) {
  if (canSkip(value)) {
    return;
  }
  if (t.isIdentifier(value)) {
    identifiers.add(value);
  } else if (t.isRestElement(value)) {
    unwrapLVal(identifiers, value.argument);
  } else if (t.isAssignmentPattern(value)) {
    unwrapLVal(identifiers, value.left);
  } else if (t.isArrayPattern(value)) {
    for (let i = 0, len = value.elements.length; i < len; i += 1) {
      const el = value.elements[i];
      if (el) {
        unwrapLVal(identifiers, el);
      }
    }
  } else if (t.isObjectPattern(value)) {
    for (let i = 0, len = value.properties.length; i < len; i += 1) {
      const el = value.properties[i];
      if (t.isRestElement(el)) {
        unwrapLVal(identifiers, el.argument);
      } else if (t.isLVal(el.value)) {
        unwrapLVal(identifiers, el.value);
      }
    }
  }
}

function getDependencies(
  path: NodePath,
  identifiers: Set<t.Identifier>,
): Set<t.Identifier> {
  // Collect dependencies
  const dependencies = new Set<t.Identifier>();
  path.traverse({
    Expression(p) {
      if (t.isIdentifier(p.node) && !canSkip(p.node)) {
        const binding = p.scope.getBindingIdentifier(p.node.name);
        if (binding && identifiers.has(binding)) {
          dependencies.add(binding);
        }
      }
    },
  });
  return dependencies;
}

function transformTracking(
  ctx: StateContext,
  path: NodePath<t.CallExpression>,
  instanceID: t.Identifier,
  dependencies: Set<t.Identifier>,
  type: string,
) {
  const arg = path.node.arguments[0];

  if (!t.isExpression(arg)) {
    throw new Error(`${type} can only accept Expression.`);
  }

  let result: t.Expression;

  if (
    unwrapNode(arg, t.isArrowFunctionExpression)
    || unwrapNode(arg, t.isFunctionExpression)
  ) {
    result = arg;
  } else {
    result = t.arrowFunctionExpression(
      [],
      arg,
    );
  }

  path.replaceWith(
    t.callExpression(
      getHookIdentifier(ctx, path, type),
      [
        instanceID,
        t.arrowFunctionExpression([], t.arrayExpression(Array.from(dependencies))),
        result,
      ],
    ),
  );
}

function transformComputed(
  ctx: StateContext,
  path: NodePath<t.VariableDeclarator>,
  identifiers: Set<t.Identifier>,
  instanceID: t.Identifier,
  id: t.LVal,
  init: t.Expression,
) {
  const dependencies = getDependencies(path, identifiers);
  if (dependencies.size) {
    path.insertAfter(
      t.addComment(
        t.variableDeclarator(
          path.scope.generateUidIdentifier('computed'),
          t.callExpression(
            getHookIdentifier(ctx, path, TRUE_SYNC),
            [
              instanceID,
              t.arrowFunctionExpression(
                [],
                t.arrayExpression(Array.from(dependencies)),
              ),
              t.arrowFunctionExpression(
                [],
                t.assignmentExpression('=', id, init),
              ),
            ],
          ),
        ),
        'leading',
        SKIP,
      ),
    );
    path.node.init = undefined;
  }
}

function transformStore(
  ctx: StateContext,
  path: NodePath<t.VariableDeclarator>,
  instanceID: t.Identifier,
  id: t.LVal,
  init: t.CallExpression,
  kind: t.VariableDeclaration['kind'],
) {
  if (init.arguments.length !== 1) {
    throw new Error('$store can only accept a single argument.');
  }
  const storeArg = init.arguments[0];
  if (!t.isExpression(storeArg)) {
    throw new Error('$store can only accept expressions.');
  }
  if (!t.isIdentifier(id)) {
    throw new Error('$store is only limited to identifiers.');
  }
  const storeIdentifier = path.scope.generateUidIdentifier('store');
  path.insertBefore(
    t.variableDeclarator(storeIdentifier, storeArg),
  );
  const read = t.callExpression(
    t.memberExpression(
      storeIdentifier,
      t.identifier('get'),
    ),
    [],
  );
  const args: t.Expression[] = kind === 'const' ? [] : [
    t.arrowFunctionExpression(
      [],
      t.arrayExpression([id]),
    ),
    t.arrowFunctionExpression(
      [],
      t.callExpression(
        t.memberExpression(
          storeIdentifier,
          t.identifier('set'),
        ),
        [id],
      ),
    ),
  ];
  path.insertAfter(
    t.addComment(
      t.variableDeclarator(
        path.scope.generateUidIdentifier('subscribe'),
        t.callExpression(
          getHookIdentifier(ctx, path, TRUE_SUBSCRIBE),
          [
            instanceID,
            storeIdentifier,
            t.arrowFunctionExpression(
              [],
              t.assignmentExpression(
                '=',
                id,
                read,
              ),
            ),
            ...args,
          ],
        ),
      ),
      'leading',
      SKIP,
    ),
  );
  path.node.init = read;
}

function traverseIdentifiers(
  ctx: StateContext,
  path: NodePath<t.CallExpression>,
  instanceID: t.Identifier,
  arg: t.Function,
) {
  const identifiers = new Set<t.Identifier>();
  path.traverse({
    VariableDeclaration(p) {
      const functionParent = p.getFunctionParent();
      if (functionParent && functionParent.node === arg) {
        const { kind } = p.node;
        p.traverse({
          VariableDeclarator(child) {
            if (child.parentPath === p) {
              if (canSkip(child.node)) {
                return;
              }
              unwrapLVal(identifiers, child.node.id);
              if (child.node.init) {
                if (t.isCallExpression(child.node.init) && t.isIdentifier(child.node.init.callee)) {
                  const binding = child.scope.getBindingIdentifier(child.node.init.callee.name);
                  if (binding && ctx.identifiers.$store.has(binding)) {
                    transformStore(
                      ctx,
                      child,
                      instanceID,
                      child.node.id,
                      child.node.init,
                      kind,
                    );
                    return;
                  }
                }
                transformComputed(
                  ctx,
                  child,
                  identifiers,
                  instanceID,
                  child.node.id,
                  child.node.init,
                );
              }
            }
          },
        });
        if (p.node.kind === 'const') {
          p.node.kind = 'let';
        }
      }
    },
  });
  return identifiers;
}

function checkValidAssignment(
  path: NodePath,
  identifiers: Set<t.Identifier>,
  marked: Set<t.Identifier>,
) {
  for (const item of marked) {
    const binding = path.scope.getBindingIdentifier(item.name);
    if (binding && identifiers.has(binding)) {
      return true;
    }
  }
  return false;
}

function transformReads(
  ctx: StateContext,
  path: NodePath<t.CallExpression>,
  arg: t.Function,
  identifiers: Set<t.Identifier>,
  instanceID: t.Identifier,
) {
  path.traverse({
    // Step 2: Change all UpdateExpression and AssignmentExpression
    UpdateExpression(p) {
      const { argument } = p.node;
      if (t.isIdentifier(argument)) {
        const binding = p.scope.getBindingIdentifier(argument.name);
        if (binding && identifiers.has(binding)) {
          p.replaceWith(
            t.callExpression(
              getHookIdentifier(ctx, p, TRUE_UPDATE),
              [
                instanceID,
                p.node,
              ],
            ),
          );
          p.skip();
        }
      }
    },
    AssignmentExpression(p) {
      const marked = new Set<t.Identifier>();
      unwrapLVal(marked, p.node.left);
      if (checkValidAssignment(p, identifiers, marked)) {
        p.replaceWith(
          t.callExpression(
            getHookIdentifier(ctx, p, TRUE_UPDATE),
            [
              instanceID,
              p.node,
            ],
          ),
        );
        p.skip();
      }
    },
    CallExpression(p) {
      // If the assignment occurs in the same function, ignore
      const functionParent = p.getFunctionParent();
      if (functionParent && functionParent.node === arg) {
        const { callee } = p.node;

        const trueIdentifier = unwrapNode(callee, t.isIdentifier);
        if (trueIdentifier) {
          const binding = p.scope.getBindingIdentifier(trueIdentifier.name);
          if (binding) {
            if (ctx.identifiers.$.has(binding)) {
              const dependencies = getDependencies(p, identifiers);
              transformTracking(
                ctx,
                p,
                instanceID,
                dependencies,
                TRUE_EFFECT,
              );
            }
            if (ctx.identifiers.$sync.has(binding)) {
              const dependencies = getDependencies(p, identifiers);
              transformTracking(
                ctx,
                p,
                instanceID,
                dependencies,
                TRUE_SYNC,
              );
            }
            if (ctx.identifiers.onMount.has(binding)) {
              p.node.callee = getHookIdentifier(ctx, p, TRUE_ON_MOUNT);
              p.node.arguments = [
                instanceID,
                ...p.node.arguments,
              ];
            }
            if (ctx.identifiers.onDestroy.has(binding)) {
              p.node.callee = getHookIdentifier(ctx, p, TRUE_ON_DESTROY);
              p.node.arguments = [
                instanceID,
                ...p.node.arguments,
              ];
            }
          }
        }
      }
    },
  });
}

function transformSetup(
  ctx: StateContext,
  path: NodePath<t.CallExpression>,
  type: SilmarilTopLevel | SilmarilEffects,
) {
  // Check arguments
  if (path.node.arguments.length !== 1) {
    throw new Error(`${type} can only accept a single argument`);
  }
  const isTopLevel = type === '$$' || type === '$composable';
  const arg = path.node.arguments[0];
  const trueArg =
    unwrapNode(arg, t.isArrowFunctionExpression)
    || unwrapNode(arg, t.isFunctionExpression);
  if (!trueArg) {
    if (isTopLevel) {
      throw new Error(`${type} argument must be ArrowFunctionExpression or FunctionExpression`);
    }
    return;
  }
  if (t.isBlockStatement(trueArg.body)) {
    const instanceID = path.scope.generateUidIdentifier('ctx');
    trueArg.body.body.unshift(
      t.variableDeclaration(
        'let',
        [
          t.variableDeclarator(
            instanceID,
            t.callExpression(
              getHookIdentifier(ctx, path, TRUE_CONTEXT),
              [],
            ),
          ),
        ],
      ),
    );
    path.traverse({
      CallExpression(p) {
        const { callee } = p.node;

        const trueIdentifier = unwrapNode(callee, t.isIdentifier);
        if (trueIdentifier) {
          const binding = p.scope.getBindingIdentifier(trueIdentifier.name);
          if (binding) {
            if (ctx.identifiers.$$.has(binding)) {
              transformSetup(ctx, p, '$$');
            }
            if (ctx.identifiers.$composable.has(binding)) {
              transformSetup(ctx, p, '$composable');
            }
            if (ctx.identifiers.$.has(binding)) {
              transformSetup(ctx, p, '$');
            }
            if (ctx.identifiers.$sync.has(binding)) {
              transformSetup(ctx, p, '$sync');
            }
          }
        }
      },
    });
    const identifiers = traverseIdentifiers(ctx, path, instanceID, trueArg);
    // Crawl again to re-register bindings
    path.scope.crawl();
    // Transform all reads
    transformReads(ctx, path, trueArg, identifiers, instanceID);
  }
}

interface State extends PluginPass {
  ctx: StateContext;
}

export default function silmarilPlugin(): PluginObj<State> {
  return {
    name: 'silmaril',
    pre() {
      this.ctx = {
        hooks: new Map(),
        identifiers: {
          $: new Set(),
          $$: new Set(),
          $composable: new Set(),
          $store: new Set(),
          $sync: new Set(),
          onDestroy: new Set(),
          onMount: new Set(),
        },
      };
    },
    visitor: {
      ImportDeclaration(path, state) {
        extractImportIdentifiers(state.ctx, path);
      },
      CallExpression(path, state) {
        const { callee } = path.node;

        const trueIdentifier = unwrapNode(callee, t.isIdentifier);
        if (trueIdentifier) {
          const binding = path.scope.getBindingIdentifier(trueIdentifier.name);
          if (binding) {
            if (state.ctx.identifiers.$$.has(binding)) {
              transformSetup(state.ctx, path, '$');
            }
            if (state.ctx.identifiers.$composable.has(binding)) {
              transformSetup(state.ctx, path, '$composable');
            }
          }
        }
      },
    },
  };
}
