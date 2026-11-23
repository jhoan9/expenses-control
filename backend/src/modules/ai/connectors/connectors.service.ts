import { query, queryOne, execute } from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';
import { decryptSecret, encryptSecret } from './secret-box';
import { assertPublicHost, validateBaseUrl } from './url-guard';

export interface ConnectorRow {
  id: number;
  name: string;
  description: string | null;
  base_url: string;
  auth_type: 'none' | 'header' | 'query';
  auth_name: string | null;
  has_secret: boolean;
  enabled: boolean;
  last_used_at: Date | null;
  created_at: Date;
}

export interface ConnectorInput {
  name: string;
  description?: string;
  base_url: string;
  auth_type?: 'none' | 'header' | 'query';
  auth_name?: string;
}

const MAX_CONNECTORS = 20;
const MAX_BYTES = 200_000;
const MAX_TEXT_FOR_MODEL = 12_000;
const TIMEOUT_MS = 10_000;
/** Encabezados que no se pueden usar para la clave (los controla el servidor). */
const FORBIDDEN_HEADERS = ['host', 'cookie', 'content-length', 'connection', 'transfer-encoding', 'x-forwarded-for'];

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export const connectorHttp: { fetch: Fetcher } = { fetch: (url, init) => fetch(url, init) };

const SELECT = `SELECT id, name, description, base_url, auth_type, auth_name,
                       (secret_encrypted IS NOT NULL) AS has_secret, enabled, last_used_at, created_at
                  FROM ai_connectors`;

