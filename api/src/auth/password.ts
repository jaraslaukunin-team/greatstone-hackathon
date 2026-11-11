import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 32;

const derive = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, (err, key) => (err ? reject(err) : resolve(key)));
  });

/** scrypt с солью; хранится как `соль:хеш` в hex. Пароль нигде не сохраняется и не логируется. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await derive(password, Buffer.from(saltHex, 'hex'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
