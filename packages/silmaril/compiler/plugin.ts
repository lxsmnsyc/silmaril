import type * as babel from '@babel/core';
import * as t from '@babel/types';
import { HIDDEN_IMPORTS, TRACKED_IMPORTS } from './imports';
import type { ImportDefinition, StateContext } from './types';
import { unexpectedArgumentLength, unexpectedType } from './utils/errors';
import getForeignBindings from './utils/get-foreign-bindings';
import { getImportIdentifier } from './utils/get-import-identifier';
import { registerImportSpecifiers } from './utils/register-import-specifiers';
import { canSkip } from './utils/skip';
import { isPathValid, unwrapNode, unwrapPath } from './utils/unwrap';

function getValidCalleeFromIdentifier(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
): ImportDefinition | undefined {
  const id = unwrapNode(path.node.callee, t.isIdentifier);
  if (id) {
    const binding = path.scope.getBindingIdentifier(id.name);
    if (binding) {
      return ctx.registrations.identifiers.get(binding);
    }
    return undefined;
  }
  return undefined;
}

function getValidCalleeFromMemberExpression(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
): ImportDefinition | undefined {
  const member = unwrapNode(path.node.callee, t.isMemberExpression);
  if (!(member && !member.computed && t.isIdentifier(member.property))) {
    return undefined;
  }
  const object = unwrapNode(member.object, t.isIdentifier);
  if (!object) {
    return undefined;
  }
  const binding = path.scope.getBindingIdentifier(object.name);
  if (!binding) {
    return undefined;
  }
  const defs = ctx.registrations.namespaces.get(binding);
  if (!defs) {
    return undefined;
  }
  const propName = member.property.name;
  for (let i = 0, len = defs.length; i < len; i++) {
    const def = defs[i];
    if (def.kind === 'named' && def.name === propName) {
      return def;
    }
    if (def.kind === 'default' && propName === 'default') {
      return def;
    }
  }
  return undefined;
}

function getValidCallee(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
): ImportDefinition | undefined {
  return (
    getValidCalleeFromIdentifier(ctx, path) ||
    getValidCalleeFromMemberExpression(ctx, path)
  );
}

function isValidFunction(
  node: t.Node,
): node is t.ArrowFunctionExpression | t.FunctionExpression {
  return t.isArrowFunctionExpression(node) || t.isFunctionExpression(node);
}

function getContextInstance(
  ctx: StateContext,
  body: babel.NodePath<t.BlockStatement>,
): t.Identifier {
  const instance = body.scope.generateUidIdentifier('context');

  body.scope.registerDeclaration(
    body.unshiftContainer(
      'body',
      t.variableDeclaration('const', [
        t.addComment(
          t.variableDeclarator(
            instance,
            t.callExpression(
              getImportIdentifier(ctx, body, HIDDEN_IMPORTS.context),
              [],
            ),
          ),
          'leading',
          '$skip',
        ),
      ]),
    )[0],
  );

  return instance;
}

function transformStore(
  ctx: StateContext,
  declaration: babel.NodePath<t.VariableDeclarator>,
  lval: babel.NodePath<t.LVal>,
  init: babel.NodePath<t.CallExpression>,
  instance: t.Identifier,
): void {
  const definition = getValidCallee(ctx, init);
  if (definition !== TRACKED_IMPORTS.$store) {
    return;
  }
  if (!isPathValid(lval, t.isIdentifier)) {
    throw unexpectedType(init, init.type, 'Identifier');
  }
  const args = init.get('arguments');
  if (args.length === 0) {
    throw unexpectedArgumentLength(init, args.length, 1);
  }
  const arg = args[0];
  if (!isPathValid(arg, t.isExpression)) {
    throw unexpectedType(
      arg,
      arg.type,
      'ArrowFunctionExpression | FunctionExpression',
    );
  }
  const store = init.scope.generateUidIdentifier('store');
  init.scope.registerDeclaration(
    declaration.insertBefore(t.variableDeclarator(store, arg.node))[0],
  );
  init.scope.registerDeclaration(
    declaration.insertAfter(
      t.variableDeclarator(
        init.scope.generateUidIdentifier('subscribe'),
        t.callExpression(
          getImportIdentifier(ctx, init, HIDDEN_IMPORTS.subscribe),
          [
            instance,
            store,
            t.arrowFunctionExpression(
              [],
              t.assignmentExpression(
                '=',
                lval.node,
                t.callExpression(
                  t.memberExpression(store, t.identifier('get')),
                  [],
                ),
              ),
            ),
            t.arrowFunctionExpression([], t.arrayExpression([lval.node])),
            t.arrowFunctionExpression(
              [],
              t.callExpression(t.memberExpression(store, t.identifier('get')), [
                lval.node,
              ]),
            ),
          ],
        ),
      ),
    )[0],
  );
  init.replaceWith(
    t.callExpression(t.memberExpression(store, t.identifier('get')), []),
  );
}

