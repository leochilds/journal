import {promises as fsPromises} from 'fs';
import fs from 'fs';
import path from 'path';
import {AddressInfo} from 'net';
import {createServer} from '../src/server';
import {Entry, Day} from '../src/models/journal';

jest.mock('../src/utils/crypto', () => {
  return {
    saveEncrypted: jest.fn(async (_password, payload, dataPath, pubKeyPath) => {
      await fsPromises.writeFile(dataPath, JSON.stringify(payload));
      await fsPromises.writeFile(pubKeyPath, '');
    }),
    loadEncrypted: jest.fn(async (_password, dataPath) => {
      const file = await fsPromises.readFile(dataPath, 'utf8');
      return {payload: JSON.parse(file), privateKey: ''};
    }),
  };
});

const dataFile = path.join(__dirname, '..', 'data.json');
const pubFile = path.join(__dirname, '..', 'data.pub');

describe('journal entries', () => {
  let server: ReturnType<typeof createServer>;
  let port: number;
  const date = '2024-06-01';

  beforeAll(async () => {
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    if (fs.existsSync(pubFile)) fs.unlinkSync(pubFile);
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

  it('adds, retrieves and edits entries', async () => {
    // unlock journal
    await fetch(`http://localhost:${port}/api/unlock`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({password: 'test'}),
    });

    // add multiple entries
    const contents = ['first', 'second', 'third'];
    const added: Entry[] = [];
    for (const content of contents) {
      const res = await fetch(`http://localhost:${port}/api/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Password': 'test',
        },
        body: JSON.stringify({date, content}),
      });
      const json = (await res.json()) as Entry;
      expect(res.status).toBe(201);
      expect(typeof json.id).toBe('string');
      expect(Date.parse(json.timestamp)).not.toBeNaN();
      added.push(json);
    }

    // set summary
    await fetch(`http://localhost:${port}/api/summary/${date}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Password': 'test',
      },
      body: JSON.stringify({summary: 'busy day'}),
    });

    // retrieve entries
    const resDay = await fetch(
      `http://localhost:${port}/api/entries?date=${date}`,
      {headers: {'X-Password': 'test'}},
    );
    const day = (await resDay.json()) as Day;
    expect(resDay.status).toBe(200);
    expect(day.summary).toBe('busy day');
    expect(day.entries).toHaveLength(contents.length);
    expect(day.entries.map((e) => e.id)).toEqual(added.map((e) => e.id));
    const timestamps = day.entries.map((e) => e.timestamp);
    expect([...timestamps].sort()).toEqual(timestamps);

    // edit middle entry
    const target = added[1];
    const resEdit = await fetch(
      `http://localhost:${port}/api/entries/${target.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Password': 'test',
        },
        body: JSON.stringify({content: 'second updated'}),
      },
    );
    const updated = (await resEdit.json()) as Entry;
    expect(resEdit.status).toBe(200);
    expect(updated.content).toBe('second updated');

    const resDay2 = await fetch(
      `http://localhost:${port}/api/entries?date=${date}`,
      {headers: {'X-Password': 'test'}},
    );
    const day2 = (await resDay2.json()) as Day;
    const found = day2.entries.find((e) => e.id === target.id);
    expect(found).toBeDefined();
    expect(found?.content).toBe('second updated');
  });
});

