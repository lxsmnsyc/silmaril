// The logs that `check-samples.ts` asserts for the samples of the migration, internals and limits pages.
export default {
  'samples/internals-order.js': [
    '$sync sees 1 and 2',
    '$sync sees 5 and 10',
    '$ sees 5',
  ],
  'samples/limits-in-place.js': ['name: Ada', 'after the change: Grace'],
  'samples/limits-pattern-default.js': ['b is 1'],
  'samples/limits-settled-loop.js': ['n is 3'],
  'samples/limits-update-loop.js': ['Update loop'],
  'samples/migration-destructuring.js': [
    'a and b: 0 0',
    'a and b: 1 0',
    'a and b: 1 2',
  ],
  'samples/migration-error-isolation.js': [
    'second ran with 0',
    'second ran with 1',
    'write threw: first failed',
  ],
  'samples/migration-flush-order.js': ['parent', 'child'],
  'samples/migration-local-helper.js': ['Hello, Ada', 'Hello, Grace'],
  'samples/migration-nested-entry.js': [
    'outer body: 0',
    'nested: 0',
    'nested: 1',
  ],
  'samples/migration-read-before-declaration.js': [
    'before: undefined',
    'after: 2',
  ],
  'samples/migration-reads-only.js': ['reads a: 0', 'reads b: 0', 'reads a: 1'],
  'samples/migration-restored-value.js': ['count is 0', 'count is 0'],
  'samples/migration-sync-batch.js': ['a is 0', 'a is 0'],
};
