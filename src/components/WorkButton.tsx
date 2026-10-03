'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FormResult } from './ActionForm';
import { toast } from './Toast';
import { runWork } from '@/lib/work-client';
import type { LongJob } from '@/lib/long-work';

/**
 * A button for long work (reading documents, finding every property's zoning):
 * it runs as its own request, so the rest of the app stays clickable while it
 * goes (src/lib/long-work.ts). Says how it went, like ActionButton.
 */
export function WorkButton(props: { job: LongJob; args?: unknown[]; label: string; busyLabel?: string; done: string; className?: string; confirm?: string; dataK?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button" className={props.className ?? 'btn small'} disabled={busy} data-k={props.dataK}
      onClick={async () => {
        if (props.confirm && !window.confirm(props.confirm)) return;
        setBusy(true);
        try {
          const r = await runWork<FormResult>(props.job, ...(props.args ?? []));
          if (r && r.error) toast(r.error, 'error'); else toast(r && r.ok ? r.ok : props.done);
          router.refresh();
        } catch (e) {
          toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', 'error');
        } finally { setBusy(false); }
      }}
    >{busy ? props.busyLabel ?? 'Working…' : props.label}</button>
  );
}
