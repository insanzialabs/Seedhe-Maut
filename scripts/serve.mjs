import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { watch, createReadStream } from 'node:fs';
import { build, output, root } from './build.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const port = Number(option('--port', process.env.PORT || '4173'));
const host = option('--host', process.env.HOST || '127.0.0.1');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
await build();

const server = http.createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const url = new URL(request.url, 'http://localhost');
    let relative;
    try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, ''); }
    catch { response.writeHead(400); response.end('Invalid URL'); return; }
    let filename = path.resolve(output, relative || 'index.html');
    if (!filename.startsWith(`${output}${path.sep}`)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    let status = 200;
    try {
      if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
      await stat(filename);
    } catch { filename = path.join(output, '404.html'); status = 404; }
    if (path.extname(filename) === '.mp3' && status === 200) {
      const { size } = await stat(filename);
      let start = 0, end = size - 1;
      if (request.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (match && (match[1] || match[2])) {
          if (!match[1]) start = Math.max(0, size - Number(match[2]));
          else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
        }
        if (!match || !(match[1] || match[2]) || start > end || start >= size || (!match[1] && Number(match[2]) === 0)) {
          response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return;
        }
        status = 206;
      }
      response.writeHead(status, {
        'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
        'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache',
      });
      if (request.method === 'HEAD') { response.end(); return; }
      const stream = createReadStream(filename, { start, end });
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response); return;
    }
    const data = await readFile(filename);
    response.writeHead(status, {
      'Content-Type': types[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': data.length, 'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    console.error(error);
    response.writeHead(500); response.end('Unable to load this page.');
  }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, host, () => console.log(`Seedhe Maut → http://${host}:${port}`));

const watchers = [];
if (args.includes('--dev')) {
  let timer;
  let pending = Promise.resolve();
  for (const directory of ['src', 'public']) {
    watchers.push(watch(path.join(root, directory), { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        pending = pending.then(() => build()).catch(console.error);
      }, 150);
    }));
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  watchers.forEach(watcher => watcher.close()); server.close(() => process.exit(0));
});
