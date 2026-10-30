// Runs the prototype compiler in the page. The result goes to window.spikeResult.
import tricky from '../fixtures/tricky.tsx?raw';
import { generate } from '../gen.ts';

declare global {
  interface Window {
    spikeResult: unknown;
  }
}

async function run(): Promise<unknown> {
  const loadStart = performance.now();
  // The binding instantiates its wasm with a top-level await, so this import is the async step.
  const { compile } = await import('../compile.ts');
  const loadMs = performance.now() - loadStart;
  const out = compile(tricky, { filename: 'tricky.tsx' });
  const code = generate(2000);
  for (let i = 0; i < 5; i += 1) {
    compile(code, { filename: 'generated.tsx' });
  }
  const times: number[] = [];
  for (let i = 0; i < 20; i += 1) {
    const start = performance.now();
    compile(code, { filename: 'generated.tsx' });
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    ok: true,
    crossOriginIsolated: globalThis.crossOriginIsolated,
    loadMs,
    compileMedianMs: times[10],
    writes: out.code.split('$$set(').length - 1,
    mapVersion: out.map ? JSON.parse(out.map.toString()).version : null,
  };
}

run().then(
  (result) => {
    window.spikeResult = result;
    document.getElementById('out')!.textContent = JSON.stringify(
      result,
      null,
      2,
    );
  },
  (error: Error) => {
    window.spikeResult = {
      ok: false,
      error: String(error),
      stack: error.stack,
    };
    document.getElementById('out')!.textContent = String(error);
  },
);
