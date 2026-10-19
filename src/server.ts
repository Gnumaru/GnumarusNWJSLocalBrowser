'use strict';

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const PORT: number = 1024;
const HOST: string = '127.0.0.1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip'
};

function isLoopbackAddress(addr: string | undefined): boolean {
  if (!addr) return false;
  const a = addr.replace(/^::ffff:/, '');
  return a === '127.0.0.1' || a === '::1' || a === 'localhost';
}

function isLoopbackHost(host: string | undefined): boolean {
  if (!host) return false;
  const h = host.split(':')[0].toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
}

export function safeJoin(root: string, reqPath: string): string | null {
  let decoded: string;
  try { decoded = decodeURIComponent(reqPath.split('?')[0]); }
  catch (e) { return null; }
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.resolve(root, '.' + normalized);
  const rootResolved = path.resolve(root);
  if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return full;
}

function injectToolbar(html: string, rootDir: string): string {
  const inject = `<script>window.__SERVED_DIR__=${JSON.stringify(rootDir)};</script><script src="/__toolbar.js"></script>`;
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, inject + '</body>');
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, inject + '</html>');
  }
  return html + inject;
}

function listDirectory(dirPath: string, urlPath: string, rootDir: string): string {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const items = entries
    .filter(e => !e.name.startsWith('.'))
    .map(e => {
      const slash = e.isDirectory() ? '/' : '';
      const href = path.join(urlPath, e.name).replace(/\\/g, '/') + (e.isDirectory() ? '/' : '');
      return `<li><a href="${encodeURI(href)}">${e.name}${slash}</a></li>`;
    })
    .sort((a, b) => a.localeCompare(b));
  return injectToolbar(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Index of ${urlPath}</title></head>
<body>
<h1>Index of ${urlPath}</h1>
<ul>
${items.join('\n')}
</ul>
</body>
</html>`, rootDir);
}

type ServerCallback = (url: string) => void;
type ErrorCallback = (err: Error) => void;

let currentServer: http.Server | null = null;

export function startServer(rootDir: string, onReady: ServerCallback, onError: ErrorCallback): http.Server {
  const root = path.resolve(rootDir);

  const server = http.createServer((req, res) => {
    const remote = req.socket.remoteAddress;
    if (!isLoopbackAddress(remote)) {
      res.statusCode = 403;
      res.end('Forbidden: non-loopback client');
      return;
    }
    if (!isLoopbackHost(req.headers.host)) {
      res.statusCode = 403;
      res.end('Forbidden: non-loopback host');
      return;
    }

    if (req.url === '/__toolbar.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      try {
        const toolbarPath = path.resolve(__dirname, 'toolbar.js');
        res.end(fs.readFileSync(toolbarPath, 'utf8'));
      } catch (e) {
        res.statusCode = 404;
        res.end('Not Found');
      }
      return;
    }

    let pathname = '/';
    try { pathname = new URL(req.url || '/', 'http://localhost').pathname; }
    catch (e) { pathname = (req.url || '/').split('?')[0]; }
    let filePath = safeJoin(root, pathname || '/');
    if (!filePath) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err: NodeJS.ErrnoException | null, stat: fs.Stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(injectToolbar('<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><title>Not Found</title></head>\n<body>\n<h1>Not Found</h1>\n<p>The requested resource was not found on this server.</p>\n</body>\n</html>', root));
        } else {
          res.statusCode = 500;
          res.end('Server Error');
        }
        return;
      }

      let currentPath = filePath;
      if (stat.isDirectory()) {
        const indexFile = path.join(currentPath, 'index.html');
        if (fs.existsSync(indexFile)) {
          currentPath = indexFile;
        } else {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(listDirectory(currentPath, pathname || '/', root));
          return;
        }
      }

      const ext = path.extname(currentPath).toLowerCase();
      const mime = MIME[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', mime);

      if (ext === '.html' || ext === '.htm') {
        fs.readFile(currentPath, 'utf8', (readErr: NodeJS.ErrnoException | null, content: string) => {
          if (readErr) {
            res.statusCode = 500;
            res.end('Server Error');
            return;
          }
          res.end(injectToolbar(content, root));
        });
      } else {
        const stream = fs.createReadStream(currentPath);
        stream.on('error', () => {
          res.statusCode = 500;
          res.end('Server Error');
        });
        stream.pipe(res);
      }
    });
  });

  server.on('error', (err) => {
    onError(err);
  });

  server.listen(PORT, HOST, () => {
    onReady(`http://${HOST}:${PORT}/`);
  });

  return server;
}

export function restartServer(newDir: string, onReady: ServerCallback, onError: ErrorCallback): void {
  if (currentServer) {
    currentServer.close(() => {
      currentServer = startServer(newDir, onReady, onError);
    });
  } else {
    currentServer = startServer(newDir, onReady, onError);
  }
}

export { PORT, HOST };
