// The logs that `check-samples.ts` asserts for the samples of the guide pages.
export default {
  'samples/index-overview.js': ['1 doubled is 2', '21 doubled is 42'],
  'samples/basic-reactivity-count.js': ['Count: 1', 'Count: 100'],
  'samples/basic-reactivity-tracking.js': ['Count: 0', 'Total: 0'],
  'samples/computed-variables-message.js': ['Count: 100'],
  'samples/computed-variables-writable.js': [
    'Log Count: 0',
    'Log Count: 100',
    'Log Hello World',
    'Log Count: 200',
  ],
  'samples/synchronous-tracking-batching.js': [
    'Sync Count: 0',
    'Sync Count: 100',
    'Sync Count: 200',
    'Async Count: 200',
  ],
  'samples/synchronous-tracking-tick.js': [
    'Before tick',
    'Count: 2',
    'After tick',
  ],
  'samples/lifecycles-mount.js': ['Not mounted yet!', 'Mounted!', 'Destroyed!'],
  'samples/composition-squared.js': [
    'Value 0',
    'Squared 0',
    'Value 100',
    'Squared 10000',
  ],
  'samples/composition-nested.js': [
    'y is 0',
    'x + y is 100',
    'Cleaned up',
    'y is 100',
    'x + y is 200',
  ],
  'samples/stores-counter.js': [
    'Sync Count: 100',
    'Raw Count: 200',
    'Sync Count: 200',
    'Async Count: 200',
  ],
  'samples/solid-store.js': [
    'Silmaril Count: 0',
    'Silmaril Count: 1',
    'Silmaril Count: 10',
  ],
} satisfies Record<string, string[]>;
