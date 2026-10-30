// The model half of the runtime fixtures: for every fixture with an output.js, the
// slots, entries (kind, id, output slot) and graphs of the model equal the ones
// output.js encodes. Every compile-error fixture throws its message.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import type { Node } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { analyzeModule } from '../../../compiler/analysis/index';
import { getBlockBody, type Ref } from '../../../compiler/analysis/model';
import { unwrap, visit } from '../../../compiler/analysis/walk';
import { parseModule } from '../../../compiler/source';

const dir = new URL('../../runtime/fixtures/', import.meta.url);

interface Fixture {
  name: string;
  input: string;
  output: string | null;
  expected: { description: string; compileError?: string };
}

function loadFixtures(): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const name of readdirSync(dir).toSorted()) {
    const outputUrl = new URL(`${name}/output.js`, dir);
    fixtures.push({
      name,
      input: readFileSync(new URL(`${name}/input.js`, dir), 'utf8'),
      output: existsSync(outputUrl) ? readFileSync(outputUrl, 'utf8') : null,
      expected: JSON.parse(
        readFileSync(new URL(`${name}/expected.json`, dir), 'utf8'),
      ),
    });
  }
  return fixtures;
}

type Registration = (string | number | null)[];

interface Shape {
  graphs: (Ref[][] | null)[];
  registrations: Registration[];
  /** The slot numbers of each scope parameter name, sorted. */
  slots: Record<string, number[]>;
}

function addSlot(
  slots: Record<string, number[]>,
  param: string,
  index: number,
): void {
  const list = (slots[param] ??= []);
  if (!list.includes(index)) {
    list.push(index);
    list.sort((a, b) => a - b);
  }
}

// Graphs compare as sets per slot, without trailing empty lists.
function normalizeGraph(graph: readonly (Ref[] | undefined)[]): Ref[][] {
  const out: Ref[][] = [];
  for (const list of graph) {
    const copy = [...(list ?? [])];
    copy.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    out.push(copy);
  }
  while (out.length > 0 && out.at(-1)!.length === 0) {
    out.pop();
  }
  return out;
}

function readNumber(node: Node): number {
  const inner = unwrap(node);
  if (inner.type === 'UnaryExpression' && inner.operator === '-') {
    return -readNumber(inner.argument);
  }
  if (inner.type === 'Literal' && typeof inner.value === 'number') {
    return inner.value;
  }
  throw new Error(`not a number literal: ${inner.type}`);
}

// The value of an array of numbers, arrays and holes, read from the AST.
function readLiteral(node: Node): unknown {
  if (node.type === 'ArrayExpression') {
    const out: unknown[] = [];
    for (const element of node.elements) {
      out.push(element === null ? undefined : readLiteral(element));
    }
    return out;
  }
  return readNumber(node);
}

