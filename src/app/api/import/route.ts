import { applyImport, previewImport, type Summary } from '@/app/(app)/import-actions';
import { currentUser } from '@/lib/session';
import { can } from '@/lib/permissions';

// The Import page's preview and import, as a plain request (Oct 2, 2026: the
// server action sat on "Working…" in production with nothing logged). Every
// step is logged with its time, so a failure shows up in Vercel's logs.
export const maxDuration = 120;

export async function POST(req: Request) {
  const t0 = Date.now();
  const origin = req.headers.get('origin');
  if (!origin || new URL(origin).host !== new URL(req.url).host) return Response.json({ error: 'Not allowed.' }, { status: 403 });
  const user = await currentUser();
  if (!user || !can(user.role, 'users.manage')) return Response.json({ error: 'Only the owner can import.' }, { status: 403 });
  const mode = new URL(req.url).searchParams.get('mode');
  const text = await req.text();
  console.info(`[import] ${mode} start: ${text.length} characters`);
  try {
    const sum: Summary = mode === 'apply' ? await applyImport(text) : await previewImport(text);
    console.info(`[import] ${mode} done in ${Date.now() - t0} ms${sum.error ? `: ${sum.error}` : ''}`);
    return Response.json(sum);
  } catch (e) {
    console.error(`[import] ${mode} failed after ${Date.now() - t0} ms`, e);
    return Response.json({ error: `The import stopped with an error: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }
}
