import {promises as fs} from 'fs';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  generateKeyPairSync,
  pbkdf2Sync,
  randomBytes,
  sign,
  verify,
} from 'crypto';

interface EncryptedFile {
  timestamp: string;
  hash: string;
  salt: string;
  iv: string;
  tag: string;
  data: string;
  signature: string;
}

const deriveKey = (password: string, salt: Buffer): Buffer => {
  return pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
};

export const saveEncrypted = async (
  password: string,
  payload: unknown,
  dataPath: string,
  pubKeyPath: string,
): Promise<void> => {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(password, salt);

  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  const privPem = privateKey.export({format: 'pem', type: 'pkcs8'});
  const plaintext = JSON.stringify({payload, privateKey: privPem});

  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const hash = createHash('sha256').update(encrypted).digest('hex');
  const signature = sign(null, encrypted, privateKey);

  const file: EncryptedFile = {
    timestamp: new Date().toISOString(),
    hash,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
    signature: signature.toString('base64'),
  };

  await fs.writeFile(dataPath, JSON.stringify(file, null, 2));
  const pubPem = publicKey.export({format: 'pem', type: 'spki'});
  await fs.writeFile(pubKeyPath, pubPem);
};

export const loadEncrypted = async (
  password: string,
  dataPath: string,
  pubKeyPath: string,
): Promise<{payload: unknown; privateKey: string}> => {
  const [fileStr, pubPem] = await Promise.all([
    fs.readFile(dataPath, 'utf8'),
    fs.readFile(pubKeyPath, 'utf8'),
  ]);
  const file: EncryptedFile = JSON.parse(fileStr);
  const encrypted = Buffer.from(file.data, 'base64');
  const signature = Buffer.from(file.signature, 'base64');
  const publicKey = createPublicKey(pubPem);

  if (!verify(null, encrypted, publicKey, signature)) {
    throw new Error('Signature verification failed');
  }

  const hash = createHash('sha256').update(encrypted).digest('hex');
  if (hash !== file.hash) {
    throw new Error('Hash mismatch');
  }

  const salt = Buffer.from(file.salt, 'base64');
  const key = deriveKey(password, salt);
  const iv = Buffer.from(file.iv, 'base64');
  const tag = Buffer.from(file.tag, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as {
    payload: unknown;
    privateKey: string;
  };
};

