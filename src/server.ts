import http from 'http';
import fs from 'fs';
import path from 'path';
import {randomUUID} from 'crypto';
import {loadEncrypted, saveEncrypted} from './utils/crypto';
import logger from './utils/logger';
import {Journal, Day, Entry} from './models/journal';

const publicDir = path.join(__dirname, '..', 'public');
const dataPath = path.join(__dirname, '..', 'data.json');
const pubKeyPath = path.join(__dirname, '..', 'data.pub');

let writeLock: Promise<void> = Promise.resolve();

class NotFoundError extends Error {}

const getPassword = (req: http.IncomingMessage): string | null => {
  const pwd = req.headers['x-password'];
  if (typeof pwd !== 'string' || pwd.length === 0) return null;
  return pwd;
};

const readJournal = async (password: string): Promise<Journal> => {
  await writeLock;
  const {payload} = (await loadEncrypted(
    password,
    dataPath,
    pubKeyPath,
  )) as {payload: Journal};
  return payload as Journal;
};

const updateJournal = async <T>(
  password: string,
  fn: (journal: Journal) => T | Promise<T>,
): Promise<T> => {
  let result: T;
  writeLock = writeLock.then(async () => {
    const {payload} = (await loadEncrypted(
      password,
      dataPath,
      pubKeyPath,
    )) as {payload: Journal};
    const journal = payload as Journal;
    result = await fn(journal);
    await saveEncrypted(password, journal, dataPath, pubKeyPath);
  });
  await writeLock;
  return result!;
};

const parseJson = (req: http.IncomingMessage): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
};

const ensureDataFile = async (password: string): Promise<void> => {
  if (!fs.existsSync(dataPath) || !fs.existsSync(pubKeyPath)) {
    logger.info('Initialising encrypted journal');
    const payload: Journal = {title: 'Journal', days: {}};
    await saveEncrypted(password, payload, dataPath, pubKeyPath);
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
      const content = (await loadEncrypted(
        password,
        dataPath,
        pubKeyPath,
      )) as {payload: Journal; privateKey: string};
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(content));
    } catch (err) {
      logger.error(`Unlock failed: ${(err as Error).message}`);
      res.statusCode = 500;
      res.end(JSON.stringify({error: 'Server error'}));
    }
  });
};

const handleEntriesGet = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> => {
  const password = getPassword(req);
  if (!password || !req.url) {
    res.statusCode = 403;
    res.end(JSON.stringify({error: 'Locked'}));
    return;
  }
  const url = new URL(req.url, 'http://localhost');
  const date = url.searchParams.get('date');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.statusCode = 400;
    res.end(JSON.stringify({error: 'Invalid date'}));
    return;
  }
  try {
    const journal = await readJournal(password);
    const day: Day = journal.days[date] || {summary: '', entries: []};
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(day));
  } catch (err) {
    logger.error(`Entries get failed: ${(err as Error).message}`);
    res.statusCode = 500;
    res.end(JSON.stringify({error: 'Server error'}));
  }
};

const handleEntriesPost = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> => {
  const password = getPassword(req);
  if (!password) {
    res.statusCode = 403;
    res.end(JSON.stringify({error: 'Locked'}));
    return;
  }
  try {
    const {date, content} = (await parseJson(req)) as {
      date?: string;
      content?: string;
    };
    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !content ||
      content.length === 0
    ) {
      res.statusCode = 400;
      res.end(JSON.stringify({error: 'Invalid input'}));
      return;
    }
    const entry = await updateJournal(password, (journal) => {
      if (!journal.days[date]) journal.days[date] = {summary: '', entries: []};
      const newEntry: Entry = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        content,
      };
      journal.days[date].entries.push(newEntry);
      return newEntry;
    });
    res.statusCode = 201;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(entry));
  } catch (err) {
    logger.error(`Entries post failed: ${(err as Error).message}`);
    res.statusCode = 500;
    res.end(JSON.stringify({error: 'Server error'}));
  }
};

const handleEntryPut = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  id: string,
): Promise<void> => {
  const password = getPassword(req);
  if (!password) {
    res.statusCode = 403;
    res.end(JSON.stringify({error: 'Locked'}));
    return;
  }
  try {
    const {content, timestamp} = (await parseJson(req)) as {
      content?: string;
      timestamp?: string;
    };
    if (!content || content.length === 0) {
      res.statusCode = 400;
      res.end(JSON.stringify({error: 'Invalid input'}));
      return;
    }
    if (timestamp && Number.isNaN(Date.parse(timestamp))) {
      res.statusCode = 400;
      res.end(JSON.stringify({error: 'Invalid timestamp'}));
      return;
    }
    const found = await updateJournal(password, (journal) => {
      let match: Entry | null = null;
      Object.values(journal.days).forEach((day) => {
        day.entries.forEach((entry) => {
          if (entry.id === id) {
            entry.content = content;
            if (timestamp) entry.timestamp = timestamp;
            match = entry;
          }
        });
      });
      if (!match) throw new NotFoundError();
      return match;
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(found));
  } catch (err) {
    if (err instanceof NotFoundError) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({error: 'Entry not found'}));
      return;
    }
    logger.error(`Entry update failed: ${(err as Error).message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({error: 'Server error'}));
  }
};

const handleSummaryPut = async (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  date: string,
): Promise<void> => {
  const password = getPassword(req);
  if (!password) {
    res.statusCode = 403;
    res.end(JSON.stringify({error: 'Locked'}));
    return;
  }
  try {
    const {summary} = (await parseJson(req)) as {summary?: string};
    if (!summary) {
      res.statusCode = 400;
      res.end(JSON.stringify({error: 'Invalid input'}));
      return;
    }
    const day = await updateJournal(password, (journal) => {
      if (!journal.days[date]) journal.days[date] = {summary: '', entries: []};
      journal.days[date].summary = summary;
      return journal.days[date];
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(day));
  } catch (err) {
    logger.error(`Summary update failed: ${(err as Error).message}`);
    res.statusCode = 500;
    res.end(JSON.stringify({error: 'Server error'}));
  }
};

export const createServer = (): http.Server => {
  return http.createServer(async (req, res) => {
    logger.debug(`${req.method} ${req.url}`);
    if (req.url === '/api/unlock' && req.method === 'POST') {
      handleUnlock(req, res);
      return;
    }
    if (req.url?.startsWith('/api/entries') && req.method === 'GET') {
      await handleEntriesGet(req, res);
      return;
    }
    if (req.url === '/api/entries' && req.method === 'POST') {
      await handleEntriesPost(req, res);
      return;
    }
    const entryMatch = req.url?.match(/^\/api\/entries\/([^/?]+)$/);
    if (entryMatch && req.method === 'PUT') {
      await handleEntryPut(req, res, entryMatch[1]);
      return;
    }
    const summaryMatch = req.url?.match(/^\/api\/summary\/(\d{4}-\d{2}-\d{2})$/);
    if (summaryMatch && req.method === 'PUT') {
      await handleSummaryPut(req, res, summaryMatch[1]);
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
