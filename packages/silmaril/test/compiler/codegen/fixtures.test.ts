// The codegen half of the runtime fixtures: compile each input.js, compare the text
// with output.js after normalization, run it with the runner protocol and compare
// its logs with expected.json. Every compile-error fixture throws its message.
import { describe, expect, it } from 'vitest';
import { compile } from '../../../compiler/index';
import {
  compileChecked,
  loadFixtures,
  normalize,
  runLogs,
  type Fixture,
} from './helpers';

// Split before registering, so no test sits under a condition.
const errorFixtures: Fixture[] = [];
const compiledFixtures: Fixture[] = [];
for (const fixture of loadFixtures()) {
  if (fixture.expected.compileError !== undefined) {
    errorFixtures.push(fixture);
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

  for (const { name, input, output, expected } of compiledFixtures) {
    it(`fixture ${name} text matches output.js`, () => {
      const { code } = compileChecked(input);
      expect(normalize(code)).toBe(normalize(output!));
    });
    it(`fixture ${name} logs match expected.json`, async () => {
      const { code } = compileChecked(input);
      expect(await runLogs(code)).toStrictEqual(expected.logs);
    });
  }
});
