// Runs drizzle migrations against the configured DATABASE_URL.
// Used by the Docker entrypoint and `npm run db:migrate`.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const ssl =
  process.env.DATABASE_SSL === 'require'
    ? { rejectUnauthorized: true }
    : process.env.DATABASE_SSL === 'loose'
      ? { rejectUnauthorized: false }
      : undefined;

const pool = new pg.Pool({ connectionString: url, ssl, max: 1 });

// Wait for the database to accept connections (up to ~60s).
const maxAttempts = 30;
for (let i = 1; i <= maxAttempts; i++) {
  try {
    const client = await pool.connect();
    client.release();
    break;
  } catch (err) {
    if (i === maxAttempts) {
      console.error(`Could not connect to Postgres after ${maxAttempts} attempts:`, err.message);
      process.exit(1);
    }
    console.log(`[migrate] Postgres not ready (attempt ${i}/${maxAttempts}) — retrying in 2s`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

const db = drizzle(pool);
console.log('[migrate] applying migrations from ./drizzle');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done');
await pool.end();
