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

/** A one-time address the browser uploads one file to directly (big files skip the app's 4 MB limit). */
export async function signedUpload(path: string): Promise<string> {
  const c = cfg();
  if (!c) throw new Error('Storage is not set up.');
  const r = await fetch(`${c.url}/storage/v1/object/upload/sign/${c.bucket}/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${c.key}`, 'Content-Type': 'application/json' }, body: '{}' });
  if (!r.ok) throw new Error(`Storage refused (${r.status}).`);
  const j = (await r.json()) as { url?: string };
  if (!j.url) throw new Error('Storage gave no upload address.');
  return `${c.url}/storage/v1${j.url}`;
}

export async function removeObject(path: string) {
  const c = cfg();
  if (!c) return;
  await fetch(`${c.url}/storage/v1/object/${c.bucket}/${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${c.key}` } }).catch(() => null);
}
