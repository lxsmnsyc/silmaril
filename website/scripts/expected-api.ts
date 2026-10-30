// The logs that `check-samples.ts` asserts for the samples of the API page.
export default {
  'samples/api-store.js': ['Variable: 1', 'Store: 2', 'Variable: 2'],
  'samples/api-tick.js': ['Count: 2', 'Done'],
  'samples/api-skip.js': ['Run 0 0', 'Run 1 1', 'Done'],
} satisfies Record<string, string[]>;
