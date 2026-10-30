// Setup declarations with slots: state `let`/`var`, memos (computed `const`/`let`,
// function memos, destructuring memos), destructuring state and redeclared `var`s.
import type { Node, VariableDeclaration, VariableDeclarator } from 'oxc-parser';
import type { TempOwner, WriteSite } from '../analysis/model';
import { visit } from '../analysis/walk';
import {
  failUnsupported,
  needsParens,
  printSet,
  printSetOpen,
  takeTemp,
  useHelper,
  type GenerateContext,
} from './context';
import { printSets, renamePattern } from './writes';

// Statement lists: a split declaration needs no block there.
const STATEMENT_LISTS = new Set<string>([
  'BlockStatement',
  'Program',
  'SwitchCase',
  'StaticBlock',
]);

// True when a binding identifier is the value of a shorthand property: `{ a }`, `{ a = 1 }`.
function isShorthandBinding(identifier: Node, pattern: Node): boolean {
  let found = false;
  visit(pattern, (node, parent) => {
    if (parent?.type !== 'Property' || !parent.shorthand) {
      return;
    }
    if (
      node === identifier ||
      (node.type === 'AssignmentPattern' && node.left === identifier)
    ) {
      found = true;
    }
  });
  return found;
}

// The write site of a destructuring declarator that is not a redeclare: the
// statement form of the assignment `P = e`.
function createDeclaratorSite(
  context: GenerateContext,
  declarator: VariableDeclarator,
): WriteSite {
  const record = context.model.declarators.get(declarator)!;
  const site: WriteSite = {
    kind: 'destructure',
    node: declarator,
    pattern: declarator.id,
    targets: [],
    statement: true,
    fn: record.scope.node as TempOwner,
  };
  for (const slot of record.slots) {
    site.targets.push({
      identifier: slot.binding.identifier,
      binding: slot.binding,
      slot,
      shorthand: isShorthandBinding(slot.binding.identifier, declarator.id),
    });
  }
  return site;
}

/**
 * The opening text of a declarator with slots, from `regionStart` to the point the
 * kept text starts, and its closing text. `lead` goes first: the closing text of
 * the previous declarator.
 */
function openDeclarator(
  context: GenerateContext,
  declarator: VariableDeclarator,
  regionStart: number,
  lead: string,
): string {
  const { s, model } = context;
  const record = model.declarators.get(declarator);
  const site = model.writeOf.get(declarator);
  const init = declarator.init;

  if (record?.kind === 'store') {
    return failUnsupported(context, '$store', declarator);
  }

  if (record?.kind === 'memo' && init) {
    const entry = record.entry!;
    const child = entry.child!;
    const param = child.paramUsed ? `(${child.param})` : '()';
    const memo = `${useHelper(context, '$$memo')}(${record.scope.param}, ${entry.id}, ${entry.slot}, ${param} => `;
    if (declarator.id.type === 'Identifier') {
      // `const y = e` -> `$$memo(sc, n, k, () => e);`
      const wrap = needsParens(context.code, init);
      s.update(regionStart, init.start, `${lead}${memo}${wrap ? '(' : ''}`);
      return `${wrap ? ')' : ''});`;
    }

    // `const { p, q } = e` -> `$$memo(sc, n, -1, () => { const { p, q } = e; $$set(sc, k, p); ... });`
    s.update(regionStart, declarator.start, `${lead}${memo}{ const `);
    const sets: string[] = [];
    for (const slot of record.slots) {
      sets.push(`${printSet(context, slot, slot.binding.name)};`);
    }
    return `; ${sets.join(' ')} });`;
  }

  if (declarator.id.type === 'Identifier') {
    // `let x = v` -> `$$set(sc, k, v);`, `let x;` -> nothing. A redeclare too.
    const slot = record ? record.slots[0]! : site!.targets[0]!.slot;
    if (init) {
      s.update(
        regionStart,
        init.start,
        `${lead}${printSetOpen(context, slot)}`,
      );
      return ');';
    }
    s.update(regionStart, declarator.end, lead);
    return '';
  }

  if (site) {
    // A redeclare with a pattern keeps its `var`, which also declares the names
    // without a slot and the temps: `var [$t0, b] = e; $$set(sc, k, $t0);`.
    s.update(regionStart, declarator.id.start, `${lead}var `);
    const list = renamePattern(context, site, true);
    return `; ${printSets(context, list, '; ')};`;
  }

  // `let [a, b] = e` -> `[$t0, $t1] = e; $$set(sc, k, $t0); $$set(sc, j, $t1);`
  const object = declarator.id.type === 'ObjectPattern';
  s.update(regionStart, declarator.id.start, `${lead}${object ? '(' : ''}`);

  // An assignment pattern takes no type annotation: `let [a]: [number] = e`.
  const annotation = declarator.id.typeAnnotation;
  if (annotation) {
    s.update(annotation.start, annotation.end, '');
  }
  const list = renamePattern(
    context,
    createDeclaratorSite(context, declarator),
  );
  return `${object ? ')' : ''}; ${printSets(context, list, '; ')};`;
}

