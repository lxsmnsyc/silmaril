/** Source with `groups` reactive groups: a source, a computed and an effect each. */
export function compileSource(groups: number): string {
  const lines = ["import { $$, $ } from 'silmaril';", '$$(() => {'];
  for (let i = 0; i < groups; i++) {
    lines.push(
      `  let count${i} = ${i};`,
      `  const double${i} = count${i} * 2;`,
      `  const label${i} = \`item \${count${i}} of \${double${i}}\`;`,
      `  $(log(label${i}, double${i}));`,
    );
  }
  lines.push('});');
  return lines.join('\n');
}

/**
 * One source `count` with `size` computeds that read it and `size` sync
 * effects that read the computeds. `expose` receives the writer.
 */
export function singleWriteSource(size: number): string {
  const lines = [
    "import { $$, $sync } from 'silmaril';",
    '$$(() => {',
    '  let count = 0;',
  ];
  for (let i = 0; i < size; i++) {
    lines.push(`  const c${i} = count + ${i};`, `  $sync(sink(c${i}));`);
  }
  lines.push('  expose((value) => {', '    count = value;', '  });', '});');
  return lines.join('\n');
}

/**
 * `size` sources, each with a computed and a `$` effect. `expose` receives a
 * function that writes every source, which the runtime batches into one run.
 */
export function batchSource(size: number): string {
  const lines = ["import { $$, $ } from 'silmaril';", '$$(() => {'];
  for (let i = 0; i < size; i++) {
    lines.push(
      `  let v${i} = 0;`,
      `  const d${i} = v${i} + 1;`,
      `  $(sink(d${i}));`,
    );
  }
  lines.push('  expose((value) => {');
  for (let i = 0; i < size; i++) {
    lines.push(`    v${i} = value;`);
  }
  lines.push('  });', '});');
  return lines.join('\n');
}
