// Builds the page with Vite, serves it, and runs it in Playwright browsers,
// with and without cross-origin isolation. Run with `node browser/run.ts`.
import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { chromium, firefox, webkit, type BrowserType } from 'playwright';
import { build } from 'vite';

const root = import.meta.dirname;

for (const binding of ['wasip1', 'wasi']) {
  process.env.SPIKE_BINDING = binding;
  await build({
    configFile: path.join(root, 'vite.config.ts'),
    logLevel: 'warn',
  });
}

const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};

function serve(
  dist: string,
  isolated: boolean,
): Promise<{ server: Server; url: string }> {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? '/', 'http://x').pathname;
    const file = path.join(dist, pathname === '/' ? 'index.html' : pathname);
    try {
      const body = await readFile(file);
      const headers: Record<string, string> = {
        'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
      };
      if (isolated) {
        headers['cross-origin-opener-policy'] = 'same-origin';
        headers['cross-origin-embedder-policy'] = 'require-corp';
      }
      res.writeHead(200, headers).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as { port: number };
      resolve({ server, url: `http://127.0.0.1:${address.port}/` });
    });
  });
}

const browsers: [string, BrowserType][] = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

for (const [binding, isolated] of [
  ['wasip1', false],
  ['wasip1', true],
  ['wasi', false],
  ['wasi', true],
] as const) {
  const { server, url } = await serve(
    path.join(root, `dist-${binding}`),
    isolated,
  );
  for (const [name, type] of browsers) {
    let browser;
    try {
      browser = await type.launch();
    } catch (error) {
      console.log(
        `${name} ${binding} isolated=${isolated}: cannot launch (${(error as Error).message.split('\n')[0]})`,
      );
      continue;
    }
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url);
    try {
      await page.waitForFunction(
        () => (window as { spikeResult?: unknown }).spikeResult,
        null,
        {
          timeout: 30000,
        },
      );
      const result = await page.evaluate(
        () => (window as { spikeResult?: unknown }).spikeResult,
      );
      console.log(
        `${name} ${binding} isolated=${isolated}:`,
        JSON.stringify(result),
      );
    } catch {
      console.log(
        `${name} ${binding} isolated=${isolated}: no result. Page errors: ${errors.join(' | ')}`,
      );
    }
    await browser.close();
  }
  server.close();
}
