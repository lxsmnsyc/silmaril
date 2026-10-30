// Code generation for the reactivity-runtime contract (v4), from the model only. It
// follows the edit rules of the compiler-api contract:
// - One pre-order walk. An outer node's edits are made before an inner node's.
// - Text is replaced with `update` (keeps inserts at the range's ends), never `overwrite`.
// - Replaced ranges never overlap, and no other edit point falls strictly inside one.
// - Each identifier is replaced at most once. Write targets belong to the write.
// - An insert at a node's start uses appendLeft, at its end prependRight. An insert that
//   must wrap edits made earlier at the same offset uses prependLeft or appendRight.
import type { MagicString } from 'magic-string';
import type { CallExpression, Node } from 'oxc-parser';
import type { ModuleModel } from '../analysis/model';
import { visit } from '../analysis/walk';
import {
  createContext,
  failUnsupported,
  printGet,
  type GenerateContext,
} from './context';
import { rewriteEntry, rewriteSetup } from './entries';
import { emitGraphs, rewriteImports } from './imports';
import { declareTemps } from './temps';
import { rewriteDeclaration } from './variables';
import { rewriteWrite } from './writes';

// Calls of compile-time names.
function rewriteCall(context: GenerateContext, node: CallExpression): void {
  const { model } = context;
  const setup = model.setupOf.get(node);
  if (setup) {
    rewriteSetup(context, node, setup);
    return;
  }
  const entry = model.entryOfCall.get(node);
  if (entry) {
    rewriteEntry(context, node, entry);
    return;
  }

  // $skip, onMount and onDestroy belong to codegen-extras.
  const name = model.trackedCalls.get(node);
  if (name === '$skip' || name === 'onMount' || name === 'onDestroy') {
    failUnsupported(context, name, node);
  }
}

// Reads of slots, and identifiers that a write renamed.
function rewriteIdentifier(context: GenerateContext, node: Node): void {
  if (node.type !== 'Identifier') {
    return;
  }
  const { s, model } = context;
  const name = context.renamed.get(node);
  if (name !== undefined) {
    s.update(node.start, node.end, name);
    return;
  }
  const ref = model.info.referenceOf.get(node);
  if (!ref || ref.write || !ref.binding) {
    return;
  }
  const slot = model.slotOf.get(ref.binding);
  if (!slot) {
    return;
  }
  const text = printGet(context, slot);
  s.update(
    node.start,
    node.end,
    ref.context === 'shorthand' ? `${node.name}: ${text}` : text,
  );
}

/** Edits `s` into the compiled module. Reads the model only. */
export function generate(s: MagicString, model: ModuleModel): void {
  const context = createContext(s, model);

  visit(model.parsed.program, (node) => {
    if (node.type === 'ImportDeclaration') {
      return false;
    }
    if (node.type === 'VariableDeclaration') {
      const list = model.declarations.get(node);
      if (list) {
        rewriteDeclaration(context, node, list);
      }
    }
    const site = model.writeOf.get(node);
    if (site) {
      rewriteWrite(context, site);
    }
    if (node.type === 'CallExpression') {
      rewriteCall(context, node);
    } else {
      rewriteIdentifier(context, node);
    }
    return undefined;
  });

  declareTemps(context);
  rewriteImports(context);
  emitGraphs(context);
}
