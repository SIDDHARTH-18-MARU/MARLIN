import http from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.xml': 'application/xml',
  '.md': 'text/plain; charset=utf-8', '.ktx2': 'image/ktx2',
};

// Local verification only: no SPA rewrite, proxy or dev server.
export async function startStaticServer(directory, mount = '/') {
  const root = await realpath(directory);
  if (!/^\/(?:[\w-]+\/)*$/.test(mount)) throw new Error('Invalid mount');
  const hits = new Map();
  const server = http.createServer(async (request, response) => {
    const fail = code => response.writeHead(code).end();
    if (!['GET', 'HEAD'].includes(request.method)) return fail(405);
    try {
      const url = new URL(request.url, 'http://localhost');
      if (!url.pathname.startsWith(mount)) return fail(404);
      const name = decodeURIComponent(url.pathname.slice(mount.length)) || 'index.html';
      const file = await realpath(resolve(root, name));
      const location = relative(root, file);
      if (location.startsWith('..') || isAbsolute(location)) return fail(404);
      const info = await stat(file);
      if (!info.isFile()) return fail(404);
      const etag = '"' + info.size.toString(16) + '-' + Math.trunc(info.mtimeMs).toString(16) + '"';
      const cache = name === 'index.html' ? 'no-cache'
        : /^assets\/[^/]+-[\w-]{8}\.(js|css)$/.test(name) ? 'public, max-age=31536000, immutable'
        : 'public, max-age=0, must-revalidate';
      hits.set(url.pathname, (hits.get(url.pathname) ?? 0) + 1);
      response.setHeader('ETag', etag);
      response.setHeader('Cache-Control', cache);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      if (request.headers['if-none-match'] === etag) return fail(304);
      response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(file);
      response.once('close', () => stream.destroy());
      stream.on('error', () => response.destroy());
      stream.pipe(response);
    } catch {
      if (response.headersSent) response.destroy();
      else fail(404);
    }
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  const origin = 'http://127.0.0.1:' + server.address().port;
  return { origin, base: origin + mount, hits, close: () => new Promise(ok => server.close(ok)) };
}
