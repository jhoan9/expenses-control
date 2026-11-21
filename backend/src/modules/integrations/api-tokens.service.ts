import crypto from 'crypto';
import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

/**
 * Tokens personales para automatizaciones (Atajos de iPhone, apps de Android).
 * Formato: "ctl_" + 32 bytes aleatorios en base64url. Se guarda solo el SHA-256;
 * el token completo se devuelve una única vez, al crearlo.
 */
export const TOKEN_PREFIX = 'ctl_';
const MAX_TOKENS_PER_USER = 10;

export const hashSecret = (value: string): string =>
  crypto.createHash('sha256').update(value).digest('hex');

export interface ApiTokenRow {
  id: number;
  name: string;
  token_prefix: string;
  last_used_at: Date | null;
  created_at: Date;
}

export class ApiTokensService {
  async list(userId: number): Promise<ApiTokenRow[]> {
    return query<ApiTokenRow>(
      `SELECT id, name, token_prefix, last_used_at, created_at FROM api_tokens
        WHERE user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
      [userId]
    );
  }

  async create(userId: number, name: string): Promise<ApiTokenRow & { token: string }> {
    const cleanName = (name ?? '').trim().slice(0, 80) || 'Automatización';
    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM api_tokens WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    if (Number(count) >= MAX_TOKENS_PER_USER) {
      throw AppError.badRequest(`Puedes tener hasta ${MAX_TOKENS_PER_USER} tokens activos. Revoca uno que no uses.`);
    }

    const token = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
    const prefix = token.slice(0, 12);
    const row = await queryOne<ApiTokenRow>(
      `INSERT INTO api_tokens (user_id, name, token_hash, token_prefix) VALUES ($1, $2, $3, $4)
       RETURNING id, name, token_prefix, last_used_at, created_at`,
      [userId, cleanName, hashSecret(token), prefix]
    );
    return { ...row!, token };
  }

  async revoke(userId: number, id: number): Promise<void> {
    const res = await execute(
      'UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
      [id, userId]
    );
    if (!res.rowCount) throw AppError.notFound('Token no encontrado');
  }

  /** Devuelve el usuario dueño de un token válido, o null. */
  async verify(token: string): Promise<{ userId: number; role: string } | null> {
    if (!token.startsWith(TOKEN_PREFIX) || token.length > 100) return null;
    const row = await queryOne<{ id: number; user_id: number; role: string }>(
      `SELECT t.id, t.user_id, u.role FROM api_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = $1 AND t.revoked_at IS NULL AND u.deleted_at IS NULL AND u.is_active IS NOT FALSE`,
      [hashSecret(token)]
    );
    if (!row) return null;
    // No bloquea la respuesta si falla la actualización del último uso
    execute('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [row.id]).catch(() => undefined);
    return { userId: row.user_id, role: row.role };
  }
}

export const apiTokensService = new ApiTokensService();
