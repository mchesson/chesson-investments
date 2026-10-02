import 'server-only';

// Private Supabase Storage bucket when SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// and SUPABASE_BUCKET are all set; otherwise files stay in the database row.
// The key never reaches the browser: every download goes through /files/<id>.
const cfg = () => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY, bucket = process.env.SUPABASE_BUCKET;
  return url && key && bucket ? { url: url.replace(/\/$/, ''), key, bucket } : null;
};

export const storageOn = () => !!cfg();

export async function putObject(path: string, data: Buffer, contentType: string) {
  const c = cfg()!;
  const r = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${c.key}`, 'Content-Type': contentType, 'x-upsert': 'false' }, body: new Uint8Array(data),
  });
  if (!r.ok) throw new Error(`Storage refused the file (${r.status}).`);
}

export async function getObject(path: string): Promise<Buffer> {
  const c = cfg();
  if (!c) throw new Error('Storage is not set up.');
  const r = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, { headers: { Authorization: `Bearer ${c.key}` } });
  if (!r.ok) throw new Error(`Storage refused (${r.status}).`);
  return Buffer.from(await r.arrayBuffer());
}
