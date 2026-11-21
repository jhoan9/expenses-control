import crypto from 'crypto';
import { query, queryOne, execute } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { hashSecret } from '../integrations/api-tokens.service';

const CODE_TTL_MINUTES = 10;
const MAX_FAILED_PER_PHONE = 5;
const FAILED_WINDOW_MS = 60 * 60 * 1000;

/** Intentos fallidos por número (en memoria): frena a quien prueba códigos al azar. */
const failed = new Map<string, { count: number; since: number }>();

/** "573001112233" → "+57 ••• 2233" (código de país de 1 a 3 dígitos aproximado por longitud) */
export const maskPhone = (phone: string): string => {
  if (phone.length <= 6) return phone;
  const cc = phone.length > 11 ? phone.slice(0, phone.length - 10) : phone.slice(0, 1);
  return `+${cc} ••• ${phone.slice(-4)}`;
};

export interface WhatsappStatus {
  enabled: boolean;
  linked: boolean;
  phone: string | null;
  linked_at: Date | null;
  bot_number: string | null;
}

export class WhatsappLinkService {
  async status(userId: number): Promise<WhatsappStatus> {
    const link = await queryOne<{ phone: string; linked_at: Date }>(
      'SELECT phone, linked_at FROM whatsapp_links WHERE user_id = $1',
      [userId]
    );
    return {
      enabled: env.whatsappEnabled,
      linked: Boolean(link),
      phone: link ? maskPhone(link.phone) : null,
      linked_at: link?.linked_at ?? null,
      bot_number: env.WHATSAPP_BOT_NUMBER || null,
    };
  }

  /** Genera un código de 6 dígitos (reemplaza el anterior). */
  async createCode(userId: number): Promise<{ code: string; expires_at: Date; bot_number: string | null }> {
    let code = '';
    // Evita colisiones con códigos vigentes de otros usuarios
    for (let i = 0; i < 5; i++) {
      code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
      const clash = await queryOne(
        'SELECT 1 FROM whatsapp_link_codes WHERE code_hash = $1 AND user_id != $2 AND expires_at > NOW()',
        [hashSecret(code), userId]
      );
      if (!clash) break;
    }
    // Limpia códigos vencidos (incluido un posible choque con uno ya expirado)
    await execute('DELETE FROM whatsapp_link_codes WHERE expires_at <= NOW()');

    const row = await queryOne<{ expires_at: Date }>(
      `INSERT INTO whatsapp_link_codes (user_id, code_hash, expires_at, attempts)
       VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes', 0)
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, attempts = 0
       RETURNING expires_at`,
      [userId, hashSecret(code)]
    );
    return { code, expires_at: row!.expires_at, bot_number: env.WHATSAPP_BOT_NUMBER || null };
  }

  async unlink(userId: number): Promise<void> {
    await execute('DELETE FROM whatsapp_links WHERE user_id = $1', [userId]);
    await execute('DELETE FROM whatsapp_pending WHERE user_id = $1', [userId]);
  }

  async userForPhone(phone: string): Promise<{ id: number; name: string } | null> {
    return queryOne<{ id: number; name: string }>(
      `SELECT u.id, u.name FROM whatsapp_links w JOIN users u ON u.id = w.user_id
        WHERE w.phone = $1 AND u.deleted_at IS NULL AND u.is_active IS NOT FALSE`,
      [phone]
    );
  }

  /**
   * Vincula el número que envía el código. Devuelve el nombre del usuario
   * o lanza un error con un mensaje apto para responder por WhatsApp.
   */
  async consumeCode(phone: string, code: string): Promise<{ userId: number; name: string }> {
    const now = Date.now();
    const f = failed.get(phone);
    if (f && now - f.since < FAILED_WINDOW_MS && f.count >= MAX_FAILED_PER_PHONE) {
      throw AppError.forbidden('Demasiados intentos. Espera una hora y genera un código nuevo en la web.');
    }

    const row = await queryOne<{ user_id: number; name: string }>(
      `SELECT c.user_id, u.name FROM whatsapp_link_codes c JOIN users u ON u.id = c.user_id
        WHERE c.code_hash = $1 AND c.expires_at > NOW()`,
      [hashSecret(code)]
    );
    if (!row) {
      const entry = f && now - f.since < FAILED_WINDOW_MS ? f : { count: 0, since: now };
      entry.count += 1;
      failed.set(phone, entry);
      throw AppError.badRequest('Ese código no es válido o ya venció. Genera uno nuevo en Controla → Integraciones.');
    }
    failed.delete(phone);

    // Un número pertenece a un solo usuario y cada usuario tiene un solo número
    await execute('DELETE FROM whatsapp_links WHERE phone = $1 OR user_id = $2', [phone, row.user_id]);
    await execute('INSERT INTO whatsapp_links (user_id, phone) VALUES ($1, $2)', [row.user_id, phone]);
    await execute('DELETE FROM whatsapp_link_codes WHERE user_id = $1', [row.user_id]);
    await execute('DELETE FROM whatsapp_pending WHERE phone = $1', [phone]);
    return { userId: row.user_id, name: row.name };
  }

  /** Solo para pruebas */
  _resetFailures(): void {
    failed.clear();
  }

  async linkedCount(): Promise<number> {
    const [r] = await query<{ c: string }>('SELECT COUNT(*) AS c FROM whatsapp_links');
    return Number(r.c);
  }
}

export const whatsappLinkService = new WhatsappLinkService();
