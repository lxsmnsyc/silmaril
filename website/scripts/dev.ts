import { createServer as createHTTPServer } from 'node:http';
import { Readable } from 'node:stream';
import { toNodeHeaders } from 'brumate/server';
import { errorPage } from 'brumate/vite';
import { createServer } from 'vite';

// Renders the pages with Vite in development. Vite also serves the client modules.
const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
});

const http = createHTTPServer((request, response) => {
  vite.middlewares(request, response, async () => {
    try {
      const { handle } = await vite.ssrLoadModule('virtual:brumate/routes');
      const answer: Response | undefined = await handle(
        new Request(`http://localhost${request.url}`),
        {
          scripts:
            '<script type="module" src="/@vite/client"></script><script type="module" async src="/src/client.ts"></script>',
        },
      );
      if (!answer) {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      response.writeHead(answer.status, toNodeHeaders(answer.headers));
      Readable.fromWeb(answer.body as never).pipe(response);
    } catch (error) {
      // Vite's error overlay shows the error, and the page loads again after a fix.
      response.statusCode = 500;
      response.setHeader('content-type', 'text/html');
      response.end(errorPage(error, vite));
    }
  });
});

const port = Number(process.env.PORT ?? 5180);
http.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
