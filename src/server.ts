import http from 'http';
import fs from 'fs';
import path from 'path';

const publicDir = path.join(__dirname, '..', 'public');
const dataPath = path.join(__dirname, '..', 'data.json');

const ensureDataFile = (): void => {
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify({ title: 'Journal' }, null, 2));
  }
};

const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
  if (req.method !== 'GET' || !req.url) return false;
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, path.normalize(urlPath));
  if (!filePath.startsWith(publicDir)) {
    return false;
  }
  let contentType = 'text/plain';
  if (filePath.endsWith('.html')) contentType = 'text/html';
  else if (filePath.endsWith('.js')) contentType = 'application/javascript';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
  return true;
};

const handleUnlock = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    try {
      const { password } = JSON.parse(body);
      if (!password || password.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Password required' }));
        return;
      }
      ensureDataFile();
      const content = fs.readFileSync(dataPath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.end(content);
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Server error' }));
    }
  });
};

export const createServer = (): http.Server => {
  return http.createServer((req, res) => {
    if (req.url === '/api/unlock' && req.method === 'POST') {
      handleUnlock(req, res);
      return;
    }
    if (serveStatic(req, res)) return;
    res.statusCode = 404;
    res.end('Not found');
  });
};

export const startServer = (port = 3000): http.Server => {
  const server = createServer();
  return server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
};

if (require.main === module) {
  startServer();
}
