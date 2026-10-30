// The codegen half of the runtime fixtures: compile each input.js, compare the text
// with output.js after normalization, run it with the runner protocol and compare
// its logs with expected.json. Every compile-error fixture throws its message.
import { describe, expect, it } from 'vitest';
import { compile } from '../../../compiler/index';
import { loadFixtures, normalize, runLogs, type Fixture } from './helpers';

// Fixtures that need $store, $composable, onMount, onDestroy or $skip. Their code
// generation belongs to codegen-extras, which empties this list.
const WAITING_FOR_EXTRAS = new Set<string>([
  'composable',
  'composable-glitch',
  'composable-lifecycle',
  'dispose-order',
  'dispose-queued',
  'effect-scope',
  'error-in-rerun',
  'lifecycle',
  'memo-local-call',
  'nested-composable',
  'nested-root',
  'nested-scope',
  'setup-throws',
  'skip',
  'store-const',
  'store-echo',
  'store-let',
  'store-writeback-batch',
]);

// Split before registering, so no test sits under a condition.
const errorFixtures: Fixture[] = [];
const waitingFixtures: Fixture[] = [];
const compiledFixtures: Fixture[] = [];
for (const fixture of loadFixtures()) {
  if (fixture.expected.compileError !== undefined) {
    errorFixtures.push(fixture);
  } else if (WAITING_FOR_EXTRAS.has(fixture.name)) {
    waitingFixtures.push(fixture);
  } else {
    compiledFixtures.push(fixture);
  }
}

describe('codegen fixtures', () => {
  for (const { name, input, expected } of errorFixtures) {
    it(`fixture ${name} throws its compile error`, () => {
      expect(() => compile(input, { filename: 'input.js' })).toThrow(
        expected.compileError,
      );
    });
  }

  for (const { name, input } of waitingFixtures) {
    it(`fixture ${name} waits for codegen-extras`, () => {
      expect(() => compile(input, { filename: 'input.js' })).toThrow(
        'is not supported by the compiler yet.',
      );
    });
  }

  for (const { name, input, output, expected } of compiledFixtures) {
    it(`fixture ${name} text matches output.js`, () => {
      const { code } = compile(input, { filename: 'input.js' });
      expect(normalize(code)).toBe(normalize(output!));
    });
    it(`fixture ${name} logs match expected.json`, async () => {
      const { code } = compile(input, { filename: 'input.js' });
      expect(await runLogs(code)).toStrictEqual(expected.logs);
    });
  }

  it('waits only for fixtures that exist', () => {
    const found: string[] = [];
    for (const fixture of waitingFixtures) {
      found.push(fixture.name);
    }
    expect(found).toStrictEqual([...WAITING_FOR_EXTRAS]);
  });
});
