import { describe, expect, it } from 'vitest';
import { compile } from '../compiler';

const ID = '/path/to/example.ts';

describe('let', () => {
  it('should compile on AssignmentExpression', async () => {
    const result = await compile(
      ID,
      `
    import { $$ } from 'silmaril';

    $$(() => {
      let x = 0;

      function increment() {
        x += 1;
      }
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should compile on UpdateExpression', async () => {
    const result = await compile(
      ID,
      `
    import { $$ } from 'silmaril';

    $$(() => {
      let x = 0;

      function increment() {
        x++;
      }
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should compile when accessing owned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$ } from 'silmaril';

    $$(() => {
      let greeting = 'Hello';
      let receiver = 'World';
      const message = greeting + ' ' + receiver;
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should not compile when not accessing owned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$ } from 'silmaril';

    $$(() => {
      const message = Math.random();
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
describe('$', () => {
  it('should compile to $$effect', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $ } from 'silmaril';

    $$(() => {
      $(console.log('Example'));
      $(() => console.log('Example'));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should subscribe to owned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $ } from 'silmaril';

    $$(() => {
      let x = 0;
      $(console.log(x));
      $(() => console.log(x));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should not subscribe to unowned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $ } from 'silmaril';

    let x = 0;
    $$(() => {
      $(console.log(x));
      $(() => console.log(x));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
describe('$sync', () => {
  it('should compile to $$sync', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $sync } from 'silmaril';

    $$(() => {
      $sync(console.log('Example'));
      $sync(() => console.log('Example'));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should subscribe to owned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $sync } from 'silmaril';

    $$(() => {
      let x = 0;
      $sync(console.log(x));
      $sync(() => console.log(x));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should not subscribe to unowned variables', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $sync } from 'silmaril';

    let x = 0;
    $$(() => {
      $sync(console.log(x));
      $sync(() => console.log(x));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
describe('onMount', () => {
  it('should compile to $$mount', async () => {
    const result = await compile(
      ID,
      `
    import { $$, onMount } from 'silmaril';

    $$(() => {
      onMount(() => console.log('Example'));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
describe('onDestroy', () => {
  it('should compile to $$destroy', async () => {
    const result = await compile(
      ID,
      `
    import { $$, onDestroy } from 'silmaril';

    $$(() => {
      onDestroy(() => console.log('Example'));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
describe('$store', () => {
  it('should compile $store with const', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $store } from 'silmaril';

    $$(() => {
      const example = $store(someStore);
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should compile $store with let', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should allow updates for mutable stores', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);

      function mutate() {
        example = newValue;
      }
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
  it('should allow tracking for stores', async () => {
    const result = await compile(
      ID,
      `
    import { $$, $, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);

      $(console.log(example));
    });
    `,
    );

    expect(result).toMatchSnapshot();
  });
});
