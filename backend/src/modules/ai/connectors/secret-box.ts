import crypto from 'crypto';
import { env } from '../../../config/env';

/**
 * Cifrado de secretos de conectores (API keys) con AES-256-GCM.
 * Clave: CONNECTORS_SECRET_KEY, o derivada de JWT_SECRET si no se definió.
 * Formato: v1.<iv>.<tag>.<cifrado> en base64url.
 */
const key = () =>
  crypto.createHash('sha256').update(env.CONNECTORS_SECRET_KEY || `${env.JWT_SECRET}:ai-connectors`).digest();

export const encryptSecret = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), enc.toString('base64url')].join('.');
};

export const decryptSecret = (box: string): string => {
  const [v, iv, tag, data] = box.split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new Error('Formato de secreto inválido');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
};
