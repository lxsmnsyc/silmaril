import type * as babel from '@babel/core';
import * as t from '@babel/types';
import type { TrackedImports } from '../imports';
import { TRACKED_IMPORTS } from '../imports';
import type { ImportDefinition, StateContext } from '../types';
import { getImportSpecifierName } from './get-import-specifier-name';

function registerImportSpecifier(
  ctx: StateContext,
  node:
    | t.ImportSpecifier
    | t.ImportDefaultSpecifier
    | t.ImportNamespaceSpecifier,
  definition: ImportDefinition,
): void {
  if (t.isImportSpecifier(node)) {
    if (node.importKind === 'type' || node.importKind === 'typeof') {
      return;
    }
    const key = getImportSpecifierName(node);
    if (
      (definition.kind === 'named' && key === definition.name) ||
      (definition.kind === 'default' && key === 'default')
    ) {
      ctx.registrations.identifiers.set(node.local, definition);
    }
  }
  if (t.isImportDefaultSpecifier(node) && definition.kind === 'default') {
    ctx.registrations.identifiers.set(node.local, definition);
  }
  if (t.isImportNamespaceSpecifier(node)) {
    let current = ctx.registrations.namespaces.get(node.local);
    if (!current) {
      current = [];
    }
    current.push(definition);
    ctx.registrations.namespaces.set(node.local, current);
  }
}

function registerImportDeclarationByDefinition(
  ctx: StateContext,
  path: babel.NodePath<t.ImportDeclaration>,
  definition: ImportDefinition,
): void {
  for (let i = 0, len = path.node.specifiers.length; i < len; i++) {
    const specifier = path.node.specifiers[i];
    registerImportSpecifier(ctx, specifier, definition);
  }
}

export function registerImportSpecifiers(
  ctx: StateContext,
  programPath: babel.NodePath<t.Program>,
): void {
  programPath.traverse({
    ImportDeclaration(path) {
      if (
        path.node.importKind === 'type' ||
        path.node.importKind === 'typeof'
      ) {
        return;
      }
      for (const key in TRACKED_IMPORTS) {
        const definition = TRACKED_IMPORTS[key as keyof TrackedImports];
        if (definition.source === path.node.source.value) {
          registerImportDeclarationByDefinition(ctx, path, definition);
        }
      }
    },
  });
}
