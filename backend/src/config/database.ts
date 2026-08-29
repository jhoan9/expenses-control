import { Pool, PoolClient, QueryResult, types } from 'pg';
import { env } from './env';

// PostgreSQL DATE (OID 1082): return 'YYYY-MM-DD' as string
// instead of a Date object at UTC midnight (avoids off-by-one display
// errors in timezones behind UTC, e.g. Colombia UTC-5)
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  options: '-c search_path=expenses_control',
  ...(env.DB_SSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const query = async <T = any>(
  sql: string,
  values?: any[],
  client?: PoolClient
): Promise<T[]> => {
  const result: QueryResult = client
    ? await client.query(sql, values)
    : await pool.query(sql, values);
  return result.rows as T[];
};

export const queryOne = async <T = any>(
  sql: string,
  values?: any[],
  client?: PoolClient
): Promise<T | null> => {
  const rows = await query<T>(sql, values, client);
  return rows.length > 0 ? rows[0] : null;
};

export interface ExecuteResult {
  rows: any[];
  rowCount: number;
}

export const execute = async (
  sql: string,
  values?: any[],
  client?: PoolClient
): Promise<ExecuteResult> => {
  const result: QueryResult = client
    ? await client.query(sql, values)
    : await pool.query(sql, values);
  return { rows: result.rows, rowCount: result.rowCount ?? 0 };
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const testConnection = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
};

export default pool;
