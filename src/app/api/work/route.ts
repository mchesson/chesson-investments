import { NextResponse } from 'next/server';
import { isLongJob, type LongJob } from '@/lib/long-work';
import { dropSmall, finishDrop, readAgain, startDrop } from '@/app/(app)/doc-drop-actions';
import { placeOurPlaces, startMarketSync, stepMarketSync, updateEverything, updateFeed } from '@/app/(app)/market-actions';
import { findLocationsAndZoning } from '@/app/(app)/locate-actions';
import { readCompsFromDocument } from '@/app/(app)/comp-actions';
import { readReceipt } from '@/app/(app)/receipt-actions';

// Long work, run as its own request so the rest of the app stays clickable
// (src/lib/long-work.ts). Each job checks its own permission, exactly as when
// it was a button.
export const maxDuration = 300;

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const jobs: Partial<Record<LongJob, (a: unknown[], form: FormData | null) => Promise<unknown>>> = {
  startDrop: (a) => startDrop(str(a[0]), Number(a[1]) || 0),
  finishDrop: (a) => finishDrop(str(a[0]), str(a[1]), str(a[2])),
  dropSmall: (_a, form) => dropSmall(form ?? new FormData()),
  readAgain: () => readAgain(),
  startMarketSync: (a) => startMarketSync(str(a[0])),
  stepMarketSync: (a) => stepMarketSync(str(a[0])),
  updateFeed: (a) => updateFeed(str(a[0])),
  updateEverything: (a) => updateEverything(str(a[0])),
  placeOurPlaces: () => placeOurPlaces(),
  findLocationsAndZoning: () => findLocationsAndZoning(),
  readCompsFromDocument: (a) => readCompsFromDocument(str(a[0]), str(a[1])),
  readReceipt: (_a, form) => readReceipt(form ?? new FormData()),
};

export async function POST(req: Request) {
  // Only our own pages: a form from elsewhere can't start work as the signed-in person.
  const origin = req.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: 'Not allowed.' }, { status: 403 });
  let job: unknown, args: unknown[] = [], form: FormData | null = null;
  if ((req.headers.get('content-type') ?? '').startsWith('multipart/form-data')) {
    form = await req.formData();
    job = form.get('job');
  } else {
    const body = await req.json().catch(() => ({})) as { job?: unknown; args?: unknown };
    job = body.job;
    args = Array.isArray(body.args) ? body.args : [];
  }
  if (!isLongJob(job)) return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  const run = jobs[job];
  if (!run) return NextResponse.json({ error: 'Unknown job.' }, { status: 400 });
  try {
    const result = await run(args, form);
    return NextResponse.json({ result: result ?? null });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Something went wrong.';
    return NextResponse.json({ error: message }, { status: /access/i.test(message) ? 403 : 500 });
  }
}
