import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Production goes through Supabase's pooler. Its transaction mode (port 6543)
// froze the app (Oct 2, 2026): queries started together left database
// connections "active, waiting for the client" with a transaction open, and
// every page waiting behind them hung. max_pipeline: 1 didn't stop it. So the
// app uses the pooler's session mode (same host, port 5432): each app
// connection keeps its own database connection, nothing is split between them.
// sessionUrl() (src/lib/db-url.ts) switches a 6543 pooler address to 5432.
// Back on the transaction pooler (6543): session mode's 15-client limit was
// used up by Vercel's many server instances and every page failed (Oct 2, 2026).
const url = process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci';
const g = globalThis as unknown as { __ciSql?: ReturnType<typeof postgres> };
// max_pipeline is a real postgres.js option (default 100) missing from its types.
// Session mode allows 15 connections in all (pool_size), so each server
// instance keeps at most 2 and frees them after 5 idle seconds; the public
// website reads from a cache (src/lib/site-data.ts).
const options = {
  max: 3, prepare: false, idle_timeout: 5, connect_timeout: 15, max_pipeline: 1,
} as postgres.Options<{}>;
const client = g.__ciSql ?? postgres(url, options);
if (process.env.NODE_ENV !== 'production') g.__ciSql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Reader = Db | Tx;
