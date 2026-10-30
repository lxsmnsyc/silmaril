// Code generation against the reactivity-runtime contract (PR #8, version 4), from the
// model only. It follows the edit rules of proposed-compiler-api.md:
// - One pre-order walk. An outer node's edits are made before an inner node's.
// - Text is replaced with `update` (keeps inserts at the range's ends), never `overwrite`.
// - Replaced ranges never overlap, and no other edit point falls strictly inside one.
// - Each identifier is replaced at most once. Write targets belong to the write.
// - An insert at a node's start uses appendLeft, at its end prependRight. An insert that
//   must wrap edits made earlier at the same offset uses prependLeft or appendRight.
import type { MagicString } from 'magic-string';
import type {
  Entry,
  ModuleModel,
  ReactiveScope,
  Slot,
  WriteSite,
} from './model.ts';
import type { Node } from './scope.ts';
import { CompileError, unwrap, visit } from './source.ts';

// Helper order of the contract's export table.
const HELPERS = [
  '$$root',
  '$$composable',
  '$$get',
  '$$set',
  '$$update',
  '$$memo',
  '$$sync',
  '$$effect',
  '$$store',
  '$$mount',
  '$$destroy',
];

function needsParens(node: Node): boolean {
  return node.type === 'ObjectExpression' || node.type === 'SequenceExpression';
}

// True when a binding identifier is the value of a shorthand property: `{ a }`, `{ a = 1 }`.
function isShorthandBinding(identifier: Node, pattern: Node): boolean {
  let found = false;
  visit(pattern, (node, parent) => {
    if (
      node === identifier &&
      parent?.type === 'Property' &&
      parent.shorthand
    ) {
      found = true;
    }
    if (
      node.type === 'AssignmentPattern' &&
      node.left === identifier &&
      parent?.type === 'Property' &&
      parent.shorthand
    ) {
      found = true;
    }
  });
  return found;
}

