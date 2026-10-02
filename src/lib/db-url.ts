// Supabase's pooler in session mode (port 5432) instead of transaction mode
// (6543). Transaction mode now and then forwarded a query without its closing
// Sync, leaving the database waiting forever with the connection open, and the
// app froze behind it (Oct 2, 2026, with both postgres.js and pg). Session mode
// passes each connection straight through. Its client limit is the pool size,
// raised from 15 to 40 (owner's go-ahead, Oct 2, 2026). Pure, tested.
export function sessionUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith('.pooler.supabase.com') && u.port === '6543') { u.port = '5432'; return u.toString(); }
  } catch { /* not a URL: use as given */ }
  return raw;
}