export class ConnectorsService {
  /** Normaliza y valida los datos de un conector (no toca la base de datos). */
  normalize(input: ConnectorInput): Required<Omit<ConnectorInput, 'description'>> & { description: string | null } {
    const name = String(input.name ?? '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    if (name.length < 2) throw AppError.badRequest('El nombre del conector debe tener al menos 2 caracteres (letras, números, - o _).');
    const url = validateBaseUrl(input.base_url);
    const authType = input.auth_type === 'header' || input.auth_type === 'query' ? input.auth_type : 'none';
    let authName = String(input.auth_name ?? '').trim();
    if (authType !== 'none') {
      if (!/^[A-Za-z0-9_-]{1,60}$/.test(authName)) throw AppError.badRequest('Indica el nombre del encabezado o parámetro de la clave (p. ej. X-Api-Key o apikey).');
      if (authType === 'header' && FORBIDDEN_HEADERS.includes(authName.toLowerCase())) throw AppError.badRequest(`El encabezado "${authName}" no está permitido.`);
    } else {
      authName = '';
    }
    return {
      name,
      description: input.description ? String(input.description).trim().slice(0, 500) : null,
      base_url: url.toString().replace(/\/$/, ''),
      auth_type: authType,
      auth_name: authName,
    };
  }

  async list(userId: number): Promise<ConnectorRow[]> {
    return query<ConnectorRow>(`${SELECT} WHERE user_id = $1 ORDER BY name`, [userId]);
  }

  async get(userId: number, nameOrId: string | number): Promise<ConnectorRow & { secret_encrypted?: string | null }> {
    const row = await queryOne<ConnectorRow & { secret_encrypted: string | null }>(
      `SELECT id, name, description, base_url, auth_type, auth_name, secret_encrypted,
              (secret_encrypted IS NOT NULL) AS has_secret, enabled, last_used_at, created_at
         FROM ai_connectors WHERE user_id = $1 AND (name = $2 OR id::text = $2)`,
      [userId, String(nameOrId).trim().toLowerCase()]
    );
    if (!row) throw AppError.notFound(`No existe un conector "${nameOrId}".`);
    return row;
  }

  async create(userId: number, input: ConnectorInput, secret?: string): Promise<ConnectorRow> {
    const data = this.normalize(input);
    await assertPublicHost(new URL(data.base_url).hostname);
    const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) AS count FROM ai_connectors WHERE user_id = $1', [userId]);
    if (Number(count) >= MAX_CONNECTORS) throw AppError.badRequest(`Máximo ${MAX_CONNECTORS} conectores.`);
    const exists = await queryOne('SELECT 1 FROM ai_connectors WHERE user_id = $1 AND name = $2', [userId, data.name]);
    if (exists) throw AppError.conflict(`Ya existe un conector llamado "${data.name}".`);
    const row = await queryOne<{ id: number }>(
      `INSERT INTO ai_connectors (user_id, name, description, base_url, auth_type, auth_name, secret_encrypted)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, data.name, data.description, data.base_url, data.auth_type, data.auth_name || null, secret ? encryptSecret(secret) : null]
    );
    return this.get(userId, row!.id);
  }

  async setSecret(userId: number, id: number, secret: string | null): Promise<void> {
    const value = secret ? String(secret).trim() : '';
    if (value.length > 500) throw AppError.badRequest('La clave es demasiado larga.');
    const res = await execute('UPDATE ai_connectors SET secret_encrypted = $3 WHERE id = $1 AND user_id = $2', [
      id, userId, value ? encryptSecret(value) : null,
    ]);
    if (!res.rowCount) throw AppError.notFound('Conector no encontrado');
  }

  async setEnabled(userId: number, id: number, enabled: boolean): Promise<void> {
    const res = await execute('UPDATE ai_connectors SET enabled = $3 WHERE id = $1 AND user_id = $2', [id, userId, Boolean(enabled)]);
    if (!res.rowCount) throw AppError.notFound('Conector no encontrado');
  }

  async remove(userId: number, id: number): Promise<void> {
    const res = await execute('DELETE FROM ai_connectors WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!res.rowCount) throw AppError.notFound('Conector no encontrado');
  }

  /** Construye la URL final y comprueba que no se salga del host del conector. */
  buildUrl(baseUrl: string, path: string | undefined, params: Record<string, unknown> | undefined): URL {
    const p = String(path ?? '').trim();
    if (p && !p.startsWith('/')) throw AppError.badRequest('La ruta debe empezar por "/".');
    if (/(^|\/)\.\.(\/|$)|\/\/|\\|[\s#@]/.test(p)) throw AppError.badRequest('La ruta contiene caracteres no permitidos.');
    const base = new URL(baseUrl);
    const url = new URL(base.toString().replace(/\/$/, '') + p);
    if (url.host !== base.host || url.protocol !== 'https:') throw AppError.badRequest('La ruta no puede cambiar de dominio.');
    const entries = Object.entries(params ?? {});
    if (entries.length > 15) throw AppError.badRequest('Demasiados parámetros (máximo 15).');
    for (const [k, v] of entries) {
      if (!/^[A-Za-z0-9_.\-[\]]{1,50}$/.test(k)) throw AppError.badRequest(`Parámetro inválido: ${k}`);
      const value = String(v ?? '');
      // Valores largos no hacen falta para consultar datos y facilitarían filtrar información
      if (value.length > 200) throw AppError.badRequest(`El valor de "${k}" es demasiado largo.`);
      url.searchParams.set(k, value);
    }
    return url;
  }

  /** GET al conector con límites de tiempo, tamaño y sin seguir redirecciones. */
  async call(userId: number, name: string, path?: string, params?: Record<string, unknown>) {
    const c = await this.get(userId, name);
    if (!c.enabled) throw AppError.badRequest(`El conector "${c.name}" está desactivado.`);
    if (c.auth_type !== 'none' && !c.secret_encrypted) {
      throw AppError.badRequest(`El conector "${c.name}" necesita su clave. El usuario debe agregarla en Integraciones → Conectores de API.`);
    }

    const url = this.buildUrl(c.base_url, path, params);
    await assertPublicHost(url.hostname);
    const headers: Record<string, string> = { Accept: 'application/json, text/plain;q=0.8', 'User-Agent': 'Controla-Assistant/1.0' };
    if (c.auth_type !== 'none') {
      const secret = decryptSecret(c.secret_encrypted!);
      if (c.auth_type === 'header') headers[c.auth_name!] = secret;
      else url.searchParams.set(c.auth_name!, secret);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await connectorHttp.fetch(url.toString(), { method: 'GET', headers, redirect: 'manual', signal: controller.signal });
      execute('UPDATE ai_connectors SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [c.id]).catch(() => undefined);

      if (res.status >= 300 && res.status < 400) {
        return { status: res.status, note: 'La API respondió con una redirección; no se sigue por seguridad.' };
      }

      // Lee como máximo MAX_BYTES
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      let truncated = false;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_BYTES) {
            truncated = true;
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      const text = Buffer.concat(chunks).toString('utf8');
      const type = res.headers.get('content-type') ?? '';
      let data: unknown = text;
      if (!truncated && type.includes('json')) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      let serialized = typeof data === 'string' ? data : JSON.stringify(data);
      if (serialized.length > MAX_TEXT_FOR_MODEL) {
        truncated = true;
        serialized = serialized.slice(0, MAX_TEXT_FOR_MODEL);
        data = serialized;
      }
      // La clave nunca debe volver al modelo aunque la API la refleje
      if (c.auth_type !== 'none') {
        const secret = decryptSecret(c.secret_encrypted!);
        if (secret && serialized.includes(secret)) data = serialized.split(secret).join('[CLAVE OCULTA]');
      }
      return { status: res.status, ok: res.ok, url_path: url.pathname, truncated, data };
    } catch (err) {
      if (err instanceof AppError) throw err;
      if ((err as Error).name === 'AbortError') throw new AppError('La API externa tardó demasiado en responder.', 504);
      throw new AppError('No pude conectarme a la API externa.', 502);
    } finally {
      clearTimeout(timer);
    }
  }
}

export const connectorsService = new ConnectorsService();
