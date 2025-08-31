import { createServer } from '../src/server';
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';

const dataFile = path.join(__dirname, '..', 'data.json');

describe('unlock API', () => {
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
  });

  it('creates data file and returns title', async () => {
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    const res = await fetch(`http://localhost:${port}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'secret' }),
    });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.title).toBeDefined();
    expect(fs.existsSync(dataFile)).toBe(true);
  });
  it('responds with 400 when password missing', async () => {
    const res = await fetch(`http://localhost:${port}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' }),
    });
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBeDefined();
  });
});