function transformVariableDeclarator(
  ctx: StateContext,
  path: babel.NodePath<t.VariableDeclarator>,
  instance: t.Identifier,
): void {
  if (canSkip(path.node)) {
    return;
  }
  const id = path.get('id');
  const init = path.get('init');
  if (!isPathValid(init, t.isExpression)) {
    return;
  }
  const check = unwrapPath(init, t.isCallExpression);
  if (check) {
    transformStore(ctx, path, id, check, instance);
    return;
  }
  const dependencies = getDependencies(init, 'expression');
  if (!dependencies.length) {
    return;
  }
  const [tmp] = path.insertAfter(
    t.variableDeclarator(
      path.scope.generateUidIdentifier('computed'),
      t.callExpression(getImportIdentifier(ctx, path, HIDDEN_IMPORTS.sync), [
        instance,
        t.arrowFunctionExpression([], t.arrayExpression(dependencies)),
        t.arrowFunctionExpression(
          [],
          t.assignmentExpression('=', id.node, init.node),
        ),
      ]),
    ),
  );
  path.scope.registerDeclaration(tmp);
  init.remove();
}

function transformComputeds(
  ctx: StateContext,
  path: babel.NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  instance: t.Identifier,
): void {
  path.traverse({
    VariableDeclaration(child) {
      const target = child.getFunctionParent();
      if (!(target && target.node === path.node)) {
        return;
      }
      if (
        child.node.kind === 'const' ||
        child.node.kind === 'let' ||
        child.node.kind === 'var'
      ) {
        child.node.kind = 'let';
        const declarations = [...child.get('declarations')];
        for (let i = 0, len = declarations.length; i < len; i++) {
          transformVariableDeclarator(ctx, declarations[i], instance);
        }
      }
    },
  });
}

function transformUpdates(
  ctx: StateContext,
  path: babel.NodePath<t.ArrowFunctionExpression | t.FunctionExpression>,
  instance: t.Identifier,
): void {
  path.traverse({
    // Transform all assignments
    AssignmentExpression: {
      exit(child) {
        child.replaceWith(
          t.callExpression(
            getImportIdentifier(ctx, child, HIDDEN_IMPORTS.update),
            [instance, child.node],
          ),
        );
        child.skip();
      },
    },
    UpdateExpression: {
      exit(child) {
        child.replaceWith(
          t.callExpression(
            getImportIdentifier(ctx, child, HIDDEN_IMPORTS.update),
            [instance, child.node],
          ),
        );
        child.skip();
      },
    },
  });
}

function transformSetup(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
): void {
  const args = path.get('arguments');
  if (args.length === 0) {
    throw unexpectedArgumentLength(path, args.length, 1);
  }
  const arg = unwrapPath(args[0], isValidFunction);
  if (!arg) {
    throw unexpectedType(
      args[0],
      args[0].type,
      'ArrowFunctionExpression | FunctionExpression',
    );
  }
  const body = arg.get('body');

  if (isPathValid(body, t.isExpression)) {
    body.replaceWith(t.blockStatement([t.returnStatement(body.node)]));
  }
  if (isPathValid(body, t.isBlockStatement)) {
    const instance = getContextInstance(ctx, body);
    transformComputeds(ctx, arg, instance);
    transformUpdates(ctx, arg, instance);

    arg.traverse({
      CallExpression(child) {
        transformCallExpression(ctx, child, instance);
      },
    });
  }
}

