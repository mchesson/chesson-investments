import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { files } from '@/db/schema';
import { currentUser } from '@/lib/session';
import { can, type Permission } from '@/lib/permissions';
import { isUuid } from '@/lib/forms';
import { getObject } from '@/lib/storage';

// Who may open a file depends on what it belongs to.
const need: Record<string, Permission> = { property: 'properties.view', project: 'projects.view', daily_log: 'projects.view', bill: 'money.view' };

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await currentUser();
  if (!user || !isUuid(id)) return new Response('Not found', { status: 404 });
  const [f] = await db.select().from(files).where(eq(files.id, id));
  if (!f || f.archived || !can(user.role, need[f.entity] ?? 'users.manage')) return new Response('Not found', { status: 404 });
  const body = f.data ?? (f.storagePath ? await getObject(f.storagePath) : null);
  if (!body) return new Response('Not found', { status: 404 });
  const inline = new URL(req.url).searchParams.has('inline') || f.contentType.startsWith('image/');
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': f.contentType,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${f.name.replace(/[^\w.\- ]/g, '_')}"`,
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
