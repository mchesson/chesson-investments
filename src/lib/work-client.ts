'use client';
import type { LongJob } from './long-work';

/** Runs a long job (src/lib/long-work.ts) as its own request: the rest of the page stays clickable. */
export async function runWork<T>(job: LongJob, ...args: unknown[]): Promise<T> {
  const r = await fetch('/api/work', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ job, args }) });
  return answer<T>(r);
}
/** The same with a file (FormData gets the job's name added). */
export async function runWorkForm<T>(job: LongJob, form: FormData): Promise<T> {
  form.set('job', job);
  return answer<T>(await fetch('/api/work', { method: 'POST', body: form }));
}
async function answer<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => null) as { result?: T; error?: string } | null;
  if (!r.ok || !body || body.error) throw new Error(body?.error ?? (r.status === 504 ? 'That took too long. Try again.' : `It didn’t go through (${r.status}). Try again.`));
  return body.result as T;
}