function getDependencies(
  path: babel.NodePath,
  kind: 'function' | 'expression',
): t.Identifier[] {
  return getForeignBindings(path, kind);
}

function transformEffect(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
  parent: t.Identifier,
  isSync: boolean,
): void {
  const args = path.get('arguments');
  if (args.length === 0) {
    throw unexpectedArgumentLength(path, args.length, 1);
  }
  const arg = args[0];
  if (!isPathValid(arg, t.isExpression)) {
    throw unexpectedType(
      arg,
      arg.type,
      'ArrowFunctionExpression | FunctionExpression',
    );
  }
  let trueArg = unwrapPath(arg, isValidFunction);
  if (!trueArg) {
    trueArg = arg.replaceWith(t.arrowFunctionExpression([], arg.node))[0];
  }

  const body = trueArg.get('body');
  if (isPathValid(body, t.isExpression)) {
    body.replaceWith(t.blockStatement([t.returnStatement(body.node)]));
  }
  if (isPathValid(body, t.isBlockStatement)) {
    const instance = getContextInstance(ctx, body);

    transformComputeds(ctx, trueArg, instance);
    transformUpdates(ctx, trueArg, instance);

    const dependencies = getDependencies(trueArg, 'function');
    path.replaceWith(
      t.callExpression(
        getImportIdentifier(
          ctx,
          path,
          isSync ? HIDDEN_IMPORTS.sync : HIDDEN_IMPORTS.effect,
        ),
        [
          parent,
          t.arrowFunctionExpression([], t.arrayExpression(dependencies)),
          trueArg.node,
        ],
      ),
    );
  }
}

function transformSkip(path: babel.NodePath<t.CallExpression>): void {
  const args = path.get('arguments');
  if (args.length === 0) {
    throw unexpectedArgumentLength(path, args.length, 1);
  }
  const arg = args[0];
  if (!isPathValid(arg, t.isExpression)) {
    throw unexpectedType(arg, arg.type, 'Expression');
  }
  path.replaceWith(t.addComment(arg.node, 'leading', '$skip'))[0].skip();
}

function transformCallExpression(
  ctx: StateContext,
  path: babel.NodePath<t.CallExpression>,
  instance?: t.Identifier,
): void {
  const definition = getValidCallee(ctx, path);

  if (!instance) {
    if (definition === TRACKED_IMPORTS.$skip) {
      transformSkip(path);
    }
    if (definition === TRACKED_IMPORTS.$$) {
      transformSetup(ctx, path);
    }
    if (definition === TRACKED_IMPORTS.$composable) {
      transformSetup(ctx, path);
    }
    return;
  }
  if (definition === TRACKED_IMPORTS.$) {
    transformEffect(ctx, path, instance, false);
  }
  if (definition === TRACKED_IMPORTS.$sync) {
    transformEffect(ctx, path, instance, true);
  }
  if (definition === TRACKED_IMPORTS.onMount) {
    path.node.callee = getImportIdentifier(ctx, path, HIDDEN_IMPORTS.mount);
    path.node.arguments = [instance, ...path.node.arguments];
  }
  if (definition === TRACKED_IMPORTS.onDestroy) {
    path.node.callee = getImportIdentifier(ctx, path, HIDDEN_IMPORTS.destroy);
    path.node.arguments = [instance, ...path.node.arguments];
  }
}

interface State extends babel.PluginPass {
  ctx: StateContext;
}

export default function silmarilPlugin(): babel.PluginObj<State> {
  return {
    name: 'silmaril',
    visitor: {
      Program(programPath) {
        const ctx: StateContext = {
          imports: new Map(),
          registrations: {
            identifiers: new Map(),
            namespaces: new Map(),
          },
        };

        registerImportSpecifiers(ctx, programPath);
        programPath.traverse({
          CallExpression: {
            exit(path) {
              transformCallExpression(ctx, path);
            },
          },
        });
      },
    },
  };
}
