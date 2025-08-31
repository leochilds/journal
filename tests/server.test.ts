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
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({date, content: 'hello'}),
      });
      const json = (await res.json()) as {id: string; content: string};
      expect(res.status).toBe(201);
      expect(json.content).toBe('hello');
      entryId = json.id;
    });

    it('retrieves entries for the day', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/entries?date=${date}`,
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.entries).toHaveLength(1);
      expect(json.summary).toBe('');
    });

    it('updates an entry', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/entries/${entryId}`,
        {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({content: 'updated'}),
        },
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.content).toBe('updated');
    });

    it('updates summary', async () => {
      const res = await fetch(
        `http://localhost:${port}/api/summary/${date}`,
        {
          method: 'PUT',
          headers: {'Content-Type': 'application/json'},
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
      );
      const json = await res.json();
      expect(json.summary).toBe('great day');
      expect(json.entries[0].content).toBe('updated');
    });
  });
});

