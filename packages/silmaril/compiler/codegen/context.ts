// State shared by the code generators: the text being edited, the model, the helper
// imports, the temps and the identifiers that a write prints under another name.
import type { MagicString } from 'magic-string';
import type { Node } from 'oxc-parser';
import type { ModuleModel, Slot, TempOwner } from '../analysis/model';
import { visit } from '../analysis/walk';

/** The helpers of the runtime, in the order of the contract's export table. */
export const HELPERS = [
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
] as const;

export type Helper = (typeof HELPERS)[number];

export interface GenerateContext {
  s: MagicString;
  model: ModuleModel;
  code: string;
  parentOf: Map<Node, Node | null>;
  /** The local name of each helper: the export name, or with `_` added until it is free. */
  helperNames: Map<Helper, string>;
  /** Helpers printed so far. The import rewrite adds these. */
  usedHelpers: Set<Helper>;
  /** Identifiers printed as another text: write targets and reads of earlier targets. */
  renamed: Map<Node, string>;
  /** Temps of each owner, in the order they were taken. */
  temps: Map<TempOwner, string[]>;
  /** Temps that the code declares itself (`const $t0` in a loop head, a `var` pattern). */
  declaredTemps: Set<string>;
  tempPrefix: string;
  tempCount: number;
}

// Temps are `$t0`, `$t1`... The prefix gets `_` until no user name is the prefix
// followed by digits only.
function pickTempPrefix(names: Set<string>): string {
  let prefix = '$t';
  while (isTempPrefixTaken(names, prefix)) {
    prefix += '_';
  }
  return prefix;
}

function isTempPrefixTaken(names: Set<string>, prefix: string): boolean {
  for (const name of names) {
    if (name.startsWith(prefix) && /^\d+$/.test(name.slice(prefix.length))) {
      return true;
    }
  }
  return false;
}

export function createContext(
  s: MagicString,
  model: ModuleModel,
): GenerateContext {
  const { names } = model.info;

  // Each helper keeps its export name unless the module uses it.
  const helperNames = new Map<Helper, string>();
  for (const name of HELPERS) {
    let local: string = name;
    while (names.has(local)) {
      local += '_';
    }
    helperNames.set(name, local);
  }

  const parentOf = new Map<Node, Node | null>();
  visit(model.parsed.program, (node, parent) => {
    parentOf.set(node, parent);
  });

  return {
    s,
    model,
    code: model.parsed.code,
    parentOf,
    helperNames,
    usedHelpers: new Set(),
    renamed: new Map(),
    temps: new Map(),
    declaredTemps: new Set(),
    tempPrefix: pickTempPrefix(names),
    tempCount: 0,
  };
}

/** The local name of a helper. Marks it for the import. */
export function useHelper(context: GenerateContext, name: Helper): string {
  context.usedHelpers.add(name);
  return context.helperNames.get(name)!;
}

/** `$$get(sc, k)`. */
export function printGet(context: GenerateContext, slot: Slot): string {
  return `${useHelper(context, '$$get')}(${slot.scope.param}, ${slot.index})`;
}

/** `$$set(sc, k, `: the opening text of a write whose value follows. */
export function printSetOpen(context: GenerateContext, slot: Slot): string {
  return `${useHelper(context, '$$set')}(${slot.scope.param}, ${slot.index}, `;
}

/** `$$set(sc, k, value)`. */
export function printSet(
  context: GenerateContext,
  slot: Slot,
  value: string,
): string {
  return `${printSetOpen(context, slot)}${value})`;
}

/**
 * A new temp of the owner. One counter for the module, so no temp shadows another.
 * `declared` temps are declared by the code that uses them and get no `let`.
 */
export function takeTemp(
  context: GenerateContext,
  owner: TempOwner,
  declared = false,
): string {
  let list = context.temps.get(owner);
  if (!list) {
    list = [];
    context.temps.set(owner, list);
  }
  const name = `${context.tempPrefix}${context.tempCount}`;
  context.tempCount += 1;
  list.push(name);
  if (declared) {
    context.declaredTemps.add(name);
  }
  return name;
}

/**
 * True when the expression must be parenthesized as an arrow body: its text starts
 * with `{` (an object literal, `{ n }.n`, `{ n } as const`), or it is a sequence.
 */
export function needsParens(code: string, node: Node): boolean {
  return code[node.start] === '{' || node.type === 'SequenceExpression';
}