// The shape the hand-written output.js encodes.
function readOutputShape(code: string): Shape {
  const { program } = parseModule(code, 'output.js');

  // Graph constants are array literals at the module level.
  const constants = new Map<string, Ref[][]>();
  visit(program, (node) => {
    if (
      node.type === 'VariableDeclarator' &&
      node.id.type === 'Identifier' &&
      node.init?.type === 'ArrayExpression'
    ) {
      constants.set(node.id.name, readLiteral(node.init) as Ref[][]);
    }
  });
  function readGraph(node: Node | undefined): Ref[][] | null {
    if (node?.type === 'Identifier' && constants.has(node.name)) {
      return normalizeGraph(constants.get(node.name)!);
    }
    return null;
  }

  // Registrations in source order, and the graph of every setup and entry body.
  const graphs: (Ref[][] | null)[] = [];
  const registrations: Registration[] = [];
  const slots: Record<string, number[]> = {};
  visit(program, (node) => {
    if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') {
      return;
    }
    const args = node.arguments as Node[];

    // Every slot appears in a helper call: `$$get(p, k)`, `$$set(p, k, v)`,
    // `$$update(p, k, ...)`, `$$memo(p, n, k, f)` or `$$store(p, k, s)`.
    const param = args[0]?.type === 'Identifier' ? args[0].name : null;
    const name = node.callee.name;
    if (param && ['$$get', '$$set', '$$update', '$$store'].includes(name)) {
      addSlot(slots, param, readNumber(args[1]!));
    }
    if (param && name === '$$memo' && readNumber(args[2]!) >= 0) {
      addSlot(slots, param, readNumber(args[2]!));
    }

    switch (name) {
      case '$$root':
      case '$$composable':
        graphs.push(readGraph(args[0]));
        break;
      case '$$sync':
      case '$$effect': {
        const kind = node.callee.name === '$$sync' ? 'sync' : 'effect';
        registrations.push([kind, readNumber(args[1]!)]);
        const body = unwrap(args[2]!);
        if (
          (body.type === 'ArrowFunctionExpression' ||
            body.type === 'FunctionExpression') &&
          (body.body?.type === 'BlockStatement' || args.length > 3)
        ) {
          graphs.push(readGraph(args[3]));
        }
        break;
      }
      case '$$memo':
        registrations.push([
          'memo',
          readNumber(args[1]!),
          readNumber(args[2]!),
        ]);
        break;
      case '$$store':
        registrations.push([
          'store',
          readNumber(args[1]!),
          args[3] ? readNumber(args[3]) : null,
        ]);
        break;
      default:
        break;
    }
  });
  return { graphs, registrations, slots };
}

// The same shape from the model of input.js.
function readModelShape(code: string): Shape {
  const model = analyzeModule(code, 'input.js');
  // No compile-time import: nothing is registered (fixture namespace-root).
  if (!model) {
    return { graphs: [], registrations: [], slots: {} };
  }
  const graphs: (Ref[][] | null)[] = [];
  const items: { start: number; registration: Registration }[] = [];
  const slots: Record<string, number[]> = {};
  for (const scope of model.scopes) {
    for (const slot of scope.slots) {
      addSlot(slots, scope.param, slot.index);
    }
    if (scope.call) {
      graphs.push(normalizeGraph(scope.graph!));
    } else if (getBlockBody(scope)) {
      graphs.push(scope.graph ? normalizeGraph(scope.graph) : null);
    }
    for (const entry of scope.entries) {
      if (entry.kind === 'sync' || entry.kind === 'effect') {
        items.push({
          start: entry.node.start,
          registration: [entry.kind, entry.id],
        });
      } else if (entry.kind === 'memo') {
        items.push({
          start: entry.node.start,
          registration: ['memo', entry.id, entry.slot],
        });
      }
    }
  }
  for (const record of model.declarators.values()) {
    if (record.kind === 'store') {
      items.push({
        start: record.declarator.start,
        registration: [
          'store',
          record.slots[0]!.index,
          record.entry ? record.entry.id : null,
        ],
      });
    }
  }
  items.sort((a, b) => a.start - b.start);
  return {
    graphs,
    registrations: items.map((item) => item.registration),
    slots,
  };
}

const fixtures = loadFixtures();

it('every fixture has either an output.js or a compile error', () => {
  let withOutput = 0;
  let withError = 0;
  for (const fixture of fixtures) {
    if (fixture.output !== null) {
      withOutput += 1;
    }
    if (fixture.expected.compileError !== undefined) {
      withError += 1;
    }
  }
  expect([withOutput, withError]).toEqual([54, 7]);
  expect(withOutput + withError).toBe(fixtures.length);
});

describe('runtime fixtures: model', () => {
  const withOutput = fixtures.filter((fixture) => fixture.output !== null);

  for (const fixture of withOutput) {
    it(`fixture ${fixture.name}`, () => {
      expect(readModelShape(fixture.input)).toEqual(
        readOutputShape(fixture.output!),
      );
    });
  }
});

describe('runtime fixtures: compile errors', () => {
  const withError = fixtures.filter(
    (fixture) => fixture.expected.compileError !== undefined,
  );

  for (const fixture of withError) {
    it(`fixture ${fixture.name}`, () => {
      expect(() => analyzeModule(fixture.input, 'input.js')).toThrow(
        fixture.expected.compileError,
      );
    });
  }
});
