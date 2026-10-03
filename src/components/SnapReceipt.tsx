'use client';

import { useState } from 'react';
import { ActionForm } from './ActionForm';
import { SearchPicker, type PickOption } from './SearchPicker';
import { runWorkForm } from '@/lib/work-client';
import { saveReceipt, type ReceiptReading } from '@/app/(app)/receipt-actions';
import { overheadCategories } from '@/lib/overhead';
import { HOLDING_KINDS } from '@/lib/cost-codes';

/** A phone photo is shrunk before it's sent (a camera photo can be 5 MB; 2,000 px is plenty to read). */
async function shrink(f: File): Promise<File> {
  if (!f.type.startsWith('image/') || f.size < 1_500_000) return f;
  try {
    const img = await createImageBitmap(f);
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; } // a format the browser can't draw (HEIC on a computer): sent as it is
}

/** Snap a Receipt (owner, Oct 3, 2026: "take a pic and send"): photo → what was read → confirm → saved. */
export function SnapReceipt({ places, codes, projectId }: { places: PickOption[]; codes: { id: string; label: string }[]; projectId: string | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [r, setR] = useState<ReceiptReading | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [n, setN] = useState(0); // a new form after each save

  async function picked(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    setBusy(true); setError(null); setR(null);
    try {
      const small = await shrink(f);
      if (small.type.startsWith('image/')) setPreview(URL.createObjectURL(small));
      const form = new FormData(); form.set('file', small);
      if (projectId) form.set('projectId', projectId);
      const out = await runWorkForm<ReceiptReading | { error: string }>('readReceipt', form);
      if ('error' in out) setError(out.error); else setR(out);
    } catch (e) { setError(e instanceof Error ? e.message : 'It didn’t send. Try again.'); }
    setBusy(false);
  }

  if (!r) return (
    <div className="snap">
      <label className="btn snap-btn">
        {busy ? 'Reading the Receipt…' : 'Take a Photo of the Receipt'}
        <input type="file" accept="image/*,application/pdf" capture="environment" hidden disabled={busy} onChange={(e) => picked(e.target.files)} />
      </label>
      <label className="link-btn small">Or choose a photo or PDF<input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={(e) => picked(e.target.files)} /></label>
      {error ? <div className="notice error" role="alert">{error}</div> : null}
      <p className="small muted">The receipt is read for the store, the total and the date. You check it before it’s saved.</p>
    </div>
  );

  const defaultWhere = r.where ? `${r.where.kind}:${r.where.id}` : null;
  return (
    <div className="snap-confirm" key={n}>
      {preview ? <img src={preview} alt="The receipt" className="snap-preview" /> : null}
      <p className="small muted" style={{ margin: 0 }}>{r.read ? 'Here’s what was read. Fix anything that’s wrong, then save.' : 'The receipt couldn’t be read here: fill in what it says.'}</p>
      <ActionForm action={saveReceipt} submit="Save the Receipt" saved="Receipt saved.">
        <input type="hidden" name="fileId" value={r.fileId} />
        <SearchPicker name="where" label="What It Was For" required placeholder="Type the property or the business" options={places} defaultId={defaultWhere} />
        <div className="fields">
          <label className="f">Paid To<input name="vendor" required defaultValue={r.vendor ?? ''} placeholder="Home Depot" /></label>
          <label className="f">Total<input name="amount" required inputMode="decimal" defaultValue={r.amount ?? ''} placeholder="84.17" /></label>
          <label className="f">Date<input name="spentOn" type="date" defaultValue={r.spentOn ?? ''} /></label>
          <label className="f">Paid With<span className="h">Optional</span><input name="paidHow" placeholder="Business card, cash" /></label>
        </div>
        <fieldset className="f">
          <legend>For a Property</legend>
          <div className="fields">
            <label className="f">Kind of Cost<select name="lineKind" defaultValue="build"><option value="build">Build cost</option><option value="holding">Holding cost</option></select></label>
            <label className="f">Cost Code<span className="h">For a build cost</span><select name="costCodeId" defaultValue=""><option value="">Pick one</option>{codes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="f">Holding Cost Kind<select name="holdingKind" defaultValue="Other">{HOLDING_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}</select></label>
          </div>
        </fieldset>
        <fieldset className="f">
          <legend>For Business Overhead</legend>
          <label className="f">Category<select name="category" defaultValue={r.category ?? 'other'}>{overheadCategories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
        </fieldset>
        <label className="f">Notes<input name="notes" /></label>
      </ActionForm>
      <button type="button" className="btn secondary small" onClick={() => { setR(null); setPreview(null); setN((x) => x + 1); }}>Next Receipt</button>
    </div>
  );
}
