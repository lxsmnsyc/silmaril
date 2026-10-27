// Parse and analysis time on a generated 2,000-line TSX file. Run with `node bench.ts`.
import { parseSync } from 'oxc-parser';
import { analyze as periscopic } from 'periscopic';
import { babel, babelCompile, babelParse } from './babel-baseline.ts';
import { compile, parseModule } from './compile.ts';
import { generate } from './gen.ts';
import { analyzeScopes } from './scope.ts';

const code = generate(2000);
const filename = 'generated.tsx';
console.log(`input: ${code.split('\n').length} lines, ${code.length} bytes`);

function measure(name: string, fn: () => void, runs = 50): void {
  for (let i = 0; i < 10; i += 1) {
    fn();
  }
  const times: number[] = [];
  for (let i = 0; i < runs; i += 1) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)]!;
  const p90 = times[Math.floor(times.length * 0.9)]!;
  console.log(
    `${name.padEnd(48)} median ${median.toFixed(2)} ms   p90 ${p90.toFixed(2)} ms`,
  );
}

measure('babel: parse', () => {
  babelParse(code, filename);
});
measure('babel: parse + scope crawl', () => {
  const ast = babelParse(code, filename)!;
  babel.traverse(ast, {
    Program(path) {
      path.scope.crawl();
    },
  });
});
measure('babel: silmaril plugin (parse+transform+generate+map)', () => {
  babelCompile(code, filename);
});
measure('oxc: parseSync + read program', () => {
  // `program` is a getter that builds the JS objects, so it is read here.
  void parseSync(filename, code, {
    lang: 'tsx',
    sourceType: 'module',
    preserveParens: true,
  }).program;
});
measure('oxc: parse + analyzeScopes', () => {
  analyzeScopes(parseModule(code, filename).program);
});
measure('oxc: parse + periscopic (no TS awareness)', () => {
  periscopic(parseModule(code, filename).program);
});
const { program } = parseModule(code, filename);
measure('analyzeScopes alone', () => {
  analyzeScopes(program);
});
measure('oxc: prototype compile (parse+analysis+magic-string+map)', () => {
  compile(code, { filename });
});
