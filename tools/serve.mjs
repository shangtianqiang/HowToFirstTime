import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { root } from './lib.mjs';

const base = root.endsWith(sep) ? root.slice(0, -1) : root;
const port = Number(process.env.PORT) || 8000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    let relativePath = pathname.replace(/^\/+/, '');
    if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html';

    const file = normalize(join(base, relativePath));
    if (file !== base && !file.startsWith(base + sep)) {
      response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('403');
      return;
    }

    const data = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('404');
  }
}).listen(port, () => {
  console.log(`静态服务已启动：http://localhost:${port}/`);
});
