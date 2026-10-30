export interface Stats {
  median: number;
  min: number;
  max: number;
}

/** Summarizes samples (any unit). */
export function summarize(samples: number[]): Stats {
  const sorted = samples.toSorted((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)]!,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
  };
}

/** Milliseconds for one call of `fn`. */
export async function timeMs(fn: () => unknown): Promise<number> {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

declare const gc: (() => void) | undefined;

/** Forces a collection when node runs with `--expose-gc`. */
export function collect(): void {
  if (typeof gc === 'function') {
    gc();
  }
}

export function format(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/** Prints rows as an aligned markdown table. */
export function printTable(
  title: string,
  header: string[],
  rows: string[][],
): void {
  const widths = header.map((cell, i) =>
    Math.max(cell.length, ...rows.map((row) => row[i]!.length)),
  );
  const line = (row: string[]): string =>
    `| ${row.map((cell, i) => cell.padEnd(widths[i]!)).join(' | ')} |`;
  console.log(`\n${title}\n`);
  console.log(line(header));
  console.log(`| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`);
  for (const row of rows) {
    console.log(line(row));
  }
}
