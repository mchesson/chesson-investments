import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';

// The database, through Supabase's transaction pooler (port 6543) in production.
//
// Driver: node-postgres (pg), with Vercel's attachDatabasePool (Oct 2, 2026).
// With postgres.js the app froze again and again: queries left pooler
// connections "active, waiting for the client" with a transaction open
// (pg_stat_activity), and every page waiting behind them hung. max_pipeline: 1
// didn't stop it, and the session pooler (5432) ran out of its 15 clients on
// Vercel's many server instances. pg sends each query as one complete message,
// and attachDatabasePool keeps a paused Vercel instance alive long enough to
// close its idle connections, so none is left half-used on the pooler.
// Every statement also gives up after 25 seconds (client side), so one stuck
// query fails that page instead of hanging it.
const url = process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci';
const g = globalThis as unknown as { __ciPool?: Pool };
const pool = g.__ciPool ?? new Pool({
  connectionString: url,
  max: 3,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 15_000,
  query_timeout: 25_000,
});
if (!g.__ciPool) {
  // A connection that drops while idle mustn't crash the server.
  pool.on('error', (e) => console.error('[db] idle connection error', e.message));
  attachDatabasePool(pool);
}
if (process.env.NODE_ENV !== 'production') g.__ciPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Reader = Db | Tx;
