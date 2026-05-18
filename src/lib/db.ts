import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

type DB = NodePgDatabase<typeof schema>;

let _db: DB | null = null;
let _pool: Pool | null = null;

function init(): DB {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. See .env.example.');
  }
  _pool = new Pool({
    connectionString: url,
    // Allow self-signed certs when DATABASE_SSL=loose (e.g. for Neon set "require")
    ssl:
      process.env.DATABASE_SSL === 'require'
        ? { rejectUnauthorized: true }
        : process.env.DATABASE_SSL === 'loose'
          ? { rejectUnauthorized: false }
          : undefined,
    max: 5,
  });
  return drizzle(_pool, { schema });
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    if (!_db) _db = init();
    return (_db as any)[prop];
  },
});

export function getPool(): Pool {
  if (!_pool) _db = init();
  return _pool!;
}

export { schema };
