import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

// Serves the static build, as a static host does.
const root = path.join(
  path.dirname(path.dirname(new URL(import.meta.url).pathname)),
  'dist/client',
);
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

const http = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const candidates = [url.pathname, path.join(url.pathname, 'index.html')];
  for (const candidate of candidates) {
    const file = path.join(root, path.normalize(candidate));
    if (!file.startsWith(root)) {
      break;
    }
    try {
      // oxlint-disable-next-line no-await-in-loop -- The first file that exists wins.
      const body = await readFile(file);
      response.setHeader(
        'content-type',
        TYPES[path.extname(file)] ?? 'application/octet-stream',
      );
      response.end(body);
      return;
    } catch {
      // Not this one.
    }
  }
  response.statusCode = 404;
  response.setHeader('content-type', TYPES['.html']!);
  response.end(
    await readFile(path.join(root, '404.html')).catch(() => 'Not found'),
  );
});

const port = Number(process.env.PORT ?? 4180);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
