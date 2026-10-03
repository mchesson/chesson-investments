'use client';

import { useTransition } from 'react';
import type { FormResult } from './ActionForm';
import { failure, toast } from './Toast';

/**
 * A one-click save (Done, Approve, Restore, Take Off...) that says how it went.
 * `action` is a bound server action; `done` is what to say when it worked.
 */
export function ActionButton(props: {
  action: () => Promise<FormResult | void>; label: string; done: string; className?: string; confirm?: string; dataK?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button" className={props.className ?? 'btn small'} disabled={pending} data-k={props.dataK}
      onClick={() => {
        if (props.confirm && !window.confirm(props.confirm)) return;
        start(async () => {
          try {
            const r = await props.action();
            if (r && r.error) toast(r.error, 'error');
            else toast(r && r.ok ? r.ok : props.done);
          } catch (e) {
            const msg = failure(e);
            if (msg) toast(msg, 'error'); else { toast(props.done); throw e; }
          }
        });
      }}
    >{pending ? 'Saving…' : props.label}</button>
  );
}
