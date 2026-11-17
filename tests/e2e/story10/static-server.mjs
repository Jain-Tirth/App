/**
 * Tiny static server for a BUILT UserWeb (story 10 PWA specs). Serves a dist folder with an SPA fallback.
 * Test controls (plain HTTP, localhost only):
 *   POST /__test/second-build   sw.js is served with a different build id (simulates a second deploy)
 *   POST /__test/down           every non-control request has its socket destroyed (network failure)
 *   POST /__test/reset          back to the first build, server up, request log cleared
 *   GET  /__test/log            JSON list of the request paths seen since the last reset
 * Usage: node tests/e2e/story10/static-server.mjs <distDir> <port>
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [dist, portArg] = process.argv.slice(2);
const root = path.resolve(dist);
const port = Number(portArg);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

let secondBuild = false;
let down = false;
let log = [];

async function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/^\/+/, '');
  const full = path.resolve(root, clean);
  if (!full.startsWith(root)) return null;
  try {
    const s = await stat(full);
    if (s.isFile()) return full;
  } catch {
    /* not a file */
  }
  return null;
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  if (url.pathname.startsWith('/__test/')) {
    const cmd = url.pathname.slice('/__test/'.length);
    if (cmd === 'second-build') secondBuild = true;
    else if (cmd === 'down') down = true;
    else if (cmd === 'reset') { secondBuild = false; down = false; log = []; }
    else if (cmd === 'log') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(log)); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ secondBuild, down }));
    return;
  }
  log.push(url.pathname);
  if (down) { req.socket.destroy(); return; }

  let file = await fileFor(url.pathname === '/' ? 'index.html' : url.pathname);
  let spa = false;
  if (!file) {
    if (path.extname(url.pathname)) { res.writeHead(404); res.end('not found'); return; }
    file = path.join(root, 'index.html');
    spa = true;
  }
  let body = await readFile(file);
  const ext = path.extname(file);
  if (url.pathname === '/sw.js' && secondBuild) {
    body = Buffer.from(body.toString('utf8').replace(/(\}|dhobi-shell-)[0-9a-f]{12}/, '$1ffffffffffff') + '\n/* second build */');
  }
  res.writeHead(200, {
    'content-type': TYPES[ext] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
    ...(spa ? {} : {}),
  });
  res.end(body);
}).listen(port, '127.0.0.1', () => console.log(`[static-server] ${root} on http://127.0.0.1:${port}`));
