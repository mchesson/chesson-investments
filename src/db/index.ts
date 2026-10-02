import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Supabase transaction pooler (port 6543) in production: no prepared statements.
const url = process.env.DATABASE_URL ?? 'postgres://ci:ci@localhost:5432/ci';
const g = globalThis as unknown as { __ciSql?: ReturnType<typeof postgres> };
const client = g.__ciSql ?? postgres(url, { max: 5, prepare: false, idle_timeout: 20, connect_timeout: 15 });
if (process.env.NODE_ENV !== 'production') g.__ciSql = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type Reader = Db | Tx;
