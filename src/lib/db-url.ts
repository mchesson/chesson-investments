// Supabase's pooler in session mode (port 5432) instead of transaction mode
// (6543), which froze the app (see src/db/index.ts). Pure, tested.
export function sessionUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith('.pooler.supabase.com') && u.port === '6543') { u.port = '5432'; return u.toString(); }
  } catch { /* not a URL: use as given */ }
  return raw;
}
