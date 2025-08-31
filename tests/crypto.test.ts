import {promises as fs, mkdtempSync, rmSync} from 'fs';
import os from 'os';
import path from 'path';
import {loadEncrypted, saveEncrypted} from '../src/utils/crypto';
import {Journal} from '../src/models/journal';

describe('encryption flow', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'journal-'));
  const dataPath = path.join(dir, 'data.json');
  const pubPath = path.join(dir, 'data.pub');
  const password = 'supersecret';
  const payload: Journal = {
    title: 'Test',
    days: {
      '2024-01-01': {
        summary: 'New Year',
        entries: [
          {
            id: '1',
            timestamp: '2024-01-01T00:00:00.000Z',
            content: 'Hello',
          },
        ],
      },
    },
  };

  afterAll(() => rmSync(dir, {recursive: true, force: true}));

  it('encrypts and decrypts data', async () => {
    await saveEncrypted(password, payload, dataPath, pubPath);
    const result = await loadEncrypted(password, dataPath, pubPath);
    expect(result.payload).toEqual(payload);
    expect(typeof result.privateKey).toBe('string');
  });

  it('detects tampering', async () => {
    await saveEncrypted(password, payload, dataPath, pubPath);
    const obj = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    const buf = Buffer.from(obj.data, 'base64');
    buf[0] ^= 0xff; // corrupt
    obj.data = buf.toString('base64');
    await fs.writeFile(dataPath, JSON.stringify(obj));
    await expect(loadEncrypted(password, dataPath, pubPath)).rejects.toThrow();
  });
});

