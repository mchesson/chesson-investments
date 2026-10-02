import { isUuid } from '@/lib/forms';
import { publicPhoto } from '@/lib/site-data';
import { getObject } from '@/lib/storage';

// The website's photos: no sign-in, but only photos marked for the website on a
// published project (everything else is a 404, like a missing page).
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const f = isUuid(id) ? await publicPhoto(id) : null;
  const body = f ? f.data ?? (f.storagePath ? await getObject(f.storagePath).catch(() => null) : null) : null;
  if (!f || !body) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: {
      'Content-Type': f.contentType,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=604800',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
