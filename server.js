import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/analyse' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const mock = { method: req.method, body };
        const mockRes = {
          _status: 200,
          _body: null,
          status(code) { this._status = code; return this; },
          json(data) { this._body = JSON.stringify(data); return this; },
        };

        const { default: handler } = await import('./api/analyse.js');
        mock.body = JSON.parse(body);
        await handler(mock, mockRes);

        res.writeHead(mockRes._status, { 'Content-Type': 'application/json' });
        res.end(mockRes._body);
      } catch (err) {
        console.error(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, 'public', 'index.html');
  }

  try {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`River Map running at http://localhost:${PORT}`);
});
