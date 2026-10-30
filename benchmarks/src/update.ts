import type { Pipeline } from '../../packages/silmaril/test/behavior/harness';
import { runModule } from './load';
import { batchSource, singleWriteSource } from './sources';
import { format, printTable, summarize, timeMs } from './stats';

const SIZES = [10, 100, 400];
const RUNS = 20;
const WRITES = 50;

type Writer = (value: number) => void;

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function setup(pipeline: Pipeline, code: string): Promise<Writer> {
  let write: Writer | undefined;
  let sunk = 0;
  await runModule(pipeline, code, {
    expose(fn: Writer) {
      write = fn;
    },
    sink(value: number) {
      sunk += value;
    },
  });
  await tick();
  if (!write || sunk < 0) {
    throw new Error('the benchmark module did not expose a writer');
  }
  return write;
}

/** Update cost per pipeline: one write, and many writes in a batch. */
export async function benchUpdate(pipelines: Pipeline[]): Promise<void> {
  const rows: string[][] = [];
  for (const pipeline of pipelines) {
    for (const size of SIZES) {
      // One write fans out to `size` computeds and `size` sync effects.
      const write = await setup(pipeline, singleWriteSource(size));
      let value = 0;
      for (let i = 0; i < 5; i++) {
        write(++value);
      }
      const single: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        single.push(await timeMs(() => write(++value)));
      }
      const one = summarize(single);

      // `WRITES` rounds of writing `size` sources at once, then one flush.
      const batchWrite = await setup(pipeline, batchSource(size));
      let batchValue = 0;
      for (let i = 0; i < 3; i++) {
        batchWrite(++batchValue);
        await tick();
      }
      const batch: number[] = [];
      for (let i = 0; i < RUNS; i++) {
        batch.push(
          await timeMs(async () => {
            for (let j = 0; j < WRITES; j++) {
              batchWrite(++batchValue);
            }
            await tick();
          }),
        );
      }
      const many = summarize(batch);
      rows.push([
        pipeline.name,
        String(size),
        format(one.median * 1000, 1),
        format(one.max * 1000, 1),
        format(many.median),
        format(many.max),
      ]);
    }
  }
  printTable(
    `Update (one write: microseconds; batch: ${WRITES} writes of N sources then one tick, ms)`,
    [
      'pipeline',
      'N',
      'write median us',
      'write max us',
      'batch median ms',
      'batch max ms',
    ],
    rows,
  );
}
