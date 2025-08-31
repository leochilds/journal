import http from 'http';
import fs from 'fs';
import path from 'path';
import {loadEncrypted, saveEncrypted} from './utils/crypto';

const publicDir = path.join(__dirname, '..', 'public');
const dataPath = path.join(__dirname, '..', 'data.json');
const pubKeyPath = path.join(__dirname, '..', 'data.pub');

const ensureDataFile = async (password: string): Promise<void> => {
  if (!fs.existsSync(dataPath) || !fs.existsSync(pubKeyPath)) {
    await saveEncrypted(password, {title: 'Journal'}, dataPath, pubKeyPath);
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
  req.on('end', async () => {
    try {
      const {password} = JSON.parse(body);
      if (!password || password.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({error: 'Password required'}));
        return;
      }
      await ensureDataFile(password);
      const content = await loadEncrypted(password, dataPath, pubKeyPath);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(content));
    } catch {
      res.statusCode = 500;
      res.end(JSON.stringify({error: 'Server error'}));
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
