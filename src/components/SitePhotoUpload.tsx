'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { photoKinds } from '@/lib/site';
import { uploadSitePhoto } from '@/app/(app)/site-actions';
import { Choice } from './Choice';

/** Many photos at once, sent one by one (each request stays under 4 MB). */
export function SitePhotoUpload({ projectId }: { projectId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form ref={form} className="stack-form" onSubmit={(e) => {
      e.preventDefault();
      const d = new FormData(e.currentTarget);
      const list = d.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);
      if (!list.length) { setMsg('Pick one or more photos.'); return; }
      setErrors([]);
      start(async () => {
        const errs: string[] = [];
        for (const [i, f] of list.entries()) {
          setMsg(`Sending ${i + 1} of ${list.length}…`);
          const one = new FormData();
          for (const k of ['projectId', 'kind', 'onSite']) { const v = d.get(k); if (v !== null) one.set(k, v); }
          one.set('sort', String(Number(d.get('sort') ?? 0) + i));
          one.set('file', f);
          const r = await uploadSitePhoto(one).catch(() => ({ error: `${f.name}: couldn’t be sent.` }));
          if (r.error) errs.push(r.error);
        }
        setErrors(errs);
        setMsg(`Added ${list.length - errs.length} of ${list.length}.`);
        if (errs.length < list.length) form.current?.reset();
        router.refresh();
      });
    }}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="fields">
        <label className="f">Photos<span className="h">JPEG, PNG, WebP or HEIC, up to 4 MB each</span><input type="file" name="files" accept="image/*" multiple required /></label>
        <Choice name="kind" label="They Are" options={photoKinds} defaultValue="after" color="aqua" />
        <label className="f">Order From<span className="h">Lower shows first</span><input name="sort" type="number" min={0} max={999} defaultValue={0} /></label>
      </div>
      <label className="check"><input type="checkbox" name="onSite" defaultChecked /> Show on the website</label>
      {msg ? <div className="notice" role="status">{msg}</div> : null}
      {errors.length ? <div className="notice error" role="alert"><ul>{errors.map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null}
      <div className="form-actions"><button className="btn" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Add Photos'}</button></div>
    </form>
  );
}