export function generate(s: MagicString, model: ModuleModel): void {
  const { code } = model.parsed;
  const { info } = model;
  const used = new Set<string>();
  const helperLocal = new Map<string, string>();
  for (const name of HELPERS) {
    let local = name;
    while (model.names.has(local)) {
      local += '_';
    }
    helperLocal.set(name, local);
  }
  function helper(name: string): string {
    used.add(name);
    return helperLocal.get(name)!;
  }
  function get(slot: Slot): string {
    return `${helper('$$get')}(${slot.scope.param}, ${slot.index})`;
  }
  function set(slot: Slot, value: string): string {
    return `${helper('$$set')}(${slot.scope.param}, ${slot.index}, ${value}`;
  }

  // Temps, in source order of the write sites, declared in the nearest function.
  const temps = new Map<Node, string[]>();
  const loopTemps = new Set<string>();
  // One counter for the module, so a temp never shadows another one.
  let tempCount = 0;
  let tempPrefix = '$t';
  while (true) {
    let clash = false;
    for (const name of model.names) {
      if (
        name.startsWith(tempPrefix) &&
        /^\d+$/.test(name.slice(tempPrefix.length))
      ) {
        clash = true;
        break;
      }
    }
    if (!clash) {
      break;
    }
    tempPrefix += '_';
  }
  function temp(fn: Node, loop = false): string {
    let list = temps.get(fn);
    if (!list) {
      list = [];
      temps.set(fn, list);
    }
    const name = `${tempPrefix}${tempCount}`;
    tempCount += 1;
    list.push(name);
    if (loop) {
      loopTemps.add(name);
    }
    return name;
  }

  const parents = new Map<Node, Node | null>();
  visit(model.parsed.program, (node, parent) => {
    parents.set(node, parent);
  });

  // Identifier nodes printed as another name (write targets and reads of earlier targets).
  const renamed = new Map<Node, string>();

  // Scope parameter insertion for a function that takes the scope first.
  function insertParam(fn: Node, param: string): void {
    if (fn.params.length > 0) {
      const first = fn.params[0];
      const before = code.slice(fn.start, first.start);
      if (before.includes('(')) {
        s.appendLeft(first.start, `${param}, `);
      } else {
        // `x => ...`
        s.appendLeft(first.start, `(${param}, `);
        s.prependRight(first.end, ')');
      }
      return;
    }
    let from = fn.start;
    if (fn.typeParameters) {
      from = fn.typeParameters.end;
    } else if (fn.id) {
      from = fn.id.end;
    }
    const open = code.indexOf('(', from);
    s.appendLeft(open + 1, param);
  }

  // Renames the slot targets of a pattern to temps. Reads of an earlier target in a
  // later default or computed key read its temp. Returns the targets with their temps.
  function renamePattern(site: WriteSite): { slot: Slot; temp: string }[] {
    const out: { slot: Slot; temp: string }[] = [];
    const seen = new Map<unknown, string>();
    const targetNodes = new Map<Node, { slot: Slot; shorthand: boolean }>();
    for (const target of site.targets) {
      targetNodes.set(target.identifier, target);
    }
    visit(site.pattern, (node) => {
      const target = targetNodes.get(node);
      if (target) {
        const name = temp(site.fn);
        seen.set(target.slot.binding, name);
        renamed.set(node, target.shorthand ? `${node.name}: ${name}` : name);
        out.push({ slot: target.slot, temp: name });
        return;
      }
      if (node.type === 'Identifier') {
        const ref = info.referenceOf.get(node);
        if (ref && !ref.write && ref.binding && seen.has(ref.binding)) {
          const name = seen.get(ref.binding)!;
          renamed.set(
            node,
            ref.context === 'shorthand' ? `${node.name}: ${name}` : name,
          );
        }
      }
    });
    return out;
  }

  function writeSets(
    list: { slot: Slot; temp: string }[],
    separator: string,
  ): string {
    const parts: string[] = [];
    for (const item of list) {
      parts.push(`${set(item.slot, item.temp)})`);
    }
    return parts.join(separator);
  }

  // A declaration with slot declarators: one statement per declarator.
  function rewriteDeclaration(declaration: Node, list: Node[]): void {
    // `if (c) var a = 1, b = 2;` has no statement list: the split needs a block.
    const container = parents.get(declaration);
    const wrapped =
      container !== null &&
      container !== undefined &&
      container.type !== 'BlockStatement' &&
      container.type !== 'Program' &&
      container.type !== 'SwitchCase' &&
      container.type !== 'StaticBlock';
    if (wrapped) {
      s.prependLeft(declaration.start, '{ ');
      s.appendRight(declaration.end, ' }');
    }
    const special = new Set(list);
    const items = declaration.declarations;
    const keyword = declaration.kind;
    let pendingClose = '';
    let open = false; // a plain `let a, b` run is open
    for (let i = 0; i < items.length; i += 1) {
      const d = items[i];
      const regionStart = i === 0 ? declaration.start : items[i - 1].end;
      const record = model.declarators.get(d);
      const site = model.writeOf.get(d);
      if (!special.has(d)) {
        // Plain declarator.
        const text = open
          ? `${pendingClose}, `
          : `${pendingClose}${pendingClose === '' ? '' : ' '}${keyword} `;
        if (i > 0 || open || pendingClose !== '') {
          s.update(regionStart, d.start, text);
        }
        pendingClose = '';
        open = true;
        continue;
      }
      const close = open ? ';' : '';
      open = false;
      const lead = pendingClose + close + (i > 0 ? ' ' : '');
      let suffix = '';
      if (record && record.kind === 'store') {
        const scope = record.scope;
        const call = record.store;
        const arg = call.arguments[0];
        const id = record.entry ? `, ${record.entry.id}` : '';
        s.update(
          regionStart,
          arg.start,
          `${lead}${helper('$$store')}(${scope.param}, ${record.slots[0]!.index}, `,
        );
        if (arg.end < d.init.end) {
          s.update(arg.end, d.init.end, '');
        }
        suffix = `${id});`;
      } else if (record && record.kind === 'memo') {
        const entry = record.entry!;
        const param = entry.child!.paramUsed ? `(${entry.child!.param})` : '()';
        const init = d.init;
        const memo = `${helper('$$memo')}(${record.scope.param}, ${entry.id}, ${entry.slot}, ${param} => `;
        if (d.id.type === 'Identifier') {
          const wrap = needsParens(init);
          s.update(regionStart, init.start, `${lead}${memo}${wrap ? '(' : ''}`);
          suffix = `${wrap ? ')' : ''});`;
        } else {
          s.update(regionStart, d.start, `${lead}${memo}{ const `);
          const sets: string[] = [];
          for (const slot of record.slots) {
            sets.push(`${set(slot, slot.binding.name)});`);
          }
          suffix = `; ${sets.join(' ')} });`;
        }
      } else if (d.id.type === 'Identifier') {
        // State slot, or a redeclared `var` with a slot.
        const slot = record ? record.slots[0]! : site!.targets[0]!.slot;
        if (d.init) {
          s.update(regionStart, d.init.start, `${lead}${set(slot, '')}`);
          suffix = ');';
        } else {
          s.update(regionStart, d.end, lead);
          suffix = '';
        }
      } else {
        // Destructuring declarator with slots: the statement form of the assignment.
        const fakeSite: WriteSite = site ?? {
          kind: 'redeclare',
          node: d,
          pattern: d.id,
          targets: [],
          statement: true,
          fn: record!.scope.node,
        };
        if (!site) {
          for (const slot of record!.slots) {
            fakeSite.targets.push({
              identifier: slot.binding.identifier,
              binding: slot.binding,
              slot,
              shorthand: isShorthandBinding(slot.binding.identifier, d.id),
            });
          }
        }
        const object = d.id.type === 'ObjectPattern';
        s.update(regionStart, d.id.start, `${lead}${object ? '(' : ''}`);
        const list2 = renamePattern(fakeSite);
        suffix = `${object ? ')' : ''}; ${writeSets(list2, '; ')};`;
      }
      pendingClose = suffix;
    }
    // Tail: the original `;` (or nothing), replaced by the last closing text.
    const last = items[items.length - 1];
    const tail = open ? `${pendingClose};` : pendingClose;
    if (last.end < declaration.end) {
      s.update(last.end, declaration.end, tail);
    } else if (tail !== '') {
      s.prependRight(last.end, tail);
    }
  }

  function rewriteWrite(site: WriteSite): void {
    const node = site.node;
    switch (site.kind) {
      case 'assign': {
        const slot = site.targets[0]!.slot;
        s.update(node.start, node.right.start, set(slot, ''));
        s.prependRight(node.end, ')');
        return;
      }
      case 'compound': {
        const slot = site.targets[0]!.slot;
        const op = node.operator.slice(0, -1);
        s.update(
          node.start,
          node.right.start,
          `${set(slot, `${get(slot)} ${op} (`)}`,
        );
        s.prependRight(node.end, '))');
        return;
      }
      case 'logical': {
        const slot = site.targets[0]!.slot;
        const op = node.operator.slice(0, -1);
        s.update(
          node.start,
          node.right.start,
          `(${get(slot)} ${op} ${set(slot, '')}`,
        );
        s.prependRight(node.end, '))');
        return;
      }
      case 'update': {
        const slot = site.targets[0]!.slot;
        const delta = node.operator === '++' ? 1 : -1;
        s.update(
          node.start,
          node.end,
          `${helper('$$update')}(${slot.scope.param}, ${slot.index}, ${delta}, ${node.prefix})`,
        );
        return;
      }
      case 'destructure': {
        if (site.statement) {
          const list = renamePattern(site);
          let statement = node;
          while (statement.type !== 'ExpressionStatement') {
            statement = parents.get(statement)!;
          }
          const semi = code[statement.end - 1] === ';' ? '' : ';';
          s.prependRight(statement.end, `${semi} ${writeSets(list, '; ')};`);
        } else {
          // The temp of the right side comes first, then the targets.
          const result = temp(site.fn);
          const list = renamePattern(site);
          s.appendLeft(node.start, '(');
          s.appendLeft(node.right.start, `${result} = `);
          s.prependRight(node.end, `, ${writeSets(list, ', ')}, ${result})`);
        }
        return;
      }
      case 'for': {
        const body = node.body;
        let sets: string;
        const left = unwrap(node.left);
        if (left.type === 'Identifier') {
          const name = temp(site.fn, true);
          s.update(node.left.start, node.left.end, `const ${name}`);
          sets = `${set(site.targets[0]!.slot, name)});`;
        } else {
          // The pattern stays in place with temps as targets.
          sets = `${writeSets(renamePattern(site), '; ')};`;
        }
        if (body.type === 'BlockStatement') {
          s.appendLeft(body.start + 1, ` ${sets}`);
        } else {
          s.appendLeft(body.start, `{ ${sets} `);
          s.prependRight(body.end, ' }');
        }
        return;
      }
      case 'redeclare':
        // Printed by rewriteDeclaration.
        return;
    }
  }

  function rewriteEntry(call: Node, entry: Entry): void {
    const name = entry.kind === 'sync' ? '$$sync' : '$$effect';
    s.update(call.callee.start, call.callee.end, helper(name));
    const arg = call.arguments[0];
    const owner = entry.scope;
    const child = entry.child!;
    if (child.isBody) {
      s.appendLeft(arg.start, `${owner.param}, ${entry.id}, `);
      if (child.paramUsed) {
        insertParam(unwrap(arg), child.param);
      }
      if (child.graph) {
        s.prependRight(arg.end, `, ${child.graphName}`);
      }
    } else {
      const param = child.paramUsed ? `(${child.param})` : '()';
      const wrap =
        needsParens(unwrap(arg)) && arg.type !== 'ParenthesizedExpression';
      s.appendLeft(
        arg.start,
        `${owner.param}, ${entry.id}, ${param} => ${wrap ? '(' : ''}`,
      );
      if (wrap) {
        s.prependRight(arg.end, ')');
      }
    }
  }

  function rewriteSetup(call: Node, scope: ReactiveScope): void {
    s.update(
      call.callee.start,
      call.callee.end,
      helper(scope.kind === 'root' ? '$$root' : '$$composable'),
    );
    s.appendLeft(call.arguments[0].start, `${scope.graphName}, `);
    insertParam(scope.node, scope.param);
  }

  // The walk.
  visit(model.parsed.program, (node) => {
    if (node.type === 'ImportDeclaration') {
      return false;
    }
    const declarationList = model.declarations.get(node);
    if (declarationList) {
      rewriteDeclaration(node, declarationList);
    }
    const site = model.writeOf.get(node);
    if (site) {
      rewriteWrite(site);
    }
    if (node.type === 'CallExpression') {
      const setup = model.setupOf.get(node);
      if (setup) {
        rewriteSetup(node, setup);
        return;
      }
      const entry = model.entryOfCall.get(node);
      if (entry) {
        rewriteEntry(node, entry);
        return;
      }
      const name = model.trackedCalls.get(node);
      if (name === '$skip') {
        const arg = node.arguments[0];
        s.update(node.start, arg.start, '(');
        s.update(arg.end, node.end, ')');
        return;
      }
      if (name === 'onMount' || name === 'onDestroy') {
        const binding = model.bindingOf.get(node)!;
        s.update(
          node.callee.start,
          node.callee.end,
          helper(name === 'onMount' ? '$$mount' : '$$destroy'),
        );
        s.appendLeft(node.arguments[0].start, `${binding.scope.param}, `);
        return;
      }
      return;
    }
    if (node.type !== 'Identifier' && node.type !== 'JSXIdentifier') {
      return;
    }
    const name = renamed.get(node);
    if (name !== undefined) {
      s.update(node.start, node.end, name);
      return;
    }
    const ref = info.referenceOf.get(node);
    if (!ref || ref.write || !ref.binding) {
      return;
    }
    const slot = model.slotOf.get(ref.binding);
    if (!slot) {
      return;
    }
    if (ref.context === 'jsx') {
      throw new CompileError(
        'A reactive variable cannot be used as a JSX tag (not prototyped).',
        code,
        node.start,
      );
    }
    const text = get(slot);
    s.update(
      node.start,
      node.end,
      ref.context === 'shorthand' ? `${node.name}: ${text}` : text,
    );
  });

  // Temps: one `let` at the start of the nearest function body, after its directives.
  for (const [fn, list] of temps) {
    const names: string[] = [];
    for (const name of list) {
      if (!loopTemps.has(name)) {
        names.push(name);
      }
    }
    if (names.length === 0) {
      continue;
    }
    const declaration = `let ${names.join(', ')};`;
    if (fn.type === 'PropertyDefinition' || fn.type === 'AccessorProperty') {
      // A class field initializer: an arrow called at once keeps `this` and declares
      // the temps. It wraps the edits made inside the value.
      s.prependLeft(fn.value.start, `(() => { ${declaration} return `);
      s.appendRight(fn.value.end, '; })()');
      continue;
    }
    const body = fn.body;
    if (body.type === 'BlockStatement') {
      let at = body.start + 1;
      for (const statement of body.body) {
        if (statement.type === 'ExpressionStatement' && statement.directive) {
          at = statement.end;
        } else {
          break;
        }
      }
      const next = body.body[0];
      let indent = '';
      if (next) {
        const lineStart = code.lastIndexOf('\n', next.start - 1) + 1;
        indent = /^[ \t]*/.exec(code.slice(lineStart, next.start))![0];
      }
      s.appendLeft(at, `\n${indent}${declaration}`);
    } else {
      // `(a) => expr` becomes `(a) => { let ...; return expr; }`. These wrap edits made
      // earlier at the same offsets, so they go on the outside.
      s.prependLeft(body.start, `{ ${declaration} return `);
      s.appendRight(body.end, '; }');
    }
  }

  // Imports: drop the compile-time names, add the helpers to the first declaration.
  const helpers: string[] = [];
  for (const name of HELPERS) {
    if (used.has(name)) {
      const local = helperLocal.get(name)!;
      helpers.push(local === name ? name : `${name} as ${local}`);
    }
  }
  let first = true;
  for (const declaration of model.imports.declarations) {
    const kept: string[] = [];
    let defaultText = '';
    for (const specifier of declaration.specifiers) {
      if (specifier.type === 'ImportDefaultSpecifier') {
        defaultText = `${code.slice(specifier.start, specifier.end)}, `;
      } else if (!model.imports.compileTime.has(specifier)) {
        kept.push(code.slice(specifier.start, specifier.end));
      }
    }
    const names = first ? [...helpers, ...kept] : kept;
    first = false;
    const source = code.slice(declaration.source.start, declaration.source.end);
    const text =
      names.length > 0 || defaultText !== ''
        ? `import ${defaultText}{ ${names.join(', ')} } from ${source};`
        : '';
    s.update(declaration.start, declaration.end, text);
  }

  // Graphs: module-level constants after the last import.
  const graphs: string[] = [];
  for (const scope of model.scopes) {
    if (scope.graph) {
      // Trailing slots that no entry reads are left out, as the contract allows.
      const lists = [...scope.graph];
      while (lists.length > 0 && lists[lists.length - 1]!.length === 0) {
        lists.pop();
      }
      graphs.push(
        `const ${scope.graphName} = ${JSON.stringify(lists).replaceAll(',', ', ')};`,
      );
    }
  }

  if (graphs.length > 0) {
    let lastImport: Node | null = null;
    for (const statement of model.parsed.program.body) {
      if (statement.type === 'ImportDeclaration') {
        lastImport = statement;
      }
    }
    const text = graphs.join('\n\n');
    if (lastImport) {
      s.appendLeft(lastImport.end, `\n\n${text}`);
    } else {
      s.prepend(`${text}\n\n`);
    }
  }
}
