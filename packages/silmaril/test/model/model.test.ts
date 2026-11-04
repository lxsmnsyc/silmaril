import * as fc from 'fast-check';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { pipelines, run } from '../behavior/harness';
import { parseLogs, simulate } from './oracle';
import { programArb, renderProgram } from './program';
import type { Program } from './program';

const NUM_RUNS = 150;

describe.each(pipelines)('model [$name]', (pipeline) => {
  it('matches the plain JS oracle after every action', async () => {
    await fc.assert(
      fc.asyncProperty(programArb, async (program) => {
        const source = renderProgram(program);
        const expected = simulate(program);

        // Run the compiled program. The logs hold the markers and effect logs.
        const result = await run(pipeline, source);
        result.dispose();

        // The message prints the source when the comparison fails.
        expect(parseLogs(result.logs), `generated source:\n${source}`).toEqual(
          expected,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('compiles every generated program to valid syntax', async () => {
    await fc.assert(
      fc.asyncProperty(programArb, async (program) => {
        const source = renderProgram(program);
        const code = await pipeline.compile(source, '/model/program.js');
        const parsed = parseSync('program.js', code, { sourceType: 'module' });
        const messages: string[] = [];
        for (const error of parsed.errors) {
          messages.push(error.message);
        }
        expect(
          messages,
          `generated source:\n${source}\ncompiled:\n${code}`,
        ).toEqual([]);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('runs a fixed program as the oracle predicts', async () => {
    const program: Program = {
      bases: [1, 2],
      deriveds: [
        {
          k: 'cond',
          op: '>',
          l: { k: 'ref', name: 0 },
          r: { k: 'num', n: 1 },
          a: { k: 'ref', name: 1 },
          b: { k: 'num', n: 0 },
        },
      ],
      effects: [
        { sync: true, cleanup: true, exprs: [{ k: 'ref', name: 2 }] },
        { sync: false, cleanup: false, exprs: [{ k: 'ref', name: 0 }] },
      ],
      setup: [],
      actions: [
        { t: 'flush' },
        {
          t: 'step',
          stmts: [{ target: 0, op: '++x', value: { k: 'num', n: 0 } }],
        },
        { t: 'flush' },
        { t: 'stop' },
      ],
    };
    const source = renderProgram(program);
    const result = await run(pipeline, source);
    result.dispose();
    const trace = parseLogs(result.logs);
    const effects = [];
    for (const entry of trace) {
      effects.push(entry.effects);
    }
    expect(effects).toEqual([
      { e0: [[0]] },
      { e1: [[1]] },
      { c0: [[]], e0: [[2]] },
      { e1: [[2]] },
      { c0: [[]] },
    ]);
  });
});
