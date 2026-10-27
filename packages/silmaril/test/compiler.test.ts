import { describe, it, expect } from 'vitest';
import * as babel from '@babel/core';
import plugin from '../babel';

async function compile(code: string) {
  const result = await babel.transformAsync(code, {
    plugins: [plugin],
  });
  return result?.code;
}

describe('let', () => {
  it('should compile on AssignmentExpression', async () => {
    const result = await compile(`
    import { $$ } from 'silmaril';

    $$(() => {
      let x = 0;

      function increment() {
        x += 1;
      }
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should compile on UpdateExpression', async () => {
    const result = await compile(`
    import { $$ } from 'silmaril';

    $$(() => {
      let x = 0;

      function increment() {
        x++;
      }
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should compile when accessing owned variables', async () => {
    const result = await compile(`
    import { $$ } from 'silmaril';

    $$(() => {
      let greeting = 'Hello';
      let receiver = 'World';
      const message = greeting + ' ' + receiver;
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should not compile when not accessing owned variables', async () => {
    const result = await compile(`
    import { $$ } from 'silmaril';

    $$(() => {
      const message = Math.random();
    });
    `);

    expect(result).toMatchSnapshot();
  });
});
describe('$', () => {
  it('should compile to $$effect', async () => {
    const result = await compile(`
    import { $$, $ } from 'silmaril';

    $$(() => {
      $(console.log('Example'));
      $(() => console.log('Example'));
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should subscribe to owned variables', async () => {
    const result = await compile(`
    import { $$, $ } from 'silmaril';

    $$(() => {
      let x = 0;
      $(console.log(x));
      $(() => console.log(x));
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should not subscribe to unowned variables', async () => {
    const result = await compile(`
    import { $$, $ } from 'silmaril';

    let x = 0;
    $$(() => {
      $(console.log(x));
      $(() => console.log(x));
    });
    `);

    expect(result).toMatchSnapshot();
  });
});
describe('$sync', () => {
  it('should compile to $$sync', async () => {
    const result = await compile(`
    import { $$, $sync } from 'silmaril';

    $$(() => {
      $sync(console.log('Example'));
      $sync(() => console.log('Example'));
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should subscribe to owned variables', async () => {
    const result = await compile(`
    import { $$, $sync } from 'silmaril';

    $$(() => {
      let x = 0;
      $sync(console.log(x));
      $sync(() => console.log(x));
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should not subscribe to unowned variables', async () => {
    const result = await compile(`
    import { $$, $sync } from 'silmaril';

    let x = 0;
    $$(() => {
      $sync(console.log(x));
      $sync(() => console.log(x));
    });
    `);

    expect(result).toMatchSnapshot();
  });
});
describe('onMount', () => {
  it('should compile to $$mount', async () => {
    const result = await compile(`
    import { $$, onMount } from 'silmaril';

    $$(() => {
      onMount(() => sconsole.log('Example'));
    });
    `);

    expect(result).toMatchSnapshot();
  });
});
describe('onDestroy', () => {
  it('should compile to $$destroy', async () => {
    const result = await compile(`
    import { $$, onDestroy } from 'silmaril';

    $$(() => {
      onDestroy(() => console.log('Example'));
    });
    `);

    expect(result).toMatchSnapshot();
  });
});
describe('$store', () => {
  it('should compile $store with const', async () => {
    const result = await compile(`
    import { $$, $store } from 'silmaril';

    $$(() => {
      const example = $store(someStore);
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should compile $store with let', async () => {
    const result = await compile(`
    import { $$, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should allow updates for mutable stores', async () => {
    const result = await compile(`
    import { $$, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);

      function mutate() {
        example = newValue;
      }
    });
    `);

    expect(result).toMatchSnapshot();
  });
  it('should allow tracking for stores', async () => {
    const result = await compile(`
    import { $$, $store } from 'silmaril';

    $$(() => {
      let example = $store(someStore);

      $(console.log(example));
    });
    `);

    expect(result).toMatchSnapshot();
  });
});

describe('$skip', () => {
  it('should leave skipped identifiers out of tracking', async () => {
    const result = await compile(`
    import { $$, $, $skip } from 'silmaril';

    $$(() => {
      let a = 0;
      let b = 0;

      $(console.log(a, $skip(b)));
    });
    `);

    expect(result).not.toContain('$skip(');
    expect(result).toMatchInlineSnapshot(`
      "import { $$, $, $skip, $$context as _$$context, $$effect as _$$effect } from 'silmaril';
      $$(() => {
        let _ctx = _$$context();
        let a = 0;
        let b = 0;
        _$$effect(_ctx, () => [a], () => console.log(a, b));
      });"
    `);
  });
  it('should leave skipped identifiers out of computed values', async () => {
    const result = await compile(`
    import { $$, $skip } from 'silmaril';

    $$(() => {
      let a = 0;
      let b = 0;
      const sum = a + $skip(b + 1);
    });
    `);

    expect(result).not.toContain('$skip(');
    expect(result).toMatchInlineSnapshot(`
      "import { $$, $skip, $$context as _$$context, $$sync as _$$sync, $$update as _$$update } from 'silmaril';
      $$(() => {
        let _ctx = _$$context();
        let a = 0;
        let b = 0;
        let sum,
          /*$skip*/_computed = _$$sync(_ctx, () => [a], () => _$$update(_ctx, sum = a + (b + 1)));
      });"
    `);
  });
});

describe('$$ argument', () => {
  it('should throw on a literal argument', async () => {
    await expect(
      compile(`
      import { $$ } from 'silmaril';

      $$(1);
      `),
    ).rejects.toThrow(
      '$$ argument must be ArrowFunctionExpression or FunctionExpression',
    );
  });
  it('should throw on an identifier argument', async () => {
    await expect(
      compile(`
      import { $$ } from 'silmaril';

      const setup = () => {};
      $$(setup);
      `),
    ).rejects.toThrow(
      '$$ argument must be ArrowFunctionExpression or FunctionExpression',
    );
  });
});
