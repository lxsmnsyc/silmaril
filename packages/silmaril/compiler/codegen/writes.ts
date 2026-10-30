// Writes of slots: assignments, compound and logical assignments, updates,
// destructuring and for-in/of heads (runtime contract "Compiled forms").
import type { Node } from 'oxc-parser';
import type { Slot, WriteSite } from '../analysis/model';
import { unwrap, visit } from '../analysis/walk';
import {
  printGet,
  printSet,
  printSetOpen,
  takeTemp,
  useHelper,
  type GenerateContext,
} from './context';

export interface RenamedTarget {
  slot: Slot;
  temp: string;
}

/**
 * Renames the slot targets of a pattern to temps, in source order. A read of an
 * earlier target in a later default or computed key reads that target's temp. The
 * read pass prints the renamed identifiers. `declared` temps get no `let`: a `var`
 * pattern declares them.
 */
export function renamePattern(
  context: GenerateContext,
  site: WriteSite,
  declared = false,
): RenamedTarget[] {
  const { renamed, model } = context;
  const out: RenamedTarget[] = [];
  const tempOf = new Map<unknown, string>();
  const targetOf = new Map<Node, WriteSite['targets'][number]>();
  for (const target of site.targets) {
    targetOf.set(target.identifier, target);
  }
  visit(site.pattern, (node) => {
    if (node.type !== 'Identifier') {
      return;
    }
    const target = targetOf.get(node);
    if (target) {
      const name = takeTemp(context, site.fn, declared);
      tempOf.set(target.binding, name);
      renamed.set(node, target.shorthand ? `${node.name}: ${name}` : name);
      out.push({ slot: target.slot, temp: name });
      return;
    }

    // A read of a target seen earlier in the pattern reads its temp.
    const ref = model.info.referenceOf.get(node);
    if (ref && !ref.write && ref.binding && tempOf.has(ref.binding)) {
      const name = tempOf.get(ref.binding)!;
      renamed.set(
        node,
        ref.context === 'shorthand' ? `${node.name}: ${name}` : name,
      );
    }
  });
  return out;
}

/** The `$$set` calls that copy each temp into its slot. */
export function printSets(
  context: GenerateContext,
  list: RenamedTarget[],
  separator: string,
): string {
  const parts: string[] = [];
  for (const item of list) {
    parts.push(printSet(context, item.slot, item.temp));
  }
  return parts.join(separator);
}

function findStatement(context: GenerateContext, node: Node): Node {
  let current = node;
  while (current.type !== 'ExpressionStatement') {
    current = context.parentOf.get(current)!;
  }
  return current;
}

/** The edits of one write site. A redeclare is printed with its declaration. */
export function rewriteWrite(context: GenerateContext, site: WriteSite): void {
  const { s } = context;
  const node = site.node;
  switch (node.type) {
    case 'AssignmentExpression': {
      if (site.kind === 'destructure') {
        rewriteDestructure(context, site, node);
        return;
      }
      const slot = site.targets[0]!.slot;
      const op = node.operator.slice(0, -1);
      if (site.kind === 'assign') {
        // `x = v` -> `$$set(sc, k, v)`
        s.update(node.start, node.right.start, printSetOpen(context, slot));
        s.prependRight(node.end, ')');
      } else if (site.kind === 'compound') {
        // `x op= v` -> `$$set(sc, k, $$get(sc, k) op (v))`
        s.update(
          node.start,
          node.right.start,
          `${printSetOpen(context, slot)}${printGet(context, slot)} ${op} (`,
        );
        s.prependRight(node.end, '))');
      } else {
        // `x ||= v` -> `($$get(sc, k) || $$set(sc, k, v))`
        s.update(
          node.start,
          node.right.start,
          `(${printGet(context, slot)} ${op} ${printSetOpen(context, slot)}`,
        );
        s.prependRight(node.end, '))');
      }
      return;
    }
    case 'UpdateExpression': {
      const slot = site.targets[0]!.slot;
      const delta = node.operator === '++' ? 1 : -1;
      s.update(
        node.start,
        node.end,
        `${useHelper(context, '$$update')}(${slot.scope.param}, ${slot.index}, ${delta}, ${node.prefix})`,
      );
      return;
    }
    case 'ForInStatement':
    case 'ForOfStatement': {
      const left = unwrap(node.left);
      let sets: string;
      const single =
        left.type === 'Identifier' ||
        (left.type === 'VariableDeclaration' &&
          left.declarations[0]!.id.type === 'Identifier');
      if (single) {
        // `for (x of e)` and `for (var x of e)` -> `for (const $t0 of e)`
        const name = takeTemp(context, site.fn, true);
        s.update(node.left.start, node.left.end, `const ${name}`);
        sets = `${printSet(context, site.targets[0]!.slot, name)};`;
      } else {
        // The pattern stays in place with temps as targets. A `var` declares them.
        const declared = left.type === 'VariableDeclaration';
        sets = `${printSets(context, renamePattern(context, site, declared), '; ')};`;
      }
      const body = node.body;
      if (body.type === 'BlockStatement') {
        s.appendLeft(body.start + 1, ` ${sets}`);
      } else {
        s.appendLeft(body.start, `{ ${sets} `);
        s.prependRight(body.end, ' }');
      }
      return;
    }
    default:
      // A redeclare is printed by rewriteDeclaration.
      return;
  }
}

function rewriteDestructure(
  context: GenerateContext,
  site: WriteSite,
  node: Node & { type: 'AssignmentExpression' },
): void {
  const { s, code } = context;
  if (site.statement) {
    // `P = e;` -> `P' = e; $$set(sc, k1, $t1); ...;`
    const list = renamePattern(context, site);
    const statement = findStatement(context, node);
    const semi = code[statement.end - 1] === ';' ? '' : ';';
    s.prependRight(statement.end, `${semi} ${printSets(context, list, '; ')};`);
    return;
  }

  // `(P' = $t0 = e, $$set(sc, k1, $t1), ..., $t0)`. The temp of the right side is
  // taken before the target temps.
  const result = takeTemp(context, site.fn);
  const list = renamePattern(context, site);
  s.appendLeft(node.start, '(');
  s.appendLeft(node.right.start, `${result} = `);
  s.prependRight(node.end, `, ${printSets(context, list, ', ')}, ${result})`);
}
