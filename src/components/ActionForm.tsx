'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';

export type FormResult = { error?: string; ok?: string } | null | undefined | void;
type Action = (prev: FormResult, data: FormData) => Promise<FormResult>;

/** A form for a Server Action: shows its error or message; resets after a success when asked. */
export function ActionForm(props: {
  action: Action; children: ReactNode; className?: string; resetOnOk?: boolean; confirm?: string; submit?: string; submitClass?: string;
}) {
  const [state, run, pending] = useActionState(props.action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state?.ok && props.resetOnOk) ref.current?.reset(); }, [state, props.resetOnOk]);
  return (
    <form
      ref={ref}
      action={run}
      className={props.className ?? 'stack-form'}
      onSubmit={(e) => { if (props.confirm && !window.confirm(props.confirm)) e.preventDefault(); }}
    >
      {state?.error ? <div className="notice error" role="alert">{state.error}</div> : null}
      {state?.ok ? <div className="notice" role="status">{state.ok}</div> : null}
      {props.children}
      {props.submit ? (
        <div className="form-actions">
          <button className={props.submitClass ?? 'btn'} type="submit" disabled={pending}>{pending ? 'Saving…' : props.submit}</button>
        </div>
      ) : null}
    </form>
  );
}
