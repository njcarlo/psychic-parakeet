import pg from 'pg';
import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000
});

export type DbClient = Pick<PoolClient, 'query'>;
export type DbExecutor = typeof pool | PoolClient | DbClient;

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client: DbExecutor = pool
): Promise<QueryResult<T>> {
  return client.query<T>(text, params);
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function withBusinessContext<T>(businessId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withTransaction(async (client) => {
    await client.query('SELECT set_config($1, $2, true)', ['app.current_business_id', businessId]);
    return fn(client);
  });
}

export async function setBusinessContext(client: PoolClient, businessId: string): Promise<void> {
  await client.query('SELECT set_config($1, $2, true)', ['app.current_business_id', businessId]);
}

export type { PoolClient, QueryResult, QueryResultRow };
