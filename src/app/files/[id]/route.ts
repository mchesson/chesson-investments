import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { files } from '@/db/schema';
import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';
import { isUuid } from '@/lib/forms';
import { getObject } from '@/lib/storage';
import { downloadName, fileNeed, previewKind } from '@/lib/file-view';

// A saved file's bytes. Shown in the page (?inline=1, and web images) or
// downloaded (?download=1, and anything a browser can't show). Who may open
// it depends on what it belongs to (src/lib/file-view.ts).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user || !isUuid(id)) return new Response('Not found', { status: 404 });
  const [f] = await db.select().from(files).where(eq(files.id, id));
  if (!f || f.archived || !can(user, fileNeed(f.entity))) return new Response('Not found', { status: 404 });
  const body = f.data ?? (f.storagePath ? await getObject(f.storagePath).catch(() => null) : null);
  if (!body) return new Response('The file couldn’t be read from storage.', { status: 502 });
  const q = new URL(req.url).searchParams;
  const kind = previewKind(f.contentType);
  const inline = !q.has('download') && kind !== 'download' && (q.has('inline') || kind === 'image');
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': f.contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${downloadName(f.name)}"`,
      'Content-Length': String(body.length),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      // A PDF shown in the app's own page only.
      'Content-Security-Policy': "frame-ancestors 'self'",
    },
  });
}
