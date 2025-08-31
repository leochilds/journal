import http from 'http';
import fs from 'fs';
import path from 'path';
import {loadEncrypted, saveEncrypted} from './utils/crypto';
import logger from './utils/logger';

const publicDir = path.join(__dirname, '..', 'public');
const dataPath = path.join(__dirname, '..', 'data.json');
const pubKeyPath = path.join(__dirname, '..', 'data.pub');

const ensureDataFile = async (password: string): Promise<void> => {
  if (!fs.existsSync(dataPath) || !fs.existsSync(pubKeyPath)) {
    logger.info('Initialising encrypted journal');
    await saveEncrypted(password, {title: 'Journal'}, dataPath, pubKeyPath);
  } else {
    logger.debug('Encrypted journal already exists');
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
      logger.warn(`Static file not found: ${filePath}`);
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    logger.debug(`Serving static file: ${filePath}`);
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
        logger.warn('Unlock attempted without password');
        res.statusCode = 400;
        res.end(JSON.stringify({error: 'Password required'}));
        return;
      }
      logger.info('Unlocking journal');
      await ensureDataFile(password);
      const content = await loadEncrypted(password, dataPath, pubKeyPath);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(content));
    } catch (err) {
      logger.error(`Unlock failed: ${(err as Error).message}`);
      res.statusCode = 500;
      res.end(JSON.stringify({error: 'Server error'}));
    }
  });
};

export const createServer = (): http.Server => {
  return http.createServer((req, res) => {
    logger.debug(`${req.method} ${req.url}`);
    if (req.url === '/api/unlock' && req.method === 'POST') {
      handleUnlock(req, res);
      return;
    }
    if (serveStatic(req, res)) return;
    logger.warn(`Route not found: ${req.method} ${req.url}`);
    res.statusCode = 404;
    res.end('Not found');
  });
};

export const startServer = (port = 3000): http.Server => {
  const server = createServer();
  return server.listen(port, () => {
    logger.info(`Server running on http://localhost:${port}`);
  });
};

if (require.main === module) {
  startServer();
}
