import 'server-only';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';
import { sessionUrl } from '@/lib/db-url';

// The database, through Supabase's session pooler (port 5432; sessionUrl in
// src/lib/db-url.ts explains why not transaction mode), with node-postgres and
// Vercel's attachDatabasePool so a paused instance closes its idle connection.
// One connection per server instance: the pool size (40 clients in all) is
// shared by every instance. Each statement gives up after 25 seconds.
const url = sessionUrl(process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci');
const g = globalThis as unknown as { __ciPool?: Pool };
const pool = g.__ciPool ?? new Pool({
  connectionString: url,
  max: 1,
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
