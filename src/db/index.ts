import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { sessionUrl } from '@/lib/db-url';

// Production goes through Supabase's pooler. Its transaction mode (port 6543)
// froze the app (Oct 2, 2026): queries started together left database
// connections "active, waiting for the client" with a transaction open, and
// every page waiting behind them hung. max_pipeline: 1 didn't stop it. So the
// app uses the pooler's session mode (same host, port 5432): each app
// connection keeps its own database connection, nothing is split between them.
// sessionUrl() (src/lib/db-url.ts) switches a 6543 pooler address to 5432.
const url = sessionUrl(process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci');
const g = globalThis as unknown as { __ciSql?: ReturnType<typeof postgres> };
// max_pipeline is a real postgres.js option (default 100) missing from its types.
// Few connections per server instance: session mode holds one database
// connection per app connection, and they're freed after 20 idle seconds.
const options = {
  max: 3, prepare: false, idle_timeout: 20, connect_timeout: 15, max_pipeline: 1,
} as postgres.Options<{}>;
const client = g.__ciSql ?? postgres(url, options);
if (process.env.NODE_ENV !== 'production') g.__ciSql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Reader = Db | Tx;
