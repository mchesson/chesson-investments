'use client';

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from 'react';

export type FormResult = { error?: string; ok?: string } | null | undefined | void;
type Action = (prev: FormResult, data: FormData) => Promise<FormResult>;

/**
 * A form for a Server Action: shows its error or message; resets after a success when asked.
 * Submitted by hand (not the form's action prop) so an error keeps what was typed:
 * React otherwise clears the form after every submit.
 */
export function ActionForm(props: {
  action: Action; children: ReactNode; className?: string; resetOnOk?: boolean; confirm?: string; submit?: string; submitClass?: string;
}) {
  const [state, run, pending] = useActionState(props.action, null);
  const ref = useRef<HTMLFormElement>(null);
  // After a save that worked, clear the form as React would; after an error, keep what was typed.
  const submitted = useRef(false);
  useEffect(() => {
    if (pending || !submitted.current) return;
    submitted.current = false;
    if (!state?.error) ref.current?.reset();
  }, [pending, state]);
  return (
    <form
      ref={ref}
      className={props.className ?? 'stack-form'}
      onSubmit={(e) => {
        e.preventDefault();
        if (props.confirm && !window.confirm(props.confirm)) return;
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        submitted.current = true;
        startTransition(() => run(data));
      }}
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
