// Runs every migration in drizzle/ (production builds run it first: vercel-build).
// Each migration waits at most 5 s for a lock and is retried, so a busy table
// never makes the whole site hang behind an ALTER TABLE.
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  if (process.env.VERCEL) throw new Error('DATABASE_URL is not set');
  console.log('No DATABASE_URL: using the local database.');
}
const sql = postgres(url ?? 'postgres://ci:ci@localhost:5432/ci', { max: 1, prepare: false, onnotice: () => {} });

for (let attempt = 1; ; attempt++) {
  try {
    await sql`set lock_timeout = '5s'`;
    await migrate(drizzle(sql), { migrationsFolder: 'drizzle' });
    console.log('Migrations applied.');
    break;
  } catch (e) {
    if (attempt >= 6) throw e;
    console.warn(`Migration attempt ${attempt} failed (${(e as Error).message}); trying again in 10 s.`);
    await new Promise((r) => setTimeout(r, 10_000));
  }
}
await sql.end();
