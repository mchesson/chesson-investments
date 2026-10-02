import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase transaction pooler (port 6543) in production: no prepared statements,
// and one query at a time per connection (max_pipeline: 1). With pipelining,
// queries started together (Promise.all) were sent down one pooled connection
// back to back; the pooler mixed them up and left the connection "active"
// waiting for the client, freezing every page that used it (Oct 2, 2026; the
// same fix TS Workspace uses). Each statement also gives up after 20 seconds.
const url = process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci';
const g = globalThis as unknown as { __ciSql?: ReturnType<typeof postgres> };
// max_pipeline is a real postgres.js option (default 100) missing from its types.
const options = {
  max: 5, prepare: false, idle_timeout: 20, connect_timeout: 15, max_pipeline: 1,
  connection: { statement_timeout: 20_000, idle_in_transaction_session_timeout: 30_000 },
} as postgres.Options<{}>;
const client = g.__ciSql ?? postgres(url, options);
if (process.env.NODE_ENV !== 'production') g.__ciSql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Reader = Db | Tx;
