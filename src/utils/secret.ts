import crypto from 'crypto';
import { env } from '../config/env';

const ALGO = 'aes-256-gcm';

const key = () => crypto.createHash('sha256').update(env.JWT_SECRET).digest();

/** Encrypt a short secret (e.g. SMTP app password) for storage. */
export const encryptSecret = (plain: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
};

export const decryptSecret = (payload: string) => {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted secret');
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
};
