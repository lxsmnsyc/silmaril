import type { Pipeline } from '../../packages/silmaril/test/behavior/harness';
import { compileSource } from './sources';
import { collect, format, printTable, summarize, timeMs } from './stats';

const GROUPS = [10, 100, 400];
const RUNS = 7;

/** Compile time and retained memory per source size, for each pipeline. */
export async function benchCompile(pipelines: Pipeline[]): Promise<void> {
  const rows: string[][] = [];
  for (const pipeline of pipelines) {
    for (const groups of GROUPS) {
      const code = compileSource(groups);
      // Warm up so the JIT and the parser setup are not measured.
      await pipeline.compile(code, 'bench.js');
      const times: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        times.push(await timeMs(() => pipeline.compile(code, 'bench.js')));
      }
      // Memory: heap allocated by one compile, read right after a collection.
      const heaps: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        collect();
        const before = process.memoryUsage().heapUsed;
        const output = await pipeline.compile(code, 'bench.js');
        heaps.push((process.memoryUsage().heapUsed - before) / 1024);
        if (output.length === 0) {
          throw new Error('empty compile output');
        }
      }
      const heap = summarize(heaps).median;
      const stats = summarize(times);
      rows.push([
        pipeline.name,
        `${(code.length / 1024).toFixed(1)} KB`,
        format(stats.median),
        format(stats.min),
        format(stats.max),
        format(heap, 1),
      ]);
    }
  }
  printTable(
    'Compile (ms per file, KiB of heap allocated per compile, a lower bound)',
    ['pipeline', 'source', 'median ms', 'min ms', 'max ms', 'heap KiB'],
    rows,
  );
}