// A redeclare in the init of a `for` statement cannot be split into statements.
// The declaration stays and each redeclared value goes through `$$set`.
function rewriteForInit(
  context: GenerateContext,
  list: VariableDeclarator[],
): void {
  const { s, model } = context;
  for (const declarator of list) {
    const site = model.writeOf.get(declarator);
    const init = declarator.init;
    if (!site || !init) {
      continue;
    }
    if (declarator.id.type === 'Identifier') {
      // `var x = v` -> `var x = $$set(sc, k, v)`. `x` is a dead local.
      s.appendLeft(init.start, printSetOpen(context, site.targets[0]!.slot));
      s.prependRight(init.end, ')');
      continue;
    }

    // `var [a, b] = e` -> `var [$t0, b] = e, $t1 = [$$set(sc, k, $t0)]`
    const renamed = renamePattern(context, site, true);
    const rest = takeTemp(context, site.fn, true);
    s.prependRight(
      declarator.end,
      `, ${rest} = [${printSets(context, renamed, ', ')}]`,
    );
  }
}

/** A declaration with slot declarators or redeclares: one statement per declarator. */
export function rewriteDeclaration(
  context: GenerateContext,
  declaration: VariableDeclaration,
  list: VariableDeclarator[],
): void {
  const { s, parentOf } = context;
  const container = parentOf.get(declaration);
  if (container?.type === 'ForStatement' && container.init === declaration) {
    rewriteForInit(context, list);
    return;
  }

  // `if (c) var a = 1, b = 2;` has no statement list: the split needs a block.
  if (container && !STATEMENT_LISTS.has(container.type)) {
    s.prependLeft(declaration.start, '{ ');
    s.appendRight(declaration.end, ' }');
  }

  const special = new Set<Node>(list);
  const items = declaration.declarations;
  const keyword = declaration.kind;
  // The closing text of the previous declarator with slots.
  let pendingClose = '';
  // A run of plain declarators (`let a, b`) is open.
  let open = false;
  for (let i = 0; i < items.length; i += 1) {
    const declarator = items[i]!;
    const regionStart = i === 0 ? declaration.start : items[i - 1]!.end;
    if (!special.has(declarator)) {
      // A plain declarator stays. After a declarator with slots, it starts a new
      // declaration with the same keyword.
      if (!open && i > 0) {
        const space = pendingClose === '' ? '' : ' ';
        s.update(
          regionStart,
          declarator.start,
          `${pendingClose}${space}${keyword} `,
        );
      }
      pendingClose = '';
      open = true;
      continue;
    }
    const lead = `${pendingClose}${open ? ';' : ''}${i > 0 ? ' ' : ''}`;
    open = false;
    pendingClose = openDeclarator(context, declarator, regionStart, lead);
  }

  // The original `;` (or nothing) becomes the last closing text.
  const last = items[items.length - 1]!;
  const tail = open ? `${pendingClose};` : pendingClose;
  if (last.end < declaration.end) {
    s.update(last.end, declaration.end, tail);
  } else if (tail !== '') {
    s.prependRight(last.end, tail);
  }
}
