import { revalidatePath, revalidateTag } from 'next/cache';
import { isAutoPart, runAutoUpdate } from '@/lib/market-auto';
import { FEEDS_TAG } from '@/lib/market-feeds-data';
import { ZONES_TAG } from '@/lib/buy-box-data';

// The twice-daily market update (vercel.json crons), called by Vercel with
// CRON_SECRET. ?part=counties | feeds | places, each its own run.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Not allowed.' }, { status: 401 });
  const part = new URL(req.url).searchParams.get('part');
  if (!isAutoPart(part)) return Response.json({ error: 'part: counties, feeds or places' }, { status: 400 });
  // Redfin's files are weekly and take a couple of minutes: the morning run only.
  const morning = new Date().getUTCHours() < 16;
  const r = await runAutoUpdate(part, { budgetMs: 270_000, redfin: morning });
  revalidateTag(FEEDS_TAG, 'max');
  revalidateTag(ZONES_TAG, 'max');
  revalidatePath('/market');
  revalidatePath('/projects');
  revalidatePath('/watchlist');
  return Response.json(r);
}
