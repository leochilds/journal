import {createServer} from '../src/server';
import fs from 'fs';
import path from 'path';
import {AddressInfo} from 'net';

const dataFile = path.join(__dirname, '..', 'data.json');
const pubFile = path.join(__dirname, '..', 'data.pub');

describe('server APIs', () => {
  let server: ReturnType<typeof createServer>;
  let port: number;

  beforeAll(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = (server.address() as AddressInfo).port;
        resolve(null);
      });
    });
  });

  afterAll(() => {
    server.close();
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    if (fs.existsSync(pubFile)) fs.unlinkSync(pubFile);
  });

  describe('unlock API', () => {
    it('creates encrypted data file and returns payload', async () => {
      if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
      if (fs.existsSync(pubFile)) fs.unlinkSync(pubFile);
      const res = await fetch(`http://localhost:${port}/api/unlock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: 'secret'}),
      });
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.payload.title).toBe('Journal');
      expect(json.payload.days).toEqual({});
      expect(typeof json.privateKey).toBe('string');
      expect(fs.existsSync(dataFile)).toBe(true);
      expect(fs.existsSync(pubFile)).toBe(true);
    });

    it('responds with 400 when password missing', async () => {
      const res = await fetch(`http://localhost:${port}/api/unlock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: ''}),
      });
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error).toBeDefined();
    });
  });

  describe('entries API', () => {
    const date = '2024-01-02';
    let entryId: string;
    let entryTimestamp: string;

    beforeAll(async () => {
      await fetch(`http://localhost:${port}/api/unlock`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({password: 'secret'}),
      });
    });

    it('appends an entry', async () => {
      const res = await fetch(`http://localhost:${port}/api/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Password': 'secret',
        },
        body: JSON.stringify({date, content: 'hello'}),
      });
      const json = (await res.json()) as {
        id: string;
        content: string;
        timestamp: string;
      };
      expect(res.status).toBe(201);
      expect(json.content).toBe('hello');
      expect(typeof json.id).toBe('string');
      expect(Date.parse(json.timestamp)).not.toBeNaN();
      entryId = json.id;
      entryTimestamp = json.timestamp;
    });

    it('retrieves entries for the day', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/entries?date=${date}`,
        {headers: {'X-Password': 'secret'}},
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.entries).toHaveLength(1);
      expect(json.entries[0].id).toBe(entryId);
      expect(Date.parse(json.entries[0].timestamp)).not.toBeNaN();
      expect(json.summary).toBe('');
    });

    it('updates an entry', async () => {
      const newTimestamp = new Date().toISOString();
      const res = await fetch(
        `http://localhost:${port}/api/entries/${entryId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Password': 'secret',
          },
          body: JSON.stringify({content: 'updated', timestamp: newTimestamp}),
        },
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.id).toBe(entryId);
      expect(json.content).toBe('updated');
      expect(json.timestamp).toBe(newTimestamp);
      entryTimestamp = json.timestamp;
    });

    it('updates summary', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/summary/${date}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Password': 'secret',
          },
          body: JSON.stringify({summary: 'great day'}),
        },
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.summary).toBe('great day');
    });

    it('reflects updates when fetching day', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/entries?date=${date}`,
        {headers: {'X-Password': 'secret'}},
      );
      const json = await res.json();
      expect(json.summary).toBe('great day');
      expect(json.entries[0].content).toBe('updated');
      expect(json.entries[0].timestamp).toBe(entryTimestamp);
    });
    it('rejects requests without password', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/entries?date=${date}`,
      );
      expect(res.status).toBe(403);
    });
  });
});

